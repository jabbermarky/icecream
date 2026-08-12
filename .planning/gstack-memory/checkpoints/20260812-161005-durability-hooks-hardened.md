---
status: completed
branch: claude/batch-loop-design
timestamp: 2026-08-12T16:10:05Z
files_modified: []
---

## Working on: durability hooks hardened

### Summary

Built, adversarially reviewed, and fully hardened the session-durability system:
four hooks that let this project survive session clears, context compaction, and
container reclamation. The arc ran design → REJECT review (12 findings, 2
confirmed data-loss paths) → fix batch one → fix batch two → both maintainer
policy decisions → re-review waived. Working tree clean, everything pushed at
`b949d6b`. The hooks are LIVE: the per-turn mirror has been committing on its
own since mid-session.

### Decisions Made

- **Capture on the way through, not on the way out.** Reclamation runs no
  shutdown code, so exit-time capture writes in exactly the case that never
  arrives. Mirror runs on `Stop` every turn; recorded in CLAUDE.md.
- **Briefing must be synchronous.** SessionStart stdout becomes model context
  ONLY for sync hooks; `async: true` output is discarded. The old provisioning
  hook had never briefed anything.
- **`decisions.archive.jsonl` merges (union, exact-line dedupe) in BOTH
  directions** — append-only file + async restore means copy-if-absent loses
  history whichever side wins the race.
- **Digest is one-shot**: briefing consumes it (mv to `.read`) before emitting;
  decisions section gates on captured content, not file absence.
- **flock over mkdir-lock** — kernel releases on holder death (verified
  kill -9), so a killed hook can't wedge the system. Mirror skips after 5s;
  restore/compaction wait 30s.
- **Push kept, with disclosure** (maintainer decision): pushing the branch
  publishes all unpushed commits; the hook names non-memory commits it
  publishes. Dedicated ref rejected — write-only durability, nothing fetches it
  on a fresh container.
- **Mirror silent on the default branch** (maintainer decision): origin/HEAD
  detection with main/master name fallback (origin/HEAD is unset in CCR clones,
  so the fallback is the live path).
- **Codex re-review WAIVED** (maintainer decision): codex's websocket transport
  hung on 4 of 7 invocations. Every code finding was independently verified
  before its fix landed, so the waiver costs nothing already checked.
- **One shared decision extractor** (`extract-decisions.sh`), live-store-first —
  the mirror is copied from live every turn and can never be fresher.

### Remaining Work

1. **The binder read** (the assignment, maintainer's evening, no code): twenty
   batches → churn sheet schema, outcome vocabulary, answers open question 3.
   Nothing in the batch loop should be built ahead of it.
2. **P0.1** — node unit test lane + characterization tests. Cleared to start.
   Also the promise `/ship` extracted when it overrode its coverage gate at 25%.
3. **P0.3 is DO NOT START** — identity must sync; keying by name collides on
   delete/reuse. Blocked on design, not on code.
4. File the **silent cloud-save failure** as a GitHub issue
   (`google-drive-storage.js:79` returns false; `sync-manager.js:122,242`
   discard it). Found, documented in STATE.md, never filed.
5. Open design decisions: photos portable? ingredient order meaningful in the
   diff? (Second one answerable from the binder read.)
6. Delete stale remote branch `claude/garry-tan-gstack-install-lp58z2` via
   GitHub UI (git proxy refuses deletions).

### Notes

- **Codex reviews hang**: websocket transport through the container proxy
  stalls with no rollout file, no error, no recovery. Healthy runs take
  20-60s. Retry short (150s x 4), never one long wait. Learning key:
  `codex-websocket-flaky-retry-short`. Not client-side, not auth, not credits.
- The fix list with per-item verification notes:
  `.planning/todos/pending/2026-08-12-durability-hook-fixes.md` (all 15 items
  closed or decided).
- The briefing hook injects `.planning/STATE.md`'s BRIEFING block + settled
  decisions into every new session automatically — /context-restore of this
  file is supplementary, not the only recovery path.
- **Re-subscribe PR #11** (`subscribe_pr_activity`) in any new session — the
  one piece of state no hook can restore.
- Session history pattern worth remembering: fixes here twice introduced the
  bug the next review found. Verify fixes with the failure they fix, sandboxed
  (GSTACK_HOME override), never against the live store.
- PR #11 (draft) carries the live checklist; PR #5 open; issues #6-#10 hold the
  durable ingredient tasks; #7 (test lane) is the most urgent thing in the
  project.
- Suite: `./.claude/hooks/wait-for-setup.sh && xvfb-run -a npm test` — green at
  114/0 as of `b949d6b`.
