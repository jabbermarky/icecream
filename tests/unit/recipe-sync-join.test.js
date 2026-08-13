// Tests for js/storage/recipe-sync-join.js — the pure sync decision core
// (P0.3 T3). The matrix comes from the design doc (decision 9 spec plus the
// failure-modes table): id/no-id on each side, duplicate ids on one side,
// dead id vs live name, SavedAt vs updatedAt, renames, the newer-schema
// guard, unreadable bodies, and the pushRecipe gate. Everything here is
// synchronous and storage-free by construction — that is the point of the
// extraction.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { planRecipeSync, decideRecipePush, SYNC_WARNINGS } =
  await import('../../js/storage/recipe-sync-join.js');
const { RECIPE_SCHEMA_VERSION } =
  await import('../../js/models/recipe-serialization.js');

// --- Fixtures ---

const T1 = '2026-08-13T10:00:00.000Z';
const T2 = '2026-08-13T11:00:00.000Z';
const T3 = '2026-08-13T12:00:00.000Z';

/** A well-formed v2 container. Pass savedAt: null for a v2 record without a clock. */
function v2(name, { id = null, savedAt = T1 } = {}) {
  const c = { SchemaVersion: 2, Recipe: { Name: name, Ingredients: [] }, Ingredients: {} };
  if (id) c.RecipeId = id;
  if (savedAt) c.SavedAt = savedAt;
  return c;
}

/** A legacy (v1) container: no schema field, no identity, no SavedAt. */
function v1(name) {
  return { Recipe: { Name: name, Ingredients: [] }, Ingredients: {} };
}

/** A record as the join receives it: list entry + downloaded body. */
function rec(name, data, updatedAt = T1) {
  return { name, updatedAt, data };
}

function ops(plan) {
  return plan.actions.map((a) => `${a.op}:${a.name}` + (a.target ? `@${a.target}` : ''));
}

function codes(plan) {
  return plan.warnings.map((w) => w.code);
}

// --- Id join: LWW on the SavedAt clock ---

test('T3: same id both sides — the newer SavedAt side wins, whichever direction', () => {
  const newerLocal = planRecipeSync(
    [rec('A', v2('A', { id: 'id-1', savedAt: T2 }))],
    [rec('A', v2('A', { id: 'id-1', savedAt: T1 }))]);
  assert.deepEqual(ops(newerLocal), ['push:A']);
  assert.equal(newerLocal.actions[0].reason, 'local-newer');
  assert.equal(newerLocal.stats.pairsById, 1);

  const newerCloud = planRecipeSync(
    [rec('A', v2('A', { id: 'id-1', savedAt: T1 }))],
    [rec('A', v2('A', { id: 'id-1', savedAt: T3 }))]);
  assert.deepEqual(ops(newerCloud), ['pull:A']);
  assert.equal(newerCloud.actions[0].data.SavedAt, T3, 'the WINNER body is what gets written');
});

test('T3: equal clocks — no action, counted as unchanged', () => {
  const plan = planRecipeSync(
    [rec('A', v2('A', { id: 'id-1', savedAt: T1 }))],
    [rec('A', v2('A', { id: 'id-1', savedAt: T1 }))]);
  assert.deepEqual(plan.actions, []);
  assert.equal(plan.stats.unchanged, 1);
  assert.deepEqual(plan.warnings, []);
});

test('T3: SavedAt outranks updatedAt when BOTH sides carry one — the storage clock lies', () => {
  // updatedAt says cloud is newer (a sync copy re-stamped it); SavedAt knows
  // the local record is the later authored one. Decision 8: SavedAt wins.
  const plan = planRecipeSync(
    [rec('A', v2('A', { id: 'id-1', savedAt: T2 }), T1)],
    [rec('A', v2('A', { id: 'id-1', savedAt: T1 }), T3)]);
  assert.deepEqual(ops(plan), ['push:A']);
});

test('T3: updatedAt is the fallback when either side lacks SavedAt', () => {
  // Local v2 has SavedAt, cloud legacy does not → the comparison drops to
  // updatedAt for BOTH (comparing SavedAt to updatedAt would compare an
  // author clock to a write clock — meaningless).
  const plan = planRecipeSync(
    [rec('A', v2('A', { id: null, savedAt: T1 }), T1)],
    [rec('A', v1('A'), T2)]);
  assert.deepEqual(ops(plan), ['pull:A']);
  assert.equal(plan.stats.pairsByName, 1);
});

test('T3: a garbage updatedAt loses deterministically instead of silently picking a side', () => {
  const plan = planRecipeSync(
    [rec('A', v1('A'), 'not a date')],
    [rec('A', v1('A'), T1)]);
  assert.deepEqual(ops(plan), ['pull:A']);
});

// --- Renames: the id join is what makes them visible ---

