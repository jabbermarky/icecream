# Testing Patterns

**Analysis Date:** 2026-01-13

## Test Framework

**Runner:**
- Custom Playwright automation
- Location: `test-app.js` (single test file)

**Assertion Library:**
- Custom `logTest(name, passed, details)` helper
- No external assertion library (Jest, Chai, etc.)

**Run Commands:**
```bash
npm test                           # Run all tests
node test-app.js                   # Direct execution
```

## Test File Organization

**Location:**
- Single test file: `test-app.js`
- Test data: `test-recipe.ier` (Ice Ed Recipe format)

**Naming:**
- Test methods: `test[Feature][Aspect]` pattern
- Examples: `testPageLoads`, `testRecipeBuilding`, `testIngredientsList`

**Structure:**
```
icecream/
├── test-app.js           # Playwright test suite (~1,000 lines)
└── test-recipe.ier       # Test data file
```

## Test Structure

**Suite Organization:**
```javascript
const tests = {
  async testPageLoads() {
    // Navigate and verify basic loading
    await page.goto(BASE_URL);
    logTest('Page loads', page.url().includes('index.html'));
  },

  async testTabNavigation() {
    // Test tab switching functionality
    for (const tab of tabs) {
      await page.click(`[data-tabid="${tab}"]`);
      logTest(`Tab ${tab} works`, await page.isVisible(`#${tab}`));
    }
  },

  async testRecipeBuilding() {
    // Test recipe manipulation
    // ... arrange, act, assert
  }
};
```

**Patterns:**
- Each test method is async
- Uses Playwright page object for DOM interaction
- `logTest()` records pass/fail with optional details
- Tests run sequentially in defined order

## Mocking

**Framework:**
- No mocking framework
- Real browser environment via Playwright

**Patterns:**
- Tests run against actual application
- File downloads intercepted via download event
- No API mocking for USDA integration

**What to Mock:**
- Not currently mocking anything
- USDA API calls tested structurally, not functionally

## Fixtures and Factories

**Test Data:**
```javascript
// Test recipe file: test-recipe.ier
{
  "id": "IER",
  "version": 1,
  "data": {
    "Name": "Test-Recipe",
    "ServingTemperature": -15,
    // ... known test values
  }
}
```

**Location:**
- Test recipe: `test-recipe.ier` in project root
- Inline test data in test methods

## Coverage

**Requirements:**
- No enforced coverage target
- No coverage tooling configured

**Configuration:**
- Not applicable - no unit test framework

**View Coverage:**
- Not available

## Test Types

**Smoke Tests:**
- `testPageLoads()` - Page loads without errors
- `testNoConsoleErrors()` - No unexpected console errors

**Integration Tests:**
- `testTabNavigation()` - Tab switching across 5 tabs
- `testRecipeTab()` - Recipe UI elements present
- `testRecipeBuilding()` - Add ingredients, set values

**Feature Tests:**
- `testRecipeLoading()` - Load recipe from file
- `testRecipeSaving()` - Save recipe to file
- `testIngredientSaving()` - Export ingredients
- `testIngredientsList()` - Display and filter
- `testOptimizeRecipe()` - Recipe optimization

**Unit-like Tests (via browser):**
- `testNumberInputs()` - `toFloat()` locale handling
- `testIngredientClass()` - `cIngredient` properties
- `testIngredientEdit()` - Data functions
- `testIngredientUsage()` - `isIngredientUsed()` detection
- `testIngredientDiff()` - `diffIngredients()` comparison

## Common Patterns

**Async Testing:**
```javascript
async testRecipeLoading() {
  const fileInput = await page.$('input[type="file"]');
  await fileInput.setInputFiles('test-recipe.ier');
  await page.waitForTimeout(500);
  const recipeName = await page.$eval('#edRecipeName', el => el.value);
  logTest('Recipe loaded', recipeName === 'Test-Recipe');
}
```

**DOM Assertions:**
```javascript
const isVisible = await page.isVisible('#RecipeTab');
logTest('Recipe tab visible', isVisible);

const value = await page.$eval('#slServingTemperature', el => el.value);
logTest('Temperature correct', value === '-15');
```

**File Download Testing:**
```javascript
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.click('#btnSaveRecipe')
]);
logTest('Download triggered', download.suggestedFilename().endsWith('.ier'));
```

**Error Filtering:**
```javascript
const errors = page.consoleMessages.filter(m =>
  m.type === 'error' &&
  !m.text.includes('favicon') &&
  !m.text.includes('Failed to load resource')
);
logTest('No console errors', errors.length === 0);
```

## Test Infrastructure

**Server Management:**
```javascript
async function startServer() {
  server = spawn('python3', ['-m', 'http.server', PORT.toString()]);
  // Wait for "Serving HTTP" message
}
```

**Browser Setup:**
```javascript
async function initBrowser() {
  browser = await chromium.launch({ headless: false });
  context = await browser.newContext();
  page = await context.newPage();

  // Capture console messages
  page.consoleMessages = [];
  page.on('console', msg => {
    page.consoleMessages.push({ type: msg.type(), text: msg.text() });
  });
}
```

**Test Execution:**
```javascript
async function runTests() {
  await startServer();
  await initBrowser();

  for (const [name, fn] of Object.entries(tests)) {
    logSection(name);
    await fn();
  }

  // Summary and cleanup
  await browser.close();
  server.kill();
}
```

## Output Format

**Colors:**
- Green (✓) for passing tests
- Red (✗) for failing tests
- Blue for section headers
- Gray for details

**Example Output:**
```
testPageLoads
────────────────────────────────────────────────────────
  ✓ Page loads
  ✓ Title correct
  ✓ No console errors

testTabNavigation
────────────────────────────────────────────────────────
  ✓ Recipe tab works
  ✓ Ingredients tab works
  ✓ Sugars tab works
  ✓ Tools tab works
  ✓ Help tab works
```

---

*Testing analysis: 2026-01-13*
*Update when test patterns change*
