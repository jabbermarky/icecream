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
(
  # Serialized against the per-turn mirror, which takes the same lock: this
  # restore writes ~/.gstack while mirror-memory.sh reads it, and unserialized
  # the mirror can capture a half-restored store and commit it. flock releases
  # on process death, so a killed restore cannot wedge future mirrors. A 30s
  # wait is affordable -- this hook is already async.
  if command -v flock >/dev/null 2>&1; then
    mkdir -p "$REPO/.claude" 2>/dev/null
    exec 9>"$REPO/.claude/.memory.lock" && flock -w 30 9 || exit 0
  fi
  mkdir -p "$GS_DST" 2>/dev/null
  restored=0

  # "Needs restoring" means missing OR effectively empty (<=2 bytes covers "",
  # "[]" and "{}"). The old existence-only check skipped a present-but-empty
  # destination forever -- and a file some tool created empty before this
  # restore reached it is precisely the case that needs restoring.
  needs_restore() {
    [ ! -f "$1" ] || [ "$(wc -c < "$1" 2>/dev/null | tr -d ' ')" -le 2 ]
  }
  # Copy-to-temp + same-directory atomic rename: gstack tools read these files
  # while this async restore runs, and must never observe a half-written one.
  atomic_cp() {
    local tmp="$2.tmp.$$"
    if cp "$1" "$tmp" 2>/dev/null && mv -f "$tmp" "$2" 2>/dev/null; then
      return 0
    fi
    rm -f "$tmp" 2>/dev/null
    return 1
  }

  for f in learnings.jsonl decisions.jsonl decisions.active.json \
           question-log.jsonl timeline.jsonl tasks-eng-review.jsonl; do
    if [ -f "$GS_SRC/$f" ] && needs_restore "$GS_DST/$f"; then
      atomic_cp "$GS_SRC/$f" "$GS_DST/$f" && restored=$((restored + 1))
    fi
  done
  # decisions.archive.jsonl is append-only and must MERGE, not copy-if-absent.
  # This restore is async, so a decision compaction can run before it gets here
  # and create a local archive holding only newly superseded entries. Under
  # copy-if-absent that local file would win, and the next mirror would
  # overwrite the durable history with it -- compaction becoming the way the
  # record it exists to keep gets lost. Union with exact-line dedupe is safe
  # because entries are self-contained JSON events; mirrored (older) lines
  # stay first.
  if [ -f "$GS_SRC/decisions.archive.jsonl" ]; then
    if needs_restore "$GS_DST/decisions.archive.jsonl"; then
      atomic_cp "$GS_SRC/decisions.archive.jsonl" "$GS_DST/decisions.archive.jsonl" &&
        restored=$((restored + 1))
    else
      _amerge="$GS_DST/.decisions.archive.merge.$$"
      if awk '!seen[$0]++' "$GS_SRC/decisions.archive.jsonl" \
             "$GS_DST/decisions.archive.jsonl" > "$_amerge" 2>/dev/null &&
         mv -f "$_amerge" "$GS_DST/decisions.archive.jsonl" 2>/dev/null; then
        restored=$((restored + 1))
      fi
      rm -f "$_amerge" 2>/dev/null
    fi
  fi
  # Markdown artifacts (test plans). gstack writes these with a generated
  # prefix that encodes user and branch, so the mirrored name and the name a
  # fresh container would pick rarely match. Restore under the mirrored name --
  # /qa and /ship glob for these by suffix, not by exact filename.
  for f in "$GS_SRC"/*.md; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    [ "$base" = "README.md" ] && continue
    if [ "$base" = "eng-review-test-plan.md" ] &&
       ls "$GS_DST"/*eng-review-test-plan*.md >/dev/null 2>&1; then
      continue
    fi
    if needs_restore "$GS_DST/$base"; then
      atomic_cp "$f" "$GS_DST/$base" && restored=$((restored + 1))
    fi
  done
  # Review logs. These are what /ship's readiness dashboard reads, so losing
  # them makes a fresh session believe nothing has ever been reviewed. Filenames
  # are branch-derived and gstack's own naming is inconsistent for branches
  # containing a slash, so restore whatever names are present rather than
  # guessing one.
  if [ -d "$GS_SRC/reviews" ]; then
    for f in "$GS_SRC"/reviews/*.jsonl; do
      [ -f "$f" ] || continue
      if needs_restore "$GS_DST/$(basename "$f")"; then
        atomic_cp "$f" "$GS_DST/$(basename "$f")" && restored=$((restored + 1))
      fi
    done
  fi
  echo "[session-start] gstack memory: $restored file(s) restored"
)
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
