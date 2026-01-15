# Ice Ed Modularization - Project Definition

**Created:** 2026-01-13
**Status:** v1.3 Complete

## Vision

Complete the modularization of Ice Ed from a partially-extracted codebase to a fully-modular ES6 architecture. Reduce `js/app.js` from 1,666 lines to ~150 lines of orchestration code by extracting the remaining functionality into focused modules.

## Background

Ice Ed is an ice cream recipe formulation tool that calculates PAC (freezing point depression), POD (sweetening power), fat content, and other properties. The codebase originated as a single HTML file and has been incrementally modularized through 9 extraction steps.

## Current State (v1.3 Shipped)

Shipped v1.3 Ingredient Persistence on 2026-01-15.

**Codebase:**
- `js/app.js`: 364 lines (78% reduction from original 1,666)
- 12 specialized modules totaling ~4,400 lines
- Test suite: 27 test methods in Playwright
- `js/features/recipe-manager.js`: 1,363 lines (includes drag-drop + save workflow)

**v1.3 Features:**
- Ingredient library persisted in IndexedDB
- Auto-sync ingredient changes (edits, deletes, imports)
- Library-first loading on app startup
- Context-aware merge dialog when loading recipes
- Clear Library/Recipe column labels in merge conflicts
- Keep Library/Use Recipe action buttons

**Architecture:**
- `js/utils/helpers.js` (127 lines) — Utility functions
- `js/utils/file-io.js` (92 lines) — File save/load
- `js/utils/tools.js` (396 lines) — Calculator tools
- `js/ui/components.js` (180 lines) — UI components
- `js/ui/graph.js` (118 lines) — Freezing curve graph
- `js/ui/recipe-library.js` (116 lines) — Recipe library modal
- `js/models/core.js` (155 lines) — Core data models
- `js/storage/storage.js` (51 lines) — Storage interface
- `js/storage/indexeddb-storage.js` (221 lines) — IndexedDB implementation (recipes + ingredients)
- `js/features/calculations.js` (98 lines) — Recipe calculations
- `js/features/ingredients.js` (827 lines) — Ingredient management + storage sync
- `js/features/recipe-manager.js` (1,350 lines) — Recipe operations + drag-drop + save

## Requirements

### Validated

- R1: Extract Tools Module — v1.0
- R2: Extract Core Models — v1.0
- R3: Extract Recipe Manager — v1.0
- R4: Clean Up app.js — v1.0 (364 lines, slightly over 200-line target)
- R5: Drag-drop ingredient reordering — v1.1
- R6: Order persistence through save/load — v1.1
- R7: Pluggable storage interface — v1.2
- R8: IndexedDB recipe library — v1.2
- R9: Recipe library UI (list, load, delete) — v1.2
- R10: Save to library workflow — v1.2
- R11: Ingredient library persistence — v1.3
- R12: Auto-sync ingredient changes — v1.3
- R13: Context-aware merge dialog — v1.3

### Out of Scope

The following are explicitly deferred:
- Cloud sync storage backend
- Ingredient workflow improvements (research/calculation process)
- Performance optimizations

## Constraints

### C1: Test Suite Must Pass
All existing tests must pass after each extraction. Run `npm test` before and after every step.

### C2: No Functional Changes
Extract code as-is. Do not refactor, optimize, or fix bugs during extraction. Behavior must remain identical.

### C3: Follow Established Patterns
Use the same patterns established in Steps 1-6:
- ES6 named exports (no default exports)
- Dependency injection for DOM decoupling
- Kebab-case file names
- Imports at top of modules

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Deferred Recipe access via getRecipe | Recipe not available at module load time | Good |
| Constructor defaults for cRecipe | Decouple class from DOM at construction | Good |
| Self-contained recipe-manager module | UpdateRecipeSums internal, no callback needed | Good |
| Remove Check for Updates feature | Deprecated with strict mode bug, cleaner to remove | Good |
| Accessor functions for module state | Allow app.js to interact with module-owned state | Good |
| RECIPE_COLS constant for column indices | Avoid magic numbers; safer when columns change | Good |
| Mousedown tracking for drag handle | dragstart target is always the row, not clicked element | Good |
| Clear sortBy on drag-drop reorder | Prevent misleading sort indicator after manual reorder | Good |
| idb library from ESM CDN | No npm install or bundler needed, lightweight | Good |
| Storage interface pattern | Enables future backend swaps without changing consumers | Good |
| Callback pattern for library actions | Flexible action handling for load/delete | Good |
| Save to library as default | Primary action for users; file export as secondary | Good |
| Storage methods return boolean | Enables caller to show appropriate feedback | Good |
| Single 'library' record for ingredients | Simpler than individual records, sufficient for needs | Good |
| Fire-and-forget sync | Don't block user workflow for storage operations | Good |
| Configurable dialog labels | Parameter objects with defaults for context-specific UX | Good |

## References

- `MODULARIZATION_PLAN.md` - Detailed extraction strategy
- `WORKFLOW.md` - Testing workflow
- `.planning/codebase/` - Codebase analysis documents
- `.planning/MILESTONES.md` - Shipped milestones

---
*Last updated: 2026-01-15 after v1.3 milestone*
