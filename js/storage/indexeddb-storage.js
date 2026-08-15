// IndexedDB Storage Implementation
// Uses idb library for Promise-based IndexedDB access

import { openDB } from '../vendor/idb.js';
import { createStorage } from './storage.js';

const DB_NAME = 'ice-ed-recipes';
const DB_VERSION = 2;
const STORE_NAME = 'recipes';
const STORE_NAME_INGREDIENTS = 'ingredients';

/**
 * IndexedDB storage implementation for recipes
 * Each recipe stored as: { name, updatedAt, data: { Recipe, Ingredients } }
 */
export const IndexedDBStorage = {
  db: null,

  /**
   * Save recipe to IndexedDB
   * @param {Object} recipe - Recipe object with name and data properties
   * @returns {Promise<boolean>} True on success, false on error
   */
  async saveRecipe(recipe) {
    try {
      if (!this.db) {
        console.error('IndexedDB not initialized');
        return false;
      }
      const record = {
        name: recipe.name,
        updatedAt: new Date().toISOString(),
        data: recipe.data
      };
      await this.db.put(STORE_NAME, record);
      return true;
    } catch (error) {
      console.error('Failed to save recipe:', error);
      return false;
    }
  },

  /**
   * Load recipe by name from IndexedDB
   * @param {string} name - Recipe name to load
   * @returns {Promise<Object|null>} Recipe data or null if not found
   */
  async loadRecipe(name) {
    try {
      if (!this.db) {
        console.error('IndexedDB not initialized');
        return null;
      }
      const record = await this.db.get(STORE_NAME, name);
      return record || null;
    } catch (error) {
      console.error('Failed to load recipe:', error);
      return null;
    }
  },

  /**
   * List all recipes in IndexedDB
   * Swallow-to-[] contract for UI callers where an empty view is an
   * acceptable degradation. One implementation: this delegates to
   * listRecipesStrict so the mapping and ordering cannot diverge.
   * @returns {Promise<Array<{name, updatedAt}>>} Array of recipe summaries
   */
  async listRecipes() {
    try {
      return await this.listRecipesStrict();
    } catch (error) {
      console.error('Failed to list recipes:', error);
      return [];
    }
  },

  /**
   * List all recipes, surfacing failure instead of swallowing it.
   *
   * Sync planning MUST tell "no recipes" apart from "listing failed":
   * a falsely-empty local listing makes every cloud record look cloud-only,
   * and the resulting pulls clobber newer local records with no clock
   * comparison. listRecipes() above keeps its swallow-to-[] contract for
   * UI callers where an empty library view is an acceptable degradation.
   * @returns {Promise<Array<{name, updatedAt}>>}
   * @throws when the database is unavailable or the read fails
   */
  async listRecipesStrict() {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }
    // getAll on the store, NOT getAllFromIndex('updatedAt'): an index
    // silently omits any record whose indexed key is missing or invalid,
    // and an incomplete listing here makes the sync planner treat the
    // unlisted record's counterpart as one-sided (the silent-clobber class
    // this method exists to prevent). Sort most-recent-first in JS instead;
    // unparseable timestamps sort last.
    const records = await this.db.getAll(STORE_NAME);
    const ms = (v) => {
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : -Infinity;
    };
    return records
      .sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt))
      .map(r => ({ name: r.name, updatedAt: r.updatedAt }));
  },

  /**
   * Delete recipe by name from IndexedDB
   * @param {string} name - Recipe name to delete
   * @returns {Promise<boolean>} True on success, false on error
   */
  async deleteRecipe(name) {
    try {
      if (!this.db) {
        console.error('IndexedDB not initialized');
        return false;
      }
      await this.db.delete(STORE_NAME, name);
      return true;
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      return false;
    }
  },

  /**
   * Check if recipe exists in IndexedDB
   * @param {string} name - Recipe name to check
   * @returns {Promise<boolean>} True if recipe exists
   */
  async hasRecipe(name) {
    try {
      if (!this.db) {
        console.error('IndexedDB not initialized');
        return false;
      }
      const record = await this.db.get(STORE_NAME, name);
      return record !== undefined;
    } catch (error) {
      console.error('Failed to check recipe:', error);
      return false;
    }
  },

  // --- Ingredient Storage Methods ---

  /**
   * Save ingredients to IndexedDB
   * @param {Object} ingredients - Ingredients object to save
   * @returns {Promise<boolean>} True on success, false on error
   */
  async saveIngredients(ingredients) {
    try {
      if (!this.db) {
        console.error('IndexedDB not initialized');
        return false;
      }
      const record = {
        name: 'library',
        updatedAt: new Date().toISOString(),
        data: ingredients
      };
      await this.db.put(STORE_NAME_INGREDIENTS, record);
      return true;
    } catch (error) {
      console.error('Failed to save ingredients:', error);
      return false;
    }
  },

  /**
   * Load ingredients from IndexedDB
   * @returns {Promise<Object|null>} Ingredients object or null if not found
   */
  async loadIngredients() {
    try {
      if (!this.db) {
        console.error('IndexedDB not initialized');
        return null;
      }
      const record = await this.db.get(STORE_NAME_INGREDIENTS, 'library');
      return record ? record.data : null;
    } catch (error) {
      console.error('Failed to load ingredients:', error);
      return null;
    }
  },

  /**
   * Check if library ingredients exist in IndexedDB
   * @returns {Promise<boolean>} True if library ingredients exist
   */
  async hasIngredients() {
    try {
      if (!this.db) {
        console.error('IndexedDB not initialized');
        return false;
      }
      const record = await this.db.get(STORE_NAME_INGREDIENTS, 'library');
      return record !== undefined;
    } catch (error) {
      console.error('Failed to check ingredients:', error);
      return false;
    }
  }
};

/**
 * Initialize IndexedDB and return storage instance
 * @returns {Promise<Object>} Validated storage instance
 */
export async function initIndexedDBStorage() {
  try {
    const db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create recipes object store with name as key
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'name' });
          // Create index on updatedAt for sorting by recent
          store.createIndex('updatedAt', 'updatedAt');
        }
        // Create ingredients object store with name as key (v2)
        if (!db.objectStoreNames.contains(STORE_NAME_INGREDIENTS)) {
          db.createObjectStore(STORE_NAME_INGREDIENTS, { keyPath: 'name' });
        }
      }
    });

    // Bind db to storage object
    IndexedDBStorage.db = db;

    // Validate and return storage instance
    return createStorage(IndexedDBStorage);
  } catch (error) {
    console.error('Failed to initialize IndexedDB:', error);
    // Return a non-functional storage that won't throw but logs errors
    return createStorage({
      async saveRecipe() { console.error('Storage not available'); return false; },
      async loadRecipe() { console.error('Storage not available'); return null; },
      async listRecipes() { console.error('Storage not available'); return []; },
      async listRecipesStrict() { throw new Error('Storage not available'); },
      async deleteRecipe() { console.error('Storage not available'); return false; },
      async hasRecipe() { console.error('Storage not available'); return false; }
    });
  }
}
