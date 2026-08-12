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
        if (ingredientLibrary.hasOwnProperty(ingredient.Name)) {
            container.Ingredients[ingredient.Name] = ingredientLibrary[ingredient.Name].copy();
            for (const key in container.Ingredients[ingredient.Name])
                if (container.Ingredients[ingredient.Name][key] == 0.0)
                    delete container.Ingredients[ingredient.Name][key];
        } else
            warn("Recipe is using undefined ingredient " + ingredient.Name);
    return container;
}

/**
 * The schema version a container claims. Absent means v1: every record written
 * before SchemaVersion existed has exactly the v1 shape.
 * @param {Object} container
 * @returns {number}
 */
export function containerSchemaVersion(container) {
    const v = container ? container.SchemaVersion : undefined;
    return typeof v === 'number' ? v : 1;
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
 * The user-facing refusal message, shared by every caller so the load paths
 * cannot drift apart in what they tell the user.
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
 * Hydrate a fresh cRecipe from a container. Copies exactly the fields the
 * current cRecipe declares — the same declared-fields filter the two previous
 * inline loops applied, now in one place.
 *
 * Returns null when the container claims a newer schema (see the refusal rule
 * above). Callers must treat null as "do not touch the current recipe and do
 * not write anything": show newerSchemaMessage() and stop.
 *
 * @param {Object} container - A {SchemaVersion?, Recipe, Ingredients} container
 * @param {Object} defaults - Optional cRecipe constructor defaults
 * @returns {cRecipe|null}
 */
export function hydrateRecipe(container, defaults = {}) {
    if (isNewerSchema(container)) return null;
    const recipe = new cRecipe("", "", defaults);
    for (const key in recipe)
        if (container.Recipe.hasOwnProperty(key))
            recipe[key] = container.Recipe[key];
    return recipe;
}
