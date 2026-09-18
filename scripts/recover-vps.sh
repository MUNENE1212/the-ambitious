#!/usr/bin/env bash
# Recovery: bring the the-ambitious app back online after a broken deploy.
# Run as root or with sudo. Safe to run multiple times.
#
# This restores the in-place layout the app used before atomic deploys were
# introduced, so the app comes back regardless of what state the failed deploy
# left behind.

set -euo pipefail

APP_DIR=/opt/the-ambitious
APP_NAME=the-ambitious
PORT=3005
HEALTH_URL="http://127.0.0.1:${PORT}/"

echo "=== Stopping PM2 ==="
pm2 delete "$APP_NAME" 2>/dev/null || pm2 kill 2>/dev/null || true

echo ""
echo "=== Cleaning broken atomic-deploy state ==="
rm -rf "$APP_DIR/releases" "$APP_DIR/current" "$APP_DIR/.current-sha" \
       "$APP_DIR/deploy.tar.gz" "$APP_DIR/deploy-remote.sh" 2>/dev/null || true

echo ""
echo "=== Inspecting existing in-place files ==="
if [ -f "$APP_DIR/.next/standalone/server.js" ]; then
  echo "Found existing in-place bundle at $APP_DIR/.next/standalone/server.js"
else
  echo "WARNING: No in-place bundle found."
  echo "         After this script, trigger a manual deploy from GitHub Actions:"
  echo "           Actions > Deploy > Run workflow > ref: main"
  echo "         (the bug is fixed in the workflow; the deploy will produce a valid bundle)"
fi

echo ""
echo "=== Writing in-place ecosystem.config.cjs ==="
cat > "$APP_DIR/ecosystem.config.cjs" <<'EOF'
module.exports = {
  apps: [
    {
      name: 'the-ambitious',
      script: '.next/standalone/server.js',
      cwd: '/opt/the-ambitious',
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
    },
  ],
};
EOF

echo ""
echo "=== Starting PM2 ==="
cd "$APP_DIR"
pm2 start ecosystem.config.cjs --only "$APP_NAME"
pm2 save

echo ""
echo "=== Waiting for boot + health check ==="
ok=0
for i in 1 2 3 4 5 6 7 8; do
  sleep 2
  if curl -sf --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
    ok=1
    break
  fi
  echo "  attempt $i: not ready yet"
done

if [ "$ok" -eq 1 ]; then
  echo ""
  echo "OK: app is responding at $HEALTH_URL"
  pm2 status
else
  echo ""
  echo "STILL DOWN. Diagnostics:"
  echo "--- pm2 status ---"
  pm2 status
  echo "--- last 30 log lines ---"
  pm2 logs "$APP_NAME" --lines 30 --nostream 2>&1 || true
  echo ""
  echo "You will need to trigger a manual deploy from GitHub Actions once"
  echo "the workflow fix has been pushed:"
  echo "  Actions > Deploy > Run workflow > ref: main"
  exit 1
fi