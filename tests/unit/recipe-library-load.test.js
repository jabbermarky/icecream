// Tests for the Recipe Library "Load" path —
// js/features/recipe-library-load.js, driven as app.js wires it.
//
// This wiring had ZERO coverage before P0.5 (item 16 of the P0.1+P0.2 review)
// while guarding the path the refusal rule primarily protects: a stale tab that
// hydrates a newer record here and saves it back is the silent-truncation case.
// The shared module logic is tested in recipe-serialization.test.js; what these
// tests pin is the ORDER — refusal gate BEFORE importIngredients, and before
// the current recipe is replaced — plus the messages and the .catch path.
//
// Mirrors the .ier import tests in recipe-roundtrip.test.js on purpose: the two
// load paths share a hydrator and must refuse identically.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './support/dom-stub.js';

installDom();

const { cRecipe } = await import('../../js/models/core.js');
const { RECIPE_SCHEMA_VERSION } = await import('../../js/models/recipe-serialization.js');
const { createLibraryRecipeLoader } = await import('../../js/features/recipe-library-load.js');

// Version-relative fixture for "newer than this build" (review finding: these
// were re-hardcoded to the literal the last bump invalidated; relative
// fixtures survive every future bump).
const NEWER = RECIPE_SCHEMA_VERSION + 1;

// --- Wiring, mirroring app.js ---

function harness({ record, loadThrows = false } = {}) {
  const state = {
    recipe: new cRecipe('Currently Open'),
    identity: 'UNSET',          // sentinel: distinguishes "never called" from null
    imports: [],
    displayed: 0,
    modifiedCalls: [],
    info: [],
    warning: [],
    error: [],
    consoleErrors: [],
  };

  const origConsoleError = console.error;
  console.error = (...args) => state.consoleErrors.push(args);
  state.restoreConsole = () => { console.error = origConsoleError; };

  const load = createLibraryRecipeLoader({
    storage: {
      loadRecipe: async () => {
        if (loadThrows) throw new Error('IndexedDB exploded');
        return record;
      },
    },
    setRecipe: (r) => { state.recipe = r; },
    setRecipeIdentity: (id) => { state.identity = id; },
    importIngredients: (ingredients, ...rest) => state.imports.push({ ingredients, rest }),
    DisplayRecipe: () => { state.displayed++; },
    SetRecipeModified: (v) => state.modifiedCalls.push(v),
    Info: (m) => state.info.push(m),
    Warning: (m) => state.warning.push(m),
    ErrorMsg: (m) => state.error.push(m),
  });

  return { state, load };
}

function libraryRecord(data) {
  // What IndexedDBStorage.loadRecipe returns: the whole record, container under .data
  return { name: 'Stored', updatedAt: '2026-08-12T00:00:00.000Z', data };
}

// --- The happy path ---

test('a valid record hydrates, imports its ingredients, redraws and reports', async () => {
  const { state, load } = harness({
    record: libraryRecord({
      SchemaVersion: 1,
      Recipe: { Name: 'Vanilla', Notes: 'from the library', Type: 'Gelato', Ingredients: [{ Name: 'Milk', Amount: 500 }] },
      Ingredients: { Milk: { Water: 0.87 } },
    }),
  });
  await load('Vanilla');
  state.restoreConsole();

  assert.equal(state.recipe.Name, 'Vanilla');
  assert.equal(state.recipe.Notes, 'from the library');
  assert.equal(state.recipe.Type, 'Gelato');
  assert.deepEqual(state.recipe.Ingredients, [{ Name: 'Milk', Amount: 500 }]);
  assert.ok(state.recipe instanceof cRecipe);       // a real recipe, not the raw record
  assert.equal(state.imports.length, 1);
  assert.deepEqual(state.imports[0].ingredients, { Milk: { Water: 0.87 } });
  assert.equal(state.imports[0].rest[0], false);    // never silently overwrites the library
  assert.equal(state.displayed, 1);
  assert.deepEqual(state.modifiedCalls, [false]);
  assert.equal(state.info.length, 1);
  assert.match(state.info[0], /Loaded "Vanilla"/);
  assert.equal(state.error.length, 0);
});

