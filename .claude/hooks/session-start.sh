#!/bin/bash
# SessionStart hook — prepare a Claude Code on the web container for this repo.
#
# Without this, every new session rediscovers the same blockers:
#   1. node_modules is absent on a fresh clone, so `npm test` cannot even start
#   2. the pinned playwright version's chromium build is not in the image, so
#      the browser fails to launch
#   3. the codex CLI (gstack's cross-model outside voice) is not installed, and
#      it does NOT read OPENAI_API_KEY from the environment -- it needs a login
#   4. gstack's accumulated knowledge lives in ~/.gstack, which is
#      container-local and gone
#
# ASYNC AND MATCHER ARE CONFIGURED IN .claude/settings.json, NOT HERE.
# Printing {"async": true} from a hook script does nothing; `async` is a field
# on the hook handler. See https://code.claude.com/docs/en/hooks. The matcher is
# "startup|resume": resume MUST be included because a session can resume into a
# freshly recreated container with no toolchain at all. clear/compact/fork are
# excluded, since those happen mid-session in a container that is already set
# up and would only launch concurrent installs against the same files.
#
# The status file records whether setup actually succeeded, so
# wait-for-setup.sh can fail fast instead of green-lighting a broken toolchain.
#
# Idempotent and non-interactive. Every network step is failure-tolerant so a
# hook problem never blocks session startup.

set -uo pipefail

# Local runs already have a working environment; only fix up remote containers.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

REPO="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$REPO" || exit 0

# Per-checkout, not a shared /tmp path: what is being guarded is THIS
# checkout's toolchain (node_modules, browsers). Two sessions on the same
# worktree legitimately share it; two worktrees must not. Also avoids the
# symlink race a predictable world-writable /tmp path invites.
STATUS_FILE="$REPO/.claude/.session-start-status"
rm -f "$STATUS_FILE"
FAILURES=""

echo "[session-start] preparing $REPO"

# --- 1. node dependencies --------------------------------------------------
# npm install (not ci) so the container's cached state is reused on later runs.
if [ -f package.json ]; then
  if npm install --no-audit --no-fund >/dev/null 2>&1; then
    echo "[session-start] npm dependencies ok"
  else
    echo "[session-start] WARN npm install failed; 'npm test' will not run"
    FAILURES="${FAILURES}npm "
  fi
fi

# --- 2. playwright browser -------------------------------------------------
# The image pre-bakes some chromium builds, but package.json's playwright may
# want a different revision. `playwright install` is a no-op when the matching
# build is already present. This is the slow step async mode exists for.
if [ -d node_modules/playwright ]; then
  if npx --no-install playwright install chromium >/dev/null 2>&1; then
    echo "[session-start] playwright chromium ok"
  else
    echo "[session-start] WARN playwright browser install failed; browser tests will not run"
    FAILURES="${FAILURES}playwright "
  fi
fi

# --- 3. codex CLI ----------------------------------------------------------
if ! command -v codex >/dev/null 2>&1; then
  if npm install -g @openai/codex >/dev/null 2>&1; then
    echo "[session-start] codex CLI installed"
  else
    echo "[session-start] WARN codex CLI install failed; outside voice unavailable"
    FAILURES="${FAILURES}codex "
  fi
fi

# --- 3b. codex auth --------------------------------------------------------
# Codex CLI 0.147 does NOT read OPENAI_API_KEY from the environment. Without
# this it returns "401 Unauthorized: Missing bearer or basic authentication in
# header" even with the variable set. The key must be stored via login, which
# writes ~/.codex/auth.json -- container-local, so this reruns on cold start.
#
# gstack's own auth probe only checks that the variable is non-empty, so it
# reports CODEX_MODE: ready in exactly the state that 401s. A passing probe is
# not evidence the outside voice works.
#
# Not counted as a setup failure: the toolchain is still usable without it.
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

# --- 4. restore gstack memory ----------------------------------------------
# ~/.gstack is container-local. .planning/gstack-memory/ is the durable copy.
# Restore is additive: only absent files are written, so a session's own newer
# state is never clobbered.
GS_SRC="$REPO/.planning/gstack-memory"
GS_DST="$HOME/.gstack/projects/jabbermarky-icecream"   # gstack-slug for this repo
if [ -d "$GS_SRC" ]; then
  mkdir -p "$GS_DST" 2>/dev/null
  restored=0
  for f in learnings.jsonl decisions.jsonl decisions.active.json \
           question-log.jsonl timeline.jsonl tasks-eng-review.jsonl; do
    if [ -f "$GS_SRC/$f" ] && [ ! -f "$GS_DST/$f" ]; then
      cp "$GS_SRC/$f" "$GS_DST/$f" 2>/dev/null && restored=$((restored + 1))
    fi
  done
  if [ -f "$GS_SRC/eng-review-test-plan.md" ] && \
     ! ls "$GS_DST"/*eng-review-test-plan*.md >/dev/null 2>&1; then
    cp "$GS_SRC/eng-review-test-plan.md" "$GS_DST/eng-review-test-plan.md" 2>/dev/null &&
      restored=$((restored + 1))
  fi
  echo "[session-start] gstack memory: $restored file(s) restored"
fi

# --- status ----------------------------------------------------------------
# Written last, and its CONTENT records the outcome. A green marker after a
# failed install is worse than no marker: wait-for-setup.sh would wave through
# a toolchain that cannot run the tests.
if [ -z "$FAILURES" ]; then
  printf 'ok\n' > "$STATUS_FILE"
  echo "[session-start] done"
else
  printf 'failed: %s\n' "${FAILURES% }" > "$STATUS_FILE"
  echo "[session-start] done WITH FAILURES: ${FAILURES% }"
fi

# test-app.js launches with headless:false, so the suite needs a virtual
# display in a container: run it as `xvfb-run -a npm test`.
exit 0
