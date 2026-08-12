// Characterization tests for js/utils/file-io.js — pins CURRENT behaviour
// of the .ier/.iei file envelope before the P0.2 versioned serializer lands.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, resetDom, capturedBlobs } from './support/dom-stub.js';

installDom();

const { parseRecipeFile, parseIngredientsFile, saveToFile } =
  await import('../../js/utils/file-io.js');

test('parseRecipeFile accepts a valid IER v1 envelope and returns it verbatim', () => {
  const envelope = { id: 'IER', version: 1, data: { Recipe: { Name: 'X' }, Ingredients: {} } };
  const parsed = parseRecipeFile(JSON.stringify(envelope));
  assert.deepEqual(parsed, envelope);
});

test('parseRecipeFile keeps unknown top-level fields — no validation beyond id/version/data', () => {
  const envelope = { id: 'IER', version: 1, data: {}, futureField: 'kept' };
  const parsed = parseRecipeFile(JSON.stringify(envelope));
  assert.equal(parsed.futureField, 'kept');
});

test('parseRecipeFile rejects an unknown NEWER version (returns null, no partial read)', () => {
  // Load-bearing for P0.2: the current reader already refuses unknown schema
  // versions outright rather than attempting a partial parse.
  const v2 = { id: 'IER', version: 2, data: {} };
  assert.equal(parseRecipeFile(JSON.stringify(v2)), null);
});

test('parseRecipeFile rejects wrong id, missing keys, and invalid JSON', () => {
  assert.equal(parseRecipeFile(JSON.stringify({ id: 'IEI', version: 1, data: {} })), null);
  assert.equal(parseRecipeFile(JSON.stringify({ version: 1, data: {} })), null);
  assert.equal(parseRecipeFile(JSON.stringify({ id: 'IER', data: {} })), null);
  assert.equal(parseRecipeFile(JSON.stringify({ id: 'IER', version: 1 })), null);
  assert.equal(parseRecipeFile('not json {'), null);
});

test('parseRecipeFile accepts version "1" as a string — loose equality', () => {
  // Documents the current != (not !==) comparison; a schema bump must not
  // accidentally tighten this without deciding to.
  const stringVersion = { id: 'IER', version: '1', data: {} };
  assert.notEqual(parseRecipeFile(JSON.stringify(stringVersion)), null);
});

test('parseIngredientsFile accepts IEI v1 and rejects IER', () => {
  assert.notEqual(parseIngredientsFile(JSON.stringify({ id: 'IEI', version: 1, data: {} })), null);
  assert.equal(parseIngredientsFile(JSON.stringify({ id: 'IER', version: 1, data: {} })), null);
});

test('saveToFile wraps the payload as {id, version, data} and emits one blob', async () => {
  resetDom();
  saveToFile({ hello: 'world' }, 'test.ier', 'IER', 1);
  assert.equal(capturedBlobs.length, 1);
  const written = JSON.parse(await capturedBlobs[0].text());
  assert.deepEqual(written, { id: 'IER', version: 1, data: { hello: 'world' } });
});
