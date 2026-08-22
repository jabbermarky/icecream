# Binder audit — verification against the codebase (2026-08-14)

The audit (`.planning/evidence/binder-audit.md`) ends with an 11-item "Verify before
sharing" list. Most items need the photographs or the maintainer. Three can be
checked against this repository. This file records what that check found.

## Item 10 — the dextrose coefficient change: CONFIRMED, and the mechanism is
## narrower than the audit could tell from paper

The audit flagged this as "the claim here I'd most want you to confirm... because
the most is built on it," and listed three candidate causes it could not
distinguish: a revised coefficient, a dextrose anhydrous/monohydrate switch under
one label, or a units change.

**It is none of those three. The PAC coefficient never changed.**

`js/utils/tools.js` derives PAC from molecular weight against sucrose:

```js
export const Sugars = {            // g/mol     POD
    "Sucrose": [342.3, 100],
    "Dextrose": [180, 70],
    ...
};
pacSum += 342.3 / Sugars[sugar][0] * floatValue;   // tools.js:174
podSum += Sugars[sugar][1] * floatValue;           // tools.js:175
```

`342.3 / 180 = 1.9017` — dextrose PAC 190 on a 100 %-sugar basis, POD 70. Those
are the textbook values the audit deduced from the *newer* sheets, and they are
what the code says today. The coefficient is not what moved.

What moved is that **PAC and POD are now scaled by the ingredient's sugar
fraction** (`* floatValue`), where they previously were not. Check it against the
audit's own per-gram figures:

| Per gram of dextrose | Audit, Gen-1 sheet | Audit, Gen-3 sheet | Today's code |
|---|---|---|---|
| PAC | 1.903 | 1.663 | `1.9017 × sugar%` → **1.664** at 87.5 % |
| POD | 0.700 | 0.610 | `0.70 × sugar%` → **0.6125** at 87.5 % |
| Solids | 0.915 | 0.876 | — |

The Gen-1 column is the unscaled computation exactly (`1.9017 × 1.0`,
`0.70 × 1.0`). The Gen-3 column is today's computation exactly, at a sugar
fraction of ~87.5 %. Both of the audit's readings are arithmetically sound and
they bracket a single change in basis, not a change in constant.

**The ~12.5 % is therefore a sugar-fraction change, and the likely source is the
USDA import.** `js/features/ingredients.js:805` reads Dextrose's sugar from
`firstNutritionValue("Glucose", "Glucose (dextrose)")` — FDC data, which carries
a real moisture figure rather than a hand-entered 100 %. v0.5.0's headline was
exactly this: USDA import populating PAC, POD and Sugar for the first time.

**What still needs the maintainer:** the definitive check is one number — the
`Sugar` value on the Dextrose record in the live ingredient library (IndexedDB,
not in this repo). If it reads ~87.5, this is closed. The *consequence* the audit
draws is unaffected either way: cross-generation PAC/POD comparisons in the
binder are confounded, in the exact variable being tuned.

## The audit's fix for it is already built — for app-saved recipes

The audit's two build consequences were: "version the ingredient database and
stamp that version on the sheet," and "recompute every historical formula under
one current model."

The first is **already satisfied structurally, and better than versioning would
do it.** `buildRecipeContainer` (`recipe-serialization.js:167-174`) copies the
full ingredient definition — Water, Sugar, Fat, MSNF, Solids, PAC, POD,
Stabilizer, kcal — into `container.Ingredients` for every ingredient the recipe
uses, at save time. Every recipe saved since P0.2/P0.5 therefore carries the
coefficients it was actually computed with. That is a per-record snapshot rather
than a version stamp pointing at a mutable table, so it survives the table
changing again and needs no migration.

The gap is narrower than the audit assumed, and it is exactly two things:

1. **The printed sheet does not show it.** The data is in the record; the paper
   does not display it, so a printed page still cannot be trusted across
   generations. That is a print-format item, not a data-model one.
2. **The 29 binder pages predate the snapshot.** Their printed totals are the
   only record, and for Gen-1/Gen-2 pages those totals are on a different basis.
   The audit's "recompute under one current model" therefore applies to the
   binder import specifically, not to the app's own history.

## Item 9 — the Peppermint concentration table: CONFIRMED

The audit's arithmetic, recomputed:

- Extract: `2.0 / 504 = 0.3968 %` → `3.1 / 947 = 0.3273 %` = **−17.5 %**
  (audit: 0.397 → 0.327, −18 %)
- Sucrose: `23 / 504 = 4.563 %` → `40 / 947 = 4.224 %` = **−7.4 %**
  (audit: 4.56 → 4.22, −7 %)

Both corrections were applied in the direction v1's note asked for, and both are
invisible in grams. The design consequence — deltas must be expressed in
concentration or PAC/POD contribution, never grams — follows.

## The stale-observations failure is structural, not a slip

The audit calls Mexican Chocolate v3 "the single most dangerous page in the
binder": an `Observations:` field populated with v1's observations, on a page
that reads as evaluated and is not.

This is not a transcription artifact or a one-off user error. `Notes` is a
declared field on `cRecipe` (`core.js:99`), so it is copied by `copyFrom`,
carried through `buildRecipeContainer`, and hydrated back on load like any other
field. **A new version of a recipe inherits the previous version's notes by
construction, and nothing marks them as belonging to an earlier batch.** Any
recipe saved as a new version reproduces the failure. It is a live defect in the
shipped app, not a gap in a feature that was never built.
