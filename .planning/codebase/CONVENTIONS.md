# Coding Conventions

**Analysis Date:** 2026-01-13

## Naming Patterns

**Files:**
- kebab-case for all JavaScript modules: `file-io.js`, `helpers.js`, `calculations.js`
- Test files: `test-*.js` pattern (`test-app.js`)
- Data files: kebab-case (`ingredients.json`)

**Functions:**
- camelCase for most functions: `toFloat()`, `saveToFile()`, `loadIngredients()`
- PascalCase for some exports (historical): `DrawFreezingGraph()`, `GetIdealPAC()`, `Fitness()`
- Event handlers: `on*` prefix (`onIngredientChanged`, `onRecipeScaled`)

**Variables:**
- camelCase for variables: `decimalSeparator`, `temperatureForTgtHardness`
- CONSTANT_CASE for module constants: `IngredientDataFields`, `RecipeDataColumns`

**Types:**
- Classes: PascalCase with `c` prefix (historical): `cIngredient`, `cRecipe`, `cTarget`
- No TypeScript - plain JavaScript classes

## Code Style

**Formatting:**
- No Prettier/ESLint configured
- Indentation: Tabs (consistent throughout)
- Line length: ~80-120 characters (informal)
- Quotes: Single quotes for strings, double quotes in JSON
- Semicolons: Required (consistent use)

**Linting:**
- No automated linting configured
- Manual conventions followed by inspection

## Import Organization

**Order:**
1. Relative imports from utils (`../utils/helpers.js`)
2. Relative imports from features (`../features/calculations.js`)

**Grouping:**
- Single import statement per module
- Named exports grouped in destructuring

**Path Aliases:**
- None - all relative paths (`../`, `./`)

**Example from `js/features/ingredients.js`:**
```javascript
import { toFloat, round, nGenerator, objIsEmpty, filterPosNumberInput,
         filterNumberInput, DamerauLevenshteinDistance } from '../utils/helpers.js';
```

## Error Handling

**Patterns:**
- `try/catch` around file loading and API calls
- `console.error()` for diagnostic messages
- Alert/modal for user-visible errors

**Error Types:**
- Throw on invalid file format during import
- Return early on validation failure
- Log and continue for non-critical errors

**Logging:**
- `console.log()` for debugging (some left in code)
- `console.error()` for error conditions
- `console.assert()` for internal validation

## Logging

**Framework:**
- Browser console (no external logging library)

**Patterns:**
- `console.log()` for development debugging
- `console.error()` for errors
- `console.assert()` for assertions (without messages in some cases)

## Comments

**When to Comment:**
- JSDoc-style for public function documentation
- Section separators with `// ===` lines
- Inline comments for non-obvious logic

**JSDoc/TSDoc:**
- Used for public API functions
- `@param` and `@returns` tags

**Example from `js/utils/helpers.js`:**
```javascript
/**
 * Parse a string to float, handling locale-specific decimal separators
 * @param {string} string - The string to parse
 * @returns {number} - The parsed float or NaN if invalid
 */
export function toFloat(string) { ... }
```

**Section Separators:**
```javascript
// ============================================================
// Tab System
// ============================================================
```

**TODO Comments:**
- Format: `// TODO: description`
- Some legacy markers: `/*INGREDIENTS_START_MARKER*/`

## Function Design

**Size:**
- Target under 50 lines (some legacy functions exceed this)
- Large functions flagged for refactoring

**Parameters:**
- No strict limit, but options objects used for complex cases
- Default parameters used: `function ShowModal(content, buttons = null)`

**Return Values:**
- Explicit returns
- Early returns for guard clauses

## Module Design

**Exports:**
- Named exports for all public APIs
- No default exports
- Classes and functions exported together

**Example from `js/features/ingredients.js`:**
```javascript
export class cIngredient { ... }
export let Ingredients = {};
export const IngredientDataFields = [...];
export function IngredientNames() { ... }
export function loadIngredients() { ... }
```

**Dependency Injection:**
- Used for decoupling modules from DOM
- `initUIComponents(deps)` pattern

**Example:**
```javascript
export function initUIComponents(deps) {
    if (deps.onTabSwitch) onTabSwitch = deps.onTabSwitch;
}
```

## DOM Element IDs

**Naming Convention:** Prefix + descriptive name

**Prefixes:**
- `btn*` - Buttons: `btnLoadRecipe`, `btnSaveRecipe`
- `ed*` - Input/edit elements: `edRecipeName`, `edIngredientFilter`
- `sl*` - Sliders: `slServingTemperature`, `slHardness`
- `tbl*` - Tables: `tblRecipe`, `tblIngredientsList`
- `cv*` - Canvas: `cvFreezingGraph`
- `ta*` - Textarea: `taRecipeNotes`
- `tgt*` - Target selects: `tgtSelection`
- `lb*` - Labels (display-only): `lbServingTemperature`

---

*Convention analysis: 2026-01-13*
*Update when patterns change*
