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
const { initRecipeManager, initRecipeButtons, getRecipeStack, SetRecipeModified, IsRecipeModified,
  setCurrentRecipeIdentity, getCurrentRecipeIdentity, RestoreBackup, BackupRecipe } =
  await import('../../js/features/recipe-manager.js');
const { containerRecipeId, isValidRecipeId } =
  await import('../../js/models/recipe-serialization.js');

// --- Wiring, mirroring app.js ---

let currentRecipe = new cRecipe('');
const messages = { info: [], warning: [], error: [] };
const cloudPushes = [];
let storageCalls = [];
// A real (tiny) record store, keyed by name — the save path now READS records
// (target lookup + identity scan), so a boolean hasRecipe stub can no longer
// model it. saveRecipe persists here exactly like IndexedDB's put.
let storageRecords = {};
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
  loadRecipe: async (name) => storageRecords[name] ?? null,
  listRecipes: async () => Object.keys(storageRecords).map((name) => ({ name })),
  saveRecipe: async (rec) => {
    storageCalls.push(rec);
    if (storageSaveResult) storageRecords[rec.name] = rec;
    return storageSaveResult;
  },
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
  storageRecords = {};
  storageSaveResult = true;
  setCurrentRecipeIdentity(null);   // identity is module state — reset like the stack
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
  storageRecords['Existing'] = { name: 'Existing', data: { Recipe: { Name: 'Existing' }, Ingredients: {} } };
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
  const origLoadRecipe = buttons.storage.loadRecipe;
  // try/finally so a failing assertion cannot leak the mutating stub into
  // every later test in the file (review finding — the leak turns one failure
  // into an order-dependent cascade that hides the real one). The mutation
  // now rides the target-lookup await, the save path's first.
  try {
    buttons.storage.loadRecipe = async () => {
      currentRecipe.Name = 'Mango V2.2';   // the rename that used to fork the key
      currentRecipe.Overrun = 0.99;
      currentRecipe.addIngredient('Sugar', 999);
      return null;
    };
    await buttons.btnSaveRecipe.onclick();
  } finally {
    buttons.storage.loadRecipe = origLoadRecipe;
  }

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
  const origLoadRecipe = buttons.storage.loadRecipe;
  try {
    buttons.storage.loadRecipe = async () => { currentRecipe.Overrun = 0.99; return null; };
    await buttons.btnSaveRecipe.onclick();
  } finally {
    buttons.storage.loadRecipe = origLoadRecipe;
  }
  assert.equal(storageCalls.length, 1);
  assert.equal(storageCalls[0].data.Recipe.Overrun, 0.3);
  assert.equal(IsRecipeModified(), true, 'the excluded edit must still read as unsaved');

  // The clean case still clears it.
  freshState(makeRecipe('Clean Save'));
  SetRecipeModified(true);
  await buttons.btnSaveRecipe.onclick();
  assert.equal(IsRecipeModified(), false, 'an unraced save must clear the flag');
});

test('STALE BINDING: a recipe swap during the save cannot clear the NEW recipe\'s flag', async () => {
  // Red-team finding: clearModifiedIfUnchanged compares the handler-captured
  // recipe, but the modified flag is one GLOBAL bit describing whichever
  // recipe is current. Swap recipes inside the save's await (New Recipe /
  // Restore / a completing library load all call setRecipe synchronously),
  // edit the new one, and the resolving save would compare the OLD unchanged
  // object to its own snapshot and clear the flag for work it never saved.
  freshState(makeRecipe('Old One'));
  const origLoadRecipe = buttons.storage.loadRecipe;
  try {
    buttons.storage.loadRecipe = async () => {
      const swapped = makeRecipe('Brand New');   // the swap, mid-await
      swapped.Overrun = 0.77;                    // ...with unsaved edits
      currentRecipe = swapped;
      SetRecipeModified(true);
      return null;
    };
    await buttons.btnSaveRecipe.onclick();
  } finally {
    buttons.storage.loadRecipe = origLoadRecipe;
  }
  assert.equal(storageCalls.length, 1);
  assert.equal(storageCalls[0].name, 'Old One');  // the save itself is fine
  assert.equal(IsRecipeModified(), true,
    'the flag belongs to the CURRENT recipe, whose edits were never saved');
  // Same guard, same reason, for identity: the minted id belongs to the
  // record just written, and the OPEN recipe is a different one now.
  assert.equal(getCurrentRecipeIdentity(), null,
    'a swapped-in recipe must not adopt the old save\'s id');
});

