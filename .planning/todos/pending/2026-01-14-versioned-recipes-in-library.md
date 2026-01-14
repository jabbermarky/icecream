---
created: 2026-01-14T12:12
title: Support versioned recipes in library
area: storage
files:
  - js/storage/indexeddb-storage.js
  - js/ui/recipe-library.js
---

## Problem

Users iterate on recipes over time, improving them through multiple versions. Currently the library only stores one version per recipe name - saving overwrites the previous version with no history.

User wants to:
- Track progress across recipe versions as they improve
- Compare different versions of the same recipe
- Not lose earlier versions when saving improvements

## Solution

TBD - Consider:
- Store recipes with version numbers (e.g., "Vanilla Gelato v1", "Vanilla Gelato v2")
- Auto-increment version on save, or let user choose
- Group versions in library UI (expandable tree or tabs)
- Add "Save as new version" vs "Overwrite current version" options
- Consider version metadata (notes about what changed)
