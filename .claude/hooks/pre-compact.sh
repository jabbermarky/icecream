#!/bin/bash
# PreCompact -- the last moment before the conversation is summarized.
#
# WHAT THIS CAN AND CANNOT DO
#
# It cannot brief the model. Only UserPromptSubmit, UserPromptExpansion and
# SessionStart have stdout that becomes model-visible context; PreCompact's
# output goes to the debug log. So this hook does not try to talk. It writes a
# digest to disk and lets session-briefing.sh read it back -- SessionStart fires
# with matcher "compact" on the far side of a compaction, and that hook is
# registered for every matcher precisely so it catches that edge.
#
# Two jobs:
#
# 1. THE DIGEST. STATE.md carries what is durable and curated. What compaction
#    actually destroys is the volatile stuff: which files were half-edited, what
#    was committed in this session and not yet pushed, which decisions were just
#    taken. None of that is in STATE.md and none of it belongs there. So it is
#    captured here, into a container-local file, and read once on the other side.
#
#    Deliberately NOT committed: it describes work in flight, not project state.
#    If the container dies the digest dies with it, and that is correct -- the
#    durable answer to reclamation is STATE.md plus the per-turn mirror.
#
# 2. DECISION COMPACTION. gstack models superseded decisions properly -- an
#    append-only log projected into a bounded active snapshot -- but nothing in
#    gstack ever calls --compact, so superseded entries accumulate in the active
#    log and get re-read at every session start. PreCompact is a good moment for
#    it: rare, and already a "tidy up before we lose detail" boundary.
#
# Ordering matters: compact first, then mirror, so the same push carries both
# the rewritten active log and the archive file compaction just created.

set -uo pipefail

REPO="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$REPO" || exit 0

HOOKS="$REPO/.claude/hooks"
DIGEST="$REPO/.claude/.recovery-digest"
GS="${GSTACK_HOME:-$HOME/.gstack}/projects/jabbermarky-icecream"

# --- 1. compact the decision log ------------------------------------------
# Best-effort in every direction: gstack may not be installed, and it needs bun.
# A missing tool must not cost us the digest or the mirror below.
DECISION_LOG="$HOME/.claude/skills/gstack/bin/gstack-decision-log"
if [ -x "$DECISION_LOG" ] && command -v bun >/dev/null 2>&1; then
  "$DECISION_LOG" --compact >/dev/null 2>&1 || true
fi

# --- 2. write the recovery digest ------------------------------------------
{
  echo "### Recovery digest (written by the PreCompact hook, $(date -u '+%Y-%m-%d %H:%MZ'))"
  echo
  echo "Context was compacted at this point. This is the volatile state that"
  echo "compaction drops; \`.planning/STATE.md\` has the durable picture."

  BRANCH=$(git branch --show-current 2>/dev/null)
  if [ -n "$BRANCH" ]; then
    echo
    echo "**Branch** \`$BRANCH\` at \`$(git log -1 --format='%h %s' 2>/dev/null)\`"

    # Work in flight. This is the highest-value line in the digest: a
    # half-finished edit is exactly what a summarizer drops and what the model
    # will otherwise cheerfully start over from scratch.
    DIRTY=$(git status --short 2>/dev/null | head -25)
    if [ -n "$DIRTY" ]; then
      echo
      echo "**Uncommitted — work was in flight:**"
      echo '```'
      echo "$DIRTY"
      echo '```'
    else
      echo
      echo "Working tree was clean."
    fi

    # Unpushed commits: what this session built that the remote has not seen.
    UNPUSHED=$(git log --oneline "@{upstream}..HEAD" 2>/dev/null | head -15)
    if [ -n "$UNPUSHED" ]; then
      echo
      echo "**Committed but not pushed:**"
      echo '```'
      echo "$UNPUSHED"
      echo '```'
    fi
  fi

  # Active decisions, straight from the snapshot rather than through
  # gstack-decision-search: the search binary needs bun and gstack, the snapshot
  # is plain JSON, and this hook must degrade to something rather than nothing.
  # Falls back to the committed mirror, which is what exists in a fresh
  # container before the async restore hook has run.
  # Fall through on an EMPTY source, not just a missing one. session-start.sh
  # restores ~/.gstack asynchronously, so the directory routinely exists before
  # it has any content -- breaking on "file present" would report no decisions
  # in exactly that window.
  for src in "$GS/decisions.active.json" "$REPO/.planning/gstack-memory/decisions.active.json"; do
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
    echo "**Decisions already settled — do not silently re-litigate these:**"
    echo "$DECISIONS"
    break
  done

  echo
  echo "Delete \`.claude/.recovery-digest\` once you have read it."
} > "$DIGEST" 2>/dev/null || true

# --- 3. mirror and push ----------------------------------------------------
# Last, so the push carries the compacted decision log and its new archive file.
[ -x "$HOOKS/mirror-memory.sh" ] && "$HOOKS/mirror-memory.sh" --push

exit 0
