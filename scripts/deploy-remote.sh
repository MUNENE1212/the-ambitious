#!/usr/bin/env bash
# Atomic deploy + health check + auto-rollback for the Next.js standalone bundle.
#
# Layout:
#   /opt/kuku-egg-tracker/
#     deploy.tar.gz          # uploaded by CI
#     deploy-remote.sh       # this script (uploaded by CI)
#     releases/<sha>/        # one directory per deploy
#     current -> releases/<sha>   # symlink the running app uses
#     .current-sha           # last successfully deployed SHA
#
# Required env (or defaults):
#   PORT=3004  HEALTH_URL=auto
#
# Args:
#   $1  SHA of the new release (optional; defaults to contents of .current-sha + 1)

set -euo pipefail

APP_DIR=${APP_DIR:-/opt/kuku-egg-tracker}
APP_NAME=${APP_NAME:-kuku-egg-tracker}
PORT=${PORT:-3004}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:${PORT}/}
TARBALL=${TARBALL:-${APP_DIR}/deploy.tar.gz}
KEEP_RELEASES=${KEEP_RELEASES:-5}
MAX_HEALTH_ATTEMPTS=${MAX_HEALTH_ATTEMPTS:-5}
HEALTH_RETRY_DELAY=${HEALTH_RETRY_DELAY:-2}

RELEASES_DIR="${APP_DIR}/releases"
CURRENT_LINK="${APP_DIR}/current"
SHA_FILE="${APP_DIR}/.current-sha"

log() { echo "[deploy] $*"; }
err() { echo "[deploy] ERROR: $*" >&2; }

if [ ! -f "$TARBALL" ]; then
  err "Tarball not found at $TARBALL"
  exit 2
fi

# --- Resolve SHA ---
NEW_SHA="${1:-}"
if [ -z "$NEW_SHA" ]; then
  if command -v git >/dev/null && [ -d "${APP_DIR}/.git" ]; then
    NEW_SHA=$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo "")
  fi
  if [ -z "$NEW_SHA" ]; then
    NEW_SHA=$(date -u +%Y%m%d%H%M%S)
  fi
fi

# --- Prepare work directory ---
mkdir -p "$RELEASES_DIR"
NEW_DIR="${RELEASES_DIR}/${NEW_SHA}"
rm -rf "$NEW_DIR"
mkdir -p "$NEW_DIR"

log "Extracting $TARBALL -> $NEW_DIR"
tar -xzf "$TARBALL" -C "$NEW_DIR"

# Verify the standalone bundle is intact
if [ ! -f "${NEW_DIR}/.next/standalone/server.js" ]; then
  err "Extracted bundle is missing .next/standalone/server.js"
  rm -rf "$NEW_DIR"
  exit 2
fi

# --- Capture previous release for rollback ---
PREVIOUS=""
if [ -L "$CURRENT_LINK" ]; then
  PREVIOUS=$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)
fi
if [ -n "$PREVIOUS" ] && [ ! -d "$PREVIOUS" ]; then
  PREVIOUS=""
fi

# --- Atomic symlink swap ---
ln -sfn "$NEW_DIR" "${CURRENT_LINK}.tmp"
mv -T "${CURRENT_LINK}.tmp" "$CURRENT_LINK"
log "Symlink swapped -> $NEW_DIR"

# --- Restart PM2 with the new release's config ---
# pm2 reload does NOT pick up a changed cwd from ecosystem.config.cjs, so we
# must delete + start to actually switch the running process to the new
# release. Brief downtime (~1-2s) is acceptable and the health check below
# covers the window.
cd "$CURRENT_LINK"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  log "Stopping existing $APP_NAME process"
  pm2 delete "$APP_NAME" 2>/dev/null || true
fi
log "Starting $APP_NAME from $CURRENT_LINK"
pm2 start ecosystem.config.cjs --only "$APP_NAME" || {
  err "pm2 start failed"
  rollback
  exit 1
}
pm2 save >/dev/null 2>&1 || true

# --- Health check ---
ok=0
for i in $(seq 1 "$MAX_HEALTH_ATTEMPTS"); do
  sleep "$HEALTH_RETRY_DELAY"
  if curl -sf --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
    ok=1
    break
  fi
  log "Health attempt $i/$MAX_HEALTH_ATTEMPTS failed"
done

if [ "$ok" -ne 1 ]; then
  err "Health check failed after $MAX_HEALTH_ATTEMPTS attempts"
  rollback
  exit 1
fi

log "Health check passed"

# --- Record successful deploy ---
echo "$NEW_SHA" > "$SHA_FILE"

# --- Trim old releases ---
cd "$RELEASES_DIR"
if [ -d "$RELEASES_DIR" ]; then
  ls -1t 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | while read -r old; do
    if [ "$old" != "$NEW_SHA" ] && [ "$RELEASES_DIR/$old" != "$PREVIOUS" ]; then
      log "Pruning old release $old"
      rm -rf "$RELEASES_DIR/$old"
    fi
  done
fi

log "Deploy $NEW_SHA complete"
exit 0

# --- Rollback helper ---
rollback() {
  if [ -z "$PREVIOUS" ] || [ ! -d "$PREVIOUS" ]; then
    err "No previous release to roll back to"
    return
  fi
  err "Rolling back to $PREVIOUS"
  ln -sfn "$PREVIOUS" "${CURRENT_LINK}.tmp"
  mv -T "${CURRENT_LINK}.tmp" "$CURRENT_LINK"
  cd "$CURRENT_LINK"
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 reload "$APP_NAME" --update-env >/dev/null 2>&1 || pm2 start ecosystem.config.cjs --only "$APP_NAME" || true
  else
    pm2 start ecosystem.config.cjs --only "$APP_NAME" || true
  fi
}