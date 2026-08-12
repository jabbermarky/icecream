// Recipe serialization — the ONE place a recipe container is built or read.
//
// Before this module there were four filtered copies of this logic: library
// save and .ier export each built the container inline (identically), and
// library load (app.js) and .ier import (recipe-manager.js) each hydrated with
// an identical declared-fields loop. Four copies of a filter is four places a
// new field has to be remembered, and forgetting any one of them silently
// drops the field on the next round-trip.
//
// Two version numbers exist and mean different things:
//   - The .ier ENVELOPE version ({id: 'IER', version: 1, data}) is the file
//     wrapper. parseRecipeFile refuses any envelope that is not exactly v1.
//   - SchemaVersion, on the container itself, is the shape of the record. It
//     travels inside library records and .ier files alike, so the guard below
//     works for both storage backends and the file format at once.
//
// THE REFUSAL RULE (the reason this module exists): a reader that meets a
// SchemaVersion NEWER than it understands must refuse, not hydrate. Hydrating
// a newer record through this version's declared-field filter would strip
// whatever fields the newer schema added, and the very next save would write
// the truncated object back over the full one — a silent, invisible data loss
// with no error and no attribution. Refusing costs an error message;
// truncating costs the user's data.
//
// Records written before this module carry no SchemaVersion; they are v1 by
// definition and hydrate normally.

import { cRecipe } from './core.js';

export const RECIPE_SCHEMA_VERSION = 1;

/**
 * Freeze an object graph in place, cycle-safe.
 *
 * The isFrozen check is the cycle guard, not an optimization: structuredClone
 * PRESERVES cycles, so a naive recursion over a self-referencing record would
 * not terminate. A node is frozen before its children are visited, so a cycle
 * back to it returns immediately.
 * @param {*} value
 * @returns {*} the same value
 */
function deepFreeze(value) {
    if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    return value;
}

/**
 * Build the persistable {SchemaVersion, Recipe, Ingredients} container used by
 * both library save and .ier export.
 *
 * P0.5: the container is a DETACHED, DEEPLY FROZEN snapshot. It was previously
 * a view onto the live recipe (container.Recipe === the live object), which the
 * P0.1 characterization tests pinned as the then-current behaviour.
 *
 * WHY DETACHED. The cloud write is fire-and-forget and serializes LATE:
 * google-drive-storage.saveRecipe awaits findFileByName — a network round trip
 * — before updateFile stringifies the payload. While the container held the
 * live object, any edit made inside that window entered the cloud copy while
 * IndexedDB held the earlier state. The two backends then disagreed with no
 * error, no attribution, and nothing in the UI to suggest a save had captured
 * something other than what was on screen. Snapshotting also pins the record at
 * the moment the user clicked Save, which is the state they were looking at.
 *
 * WHY FROZEN. Detaching alone is a convention any later caller can break by
 * mutating the snapshot between build and write. Module code is strict, so a
 * write to a frozen snapshot throws at the line that does it rather than
 * producing a third version of the record.
 *
 * Cloning drops prototypes: container.Recipe is a plain object, not a cRecipe,
 * and each container.Ingredients entry is a plain object, not a cIngredient.
 * That is what every reader already saw (both backends round-trip through JSON
 * or a structured clone), so this makes the in-memory shape match the persisted
 * one instead of diverging from it. Nothing downstream reads a method off
 * either — hydrateRecipe builds a fresh cRecipe and copies declared fields.
 *
 * THROWS DataCloneError if the recipe holds something unclonable (a function, a
 * DOM node). JSON.stringify used to drop such values silently; this refuses
 * instead. Callers must catch and report — an uncaught throw here reaches the
 * user as Save doing nothing at all.
 *
 * @param {cRecipe} recipe - The recipe to serialize
 * @param {Object} ingredientLibrary - Name → cIngredient map
 * @param {Function} warn - Called with a message per ingredient missing from the library
 * @returns {Object} The frozen, detached container
 */
export function buildRecipeContainer(recipe, ingredientLibrary, warn) {
    const container = {
        SchemaVersion: RECIPE_SCHEMA_VERSION,
        Recipe: recipe,
        Ingredients: {}
    };
    for (const ingredient of recipe.Ingredients)
        if (Object.prototype.hasOwnProperty.call(ingredientLibrary, ingredient.Name)) {
            container.Ingredients[ingredient.Name] = ingredientLibrary[ingredient.Name].copy();
            for (const key in container.Ingredients[ingredient.Name])
                if (container.Ingredients[ingredient.Name][key] == 0.0)
                    delete container.Ingredients[ingredient.Name][key];
        } else
            warn("Recipe is using undefined ingredient " + ingredient.Name);
    // Clone LAST, so the zero-strip above still runs against the mutable
    // cIngredient copies and the snapshot is taken of the finished shape.
    return deepFreeze(structuredClone(container));
}

