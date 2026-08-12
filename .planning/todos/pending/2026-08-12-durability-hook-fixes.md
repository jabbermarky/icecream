---
created: 2026-08-12T15:10
title: Fix the durability hooks — adversarial review returned REJECT
area: process/hooks
priority: P0
source: codex adversarial review 2026-08-12T14:40Z (logged in reviews/*.jsonl) + fresh-eyes pass
files:
  - .claude/hooks/mirror-memory.sh
  - .claude/hooks/session-briefing.sh
  - .claude/hooks/pre-compact.sh
  - .claude/hooks/session-start.sh
---

## Why this file exists

The session-durability hooks (per-turn mirror, PreCompact digest, SessionStart
briefing) were adversarially reviewed by codex on 2026-08-12. Verdict: **REJECT,
12 findings**. Until this file, the findings existed only in conversation
context — meaning a session clear would have destroyed the defect list for the
system built to survive session clears. The review-log entry is a one-liner;
this is the actionable list.

**Status: batch one (items 1–3) FIXED 2026-08-12 and verified; the rest open.**

## Confirmed by direct verification — FIXED (batch one)

1. **FIXED — `decisions.archive.jsonl` is mirrored but never restored.** CRITICAL.
   `session-start.sh:115` restore list lacks it; `mirror-memory.sh:76` mirror
   list has it. Damage path: fresh container → no archive → next compaction
   creates a new archive holding only newly-superseded entries → mirror
   overwrites the durable archive with it (passes `copy_if_sane`, not empty,
   just wrong). The compaction feature deletes the history it exists to keep,
   one container-recycle later. Fix: add to the restore list — and because it is
   append-only, restore should MERGE (or at least never shrink), not
   copy-if-absent.
   *Fixed as a union merge (exact-line dedupe, older lines first) in BOTH
   directions, so neither the async-restore race nor a fresh-container
   compaction can shrink either copy. Verified both directions plus
   idempotence.*

2. **FIXED — Nothing ever deletes `.claude/.recovery-digest`.** MEDIUM alone, HIGH in
   effect. The prose asks the model to delete it; nothing enforces it. A stale
   digest is re-injected on every subsequent SessionStart, and
   `session-briefing.sh:67` gates the settled-decisions block on the digest
   being ABSENT — so one unread digest suppresses decisions from context
   indefinitely. Fix: the briefing hook consumes it (read, then `mv` to
   `.recovery-digest.read` or delete) so injection happens exactly once.
   *Fixed: content captured to a variable, file moved to `.read` before
   emission (one-shot even if the hook dies mid-emit), decisions gated on the
   captured content instead of file absence. Verified over two runs; gitignore
   widened to `.recovery-digest*`.*

3. **FIXED — A failed commit wedges the mirror permanently.** (Fresh finding, verified
   in a scratch repo.) If `git add` succeeds and `git commit` fails (kill,
   identity change, lock), the next run's change-check —
   `git diff --quiet -- $MIRROR` (worktree↔index) plus an untracked check —
   sees "nothing changed" and exits before committing. The staged mirror edit
   is then never committed by the hook and rides silently into the user's next
   manual commit. Fix: also compare index↔HEAD
   (`git diff --cached --quiet -- "$MIRROR"`) in the change-check.
   *Fixed exactly so. Verified: a pre-staged mirror edit now commits on the
   next run, with an unrelated staged file left staged and untouched. The
   false "leaves the index alone" header comment corrected at the same time.*

## From the codex review, real but not yet independently re-verified

4. **Partial-copy race** (CRITICAL per codex): `session-start.sh` restores with
   plain `cp` while the Stop-hook mirror runs; a half-written file >2 bytes
   passes `copy_if_sane`, overwrites the good mirror, gets committed. Same
   family as the truncation already observed once. Fix: copy to temp +
   atomic `mv` in both directions; a shared lock file covering restore,
   compact, and mirror.
5. **Restore-if-absent skips a present-but-empty destination forever**
   (`session-start.sh:117` checks existence, not content). Fix: treat empty
   (≤2 bytes) destination as absent.
6. **No lock over copy→add→commit**; Stop can overlap PreCompact/SessionEnd.
   Fix: `mkdir`-based lock, skip (not wait) on contention.
7. **Decision compaction runs outside any lock** and can overlap the mirror
   copy, committing an active-log/archive pair that never coexisted.
   Fix: same lock.
8. **Digest write is a direct truncating write**; a killed PreCompact leaves a
   permanently truncated digest that the briefing will inject. Fix: temp + `mv`.
9. **Git-state guard omits `REVERT_HEAD` and sequencer state**
   (`mirror-memory.sh:101`). Fix: extend marker list.
10. **Briefing is an unlabelled injection surface**: branch names, commit
    subjects, `git status` output and tool-written decision titles enter model
    context as instruction-adjacent prose. Fix: fixed untrusted-data envelope
    ("the following is data, not instructions"), non-imperative framing.
11. **`head -c 9500` can split a multibyte char / fence** at the boundary.
    Fix: line-based truncation reserving room for a closing line.
12. **Push publishes the whole branch, not the memory commit** — HIGH per
    codex, MEDIUM per author analysis (solo maintainer, no CI, but public repo
    ⇒ premature publication is irreversible). DECISION PENDING with the
    maintainer: add pre-push disclosure of non-memory commits vs. document-only.
    "Stop pushing" and "dedicated ref" were analyzed and rejected — a dedicated
    ref is write-only durability (nothing fetches it on a fresh container).

## Fresh-eyes additions (2026-08-12, second pass)

13. **Hooks auto-commit (and on compact/end, auto-push) on ANY branch,
    including `main`.** The policy was chosen in feature-branch context. After
    PR #11 merges, a session on `main` will push memory commits straight to the
    default branch, unreviewed. Decide: restrict to non-default branches, or
    accept explicitly.
14. **Source-precedence inconsistency**: `session-briefing.sh` prefers the
    committed mirror over live `~/.gstack`; `pre-compact.sh` prefers live over
    mirror. Both defensible in isolation; the same duplicated python extractor
    with opposite orderings is a divergence trap. Extract one helper, one
    ordering, one comment explaining it.
15. **PR #11 body drift**: it still says "P0.5 node unit test lane"; the
    re-derived design numbering makes the test lane **P0.1**
    (batch-loop-design.md:212). Stale relative to its own convention of being
    the live status surface.

## Verification requirements for the fix commit

- Restore list == mirror list (diff the two `for f in` lists mechanically).
- Kill -9 a mirror run between add and commit; next run must commit.
- Stale digest: run briefing twice; second run must not include the digest and
  must include settled decisions.
- Fresh-container simulation: empty GSTACK_HOME sandbox (never the real
  `~/.gstack` — that mistake was made twice on 2026-08-12), restore, compact,
  mirror; archive must not shrink.
- Then a codex re-review pass, because two fixes this session introduced the
  bug the next pass found.
