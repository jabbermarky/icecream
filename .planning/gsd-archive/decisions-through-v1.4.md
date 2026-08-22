# Accumulated decisions through v1.4

*An append-only archive, not state. Lifted out of `STATE.md` on 2026-08-17 —
it is history, and history does not belong in the file a session reads to find
out what is true now.*

Kept because the reasoning is still load-bearing in the code. This table stops
at the v1.4 milestone (archived 2026-01-15); everything after it is in
`decisions.jsonl` and in commit messages.
| Phase | Decision | Rationale |
|-------|----------|-----------|
| 07 | Deferred Recipe access via getRecipe function | Recipe not available at module load time |
| 07 | Return InitYolkTable from initYolkCalculator | Tab handler needs access to initialize yolk values |
| 08 | Constructor defaults object for cRecipe | Decouple class from DOM at construction time |
| 08 | Inject RecipeDataColumns via getRecipeDataColumns | Avoid circular dependency with future recipe-manager |
| 09 | Accessor functions for module state | Allow app.js to interact with RecipeBackup/RecipeStack/sortBy owned by recipe-manager |
| 09 | Self-contained recipe-manager module | UpdateRecipeSums now internal, no callback injection needed |
| 09 | initRecipeButtons for button handlers | Keeps handler implementations in recipe-manager module |
| 09 | Remove Check for Updates feature | Deprecated feature with strict mode bug, cleaner to remove than fix |
| 10 | RECIPE_COLS constant for column indices | Avoid magic numbers; safer when columns change |
| 10 | Mousedown tracking for drag handle restriction | dragstart target is always the row, not clicked element |
| 11 | Clear sortBy on drag-drop reorder | Prevent misleading sort indicator after manual reorder |
| 11 | DOM-based test verification | window.Recipe reference becomes stale after setRecipe() calls |
| 12 | idb library from ESM CDN | No npm install or bundler needed, lightweight — **superseded in v0.5.0, now vendored** |
| 12 | Storage interface pattern | Enables future backend swaps (cloud sync) without changing consumers |
| 12 | Graceful error handling in storage | Return null/empty array on failure, matches existing parseRecipeFile pattern |
| 13 | Callback pattern for library actions | onLoad/onDelete callbacks allow flexible action handling |
| 13 | Browser confirm() for delete | Simpler than custom modal, effective UX |
| 13 | Close modal after delete | Cleaner than refreshing list in place |
| 14 | Save to library as default | Primary action for most users; file export as secondary |
| 14 | Port detection in test runner | Piggyback on VSCode Live Server (5500) when available |
| 15 | Storage methods return boolean | Enables caller to check success/failure and show appropriate feedback |
| 16 | Single 'library' record for ingredients | Simpler than individual records, sufficient for current needs |
| 16 | Storage-first initialization | Enable library-first loading pattern |
| 17 | Fire-and-forget sync (no await) | Don't block user workflow for storage operations — **see the cloud write race above** |
| 17 | Export sync function for recipe-manager | Allow cross-module sync when storing recipe as ingredient |
| 18 | columnLabels/buttonLabels parameters | Configurable dialog labels via parameter objects with defaults |
| 18 | Recipe-specific merge context | Library/Recipe columns + Keep Library/Use Recipe buttons |
| 19 | Made repository public | Free GitHub Pages hosting; user data stays in browser IndexedDB |
| 19 | Relative paths in webmanifest | Icons in same directory, use filenames for subdirectory compatibility |
| 20-03 | Right-click for sign-out | Keep UI clean - primary button action is sync/sign-in |
| 20-03 | Status indicator with 4 states | syncing/synced/error/offline for clear visual feedback |
| 20-04 | Store files in IceCream App Data subfolder | Keep user's Drive root clean |
| 20-04 | Timestamp-based conflict resolution | Newer wins; simple, predictable behavior |

**Deployed:** https://www.marklummus.com/icecream/
**v1.4 archive:** `.planning/milestones/v1.4-ARCHIVE.md`