test('a legacy record with no SchemaVersion still loads', async () => {
  const { state, load } = harness({
    record: libraryRecord({ Recipe: { Name: 'Legacy', Overrun: 0.4, Ingredients: [] }, Ingredients: {} }),
  });
  await load('Legacy');
  state.restoreConsole();

  assert.equal(state.recipe.Name, 'Legacy');
  assert.equal(state.recipe.Overrun, 0.4);
  assert.equal(state.recipe.Type, 'Standard'); // absent fields keep constructor defaults
  assert.equal(state.error.length, 0);
});

test('undeclared fields are filtered — the same declared-fields filter as .ier import', async () => {
  const { state, load } = harness({
    record: libraryRecord({
      Recipe: { Name: 'Filtered', FutureField: 'lineage-or-id', Ingredients: [] },
      Ingredients: {},
    }),
  });
  await load('Filtered');
  state.restoreConsole();

  assert.equal(state.recipe.Name, 'Filtered');
  assert.equal(state.recipe.FutureField, undefined);
});

// --- The refusal gate, and its ORDER (the thing with no coverage) ---

test('REFUSAL: a newer-schema record is rejected BEFORE importIngredients and before the swap', async () => {
  // The ingredient map is deliberately NON-EMPTY: if the gate ever moved below
  // importIngredients, 'Trojan' would reach the library and this would catch
  // the ordering regression. Same fixture shape as the .ier test.
  const { state, load } = harness({
    record: libraryRecord({
      SchemaVersion: NEWER,
      Recipe: { Name: 'From The Future', LineageId: 'abc', Ingredients: [] },
      Ingredients: { Trojan: { Water: 1.0 } },
    }),
  });
  const before = state.recipe;
  await load('From The Future');
  state.restoreConsole();

  assert.equal(state.error.length, 1);
  assert.match(state.error[0], /newer version/);
  assert.match(state.error[0], new RegExp(`schema ${NEWER}`));
  assert.equal(state.imports.length, 0);      // library untouched — the ordering pin
  assert.equal(state.recipe, before);         // open recipe untouched
  assert.equal(state.displayed, 0);
  assert.equal(state.info.length, 0);
  assert.equal(state.modifiedCalls.length, 0);
});

test('REFUSAL: a numeric-string NEWER SchemaVersion refuses here too (the fail-closed bypass)', async () => {
  const { state, load } = harness({
    record: libraryRecord({ SchemaVersion: String(NEWER), Recipe: { Name: 'Stringly Future' }, Ingredients: {} }),
  });
  await load('Stringly Future');
  state.restoreConsole();

  assert.equal(state.error.length, 1);
  assert.match(state.error[0], new RegExp(`schema ${NEWER}`));
  assert.equal(state.imports.length, 0);
});

test('REFUSAL: a damaged record gets the damaged message, not "update the app"', async () => {
  for (const damaged of [{}, { Ingredients: {} }, { Recipe: null }, { Recipe: 'garbage' }, { Recipe: [1, 2] }]) {
    const { state, load } = harness({ record: libraryRecord(damaged) });
    const before = state.recipe;
    await load('Damaged');
    state.restoreConsole();

    assert.equal(state.error.length, 1, `must refuse: ${JSON.stringify(damaged)}`);
    assert.match(state.error[0], /damaged/);
    assert.doesNotMatch(state.error[0], /newer version/);  // truthful cause
    assert.equal(state.imports.length, 0);
    assert.equal(state.recipe, before);
  }
});

