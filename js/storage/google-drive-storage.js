// Google Drive Storage Implementation
// Uses gapi client library for Drive API access
// Implements StorageInterface pattern from storage.js
//
// Storage location: IceCream App Data/ folder in user's Drive
//
// File naming convention:
//   Recipes: recipe-{name}.json (one file per recipe)
//   Ingredients: ingredients.json (single file)
//
// File metadata (appProperties):
//   app: 'icecream' - identifies files as belonging to this app
//   type: 'recipe' | 'ingredients' - file type for filtering
//
// File content structure (same as IndexedDB for consistency):
//   {
//     "name": "Recipe Name",
//     "updatedAt": "2026-01-15T...",
//     "data": { "Recipe": {...}, "Ingredients": {...} }
//   }

import { createStorage } from './storage.js';
import { isSignedIn } from './google-auth.js';

// Folder and file naming conventions
const APP_FOLDER_NAME = 'IceCream App Data';
const RECIPE_PREFIX = 'recipe-';
const INGREDIENTS_FILE = 'ingredients.json';
const MIME_TYPE = 'application/json';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

// App properties for identifying app files (used in queries)
const APP_PROPERTIES = {
  app: 'icecream'
};

// Cached folder ID (avoids repeated lookups)
let appFolderId = null;

/**
 * Google Drive storage implementation for recipes and ingredients
 * Each recipe stored as: { name, updatedAt, data: { Recipe, Ingredients } }
 */
