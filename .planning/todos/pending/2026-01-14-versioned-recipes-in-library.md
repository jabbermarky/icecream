---
created: 2026-01-14T12:12
updated: 2026-01-15T00:00
title: Recipe and ingredient versioning strategy
area: storage
files:
  - js/storage/indexeddb-storage.js
  - js/ui/recipe-library.js
  - js/features/ingredients.js
  - js/models/core.js
---

## Problem

Two related versioning challenges:

### 1. Recipe History
Users iterate on recipes over time, improving them through multiple versions. Currently the library only stores one version per recipe name - saving overwrites the previous version with no history.

### 2. Ingredient Dependencies (discussed 2026-01-15)
Recipes are formulas designed with specific ingredient properties. When ingredient values change in the library (user researches better values), old recipes may behave differently than intended.

**Core tension**: An ice cream recipe is a *formula* - designed with specific ingredient properties. If Milk's fat changes from 3.0% to 3.5% but recipe quantities stay the same, the resulting ice cream has 0.5g more fat than designed. Affects texture, flavor balance, total fat %.

**Two distinct use cases identified:**

1. **"Make it again" (Locked mode)** - Recipe is a complete snapshot including exact ingredient properties. Like `package-lock.json` - exact versions frozen. Don't care about library updates, want same formula.

2. **"Improve it" (Evolving mode)** - Recipe is a starting point, ingredient library is truth. Want to see what changed and why. Like developing with `package.json` semver - accept updates.

**Current architecture limitation:**
- Recipe stores only ingredient *names* and *amounts* (references)
- When saved: Full `Ingredients` object snapshot included
- When loaded: Snapshot merged into global library via `importIngredients`
- No way to load a recipe in "locked" mode using its own ingredient definitions

## Solution

TBD - Consider:

### Recipe versioning:
- Store recipes with version numbers (e.g., "Vanilla Gelato v1", "Vanilla Gelato v2")
- Auto-increment version on save, or let user choose
- Group versions in library UI (expandable tree or tabs)
- Add "Save as new version" vs "Overwrite current version" options
- Version metadata (notes about what changed)

### Ingredient dependency versioning:
- Recipe could carry self-contained ingredient definitions (bundled mode)
- Or reference library with explicit version/hash
- "Lock" mode: Recipe uses its own bundled ingredients, ignores library
- "Float" mode: Recipe uses library (current behavior with merge dialog)
- Show diff when loading: "These ingredients changed since recipe was saved"
- Future LLM integration: When improving recipe, knowing old ingredient assumptions helps diagnose how formula was evaluated

### npm analogy:
- `package.json` = recipe referencing ingredients by name (float)
- `package-lock.json` = recipe with exact ingredient versions frozen (lock)
- `npm ci` = load recipe in locked mode
- `npm install` = load recipe in floating mode, show updates
