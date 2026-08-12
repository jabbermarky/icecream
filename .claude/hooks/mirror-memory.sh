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
# The hook DOES touch the index -- `git add -- <mirror>` stages the mirror paths
# -- but the pathspec-limited commit takes only those paths, so other staged
# work is never swept into an automatic commit (verified: unrelated staged files
# stay staged, untouched). If anything is unusual -- detached HEAD, a merge or
# rebase in progress, no identity configured -- this does nothing and exits 0.
# A memory mirror must never be the reason a turn fails or a bisect gets
# confused.

set -uo pipefail

PUSH=0
[ "${1:-}" = "--push" ] && PUSH=1

REPO="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$REPO" || exit 0

MIRROR=".planning/gstack-memory"
GS="${GSTACK_HOME:-$HOME/.gstack}/projects/jabbermarky-icecream"

[ -d "$GS" ] || exit 0
[ -d .git ] || exit 0

# --- lock ------------------------------------------------------------------
# One writer at a time across the whole copy->add->commit sequence. Stop can
# overlap PreCompact/SessionEnd (which run this same script), and the restore
# in session-start.sh writes the other direction; unserialized, a pathspec
# commit can capture a mix of two snapshots that never coexisted. flock, not a
# mkdir lock: the kernel releases it when the holder dies, so a killed hook
# can never wedge every future mirror. Short wait, then SKIP -- a missed turn
# is caught by the next one, and a memory mirror must never stall a turn.
# Degrades to unlocked (today's behaviour) if flock is absent.
mkdir -p .claude 2>/dev/null
if command -v flock >/dev/null 2>&1; then
  exec 9>".claude/.memory.lock" || exit 0
  flock -w 5 9 || exit 0
fi

# --- copy ------------------------------------------------------------------
mkdir -p "$MIRROR/reviews" 2>/dev/null || exit 0

# Never let an empty source blank out a mirror that has content.
#
# session-start.sh restores ~/.gstack ASYNCHRONOUSLY, and this hook runs on
# every turn -- so a turn can complete while ~/.gstack exists but holds nothing
# yet. A plain `cp` in that window copies emptiness over committed history and
# then commits it. Observed, not theorised: a run with a deliberately empty
# store truncated decisions.jsonl and decisions.active.json in the mirror and
# pushed the result.
#
# Shrinking is fine and expected -- compaction moves superseded decisions out of
# the active log. What is never legitimate is a store going from content to
# nothing, so that is the only case refused. A 2-byte floor catches "[]" and
# "{}" as well as a zero-length file.
copy_if_sane() {
  local src="$1" dst="$2" size tmp
  [ -f "$src" ] || return 0
  size=$(wc -c < "$src" 2>/dev/null | tr -d ' ')
  case "$size" in ''|*[!0-9]*) return 0 ;; esac
  if [ "$size" -le 2 ] && [ -s "$dst" ]; then
    echo "[mirror-memory] refused to blank $(basename "$dst") from an empty source" >&2
    return 0
  fi
  # Copy-to-temp then same-directory rename, so no reader of the mirror -- git
  # committing it, pre-compact extracting decisions from it -- can ever observe
  # a half-written file. rename(2) is atomic; plain cp is a window.
  tmp="$dst.tmp.$$"
  if cp "$src" "$tmp" 2>/dev/null; then
    mv -f "$tmp" "$dst" 2>/dev/null || rm -f "$tmp" 2>/dev/null
  else
    rm -f "$tmp" 2>/dev/null
  fi
  return 0
}

for f in learnings.jsonl decisions.jsonl decisions.active.json \
         question-log.jsonl timeline.jsonl tasks-eng-review.jsonl; do
  copy_if_sane "$GS/$f" "$MIRROR/$f"
done

# decisions.archive.jsonl is where compaction moves superseded decisions -- the
# ONLY copy of that history once the active log is rewritten. It is append-only,
# so it is MERGED rather than copied: if a compaction ran in this container
# before the async restore delivered the old archive, the live file holds only
# newly superseded entries, and a plain copy would shrink the mirror's history
# to just those. Union with exact-line dedupe; mirrored (older) lines first.
if [ -f "$GS/decisions.archive.jsonl" ]; then
  if [ -s "$MIRROR/decisions.archive.jsonl" ]; then
    _amerge="$MIRROR/.decisions.archive.merge.$$"
    if awk '!seen[$0]++' "$MIRROR/decisions.archive.jsonl" \
           "$GS/decisions.archive.jsonl" > "$_amerge" 2>/dev/null; then
      mv -f "$_amerge" "$MIRROR/decisions.archive.jsonl" 2>/dev/null || rm -f "$_amerge"
    else
      rm -f "$_amerge" 2>/dev/null
    fi
  else
    copy_if_sane "$GS/decisions.archive.jsonl" "$MIRROR/decisions.archive.jsonl"
  fi
