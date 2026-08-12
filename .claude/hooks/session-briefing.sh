#!/bin/bash
# SessionStart briefing -- put the project's current state into the new
# session's context.
#
# WHY THIS EXISTS SEPARATELY FROM session-start.sh
#
# SessionStart is one of only three events whose stdout becomes context the
# model can see: "For most events, stdout is written to the debug log but not
# shown in the transcript. The exceptions are UserPromptSubmit,
# UserPromptExpansion, and SessionStart, where stdout is added as context that
# Claude can see and act on."
#
# But that does not apply to an async hook: with "async": true the hook "runs
# silently in background, output discarded". session-start.sh is async because
# it installs npm packages and a browser, so every line it has ever printed was
# thrown away. Restoring state to disk was only ever half the job -- a fresh
# session had no way to know the files existed.
#
# So this hook is SYNCHRONOUS and does nothing that could block: it reads one
# committed file and asks git two local questions. No network, no installs.
# The slow provisioning stays in session-start.sh.
#
# Registered for startup|resume|clear|compact|fork -- every matcher, unlike the
# provisioning hook. Surviving /clear and compaction is the entire point.
#
# Hook output is capped at 10,000 characters, which is a useful constraint: the
# briefing has to stay short enough to be read, so STATE.md keeps the durable
# detail and exposes only a bounded section here.

set -uo pipefail

REPO="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$REPO" || exit 0

STATE=".planning/STATE.md"
[ -f "$STATE" ] || exit 0

BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
HEAD_LINE=$(git log -1 --format='%h %s' 2>/dev/null || echo "unknown")

{
  echo "## Project state (from $STATE, injected by the SessionStart hook)"
  echo
  echo "Branch \`$BRANCH\` at \`$HEAD_LINE\`."
  echo
  # Everything between the markers. STATE.md holds the full picture; this
  # section is the part worth spending context on at turn zero.
  sed -n '/<!-- BRIEFING:START -->/,/<!-- BRIEFING:END -->/p' "$STATE" |
    sed '/<!-- BRIEFING:\(START\|END\) -->/d'
  echo
  echo "Read \`$STATE\` for the full picture before acting on any of it."
} | head -c 9500

exit 0
