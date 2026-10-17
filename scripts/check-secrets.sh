#!/usr/bin/env bash
# Blocks commits that contain keys or secrets. Installed as .git/hooks/pre-commit by:
#   ln -sf ../../scripts/check-secrets.sh .git/hooks/pre-commit
# Also checks the local admin key and Firebase web key values never appear in staged changes.
set -euo pipefail
diff=$(git diff --cached -U0 --no-color -- . ':!scripts/check-secrets.sh' || true)
bad=0
for pat in 'AIza[0-9A-Za-z_-]{20,}' '-----BEGIN [A-Z ]*PRIVATE KEY' '"private_key"' 'ya29\.[0-9A-Za-z_-]+' 'sk-[A-Za-z0-9]{20,}' 'ghp_[A-Za-z0-9]{20,}' 'client_secret' 'GEMINI_API_KEY=[A-Za-z0-9]'; do
  if grep -qE -- "$pat" <<<"$diff"; then echo "✗ secret-like text staged (pattern: $pat)"; bad=1; fi
done
for f in "$HOME/.config/lessonbloom/admin-key"; do [ -s "$f" ] && grep -qF -- "$(tr -d '\n' < "$f")" <<<"$diff" && { echo "✗ the admin key is staged"; bad=1; }; done
if git diff --cached --name-only | grep -qiE '(^|/)\.env$|service-account.*\.json$|\.pem$|\.p12$|firebase-web\.json$'; then echo "✗ a secrets file is staged"; bad=1; fi
[ $bad -eq 0 ] || { echo "Commit blocked. Remove the secret (keys live in Secret Manager / ~/.config/lessonbloom)."; exit 1; }
