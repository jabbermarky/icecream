#!/bin/bash
# Block until the async SessionStart hook has finished installing the toolchain.
#
# .claude/hooks/session-start.sh runs async (configured in .claude/settings.json),
# so a session can begin before node_modules and the playwright chromium build
# exist. Anything that needs them should wait first:
#
#     ./.claude/hooks/wait-for-setup.sh && xvfb-run -a npm test
#
# Exit codes:
#   0  setup completed successfully
#   1  setup failed, or timed out — do not proceed
#
# The status file's CONTENT carries the outcome, so a failed install fails fast
# here rather than being waved through by the mere existence of a marker.

set -uo pipefail

REPO="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
# Per-checkout, matching session-start.sh. A shared /tmp path would let one
# worktree's setup release another's waiters, and invites a symlink race.
STATUS_FILE="$REPO/.claude/.session-start-status"
INTERVAL=2

# Timeout must be a non-negative integer. Without this check a non-numeric
# value makes every `-ge` comparison error out, and the "bounded" wait becomes
# an infinite loop (reproduced with WAIT_FOR_SETUP_TIMEOUT=bogus).
TIMEOUT_RAW="${1:-${WAIT_FOR_SETUP_TIMEOUT:-300}}"
if ! printf '%s' "$TIMEOUT_RAW" | grep -qE '^[0-9]+$'; then
  echo "[wait-for-setup] invalid timeout '$TIMEOUT_RAW' (want a whole number of seconds); using 300" >&2
  TIMEOUT=300
else
  TIMEOUT="$TIMEOUT_RAW"
fi

# The SessionStart hook only does work in remote containers and exits early
# otherwise, so it never writes a status file locally. Waiting there would
# block on something that is never coming.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Reports the status file's verdict. Returns 0 = ok, 1 = failed, 2 = not ready.
read_status() {
  [ -f "$STATUS_FILE" ] || return 2
  local status
  status=$(head -1 "$STATUS_FILE" 2>/dev/null)
  case "$status" in
    ok) return 0 ;;
    failed*)
      echo "[wait-for-setup] setup reported a failure: $status" >&2
      echo "[wait-for-setup] the toolchain is incomplete; recover with:" >&2
      echo "[wait-for-setup]   npm install && npx playwright install chromium" >&2
      return 1
      ;;
    *) return 2 ;;
  esac
}

read_status; rc=$?
[ "$rc" -ne 2 ] && exit "$rc"

echo "[wait-for-setup] waiting for session setup to finish (timeout ${TIMEOUT}s)"
waited=0
while true; do
  if [ "$waited" -ge "$TIMEOUT" ]; then
    {
      echo "[wait-for-setup] TIMED OUT after ${TIMEOUT}s."
      echo "[wait-for-setup] node_modules and/or the chromium build may be missing."
      echo "[wait-for-setup] Check the SessionStart hook output, or run by hand:"
      echo "[wait-for-setup]   npm install && npx playwright install chromium"
    } >&2
    exit 1
  fi
  sleep "$INTERVAL"
  waited=$((waited + INTERVAL))
  read_status; rc=$?
  if [ "$rc" -ne 2 ]; then
    [ "$rc" -eq 0 ] && echo "[wait-for-setup] setup complete after ${waited}s"
    exit "$rc"
  fi
  # Periodic heartbeat so a long wait does not look like a hang.
  if [ $((waited % 30)) -eq 0 ]; then
    echo "[wait-for-setup] still waiting (${waited}s)"
  fi
done
