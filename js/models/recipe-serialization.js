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
 * Build the persistable {SchemaVersion, Recipe, Ingredients} container used by
 * both library save and .ier export.
 *
 * NOTE: container.Recipe is the LIVE recipe object, not a clone — pinned by
 * the P0.1 characterization tests. P0.5 (one canonical save path on an
 * immutable structuredClone) changes that deliberately; this module must not
 * change it as a side effect.
 *
 * @param {cRecipe} recipe - The recipe to serialize
 * @param {Object} ingredientLibrary - Name → cIngredient map
 * @param {Function} warn - Called with a message per ingredient missing from the library
 * @returns {Object} The container
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
    return container;
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
 * NOTE: Ingredients is copied by REFERENCE from the container. Every current
 * caller hydrates from parsed JSON or an IndexedDB structured clone, so the
 * container is already a private copy — but an in-memory build→hydrate
 * round-trip (a future undo or duplicate feature) would share the live
 * Ingredients array between container and recipe. Copy it if that ever
 * becomes a call pattern.
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
