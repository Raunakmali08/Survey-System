#!/bin/bash
set -euo pipefail

ROOT_DIR="/home/ronin/Survey-System"
BACKUP_DIR="$ROOT_DIR/backups"
LOG_FILE="$BACKUP_DIR/backup-cron.log"

mkdir -p "$BACKUP_DIR"

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

cd "$ROOT_DIR"
BACKUP_DIR="$BACKUP_DIR" ./scripts/backup-postgres.sh >> "$LOG_FILE" 2>&1
