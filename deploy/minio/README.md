# MinIO source build

The deployment previously pulled `minio/minio:latest`. That repository is
unavailable. The community project's official README now documents source-only
distribution and says it is no longer maintained:
https://github.com/minio/minio

This image builds official release `RELEASE.2025-10-15T17-29-55Z`, pinned to
commit `9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a`. It does not depend on a
prebuilt MinIO image. The source revision is pinned; base image tags are not
immutable, so this is not a fully reproducible build.

Compose retains the existing MinIO service name, command, network, credentials,
and `minio_data:/data` volume. Do not delete that volume to fix an image-pull
failure. The existing workflow builds all custom images before changing running
services; the first MinIO compilation can take several minutes and requires
access to GitHub, Go modules, Docker Hub base images, and Debian packages.

From the repository root on the Docker host:

```sh
docker compose --env-file "$HOME/.config/daymark/production.env" -f deploy/compose.prod.yml config --quiet
docker compose --env-file "$HOME/.config/daymark/production.env" -f deploy/compose.prod.yml build minio
docker compose --env-file "$HOME/.config/daymark/production.env" -f deploy/compose.prod.yml run --rm --no-deps minio --version
docker compose --env-file "$HOME/.config/daymark/production.env" -f deploy/compose.prod.yml up -d --build --remove-orphans
docker compose --env-file "$HOME/.config/daymark/production.env" -f deploy/compose.prod.yml exec -T minio curl -fsS http://127.0.0.1:9000/minio/health/ready
```

The direct binary entrypoint accepts the Compose `server /data` command and reads
`MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`. The image includes a readiness check,
CA certificates, and the upstream license/notice files. Upstream release-version
linker metadata is not injected, so `--version` can report a development build;
the OCI revision label identifies the pinned source.

This is a compatibility recovery for the existing homelab deployment, not a claim
that the archived release is receiving security updates. Plan a maintained
object-storage replacement separately, including an explicit data migration.
