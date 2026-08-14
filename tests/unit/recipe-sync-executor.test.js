// Tests for js/storage/recipe-sync-executor.js — the storage-facing half of
// recipe sync (P0.3 T4). The join module's decision matrix is covered by
// recipe-sync-join.test.js; this file drives the EXECUTION contract with
// stub stores: strict listings abort the plan (rule 1), a failed write skips
// all deletes (rule 2), writes land on the correct store in plan order, and
// the pushRecipe fetch shapes the cloud record exactly as decideRecipePush's
// caller contract requires.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  collectSyncRecords,
  executeRecipeSyncPlan,
  runRecipeSync,
  fetchCloudRecordForPush,
  executeGatedPush,
} = await import('../../js/storage/recipe-sync-executor.js');
const { SYNC_WARNINGS } = await import('../../js/storage/recipe-sync-join.js');

// --- Fixtures ---

const T1 = '2026-08-14T10:00:00.000Z';
const T2 = '2026-08-14T11:00:00.000Z';

/** A well-formed v2 container. */
function v2(name, { id = null, savedAt = T1 } = {}) {
  const c = { SchemaVersion: 2, Recipe: { Name: name, Ingredients: [] }, Ingredients: {} };
  if (id) c.RecipeId = id;
  if (savedAt) c.SavedAt = savedAt;
  return c;
}

/**
 * A stub store recording every call.
 * `bodies` maps name → container body; an Error value makes loadRecipe throw
 * for that name; a missing name makes it return null (not found).
 * `saveResult`/`deleteResult` may be a value, an Error (thrown), or a
 * function of the argument.
 */
function stubStore({ listing = [], bodies = {}, failList = false, saveResult = true, deleteResult = true } = {}) {
  const calls = { saves: [], deletes: [], loads: [] };
  return {
    calls,
    async listRecipesStrict() {
      if (failList) throw new Error('listing failed');
      return listing;
    },
    async loadRecipe(name) {
      calls.loads.push(name);
      const b = bodies[name];
      if (b instanceof Error) throw b;
      return b === undefined ? null : { name, updatedAt: T1, data: b };
    },
    async saveRecipe(recipe) {
      calls.saves.push(recipe);
      if (saveResult instanceof Error) throw saveResult;
      return typeof saveResult === 'function' ? saveResult(recipe) : saveResult;
    },
    async deleteRecipe(name) {
      calls.deletes.push(name);
      if (deleteResult instanceof Error) throw deleteResult;
      return typeof deleteResult === 'function' ? deleteResult(name) : deleteResult;
    },
  };
}

function entry(name, updatedAt = T1) {
  return { name, updatedAt };
}

// --- collectSyncRecords ---

test('T4: collect pairs each listing entry with its downloaded body', async () => {
  const body = v2('A', { id: 'id-1' });
  const store = stubStore({ listing: [entry('A', T2)], bodies: { A: body } });
  const records = await collectSyncRecords(store);
  assert.deepEqual(records, [{ name: 'A', updatedAt: T2, data: body }]);
});

test('T4: a body that fails to load becomes data: null — skips the record, not the sync', async () => {
  const store = stubStore({
    listing: [entry('A'), entry('B')],
    bodies: { A: new Error('read failed'), B: v2('B') },
  });
  const records = await collectSyncRecords(store);
  assert.equal(records[0].data, null);
  assert.deepEqual(records[1].data, v2('B'));
});

test('T4: a listed record whose load returns null (deleted mid-sync) is data: null', async () => {
  const store = stubStore({ listing: [entry('gone')], bodies: {} });
  const records = await collectSyncRecords(store);
  assert.deepEqual(records, [{ name: 'gone', updatedAt: T1, data: null }]);
});

test('T4: collect — a loaded record with no data field becomes data: null, not undefined', async () => {
  const store = {
    async listRecipesStrict() { return [entry('A')]; },
    async loadRecipe(name) { return { name, updatedAt: T1 }; },
  };
  const records = await collectSyncRecords(store);
  assert.deepEqual(records, [{ name: 'A', updatedAt: T1, data: null }]);
});

