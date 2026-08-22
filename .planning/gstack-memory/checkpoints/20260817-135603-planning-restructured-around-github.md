---
status: in-progress
branch: claude/batch-loop-design
timestamp: 2026-08-17T13:56:03Z
files_modified: []
---

## Working on: .planning restructured around GitHub as the state store

### Summary

`.planning/` was reorganised so that no markdown file asserts status or
sequence — that job moved to GitHub issues, the epic (#41), milestones and the
Project board. Ten commits, all pushed, working tree clean at `7448981`. PR #25
absorbed the work and was retitled to match.

The session ended mid-argument, and the argument is the valuable part: the
maintainer challenged whether what I *kept* in STATE.md is state at all. It
isn't. **An open design question is on the table and unanswered** — see
Remaining Work item 1.

### Decisions Made

**`.planning/` is sorted by what a document IS, not what it is about.**
`designs/` (a chosen shape and why), `evidence/` (findings about the world),
`gsd-archive/` (superseded status documents). Nothing loose in the root any
more. The classification principle behind it: **append-only history and
evidence do not rot; mutable state does.**

**Retired IDs are cleaned out of live documents and deliberately kept in
records.** `phases/`, `milestones/`, `gsd-archive/`, and the two design docs now
headed as superseded records (`batch-loop-design.md`, `p0.3-identity-design.md`)
keep their `P`/`B`/`T` numbering. Rewriting a record to match present vocabulary
falsifies it rather than fixing it. The fix is the header saying it is a record.

**Every design doc opens with "a record of a decision, not a plan"** and names
the issue carrying the live work.

**Time estimates are deleted, not updated.** The ingredient design's checklist
carried human/CC estimates that were being read as measurements. Same failure as
"#16, ~an hour" — which appeared in THREE places (STATE.md, the schema doc, PR
#25's body) and was wrong in both halves.

**Retiring a checklist requires filing what it held first.** #57, #58, #59, #60
were filed before the ingredient checklist was deleted, and each was verified
against the code rather than trusted from the document. All four are real.

**The maintainer rejected all three options offered for where durable operating
facts should live** (CLAUDE.md / GSD.md / split-by-consequence), and answering
that question surfaced the finding below.

**STATE.md stays as a file, near-empty** (maintainer's choice). The
SessionStart hook reads its BRIEFING block, and a near-empty state file is an
honest signal that status lives in GitHub.

### Remaining Work

1. **UNANSWERED QUESTION — where durable operating facts live.** The maintainer
   picked "do something else" over all three options and did not say what. The
   strong candidate discovered right after: **gstack's own learnings store**
   (see Notes). Proposal on the table, not yet approved:
   - `learnings.jsonl` — tool traps, operational hazards. Log the 4 missing:
     the PAC-band correction, sub-issue depth = 6, `labels` REPLACES on update,
     second-session-can-move-the-branch.
   - `GSD.md` — architecture facts (no build step, identity closed, code facts).
   - `CLAUDE.md` — gains ONE line pointing at STATE.md, reversing the direction.
   - `STATE.md` — branch, open PR, in-flight, "search learnings first". ~10 lines.
   - **Sub-question also unanswered:** should the briefing *invoke* a learnings
     search at session start rather than recommend one? It would close the
     retrieval gap properly, but `session-briefing.sh` must stay synchronous and
     fast, and a search adds work to every session start.
2. **#56 remaining:** triage `.planning/todos/pending/` and clean retired IDs
   out of #6–#10's bodies (they still carry `T1 → T6 → T7` ordering).
3. **The todo triage is bigger than #56 says** — the issue claims 7 files,
   `GSD.md` says 18, there are actually **19**. Ten are from January and read
   like product wishes (LLM chat, mobile UI, toast notifications), nine from
   August. Needs a per-file judgment call WITH the maintainer, not for me alone.
4. **`GSD.md` has not had the same audit.** It is now the larger document, and
   it asserted `todos/pending` holds 18 files when it holds 19.
5. **PR #25 still draft**, waiting only on the maintainer reading it.
6. **#48** (amend the two docs asserting the 220–230 claim) and **#47**
   unstarted. **#61** (settle the Plan Room's fate) newly filed, undecided.

### Notes

- **THE FINDING OF THE SESSION: gstack already has a learnings store and I was
  hand-duplicating it into prose.**
  `~/.gstack/projects/jabbermarky-icecream/learnings.jsonl` — **47 entries**,
  append-only, structured (`type`/`key`/`insight`/`confidence`/`source`/`branch`/
  `commit`/`files`), already mirrored to `.planning/gstack-memory/` and committed
  by the Stop hook, searchable via `bin/gstack-learnings-search`.
  24 pitfall / 11 operational / 8 architecture / 4 pattern.
  **`pages-deploy-is-merge`, `pkill-self-match` and `issue_write-silent-discard`
  are ALREADY in it** — the exact three facts hand-copied into STATE.md's
  briefing. The stored `pages-deploy-is-merge` entry even carries the iPad/WebKit
  lesson at confidence 9/10, dated and attributed.
  **The gap is retrieval, not storage:** learnings are injected by gstack skills
  through the resolver, not at session start. That is the hole the briefing was
  patching by hand.
- **Two maintainer pushbacks, both correct, both conceded:**
  1. *"How is that state?"* — Applying GSD.md's own test ("stale within a week →
     STATE.md; still true next year → GSD.md"), NOT ONE of the facts kept in
     STATE.md goes stale within a week. Status was removed and the file refilled
     with durable facts that had nowhere else to live. Reasoned from the file's
     name instead of the test.
  2. *"I hope you referenced STATE from CLAUDE, not the other way around."* —
     Did it backwards. STATE.md points at CLAUDE.md three times; CLAUDE.md
     mentions STATE.md only to describe write rules, never as a content pointer.
- **Two guaranteed-read channels, treated as one.** CLAUDE.md is injected every
  prompt; the BRIEFING block every session start. Durable content was put in the
  briefing *because the briefing is injected*, which has nothing to do with
  whether the content is state.
- **PR #25 had a merge conflict with main** (`mergeable_state: dirty`), found
  only because the PR was read directly — no notification arrived. Trivial: both
  branches added the same `.context/` gitignore rule with different comments.
  Merged; brought in #15's tests, so the node lane is **224**, not 207.
- **No CI exists on this repo** — `get_status` returns `total_count: 0`. There
  are no workflows. Do not wait for green.
- **Subscribed to PR #25 activity.** Deliberately did NOT schedule a `send_later`
  check-in: CLAUDE.md forbids polling automations, which overrides the generic
  subscription advice.
- The earlier `sed`-based path rewrite over-applied and produced
  `designs/designs/designs/batch-loop-design.md` in three places. Fixed. Prefer
  python with explicit assertions over chained `sed -i` for path rewrites.
- Issues filed this session: **#57** (silent non-200 FDC failures), **#58**
  (lexicographic distance sort), **#59** (Foundation preference selects the
  record with no sugar data), **#60** (optimizer hot-path logging), **#61**
  (settle the Plan Room).
- STATE.md trajectory: **435 → 303 → 160 lines**; briefing **129 → 95**. Still
  too big by the argument above.
