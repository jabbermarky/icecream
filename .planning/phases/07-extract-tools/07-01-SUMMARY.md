---
phase: 07-extract-tools
plan: 01
subsystem: utils
tags: [calculator, pac, pod, gmol, egg, yolk, tools]

# Dependency graph
requires:
  - phase: 06-extract-graph
    provides: ui/components.js dependency injection pattern
provides:
  - Calculator tools module (PAC/POD, G/Mol, Egg/Yolk)
  - Dependency injection for Recipe access
  - Sugars and eggTypes reference data constants
affects: [08-extract-models]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dependency injection via init function for Recipe access"
    - "Return object from init function for tab handler integration"

key-files:
  created:
    - js/utils/tools.js
  modified:
    - js/app.js

key-decisions:
  - "Use getRecipe function for deferred Recipe access"
  - "Return InitYolkTable from initYolkCalculator for tab handler"

patterns-established:
  - "Return handler functions from init for external use"

issues-created: []

# Metrics
duration: 16min
completed: 2026-01-13
---

# Phase 7 Plan 01: Extract Tools Module Summary

**Extracted PAC/POD calculator, G/Mol calculator, and Egg/Yolk calculator to js/utils/tools.js with dependency injection for Recipe access**

## Performance

- **Duration:** 16 min
- **Started:** 2026-01-13T20:18:58Z
- **Completed:** 2026-01-13T20:34:46Z
- **Tasks:** 3
- **Files modified:** 2 (created 1, modified 1)

## Accomplishments

- Created js/utils/tools.js (396 lines) with all three calculator tools
- Reduced js/app.js by 302 lines (from 1668 to 1366)
- Maintained backward compatibility with InitYolkTable for tab handler
- Fixed pre-existing bugs exposed by extraction (undeclared variables)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tools.js module** - `9d62981` (feat)
2. **Task 2: Update app.js imports** - `36a059c` (feat)
3. **Task 3: Fix undeclared variables** - `936de39` (fix)

**Plan metadata:** (pending)

## Files Created/Modified

- `js/utils/tools.js` - New module (396 lines) with:
  - `Sugars` constant - Sugar reference table with g/mol and POD values
  - `eggTypes` constant - Egg weight standards by region
  - `cEgg` class - Egg calculator model
  - `initPACPODCalculator()` - PAC/POD calculator UI setup
  - `initGMolCalculator()` - G/Mol calculator UI setup
  - `initYolkCalculator()` - Egg/Yolk calculator UI setup
  - `initTools()` - Dependency injection for Recipe access

- `js/app.js` - Updated to import and use tools module
  - Added import for tools module functions and constants
  - Added initTools({ getRecipe: () => Recipe }) call
  - Removed ~302 lines of extracted tool code
  - Fixed undeclared var for `input` and `btn` in CreateRecipeRow

## Decisions Made

1. **Deferred Recipe access via getRecipe function** - The Recipe object isn't available at module load time, so we inject a getter function that retrieves it when needed
2. **Return InitYolkTable from initYolkCalculator** - The tab handler needs to call InitYolkTable when the Yolk tab is activated, so we return it from the init function for app.js to capture

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed undeclared variable `input` in CreateRecipeRow**
- **Found during:** Task 3 (Running tests)
- **Issue:** Line 431 used `input = document.createElement(...)` without `var` declaration - this was a pre-existing implicit global that only worked because the tools block happened to declare a `var input` in an outer scope
- **Fix:** Added `var` declaration
- **Files modified:** js/app.js
- **Verification:** Tests pass, no console errors
- **Committed in:** 936de39

**2. [Rule 1 - Bug] Fixed undeclared variable `btn` in CreateRecipeRow**
- **Found during:** Task 3 (Running tests)
- **Issue:** Line 460 used `btn = document.createElement(...)` without `var` declaration - same issue as above
- **Fix:** Added `var` declaration
- **Files modified:** js/app.js
- **Verification:** Tests pass, no console errors
- **Committed in:** 936de39

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes were for pre-existing bugs exposed by the extraction. No scope creep.

## Issues Encountered

- **Initial test failures:** Recipe loading and building tests failed after extraction. Investigation revealed JavaScript runtime errors ("input is not defined", "btn is not defined") due to implicit global variables that were accidentally masked by the old tools code block scope. Fixed by adding proper `var` declarations.

## Next Phase Readiness

- Tools extraction complete, ready for Phase 8: Extract Core Models
- No blockers or concerns

---
*Phase: 07-extract-tools*
*Completed: 2026-01-13*
