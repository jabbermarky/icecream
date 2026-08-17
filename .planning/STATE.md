# Project state

**This file is written when things change, not at the end of a session.**

The section between the `BRIEFING` markers is read by
`.claude/hooks/session-briefing.sh` and injected into every new session's
context — including after `/clear` and after compaction. Keep it short and
keep it true; everything below the markers is the detail it points at.

**It does not carry status.** What is open, what it depends on, what ships
together and what state each thing is in all live in GitHub — issues, the epic
(#41), milestones and the Project board. This file carries what a session
cannot get from there: facts that were expensive to learn, traps that look like
success, and the reasoning behind decisions that a bare issue title does not
explain. If something here can be answered by reading the board, it should be
deleted from here rather than kept in sync.

<!-- BRIEFING:START -->
### Read the board first

Status is in GitHub and nowhere else. Start with the **Project board** for
where things are, and **#41** for what the batch loop is made of and in what
order. Do not reconstruct a plan from this file — it deliberately no longer
holds one.

**If a task's state changes, change the issue.** One `issue_write` call and the
board follows. Never write status into a document.

### The app is deployed by merging, and that is a trap

GitHub Pages serves the repo directly — no build step, no workflow. **Merging
to `main` IS the deploy.** There is no separate deploy action to forget, and no
CI signal that a deploy happened.

The trap is the other half: **there is no cache-busting (#26).** Bare
unversioned paths in `index.html`, unversioned relative module imports in
`app.js`, and a 4-hour Cloudflare TTL. A device can run stale JS for hours
after a merge. Every deploy needs the hard-reload ritual by hand until #26 is
fixed, which is part of what **#40** exists to close.

**So never tell the maintainer a fix is visible before it is on the live
site and reloaded.** This has already cost them a round of testing across
three browsers on a device where every browser is WebKit anyway.

The app can tell you which build it is running: `js/features/build-info.js`
plus the Info & FAQ panel report the version, the recipe schema version, and
this device's record counts (identified / legacy / unreadable / **newer**).
The version is a **bundle constant on purpose** — a fetched `package.json`
would report the server's version while the browser ran stale JS, which is the
one case the panel exists for. `newer > 0` means another device is ahead of
this tab, so the verdict names the hard reload.

### Recipe identity is closed, and the whole library is uniform

Recipes carry `RecipeId` + author-time `SavedAt` inside the container behind
`SchemaVersion: 2` — **not** a separate store, which was reversed because one
Drive file is the only atomic unit available. Identity is validated OUTSIDE the
fail-closed gate, so a stripped record warns and re-mints rather than locking
the user out. Minting happens only at save, under one invariant: at most one
record per id.

**Designed, built, deployed AND rolled out — the maintainer confirmed
2026-08-17, on every device, with ZERO skips. Do not re-raise it** (#44).

The consequence that matters downstream: identity is uniform across the whole
library, which is the precondition the batch loop needs before it writes
anything keyed on `RecipeId`. Decision 14's `SYNC_WARNINGS.LEGACY_CONFLICT`
should now never fire — **if it does, it is unambiguously new information**, a
device that was missed or a record arriving from somewhere unexpected, not
residue from the backlog.

Known limit, recorded in `designs/p0.3-identity-design.md`: deletes do not
propagate across devices (#21).

### One correction that is load-bearing

**`(220 - 230)` was never the type's PAC range.** There is no per-type PAC
range anywhere in the codebase — `cTarget` carries Fat, MSNF, Solids, POD and
Stabilizer, and never PAC. The band was the upstream author's numbers for
gelato, inherited verbatim from `IceEd.html:1743` and compared to nothing.

Two things follow, and both reverse an earlier conclusion:

- **Cranberry v1.2's "347 PAC" was not a spec violation.** The Error row was
  right and the band was the wrong yardstick. Two documents still assert
  otherwise and need amending (**#48**).
- **#16 is undisturbed**, because its evidence is that v1.2 is
  formula-identical to v1.0 — found by diffing tables, not by reading the band.

**Beware estimates that survive as facts.** "#15 and #16, about an hour each,
either would have caught the regression" was quoted for days as though
measured. Both halves were wrong: #16 is 2–3 hours because the container is
rebuilt on every save so lineage must be carried forward explicitly through
module state, and #15 was measured against the fiction above, so only #16 would
have caught it.

### Tool traps

- **A success response does NOT mean the field was written.** `issue_write`
  returned 200 while silently discarding `type`, and again while discarding
  `state: closed` on create — four issues came back open. **Verify after
  writing, always.**
- **Not available at all:** Projects v2 (no tool — status moves, views and
  custom fields are the maintainer's), issue types (404, org-only), custom
  issue fields (need an org), issue dependencies (readable via
  `issue_dependencies_summary`, not writable), milestone *creation* (the
  maintainer creates, Claude assigns).
- `labels` **REPLACES** on update. Always send the full intended set.
- Sub-issue nesting was measured to **6 levels**, one parent per issue
  (`replace_parent: true` to reparent). **Rollup is one level, not recursive** —
  a parent reports only its direct children.
- `pkill -f "http.server"` **kills its own shell here**, because the bash
  command line contains the pattern. Use `pkill -f "[h]ttp\.server"`.
- Throwaway Playwright probes must live in the **repo root**, not the
  scratchpad, or module specifiers fail to resolve.

### Do these at the start of a session

- Tests need a virtual display and the async provisioning hook:
  `./.claude/hooks/wait-for-setup.sh && xvfb-run -a npm test`.
  The node lane is `npm run test:unit` and needs neither.
- **Re-arm `subscribe_pr_activity` on any open PR.** That subscription is the
  one piece of session state no hook can restore.
- **Artifacts are session state too.** An artifact lives outside the repo, so
  no hook mirrors it and compaction takes every trace of it with the turn that
  made it. This already happened once: the Plan Room was published, recorded
  nowhere, and a later session had to rediscover it with `Artifact list` —
  and could not recover the favicon it had itself chosen. **Publishing an
  artifact is not done until its URL is in this file.**

### Conventions that are easy to violate by accident

- Draft PR on the **first** commit of a branch, never at the end. The PR body
  carries a live checklist.
- Durable work becomes a GitHub issue; session-scoped steps stay in the PR
  checklist.
- Decisions get written down when made — into the issue, the PR, or
  `decisions.jsonl` — because the session they were made in will not survive.
  **An open decision is a task ("settle X"); a settled decision is that same
  issue, closed, with the rationale in it.**
- **Token discipline is in CLAUDE.md and it is load-bearing.** One review round
  per build step, then bank the rest. The full multi-agent fan-out runs at most
  ONCE per PR, at the merge boundary. **No polling automations.**
- **N=1.** This app has one user. A threat needing a second concurrent writer,
  a hostile file author, or a fleet is a documented limit, not code.
<!-- BRIEFING:END -->

## Where the work is

Branch `claude/batch-loop-design`, which is what **PR #25** (draft) tracks.
The old `claude/garry-tan-gstack-install-lp58z2` is merged; its remote ref
still exists because the git proxy refuses branch deletion, so remove it from
the GitHub UI when convenient.

**Shipped:** v0.5.0 (PR #4), then identity and sync (PR #11), build info
(PR #28), the in-app migration (PR #29), and the range check (PR #46). Node
lane at 207 tests.

Two workstreams, both tracked as issues:

**The batch loop** — epic **#41**. The maintainer already runs a working manual
version-control system: versioned recipe names, print as an immutable snapshot,
annotate the page during the churn, file by base recipe, copy-and-tweak for the
next version. **The design feeds that paper workflow rather than replacing
it** — paper wins at capture. Reasoning in `designs/p0.4-batch-schema.md` and
`designs/printed-sheet-design.md`; the normative schema is
`designs/p0.4-data-model.mmd`.

**Ingredient onboarding** — reasoning in
`designs/ingredient-onboarding-design.md`, which lists every finding against its
issue. `/ship` once overrode its coverage gate at 25% on the explicit
understanding that the node lane landed next; **that promise is outstanding**
(#7).

## Facts about the code worth not rediscovering

- `js/features/recipe-manager.js` is **1,820 lines** and `js/features/ingredients.js`
  is **862** — both over the 600-line bound v1.0 set. recipe-manager broke it
  *after* the modularization project closed, by absorbing the identity work, so
  splitting it is unscheduled work rather than unfinished work.
  `.planning/codebase/STRUCTURE.md` still omits recipe-manager entirely, even
  after a sync commit that claimed to fix it.
- **The cloud write race is fixed.** Save used to pass the live `Recipe` object
  to a fire-and-forget cloud write that stringified only after Drive's
  `findFileByName` round trip, so edits made in that window entered the cloud
  payload while IndexedDB held the earlier state. `buildRecipeContainer` now
  returns a detached, deeply frozen `structuredClone`, and both backends receive
  that same object. Pinned end to end by `tests/unit/recipe-roundtrip.test.js`.
- **Sync can still lie about having saved** (#12). Drive's `saveRecipe` returns
  `false` on error (`google-drive-storage.js:79`) and both callers discard it —
  `sync-manager.js:242` calls `notifyStatus('synced')`, `sync-manager.js:122`
  does `stats.pushed++`.
- `recipe-sync-join.js` is the pure decision core (id-first join, name fallback,
  `SavedAt` clock, fixpoint placement so plans are order-independent);
  `recipe-sync-executor.js` executes (listing failure aborts before any write;
  any write failure skips all deletes). Legacy conflicts REJECT — an id-less
  body never replaces an identified record.
- The in-app migration replaced a console script that could not run on an iPad,
  and writing it surfaced four defects the script had carried: it downgraded
  records from newer builds, restamped the `SavedAt` clock sync orders by, listed
  with the lossy `listRecipes`, and duplicated `mintRecipeId`.

## The Plan Room

A published artifact, **not a repo file**:
`https://claude.ai/code/artifact/a8207f87-a919-45a0-8cf7-1d32b985f39e`
Favicon 🍦 — keep it stable. **Update it in place by passing that URL**;
publishing without it creates a duplicate and orphans the maintainer's link.

**Its future is undecided and the maintainer has not chosen.** It was built
before the Project board existed and now overlaps it on status while still
holding the glossary, the decisions and the review ledger the board cannot.
Three options were on the table: keep it as reference-only with the status half
cut, retire it and move glossary/decisions into the repo, or leave it. Until
that is settled it is **on hold and untouched**.

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
why the briefing names it.

### Surviving compaction, specifically

Compaction destroys different things than a container does. This file stays
true and readable across it; what actually goes missing is which files were
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

**A second session can be live on the same branch.** One ran `/context-restore`
and committed mid-`/context-save` here, moving the repo five commits underneath
the session that was writing. Re-check `git log` before assuming the tree is
where you left it.

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
| 17 | Fire-and-forget sync (no await) | Don't block user workflow for storage operations — **see the cloud write race above** |
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
