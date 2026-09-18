#!/usr/bin/env bash
# Diagnose and bring the-ambitious back online in IN-PLACE layout
# (the layout that was working before atomic deploys were attempted).
#
# Run as root or with sudo. Safe to run multiple times.
# Will NOT touch other services or other PM2 apps.

set +e
APP_DIR=/opt/the-ambitious
APP_NAME=the-ambitious
PORT=3005
HEALTH_URL="http://127.0.0.1:${PORT}/"

echo "=== 1. Current state ==="
echo "-- top of $APP_DIR --"
ls -la "$APP_DIR/" 2>&1 | head -20
echo ""
echo "-- /opt/the-ambitious/current --"
ls -la "$APP_DIR/current" 2>&1
echo ""
echo "-- /opt/the-ambitious/releases/ --"
ls -la "$APP_DIR/releases/" 2>&1 | head -10
echo ""
echo "-- PM2 status --"
pm2 status 2>&1 | tail -10
echo ""
echo "-- port $PORT listening? --"
ss -tlnp 2>/dev/null | grep ":$PORT" || echo "  NOT listening"
echo ""

echo "=== 2. Stop PM2 instance for our app only ==="
pm2 delete "$APP_NAME" 2>/dev/null
pm2 kill 2>/dev/null
sleep 1

echo ""
echo "=== 3. Clean atomic-deploy state (does NOT touch .next/ or existing files) ==="
rm -rf "$APP_DIR/releases"
rm -f  "$APP_DIR/current"
rm -f  "$APP_DIR/.current-sha"
rm -f  "$APP_DIR/deploy.tar.gz"
echo "  removed: releases/, current, .current-sha, deploy.tar.gz"
echo ""

echo "=== 4. Existing in-place bundle? ==="
if [ -f "$APP_DIR/.next/standalone/server.js" ]; then
  echo "  YES — at $APP_DIR/.next/standalone/server.js"
else
  echo "  NO — no in-place bundle. Will need to download one."
  echo "  Trigger a manual deploy after this script:"
  echo "    Actions > Deploy > Run workflow > ref: main"
  echo ""
  echo "=== EXTRACTING FROM CURRENT deploy.tar.gz IF PRESENT ==="
  if [ -f "$APP_DIR/.next/standalone/server.js.tmp.tar.gz" ]; then
    tar -xzf "$APP_DIR/.next/standalone/server.js.tmp.tar.gz" -C "$APP_DIR"
  fi
fi
echo ""

echo "=== 5. Write in-place ecosystem.config.cjs (uses cwd=$APP_DIR) ==="
cat > "$APP_DIR/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [
    {
      name: '$APP_NAME',
      script: '.next/standalone/server.js',
      cwd: '$APP_DIR',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: $PORT,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
    },
  ],
};
EOF
echo "  written."
echo ""

echo "=== 6. Start PM2 ==="
cd "$APP_DIR"
pm2 start ecosystem.config.cjs --only "$APP_NAME"
pm2 save 2>/dev/null
sleep 3

echo ""
echo "=== 7. Health check ==="
ok=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
    ok=1
    break
  fi
  echo "  attempt $i: not ready"
  sleep 2
done

echo ""
echo "=== 8. Final state ==="
pm2 status
echo ""
if [ "$ok" -eq 1 ]; then
  echo "OK: app is responding at $HEALTH_URL"
  curl -sS -o /dev/null -w "Root:    HTTP %{http_code} %{content_type} %{size_download}b\n" "$HEALTH_URL"
  CSS="\$(curl -sS $HEALTH_URL | grep -oE '/_next/static/chunks/[^\\\"]+\\\.css' | head -1)"
  if [ -n "$CSS" ]; then
    curl -sS -o /dev/null -w "CSS:     HTTP %{http_code} %{content_type} %{size_download}b\n" "http://127.0.0.1:$PORT$CSS"
  fi
else
  echo "STILL DOWN. Run this and paste output:"
  echo "  cd $APP_DIR && NODE_ENV=production PORT=$PORT timeout 8 node .next/standalone/server.js 2>&1 | head -30"
  echo "---"
  echo "PM2 error log:"
  cat /home/*/.pm2/logs/$APP_NAME-error-0.log 2>/dev/null | tail -30
  echo "---"
  echo "PM2 out log:"
  cat /home/*/.pm2/logs/$APP_NAME-out-0.log 2>/dev/null | tail -30
fi