// Tests for the recipe save / export / import paths in
// js/features/recipe-manager.js — driving the REAL handlers through
// initRecipeManager/initRecipeButtons with stub elements, exactly as the
// app wires them. Two layers: pre-P0.2 characterization pins where the
// behaviour survives (declared-fields filtering, zero-strip, live-object
// container), and the P0.2 serializer contract (SchemaVersion on the
// record, refusal on newer schema).
//
// The central pin: the round-trip DROPS any field cRecipe does not declare
// within the same schema version. A field added WITH a schema bump makes
// old readers refuse instead — see js/models/recipe-serialization.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, resetDom, capturedBlobs, makeElement, makeFile } from './support/dom-stub.js';

installDom();

const { cRecipe } = await import('../../js/models/core.js');
const { cIngredient, initIngredients, Ingredients: IngredientLibrary } =
  await import('../../js/features/ingredients.js');
const { initRecipeManager, initRecipeButtons, getRecipeStack } =
  await import('../../js/features/recipe-manager.js');

// --- Wiring, mirroring app.js ---

let currentRecipe = new cRecipe('');
const messages = { info: [], warning: [], error: [] };
const cloudPushes = [];
let storageCalls = [];
let storageHasRecipe = false;
let storageSaveResult = true;

// The library is the REAL module-level map from ingredients.js — the one
// importIngredients mutates. In the app, deps.getIngredients returns this
// same object (app.js wires `() => Ingredients`); an earlier version of this
// harness injected a private map here, which meant the load path's imports
// mutated a different object than the assertions inspected. Found by review.
function seedLibrary() {
  for (const k of Object.keys(IngredientLibrary)) delete IngredientLibrary[k];
  IngredientLibrary.Milk = Object.assign(new cIngredient(), { Water: 0.87, Fat: 0.04, MSNF: 0.09, Sugar: 0.0, PAC: 0.05 });
  IngredientLibrary.Sugar = Object.assign(new cIngredient(), { Water: 0.0, Sugar: 1.0, PAC: 1.0, POD: 1.0, Solids: 1.0 });
}
seedLibrary();

const deps = {
  getRecipe: () => currentRecipe,
  setRecipe: (r) => { currentRecipe = r; },
  getIngredients: () => IngredientLibrary,
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
  seedLibrary();
  // Recipe-manager module state accumulates across tests otherwise —
  // recipe names are unique per test, but a stale stack entry could still
  // route a load through the "already loaded" modal path unexpectedly.
  const stack = getRecipeStack();
  for (const k of Object.keys(stack)) delete stack[k];
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
  assert.equal(IngredientLibrary.Milk.Sugar, 0.0);   // the library copy is untouched
  assert.notEqual(savedMilk, IngredientLibrary.Milk);
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
  // The fixture carries a NON-EMPTY ingredient map: if the refusal guard ever
  // moved below importIngredients, 'Trojan' would land in the library and the
  // assertion below would catch the ordering regression. An earlier version
  // used an empty map, which made the ordering unobservable. Found by review.
  const newer = JSON.stringify({
    id: 'IER', version: 1,
    data: {
      SchemaVersion: 2,
      Recipe: { Name: 'From The Future', LineageId: 'abc', Ingredients: [] },
      Ingredients: { Trojan: { Water: 1.0 } },
    },
  });
  buttons.inputLoadRecipe.onchange({ target: { files: [makeFile(newer)] } });

  assert.equal(messages.error.length, 1);
  assert.match(messages.error[0], /newer version/);
  assert.match(messages.error[0], /schema 2/);
  assert.equal(currentRecipe, before);                       // current recipe untouched
  assert.equal(messages.info.length, 0);                     // no "loaded" message
  assert.equal('Trojan' in IngredientLibrary, false);        // library untouched
});

test('zero-strip uses LOOSE equality — "" and "0" values are also deleted (pinned)', async () => {
  // The centralized filter in buildRecipeContainer keeps the original == 0.0
  // comparison, so '' and '0' (and false) strip like numeric zero. Pinned so a
  // future strict-equality cleanup is a decision, not an accident — the same
  // reason file-io.test.js pins the envelope's loose version compare.
  freshState(makeRecipe('Loose Zero'));
  IngredientLibrary.Milk.Brand = '';
  IngredientLibrary.Milk.Grade = '0';
  IngredientLibrary.Milk.Origin = 'valley';
  await buttons.btnSaveRecipe.onclick();

  const savedMilk = storageCalls[0].data.Ingredients.Milk;
  assert.equal('Brand' in savedMilk, false);   // '' == 0.0 → stripped
  assert.equal('Grade' in savedMilk, false);   // '0' == 0.0 → stripped
  assert.equal(savedMilk.Origin, 'valley');    // truthy string kept
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

test('a damaged .ier (valid envelope, data:{}) is refused with the damaged-record message', () => {
  // parseRecipeFile accepts {id:'IER',version:1,data:{}} — pre-fix this threw
  // a TypeError inside reader.onload after mutations, with no error shown.
  freshState(makeRecipe('Survives Damage'));
  const before = currentRecipe;
  buttons.inputLoadRecipe.onchange({
    target: { files: [makeFile(JSON.stringify({ id: 'IER', version: 1, data: {} }))] },
  });
  assert.equal(messages.error.length, 1);
  assert.match(messages.error[0], /damaged/);
  assert.doesNotMatch(messages.error[0], /newer version/); // truthful cause
  assert.equal(currentRecipe, before);
});
