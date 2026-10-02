# UserHQ Deployment Runbook

This document is the operator runbook for deploying and managing UserHQ across environments. It details the infrastructure architecture, environment configurations, Dokploy settings, OAuth provider requirements, release procedures, and VPS operational commands.

---

## 1. Environment Matrix

| Environment | Purpose | URL / Host | Source Branch | Deployment Trigger | Stack Composition |
|-------------|---------|------------|---------------|-------------------|-------------------|
| **Dev** | Local native development | `http://localhost` | Local working tree | Manual (`bun run dev`) | Native Vite + NestJS behind Caddy dev proxy; local Postgres & Mailpit |
| **Local Smoke** | Local container verification | `http://localhost:8080` | Local working tree | Manual (`bun run stack:up`) | `compose.yaml` + `compose.local.yaml` with host ports 8080 & 5433 |
| **Prod** | Live deployment | `https://userhq.increasinglabs.com` | `main` | Push to `main` via Dokploy | Dokploy Compose app `userhq-prod`; Traefik SSL/TLS; Postgres 18 |

---

## 2. Dokploy Settings per Application

UserHQ runs on Dokploy as Docker Compose services. Both environments run on the same physical VPS and **MUST** maintain complete process, network, and storage isolation.

### Critical Setting: Isolated Deployments
> [!IMPORTANT]
> **Isolated Deployments MUST be enabled (ON) for BOTH `userhq-staging` and `userhq-prod`.**  
> Without Isolated Deployments, Dokploy attaches both Compose stacks to a single shared bridge network (`dokploy-network`). Because internal service names (`api`, `web`, `postgres`) are identical, DNS resolution will cross-wire between staging and production, leading to severe data corruption and security breaches.

### Dokploy Compose App Configuration

- **App Names:** `userhq-staging` and `userhq-prod`
- **Compose Path:** `./compose.yaml`
- **Auto Deploy:** Enabled (`ON`) for both
- **Branch:**
  - `userhq-staging`: `main`
  - `userhq-prod`: `release` (pointer branch updated only on tag release)

### Traefik Domain Routing (Domains Tab)

Each application requires three domain routing rules configured in Dokploy under the **Domains** tab with Let's Encrypt SSL/TLS enabled:

| Service | Host | Path | Container Port | Strip Path | HTTPS / Certificate |
|---------|------|------|----------------|------------|---------------------|
| `api` | `${DOMAIN}` | `/api` | `4000` | **OFF** | Let's Encrypt (automatic) |
| `api` | `${DOMAIN}` | `/uploads` | `4000` | **OFF** | Let's Encrypt (automatic) |
| `web` | `${DOMAIN}` | `/` | `3000` | **OFF** | Let's Encrypt (automatic) |

*Note: Order matters in Traefik. Specific path prefixes (`/api`, `/uploads`) are prioritized over the root catch-all (`/`). Do NOT strip paths: NestJS expects `/api/*` and `/uploads/*` prefixes directly.*

---

## 3. Environment Variables Specification

Secrets must never be committed to git, printed in CI logs, or shared in chat. Configure environment variables directly inside the Dokploy web interface.

| Variable | Staging | Production | Description / Requirements |
|----------|---------|------------|----------------------------|
| `POSTGRES_USER` | `userhq` | `userhq` | Database superuser username |
| `POSTGRES_PASSWORD` | `<random-hex-staging>` | `<random-hex-prod>` | Unique, URL-safe random string per environment (`openssl rand -hex 24`) |
| `POSTGRES_DB` | `userhq_staging` | `userhq_prod` | Distinct database name per environment |
| `PUBLIC_URL` | `https://${STAGING_DOMAIN}` | `https://${PROD_DOMAIN}` | Public canonical HTTPS origin (no trailing slash) |
| `BETTER_AUTH_SECRET` | `<random-hex-staging>` | `<random-hex-prod>` | 64-character hex secret for session encryption (`openssl rand -hex 32`) |
| `GOOGLE_CLIENT_ID` | `<staging-google-client-id>` | `<prod-google-client-id>` | Google OAuth 2.0 Client ID for this environment |
| `GOOGLE_CLIENT_SECRET` | `<staging-google-secret>` | `<prod-google-secret>` | Google OAuth 2.0 Client Secret for this environment |
| `GITHUB_CLIENT_ID` | `<staging-github-client-id>` | `<prod-github-client-id>` | GitHub OAuth App Client ID for this environment |
| `GITHUB_CLIENT_SECRET` | `<staging-github-secret>` | `<prod-github-secret>` | GitHub OAuth App Client Secret for this environment |
| `DEV_UPLOAD_PAGE` | `true` | `false` | Enables `/dev/upload` testing interface on staging; disabled on prod |
| `COMPOSE_PROFILES` | `mail` | *(unset / empty)* | Activates staging Mailpit service. Unset in prod to disable Mailpit container |
| `SMTP_HOST` | *(unset)* | `smtp-relay.brevo.com` | Brevo SMTP relay host (prod only) |
| `SMTP_USER` | *(unset)* | `<brevo-smtp-login>` | Brevo SMTP login username (prod only) |
| `SMTP_PASS` | *(unset)* | `<brevo-smtp-key>` | Brevo SMTP key (not the API key; prod only) |

