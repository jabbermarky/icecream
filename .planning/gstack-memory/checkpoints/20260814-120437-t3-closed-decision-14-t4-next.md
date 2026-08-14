---
status: in-progress
branch: claude/batch-loop-design
timestamp: 2026-08-14T12:04:37Z
files_modified: []
---

## Working on: t3 closed decision 14, t4 next

### Summary

P0.3 stands at T1+T2+T2.5+T2.6+T3 landed, every round reviewed, and the T3
codex cross-model round CLOSED by decision 14. Unit lane 146, browser green.
Tree clean; one memory-mirror commit (`21319b4`) push-pending (stop hook will
nag until pushed — do it first thing). **T4 is the next work**: sync-manager
swaps to the join module, with its spec now carrying the two executor rules
and the body-download contract. T4 gets the full gstack /review (the one
trust-boundary step left) — keep the codex outside voice in it; codex works
from this container again.

### Decisions Made

- **Decision 14 (maintainer, 2026-08-14): sync legacy conflicts REJECT — an
  id-less body never replaces an identified record.**
  `SYNC_WARNINGS.LEGACY_CONFLICT`, enforced in BOTH write paths
  (planRecipeSync and decideRecipePush; unit 142 → 146). Graft-with-warning
  was WITHDRAWN as over-design for N=1: with one real user, the honest
  population of id-less records is drained by a throwaway migration script
  instead of a permanent heuristic in the join.
  `scripts/migrate-legacy-recipes.js` (console-pasteable) does the draining.
  The identified-winner direction stays OPEN (an identified body may still
  LWW-replace an id-less one — that direction never erases identity).
- **The codex T3 round's executor rules moved into T4's design-doc entry:**
  (1) listing-failure ambiguity — T4 calls the stores in a way that surfaces
  failure distinctly and aborts the plan on a failed listing (genuinely-empty
  stays legal); (2) failed-write→delete linkage — a delete only executes if
  the write that vacates its key succeeded.
- **The round's P2s are banked** as items 6–8 of
  `.planning/todos/pending/2026-08-13-t2.6-round3-review-findings.md`
  (key/body name-mismatch → join classification; equal-clock rename
  divergence warning; ingredient-free-recipe backup hole joined to the
  BackupRecipe design call).
- Prior settled (see decision log): decision 6 amended (mint only when
  keeping would duplicate; identity follows the recipe); typed arrays refuse
  at snapshot; legacy-population closure is operational (reload every device
  at rollout) PLUS decision 14's architectural reject.

### Remaining Work

1. **Push `21319b4`** (memory mirror — stop-hook nag outstanding).
2. **T4 — sync-manager swaps to the join module.**
   `js/storage/sync-manager.js`: syncRecipes calls planRecipeSync with
   already-downloaded bodies (body download for unknown ids is the caller's
   job — decision 3); pushRecipe gates through decideRecipePush; execute
   actions in order with the two executor rules above; surface
   SYNC_WARNINGS.* through notifyStatus/UI vocabulary. Review: **full gstack
   /review including codex** (behavior change, prior coverage zero).
   sync-manager has NO unit harness — T4 should extract/inject enough to
   drive the executor from the node lane (the join module is already pure).
3. **T5 — browser round-trip of a built container** (closes item 22).
4. **T6 — paperwork:** lift DO-NOT-START in batch-loop-design.md; rollout
   note (reload every device, verify cache-busting, run
   migrate-legacy-recipes.js as part of the ritual); deleted-record
   id-resurrection sentence.
5. **Merge boundary for #11:** full /review over the whole diff (the /ship
   gate) + the banked round-3 items 1–8 considered there. Then merge, close,
   fresh branch for P0.4+.
6. The binder read (maintainer) — gates P0.4/P0.7.
7. Background: durability items 18–21/23, ingredient issues #6–#10, #12,
   #13, quality findings from the built-in /code-review (hooks dedup pair,
   save-tail dedup, test harness wiring — partially collapsed already).

### Notes

- **Codex is usable from this container** (three clean runs). Yesterday's
  hangs were environmental. Keep it in T4's review; its T3 round hit design
  seams and the execution boundary — 6 unique findings, all triaged.
- PR #11: open/draft, no comments ever, no CI, mergeable. Hourly check-in
  re-arms from this session (trigger armed ~12:19Z fire); re-arm
  subscribe_pr_activity + the check-in on any fresh session — the two
  unrecoverable states.
- PR body: current through T2 era; owes one consolidated update covering
  T2.5/T2.6/T3/decision 14 — do it with the T4 push rather than separately.
- Unit-lane gotchas that keep biting: async .ier import needs a
  setTimeout-0 tick before asserting; stub-DOM render throws are caught at
  loadRecipe call sites (console-only, deliberate); the browser suite is the
  ONLY lane that sees DisplayRecipe/slider oninput interactions
  (clear-after-display is load-bearing — a round-two review claim got this
  wrong and the browser suite caught it).
- `scripts/migrate-legacy-recipes.js` is deliberately throwaway and NOT
  wired into the app; it dies with Phase 0 unless the rollout note says
  otherwise.
