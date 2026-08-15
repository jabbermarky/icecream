// Build and data diagnostics for the Info & FAQ panel.
//
// This exists because a deployed build could not tell you what it was. The
// version string was hardcoded in app.js and had drifted two releases behind
// package.json, so the app reported 0.4.0 beta while serving 0.5.0.
//
// WHY THE VERSION IS A CONSTANT HERE AND NOT FETCHED FROM package.json:
// the question this panel answers is "what code am I actually running", which
// matters most when a stale cache means the answer is "not what the server has".
// A fetched package.json would report the SERVER's version while the browser ran
// older JS -- confidently telling you the opposite of the truth in exactly the
// case you needed it. The constant ships inside the bundle, so it is stale
// precisely when the bundle is stale. `tests/unit/build-info.test.js` pins it to
// package.json so the two cannot drift silently.

import {
    RECIPE_SCHEMA_VERSION, containerSchemaVersion, containerRecipeId, containerProblem
} from '../models/recipe-serialization.js';

export const APP_VERSION = '0.5.0';

/**
 * Survey the build and the records on THIS device.
 *
 * Pure except for the injected storage, so the node lane can drive it. Never
 * throws: a diagnostics panel that fails is worse than one reporting gaps, and
 * this runs against whatever state the device is actually in.
 *
 * @param {Object} deps
 * @param {?Object} deps.storage - record store (needs listRecipesStrict, loadRecipe)
 * @param {Function} [deps.getIngredients] - returns the ingredient library map
 * @returns {Promise<Object>} the survey
 */
export async function collectBuildInfo({ storage, getIngredients } = {}) {
    const info = {
        version: APP_VERSION,
        schemaVersion: RECIPE_SCHEMA_VERSION,
        ingredients: null,
        storageAvailable: !!storage,
        listingFailed: false,
        recipes: { total: 0, identified: 0, legacy: 0, unreadable: 0, newer: 0 },
    };

    if (typeof getIngredients === 'function') {
        try {
            const lib = getIngredients();
            if (lib) info.ingredients = Object.keys(lib).length;
        } catch { /* diagnostics never throw */ }
    }

    if (!storage) return info;

    let list;
    try {
        // STRICT: a swallowed listing failure would render as "0 recipes", which
        // on this panel reads as "your library is empty" -- the most alarming
        // possible way to report a transient storage error.
        list = await storage.listRecipesStrict();
    } catch {
        info.listingFailed = true;
        return info;
    }

    info.recipes.total = list.length;
    for (const entry of list) {
        let record = null;
        try {
            record = await storage.loadRecipe(entry.name);
        } catch { /* counted as unreadable below */ }

        if (!record || !record.data) { info.recipes.unreadable++; continue; }

        // Order matters. containerSchemaVersion maps GARBAGE to Infinity (fail
        // closed), so a finite check separates "written by a newer build" from
        // "corrupt" -- the same distinction the save path draws before choosing
        // which refusal message to show.
        const v = containerSchemaVersion(record.data);
        if (Number.isFinite(v) && v > RECIPE_SCHEMA_VERSION) { info.recipes.newer++; continue; }
        if (containerProblem(record.data)) { info.recipes.unreadable++; continue; }
        if (containerRecipeId(record.data)) info.recipes.identified++;
        else info.recipes.legacy++;
    }

    return info;
}

/**
 * The one-line verdict for the panel: what, if anything, needs doing.
 *
 * `newer` is the sharpest signal here. A record written under a HIGHER schema
 * than this build can read means another device is ahead of this one -- which,
 * with no cache-busting in the page (issue #26), most often means this tab is
 * running stale JS from cache. That is the exact failure the deploy rollout
 * cannot otherwise detect, and it is visible here for free.
 *
 * @param {Object} info - from collectBuildInfo
 * @returns {{level: string, message: string}}
 */
export function buildInfoVerdict(info) {
    if (!info.storageAvailable)
        return { level: 'warn', message: 'Local storage is unavailable, so nothing can be saved on this device.' };

    if (info.listingFailed)
        return { level: 'warn', message: 'The recipe library could not be read just now, so the counts below are unknown rather than zero.' };

    if (info.recipes.newer > 0)
        return {
            level: 'warn',
            message: `${info.recipes.newer} recipe(s) were saved by a NEWER version of Ice Ed than this tab is running. ` +
                `This tab is probably running an old copy from your browser cache — reload it with Ctrl+Shift+R (Cmd+Shift+R on a Mac) before saving anything.`,
        };

    if (info.recipes.unreadable > 0)
        return {
            level: 'warn',
            message: `${info.recipes.unreadable} recipe(s) could not be read. They were left untouched; nothing was overwritten.`,
        };

    if (info.recipes.legacy > 0)
        return {
            level: 'info',
            message: `${info.recipes.legacy} recipe(s) predate recipe identities. They still load, and each one picks up an identity the next time you save it.`,
        };

    return { level: 'ok', message: 'Everything on this device is up to date.' };
}
