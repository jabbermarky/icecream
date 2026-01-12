// File I/O Utilities
// Handles saving and loading of recipe and ingredient files

import { clickOn } from './helpers.js';

/**
 * Save a JavaScript object to a file download
 * @param {Object} jsObject - The data to save
 * @param {string} fileName - The filename for the download
 * @param {string} fileId - File type identifier (e.g., 'IER', 'IEI')
 * @param {number} fileVersion - File format version
 * @param {Function} replacerFunction - Optional JSON replacer function
 */
export function saveToFile(jsObject, fileName, fileId, fileVersion, replacerFunction = null) {
    var link = document.createElement('a');
    const obj = { id: fileId, version: fileVersion, data: jsObject };
    link.setAttribute('href', URL.createObjectURL(new Blob([JSON.stringify(obj, replacerFunction, '\t')], {
        type: 'application/octet-stream'
    })));
    link.setAttribute('download', fileName);

    clickOn(link);
}

/**
 * Save ingredients to a file with custom formatting
 * @param {Object} ingredients - The ingredients object to save
 */
export function saveIngredientsToFile(ingredients) {
    const headerObj = {
        id: "IEI",
        version: 1,
        data: "$DATA$"
    };
    const content = JSON.stringify(ingredients, (key, value) => { return value == 0.0 ? undefined : value; }, " ").replaceAll('\n', '').replaceAll('},', "},\n");
    var link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(new Blob([JSON.stringify(headerObj, null, '\t').replace("\"$DATA$\"", '\n' + content)], {
        type: 'application/octet-stream'
    })));
    link.setAttribute('download', 'Ingredients.iei');
    clickOn(link);
}

/**
 * Parse and validate a recipe file
 * @param {string} content - The file content as string
 * @returns {Object} Parsed data object or null if invalid
 */
export function parseRecipeFile(content) {
    try {
        const dataObj = JSON.parse(content);
        if (!dataObj.hasOwnProperty('id') || !dataObj.hasOwnProperty('version') || !dataObj.hasOwnProperty('data')
            || dataObj.id != 'IER' || dataObj.version != 1) {
            return null;
        }
        return dataObj;
    } catch (e) {
        return null;
    }
}

/**
 * Parse and validate an ingredients file
 * @param {string} content - The file content as string
 * @returns {Object} Parsed data object or null if invalid
 */
export function parseIngredientsFile(content) {
    try {
        const dataObj = JSON.parse(content);
        if (dataObj.hasOwnProperty('id') && dataObj.hasOwnProperty('version') && dataObj.hasOwnProperty('data')
            && dataObj.id == 'IEI' && dataObj.version == 1) {
            return dataObj;
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Read a file and return its contents as text
 * @param {File} file - The file to read
 * @returns {Promise<string>} The file contents
 */
export function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}
