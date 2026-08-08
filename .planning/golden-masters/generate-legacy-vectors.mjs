/**
 * Golden-master vector generator — LEGACY JS oracle.
 *
 * Runs the actual production calculation code (js/features/calculations.js,
 * js/models/core.js) headlessly under Node and records inputs → outputs as
 * JSON test vectors for validating the Sprinkles recipe-domain TS port.
 *
 * Usage (from repo root):  node .planning/golden-masters/generate-legacy-vectors.mjs
 *
 * See README.md in this directory for provenance and the legacy-convention
 * caveat: these vectors validate FORMULAS that carry over, not per-ingredient
 * PAC/POD data conventions.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { SE_to_FPD, FDP_to_SE, CalcFDP, GetIdealPAC, Fitness } from '../../js/features/calculations.js';
import { cRecipe, cTarget, cTargetValue, Targets } from '../../js/models/core.js';
import { Ingredients, IngredientDataFields } from '../../js/features/ingredients.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

// The legacy Sums getter logs per-ingredient debug lines; silence during generation.
const realLog = console.log;
console.log = () => {};

const db = JSON.parse(readFileSync(join(repoRoot, 'data', 'ingredients.json'), 'utf8')).ingredients;
const ier = JSON.parse(readFileSync(join(repoRoot, 'test-recipe.ier'), 'utf8')).data;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRecipe({ name, type, servingTemperature, hardness, ingredients }) {
  const r = new cRecipe(name, '', { Type: type, ServingTemperature: servingTemperature, Hardness: hardness });
  for (const [n, amount] of ingredients) r.addIngredient(n, amount);
  return r;
}

// Each fixture declares which ingredient table it resolves against, so vectors
// are self-contained: the TS test suite replays with the recorded rows, not
// with whatever DB it happens to ship.
const fixtures = [
  {
    id: 'test-recipe-ier',
    note: 'The repo test fixture (test-recipe.ier) with its own embedded ingredient snapshot; includes a zero-amount ingredient and a PAC-less ingredient (goat cheese).',
    source: ier.Ingredients,
    recipe: makeRecipe({
      name: ier.Recipe.Name, type: ier.Recipe.Type,
      servingTemperature: ier.Recipe.ServingTemperature, hardness: ier.Recipe.Hardness,
      ingredients: ier.Recipe.Ingredients.map(i => [i.Name, i.Amount]),
    }),
  },
  {
    id: 'standard-vanilla',
    note: 'Conventional Standard base from the shipped ingredient DB.',
    source: db,
    recipe: makeRecipe({
      name: 'Standard Vanilla', type: 'Standard', servingTemperature: -18, hardness: 0.75,
      ingredients: [
        ['Whole Milk 3.3%', 620], ['Cream, heavy', 230], ['Sucrose', 130], ['Dextrose', 40],
        ['Dried Skimmed Milk Powder', 45], ['Egg Yolk', 30], ['Vanilla Extract', 8],
      ],
    }),
  },
  {
    id: 'super-premium-custard',
    note: 'High-fat, egg-yolk-heavy Super-Premium.',
    source: db,
    recipe: makeRecipe({
      name: 'Super-Premium Custard', type: 'Super-Premium', servingTemperature: -18, hardness: 0.75,
      ingredients: [
        ['Cream, heavy', 450], ['Whole Milk 3.3%', 350], ['Sucrose', 140],
        ['Egg Yolk', 90], ['Dried Skimmed Milk Powder', 20],
      ],
    }),
  },
  {
    id: 'lemon-sorbet',
    note: 'No dairy (MSNF ~0); exercises the sorbet path and non-default serving temperature/hardness.',
    source: db,
    recipe: makeRecipe({
      name: 'Lemon Sorbet', type: 'Sorbet', servingTemperature: -12, hardness: 0.7,
      ingredients: [
        ['Water', 550], ['Lemon Juice', 250], ['Sucrose', 150],
        ['Atomized Glucose DE40', 50], ['Invert Syrup 80%', 30],
      ],
    }),
  },
  {
    id: 'chocolate-gelato',
    note: 'Cocoa/chocolate solids; Gelato target at -15.',
    source: db,
    recipe: makeRecipe({
      name: 'Chocolate Gelato', type: 'Gelato', servingTemperature: -15, hardness: 0.75,
      ingredients: [
        ['Whole Milk 3.3%', 600], ['Cream, heavy', 150], ['Sucrose', 120], ['Dextrose', 30],
        ['Cocoa Powder', 60], ['Chocolate, dark', 80], ['Dried Skimmed Milk Powder', 30],
      ],
    }),
  },
  {
    id: 'almond-alcohol-edge',
    note: 'Edge conventions: negative-PAC ingredient (Almond Paste, PAC -0.84) plus high-PAC alcohol (2.97).',
    source: db,
    recipe: makeRecipe({
      name: 'Almond Amaretto', type: 'Premium', servingTemperature: -18, hardness: 0.75,
      ingredients: [
        ['Whole Milk 3.3%', 500], ['Cream, heavy', 200], ['Sucrose', 120],
        ['Almond Paste (pure)', 80], ['Alcohol 40%', 40], ['Dried Skimmed Milk Powder', 40],
      ],
    }),
  },
  {
    id: 'tiny-two-ingredient',
    note: 'Minimal recipe: water + sucrose only.',
    source: db,
    recipe: makeRecipe({
      name: 'Tiny', type: 'Sorbet', servingTemperature: -12, hardness: 0.7,
      ingredients: [['Water', 100], ['Sucrose', 25]],
    }),
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useIngredientTable(table) {
  for (const k of Object.keys(Ingredients)) delete Ingredients[k];
  Object.assign(Ingredients, table);
}

function resolvedRows(recipe, table) {
  const rows = {};
  for (const ing of recipe.Ingredients) if (table[ing.Name]) rows[ing.Name] = table[ing.Name];
  return rows;
}

// Fresh clone of a named target: Fitness() mutates its tgtType argument
// (adds/overwrites .PAC), and the legacy Targets are module-level singletons.
function freshTarget(name) {
  const t = Targets[name];
  return new cTarget(
    t.Fat.Min, t.Fat.Max, t.MSNF.Min, t.MSNF.Max, t.POD.Min, t.POD.Max,
    t.Stabilizer.Min, t.Stabilizer.Max, t.Solids.Min, t.Solids.Max,
  );
}

// Legacy quirk (documented in README): OptimizeRecipe computes fitnessFields
// BEFORE Fitness() first mutates the target with a PAC key. So the first
// optimize of a session scores WITHOUT PAC; later ones include it. Capture both.
const FIELDS_FIRST_RUN = IngredientDataFields.filter(c => Object.prototype.hasOwnProperty.call(freshTarget('Standard'), c));
const withPac = freshTarget('Standard');
withPac.PAC = new cTargetValue(0, 0); // simulate post-first-run mutation for field derivation
const FIELDS_STEADY_STATE = IngredientDataFields.filter(c => Object.prototype.hasOwnProperty.call(withPac, c));

// ---------------------------------------------------------------------------
// Vector generation
// ---------------------------------------------------------------------------

const vectors = { meta: null, se_fpd_curve: [], calc_fdp_grid: [], targets: {}, recipes: [] };

// 1. SE→FPD curve and round-trips over the function's stated accuracy range [0, 1.8].
for (let i = 0; i <= 36; i++) {
  const se = i * 0.05;
  const fpd = SE_to_FPD(se);
  vectors.se_fpd_curve.push({ se, fpd, se_roundtrip: FDP_to_SE(fpd) });
}

// 2. CalcFDP over a grid of absolute (Water, PAC, MSNF) in grams.
for (const water of [100, 500, 650, 1000])
  for (const pac of [0, 25, 120, 250])
    for (const msnf of [0, 50, 120])
      vectors.calc_fdp_grid.push({ water, pac, msnf, fdp: CalcFDP(water, pac, msnf) });

// 3. The target table itself (constructor-derived Mean/Range are part of the contract).
for (const [name, t] of Object.entries(Targets)) {
  vectors.targets[name] = {};
  for (const f of ['Fat', 'MSNF', 'Solids', 'POD', 'Stabilizer'])
    vectors.targets[name][f] = { Min: t[f].Min, Max: t[f].Max, Mean: t[f].Mean, Range: t[f].Range };
}

// 4. Per-recipe vectors: sums, FDP, ideal PAC, fitness (both modes × both field sets).
for (const fx of fixtures) {
  useIngredientTable(fx.source);
  const r = fx.recipe;
  const sums = r.Sums;
  // Legacy quirk: Sums unconditionally multiplies per-ingredient nonLactoseSugar
  // and milkFat, which no shipped ingredient row defines -> NaN in production.
  // Strip accidental NaN; the port should not reproduce it. (Kept if ever finite.)
  for (const k of ['nonLactoseSugar', 'milkFat']) if (Number.isNaN(sums[k])) delete sums[k];
  const entry = {
    id: fx.id,
    note: fx.note,
    input: {
      recipe: {
        Name: r.Name, Type: r.Type, ServingTemperature: r.ServingTemperature,
        Hardness: r.Hardness, Overrun: r.Overrun,
        Ingredients: r.Ingredients.map(i => ({ Name: i.Name, Amount: i.Amount })),
      },
      ingredientRows: resolvedRows(r, fx.source),
    },
    expected: {
      sums,
      fdp: CalcFDP(sums.Water, sums.PAC, sums.MSNF),
      idealPAC: {},
      fitness: {},
    },
  };

  // Ideal PAC against the recipe's own target type, plus a full sweep across
  // all target types for two representative recipes.
  const sweepAll = fx.id === 'standard-vanilla' || fx.id === 'lemon-sorbet';
  const targetNames = sweepAll ? Object.keys(Targets) : [r.Type];
  for (const tn of targetNames)
    entry.expected.idealPAC[tn] = GetIdealPAC(r, freshTarget(tn), sums);

  for (const [label, fields] of [['firstRun', FIELDS_FIRST_RUN], ['steadyState', FIELDS_STEADY_STATE]])
    for (const mode of [true, false])
      entry.expected.fitness[`${label}_${mode ? 'mean' : 'range'}`] =
        Fitness(cRecipe.copyFrom(r), r, freshTarget(r.Type), fields, cTargetValue, mode);

  vectors.recipes.push(entry);
}

// ---------------------------------------------------------------------------
// Metadata + write
// ---------------------------------------------------------------------------

const git = (cmd) => execSync(cmd, { cwd: repoRoot }).toString().trim();
vectors.meta = {
  oracle: 'legacy-js',
  description: 'Golden-master vectors generated from the legacy Ice Ed production JS (calculations.js, core.js). See README.md for scope and caveats.',
  generatedAt: new Date().toISOString(),
  repoCommit: git('git rev-parse HEAD'),
  nodeVersion: process.version,
  sourceFiles: ['js/features/calculations.js', 'js/models/core.js', 'js/features/ingredients.js (data fields + ingredient rows)'],
  fitnessFieldSets: { firstRun: FIELDS_FIRST_RUN, steadyState: FIELDS_STEADY_STATE },
  quirks: [
    'fitnessFields order-dependence: OptimizeRecipe derives fitnessFields before Fitness() first mutates the shared Targets singleton with a PAC key, so the first optimize of a session scores WITHOUT PAC and later ones include it. Vectors record both field sets; the TS port should include PAC deliberately.',
    'Sums NaN: the legacy Sums getter multiplies per-ingredient nonLactoseSugar/milkFat fields that no shipped ingredient row defines, yielding NaN in production (never displayed). Stripped from these vectors; do not reproduce.',
    'Fitness mutates its tgtType argument (sets .PAC to ideal±5%); vectors were generated with a fresh target clone per call.',
  ],
  counts: {
    se_fpd_curve: vectors.se_fpd_curve.length,
    calc_fdp_grid: vectors.calc_fdp_grid.length,
    recipes: vectors.recipes.length,
  },
};

console.log = realLog;
const out = join(here, 'legacy-vectors.json');
writeFileSync(out, JSON.stringify(vectors, null, 2) + '\n');
console.log(`Wrote ${out}`);
console.log(JSON.stringify(vectors.meta.counts));
