// Characterization tests for the recipe save / export / import paths in
// js/features/recipe-manager.js — driving the REAL handlers through
// initRecipeManager/initRecipeButtons with stub elements, exactly as the
// app wires them. Pins CURRENT behaviour before P0.2's versioned serializer.
//
// The central pin: the round-trip DROPS any field cRecipe does not declare
// (save keeps it, load's key-filtered hydration discards it). This is the
// verified reality behind Phase 0 — see .planning/batch-loop-design.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, resetDom, capturedBlobs, makeElement, makeFile } from './support/dom-stub.js';

installDom();

const { cRecipe } = await import('../../js/models/core.js');
const { cIngredient, initIngredients } = await import('../../js/features/ingredients.js');
const { initRecipeManager, initRecipeButtons } = await import('../../js/features/recipe-manager.js');

// --- Wiring, mirroring app.js ---

let currentRecipe = new cRecipe('');
const messages = { info: [], warning: [], error: [] };
const cloudPushes = [];
let storageCalls = [];
let storageHasRecipe = false;
let storageSaveResult = true;

const IngredientsMap = {
  Milk: Object.assign(new cIngredient(), { Water: 0.87, Fat: 0.04, MSNF: 0.09, Sugar: 0.0, PAC: 0.05 }),
  Sugar: Object.assign(new cIngredient(), { Water: 0.0, Sugar: 1.0, PAC: 1.0, POD: 1.0, Solids: 1.0 }),
};

const deps = {
  getRecipe: () => currentRecipe,
  setRecipe: (r) => { currentRecipe = r; },
  getIngredients: () => IngredientsMap,
  getRecipeDataColumns: () => ['Water', 'Sugar', 'Fat', 'MSNF', 'Solids', 'PAC', 'POD', 'Stabilizer'],
  getRecipeColumns: () => ['Name', 'Amount', 'Scale to', '', 'Water', 'Sugar', 'Fat', 'MSNF', 'Solids', 'PAC', 'POD', 'Stabilizer'],
  sliders: new Proxy({}, { get: () => makeElement('input') }),
  scoopSizes: new Proxy({}, { get: () => ({ Name: 'stub', Amount: 50 }) }),
  tgtSelection: Object.assign(makeElement('select'), { value: 'Standard' }),
  showModal: () => {},
  hideModal: () => {},
  Info: (m) => messages.info.push(m),
  Warning: (m) => messages.warning.push(m),
  ErrorMsg: (m) => messages.error.push(m),
};
initRecipeManager(deps);
initIngredients({ ...deps, DisplayRecipe: () => {}, getRecipeContext: () => ({}), Sugars: {}, storage: null });

const buttons = {};
for (const name of ['btnNewRecipe', 'btnStoreAsIngredient', 'btnSaveRecipe', 'btnExportRecipe',
  'btnLoadRecipe', 'inputLoadRecipe', 'btnPrintRecipe', 'btnCategorizeRecipe', 'btnOptimizeMean',
  'btnOptimizeRange', 'btnRestoreRecipe', 'btnScale', 'cbxScaleByIngredient', 'edTargetWeight',
  'selTargetWeightMode', 'edRecipeName']) buttons[name] = makeElement('button');
buttons.storage = {
  hasRecipe: async () => storageHasRecipe,
  saveRecipe: async (rec) => { storageCalls.push(rec); return storageSaveResult; },
};
buttons.pushRecipe = (rec) => cloudPushes.push(rec);
initRecipeButtons(buttons);

function freshState(recipe) {
  resetDom();
  messages.info.length = messages.warning.length = messages.error.length = 0;
  cloudPushes.length = 0;
  storageCalls = [];
  storageHasRecipe = false;
  storageSaveResult = true;
  globalThis.confirm = () => true;
  currentRecipe = recipe;
}

function makeRecipe(name) {
  const r = new cRecipe(name, 'some notes');
  r.addIngredient('Milk', 500);
  r.addIngredient('Sugar', 120);
  return r;
}

// --- Save path (real handleSaveRecipe) ---

