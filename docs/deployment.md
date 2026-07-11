# Deployment

Crazy Mini Golf is a static Vite application. The repository produces two release artifacts:

1. a GitHub Pages deployment of `dist/`
2. a Docker image published to GitHub Container Registry (GHCR)

Deployment starts only after the `CI` workflow has completed successfully for `main`. A manual workflow dispatch remains available for recovery or re-deployment.

## Local Docker run

```bash
docker compose up --build -d
```

Open `http://localhost:8080`. The health endpoint is available at `http://localhost:8080/healthz`.

The Compose file binds the service to `127.0.0.1` so it is not exposed directly on every network interface. Put an HTTPS reverse proxy in front of it for public hosting.

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
  -p 127.0.0.1:8080:8080 \
  ghcr.io/pepitodrop/crazy-mini-golf:latest
```

GHCR package visibility is managed independently from repository visibility. To allow anonymous pulls, explicitly set the package to **Public** in the package settings. If the package remains private, authenticate first:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u Pepitodrop --password-stdin
```

Use a token with only the required `read:packages` permission.

## GitHub Pages

The deployment workflow calls `actions/configure-pages`, uploads the generated `dist/` artifact, deploys it, and verifies that the public URL serves Crazy Mini Golf. Vite uses a relative base path, so worker and asset URLs work below a repository path.

If GitHub cannot enable Pages automatically, select **Settings → Pages → Build and deployment → GitHub Actions**, then rerun the `Deploy` workflow.

Private-repository Pages availability depends on the GitHub account or organization plan. The Docker/GHCR output does not depend on Pages availability.

## Reverse proxy and TLS

The container listens on port `8080`. Forward HTTPS traffic from Apache, Nginx, Caddy, or Traefik to `127.0.0.1:8080`.

The included Nginx configuration provides:

- SPA fallback to `index.html`
- immutable caching for fingerprinted assets
- disabled server version disclosure
- Content Security Policy and defensive browser headers
- a Docker health endpoint

## Release flow

1. Merge reviewed code to `main`.
2. CI validates dependencies, Git history, TypeScript, Brainfuck generation, level data, coverage, desktop/mobile browser E2E, R analysis, and the Docker runtime.
3. `Deploy` checks out the exact successful CI commit.
4. GitHub Pages and GHCR artifacts are published.
5. The Pages URL is smoke-tested after deployment.
6. `Release` creates the matching `v<package-version>` GitHub Release if it does not already exist.

For rollback, deploy an earlier `sha-...` image or rerun a previous successful Pages deployment.
