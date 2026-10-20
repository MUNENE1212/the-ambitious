#!/usr/bin/env bash
# Atomic deploy + health check + auto-rollback for the Next.js standalone bundle.
#
# Layout:
#   /opt/the-ambitious/
#     deploy.tar.gz          # uploaded by CI
#     deploy-remote.sh       # this script (uploaded by CI)
#     releases/<sha>/        # one directory per deploy
#     current -> releases/<sha>   # symlink the running app uses
#     .current-sha           # last successfully deployed SHA
#
# Required env (or defaults):
#   PORT=3005  HEALTH_URL=auto
#
# Args:
#   $1  SHA of the new release (optional; defaults to contents of .current-sha + 1)

set -euo pipefail

APP_DIR=${APP_DIR:-/opt/the-ambitious}
APP_NAME=${APP_NAME:-the-ambitious}
PORT=${PORT:-3005}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:${PORT}/}
# A second probe that must ALSO pass. Fetching `/` only proves the process
# booted — the most likely failure is authentication returning 503 because the
# Firebase Admin credentials are missing, and that is invisible from `/`.
# /api/auth/session returns 200 with {"user":null} when unauthenticated, so a
# 200 here means the route handler, the cookie jar and the session lookup are
# all alive.
AUTH_HEALTH_URL=${AUTH_HEALTH_URL:-http://127.0.0.1:${PORT}/api/auth/session}
# Written by the deploy workflow before this script runs. Sourced, not parsed.
ENV_FILE=${ENV_FILE:-${APP_DIR}/.env.production}
TARBALL=${TARBALL:-${APP_DIR}/deploy.tar.gz}
KEEP_RELEASES=${KEEP_RELEASES:-5}
MAX_HEALTH_ATTEMPTS=${MAX_HEALTH_ATTEMPTS:-5}
HEALTH_RETRY_DELAY=${HEALTH_RETRY_DELAY:-2}

RELEASES_DIR="${APP_DIR}/releases"
CURRENT_LINK="${APP_DIR}/current"
SHA_FILE="${APP_DIR}/.current-sha"

log() { echo "[deploy] $*"; }
err() { echo "[deploy] ERROR: $*" >&2; }

# --- Rollback helper ---
# Must be defined before the first call below: bash resolves function names at
# call time, so a definition placed after the `exit 0` at the end of the script
# is never in scope and every rollback path would die with "command not found".
# $PREVIOUS is assigned later, before any call site — that is fine, the body is
# only evaluated when invoked.
rollback() {
  if [ -z "${PREVIOUS:-}" ] || [ ! -d "$PREVIOUS" ]; then
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

# --- Load server secrets ---
# FIREBASE_PRIVATE_KEY contains real newlines and cannot safely travel through
# the GitHub runner's environment, so the workflow writes it to a root-owned
# 600 file instead. It is sourced here so PM2 inherits it. Absent file is a
# hard error, not a warning: without it every login 503s.
if [ ! -f "$ENV_FILE" ]; then
  err "Server secrets file $ENV_FILE is missing."
  err "Login would return 503 for every member. Refusing to deploy."
  exit 2
fi

# The file holds one variable per line, so this cannot execute anything from it.
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

# The key arrives base64-encoded: a PEM key spans many lines, and a multi-line
# value cannot survive the trip through a CI environment intact. Decode it here
# so PM2 and Next see the real key with real newlines.
if [ -n "${FIREBASE_PRIVATE_KEY_B64:-}" ]; then
  FIREBASE_PRIVATE_KEY=$(printf '%s' "$FIREBASE_PRIVATE_KEY_B64" | base64 -d 2>/dev/null || echo "")
  export FIREBASE_PRIVATE_KEY
  unset FIREBASE_PRIVATE_KEY_B64
fi

if [ -z "${FIREBASE_CLIENT_EMAIL:-}" ] || [ -z "${FIREBASE_PRIVATE_KEY:-}" ]; then
  err "$ENV_FILE is missing FIREBASE_CLIENT_EMAIL or a decodable FIREBASE_PRIVATE_KEY"
  err "Refusing to deploy an app whose login returns 503."
  exit 2
fi

# The Admin SDK reads this at boot; a wrong project id produces a 503 that looks
# exactly like a missing key, so verify it is set and plausible.
if [ -z "${FIREBASE_PROJECT_ID:-}" ]; then
  err "FIREBASE_PROJECT_ID is not set. Refusing to deploy."
  exit 2
fi

# Refuse to continue if the env file is world-readable — the key would be on
# disk for any local account.
env_mode=$(stat -c %a "$ENV_FILE" 2>/dev/null || echo "unknown")
if [ "$env_mode" != "600" ]; then
  err "$ENV_FILE has mode $env_mode, expected 600. The private key would be readable by other accounts."
  exit 2
fi

log "Server secrets loaded (project=$FIREBASE_PROJECT_ID, key decoded, mode $env_mode)"

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
# Two probes. The root page proves the process serves HTML; the session endpoint
# proves the server-side auth stack is actually wired up. A deploy where login
# is broken must NOT report success.
ok=0
for i in $(seq 1 "$MAX_HEALTH_ATTEMPTS"); do
  sleep "$HEALTH_RETRY_DELAY"
  if curl -sf --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
    auth_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$AUTH_HEALTH_URL" 2>/dev/null || echo "000")
    if [ "$auth_code" = "200" ]; then
      ok=1
      break
    fi
    log "Root OK but auth probe returned $auth_code (attempt $i/$MAX_HEALTH_ATTEMPTS)"
  else
    log "Health attempt $i/$MAX_HEALTH_ATTEMPTS failed"
  fi
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
