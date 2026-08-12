// js/models/recipe-serialization.js — direct unit tests, no DOM.
//
// This module is the single owner of the container shape and the
// declared-fields hydration filter (P0.2). The through-the-handlers coverage
// lives in recipe-roundtrip.test.js; these tests pin the module's own
// contract, including the one behaviour that must never regress: a NEWER
// schema is REFUSED, not truncated.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { cRecipe } = await import('../../js/models/core.js');
const {
  RECIPE_SCHEMA_VERSION,
  buildRecipeContainer,
  containerSchemaVersion,
  isNewerSchema,
  newerSchemaMessage,
  invalidContainerMessage,
  containerProblem,
  hydrateRecipe,
} = await import('../../js/models/recipe-serialization.js');

// Minimal ingredient stand-ins: the builder only needs .copy() and fields.
function fakeIngredient(fields) {
  return { ...fields, copy() { const { copy, ...rest } = this; return { ...rest }; } };
}

function makeRecipe() {
  const r = new cRecipe('Test', 'notes');
  r.addIngredient('Milk', 500);
  r.addIngredient('Sugar', 120);
  return r;
}

const library = {
  Milk: fakeIngredient({ Water: 0.87, Fat: 0.04, Sugar: 0.0 }),
  Sugar: fakeIngredient({ Water: 0.0, Sugar: 1.0 }),
};

// --- buildRecipeContainer ---

test('container carries SchemaVersion and the LIVE recipe object (P0.5 pin)', () => {
  const r = makeRecipe();
  const c = buildRecipeContainer(r, library, () => {});
  assert.equal(c.SchemaVersion, RECIPE_SCHEMA_VERSION);
  assert.equal(c.Recipe, r); // live object until P0.5 — deliberate
  assert.deepEqual(Object.keys(c.Ingredients).sort(), ['Milk', 'Sugar']);
});

test('builder strips zero-valued keys from ingredient COPIES, library untouched', () => {
  const c = buildRecipeContainer(makeRecipe(), library, () => {});
  assert.equal(c.Ingredients.Milk.Sugar, undefined);
  assert.equal(c.Ingredients.Milk.Water, 0.87);
  assert.equal(library.Milk.Sugar, 0.0);
});

test('builder warns per missing ingredient and omits it', () => {
  const r = makeRecipe();
  r.addIngredient('Mystery', 10);
  const warnings = [];
  const c = buildRecipeContainer(r, library, (m) => warnings.push(m));
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Mystery/);
  assert.equal(c.Ingredients.Mystery, undefined);
});

// --- version accounting ---

test('a container without SchemaVersion is v1 by definition (every pre-P0.2 record)', () => {
  assert.equal(containerSchemaVersion({ Recipe: {}, Ingredients: {} }), 1);
  assert.equal(isNewerSchema({ Recipe: {}, Ingredients: {} }), false);
});

test('same-version and older containers are not "newer"', () => {
  assert.equal(isNewerSchema({ SchemaVersion: RECIPE_SCHEMA_VERSION }), false);
  assert.equal(isNewerSchema({ SchemaVersion: 0 }), false);
});

test('a higher SchemaVersion is newer, and the message names both versions', () => {
  const c = { SchemaVersion: RECIPE_SCHEMA_VERSION + 1 };
  assert.equal(isNewerSchema(c), true);
  const msg = newerSchemaMessage(c);
  assert.match(msg, new RegExp(`schema ${RECIPE_SCHEMA_VERSION + 1}`));
  assert.match(msg, new RegExp(`up to ${RECIPE_SCHEMA_VERSION}`));
});

// --- hydrateRecipe ---

test('hydration copies exactly the declared fields; undeclared fields drop', () => {
  const c = buildRecipeContainer(makeRecipe(), library, () => {});
  c.Recipe = { ...JSON.parse(JSON.stringify(c.Recipe)), FutureField: 'x' };
  const h = hydrateRecipe(c);
  assert.ok(h instanceof cRecipe);
  assert.equal(h.Name, 'Test');
  assert.equal(h.Notes, 'notes');
  assert.deepEqual(h.Ingredients, [
    { Name: 'Milk', Amount: 500 },
    { Name: 'Sugar', Amount: 120 },
  ]);
  assert.equal(h.FutureField, undefined); // same-schema undeclared field: still filtered
});

