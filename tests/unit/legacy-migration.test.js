// Tests for js/features/legacy-migration.js — draining the legacy population.
//
// Two of these pin defects that were live in the console script this replaces:
// "refuses to DOWNGRADE" and "keeps an existing SavedAt". The third property
// worth protecting is that a listing failure writes NOTHING, because a partial
// migration reports success and nobody runs it twice.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { migrateLegacyRecipes, migrationVerdict, MIGRATION_SUMMARY_KEY } =
  await import('../../js/features/legacy-migration.js');
const { RECIPE_SCHEMA_VERSION, containerRecipeId, mintRecipeId } =
  await import('../../js/models/recipe-serialization.js');

// --- Fixtures ---

const body = (name) => ({ Recipe: { Name: name, Ingredients: [] }, Ingredients: {} });
const legacy = (name) => ({ name, data: body(name) });
const identified = (name, id) => ({
  name,
  data: { SchemaVersion: RECIPE_SCHEMA_VERSION, RecipeId: id, ...body(name) },
});

function store(records, { listThrows = false, loadThrows = false, saveResult = true } = {}) {
  const writes = [];
  return {
    writes,
    async listRecipesStrict() {
      if (listThrows) throw new Error('IndexedDB exploded');
      return records.map(r => ({ name: r.name }));
    },
    async loadRecipe(name) {
      if (loadThrows) throw new Error('read error');
      return records.find(r => r.name === name) ?? null;
    },
    async saveRecipe(rec) {
      if (saveResult === 'throw') throw new Error('write error');
      writes.push(rec);
      return saveResult;
    },
  };
}

const seq = () => { let n = 0; return () => `id-${++n}`; };
const NOW = '2026-08-16T12:00:00.000Z';

// --- The happy path ---

test('gives every legacy record an identity and leaves identified ones alone', async () => {
  const s = store([legacy('Vanilla'), identified('Pistachio', 'keep-me'), legacy('Chocolate')]);
  const r = await migrateLegacyRecipes({ storage: s, mint: seq(), now: () => NOW });

  assert.equal(r.migrated.length, 2);
  assert.deepEqual(r.migrated.map(m => m.name), ['Vanilla', 'Chocolate']);
  assert.equal(r.alreadyIdentified, 1);
  assert.deepEqual(r.skipped, []);

  assert.equal(s.writes.length, 2, 'the identified record must not be rewritten');
  for (const w of s.writes) {
    assert.equal(w.data.SchemaVersion, RECIPE_SCHEMA_VERSION);
    assert.ok(containerRecipeId(w.data), 'the written body must pass the id reader, not just carry a field');
    assert.equal(w.data.SavedAt, NOW);
    assert.deepEqual(w.data.Recipe.Ingredients, [], 'the body must survive intact');
  }
});

test('is idempotent — a second run has nothing to do', async () => {
  const records = [legacy('Vanilla')];
  const s = store(records);
  await migrateLegacyRecipes({ storage: s, mint: seq(), now: () => NOW });
  records[0] = { name: 'Vanilla', data: s.writes[0].data };

  const again = await migrateLegacyRecipes({ storage: s, mint: seq(), now: () => NOW });
  assert.equal(again.migrated.length, 0);
  assert.equal(again.alreadyIdentified, 1);
  assert.equal(s.writes.length, 1, 'no second write');
});

test('mints a DISTINCT id per record — one id for two recipes would fuse them', async () => {
  const s = store([legacy('A'), legacy('B'), legacy('C')]);
  const r = await migrateLegacyRecipes({ storage: s, mint: mintRecipeId, now: () => NOW });
  const ids = new Set(r.migrated.map(m => m.id));
  assert.equal(ids.size, 3);
});

// --- The two defects the console script carried ---

test('REFUSES TO DOWNGRADE a record from a newer build', async () => {
  // The console script stamped SchemaVersion 2 unconditionally, so an id-less
  // record written by a FUTURE build would be rewritten down to this schema,
  // silently dropping whatever the newer fields were.
  const future = { name: 'F', data: { SchemaVersion: RECIPE_SCHEMA_VERSION + 1, ...body('F') } };
  const s = store([future]);
  const r = await migrateLegacyRecipes({ storage: s, mint: seq(), now: () => NOW });

  assert.equal(s.writes.length, 0, 'nothing may be written over a newer record');
  assert.equal(r.migrated.length, 0);
  assert.equal(r.skipped.length, 1);
  assert.match(r.skipped[0].reason, /newer version/);
});

test('a GARBAGE SchemaVersion is skipped, and NOT blamed on a newer version', async () => {
  // containerSchemaVersion maps garbage to Infinity to fail closed, so it
  // rides the same guard as a genuinely newer record — but reporting it as
  // "written by a newer version" would send the user to update an app that
  // is already current, over a record that is simply damaged. Same split the
  // save path draws between newerSchemaMessage and invalidContainerMessage.
  for (const garbage of [true, {}, '', NaN]) {
    const s = store([{ name: 'G', data: { SchemaVersion: garbage, ...body('G') } }]);
    const r = await migrateLegacyRecipes({ storage: s, mint: seq(), now: () => NOW });
    assert.equal(s.writes.length, 0, `garbage ${JSON.stringify(garbage)} must not be written over`);
    assert.equal(r.skipped.length, 1);
    assert.match(r.skipped[0].reason, /damaged|unrecognizable/,
      `garbage ${JSON.stringify(garbage)} must not be reported as a newer version`);
  }
});