test('a recipe that will not JSON-serialize keeps the modified flag after a successful save', async () => {
  // The catch branch in clearModifiedIfUnchanged was an invariant stated only
  // in a comment (review finding). The branch is reachable: structuredClone
  // preserves cycles, so a cyclic recipe snapshots and SAVES fine, then
  // JSON.stringify(liveRecipe) throws in the comparison. Unprovable-unchanged
  // must fail toward keep-flag-set.
  freshState(makeRecipe('Cyclic'));
  currentRecipe.Self = currentRecipe;
  SetRecipeModified(true);
  await buttons.btnSaveRecipe.onclick();
  assert.equal(storageCalls.length, 1, 'the save itself must succeed');
  assert.equal(IsRecipeModified(), true, 'unprovable-unchanged must keep the flag set');
});

test('a RangeError from snapshotting reports the nesting message and writes nothing', async () => {
  // One of snapshotForSave's three error classifications (review finding: the
  // dispatch had zero coverage, so a regression in the instanceof chain kept
  // every test green).
  const r = makeRecipe('Deep');
  let p = r;
  for (let i = 0; i < 200000; i++) { p.Next = {}; p = p.Next; }
  freshState(r);
  await buttons.btnSaveRecipe.onclick();
  assert.equal(storageCalls.length, 0);
  assert.equal(cloudPushes.length, 0);
  assert.match(messages.error[0], /nested too deeply/);
  assert.match(messages.error[0], /Nothing was saved or exported/);
});

test('a missing structuredClone reports the browser-feature message and writes nothing', async () => {
  const orig = globalThis.structuredClone;
  try {
    globalThis.structuredClone = undefined;
    freshState(makeRecipe('NoClone'));
    await buttons.btnSaveRecipe.onclick();
    assert.equal(storageCalls.length, 0);
    assert.match(messages.error[0], /structuredClone/);
    assert.match(messages.error[0], /Nothing was saved or exported/);
  } finally {
    globalThis.structuredClone = orig;
  }
});

// --- P0.3 T2: identity through the REAL handlers ---

test('P0.3: first save MINTS an id; re-saving the same record KEEPS it', async () => {
  // The T1 interim pin (RecipeId absent) flipped here, as designed: T2 wires
  // minting, so every record the save path emits is identified.
  freshState(makeRecipe('Minted'));
  await buttons.btnSaveRecipe.onclick();
  const first = storageCalls[0].data;
  assert.equal(typeof first.SavedAt, 'string');
  assert.ok(Number.isFinite(Date.parse(first.SavedAt)), 'SavedAt must be a parseable clock');
  assert.ok(isValidRecipeId(first.RecipeId), 'first save must mint');
  assert.equal(containerRecipeId(first), first.RecipeId);
  assert.equal(getCurrentRecipeIdentity(), first.RecipeId, 'the open recipe adopts the minted id');

  // Save again under the same name: the target is my own record → KEEP.
  await buttons.btnSaveRecipe.onclick();
  assert.equal(storageCalls[1].data.RecipeId, first.RecipeId,
    're-saving my own record must not re-mint');
});

test('P0.3 DECISION 6: save-as-new-name is a COPY and mints — the old record keeps its id', async () => {
  // The mainline flow (Mango V2.1 -> V2.2). Without the mint, two records
  // carry one id and the id space is corrupt before sync ever joins on it
  // (outside-voice finding that merged P0.6's guards into this cut).
  freshState(makeRecipe('Mango V2.1'));
  await buttons.btnSaveRecipe.onclick();
  const idV21 = storageCalls[0].data.RecipeId;

  currentRecipe.Name = 'Mango V2.2';           // the routine rename
  await buttons.btnSaveRecipe.onclick();
  const idV22 = storageCalls[1].data.RecipeId;

  assert.ok(isValidRecipeId(idV22));
  assert.notEqual(idV22, idV21, 'the copy must mint its own id');
  assert.equal(containerRecipeId(storageRecords['Mango V2.1'].data), idV21,
    'the old record keeps its identity');
  assert.equal(getCurrentRecipeIdentity(), idV22, 'the open recipe is now the V2.2 record');
});

