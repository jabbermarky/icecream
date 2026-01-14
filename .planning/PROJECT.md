# Ice Ed Modularization - Project Definition

**Created:** 2026-01-13
**Status:** v1.1 Complete

## Vision

Complete the modularization of Ice Ed from a partially-extracted codebase to a fully-modular ES6 architecture. Reduce `js/app.js` from 1,666 lines to ~150 lines of orchestration code by extracting the remaining functionality into focused modules.

## Background

Ice Ed is an ice cream recipe formulation tool that calculates PAC (freezing point depression), POD (sweetening power), fat content, and other properties. The codebase originated as a single HTML file and has been incrementally modularized through 9 extraction steps.

## Current State (v1.1 Shipped)

Shipped v1.1 Recipe Organization on 2026-01-13.

**Codebase:**
- `js/app.js`: 364 lines (78% reduction from original 1,666)
- 9 specialized modules totaling ~3,600 lines
- Test suite: 22 test methods in Playwright
- `js/features/recipe-manager.js`: 1,325 lines (includes drag-drop)

**v1.1 Features:**
- Drag-drop ingredient reordering with visual handles
- Sort indicator clears on manual reorder
- Order persistence through save/load cycle

**Architecture:**
- `js/utils/helpers.js` (127 lines) — Utility functions
- `js/utils/file-io.js` (92 lines) — File save/load
- `js/utils/tools.js` (396 lines) — Calculator tools
- `js/ui/components.js` (180 lines) — UI components
- `js/ui/graph.js` (118 lines) — Freezing curve graph
- `js/models/core.js` (155 lines) — Core data models
- `js/features/calculations.js` (98 lines) — Recipe calculations
- `js/features/ingredients.js` (749 lines) — Ingredient management
- `js/features/recipe-manager.js` (1,325 lines) — Recipe operations + drag-drop

## Requirements

### Validated

- R1: Extract Tools Module — v1.0
- R2: Extract Core Models — v1.0
- R3: Extract Recipe Manager — v1.0
- R4: Clean Up app.js — v1.0 (364 lines, slightly over 200-line target)
- R5: Drag-drop ingredient reordering — v1.1
- R6: Order persistence through save/load — v1.1

### Out of Scope

The following are explicitly deferred:
- File/data store API changes (keep browser upload/download)
- Ingredient workflow improvements (research/calculation process)
- Performance optimizations
- New features

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

## References

- `MODULARIZATION_PLAN.md` - Detailed extraction strategy
- `WORKFLOW.md` - Testing workflow
- `.planning/codebase/` - Codebase analysis documents
- `.planning/MILESTONES.md` - Shipped milestones

---
*Last updated: 2026-01-13 after v1.1 milestone*
