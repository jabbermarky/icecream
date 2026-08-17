// Tests for js/features/target-ranges.js — issue #15.
//
// The load-bearing test here is "no type has a POD range of 110–120". That is
// the finding the issue turned on: the band the app printed for years matched
// none of its own twelve types, because it was the upstream author's gelato
// numbers carried over from the single-file original.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
    PER_KILO, toPerKilo, podRangeForType, pacRangeFromIdeal,
    rangeVerdict, formatRange, verdictMarker,
} = await import('../../js/features/target-ranges.js');
const { Targets } = await import('../../js/models/core.js');

// --- The finding this issue rests on ---

test('NO type has a POD range of 110–120 — the band the app printed for years', () => {
    const offenders = [];
    for (const name of Object.keys(Targets)) {
        const r = podRangeForType(name);
        if (r && r.min === 110 && r.max === 120) offenders.push(name);
    }
    assert.deepEqual(offenders, [],
        'if a type ever legitimately has 110–120, the issue #15 story needs revisiting');
});

test('every type produces a usable POD range — no silent gaps', () => {
    for (const name of Object.keys(Targets)) {
        const r = podRangeForType(name);
        assert.ok(r, `${name} has no POD range`);
        assert.ok(r.min <= r.max, `${name} range is inverted`);
    }
});

// --- POD conversion ---

test('POD converts from fraction-of-mass to per-kilo by 1000', () => {
    // Gelato is 0.13–0.17 in cTarget. Spot-checked against the table rather
    // than hardcoded from memory, so a data edit shows up here.
    const gelato = Targets['Gelato'].POD;
    assert.deepEqual(podRangeForType('Gelato'), {
        min: Math.round(gelato.Min * 1000),
        max: Math.round(gelato.Max * 1000),
    });
});

test('Sorbet is far outside the old literal, which is the point', () => {
    const r = podRangeForType('Sorbet');
    assert.ok(r.min >= 200, `Sorbet POD floor is ${r.min}; the printed band claimed 110`);
});

test('an unknown type yields null, not a guess', () => {
    assert.equal(podRangeForType('Semifreddo'), null);
    assert.equal(podRangeForType(''), null);
    assert.equal(podRangeForType(undefined), null);
});

// --- Scale ---

test('toPerKilo matches the panel arithmetic', () => {
    assert.equal(toPerKilo(347, 1000), 347);
    assert.equal(toPerKilo(694, 2000), 347);
    assert.equal(PER_KILO, 1000);
});

test('toPerKilo refuses a zero or absent amount rather than dividing by it', () => {
    for (const bad of [0, -1, NaN, undefined, null]) {
        assert.equal(toPerKilo(100, bad), null, `amount ${bad}`);
    }
});

// --- PAC ---

test('the PAC band comes from the derived ideal, matching the display tolerance', () => {
    const r = pacRangeFromIdeal(0.35);
    assert.deepEqual(r, { min: Math.round(350 * 0.98), max: Math.round(350 * 1.03) });
});

test('a non-positive ideal yields no range instead of a nonsense one', () => {
    for (const bad of [0, -0.2, NaN, undefined]) {
        assert.equal(pacRangeFromIdeal(bad), null, `ideal ${bad}`);
    }
});

// --- Verdicts ---

test('a value inside its range is ok, and the edges are inclusive', () => {
    const range = { min: 130, max: 170 };
    assert.equal(rangeVerdict(150, range).state, 'ok');
    assert.equal(rangeVerdict(130, range).state, 'ok');
    assert.equal(rangeVerdict(170, range).state, 'ok');
});

test('above and below are distinguished — the direction is the actionable part', () => {
    const range = { min: 130, max: 170 };
    assert.equal(rangeVerdict(171, range).state, 'above');
    assert.equal(rangeVerdict(129, range).state, 'below');
    assert.equal(verdictMarker(rangeVerdict(171, range)), 'over');
    assert.equal(verdictMarker(rangeVerdict(129, range)), 'under');
});

test('UNKNOWN is not ok — an unchecked value must never render as fine', () => {
    // This is the whole bug in one assertion. A missing range used to print as
    // a confident-looking band; it now says it was not checked.
    for (const bad of [null, undefined, {}, { min: 1 }, { min: NaN, max: 2 }]) {
        const v = rangeVerdict(150, bad);
        assert.equal(v.state, 'unknown', `range ${JSON.stringify(bad)}`);
        assert.notEqual(v.state, 'ok');
    }
    assert.equal(rangeVerdict(NaN, { min: 1, max: 2 }).state, 'unknown');
    assert.equal(verdictMarker({ state: 'unknown' }), 'not checked');
});

test('an in-range verdict carries no marker', () => {
    assert.equal(verdictMarker(rangeVerdict(150, { min: 130, max: 170 })), '');
});

// --- Formatting ---

test('formatRange prints a real range and a placeholder for none', () => {
    assert.equal(formatRange({ min: 130, max: 170 }), '130 – 170');
    assert.equal(formatRange(null), '—');
    assert.equal(formatRange({ min: 1 }), '—');
});

// --- The regression this exists to prevent ---

test('REGRESSION: Cranberry v1.2 — 347 PAC is IN range for its own ideal', () => {
    // The binder audit called 347 "the largest spec violation in the binder",
    // reading it against the hardcoded 220–230. If the recipe was hitting the
    // PAC its own hardness and serving temperature required, the Error row's 0%
    // was correct and the violation was an artifact of the fiction.
    const idealPerGram = 0.34;               // ~340 per kilo
    const verdict = rangeVerdict(347, pacRangeFromIdeal(idealPerGram));
    assert.equal(verdict.state, 'ok',
        '347 sits inside -2%/+3% of a 340 ideal — the old band was the wrong yardstick');
});
