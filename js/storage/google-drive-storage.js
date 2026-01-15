// Google Drive Storage Implementation
// Uses gapi client library for Drive API access
// Implements StorageInterface pattern from storage.js

import { createStorage } from './storage.js';
import { isSignedIn } from './google-auth.js';

// File naming conventions for Ice Ed files in Drive
const RECIPE_PREFIX = 'ice-ed-recipe-';
const INGREDIENTS_FILE = 'ice-ed-ingredients.json';
const MIME_TYPE = 'application/json';

// App properties for identifying Ice Ed files
const APP_PROPERTIES = {
  app: 'ice-ed'
};

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
        // Create new file
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
   * @returns {Promise<Array<{name, updatedAt}>>} Array of recipe summaries
   */
  async listRecipes() {
    try {
      if (!isSignedIn()) {
        console.error('Not signed in to Google');
        return [];
      }

      // Query for all Ice Ed recipe files
      const query = `name contains '${RECIPE_PREFIX}' and mimeType='${MIME_TYPE}' and trashed=false`;

      const response = await gapi.client.drive.files.list({
        q: query,
        fields: 'files(id, name, modifiedTime)',
        orderBy: 'modifiedTime desc'
      });

      const files = response.result.files || [];

      // Parse file metadata to extract recipe info
      return files.map(file => {
        // Extract recipe name from filename: ice-ed-recipe-{name}.json -> {name}
        const recipeName = file.name
          .replace(RECIPE_PREFIX, '')
          .replace('.json', '');

        return {
          name: recipeName,
          updatedAt: file.modifiedTime
        };
      });
    } catch (error) {
      console.error('Failed to list recipes from Drive:', error);
      return [];
    }
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
        // Create new file
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
 * Find a file in Drive by exact name
 * @param {string} name - Exact filename to search for
 * @returns {Promise<Object|null>} File metadata or null if not found
 */
async function findFileByName(name) {
  try {
    const query = `name='${name}' and mimeType='${MIME_TYPE}' and trashed=false`;

    const response = await gapi.client.drive.files.list({
      q: query,
      fields: 'files(id, name, modifiedTime)',
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
 * Upload a new file to Drive
 * @param {string} name - Filename
 * @param {Object} content - File content (will be JSON stringified)
 * @param {string} type - File type for appProperties ('recipe' or 'ingredients')
 * @returns {Promise<Object>} Created file metadata
 */
async function uploadFile(name, content, type) {
  const fileMetadata = {
    name: name,
    mimeType: MIME_TYPE,
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
 * Initialize Google Drive storage and return validated instance
 * @returns {Object} Validated storage instance via createStorage()
 */
export function initGoogleDriveStorage() {
  return createStorage(GoogleDriveStorage);
}