test('P0.3 SCAN INTEGRITY: a listed record the scan cannot READ forces a mint', async () => {
  // Review finding: the real backends never throw — they catch internally and
  // return []/null — so the fail-toward-mint catch was unreachable. A record
  // that is IN the list but unreadable means the scan is blind to a possible
  // carrier of my id; keeping would risk one id on two records.
  freshState(makeRecipe('Mango V2.2'));
  storageRecords['Mango V2.1'] = { name: 'Mango V2.1', data: { SchemaVersion: 2, RecipeId: 'id-a', Recipe: { Name: 'Mango V2.1' }, Ingredients: {} } };
  setCurrentRecipeIdentity('id-a');
  const origLoadRecipe = buttons.storage.loadRecipe;
  try {
    // Target lookup (V2.2) truthfully null; the V2.1 read is broken.
    buttons.storage.loadRecipe = async () => null;
    await buttons.btnSaveRecipe.onclick();
  } finally {
    buttons.storage.loadRecipe = origLoadRecipe;
  }
  const saved = storageCalls[0].data;
  assert.ok(isValidRecipeId(saved.RecipeId));
  assert.notEqual(saved.RecipeId, 'id-a', 'an unverifiable scan must mint, never keep');
});

test('P0.3 MINT FALLBACK: minting works without crypto.randomUUID (insecure contexts)', async () => {
  // crypto.randomUUID exists only in secure contexts; over plain http on a
  // LAN it is undefined and the throw would kill Save as a silent unhandled
  // rejection (review finding). The fallback mints the same UUIDv4 shape via
  // getRandomValues, which exists everywhere.
  const orig = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(globalThis.crypto), 'randomUUID')
    || Object.getOwnPropertyDescriptor(globalThis.crypto, 'randomUUID');
  const target = Object.getOwnPropertyDescriptor(globalThis.crypto, 'randomUUID') ? globalThis.crypto : Object.getPrototypeOf(globalThis.crypto);
  try {
    Object.defineProperty(target, 'randomUUID', { value: undefined, configurable: true });
    freshState(makeRecipe('Insecure Context'));
    await buttons.btnSaveRecipe.onclick();
    const saved = storageCalls[0].data;
    assert.ok(isValidRecipeId(saved.RecipeId), 'a save must still mint');
    assert.match(saved.RecipeId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      'the fallback keeps the UUIDv4 shape so ids mix freely');
  } finally {
    Object.defineProperty(target, 'randomUUID', orig);
  }
});

test('P0.3: an identity that arrived by import round-trips through its first local save', async () => {
  // The KEEP half of the mint rule: no other local record carries this id, so
  // this save is the first local materialization of an existing identity —
  // minting here would fork the lineage on every device-to-device .ier hop.
  freshState(makeRecipe('Traveler'));
  setCurrentRecipeIdentity('id-from-another-device');
  await buttons.btnSaveRecipe.onclick();
  assert.equal(storageCalls[0].data.RecipeId, 'id-from-another-device');
});

