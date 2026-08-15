// Sync Manager Module
// Handles bidirectional sync between IndexedDB and Google Drive storage

import { isSignedIn, onAuthStateChange } from './google-auth.js';
import { initGoogleDriveStorage, clearFolderCache } from './google-drive-storage.js';
import { runRecipeSync, executeGatedPush } from './recipe-sync-executor.js';

// Module state
let localStorage = null;      // IndexedDB storage instance
let cloudStorage = null;      // GoogleDrive storage instance (null if not signed in)
let isSyncing = false;
let lastSyncTime = null;

// Sync status callback for UI updates
let onSyncStatusChange = null;
// Sync warnings callback: receives the join's warning objects ({code, side,
// name, message} — SYNC_WARNINGS vocabulary) for user-facing display
let onSyncWarnings = null;

/**
 * Initialize sync manager with local storage reference
 * @param {Object} indexedDBStorage - IndexedDB storage instance
 * @param {Object} options - Optional configuration
 * @param {Function} options.onSyncStatusChange - Callback for sync status changes
 * @param {Function} options.onSyncWarnings - Callback receiving an array of
 *   sync warning objects whenever a sync or push skips or refuses something
 */
export function initSyncManager(indexedDBStorage, options = {}) {
  localStorage = indexedDBStorage;
  onSyncStatusChange = options.onSyncStatusChange || null;
  onSyncWarnings = options.onSyncWarnings || null;

  // Subscribe to auth state changes
  onAuthStateChange(handleAuthStateChange);

  console.log('Sync manager initialized');
}

/**
 * Handle auth state changes - trigger sync on sign-in, clear cloud ref on sign-out
 * @param {boolean} signedIn - Whether user is signed in
 */
async function handleAuthStateChange(signedIn) {
  if (signedIn) {
    // Initialize cloud storage
    cloudStorage = initGoogleDriveStorage();
    console.log('Cloud storage connected');

    // Trigger initial full sync. syncAll sets the final status itself
    // ('synced'/'error'), so don't overwrite it here — and a 'not signed
    // in'/'already syncing' short-circuit is not an error state: auth
    // listeners can fire in bursts, and painting the UI red for a
    // concurrent sync that is still running would be a lie.
    notifyStatus('syncing');
    const result = await syncAll();

    if (result.success) {
      console.log('Initial sync complete:', result);
    } else if (result.reason) {
      console.log('Initial sync skipped:', result.reason);
    } else {
      console.error('Initial sync failed');
    }
  } else {
    // Clear cloud storage reference and folder cache
    cloudStorage = null;
    clearFolderCache();
    console.log('Cloud storage disconnected');
    notifyStatus('offline');
  }
}

/**
 * Perform full bidirectional sync of recipes and ingredients
 * @returns {Promise<Object>} Sync result with success flag and stats
 */
export async function syncAll() {
  if (!isSignedIn() || isSyncing) {
    return { success: false, reason: isSyncing ? 'already syncing' : 'not signed in' };
  }

  isSyncing = true;
  notifyStatus('syncing');

  try {
    // Sync recipes
    const recipesResult = await syncRecipes();

    // Sync ingredients
    const ingredientsResult = await syncIngredients();

    // Update last sync time
    lastSyncTime = new Date().toISOString();
    isSyncing = false;

    // A failed write means the two sides still disagree; a failed or skipped
    // delete leaves stale rename residue that the next sync will NOT retry
    // (it re-joins as a duplicate id, which the planner refuses to touch).
    // Both are incomplete syncs, not a synced state — and the moment the
    // user can still act on a failed delete is now, so say so.
    const complete = recipesResult.writeFailures.length === 0 &&
      recipesResult.deleteFailures.length === 0;
    notifyStatus(complete ? 'synced' : 'error');

    return {
      success: complete,
      recipes: recipesResult,
      ingredients: ingredientsResult,
      syncTime: lastSyncTime
    };
  } catch (error) {
    console.error('Sync failed:', error);
    isSyncing = false;
    notifyStatus('error');
    return { success: false, error: error.message };
  }
}

/**
 * Sync recipes between local and cloud storage.
 *
 * Thin wrapper over the executor module: collect (strict listings + bodies),
 * plan (recipe-sync-join), execute (writes then deletes, with the failed-
 * write → skip-deletes rule). A failed LISTING throws before any write —
 * syncAll's catch turns that into an error status with no changes made.
 *
 * @returns {Promise<Object>} join stats + execution counts + failures
 */
async function syncRecipes() {
  const { plan, execution } = await runRecipeSync({
    localStore: localStorage,
    cloudStore: cloudStorage,
  });
  surfaceWarnings(plan.warnings);
  if (execution.deleteFailures.length > 0) {
    // A failed stale-rename delete will NOT be retried by the next sync
    // (the leftover re-joins as a duplicate id and gets blocked), so tell
    // the user while deleting by hand is still the easy fix.
    surfaceWarnings(execution.deleteFailures.map((d) => ({
      code: 'delete-failed', side: d.target, name: d.name,
      message: `The old copy of "${d.name}" (${d.target}) could not be removed after its ` +
        `rename synced; delete it by hand or future syncs will keep warning about it.`,
    })));
  }
  console.log('Recipe sync complete:', plan.stats, execution);
  return {
    // What actually happened (execution), not what was planned (plan.stats):
    // the two differ exactly when a write failed.
    pushed: execution.pushed,
    pulled: execution.pulled,
    deleted: execution.deleted,
    unchanged: plan.stats.unchanged,
    skipped: plan.stats.skipped,
    warnings: plan.warnings,
    writeFailures: execution.writeFailures,
    deleteFailures: execution.deleteFailures,
    deletesSkipped: execution.deletesSkipped,
  };
}

