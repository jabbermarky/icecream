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
# Runs in ASYNC mode so session startup does not wait on a ~180MB browser
# download. Consequence: for a short window after startup the toolchain may not
# be ready yet. Two mitigations:
#   - the gstack memory restore runs BEFORE the async handoff, since it is
#     instant and local, so accumulated knowledge is available immediately
#   - a marker file is written when the slow work finishes, so readiness is
#     checkable rather than guessed. Block on it before using the toolchain:
#         ./.claude/hooks/wait-for-setup.sh && xvfb-run -a npm test
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

DONE_MARKER="${TMPDIR:-/tmp}/.icecream-session-start-done"
rm -f "$DONE_MARKER"

# --- 0. restore gstack memory (SYNCHRONOUS) --------------------------------
# Deliberately before the async handoff: no network, effectively instant, and
# it is the thing the agent benefits from having at turn one. ~/.gstack is
# container-local; .planning/gstack-memory/ is the durable copy. Restore is
# additive — only absent files are written — so a session's own newer state is
# never clobbered.
#
# No stdout before the async control line below, so the result is captured and
# printed afterwards.
GS_SRC="$REPO/.planning/gstack-memory"
GS_DST="$HOME/.gstack/projects/jabbermarky-icecream"   # gstack-slug for this repo
gs_restored=0
if [ -d "$GS_SRC" ]; then
  mkdir -p "$GS_DST" 2>/dev/null
  for f in learnings.jsonl decisions.jsonl decisions.active.json \
           question-log.jsonl timeline.jsonl tasks-eng-review.jsonl; do
    if [ -f "$GS_SRC/$f" ] && [ ! -f "$GS_DST/$f" ]; then
      cp "$GS_SRC/$f" "$GS_DST/$f" 2>/dev/null && gs_restored=$((gs_restored + 1))
    fi
  done
  if [ -f "$GS_SRC/eng-review-test-plan.md" ] && \
     ! ls "$GS_DST"/*eng-review-test-plan*.md >/dev/null 2>&1; then
    cp "$GS_SRC/eng-review-test-plan.md" "$GS_DST/eng-review-test-plan.md" 2>/dev/null &&
      gs_restored=$((gs_restored + 1))
  fi
fi

# --- async handoff ---------------------------------------------------------
# MUST be the first line on stdout. Everything past here runs in the background
# while the session starts.
echo '{"async": true, "asyncTimeout": 300000}'

echo "[session-start] preparing $REPO"
echo "[session-start] gstack memory: $gs_restored file(s) restored (synchronous)"

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
# build is already present. This is the slow step the async mode exists for.
if [ -d node_modules/playwright ]; then
  if npx --no-install playwright install chromium >/dev/null 2>&1; then
    echo "[session-start] playwright chromium ok"
  else
    echo "[session-start] WARN playwright browser install failed; browser tests will not run"
  fi
fi

# --- 3. codex CLI ----------------------------------------------------------
# Powers the cross-model outside voice in gstack's /plan-*-review and /codex.
if ! command -v codex >/dev/null 2>&1; then
  if npm install -g @openai/codex >/dev/null 2>&1; then
    echo "[session-start] codex CLI installed"
  else
    echo "[session-start] WARN codex CLI install failed; outside voice unavailable"
  fi
fi

# --- 3b. codex auth --------------------------------------------------------
# Codex CLI 0.147 does NOT read OPENAI_API_KEY from the environment. Without
# this step it returns "401 Unauthorized: Missing bearer or basic authentication
# in header" even with the variable correctly set. The key has to be stored via
# login, which writes ~/.codex/auth.json -- and that file is container-local, so
# this has to run on every cold start.
#
# Note that gstack's own auth probe only checks that the variable is non-empty,
# so it reports CODEX_MODE: ready in exactly the state that fails. Do not treat
# a passing probe as evidence the outside voice will work.
if command -v codex >/dev/null 2>&1; then
  if codex login status >/dev/null 2>&1; then
    echo "[session-start] codex already authenticated"
  elif [ -n "${OPENAI_API_KEY:-}" ]; then
    if printenv OPENAI_API_KEY | codex login --with-api-key >/dev/null 2>&1; then
      echo "[session-start] codex authenticated from OPENAI_API_KEY"
    else
      echo "[session-start] WARN codex login failed; outside voice unavailable"
    fi
  else
    echo "[session-start] note: OPENAI_API_KEY unset; codex installed but not authenticated"
  fi
fi

# --- notes for the agent ---------------------------------------------------
# test-app.js launches with headless:false, so the suite needs a virtual
# display in a container. Until that is made configurable, run:
#     xvfb-run -a npm test
echo "[session-start] note: run the suite as 'xvfb-run -a npm test' (test-app.js uses headless:false)"

touch "$DONE_MARKER"
echo "[session-start] done (marker: $DONE_MARKER)"
exit 0