test('P0.3 DECISION 6: overwriting a DIFFERENT identified recipe re-prompts with the real stakes', async () => {
  // The name-only prompt let "Overwrite?" silently destroy another recipe's
  // identity and history (review finding). My old record still carries my id,
  // so the save also MINTS — one id never lands on two records.
  freshState(makeRecipe('Taken'));
  storageRecords['Mine'] = { name: 'Mine', data: { SchemaVersion: 2, RecipeId: 'id-mine', Recipe: { Name: 'Mine' }, Ingredients: {} } };
  storageRecords['Taken'] = { name: 'Taken', data: { SchemaVersion: 2, RecipeId: 'id-victim', Recipe: { Name: 'Taken' }, Ingredients: {} } };
  setCurrentRecipeIdentity('id-mine');
  const prompts = [];
  globalThis.confirm = (msg) => { prompts.push(msg); return true; };

  await buttons.btnSaveRecipe.onclick();
  assert.equal(prompts.length, 1);
  assert.match(prompts[0], /DIFFERENT recipe/);
  assert.match(prompts[0], /permanently replace/);
  const saved = storageCalls[0].data;
  assert.ok(isValidRecipeId(saved.RecipeId));
  assert.notEqual(saved.RecipeId, 'id-mine', 'record "Mine" still carries id-mine — this is a copy');
  assert.notEqual(saved.RecipeId, 'id-victim', 'the victim\'s identity is not silently reused');
});

test('T2.5 DECISION 6 AMENDED: a confirmed different-id overwrite KEEPS my id when nothing else carries it', async () => {
  // The import-collision case (cross-model KEEP verdict): my recipe IS id-a,
  // arrived by .ier, nothing local carries it. The target's identity dies
  // with its record either way; minting would only disconnect MY batch
  // history and make the future sync join manufacture duplicates.
  freshState(makeRecipe('Taken'));
  storageRecords['Taken'] = { name: 'Taken', data: { SchemaVersion: 2, RecipeId: 'id-victim', Recipe: { Name: 'Taken' }, Ingredients: {} } };
  setCurrentRecipeIdentity('id-a');
  const prompts = [];
  globalThis.confirm = (msg) => { prompts.push(msg); return true; };
  await buttons.btnSaveRecipe.onclick();
  assert.match(prompts[0], /DIFFERENT recipe/);
  assert.equal(storageCalls[0].data.RecipeId, 'id-a', 'identity follows the recipe');
});

test('T2.5 1a: an UNIDENTIFIED recipe replacing an identified target gets the strong prompt', async () => {
  // The guard used to require BOTH ids, which produced the weak prompt
  // exactly when an identified recipe's history was about to be destroyed by
  // a nameless one (codex finding 1a).
  freshState(makeRecipe('Occupied'));
  storageRecords['Occupied'] = { name: 'Occupied', data: { SchemaVersion: 2, RecipeId: 'id-holder', Recipe: { Name: 'Occupied' }, Ingredients: {} } };
  const prompts = [];
  globalThis.confirm = (msg) => { prompts.push(msg); return true; };
  await buttons.btnSaveRecipe.onclick();
  assert.equal(prompts.length, 1);
  assert.match(prompts[0], /DIFFERENT recipe/);
  const saved = storageCalls[0].data;
  assert.ok(isValidRecipeId(saved.RecipeId));            // minted (no id at click)
  assert.notEqual(saved.RecipeId, 'id-holder');
});

test('T2.5 DECISION 11: importing a file whose id lives in the library prompts, keyed by id', async () => {
  // OK → load AS that recipe (adopt the id). Cancel → independent copy
  // (identity null; mint at next save).
  const fileFor = (name) => JSON.stringify({
    id: 'IER', version: 1,
    data: { SchemaVersion: 2, RecipeId: 'id-shared', Recipe: { Name: name, Ingredients: [] }, Ingredients: {} },
  });
  freshState(new cRecipe(''));
  storageRecords['Home Name'] = { name: 'Home Name', data: { SchemaVersion: 2, RecipeId: 'id-shared', Recipe: { Name: 'Home Name' }, Ingredients: {} } };
  const prompts = [];
  globalThis.confirm = (msg) => { prompts.push(msg); return true; };
  try {
    buttons.inputLoadRecipe.onchange({ target: { files: [makeFile(fileFor('Traveler'))] } });
  } catch { /* render-time throw in stub DOM */ }
  await new Promise((r) => setTimeout(r, 0));   // the import scan is async
  assert.equal(prompts.length, 1);
  assert.match(prompts[0], /same recipe as "Home Name"/);
  assert.equal(getCurrentRecipeIdentity(), 'id-shared', 'OK adopts the identity');

  freshState(new cRecipe(''));
  storageRecords['Home Name'] = { name: 'Home Name', data: { SchemaVersion: 2, RecipeId: 'id-shared', Recipe: { Name: 'Home Name' }, Ingredients: {} } };
  globalThis.confirm = () => false;             // Cancel: independent copy
  try {
    buttons.inputLoadRecipe.onchange({ target: { files: [fileForCancel()] } });
  } catch { /* render-time throw in stub DOM */ }
  function fileForCancel() { return makeFile(fileFor('Traveler Copy')); }
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(getCurrentRecipeIdentity(), null, 'Cancel means copy semantics — mint at next save');
});

