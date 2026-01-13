# Ice Ed Modularization - Roadmap

**Project:** Complete modularization Steps 7-9
**Goal:** Reduce `js/app.js` from 1,666 lines to ~150 lines

## Phases

### Phase 7: Extract Tools Module
**Status:** Complete (2026-01-13)
**Goal:** Extract calculator tools to `js/utils/tools.js`
**Output:** PAC/POD, G/Mol, and Egg/Yolk calculators in dedicated module (396 lines)
**Plans:** 1/1 complete

### Phase 8: Extract Core Models
**Status:** Complete (2026-01-13)
**Goal:** Extract data models to `js/models/core.js`
**Output:** cTargetValue, cTarget, Targets, cRecipe classes with dependency injection (155 lines)
**Plans:** 1/1 complete

### Phase 9: Extract Recipe Manager
**Status:** Complete (2026-01-13)
**Goal:** Extract recipe operations to `js/features/recipe-manager.js`
**Output:** DisplayRecipe, UpdateRecipeSums, OptimizeRecipe, recipe CRUD, scaling, validation (1,140 lines)
**Plans:** 4/4 complete
**Notes:**
- ISS-001 and ISS-002 resolved (removed deprecated Check for Updates feature)
- app.js reduced to 364 lines (78% reduction from original 1,666)

## Success Criteria

- ✅ All existing tests pass after each phase
- ✅ `js/app.js` reduced from 1,666 to 364 lines (78% reduction)
- ✅ No module exceeds 1,200 lines (recipe-manager.js at 1,140 lines)
- ✅ App remains fully functional
- ✅ 9 specialized modules created

## References

- `MODULARIZATION_PLAN.md` - Detailed extraction strategy
- `WORKFLOW.md` - Testing workflow
- `.planning/codebase/` - Codebase analysis
- `.planning/STRICT-MODE-AUDIT.md` - Strict mode compatibility checklist
- `.planning/ISSUES.md` - Deferred issues log
