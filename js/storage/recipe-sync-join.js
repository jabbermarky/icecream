// Recipe Sync Join Module (P0.3 T3)
//
// The PURE decision core for recipe sync: given the local and cloud record
// sets, decide what to write where — no storage access, no network, no
// side effects. The same extraction pattern as recipe-library-load.js, which
// has caught criticals three times on this branch: the decision logic lives
// where the node test lane can drive every branch, and sync-manager.js (T4)
// becomes a thin executor.
//
// Design source: .planning/p0.3-identity-design.md decisions 3, 8, 9.
//
// The rules, in order of authority:
//   - Records join ID-FIRST (identity is the record's name for join
//     purposes; the display name is just a label that renames propagate),
//     with NAME FALLBACK for legacy records that carry no id.
//   - The clock is SavedAt (author time) when BOTH sides carry one,
//     updatedAt otherwise (decision 8: both backends re-stamp updatedAt at
//     WRITE time, so it lies whenever sync itself has copied a record).
//   - NEVER overwrite a record whose SchemaVersion this build does not
//     understand (decision 9, red team): sync writes records it never loads,
//     so without this guard a stale device's LWW push strips v2+ fields
//     wholesale on a path the load gate cannot see. Skip and warn instead.
//   - Same name + two different ids is TWO recipes, not a conflict to LWW
//     away (the dead-id-vs-live-name case): overwriting either side would
//     destroy a lineage. Skip and warn; resolution is a user decision.
//   - No partial overwrites: a record whose body could not be read blocks
//     its name on its own side — the other side's same-named record must
//     not be treated as "only" and clobber what we could not see.
//
// The caller contract (T4):
//   - Every record passed in is { name, updatedAt, data } with `data` the
//     already-downloaded container body, or `data: null` when the body could
//     not be read (decision 3: ids are invisible in listRecipes output, so
//     the join NEEDS bodies; the download is the caller's job).
//   - Execute the returned actions IN ORDER. Renames emit a write under the
//     new name followed by a delete of the stale old key, and a later action
//     may legitimately reuse a deleted name — reordering breaks that.

import {
    RECIPE_SCHEMA_VERSION,
    containerProblem,
    containerRecipeId,
    containerSavedAt,
    containerSchemaVersion,
} from '../models/recipe-serialization.js';

/** Warning codes, exported so tests and T4's status UI match on one vocabulary. */
export const SYNC_WARNINGS = Object.freeze({
    UNREADABLE: 'unreadable',
    NEWER_SCHEMA: 'newer-schema',
    DIVERGENT_IDENTITIES: 'divergent-identities',
    DUPLICATE_ID: 'duplicate-id',
    NAME_COLLISION: 'name-collision',
});

/**
 * A record's updatedAt as epoch milliseconds, 0 for anything unparseable —
 * 0 (not NaN) because NaN compares false BOTH ways and would silently pick
 * a side; 0 makes a garbage clock LOSE deterministically, which is the
 * fail-safe direction (the readable clock wins).
 * @param {*} v
 * @returns {number}
 */
function updatedAtMs(v) {
    if (v instanceof Date) { const t = v.getTime(); return Number.isFinite(t) ? t : 0; }
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'string') { const t = Date.parse(v); return Number.isFinite(t) ? t : 0; }
    return 0;
}

/**
 * Compare two classified records on the best available clock: SavedAt when
 * BOTH carry one (containerSavedAt already refused non-UTC-anchored shapes,
 * so Date.parse here is deterministic across runtimes), updatedAt otherwise.
 * @returns {number} negative = a older, positive = a newer, 0 = tie
 */
function compareClocks(a, b) {
    if (a.savedAt && b.savedAt) return Date.parse(a.savedAt) - Date.parse(b.savedAt);
    return updatedAtMs(a.updatedAt) - updatedAtMs(b.updatedAt);
}