test('T3: same id, different names — the winner\'s name propagates and the stale key is deleted AFTER the write', () => {
  const plan = planRecipeSync(
    [rec('Mango V2', v2('Mango V2', { id: 'id-1', savedAt: T2 }))],
    [rec('Mango', v2('Mango', { id: 'id-1', savedAt: T1 }))]);
  assert.deepEqual(ops(plan), ['push:Mango V2', 'delete:Mango@cloud']);
  assert.equal(plan.actions[1].reason, 'renamed');
  assert.equal(plan.stats.deleted, 1);
});

test('T3: a freed rename key can be claimed by a one-sided copy — deletes stay ordered before singles', () => {
  // Cloud "Mango"(id-1) was renamed locally to "Mango V2"; local ALSO has an
  // unrelated new "Mango"(id-2) that does not exist in the cloud. The stale
  // delete must run before the single push so the new Mango survives.
  const plan = planRecipeSync(
    [rec('Mango V2', v2('Mango V2', { id: 'id-1', savedAt: T2 })),
     rec('Mango', v2('Mango', { id: 'id-2', savedAt: T1 }))],
    [rec('Mango', v2('Mango', { id: 'id-1', savedAt: T1 }))]);
  assert.deepEqual(ops(plan), ['push:Mango V2', 'delete:Mango@cloud', 'push:Mango']);
});

test('T3: a rename landing on a name a DIFFERENT record holds is refused, both left untouched', () => {
  // Local renamed id-1 to "Mango", but the cloud already has a different
  // recipe called "Mango" (id-3). Writing would destroy the third lineage.
  const plan = planRecipeSync(
    [rec('Mango', v2('Mango', { id: 'id-1', savedAt: T3 }))],
    [rec('Mango Old', v2('Mango Old', { id: 'id-1', savedAt: T1 })),
     rec('Mango', v2('Mango', { id: 'id-3', savedAt: T1 }))]);
  assert.ok(codes(plan).includes(SYNC_WARNINGS.NAME_COLLISION));
  // Nothing may touch either Mango; the id-3 cloud Mango is ALSO not pulled,
  // because its local name slot belongs to the refused rename.
  assert.deepEqual(plan.actions.filter((a) => a.name === 'Mango' || a.name === 'Mango Old'), []);
});

// --- Name fallback and identity divergence ---

test('T3: legacy no-id records on both sides join by name — plain LWW', () => {
  const plan = planRecipeSync(
    [rec('A', v1('A'), T2)],
    [rec('A', v1('A'), T1)]);
  assert.deepEqual(ops(plan), ['push:A']);
  assert.equal(plan.stats.pairsByName, 1);
});

test('T3: dead id vs live name — same name, two different ids, NEVER merged', () => {
  const plan = planRecipeSync(
    [rec('A', v2('A', { id: 'id-old', savedAt: T3 }))],
    [rec('A', v2('A', { id: 'id-new', savedAt: T1 }))]);
  assert.deepEqual(plan.actions, [], 'no write in either direction, however the clocks lean');
  assert.deepEqual(codes(plan), [SYNC_WARNINGS.DIVERGENT_IDENTITIES]);
  assert.equal(plan.stats.skipped, 1);
});

test('T3: one-sided records copy across — including identified ones with no counterpart', () => {
  const plan = planRecipeSync(
    [rec('Local Only', v2('Local Only', { id: 'id-l' }))],
    [rec('Cloud Only', v1('Cloud Only'))]);
  assert.deepEqual(ops(plan).sort(), ['pull:Cloud Only', 'push:Local Only']);
  assert.equal(plan.stats.pushed, 1);
  assert.equal(plan.stats.pulled, 1);
});

// --- Duplicate ids on one side (pre-guard records) ---

test('T3: duplicate ids on one side — deterministic representative, others blocked and reported', () => {
  // Two local records carry id-1 (written before the mint guards). The newer
  // one represents the id in the join; the older is excluded, blocks its
  // name, and the duplication is surfaced.
  const plan = planRecipeSync(
    [rec('Newer', v2('Newer', { id: 'id-1', savedAt: T2 })),
     rec('Older', v2('Older', { id: 'id-1', savedAt: T1 }))],
    [rec('Newer', v2('Newer', { id: 'id-1', savedAt: T3 })),
     rec('Older', v1('Older'), T3)]);
  assert.ok(codes(plan).includes(SYNC_WARNINGS.DUPLICATE_ID));
  assert.deepEqual(ops(plan), ['pull:Newer'], 'the representative joins; the excluded record moves nothing');
  // The cloud's same-named "Older" must NOT clobber the excluded local one.
  assert.equal(plan.actions.some((a) => a.name === 'Older'), false);
});

test('T3: duplicate-id tie on the clock breaks by name, ascending — fully deterministic', () => {
  const plan = planRecipeSync(
    [rec('B-name', v2('B-name', { id: 'id-1', savedAt: T1 })),
     rec('A-name', v2('A-name', { id: 'id-1', savedAt: T1 }))],
    []);
  const dup = plan.warnings.find((w) => w.code === SYNC_WARNINGS.DUPLICATE_ID);
  assert.equal(dup.name, 'B-name', 'A-name wins the tie and B-name is the reported duplicate');
  assert.deepEqual(ops(plan), ['push:A-name'], 'only the representative copies');
});

