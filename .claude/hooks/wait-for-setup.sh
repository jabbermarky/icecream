#!/bin/bash
# Block until the async SessionStart hook has finished installing the toolchain.
#
# .claude/hooks/session-start.sh runs in async mode, so a session can begin
# before node_modules and the playwright chromium build exist. Anything that
# needs them should wait first:
#
#     ./.claude/hooks/wait-for-setup.sh && xvfb-run -a npm test
#
# Exit codes:
#   0  setup is complete (or there is nothing to wait for)
#   1  timed out — the toolchain is probably incomplete, so do not proceed
#
# Timeout defaults to 300s to match the hook's asyncTimeout: past that point the
# harness has already killed the hook, so the marker will never appear and
# waiting longer only delays a failure that has already happened.
# Override with an argument or $WAIT_FOR_SETUP_TIMEOUT.

set -uo pipefail

MARKER="${TMPDIR:-/tmp}/.icecream-session-start-done"
TIMEOUT="${1:-${WAIT_FOR_SETUP_TIMEOUT:-300}}"
INTERVAL=2

# The SessionStart hook only does work in remote containers and exits early
# otherwise, so it never writes a marker locally. Waiting there would block
# forever on something that is never coming.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Fast path: already done. The hook clears the marker before the async handoff,
# so a marker present here always refers to this session, never a stale one.
if [ -f "$MARKER" ]; then
  exit 0
fi

echo "[wait-for-setup] waiting for session setup to finish (timeout ${TIMEOUT}s)"
waited=0
while [ ! -f "$MARKER" ]; do
  if [ "$waited" -ge "$TIMEOUT" ]; then
    {
      echo "[wait-for-setup] TIMED OUT after ${TIMEOUT}s."
      echo "[wait-for-setup] node_modules and/or the chromium build may be missing."
      echo "[wait-for-setup] Check the SessionStart hook output, or run the steps by hand:"
      echo "[wait-for-setup]   npm install && npx playwright install chromium"
    } >&2
    exit 1
  fi
  sleep "$INTERVAL"
  waited=$((waited + INTERVAL))
  # Periodic heartbeat so a long wait does not look like a hang.
  if [ $((waited % 30)) -eq 0 ]; then
    echo "[wait-for-setup] still waiting (${waited}s)"
  fi
done

echo "[wait-for-setup] setup complete after ${waited}s"
exit 0