test('REFUSAL: garbage SchemaVersion is damaged, not legacy', async () => {
  for (const garbage of [true, NaN, '', {}]) {
    const { state, load } = harness({
      record: libraryRecord({ SchemaVersion: garbage, Recipe: { Name: 'X' }, Ingredients: {} }),
    });
    await load('Garbage');
    state.restoreConsole();

    assert.equal(state.error.length, 1, `SchemaVersion ${String(garbage)} must refuse`);
    assert.match(state.error[0], /damaged/);
    assert.equal(state.imports.length, 0);
  }
});

// --- Missing and failing loads ---

test('a missing recipe warns and changes nothing', async () => {
  const { state, load } = harness({ record: null });
  const before = state.recipe;
  await load('Nope');
  state.restoreConsole();

  assert.equal(state.warning.length, 1);
  assert.match(state.warning[0], /"Nope" not found/);
  assert.equal(state.error.length, 0);
  assert.equal(state.recipe, before);
  assert.equal(state.imports.length, 0);
});

test('a throwing storage layer is reported, not swallowed into an unhandled rejection', async () => {
  // Before the .catch existed, the user clicked Load and nothing happened at
  // all — console only. Pinned so it cannot regress to silence.
  const { state, load } = harness({ loadThrows: true });
  const before = state.recipe;
  await load('Explodes');
  state.restoreConsole();

  assert.equal(state.error.length, 1);
  assert.match(state.error[0], /Failed to load recipe/);
  assert.equal(state.recipe, before);
  assert.equal(state.consoleErrors.length, 1);
});

test('a throw while APPLYING reports a half-loaded app, not a damaged record', async () => {
  // Review finding: the loader used to guard fetch and apply in one try, so a
  // render crash — after the open recipe had already been replaced, on a path
  // that deliberately keeps no backup — told the user their STORED record was
  // damaged. The stored record is fine; their open work is what is gone. The
  // two phases now have separate catches and separate, truthful messages.
  const { state } = harness({
    record: libraryRecord({ Recipe: { Name: 'Render Boom', Ingredients: [] }, Ingredients: {} }),
  });
  const loader = createLibraryRecipeLoader({
    storage: { loadRecipe: async () => libraryRecord({ Recipe: { Name: 'Render Boom', Ingredients: [] }, Ingredients: {} }) },
    setRecipe: (r) => { state.recipe = r; },
    setRecipeIdentity: () => {},
    importIngredients: () => {},
    DisplayRecipe: () => { throw new Error('render exploded'); },
    SetRecipeModified: () => {},
    Info: (m) => state.info.push(m),
    Warning: (m) => state.warning.push(m),
    ErrorMsg: (m) => state.error.push(m),
  });
  await loader('Render Boom');
  state.restoreConsole();

  assert.equal(state.error.length, 1);
  assert.match(state.error[0], /could not be applied/);
  assert.match(state.error[0], /recipe copy is unchanged/);
  assert.doesNotMatch(state.error[0], /record may be damaged/); // the old lie
  assert.equal(state.info.length, 0);   // no success message after a failed render
});

test('a record whose Ingredients is not a name->definition map is refused at the gate', async () => {
  // The gate exists to run BEFORE importIngredients touches the live library.
  // An array there merged entries under numeric keys "0","1"; a string threw
  // mid-merge. Both now refuse, and importIngredients is never reached.
  // Includes ENTRY-VALUE garbage (review finding: the gate now checks one
  // level down — a string entry would spread its characters into numeric keys
  // inside the live library via Object.assign in importIngredients).
  for (const bad of [[{ Water: 1.0 }], 'garbage', 42, { Cream: 'AAAA' }, { Cream: 7 }]) {
    const { state, load } = harness({
      record: libraryRecord({ Recipe: { Name: 'Bad Ingredients', Ingredients: [] }, Ingredients: bad }),
    });
    await load('Bad Ingredients');
    state.restoreConsole();
    assert.equal(state.error.length, 1, `Ingredients=${JSON.stringify(bad)} must be refused`);
    assert.match(state.error[0], /damaged/);
    assert.equal(state.imports.length, 0, 'importIngredients must not run');
    assert.equal(state.info.length, 0);
  }
});

