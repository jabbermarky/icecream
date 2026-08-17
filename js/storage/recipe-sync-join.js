// Recipe Sync Join Module (P0.3 T3)
//
// The PURE decision core for recipe sync: given the local and cloud record
// sets, decide what to write where — no storage access, no network, no
// side effects. The same extraction pattern as recipe-library-load.js, which
// has caught criticals three times on this branch: the decision logic lives
// where the node test lane can drive every branch, and sync-manager.js (T4)
// becomes a thin executor.
//
// Design source: .planning/designs/p0.3-identity-design.md decisions 3, 8, 9.
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
//     "Newer schema" means a FINITE version above ours — a garbage
//     SchemaVersion is corruption, not the future, and is unreadable (the
//     same distinction containerProblem draws, for the same review reason:
//     telling a user with a corrupted record to update the app is a lie).
//   - Same name + two different ids is TWO recipes, not a conflict to LWW
//     away (the dead-id-vs-live-name case): overwriting either side would
//     destroy a lineage. Skip and warn; resolution is a user decision.
//   - An id-less body NEVER replaces an identified record, even when it wins
//     the clock: the write would erase the identity and sync would then
//     propagate the erasure. Skip and warn; resolution is a user decision —
//     keep one copy, delete or rename the other. (Re-saving the old copy
//     does NOT converge: a save mints a FRESH id, which turns this into the
//     divergent-identities stall.) The other direction stays open — an
//     identified winner replacing a legacy record is how old records get
//     carried forward — and the Info & FAQ migration
//     (js/features/legacy-migration.js) drains legacy records that have no
//     identified counterpart.
//   - No partial overwrites: a record whose body is missing or malformed
//     blocks its name on its own side — the other side's same-named record
//     must not be treated as "only" and clobber what we could not see.
//   - A name is only written when its current holder is this write's own
//     join partner, is being renamed away by another surviving write, or
//     does not exist. Placement is resolved AFTER all pairs are known, so
//     the plan does not depend on record listing order — a rename chain
//     (A→B while B→C) resolves the same way from any input order.
//
// The caller contract (T4):
//   - Every record passed in is { name, updatedAt, data } with `data` the
//     already-downloaded container body, or `data: null` when the body could
//     not be read (decision 3: ids are invisible in listRecipes output, so
//     the join NEEDS bodies; the download is the caller's job).
//   - Execute the returned actions IN ORDER: writes first, then deletes.
//     A delete never names a key any planned write targets — when a rename
//     frees a key another record claims, the overwrite IS the cleanup and
//     no delete is emitted.

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
    LEGACY_CONFLICT: 'legacy-conflict',
});

/**
 * True for a body written by a genuinely newer schema: a FINITE version
 * above ours. Such a body is a faithful blob this build may copy but never
 * overwrite. A non-finite version (true/NaN/"" → Infinity) is corruption
 * and must NOT reach here — classify it unreadable first.
 * @param {number} sv - a containerSchemaVersion() result
 * @returns {boolean}
 */
function isCopyableNewerSchema(sv) {
    return Number.isFinite(sv) && sv > RECIPE_SCHEMA_VERSION;
}

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
 * download), its SchemaVersion is garbage (non-finite — corruption, not the
 * future), or it is malformed at a schema this build understands. A record
 * with a FINITE newer schema is NOT unreadable: it is a faithful blob this
 * build may copy but never overwrite. Unreadable records join nothing and
 * BLOCK their name as a write target.
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
        const sv = data == null ? NaN : containerSchemaVersion(data);
        const malformed = data == null ||
            (!isCopyableNewerSchema(sv) && containerProblem(data));
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
            schemaVersion: sv,
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
 * @returns {Map<string, Object>} id → representative entry
 */
function resolveDuplicateIds(entries, blocked, side, warnings) {
    const groups = new Map();
    for (const e of entries) {
        if (!e.id) continue;
        if (!groups.has(e.id)) groups.set(e.id, []);
        groups.get(e.id).push(e);
    }
    const representatives = new Map();
    for (const [id, group] of groups) {
        group.sort((a, b) => compareClocks(b, a) || (a.name < b.name ? -1 : 1));
        representatives.set(id, group[0]);
        for (const loser of group.slice(1)) {
            loser.excluded = true;
            blocked.add(loser.name);
            warnings.push({
                code: SYNC_WARNINGS.DUPLICATE_ID, side, name: loser.name,
                message: `"${loser.name}" (${side}) shares its identity with "${group[0].name}"; ` +
                    `"${group[0].name}" is newer and syncs, "${loser.name}" was left untouched.`,
            });
        }
    }
    return representatives;
}

/**
 * LWW a joined pair into a write candidate, or null when no write should
 * happen. The schema guard lives HERE, at the one point every pair overwrite
 * passes through: the record being REPLACED must be of a schema this build
 * understands, whichever direction the clock points. (Garbage versions never
 * reach this — classifySide already refused them as unreadable.)
 */
