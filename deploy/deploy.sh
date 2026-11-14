#!/usr/bin/env bash
# Puts the newest code live. Run as the app's user, from anywhere:
#   sudo -u motiondots bash /home/motiondots/app/deploy/deploy.sh
# Pulls, installs, builds (the film bundle and the site), makes sure the
# browsers are there, then restarts with no downtime pm2 can avoid.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env.production ] || { echo "No .env.production — copy deploy/env.example to .env.production and fill it in first."; exit 1; }

echo "== code"
git pull --ff-only

echo "== packages"
npm ci --no-audit --no-fund

echo "== browsers: Remotion's Chrome (videos) and Playwright's Chromium (website pictures)"
node -e "require('@remotion/renderer').ensureBrowser({chromeMode:'headless-shell'}).then(()=>console.log('remotion chrome ready'))"
node node_modules/playwright-core/cli.js install --only-shell chromium

echo "== build"
npm run build

echo "== daily keep-alive (Supabase's free plan pauses a project left quiet for a week)"
SECRET="$(grep -E '^CRON_SECRET=' .env.production | cut -d= -f2- || true)"
( crontab -l 2>/dev/null | grep -v '/api/keep-alive' || true
  echo "23 4 * * * curl -fsS -m 30 -H 'Authorization: Bearer ${SECRET}' http://127.0.0.1:3000/api/keep-alive >/dev/null 2>&1" ) | crontab -

echo "== start / restart"
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save
echo "Live. Logs: pm2 logs motiondots"
