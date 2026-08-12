# Session handoff — 2026-08-12

Written so this session can be cleared without losing anything. Everything below
is durable (in git or on GitHub) unless marked otherwise.

## Where things stand

**Branch:** `claude/batch-loop-design` (renamed from
`claude/garry-tan-gstack-install-lp58z2`, which is merged and whose remote ref
still exists — the git proxy refuses branch deletion, so remove it from the
GitHub UI when convenient).

**Shipped:** v0.5.0, merged in PR #4. The USDA ingredient import populates PAC,
POD and Sugar for the first time (measured 0/11 → 6/11 against the live FDC API,
Sugar 0/11 → 10/11). `idb` vendored so startup no longer depends on a CDN.
Google Auth degrades quietly offline. Suite green at 114 passed / 0 failed.

**Open on GitHub:**

| | |
|---|---|
| PR #5 | Durable ingredient tasks carried forward (draft, 1 file) |
| PR #11 | Batch loop design (draft, live checklist) |
| #6 | T1 extract shared derivation — P1, gates #7 |
| #7 | T6 node test lane — **P1, most urgent**, blocked by #6 |
| #8 | T7 regression guards — P1, blocked by #7 |
| #9 | T2b reconciliation — P1, **blocked on the apportionment decision** |
| #10 | T5 provenance sidecar — P2 |

## The two workstreams

### 1. Ingredient onboarding (v0.5.0 shipped, 9 tasks remain)

Design: `.planning/ingredient-onboarding-design.md`
Carryover: `.planning/todos/pending/2026-08-11-durable-ingredient-tasks-carryover.md`

T0 and T2a shipped. Of the nine remaining, four (T3, T4, T8, T9) are repairs to
code a rewrite would delete; the rest are durable and are issues #6-#10.

**The most urgent thing in this workstream is testing.** `firstNutritionValue()`
has zero tests and was written wrong twice in one session — first with
`Math.max` across aliases, then with the loop nesting inverted. Both were caught
by cross-model review, not by the suite. `/ship` overrode its coverage gate at
25% on the understanding that #7 lands next.

### 2. The batch loop (design reviewed, not started)

Design: `.planning/batch-loop-design.md` — read this first, it is the current
source of truth and carries its own review report.

Linking recipe versions to what happened when they were churned. The maintainer
already runs a working manual version-control system: versioned recipe names,
print as an immutable snapshot, annotate the page during the churn, file by base
recipe, copy-and-tweak for the next version. **The design feeds that paper
workflow rather than replacing it** — paper wins at capture.

**Status: P0.1 is cleared to start. P0.3 is explicitly marked DO NOT START.**

## What is decided, and what is not

**Decided** (each with reasoning in the design doc and in commit messages):
print-first over a full digital loop; advisory lineage rather than referential
integrity; mechanical diff stored as printed plus optional intent; a new
`js/features/recipe-versions.js` module; the batch loop builds the node test
lane itself; photos as separate Blobs; rename refused unconditionally on any
saved recipe; identity in a separate object store.

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

## The assignment that unblocks the most

**Read the binder. Twenty batches. One evening, no code.** For each: which
recipe and version, what changed from the previous version and whether the page
alone tells you, every process variable written down, the exact words used about
the result, whether the formula is reconstructable from that page, and — for
each observation — whether it could have been a checkbox or genuinely needed
prose.

That produces the churn sheet's real schema, the process variables no competitor
models, the outcome vocabulary, and the prose-versus-marks ratio that decides
how much of the return path is worth building. It also answers open question 3.

Separately, with a date on it: one post in r/icecreamery asking whether people
version recipes and what they record. Demand is currently **N=1** and stated as
such.

## Known bugs found but not fixed

- **Silent cloud-save failure, two instances.** Drive's `saveRecipe` returns
  `false` on error (`google-drive-storage.js:79`); the callers discard it and
  report success (`sync-manager.js:242` calls `notifyStatus('synced')`,
  `sync-manager.js:122` does `stats.pushed++`). Sync can lie about having saved.
  Pre-existing, unrelated to either workstream. **Not yet filed as an issue.**
- **Cloud write race.** Save passes the live `Recipe` object to a
  fire-and-forget cloud write that stringifies later (`recipe-manager.js:1197`,
  `:1221`), so edits made after clicking Save can enter the cloud payload while
  IndexedDB holds the earlier state. Folded into P0.5.
- `.planning/codebase/STRUCTURE.md` omitted `recipe-manager.js` (1,407 lines)
  even after a sync that claimed to fix it. Worth a proper `/document-release`.

## What does NOT survive clearing this session

- **The PR #11 activity subscription.** Re-establish with
  `subscribe_pr_activity` if you want inline PR comments to reach the session.
- **`~/.gstack/config.yaml` and `developer-profile.json`** — container-local,
  and gstack will re-prompt for telemetry and cross-project learnings.
- **`~/.codex/auth.json`** — the SessionStart hook re-creates it from
  `OPENAI_API_KEY` on every cold start.

Everything else — learnings, decisions, timeline, question log, **review logs**,
design docs, test plans — is mirrored into `.planning/gstack-memory/` and
restored by the SessionStart hook.

## Container facts worth not rediscovering

```bash
./.claude/hooks/wait-for-setup.sh && xvfb-run -a npm test
```

`test-app.js` launches with `headless: false`, so the suite needs a virtual
display. `wait-for-setup.sh` gates on the async provisioning hook. Both are
recorded in `CLAUDE.md`.
