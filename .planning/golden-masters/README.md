# Golden-master vectors for the Sprinkles `recipe-domain` port

Per stack decision **D2** (`.planning/sprinkles-stack-decisions.md`): the TS
calculation engine is correct when it reproduces recorded oracle outputs, not
when it looks right. Two oracle sets are planned; this directory holds the
first.

## What's here

- `generate-legacy-vectors.mjs` — generator that runs the **actual legacy
  production code** (`js/features/calculations.js`, `js/models/core.js`)
  headlessly under Node and records inputs → outputs.
  Run from repo root: `node .planning/golden-masters/generate-legacy-vectors.mjs`
- `legacy-vectors.json` — the recorded vectors. Self-contained: each recipe
  vector embeds the exact ingredient rows it was computed against, so the TS
  test suite replays without this repo's ingredient DB.

## Two oracles, two jobs

| Oracle | Status | Validates |
|---|---|---|
| **Legacy JS** (this set) | ✅ generated | The formulas that carry over: SE↔FPD polynomial, `CalcFDP`, recipe `Sums` aggregation, `GetIdealPAC`, `Fitness` scoring, the `Targets` table |
| **`balance_engine.py`** (primary, pending) | ⏳ blocked — file not in this repo | The *new* formula conventions (recomputed PAC/POD, negative-PAC handling, Leighton curve) that the TS engine must actually ship with |

**The legacy-convention caveat (important):** these vectors encode legacy
*formulas* applied to legacy *ingredient data*. Per
`sprinkles-legacy-data-comparison.md`, legacy per-ingredient PAC/POD values mix
basis conventions (e.g. dextrose 1.66 as-is vs. corn syrup solids-basis) and
are **not** the port's data target. Use this set to validate formula
transcription; use the `balance_engine.py` set (once generated) as the
authoritative end-to-end target. Where the two disagree on a formula, the
Python prototype wins by decision D2.

## Vector categories

- `se_fpd_curve` — 37 points over SE ∈ [0, 1.8] (the polynomial's stated
  accuracy range), with `FDP_to_SE` round-trips.
- `calc_fdp_grid` — 48 absolute (Water g, PAC g, MSNF g) combinations.
- `targets` — the full legacy `Targets` table with constructor-derived
  Mean/Range (part of the contract).
- `recipes` — 7 fixtures spanning: the repo's `test-recipe.ier` (embedded
  ingredient snapshot, zero-amount ingredient, PAC-less ingredient), standard /
  super-premium / gelato bases, a no-dairy sorbet, a negative-PAC + alcohol
  edge case, and a minimal 2-ingredient recipe. Each records `Sums`, recipe
  FDP, ideal PAC (full 12-target sweep on two fixtures), and `Fitness` in
  4 variants (mean/range × the two field sets below).

## Legacy quirks captured (do not blindly reproduce)

1. **`fitnessFields` order-dependence.** `OptimizeRecipe` derives
   `fitnessFields` *before* `Fitness()` first mutates the shared `Targets`
   singleton by adding a `PAC` key — so the first optimize of a session scores
   without PAC and subsequent ones include it. Vectors record both
   (`firstRun_*` / `steadyState_*`). The TS engine should include PAC
   deliberately and add no hidden state.
2. **`Sums` NaN.** The legacy getter multiplies per-ingredient
   `nonLactoseSugar` / `milkFat` fields that no shipped ingredient row
   defines → `NaN` in production (never displayed). Stripped from vectors;
   the port should define these properly or not at all.
3. **`Fitness` mutates its target argument** (sets `.PAC` to ideal ±5%).
   Vectors used a fresh target clone per call. The TS engine should keep
   fitness pure.
4. **Empty-recipe behavior is undefined in legacy** (`CalcFDP` divides by
   `Water = 0`). Not vectorized; the port should validate instead.

## Tolerances

Values are raw IEEE-754 doubles from the JS runtime. A faithful TS port of the
same operations should reproduce them near-exactly; comparing at **1e-9
relative tolerance** allows reordering of float operations without masking
formula errors. `meta` records the repo commit, Node version, and generation
timestamp.
