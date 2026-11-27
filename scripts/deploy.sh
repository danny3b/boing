#!/bin/sh
# npm run deploy -- "opis zmian"
#  1. commituje niezapisane zmiany (jeśli są),
#  2. wypycha gałąź na GitHuba,
#  3. buduje dist/ i publikuje na Cloudflare Pages.
set -e
cd "$(dirname "$0")/.."

# prywatne konto Cloudflare — deploy trafia tylko tutaj
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-569d9ce8db7d1fde735846cc6ac48664}"

MSG="${1:-Deploy $(date '+%Y-%m-%d %H:%M')}"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if [ -n "$(git status --porcelain)" ]; then
  echo "→ Commit: $MSG"
  git add -A
  git commit -m "$MSG"
else
  echo "→ Brak zmian do commitu"
fi

echo "→ Push na GitHuba ($BRANCH)"
git push -u origin "$BRANCH"

echo "→ Build"
npm run build --silent

echo "→ Cloudflare Pages"
npx wrangler pages deploy dist \
  --branch "$BRANCH" \
  --commit-hash "$(git rev-parse HEAD)" \
  --commit-message "$(git log -1 --pretty=%s)"