test('a nameless listing entry is COUNTED as skipped, not dropped', async () => {
  // Dropped silently, the verdict could say "nothing to do" while the legacy
  // count that enabled the button stayed non-zero.
  const s = store([]);
  s.listRecipesStrict = async () => [{ name: '' }, { name: null }, {}];
  const r = await migrateLegacyRecipes({ storage: s, mint: seq(), now: () => NOW });

  assert.equal(r.skipped.length, 3);
  assert.equal(r.migrated.length, 0);
  assert.equal(s.writes.length, 0);
});

test('keeps an EXISTING SavedAt — it is the clock sync orders by', async () => {
  // A v2 record stripped of its id still carries the author clock. Restamping
  // it with "now" would make this device win against a genuinely newer edit
  // on another one.
  const stripped = {
    name: 'S',
    data: { SchemaVersion: RECIPE_SCHEMA_VERSION, SavedAt: '2020-01-01T00:00:00.000Z', ...body('S') },
  };
  const s = store([stripped]);
  await migrateLegacyRecipes({ storage: s, mint: seq(), now: () => NOW });

  assert.equal(s.writes[0].data.SavedAt, '2020-01-01T00:00:00.000Z');
});

test('a GARBAGE SavedAt is replaced rather than carried forward', async () => {
  const s = store([{ name: 'S', data: { SavedAt: 'last tuesday', ...body('S') } }]);
  await migrateLegacyRecipes({ storage: s, mint: seq(), now: () => NOW });
  assert.equal(s.writes[0].data.SavedAt, NOW);
});

// --- Failure handling ---

test('a listing failure writes NOTHING and says so', async () => {
  const s = store([legacy('A')], { listThrows: true });
  const r = await migrateLegacyRecipes({ storage: s, mint: seq(), now: () => NOW });

  assert.equal(r.listingFailed, true);
  assert.equal(r.ran, false);
  assert.equal(s.writes.length, 0);
  assert.match(migrationVerdict(r).message, /could not be read/);
});

test('one unreadable record does not abort the rest', async () => {
  const s = store([{ name: 'Bad', data: null }, legacy('Good')]);
  const r = await migrateLegacyRecipes({ storage: s, mint: seq(), now: () => NOW });

  assert.equal(r.migrated.length, 1);
  assert.equal(r.migrated[0].name, 'Good');
  assert.equal(r.skipped.length, 1);
  assert.equal(r.skipped[0].name, 'Bad');
});

test('a load error is skipped, not thrown', async () => {
  const s = store([legacy('A')], { loadThrows: true });
  const r = await migrateLegacyRecipes({ storage: s, mint: seq(), now: () => NOW });
  assert.equal(r.skipped.length, 1);
  assert.equal(r.migrated.length, 0);
});

test('a failed write is reported as skipped, never as migrated', async () => {
  for (const saveResult of [false, 'throw']) {
    const s = store([legacy('A')], { saveResult });
    const r = await migrateLegacyRecipes({ storage: s, mint: seq(), now: () => NOW });
    assert.equal(r.migrated.length, 0, `saveResult=${saveResult}`);
    assert.equal(r.skipped.length, 1);
  }
});

test('a damaged body is refused by the gate rather than written', async () => {
  const s = store([{ name: 'D', data: { Recipe: null } }]);
  const r = await migrateLegacyRecipes({ storage: s, mint: seq(), now: () => NOW });
  assert.equal(s.writes.length, 0);
  assert.equal(r.skipped.length, 1);
});

test('no storage at all is reported, not treated as an empty library', async () => {
  const r = await migrateLegacyRecipes({ storage: null });
  assert.equal(r.ran, false);
  assert.equal(r.listingFailed, false);
  assert.match(migrationVerdict(r).message, /unavailable/);
});

test('survives being called with nothing', async () => {
  const r = await migrateLegacyRecipes();
  assert.equal(r.ran, false);
  assert.deepEqual(r.migrated, []);
});

// --- Dry run ---

test('DRY RUN reports what would change and writes nothing', async () => {
  const s = store([legacy('A'), legacy('B')]);
  const r = await migrateLegacyRecipes({ storage: s, mint: seq(), now: () => NOW, dryRun: true });

  assert.equal(r.migrated.length, 2);
  assert.equal(s.writes.length, 0);
  assert.match(migrationVerdict(r).message, /Would give/);
});

// --- The verdict ---

test('VERDICT: skips downgrade the verdict to a warning', async () => {
  const s = store([legacy('A'), { name: 'Bad', data: null }]);
  const r = await migrateLegacyRecipes({ storage: s, mint: seq(), now: () => NOW });
  const v = migrationVerdict(r);
  assert.equal(v.level, 'warn');
  assert.match(v.message, /1 skipped/);
});

test('VERDICT: an all-identified device says there is nothing to do', async () => {
  const r = await migrateLegacyRecipes({ storage: store([identified('A', 'a')]), now: () => NOW });
  const v = migrationVerdict(r);
  assert.equal(v.level, 'ok');
  assert.match(v.message, /already has an identity/);
});

test('VERDICT: an empty device does not claim recipes were identified', async () => {
  const r = await migrateLegacyRecipes({ storage: store([]) });
  assert.match(migrationVerdict(r).message, /no recipes on this device/);
});

test('the summary key is namespaced so it cannot collide with app state', () => {
  assert.match(MIGRATION_SUMMARY_KEY, /^iceEd\./);
});
