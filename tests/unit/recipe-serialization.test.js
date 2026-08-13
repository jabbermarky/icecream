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
  isValidRecipeId,
  containerRecipeId,
  containerSavedAt,
  containerIdentityWarning,
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

test('P0.5: the container is DETACHED from the live recipe, not a view onto it', () => {
  const r = makeRecipe();
  const c = buildRecipeContainer(r, library, () => {});
  assert.equal(c.SchemaVersion, RECIPE_SCHEMA_VERSION);
  assert.deepEqual(Object.keys(c.Ingredients).sort(), ['Milk', 'Sugar']);

  assert.notEqual(c.Recipe, r);                 // pre-P0.5 this WAS the live object
  assert.notEqual(c.Recipe.Ingredients, r.Ingredients);
  assert.equal(c.Recipe.Name, 'Test');          // ...but carries the same values
  assert.equal(c.Recipe.Notes, 'notes');
  assert.deepEqual(c.Recipe.Ingredients, [
    { Name: 'Milk', Amount: 500 },
    { Name: 'Sugar', Amount: 120 },
  ]);
});

test('P0.5: editing the recipe AFTER the build cannot reach the snapshot', () => {
  // The cloud-write race in one assertion. google-drive-storage.saveRecipe
  // awaits findFileByName before updateFile stringifies the payload; every
  // edit in that window used to land in the cloud copy.
  const r = makeRecipe();
  const c = buildRecipeContainer(r, library, () => {});

  r.Name = 'Renamed After Save';
  r.Overrun = 0.99;
  r.addIngredient('Cream', 200);

  assert.equal(c.Recipe.Name, 'Test');
  assert.equal(c.Recipe.Overrun, 0.3);
  assert.equal(c.Recipe.Ingredients.length, 2);
});

test('P0.5: the snapshot is DEEPLY frozen, so a late mutation throws instead of writing', () => {
  const c = buildRecipeContainer(makeRecipe(), library, () => {});
  assert.ok(Object.isFrozen(c));
  assert.ok(Object.isFrozen(c.Recipe));
  assert.ok(Object.isFrozen(c.Recipe.Ingredients));
  assert.ok(Object.isFrozen(c.Recipe.Ingredients[0]));  // array ELEMENTS too
  assert.ok(Object.isFrozen(c.Ingredients));
  assert.ok(Object.isFrozen(c.Ingredients.Milk));

  // Strict mode (every ES module): a write to a frozen object throws at the
  // line that does it rather than being dropped on the floor.
  assert.throws(() => { c.Recipe.Name = 'mutated'; }, TypeError);
  assert.throws(() => { c.Recipe.Ingredients.push({ Name: 'X', Amount: 1 }); }, TypeError);
  assert.throws(() => { c.Ingredients.Milk.Water = 0; }, TypeError);
  assert.throws(() => { c.SchemaVersion = 99; }, TypeError);
});

test('P0.5: cloning drops prototypes — plain objects, matching what every reader sees', () => {
  // Both backends round-trip through JSON or a structured clone, so a cRecipe
  // instance never survived persistence anyway. Pinned because hydrateRecipe
  // must keep working off a plain object.
  const c = buildRecipeContainer(makeRecipe(), library, () => {});
  assert.equal(c.Recipe instanceof cRecipe, false);
  assert.equal(Object.getPrototypeOf(c.Recipe), Object.prototype);
  assert.equal(Object.getPrototypeOf(c.Ingredients.Milk), Object.prototype);
  assert.equal(hydrateRecipe(c).Name, 'Test'); // still hydrates
});

test('P0.5: a self-referencing recipe freezes without hanging (cycle guard)', () => {
  // structuredClone PRESERVES cycles, so deepFreeze recursing naively would
  // never terminate. Not a shape the app produces; pinned so the guard is not
  // "simplified" away later.
  const r = makeRecipe();
  r.Self = r;
  const c = buildRecipeContainer(r, library, () => {});
  assert.ok(Object.isFrozen(c.Recipe));
  assert.ok(Object.isFrozen(c.Recipe.Self));
  assert.equal(c.Recipe.Self, c.Recipe); // cycle preserved by the clone
});

