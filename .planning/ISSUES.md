# Project Issues Log

Enhancements discovered during execution. Not critical - address in future phases.

## Open Enhancements

### ISS-001: Remove Check for Updates functionality

- **Discovered:** Phase 7 strict mode audit (2026-01-13)
- **Type:** Refactoring
- **Description:** The "Check for Updates" button (btnCheckUpdate) fetches release info from GitHub API and allows downloading newer versions. This feature has a strict mode bug (undeclared `httpRequest` variable) and is no longer desired as part of the modularization effort. Remove the button from HTML and the handler code from app.js.
- **Impact:** Low (feature works in non-strict mode, will break when clicked in strict mode)
- **Effort:** Quick
- **Suggested phase:** Phase 9 (final cleanup) or Future

### ISS-002: Strict mode audit - httpRequest undeclared variable

- **Discovered:** Phase 7 strict mode audit (2026-01-13)
- **Type:** Bug (deferred - will be removed with ISS-001)
- **Description:** Lines 1268 and 1282 in app.js use `httpRequest = new XMLHttpRequest()` without `var/let/const` declaration. This throws ReferenceError in strict mode (ES6 modules). Linked to ISS-001 - will be resolved by removing the feature.
- **Impact:** Medium (causes runtime error when Check for Updates clicked)
- **Effort:** Quick (just add `var`, but prefer removal per ISS-001)
- **Suggested phase:** Resolve via ISS-001

## Closed Enhancements

[Moved here when addressed]