test('T2.6: re-importing your OWN export (carrier has the file\'s name) adopts silently — no prompt', async () => {
  // T2.5-review finding: the decision-11 prompt fired for a file whose
  // carrier IS the same-named library record — a confusing "same recipe as
  // Mango" confirm on re-importing Mango — and its Cancel branch armed the
  // destructive different-id overwrite prompt against the user's own
  // record at the next save. Same name + same id is trivially the same
  // recipe: adopt, no question.
  freshState(new cRecipe(''));
  storageRecords['Mango'] = { name: 'Mango', data: { SchemaVersion: 2, RecipeId: 'id-mango', Recipe: { Name: 'Mango' }, Ingredients: {} } };
  const prompts = [];
  globalThis.confirm = (msg) => { prompts.push(msg); return true; };
  const file = JSON.stringify({
    id: 'IER', version: 1,
    data: { SchemaVersion: 2, RecipeId: 'id-mango', Recipe: { Name: 'Mango', Ingredients: [] }, Ingredients: {} },
  });
  try {
    buttons.inputLoadRecipe.onchange({ target: { files: [makeFile(file)] } });
  } catch { /* render-time throw in stub DOM */ }
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(prompts.length, 0, 'a same-named carrier must not prompt');
  assert.equal(getCurrentRecipeIdentity(), 'id-mango', 'the identity is adopted, not lost to copy semantics');
  assert.equal(currentRecipe.Name, 'Mango');
});

test('T2.6: edits made while the import identity scan is pending land in the BACKUP', async () => {
  // T2.5-review finding: the old shape took the backup BEFORE the scan's
  // awaits, so a keystroke landing during the scan mutated a recipe that
  // was already snapshotted and was then discarded by setRecipe — lost from
  // both sides. The backup now happens after the last await.
  freshState(makeRecipe('Mid Edit'));
  // A populated library forces the scan to actually await storage reads.
  storageRecords['Elsewhere'] = { name: 'Elsewhere', data: { SchemaVersion: 2, RecipeId: 'id-other', Recipe: { Name: 'Elsewhere' }, Ingredients: {} } };
  const identified = JSON.stringify({
    id: 'IER', version: 1,
    data: { SchemaVersion: 2, RecipeId: 'id-incoming', Recipe: { Name: 'Incoming', Ingredients: [] }, Ingredients: {} },
  });
  try {
    buttons.inputLoadRecipe.onchange({ target: { files: [makeFile(identified)] } });
  } catch { /* render-time throw in stub DOM */ }
  // The scan is in flight; the user keeps typing.
  currentRecipe.Notes = 'edited while the scan was pending';
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(currentRecipe.Name, 'Incoming', 'the import itself still lands');
  assert.equal(getRecipeStack()['Mid Edit'].Recipe.Notes, 'edited while the scan was pending',
    'the backup snapshots the recipe as it was at mutation time, not at file-pick time');
});