---

## 4. OAuth Provider Configuration

Google and GitHub require explicit redirect callback URLs.

> [!WARNING]
> GitHub OAuth Apps support only **one callback URL per application**. You must register three separate GitHub OAuth Apps (Dev, Staging, Prod).

### Authorized Callback URLs

| Provider | Environment | Callback URL |
|----------|-------------|--------------|
| **Google** | Dev | `http://localhost/api/auth/callback/google` |
| **Google** | Staging | `https://${STAGING_DOMAIN}/api/auth/callback/google` |
| **Google** | Prod | `https://${PROD_DOMAIN}/api/auth/callback/google` |
| **GitHub** | Dev | `http://localhost/api/auth/callback/github` |
| **GitHub** | Staging | `https://${STAGING_DOMAIN}/api/auth/callback/github` |
| **GitHub** | Prod | `https://${PROD_DOMAIN}/api/auth/callback/github` |

### Provider Setup Instructions
1. **Google Cloud Console:**
   - Configure OAuth consent screen in **Testing** status.
   - Add operator personal accounts to **Test users**.
   - Create Web Application credentials with the callback URLs above. Request no extra scopes beyond standard profile and email.
2. **GitHub Developer Settings:**
   - Register three GitHub OAuth Apps named e.g. `UserHQ Local Dev`, `UserHQ Staging`, `UserHQ Production`.
   - Set Homepage URL and Authorization callback URL appropriately.

---

## 5. Tag-Driven Release Workflow

Releases are strictly managed through semver git tags:

1. Changes merge into `main` after passing GitHub Actions CI.
2. When ready for a release, the operator creates and pushes an annotated semver git tag:
   ```bash
   git tag -a v0.1.0 -m "Release v0.1.0"
   git push origin v0.1.0
   ```
3. GitHub Actions `release.yml` triggers on `v*`:
   - Runs `jobs.ci` using `.github/workflows/ci.yml` (the exact CI checks).
   - Once CI passes, it automatically creates an official GitHub Release with release notes.
4. Dokploy deploys the released version directly.

### Rollback Procedure
If a production issue requires rolling back to a previously known good commit, simply tag that commit with the next patch tag:
```bash
git tag -a v0.1.1 <known-good-commit-sha> -m "Rollback to <sha>"
git push origin v0.1.1
```

### Dokploy API Fallback (Webhook Alternative)
If Dokploy's Git webhook does not automatically fire on GITHUB_TOKEN-authored branch pushes, use the Dokploy API deploy fallback:
1. Generate an API Key in Dokploy (**Dokploy → Settings → API Keys**).
2. Set the repository secret `DOKPLOY_API_KEY` in GitHub:
   ```bash
   gh secret set DOKPLOY_API_KEY
   ```
3. Call the Dokploy Compose Deploy endpoint:
   `POST https://<DOKPLOY_HOST>/api/compose.deploy` with header `x-api-key: $DOKPLOY_API_KEY`.

---

## 6. VPS Architecture & Resource Management

- **Host Architecture:** Oracle Cloud Infrastructure Ampere A1 (`aarch64` / ARM64).
- **Native Container Builds:** Dokploy builds container images directly on the VPS using Docker BuildKit. No third-party image registry is used.
- **Memory & Swap Configuration:**
  - TypeScript compilation and Next.js static page generation require substantial RAM.
  - If the VPS has less than 4 GB free memory + swap, configure a swap file to prevent out-of-memory (OOM) build aborts:
    ```bash
    # Create 4 GB swap file on VPS if required
    sudo fallocate -l 4G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    ```

---

## 7. SSH Alias & Verification Commands

Add the following host definition to your local `~/.ssh/config` file:

```sshconfig
Host userhq-vps
    HostName <VPS_PUBLIC_IP>
    User ubuntu
    IdentityFile ~/.ssh/id_rsa
```

### Operational Check Commands

```bash
# Check system architecture and available memory
ssh userhq-vps "uname -m; nproc; free -h; df -h"

# List active Dokploy and application containers
ssh userhq-vps "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

# Inspect staging isolated network
ssh userhq-vps "docker network ls | grep staging"

# Run SMTP probe inside the running production API container
ssh userhq-vps "docker exec \$(docker ps -q -f name=userhq-prod-api) node apps/api/dist/scripts/smtp-check.js"

# Inspect application logs
ssh userhq-vps "docker logs --tail 100 -f \$(docker ps -q -f name=userhq-staging-api)"
```
