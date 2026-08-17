# Project state

**This file is written when things change, not at the end of a session.**

The section between the `BRIEFING` markers is read by
`.claude/hooks/session-briefing.sh` and injected into every new session's
context — including after `/clear` and after compaction. Keep it short and
keep it true; everything below the markers is the detail it points at.

<!-- BRIEFING:START -->
### Where things are

**Shipped:** v0.5.0 (PR #4). USDA ingredient import populates PAC, POD and
Sugar for the first time. `idb` is vendored, so startup needs no CDN.

**JUST MERGED — PR #11, squash `644a598` (2026-08-15).** Phase 0's identity
work and the batch-loop design. P0.1, P0.2, P0.3, P0.5 are all DONE. Unit lane
175, browser suite green. What landed, in one paragraph each:

- **Identity (P0.3).** Recipes carry `RecipeId` + author-time `SavedAt` inside
  the container behind `SchemaVersion: 2` — NOT a separate store, which was
  reversed because one Drive file is the only atomic unit available. Identity
  is validated OUTSIDE the fail-closed gate, so a stripped record warns and
  re-mints instead of locking the user out. Minting happens only at save, under
  one invariant: at most one record per id.
- **Sync.** `recipe-sync-join.js` is the pure decision core (id-first join, name
  fallback, `SavedAt` clock, fixpoint placement so plans are order-independent);
  `recipe-sync-executor.js` executes (listing failure aborts before any write;
  any write failure skips all deletes). Legacy conflicts REJECT — an id-less
  body never replaces an identified record.
- **The batch loop is DESIGNED, not built.** `.planning/p0.4-batch-schema.md`,
  decisions 15–24, tasks B1–B6.

**✅ THE CODE IS LIVE — verified 2026-08-15 against the running site.** Earlier
STATE.md said "NOT DEPLOYED"; that was wrong. GitHub Pages serves the repo
directly with no build step or workflow, so **merging #11 to main WAS the
deploy**. `https://www.marklummus.com/icecream/js/models/recipe-serialization.js`
serves `RECIPE_SCHEMA_VERSION = 2`, and every P0.3/T4 file returns 200. The live
`recipe-manager.js` is byte-identical to `origin/main` and carries the
merge-boundary fixes. (`jabbermarky.github.io/icecream` 301s to the custom
domain over plain **http**, with no HSTS to upgrade it — **issue #27**. It is a
settings fix, not a code fix: GitHub's Enforce HTTPS is almost certainly greyed
out because Cloudflare proxying blocks certificate provisioning.)

**✅ THE ROLLOUT IS DONE — maintainer confirmed 2026-08-17.** All three steps
ran on every device: hard reload, sync, then the Info & FAQ migration button.
P0.3 is closed end to end — designed, built, deployed AND rolled out. Do not
re-raise it.

Two consequences worth carrying:

- **Legacy records ARE drained — every device reported ZERO skips.** Nothing
  unreadable, nothing from a newer build, nothing needing hand-attention. So
  identity is uniform across the whole library, which is the precondition the
  batch loop needs before it writes anything keyed on `RecipeId`. Decision 14's
  `SYNC_WARNINGS.LEGACY_CONFLICT` should now never fire; **if it does, it is
  unambiguously new information** — a device that was missed, or a record
  arriving from somewhere unexpected — not residue from the backlog.
- **The rollout's step 1 still FAILS as a general property.** There is no
  cache-busting (**#26**): bare unversioned paths in `index.html`, unversioned
  relative module imports in `app.js`, and a 4-hour Cloudflare TTL. This
  rollout worked because the steps were performed by hand. **Every future
  deploy has the same problem** until #26 is fixed, which is part of what
  **#40** (move to Cloudflare Pages) exists to close.

The migration itself was `scripts/migrate-legacy-recipes.js`, pasted into a
console — impossible on an iPad, which has none. PR #29 deleted the script and
moved it into the app, which surfaced four defects it had carried: it
downgraded records from newer builds, restamped the `SavedAt` clock sync orders
by, listed with the lossy `listRecipes`, and duplicated `mintRecipeId` (now in
`recipe-serialization.js`).

Full text and reasoning: the Rollout section of
`.planning/p0.3-identity-design.md`. Known limit recorded there too: deletes do
not propagate across devices.

**The app can now tell you which build it is running — PR #28, merged
2026-08-15.** `js/features/build-info.js` + the Info & FAQ panel report the
version, the recipe schema version, and this device's record counts
(identified / legacy / unreadable / **newer**). `VERSION` had been hardcoded at
`"0.4.0 beta"` while package.json said 0.5.0; a unit test now pins `APP_VERSION`
to package.json. The version is a **bundle constant on purpose** — a fetched
package.json would report the server's version while the browser ran stale JS,
which is the one case the panel exists for. `newer > 0` is the stale-cache
detector step 1 above cannot otherwise provide: it means another device is ahead
of this tab, so the verdict names the hard reload.

### What to work on

Nothing is waiting on the maintainer. Three live threads, in rough priority:

1. **The UI/UX replacement.** The maintainer is replacing the app's UI; some
   pages are already redesigned. All banked findings are triaged for it in
   `.planning/todos/pending/2026-08-13-t2.6-round3-review-findings.md`. Start
   with the three `[REDESIGN-ENABLER]` items (3, 8, 18 — the `BackupRecipe`
   design call and a pure `syncOutcome()`), which belong before the new UI is
   wired. P0.6 (copy button + rename-refusal surface) and P0.4's outcome
   surface are both pure UI and should land WITH the redesign, not before.
2. **Batch loop implementation — UNBLOCKED 2026-08-16 (`dc26016`, PR #25).**
   The codex GATE FAIL's 13 P1s and 2 P2s are all resolved and B1 has a text to
   build against. Most were already answered by the 2026-08-15 session
   (decisions 25–29 + `p0.4-data-model.mmd`); the stale artifact was the schema
   *document*. Seven new decisions (30–36) cover what remained: the snapshot is
   **copied** into the batch not referenced, a batch is never deleted by its
   recipe, `overall` leaves the signed axis set, deltas group and carry a range,
   the diff keys on `row_id` and **recomputes** under one coefficient set, and
   the prose contract splits into typed field / photo / transcribed text with
   **no OCR in scope**.
   **The tasks are GitHub issues now (2026-08-16), not prose in this file.**
   That is the point: status lives in a tracker that is live by construction,
   so it cannot drift from what a document claims. Sequence:
   **#31** B1 container → **#32** B2 store → **#33** B2.5 event log →
   **#34** P0.7+B3 as ONE cut → **#35** B5 sync → P1.1 → **#36** B4 diff →
   **#37** B6 outcome surface. Also filed: **#38** P0.6 (copy button +
   rename-refusal, held for redesign) and **#39** the QR payload format.
   Ahead of all of it: **#16** (parent-version pointer), ~an hour.
   **#15 is DONE and merged (PR #46, squash `3f3b29f`, deployed and verified
   live).** It did NOT go the way the audit predicted, and the correction is
   load-bearing: **`(220 - 230)` was never the type's range.** There is no
   per-type PAC range anywhere in the codebase — `cTarget` carries Fat, MSNF,
   Solids, POD, Stabilizer and never PAC. The band was the upstream author's
   numbers for gelato, inherited verbatim from `IceEd.html:1743` and compared
   to nothing. POD needed no new data (the per-type range existed all along;
   ×1000 puts it on the display scale, and NO type is 110–120). PAC now uses
   the derived `GetIdealPAC` ideal, which is type-sensitive via
   `Target.MSNF.Mean`.
   **So Cranberry v1.2's "347 PAC" was not a spec violation.** The Error row
   was right and the band was the wrong yardstick — `binder-audit.md:590` and
   `p0.4-batch-schema.md:736` both assert otherwise and need amending
   (**#48**). **#16 is undisturbed**: its evidence is that v1.2 is
   formula-identical to v1.0, found by diffing tables, not by reading the band.
   Banked from the same review: **#47**, `UpdateRecipeSums` mutating the shared
   `Targets` registry during a render, plus two different tolerance bands
   (−2%/+3% display vs ±5% optimizer) on one quantity.
   **#36 is blocked on #30** — decision 35 needs a `coefficient_set_id` and
   nothing in the ingredient library can produce one.
   **Four things stay open and are listed rather than invented:** half-steps on
   the signed scale, a struck-through process step, the churn timeline, and a
   pre-churn value for `OBSERVATION.occasion`. None blocks B1; the first and
   last are written into #37. The one that accrues cost while open is
   **#39, the QR payload format** — it blocks nothing, so it will never surface
   as a blocker, only as regret. Sheets printed against a format that later
   changes are unrecoverable paper.
3. **Ingredient onboarding** — issues #6–#10.

### Do these at the start of a session

- Tests need a virtual display and the async provisioning hook:
  `./.claude/hooks/wait-for-setup.sh && xvfb-run -a npm test`
- **PR #25 is open (draft)** — the P0.4 schema revision, now COMPLETE (all 15
  findings resolved, `dc26016`). Body carries the live checklist. Re-arm
  `subscribe_pr_activity` on it; that subscription is the only state no hook can
  restore. It is docs-only and ready to mark for review whenever the maintainer
  has read it.
- **Status lives in the GitHub Project now, not in a document.** The maintainer
  created it 2026-08-16 with a table view, a `Backlog` default (renamed from
  `Todo` rather than deleted, so existing assignments survived) and statuses
  `Backlog / Next / In progress / Blocked / Held for redesign / Done`. Two
  built-in workflows carry it: auto-add on `is:issue is:open`, and
  item-closed → Done. **Do not rebuild a status document.** If a task's state
  changes, change the issue — one `issue_write` call — and the board follows.
  **The maintainer's objection is the reason this exists** and is worth not
  re-litigating: `.planning/` sprawl means THEY cannot see what is happening.
  `.planning/` is agent memory, read by a session with no context; the Project
  is human-readable state. Different readers, not duplicates. Issue bodies are
  written LONG on purpose, carrying the reasoning inline, so the board is
  readable without opening a design doc.
- **The label taxonomy (2026-08-16), 8 labels, all 36 issues covered.** Seven
  describe the KIND of work — `batch-loop`, `phase-0`, `sync`, `ingredients`,
  `binder-audit`, `deploy`, `security` — plus one type label per issue
  (`bug` / `feature` / `task`) and `data-loss` as the one severity marker that
  cuts across. **Nothing encodes state**, so nothing competes with the Status
  field. `labels` REPLACES on update, so always send the full intended set.
- **Filed since #39:** **#40** hosting move to Cloudflare Pages (closes #26 and
  #27; do it AFTER the device rollout), **#41** the batch-loop parent with
  #31–#35 as sub-issues (live 0/5 count, no document maintains it), and
  **#42–#45** — P0.1, P0.2, P0.3, P0.5 retro-filed as CLOSED so Done is visible
  and future milestone bars are honest.
- **Milestones are PROPOSED, not created** — the maintainer creates them, then
  Claude assigns. v0.5.1 (#40, #15, #17 — batch them so they share one reload
  ritual, which #40 then ends), v0.6 (#39 + #41's five children — the loop
  closes), v0.7 (#30, #36, #16 — the diff answers the question). No due dates.
  A milestone contains its own blockers; absence of a milestone means
  not-yet-committed.
- **TOOL TRAP, hit twice: a success response does NOT mean the field was
  written.** `type` and `state: closed`-on-create were both silently discarded
  by `issue_write` while returning 200. Verify after writing. Also unavailable:
  Projects v2 (no tool — status moves are the maintainer's), issue types (404,
  org-only), custom issue fields (need an org), issue dependencies (readable
  via `issue_dependencies_summary`, not writable).
- **The Plan Room is a published artifact, and it is NOT in this repo:**
  `https://claude.ai/code/artifact/a8207f87-a919-45a0-8cf7-1d32b985f39e`
  A live status page for the batch loop — the plan, what is blocking, the
  review ledger, a glossary of both vocabularies, and the workstream risks.
  **Update it in place by passing that URL**; publishing without it creates a
  duplicate and orphans the maintainer's link. Favicon 🍦 — keep it stable.
  It is regenerated from `.planning/`, so it goes stale whenever STATE.md,
  the design docs, or the issue list move.

### Artifacts are session state too — write them down HERE

An artifact lives outside the repo, so no hook mirrors it, no commit records
it, and a compaction takes every trace of it with the turn that made it. This
already happened once: the Plan Room was published, recorded nowhere, and a
later session had to rediscover it with `Artifact list` — and could not recover
the favicon it had itself chosen. **Publishing an artifact is not done until
its URL is in this file.**

### Conventions that are easy to violate by accident

- Draft PR on the **first** commit of a branch, never at the end. The PR body
  carries a live checklist.
- Durable work becomes a GitHub issue; session-scoped steps stay in the PR
  checklist.
- Decisions get written down when made — into this file, the PR, or
  `decisions.jsonl` — because the session they were made in will not survive.
- **Token discipline is in CLAUDE.md and it is load-bearing.** One review round
  per build step, then bank the rest. The full multi-agent fan-out runs at most
  ONCE per PR, at the merge boundary. No polling automations.
<!-- BRIEFING:END -->

## Open on GitHub

**No open PRs.** #4, #5 and #11 are all merged.

Ingredient onboarding:

| | |
|---|---|
| #6 | T1 extract shared derivation — P1, gates #7 |
| #7 | T6 node test lane — **P1**, blocked by #6 |
| #8 | T7 regression guards — P1, blocked by #7 |
| #9 | T2b reconciliation — P1, **blocked on the apportionment decision** |
| #10 | T5 provenance sidecar — P2 |

Known defects and sync follow-ups:

| | |
|---|---|
| #12 | Silent cloud-save failure |
| #13 | XSS family: Notes and names reach innerHTML unsanitized |
| #14 | Notes carry stale into the next recipe version — **live defect, from the binder audit** |
| #15 | PAC/POD type range never checked (Error row measures the recipe's own target) |
| #16 | No parent-version pointer — version strings do not encode lineage |
| #17 | Unit-free temperature fields (already cost a silent 5 °C error) |
| #18 | Ingredient composition metadata re-derived every few months |
| #19 | Sync loads and deletes by mutable name, not store id — `[DATA-LOSS]` |
| #20 | Rename residue stalls as DUPLICATE_ID forever |
| #21 | Deletes never propagate across devices (no tombstones) — `[DATA-LOSS]` |
| #22 | Two sync join classification edges |
| #23 | Sync housekeeping: op constants, fixture dedup |
| #24 | Legacy records push/pull alternate forever (fallback clock is re-stamped) |

#15 and #16 are the two that would each independently have caught the binder's
one silent regression, and each is about an hour.

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

3. ~~Is a reprint a new batch or the same batch?~~ **CLOSED 2026-08-14.** A batch
   is a churn event; a reprint reuses the existing `planned` batch. A cancelled
   print is undetectable from the browser, so it leaves a `planned` batch that
   the `not churned` state clears in one tap.
   ~~Is ingredient order meaningful in the diff?~~ **CLOSED: no** (maintainer).
   The diff is keyed by ingredient name, no move operations.
4. **Are photos portable or local-only? NOW LOAD-BEARING, no longer P3.3-only.**
   Decision 20 withdrew the prose return path — prose gets photographed,
   attached and full-text searched rather than parsed — which makes the
   photograph the storage medium for the highest-value 20 % of the record.
   Decision 22 keeps it off P0.4's critical path (photos are attachments; a
   batch without its photo is still a batch), but it must be answered before
   prose is trusted to the system.

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

**The one thing none of that covers** is the PR activity subscription. There is
no open PR right now; the briefing says to re-arm it on the first commit of the
next one, because that is the moment it can be lost again.

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
