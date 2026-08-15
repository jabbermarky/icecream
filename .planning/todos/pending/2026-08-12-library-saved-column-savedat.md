# Library "Saved" column should show SavedAt, not updatedAt

**Status:** deferred by the maintainer (T1 review, tension 3 follow-on) —
user-visible change, and Phase 0 is structural-only.

## What

The Recipe Library's "Saved" column (`js/ui/recipe-library.js:63`) renders the
backend `updatedAt`, which `indexeddb-storage.saveRecipe` re-stamps at write
time (`indexeddb-storage.js:32`) — including on every sync pull. Once sync
runs, every pulled recipe's "Saved" date becomes the pull time: the exact lie
the v2 container's `SavedAt` was added to correct, shown on the one surface a
user actually reads.

## Fix shape

`listRecipes` surfaces the container's `SavedAt` (via `containerSavedAt`,
falling back to `updatedAt` for v1/legacy records) and the library column
renders that. IndexedDB records hold the container under `.data`, so this is a
per-record read of a field that is already there.

## Depends on

P0.3 landed (SavedAt exists on new records). Worth doing in the first
post-Phase-0 UI batch.
