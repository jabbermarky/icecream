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

/**
 * Round a value to appropriate precision based on its magnitude
 * @param {number} value - The value to round
 * @returns {number} - The rounded value
 */
export function round(value) {
    if (value == 0)
        return 0;
    const precision = 2;
    const decimalShift = Math.max(Math.pow(10, Math.min(precision - Math.floor(Math.log10(Math.abs(value))), 2)), 1);
    return Math.round(value * decimalShift) / decimalShift;
}

/**
 * Generator that yields n items created by a functor
 * @param {number} count - Number of items to generate
 * @param {function} functor - Function to call for each item
 */
export function* nGenerator(count, functor) {
    var i = 0;
    for (; i < count; ++i) {
        yield functor(i);
    }
    return i;
}

/**
 * Check if an object is empty
 * @param {object} obj - The object to check
 * @returns {boolean} - True if empty
 */
export function objIsEmpty(obj) {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
}

/**
 * Filter keyboard input to allow only positive numbers
 * Used as onkeypress handler for number inputs
 * @param {KeyboardEvent} event - The keyboard event
 * @returns {boolean} - Whether to allow the keypress
 */
export function filterPosNumberInput(event) {
    const acceptSeparator = !this.value.includes(decimalSeparator) && !this.value.includes('.');
    const ASCIICode = event.which ? event.which : event.keyCode;
    const isSeparator = String.fromCharCode(ASCIICode) === decimalSeparator || String.fromCharCode(ASCIICode) === '.';
    return (acceptSeparator && isSeparator)
        || (ASCIICode >= 48 && ASCIICode <= 57);
}

/**
 * Filter keyboard input to allow numbers (including negative)
 * Used as onkeypress handler for number inputs
 * @param {KeyboardEvent} event - The keyboard event
 * @returns {boolean} - Whether to allow the keypress
 */
export function filterNumberInput(event) {
    const acceptSeparator = !this.value.includes(decimalSeparator) && !this.value.includes('.');
    const ASCIICode = event.which ? event.which : event.keyCode;
    const isSeparator = String.fromCharCode(ASCIICode) === decimalSeparator || String.fromCharCode(ASCIICode) === '.';
    return (acceptSeparator && isSeparator)
        || (ASCIICode >= 48 && ASCIICode <= 57)
        || (ASCIICode === 45 && event.target.selectionStart === 0); // allow '-' at first position
}

/**
 * Damerau-Levenshtein distance algorithm for fuzzy string matching
 * Used for USDA ingredient search results filtering
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} - Edit distance between strings
 */
export function DamerauLevenshteinDistance(a, b) {
    var i, j;
    const m = a.length, n = b.length;
    if (!m)
        return n;
    if (!n)
        return m;

    var d = [(m + 1) * (n + 1)];

    for (i = 0; i <= m; ++i)
        d[i] = i;
    for (j = 0; j <= n; ++j)
        d[j * (m + 1)] = j;

    for (i = 0; i != m; ++i)
        for (j = 0; j != n; ++j)
            d[(i + 1) + (j + 1) * (m + 1)] = Math.min(
                d[i + (j + 1) * (m + 1)] + 1, //deletion
                d[(i + 1) + j * (m + 1)] + 1,  //insertion
                d[i + j * (m + 1)] + ((a[i] != b[j]) ? 1 : 0), // substitution
                (i && j && a[i] == b[j - 1] && a[i - 1] == b[j]) ? d[(i - 1) + (j - 1) * (m + 1)] + 1 : Number.MAX_SAFE_INTEGER // transposition
            );
    return d[m + n * (m + 1)];
}

