---
status: in-progress
branch: claude/batch-loop-design
timestamp: 2026-08-14T11:28:45Z
files_modified: []
---

## Working on: t3 reviewed, amendment round proposed

### Summary

T3 (pure sync join module, `js/storage/recipe-sync-join.js`) is landed and
twice-reviewed (unit lane 142, browser green, all pushed at `ecf848b`). A
codex CROSS-MODEL review of T3 then found six unique findings at the design
seams and T4 execution boundary — places the within-module rounds structurally
could not see (~8% overlap with prior findings; the low overlap IS the value).
A full disposition was proposed to the maintainer and is **AWAITING GO**,
bundled with the open graft-with-warning decision on identity erasure.

### Decisions Made

- **PENDING (do not act without maintainer confirmation): the T3 amendment
  round as scoped below, which implicitly resolves identity-erasure as
  graft-with-warning.** The maintainer was asked to say "go" or redirect;
  neither has happened yet.
- Triage of the codex T3 cross-model round (all six verified against code):
  P1 identity erasure via legacy-LWW name join (`resolvePair`,
  recipe-sync-join.js:188 — id-vs-no-id name pair goes to plain LWW; if the
  id-less side wins the clock, the identity is erased and sync propagates the
  erasure fleet-wide; the strip event itself re-stamps updatedAt, favoring
  the attacker). P1 empty-vs-failed listing ambiguity (backends swallow →
  [] — a falsely-empty LOCAL listing makes every cloud record "cloud-only"
  and pulls clobber newer local records with no clock comparison). P1
  failed-write→delete data loss (plan orders writes before deletes but
  cannot express runtime write failure; executing a rename's delete after
  its write failed destroys the only copy). P2 key/body name-mismatch
  records treated as renames (item-18 family). P2 equal-clock rename
  divergence never surfaced (cmp===0 → unchanged, no warning, names diverge
  forever). P2 ingredient-free-recipe hole in the mid-scan backup guarantee
  (BackupRecipe's `Ingredients.length == 0 → return false` guard).
- **Proposed disposition:** T3 amendment round (graft-with-warning for
  identity erasure + delete/write linkage in plan output + key/body-mismatch
  classification + equal-clock warning); T4 spec additions (listing-failure
  contract: T4 calls stores so failure surfaces distinctly, aborts plan;
  executor skips any delete whose enabling write failed); bank the
  ingredient-free backup hole into the round-3 todo file next to the
  adjacent BackupRecipe design call.
- **Identity-erasure options weighed:** skip+warn (stalls sync forever on
  usually-same-recipe pairs), id-always-wins (discards newest edits — wrong
  priority), graft (content LWW wins, loser's RecipeId carried onto the
  winning id-less body, stamped SchemaVersion 2 — "identity follows the
  recipe", amended decision 6 applied to sync), graft+warning
  (recommended — decision 7's "visible, not silent"). Named counterargument:
  grafting attaches a dead lineage to a name-reusing NEW recipe — the same
  resurrection semantics already accepted for open-recipe re-save; must be
  recorded in the decision when taken. Same rule must apply to
  decideRecipePush (the two write paths must not disagree — that symmetry
  was itself a T3 review finding).
- Push-back recorded on the codex analysis's 8% framing: counting
  already-fixed Claude findings in the denominator overstates the drama;
  the directional conclusion (cross-model at boundaries earns its cost)
  stands. T4's full /review keeps the codex pass.

### Remaining Work

1. **Get the maintainer's GO** (or redirect) on: (a) the T3 amendment round
   scope, (b) graft-with-warning as the identity-erasure resolution.
2. **T3 amendment round** (pure module + tests): graft-with-warning (new
   SYNC_WARNINGS code, both planRecipeSync and decideRecipePush),
   delete-actions carry linkage to their enabling write, key/body
   name-mismatch → unreadable-style skip+warn, equal-clock divergent-names
   warning. Then /code-review medium (T3's review tier).
3. **T4 spec additions** in `.planning/p0.3-identity-design.md`: listing
   failure contract + executor delete rule. Then T4 itself (sync-manager
   swap + pushRecipe gated via decideRecipePush + body download), full
   gstack /review with codex pass.
4. **Bank** the ingredient-free backup hole into
   `.planning/todos/pending/2026-08-13-t2.6-round3-review-findings.md`.
5. T5 (browser round-trip, closes item 22), T6 (lift DO-NOT-START, rollout
   note, deleted-record resurrection sentence), then the merge-boundary full
   /review of #11 (include the round-3 banked findings) and MERGE #11.
6. Background: binder read (gates P0.4/P0.7), items 18-21/23, issues
   #6-#10, #12, #13.

### Notes

- The T2.6/T3 review rounds ran in a since-compacted window: round-3
  unapplied findings live in the todo file above; T3's applied rounds are in
  commit bodies `f0a9a86` (garbage-schema, placement fixpoint, push-gate
  agreement) and `eff888a` (blocked-name placement regression).
- "The identity-erasure finding" = codex's P1 on the legacy-LWW name join
  (reconstructed from code after compaction; the original write-up text is
  gone but the mechanism is verified at recipe-sync-join.js:188/:258).
- Codex is usable from this container again (three clean runs). The earlier
  duration-correlated hangs were environmental.
- Join module caller contract (T4): records arrive as {name, updatedAt,
  data} with data null when unreadable; execute actions IN ORDER; deletes
  never name a key any write targets — the amendment adds explicit
  write-failure linkage on top.
- PR #11: open/draft, no comments ever, no CI, mergeable; hourly check-in
  armed (next ~12:19Z). Re-arm subscribe_pr_activity + check-in on any
  fresh session — still the only unrecoverable state.
- STATE.md briefing is current through T3.