/**
 * Classify one side's raw records into joinable entries and blocked names.
 *
 * A record is UNREADABLE when its body is missing (null data — a failed
 * download) or malformed at a schema this build understands (containerProblem
 * at sv <= RECIPE_SCHEMA_VERSION). A NEWER-schema record is NOT unreadable:
 * its body is a faithful blob this build may copy but never overwrite.
 * Unreadable records join nothing and BLOCK their name as a write target.
 */
function classifySide(records, side, warnings) {
    const entries = [];          // joinable, in input order
    const blocked = new Set();   // names no action may write to on this side
    for (const record of records) {
        const name = record && typeof record.name === 'string' ? record.name : null;
        if (!name) {
            warnings.push({
                code: SYNC_WARNINGS.UNREADABLE, side, name: String(record && record.name),
                message: `A ${side} recipe entry has no usable name and was skipped.`,
            });
            continue;
        }
        const data = record.data;
        const malformed = data == null ||
            (containerSchemaVersion(data) <= RECIPE_SCHEMA_VERSION && containerProblem(data));
        if (malformed) {
            blocked.add(name);
            warnings.push({
                code: SYNC_WARNINGS.UNREADABLE, side, name,
                message: `"${name}" (${side}) could not be read and was left untouched on both sides.`,
            });
            continue;
        }
        entries.push({
            side, name, data,
            updatedAt: record.updatedAt,
            id: containerRecipeId(data),
            savedAt: containerSavedAt(data),
            schemaVersion: containerSchemaVersion(data),
        });
    }
    return { entries, blocked };
}

/**
 * Resolve duplicate ids WITHIN one side (decision 6's pre-guard window: two
 * records carrying one id, written before the mint guards existed). One
 * record represents the id in the join — picked deterministically as the
 * newest clock, name ascending on a tie — and the others are excluded AND
 * block their names, so nothing overwrites them until a human untangles it.
 */
function resolveDuplicateIds(entries, blocked, side, warnings) {
    const byId = new Map();
    for (const e of entries) {
        if (!e.id) continue;
        if (!byId.has(e.id)) byId.set(e.id, []);
        byId.get(e.id).push(e);
    }
    for (const [id, group] of byId) {
        if (group.length < 2) continue;
        group.sort((a, b) => compareClocks(b, a) || (a.name < b.name ? -1 : 1));
        for (const loser of group.slice(1)) {
            loser.excluded = true;
            blocked.add(loser.name);
            warnings.push({
                code: SYNC_WARNINGS.DUPLICATE_ID, side, name: loser.name,
                message: `"${loser.name}" (${side}) shares its identity with "${group[0].name}"; ` +
                    `"${group[0].name}" is newer and syncs, "${loser.name}" was left untouched.`,
            });
        }
        byId.set(id, [group[0]]);
    }
    const representatives = new Map();
    for (const [id, group] of byId) representatives.set(id, group[0]);
    return representatives;
}

/**
 * LWW a joined pair into an action, or null when no write should happen.
 * The schema guard lives HERE, at the one point every overwrite passes
 * through: the record being REPLACED must be of a schema this build
 * understands, whichever direction the clock points.
 */
function resolvePair(local, cloud, warnings) {
    const cmp = compareClocks(local, cloud);
    if (cmp === 0) return null;
    const winner = cmp > 0 ? local : cloud;
    const loser = cmp > 0 ? cloud : local;
    if (loser.schemaVersion > RECIPE_SCHEMA_VERSION) {
        warnings.push({
            code: SYNC_WARNINGS.NEWER_SCHEMA, side: loser.side, name: loser.name,
            message: `"${loser.name}" (${loser.side}) was saved by a newer version of Ice Ed ` +
                `and cannot be safely replaced by this one. Update the app, then sync again.`,
        });
        return null;
    }
    return {
        op: winner.side === 'local' ? 'push' : 'pull',
        name: winner.name,
        data: winner.data,
        reason: winner.side === 'local' ? 'local-newer' : 'cloud-newer',
        staleName: loser.name !== winner.name ? loser.name : undefined,
        staleTarget: loser.name !== winner.name ? loser.side : undefined,
    };
}

