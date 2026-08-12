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
DIGEST=".claude/.recovery-digest"
[ -f "$STATE" ] || exit 0

BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
HEAD_LINE=$(git log -1 --format='%h %s' 2>/dev/null || echo "unknown")

# Consume the digest BEFORE emitting anything. PreCompact writes it; this hook
# is its only reader, and it must be injected exactly once. Nothing else ever
# deletes it, and asking the model to (the first design) fails open: a digest
# that lingered would be re-injected on every later SessionStart AND would
# suppress the settled-decisions section below, which used to gate on the
# file's absence. Moved aside rather than deleted so it stays inspectable;
# .claude/.recovery-digest* is gitignored. Consuming up front also keeps the
# one-shot property even if this hook dies mid-emit.
DIGEST_CONTENT=""
if [ -f "$DIGEST" ]; then
  DIGEST_CONTENT=$(cat "$DIGEST" 2>/dev/null) || DIGEST_CONTENT=""
  mv -f "$DIGEST" "$DIGEST.read" 2>/dev/null || rm -f "$DIGEST" 2>/dev/null
fi

{
  # The digest goes FIRST when present. It only exists on the far side of a
  # compaction, and on that path it is the more urgent of the two: STATE.md is
  # still true and still readable, but the half-finished edit the summarizer
  # just dropped is not recoverable from anywhere else.
  if [ -n "$DIGEST_CONTENT" ]; then
    printf '%s\n' "$DIGEST_CONTENT"
    echo
    echo "---"
    echo
  fi

  echo "## Project state (from $STATE, injected by the SessionStart hook)"
  echo
  echo "Branch \`$BRANCH\` at \`$HEAD_LINE\`."
  echo
  # Everything between the markers. STATE.md holds the full picture; this
  # section is the part worth spending context on at turn zero.
  sed -n '/<!-- BRIEFING:START -->/,/<!-- BRIEFING:END -->/p' "$STATE" |
    sed '/<!-- BRIEFING:\(START\|END\) -->/d'

  # Settled decisions, when the digest has not already listed them. Gated on
  # the CONTENT captured this run, not on the file: the file is already
  # consumed by now, and gating on its absence was the bug that let one stale
  # digest suppress decisions indefinitely. Read from the committed mirror in
  # preference to ~/.gstack: on a cold container the async restore hook has
  # not run yet, so ~/.gstack may not exist, while the mirror is in the
  # repository and therefore always present.
  if [ -z "$DIGEST_CONTENT" ]; then
    # Fall through on an empty source as well as a missing one: ~/.gstack is
    # restored asynchronously, so it can exist while still unpopulated.
    for src in ".planning/gstack-memory/decisions.active.json" \
               "${GSTACK_HOME:-$HOME/.gstack}/projects/jabbermarky-icecream/decisions.active.json"; do
      [ -f "$src" ] || continue
      DECISIONS=$(python3 -c '
import json, sys
try:
    rows = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(0)
for d in rows[:6]:
    t = d.get("title") or d.get("decision") or d.get("what") or ""
    if t:
        print("- " + " ".join(t.split())[:200])
' "$src" 2>/dev/null)
      [ -n "$DECISIONS" ] || continue
      echo
      echo "### Settled decisions"
      echo
      echo "Prior calls with recorded rationale. Do not silently re-litigate"
      echo "them; if you are about to reverse one, say so explicitly."
      echo
      echo "$DECISIONS"
      break
    done
  fi

  echo
  echo "Read \`$STATE\` for the full picture before acting on any of it."
} | head -c 9500

exit 0
