#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"

env_file=${ENV_FILE:-.env.production}
compose_file=${COMPOSE_FILE:-docker-compose.prod.yml}

[ -f "$env_file" ] || { echo "Missing $env_file; copy .env.production.example and fill it outside Git." >&2; exit 1; }
[ -f "$compose_file" ] || { echo "Missing $compose_file" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required" >&2; exit 1; }

case "$(uname -s)" in
  Linux) chmod 600 "$env_file" ;;
esac

docker compose --env-file "$env_file" -f "$compose_file" config --quiet
docker compose --env-file "$env_file" -f "$compose_file" build --pull app
docker compose --env-file "$env_file" -f "$compose_file" --profile tools run --rm migrate
docker compose --env-file "$env_file" -f "$compose_file" up -d database app proxy
docker compose --env-file "$env_file" -f "$compose_file" ps

echo "Deployment started. Verify https://<SITE_DOMAIN>/health and /ready before enabling orders."