// --- Rule 1: listing failure aborts the plan ---

test('T4: a failed LOCAL listing aborts before any write, tagged with its side', async () => {
  const local = stubStore({ failList: true });
  const cloud = stubStore({ listing: [entry('A')], bodies: { A: v2('A') } });
  await assert.rejects(
    runRecipeSync({ localStore: local, cloudStore: cloud }),
    (e) => e.code === 'SYNC_LISTING_FAILED' && e.side === 'local');
  assert.equal(local.calls.saves.length, 0);
  assert.equal(cloud.calls.saves.length, 0);
  assert.equal(local.calls.deletes.length + cloud.calls.deletes.length, 0);
});

test('T4: a failed CLOUD listing aborts before any write, tagged with its side', async () => {
  const local = stubStore({ listing: [entry('A')], bodies: { A: v2('A') } });
  const cloud = stubStore({ failList: true });
  await assert.rejects(
    runRecipeSync({ localStore: local, cloudStore: cloud }),
    (e) => e.code === 'SYNC_LISTING_FAILED' && e.side === 'cloud');
  assert.equal(local.calls.saves.length, 0);
  assert.equal(cloud.calls.saves.length, 0);
});

test('T4: genuinely-empty listings are legal — empty plan, no failures', async () => {
  const local = stubStore();
  const cloud = stubStore();
  const { plan, execution } = await runRecipeSync({ localStore: local, cloudStore: cloud });
  assert.deepEqual(plan.actions, []);
  assert.deepEqual(execution.writeFailures, []);
  assert.equal(execution.deletesSkipped, false);
});

// --- End-to-end: plan lands on the right stores ---

test('T4: local-only pushes to cloud, cloud-only pulls to local', async () => {
  const localBody = v2('mine', { id: 'id-l' });
  const cloudBody = v2('theirs', { id: 'id-c' });
  const local = stubStore({ listing: [entry('mine')], bodies: { mine: localBody } });
  const cloud = stubStore({ listing: [entry('theirs')], bodies: { theirs: cloudBody } });
  const { execution } = await runRecipeSync({ localStore: local, cloudStore: cloud });
  assert.deepEqual(cloud.calls.saves, [{ name: 'mine', data: localBody }]);
  assert.deepEqual(local.calls.saves, [{ name: 'theirs', data: cloudBody }]);
  assert.equal(execution.pushed, 1);
  assert.equal(execution.pulled, 1);
});

test('T4: id-joined pair — the newer side overwrites the older on its own store only', async () => {
  const newer = v2('A', { id: 'id-1', savedAt: T2 });
  const older = v2('A', { id: 'id-1', savedAt: T1 });
  const local = stubStore({ listing: [entry('A')], bodies: { A: newer } });
  const cloud = stubStore({ listing: [entry('A')], bodies: { A: older } });
  const { execution } = await runRecipeSync({ localStore: local, cloudStore: cloud });
  assert.deepEqual(cloud.calls.saves, [{ name: 'A', data: newer }]);
  assert.equal(local.calls.saves.length, 0);
  assert.equal(execution.pushed, 1);
});

test('T4: an unreadable body blocks its name — no write, UNREADABLE warning surfaced in the plan', async () => {
  const local = stubStore({ listing: [entry('A')], bodies: { A: new Error('read failed') } });
  const cloud = stubStore({ listing: [entry('A')], bodies: { A: v2('A', { id: 'id-1' }) } });
  const { plan, execution } = await runRecipeSync({ localStore: local, cloudStore: cloud });
  assert.equal(local.calls.saves.length, 0);
  assert.equal(cloud.calls.saves.length, 0);
  assert.ok(plan.warnings.some((w) => w.code === SYNC_WARNINGS.UNREADABLE && w.side === 'local'));
  assert.equal(execution.pushed + execution.pulled, 0);
});

