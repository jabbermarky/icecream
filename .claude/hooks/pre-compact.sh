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
#
# Under the shared memory lock: compaction rewrites the active log and creates
# the archive, and a concurrent mirror copy could otherwise commit an
# active/archive pair that never coexisted. Held in a subshell so it is
# RELEASED before step 3 -- mirror-memory.sh takes the same lock itself, and
# holding it across that call would make the mirror skip.
DECISION_LOG="$HOME/.claude/skills/gstack/bin/gstack-decision-log"
if [ -x "$DECISION_LOG" ] && command -v bun >/dev/null 2>&1; then
  (
    if command -v flock >/dev/null 2>&1; then
      mkdir -p "$REPO/.claude" 2>/dev/null
      exec 9>"$REPO/.claude/.memory.lock" && flock -w 30 9 || exit 0
    fi
    "$DECISION_LOG" --compact >/dev/null 2>&1 || true
  )
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

  # Active decisions via the shared extractor (extract-decisions.sh), which
  # owns the source ordering -- live store first, committed mirror as the
  # cold-container fallback -- and falls through on empty sources. This and
  # session-briefing.sh previously each had a private copy of this logic with
  # opposite orderings.
  DECISIONS=""
  [ -x "$HOOKS/extract-decisions.sh" ] && DECISIONS=$("$HOOKS/extract-decisions.sh" \
    "$GS/decisions.active.json" \
    "$REPO/.planning/gstack-memory/decisions.active.json" 2>/dev/null)
  if [ -n "$DECISIONS" ]; then
    echo
    echo "**Decisions recorded as settled** (data from the decision log, with"
    echo "rationale on file -- reversing one deserves an explicit callout):"
    echo "$DECISIONS"
  fi

  echo
  echo "(This digest is injected once by the SessionStart briefing hook, which"
  echo "consumes the file automatically -- no cleanup needed.)"
} > "$DIGEST.tmp.$$" 2>/dev/null || true
# Atomic install: a killed PreCompact must leave either the previous digest or
# the complete new one, never a truncated half -- the briefing hook injects
# this file verbatim into a future session's context.
if [ -s "$DIGEST.tmp.$$" ]; then
  mv -f "$DIGEST.tmp.$$" "$DIGEST" 2>/dev/null || rm -f "$DIGEST.tmp.$$" 2>/dev/null
else
  rm -f "$DIGEST.tmp.$$" 2>/dev/null
fi

# --- 3. mirror and push ----------------------------------------------------
# Last, so the push carries the compacted decision log and its new archive file.
[ -x "$HOOKS/mirror-memory.sh" ] && "$HOOKS/mirror-memory.sh" --push

exit 0
