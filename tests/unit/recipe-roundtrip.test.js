// Tests for the recipe save / export / import paths in
// js/features/recipe-manager.js — driving the REAL handlers through
// initRecipeManager/initRecipeButtons with stub elements, exactly as the
// app wires them. Two layers: characterization pins where the behaviour
// survives (declared-fields filtering, zero-strip), and the serializer
// contract — P0.2's SchemaVersion and refusal-on-newer-schema, plus P0.5's
// detached, deeply frozen snapshot shared by both backends. The live-object
// container this file once pinned was REPLACED by P0.5, deliberately.
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
const { initRecipeManager, initRecipeButtons, getRecipeStack, SetRecipeModified, IsRecipeModified } =
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
  assert.notEqual(data.Recipe, currentRecipe); // P0.5: a snapshot, not the live object
  assert.equal(data.Recipe.Name, 'Save Shape');
  assert.deepEqual(Object.keys(data.Ingredients).sort(), ['Milk', 'Sugar']);
  assert.equal(cloudPushes.length, 1);
  assert.equal(cloudPushes[0].data, data); // ONE snapshot reaches BOTH backends
  assert.equal(messages.info.length, 1);
});

test('P0.5 RACE: edits made after Save cannot reach the cloud payload', async () => {
  // The bug, end to end. pushRecipeToCloud is fire-and-forget and Drive's
  // saveRecipe stringifies only after a findFileByName round trip, so before
  // P0.5 an edit landing in that window went to the cloud while IndexedDB kept
  // the earlier state — two backends disagreeing, no error, no attribution.
  freshState(makeRecipe('Race'));
  await buttons.btnSaveRecipe.onclick();

  // The window between clicking Save and the cloud write serializing.
  currentRecipe.Name = 'Edited After Save';
  currentRecipe.Overrun = 0.99;
  currentRecipe.addIngredient('Cream', 200);

  const local = storageCalls[0].data;
  const cloud = cloudPushes[0].data;
  for (const [label, payload] of [['local', local], ['cloud', cloud]]) {
    assert.equal(payload.Recipe.Name, 'Race', `${label} payload took a later edit`);
    assert.equal(payload.Recipe.Overrun, 0.3, `${label} payload took a later edit`);
    assert.equal(payload.Recipe.Ingredients.length, 2, `${label} payload took a later edit`);
  }
  // NOT deepEqual(cloud.Recipe, local.Recipe): the two are the SAME object
  // reference (pinned above), so that assertion could never fail. What is worth
  // pinning is that both backends were handed the one snapshot object.
  assert.equal(cloud, local, 'both backends must write the same snapshot object');
});

test('P0.5: the saved snapshot is frozen, so nothing downstream can amend it in flight', async () => {
  freshState(makeRecipe('Frozen Payload'));
  await buttons.btnSaveRecipe.onclick();

  const data = storageCalls[0].data;
  assert.ok(Object.isFrozen(data));
  assert.ok(Object.isFrozen(data.Recipe));
  assert.ok(Object.isFrozen(data.Ingredients.Milk));
  assert.throws(() => { data.Recipe.Name = 'amended'; }, TypeError);
});

test('P0.5: an unclonable recipe reports an error and writes NOTHING', async () => {
  // structuredClone refuses what JSON.stringify used to drop silently. The
  // handler must surface that: an uncaught throw here is an unhandled
  // rejection, i.e. the user clicks Save and nothing happens at all.
  const r = makeRecipe('Unclonable');
  r.Callback = () => {};
  freshState(r);
  await buttons.btnSaveRecipe.onclick();

  assert.equal(storageCalls.length, 0);
  assert.equal(cloudPushes.length, 0);
  assert.equal(messages.info.length, 0);
  assert.equal(messages.error.length, 1);
  assert.match(messages.error[0], /could not be prepared/);
});

