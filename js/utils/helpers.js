/**
 * Helper utility functions
 * Step 1 of modularization - extracted from app.js
 */

// Locale-specific decimal separator (e.g., '.' in US, ',' in EU)
export const decimalSeparator = (1.1).toLocaleString().substring(1, 2);

/**
 * Parse a string to float, handling locale-specific decimal separators
 * @param {string} string - The string to parse
 * @returns {number} - The parsed float or NaN if invalid
 */
export function toFloat(string) {
    string = string.replaceAll(decimalSeparator, '.');
    if (string.match("-?[0-9]+(\.[0-9]+)?"))
        return Number(string);
    return NaN;
}

/**
 * Programmatically trigger a click event on an element
 * @param {HTMLElement} element - The element to click
 */
export function clickOn(element) {
    var event = document.createEvent('MouseEvents');
    event.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
    element.dispatchEvent(event);
}

