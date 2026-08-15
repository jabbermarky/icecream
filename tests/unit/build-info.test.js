// Tests for js/features/build-info.js — the Info & FAQ diagnostics.
//
// The bug this module exists to prevent: app.js hardcoded VERSION = "0.4.0 beta"
// while package.json said 0.5.0, so a deployed build reported a version two
// releases old and nobody could tell what was actually running. The first test
// below is the guard — it fails the lane the moment the two drift again.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { APP_VERSION, collectBuildInfo, buildInfoVerdict } =
  await import('../../js/features/build-info.js');
const { RECIPE_SCHEMA_VERSION } =
  await import('../../js/models/recipe-serialization.js');

// --- The single-source guard ---

test('APP_VERSION matches package.json — the drift that caused this', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(APP_VERSION, pkg.version,
    'build-info.js APP_VERSION and package.json disagree — package.json is the single source');
});

// --- Fixtures ---

const v2 = (name, id) => ({
  name,
  data: {
    SchemaVersion: 2,
    ...(id ? { RecipeId: id } : {}),
    Recipe: { Name: name, Ingredients: [] },
    Ingredients: {},
  },
});
const legacy = (name) => ({ name, data: { Recipe: { Name: name, Ingredients: [] }, Ingredients: {} } });

function store(records, { listThrows = false, loadThrows = false } = {}) {
  return {
    async listRecipesStrict() {
      if (listThrows) throw new Error('IndexedDB exploded');
      return records.map(r => ({ name: r.name }));
    },
    async loadRecipe(name) {
      if (loadThrows) throw new Error('read error');
      return records.find(r => r.name === name) ?? null;
    },
  };
}

// --- Counting ---

test('counts identified, legacy and total separately', async () => {
  const info = await collectBuildInfo({
    storage: store([v2('A', 'id-a'), v2('B', 'id-b'), legacy('Old')]),
    getIngredients: () => ({ Milk: {}, Sugar: {} }),
  });

  assert.equal(info.recipes.total, 3);
  assert.equal(info.recipes.identified, 2);
  assert.equal(info.recipes.legacy, 1);
  assert.equal(info.recipes.unreadable, 0);
  assert.equal(info.recipes.newer, 0);
  assert.equal(info.ingredients, 2);
  assert.equal(info.version, APP_VERSION);
  assert.equal(info.schemaVersion, RECIPE_SCHEMA_VERSION);
});

test('a record from a NEWER build is counted as newer, not unreadable', async () => {
  // The stale-cache detector. Version-relative so a schema bump cannot
  // invalidate the fixture.
  const future = { name: 'F', data: { SchemaVersion: RECIPE_SCHEMA_VERSION + 1, Recipe: { Name: 'F' }, Ingredients: {} } };
  const info = await collectBuildInfo({ storage: store([future]) });

  assert.equal(info.recipes.newer, 1);
  assert.equal(info.recipes.unreadable, 0);
  assert.equal(info.recipes.legacy, 0);
});

test('GARBAGE SchemaVersion is unreadable, not newer', async () => {
  // containerSchemaVersion maps garbage to Infinity (fail closed), so without a
  // finite check every corrupt record would masquerade as "from a newer build"
  // and send the user chasing a cache problem they do not have.
  for (const garbage of [true, NaN, '', {}]) {
    const info = await collectBuildInfo({
      storage: store([{ name: 'G', data: { SchemaVersion: garbage, Recipe: { Name: 'G' }, Ingredients: {} } }]),
    });
    assert.equal(info.recipes.newer, 0, `garbage ${JSON.stringify(garbage)} must not count as newer`);
    assert.equal(info.recipes.unreadable, 1);
  }
});

test('a damaged record counts as unreadable and does not abort the survey', async () => {
  const info = await collectBuildInfo({
    storage: store([v2('Good', 'id-g'), { name: 'Bad', data: { Recipe: null } }]),
  });
  assert.equal(info.recipes.identified, 1);
  assert.equal(info.recipes.unreadable, 1);
});

test('a load error counts as unreadable rather than throwing', async () => {
  const info = await collectBuildInfo({ storage: store([v2('A', 'id-a')], { loadThrows: true }) });
  assert.equal(info.recipes.unreadable, 1);
  assert.equal(info.listingFailed, false);
});

// --- Failure reporting ---

test('a failed listing reports listingFailed, NOT zero recipes', async () => {
  // Reporting 0 would read as "your library is empty" — the most alarming
  // possible rendering of a transient storage error.
  const info = await collectBuildInfo({ storage: store([], { listThrows: true }) });
  assert.equal(info.listingFailed, true);
  assert.equal(info.recipes.total, 0);
  assert.match(buildInfoVerdict(info).message, /could not be read/);
});

test('no storage at all is reported, not treated as an empty library', async () => {
  const info = await collectBuildInfo({ storage: null });
  assert.equal(info.storageAvailable, false);
  assert.match(buildInfoVerdict(info).message, /unavailable/);
});

test('collectBuildInfo survives being called with nothing', async () => {
  const info = await collectBuildInfo();
  assert.equal(info.version, APP_VERSION);
  assert.equal(info.storageAvailable, false);
});

// --- The verdict ---

test('VERDICT: newer records outrank everything and name the hard reload', async () => {
  const info = await collectBuildInfo({
    storage: store([
      { name: 'F', data: { SchemaVersion: RECIPE_SCHEMA_VERSION + 1, Recipe: { Name: 'F' }, Ingredients: {} } },
      legacy('Old'),
    ]),
  });
  const verdict = buildInfoVerdict(info);
  assert.equal(verdict.level, 'warn');
  assert.match(verdict.message, /NEWER version/);
  assert.match(verdict.message, /Shift\+R/, 'must tell the user how to fix it');
});

test('VERDICT: legacy records are info, not a warning — they still load', async () => {
  const info = await collectBuildInfo({ storage: store([legacy('Old'), v2('A', 'id-a')]) });
  const verdict = buildInfoVerdict(info);
  assert.equal(verdict.level, 'info');
  assert.match(verdict.message, /1 recipe/);
  assert.match(verdict.message, /next time you save/);
});

test('VERDICT: a clean device says so', async () => {
  const info = await collectBuildInfo({ storage: store([v2('A', 'id-a')]) });
  assert.equal(buildInfoVerdict(info).level, 'ok');
});
