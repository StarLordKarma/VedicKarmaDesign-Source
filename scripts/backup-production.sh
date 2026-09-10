#!/bin/sh
set -eu

: "${BACKUP_DIR:?Set BACKUP_DIR to a dedicated absolute backup directory}"
: "${DB_HOST:?Set DB_HOST}"
: "${DB_PORT:=3306}"
: "${DB_NAME:?Set DB_NAME}"
: "${DB_USER:?Set DB_USER}"
: "${DB_PASSWORD:?Set DB_PASSWORD}"

case "$BACKUP_DIR" in
  /*) ;;
  *) echo "BACKUP_DIR must be absolute" >&2; exit 1 ;;
esac
case "$BACKUP_DIR" in
  /|/Users|/home|/root) echo "Refusing broad BACKUP_DIR" >&2; exit 1 ;;
esac

umask 077
mkdir -p "$BACKUP_DIR"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
target="$BACKUP_DIR/vedic-mysql-$stamp.sql.gz"

MYSQL_PWD="$DB_PASSWORD" mysqldump \
  --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" \
  --single-transaction --quick --routines --triggers --set-gtid-purged=OFF \
  "$DB_NAME" | gzip -9 > "$target"
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$BACKUP_DIR" && sha256sum "$(basename "$target")" > "$(basename "$target").sha256")
else
  (cd "$BACKUP_DIR" && shasum -a 256 "$(basename "$target")" > "$(basename "$target").sha256")
fi

if [ -n "${BACKUP_S3_URI:-}" ]; then
  command -v aws >/dev/null 2>&1 || { echo "aws CLI is required for BACKUP_S3_URI" >&2; exit 1; }
  aws s3 cp "$target" "$BACKUP_S3_URI/"
  aws s3 cp "$target.sha256" "$BACKUP_S3_URI/"
fi

find "$BACKUP_DIR" -type f -name 'vedic-mysql-*.sql.gz*' -mtime "+${BACKUP_RETENTION_DAYS:-30}" -delete
echo "Backup created: $target"
