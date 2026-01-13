# Ice Ed Modularization - Project Definition

**Created:** 2026-01-13
**Status:** Active

## Vision

Complete the modularization of Ice Ed from a partially-extracted codebase to a fully-modular ES6 architecture. Reduce `js/app.js` from 1,666 lines to ~150 lines of orchestration code by extracting the remaining functionality into focused modules.

## Background

Ice Ed is an ice cream recipe formulation tool that calculates PAC (freezing point depression), POD (sweetening power), fat content, and other properties. The codebase originated as a single HTML file and has been incrementally modularized through 6 extraction steps. Steps 7-9 remain to complete the modularization.

### Current State
- Steps 1-6: Complete (helpers, ingredients data, ingredients module, calculations, UI components, graph)
- `js/app.js`: 1,666 lines (down from 2,694)
- Test suite: 21 test methods in Playwright

### Target State
- Steps 7-9: Complete
- `js/app.js`: ~150 lines (imports, event setup, initialization)
- No module exceeds 600 lines

## Core Requirements

### R1: Extract Tools Module (Step 7)
Extract calculator tools from `js/app.js` to `js/utils/tools.js`:
- PAC/POD calculator
- G/Mol calculator
- Egg/Yolk calculator
- ~314 lines of code

**Acceptance:** All tools in Tools tab function correctly after extraction.

### R2: Extract Core Models (Step 8)
Extract data models from `js/app.js` to `js/models/core.js`:
- `cTarget` class
- `cTargetValue` class
- `cRecipe` class (structure only, not recipe operations)
- `cVersion` class
- `cEgg` class
- `Targets` constant definitions
- `Sugars` reference table

**Acceptance:** Recipe targets display correctly, version info shows.

### R3: Extract Recipe Manager (Step 9)
Extract recipe operations from `js/app.js` to `js/features/recipe-manager.js`:
- `DisplayRecipe()` - main rendering
- `UpdateRecipeSums()` - calculation updates
- `OptimizeRecipe()` - optimization algorithm
- Recipe CRUD operations
- Recipe scaling
- Recipe validation
- Backup/restore stack (`RecipeBackup`, `RecipeStack`)
- ~1,150 lines of code

**Acceptance:** Full end-to-end recipe functionality works.

### R4: Clean Up app.js
After extractions, `js/app.js` should contain only:
- Import statements for all modules
- Global constants (VERSION, RecipeDataColumns)
- Event listener setup
- DOM initialization
- Tab and data initialization calls

**Acceptance:** `js/app.js` is under 200 lines.

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

## Out of Scope

The following are explicitly deferred:
- File/data store API changes (keep browser upload/download)
- Ingredient workflow improvements (research/calculation process)
- Performance optimizations
- Bug fixes (unless they block extraction)
- New features

## Success Criteria

1. All existing tests pass
2. `js/app.js` reduced to ~150-200 lines
3. Three new modules created:
   - `js/utils/tools.js`
   - `js/models/core.js`
   - `js/features/recipe-manager.js`
4. No module exceeds 600 lines
5. App remains fully functional

## References

- `MODULARIZATION_PLAN.md` - Detailed extraction strategy
- `WORKFLOW.md` - Testing workflow
- `.planning/codebase/` - Codebase analysis documents
