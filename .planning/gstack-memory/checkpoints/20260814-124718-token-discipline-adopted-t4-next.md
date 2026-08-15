---
status: in-progress
branch: claude/batch-loop-design
timestamp: 2026-08-14T12:47:18Z
files_modified: []
---

## Working on: token discipline adopted, t4 next

### Summary

Process checkpoint, small delta over this morning's
`20260814-120437-t3-closed-decision-14-t4-next.md` — read THAT one for the
full T4 spec and project state; this one records the operating-rule changes
made since. Tree clean, pushed at `6511079`.

### Decisions Made

- **Token discipline is now a standing CLAUDE.md section** (`6511079`),
  driven by a measured spend analysis: the 3-day session cost 5M+ output
  tokens on ~190 user inputs, ~60% on review machinery, 335k on polling
  automations. Five rules: one review round per step (further findings are
  BANKED, not fixed); full multi-agent fan-out at most once per PR, at the
  merge boundary; N=1 triage gate at design time (decision 14 precedent);
  no polling automations; fresh session per work block; batch small
  operations.
- **The hourly PR #11 check-in is DEAD, permanently — do NOT re-arm it.**
  Both live triggers deleted (there were two parallel chains, which proved
  the point). Maintainer's explicit rule: they will do NOTHING to a PR
  without saying so in chat. PR signals = subscribe_pr_activity events +
  the maintainer. The session-start convention "re-arm the check-in" is
  REVOKED; re-arming subscribe_pr_activity stays.
- Also this session: PR #5 merged (squash `b6250c2`), main folded back
  into the branch, CLAUDE.md measured at ~7.4KB (~1.9k tokens, cached and
  cheap — the expensive standing cost is gstack skill preambles).

### Remaining Work

1. **T4** — sync-manager swaps to the join module. Full spec in the
   morning checkpoint + `.planning/p0.3-identity-design.md` (executor
   rules, pushRecipe gate, body download). Review per the NEW discipline:
   ONE full /review round (this is the merge-boundary trust step), codex
   outside voice included, further findings banked.
2. T5 (browser round-trip, item 22), T6 (paperwork + rollout note), then
   merge #11 and close it; fresh branch for P0.4+.
3. Binder read (maintainer) gates P0.4/P0.7. Banked: round-3 todo items
   1–8, durability items 18–21/23, issues #6–#10/#12/#13.

### Notes

- Start T4 in a FRESH session (rule 4) — /context-restore picks up the
  morning checkpoint plus this one.
- STATE.md briefing still says "hourly check-in" under session-start
  conventions — next session should NOT obey that line; fix the briefing
  when STATE.md is next touched (T4 landing) rather than churning a commit
  for it now (rule 5).
