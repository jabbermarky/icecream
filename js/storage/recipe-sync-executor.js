// Recipe Sync Executor Module (P0.3 T4)
//
// The storage-facing half of recipe sync: collect records with bodies, run
// the pure planner (recipe-sync-join.js), execute the plan against injected
// stores. No module state and no imports beyond the join module, so the node
// test lane can drive every branch with stub stores — the same extraction
// pattern as recipe-library-load.js. sync-manager.js stays the thin wiring
// layer (auth state, module store refs, status callbacks).
//
// Two executor rules, from the codex T3 cross-model round (design doc T4
// entry), kept deliberately blunt:
//   1. A listing failure surfaces distinctly from an empty listing and
//      ABORTS the plan. A falsely-empty listing makes every record on the
//      other side look one-sided, and the resulting copies clobber newer
//      records with no clock comparison. Stores expose this via
//      listRecipesStrict(), which throws where listRecipes() swallows to [].
//   2. If ANY write fails, skip ALL deletes. Deletes are only stale-rename
//      cleanup, so skipping them never loses recipe content — but it is NOT
//      free: a stale rename source that survives (skipped or failed delete)
//      re-joins on the next sync as a same-id duplicate, which the planner
//      deliberately refuses to touch (DUPLICATE_ID warns and blocks, it
//      never deletes). The residue therefore stalls until resolved by hand.
//      Whether sync should recognize its own rename residue is a banked
//      design question (round-3 findings file); until then the honest
//      contract is "no data loss, possible warn-until-hand-fixed stall."
//
// Partial write execution (some writes landed, one failed) is likewise
// divergence, not loss: every pair's winning body still exists on its own
// source side, so the next sync re-plans the remaining writes from there.

import { planRecipeSync, decideRecipePush } from './recipe-sync-join.js';

/**
 * Error a failed listing aborts with, tagged so callers can report the side
 * without matching on message text.
 */
function listingFailure(side, cause) {
  const error = new Error(`Could not list ${side} recipes; sync aborted with no changes made.`);
  error.code = 'SYNC_LISTING_FAILED';
  error.side = side;
  error.cause = cause;
  return error;
}

/**
 * Collect one side's records in the join's caller contract shape:
 * { name, updatedAt, data } with `data` the downloaded container body, or
 * null when the body could not be read (the join classifies those unreadable,
 * which blocks the name on both sides — fail-closed).
 *
 * The listing is strict — a throw here means the plan must not run. Body
 * downloads are per-record: one unreadable body skips one record, it does
 * not abort the sync.
 *
 * @param {Object} store - backend with listRecipesStrict() and loadRecipe()
 * @returns {Promise<Array<{name: string, updatedAt: *, data: ?Object}>>}
 */
export async function collectSyncRecords(store) {
  const listing = await store.listRecipesStrict();
  const records = [];
  for (const entry of listing) {
    let data = null;
    try {
      const loaded = await store.loadRecipe(entry.name);
      data = loaded && loaded.data !== undefined ? loaded.data : null;
    } catch (error) {
      data = null;
    }
    records.push({ name: entry.name, updatedAt: entry.updatedAt, data });
  }
  return records;
}

/**
 * Execute a planRecipeSync plan against the two stores: writes in plan
 * order, then deletes — and no deletes at all if any write failed (rule 2).
 * A write "fails" unless saveRecipe returns exactly true: the backends
 * return false on failure rather than throwing, and discarding that false
 * is how sync used to report success on a failed cloud save (#12).
 *
 * @param {{actions: Array}} plan - a planRecipeSync result
 * @param {{localStore: Object, cloudStore: Object}} stores
 * @returns {Promise<{pushed: number, pulled: number, deleted: number,
 *   writeFailures: Array<{op: string, name: string}>,
 *   deleteFailures: Array<{name: string, target: string}>,
 *   deletesSkipped: boolean}>}
 */
