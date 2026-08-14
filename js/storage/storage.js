// Storage Interface
// Defines the contract for recipe storage implementations
// Implementations: IndexedDBStorage (local), future CloudStorage

/**
 * Storage interface - all methods return Promises
 * Implementations must provide all methods defined here
 */
export const StorageInterface = {
  // Save recipe - returns Promise<void>
  saveRecipe: async (recipe) => { throw new Error('Not implemented'); },

  // Load recipe by name - returns Promise<RecipeData|null>
  loadRecipe: async (name) => { throw new Error('Not implemented'); },

  // List all recipes - returns Promise<Array<{name, updatedAt}>>
  listRecipes: async () => { throw new Error('Not implemented'); },

  // Delete recipe by name - returns Promise<void>
  deleteRecipe: async (name) => { throw new Error('Not implemented'); },

  // Check if recipe exists - returns Promise<boolean>
  hasRecipe: async (name) => { throw new Error('Not implemented'); }
};

/**
 * Required methods for a valid storage implementation
 */
const REQUIRED_METHODS = ['saveRecipe', 'loadRecipe', 'listRecipes', 'listRecipesStrict', 'deleteRecipe', 'hasRecipe'];

/**
 * Factory function to create and validate a storage instance
 * @param {Object} implementation - Object implementing StorageInterface methods
 * @returns {Object} Validated storage instance
 * @throws {Error} If implementation is missing required methods
 */
export function createStorage(implementation) {
  if (!implementation || typeof implementation !== 'object') {
    throw new Error('Storage implementation must be an object');
  }

  const missingMethods = REQUIRED_METHODS.filter(
    method => typeof implementation[method] !== 'function'
  );

  if (missingMethods.length > 0) {
    throw new Error(`Storage implementation missing required methods: ${missingMethods.join(', ')}`);
  }

  return implementation;
}
