# Codebase Structure

**Analysis Date:** 2026-01-13

## Directory Layout

```
icecream/
├── index.html              # Main HTML entry (377 lines)
├── IceEd.html              # Backup of original monolithic version
├── package.json            # npm config (Playwright for testing)
├── package-lock.json       # Dependency lockfile
├── test-app.js             # Playwright test suite
├── start.sh                # Development server script
├── CLAUDE.md               # Project context for Claude
├── MODULARIZATION_PLAN.md  # Step-by-step extraction strategy
├── WORKFLOW.md             # Testing workflow documentation
├── TESTING_SUMMARY.md      # Test results and coverage
├── TEST_README.md          # Test documentation
│
├── css/
│   └── styles.css          # 457 lines - CSS Grid layout, theme variables
│
├── data/
│   └── ingredients.json    # Database: 76 ingredient definitions
│
├── js/
│   ├── app.js              # Main orchestration (454 lines)
│   │
│   ├── features/           # Business logic modules
│   │   ├── calculations.js # 98 lines - PAC/POD/freezing math
│   │   └── ingredients.js  # 862 lines - Ingredient CRUD, USDA API
│   │
│   ├── models/             # Domain model
│   │   └── core.js         # Recipe and ingredient types
│   │
│   ├── storage/            # Persistence and sync
│   │   ├── storage.js      # Storage interface
│   │   ├── indexeddb-storage.js  # Local persistence (uses vendor/idb)
│   │   ├── google-auth.js  # Google OAuth for cloud sync
│   │   ├── google-drive-storage.js
│   │   └── sync-manager.js
│   │
│   ├── ui/                 # User interface modules
│   │   ├── components.js   # 180 lines - Tabs, modals, status bar
│   │   └── graph.js        # 118 lines - Canvas freezing curve
│   │
│   ├── utils/              # Utility modules
│   │   ├── helpers.js      # 127 lines - Locale parsing, DOM utils
│   │   └── file-io.js      # 92 lines - Recipe/ingredient serialization
│   │
│   └── vendor/             # Vendored third-party, unmodified
│       └── idb.js          # idb v8.0.3 (ISC). To update:
│                           #   npm pack idb@<version> && tar xzf idb-<version>.tgz
│                           #   cp package/build/index.js js/vendor/idb.js
│                           # Vendored rather than loaded from a CDN so startup
│                           # does not depend on a third-party host.
│
└── .planning/              # GSD planning documents
    └── codebase/           # Codebase analysis (this directory)
```

## Directory Purposes

**css/**
- Purpose: All styling for the application
- Contains: Single `styles.css` file with CSS custom properties
- Key files: `styles.css` - Responsive layout, theme colors, form styling
- Subdirectories: None

**data/**
- Purpose: Static data files loaded at runtime
- Contains: `ingredients.json` - Default ingredient database
- Key files: `ingredients.json` - 76 ingredient definitions with nutritional data
- Subdirectories: None

**js/**
- Purpose: All JavaScript application code
- Contains: ES6 modules organized by functional domain
- Key files: `app.js` - Main entry point and orchestration
- Subdirectories: `features/`, `ui/`, `utils/`

**js/features/**
- Purpose: Business domain logic
- Contains: Ingredient management, calculations
- Key files: `ingredients.js` (CRUD, USDA), `calculations.js` (math)
- Subdirectories: None

**js/ui/**
- Purpose: Presentation layer components
- Contains: Tab system, modals, graph rendering
- Key files: `components.js` (tabs, dialogs), `graph.js` (canvas)
- Subdirectories: None

**js/utils/**
- Purpose: Cross-cutting utilities
- Contains: Helpers, file I/O operations
- Key files: `helpers.js` (parsing, DOM), `file-io.js` (save/load)
- Subdirectories: None

## Key File Locations

**Entry Points:**
- `index.html` - Browser entry, loads `js/app.js` as ES6 module
- `js/app.js` - Module entry, initializes application
- `test-app.js` - Test entry, Playwright test suite

**Configuration:**
- `package.json` - npm scripts, dependencies
- `css/styles.css` - CSS custom properties (theme colors)

**Core Logic:**
- `js/app.js` - Recipe system, optimization, UI orchestration
- `js/features/calculations.js` - PAC/POD calculations, freezing curve math
- `js/features/ingredients.js` - Ingredient CRUD, USDA API integration

**Testing:**
- `test-app.js` - Playwright test suite (21 test methods)
- `test-recipe.ier` - Test data file for recipe loading

**Documentation:**
- `CLAUDE.md` - Instructions for Claude Code
- `MODULARIZATION_PLAN.md` - Extraction strategy (6/9 steps complete)
- `WORKFLOW.md` - Testing protocol

## Naming Conventions

**Files:**
- kebab-case for JavaScript modules: `file-io.js`, `helpers.js`
- kebab-case for data files: `ingredients.json`
- UPPERCASE.md for important docs: `CLAUDE.md`, `WORKFLOW.md`
- PascalCase for HTML: `IceEd.html`

**Directories:**
- kebab-case (lowercase): `css/`, `js/`, `data/`
- Plural for collections: `features/`, `utils/`

**Special Patterns:**
- `test-*.js` for test files
- `*.ier` for Ice Ed Recipe files
- `*.iei` for Ice Ed Ingredients files

## Where to Add New Code

**New Feature:**
- Primary code: `js/features/{feature-name}.js`
- Tests: Add test methods to `test-app.js`
- Documentation: Update `MODULARIZATION_PLAN.md` if architectural

**New Component/Module:**
- UI component: `js/ui/{component-name}.js`
- Utility: `js/utils/{utility-name}.js`
- Export from new module, import in `js/app.js`

**New Calculator/Tool:**
- Implementation: `js/utils/tools.js` (planned, not yet extracted)
- Currently in `js/app.js` (lines 1178-1500 approximately)

**Utilities:**
- Shared helpers: `js/utils/helpers.js`
- File operations: `js/utils/file-io.js`

## Special Directories

**.planning/**
- Purpose: GSD planning and analysis documents
- Source: Created by `/gsd:map-codebase` command
- Committed: Yes (useful for context)

**node_modules/**
- Purpose: npm dependencies (Playwright only)
- Source: Generated by `npm install`
- Committed: No (in .gitignore)

---

*Structure analysis: 2026-01-13*
*Update when directory structure changes*