test('T4: a rename executes its write before its stale-key delete, on the loser side', async () => {
  // Same id, local renamed to B and newer: plan = push B to cloud, delete cloud A.
  const renamed = v2('B', { id: 'id-1', savedAt: T2 });
  const stale = v2('A', { id: 'id-1', savedAt: T1 });
  const local = stubStore({ listing: [entry('B')], bodies: { B: renamed } });
  const cloud = stubStore({ listing: [entry('A')], bodies: { A: stale } });
  const { execution } = await runRecipeSync({ localStore: local, cloudStore: cloud });
  assert.deepEqual(cloud.calls.saves, [{ name: 'B', data: renamed }]);
  assert.deepEqual(cloud.calls.deletes, ['A']);
  assert.equal(local.calls.deletes.length, 0);
  assert.equal(execution.deleted, 1);
});

// --- Rule 2: any failed write skips ALL deletes ---

test('T4: a write that returns false records a failure and skips every delete', async () => {
  const renamed = v2('B', { id: 'id-1', savedAt: T2 });
  const stale = v2('A', { id: 'id-1', savedAt: T1 });
  const local = stubStore({ listing: [entry('B')], bodies: { B: renamed } });
  const cloud = stubStore({ listing: [entry('A')], bodies: { A: stale }, saveResult: false });
  const { execution } = await runRecipeSync({ localStore: local, cloudStore: cloud });
  assert.deepEqual(execution.writeFailures, [{ op: 'push', name: 'B' }]);
  assert.equal(execution.deletesSkipped, true);
  assert.equal(cloud.calls.deletes.length, 0);
  assert.equal(local.calls.deletes.length, 0);
});

test('T4: a write that THROWS is a failure, not an abort — remaining writes still run, deletes skipped', async () => {
  const plan = {
    actions: [
      { op: 'push', name: 'A', data: v2('A') },
      { op: 'pull', name: 'B', data: v2('B') },
      { op: 'delete', target: 'cloud', name: 'old' },
    ],
  };
  const local = stubStore();
  const cloud = stubStore({ saveResult: new Error('quota') });
  const result = await executeRecipeSyncPlan(plan, { localStore: local, cloudStore: cloud });
  assert.deepEqual(result.writeFailures, [{ op: 'push', name: 'A' }]);
  assert.equal(result.pulled, 1, 'the pull after the failed push still executed');
  assert.equal(result.deletesSkipped, true);
  assert.equal(cloud.calls.deletes.length, 0);
});

test('T4: a save resolving to a non-true value counts as a failure (the #12 discard-false class)', async () => {
  const plan = { actions: [{ op: 'push', name: 'A', data: v2('A') }] };
  const local = stubStore();
  const cloud = stubStore({ saveResult: () => undefined });
  const result = await executeRecipeSyncPlan(plan, { localStore: local, cloudStore: cloud });
  assert.deepEqual(result.writeFailures, [{ op: 'push', name: 'A' }]);
});

test('T4: delete failures are recorded per delete and do not stop the remaining deletes', async () => {
  const plan = {
    actions: [
      { op: 'delete', target: 'cloud', name: 'one' },
      { op: 'delete', target: 'local', name: 'two' },
    ],
  };
  const local = stubStore();
  const cloud = stubStore({ deleteResult: false });
  const result = await executeRecipeSyncPlan(plan, { localStore: local, cloudStore: cloud });
  assert.deepEqual(result.deleteFailures, [{ name: 'one', target: 'cloud' }]);
  assert.deepEqual(local.calls.deletes, ['two']);
  assert.equal(result.deleted, 1);
  assert.equal(result.deletesSkipped, false);
});

// --- fetchCloudRecordForPush: decideRecipePush's caller contract ---

test('T4: push fetch — absent record is null (the allow shape)', async () => {
  const cloud = stubStore({ bodies: {} });
  assert.equal(await fetchCloudRecordForPush(cloud, 'new-name'), null);
});

