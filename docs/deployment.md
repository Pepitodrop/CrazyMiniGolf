# Deployment

Crazy Mini Golf is a static Vite application. The repository supports two production outputs:

1. a GitHub Pages deployment of `dist/`
2. a Docker image published to GitHub Container Registry (GHCR)

Both outputs are created by `.github/workflows/deploy.yml` after a successful push to `main` or a manual workflow dispatch.

## Local Docker run

```bash
docker compose up --build -d
```

Open `http://localhost:8080`. The health endpoint is available at `http://localhost:8080/healthz`.

Stop the service with:

```bash
docker compose down
```

## Pull the published image

```bash
docker pull ghcr.io/pepitodrop/crazy-mini-golf:latest
docker run -d \
  --name crazy-mini-golf \
  --restart unless-stopped \
  --read-only \
  --tmpfs /var/cache/nginx \
  --tmpfs /var/run \
  -p 8080:8080 \
  ghcr.io/pepitodrop/crazy-mini-golf:latest
```

The package inherits the repository visibility by default. If the package remains private, authenticate first:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u Pepitodrop --password-stdin
```

Use a fine-grained token or classic token with the minimum required `read:packages` permission.

## GitHub Pages

The deployment workflow calls `actions/configure-pages` with automatic enablement and deploys the generated `dist/` artifact. Vite uses a relative base path, so worker and asset URLs work under the repository subpath.

If GitHub cannot enable Pages automatically, open the repository settings and select **Pages → Build and deployment → GitHub Actions**, then rerun the `Deploy` workflow.

Private-repository Pages availability depends on the GitHub account and organization plan. The Docker/GHCR output does not depend on Pages availability.

## Reverse proxy and TLS

The container listens on port `8080`. Put it behind an HTTPS reverse proxy such as Apache, Nginx, Caddy or Traefik. Forward traffic to `127.0.0.1:8080`; do not expose an unencrypted public endpoint when TLS termination is available.

The included Nginx configuration provides:

- an unprivileged external port (`8080`)
- SPA fallback to `index.html`
- immutable caching for fingerprinted assets
- disabled server version disclosure
- Content Security Policy and defensive browser headers
- a Docker health check endpoint

## Release flow

1. Merge reviewed code to `main`.
2. CI validates TypeScript, Brainfuck generation, level data, coverage, Chromium E2E, R analysis and the Docker runtime.
3. `Deploy` rebuilds the same commit.
4. The site is deployed to GitHub Pages.
5. `latest` and `sha-<commit>` images are pushed to GHCR.

For rollback, deploy a previous `sha-...` image tag or rerun a previous successful Pages workflow commit.
