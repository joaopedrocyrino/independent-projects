#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
DEPLOY_PATH=$1
release_id=$2
export APP_IMAGE=$3 APP_HOSTNAME=$4
caddy_container=$5
registry_user=$6
[[ "$DEPLOY_PATH" =~ ^/[a-zA-Z0-9_/-]+$ && "$DEPLOY_PATH" != / && "$DEPLOY_PATH" != /opt ]]
[[ "$release_id" =~ ^[a-f0-9]{40}-[0-9]+-[0-9]+$ ]]
[[ "$APP_IMAGE" =~ ^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$ ]]
[[ "$APP_HOSTNAME" =~ ^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$ ]]
command -v docker >/dev/null
command -v python3 >/dev/null
command -v flock >/dev/null
command -v curl >/dev/null
exec 9>"$DEPLOY_PATH/.deploy.lock"
flock -w 1200 9
release="$DEPLOY_PATH/releases/$release_id"
mkdir -p "$release" "$DEPLOY_PATH/backups"
tar -xzf "$DEPLOY_PATH/incoming/$release_id/release.tar.gz" -C "$release"
python3 "$release/scripts/validate-server-env.py" "$DEPLOY_PATH/.env"
docker network inspect proxy >/dev/null
TRUSTED_PROXY_IP=$(docker inspect --format '{{with index .NetworkSettings.Networks "proxy"}}{{.IPAddress}}{{end}}' "$caddy_container")
[[ "$TRUSTED_PROXY_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'The shared Caddy container needs an IPv4 address on proxy.' >&2; exit 1; }
export TRUSTED_PROXY_IP
registry=$(mktemp -d "$DEPLOY_PATH/.registry-XXXXXX")
export DOCKER_CONFIG="$registry"
cleanup() { rm -rf -- "$registry"; }
trap cleanup EXIT
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io --username "$registry_user" --password-stdin
unset GHCR_TOKEN
compose() { docker compose -p projects --env-file "$DEPLOY_PATH/.env" -f "$release/docker-compose.prod.yml" "$@"; }
previous=$(readlink -f "$DEPLOY_PATH/current" 2>/dev/null || true)
replaced=false
rollback() {
 local status=$?
 trap - ERR
 echo "Deployment failed (exit $status)."
 compose ps --all || true
 if [[ "$replaced" == true ]]; then
  if [[ -n "$previous" && -f "$previous/release.json" ]]; then
   APP_IMAGE=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["image"])' "$previous/release.json")
   export APP_IMAGE
   docker compose -p projects --env-file "$DEPLOY_PATH/.env" -f "$previous/docker-compose.prod.yml" up -d --no-deps --pull never app || true
   echo 'Restored the previous app image; database migrations were retained.'
  else
   compose stop app || true
  fi
 fi
 exit "$status"
}
trap rollback ERR
printf 'Stage: pull\n'
compose --profile deploy pull postgres migrate app
printf 'Stage: database\n'
compose up -d --wait --wait-timeout 120 postgres
# Expand these variables inside the PostgreSQL container, not the deploy shell.
# shellcheck disable=SC2016
compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$DEPLOY_PATH/backups/$release_id.dump"
printf 'Stage: migrate\n'
compose --profile deploy run --rm --no-deps migrate
printf 'Stage: app\n'
replaced=true
compose up -d --no-deps --pull never app
printf 'Stage: HTTPS readiness\n'
ready=false
for _attempt in $(seq 1 30); do
 if curl --silent --fail --connect-timeout 3 --max-time 5 --resolve "$APP_HOSTNAME:443:127.0.0.1" "https://$APP_HOSTNAME/api/health/ready" >/dev/null; then ready=true; break; fi
 sleep 3
done
[[ "$ready" == true ]] || { echo 'HTTPS readiness did not pass; check projects app and shared Caddy logs on the server.' >&2; false; }
python3 - "$release/release.json" "$APP_IMAGE" "$APP_HOSTNAME" <<'JSON'
import json,sys
from pathlib import Path
Path(sys.argv[1]).write_text(json.dumps({'image':sys.argv[2],'hostname':sys.argv[3]}))
JSON
ln -sfn "$release" "$DEPLOY_PATH/current"
printf 'Deployed: https://%s\n' "$APP_HOSTNAME"
