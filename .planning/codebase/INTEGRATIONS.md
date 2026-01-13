# External Integrations

**Analysis Date:** 2026-01-13

## APIs & External Services

**USDA FoodData Central:**
- Service: U.S. Department of Agriculture FoodData Central
- Purpose: Searching for ingredient nutritional data by name
- Endpoint: `https://api.nal.usda.gov/fdc/v1/foods/search`
- Integration file: `js/features/ingredients.js` (lines 558-747)
- Implementation method: XMLHttpRequest (legacy pattern)
- Key function: `onDownloadIngredientData()`
- Auth: API key embedded in source code (line 573)
- Search parameters: query, dataType (Foundation, Survey, SR Legacy)
- Nutritional data extracted: Water, Total lipid (fat), Sugars, Energy (kcal), alcohol, PAC calculations

**Payment Processing:**
- Not applicable

**Email/SMS:**
- Not applicable

## Data Storage

**Databases:**
- None - Client-side only application

**File Storage:**
- Local JSON data file: `data/ingredients.json`
  - Format: JSON with 76+ ingredient definitions
  - Loaded via: `fetch('data/ingredients.json')` in `js/features/ingredients.js` line 116
  - File format version: 1

**Caching:**
- None (in-memory state only, no localStorage/IndexedDB)

## Authentication & Identity

**Auth Provider:**
- Not applicable - No user authentication

**OAuth Integrations:**
- Not applicable

## Monitoring & Observability

**Error Tracking:**
- None - Browser console only

**Analytics:**
- None

**Logs:**
- Browser console.log for debugging
- No external logging service

## CI/CD & Deployment

**Hosting:**
- Static file serving (any HTTP server)
- Local development: Python3 `http.server` via `start.sh`

**CI Pipeline:**
- Manual test execution via `npm test`
- No automated CI/CD configured

## Environment Configuration

**Development:**
- Required env vars: None
- Secrets location: USDA API key hardcoded in `js/features/ingredients.js`
- Local server: `python3 -m http.server 8000` (via `start.sh`)

**Staging:**
- Not applicable

**Production:**
- Static deployment to any web server
- No environment-specific configuration

## Webhooks & Callbacks

**Incoming:**
- Not applicable

**Outgoing:**
- Not applicable

---

*Integration audit: 2026-01-13*
*Update when adding/removing external services*
