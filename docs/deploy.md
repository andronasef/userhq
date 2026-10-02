# UserHQ Deployment Runbook

This document is the operator runbook for deploying and managing UserHQ across environments. It details the infrastructure architecture, environment configurations, Dokploy settings, OAuth provider requirements, release procedures, and VPS operational commands.

---

## 1. Environment Matrix

| Environment | Purpose | URL / Host | Source Branch | Deployment Trigger | Stack Composition |
|-------------|---------|------------|---------------|-------------------|-------------------|
| **Dev** | Local native development | `http://localhost` | Local working tree | Manual (`bun run dev`) | Native Vite + NestJS behind Caddy dev proxy; local Postgres & Mailpit |
| **Local Smoke** | Local container verification | `http://localhost:8080` | Local working tree | Manual (`bun run stack:up`) | `compose.yaml` + `compose.local.yaml` with host ports 8080 & 5433 |
| **Staging** | Pre-production testing & QA | `https://${STAGING_DOMAIN}` | `main` | Automatic on push to `main` | Dokploy Compose app `userhq-staging`; Mailpit profile active (`COMPOSE_PROFILES=mail`) |
| **Prod** | Live production | `https://${PROD_DOMAIN}` | `release` | Automated via GitHub Actions release workflow on `v*` tags | Dokploy Compose app `userhq-prod`; Brevo SMTP relay; `DEV_UPLOAD_PAGE=false` |

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

## 5. Release Workflow (Overview)

Production deployments are strictly tag-driven to prevent untested commits from hitting live users:

1. Changes merge into `main` after passing GitHub Actions CI.
2. Main auto-deploys to Staging via Dokploy push trigger.
3. Once staging verification passes, the operator creates a semver git tag:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
4. GitHub Actions `release.yml` triggers on `v*`:
   - Executes full CI test matrix against the tagged SHA.
   - Fast-forwards the `release` branch to the tagged commit:
     `git push origin <tag-sha>:refs/heads/release --force-with-lease`
5. Dokploy detects the `release` branch update and automatically builds and deploys `userhq-prod`.

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
