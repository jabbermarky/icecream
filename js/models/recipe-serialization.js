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
//
// VERSION HISTORY
//   v1 — {SchemaVersion?, Recipe, Ingredients}. Absence of SchemaVersion IS v1.
//   v2 (P0.3) — adds container-level identity: RecipeId (minted by the SAVE
//     path, never by this module and never on load) and SavedAt (author-time
//     clock stamped at snapshot time, because both storage backends re-stamp
//     updatedAt at WRITE time and Drive's LWW compares file modifiedTime, so
//     the storage clock lies about which edit is newer).
//
// Identity is deliberately NOT validated by containerProblem: a v2 record
// whose RecipeId was stripped (a pre-P0.2 client rewrote it) still has an
// intact payload, and refusing it would lock the user out of their own recipe
// over damage that is not their fault. Identity problems are ADVISORY —
// containerIdentityWarning below — and the record re-mints on its next save.

import { cRecipe } from './core.js';

export const RECIPE_SCHEMA_VERSION = 2;

/**
 * Freeze a PLAIN-object/array graph in place, cycle-safe.
 *
 * The isFrozen check is the cycle guard, not an optimization: structuredClone
 * PRESERVES cycles, so a naive recursion over a self-referencing record would
 * not terminate. A node is frozen before its children are visited, so a cycle
 * back to it returns immediately.
 *
 * KNOWN LIMIT (review finding, measured): this only walks Object.keys, so the
 * container types structuredClone preserves but Object.keys does not enumerate
 * — Map, Set, Date, typed arrays — are marked frozen while their CONTENTS stay
 * mutable (`map.set(...)`, `date.setTime(...)` both succeed on a "frozen"
 * snapshot), and objects reachable only through a Map/Set are never visited at
 * all. Recipes hold no such values today; the guarantee below is therefore
 * accurate for the shapes actually built, and narrower than "any object graph".
 * @param {*} value
 * @returns {*} the same value
 */