test('a record with NO Ingredients key still loads — and importIngredients gets {}, not undefined', async () => {
  const { state, load } = harness({
    record: libraryRecord({ Recipe: { Name: 'No Ingredients', Ingredients: [] } }),
  });
  await load('No Ingredients');
  state.restoreConsole();
  assert.equal(state.error.length, 0);
  assert.equal(state.recipe.Name, 'No Ingredients');
  // The load-bearing half (review finding): the REAL importIngredients opens
  // with Object.entries(dataObj) and throws on undefined — the earlier
  // version of this test stayed green only because the harness stub accepted
  // anything. Pin the fallback the loader now supplies.
  assert.equal(state.imports.length, 1);
  assert.deepEqual(state.imports[0].ingredients, {});
});

// --- P0.3: identity adoption on load ---

test('P0.3: loading an identified record adopts its RecipeId, silently', async () => {
  const { state, load } = harness({
    record: libraryRecord({
      SchemaVersion: 2, RecipeId: 'id-loaded',
      Recipe: { Name: 'Identified', Ingredients: [] }, Ingredients: {},
    }),
  });
  await load('Identified');
  state.restoreConsole();
  assert.equal(state.identity, 'id-loaded');
  assert.equal(state.warning.length, 0);       // a healthy record does not warn
  assert.equal(state.error.length, 0);
});

test('P0.3 DECISION 7: a v2 record with NO id loads, warns, and adopts null', async () => {
  const { state, load } = harness({
    record: libraryRecord({ SchemaVersion: 2, Recipe: { Name: 'Stripped', Ingredients: [] }, Ingredients: {} }),
  });
  await load('Stripped');
  state.restoreConsole();
  assert.equal(state.recipe.Name, 'Stripped');  // loaded, not locked out
  assert.equal(state.identity, null);           // re-mints at the next save
  assert.equal(state.warning.length, 1);
  assert.match(state.warning[0], /identity/);
  assert.equal(state.info.length, 1, 'the warning must not replace the success message');
  assert.equal(state.error.length, 0, 'and must not read as a failure');
});

test('P0.3: a legacy v1 record adopts null identity with NO warning (absence is expected)', async () => {
  const { state, load } = harness({
    record: libraryRecord({ Recipe: { Name: 'Legacy Id', Ingredients: [] }, Ingredients: {} }),
  });
  await load('Legacy Id');
  state.restoreConsole();
  assert.equal(state.identity, null);
  assert.equal(state.warning.length, 0);
});

test('P0.3: a REFUSED record never touches identity', async () => {
  const { state, load } = harness({
    record: libraryRecord({ SchemaVersion: NEWER, Recipe: { Name: 'X' }, Ingredients: {} }),
  });
  await load('X');
  state.restoreConsole();
  assert.equal(state.identity, 'UNSET', 'the open recipe\'s identity must survive a refused load');
});

// --- The deliberate divergence from .ier import, pinned so it stays a decision ---

test('library load does NOT back up the current recipe (deliberate, unlike .ier import)', async () => {
  // .ier import pushes the open recipe onto the backup stack; this path does
  // not. Reviewed under P0.5 and kept: aligning them is a user-visible change
  // and Phase 0 is structural only. Pinned so a later change is a decision.
  const { state, load } = harness({
    record: libraryRecord({ Recipe: { Name: 'Replaces Silently', Ingredients: [] }, Ingredients: {} }),
  });
  await load('Replaces Silently');
  state.restoreConsole();

  assert.equal(state.recipe.Name, 'Replaces Silently');
  // No backup hook exists in this path's dependency surface at all — the
  // absence IS the behaviour. If a backup is ever added, this test names the
  // moment it changed.
  assert.equal(state.imports.length, 1);
});