test('save builds a {Recipe, Ingredients} container and pushes the same container to the cloud', async () => {
  freshState(makeRecipe('Save Shape'));
  await buttons.btnSaveRecipe.onclick();

  assert.equal(storageCalls.length, 1);
  const { name, data } = storageCalls[0];
  assert.equal(name, 'Save Shape');
  assert.equal(data.Recipe, currentRecipe); // the LIVE object, not a clone — P0.5 fixes this
  assert.deepEqual(Object.keys(data.Ingredients).sort(), ['Milk', 'Sugar']);
  assert.equal(cloudPushes.length, 1);
  assert.equal(cloudPushes[0].data, data); // same container object, fire-and-forget
  assert.equal(messages.info.length, 1);
});

test('save DELETES zero-valued keys from each ingredient copy (library stays intact)', async () => {
  freshState(makeRecipe('Zero Strip'));
  await buttons.btnSaveRecipe.onclick();

  const savedMilk = storageCalls[0].data.Ingredients.Milk;
  assert.equal(savedMilk.Sugar, undefined);       // 0.0 → deleted
  assert.equal(savedMilk.Water, 0.87);            // non-zero → kept
  assert.equal(IngredientsMap.Milk.Sugar, 0.0);   // the library copy is untouched
  assert.notEqual(savedMilk, IngredientsMap.Milk);
});

test('save warns on an ingredient missing from the library and omits it from the container', async () => {
  const r = makeRecipe('Missing Ingredient');
  r.addIngredient('Mystery', 10);
  freshState(r);
  await buttons.btnSaveRecipe.onclick();

  assert.equal(messages.warning.length, 1);
  assert.match(messages.warning[0], /Mystery/);
  assert.equal(storageCalls[0].data.Ingredients.Mystery, undefined);
  assert.equal(storageCalls.length, 1); // still saves the rest
});

test('save with an empty name warns and never touches storage', async () => {
  freshState(new cRecipe(''));
  await buttons.btnSaveRecipe.onclick();
  assert.equal(messages.warning.length, 1);
  assert.equal(storageCalls.length, 0);
});

test('overwrite prompt: declining confirm() aborts the save', async () => {
  freshState(makeRecipe('Existing'));
  storageHasRecipe = true;
  globalThis.confirm = () => false;
  await buttons.btnSaveRecipe.onclick();
  assert.equal(storageCalls.length, 0);
  assert.equal(cloudPushes.length, 0);
});

test('LOCAL save failure is surfaced (ErrorMsg) and skips the cloud push', async () => {
  // The local layer checks saveRecipe's boolean. The CLOUD layer does not —
  // that asymmetry is issue #12, in sync-manager.js, outside this module.
  freshState(makeRecipe('Fail Save'));
  storageSaveResult = false;
  await buttons.btnSaveRecipe.onclick();
  assert.equal(messages.error.length, 1);
  assert.equal(cloudPushes.length, 0);
});

// --- Export path (real handleExportRecipe) ---

test('export writes an IER v1 envelope containing the same container shape', async () => {
  freshState(makeRecipe('Export Me'));
  buttons.btnExportRecipe.onclick();

  assert.equal(capturedBlobs.length, 1);
  const envelope = JSON.parse(await capturedBlobs[0].text());
  assert.equal(envelope.id, 'IER');
  assert.equal(envelope.version, 1);
  assert.equal(envelope.data.Recipe.Name, 'Export Me');
  assert.deepEqual(Object.keys(envelope.data.Ingredients).sort(), ['Milk', 'Sugar']);
});

// --- Round-trip (real export → real handleLoadRecipeFile) ---

async function exportThenImport(recipe) {
  freshState(recipe);
  buttons.btnExportRecipe.onclick();
  const fileContent = await capturedBlobs[0].text();

  // Start from a clean current recipe (no ingredients → no backup-stack detour).
  currentRecipe = new cRecipe('');
  let renderError = null;
  try {
    buttons.inputLoadRecipe.onchange({ target: { files: [makeFile(fileContent)] } });
  } catch (err) {
    // Hydration happens BEFORE DisplayRecipe; a render-time throw in node's
    // stub DOM does not affect the state under test. Rendering is covered by
    // the Playwright suite.
    renderError = err;
  }
  return { hydrated: currentRecipe, renderError };
}