test('T4: push fetch — an existing readable record passes through with its body', async () => {
  const body = v2('A', { id: 'id-1' });
  const cloud = stubStore({ bodies: { A: body } });
  const record = await fetchCloudRecordForPush(cloud, 'A');
  assert.deepEqual(record, { name: 'A', updatedAt: T1, data: body });
});

test('T4: push fetch — a lookup that throws returns the unreadable shape, which the gate refuses', async () => {
  const cloud = {
    async loadRecipe() { throw new Error('network'); },
  };
  const record = await fetchCloudRecordForPush(cloud, 'A');
  assert.deepEqual(record, { name: 'A', data: null });
});

test('T4: push fetch — a record with no data field is the unreadable shape, not the allow shape', async () => {
  const cloud = {
    async loadRecipe(name) { return { name, updatedAt: T1 }; },
  };
  const record = await fetchCloudRecordForPush(cloud, 'A');
  assert.equal(record.data, null);
});

// --- executeGatedPush: the gate is consulted and refusals perform no write ---

test('T4: gated push — absent cloud name saves and reports pushed', async () => {
  const cloud = stubStore({ bodies: {} });
  const result = await executeGatedPush(cloud, { name: 'new', data: v2('new', { id: 'id-1' }) });
  assert.deepEqual(result, { pushed: true, warning: null });
  assert.equal(cloud.calls.saves.length, 1);
});

test('T4: gated push — a refusing verdict performs NO cloud save and returns the warning', async () => {
  // Identified cloud record, id-less pushed body: the legacy-conflict refusal.
  const cloud = stubStore({ bodies: { A: v2('A', { id: 'id-1' }) } });
  const legacyBody = { Recipe: { Name: 'A', Ingredients: [] }, Ingredients: {} };
  const result = await executeGatedPush(cloud, { name: 'A', data: legacyBody });
  assert.equal(result.pushed, false);
  assert.equal(result.warning.code, SYNC_WARNINGS.LEGACY_CONFLICT);
  assert.equal(cloud.calls.saves.length, 0, 'refusal must not write');
});

test('T4: gated push — divergent identities refuse without writing', async () => {
  const cloud = stubStore({ bodies: { A: v2('A', { id: 'id-cloud' }) } });
  const result = await executeGatedPush(cloud, { name: 'A', data: v2('A', { id: 'id-local' }) });
  assert.equal(result.pushed, false);
  assert.equal(result.warning.code, SYNC_WARNINGS.DIVERGENT_IDENTITIES);
  assert.equal(cloud.calls.saves.length, 0);
});

test('T4: gated push — an allowed write that fails (false or throw) is pushed:false, no warning', async () => {
  const sameId = { name: 'A', data: v2('A', { id: 'id-1', savedAt: T2 }) };
  const falseCloud = stubStore({ bodies: { A: v2('A', { id: 'id-1', savedAt: T1 }) }, saveResult: false });
  assert.deepEqual(await executeGatedPush(falseCloud, sameId), { pushed: false, warning: null });
  const throwCloud = stubStore({ bodies: { A: v2('A', { id: 'id-1', savedAt: T1 }) }, saveResult: new Error('quota') });
  assert.deepEqual(await executeGatedPush(throwCloud, sameId), { pushed: false, warning: null });
});

test('T4: gated push — a lookup that throws refuses via the unreadable shape', async () => {
  const calls = { saves: [] };
  const cloud = {
    calls,
    async loadRecipe() { throw new Error('network'); },
    async saveRecipe(r) { calls.saves.push(r); return true; },
  };
  const result = await executeGatedPush(cloud, { name: 'A', data: v2('A', { id: 'id-1' }) });
  assert.equal(result.pushed, false);
  assert.equal(result.warning.code, SYNC_WARNINGS.UNREADABLE);
  assert.equal(calls.saves.length, 0);
});