test('P0.5: an unclonable value THROWS rather than being dropped silently', () => {
  // JSON.stringify omits functions without a word. structuredClone refuses.
  // recipe-manager catches this and reports it; the module must not swallow it.
  const r = makeRecipe();
  r.Callback = () => {};
  assert.throws(() => buildRecipeContainer(r, library, () => {}));
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
  const built = buildRecipeContainer(makeRecipe(), library, () => {});
  // A fresh container, not a mutation of `built` — the snapshot is frozen.
  const c = { ...built, Recipe: { ...built.Recipe, FutureField: 'x' } };
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

// --- P0.5 freeze: what it does and does not guarantee (review findings) ---

test('REVERSAL (T1 review): typed arrays are REFUSED at snapshot time, loudly', () => {
  // This inverts the P0.5 pin that typed arrays pass through unfrozen. The
  // review showed JSON backends corrupt Uint8Array to {"0":1,...} silently
  // while IndexedDB stores it real — same record, two shapes, and sync then
  // overwrites the good copy. Not storable → refused like functions, so the
  // save path reports it and writes NOTHING to either backend.
  const r = makeRecipe();
  r.Thumbnail = new Uint8Array([1, 2, 3]);
  assert.throws(() => buildRecipeContainer(r, library, () => {}), TypeError);
  const r2 = makeRecipe();
  r2.Raw = new ArrayBuffer(8);
  assert.throws(() => buildRecipeContainer(r2, library, () => {}), TypeError);
});

test('P0.5 KNOWN LIMIT: Map/Set/Date contents stay mutable inside a "frozen" snapshot', () => {
  // deepFreeze walks Object.keys, which is empty for these, so their internals
  // are untouched. No recipe holds them today; pinned so the limit is a
  // recorded fact rather than a surprise, and so extending deepFreeze later
  // flips a test rather than silently changing behaviour.
  const r = makeRecipe();
  r.LastChurned = new Date(0);
  const c = buildRecipeContainer(r, library, () => {});
  assert.ok(Object.isFrozen(c.Recipe.LastChurned), 'marked frozen...');
  c.Recipe.LastChurned.setTime(99999);
  assert.equal(c.Recipe.LastChurned.getTime(), 99999, '...but its contents are not');
});

test('P0.5 HAZARD: an in-memory build -> hydrate round-trip yields an uneditable recipe', () => {
  // Documented in hydrateRecipe's JSDoc and previously untested. A future undo
  // or duplicate feature is the call pattern that hits it. When hydrateRecipe
  // starts cloning the array, invert this test rather than deleting it.
  const c = buildRecipeContainer(makeRecipe(), library, () => {});
  const h = hydrateRecipe(c);
  assert.ok(Object.isFrozen(h.Ingredients), 'hydration copies the frozen array by reference');
  assert.throws(() => h.addIngredient('Cream', 200), TypeError);
});

// --- FAIL CLOSED: the SchemaVersion type matrix (review finding, 3 passes) ---

test('a numeric-string NEWER SchemaVersion refuses at its numeric value — the bypass that shipped first', () => {
  // Originally pinned with the literal '2' when the current version was 1; the
  // fixture is relative now so the rule (numeric strings refuse as numbers,
  // not hydrate as v1) survives every version bump.
  const newer = String(RECIPE_SCHEMA_VERSION + 1);
  const c = { SchemaVersion: newer, Recipe: { Name: 'X', LineageId: 'abc' }, Ingredients: {} };
  assert.equal(containerSchemaVersion(c), RECIPE_SCHEMA_VERSION + 1);
  assert.equal(isNewerSchema(c), true);
  assert.equal(hydrateRecipe(c), null);
  assert.match(containerProblem(c), /newer version/); // truthful message, names the schema
  assert.match(containerProblem(c), new RegExp(`schema ${newer}`));
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
  assert.notEqual(invalidContainerMessage(),
    newerSchemaMessage({ SchemaVersion: RECIPE_SCHEMA_VERSION + 1 }));
  assert.doesNotMatch(invalidContainerMessage(), /newer version/);
});

// --- P0.3: identity in the container — RecipeId, SavedAt, and the advisory limit ---

test('P0.3: the schema version is 2 — identity ships behind a version bump', () => {
  // Absolute on purpose (everything else is relative): the refusal gate is
  // what protects RecipeId from pre-P0.3 clients, so the bump IS the feature.
  assert.equal(RECIPE_SCHEMA_VERSION, 2);
});

test('P0.3: the builder STAMPS a supplied RecipeId and always stamps SavedAt', () => {
  const before = Date.now();
  const c = buildRecipeContainer(makeRecipe(), library, () => {},
    { RecipeId: 'id-mango-v21' });
  const after = Date.now();

  assert.equal(c.RecipeId, 'id-mango-v21');
  const t = Date.parse(c.SavedAt);
  assert.ok(t >= before && t <= after, `SavedAt ${c.SavedAt} is the snapshot moment`);
  assert.ok(Object.isFrozen(c)); // identity fields are inside the frozen snapshot
  assert.throws(() => { c.RecipeId = 'clobbered'; }, TypeError);
});

test('P0.3: no identity supplied → a v2 container WITHOUT a RecipeId key', () => {
  // Legal, not an error: this is what an unidentified legacy recipe looks like
  // the instant before the save path mints. {RecipeId: null} means the same.
  for (const identity of [undefined, null, {}, { RecipeId: null }, { RecipeId: undefined }]) {
    const c = buildRecipeContainer(makeRecipe(), library, () => {}, identity);
    assert.equal('RecipeId' in c, false, `identity ${JSON.stringify(identity)} must omit the key`);
    assert.equal(typeof c.SavedAt, 'string'); // SavedAt is unconditional
  }
});

test('P0.3: a GARBAGE supplied RecipeId throws — a programmer error, not a data state', () => {
  // Minting is the save path's job (crypto.randomUUID()); handing the builder
  // a non-string or empty id is a bug and must fail at the line that did it.
  for (const bad of [42, '', '   ', {}, ['x'], true]) {
    assert.throws(() => buildRecipeContainer(makeRecipe(), library, () => {}, { RecipeId: bad }),
      TypeError, `RecipeId ${JSON.stringify(bad)} must throw`);
  }
});

test('P0.3: isValidRecipeId is strict on what string-equality joins cannot survive', () => {
  assert.equal(isValidRecipeId('abc'), true);
  assert.equal(isValidRecipeId(''), false);
  assert.equal(isValidRecipeId(42), false);
  // Whitespace forks: ' abc ' !== 'abc' under the join, so an untrimmed id in
  // a hand-edited file would silently fork the lineage. Treated as NO id
  // (load, warn, re-mint) — the fail-safe direction. Review finding.
  assert.equal(isValidRecipeId(' abc '), false);
  assert.equal(isValidRecipeId('abc\n'), false);
  // Unbounded ids from a hostile file must not be stamped into every future
  // save. 256 is far above any UUID and far below any payload.
  assert.equal(isValidRecipeId('x'.repeat(256)), true);
  assert.equal(isValidRecipeId('x'.repeat(257)), false);
});

test('P0.3: containerRecipeId honors ids from the identity schema (v2) on — not v1', () => {
  // Review finding: version-agnostic reading was wider than decision 1. A
  // crafted v1 .ier carrying a victim recipe's id could steer the future
  // id-keyed overwrite prompt at a record whose name appears nowhere in the
  // file. Identity is behind SchemaVersion 2, in reading as in writing.
  assert.equal(containerRecipeId({ SchemaVersion: 2, RecipeId: 'abc' }), 'abc');
  assert.equal(containerRecipeId({ RecipeId: 'abc' }), null);                    // no version = v1
  assert.equal(containerRecipeId({ SchemaVersion: 1, RecipeId: 'abc' }), null); // v1 explicit
  assert.equal(containerRecipeId({ SchemaVersion: 2 }), null);
  assert.equal(containerRecipeId({ SchemaVersion: 2, RecipeId: '' }), null);
  assert.equal(containerRecipeId({ SchemaVersion: 2, RecipeId: ' abc ' }), null);
  assert.equal(containerRecipeId({ SchemaVersion: 2, RecipeId: 42 }), null);
  assert.equal(containerRecipeId(null), null);
  assert.equal(containerRecipeId('not an object'), null);
});

test('P0.3: containerSavedAt returns a parseable clock or null — never a raw field', () => {
  // Review finding: the sync merge (T3) must never read container.SavedAt
  // raw. Date.parse of garbage is NaN, and NaN compares false BOTH ways — a
  // merge on the raw field silently picks a side. Null routes the caller to
  // the updatedAt fallback instead, the same shape as the id-first join.
  const good = new Date(0).toISOString();
  assert.equal(containerSavedAt({ SavedAt: good }), good);
  assert.equal(containerSavedAt({ SavedAt: 'banana' }), null);
  // Parseable-but-not-ISO refuses too (T2.5, outside-voice finding 10):
  // Date.parse of non-ISO strings is implementation-DEPENDENT, so a
  // hand-edited timestamp could order the same records differently on two
  // runtimes — the divergence this clock exists to kill.
  assert.equal(containerSavedAt({ SavedAt: 'Aug 13, 2026 10:00:00' }), null);
  assert.equal(containerSavedAt({ SavedAt: '13/08/2026' }), null);
  assert.equal(containerSavedAt({ SavedAt: 42 }), null);
  assert.equal(containerSavedAt({ SavedAt: '' }), null);
  assert.equal(containerSavedAt({}), null);
  assert.equal(containerSavedAt(null), null);
  // T2.6 (review of T2.5): the guard anchors to the full UTC toISOString
  // shape. A timezone-less date-time PASSES a prefix check but Date.parse
  // reads it as LOCAL time — the same string is a different instant on two
  // devices, so two runtimes would order the same pair of records
  // differently. Non-Z offsets parse consistently but break lexicographic
  // comparison of SavedAt strings. The builder only writes toISOString().
  assert.equal(containerSavedAt({ SavedAt: '2026-08-13T10:00' }), null);
  assert.equal(containerSavedAt({ SavedAt: '2026-08-13T10:00:00' }), null);
  assert.equal(containerSavedAt({ SavedAt: '2026-08-13T10:00:00.000' }), null);
  assert.equal(containerSavedAt({ SavedAt: '2026-08-13T10:00:00+05:00' }), null);
  assert.equal(containerSavedAt({ SavedAt: '2026-08-13T10:00:00Z' }), '2026-08-13T10:00:00Z');
  assert.equal(containerSavedAt({ SavedAt: '2026-08-13T10:00:00.5Z' }), '2026-08-13T10:00:00.5Z');
  // And the builder's own stamp round-trips through its own accessor.
  const c = buildRecipeContainer(makeRecipe(), library, () => {});
  assert.equal(containerSavedAt(c), c.SavedAt);
});

test('GATE DEPTH: Ingredients entry VALUES that would corrupt the library are refused', () => {
  // Review finding (two independent passes): importIngredients does
  // Object.assign(new cIngredient(), value) per entry, so a string value
  // spreads its characters into numeric keys and installs the result as a
  // live ingredient — the same corruption the top-level check closed, one
  // level down. The gate exists to run before that loop; it must see this.
  for (const bad of ['AAAA', 42, null, [1, 2], true]) {
    const c = { Recipe: { Name: 'X' }, Ingredients: { Cream: bad } };
    assert.equal(containerProblem(c), invalidContainerMessage(),
      `entry value ${JSON.stringify(bad)} must refuse`);
    assert.equal(hydrateRecipe(c), null);
  }
  // A well-formed sibling does not save a record with one bad entry.
  const mixed = { Recipe: { Name: 'X' }, Ingredients: { Milk: { Water: 0.87 }, Cream: 'AAAA' } };
  assert.equal(containerProblem(mixed), invalidContainerMessage());
});

test('GATE DEPTH: prototype-pollution-shaped Ingredients keys are refused', () => {
  // Review finding: a key of "__proto__"/"constructor"/"prototype" reaches an
  // assignment loop in importIngredients that would rewrite the target
  // object's prototype. JSON.parse creates "__proto__" as an OWN key, so the
  // fixture goes through JSON to match what a crafted .ier actually produces.
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const c = JSON.parse(`{"Recipe":{"Name":"X"},"Ingredients":{${JSON.stringify(key)}:{"Water":1}}}`);
    assert.equal(containerProblem(c), invalidContainerMessage(), `key ${key} must refuse`);
  }
  // The guard reads OWN keys only — a clean record still passes.
  assert.equal(containerProblem({ Recipe: { Name: 'X' }, Ingredients: { Milk: { Water: 1 } } }), null);
});

test('P0.3 DECISION 7: a v2 record with a missing id PASSES the fail-closed gate', () => {
  // The load-bearing pin of the whole warn-and-load decision: the payload is
  // intact, so the gate must not lock the user out of their own recipe.
  const stripped = { SchemaVersion: 2, Recipe: { Name: 'Stripped' }, Ingredients: {} };
  assert.equal(containerProblem(stripped), null);
  assert.equal(hydrateRecipe(stripped).Name, 'Stripped');
});

test('P0.3: containerIdentityWarning fires ONLY for a loadable v2+ record with no usable id', () => {
  // v2, no id → warn (loads anyway; the message says so and names the cost)
  const w = containerIdentityWarning({ SchemaVersion: 2, Recipe: { Name: 'S' }, Ingredients: {} });
  assert.match(w, /identity/);
  assert.match(w, /loaded normally/);
  assert.match(w, /next time you save/);
  // v2, garbage id → warn (same treatment as missing)
  for (const bad of ['', 42, {}]) {
    assert.ok(containerIdentityWarning(
      { SchemaVersion: 2, RecipeId: bad, Recipe: { Name: 'S' }, Ingredients: {} }),
      `garbage id ${JSON.stringify(bad)} must warn`);
  }
  // v2 with a valid id → silent
  assert.equal(containerIdentityWarning(
    { SchemaVersion: 2, RecipeId: 'abc', Recipe: { Name: 'S' }, Ingredients: {} }), null);
  // v1/legacy → silent, absence is what pre-identity records look like
  assert.equal(containerIdentityWarning({ Recipe: { Name: 'Old' }, Ingredients: {} }), null);
  assert.equal(containerIdentityWarning(
    { SchemaVersion: 1, Recipe: { Name: 'Old' }, Ingredients: {} }), null);
  // unloadable → silent: the REFUSAL message owns every unloadable case
  assert.equal(containerIdentityWarning({ SchemaVersion: 99, Recipe: {}, Ingredients: {} }), null);
  assert.equal(containerIdentityWarning(null), null);
});

test('P0.3: hydration NEVER copies identity onto the recipe (container-level by design)', () => {
  // Identity off cRecipe is what keeps it out of the declared-fields filter
  // and out of copyFrom's Object.assign — a copy inherits no id by construction.
  const c = buildRecipeContainer(makeRecipe(), library, () => {}, { RecipeId: 'id-1' });
  const h = hydrateRecipe(c);
  assert.equal(Object.prototype.hasOwnProperty.call(h, 'RecipeId'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(h, 'SavedAt'), false);
});

test('P0.3: identity survives the JSON round-trip both backends use', () => {
  const c = buildRecipeContainer(makeRecipe(), library, () => {}, { RecipeId: 'id-rt' });
  const back = JSON.parse(JSON.stringify(c));
  assert.equal(containerRecipeId(back), 'id-rt');
  assert.equal(back.SavedAt, c.SavedAt);
  assert.equal(containerProblem(back), null);
  assert.equal(containerIdentityWarning(back), null);
});
