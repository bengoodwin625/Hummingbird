#!/bin/sh
# Stop hook: after each Claude turn, publish any changes. Commits everything and pushes to
# GitHub (main), which makes Render redeploy the live site. Nothing is pushed unless the
# backend tests, the content validator and the frontend type check all pass.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -n "$(git status --porcelain)" ] || exit 0

say() { printf '{"systemMessage": "%s"}\n' "$1"; }

if ! (cd backend && .venv/Scripts/python -m pytest -q >/dev/null 2>&1); then
  say "Auto-publish skipped: backend tests failed. Changes are not pushed."; exit 0
fi
if ! backend/.venv/Scripts/python scripts/validate_content.py content/ >/dev/null 2>&1; then
  say "Auto-publish skipped: a content file is invalid. Changes are not pushed."; exit 0
fi
if ! (cd frontend && npx tsc --noEmit >/dev/null 2>&1); then
  say "Auto-publish skipped: the frontend type check failed. Changes are not pushed."; exit 0
fi

files=$(git status --porcelain | awk '{print $NF}' | head -3 | tr '\n' ' ')
git add -A
git commit -q -m "Auto-publish: ${files}

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" || exit 0
if git push -q 2>/dev/null; then
  say "Published to GitHub; Render is redeploying the live site."
else
  say "Committed locally, but the push to GitHub failed. Run git push."
fi
