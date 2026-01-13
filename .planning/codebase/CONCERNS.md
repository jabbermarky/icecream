# Codebase Concerns

**Analysis Date:** 2026-01-13

## Tech Debt

**Incomplete Modularization:**
- Issue: Main `js/app.js` still contains 1,666 lines of mixed concerns
- Files: `js/app.js`
- Why: Incremental extraction in progress (6/9 steps complete)
- Impact: Large file harder to maintain, test, and understand
- Fix approach: Complete Steps 7-9 per `MODULARIZATION_PLAN.md`:
  - Step 7: Extract tools to `js/utils/tools.js`
  - Step 8: Extract models to `js/models/core.js`
  - Step 9: Extract recipe manager to `js/features/recipe-manager.js`

**Debug Console Statements Left in Code:**
- Issue: Multiple `console.log()` calls remain in production code
- Files:
  - `js/app.js` (lines 257, 266-267) - Recipe sums debugging
  - `js/features/ingredients.js` (lines 80, 84, 88, 91) - milkFat getter debugging
- Why: Development debugging not cleaned up
- Impact: Console noise, exposes implementation details
- Fix approach: Remove or wrap in development-only conditional

**String.prototype.replaceAll Polyfill:**
- Issue: Legacy polyfill for now widely-supported method
- Files: `js/app.js` (lines 46-48)
- Why: Historical browser compatibility
- Impact: Minor - unnecessary code, potential regex edge cases
- Fix approach: Remove polyfill, assume ES2021 support

## Known Bugs

**None critical identified during analysis**

## Security Considerations

**Hardcoded API Key:**
- Risk: USDA API key exposed in client-side JavaScript
- Files: `js/features/ingredients.js` (line 573)
- Current mitigation: USDA API keys are free and low-risk
- Recommendations: Consider proxy server for API calls in production

**innerHTML Usage:**
- Risk: Direct innerHTML assignments could enable XSS if content not sanitized
- Files: `js/app.js` (lines 148, 156, 166, 198, 285, 474, 489, 674, 680)
- Current mitigation: Content sources are controlled (user input, computed values)
- Recommendations: Use `textContent` where HTML is not needed

## Performance Bottlenecks

**Recipe.Sums Getter:**
- Problem: Computed getter iterates all ingredients on every access
- Files: `js/app.js` (lines 251-274)
- Cause: No caching of computed sums
- Improvement path: Cache computed sums, invalidate on recipe change

**DisplayRecipe() Full Rebuild:**
- Problem: Rebuilds entire recipe table DOM on every update
- Files: `js/app.js` (lines 471-530)
- Cause: No incremental DOM updates
- Improvement path: Update only changed rows, or use virtual DOM approach

**Synchronous Optimization:**
- Problem: `OptimizeRecipe()` blocks UI during computation
- Files: `js/app.js` (lines 816-938)
- Cause: Hill-climbing algorithm runs synchronously
- Improvement path: Use Web Workers for background computation

## Fragile Areas

**Optimization Algorithm:**
- Files: `js/app.js` (lines 816-938)
- Why fragile: Complex nested loops, global state modification
- Common failures: Edge cases with extreme target values
- Safe modification: Add comprehensive tests before changes
- Test coverage: Basic test exists, edge cases untested

**USDA API Integration:**
- Files: `js/features/ingredients.js` (lines 558-747)
- Why fragile: External API dependency, complex data mapping
- Common failures: API rate limits, response format changes
- Safe modification: Test with mock responses
- Test coverage: Structure tested, not functional behavior

## Scaling Limits

**Not applicable** - Client-side application with no multi-user concerns

## Dependencies at Risk

**Playwright:**
- Package: `playwright@^1.57.0`
- Risk: Breaking changes in major versions
- Impact: Test suite could break
- Migration plan: Pin to specific version, update carefully

## Missing Critical Features

**No persistent storage:**
- Problem: All data lost on page refresh
- Current workaround: Users must export/import files
- Blocks: Can't save work-in-progress automatically
- Implementation complexity: Low (localStorage or IndexedDB)

**No undo for ingredient edits:**
- Problem: Ingredient changes are immediate and permanent (in session)
- Current workaround: Export before editing as backup
- Blocks: Users hesitant to experiment with edits
- Implementation complexity: Medium (backup stack like recipes have)

## Test Coverage Gaps

**USDA API Integration:**
- What's not tested: Actual API calls, error handling, rate limits
- Risk: API integration could break silently
- Priority: Medium
- Difficulty to test: Requires API mocking setup

**Edge Cases in Calculations:**
- What's not tested: Extreme values, division by zero, NaN handling
- Risk: Calculations could produce incorrect results
- Priority: Medium
- Difficulty to test: Need to identify boundary conditions

**File Import Error Handling:**
- What's not tested: Malformed JSON, wrong file format, empty files
- Risk: Poor error messages or crashes on bad input
- Priority: Low
- Difficulty to test: Create malformed test files

## Code Quality Issues

**Loose Equality:**
- Issue: Multiple uses of `==` instead of `===`
- Files: Throughout `js/app.js`, `js/features/ingredients.js`, `js/features/calculations.js`
- Impact: Potential type coercion bugs
- Fix approach: Replace all `==` with `===`

**Large Functions:**
- Issue: Several functions exceed 50 lines
- Files:
  - `js/app.js:816-938` - `OptimizeRecipe()` (122 lines)
  - `js/app.js:471-530` - `DisplayRecipe()` (59 lines)
  - `js/features/ingredients.js:430-730` - USDA integration (300+ lines)
- Impact: Hard to test, understand, maintain
- Fix approach: Extract helper functions

**Unused/Commented Code:**
- Issue: Dead code and commented-out sections
- Files:
  - `js/app.js` (lines 262, 545-547, 741, 744, 758)
  - `js/ui/graph.js` (lines 93, 114)
- Impact: Code clutter, confusion
- Fix approach: Remove commented code, rely on git history

---

*Concerns audit: 2026-01-13*
*Update as issues are fixed or new ones discovered*
