#!/bin/bash
# Mirror gstack's container-local memory into the repository, continuously.
#
# WHY THIS RUNS EVERY TURN AND NOT AT SESSION END
#
# ~/.gstack is destroyed when the container is reclaimed. Reclamation fires no
# hook at all -- not SessionEnd, not PreCompact -- so anything that captures
# state "on the way out" captures nothing in exactly the case it exists for.
# This is not hypothetical: the review log (15 entries, every review this
# project has run) survived only because someone thought to ask one turn before
# it would have mattered.
#
# So: capture on the way through. Stop fires when a turn completes, so the
# worst case is losing one turn's worth of learnings.
#
# Registered on three events in .claude/settings.json:
#   Stop        -- mirror and commit (no push; a push per turn would fill the
#                  PR timeline with chore commits and wake every PR watcher)
#   PreCompact  -- mirror, commit and push, before the summarizer drops detail
#   SessionEnd  -- mirror, commit and push, on /clear and friends
#
# SAFETY: every git operation here is pathspec-limited to the mirror directory.
# `git commit -- <paths>` takes those paths from the working tree and leaves the
# index alone, so a turn's in-progress staged work is never swept into an
# automatic commit. If anything is unusual -- detached HEAD, a merge or rebase
# in progress, no identity configured -- this does nothing and exits 0. A memory
# mirror must never be the reason a turn fails or a bisect gets confused.

set -uo pipefail

PUSH=0
[ "${1:-}" = "--push" ] && PUSH=1

REPO="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$REPO" || exit 0

MIRROR=".planning/gstack-memory"
GS="${GSTACK_HOME:-$HOME/.gstack}/projects/jabbermarky-icecream"

[ -d "$GS" ] || exit 0
[ -d .git ] || exit 0

# --- copy ------------------------------------------------------------------
mkdir -p "$MIRROR/reviews" 2>/dev/null || exit 0

for f in learnings.jsonl decisions.jsonl decisions.active.json \
         question-log.jsonl timeline.jsonl tasks-eng-review.jsonl; do
  [ -f "$GS/$f" ] && cp "$GS/$f" "$MIRROR/$f" 2>/dev/null
done

# Review logs: gstack derives the filename from the branch and mangles a slash
# inconsistently, so mirror whatever names exist rather than guessing one.
for f in "$GS"/*reviews.jsonl; do
  [ -f "$f" ] && cp "$f" "$MIRROR/reviews/$(basename "$f")" 2>/dev/null
done

# Test plans only. The other generated markdown in ~/.gstack is design-doc
# snapshots that are byte-identical to committed files in .planning/ -- git
# already holds that revision history, and mirroring it would add a duplicate
# copy of a 600-line document on every revision.
for f in "$GS"/*test-plan*.md; do
  [ -f "$f" ] && cp "$f" "$MIRROR/$(basename "$f")" 2>/dev/null
done

# --- commit ----------------------------------------------------------------
# Bail out of anything that would make an automatic commit surprising.
git rev-parse --verify HEAD >/dev/null 2>&1 || exit 0
BRANCH=$(git branch --show-current 2>/dev/null)
[ -n "$BRANCH" ] || exit 0                       # detached HEAD
GIT_DIR_PATH=$(git rev-parse --git-dir 2>/dev/null) || exit 0
for marker in MERGE_HEAD REBASE_HEAD CHERRY_PICK_HEAD BISECT_LOG rebase-merge rebase-apply; do
  [ -e "$GIT_DIR_PATH/$marker" ] && exit 0
done
git config user.email >/dev/null 2>&1 || exit 0

# Nothing changed is the common case -- most turns produce no new learnings.
if git diff --quiet -- "$MIRROR" && \
   [ -z "$(git ls-files --others --exclude-standard -- "$MIRROR")" ]; then
  exit 0
fi

git add -- "$MIRROR" >/dev/null 2>&1 || exit 0
# Pathspec-limited: commits the mirror from the working tree and leaves any
# other staged changes exactly as they were.
git commit -q --no-verify -m "chore(memory): mirror gstack state" \
  -m "Automatic, written by .claude/hooks/mirror-memory.sh. See that file for
why this is captured per-turn rather than at session end." \
  -- "$MIRROR" >/dev/null 2>&1 || exit 0

echo "[mirror-memory] committed gstack state on $BRANCH" >&2

# --- push ------------------------------------------------------------------
# Only on the way out (PreCompact, SessionEnd). One retry: this is best-effort,
# and the next event will push again anyway.
if [ "$PUSH" = "1" ]; then
  git push -q -u origin "$BRANCH" >/dev/null 2>&1 ||
    { sleep 2; git push -q -u origin "$BRANCH" >/dev/null 2>&1; } ||
    echo "[mirror-memory] WARN push failed; state is committed locally only" >&2
fi

exit 0
