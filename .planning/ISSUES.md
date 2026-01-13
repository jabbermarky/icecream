# Project Issues Log

Enhancements discovered during execution. Not critical - address in future phases.

## Open Enhancements

None

## Closed Enhancements

### ISS-001: Remove Check for Updates functionality

- **Discovered:** Phase 7 strict mode audit (2026-01-13)
- **Resolved:** Phase 9 Plan 04 (2026-01-13)
- **Type:** Refactoring
- **Description:** The "Check for Updates" button (btnCheckUpdate) fetches release info from GitHub API and allows downloading newer versions. This feature has a strict mode bug (undeclared `httpRequest` variable) and is no longer desired as part of the modularization effort. Remove the button from HTML and the handler code from app.js.
- **Resolution:** Removed btnCheckUpdate button from index.html and the onclick handler (~60 lines) from app.js. Feature was deprecated as part of modularization cleanup.

### ISS-002: Strict mode audit - httpRequest undeclared variable

- **Discovered:** Phase 7 strict mode audit (2026-01-13)
- **Resolved:** Phase 9 Plan 04 (2026-01-13)
- **Type:** Bug (deferred - removed with ISS-001)
- **Description:** Lines 1268 and 1282 in app.js used `httpRequest = new XMLHttpRequest()` without `var/let/const` declaration. This threw ReferenceError in strict mode (ES6 modules).
- **Resolution:** Resolved by removing the Check for Updates feature (ISS-001). The problematic code was deleted entirely.