test('P0.5: export refuses an unclonable recipe too, and writes no file', async () => {
  const r = makeRecipe('Unclonable Export');
  r.Callback = () => {};
  freshState(r);
  buttons.btnExportRecipe.onclick();

  assert.equal(capturedBlobs.length, 0);
  assert.equal(messages.error.length, 1);
  assert.match(messages.error[0], /could not be prepared/);
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

test('P0.2/P0.3: saved container and exported envelope both carry SchemaVersion 2', async () => {
  freshState(makeRecipe('Versioned'));
  await buttons.btnSaveRecipe.onclick();
  assert.equal(storageCalls[0].data.SchemaVersion, 2);

  freshState(makeRecipe('Versioned'));
  buttons.btnExportRecipe.onclick();
  const envelope = JSON.parse(await capturedBlobs[0].text());
  assert.equal(envelope.version, 1);            // envelope stays v1 DELIBERATELY
  // (P0.3 decision 11): the container's own SchemaVersion 2 is the thing
  // pre-P0.2 builds cannot check, and that population is closed operationally.
  assert.equal(envelope.data.SchemaVersion, 2);
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
      SchemaVersion: 3,
      Recipe: { Name: 'From The Future', LineageId: 'abc', Ingredients: [] },
      Ingredients: { Trojan: { Water: 1.0 } },
    },
  });
  buttons.inputLoadRecipe.onchange({ target: { files: [makeFile(newer)] } });

  assert.equal(messages.error.length, 1);
  assert.match(messages.error[0], /newer version/);
  assert.match(messages.error[0], /schema 3/);
  assert.equal(currentRecipe, before);                       // current recipe untouched
  assert.equal(messages.info.length, 0);                     // no "loaded" message
  assert.equal('Trojan' in IngredientLibrary, false);        // library untouched
});

test('P0.5: the snapshot AND the record key are both taken before the awaits', async () => {
  // The invariant had zero coverage: moving snapshotForSave below the await
  // kept every test green, because the hasRecipe stub was inert. This drives a
  // mutation from INSIDE the await, which is the real window — edRecipeName's
  // oninput writes straight to Recipe.Name and the event loop is free while an
  // IndexedDB read resolves.
  freshState(makeRecipe('Mango V2.1'));
  const origHasRecipe = buttons.storage.hasRecipe;
  buttons.storage.hasRecipe = async () => {
    currentRecipe.Name = 'Mango V2.2';   // the rename that used to fork the key
    currentRecipe.Overrun = 0.99;
    currentRecipe.addIngredient('Sugar', 999);
    return false;
  };
  await buttons.btnSaveRecipe.onclick();
  buttons.storage.hasRecipe = origHasRecipe;

  const stored = storageCalls[0];
  // Payload pinned to click time...
  assert.equal(stored.data.Recipe.Overrun, 0.3, 'payload took a mid-await edit');
  assert.equal(stored.data.Recipe.Ingredients.length, 2, 'payload took a mid-await edit');
  // ...and the KEY agrees with the payload it labels. Before the fix the record
  // was stored under "Mango V2.2" while its snapshot said "Mango V2.1".
  assert.equal(stored.name, 'Mango V2.1');
  assert.equal(stored.name, stored.data.Recipe.Name, 'record key must match its own snapshot');
  assert.equal(cloudPushes[0].name, stored.name, 'both backends must use one key');
  // And the user is not told the edit was saved: it was not.
  assert.equal(messages.info.length, 1);
  assert.match(messages.info[0], /Mango V2\.1/);
});

test('P0.5: the modified flag is NOT cleared when an edit landed during the save', async () => {
  // Regression this change introduced: the snapshot provably excludes a
  // mid-save edit, so clearing the dirty flag would discard the work AND
  // report it clean. ModifiedIndicator is the only unsaved-work signal in the
  // app — no beforeunload, no undo.
  freshState(makeRecipe('Dirty Flag'));
  SetRecipeModified(true);   // the user has unsaved edits and clicks Save
  const origHasRecipe = buttons.storage.hasRecipe;
  buttons.storage.hasRecipe = async () => { currentRecipe.Overrun = 0.99; return false; };
  await buttons.btnSaveRecipe.onclick();
  buttons.storage.hasRecipe = origHasRecipe;
  assert.equal(storageCalls.length, 1);
  assert.equal(storageCalls[0].data.Recipe.Overrun, 0.3);
  assert.equal(IsRecipeModified(), true, 'the excluded edit must still read as unsaved');

  // The clean case still clears it.
  freshState(makeRecipe('Clean Save'));
  SetRecipeModified(true);
  await buttons.btnSaveRecipe.onclick();
  assert.equal(IsRecipeModified(), false, 'an unraced save must clear the flag');
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
