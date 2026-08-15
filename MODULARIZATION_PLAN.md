# Ice Ed JavaScript Modularization Plan - Incremental Approach

> # ✅ PROJECT COMPLETE — closed 2026-08-15
>
> **All nine extraction steps landed.** `js/app.js` is **464 lines of wiring
> with zero top-level functions**, down from 2,694. Every planned module exists,
> and the tree grew past the plan: 21 modules rather than the 10 forecast, plus
> a node unit lane (`tests/unit/`, 175 cases) the plan never anticipated.
>
> ## ⚠️ This document is NOT the project record. The GSD records are.
>
> Steps 7–9 were executed under the **Get Shit Done** methodology and tracked in
> `.planning/`, not here. That is why this file reads as stalled at Step 6: it
> was superseded mid-project and never updated, not abandoned.
>
> **The authoritative history, in order of usefulness:**
>
> | Record | What it holds |
> |---|---|
> | `.planning/milestones/v1.0-ROADMAP.md` | The milestone. *"Status: SHIPPED 2026-01-13 · Phases: 7-9 · Total Plans: 6."* Per-phase goals, dependencies, and what each extraction actually did. |
> | `.planning/phases/07-extract-tools/` | `07-01` PLAN + SUMMARY |
> | `.planning/phases/08-extract-models/` | `08-01` PLAN + SUMMARY |
> | `.planning/phases/09-extract-recipe-manager/` | `09-01`…`09-04`, four PLAN + SUMMARY pairs — recipe-manager was the one extraction that needed splitting |
>
> Those 13 files carry detail that exists nowhere else. Phase 7's summary, for
> example: *"Reduced js/app.js by 302 lines (from 1668 to 1366) … Fixed
> pre-existing undeclared variable bugs exposed by extraction."*
>
> **Steps 1–6 predate GSD adoption** and have no phase directories — nothing in
> `.planning/` references phases 01–06. Those six steps are documented only in
> this file, which is the one job it still does.
>
> **Do not restart any of it.** The code is the authority on the result; the GSD
> records are the authority on how it was done. Live status is
> `.planning/STATE.md`.
>
> One target worth knowing: v1.0's stated goal was reducing `app.js` to **~150
> lines** of orchestration. It is 464. That is not a v1.0 miss — phases 10–20
> (storage interface, library UI, cloud sync) added wiring after v1.0 shipped —
> but 150 is the bar the original plan set, if it is ever worth meeting.
>
> **One success criterion was NOT met, and is now a live concern rather than a
> refactor leftover:** *no file exceeds 600 lines* (see Success Criteria below).
> `js/features/recipe-manager.js` is **1,837** and `js/features/ingredients.js`
> is **862**. recipe-manager breached the bound *after* the refactor, during
> P0.3, which pushed identity, minting, adoption and the save guards into it.
> Splitting it is unscheduled work, not unfinished work.

## Current State — as of project close (2026-08-15)

| | Planned | Actual |
|---|---|---|
| `js/app.js` | thin wiring | **464 lines, no top-level functions** (was 2,694) |
| Modules | 10 focused files | **21** under `js/` |
| Largest file | ≤ 600 lines | **1,837** (`recipe-manager.js`) ❌ |
| Test lane | Playwright only | Playwright **+ 175-case node unit lane** |

Historical state at the time this section was last accurate (Step 6):

✅ HTML: 377 lines (clean structure)
✅ CSS: 455 lines in `css/styles.css`
✅ **Step 1 COMPLETE:** Helper functions extracted to `js/utils/helpers.js` (127 lines)
✅ **Step 2 COMPLETE:** Ingredients data extracted to `data/ingredients.json`
✅ **Step 3 COMPLETE:** Ingredients module extracted to `js/features/ingredients.js` (749 lines)
✅ **Step 4 COMPLETE:** Calculations extracted to `js/features/calculations.js` (95 lines)
✅ **Step 5 COMPLETE:** UI components extracted to `js/ui/components.js` (180 lines)
✅ **Step 6 COMPLETE:** Graph renderer extracted to `js/ui/graph.js` (118 lines)
- JavaScript: ~1,666 lines in `js/app.js` (down from 2,694)
- ⚠️ **Lesson learned:** ES6 modules enable strict mode - need to test for strict mode bugs BEFORE extraction

