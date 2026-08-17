# GSD — project record, milestones and document map

Ice Ed is planned with the **Get Shit Done** methodology. Everything GSD owns
lives in `.planning/`. This file is the index to it, and the home for the
project status that used to sit in `CLAUDE.md`.

**It was moved out of `CLAUDE.md` on purpose.** That file is injected into every
prompt, so status and document links belong here where they cost nothing until
someone actually needs them.

---

## Two status files, and the split between them

Do not duplicate one into the other. They answer different questions.

| File | Question it answers | Volatility |
|---|---|---|
| **`.planning/STATE.md`** | *What is true right now?* Live status, what to work on next, open PRs, decisions just taken. Its `BRIEFING` block is injected by the `SessionStart` hook. | Changes most sessions |
| **`GSD.md`** (this file) | *What is the shape of the project, and where is everything?* Milestones shipped, phase history, document map. | Changes when a milestone ships |

If a fact goes stale within a week, it belongs in STATE.md. If it is still true
next year, it belongs here.

---

## The `.planning/` layout

```
.planning/
├── PROJECT.md            # GSD project definition — "Ice Ed Modularization", created 2026-01-13
├── ROADMAP.md            # milestone index + per-phase progress
├── MILESTONES.md         # milestone log
├── ISSUES.md             # enhancements found during execution, deferred not dropped
├── STATE.md              # LIVE status (see above) — BRIEFING block is hook-injected
├── milestones/           # one roadmap per shipped milestone
├── phases/NN-name/       # NN-MM-PLAN.md paired with NN-MM-SUMMARY.md
├── codebase/             # codebase analysis, from /gsd:map-codebase
├── todos/pending|done/   # deferred work not worth an issue
├── golden-masters/       # oracle vectors for the Sprinkles port (stack decision D2)
├── prototype/            # Sprinkles balance-engine prototype
└── gstack-memory/        # mirror of ~/.gstack, written by the Stop hook
```

The phase convention is one directory per phase, and inside it a **PLAN** before
the work and a **SUMMARY** after. The summaries are where the real detail lives —
what actually changed, what broke, what the extraction exposed.

---

## Milestones

| Milestone | Phases | Shipped | Record |
|---|---|---|---|
| v1.0 Modularization | 7–9 | 2026-01-13 | `milestones/v1.0-ROADMAP.md` |
| v1.1 Recipe Organization | 10–11 | 2026-01-13 | `milestones/v1.1-ROADMAP.md` |
| v1.2 Recipe Library | 12–15 | 2026-01-14 | `milestones/v1.2-ROADMAP.md` |
| v1.3 Ingredient Persistence | 16–18 | 2026-01-15 | `milestones/v1.3-ROADMAP.md` |
| v1.4 Multi-Device Access | 19–20 | 2026-01-15 | `milestones/v1.4-ARCHIVE.md` |

Note the two numbering systems: these are **GSD milestones**, while the app's own
version in `package.json` is **0.5.0**. They are unrelated sequences.

Work since v1.4 — the batch loop and ingredient onboarding — is tracked as design
docs plus GitHub issues rather than as GSD phases. `ROADMAP.md` lists v1.0 in its
milestone index but its per-phase detail section starts at v1.1; Phases 7–9 were
collapsed into the milestone file when it shipped.

---

## The modularization project — CLOSED 2026-08-15

The single-file app (`IceEd.html`, 3,528 lines) was decomposed in nine steps.
**All nine landed.** `js/app.js` is 464 lines of wiring with zero top-level
functions, down from 2,694, and every planned module exists — 21 modules against
the 10 the plan forecast, plus a node unit lane the plan never anticipated.

**The project record is the GSD milestone, not the root plan documents:**

- `.planning/milestones/v1.0-ROADMAP.md` — *"SHIPPED 2026-01-13 · Phases: 7-9 ·
  Total Plans: 6"*, with per-phase goals and outcomes
- `.planning/phases/07-extract-tools/` — `07-01` PLAN + SUMMARY
- `.planning/phases/08-extract-models/` — `08-01` PLAN + SUMMARY
- `.planning/phases/09-extract-recipe-manager/` — `09-01`…`09-04`, four pairs;
  recipe-manager was the one extraction that needed splitting

