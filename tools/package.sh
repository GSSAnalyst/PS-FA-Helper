#!/usr/bin/env bash
# Builds the Chrome Web Store upload: dist/fa-helper-<version>.zip
# Only runtime files go in; docs, tools and git files stay out.
set -euo pipefail
cd "$(dirname "$0")/.."

FILES=(manifest.json background.js claude.js config.js kb.js markdown.js
       sidepanel.html sidepanel.css sidepanel.js icons kb/peoplebook-fa.json)

version=$(node -p 'require("./manifest.json").version')
for f in "${FILES[@]}"; do [ -e "$f" ] || { echo "Missing $f" >&2; exit 1; }; done
[ -e config.js ] || cp config.example.js config.js
for js in *.js; do node --check "$js"; done
if grep -q 'TEAM_API_KEY = ""' config.js; then
  echo "Note: config.js has no team key, so users will be asked for their own." >&2
else
  echo "Note: this build includes the team API key. Share it only with your team; don't publish it publicly." >&2
fi

mkdir -p dist
out="dist/fa-helper-$version.zip"
rm -f "$out"
zip -qr -X "$out" "${FILES[@]}" -x '*.DS_Store'
echo "Built $out ($(du -h "$out" | cut -f1))"