// --- The newer-schema guard ---

test('T3: a newer-schema record is NEVER overwritten, in either direction, even when it loses the clock', () => {
  const v3local = { SchemaVersion: RECIPE_SCHEMA_VERSION + 1, RecipeId: 'id-1', SavedAt: T1, Recipe: { Name: 'A' } };
  const plan = planRecipeSync(
    [rec('A', v3local)],
    [rec('A', v2('A', { id: 'id-1', savedAt: T3 }))]);
  assert.deepEqual(plan.actions, []);
  assert.deepEqual(codes(plan), [SYNC_WARNINGS.NEWER_SCHEMA]);
});

test('T3: a newer-schema record that WINS the clock copies faithfully — it is a blob, not garbage', () => {
  const v3cloud = { SchemaVersion: RECIPE_SCHEMA_VERSION + 1, RecipeId: 'id-1', SavedAt: T3, Recipe: { Name: 'A' } };
  const plan = planRecipeSync(
    [rec('A', v2('A', { id: 'id-1', savedAt: T1 }))],
    [rec('A', v3cloud)]);
  assert.deepEqual(ops(plan), ['pull:A']);
  assert.equal(plan.actions[0].data, v3cloud, 'the body passes through untouched');
});

test('T3: a newer-schema one-sided record still copies across', () => {
  const v3 = { SchemaVersion: RECIPE_SCHEMA_VERSION + 1, RecipeId: 'id-x', SavedAt: T1, Recipe: { Name: 'Future' } };
  const plan = planRecipeSync([], [rec('Future', v3)]);
  assert.deepEqual(ops(plan), ['pull:Future']);
});

// --- Unreadable bodies: no partial overwrites ---

test('T3: a record whose body could not be read blocks its name — the other side must not clobber it', () => {
  const plan = planRecipeSync(
    [rec('A', v2('A'), T3)],
    [rec('A', null)]);   // download failed
  assert.deepEqual(plan.actions, [], 'A is not pushed over the unreadable cloud copy');
  assert.deepEqual(codes(plan), [SYNC_WARNINGS.UNREADABLE]);
  assert.equal(plan.stats.skipped, 1);
});

test('T3: a malformed body at an understood schema is unreadable; the rest of the plan proceeds', () => {
  const plan = planRecipeSync(
    [rec('Broken', { SchemaVersion: 2, Recipe: 'not an object' }),
     rec('Fine', v2('Fine', { id: 'id-f' }))],
    []);
  assert.deepEqual(ops(plan), ['push:Fine']);
  assert.deepEqual(codes(plan), [SYNC_WARNINGS.UNREADABLE]);
});

// --- Empty and trivial inputs ---

test('T3: empty inputs plan nothing and warn nothing', () => {
  const plan = planRecipeSync([], []);
  assert.deepEqual(plan.actions, []);
  assert.deepEqual(plan.warnings, []);
});

// --- decideRecipePush: the fire-and-forget gate ---

test('T3 PUSH GATE: absent cloud record allows; same or missing identity allows', () => {
  const mine = { name: 'A', data: v2('A', { id: 'id-1' }) };
  assert.equal(decideRecipePush(mine, null).allow, true);
  assert.equal(decideRecipePush(mine, rec('A', v2('A', { id: 'id-1' }))).allow, true);
  assert.equal(decideRecipePush(mine, rec('A', v1('A'))).allow, true, 'a legacy cloud copy is mine to update');
  const unidentified = { name: 'A', data: v2('A') };
  assert.equal(decideRecipePush(unidentified, rec('A', v2('A', { id: 'id-1' }))).allow, true,
    'an id-less push is the save path\'s business — the join cannot rule on it');
});

test('T3 PUSH GATE: a newer-schema cloud record refuses the push, with a warning', () => {
  const mine = { name: 'A', data: v2('A', { id: 'id-1' }) };
  const future = rec('A', { SchemaVersion: RECIPE_SCHEMA_VERSION + 1, Recipe: { Name: 'A' } });
  const verdict = decideRecipePush(mine, future);
  assert.equal(verdict.allow, false);
  assert.equal(verdict.warning.code, SYNC_WARNINGS.NEWER_SCHEMA);
});

test('T3 PUSH GATE: a different identity at the same cloud name refuses the push', () => {
  const mine = { name: 'A', data: v2('A', { id: 'id-1' }) };
  const theirs = rec('A', v2('A', { id: 'id-2' }));
  const verdict = decideRecipePush(mine, theirs);
  assert.equal(verdict.allow, false);
  assert.equal(verdict.warning.code, SYNC_WARNINGS.DIVERGENT_IDENTITIES);
});

test('T3 PUSH GATE: an unreadable cloud body refuses — never overwrite what could not be seen', () => {
  const mine = { name: 'A', data: v2('A', { id: 'id-1' }) };
  const verdict = decideRecipePush(mine, { name: 'A', data: null });
  assert.equal(verdict.allow, false);
  assert.equal(verdict.warning.code, SYNC_WARNINGS.UNREADABLE);
});
