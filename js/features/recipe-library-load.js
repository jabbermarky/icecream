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
        try {
            const data = await storage.loadRecipe(name);
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

            importIngredients(
                data.data.Ingredients,
                false,
                INGREDIENT_CONFLICT_MESSAGE,
                { current: "Library", imported: "Recipe" },
                { keep: "Keep Library", replace: "Use Recipe" }
            );

            // Shared declared-fields hydrator — the same code as .ier import.
            const newRecipe = hydrateRecipe(data.data);
            if (!newRecipe) {
                // Unreachable while containerProblem gates above, and kept
                // anyway: the two must never disagree silently, and a null here
                // would otherwise blank the user's open recipe.
                ErrorMsg(containerProblem(data.data) || invalidContainerMessage());
                return;
            }

            setRecipe(newRecipe);
            DisplayRecipe();
            SetRecipeModified(false);
            Info(`Loaded "${name}" from library`);
        } catch (err) {
            // Without this, a throw anywhere above is an unhandled rejection:
            // the user clicks Load and nothing happens, no message, console
            // only (review finding).
            console.error('Failed to load recipe from library:', err);
            ErrorMsg('Failed to load recipe. The stored record may be damaged.');
        }
    };
}