/**
 * Plan a bidirectional recipe sync. Pure: decides, never executes.
 *
 * @param {Array<{name: string, updatedAt: *, data: ?Object}>} localRecords
 * @param {Array<{name: string, updatedAt: *, data: ?Object}>} cloudRecords
 * @returns {{
 *   actions: Array<{op: 'push'|'pull'|'delete', name: string, data?: Object,
 *                   target?: 'local'|'cloud', reason: string}>,
 *   warnings: Array<{code: string, side: string, name: string, message: string}>,
 *   stats: {pairsById: number, pairsByName: number, pushed: number,
 *           pulled: number, deleted: number, unchanged: number, skipped: number},
 * }} actions are ORDERED: paired writes first, then stale-rename deletes,
 *    then one-sided copies — a later copy may legitimately claim a name a
 *    delete just freed, so executing out of order loses records.
 */
export function planRecipeSync(localRecords, cloudRecords) {
    const warnings = [];
    const stats = { pairsById: 0, pairsByName: 0, pushed: 0, pulled: 0, deleted: 0, unchanged: 0, skipped: 0 };

    const local = classifySide(localRecords || [], 'local', warnings);
    const cloud = classifySide(cloudRecords || [], 'cloud', warnings);
    const localById = resolveDuplicateIds(local.entries, local.blocked, 'local', warnings);
    const cloudById = resolveDuplicateIds(cloud.entries, cloud.blocked, 'cloud', warnings);

    const pairWrites = [];
    const staleDeletes = [];
    const singles = [];

    const blockedOn = (side) => (side === 'local' ? local.blocked : cloud.blocked);
    const entriesOf = (side) => (side === 'local' ? local.entries : cloud.entries);

    // --- Pass 1: id join ---
    for (const [id, l] of localById) {
        const c = cloudById.get(id);
        if (!c) continue;
        stats.pairsById++;
        l.consumed = c.consumed = true;
        // A rename writes the winner under ITS name on the other side. If a
        // DIFFERENT record (or an unreadable one) already sits at that name
        // there, writing would destroy a third lineage — skip and warn.
        const action = resolvePair(l, c, warnings);
        if (!action) {
            if (compareClocks(l, c) === 0) stats.unchanged++; else stats.skipped++;
            continue;
        }
        if (action.staleName) {
            const destSide = action.op === 'push' ? 'cloud' : 'local';
            const occupant = entriesOf(destSide).find((e) => e.name === action.name && !e.consumed && !e.excluded);
            if (occupant || blockedOn(destSide).has(action.name)) {
                warnings.push({
                    code: SYNC_WARNINGS.NAME_COLLISION, side: destSide, name: action.name,
                    message: `Syncing the rename of "${action.staleName}" to "${action.name}" would ` +
                        `overwrite a different "${action.name}" (${destSide}); both were left untouched.`,
                });
                stats.skipped++;
                continue;
            }
            staleDeletes.push({ op: 'delete', target: action.staleTarget, name: action.staleName, reason: 'renamed' });
        }
        delete action.staleName;
        delete action.staleTarget;
        pairWrites.push(action);
    }

    // --- Pass 2: name fallback ---
    // Only pairs where at least one side is id-less join here: two records
    // that BOTH carry ids either already joined by id or are two different
    // recipes sharing a name (dead id vs live name) — never LWW those.
    const cloudByName = new Map();
    for (const e of cloud.entries) if (!e.consumed && !e.excluded) cloudByName.set(e.name, e);
    for (const l of local.entries) {
        if (l.consumed || l.excluded) continue;
        const c = cloudByName.get(l.name);
        if (!c) continue;
        l.consumed = c.consumed = true;
        if (l.id && c.id && l.id !== c.id) {
            warnings.push({
                code: SYNC_WARNINGS.DIVERGENT_IDENTITIES, side: 'both', name: l.name,
                message: `"${l.name}" is a different recipe locally than in the cloud (the two ` +
                    `carry different identities); neither copy was changed. Rename one to keep both.`,
            });
            stats.skipped++;
            continue;
        }
        stats.pairsByName++;
        const action = resolvePair(l, c, warnings);
        if (!action) {
            if (compareClocks(l, c) === 0) stats.unchanged++; else stats.skipped++;
            continue;
        }
        pairWrites.push(action);
    }

    // --- Pass 3: one-sided copies ---
    // "One-sided" means the DESTINATION side has no record under that name at
    // all — not merely no unconsumed one. A record that sits at the name but
    // was consumed by a refused pairing (a rename collision, a divergent
    // identity) is still a record; writing over it as if the name were free
    // is the partial-overwrite this module exists to prevent. The one
    // exception is a name a scheduled rename-delete is about to vacate.
    const namesOn = {
        local: new Set([...local.entries.map((e) => e.name), ...local.blocked]),
        cloud: new Set([...cloud.entries.map((e) => e.name), ...cloud.blocked]),
    };
    const freedOn = { local: new Set(), cloud: new Set() };
    for (const d of staleDeletes) freedOn[d.target].add(d.name);
    for (const e of [...local.entries, ...cloud.entries]) {
        if (e.consumed || e.excluded) continue;
        const destSide = e.side === 'local' ? 'cloud' : 'local';
        if (namesOn[destSide].has(e.name) && !freedOn[destSide].has(e.name)) {
            stats.skipped++;
            continue;
        }
        singles.push({
            op: e.side === 'local' ? 'push' : 'pull',
            name: e.name,
            data: e.data,
            reason: e.side === 'local' ? 'local-only' : 'cloud-only',
        });
    }

    const actions = [...pairWrites, ...staleDeletes, ...singles];
    for (const a of actions) {
        if (a.op === 'push') stats.pushed++;
        else if (a.op === 'pull') stats.pulled++;
        else stats.deleted++;
    }
    return { actions, warnings, stats };
}

