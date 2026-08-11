# Ingredient Onboarding — Closing the Cold-Start Gap

*Design doc — 2026-08-11*

## The problem

Two workflow gaps were named:

1. **Improve on the previous batch of a recipe.** This one has a working
   workaround: batch notes have been kept by hand for over a year. It costs
   convenience, not days.
2. **Start a new recipe from scratch.** Identify the ingredients, research the
   flavor profile against other online recipes, determine nutritional values for
   ingredients not already in the library, balance, churn. Historically this took
   **days** to reach first churn.

Gap 2 is the expensive one, and it is the only one with a number attached.

Decomposed, gap 2 is four steps:

| Step | Status in Ice Ed |
| --- | --- |
| Research flavor profile / ratios | Not addressed — happens in browser tabs |
| Get nutritional values for unknown ingredients | **Partly addressed — see below** |
| Balance to targets | Solved. This is the app's core competence |
| Churn | Out of scope for software |

Ice Ed today solves the last twenty minutes of a multi-day process and none of
the days in front of it.

## What already exists

`onDownloadIngredientData` (`js/features/ingredients.js:635`) is substantially
more complete than a stub. Given an ingredient row with a name, it:

- POSTs to USDA FoodData Central across `Foundation`, `Survey (FNDDS)` and
  `SR Legacy` data types (`:646-652`)
- Retries with progressively truncated queries on zero hits (`:660-667`)
- Fuzzy-matches results by Damerau-Levenshtein distance and presents a
  pick-list (`:669-707`)
- Prefers Foundation over SR Legacy over Survey when the same description
  appears in several data types (`:714-735`)
- Derives `Water`, `Fat`, `Sugar`, `kcal` directly (`:761-764`)
- Derives `PAC` and `POD` from the individual sugar breakdown — sucrose,
  dextrose, fructose, lactose, maltose, galactose, ethanol — against the
  `Sugars` reference table (`:766-789`)
- Derives `Solids` as `1 - (water + ethanol)`, and `MSNF` as `Solids - Fat`
  when lactose is present (`:790-797`)
- Reports which fields it could not populate (`:799-807`)
- Routes the result through `importIngredients` for diff-and-confirm rather
  than overwriting silently (`:807`)

**This design is therefore not "build ingredient onboarding." It is "close the
gaps in the ingredient onboarding that already exists."** That is a smaller and
better-targeted piece of work, and it is why this is the right first move rather
than the full web importer.

## What is actually missing

### G1 — PAC and POD are gated all-or-nothing, and the gate usually fails

`getNutritionValue` returns `-1.0` when a nutrient is absent from the record
(`:743`). The validity check is:

```js
valid &= sugars[key] >= 0.0;
```

across all seven sugar keys (`:779-783`). Ethanol is clamped non-negative
(`:766`), but the other six are not. If FDC omits *any single one* of sucrose,
dextrose, fructose, lactose, maltose or galactose — and maltose and galactose
are frequently absent even from Foundation records — then `valid` is false and
neither `PAC` nor `POD` is written (`:784-789`).

The consequence: the import populates the easy, mechanical fields and silently
declines to populate the two domain-critical ones, handing back "Please check
values manually for: PAC, POD." The user then computes them by hand in the
PAC/POD calculator tool. **This is the single most likely place the research
hours actually go, and it is a five-line problem, not an architecture problem.**

Fix: separate *absent* from *zero*, and degrade instead of refusing.

- Treat an absent sub-sugar as absent, not as a poison value.
- When the breakdown is partial but total `Sugar` is known, apportion the
  unattributed remainder using a declared assumption (default: sucrose, which
  is the common case for most non-dairy foods) and mark the result **estimated**
  rather than **measured**.
- When the breakdown is complete, mark the result **measured** — the current
  behaviour, which is correct and should be preserved exactly.
- Never write a PAC/POD silently; always show which of the two paths produced it
  and what was assumed.

The distinction that matters: today the choice is between a correct number and
nothing. It should be between a correct number, a labelled estimate, and
nothing — with the user able to see which they got and override it.

### G2 — No provenance on any ingredient value

`IngredientDataFields` (`:17`) is nine numeric fields. `data/ingredients.json`
stores flat numbers. Nothing records whether a value came from a USDA Foundation
record, an SR Legacy record, a derived estimate, or was typed in by hand three
years ago.

This matters for three reasons:

- You cannot audit a suspicious formulation back to its inputs.
- You cannot re-import an ingredient later to upgrade it from estimated to
  measured, because you do not know which ones are estimated.
- Any future AI-sourced value is indistinguishable from a curated one, which is
  precisely the condition under which an AI-populated library becomes
  untrustworthy.

Fix: add an optional sidecar per ingredient recording, per field, the source
(`usda:foundation`, `usda:sr-legacy`, `derived`, `estimated`, `manual`,
later `llm`), the FDC ID where applicable, and the date. Optional and additive,
so existing `ingredients.json` entries stay valid and unannotated ones simply
read as `manual`.

