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

UserHQ runs on Dokploy as Docker Compose services. Production tracks `main`. If staging is also configured on the same VPS, keep its processes, network and storage isolated from production.

### Critical Setting: Isolated Deployments
> [!IMPORTANT]
> **Isolated Deployments MUST be enabled (ON) for BOTH `userhq-staging` and `userhq-prod`.**  
> Without Isolated Deployments, Dokploy attaches both Compose stacks to a single shared bridge network (`dokploy-network`). Because internal service names (`api`, `web`, `postgres`) are identical, DNS resolution will cross-wire between staging and production, leading to severe data corruption and security breaches.

### Dokploy Compose App Configuration

- **App Names:** `userhq-prod`, plus `userhq-staging` if used
- **Compose Path:** `./compose.yaml`
- **Auto Deploy:** Enabled (`ON`) for both
- **Branch:**
  - `userhq-staging`: `main`
  - `userhq-prod`: `main` (there is no release pointer branch)

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
| `PLATFORM_OWNER_EMAIL` | `<platform owner's verified email>` | `<platform owner's verified email>` | The platform owner (PLAT-01); compose refuses to deploy without it; set it in Dokploy before pushing Phase 2 to main |
| `DEV_UPLOAD_PAGE` | `true` | `false` | Enables `/dev/upload` testing interface on staging; disabled on prod |
| `COMPOSE_PROFILES` | `mail` | *(unset / empty)* | Activates staging Mailpit service. Unset in prod to disable Mailpit container |
| `SMTP_HOST` | `mailpit` | `smtp-relay.brevo.com` | Brevo SMTP relay host (prod) or internal Mailpit service (staging) |
| `SMTP_PORT` | `1025` | `587` | SMTP port (Mailpit on staging, Brevo submission on prod; confirmed via probe) |
| `SMTP_USER` | *(unset)* | `<brevo-smtp-login>` | Brevo SMTP login username (prod only) |
| `SMTP_PASS` | *(unset)* | `<brevo-smtp-key>` | Brevo SMTP key (not the API key; prod only) |
| `SMTP_FROM` | `notifications@userhq.test` | `notifications@increasinglabs.com` | Sender address on an authenticated domain (DKIM/SPF verified in Brevo) |
| `SMTP_REQUIRE_TLS` | `false` | `true` | Enforce TLS (STARTTLS/SSL) for outgoing SMTP connections |
| `VAPID_PUBLIC_KEY` | `<persistent-staging-public-key>` | `<persistent-prod-public-key>` | Required whenever `NODE_ENV=production`, including a production-mode staging container |
| `VAPID_PRIVATE_KEY` | `<persistent-staging-private-key>` | `<persistent-prod-private-key>` | Required with the matching public key; preserve the pair across deployments |
| `VAPID_SUBJECT` | `https://${STAGING_DOMAIN}` | `https://${PROD_DOMAIN}` | Optional contact URL or `mailto:` address; the server has a default when omitted |

Recorded Brevo port: smtp-relay.brevo.com:587 (confirmed 2026-10-03 from the prod API container)

> [!NOTE]
> Rotating `BETTER_AUTH_SECRET` invalidates every unsubscribe and mute link already emailed; recipients then see the "This link isn't valid" page and can use account settings.

### Browser push VAPID startup requirement

Since `v0.3.0`, production startup validation requires both VAPID keys even if nobody has opted in to push yet. Missing keys stop the API container, affecting sign-in and all API-backed operations while the web container may still display the login page. Do not bypass validation or generate a fresh pair on every boot.

Generate one pair per environment from the installed API workspace, on a trusted machine. This command creates a private file rather than printing the keys:

```bash
cd apps/api
node --input-type=module - <<'JS'
import webpush from 'web-push';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
const dir = join(homedir(), '.config', 'userhq');
mkdirSync(dir, { recursive: true, mode: 0o700 });
writeFileSync(join(dir, 'vapid.env'), `VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\n`, {
  mode: 0o600,
  flag: 'wx',
});
JS
```

The file is `~/.config/userhq/vapid.env`, outside the repository. Copy both values into the Dokploy Compose application's environment settings, optionally set `VAPID_SUBJECT`, save and redeploy. Store the pair securely for subsequent deployments, then remove the temporary file when a secure backup exists; never commit it. `flag: 'wx'` refuses to overwrite an existing file. Rotating the pair can invalidate existing browser subscriptions; coordinate re-subscription when rotation is necessary.

For local smoke verification, pass a throwaway pair through the environment of `bun run stack:up`; never reuse that disposable pair for production. Normal development/test mode can generate ephemeral keys, which are not a production persistence mechanism.

After deployment, check `GET /api/v1/health` on the app origin returns success and the API container is healthy; check `GET /api/auth/get-session` returns JSON (often `null` without a session), not an HTML 404 or gateway error. Then verify an authorized user's OAuth flow. If startup reports `Failing keys: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY`, correct Dokploy environment settings and redeploy the API before investigating OAuth credentials.

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

Tags identify releases; production deployment and GitHub release publication are separate operations:

1. Complete the [documentation and tag checklist](../AGENTS.md#documentation-and-release-tags): update the changelog, review user/API/LLM docs, document environment and migration requirements, and commit the verified changes.
2. With authorization, push `main`. Dokploy is configured to deploy pushes to `main`; do not assume a later tag's CI blocks that deployment. Verify environment prerequisites before the branch push.
3. With authorization, create an annotated semver tag on the intended verified commit. Use the next version appropriate to the change (major, minor, patch or prerelease), and do not overwrite an existing published tag:
   ```bash
   git tag -a <next-version> <verified-commit> -m "Release <next-version>"
   git push origin <next-version>
   ```
4. GitHub Actions `release.yml` triggers on `v*`:
   - Runs `jobs.ci` using `.github/workflows/ci.yml` (the exact CI checks).
   - Once CI passes, it automatically creates an official GitHub Release with release notes.
5. Confirm the workflow outcome and that the GitHub Release exists. The workflow currently tolerates `gh release create` errors, so a green job alone does not prove publication. It contains no Dokploy deployment job and does not update a release branch.

The `v0.3.0` changelog entry was added retrospectively. Its published tag remains on the original release commit; documentation corrections are subsequent commits, not a rewritten release.

### Rollback Procedure
Use Dokploy's deployment controls to deploy a known-good revision, after checking its compatibility with the current database migrations and stored uploads. Preserve backups; older application code may not work with a newer schema. A tag by itself does not change the `main` revision Dokploy builds. For a durable source rollback, prepare and verify a revert on `main`, update the changelog/docs as needed, and obtain push authorization. Never move published tags to perform a rollback.

### Manual redeploy
If the configured Git webhook misses a branch push, use Dokploy's deployment controls to redeploy the intended `main` revision and check container health and application sign-in. This repository's release workflow does not consume a `DOKPLOY_API_KEY` or implement an automatic fallback deploy.

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
ssh userhq-vps "docker exec -e SMTP_HOST=smtp-relay.brevo.com -e SMTP_USER=<login> -e SMTP_PASS=<key> \$(docker ps -q -f name=userhq-prod-api) node apps/api/dist/scripts/smtp-check.js"

# Inspect application logs
ssh userhq-vps "docker logs --tail 100 -f \$(docker ps -q -f name=userhq-staging-api)"
```
