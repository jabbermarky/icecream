// Sync Manager Module
// Handles bidirectional sync between IndexedDB and Google Drive storage

import { isSignedIn, onAuthStateChange } from './google-auth.js';
import { initGoogleDriveStorage, clearFolderCache } from './google-drive-storage.js';

// Module state
let localStorage = null;      // IndexedDB storage instance
let cloudStorage = null;      // GoogleDrive storage instance (null if not signed in)
let isSyncing = false;
let lastSyncTime = null;

// Sync status callback for UI updates
let onSyncStatusChange = null;

/**
 * Initialize sync manager with local storage reference
 * @param {Object} indexedDBStorage - IndexedDB storage instance
 * @param {Object} options - Optional configuration
 * @param {Function} options.onSyncStatusChange - Callback for sync status changes
 */
export function initSyncManager(indexedDBStorage, options = {}) {
  localStorage = indexedDBStorage;
  onSyncStatusChange = options.onSyncStatusChange || null;

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

    // Trigger initial full sync
    notifyStatus('syncing');
    const result = await syncAll();

    if (result.success) {
      console.log('Initial sync complete:', result);
      notifyStatus('synced');
    } else {
      console.error('Initial sync failed');
      notifyStatus('error');
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
    notifyStatus('synced');

    return {
      success: true,
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
 * Sync recipes between local and cloud storage
 * @returns {Promise<Object>} Stats about recipes synced
 */
async function syncRecipes() {
  const stats = { pushed: 0, pulled: 0, conflicts: 0 };

  try {
    // Get both lists
    const localList = await localStorage.listRecipes();
    const cloudList = await cloudStorage.listRecipes();

    // Create lookup maps
    const localMap = new Map(localList.map(r => [r.name, r]));
    const cloudMap = new Map(cloudList.map(r => [r.name, r]));

    // Push local recipes not in cloud
    for (const local of localList) {
      if (!cloudMap.has(local.name)) {
        // Local only - push to cloud
        const recipe = await localStorage.loadRecipe(local.name);
        if (recipe) {
          await cloudStorage.saveRecipe({ name: local.name, data: recipe.data });
          stats.pushed++;
          console.log(`Pushed recipe to cloud: ${local.name}`);
        }
      } else {
        // Exists in both - check for conflicts
        const cloud = cloudMap.get(local.name);
        const localTime = new Date(local.updatedAt).getTime();
        const cloudTime = new Date(cloud.updatedAt).getTime();

        if (localTime > cloudTime) {
          // Local is newer - push to cloud
          const recipe = await localStorage.loadRecipe(local.name);
          if (recipe) {
            await cloudStorage.saveRecipe({ name: local.name, data: recipe.data });
            stats.pushed++;
            stats.conflicts++;
            console.log(`Conflict resolved (local newer): ${local.name}`);
          }
        } else if (cloudTime > localTime) {
          // Cloud is newer - pull to local
          const recipe = await cloudStorage.loadRecipe(local.name);
          if (recipe) {
            await localStorage.saveRecipe({ name: local.name, data: recipe.data });
            stats.pulled++;
            stats.conflicts++;
            console.log(`Conflict resolved (cloud newer): ${local.name}`);
          }
        }
        // If equal timestamps, no action needed
      }
    }

    // Pull cloud recipes not in local
    for (const cloud of cloudList) {
      if (!localMap.has(cloud.name)) {
        // Cloud only - pull to local
        const recipe = await cloudStorage.loadRecipe(cloud.name);
        if (recipe) {
          await localStorage.saveRecipe({ name: cloud.name, data: recipe.data });
          stats.pulled++;
          console.log(`Pulled recipe from cloud: ${cloud.name}`);
        }
      }
    }

    console.log('Recipe sync complete:', stats);
    return stats;
  } catch (error) {
    console.error('Recipe sync error:', error);
    throw error;
  }
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
 * @param {Object} recipe - Recipe object with name and data
 */
export async function pushRecipe(recipe) {
  if (!isSignedIn() || !cloudStorage) {
    return;
  }

  try {
    await cloudStorage.saveRecipe(recipe);
    console.log(`Pushed recipe to cloud: ${recipe.name}`);
    notifyStatus('synced');
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