### G3 — No path for ingredients FDC does not have

Pistachio paste, specific glucose syrups by DE, commercial stabilizer blends,
inverted sugar, regional or artisanal products: these are either absent from FDC
or present at the wrong specificity. Today, the search returns nothing useful and
the user leaves the app.

Fix (deliberately deferred — see Scope): an LLM fallback that proposes values
*with* the same provenance and confidence machinery from G1 and G2, so an
AI-sourced ingredient is visibly AI-sourced and reviewable field by field. The
value of doing G1 and G2 first is that this fallback then has somewhere honest to
put its output.

### B1 — Fuzzy-match threshold is miscalibrated (bug)

Line 673:

```js
distances.sort();
```

`Array.prototype.sort` without a comparator sorts lexicographically. For numeric
edit distances this orders `[9, 10, 100]` as `[10, 100, 9]`. The threshold
selected on the next line — `distances[Math.min(12, distances.length - 1)]` —
is therefore not the 13th-smallest distance, and the filter on `:675-678` keeps
and discards the wrong candidates.

Fix: `distances.sort((a, b) => a - b)`. One line, independently testable,
worth doing regardless of everything else here.

### B2 — USDA API key is committed to the repository

`js/features/ingredients.js:650` contains a hardcoded FDC API key in a
client-side request. Two separate issues: it is in version control, and because
the call is made from the browser the key is exposed to anyone using the app
regardless. Low severity — FDC keys are free and rate-limited, not billable —
but it should be rotated and moved to configuration rather than left inline.
Noted here for completeness; not part of this design's scope.

## Scope

**In scope:**

- G1 — graded PAC/POD derivation with measured/estimated distinction
- G2 — per-field provenance, additive and backward-compatible
- B1 — the comparator fix

**Out of scope, deliberately:**

- G3 (LLM fallback) — depends on G1/G2 landing first, and pulls in the API
  proxy question that this work otherwise avoids entirely
- The full web recipe importer (`.planning/todos/pending/2026-01-15-ai-recipe-importer-from-web.md`)
- Flavor-profile research
- Any part of the Sprinkles rewrite. This lands in the current vanilla app.

**Non-goal:** making the import fully automatic. The review step is the feature,
not friction. A wrong fat percentage that enters the library unchallenged
silently ruins batches for months.

## Relationship to the Sprinkles decisions doc

Two observations, both of which survive whatever happens to the rewrite.

**The AI command vocabulary cannot express ingredient creation.** D9
(`.planning/sprinkles-stack-decisions.md:104-109`) defines the typed command set
as `setIngredientAmount(id, grams)`, `addIngredient(id, grams)`,
`removeIngredient(id)`, `setTargetPAC`, `setTargetFat`, `optimizeRecipe`. Every
one takes an ingredient ID that already exists. There is no `createIngredient`.
The vocabulary fits recipe *editing*, which is what D12 was designed around — and
it fits the two chat todos D12 explicitly absorbs (`:232`). It does not fit
"this ingredient does not exist yet, go find out what is in it," which is the
operation that costs days.

**The importer todo is not carried into the decisions doc.** Of the three
January AI todos, D12 names `llm-chat-recipe-research.md` and
`-troubleshooting.md`. `ai-recipe-importer-from-web.md` — the one describing
unit conversion, library matching, USDA research for unknown ingredients, and
per-field confidence — is neither adopted nor listed under Rejected
Alternatives. It appears to have fallen out because it did not fit the
editing-centric frame, not because it was judged low-value.

Doing G1 and G2 now forces `createIngredient` to exist as a real domain concept
with provenance and confidence semantics *before* `recipe-domain` (D13) is
extracted. If the rewrite proceeds, that concept is already specified and
validated against real use. If it does not, the work still stands on its own.

## Risks

- **Estimated PAC/POD could be worse than no PAC/POD.** A labelled estimate that
  gets ignored is more dangerous than a blank that forces attention. Mitigation:
  estimated values must be visually distinct at the point of *use* in a
  formulation, not only at the point of import.
- **The sucrose-remainder assumption is wrong for some foods.** It is a
  reasonable default for fruit and most non-dairy ingredients, and wrong for
  anything dominated by lactose or maltose. Mitigation: the assumption is
  declared in the UI and the apportionment is editable before commit.
- **Provenance is only as good as its adoption.** If it is optional and nothing
  displays it, it becomes dead weight. Mitigation: G2 is not "done" until
  provenance is visible in the ingredient editor.

## Open questions

1. When the sugar breakdown is partial, is sucrose the right default for the
   unattributed remainder, or should the app refuse to guess for ingredients
   above some sugar threshold?
2. Should re-importing an existing ingredient be able to *upgrade* estimated
   values to measured automatically, or always require review?
3. Roughly what fraction of the ingredients you have added in the last year were
   found in FDC at all? That number decides how urgent G3 really is.