export async function executeRecipeSyncPlan(plan, { localStore, cloudStore }) {
  const result = {
    pushed: 0, pulled: 0, deleted: 0,
    writeFailures: [], deleteFailures: [], deletesSkipped: false,
  };
  const writes = plan.actions.filter((a) => a.op !== 'delete');
  const deletes = plan.actions.filter((a) => a.op === 'delete');

  for (const action of writes) {
    const store = action.op === 'push' ? cloudStore : localStore;
    let ok = false;
    try {
      ok = (await store.saveRecipe({ name: action.name, data: action.data })) === true;
    } catch (error) {
      ok = false;
    }
    if (ok) {
      if (action.op === 'push') result.pushed++; else result.pulled++;
    } else {
      result.writeFailures.push({ op: action.op, name: action.name });
    }
  }

  if (result.writeFailures.length > 0) {
    result.deletesSkipped = deletes.length > 0;
    return result;
  }

  for (const action of deletes) {
    const store = action.target === 'cloud' ? cloudStore : localStore;
    let ok = false;
    try {
      ok = (await store.deleteRecipe(action.name)) === true;
    } catch (error) {
      ok = false;
    }
    if (ok) result.deleted++;
    else result.deleteFailures.push({ name: action.name, target: action.target });
  }
  return result;
}

/**
 * One full recipe sync: collect both sides, plan, execute.
 *
 * Throws a SYNC_LISTING_FAILED error (rule 1) before any write when either
 * listing fails; every other failure is reported in the returned result.
 *
 * @param {{localStore: Object, cloudStore: Object}} stores
 * @returns {Promise<{plan: Object, execution: Object}>} plan carries the
 *   join's warnings and stats; execution carries what actually happened.
 */
export async function runRecipeSync({ localStore, cloudStore }) {
  let localRecords, cloudRecords;
  try {
    localRecords = await collectSyncRecords(localStore);
  } catch (error) {
    throw listingFailure('local', error);
  }
  try {
    cloudRecords = await collectSyncRecords(cloudStore);
  } catch (error) {
    throw listingFailure('cloud', error);
  }
  const plan = planRecipeSync(localRecords, cloudRecords);
  const execution = await executeRecipeSyncPlan(plan, { localStore, cloudStore });
  return { plan, execution };
}

/**
 * Fetch the current cloud record at a name, in decideRecipePush's caller
 * contract shape: null for absent, { name, updatedAt, data } when readable,
 * { name, data: null } (which the gate refuses) when the lookup itself threw.
 *
 * Known window, scoped with #12: the Drive backend's loadRecipe swallows
 * read errors to null, so a transient read failure on an EXISTING record
 * reaches this function as null and passes the gate as "absent". Closing
 * that needs the backend to distinguish not-found from read-error; until
 * then this function is honest about everything the backend lets it see.
 *
 * @param {Object} cloudStore
 * @param {string} name
 * @returns {Promise<?{name: string, updatedAt: *, data: ?Object}>}
 */
export async function fetchCloudRecordForPush(cloudStore, name) {
  let existing;
  try {
    existing = await cloudStore.loadRecipe(name);
  } catch (error) {
    return { name, data: null };
  }
  if (!existing) return null;
  return {
    name,
    updatedAt: existing.updatedAt,
    data: existing.data !== undefined ? existing.data : null,
  };
}

/**
 * The full gated single-record push: fetch the current cloud record, ask
 * decideRecipePush, and only on an allow verdict write the record. Extracted
 * here so the node lane can prove the gate is actually consulted — a
 * regression that drops the gate call or ignores the verdict fails these
 * tests, not just the browser suite.
 *
 * The gate is best-effort, not atomic: the cloud can change between the
 * fetch and the write (item 20's family), and a Drive read error reaches the
 * fetch as "absent" until the backends distinguish not-found from read-error
 * (#12). Within what the backends let it see, it refuses everything
 * planRecipeSync would refuse.
 *
 * @param {Object} cloudStore
 * @param {{name: string, data: Object}} recipe
 * @returns {Promise<{pushed: boolean, warning: ?Object}>} pushed=false with a
 *   warning on refusal; pushed=false with warning=null on a failed write.
 */
export async function executeGatedPush(cloudStore, recipe) {
  const cloudRecord = await fetchCloudRecordForPush(cloudStore, recipe.name);
  const verdict = decideRecipePush(recipe, cloudRecord);
  if (!verdict.allow) {
    return { pushed: false, warning: verdict.warning };
  }
  let saved = false;
  try {
    saved = (await cloudStore.saveRecipe(recipe)) === true;
  } catch (error) {
    saved = false;
  }
  return { pushed: saved, warning: null };
}
