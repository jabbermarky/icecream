---
created: 2026-01-14T12:11
title: Store master ingredient list in library
area: storage
files:
  - js/storage/indexeddb-storage.js
  - js/data/ingredients.json
  - js/features/recipe-manager.js
---

## Problem

Currently, the ingredient list is loaded from a static JSON file and user modifications (custom ingredients, edited properties) are only persisted via file export/import. With the new recipe library using IndexedDB, the master ingredient list should also be stored there.

Key issues:
1. Custom ingredients added by users are lost unless they export/import
2. When loading a recipe, its embedded ingredients may conflict with the current list
3. No single source of truth for ingredients across recipes

## Solution

TBD - Consider:
- Store master ingredient list in IndexedDB alongside recipes
- When saving a recipe, update master list with any new/modified ingredients
- When loading a recipe, merge its ingredients into master list (or prompt for conflicts)
- Keep file export/import as backup mechanism
