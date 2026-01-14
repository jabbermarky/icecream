// IndexedDB Storage Implementation
// Uses idb library for Promise-based IndexedDB access

import { openDB } from 'https://esm.sh/idb@8';
import { createStorage } from './storage.js';

const DB_NAME = 'ice-ed-recipes';
const DB_VERSION = 1;
const STORE_NAME = 'recipes';

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
   * @returns {Promise<Array<{name, updatedAt}>>} Array of recipe summaries
   */
  async listRecipes() {
    try {
      if (!this.db) {
        console.error('IndexedDB not initialized');
        return [];
      }
      const records = await this.db.getAllFromIndex(STORE_NAME, 'updatedAt');
      // Return in reverse order (most recent first)
      return records.reverse().map(r => ({ name: r.name, updatedAt: r.updatedAt }));
    } catch (error) {
      console.error('Failed to list recipes:', error);
      return [];
    }
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
      async deleteRecipe() { console.error('Storage not available'); return false; },
      async hasRecipe() { console.error('Storage not available'); return false; }
    });
  }
}
