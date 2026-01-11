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
 * Get the entire document HTML as a string, including DOCTYPE
 * Based on: https://stackoverflow.com/questions/817218/how-to-get-the-entire-document-html-as-a-string
 * See also: https://www.npmjs.com/package/document-outerhtml
 * @returns {string} - The complete HTML document as a string
 */
export function getHtmlContent() {
    function nodeToString(node) {
        function doctypeToString(doctype) {
            if (doctype === null)
                return '';
            // Checking with instanceof DocumentType might be neater, but how to get a
            // reference to DocumentType without assuming it to be available globally?
            // To play nice with custom DOM implementations, we resort to duck-typing.
            if (!doctype
                || doctype.nodeType !== doctype.DOCUMENT_TYPE_NODE
                || typeof doctype.name !== 'string'
                || typeof doctype.publicId !== 'string'
                || typeof doctype.systemId !== 'string') {
                throw new TypeError('Expected a DocumentType');
            }
            return `<!DOCTYPE ${doctype.name}`
                + (doctype.publicId ? ` PUBLIC "${doctype.publicId}"` : '')
                + (doctype.systemId ? (doctype.publicId ? `` : ` SYSTEM`) + ` "${doctype.systemId}"` : ``) + `>`;
        }

        switch (node.nodeType) {
            case node.ELEMENT_NODE:
                return node.outerHTML;
            case node.TEXT_NODE:
                // Text nodes should probably never be encountered, but handling them anyway.
                return node.textContent;
            case node.COMMENT_NODE:
                return `<!--${node.textContent}-->`;
            case node.DOCUMENT_TYPE_NODE:
                return doctypeToString(node);
            default:
                throw new TypeError(`Unexpected node type: ${node.nodeType}`);
        }
    }
    return [...document.childNodes].map(node => nodeToString(node)).join('\n'); // could use '' instead, but whitespace should not matter.
}