function resolvePair(local, cloud, warnings, stats) {
    const cmp = compareClocks(local, cloud);
    if (cmp === 0) { stats.unchanged++; return null; }
    const winner = cmp > 0 ? local : cloud;
    const loser = cmp > 0 ? cloud : local;
    if (isCopyableNewerSchema(loser.schemaVersion)) {
        warnings.push({
            code: SYNC_WARNINGS.NEWER_SCHEMA, side: loser.side, name: loser.name,
            message: `"${loser.name}" (${loser.side}) was saved by a newer version of Ice Ed ` +
                `and cannot be safely replaced by this one. Update the app, then sync again.`,
        });
        stats.skipped++;
        return null;
    }
    return {
        op: winner.side === 'local' ? 'push' : 'pull',
        name: winner.name,
        data: winner.data,
        reason: winner.side === 'local' ? 'local-newer' : 'cloud-newer',
        winner, loser,
        refused: false,
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
 * }} actions are ORDERED: writes first, then stale-rename deletes. No delete
 *    ever names a key a planned write targets.
 */
export function planRecipeSync(localRecords, cloudRecords) {
    const warnings = [];
    const stats = { pairsById: 0, pairsByName: 0, pushed: 0, pulled: 0, deleted: 0, unchanged: 0, skipped: 0 };

    const local = classifySide(localRecords || [], 'local', warnings);
    const cloud = classifySide(cloudRecords || [], 'cloud', warnings);
    const localById = resolveDuplicateIds(local.entries, local.blocked, 'local', warnings);
    const cloudById = resolveDuplicateIds(cloud.entries, cloud.blocked, 'cloud', warnings);

    const candidates = [];

    // --- Pass 1: id join ---
    for (const [id, l] of localById) {
        const c = cloudById.get(id);
        if (!c) continue;
        stats.pairsById++;
        l.consumed = c.consumed = true;
        const candidate = resolvePair(l, c, warnings, stats);
        if (candidate) candidates.push(candidate);
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
        // Mixed pair — exactly one side carries an identity. When the id-less
        // side wins the clock, refuse outright: writing it would erase the
        // identity fleet-wide, and the one flow that produces this pair (an
        // old-format copy edited on a stale device) is rare enough to handle
        // by hand. The identified-winner direction falls through to plain LWW
        // below — that overwrite is how legacy records get carried forward.
        if (!l.id !== !c.id) {
            const cmp = compareClocks(l, c);
            const winner = cmp > 0 ? l : cmp < 0 ? c : null;
            if (winner && !winner.id) {
                warnings.push({
                    code: SYNC_WARNINGS.LEGACY_CONFLICT, side: winner.side, name: l.name,
                    message: `The ${winner.side} copy of "${l.name}" is newer but was saved in the ` +
                        `old format; sync never replaces an identified recipe with an old-format ` +
                        `one, so neither side was changed. Resolve it by hand: keep the copy you ` +
                        `want and delete or rename the other.`,
                });
                stats.skipped++;
                continue;
            }
        }
        stats.pairsByName++;
        const candidate = resolvePair(l, c, warnings, stats);
        if (candidate) candidates.push(candidate);
    }

    // --- Pass 3: one-sided copies ---
    // Candidates only; whether the destination name is truly free is decided
    // by the placement pass below, like every other write. Names blocked by
    // unreadable/duplicate records skip silently — their warning already
    // fired when the block was recorded.
    for (const e of [...local.entries, ...cloud.entries]) {
        if (e.consumed || e.excluded) continue;
        const destSide = e.side === 'local' ? 'cloud' : 'local';
        const destBlocked = destSide === 'local' ? local.blocked : cloud.blocked;
        if (destBlocked.has(e.name)) { stats.skipped++; continue; }
        candidates.push({
            op: e.side === 'local' ? 'push' : 'pull',
            name: e.name,
            data: e.data,
            reason: e.side === 'local' ? 'local-only' : 'cloud-only',
            winner: e, loser: null,
            refused: false,
        });
    }

    // --- Placement: refuse writes whose destination name is not actually free ---
    // Evaluated over the COMPLETE candidate set so the outcome cannot depend
    // on input order, and iterated to a fixpoint because one refusal can
    // cascade: a refused rename's loser stops vacating its key, which can
    // strand another candidate that was counting on that key.
    //
    // A write to (side, name) is legal when the record currently at that key
    //   - does not exist,
    //   - is this write's own join partner (the pair overwrite), or
    //   - is vacating: it is the loser of another SURVIVING candidate whose
    //     winner carries a different name (a rename moved its lineage away).
    // A name in a side's BLOCKED set is never legal: an unreadable or
    // duplicate-id record holds it, and those have no entries — a holder
    // check alone would see the key as free and clobber exactly what the
    // block exists to protect (review repro: a rename landing on an
    // unreadable destination name).
    // Two surviving writes to one key refuse each other — deterministically,
    // both ways — because either order would silently destroy the other.
    const entriesByName = {
        local: new Map(local.entries.map((e) => [e.name, e])),
        cloud: new Map(cloud.entries.map((e) => [e.name, e])),
    };
    const blockedNames = { local: local.blocked, cloud: cloud.blocked };
    const destSideOf = (c) => (c.op === 'push' ? 'cloud' : 'local');
    const refuse = (c, message) => {
        c.refused = true;
        stats.skipped++;
        warnings.push({ code: SYNC_WARNINGS.NAME_COLLISION, side: destSideOf(c), name: c.name, message });
    };
    for (let changed = true; changed;) {
        changed = false;
        const surviving = candidates.filter((c) => !c.refused);
        const vacating = new Set(surviving
            .filter((c) => c.loser && c.loser.name !== c.winner.name)
            .map((c) => `${c.loser.side}:${c.loser.name}`));
        const writesByKey = new Map();
        for (const c of surviving) {
            const key = `${destSideOf(c)}:${c.name}`;
            if (!writesByKey.has(key)) writesByKey.set(key, []);
            writesByKey.get(key).push(c);
        }
        for (const [key, writers] of writesByKey) {
            if (writers.length > 1) {
                for (const c of writers) refuse(c,
                    `Two records both syncing to "${c.name}" (${destSideOf(c)}) would overwrite ` +
                    `each other; both were left untouched. Rename one to resolve it.`);
                changed = true;
                continue;
            }
            const c = writers[0];
            const side = destSideOf(c);
            if (blockedNames[side].has(c.name)) {
                refuse(c,
                    `Syncing "${c.name}" (${side}) would overwrite a record that could not ` +
                    `be verified; both were left untouched.`);
                changed = true;
                continue;
            }
            const holder = entriesByName[side].get(c.name);
            if (!holder || holder === c.loser || vacating.has(key)) continue;
            refuse(c,
                `Syncing "${c.name}" (${side}) would overwrite a record that is ` +
                `staying put there; both were left untouched.`);
            changed = true;
        }
    }

    // --- Emit: writes, then the stale-rename deletes no write superseded ---
    const writes = candidates.filter((c) => !c.refused)
        .map(({ op, name, data, reason }) => ({ op, name, data, reason }));
    const writtenKeys = new Set(candidates.filter((c) => !c.refused)
        .map((c) => `${destSideOf(c)}:${c.name}`));
    const deletes = [];
    for (const c of candidates) {
        if (c.refused || !c.loser || c.loser.name === c.winner.name) continue;
        // The loser's old key: delete it — unless a surviving write claims
        // that key, in which case the overwrite IS the cleanup.
        if (writtenKeys.has(`${c.loser.side}:${c.loser.name}`)) continue;
        deletes.push({ op: 'delete', target: c.loser.side, name: c.loser.name, reason: 'renamed' });
    }

    const actions = [...writes, ...deletes];
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
 * guards, single-record shape — and the same verdicts planRecipeSync would
 * reach for the identical state, so the two write paths cannot disagree.
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
    // Missing, garbage-versioned, or malformed-at-understood-schema bodies
    // all refuse identically — the same unreadable classification the full
    // join applies, so a record the sync plan blocks cannot be clobbered
    // through this path. (A genuinely newer FINITE schema falls through to
    // the specific message below; calling corruption "newer" would send the
    // user to a repair path that cannot work.)
    const sv = data == null ? NaN : containerSchemaVersion(data);
    if (data == null || (!isCopyableNewerSchema(sv) && containerProblem(data))) {
        return {
            allow: false,
            warning: {
                code: SYNC_WARNINGS.UNREADABLE, side: 'cloud', name: record.name,
                message: `"${record.name}" exists in the cloud but could not be read; ` +
                    `the cloud copy was left untouched. Sync again to retry.`,
            },
        };
    }
    if (isCopyableNewerSchema(sv)) {
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
    // The same legacy rule the full join applies: an id-less body never
    // replaces an identified record. The mainline save path always mints
    // before pushing, so an id-less push reaching an identified cloud record
    // is an anomaly — refuse it rather than erase the identity.
    if (cloudId && !pushedId) {
        return {
            allow: false,
            warning: {
                code: SYNC_WARNINGS.LEGACY_CONFLICT, side: 'cloud', name: record.name,
                message: `The cloud copy of "${record.name}" carries an identity this record does ` +
                    `not, so it was not overwritten. Save your copy under a different name to ` +
                    `keep both, or delete the cloud copy first if it is stale.`,
            },
        };
    }
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