test('round-trip DROPS undeclared fields WITHIN the same schema — by design, post-P0.2', async () => {
  // Pre-P0.2 this pinned the motivating bug. Post-P0.2 it pins the intended
  // contract: an ad-hoc field with no schema bump is filtered (that is the
  // declared-fields filter working); a field added WITH a schema bump makes
  // old readers refuse instead — covered below and in
  // recipe-serialization.test.js.
  const original = makeRecipe('Field Drop');
  original.FutureField = 'lineage-or-id';
  const { hydrated } = await exportThenImport(original);

  assert.notEqual(hydrated, original);              // a NEW cRecipe was hydrated
  assert.equal(hydrated.Name, 'Field Drop');        // declared fields survive
  assert.equal(hydrated.FutureField, undefined);    // undeclared field filtered
});

// --- P0.2: schema version on the record, refusal on newer ---

test('P0.2: saved container and exported envelope both carry SchemaVersion 1', async () => {
  freshState(makeRecipe('Versioned'));
  await buttons.btnSaveRecipe.onclick();
  assert.equal(storageCalls[0].data.SchemaVersion, 1);

  freshState(makeRecipe('Versioned'));
  buttons.btnExportRecipe.onclick();
  const envelope = JSON.parse(await capturedBlobs[0].text());
  assert.equal(envelope.version, 1);            // envelope version unchanged —
  assert.equal(envelope.data.SchemaVersion, 1); // old readers still accept the file
});

test('P0.2: a legacy .ier (no SchemaVersion) still loads', async () => {
  freshState(new cRecipe(''));
  const legacy = JSON.stringify({
    id: 'IER', version: 1,
    data: { Recipe: { Name: 'Legacy Record', Notes: 'pre-P0.2', Ingredients: [] }, Ingredients: {} },
  });
  try {
    buttons.inputLoadRecipe.onchange({ target: { files: [makeFile(legacy)] } });
  } catch { /* render-time throw in stub DOM; hydration already happened */ }
  assert.equal(currentRecipe.Name, 'Legacy Record');
  assert.equal(currentRecipe.Notes, 'pre-P0.2');
  assert.equal(messages.error.length, 0);
});

test('P0.2 REFUSAL: a newer-schema .ier is rejected before ANY mutation', async () => {
  freshState(makeRecipe('Untouched By The Future'));
  const before = currentRecipe;
  const newer = JSON.stringify({
    id: 'IER', version: 1,
    data: {
      SchemaVersion: 2,
      Recipe: { Name: 'From The Future', LineageId: 'abc', Ingredients: [] },
      Ingredients: {},
    },
  });
  buttons.inputLoadRecipe.onchange({ target: { files: [makeFile(newer)] } });

  assert.equal(messages.error.length, 1);
  assert.match(messages.error[0], /newer version/);
  assert.match(messages.error[0], /schema 2/);
  assert.equal(currentRecipe, before);          // current recipe untouched
  assert.equal(messages.info.length, 0);        // no "loaded" message
});

test('round-trip preserves every constructor-declared field and the ingredient rows', async () => {
  const original = makeRecipe('Full Fidelity');
  original.Type = 'Gelato';
  original.ServingTemperature = -14;
  original.Hardness = 0.6;
  original.Overrun = 0.25;
  const { hydrated } = await exportThenImport(original);

  assert.equal(hydrated.Notes, 'some notes');
  assert.equal(hydrated.Type, 'Gelato');
  assert.equal(hydrated.ServingTemperature, -14);
  assert.equal(hydrated.Hardness, 0.6);
  assert.equal(hydrated.Overrun, 0.25);
  assert.deepEqual(hydrated.Ingredients, [
    { Name: 'Milk', Amount: 500 },
    { Name: 'Sugar', Amount: 120 },
  ]);
});

test('loading an invalid file reports an error and leaves the current recipe alone', () => {
  freshState(makeRecipe('Untouched'));
  const before = currentRecipe;
  buttons.inputLoadRecipe.onchange({
    target: { files: [makeFile(JSON.stringify({ id: 'IER', version: 2, data: {} }))] },
  });
  assert.equal(messages.error.length, 1);
  assert.equal(currentRecipe, before);
});