test('T2.6: BackupRecipe backs up the PASSED recipe under the PASSED identity', () => {
  // T2.5-review finding: the body re-read getRecipe() and module identity
  // state, so a caller passing any other recipe would silently have backed
  // up the current recipe under the current id — the identity-hijack class
  // finding 7 closed, waiting to recur through the exported signature.
  freshState(makeRecipe('On Screen'));
  setCurrentRecipeIdentity('id-current');
  const other = makeRecipe('Someone Else');
  BackupRecipe(other, 'id-other');
  const stack = getRecipeStack();
  assert.ok(stack['Someone Else'], 'the passed recipe is what lands on the stack');
  assert.equal(stack['Someone Else'].Identity, 'id-other', 'with the passed identity, not module state');
  assert.equal(stack['On Screen'], undefined, 'the current recipe was not backed up instead');

  // T2.6 follow-up review: backing up never mutates the caller's object —
  // an empty-named recipe gets its generated name on the stacked COPY only.
  const unnamed = makeRecipe('');
  BackupRecipe(unnamed, null);
  assert.equal(unnamed.Name, '', 'the passed object is never renamed in place');
  const generated = Object.keys(stack).find((k) => k !== 'Someone Else');
  assert.ok(generated && generated !== '', 'the stacked copy carries the generated name');
  assert.equal(stack[generated].Recipe.Name, generated);
});

test('T2.6: the Modified flag clears with the recipe swap, even when the render refresh throws', async () => {
  // Follow-up review: SetRecipeModified is state, not display. In the old
  // order a render throw skipped it, so the pristine imported recipe wore
  // the previous recipe's Modified=true — and the next same-name import
  // would spuriously route through the destructive replace modal. The stub
  // DOM's render throw is exactly the case this pin needs.
  freshState(makeRecipe('Before'));
  SetRecipeModified(true);
  const file = JSON.stringify({
    id: 'IER', version: 1,
    data: { SchemaVersion: 2, RecipeId: 'id-swap', Recipe: { Name: 'After', Ingredients: [] }, Ingredients: {} },
  });
  try {
    buttons.inputLoadRecipe.onchange({ target: { files: [makeFile(file)] } });
  } catch { /* render-time throw in stub DOM */ }
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(currentRecipe.Name, 'After');
  assert.equal(IsRecipeModified(), false,
    'the flag belongs to the state block — a display failure must not preserve it');
});

test('T2.6: a throw while APPLYING the import is reported, not swallowed', () => {
  // Follow-up review: finishLoad reports its own failures, but a throw in
  // the backup/stack phase before it used to escape with only a console
  // line — the user picks a file, the picker closes, nothing happens.
  freshState(new cRecipe(''));
  currentRecipe = {};   // no Ingredients array: the backup phase throws
  const legacy = JSON.stringify({
    id: 'IER', version: 1,
    data: { Recipe: { Name: 'Legacy', Ingredients: [] }, Ingredients: {} },
  });
  try {
    buttons.inputLoadRecipe.onchange({ target: { files: [makeFile(legacy)] } });
  } catch { /* must NOT reach here — the path reports instead */ }
  assert.ok(messages.error.some((m) => /could not be imported/.test(m)),
    'the apply failure reaches ErrorMsg');
});

test('T2.5 FINDING 7: restore returns the BACKED-UP identity, not whatever is current', async () => {
  // Save First (mints id-first), import Traveler (adopts id-traveled) — the
  // import auto-backs-up First WITH its identity — then restore First: the
  // identity must come back with it, not stay id-traveled (which would let
  // First's next save hijack Traveler's lineage).
  freshState(makeRecipe('First'));
  await buttons.btnSaveRecipe.onclick();
  const idFirst = storageCalls[0].data.RecipeId;

  const traveler = JSON.stringify({
    id: 'IER', version: 1,
    data: { SchemaVersion: 2, RecipeId: 'id-traveled', Recipe: { Name: 'Traveler', Ingredients: [{ Name: 'Milk', Amount: 1 }] }, Ingredients: {} },
  });
  try {
    buttons.inputLoadRecipe.onchange({ target: { files: [makeFile(traveler)] } });
  } catch { /* render-time throw in stub DOM */ }
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(getCurrentRecipeIdentity(), 'id-traveled');

  try {
    RestoreBackup('First');
  } catch { /* render-time throw in stub DOM; identity already restored */ }
  assert.equal(currentRecipe.Name, 'First');
  assert.equal(getCurrentRecipeIdentity(), idFirst,
    'the restored recipe carries ITS identity, not the imported one');
});

