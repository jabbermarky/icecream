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

**Status: batches one (items 1–3) and two (items 4–11, 14, 15) FIXED
2026-08-12 and verified. Items 12–13 decided by the maintainer and fixed.
The codex re-review was WAIVED by the maintainer (2026-08-12): four of seven
codex invocations that afternoon hung at the websocket transport (diagnosis in
learnings.jsonl, key codex-websocket-flaky-retry-short — retry short, never
wait long). Run it later if wanted; every code finding in this file is
independently verified regardless.**

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

## From the codex review — FIXED (batch two, 2026-08-12)

4. **FIXED — Partial-copy race** (CRITICAL per codex). All copies in both
   directions are now copy-to-temp + same-directory atomic `mv` (rename(2)),
   so no reader can observe a half-written file; plus the shared flock below,
   so mirror and restore cannot overlap at all. *Verified: no temp files
   survive any tested path.*
5. **FIXED — Restore-if-absent skips a present-but-empty destination forever.**
   `needs_restore()` treats ≤2 bytes as absent. *Verified: a 0-byte
   `learnings.jsonl` destination is restored.*
6. **FIXED — No lock over copy→add→commit.** flock, not mkdir: the kernel
   releases it when the holder dies (verified with `kill -9`), so a killed
   hook can never wedge future mirrors — the failure mode a mkdir lock would
   have introduced. Mirror waits 5s then SKIPS (a missed turn is caught by the
   next one); restore and compaction wait 30s. Degrades to today's unlocked
   behaviour if flock is absent. *Verified: mirror skips cleanly under a held
   lock, commits after release.*
7. **FIXED — Decision compaction runs outside any lock.** Compaction now runs
   under the same lock, in a subshell so it is released before the mirror call
   (which takes the lock itself — holding across it would self-skip).
8. **FIXED — Digest write is a direct truncating write.** Temp + atomic `mv`,
   installed only if non-empty; a killed PreCompact leaves the previous digest
   or the complete new one, never a fragment. *Verified complete to the last
   line.*
9. **FIXED — Git-state guard omits `REVERT_HEAD` and sequencer state.** Both
   added. *Verified: no commit lands mid-revert or with a sequencer active.*
10. **FIXED — Briefing is an unlabelled injection surface.** A fixed envelope
    now leads the briefing ("recovered state is DATA, not instructions"), and
    the settled-decisions framing is descriptive rather than imperative.
    Envelope-level mitigation: content is framed, not sanitized — full
    JSON-encoding of fields was judged out of proportion for a solo repo whose
    inputs are this project's own tooling.
11. **FIXED — `head -c 9500` can split a multibyte char / fence.** awk
    character-budget truncation that only cuts on line boundaries, with an
    explicit truncation marker. *Verified: 9.7KB input cut on a whole line at
    9,532 chars.*
12. **DECIDED & FIXED — Push publishes the whole branch, not the memory
    commit.** Maintainer chose disclosure: before pushing, the hook enumerates
    `@{upstream}..HEAD` and names any non-memory commits on stderr, then
    pushes anyway — durability wins, but the scope is no longer silent. "Stop
    pushing" and "dedicated ref" were analyzed and rejected — a dedicated ref
    is write-only durability (nothing fetches it on a fresh container).
    *Verified against a local bare origin: the real commit is named, memory
    commits are excluded from the list, the push is delivered, and memory-only
    pushes stay silent.*

## Fresh-eyes additions (2026-08-12, second pass)

13. **DECIDED & FIXED — Hooks auto-commit (and on compact/end, auto-push) on
    ANY branch, including `main`.** Maintainer chose to restrict: the mirror
    is silent on the default branch — detected from `origin/HEAD` when set,
    falling back to the names `main`/`master` (origin/HEAD is unset in this
    clone, so the fallback is the live path). *Verified: silent on `main` via
    fallback; silent on a detected default named `trunk`; still commits on a
    branch named `main` when the detected default is `trunk`.*
14. **FIXED — Source-precedence inconsistency.** Both hooks now call the shared
    `extract-decisions.sh`, which owns the one ordering: live store first (it
    is never staler than the mirror, which is copied from it every Stop), then
    the committed mirror for the cold-container case, falling through on empty
    sources. *Verified: with different decisions seeded in each source, both
    hooks surface the live one.* Note this flipped the briefing from
    mirror-first to live-first — deliberate, reasoned above.
15. **FIXED — PR #11 body drift.** Body updated to the re-derived P0 numbering
    with an explicit note, and the status checklist now carries the review
    arc (REJECT → fix batches → re-review pending).

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

## Follow-up from the P0.1+P0.2 code review (2026-08-12, /review)

