#!/bin/bash
# SessionStart hook — prepare a Claude Code on the web container for this repo.
#
# Without this, every new session rediscovers the same three blockers:
#   1. node_modules is absent on a fresh clone, so `npm test` cannot even start
#   2. the pinned playwright version's chromium build is not in the image, so
#      the browser fails to launch
#   3. gstack's accumulated knowledge lives in ~/.gstack, which is
#      container-local and gone
#
# Idempotent and non-interactive. Every network step is tolerant of failure so
# that a hook problem never blocks session startup.

set -uo pipefail

# Local runs already have a working environment; only fix up remote containers.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

REPO="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$REPO" || exit 0

echo "[session-start] preparing $REPO"

# --- 1. node dependencies --------------------------------------------------
# npm install (not ci) so the container's cached state is reused on later runs.
if [ -f package.json ]; then
  if npm install --no-audit --no-fund >/dev/null 2>&1; then
    echo "[session-start] npm dependencies ok"
  else
    echo "[session-start] WARN npm install failed; 'npm test' will not run"
  fi
fi

# --- 2. playwright browser -------------------------------------------------
# The image pre-bakes some chromium builds, but package.json's playwright may
# want a different revision. `playwright install` is a no-op when the matching
# build is already present.
if [ -d node_modules/playwright ]; then
  if npx --no-install playwright install chromium >/dev/null 2>&1; then
    echo "[session-start] playwright chromium ok"
  else
    echo "[session-start] WARN playwright browser install failed; browser tests will not run"
  fi
fi

# --- 3. codex CLI ----------------------------------------------------------
# Powers the cross-model outside voice in gstack's /plan-*-review and /codex.
# Needs OPENAI_API_KEY in the environment config to actually authenticate.
if ! command -v codex >/dev/null 2>&1; then
  if npm install -g @openai/codex >/dev/null 2>&1; then
    echo "[session-start] codex CLI installed"
  else
    echo "[session-start] WARN codex CLI install failed; outside voice unavailable"
  fi
fi

# --- 4. restore gstack memory ----------------------------------------------
# ~/.gstack is container-local. .planning/gstack-memory/ is the durable copy.
# Restore is additive: only files that are absent are written, so a session's
# own newer state is never clobbered.
GS_SRC="$REPO/.planning/gstack-memory"
GS_DST="$HOME/.gstack/projects/jabbermarky-icecream"   # gstack-slug for this repo
if [ -d "$GS_SRC" ]; then
  mkdir -p "$GS_DST"
  restored=0
  for f in learnings.jsonl decisions.jsonl decisions.active.json \
           question-log.jsonl timeline.jsonl tasks-eng-review.jsonl; do
    if [ -f "$GS_SRC/$f" ] && [ ! -f "$GS_DST/$f" ]; then
      cp "$GS_SRC/$f" "$GS_DST/$f" && restored=$((restored + 1))
    fi
  done
  if [ -f "$GS_SRC/eng-review-test-plan.md" ] && \
     ! ls "$GS_DST"/*eng-review-test-plan*.md >/dev/null 2>&1; then
    cp "$GS_SRC/eng-review-test-plan.md" "$GS_DST/eng-review-test-plan.md"
    restored=$((restored + 1))
  fi
  echo "[session-start] gstack memory: $restored file(s) restored"
fi

# --- notes for the agent ---------------------------------------------------
# test-app.js launches with headless:false, so the suite needs a virtual
# display in a container. Until that is made configurable, run:
#     xvfb-run -a npm test
echo "[session-start] note: run the suite as 'xvfb-run -a npm test' (test-app.js uses headless:false)"
echo "[session-start] done"
exit 0
