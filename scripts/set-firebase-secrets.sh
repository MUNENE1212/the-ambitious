#!/usr/bin/env bash
# Set the two Firebase service-account secrets from a downloaded JSON key.
#
#   ./scripts/set-firebase-secrets.sh ~/Downloads/ambitious-ke-xxxx.json
#
# Why a script rather than two `gh secret set` commands by hand: the private key
# must be BASE64-encoded before it goes into GitHub. A PEM key spans ~28 lines,
# and `appleboy/ssh-action` mangles multi-line values passed through `envs` —
# a truncated key produces the exact same 503-login failure as a missing one,
# but only AFTER a deploy reports success. Encoding it here means the workflow
# only ever handles a single line.
#
# The JSON key is read locally and never uploaded anywhere except GitHub's
# encrypted secret store. Delete it from Downloads once this finishes.

set -euo pipefail

KEY_FILE="${1:-}"

if [ -z "$KEY_FILE" ]; then
  echo "Usage: $0 /path/to/service-account-key.json" >&2
  exit 1
fi

if [ ! -f "$KEY_FILE" ]; then
  echo "No such file: $KEY_FILE" >&2
  exit 1
fi

if ! command -v gh >/dev/null; then
  echo "gh (GitHub CLI) is required: https://cli.github.com" >&2
  exit 1
fi

# Read the two fields with node rather than jq: node is already required to
# build this app, so it is on every machine that can run the repo, and jq is not.
read_field() {
  node -e '
    const fs = require("fs");
    const raw = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const v = raw[process.argv[2]];
    if (typeof v !== "string" || !v) {
      console.error(`Field "${process.argv[2]}" missing or empty in the key file.`);
      process.exit(1);
    }
    process.stdout.write(v);
  ' "$KEY_FILE" "$1"
}

EMAIL=$(read_field client_email)
PROJECT=$(read_field project_id)
PRIVATE_KEY=$(read_field private_key)

# Sanity-check before writing anything, so a malformed key fails here rather
# than halfway through a deploy.
case "$EMAIL" in
  *@*.iam.gserviceaccount.com) ;;
  *) echo "client_email does not look like a service account: $EMAIL" >&2; exit 1 ;;
esac

case "$PRIVATE_KEY" in
  *"BEGIN PRIVATE KEY"*) ;;
  *) echo "private_key is not a PEM private key." >&2; exit 1 ;;
esac

if [ "$PROJECT" != "ambitious-ke" ]; then
  echo "WARNING: project_id is '$PROJECT', expected 'ambitious-ke'." >&2
  echo "Press Ctrl-C to stop, or Enter to continue anyway." >&2
  read -r _
fi

B64=$(printf '%s' "$PRIVATE_KEY" | base64 -w0)

# Confirm it round-trips before it goes anywhere.
if ! printf '%s' "$B64" | base64 -d 2>/dev/null | grep -q "BEGIN PRIVATE KEY"; then
  echo "Base64 round-trip failed — refusing to write a broken secret." >&2
  exit 1
fi

echo "Setting FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY_B64..."
gh secret set FIREBASE_CLIENT_EMAIL -b "$EMAIL"
gh secret set FIREBASE_PRIVATE_KEY_B64 -b "$B64"

if [ "$PROJECT" != "ambitious-ke" ]; then
  echo "Setting FIREBASE_PROJECT_ID=$PROJECT"
  gh secret set FIREBASE_PROJECT_ID -b "$PROJECT"
fi

echo
echo "Done. Secrets now set:"
gh secret list | awk '{print "  " $1}'
echo
echo "Delete the JSON key file now:  rm $KEY_FILE"