/**
 * The schema version a container claims.
 *
 * FAIL CLOSED on garbage (review finding, confirmed by three independent
 * passes): the first version of this function mapped every non-number to 1,
 * so a record carrying SchemaVersion "2" (string) bypassed the refusal rule
 * and was silently truncated — the exact loss this module exists to prevent.
 * String versions are a realistic shape here: the .ier envelope check is
 * loose-equality and its tests deliberately pin that "1" is accepted.
 *
 * The rules, in order:
 *  - ABSENT (or null): v1. Every record written before SchemaVersion existed
 *    has exactly the v1 shape — absence is what legacy looks like.
 *  - A number or numeric string: its numeric value ("2" is a newer writer
 *    that happened to stringify, and must refuse as 2, not hydrate as 1).
 *  - Anything else (true, NaN, '', objects): Infinity — present-but-garbage
 *    is corruption, not legacy, and corruption refuses.
 * @param {Object} container
 * @returns {number}
 */
export function containerSchemaVersion(container) {
    const v = container ? container.SchemaVersion : undefined;
    if (v === undefined || v === null) return 1;
    if (typeof v !== 'number' && typeof v !== 'string') return Infinity;
    if (typeof v === 'string' && v.trim() === '') return Infinity;
    const n = Number(v);
    return Number.isFinite(n) ? n : Infinity;
}

/**
 * True when the container was written by a NEWER schema than this code
 * understands — the one case where hydration must refuse.
 * @param {Object} container
 * @returns {boolean}
 */
export function isNewerSchema(container) {
    return containerSchemaVersion(container) > RECIPE_SCHEMA_VERSION;
}

/**
 * The user-facing refusal message for a genuinely newer schema.
 * @param {Object} container
 * @returns {string}
 */
export function newerSchemaMessage(container) {
    return "This recipe was saved by a newer version of Ice Ed " +
        "(schema " + containerSchemaVersion(container) + "; this version reads up to " +
        RECIPE_SCHEMA_VERSION + "). Loading it here would silently drop the newer fields " +
        "on your next save, so it was not loaded. Update the app to open it.";
}

/**
 * The user-facing refusal message for a damaged or unrecognizable record.
 * Distinct from newerSchemaMessage on purpose: telling a user with a
 * corrupted file to "update the app" would be a lie (review finding — the
 * null return was overloaded and every caller assumed newer-schema).
 * @returns {string}
 */
export function invalidContainerMessage() {
    return "This recipe record is damaged or has an unrecognized shape, so it " +
        "was not loaded. The stored copy was left untouched.";
}

/**
 * Why a container cannot be hydrated, as a user-facing message — or null when
 * it can. THE one refusal gate, shared by every load path, so refusals are
 * identical everywhere and each cause gets a truthful message:
 *   - garbage SchemaVersion (true, NaN, "")  → damaged-record message
 *   - genuinely newer schema                 → update-the-app message
 *   - Recipe missing / null / not an object → damaged-record message
 * Callers run this BEFORE any mutation (backup, importIngredients) and stop
 * on non-null.
 * @param {Object} container
 * @returns {string|null}
 */
export function containerProblem(container) {
    if (!container || typeof container !== 'object') return invalidContainerMessage();
    const v = containerSchemaVersion(container);
    if (!Number.isFinite(v)) return invalidContainerMessage();
    if (v > RECIPE_SCHEMA_VERSION) return newerSchemaMessage(container);
    const r = container.Recipe;
    if (!r || typeof r !== 'object' || Array.isArray(r)) return invalidContainerMessage();
    return null;
}

/**
 * Hydrate a fresh cRecipe from a container. Copies exactly the fields the
 * current cRecipe declares — the same declared-fields filter the two previous
 * inline loops applied, now in one place.
 *
 * Returns null when the container claims a newer schema (see the refusal rule
 * above). Callers must treat null as "do not touch the current recipe and do
 * not write anything": show newerSchemaMessage() and stop.
 *
 * NOTE: fields are copied by REFERENCE from the container, Ingredients
 * included. Every current caller hydrates from parsed JSON or an IndexedDB
 * record, so the container is already a private, mutable copy. An in-memory
 * build→hydrate round-trip (a future undo or duplicate feature) is the case
 * that breaks: since P0.5 buildRecipeContainer returns a DEEPLY FROZEN
 * snapshot, the hydrated recipe would take that frozen Ingredients array as
 * its own and the next addIngredient would throw. Clone the array here if that
 * ever becomes a call pattern.
 *
 * @param {Object} container - A {SchemaVersion?, Recipe, Ingredients} container
 * @returns {cRecipe|null}
 */
export function hydrateRecipe(container) {
    if (containerProblem(container)) return null;
    const recipe = new cRecipe("");
    // hasOwnProperty via the prototype, not the instance: JSON happily creates
    // an own key literally named "hasOwnProperty", which would shadow the
    // method and throw mid-hydration (red-team finding — survives any fix
    // that merely type-checks Recipe as an object).
    for (const key in recipe)
        if (Object.prototype.hasOwnProperty.call(container.Recipe, key))
            recipe[key] = container.Recipe[key];
    return recipe;
}