/**
 * Sync ingredients between local and cloud storage
 * @returns {Promise<Object>} Sync result
 */
async function syncIngredients() {
  const result = { action: 'none' };

  try {
    const localIngredients = await localStorage.loadIngredients();
    const cloudIngredients = await cloudStorage.loadIngredients();

    if (localIngredients && !cloudIngredients) {
      // Local only - push to cloud
      await cloudStorage.saveIngredients(localIngredients);
      result.action = 'pushed';
      console.log('Pushed ingredients to cloud');
    } else if (!localIngredients && cloudIngredients) {
      // Cloud only - pull to local
      await localStorage.saveIngredients(cloudIngredients);
      result.action = 'pulled';
      console.log('Pulled ingredients from cloud');
    } else if (localIngredients && cloudIngredients) {
      // Both exist - merge (cloud wins for per-ingredient conflicts)
      const merged = mergeIngredients(localIngredients, cloudIngredients);
      await localStorage.saveIngredients(merged);
      await cloudStorage.saveIngredients(merged);
      result.action = 'merged';
      console.log('Merged ingredients');
    }

    return result;
  } catch (error) {
    console.error('Ingredient sync error:', error);
    throw error;
  }
}

/**
 * Merge two ingredient objects
 * Cloud wins for per-ingredient conflicts (same name, different values)
 * @param {Object} local - Local ingredients
 * @param {Object} cloud - Cloud ingredients
 * @returns {Object} Merged ingredients
 */
function mergeIngredients(local, cloud) {
  const merged = { ...local };

  // Add cloud ingredients, overwriting local on conflict
  for (const name in cloud) {
    merged[name] = cloud[name];
  }

  return merged;
}

/**
 * Push a recipe to cloud storage (fire-and-forget)
 * Called after local save operations
 *
 * Gated through executeGatedPush (fetch → decideRecipePush → write), the
 * same guards the full sync applies: it refuses to overwrite an identified
 * cloud record with an id-less body, a different identity, an unreadable
 * body, or a newer-schema record. The gate is best-effort, not atomic —
 * the known windows (item 20's fetch-to-write race, #12's read-error-as-
 * absent conflation) are documented on executeGatedPush itself.
 *
 * @param {Object} recipe - Recipe object with name and data
 */
export async function pushRecipe(recipe) {
  if (!isSignedIn() || !cloudStorage) {
    return;
  }

  try {
    const result = await executeGatedPush(cloudStorage, recipe);
    if (result.warning) {
      console.warn(`Push refused for "${recipe.name}":`, result.warning.message);
      surfaceWarnings([result.warning]);
      notifyStatus('error');
    } else if (result.pushed) {
      console.log(`Pushed recipe to cloud: ${recipe.name}`);
      notifyStatus('synced');
    } else {
      // The backend reports failure by returning false, not throwing;
      // discarding that false was #12's bug at this call site.
      console.error(`Failed to push recipe to cloud: ${recipe.name}`);
      notifyStatus('error');
    }
  } catch (error) {
    console.error('Failed to push recipe to cloud:', error);
    notifyStatus('error');
  }
}

/**
 * Push ingredients to cloud storage (fire-and-forget)
 * Called after local ingredient save operations
 * @param {Object} ingredients - Ingredients object
 */
export async function pushIngredients(ingredients) {
  if (!isSignedIn() || !cloudStorage) {
    return;
  }

  try {
    await cloudStorage.saveIngredients(ingredients);
    console.log('Pushed ingredients to cloud');
    notifyStatus('synced');
  } catch (error) {
    console.error('Failed to push ingredients to cloud:', error);
    notifyStatus('error');
  }
}

/**
 * Delete a recipe from cloud storage
 * Called after local delete operations
 * @param {string} name - Recipe name to delete
 */
export async function deleteRecipeFromCloud(name) {
  if (!isSignedIn() || !cloudStorage) {
    return;
  }

  try {
    await cloudStorage.deleteRecipe(name);
    console.log(`Deleted recipe from cloud: ${name}`);
  } catch (error) {
    console.error('Failed to delete recipe from cloud:', error);
  }
}

/**
 * Get current sync status
 * @returns {Object} Status object with syncing state, last sync time, and connection status
 */
export function getSyncStatus() {
  return {
    isSyncing,
    lastSyncTime,
    isCloudConnected: isSignedIn()
  };
}

/**
 * Notify status change callback if registered
 * @param {'syncing' | 'synced' | 'error' | 'offline'} status
 */
function notifyStatus(status) {
  if (typeof onSyncStatusChange === 'function') {
    onSyncStatusChange(status);
  }
}

/**
 * Surface sync warnings to the registered callback, console otherwise.
 * @param {Array<{code: string, side: string, name: string, message: string}>} warnings
 */
function surfaceWarnings(warnings) {
  if (!warnings || warnings.length === 0) return;
  if (typeof onSyncWarnings === 'function') {
    onSyncWarnings(warnings);
  } else {
    for (const w of warnings) console.warn(`Sync warning [${w.code}] ${w.name}: ${w.message}`);
  }
}
