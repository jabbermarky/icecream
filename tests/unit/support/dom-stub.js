// Minimal DOM stand-ins for the node unit test lane.
//
// The app's modules never touch the DOM at import time (dependencies are
// injected, DOM access is lazy inside handlers), so a small set of generic
// stubs is enough to drive the real handler functions in node. These stubs
// absorb DOM calls; they do not emulate layout, rendering, or events.
//
// What they cannot absorb: full-fidelity rendering paths (DisplayRecipe's
// table rebuild). Tests that cross those paths assert on state captured
// BEFORE rendering and treat a render-time throw as expected in node — the
// Playwright suite covers rendering in a real browser.

/** A generic element: accepts any property, absorbs common DOM methods. */
export function makeElement(tag = 'div') {
  const el = {
    tagName: String(tag).toUpperCase(),
    style: {},
    attributes: {},
    childNodes: [],
    children: [],
    value: '',
    innerHTML: '',
    innerText: '',
    textContent: '',
    disabled: false,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return this.attributes[k]; },
    appendChild(c) { this.childNodes.push(c); this.children.push(c); return c; },
    insertBefore(c) { this.childNodes.unshift(c); this.children.unshift(c); return c; },
    removeChild(c) { return c; },
    replaceWith() {},
    replaceChildren() { this.childNodes = []; this.children = []; },
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
    focus() {},
    click() {},
    getContext() { return contextAbsorber(); },
    querySelector: () => makeElement(),
    querySelectorAll: () => [],
    closest: () => null,
    get firstChild() { return this.childNodes[0]; },
    get lastChild() { return this.childNodes[this.childNodes.length - 1]; },
  };
  return el;
}

/** Canvas-context absorber: any method call succeeds, any property reads back. */
function contextAbsorber() {
  return new Proxy(function () {}, {
    get: (t, p) => (p === Symbol.toPrimitive ? () => 0 : contextAbsorber()),
    set: () => true,
    apply: () => contextAbsorber(),
  });
}

/** Blobs captured by the URL.createObjectURL override, newest last. */
export const capturedBlobs = [];

const elementCache = new Map();

/** Install document/window/etc. globals. Call once per test file, before importing app modules is fine too (modules only touch DOM lazily). */
export function installDom() {
  globalThis.document = {
    getElementById(id) {
      if (!elementCache.has(id)) elementCache.set(id, makeElement('div'));
      return elementCache.get(id);
    },
    createElement: (tag) => makeElement(tag),
    createTextNode: (text) => ({ textContent: text }),
    createEvent: () => ({ initMouseEvent() {} }),
    documentElement: makeElement('html'),
    body: makeElement('body'),
  };
  globalThis.window = { print() {} };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  globalThis.confirm = () => true;
  URL.createObjectURL = (blob) => {
    capturedBlobs.push(blob);
    return `blob:stub-${capturedBlobs.length}`;
  };
  globalThis.FileReader = class {
    readAsText(file) {
      this.result = file.__content;
      if (this.onload) this.onload();
    }
  };
}

/** Reset captured state between tests. */
export function resetDom() {
  capturedBlobs.length = 0;
  elementCache.clear();
}

/** A fake File for the load-recipe input: only what the stub FileReader reads. */
export function makeFile(content, name = 'test.ier') {
  return { __content: content, name };
}