## Goal
Extract JavaScript functionality into focused modules **ONE AT A TIME**, testing after each extraction to ensure the app still works.

## Strategy: Test-First Incremental Extraction
For each extraction:
1. **Write/identify tests FIRST** - Establish baseline that current code passes
2. **Extract code** - Move functions to new module
3. **Run tests** - Verify no regression
4. **Commit** - Save progress with working state

This prevents breaking changes and catches issues immediately.

### Test Automation Script
Before starting Step 2, create `test-app.js` that:
- Uses Playwright to run automated tests
- Tests each major feature (tabs, recipe operations, ingredient operations)
- Can be run before/after each extraction step
- Exits with code 0 (success) or 1 (failure)

Usage: `node test-app.js` or `npm test`

---

## Extraction Order & Plan

### Step 1: Extract Helper Functions (utils/helpers.js) ✅ COMPLETE
**Status:** Done

**What was extracted:**
- `toFloat()` - Parse float with locale support
- `clickOn()` - Programmatic click helper
- `decimalSeparator` - Locale decimal separator constant

---

### Step 2: Extract Ingredients Data (data/ingredients.json)
**Why now:** Separate data from code, enables easier ingredient management and testing

**What to extract:**
- The 72 ingredients currently embedded as JSON in `app.js` (lines 126-202)
- Marked with `/*INGREDIENTS_START_MARKER*/` and `/*INGREDIENTS_END_MARKER*/`

