# Project state

**This file is written when things change, not at the end of a session.**

The section between the `BRIEFING` markers is read by
`.claude/hooks/session-briefing.sh` and injected into every new session's
context — including after `/clear` and after compaction. Keep it short and
keep it true; everything below the markers is the detail it points at.

<!-- BRIEFING:START -->
### Where things are

**Shipped:** v0.5.0 (PR #4, merged). USDA ingredient import populates PAC, POD
and Sugar for the first time — measured 0/11 → 6/11 against the live FDC API,
Sugar 0/11 → 10/11. `idb` is vendored, so startup no longer depends on a CDN.
Suite green at 114 passed / 0 failed.

**In flight:** two workstreams.

1. **The batch loop** — linking recipe versions to what happened when they were
   churned. Design: `.planning/batch-loop-design.md`. Draft PR #11. **P0.1,
   P0.2, P0.5 are DONE; P0.3 is DESIGNED and two-thirds LANDED.** The identity
   design (`.planning/p0.3-identity-design.md`, eng-reviewed + outside voice,
   13 decisions) reversed the separate-store plan: identity lives IN the
   container behind `SchemaVersion: 2` — `RecipeId` + `SavedAt`, minted only
   at save, validated OUTSIDE the fail-closed gate so a stripped record warns
   instead of locking the user out. **T1 (v2 container) and T2 (minting,
   P0.6's merged guards, adoption on load/import, id-aware overwrite prompts)
   are landed and five-pass reviewed, and T2.5 (codex outside-voice round,
   decision 6 amended) plus T2.6 (two applied review rounds: SavedAt guard
   UTC-anchored, import backup taken after the identity scan, same-name
   re-import adopts silently, import failures reach ErrorMsg, BackupRecipe
   honors its arguments) landed on top** — unit lane `npm run test:unit` at
   113 cases, browser suite green. Round three's five unapplied findings live
   in `.planning/todos/pending/2026-08-13-t2.6-round3-review-findings.md`
   for the merge-boundary review. The T1 review also REVERSED a P0.5 pin:
   typed arrays now refuse at snapshot (JSON backends corrupt them silently).
   **T3 is LANDED and twice-reviewed** (`js/storage/recipe-sync-join.js` —
   id-first join, name fallback, `SavedAt` clock, schema guard, fixpoint
   placement so plans are input-order independent; unit lane at 142, and
   `decideRecipePush` is ready as pushRecipe's gate). **The codex cross-model
   round on T3 is CLOSED by decision 14 (maintainer, 2026-08-14): legacy
   conflicts REJECT — an id-less body never replaces an identified record
   (`SYNC_WARNINGS.LEGACY_CONFLICT`, both write paths; unit lane at 146);
   graft-with-warning was withdrawn as over-design for N=1. The
   identified-winner direction stays open; `scripts/migrate-legacy-recipes.js`
   (throwaway, console-pasteable) drains the legacy population. The round's
   two executor rules moved into T4's entry in the design doc; its P2s are
   banked as items 6–8 of the round-3 todo file.**
   **T4 is LANDED and full-round reviewed (2026-08-14):**
   `js/storage/recipe-sync-executor.js` (collect strict listings + bodies →
   plan → execute; listing failure aborts with no writes; any write failure
   skips all deletes; `executeGatedPush` is the tested fetch→decide→write
   path pushRecipe uses) and sync-manager is now a thin wiring layer over
   it. The review round (testing/maintainability/security specialists +
   Claude adversarial + codex — the ONE full fan-out for this PR) applied:
   Drive listing pagination (silent >100-file truncation was the
   silent-clobber class T4 exists to kill), Drive query-value escaping
   (apostrophe names created duplicate files every save), anchored filename
   decode (closes banked item 23 for listings), listRecipes→Strict DRY
   inversion in both backends, IndexedDB strict listing off the lossy
   updatedAt index, delete failures fold into sync status + warn, warning
   batching for the one-slot status bar. Unit lane at 170, browser green.
   Nine design-level findings banked as items 9–18 of the round-3 todo
   file — the sharpest is item 9: sync's own rename residue (skipped/failed
   delete) re-joins as DUPLICATE_ID and stalls until hand-fixed.
   **T5 is LANDED (2026-08-14), RESCOPED for the UI/UX replacement:**
   `testContainerRoundTrip` in test-app.js round-trips a
   `buildRecipeContainer` container through real IndexedDB with 15
   assertions and ZERO selectors — schema version, RecipeId intact,
   SavedAt, `containerProblem === null` (the refusal gate accepting what
   the canonical builder produced, unpinned in both lanes until now),
   hydration, detachment from post-build mutation, and decision 7's
   warn-don't-lock-out with no identity supplied. The original T5 drove
   the round-trip through the Save/Load buttons; with the UI being
   replaced and test-app.js carrying ~114 selector-bound sites, that form
   writes the test twice. Durability item 22 split the same way: its
   assertion half landed, its Load-button half re-banks as a requirement
   on the redesign's library surface.
   **Remaining: T6** (lift DO-NOT-START in
   batch-loop-design.md, rollout note: reload every device at deploy, verify
   cache-busting, run migrate-legacy-recipes.js, deleted-record resurrection
   sentence — banked item 14). P0.6 shrank to the copy button +
   rename-refusal UI. P0.4
   and P0.7 are unblocked by identity but still gated on the binder read.

   **The 18 banked items are now redesign-triaged** (see the tag rubric in
   `.planning/todos/pending/2026-08-13-t2.6-round3-review-findings.md`):
   ten `[REDESIGN-INDEPENDENT]` (carrying every `[DATA-LOSS]` tag — file
   these as issues before the redesign takes over as the focus), three
   `[REDESIGN-ENABLER]` (items 3, 8, 18 — the `BackupRecipe` design call
   and a pure `syncOutcome()`; do before the new UI is wired), five
   `[REDESIGN-DEFER]`. No `[LEGACY]` item remains — decision 14 closed
   that class.
2. **Ingredient onboarding** — nine tasks remain after v0.5.0. The durable ones
   are issues #6–#10. **#7 shrinks to "add ingredient cases"** now that the
   node lane exists: `firstNutritionValue()` still has zero tests and was
   written wrong twice in one session, caught both times by review rather than
   by the suite.

**Waiting on the maintainer:** read the binder — twenty batches, one evening,
no code. It produces the churn sheet's real schema and answers what counts as
a batch (gates P0.4 and P0.7). The identity-sync design question is ANSWERED;
T3/T4 are unblocked code. Ingredient onboarding (#6–#10) also remains open.

### Do these at the start of a session

- **Re-subscribe to PR #11** with `subscribe_pr_activity` — a subscription does
  not survive a container, and this is the only piece of state that cannot be
  restored from disk.
- Tests need a virtual display and the async provisioning hook:
  `./.claude/hooks/wait-for-setup.sh && xvfb-run -a npm test`

### Conventions that are easy to violate by accident

- Draft PR on the **first** commit of a branch, never at the end. The PR body
  carries a live checklist.
- Durable work becomes a GitHub issue; session-scoped steps stay in the PR
  checklist.
- Decisions get written down when made — into this file, the PR, or
  `decisions.jsonl` — because the session they were made in will not survive.
<!-- BRIEFING:END -->

## Open on GitHub

| | |
|---|---|
| PR #5 | Durable ingredient tasks carried forward (draft) |
| PR #11 | Batch loop design (draft, live checklist) |
| #6 | T1 extract shared derivation — P1, gates #7 |
| #7 | T6 node test lane — **P1, most urgent**, blocked by #6 |
| #8 | T7 regression guards — P1, blocked by #7 |
| #9 | T2b reconciliation — P1, **blocked on the apportionment decision** |
| #10 | T5 provenance sidecar — P2 |

Branch: `claude/batch-loop-design`. The old
`claude/garry-tan-gstack-install-lp58z2` is merged and its remote ref still
exists — the git proxy refuses branch deletion, so remove it from the GitHub UI
when convenient.

## The two workstreams

### 1. Ingredient onboarding

Design: `.planning/ingredient-onboarding-design.md`
Carryover: `.planning/todos/pending/2026-08-11-durable-ingredient-tasks-carryover.md`

T0 and T2a shipped. Of the nine remaining, four (T3, T4, T8, T9) are repairs to
code a rewrite would delete; the rest are issues #6–#10.

`/ship` overrode its coverage gate at 25% on the explicit understanding that #7
lands next. That promise is outstanding.

### 2. The batch loop

Design: `.planning/batch-loop-design.md` — the current source of truth, carrying
its own review report.

The maintainer already runs a working manual version-control system: versioned
recipe names, print as an immutable snapshot, annotate the page during the
churn, file by base recipe, copy-and-tweak for the next version. **The design
feeds that paper workflow rather than replacing it** — paper wins at capture.

## Decided, and still open

**Decided** (reasoning in the design doc and in commit messages): print-first
over a full digital loop; advisory lineage rather than referential integrity;
mechanical diff stored as printed plus optional intent; a new
`js/features/recipe-versions.js`; the batch loop builds the node test lane
itself; photos as separate Blobs; rename refused unconditionally on any saved
recipe; identity in a separate object store.

**Open, and blocking P0.3:**

1. **Identity has to sync.** The separate identity store solves legacy-client
   downgrade writes and creates a cross-device problem: sync carries only
   `recipe.data` (`sync-manager.js:122`) and Drive stores `{name, data}` with no
   sidecar, so a second device allocates its own id. "No sync changes" holds for
   everything except identity.
2. **Keying that store by name collides on delete and name reuse.** Needs
   tombstones plus name non-reuse, or keying by id with a name index.

**Open, not blocking:**

3. Is a reprint a new batch or the same batch? Is a cancelled print a record?
   Gates P0.4 and P0.7. **Answerable from the binder.**
4. Are photos portable or local-only? Gates P3.3 only.

## Known bugs found but not fixed

- **Silent cloud-save failure, two instances.** Drive's `saveRecipe` returns
  `false` on error (`google-drive-storage.js:79`); the callers discard it and
  report success (`sync-manager.js:242` calls `notifyStatus('synced')`,
  `sync-manager.js:122` does `stats.pushed++`). Sync can lie about having saved.
  Pre-existing, unrelated to either workstream. **Filed as issue #12.**
- ~~**Cloud write race.**~~ **FIXED in P0.5.** Save used to pass the live
  `Recipe` object to a fire-and-forget cloud write that stringifies only after
  Drive's `findFileByName` round trip, so edits made in that window entered the
  cloud payload while IndexedDB held the earlier state. `buildRecipeContainer`
  now returns a detached, deeply frozen `structuredClone`, and both backends
  receive that same object. Pinned end to end by
  `tests/unit/recipe-roundtrip.test.js` ("P0.5 RACE").
- `.planning/codebase/STRUCTURE.md` omits `recipe-manager.js` (1,407 lines, the
  largest file in the project) even after a sync commit that claimed to fix it.

## How state survives a cleared session

| Mechanism | What it covers |
|---|---|
| `.claude/hooks/mirror-memory.sh` on `Stop` | Copies `~/.gstack` into `.planning/gstack-memory/` and commits it, every turn — working branches only, silent on the default branch. Pushes (on compact/end) publish the whole branch; the hook names any non-memory commits it is about to publish. |
| `.claude/hooks/pre-compact.sh` on `PreCompact` | Compacts the decision log, writes a recovery digest, then mirrors and pushes. |
| `.claude/hooks/mirror-memory.sh --push` on `SessionEnd` | Mirror and push on `/clear` and friends. |
| `.claude/hooks/session-briefing.sh` on `SessionStart` | Reads the briefing above, the recovery digest and the settled decisions into the new session's context. Synchronous, because an async hook's stdout is discarded. |
| `.claude/hooks/session-start.sh` on `startup\|resume` | Restores the mirror into `~/.gstack`, installs the toolchain, authenticates codex. Async. |
| GitHub issues and the PR checklist | Anything that must outlive the branch. |

**The one thing none of that covers** is the PR activity subscription, which is
why it is the first line of the briefing.

### Surviving compaction, specifically

Compaction destroys different things than a container does. STATE.md stays true
and readable across it; what actually goes missing is which files were
half-edited and which decisions were just taken. `pre-compact.sh` captures that
into `.claude/.recovery-digest` — deliberately **not** committed, because it
describes work in flight rather than project state — and the briefing hook reads
it back on the far side, since `SessionStart` fires with matcher `compact`.

It also runs `gstack-decision-log --compact`, which gstack ships but never calls
from any skill: superseded decisions otherwise accumulate in the active log and
are re-read at every session start.

Two hazards found while building this, both of which bit before they were fixed:

- **An empty source can blank the mirror.** `session-start.sh` restores
  `~/.gstack` asynchronously while the `Stop` hook runs every turn, so a turn can
  complete with the directory present and empty. `copy_if_sane` refuses any copy
  that would take a mirrored file from content to nothing. Shrinking is still
  allowed — compaction legitimately shrinks the active decision log.
- **A present-but-empty source hid the decisions.** Both hooks read `~/.gstack`
  with the committed mirror as fallback; they now fall through on an empty
  source, not merely a missing one.

## Historical: accumulated decisions through v1.4

Kept because the reasoning is still load-bearing in the code. This table stops
at the v1.4 milestone (archived 2026-01-15); everything after it is in
`decisions.jsonl` and in commit messages.

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 07 | Deferred Recipe access via getRecipe function | Recipe not available at module load time |
| 07 | Return InitYolkTable from initYolkCalculator | Tab handler needs access to initialize yolk values |
| 08 | Constructor defaults object for cRecipe | Decouple class from DOM at construction time |
| 08 | Inject RecipeDataColumns via getRecipeDataColumns | Avoid circular dependency with future recipe-manager |
| 09 | Accessor functions for module state | Allow app.js to interact with RecipeBackup/RecipeStack/sortBy owned by recipe-manager |
| 09 | Self-contained recipe-manager module | UpdateRecipeSums now internal, no callback injection needed |
| 09 | initRecipeButtons for button handlers | Keeps handler implementations in recipe-manager module |
| 09 | Remove Check for Updates feature | Deprecated feature with strict mode bug, cleaner to remove than fix |
| 10 | RECIPE_COLS constant for column indices | Avoid magic numbers; safer when columns change |
| 10 | Mousedown tracking for drag handle restriction | dragstart target is always the row, not clicked element |
| 11 | Clear sortBy on drag-drop reorder | Prevent misleading sort indicator after manual reorder |
| 11 | DOM-based test verification | window.Recipe reference becomes stale after setRecipe() calls |
| 12 | idb library from ESM CDN | No npm install or bundler needed, lightweight — **superseded in v0.5.0, now vendored** |
| 12 | Storage interface pattern | Enables future backend swaps (cloud sync) without changing consumers |
| 12 | Graceful error handling in storage | Return null/empty array on failure, matches existing parseRecipeFile pattern |
| 13 | Callback pattern for library actions | onLoad/onDelete callbacks allow flexible action handling |
| 13 | Browser confirm() for delete | Simpler than custom modal, effective UX |
| 13 | Close modal after delete | Cleaner than refreshing list in place |
| 14 | Save to library as default | Primary action for most users; file export as secondary |
| 14 | Port detection in test runner | Piggyback on VSCode Live Server (5500) when available |
| 15 | Storage methods return boolean | Enables caller to check success/failure and show appropriate feedback |
| 16 | Single 'library' record for ingredients | Simpler than individual records, sufficient for current needs |
| 16 | Storage-first initialization | Enable library-first loading pattern |
| 17 | Fire-and-forget sync (no await) | Don't block user workflow for storage operations — **see "cloud write race" above** |
| 17 | Export sync function for recipe-manager | Allow cross-module sync when storing recipe as ingredient |
| 18 | columnLabels/buttonLabels parameters | Configurable dialog labels via parameter objects with defaults |
| 18 | Recipe-specific merge context | Library/Recipe columns + Keep Library/Use Recipe buttons |
| 19 | Made repository public | Free GitHub Pages hosting; user data stays in browser IndexedDB |
| 19 | Relative paths in webmanifest | Icons in same directory, use filenames for subdirectory compatibility |
| 20-03 | Right-click for sign-out | Keep UI clean - primary button action is sync/sign-in |
| 20-03 | Status indicator with 4 states | syncing/synced/error/offline for clear visual feedback |
| 20-04 | Store files in IceCream App Data subfolder | Keep user's Drive root clean |
| 20-04 | Timestamp-based conflict resolution | Newer wins; simple, predictable behavior |

**Deployed:** https://www.marklummus.com/icecream/
**v1.4 archive:** `.planning/milestones/v1.4-ARCHIVE.md`