test('a legacy container (no SchemaVersion) hydrates normally', () => {
  const h = hydrateRecipe({ Recipe: { Name: 'Old', Overrun: 0.4 }, Ingredients: {} });
  assert.equal(h.Name, 'Old');
  assert.equal(h.Overrun, 0.4);
  assert.equal(h.Type, 'Standard'); // absent fields keep constructor defaults
});

test('REFUSAL: a newer schema hydrates to null, never to a truncated recipe', () => {
  const c = {
    SchemaVersion: RECIPE_SCHEMA_VERSION + 1,
    Recipe: { Name: 'From The Future', LineageId: 'abc' },
    Ingredients: {},
  };
  assert.equal(hydrateRecipe(c), null);
});

// --- FAIL CLOSED: the SchemaVersion type matrix (review finding, 3 passes) ---

test('a numeric-string SchemaVersion "2" REFUSES as 2 — the bypass that shipped first', () => {
  const c = { SchemaVersion: '2', Recipe: { Name: 'X', LineageId: 'abc' }, Ingredients: {} };
  assert.equal(containerSchemaVersion(c), 2);
  assert.equal(isNewerSchema(c), true);
  assert.equal(hydrateRecipe(c), null);
  assert.match(containerProblem(c), /newer version/); // truthful message, names schema 2
  assert.match(containerProblem(c), /schema 2/);
});

test('a numeric-string SchemaVersion "1" hydrates as v1', () => {
  const c = { SchemaVersion: '1', Recipe: { Name: 'Stringly' }, Ingredients: {} };
  assert.equal(containerSchemaVersion(c), 1);
  assert.equal(hydrateRecipe(c).Name, 'Stringly');
});

test('garbage SchemaVersion (true, NaN, "", {}) refuses as DAMAGED, not as "newer"', () => {
  for (const garbage of [true, NaN, '', '  ', {}]) {
    const c = { SchemaVersion: garbage, Recipe: { Name: 'X' }, Ingredients: {} };
    assert.equal(hydrateRecipe(c), null, `SchemaVersion ${String(garbage)} must refuse`);
    assert.equal(containerProblem(c), invalidContainerMessage(),
      `SchemaVersion ${String(garbage)} must get the damaged-record message, not update-the-app`);
  }
});

test('SchemaVersion null is treated as absent — legacy v1', () => {
  const c = { SchemaVersion: null, Recipe: { Name: 'Nullv' }, Ingredients: {} };
  assert.equal(containerSchemaVersion(c), 1);
  assert.equal(hydrateRecipe(c).Name, 'Nullv');
});

// --- Shape validation (review finding, 4 passes incl. red team) ---

test('malformed containers return null, never throw and never hydrate blank', () => {
  // Each of these previously threw a TypeError mid-load or silently produced
  // an empty cRecipe over the user's open recipe.
  for (const bad of [
    {},                                          // data:{} passes parseRecipeFile today
    { Ingredients: {} },                         // Recipe missing
    { Recipe: null, Ingredients: {} },
    { Recipe: 'garbage', Ingredients: {} },      // primitive → hydrated BLANK before
    { Recipe: [1, 2, 3], Ingredients: {} },      // array → hydrated BLANK before
    null,
    undefined,
    'not even an object',
  ]) {
    assert.equal(hydrateRecipe(bad), null, `must refuse: ${JSON.stringify(bad)}`);
    assert.equal(containerProblem(bad), invalidContainerMessage());
  }
});

test('a Recipe carrying an own "hasOwnProperty" key hydrates cleanly (no shadowing crash)', () => {
  const c = {
    Recipe: JSON.parse('{"Name":"Shadowed","hasOwnProperty":1}'),
    Ingredients: {},
  };
  const h = hydrateRecipe(c);
  assert.equal(h.Name, 'Shadowed');
  assert.equal(h.hasOwnProperty, Object.prototype.hasOwnProperty); // not copied — undeclared
});

test('the two refusal messages are distinct — corrupted records are not told to update the app', () => {
  assert.notEqual(invalidContainerMessage(), newerSchemaMessage({ SchemaVersion: 2 }));
  assert.doesNotMatch(invalidContainerMessage(), /newer version/);
});