**Current structure per ingredient:**
\`\`\`json
{
  "Whole Milk 3.5%": {
    "Water": 0.8813,
    "Sugar": 0.0505,
    "Fat": 0.035,
    "Solids": 0.1187,
    "MSNF": 0.087,
    "PAC": 0.04,
    "POD": 0.0077,
    "kcal": 0.61
  }
}
\`\`\`

**New file:** `data/ingredients.json`
\`\`\`json
{
  "version": 1,
  "ingredients": {
    "Alcohol 40%": { ... },
    ...72 ingredients...
    "Yogurt 3.5%": { ... }
  }
}
\`\`\`

**Loading strategy:**
- Use `fetch()` to load JSON at app startup
- Handle loading errors gracefully (show message if fetch fails)
- Cache in global `Ingredients` variable as before

**Testing:**
1. ✅ JSON file is valid (can be parsed)
2. ✅ All 72 ingredients present
3. ✅ Each ingredient has required fields: Water, Sugar, Fat, MSNF, Solids, PAC, POD, kcal
4. ✅ App loads ingredients correctly on startup
5. ✅ Ingredients appear in dropdown and Ingredients List tab

---

### Step 3: Extract Ingredient Module (features/ingredients.js)
**Why now:** Large isolated feature (~600+ lines), clear boundaries, USDA integration is self-contained

**What to extract:**

**A. cIngredient Class (lines 59-124)**
\`\`\`javascript
export class cIngredient {
  constructor(water, sugar, fat, MSNF, PAC, POD, kcal, stabilizer)
  // Properties: Water, Sugar, Fat, MSNF, Solids, PAC, POD, kcal, Stabilizer
  // Computed: isSugar, isMilkPowder, milkFat, nonLactoseSugar
  // Methods: copy()
}
\`\`\`

**B. Ingredients Data Management**
- `Ingredients` - Global ingredients object (loaded from JSON)
- `IngredientNames()` - Returns sorted array of ingredient names
- `SortIngredients()` - Alphabetically sorts ingredients object
- `IngredientDataFields` constant - `["Water", "Sugar", "Fat", "MSNF", "Solids", "PAC", "POD", "Stabilizer", "kcal"]`

**C. Ingredient CRUD Operations**
- `onIngredientEdit()` (lines 1457-1515) - Edit ingredient properties
- `onIngredientDeleted()` (lines 1542-1555) - Delete with usage validation
- `isIngredientUsed()` (lines 1517-1540) - Check if ingredient used in recipe

**D. Ingredient Display & Filtering**
- `DisplayIngredients()` (lines 1801-1828) - Render ingredients table
- `createIngredientRow()` (lines 1746-1799) - Create table row for ingredient
- `filterIngredients()` (lines 1448-1454) - Filter by search term
- `onIngredientFilterEdit()` (lines 1443-1446) - Handle filter input

**E. Import/Export**
- `importIngredients()` (lines 1330-1441) - Import with merge conflict resolution
- `diffIngredients()` (lines 1312-1328) - Compare two ingredient objects

**F. USDA FoodData Central Integration**
- `onDownloadIngredientData()` (lines 1557-1743) - Full USDA API integration
- Damerau-Levenshtein fuzzy matching for search results
- Modal dialog for selecting food item

**Exports:**
\`\`\`javascript
// Class
export class cIngredient { /* ... */ }

// Data
export let Ingredients;
export const IngredientDataFields;
export function IngredientNames() { /* ... */ }
export function SortIngredients() { /* ... */ }
export async function loadIngredients() { /* ... */ }

// CRUD
export function editIngredient(name, field, value) { /* ... */ }
export function deleteIngredient(name) { /* ... */ }
export function isIngredientUsed(name) { /* ... */ }

// Display
export function DisplayIngredients() { /* ... */ }
export function filterIngredients(term) { /* ... */ }

// Import/Export
export function importIngredients(data, mode) { /* ... */ }
export function diffIngredients(a, b) { /* ... */ }

// USDA
export async function searchUSDA(query) { /* ... */ }
export function fetchUSDADetails(fdcId) { /* ... */ }
\`\`\`

**Dependencies on other modules:**
- `helpers.js` - Uses `toFloat()`, `clickOn()`, `decimalSeparator`
- `file-io.js` - Uses `saveIngredientsToFile()`, `parseIngredientsFile()`

**Dependencies FROM other modules:**
- Recipe system uses `Ingredients` global and `cIngredient` class
- Recipe dropdowns use `IngredientNames()`

---

### Step 3 Testing Requirements

**Unit Tests (add to test-app.js or new test file):**

**A. cIngredient Class Tests:**
1. ✅ Create ingredient with all properties
2. ✅ Computed `Solids` = 1 - Water
3. ✅ `isSugar` returns true for sugar-type ingredients (Sugar > 0.5)
4. ✅ `isMilkPowder` detection works
5. ✅ `copy()` creates independent copy

**B. Ingredients Data Tests:**
1. ✅ `loadIngredients()` fetches and parses JSON
2. ✅ `IngredientNames()` returns sorted array
3. ✅ `SortIngredients()` alphabetizes correctly
4. ✅ Handle missing/corrupt JSON file gracefully

**C. CRUD Operation Tests:**
1. ✅ Create new ingredient - appears in list
2. ✅ Edit ingredient property - value updates
3. ✅ Edit ingredient name - name changes, old name removed
4. ✅ Delete unused ingredient - removed from list
5. ✅ Delete used ingredient - shows error, ingredient remains
6. ✅ `isIngredientUsed()` returns true when ingredient in recipe
7. ✅ `isIngredientUsed()` returns false when ingredient not used

**D. USDA Integration Tests:**
1. ✅ `searchUSDA()` returns results for valid query (e.g., "milk")
2. ✅ `searchUSDA()` handles empty query
3. ✅ `searchUSDA()` handles API errors gracefully
4. ✅ Fuzzy matching filters irrelevant results
5. ✅ Selected USDA item populates ingredient fields correctly
6. ✅ USDA data conversion: nutrients → app format (decimals, not percentages)

**E. Import/Export Tests:**
1. ✅ Export ingredients creates valid .iei file
2. ✅ Import ingredients (replace mode) replaces all
3. ✅ Import ingredients (merge mode) adds new, keeps existing
4. ✅ Import with conflicts shows diff dialog
5. ✅ `diffIngredients()` detects added/modified/removed

**F. Display & Filter Tests:**
1. ✅ `DisplayIngredients()` shows all 72 default ingredients
2. ✅ Filter "milk" shows only milk-containing ingredients
3. ✅ Clear filter shows all ingredients again
4. ✅ Ingredient row shows correct values
5. ✅ Editing in table triggers `onIngredientEdit()`

**Integration Tests (existing in test-app.js):**
- `testIngredientsList()` - Already tests display and filter
- `testIngredientSaving()` - Already tests save to file
- `testRecipeBuilding()` - Already tests adding ingredients to recipe

---

### Step 4: Extract Calculations (features/calculations.js) ✅ COMPLETE
**Status:** Done

**What was extracted:**
- `SE_to_FPD()` / `FDP_to_SE()` - Sucrose equivalent conversion functions
- `CalcFDP()` - Freezing point depression calculation
- `GetIdealPAC()` - Ideal PAC from temperature
- `Fitness()` - Recipe optimization fitness function

**Lines:** 95 lines

**Exports:**
```javascript
export { SE_to_FPD, FDP_to_SE, CalcFDP, GetIdealPAC, Fitness };
```

---

### Step 5: Extract UI Components (ui/components.js) ✅ COMPLETE
**Status:** Done

**What was extracted:**
- Tab system with dependency-injected callbacks (`initTabs`, `initUIComponents`)
- Modal dialog system (`showModal`, `hideModal`)
- Status bar messaging (`Info`, `Warning`, `ErrorMsg`, `SetStatusBarMessage`)
- CSS helper (`getCSS`)

**Lines:** 180 lines

**Exports:**
```javascript
export { initUIComponents, initTabs, showModal, hideModal, Info, Warning, ErrorMsg, SetStatusBarMessage, getCSS };
```

---

### Step 6: Extract Graph Renderer (ui/graph.js) ✅ COMPLETE
**Status:** Done

**What was extracted:**
- `DrawFreezingGraph()` - Canvas-based freezing curve visualization
- Imports `CalcFDP` from calculations.js

**Lines:** 118 lines

**Exports:**
```javascript
export { DrawFreezingGraph };
```

---

### Step 7: Extract Tools (utils/tools.js)
**Why:** Standalone calculators, moderate dependencies

**What to extract:**
- PAC/POD calculator
- G/Mol calculator
- Egg/Yolk calculator

**Lines:** ~314 lines

**Exports:**
\`\`\`javascript
export function initPACPODCalculator() { /* ... */ }
export function initGMolCalculator() { /* ... */ }
export function initYolkCalculator() { /* ... */ }
\`\`\`

**Testing after:** Test all calculators in Tools tab

---

### Step 8: Extract Core Models (models/core.js)
**Why:** Remaining classes after ingredients extracted

**What to extract:**
- \`cTarget\` class
- \`cTargetValue\` class
- \`cRecipe\` class (structure only)
- \`cVersion\` class
- \`cEgg\` class
- Targets definitions
- Sugars reference table

**Exports:**
\`\`\`javascript
export class cRecipe { /* ... */ }
export class cTarget { /* ... */ }
export class cTargetValue { /* ... */ }
export class cVersion { /* ... */ }
export class cEgg { /* ... */ }

export const Targets = { /* ... */ };
export const Sugars = { /* ... */ };
\`\`\`

**Testing after:** Verify recipe targets display correctly, version info shows

---

### Step 9: Extract Recipe Manager (features/recipe-manager.js)
**Why last:** Largest module, most dependencies, core functionality - highest risk

**What to extract:**
- \`DisplayRecipe()\` - Main rendering
- \`UpdateRecipeSums()\` - Calculation updates
- \`OptimizeRecipe()\` - Optimization algorithm
- Recipe CRUD operations
- Recipe scaling
- Recipe validation
- Backup/restore stack

**Lines:** ~1,150 lines

**Exports:**
\`\`\`javascript
export function initializeRecipe() { /* ... */ }
export function DisplayRecipe() { /* ... */ }
export function UpdateRecipeSums() { /* ... */ }
export function OptimizeRecipe(mode) { /* ... */ }
export function ScaleRecipe() { /* ... */ }
export function CategorizeRecipe() { /* ... */ }
export function CheckRecipe() { /* ... */ }
export let RecipeBackup = [];
export let RecipeStack = {};
\`\`\`

**Testing after:** FULL end-to-end test of all recipe functionality

---

### Final Step: Update app.js
**What remains:**
- Import all modules
- Global constants (VERSION, RecipeDataColumns)
- Event listener setup
- Hide JavaScript warning
- Initialize tabs and display initial data

**Result:** ~150-200 lines

---

## Critical Implementation Details

### Module Type
All modules must use ES6 export/import syntax.

### index.html Change
Change:
\`\`\`html
<script src="js/app.js"></script>
\`\`\`
To:
\`\`\`html
<script type="module" src="js/app.js"></script>
\`\`\`

### Global State Strategy
Modules that currently rely on global variables (Recipe, Ingredients, etc.) will:
1. Export them from their home module
2. Import them in modules that need them
3. Keep app.js importing and re-exporting for backwards compatibility during transition

### Testing Checklist (After Each Step)
1. ✅ Page loads without console errors
2. ✅ "Please enable Javascript" warning hidden
3. ✅ All tabs accessible
4. ✅ Specific functionality for that module works
5. ✅ No regression in previously tested features

---

## File Structure (Current/Final)

\`\`\`
/icecream/
├── index.html (377 lines)
├── IceEd.html (original backup)
├── css/
│   └── styles.css (455 lines)
├── data/
│   └── ingredients.json - Default ingredient database (76 ingredients) ✅
├── js/
│   ├── app.js (~1,666 lines → ~150 lines final) - Main entry point
│   ├── models/
│   │   └── core.js (~200 lines) - Recipe, Target, Egg classes [Step 8]
│   ├── features/
│   │   ├── ingredients.js (749 lines) ✅
│   │   ├── calculations.js (95 lines) ✅
│   │   └── recipe-manager.js (~600 lines) [Step 9]
│   ├── ui/
│   │   ├── components.js (180 lines) ✅
│   │   └── graph.js (118 lines) ✅
│   └── utils/
│       ├── helpers.js (127 lines) ✅
│       ├── file-io.js (92 lines) ✅
│       └── tools.js (~314 lines) [Step 7]
├── test-app.js - Playwright test suite (76 tests)
├── start.sh
└── serve.sh
\`\`\`

---

## Success Criteria — final scoring (2026-08-15)

✅ Each extraction is testable independently
✅ App remains functional after every step
✅ Clear rollback point (backup before each extraction)
✅ All 2,694 lines eventually split into 10 focused files — **exceeded, 21 modules**
❌ **No file exceeds 600 lines** — `recipe-manager.js` 1,837, `ingredients.js` 862.
   The only miss. recipe-manager broke the bound after this project closed, by
   absorbing P0.3's identity work; ingredients.js has been over since Step 3,
   when it was extracted at 749 lines and grew from there.
✅ Foundation for future enhancements — P0.1–P0.5 were built on it directly

---

## Rollback Strategy

Before each extraction:
1. Commit to git OR
2. Copy \`js/app.js\` to \`js/app.js.backup-step-N\`

If something breaks:
1. Revert the extraction
2. Identify the issue
3. Fix and retry
