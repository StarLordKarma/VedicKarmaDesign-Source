#!/bin/sh
set -eu

: "${RESTORE_FILE:?Set RESTORE_FILE to an explicit .sql.gz backup path}"
: "${RESTORE_DATABASE:?Set RESTORE_DATABASE to a new empty verification database}"
: "${RESTORE_CONFIRM:?Set RESTORE_CONFIRM=RESTORE-INTO-NEW-DATABASE}"
: "${DB_HOST:?Set DB_HOST}"
: "${DB_PORT:=3306}"
: "${DB_USER:?Set DB_USER}"
: "${DB_PASSWORD:?Set DB_PASSWORD}"

[ "$RESTORE_CONFIRM" = "RESTORE-INTO-NEW-DATABASE" ] || { echo "Confirmation mismatch" >&2; exit 1; }
[ -f "$RESTORE_FILE" ] || { echo "Backup not found: $RESTORE_FILE" >&2; exit 1; }
case "$RESTORE_DATABASE" in
  vedic_production) echo "Refusing to restore directly over production" >&2; exit 1 ;;
  *[!A-Za-z0-9_]*) echo "RESTORE_DATABASE may contain only letters, digits and underscore" >&2; exit 1 ;;
esac

checksum_file="$RESTORE_FILE.sha256"
[ -f "$checksum_file" ] || { echo "Missing checksum: $checksum_file" >&2; exit 1; }
restore_dir=$(CDPATH= cd -- "$(dirname -- "$RESTORE_FILE")" && pwd)
restore_name=$(basename -- "$RESTORE_FILE")
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$restore_dir" && sha256sum -c "$restore_name.sha256")
else
  (cd "$restore_dir" && shasum -a 256 -c "$restore_name.sha256")
fi

MYSQL_PWD="$DB_PASSWORD" mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" \
  --execute="CREATE DATABASE IF NOT EXISTS \`$RESTORE_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
gzip -dc "$RESTORE_FILE" | MYSQL_PWD="$DB_PASSWORD" mysql \
  --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" "$RESTORE_DATABASE"

echo "Restored into verification database: $RESTORE_DATABASE"
