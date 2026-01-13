# Technology Stack

**Analysis Date:** 2026-01-13

## Languages

**Primary:**
- JavaScript (ES6 modules) - All application code in `js/` directory

**Secondary:**
- HTML5 - `index.html` entry point
- CSS3 - `css/styles.css` with CSS Grid layout and CSS custom properties

## Runtime

**Environment:**
- Browser runtime - Vanilla JavaScript running in web browsers
- Node.js >=18 - Required for Playwright testing only (from `package-lock.json` engines field)

**Package Manager:**
- npm - `package.json` with type: "module" (ES6 modules)
- Lockfile: `package-lock.json` (lockfileVersion 3)

## Frameworks

**Core:**
- None - Vanilla JavaScript (no React, Vue, Angular, etc.)

**Testing:**
- Playwright 1.57.0 - Browser automation testing (`test-app.js`)

**Build/Dev:**
- None - No bundler (Vite, Webpack, etc.)
- Python3 http.server - Local development server (`start.sh`)

## Key Dependencies

**Critical:**
- None - No production dependencies (vanilla JS with browser APIs only)

**Infrastructure:**
- playwright ^1.57.0 (devDependency) - E2E testing via Chromium automation

**Browser APIs Used:**
- Fetch API - Loading `data/ingredients.json`
- XMLHttpRequest - USDA FoodData Central API communication
- File API / FileReader - Recipe and ingredient file import/export
- Canvas API - Freezing curve graph rendering (`js/ui/graph.js`)
- DOM APIs - Extensive manipulation for UI

## Configuration

**Environment:**
- No environment variables required
- No .env files
- All configuration inline or via JSON data files

**Build:**
- No build configuration (served directly as ES6 modules)
- `package.json` scripts: `"start"`, `"test"`

## Platform Requirements

**Development:**
- Any platform with Node.js >=18 (for running tests)
- Python3 (for local HTTP server)
- Modern browser with ES6 module support

**Production:**
- Client-side only - runs entirely in browser
- Can be served from any static file host
- Single HTML file deployment option available (`IceEd.html` legacy backup)

---

*Stack analysis: 2026-01-13*
*Update after major dependency changes*
