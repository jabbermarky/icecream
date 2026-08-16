---
created: 2026-08-16T12:05
updated: 2026-08-16T12:05
title: Ingredient DB needs schema versioning — and the store has three more problems in the same place
area: storage
status: needs-discussion
files:
  - js/storage/indexeddb-storage.js
  - js/storage/sync-manager.js
  - js/features/ingredients.js
  - js/models/recipe-serialization.js
related:
  - .planning/todos/pending/2026-01-14-versioned-recipes-in-library.md
  - .planning/p0.4-batch-schema.md
  - issue #30 (sync silently discards local ingredient edits — filed from this todo)
  - issue #19 (sync loads and deletes recipes by mutable name)
  - issue #21 (deletes never propagate)
---

## Why this is open

Raised by the maintainer 2026-08-16: *"we need to discuss the ingredient db
schema — seems like we need schema versioning."*

Correct, and the gap is wider than versioning alone. Recipes got the full
treatment in P0.3 — `SchemaVersion` on the container, a fail-closed refusal gate,
an author-time clock, id-first join. **The ingredient library got none of it**,
and it is synced.

Everything in "What is actually there" below was read out of the code on
2026-08-16, not inferred from memory.

## What is actually there

### 1. Ingredient records carry no schema version at all

`RECIPE_SCHEMA_VERSION = 2` and `refuseNewerSchema()` protect recipes: a record
written by a newer build is refused rather than hydrated, because hydrating it
would silently drop the fields this build cannot see and then write the truncated
version back. That is the whole reason the gate exists.

Ingredients have no equivalent. `grep SchemaVersion js/features/ingredients.js
js/storage/*.js` finds nothing on the ingredient path. A device on a newer build
adds a field to an ingredient; an older device reads it, keeps what it
understands, and writes it back. **This is the exact silent-clobber class P0.3
built the gate to prevent, still live on the other store.**

### 2. The whole library is ONE record

`indexeddb-storage.js:226` creates the store with `keyPath: 'name'`, but the
library is read and written as a single record literally named `'library'`
(`:183`, `:201`). Every ingredient lives inside it.

So the unit of sync is the entire library. This is the same shape decision 26
identified as fatal for the event log: *"sync is last-write-wins on whole
records, so two devices appending to one file silently lose events."* The
ingredient library is that file.

### 3. Local edits are silently discarded on sync

`sync-manager.js:205` is the merge:

```js
function mergeIngredients(local, cloud) {
  const merged = { ...local };
  for (const name in cloud) {
    merged[name] = cloud[name];   // cloud wins, unconditionally
  }
  return merged;
}
```

No clock, no version, no conflict detection. Cloud wins for any name it has.

The failure is concrete: edit dextrose locally, sync, and if the cloud already
knows "dextrose" the stale cloud value overwrites your edit — and then
`syncIngredients()` writes the merged result **back to both sides** (`:185-186`),
so the edit is gone from local storage too. No warning, no conflict surfaced.

**Filed as issue #30**, since it is a live data-loss defect rather than a design
question. The fix may still wait on this discussion: if the store is
restructured to per-ingredient records with an author-time clock, #30 gets the
recipe join's treatment wholesale instead of a bespoke merge patch.

### 4. Deleted ingredients resurrect

The merge is a union and never removes a name. Delete an ingredient locally, sync
against a cloud that still has it, and it comes back. Same class as issue #21 for
recipes, which decision 26 closes for recipes and batches via `deleted` events —
and does not close here.

### 5. The store is keyed by mutable name

`keyPath: 'name'`, and the merge keys on name too. Renaming an ingredient is
remove-plus-add with no identity carried across. Same class as issue #19 for
recipes and the diff own-goal decision 34 just fixed. The binder has the
consequence on record: the same named ingredient computed ~12.5 % less PAC and
POD on a newer sheet than an older one.

## The connection to P0.4, which is why this is urgent now

Decision 35 (2026-08-16) requires the diff to **recompute both sides under one
coefficient set** rather than only flagging drift. `p0.4-data-model.mmd` gives
`INGREDIENT_DEF` and `SNAPSHOT_INGREDIENT_DEF` a `coefficient_set_id` for exactly
this, and `LIBRARY_INGREDIENT` carries one too.

**There is nothing in the code today that can produce that identifier.** The
library is a bag of names to values with no version, no generation counter and no
provenance. Decision 35 is not implementable until the ingredient library can say
which coefficient set it is on.

So this is not only hygiene. It is a prerequisite for B4.

## What to discuss

1. **Per-ingredient records, or keep one library record?** Splitting to one
   record per ingredient makes sync a per-ingredient join instead of a
   whole-file LWW, and is the same move decision 26 made for the event log. It
   is also a store migration.
2. **What does `SchemaVersion` go on** — each ingredient, the library record, or
   both? Recipes put it on the container; the analogue depends on question 1.
3. **Does the ingredient library need identity** (an `IngredientId`), or is
   name-keyed acceptable at N=1 with a rename path? Decision 34 chose ids for
   formula rows. The N=1 triage gate applies here and may answer differently,
   since the maintainer is the only editor.
4. **What is a coefficient set, concretely?** A monotonic generation number
   bumped on any composition edit is the cheap version; a named, dated set is the
   useful one. Decision 35 needs whichever it is to be stable and comparable.
5. **Does `LIBRARY_INGREDIENT` back-write to recipes?** The data model says it
   never does, and the P0.4 snapshot freezes coefficients at print. Confirm that
   is the intended contract and that nothing in the current code violates it.
6. **Deletion.** Do ingredients get the `deleted` event treatment from decision
   26, or is resurrection acceptable for a library the maintainer curates by
   hand?

## Not in scope for this discussion

USDA import behaviour, the ingredient onboarding chain (#6–#10), and the
provenance sidecar (#10) — those consume whatever schema this settles.