test('P0.3: overwriting my OWN record under its name uses the ordinary prompt and keeps the id', async () => {
  freshState(makeRecipe('Same'));
  storageRecords['Same'] = { name: 'Same', data: { SchemaVersion: 2, RecipeId: 'id-same', Recipe: { Name: 'Same' }, Ingredients: {} } };
  setCurrentRecipeIdentity('id-same');
  const prompts = [];
  globalThis.confirm = (msg) => { prompts.push(msg); return true; };

  await buttons.btnSaveRecipe.onclick();
  assert.equal(prompts.length, 1);
  assert.doesNotMatch(prompts[0], /DIFFERENT/);
  assert.equal(storageCalls[0].data.RecipeId, 'id-same');
});

test('P0.3: a NEWER-schema record cannot be overwritten by this build\'s save', async () => {
  // The never-truncate rule applied to the one local path that writes without
  // loading (review finding, red team). Fail-closed, loud, nothing written.
  freshState(makeRecipe('Future'));
  storageRecords['Future'] = { name: 'Future', data: { SchemaVersion: 99, Recipe: { Name: 'Future' }, Ingredients: {} } };
  await buttons.btnSaveRecipe.onclick();
  assert.equal(storageCalls.length, 0);
  assert.equal(cloudPushes.length, 0);
  assert.match(messages.error[0], /newer version/);
});

test('P0.3: New Recipe clears the open identity — the next save mints fresh', async () => {
  freshState(makeRecipe('Original'));
  await buttons.btnSaveRecipe.onclick();
  assert.ok(getCurrentRecipeIdentity());
  try {
    buttons.btnNewRecipe.onclick();
  } catch { /* render-time throw in stub DOM; the clear already happened */ }
  assert.equal(getCurrentRecipeIdentity(), null,
    'a new recipe must not inherit the previous record\'s identity');
});

test('P0.3: .ier import ADOPTS the file\'s identity; a v2 file with no id warns and adopts null', async () => {
  // Identified file → the recipe on screen IS that record.
  freshState(new cRecipe(''));
  const identified = JSON.stringify({
    id: 'IER', version: 1,
    data: { SchemaVersion: 2, RecipeId: 'id-traveled', Recipe: { Name: 'Arrived', Ingredients: [] }, Ingredients: {} },
  });
  try {
    buttons.inputLoadRecipe.onchange({ target: { files: [makeFile(identified)] } });
  } catch { /* render-time throw in stub DOM; adoption already happened */ }
  await new Promise((r) => setTimeout(r, 0));   // identified files scan async (T2.5)
  assert.equal(currentRecipe.Name, 'Arrived');
  assert.equal(getCurrentRecipeIdentity(), 'id-traveled');

  // Stripped/no-id v2 file → decision 7: load, warn, identity null (re-mints
  // at the next save).
  freshState(new cRecipe(''));
  const stripped = JSON.stringify({
    id: 'IER', version: 1,
    data: { SchemaVersion: 2, Recipe: { Name: 'Stripped', Ingredients: [] }, Ingredients: {} },
  });
  try {
    buttons.inputLoadRecipe.onchange({ target: { files: [makeFile(stripped)] } });
  } catch { /* render-time throw in stub DOM */ }
  assert.equal(currentRecipe.Name, 'Stripped');
  assert.equal(getCurrentRecipeIdentity(), null);
  assert.ok(messages.warning.some((w) => /identity/.test(w)), 'the strip must be visible, not silent');
});

test('P0.3: export carries the open identity but NEVER mints one', async () => {
  // Identified recipe → the id travels in the .ier file.
  freshState(makeRecipe('Carry'));
  setCurrentRecipeIdentity('id-carry');
  buttons.btnExportRecipe.onclick();
  const envelope = JSON.parse(await capturedBlobs[0].text());
  assert.equal(envelope.data.RecipeId, 'id-carry');

  // Unsaved recipe → no id in the file (mint happens at SAVE, in one place);
  // the file warns on import, which is honest: it has no identity yet.
  freshState(makeRecipe('Unminted'));
  buttons.btnExportRecipe.onclick();
  const envelope2 = JSON.parse(await capturedBlobs[capturedBlobs.length - 1].text());
  assert.equal('RecipeId' in envelope2.data, false);
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
