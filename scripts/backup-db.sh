#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
env_file=${ENV_FILE:-$project_dir/.env.production}
[ -f "$env_file" ] || { echo "Missing $env_file" >&2; exit 1; }

set -a
# shellcheck disable=SC1090
. "$env_file"
set +a

exec sh "$project_dir/scripts/backup-production.sh"
