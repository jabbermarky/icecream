---
status: in-progress
branch: claude/batch-loop-design
timestamp: 2026-08-12T18:53:18Z
files_modified: []
---

## Working on: phase 0 blocked on identity design

### Summary

Phase 0 of the batch loop has run out of unblocked work. P0.1 (node unit lane),
P0.2 (versioned serializer/hydrator) and P0.5 (canonical save on an immutable
snapshot + library-load extraction) are landed and pushed at `37bb869`; the
unit lane is 65/65 and the browser suite 114/0. Everything remaining in the
phase depends on recipe identity, which is an unresolved design question, so
the workstream is now blocked on thinking rather than typing.

**The most important thing for the next session: P0.5 is UNREVIEWED.** The
review log's last entry is 17:44Z; the P0.5 commits are 18:28Z and 18:33Z.
This is the exact gap the maintainer caught after P0.1+P0.2 ("Did we miss a
review step?"), and it recurred immediately. Run `/review` on
`d6e709f..HEAD` before treating P0.5 as done.

### Decisions Made

- **P0.5: containers are detached, deeply frozen `structuredClone` snapshots
  built by one canonical path.** Closes the pre-existing cloud-write race where
  save handed the *live* Recipe to a fire-and-forget cloud write that
  stringified later, so edits after clicking Save could leak into the cloud
  payload while IndexedDB held the earlier state. Logged to `decisions.jsonl`.
- **The library-load handler moved to `js/features/recipe-library-load.js`**
  so its refusal gate is testable. This closed item 16 of the durability todo
  (the app.js coverage gap deferred during the P0.1+P0.2 review) — the deferral
  said "do it alongside P0.5", and that happened.
- **P0.2 hardening (from the six-pass review):** version guards fail CLOSED —
  absent SchemaVersion = legacy v1, numeric string "2" refuses as 2,
  present-but-garbage (true/NaN/"") refuses as damaged. One `containerProblem()`
  gate runs before any mutation, with distinct messages for newer-schema vs
  damaged records, because telling a user with a corrupted file to "update the
  app" is a lie.
- **Codex is not usable for reviews in this container.** Failure correlates
  with run duration, not prompt size: sub-30s runs always succeeded, 60s+
  file-reading reviews always hung with zero output and no rollout file. A
  passing smoke test does NOT predict a review will complete. Do not burn turns
  retrying. Recorded as `codex-long-runs-fail-short-ones-work`.
- **The hook codex re-review was waived** by the maintainer for the same
  reason. Every finding in the durability fix list was independently verified
  before its fix landed, so the waiver costs nothing already checked.

### Remaining Work

1. **Run `/review` on the P0.5 diff (`d6e709f..HEAD`).** Unreviewed code is on
   the branch right now. The last two reviews on this project each found real
   defects the tests missed — including one where a fix reintroduced the class
   of bug it was fixing.
2. **The binder read** (maintainer, no code): twenty batches, one evening. It
   produces the churn sheet's real schema, the outcome vocabulary, and answers
   what counts as a batch. Gates P0.4 and P0.7.
3. **The P0.3 identity-sync design question.** Identity must sync across
   devices; `sync-manager.js:122` carries only `recipe.data` and Drive stores
   `{name, data}` with no sidecar, so a second device allocates its own id.
   Keying the identity store by name also collides on delete and name reuse.
   P0.3 stays **DO NOT START** until this is answered. P0.4/P0.6/P0.7 all sit
   behind it.
4. **Ingredient onboarding is the available work meanwhile** — issues #6–#10.
   #7 shrank to "add ingredient cases" now that the node lane exists.
   `firstNutritionValue()` still has zero tests and was written wrong twice in
   one session, caught both times by review rather than by the suite.
5. Open, lower priority: XSS family (#13, pre-existing, four sinks, needs
   Playwright coverage of Notes formatting first); silent cloud-save failure
   (#12); durability todo item 17 (stub FileReader is synchronous, cannot model
   onerror).

### Notes

- **Two open design decisions carried in the PR body:** are photos portable or
  local-only (gates P3.3 only); is ingredient order meaningful in the diff
  (answerable from the binder). A third was added by the P0.2 review: when
  SchemaVersion 2 first ships, does the `.ier` envelope version bump with it?
  Pre-P0.2 builds have no schema check, so keeping the envelope at v1 means
  they silently truncate v2 records.
- **PR #11** is open, draft, mergeable_state clean, no comments/reviews, no CI
  configured on the repo (`check_runs: 0` — that is expected, not a failure).
  An hourly self check-in is armed; it re-arms silently when nothing changed
  and stops once the PR merges or closes.
- **Re-subscribe to PR #11** (`subscribe_pr_activity`) at session start. It is
  the only piece of state no hook can restore.
- The durability hooks are live and self-maintaining: per-turn mirror on `Stop`
  (working branches only), digest + decision compaction on `PreCompact`,
  briefing injection on every `SessionStart`. All 15 review findings against
  them are fixed or explicitly decided.
- Tests: `npm run test:unit` (65 cases, fast, no browser) and
  `./.claude/hooks/wait-for-setup.sh && xvfb-run -a npm test` (Playwright,
  114/0). Run both — the unit lane does not cover rendering.
- Pattern worth remembering: on this project, fixes have repeatedly introduced
  the next bug (alias-loop nesting inverted; an empty-source test blanked the
  mirror; a fallback loop broke on "present" instead of "yielded"). Verify a
  fix against the failure it fixes, in a sandbox, not against the live store.
