# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-15)

**Core value:** Ice cream recipe formulation with full user control
**Current focus:** v1.4 Multi-Device Access - Deploy to GitHub Pages with Google Drive sync

## Current Position

Phase: 19 of 20 (github-pages-deployment)
Plan: Not yet planned
Status: Milestone started, phase needs planning
Last activity: 2026-01-15 — Created v1.4 milestone

Progress: ░░░░░░░░░░ 0%

## Accumulated Decisions

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 07 | Deferred Recipe access via getRecipe function | Recipe not available at module load time |
| 07 | Return InitYolkTable from initYolkCalculator | Tab handler needs access to initialize yolk values |
| 08 | Constructor defaults object for cRecipe | Decouple class from DOM at construction time |
| 08 | Inject RecipeDataColumns via getRecipeDataColumns | Avoid circular dependency with future recipe-manager |
| 09 | Accessor functions for module state | Allow app.js to interact with RecipeBackup/RecipeStack/sortBy owned by recipe-manager |
| 09 | Self-contained recipe-manager module | UpdateRecipeSums now internal, no callback injection needed |
| 09 | initRecipeButtons for button handlers | Keeps handler implementations in recipe-manager module |
| 09 | Remove Check for Updates feature | Deprecated feature with strict mode bug, cleaner to remove than fix |
| 10 | RECIPE_COLS constant for column indices | Avoid magic numbers; safer when columns change |
| 10 | Mousedown tracking for drag handle restriction | dragstart target is always the row, not clicked element |
| 11 | Clear sortBy on drag-drop reorder | Prevent misleading sort indicator after manual reorder |
| 11 | DOM-based test verification | window.Recipe reference becomes stale after setRecipe() calls |
| 12 | idb library from ESM CDN | No npm install or bundler needed, lightweight |
| 12 | Storage interface pattern | Enables future backend swaps (cloud sync) without changing consumers |
| 12 | Graceful error handling in storage | Return null/empty array on failure, matches existing parseRecipeFile pattern |
| 13 | Callback pattern for library actions | onLoad/onDelete callbacks allow flexible action handling |
| 13 | Browser confirm() for delete | Simpler than custom modal, effective UX |
| 13 | Close modal after delete | Cleaner than refreshing list in place |
| 14 | Save to library as default | Primary action for most users; file export as secondary |
| 14 | Port detection in test runner | Piggyback on VSCode Live Server (5500) when available |
| 15 | Storage methods return boolean | Enables caller to check success/failure and show appropriate feedback |
| 16 | Single 'library' record for ingredients | Simpler than individual records, sufficient for current needs |
| 16 | Storage-first initialization | Enable library-first loading pattern |
| 17 | Fire-and-forget sync (no await) | Don't block user workflow for storage operations |
| 17 | Export sync function for recipe-manager | Allow cross-module sync when storing recipe as ingredient |
| 18 | columnLabels/buttonLabels parameters | Configurable dialog labels via parameter objects with defaults |
| 18 | Recipe-specific merge context | Library/Recipe columns + Keep Library/Use Recipe buttons |

## Deferred Issues

- ISS-003: Scale button enabled without valid input (pre-existing bug, logged for future fix)

## Process Improvements

- Added strict mode audit as pre-requisite for Phases 8-9
- Created STRICT-MODE-AUDIT.md reference guide
- Future extractions will scan for undeclared variables before moving code
- Audit magic numbers when touching modules (e.g., RECIPE_COLS pattern from Phase 10)

## Pending Todos

9 todos in `.planning/todos/pending/`

## Blockers/Concerns Carried Forward

None.

## Brief Alignment Status

v1.4 Multi-Device Access milestone STARTED.

**Goal:** Deploy to GitHub Pages with Google Drive sync so app and data are accessible from any device/browser.

**Phases:**
- Phase 19: GitHub Pages deployment
- Phase 20: Google Drive cloud sync

**Why this milestone:** User wants to start using the app regularly. Without deployment + cloud sync, data is trapped in one browser on one device.

## Session Continuity

Last session: 2026-01-15
Stopped at: v1.4 milestone created, ready to plan Phase 19
Resume file: None
