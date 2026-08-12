---
created: 2026-08-11T23:40
title: Durable ingredient-onboarding tasks (carried over from v0.5.0)
area: ingredients
priority: P1
source: .planning/ingredient-onboarding-design.md
files:
  - js/features/ingredients.js
  - js/utils/tools.js
  - test-app.js
---

## Why this file exists

v0.5.0 shipped T0 and T2a. Nine tasks remain in the design doc, and attention is
moving to the batch-loop work. This file carries the subset that stays valuable
**regardless of what happens to the current codebase**, so they do not get
orphaned when a newer design doc becomes the focus.

The CEO review sorted the nine by whether they survive the Sprinkles rewrite.
Four are repairs to code a rewrite deletes (T3 ranking, T4 error handling,
T8 logging, T9 Foundation preference) — those stay in the design doc and are
not carried here. The rest are listed below.

## P1 — Testing (the most urgent item in this file)

**T6 — node unit lane with table-driven cases.** The project has no unit test
lane at all; `test-app.js` is a Playwright browser harness. `testUSDAStructure`
asserts only that functions *exist*.

**T7 — two regression guards.** Complete-profile derivation unchanged;
`data/ingredients.json` loads unchanged.

**Why this is P1 and not P2.** `firstNutritionValue()` has zero tests and was
written wrong **twice** in one session:

1. First with `Math.max` across alias names, which discards FDC record priority.
2. Then with the loop nesting inverted, which reintroduced the same cross-record
   mixing from the other direction.

Both were caught by cross-model review, not by tests. Its failure mode is silent
and it corrupts a curated library: an ingredient's nutrition assembled from two
different USDA records, producing plausible but wrong PAC and POD. Nothing in
the suite would notice. The specific case a test must cover: a food present in
both Foundation and SR Legacy, where Foundation carries the alias name and
SR Legacy carries the primary name. Records must win over aliases.

`/ship` recorded 25% coverage on the v0.5.0 diff and the gate was overridden
specifically on the understanding that this lands next.

## P1 — T1: extract the shared sugar→PAC/POD derivation

Files: `js/utils/tools.js`, `js/features/ingredients.js`

The same formula exists twice, at 100x different unit scales, in the importer
and in the PAC/POD calculator tool. Changing one silently desynchronizes the
other — and the calculator is the user's own cross-check.

**T1 also gates T6.** `firstNutritionValue` is currently a closure inside
`onDownloadIngredientData` and is not exported, so it cannot be unit tested
until the extraction happens. Do T1 first, then T6, then T7.

Durable beyond this codebase: pure domain math, portable to any rewrite.

## P1 — T2b: reconcile the sugar breakdown against `Total Sugars`

Files: `js/utils/tools.js`

Takes measured PAC/POD coverage from 6/11 to 8/11, plus 2 estimated.

**Blocked** on one decision: when a record reports a sugar total but no
individual breakdown (measured: 2 of 11 — cocoa powder, vanilla extract), what
does the unattributed remainder get assigned to? Sucrose is the obvious default
and is wrong for some foods. The alternative is to decline and prompt for manual
entry.

Durable beyond this codebase: domain logic, and genuinely novel work — no
competitor examined does this.

## P2 — T5: additive provenance sidecar

Files: `js/features/ingredients.js`, `data/ingredients.json`

Record source (`usda:foundation`, `usda:sr-legacy`, `derived`, `estimated`,
`manual`), FDC ID, and date per field. Unannotated entries read as `manual`.

Durable, and **more relevant now than when it was written**: provenance is the
same idea the batch loop needs. Both are about recording where a number came
from and how much to trust it. If the batch-loop design introduces its own
confidence or source concept, these two should share one vocabulary rather than
inventing two.

## Also worth carrying: two findings from the competitive spike

Not tasks yet, but they bear on this work:

- **Ingredient categories.** Ice Cream Calc has ~390 ingredients categorized by
  type (nuts, fats & oils, dairy, sweeteners). Those categories almost certainly
  feed balancing and validation. `data/ingredients.json` has 71 ingredients and
  **no category field**. Adding one is additive and backward-compatible.
- **Curation may beat import.** A competitor solved ingredient coverage by
  hand-curating ~390 entries. Nine tasks of importer work reaches 73% measured
  coverage with 18% estimated. Growing the curated library directly may deliver
  more usable coverage per hour than perfecting the importer. This does not make
  T1/T2b/T6/T7 less valuable — the derivation and its tests matter either way —
  but it does argue against T3, T4 and T9.