export const GoogleDriveStorage = {

  // --- Recipe Methods ---

  /**
   * Save recipe to Google Drive
   * @param {Object} recipe - Recipe object with name and data properties
   * @returns {Promise<boolean>} True on success, false on error
   */
  async saveRecipe(recipe) {
    try {
      if (!isSignedIn()) {
        console.error('Not signed in to Google');
        return false;
      }

      const fileName = `${RECIPE_PREFIX}${recipe.name}.json`;
      const fileContent = {
        name: recipe.name,
        updatedAt: new Date().toISOString(),
        data: recipe.data
      };

      // Check if file already exists
      const existingFile = await findFileByName(fileName);

      if (existingFile) {
        // Update existing file
        await updateFile(existingFile.id, fileContent);
      } else {
        // Create new file in app folder
        await uploadFile(fileName, fileContent, 'recipe');
      }

      return true;
    } catch (error) {
      console.error('Failed to save recipe to Drive:', error);
      return false;
    }
  },

  /**
   * Load recipe by name from Google Drive
   * @param {string} name - Recipe name to load
   * @returns {Promise<Object|null>} Recipe data or null if not found
   */
  async loadRecipe(name) {
    try {
      if (!isSignedIn()) {
        console.error('Not signed in to Google');
        return null;
      }

      const fileName = `${RECIPE_PREFIX}${name}.json`;
      const file = await findFileByName(fileName);

      if (!file) {
        return null;
      }

      const content = await downloadFile(file.id);
      return content;
    } catch (error) {
      console.error('Failed to load recipe from Drive:', error);
      return null;
    }
  },

  /**
   * List all recipes in Google Drive
   * Swallow-to-[] contract for UI callers where an empty view is an
   * acceptable degradation. One implementation: this delegates to
   * listRecipesStrict so the query and name decoding cannot diverge.
   * @returns {Promise<Array<{name, updatedAt}>>} Array of recipe summaries
   */
  async listRecipes() {
    try {
      return await this.listRecipesStrict();
    } catch (error) {
      console.error('Failed to list recipes from Drive:', error);
      return [];
    }
  },

  /**
   * List all recipes, surfacing failure instead of swallowing it.
   *
   * Sync planning MUST tell "no recipes" apart from "listing failed": a
   * falsely-empty cloud listing makes every local record look local-only and
   * re-uploads them, and the reverse direction clobbers newer records with
   * no clock comparison. listRecipes() above keeps its swallow-to-[]
   * contract for callers where an empty view is an acceptable degradation.
   * @returns {Promise<Array<{name, updatedAt}>>}
   * @throws when not signed in, the app folder is unreachable, or the query fails
   */
  async listRecipesStrict() {
    if (!isSignedIn()) {
      throw new Error('Not signed in to Google');
    }
    const folderId = await getOrCreateAppFolder();
    if (!folderId) {
      throw new Error('Google Drive app folder is unavailable');
    }
    const query = `'${folderId}' in parents and name contains '${RECIPE_PREFIX}' and mimeType='${MIME_TYPE}' and trashed=false and appProperties has { key='app' and value='icecream' }`;
    // Follow nextPageToken to the end. Drive returns at most one page per
    // call (default 100 files) with NO error for the rest; a truncated
    // listing here would make every unlisted cloud record look local-only
    // to the sync planner — the same silent-clobber class as a falsely
    // empty listing, just past file 100 instead of at file 0.
    const files = [];
    let pageToken;
    do {
      const response = await gapi.client.drive.files.list({
        q: query,
        fields: 'nextPageToken, files(id, name, modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 1000,
        ...(pageToken ? { pageToken } : {})
      });
      files.push(...(response.result.files || []));
      pageToken = response.result.nextPageToken;
    } while (pageToken);
    // Decode recipe-{name}.json anchored at both ends, so a name that
    // itself contains ".json" or the prefix survives the round-trip.
    return files.map(file => {
      let recipeName = file.name;
      if (recipeName.startsWith(RECIPE_PREFIX)) {
        recipeName = recipeName.slice(RECIPE_PREFIX.length);
      }
      recipeName = recipeName.replace(/\.json$/, '');
      return { name: recipeName, updatedAt: file.modifiedTime };
    });
  },

  /**
   * Delete recipe by name from Google Drive
   * @param {string} name - Recipe name to delete
   * @returns {Promise<boolean>} True on success, false on error
   */
  async deleteRecipe(name) {
    try {
      if (!isSignedIn()) {
        console.error('Not signed in to Google');
        return false;
      }

      const fileName = `${RECIPE_PREFIX}${name}.json`;
      const file = await findFileByName(fileName);

      if (!file) {
        // File doesn't exist - consider this success
        return true;
      }

      await gapi.client.drive.files.delete({
        fileId: file.id
      });

      return true;
    } catch (error) {
      console.error('Failed to delete recipe from Drive:', error);
      return false;
    }
  },

  /**
   * Check if recipe exists in Google Drive
   * @param {string} name - Recipe name to check
   * @returns {Promise<boolean>} True if recipe exists
   */
  async hasRecipe(name) {
    try {
      if (!isSignedIn()) {
        console.error('Not signed in to Google');
        return false;
      }

      const fileName = `${RECIPE_PREFIX}${name}.json`;
      const file = await findFileByName(fileName);

      return file !== null;
    } catch (error) {
      console.error('Failed to check recipe in Drive:', error);
      return false;
    }
  },

  // --- Ingredient Methods ---

  /**
   * Save ingredients to Google Drive
   * @param {Object} ingredients - Ingredients object to save
   * @returns {Promise<boolean>} True on success, false on error
   */
  async saveIngredients(ingredients) {
    try {
      if (!isSignedIn()) {
        console.error('Not signed in to Google');
        return false;
      }

      const fileContent = {
        name: 'library',
        updatedAt: new Date().toISOString(),
        data: ingredients
      };

      // Check if file already exists
      const existingFile = await findFileByName(INGREDIENTS_FILE);

      if (existingFile) {
        // Update existing file
        await updateFile(existingFile.id, fileContent);
      } else {
        // Create new file in app folder
        await uploadFile(INGREDIENTS_FILE, fileContent, 'ingredients');
      }

      return true;
    } catch (error) {
      console.error('Failed to save ingredients to Drive:', error);
      return false;
    }
  },

  /**
   * Load ingredients from Google Drive
   * @returns {Promise<Object|null>} Ingredients object or null if not found
   */
  async loadIngredients() {
    try {
      if (!isSignedIn()) {
        console.error('Not signed in to Google');
        return null;
      }

      const file = await findFileByName(INGREDIENTS_FILE);

      if (!file) {
        return null;
      }

      const content = await downloadFile(file.id);
      return content ? content.data : null;
    } catch (error) {
      console.error('Failed to load ingredients from Drive:', error);
      return null;
    }
  },

  /**
   * Check if library ingredients exist in Google Drive
   * @returns {Promise<boolean>} True if library ingredients exist
   */
  async hasIngredients() {
    try {
      if (!isSignedIn()) {
        console.error('Not signed in to Google');
        return false;
      }

      const file = await findFileByName(INGREDIENTS_FILE);
      return file !== null;
    } catch (error) {
      console.error('Failed to check ingredients in Drive:', error);
      return false;
    }
  }
};

// --- Helper Functions ---

/**
 * Get or create the app folder in Drive
 * @returns {Promise<string|null>} Folder ID or null on error
 */
async function getOrCreateAppFolder() {
  // Return cached ID if available
  if (appFolderId) {
    return appFolderId;
  }

  try {
    // Search for existing folder
    const query = `name='${APP_FOLDER_NAME}' and mimeType='${FOLDER_MIME_TYPE}' and trashed=false`;

    const response = await gapi.client.drive.files.list({
      q: query,
      fields: 'files(id, name)',
      pageSize: 1
    });

    const files = response.result.files || [];

    if (files.length > 0) {
      // Folder exists - cache and return ID
      appFolderId = files[0].id;
      console.log('Found app folder:', appFolderId);
      return appFolderId;
    }

    // Create folder
    const folderMetadata = {
      name: APP_FOLDER_NAME,
      mimeType: FOLDER_MIME_TYPE
    };

    const createResponse = await gapi.client.drive.files.create({
      resource: folderMetadata,
      fields: 'id'
    });

    appFolderId = createResponse.result.id;
    console.log('Created app folder:', appFolderId);
    return appFolderId;
  } catch (error) {
    console.error('Failed to get/create app folder:', error);
    return null;
  }
}

