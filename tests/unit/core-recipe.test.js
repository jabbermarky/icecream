// Characterization tests for cRecipe (js/models/core.js) — pins CURRENT
// behaviour before Phase 0 touches identity (P0.3) and copy (P0.6).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './support/dom-stub.js';

installDom();

const { cRecipe } = await import('../../js/models/core.js');

test('constructor defaults: Standard, -18°C, hardness 0.75, overrun 0.3, no ingredients', () => {
  const r = new cRecipe('Vanilla');
  assert.equal(r.Name, 'Vanilla');
  assert.equal(r.Type, 'Standard');
  assert.equal(r.ServingTemperature, -18);
  assert.equal(r.Hardness, 0.75);
  assert.equal(r.Overrun, 0.3);
  assert.deepEqual(r.Ingredients, []);
});

test('copyFrom clones EVERY own field verbatim — including fields cRecipe does not declare', () => {
  // THE identity hazard behind P0.6: Object.assign copies unknown fields, so
  // a future stable id would be cloned verbatim and copy === rename today.
  const original = new cRecipe('Base');
  original.id = 'future-stable-id';
  const copy = cRecipe.copyFrom(original);
  assert.equal(copy.id, 'future-stable-id');
  assert.notEqual(copy, original);
});

test('copyFrom gives the copy its own Ingredients array with per-element shallow copies', () => {
  const original = new cRecipe('Base');
  original.addIngredient('Milk', 500);
  const copy = cRecipe.copyFrom(original);

  assert.notEqual(copy.Ingredients, original.Ingredients);
  assert.notEqual(copy.Ingredients[0], original.Ingredients[0]);
  copy.Ingredients[0].Amount = 999;
  assert.equal(original.Ingredients[0].Amount, 500);
});

test('copyFrom ingredient copies are SHALLOW — nested objects stay shared', () => {
  // {...value} spreads one level; anything nested (none exist today, but a
  // future marks/photo ref would) is aliased between original and copy.
  const original = new cRecipe('Base');
  original.addIngredient('Milk', 500);
  original.Ingredients[0].Meta = { note: 'shared' };
  const copy = cRecipe.copyFrom(original);
  copy.Ingredients[0].Meta.note = 'mutated via copy';
  assert.equal(original.Ingredients[0].Meta.note, 'mutated via copy');
});

test('addIngredient appends {Name, Amount} and Amount getter sums', () => {
  const r = new cRecipe('Sum');
  r.addIngredient('Milk', 500);
  r.addIngredient('Sugar', 120);
  r.addIngredient('Zero');
  assert.deepEqual(r.Ingredients[2], { Name: 'Zero', Amount: 0 });
  assert.equal(r.Amount, 620);
});

test('Amount setter scales every ingredient proportionally, rounding per-ingredient', () => {
  const r = new cRecipe('Scale');
  r.addIngredient('Milk', 500);
  r.addIngredient('Sugar', 120);
  r.Amount = 1240;
  assert.equal(r.Ingredients[0].Amount, 1000);
  assert.equal(r.Ingredients[1].Amount, 240);
});

test('Amount setter on a zero-total recipe produces NaN amounts (pinned boundary)', () => {
  // factor = target / 0 → Infinity; 0 * Infinity → NaN. Pinned before Phase 0
  // refactors touch this class, so the divide-by-zero boundary is a recorded
  // fact rather than a surprise.
  const r = new cRecipe('Empty');
  r.addIngredient('Milk', 0);
  r.Amount = 1000;
  assert.ok(Number.isNaN(r.Ingredients[0].Amount));
});
