---
phase: 08-extract-models
plan: 01
subsystem: models
tags: [recipe, target, models, extraction, dependency-injection]

# Dependency graph
requires:
  - phase: 07-extract-tools
    provides: dependency injection pattern
provides:
  - Core data model classes (cTargetValue, cTarget, cRecipe)
  - Target constant definitions (12 ice cream types)
  - Constructor defaults pattern for DOM decoupling
affects: [09-extract-recipe-manager]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Constructor defaults for DOM decoupling"

key-files:
  created:
    - js/models/core.js
  modified:
    - js/app.js

key-decisions:
  - "Use defaults object parameter in cRecipe constructor for DOM decoupling"
  - "Inject RecipeDataColumns via getRecipeDataColumns function"

patterns-established:
  - "Constructor defaults pattern: Pass optional defaults object instead of reading DOM at construction"

issues-created: []

# Metrics
duration: 4min
completed: 2026-01-13
---

# Phase 8 Plan 01: Extract Core Models Summary

**Extracted cTargetValue, cTarget, Targets, and cRecipe to js/models/core.js with constructor defaults for DOM decoupling**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-13T21:00:23Z
- **Completed:** 2026-01-13T21:04:36Z
- **Tasks:** 2
- **Files modified:** 2 (created 1, modified 1)

## Accomplishments

- Created js/models/core.js (155 lines) with all core data model classes
- Reduced js/app.js by 100 lines (from 1366 to 1266)
- Introduced constructor defaults pattern to decouple cRecipe from DOM at construction time
- All 12 target type definitions exported as Targets constant

## Task Commits

Each task was committed atomically:

1. **Task 1: Create core.js module** - `eeb3c9b` (feat)
2. **Task 2: Update app.js imports** - `dadae55` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `js/models/core.js` - New module (155 lines) with:
  - `initModels()` - Dependency injection for RecipeDataColumns
  - `cTargetValue` class - Target range with min/max bounds
  - `cTarget` class - Ice cream type target constraints
  - `Targets` constant - 12 ice cream type definitions
  - `cRecipe` class - Recipe with ingredients and properties

- `js/app.js` - Updated to import and use core models
  - Added import for model classes and functions
  - Added initModels({ getRecipeDataColumns: () => RecipeDataColumns }) call
  - Removed ~100 lines of extracted model code
  - Updated Recipe initialization to use defaults object

## Decisions Made

1. **Constructor defaults object parameter** - The cRecipe class originally read DOM elements (tgtSelection.value, slServingTemperature.value, slHardness.value) directly in its constructor. This tightly coupled the class to the DOM. Changed to accept an optional `defaults` object parameter, allowing app.js to pass DOM values at construction while the module can use sensible defaults when DOM isn't available.

2. **RecipeDataColumns dependency injection** - The cRecipe.Sums getter uses RecipeDataColumns. Instead of importing it (which would create a circular dependency when recipe-manager moves in Phase 9), we inject it via initModels() function.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - extraction was clean and all tests passed on first attempt.

## Next Phase Readiness

- Core models extraction complete, ready for Phase 9: Extract Recipe Manager
- RecipeDataColumns will move with recipe-manager.js in Phase 9
- No blockers or concerns

---
*Phase: 08-extract-models*
*Completed: 2026-01-13*
