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
**Status:** Not started
**Goal:** Extract recipe operations to `js/features/recipe-manager.js`
**Output:** DisplayRecipe, UpdateRecipeSums, OptimizeRecipe, recipe CRUD, scaling, validation (~1,150 lines)
**Pre-req:** Run strict mode audit on extraction targets (see STRICT-MODE-AUDIT.md)
**Note:** Remove Check for Updates feature (ISS-001) during final cleanup

## Success Criteria

- All existing tests pass after each phase
- `js/app.js` reduced to ~150 lines after Phase 9
- No module exceeds 600 lines
- App remains fully functional

## References

- `MODULARIZATION_PLAN.md` - Detailed extraction strategy
- `WORKFLOW.md` - Testing workflow
- `.planning/codebase/` - Codebase analysis
- `.planning/STRICT-MODE-AUDIT.md` - Strict mode compatibility checklist
- `.planning/ISSUES.md` - Deferred issues log
