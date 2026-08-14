// THROWAWAY: one-off migration of legacy recipe records to the v2 format.
//
// Sync now refuses to let an old-format (id-less) record replace an
// identified one (SYNC_WARNINGS.LEGACY_CONFLICT). This script drains the
// legacy population: every readable local record without a RecipeId gets
// SchemaVersion 2, a freshly minted RecipeId, and a SavedAt stamp. Saving
// re-stamps updatedAt, so the next sync carries the identified body over any
// legacy cloud copy — the direction the join allows.
//
// CAVEAT — recipes that already have an IDENTIFIED cloud copy: this script
// mints a fresh id, unrelated to the cloud one, so migrating such a local
// legacy copy creates two identities for one name and the next sync refuses
// with DIVERGENT_IDENTITIES instead. If a recipe's cloud copy is identified
// and current, delete the stale local legacy copy rather than migrating it.
// Run this on the device whose recipes ARE the current ones.
//
// How to run:
//   1. Open Ice Ed in the browser (the app must have finished loading —
//      that initializes the IndexedDB connection this script reuses).
//   2. Paste this ENTIRE file into the DevTools console and press Enter.
//   3. Read the per-recipe log. Re-running is harmless: a record that
//      already carries an id is left alone.
//   4. RELOAD the app: the open recipe's in-memory identity is not updated
//      by this script, and a save from the stale state would mint a second
//      id for a record this script just identified.
//   5. Sync (or just keep using the app). Then delete this script.
//
// Set DRY_RUN = true to see what would change without writing anything.

(async () => {
  const DRY_RUN = false;

  const { IndexedDBStorage } = await import('./js/storage/indexeddb-storage.js');
  const { RECIPE_SCHEMA_VERSION, containerProblem, containerRecipeId } =
    await import('./js/models/recipe-serialization.js');

  if (!IndexedDBStorage.db) {
    console.error('Storage is not initialized — load the app fully, then re-run.');
    return;
  }

  // Same fallback as the app's own mintRecipeId (recipe-manager.js — module-
  // local, so duplicated here): crypto.randomUUID exists only in secure
  // contexts, and this app is deliberately servable over plain http on a LAN.
  const mintId = () => {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };

  const summaries = await IndexedDBStorage.listRecipes();
  let migrated = 0, alreadyV2 = 0, refused = 0;

  for (const { name } of summaries) {
    const record = await IndexedDBStorage.loadRecipe(name);
    const data = record && record.data;
    if (!data) { refused++; console.warn(`SKIP  "${name}": no readable body`); continue; }
    if (containerRecipeId(data)) { alreadyV2++; continue; }

    const upgraded = {
      ...data,
      SchemaVersion: RECIPE_SCHEMA_VERSION,
      RecipeId: mintId(),
      SavedAt: new Date().toISOString(),
    };
    const problem = containerProblem(upgraded);
    if (problem) { refused++; console.warn(`SKIP  "${name}": ${problem}`); continue; }

    if (!DRY_RUN) {
      const ok = await IndexedDBStorage.saveRecipe({ name, data: upgraded });
      if (!ok) { refused++; console.warn(`FAIL  "${name}": save returned false`); continue; }
    }
    migrated++;
    console.log(`${DRY_RUN ? 'WOULD MIGRATE' : 'MIGRATED'}  "${name}" → ${upgraded.RecipeId}`);
  }

  console.log(`Done. ${migrated} migrated, ${alreadyV2} already identified, ${refused} skipped.` +
    (DRY_RUN ? ' (dry run — nothing written)' : ''));
})();
