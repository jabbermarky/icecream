# Architecture

**Analysis Date:** 2026-01-13

## Pattern Overview

**Overall:** Client-Side SPA with Modular ES6 Modules

**Key Characteristics:**
- Single-page application (SPA) using vanilla JavaScript
- ES6 modules with clear layer separation
- Incremental modularization from monolith to focused modules
- Functional + Object-Oriented hybrid paradigm
- Global state objects with module-level management

## Layers

**Presentation Layer (UI):**
- Purpose: Handle user interaction and visual rendering
- Contains: Tab system, modals, status messaging, graph rendering
- Location: `js/ui/components.js`, `js/ui/graph.js`, `index.html`
- Depends on: Feature layer for data, CSS for styling
- Used by: Main app orchestration

**Feature/Business Logic Layer:**
- Purpose: Core ice cream formulation logic
- Contains: Recipe management, calculations, ingredient CRUD, optimization
- Location: `js/features/calculations.js`, `js/features/ingredients.js`, `js/app.js`
- Depends on: Utility layer, data layer
- Used by: UI layer, event handlers

**Data Layer:**
- Purpose: Data storage and persistence
- Contains: Ingredient database, recipe state, backup stacks
- Location: `data/ingredients.json`, in-memory objects (Recipe, Ingredients)
- Depends on: Nothing
- Used by: Feature layer

**Utility Layer:**
- Purpose: Shared helpers and cross-cutting concerns
- Contains: Locale-aware parsing, DOM utilities, file I/O, string algorithms
- Location: `js/utils/helpers.js`, `js/utils/file-io.js`
- Depends on: Browser APIs only
- Used by: All other layers

## Data Flow

**Recipe Modification Flow:**

1. User interacts with form element (input, select, slider)
2. Event handler in `js/app.js` captures change
3. Recipe object updated with new value
4. `UpdateRecipeSums()` recalculates totals
5. `GetIdealPAC()` from `js/features/calculations.js` computes targets
6. `DrawFreezingGraph()` re-renders canvas with new values
7. DOM updated to reflect new state

**Ingredient Data Flow:**

1. App startup calls `loadIngredients()` in `js/features/ingredients.js`
2. `fetch()` retrieves `data/ingredients.json`
3. Data parsed into `Ingredients` global object
4. `DisplayIngredients()` renders ingredient table
5. User edits trigger `onIngredientEdit()` to update object
6. Changes persist in memory (export for permanent save)

**State Management:**
- File-based: All persistent state in `.ier` (recipe) and `.iei` (ingredients) files
- In-memory: `Recipe`, `Ingredients`, `RecipeStack`, `RecipeBackup` globals
- No localStorage or IndexedDB (stateless between sessions)

## Key Abstractions

**cRecipe:**
- Purpose: Recipe data container with computed sums
- Location: `js/app.js` (to be extracted to `js/models/core.js`)
- Pattern: Class with getters for computed properties
- Key properties: Name, Ingredients[], Target, Sums (computed)

**cIngredient:**
- Purpose: Ingredient nutritional profile
- Location: `js/features/ingredients.js` (line 49)
- Pattern: Class with derived property getters
- Key properties: Water, Sugar, Fat, PAC, POD, milkFat (computed), isSugar (computed)

**Fitness Function:**
- Purpose: Evaluate how well recipe matches targets
- Location: `js/features/calculations.js` (line 77)
- Pattern: Pure function for optimization algorithm
- Used by: `OptimizeRecipe()` hill-climbing algorithm

**Modal Dialog:**
- Purpose: User confirmation and input collection
- Location: `js/ui/components.js` (line 73)
- Pattern: `showModal(content, buttons)` function
- Used by: Import conflicts, optimization results, USDA selection

## Entry Points

**Browser Entry:**
- Location: `index.html`
- Triggers: User opens HTML file or navigates to URL
- Responsibilities: Load ES6 module entry, define HTML structure

**Module Entry:**
- Location: `js/app.js`
- Triggers: `<script type="module">` in HTML
- Responsibilities: Initialize tabs, load ingredients, set up event handlers

**Test Entry:**
- Location: `test-app.js`
- Triggers: `npm test` command
- Responsibilities: Start server, launch browser, run test suite

## Error Handling

**Strategy:** Catch at boundaries, display user-friendly messages

**Patterns:**
- `try/catch` around file loading and API calls
- `console.error()` for diagnostic logging
- `showModal()` for user-visible error messages
- `ErrorMsg()` status bar helper for transient errors

## Cross-Cutting Concerns

**Logging:**
- Browser console.log/console.error for development
- No production logging service

**Validation:**
- Input validation via `filterPosNumberInput()`, `filterNumberInput()`
- Recipe validation via `CheckRecipe()` function
- No schema validation library

**Locale Handling:**
- `decimalSeparator` constant detects user's decimal format
- `toFloat()` converts locale-specific number strings
- All numeric display respects locale separator

---

*Architecture analysis: 2026-01-13*
*Update when major patterns change*
