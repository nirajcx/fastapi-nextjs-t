# Deployment environments

Run all examples from the repository root. Compose resolves build contexts and
mounts relative to these YAML files, so they use `../backend` and `../frontend`.

## Development

```sh
docker compose -f deploy/compose.dev.yml up -d --build
```

This creates its own network, PostgreSQL database, Redis, development Keycloak,
MinIO, API and hot-reloading UI. No existing homelab services are needed.
PostgreSQL, Keycloak and MinIO data survive `down` in named volumes. Development
uses HTTP and `ENVIRONMENT=local`, so the browser can accept the local session
cookie. Frontend URLs use `localhost`; backend dependency URLs use Docker service
names. See the root README for credentials, URLs and reset commands.

## Production configuration

Copy `.env.example` to `$HOME/.config/daymark/production.env` on the runner host
and fill it in. `DAYMARK_PROD_ENV` can override this with an absolute path. Set the
GitHub repository variable of that name if the runner uses a different location.
Values containing `$`, `#` or spaces should be single-quoted in the env file;
URL-encode special characters within database URL passwords.

Required existing infrastructure:

- Docker daemon and Compose v2 accessible by the runner account, plus Bash and curl.
- External network `lab_default`, or the configured `HOMELAB_NETWORK`.
- PostgreSQL reachable by the configured hostname on that network, with the
  target application database already created.
- Keycloak realm `todo-realm` and public client `todo-app`, configured with your
  production frontend redirect URLs, logout URLs and web origin.
- A TLS reverse proxy for the frontend and browser-facing Keycloak endpoint.
- Available host ports 80, 8000, 6379, 9000 and 9001, matching the existing homelab
  bindings. Restrict access according to your network setup.

`NEXT_PUBLIC_API_URL=/api/v1` is built into the production frontend, so API calls
use the same origin and nginx proxies them to `backend:8000`. Keycloak's public
URL is also embedded at build time. Change configuration and rebuild the frontend
when changing it.

The script validates configuration, builds custom images, starts services, then
checks database readiness, the frontend, an unauthenticated API request through
nginx (expected 401), and MinIO readiness. Failures print container status/logs
and fail the workflow. This is not an automatic rollback or zero-downtime deploy.

## Self-hosted GitHub Actions

The workflow runs on `main` pushes or manual dispatch and selects a runner with
`self-hosted` and `Linux` labels. It has read-only repository permissions and
serializes production jobs without cancelling a deployment in progress.
Register a Linux runner for this repository and ensure its account has the
production env file and Docker access. The workflow does not run on PRs.

Use repository branch protections and trust only reviewed code on `main`: a
self-hosted deployment runs repository scripts with access to your homelab.
The first MinIO source build may be slow; the job permits up to 60 minutes.

## Moving an existing deployment

The old root `docker-compose.prod.yml` has moved to `deploy/compose.prod.yml`.
Update external commands to the new path. No containers or volumes are moved by
this repository edit.

Before the first deployment, find the EXISTING Compose project name:

```sh
docker inspect lab-minio --format '{{ index .Config.Labels "com.docker.compose.project" }}'
docker inspect lab-minio --format '{{range .Mounts}}{{println .Name .Destination}}{{end}}'
```

Set `COMPOSE_PROJECT_NAME` in the production env file to that name. The default
`fastapi-nextjs-t` matches the repository directory shown in the runner logs, but
inspect the existing container to confirm it. Keeping this name retains the
`<project>_minio_data` volume even though the Compose file moved. Preserve the
existing MinIO root credentials and database URL. Back up production data before
upgrading; do not run `down --volumes` to fix a deployment.

## Troubleshooting

```sh
docker compose --env-file "$HOME/.config/daymark/production.env" -f deploy/compose.prod.yml ps
docker compose --env-file "$HOME/.config/daymark/production.env" -f deploy/compose.prod.yml logs --tail 100 backend frontend minio
```

- **Missing environment variable:** configure the runner's production env file.
- **Network not found:** attach/use the existing homelab network; local dev does
  not require it.
- **502 from nginx:** inspect backend logs. Migrations run before Uvicorn, so a
  database or migration error can prevent startup.
- **Login succeeds but profile is unauthorized:** ensure production uses HTTPS;
  Secure cookies do not work on an HTTP LAN URL.
- **Local Keycloak account missing:** wait for readiness and check import logs;
  imports do not replace an existing realm.
- **Ports already in use:** stop conflicting local services or adjust host port
  mappings and corresponding browser URLs/Keycloak redirect configuration.
- **Frontend dependency problems:** restart the dev frontend to run `npm ci`.
