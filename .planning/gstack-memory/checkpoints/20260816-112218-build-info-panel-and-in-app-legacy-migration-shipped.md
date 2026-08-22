---
status: in-progress
branch: claude/batch-loop-design
timestamp: 2026-08-16T11:22:18Z
files_modified: []
---

## Working on: build-info panel and in-app legacy migration shipped

### Summary

Two user-facing fixes shipped and deployed to production today, both split onto
their own branches off `main` rather than folded into the open P0.4 design PR.
The app can now report which build it is running, and the last P0.3 rollout step
— draining legacy recipe records — is a button in the app instead of a DevTools
console script the maintainer's primary device cannot run.

Working tree is clean. `claude/batch-loop-design` is 0 behind / 27 ahead of
`origin/main` and pushed. Nothing is in flight.

### Decisions Made

- **The app version is a bundle constant, not a fetched `package.json`.** The
  question the Info & FAQ panel answers is "what code am I actually running",
  which matters most when a stale cache means the answer is "not what the server
  has". A fetched `package.json` would report the SERVER's version while the
  browser ran older JS — confidently wrong in exactly the case you needed it.
  `tests/unit/build-info.test.js` pins `APP_VERSION` to `package.json` so the two
  cannot drift silently again (they had drifted two releases: hardcoded
  `"0.4.0 beta"` vs `0.5.0`).

- **`newer > 0` is the stale-cache detector.** A record written under a higher
  schema than this build can read means another device is ahead of this tab.
  With no cache-busting in the page (issue #26), that usually means this tab is
  running stale JS — so the verdict names the hard reload. This is the check
  rollout step 1 could not otherwise perform.

- **The legacy migration moves into the app; the console script is DELETED.**
  Root cause: no browser on iPadOS has a console, so the one rollout step
  required on EVERY device was impossible on the primary one. Being in the app
  also bought it a review lane it never had.

- **Rollout step 3 is now SYNC FIRST, then migrate.** The migration mints fresh
  ids, so a local legacy record whose synced copy is already identified would
  fork into a permanent `DIVERGENT_IDENTITIES` stall — a case that converges
  today (the identified copy wins and overwrites). Syncing first lets those
  copies arrive already identified, so the migration leaves them alone. This
  converts the dangerous ordering into the safe one rather than warning about it.

- **The post-migration reload is required, not cosmetic.** The open recipe's
  in-memory identity (`currentRecipeId`) is null for a legacy record; after
  migration the store has an id and the page does not, so the next save would
  mint a SECOND id. The module cannot safely self-correct (the recipe on screen
  may have unsaved edits, or be a new recipe sharing a name). Consequences
  handled: the migration REFUSES to start when the recipe is modified, and the
  summary is parked in `sessionStorage` before the reload so the report survives.

- **`mintRecipeId` moved to `recipe-serialization.js`.** It was module-local in
  `recipe-manager.js`, which forced the console script to carry a second copy —
  two implementations of the function that decides whether two records are the
  same recipe.

### Remaining Work

1. **Maintainer device actions — the P0.3 rollout is still open.** Hard reload
   each device (Settings → Safari → Clear History and Website Data on iOS, or a
   private tab; each browser app has its own cache), then ☁️ Sync, then Info &
   FAQ → "Give older recipes an identity". Once per device. Report what the
   panel's skip list says.
2. **PR #25 body is STALE** — it still says "P0.3 is merged but not deployed"
   and points at the deleted `scripts/migrate-legacy-recipes.js`. One refresh
   pass fixes both.
3. **PR #25 itself** — the P0.4 schema revision after the codex GATE FAIL.
   13 P1s, zero fixed. Not started.
4. **Not subscribed to PR #25 activity.** `subscribe_pr_activity` is the one
   piece of session state no hook restores, and it was not re-armed this session.
5. Then the three standing threads, unchanged: UI/UX replacement enablers
   (items 3, 8, 18) → batch loop (issues #15 and #16 AHEAD of B1–B6) →
   ingredient onboarding (#6 → #7 → #8, a hard chain).

### Notes

- **Deploy = merge.** GitHub Pages serves the repo directly with no build step
  or workflow, so merging to `main` IS the deploy. Both merges went live in
  ~40 seconds, verified by probing the live site rather than trusting the merge.
- **I told the maintainer the version fix would be visible before it was
  deployed.** They tested three iPad browsers unnecessarily. On iOS all three
  are WebKit, so they were never independent engines anyway. Probe the live site
  before claiming anything is visible.
- **The deleted script had four real defects**, all now fixed and pinned by
  tests: it rewrote `SchemaVersion` unconditionally (downgrading records from
  future builds), restamped `SavedAt` (the author clock sync orders by), listed
  with the lossy `listRecipes` (a partial listing would drain what it got and
  report success — half a migration is worse than none, because nobody runs it
  twice), and duplicated `mintRecipeId`.
- **Latent trap worth remembering:** the script's `./js/...` imports only
  resolved when pasted into a console. Loading it as a module — the obvious
  bookmarklet workaround for the iPad — would have failed on the import and
  printed the failure nowhere visible.
- **The review round found five more**, all applied in `0b64a0a`: the
  unsaved-edits guard, SYNC FIRST, splitting garbage-schema from newer-schema
  reporting (`Number.isFinite`, same distinction `build-info.js` and the save
  path draw), re-enabling the button after a failure, and counting nameless
  listing entries instead of dropping them.
- **Test lanes:** `npm run test:unit` at 207/0. Browser suite needs the hook and
  a virtual display: `./.claude/hooks/wait-for-setup.sh && xvfb-run -a npm test`.
- **`pkill -f "http.server"` kills its own shell** in this environment — the
  bash command line contains the pattern. Use `pkill -f "[h]ttp\.server"`.
- **Throwaway Playwright probes must live in the repo root**, not the
  scratchpad, or module specifiers do not resolve (`ERR_MODULE_NOT_FOUND`).
- The Plan Room artifact (`https://claude.ai/code/artifact/a8207f87-a919-45a0-8cf7-1d32b985f39e`,
  favicon 🍦) is now stale — STATE.md and the rollout contract both moved today.
  Update it in place by passing that URL; publishing without it orphans the link.