function deepFreeze(value) {
    if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
    // Object.freeze THROWS on a typed array with elements ("Cannot freeze array
    // buffer views with elements") — a value structuredClone accepts and
    // IndexedDB stores natively. Freezing must never be the reason a storable
    // recipe cannot be saved OR exported, so skip what cannot be frozen and
    // keep going. Measured, not theorised (review finding).
    if (ArrayBuffer.isView(value)) return value;
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
 * producing a third version of the record. This holds for the plain
 * objects/arrays a recipe is made of; see deepFreeze for the Map/Set/Date
 * limit.
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
 * IDENTITY (P0.3). The builder STAMPS identity; it never mints it. Minting
 * policy lives in the save path (mint on save only — never on load, never on
 * a startup scan — so an id is born exactly once, on one device, inside the
 * record itself, and sync carries it everywhere). The rules here:
 *   - identity omitted/null            → v2 container WITHOUT RecipeId. Legal:
 *     that is what an unidentified legacy recipe's first save looks like the
 *     moment before the save path mints. Readers warn (containerIdentityWarning)
 *     but load.
 *   - identity.RecipeId null/undefined → same as omitted (caller has none).
 *   - identity.RecipeId invalid        → TypeError. A garbage id is a
 *     programmer error, not a data state; fail at the line that did it.
 * SavedAt is stamped unconditionally: it is the author-time clock the sync
 * merge needs, because updatedAt is re-stamped by every backend at write time.
 *
 * @param {cRecipe} recipe - The recipe to serialize
 * @param {Object} ingredientLibrary - Name → cIngredient map
 * @param {Function} warn - Called with a message per ingredient missing from the library
 * @param {?{RecipeId: ?string}} [identity] - The record's identity, if it has one
 * @returns {Object} The frozen, detached container
 */
export function buildRecipeContainer(recipe, ingredientLibrary, warn, identity) {
    const container = {
        SchemaVersion: RECIPE_SCHEMA_VERSION,
        SavedAt: new Date().toISOString(),
        Recipe: recipe,
        Ingredients: {}
    };
    if (identity !== undefined && identity !== null &&
        identity.RecipeId !== undefined && identity.RecipeId !== null) {
        if (!isValidRecipeId(identity.RecipeId))
            throw new TypeError("buildRecipeContainer: invalid RecipeId " +
                JSON.stringify(identity.RecipeId) + " — mint with crypto.randomUUID()");
        container.RecipeId = identity.RecipeId;
    }
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
 *   - garbage SchemaVersion (true, NaN, "")   → damaged-record message
 *   - genuinely newer schema                  → update-the-app message
 *   - Recipe missing / null / not an object   → damaged-record message
 *   - Ingredients present but not a plain map → damaged-record message
 * Callers run this BEFORE any mutation (backup, importIngredients) and stop
 * on non-null.
 *
 * Ingredients is validated because the gate's whole job is to run before
 * importIngredients touches the live library (review finding): an array there
 * merges entries under numeric keys "0", "1" into the user's ingredient
 * library, and a string throws mid-merge. Absent is allowed — a record with no
 * ingredient definitions is legal and importIngredients handles the empty case.
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
    const ing = container.Ingredients;
    if (ing !== undefined && ing !== null &&
        (typeof ing !== 'object' || Array.isArray(ing))) return invalidContainerMessage();
    // RecipeId is DELIBERATELY not checked here (P0.3 review, decision 7): a
    // v2 record with a stripped id has an intact payload, and this gate
    // refusing it would lock the user out with no repair path. Identity is
    // advisory — see containerIdentityWarning.
    return null;
}

// --- Identity (P0.3) — advisory, OUTSIDE the fail-closed gate above ---

/**
 * Whether a value is a usable RecipeId: a non-empty string. Deliberately
 * looser than "a UUID" — hand-authored .ier files are legal input, and the
 * only property the system relies on is stable non-empty string equality.
 * @param {*} v
 * @returns {boolean}
 */
export function isValidRecipeId(v) {
    return typeof v === 'string' && v.trim() !== '';
}

/**
 * The container's RecipeId, or null when it has none worth trusting.
 * Version-agnostic on purpose: a valid id is returned even off a v1-shaped
 * container (hand-made files exist), and garbage is null everywhere.
 * @param {Object} container
 * @returns {string|null}
 */
export function containerRecipeId(container) {
    if (!container || typeof container !== 'object') return null;
    return isValidRecipeId(container.RecipeId) ? container.RecipeId : null;
}

/**
 * ADVISORY identity warning — or null when there is nothing to say.
 *
 * Non-null only for a container that (a) passes the fail-closed gate, so the
 * refusal messages own every unloadable case, and (b) claims a schema that
 * includes identity (v2+), and (c) carries no usable RecipeId. A v1/legacy
 * container never warns: absence is what pre-identity records look like.
 *
 * Callers SHOW this and LOAD ANYWAY (decision 7). The record re-mints on its
 * next save; any restore affordance must be a user-confirmed action through
 * the normal save path, never a write triggered from load.
 * @param {Object} container
 * @returns {string|null}
 */
export function containerIdentityWarning(container) {
    if (containerProblem(container)) return null;
    if (containerSchemaVersion(container) < 2) return null;
    if (containerRecipeId(container)) return null;
    return "This recipe record should carry an identity but does not — an " +
        "older version of Ice Ed may have rewritten it. It was loaded " +
        "normally and will receive a new identity the next time you save; " +
        "any batch history linked to its old identity will not follow.";
}

/**
 * Hydrate a fresh cRecipe from a container. Copies exactly the fields the
 * current cRecipe declares — the same declared-fields filter the two previous
 * inline loops applied, now in one place.
 *
 * Returns null for ANY container containerProblem() rejects — newer schema,
 * garbage SchemaVersion, or a damaged Recipe shape. Callers must treat null as
 * "do not touch the current recipe and do not write anything": show
 * containerProblem(container) and stop. (Do not show newerSchemaMessage()
 * unconditionally — it would tell a user with a corrupted record to update the
 * app.)
 *
 * NOTE: fields are copied by REFERENCE from the container, Ingredients
 * included. Every current caller hydrates from parsed JSON or an IndexedDB
 * record, so the container is already a private, mutable copy. An in-memory
 * build→hydrate round-trip (a future undo or duplicate feature) is the case
 * that breaks, because P0.5 makes buildRecipeContainer return a DEEPLY FROZEN
 * snapshot. The FIRST casualty is not this function: on the library-load
 * ordering importIngredients runs before hydration and write-backs into its
 * argument (ingredients.js: `dataObj[key] = Object.assign(...)`), so a frozen
 * container.Ingredients throws there first. Hydration is the second: the
 * recipe would take the frozen Ingredients array as its own and the next
 * addIngredient would throw. Clone at both points if this becomes a call
 * pattern.
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
