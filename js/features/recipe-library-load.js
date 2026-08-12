// The Recipe Library "Load" handler.
//
// This is one of the four paths js/models/recipe-serialization.js governs, and
// the one the refusal rule primarily protects: a stale tab that hydrates a
// newer record here and saves it back is the silent-truncation path. The
// shared module logic has always been tested; this thin wiring — the ORDER of
// the refusal gate, importIngredients and hydration — had zero coverage, so a
// regression that dropped or reordered the gate would have shipped undetected.
// It lives in its own module rather than inline in app.js so the unit lane can
// drive it, mirroring the .ier import tests.
//
// DELIBERATE DIVERGENCE from .ier import (reviewed under P0.5, kept): .ier
// import backs up the current recipe and clears RecipeBackup/sortBy; this path
// replaces the recipe with no backup. Aligning them would be a user-visible
// behaviour change, and Phase 0 is structural only. Whether library load should
// also be undoable is a product question, not a refactor.

import { hydrateRecipe, containerProblem, invalidContainerMessage } from '../models/recipe-serialization.js';

const INGREDIENT_CONFLICT_MESSAGE =
    "This recipe was saved with different ingredient values than your current library. " +
    "The library reflects your latest research.";

/**
 * Build the Recipe Library load handler.
 *
 * Injectable rather than closed over app.js module state so the unit lane can
 * drive the real function with stubs.
 *
 * @param {Object} deps
 * @param {Object} deps.storage - Recipe storage backend (needs loadRecipe)
 * @param {Function} deps.setRecipe - Replaces the current recipe
 * @param {Function} deps.importIngredients - Merges the record's ingredients into the library
 * @param {Function} deps.DisplayRecipe - Re-renders after the swap
 * @param {Function} deps.SetRecipeModified - Clears the modified flag
 * @param {Function} deps.Info
 * @param {Function} deps.Warning
 * @param {Function} deps.ErrorMsg
 * @returns {(name: string) => Promise<void>} The onLoad callback
 */
export function createLibraryRecipeLoader(deps) {
    const {
        storage, setRecipe, importIngredients,
        DisplayRecipe, SetRecipeModified, Info, Warning, ErrorMsg
    } = deps;

    return async function loadRecipeFromLibrary(name) {
        // PHASE 1 — fetch, validate, hydrate. Nothing here touches app state, so
        // a throw is genuinely "the stored record is the problem" and the
        // message below is truthful.
        let data, newRecipe;
        try {
            data = await storage.loadRecipe(name);
            if (!data) {
                Warning(`Recipe "${name}" not found`);
                return;
            }

            // The one refusal gate, BEFORE any mutation — before
            // importIngredients touches the library and before the current
            // recipe is replaced. Covers newer schema (would truncate on the
            // next save) and damaged shapes (would crash or hydrate blank),
            // each with its own truthful message.
            const problem = containerProblem(data.data);
            if (problem) {
                ErrorMsg(problem);
                return;
            }

            // Shared declared-fields hydrator — the same code as .ier import.
            // Hydrating BEFORE any mutation means a malformed record cannot
            // leave the app half-loaded.
            newRecipe = hydrateRecipe(data.data);
            if (!newRecipe) {
                // Unreachable while containerProblem gates above, and kept
                // anyway: the two must never disagree silently, and a null here
                // would otherwise blank the user's open recipe.
                ErrorMsg(containerProblem(data.data) || invalidContainerMessage());
                return;
            }
        } catch (err) {
            // Without this, a throw is an unhandled rejection: the user clicks
            // Load and nothing happens, no message, console only. A throw here
            // can also be a transient storage failure (quota, closed
            // connection), so the message must not flatly blame the record —
            // teaching a user to distrust intact data is its own damage
            // (review finding).
            console.error('Failed to load recipe from library:', err);
            ErrorMsg('Failed to load recipe. Storage may have failed, or the stored record may be damaged. Nothing was changed — try again.');
            return;
        }

        // PHASE 2 — apply. The record passed the gate, so a throw here is a
        // merge or rendering failure — but the gate validates shape, not every
        // entry's contents, so record content can still be the trigger; the
        // message below claims only what is true (review finding: the single
        // try used to span both phases and told the user their stored record
        // was damaged after their open recipe had already been replaced, on a
        // path that deliberately keeps no backup).
        //
        // Ingredients is passed with an EMPTY-MAP FALLBACK: absent is legal at
        // the gate, but the real importIngredients opens with
        // Object.entries(dataObj), which throws on undefined (review finding —
        // the unit test only stayed green because the harness stubs it).
        try {
            importIngredients(
                data.data.Ingredients || {},
                false,
                INGREDIENT_CONFLICT_MESSAGE,
                { current: "Library", imported: "Recipe" },
                { keep: "Keep Library", replace: "Use Recipe" }
            );
            setRecipe(newRecipe);
            DisplayRecipe();
            SetRecipeModified(false);
            Info(`Loaded "${name}" from library`);
        } catch (err) {
            // importIngredients may have already merged (and its sync hook
            // persisted) ingredient definitions before the throw — the recipe
            // claim below is true; no broader "nothing changed" is promised.
            console.error('Failed to apply the loaded recipe:', err);
            ErrorMsg(`"${name}" was read successfully but could not be applied, so the app may be in a half-loaded state. Your stored recipe copy is unchanged — reload the page and try again.`);
        }
    };
}