/**
 * Gate for the fire-and-forget pushRecipe path (codex finding 3): it is a
 * second write path that would otherwise bypass the join entirely. Same
 * guards, single-record shape.
 *
 * Caller contract: `cloudRecord` is the CURRENT cloud record at this name —
 * null when the name is known absent, `{ name, data: null }` when a record
 * exists but its body could not be read. (The backends' loadRecipe conflates
 * not-found with read-error today — the known window scoped with #12; until
 * that lands, callers that cannot tell the difference should pass the
 * unreadable shape, which refuses, not null, which allows.)
 *
 * @param {{name: string, data: Object}} record - the record being pushed
 * @param {?{name: string, updatedAt: *, data: ?Object}} cloudRecord
 * @returns {{allow: boolean, warning: ?{code: string, side: string, name: string, message: string}}}
 */
export function decideRecipePush(record, cloudRecord) {
    if (!cloudRecord) return { allow: true, warning: null };
    const data = cloudRecord.data;
    if (data == null) {
        return {
            allow: false,
            warning: {
                code: SYNC_WARNINGS.UNREADABLE, side: 'cloud', name: record.name,
                message: `"${record.name}" exists in the cloud but could not be read; ` +
                    `the cloud copy was left untouched. Sync again to retry.`,
            },
        };
    }
    if (containerSchemaVersion(data) > RECIPE_SCHEMA_VERSION) {
        return {
            allow: false,
            warning: {
                code: SYNC_WARNINGS.NEWER_SCHEMA, side: 'cloud', name: record.name,
                message: `The cloud copy of "${record.name}" was saved by a newer version of ` +
                    `Ice Ed and was not overwritten. Update the app, then save again.`,
            },
        };
    }
    const pushedId = containerRecipeId(record.data);
    const cloudId = containerRecipeId(data);
    if (pushedId && cloudId && pushedId !== cloudId) {
        return {
            allow: false,
            warning: {
                code: SYNC_WARNINGS.DIVERGENT_IDENTITIES, side: 'cloud', name: record.name,
                message: `The cloud already has a DIFFERENT recipe named "${record.name}"; ` +
                    `it was not overwritten. Rename one of them, or sync to review the conflict.`,
            },
        };
    }
    return { allow: true, warning: null };
}
