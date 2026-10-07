# First deployment: projects.joaocyrino.com

Complete steps 1–5 before the first push. The checked-in workflow deploys pushes to `main`, including merges into `main`; opening a PR does not deploy.

## 1. Create an empty GitHub repository

Create `joaopedrocyrino/projects` (or choose another repository name). Leave GitHub's README, license and gitignore initialization unchecked. The local folder already has a Git repository on `main`.

Enable GitHub Actions for the repository. The workflow publishes its own GHCR image with the automatically supplied `GITHUB_TOKEN`.

## 2. Configure DNS and the existing shared proxy

At the DNS provider for `joaocyrino.com`, create:

| Type | Name | Value |
|---|---|---|
| A | projects | Shared droplet public IPv4 address |

Remove an incorrect AAAA record if IPv6 is not routed to this droplet. Wait until `dig +short projects.joaocyrino.com A` returns the droplet IP. Ports 80 and 443 must reach the existing Caddy.

On the droplet, confirm:

```bash
docker compose version
docker network inspect proxy --format '{{.Name}}'
docker ps --filter name=csl-caddy-1
```

The app already declares `caddy: projects.joaocyrino.com`, upstream port 8080, and the shared `proxy` network in `docker-compose.prod.yml`. The existing caddy-docker-proxy supplies routing and HTTPS. No second proxy or host port is needed.

The SSH deploy user needs Docker access, Python 3, curl, tar and flock. No .NET SDK, Node installation or application source checkout is needed on the droplet.

## 3. Generate production credentials only on the droplet

These commands use `root`, matching the existing trusted connection. If using another deploy user, replace `root` consistently, give that user ownership of `/opt/projects`, and run the generator as that user; the deploy validator requires `.env` to belong to the SSH deploy user.

On your Mac, replace the IP once:

```bash
cd ~/code/projects
DROPLET_IP="YOUR_ACTUAL_DROPLET_IP"
ssh root@"$DROPLET_IP" 'mkdir -p /opt/projects/setup/scripts && chmod 700 /opt/projects'
scp .env.production.example root@"$DROPLET_IP":/opt/projects/setup/
scp scripts/init-env.py root@"$DROPLET_IP":/opt/projects/setup/scripts/
ssh root@"$DROPLET_IP" 'python3 /opt/projects/setup/scripts/init-env.py --production --deploy-path /opt/projects'
ssh root@"$DROPLET_IP"
```

Then on the droplet:

```bash
nano /opt/projects/.env
chmod 600 /opt/projects/.env
```

Confirm `ADMIN_EMAIL` and `APP_HOSTNAME=projects.joaocyrino.com`. The generator has already generated strong database and initial admin passwords. Save the admin login privately. The generator refuses to replace an existing `.env`; do not copy your local development `.env` to production.

Application/database/admin secrets stay in `/opt/projects/.env`. Do not create a `PRODUCTION_ENV` GitHub secret. Bootstrap does not reset an existing administrator's password; later password changes happen through Settings in the portal.

## 4. Configure GitHub's production environment

In the new repository: **Settings → Environments → New environment → `production`**. Allow `main` if using selected deployment branches. Leave required reviewers and wait timers unset for an automatic deploy.

Add these environment secrets (or repository secrets). Values from the I Have Been setup can be reused for the same droplet, but another repository's secrets are not automatically available here.

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | Droplet IP/hostname, without `https://` or an SSH username |
| `DEPLOY_USER` | `root` for the commands above, or your actual configured deploy user |
| `DEPLOY_SSH_KEY` | Complete private deployment key; its public key must be authorized on the droplet |
| `DEPLOY_SSH_KNOWN_HOSTS` | Trusted pinned host-key line for this host and SSH port |
| `GHCR_USERNAME` | GitHub account associated with the registry token, e.g. `joaopedrocyrino` |
| `GHCR_TOKEN` | Personal access token **classic**, with `read:packages` and access to the image |

Create a registry token at GitHub account **Settings → Developer settings → Personal access tokens → Tokens (classic)**. The workflow publishes with `GITHUB_TOKEN`; `GHCR_TOKEN` is used for the droplet pull. The initial package can be private even when the source repository is public.

Add these **environment variables**, not secrets:

| Variable | Value |
|---|---|
| `DEPLOY_PATH` | `/opt/projects` — required by the current script |
| `CADDY_CONTAINER` | `csl-caddy-1` — required by the current script |
| `DEPLOY_PORT` | `22`, or your actual SSH port; defaults to 22 if unset |

The workflow already sets the production hostname. No `APP_IMAGE`, `RELEASE_SHA`, database password or admin password needs to be entered in GitHub.

Reuse the trusted known-hosts value if the host and port are the same. To obtain it through your trusted connection, run on the droplet:

```bash
cat /etc/ssh/ssh_host_ed25519_key.pub
```

Prefix that public-key output with the IP used in `DEPLOY_HOST`, producing `ACTUAL_IP ssh-ed25519 ACTUAL_PUBLIC_KEY`. For a custom SSH port, use `[ACTUAL_IP]:PORT`. This is a public host key, distinct from the private deployment key. Strict host checking is enabled.

The current unrestricted SSH credential technically allows access to server files. Actions does not upload, download or print the production `.env`; restricting that key to a forced deploy command would be a separate change.

## 5. Prepare the first local commit

After completing the server, DNS and GitHub setup:

```bash
cd ~/code/projects
git add .
git diff --cached --name-only
git commit -m "Create project gallery and admin monolith"
git remote add origin git@github.com:joaopedrocyrino/projects.git
```

Use the remote URL for your actual repository. Before committing, confirm no `.env`, local media or credentials appear in the staged files; `.env.example` and `.env.production.example` are templates and should be committed. If `origin` already exists, verify it with `git remote -v` instead of adding it again.

## 6. Push and verify deployment

```bash
git push -u origin main
```

Watch the repository's **Actions → Build and deploy** run. It installs locked dependencies, scans history, builds/tests the application and image, publishes that tested image, then deploys by immutable digest.

The server deployment starts private PostgreSQL, creates a database backup, applies migrations and creates the initial admin, starts the monolith, and verifies HTTPS `/api/health/ready`. Only then is `/opt/projects/current` updated.

After the workflow succeeds:

- Public gallery: https://projects.joaocyrino.com
- Admin: https://projects.joaocyrino.com/admin

Sign in with `ADMIN_EMAIL` and the server-generated initial `ADMIN_PASSWORD`, then create and publish the first project. Local projects/media are not copied to production.

Check from your Mac:

```bash
curl --fail https://projects.joaocyrino.com/api/health/ready
```

If deployment fails, use these targeted server checks:

```bash
docker ps --filter name=projects
docker logs --tail 80 projects-app-1
docker logs --tail 80 csl-caddy-1
```

The previous healthy image is restored on readiness failure where one exists. Database migrations remain; on a failed first deployment, the unsuccessful app is stopped. An SSH disconnect leaves completion unknown, so inspect the server before retrying.

Back up `projects_postgres_data`, `projects_media_data`, `projects_protection_keys` and the server `.env` securely. Database dumps are in `/opt/projects/backups`. Do not remove these named volumes during normal deployments.