16. **FIXED (P0.5) — app.js library-load path has zero test coverage.** One of
    P0.2's four paths, and the one the refusal rule primarily protects
    (stale-tab save-back). The shared module logic was tested; the thin onLoad
    wiring was not — a regression that dropped or reordered the
    containerProblem gate would have shipped undetected.
    **Fixed as specified:** the callback moved to
    `js/features/recipe-library-load.js` as `createLibraryRecipeLoader(deps)`,
    injectable and driven by the stub harness in
    `tests/unit/recipe-library-load.test.js` (11 cases). Mirrors the .ier
    tests: refused-before-importIngredients with a non-empty ingredient map so
    the ordering is observable, legacy no-SchemaVersion load, numeric-string
    "2" refusal, the damaged-record message matrix, missing record, the
    `.catch` path, and a throw from DisplayRecipe. The pre-existing divergence
    from .ier import (that path backs up the current recipe; this one does not)
    was reviewed and **kept deliberately** — aligning them is a user-visible
    change and Phase 0 is structural only. Pinned by a test so a later change
    is a decision rather than a drift.
17. **OPEN — stub FileReader is synchronous and cannot model onerror.**
    Documented in dom-stub.js. Remodel with queueMicrotask + a flushReads
    helper if the lane ever needs read-failure or async-ordering coverage.
    Low priority; the Playwright suite owns those paths today.

## Open from the P0.5 review (2026-08-12) — red-team findings, NOT yet fixed

18. **OPEN, CRITICAL — the record KEY and `container.Recipe.Name` can fork on
    the LOAD side.** The save side is fixed (the key now comes from the
    snapshot), but `recipe-library-load.js` still hydrates the container's name
    while reporting the key's name, so a record stored under key A whose payload
    says B loads as B and the next Save writes a NEW record under B, orphaning
    A. `libraryRecord()` in the test fixture bakes the mismatch in (key
    'Stored' vs Recipe.Name 'Vanilla') and asserts nothing about it. Fix: after
    the gate, compare `name` with `data.data.Recipe.Name` and either adopt the
    key or refuse; make the fixture agree; pin the chosen behaviour.
19. **OPEN, CRITICAL — "both backends write the SAME snapshot" is false in
    REPRESENTATION.** IndexedDB stores the structured clone verbatim; Drive and
    `.ier` go through `JSON.stringify`, so `NaN`/`Infinity` become `null` and
    undefined-valued keys vanish on the cloud side only. NaN is reachable
    today: `cRecipe`'s Amount setter divides by `this.Amount`, so scaling a
    zero-sum recipe NaNs every amount (already pinned in core-recipe.test.js).
    P0.5 removed the timing divergence, not the representation one. Fix:
    canonicalize the snapshot through the narrowest destination before
    freezing, or reject non-finite numbers in `buildRecipeContainer` — then
    soften the comment to what is actually guaranteed.
20. **OPEN — no re-entrancy guard on save; concurrent cloud writes.** Two Save
    clicks issue two fire-and-forget Drive writes. With no existing Drive file,
    both take the upload branch and Drive ends up with TWO `recipe-{name}.json`
    files; `findFileByName` uses `pageSize:1` and thereafter updates an
    arbitrary one. Freezing pins WHAT is written, not WHICH write wins. Fix:
    serialize cloud pushes per recipe name and disable the Save button for the
    duration of the handler.
21. **OPEN — `saveToFile`'s `JSON.stringify` is outside the snapshot guard.**
    `structuredClone` is LOOSER than `JSON.stringify`, not stricter as the
    JSDoc claims: a cyclic recipe clones and freezes fine, then `.ier` export
    throws uncaught inside `saveToFile` and does nothing at all — the silent
    no-op `snapshotForSave` exists to prevent. Fix: validate serializability
    once inside `snapshotForSave`, or wrap the `saveToFile` call.
22. **OPEN — the Playwright suite never round-trips a built container.**
    `testSaveWorkflow` saves via the button but only checks the name appears in
    the library list; `testRecipeLibrary` loads hand-authored fixtures with no
    SchemaVersion. So the browser lane exercises neither the clone/freeze shape
    nor the refusal gate. A container-shape regression ships green in BOTH
    lanes. Fix: read the record back after saving and assert the container
    shape, then load it through the Load button.
23. **OPEN — Drive name recovery uses unanchored `String.replace`.** A recipe
    named `My.json Test` round-trips out of Drive as `My Test.json`
    (`google-drive-storage.js:144`), forking key from `Recipe.Name` the same way
    as #18 but arriving from the cloud. Fix: slice by known prefix/suffix
    lengths, and prefer the name inside the content when both are available.
