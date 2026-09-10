#!/bin/sh
set -eu

: "${RCLONE_PDF_REMOTE:?Set source, for example r2:production-pdf}"
: "${RCLONE_BACKUP_REMOTE:?Set destination in another account, for example b2:vedic-backup/pdf}"
command -v rclone >/dev/null 2>&1 || { echo "rclone is required" >&2; exit 1; }

# Versioning/Object Lock remains the primary protection. This copy provides a
# second failure domain; --delete is intentionally omitted.
rclone copy "$RCLONE_PDF_REMOTE" "$RCLONE_BACKUP_REMOTE" \
  --immutable --checkers 4 --transfers 2
echo "Object backup synchronized without deleting destination history."
