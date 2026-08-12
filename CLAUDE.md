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
