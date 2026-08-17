// Range checking for the recipe Info panel.
//
// WHAT WAS WRONG (issue #15). The Info block printed two bands as literal text:
//
//     Normalize(sums, sums.PAC) + " PAC (220 - 230)"
//     Normalize(sums, sums.POD) + " POD (110 - 120)"
//
// Neither was a value. Neither was compared to anything. Both were inherited
// verbatim from the original single-file app (`IceEd.html:1743`), where they
// were the upstream author's numbers FOR GELATO -- not a spec, and not this
// recipe's type. The binder audit read them as "the type's range" and concluded
// the guardrail was decorative. It was worse than decorative: it was fiction
// printed next to a real number, in a place that made it look authoritative.
//
// Cranberry v1.2 is the case that matters. It printed "347 PAC (220 - 230)" and
// an Error row of 0%. Both were true, and the audit called the 0% the lie. It
// was the other way round -- 347 was measured against a constant that applies to
// no type in this app, while the Error row measured against the PAC actually
// required for that recipe's hardness at its serving temperature. The number
// that looked wrong was right.
//
// WHAT THIS MODULE DOES. Two ranges, both real:
//
//   POD -- comes from the TYPE, and already exists. cTarget carries a POD
//     fraction-of-mass range per type; multiplying by 1000 puts it on the
//     per-kilo scale the panel displays. No new domain data is invented.
//
//   PAC -- has no per-type range anywhere in this codebase, and inventing PAC
//     bands for twelve dessert types is not something a refactor gets to do.
//     The real target is derived: GetIdealPAC answers "what PAC does this
//     recipe need for the hardness it is set to, at the serving temperature it
//     is set to". That is a better target than a fixed band, because it follows
//     the user's stated intent. This module only puts it on the display scale.
//
// Pure: no DOM, no globals, no imports beyond the target table. The panel that
// consumes it is being replaced with the UI, so the logic lives here where the
// replacement inherits it.

import { Targets } from '../models/core.js';

/** Grams per kilogram of mix — the scale the Info panel prints PAC and POD on. */
export const PER_KILO = 1000;

/**
 * Put an absolute quantity on the per-kilo display scale.
 * Mirrors the panel's own `Normalize`, which is module-private there.
 * @param {number} value - absolute quantity, same units as amount
 * @param {number} amount - total mix mass
 * @returns {?number} value per kilo, or null when amount is not usable
 */
export function toPerKilo(value, amount) {
    if (!Number.isFinite(value) || !Number.isFinite(amount) || amount <= 0) return null;
    return Math.round(PER_KILO / amount * value);
}

/**
 * The POD range for an ice cream type, on the per-kilo display scale.
 *
 * `cTarget.POD` is a fraction of total mass (Gelato is 0.13–0.17), so ×1000 is
 * the whole conversion. This is the range the app has always held and never
 * shown — the panel showed 110–120 instead, which matches NO type.
 *
 * @param {string} typeName - a key of Targets, e.g. "Gelato"
 * @returns {?{min: number, max: number}} null for an unknown type
 */
export function podRangeForType(typeName) {
    const target = Targets[typeName];
    if (!target || !target.POD) return null;
    const { Min, Max } = target.POD;
    if (!Number.isFinite(Min) || !Number.isFinite(Max)) return null;
    return { min: Math.round(Min * PER_KILO), max: Math.round(Max * PER_KILO) };
}

/**
 * The PAC range implied by the ideal PAC for this recipe's hardness and
 * serving temperature, on the per-kilo display scale.
 *
 * The tolerance band matches the one the display path already applies
 * (`-2% / +3%`). NOTE that the optimizer's `Fitness` uses ±5% around the same
 * derived value — two different bands on one quantity, which is a real
 * inconsistency but a separate question from this issue.
 *
 * @param {number} idealPacPerGram - GetIdealPAC(...) / sums.Amount
 * @returns {?{min: number, max: number}}
 */
export function pacRangeFromIdeal(idealPacPerGram) {
    if (!Number.isFinite(idealPacPerGram) || idealPacPerGram <= 0) return null;
    const perKilo = idealPacPerGram * PER_KILO;
    return { min: Math.round(perKilo * 0.98), max: Math.round(perKilo * 1.03) };
}

/**
 * Where a value sits relative to a range.
 *
 * `unknown` is a distinct state from in-range on purpose: a missing range means
 * nothing was checked, and rendering that as "fine" is the failure this whole
 * issue is about.
 *
 * @param {?number} value
 * @param {?{min: number, max: number}} range
 * @returns {{state: 'unknown'|'ok'|'below'|'above', value: ?number, range: ?Object}}
 */
export function rangeVerdict(value, range) {
    if (!Number.isFinite(value) || !range
        || !Number.isFinite(range.min) || !Number.isFinite(range.max)) {
        return { state: 'unknown', value: null, range: null };
    }
    const state = value < range.min ? 'below' : value > range.max ? 'above' : 'ok';
    return { state, value, range };
}

/**
 * The range as the panel prints it, or a placeholder when there is none.
 * @param {?{min: number, max: number}} range
 * @returns {string}
 */
export function formatRange(range) {
    if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max)) return '—';
    return `${range.min} – ${range.max}`;
}

/**
 * A short marker for an out-of-range value, or '' when there is nothing to say.
 *
 * Deliberately terse: this sits in a dense info block, and the job is to make a
 * violation VISIBLE, not to explain it. `unknown` says so rather than staying
 * silent, because silence is what let 347 sit next to a fiction unremarked.
 *
 * @param {{state: string}} verdict
 * @returns {string}
 */
export function verdictMarker(verdict) {
    switch (verdict.state) {
        case 'above': return 'over';
        case 'below': return 'under';
        case 'unknown': return 'not checked';
        default: return '';
    }
}
