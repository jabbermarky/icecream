# Ice Ed - Claude Context

## Project Overview
Ice Ed is an ice cream recipe formulation tool. It helps users create balanced ice cream recipes by calculating properties like PAC (freezing point depression), POD (sweetening power), fat content, and more.

## Key Documentation

### Modularization
- **MODULARIZATION_PLAN.md** - Detailed plan for extracting js/app.js into focused modules
- **WORKFLOW.md** - Step-by-step workflow for safe code extraction with testing

### Current Status
- Step 1 complete: Helper functions extracted to `js/utils/helpers.js`
- Next: Steps 2-3 focus on ingredients (JSON data file + module)

## Working in GitHub — plan visibly, not retroactively

**Open a draft PR on the first commit of a branch, not at the end of the work.**

The point is that the plan is readable *while it is being made*. A design doc
sitting on a branch is technically reachable but nobody navigates to a branch to
read a file. A draft PR renders it, diffs it as it changes, and gives a place to
comment on a specific line.

Rules:

1. **Draft PR immediately.** First commit on a branch → open it as a draft. Every
   push updates it. Mark ready for review only when the work is actually done.
2. **The PR body carries a live status checklist.** Update it on each push, so
   "where are we" is answerable from the PR card without reading anything.
3. **Subscribe to PR activity** (`subscribe_pr_activity`) when the PR opens.
   Inline comments then reach the working session while it is still open, which
   means course corrections arrive early instead of after the fact.
4. **Durable tasks become GitHub Issues. Session-scoped steps stay in the PR
   checklist.** An issue survives the PR that spawned it, can be referenced from
   a commit, and cannot be orphaned when a newer design doc becomes the focus —
   which is exactly how work gets lost here. Do not file an issue per session
   step; that is how issue trackers rot.

Planning documents live in `.planning/`. Deferred work lives in
`.planning/todos/pending/` **or** as an issue — issues for anything that must
survive a change of focus.

## Session state — capture on the way through, not on the way out

Sessions end in ways that run no shutdown code. The container gets reclaimed,
context runs out, someone types `/clear`. Anything written "at the end of the
session" is therefore written in exactly the case that never arrives. This is
the same mistake as opening the PR after the work: it is capture that is
technically complete and practically too late.

`.planning/STATE.md` is the file that carries state between sessions. Two rules
about it:

1. **Write to it when something changes, not when a session ends.** A decision
   made, a task unblocked, a bug found and not fixed — that is the moment. If
   the session died right now, STATE.md should still be true.
2. **The `BRIEFING` block is a context budget, not a summary.** It is injected
   verbatim into every new session, so it holds what a session needs before it
   can act. Detail goes below the markers.

The machinery, all in `.claude/hooks/`:

| Hook | Event | What it does |
|---|---|---|
| `mirror-memory.sh` | `Stop` | Copies `~/.gstack` into `.planning/gstack-memory/` and commits it, every turn. Pathspec-limited, so it can never sweep up work in progress. |
| `pre-compact.sh` | `PreCompact` | Compacts the decision log, writes `.claude/.recovery-digest`, then mirrors and pushes. |
| `mirror-memory.sh --push` | `SessionEnd` | Mirror and push on the way out. |
| `session-briefing.sh` | `SessionStart` (all matchers) | Reads the `BRIEFING` block, the recovery digest and the settled decisions into the new session's context. |
| `session-start.sh` | `SessionStart` (`startup\|resume`) | Restores the mirror, installs the toolchain. Async. |

**Compaction is a different problem from reclamation.** A container takes
everything; compaction takes only what was in the conversation — which files
were half-edited, which decisions were just taken. That is what
`.claude/.recovery-digest` holds, and it is deliberately not committed: it
describes work in flight, not project state. The briefing hook reads it back
because `SessionStart` fires with matcher `compact`.

**Never let an empty source overwrite the mirror.** `session-start.sh` restores
`~/.gstack` asynchronously and the `Stop` hook runs every turn, so a turn can
complete while that directory exists and is empty. `copy_if_sane` refuses any
copy that would take a mirrored file from content to nothing; shrinking stays
allowed, since decision compaction legitimately shrinks the active log. Any code
that reads `~/.gstack` should fall back to the committed mirror, and should fall
through on an **empty** source rather than only a missing one.

**Two hook facts worth not rediscovering.** `SessionStart` is one of only three
events whose stdout becomes model-visible context — but an `async: true` hook's
output is discarded, so a briefing hook must be synchronous and must therefore
do no network work. And `Stop` fires per turn while `SessionEnd` does not fire
on container reclamation, which is why the mirror runs on `Stop`.

**What no hook can restore:** the `subscribe_pr_activity` subscription. It is
the first line of the briefing for that reason. Re-arm it early in a session
with an open PR.

## Testing
Run tests before and after any code changes:
```bash
npm test
```

In a cloud container the suite needs a virtual display, because `test-app.js`
launches with `headless: false`:
```bash
xvfb-run -a npm test
```
The `SessionStart` hook provisions dependencies and the matching browser build.
Wait for it before running anything that needs them:
```bash
./.claude/hooks/wait-for-setup.sh && xvfb-run -a npm test
```

## Tech Stack
- Vanilla JavaScript (ES6 modules)
- HTML/CSS
- Playwright for testing
- USDA FoodData Central API for ingredient data

## gstack (recommended)

This project uses [gstack](https://github.com/garrytan/gstack) for AI-assisted workflows.
Install it for the best experience:

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

Skills like /qa, /ship, /review, /investigate, and /browse become available after install.
Use /browse for all web browsing. Use ~/.claude/skills/gstack/... for gstack file paths.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
