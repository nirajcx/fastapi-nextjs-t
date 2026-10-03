"""Run with: python3 -m unittest discover -s deploy/tests -v.

Compose parsing requires the Docker CLI, not a running Docker daemon.
Deployment sequencing uses fake commands and never starts real services.
"""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class DeploymentTests(unittest.TestCase):
    def compose(self, filename, production=False):
        args = ['docker', 'compose']
        if production:
            args += ['--env-file', str(ROOT / 'deploy/.env.example')]
        args += ['-f', str(ROOT / 'deploy' / filename), 'config', '--format', 'json']
        return json.loads(subprocess.check_output(args, cwd=ROOT))

    def test_dev_is_self_contained(self):
        config = self.compose('compose.dev.yml')
        self.assertEqual(config['name'], 'daymark-dev')
        self.assertEqual(set(config['services']), {'postgres', 'redis', 'keycloak', 'minio', 'backend', 'frontend'})
        self.assertFalse(any(n.get('external') for n in config['networks'].values()))
        for service in config['services'].values():
            for port in service.get('ports', []):
                self.assertEqual(port['host_ip'], '127.0.0.1')
            for mount in service.get('volumes', []):
                if mount['type'] == 'bind':
                    self.assertTrue(Path(mount['source']).exists(), mount['source'])
        self.assertEqual(config['services']['backend']['environment']['ENVIRONMENT'], 'local')
        realm = json.loads((ROOT / 'deploy/keycloak/dev-realm.json').read_text())
        self.assertEqual(realm['realm'], 'todo-realm')
        self.assertIn('http://localhost:3000', realm['clients'][0]['redirectUris'])

    def test_production_retains_project_and_storage(self):
        config = self.compose('compose.prod.yml', production=True)
        self.assertEqual(config['name'], 'fastapi-nextjs-t')
        self.assertEqual(config['volumes']['minio_data']['name'], 'fastapi-nextjs-t_minio_data')
        self.assertEqual(config['services']['frontend']['build']['args']['NEXT_PUBLIC_API_URL'], '/api/v1')
        self.assertTrue(config['networks']['lab_default']['external'])
        for name in ['frontend', 'backend', 'minio']:
            build = config['services'][name]['build']
            self.assertTrue((Path(build['context']) / build['dockerfile']).is_file())

    def run_deploy(self, fail_build=False, missing_env=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            log = root / 'commands.log'
            config = root / 'production.env'
            if not missing_env:
                config.write_text('# Fake env: commands are mocked\n')
            docker = root / 'docker'
            docker.write_text('''#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$TEST_LOG"
if [[ "$*" == *" build" && "$FAIL_BUILD" == 1 ]]; then exit 17; fi
''')
            curl = root / 'curl'
            curl.write_text('''#!/usr/bin/env bash
if [[ "$*" == *"%{http_code}"* ]]; then printf 401; fi
''')
            docker.chmod(0o755)
            curl.chmod(0o755)
            env = dict(os.environ, PATH=f'{root}:{os.environ["PATH"]}',
                       DAYMARK_PROD_ENV=str(config), TEST_LOG=str(log),
                       FAIL_BUILD='1' if fail_build else '0')
            result = subprocess.run(['bash', str(ROOT / 'deploy/scripts/deploy.sh')],
                                    env=env, capture_output=True, text=True)
            return result, log.read_text() if log.exists() else ''

    def test_failed_build_does_not_deploy(self):
        result, log = self.run_deploy(fail_build=True)
        self.assertEqual(result.returncode, 17)
        self.assertNotIn(' up ', log)
        self.assertIn('logs --tail 100', log)

    def test_missing_config_does_not_touch_docker(self):
        result, log = self.run_deploy(missing_env=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Missing production configuration', result.stderr)
        self.assertEqual(log, '')

    def test_success_builds_before_up_then_checks_health(self):
        result, log = self.run_deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertLess(log.index(' build'), log.index(' up '))
        self.assertLess(log.index(' up '), log.index(' exec -T backend'))
        self.assertIn('checks passed', result.stdout)


if __name__ == '__main__':
    unittest.main()
