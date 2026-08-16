// One-shot migration of legacy (id-less) recipe records to the v2 format.
//
// Sync refuses to let an old-format record replace an identified one
// (SYNC_WARNINGS.LEGACY_CONFLICT, decision 14), so every legacy record left on
// a device warns on EVERY sync until it is drained. This is the drain.
//
// WHY THIS IS IN THE APP AND NOT A CONSOLE SCRIPT:
// it used to be scripts/migrate-legacy-recipes.js, pasted into DevTools. The
// maintainer's primary device is an iPad, where no browser has a console at
// all -- so the one rollout step that had to run on every device could not run
// on the main one. A console script is also unreviewable in the place it
// matters: it duplicated mintRecipeId, and it rewrote SchemaVersion
// unconditionally, which would DOWNGRADE a record written by a future build.
// Both are fixed here, under test.
//
// The migration is idempotent: a record that already carries an id is left
// exactly as it is, so running it twice is harmless.

import {
    RECIPE_SCHEMA_VERSION, containerProblem, containerRecipeId,
    containerSavedAt, isNewerSchema, mintRecipeId
} from '../models/recipe-serialization.js';

/**
 * Where the summary is parked across the post-migration reload.
 *
 * The reload is not optional (see migrateLegacyRecipes' contract), and it
 * takes the results panel with it -- so the summary has to outlive the page.
 * sessionStorage rather than localStorage: it is a fact about this tab's last
 * action, not a preference, and it should not resurface in a new session.
 */
export const MIGRATION_SUMMARY_KEY = 'iceEd.legacyMigration.lastSummary';

/**
 * Give every legacy record an identity.
 *
 * Never throws — this is a maintenance action run from a diagnostics panel,
 * and a half-finished migration that also loses its own error report is the
 * worst available outcome.
 *
 * THE CALLER MUST RELOAD when `migrated` is non-empty. The open recipe's
 * in-memory identity (recipe-manager's currentRecipeId) is null for a legacy
 * record, and this function cannot safely correct it: the recipe on screen may
 * have unsaved edits, or may be a new recipe that merely shares a name with a
 * stored one. Left stale, the next save mints a SECOND id for a record this
 * just identified — which is exactly the divergence identity exists to
 * prevent. Reloading re-reads the identity from storage and closes the window.
 *
 * @param {Object} deps
 * @param {?Object} deps.storage - record store (listRecipesStrict, loadRecipe, saveRecipe)
 * @param {Function} [deps.mint] - id source; injected for tests
 * @param {Function} [deps.now] - ISO timestamp source; injected for tests
 * @param {boolean} [deps.dryRun] - report what would change, write nothing
 * @returns {Promise<Object>} the summary
 */
export async function migrateLegacyRecipes({ storage, mint = mintRecipeId, now, dryRun = false } = {}) {
    const stamp = now || (() => new Date().toISOString());
    const summary = {
        ran: false,
        dryRun,
        listingFailed: false,
        migrated: [],
        alreadyIdentified: 0,
        skipped: [],
    };

    if (!storage) return summary;

    let list;
    try {
        // STRICT, and a failure aborts before ANY write — the same rule the
        // sync executor follows. A lossy listing would drain the records it
        // happened to return and report success, leaving the rest legacy while
        // the user believes the job is done. Half a migration is worse than
        // none, because nobody runs it a second time.
        list = await storage.listRecipesStrict();
    } catch {
        summary.listingFailed = true;
        return summary;
    }

    summary.ran = true;

    for (const entry of list) {
        const name = entry && entry.name;
        if (!name) continue;

        let record = null;
        try {
            record = await storage.loadRecipe(name);
        } catch { /* reported as unreadable below */ }

        const data = record && record.data;
        if (!data) {
            summary.skipped.push({ name, reason: 'no readable body — left untouched' });
            continue;
        }

        // BEFORE the id check, and before anything is written. A record from a
        // newer build may use a schema this code cannot read; stamping
        // SchemaVersion 2 onto it would DOWNGRADE it in place and silently
        // drop whatever the newer fields were. The old console script did
        // exactly that. Garbage SchemaVersion lands here too, since
        // containerSchemaVersion maps it to Infinity to fail closed.
        if (isNewerSchema(data)) {
            summary.skipped.push({ name, reason: 'written by a newer version of Ice Ed — not touched' });
            continue;
        }

        if (containerRecipeId(data)) { summary.alreadyIdentified++; continue; }

        const upgraded = {
            ...data,
            SchemaVersion: RECIPE_SCHEMA_VERSION,
            RecipeId: mint(),
            // An EXISTING SavedAt is kept. It is the author clock the sync
            // join orders by, so overwriting it with "now" would make this
            // device's copy win against a genuinely newer edit elsewhere.
            // Only a record with no usable stamp gets one.
            SavedAt: containerSavedAt(data) || stamp(),
        };

        const problem = containerProblem(upgraded);
        if (problem) { summary.skipped.push({ name, reason: problem }); continue; }

        if (!dryRun) {
            let ok = false;
            try {
                ok = await storage.saveRecipe({ name, data: upgraded });
            } catch { ok = false; }
            if (!ok) { summary.skipped.push({ name, reason: 'the write failed — left untouched' }); continue; }
        }

        summary.migrated.push({ name, id: upgraded.RecipeId });
    }

    return summary;
}

/**
 * The one-line headline for a summary, in the panel's verdict vocabulary.
 * @param {Object} summary - from migrateLegacyRecipes
 * @returns {{level: string, message: string}}
 */
export function migrationVerdict(summary) {
    if (!summary) return { level: 'ok', message: '' };

    if (summary.listingFailed)
        return {
            level: 'warn',
            message: 'The recipe library could not be read, so nothing was migrated and nothing was written. Try again in a moment.',
        };

    if (!summary.ran)
        return { level: 'warn', message: 'Local storage is unavailable on this device, so there is nothing to migrate.' };

    const n = summary.migrated.length;
    const parts = [];

    if (n === 0 && summary.skipped.length === 0)
        return {
            level: 'ok',
            message: summary.alreadyIdentified > 0
                ? 'Nothing to do — every recipe on this device already has an identity.'
                : 'Nothing to do — there are no recipes on this device.',
        };

    if (n > 0) parts.push(`${summary.dryRun ? 'Would give' : 'Gave'} ${n} recipe(s) an identity.`);
    if (summary.alreadyIdentified > 0) parts.push(`${summary.alreadyIdentified} already had one.`);
    if (summary.skipped.length > 0) parts.push(`${summary.skipped.length} skipped — see below.`);

    return { level: summary.skipped.length > 0 ? 'warn' : 'ok', message: parts.join(' ') };
}
