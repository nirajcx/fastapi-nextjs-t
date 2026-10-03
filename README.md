# Daymark — Todo app

Next.js frontend, FastAPI backend, PostgreSQL, Redis, and Keycloak authentication.
MinIO is included as S3-compatible storage infrastructure; the current backend
settings and routes do not yet implement attachment uploads.

## Start development on another computer

Install Docker Engine with Compose v2, or Docker Desktop (Linux containers), and
start Docker. Clone this repository, open a terminal in its root, then run:

```sh
docker compose -f deploy/compose.dev.yml up -d --build
```

No Python, Node.js, external database, homelab network, or local `.env` file is
required. All six services run in an isolated `daymark-dev` Compose project.
The first build needs internet access and can take several minutes, especially
MinIO, which is compiled from pinned official source. Allow several GB of free
RAM and disk space for image builds.

| Service | Address | Development login |
| --- | --- | --- |
| App | http://localhost:3000 | Keycloak: `demo` / `demo_dev_password` |
| FastAPI Swagger | http://localhost:8000/docs | Same API authentication rules as the app |
| Keycloak admin | http://localhost:8080/admin | `admin` / `admin_dev_password` |
| MinIO console | http://localhost:9001 | `admin` / `minio_dev_password` |
| MinIO S3 API | http://localhost:9000 | Same MinIO credentials |
| PostgreSQL | `postgres:5432` inside Compose | `todo` / `todo_dev_password`, database `todo_dev` |
| Redis | `redis:6379` inside Compose | No password; development network only |

Use **localhost**, not a LAN IP, for browser login: the imported Keycloak client
has localhost redirect URLs. All development host ports bind to loopback. The
credentials above are disposable development credentials only.

Choose **Keycloak** in the app and sign in using the demo account. For the
**Email & password** option, create a separate account using the registration
form; Keycloak users and direct accounts are separate authentication paths.

Backend migrations run automatically before Uvicorn starts. Backend source is
mounted for reload; frontend source is mounted for Next.js Fast Refresh. Frontend
`node_modules` and `.next` use Docker volumes, separate from host installations.
Startup runs `npm ci` to synchronize the dependency volume with the lockfile.

```sh
# View startup progress and errors
docker compose -f deploy/compose.dev.yml ps
docker compose -f deploy/compose.dev.yml logs -f backend frontend keycloak

# Stop containers, retaining databases and object storage
docker compose -f deploy/compose.dev.yml down

# Rebuild after changing Python dependencies or Dockerfiles
docker compose -f deploy/compose.dev.yml up -d --build

# Restart after changing frontend package dependencies
docker compose -f deploy/compose.dev.yml restart frontend
```

Realm import seeds the demo account/client on the first start. Existing realms
are not overwritten on subsequent starts; edit them in the admin console.

To **erase all local development data**, including users, todos and stored files:

```sh
docker compose -f deploy/compose.dev.yml down --volumes
```

## Production on the self-hosted homelab

Production configuration is in `deploy/compose.prod.yml`. It runs the static
frontend through nginx and builds the backend and MinIO images. It intentionally
uses your existing PostgreSQL and Keycloak installations on the external Docker
network, rather than creating new production databases or identity accounts.

One-time setup, as the account that runs the GitHub Actions runner:

```sh
mkdir -p "$HOME/.config/daymark"
cp deploy/.env.example "$HOME/.config/daymark/production.env"
chmod 600 "$HOME/.config/daymark/production.env"
```

Edit that file with the existing database URL, Keycloak URL, MinIO credentials,
and application secret. Keep it outside the runner checkout so checkout cleanup
does not delete it. Do not commit it.

```sh
# Same build/deploy/health-check sequence used by GitHub Actions
bash deploy/scripts/deploy.sh

# Equivalent manual Compose command (without the script's health verification)
docker compose --env-file "$HOME/.config/daymark/production.env" -f deploy/compose.prod.yml up -d --build
```

See [deployment setup and migration notes](deploy/README.md) before migrating an
existing deployment. Production direct-login cookies require HTTPS. Terminate
TLS at your existing reverse proxy and route to nginx on port 80; Keycloak and
browser-facing API URLs must also be reachable with appropriate HTTPS settings.
The Compose file itself does not provision certificates or a TLS proxy.

## Repository organization

```text
.github/workflows/deploy.yml    Self-hosted runner trigger; invokes deploy script
backend/                       FastAPI source, migrations, tests, app Dockerfile
frontend/                      Next.js source, production and dev Dockerfiles
deploy/
  compose.dev.yml              Self-contained local development stack
  compose.prod.yml             Existing homelab deployment
  .env.example                Production configuration template
  keycloak/dev-realm.json      Local-only realm, client and demo user
  minio/                      Pinned MinIO source build and notes
  scripts/deploy.sh            Validate, build, deploy, report failures
  scripts/healthcheck.sh       Verify DB, frontend, proxy API and MinIO
  README.md                   Runner setup, migration and troubleshooting
docs/                         Authentication review and other project notes
```

App Dockerfiles stay next to their dependency manifests. Compose environments,
service seed data and deployment orchestration live under `deploy/`.

## Checks

```sh
# Validate Compose syntax and interpolation without starting containers
docker compose -f deploy/compose.dev.yml config --quiet
docker compose --env-file deploy/.env.example -f deploy/compose.prod.yml config --quiet

# Validate deployment scripts
bash -n deploy/scripts/deploy.sh deploy/scripts/healthcheck.sh

# Test Compose isolation, production volume naming and failure handling
python3 -m unittest discover -s deploy/tests -v
```

The production example values are placeholders for validation, not deployable
credentials. Successful parsing does not establish runtime readiness.

## Current limitations

This is a learning/homelab application, not a fully hardened production system.
The current JWT verifier disables issuer/audience validation and the custom OIDC
flow still needs state/PKCE improvements. The development realm permits the
password grant to match the current UI. Do not reuse this realm in production.
The browser and container use different Keycloak hostnames locally; a future
strict issuer check must distinguish the public issuer from the internal JWKS URL.

The archived MinIO source is built locally because the former published image
is unavailable. This does not supply ongoing upstream security maintenance.
See [MinIO build notes](deploy/minio/README.md) and
[authentication review](docs/keycloak-and-session-security.md).