Those summaries hold detail that exists nowhere else. Phase 7's, for example:
*"Reduced js/app.js by 302 lines (from 1668 to 1366) … Fixed pre-existing
undeclared variable bugs exposed by extraction."*

**Steps 1–6 predate GSD adoption.** Nothing in `.planning/` references phases
01–06; those six are documented only in `MODULARIZATION_PLAN.md`, which is the
one job that file still does. It reads as stalled at Step 6 because GSD
superseded it at Step 7 and it was never updated — a handoff, not an
abandonment.

### One success criterion is still unmet

*No file exceeds 600 lines.* `js/features/recipe-manager.js` is **1,837** and
`js/features/ingredients.js` is **862**. recipe-manager broke the bound **after**
the project closed, by absorbing P0.3's identity work — so splitting it is
unscheduled work, not unfinished work. `ingredients.js` has been over since Step
3 extracted it at 749 lines.

v1.0 also targeted `app.js` at **~150 lines** of orchestration against 464 today.
Not a v1.0 miss — phases 10–20 added storage, library and sync wiring after it
shipped.

---

## Document map

`.planning/` is split by what a document *is*, because that decides whether it
can go stale. **Designs and evidence explain; neither asserts current state.**
Status lives in GitHub — issues, the epic, milestones, the Project board.

**Designs** (`.planning/designs/`) — a chosen shape and the reasoning behind it.
A record of a decision, never a plan.

| Doc | What it is |
|---|---|
| `batch-loop-design.md` | The original batch-loop plan, in the retired P0–P3 phase vocabulary. Superseded as a plan by the epic (#41); kept for its reasoning. |
| `p0.3-identity-design.md` | Recipe identity. 14 decisions, and the Rollout section that was the deploy contract. Shipped and rolled out — see #44. |
| `p0.4-batch-schema.md` | The batch record and the diff definition, decisions 15–24 plus 30–36 from the revision. What #31 builds against. |
| `p0.4-data-model.mmd` | The ERD for the above. |
| `p0.4-decision16-amendment.md` | Superseded by decisions 25 and 26; kept for the argument. |
| `printed-sheet-design.md` | The paper form. Decision 28 makes it the primary capture surface, so it drives the schema rather than following it. |
| `p3.1-qr-mechanism.md` | QR encoding notes. Feeds #39. |
| `ingredient-onboarding-design.md` | The ingredient stream. |
| `sprinkles-stack-decisions.md` | Stack decisions for the Sprinkles port. |

**Evidence** (`.planning/evidence/`) — findings about the world. Cannot go stale,
because the world already happened.

| Doc | What it is |
|---|---|
| `binder-audit.md` | Audit of 29 real churn-log pages. The evidence base for every batch-schema decision. |
| `binder-audit-verification.md` | Which of its claims were checked against the code, and what that found — including one that did not survive (#48). |

**Codebase analysis** (`.planning/codebase/`) — `ARCHITECTURE`, `CONCERNS`,
`CONVENTIONS`, `INTEGRATIONS`, `STACK`, `STRUCTURE`, `TESTING`. Generated by
`/gsd:map-codebase`. `STACK.md` carries the warning that `IceEd.html` is a frozen
snapshot that predates fixes in `js/` and cannot import USDA data correctly.

**Root documents**

| Doc | Status |
|---|---|
| `MODULARIZATION_PLAN.md` | Closed. Authoritative only for Steps 1–6. |
| `WORKFLOW.md` | Closed as a task list, kept as a method — the test-first loop is still the house pattern. |
| `TESTING_SUMMARY.md` | Historical, from the modularization test build-out. |
| `TEST_README.md` | Live — documents the current suite, though framed around modularization steps. |
| `CHANGELOG.md` | Live. |
| `IceEd.html` | The original single-file app. Frozen reference, **not a deployment target**. |

**Deferred work** lives in `.planning/todos/pending/` (18 files) or as a GitHub
issue. Issues for anything that must survive a change of focus; todos for the
rest.

**The Plan Room** is a published artifact, not a repo file — a rendered status
page with the plan, blockers, review ledger and glossary. Its URL is in
`STATE.md`; update it in place rather than republishing.
