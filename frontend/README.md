# Daymark frontend

The recommended full-stack development setup is documented in the
[root README](../README.md). Start it from the repository root:

```sh
docker compose -f deploy/compose.dev.yml up -d --build
```

The app opens at http://localhost:3000 with Fast Refresh. `Dockerfile.dev` runs
Next.js development mode; `Dockerfile` builds a static export served by nginx
for production. Deployment definitions and scripts are under `../deploy/`.

For frontend-only work with existing services, install Node.js and run `npm ci`,
configure `.env.local` using `.env.example`, then run `npm run dev`. Public
configuration is compiled into production builds and requires rebuilding when
changed.
