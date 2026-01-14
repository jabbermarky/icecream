# Plan 10-01 Summary: Drag-drop UI Implementation

**Status:** Complete
**Date:** 2026-01-13

## What Was Built

Implemented drag-drop UI for reordering recipe ingredients in the table. Users can grab a handle and drag rows to reorder ingredients visually.

## Changes Made

### js/features/recipe-manager.js

1. **Added RECIPE_COLS constant** for column indices to avoid magic numbers:
   - `DRAG_HANDLE: 0`, `INGREDIENT: 1`, `AMOUNT: 2`, `SCALE: 3`
   - `nthChild()` helper for CSS nth-child selectors

2. **Added drag state variables:**
   - `draggedRow` - tracks the row being dragged
   - `dragStartElement` - tracks mousedown target for drag-handle-only restriction

3. **Modified CreateRecipeRow():**
   - Added drag handle cell as first column (hamburger icon: \u2630)
   - Made ingredient rows draggable with `draggable=true` and `draggable-row` class
   - Empty "add new" row is NOT draggable
   - Wired up drag-drop event handlers for draggable rows

4. **Added drag event handlers:**
   - `onRowMouseDown()` - captures clicked element for drag handle check
   - `onDragStart()` - only allows drag from drag handle, sets dragging state
   - `onDragOver()` - allows drop
   - `onDragEnter()` - adds drag-over visual class
   - `onDragLeave()` - removes drag-over class
   - `onDrop()` - reorders DOM and Recipe.Ingredients array
   - `onDragEnd()` - cleans up dragging state

5. **Modified DisplayRecipe():**
   - Added header cell for drag handle column
   - Updated childNodes references to use RECIPE_COLS constants

6. **Modified UpdateRecipeSums():**
   - Added empty cell for drag handle column in footer rows (Sum, Target, Error)

7. **Modified onIngredientChanged():**
   - When empty row becomes ingredient row, make it draggable and add handlers

8. **Fixed ToggleIngredientScale() and onRecipeScaled():**
   - Updated nth-child selectors to use RECIPE_COLS constants

### css/styles.css

1. **Drag handle styling:**
   - `#tblRecipe .drag-handle` - base styling (user-select, width, color)
   - `#tblRecipe tr.draggable-row .drag-handle` - grab cursor, opacity
   - Hover state increases opacity

2. **Drag state styling:**
   - `#tblRecipe tr.dragging` - semi-transparent during drag
   - `#tblRecipe tr.drag-over` - accent-colored top border for drop target
   - `#tblRecipe tr.dragging .drag-handle` - grabbing cursor

3. **Print media query:**
   - Added `.drag-handle` to hide list

## Bug Fixes During UAT

1. **Cursor on empty row:** Scoped grab cursor CSS to `.draggable-row .drag-handle` only
2. **Drag from anywhere:** Restricted drag initiation to drag handle using mousedown tracking
3. **Safari text node issue:** Handle `nodeType` check for text node targets
4. **Footer row alignment:** Added empty cells for drag handle column in footer rows
5. **Scale by ingredient broken:** Fixed nth-child selectors after column shift; refactored to use RECIPE_COLS constants

## Commits

- `dcedaab` - feat(10): add drag handle column to recipe rows
- `aac2e4c` - feat(10): add drag-drop event handlers for row reordering
- `6f688b5` - style(10): add CSS for drag handle and drag states

## Verification

- [x] `npm test` passes
- [x] Drag handles visible on all ingredient rows (not empty row)
- [x] Drag-drop reorders rows correctly
- [x] Visual feedback during drag (opacity, border)
- [x] Recipe.Ingredients array updates with new order
- [x] Modified indicator appears after reorder
- [x] Print preview hides drag handles
- [x] Works in Safari and Chrome
- [x] Scale by ingredient toggle works correctly
- [x] Footer rows aligned correctly

## Notes

- Order is session-only (resets on page reload) - persistence is Phase 11
- Touch/mobile drag not supported (out of scope)
- ISS-003 logged: Scale button enabled without valid input (pre-existing bug)