fi

# Review logs: gstack derives the filename from the branch and mangles a slash
# inconsistently, so mirror whatever names exist rather than guessing one.
for f in "$GS"/*reviews.jsonl; do
  [ -f "$f" ] && copy_if_sane "$f" "$MIRROR/reviews/$(basename "$f")"
done

# Test plans only. The other generated markdown in ~/.gstack is design-doc
# snapshots that are byte-identical to committed files in .planning/ -- git
# already holds that revision history, and mirroring it would add a duplicate
# copy of a 600-line document on every revision.
for f in "$GS"/*test-plan*.md; do
  [ -f "$f" ] && copy_if_sane "$f" "$MIRROR/$(basename "$f")"
done

# --- commit ----------------------------------------------------------------
# Bail out of anything that would make an automatic commit surprising.
git rev-parse --verify HEAD >/dev/null 2>&1 || exit 0
BRANCH=$(git branch --show-current 2>/dev/null)
[ -n "$BRANCH" ] || exit 0                       # detached HEAD

# Never on the default branch (maintainer decision, 2026-08-12). The per-turn
# policy was chosen in feature-branch context; after a PR merges, a session on
# the default branch would otherwise auto-commit -- and on PreCompact and
# SessionEnd auto-PUSH -- straight to it, unreviewed. On working branches the
# mirror still runs every turn; on the default branch, durable capture is a
# human decision. origin/HEAD is often unset in cloud clones (it is unset in
# this one), so fall back to matching the conventional names.
DEFAULT_BRANCH=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null)
DEFAULT_BRANCH=${DEFAULT_BRANCH#origin/}
if [ -n "$DEFAULT_BRANCH" ]; then
  [ "$BRANCH" = "$DEFAULT_BRANCH" ] && exit 0
else
  case "$BRANCH" in main|master) exit 0 ;; esac
fi
GIT_DIR_PATH=$(git rev-parse --git-dir 2>/dev/null) || exit 0
# REVERT_HEAD and sequencer (multi-commit cherry-pick/revert) were missing from
# the first version of this list -- an automatic commit landing mid-revert would
# be swept into the revert's conclusion.
for marker in MERGE_HEAD REBASE_HEAD CHERRY_PICK_HEAD REVERT_HEAD BISECT_LOG \
              rebase-merge rebase-apply sequencer; do
  [ -e "$GIT_DIR_PATH/$marker" ] && exit 0
done
git config user.email >/dev/null 2>&1 || exit 0

# Nothing changed is the common case -- most turns produce no new learnings.
# Three checks, and the --cached one is load-bearing: if a previous run staged
# the mirror and was killed before committing, worktree==index, so the plain
# diff alone would report "no change" on every subsequent turn and the staged
# edit would never be committed -- wedged until it rode into someone's manual
# commit. Verified, not hypothetical.
if git diff --quiet -- "$MIRROR" && \
   git diff --cached --quiet -- "$MIRROR" && \
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
#
# SCOPE DISCLOSURE (maintainer decision, 2026-08-12): git cannot push one
# commit without its ancestors, so pushing the branch publishes EVERYTHING
# unpushed on it -- not just the memory commit this hook made. On a public
# repository that publication is effectively irreversible. The push still
# happens: durability against container reclamation is this hook's entire
# purpose, and withholding it in exactly the sessions with real unpushed work
# would be backwards. But it happens NAMED, not silently -- the disclosure
# lands in the hook log, and the pushed history itself is the durable record.
if [ "$PUSH" = "1" ]; then
  EXTRA=$(git log --format='%h %s' "@{upstream}..HEAD" 2>/dev/null |
            grep -v ' chore(memory): mirror gstack state$' | head -10)
  if [ -n "$EXTRA" ]; then
    echo "[mirror-memory] note: pushing $BRANCH also publishes non-memory commits:" >&2
    printf '%s\n' "$EXTRA" | sed 's/^/[mirror-memory]   /' >&2
  fi
  git push -q -u origin "$BRANCH" >/dev/null 2>&1 ||
    { sleep 2; git push -q -u origin "$BRANCH" >/dev/null 2>&1; } ||
    echo "[mirror-memory] WARN push failed; state is committed locally only" >&2
fi

exit 0
