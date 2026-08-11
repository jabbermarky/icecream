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

# Validate the timeout. This has bitten three times, each in a different way,
# so the checks are deliberate:
#
#   * `grep -qE '^[0-9]+$'` is NOT sufficient. grep matches line by line, so
#     $'1\ninvalid' passes on its first line, and the loop comparison then
#     errors forever. `case` matches the WHOLE value and cannot be fooled by an
#     embedded newline.
#   * A digit-only check is NOT sufficient either. A very long digit string
#     overflows bash's signed 64-bit arithmetic, so every `-ge` errors with
#     "integer expression expected" and the bounded wait becomes infinite.
#     Magnitude is therefore bounded BEFORE any arithmetic runs.
#   * Leading zeros are stripped first, so "00000" is understood as 0 rather
#     than rejected for length.
#
# Default matches the hook's own timeout in .claude/settings.json; a shorter
# default would report a legitimately slow but successful setup as failed.
TIMEOUT_DEFAULT=600
TIMEOUT_MAX=3600
TIMEOUT_RAW="${1:-${WAIT_FOR_SETUP_TIMEOUT:-$TIMEOUT_DEFAULT}}"
TIMEOUT="$TIMEOUT_DEFAULT"
timeout_error=""

case "$TIMEOUT_RAW" in
  '' | *[!0-9]*)
    # Empty, or contains anything that is not a digit: a sign, a decimal
    # point, whitespace, a newline, letters.
    timeout_error="not a whole number of seconds"
    ;;
  *)
    timeout_trimmed=$(printf '%s' "$TIMEOUT_RAW" | sed 's/^0*//')
    timeout_trimmed="${timeout_trimmed:-0}"
    if [ "${#timeout_trimmed}" -gt 4 ] || [ "$timeout_trimmed" -gt "$TIMEOUT_MAX" ]; then
      timeout_error="out of range"
    else
      TIMEOUT="$timeout_trimmed"
    fi
    ;;
esac

if [ -n "$timeout_error" ]; then
  echo "[wait-for-setup] invalid timeout ($timeout_error); want 0-${TIMEOUT_MAX} seconds, using ${TIMEOUT_DEFAULT}" >&2
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