/**
 * Escape a value for interpolation inside a single-quoted Drive query string.
 * A recipe name like "O'Brien's Vanilla" otherwise breaks the query: gapi
 * throws, the catch below returns null, and "lookup failed" becomes
 * indistinguishable from "absent" — which makes saveRecipe CREATE a duplicate
 * file on every save instead of updating the existing one.
 * @param {string} value
 * @returns {string}
 */
function escapeQueryValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Find a file in Drive by exact name (within app folder)
 * @param {string} name - Exact filename to search for
 * @returns {Promise<Object|null>} File metadata or null if not found
 */
async function findFileByName(name) {
  try {
    // Ensure we have the folder ID
    const folderId = await getOrCreateAppFolder();
    if (!folderId) {
      return null;
    }

    // Search within the app folder using appProperties
    const query = `'${folderId}' in parents and name='${escapeQueryValue(name)}' and mimeType='${MIME_TYPE}' and trashed=false and appProperties has { key='app' and value='icecream' }`;

    const response = await gapi.client.drive.files.list({
      q: query,
      fields: 'files(id, name, modifiedTime, appProperties)',
      pageSize: 1
    });

    const files = response.result.files || [];
    return files.length > 0 ? files[0] : null;
  } catch (error) {
    console.error('Failed to find file:', error);
    return null;
  }
}

/**
 * Upload a new file to Drive (in app folder)
 * @param {string} name - Filename
 * @param {Object} content - File content (will be JSON stringified)
 * @param {string} type - File type for appProperties ('recipe' or 'ingredients')
 * @returns {Promise<Object>} Created file metadata
 */
async function uploadFile(name, content, type) {
  // Ensure we have the folder ID
  const folderId = await getOrCreateAppFolder();

  const fileMetadata = {
    name: name,
    mimeType: MIME_TYPE,
    parents: folderId ? [folderId] : [],
    appProperties: {
      ...APP_PROPERTIES,
      type: type
    }
  };

  const fileContent = JSON.stringify(content, null, 2);

  // Use multipart upload for metadata + content
  const boundary = '-------314159265358979323846';
  const delimiter = '\r\n--' + boundary + '\r\n';
  const closeDelimiter = '\r\n--' + boundary + '--';

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(fileMetadata) +
    delimiter +
    'Content-Type: ' + MIME_TYPE + '\r\n\r\n' +
    fileContent +
    closeDelimiter;

  const response = await gapi.client.request({
    path: '/upload/drive/v3/files',
    method: 'POST',
    params: { uploadType: 'multipart' },
    headers: {
      'Content-Type': 'multipart/related; boundary="' + boundary + '"'
    },
    body: multipartRequestBody
  });

  return response.result;
}

/**
 * Update an existing file in Drive
 * @param {string} fileId - ID of file to update
 * @param {Object} content - New file content (will be JSON stringified)
 * @returns {Promise<Object>} Updated file metadata
 */
async function updateFile(fileId, content) {
  const fileContent = JSON.stringify(content, null, 2);

  const response = await gapi.client.request({
    path: `/upload/drive/v3/files/${fileId}`,
    method: 'PATCH',
    params: { uploadType: 'media' },
    headers: {
      'Content-Type': MIME_TYPE
    },
    body: fileContent
  });

  return response.result;
}

/**
 * Download file content from Drive
 * @param {string} fileId - ID of file to download
 * @returns {Promise<Object|null>} Parsed JSON content or null on error
 */
async function downloadFile(fileId) {
  try {
    const response = await gapi.client.drive.files.get({
      fileId: fileId,
      alt: 'media'
    });

    // Response body is the file content
    const content = response.body;

    // Parse JSON if string, otherwise return as-is
    if (typeof content === 'string') {
      return JSON.parse(content);
    }
    return content;
  } catch (error) {
    console.error('Failed to download file:', error);
    return null;
  }
}

/**
 * Clear cached folder ID (call on sign-out if needed)
 */
export function clearFolderCache() {
  appFolderId = null;
}

/**
 * Initialize Google Drive storage and return validated instance
 * @returns {Object} Validated storage instance via createStorage()
 */
export function initGoogleDriveStorage() {
  return createStorage(GoogleDriveStorage);
}
