# Ice Ed - Test Suite

## Overview
Automated test suite for Ice Ed that verifies all major functionality works correctly. This is designed to be run **before and after** each modularization step to ensure no regressions are introduced.

## Installation

```bash
npm install
```

This will install Playwright as a dev dependency. Browsers will be automatically installed on first run.

## Running Tests

```bash
npm test
```

Or directly:

```bash
node test-app.js
```

The test suite:
- Starts a local HTTP server automatically
- Launches a headless browser
- Runs all tests
- Returns exit code 0 (success) or 1 (failure)
- Takes approximately 6-7 seconds to run

## What Gets Tested

### 1. Basic Loading Tests
- ✓ Page loads successfully
- ✓ Page title is correct
- ✓ No console errors

### 2. Tab Navigation Tests
- ✓ All 5 tabs open correctly (Recipe, Ingredients List, Tools, Links, Info & FAQ)

### 3. Recipe Tab Tests
- ✓ Recipe name input visible
- ✓ Ice cream type selector visible
- ✓ Serving temperature slider visible
- ✓ Hardness slider visible
- ✓ Overrun slider visible
- ✓ Recipe table visible
- ✓ Freezing graph canvas visible

### 4. Ingredients List Tests
- ✓ Ingredients table displays
- ✓ Filter input works
- ✓ Ingredients loaded (73 default ingredients)
- ✓ Filter functionality works correctly

### 5. Tools Tab Tests
- ✓ PAC & POD calculator visible
- ✓ G/Mol calculator visible
- ✓ Yolk calculator visible

### 6. Number Input Tests (Locale Support)
- ✓ Can read slider values (tests `decimalSeparator`)
- ✓ Can change slider values (tests `toFloat()`)

### 7. Final Console Check
- ✓ No console errors introduced during testing

## Using in Modularization Workflow

### Before Extracting Code (Baseline)
```bash
npm test
```

This establishes a baseline - all tests should pass ✓

### After Extracting Code (Verification)
```bash
npm test
```

This verifies no regressions were introduced. If any test fails, you know the extraction broke something.

### Example Workflow

```bash
# Step 1: Baseline test
npm test
# All tests pass ✓

# Step 2: Extract code to new module
# ... make changes ...

# Step 3: Verification test
npm test
# All tests still pass ✓

# Step 4: Commit
git add -A
git commit -m "Step N: Extract XYZ module"
```

## Test Output

Passing tests show green checkmarks:
```
✓ Page loads successfully
✓ Page title is correct
✓ No console errors
```

Failing tests show red X marks with details:
```
✗ Tab "Recipe" opens
  Error: Timeout waiting for selector
```

## Exit Codes

- **0** - All tests passed
- **1** - One or more tests failed

This makes it easy to integrate with CI/CD pipelines or git hooks.

## Troubleshooting

### Port 8080 already in use
Kill any existing process on port 8080:
```bash
lsof -ti:8080 | xargs kill -9
```

### Browser not installed
Install Chromium for Playwright:
```bash
npx playwright install chromium
```

### Tests timeout
The default timeout is 5 seconds. If tests are timing out, your system might be slow. You can increase the timeout in `test-app.js`:
```javascript
const TIMEOUT = 10000; // Increase to 10 seconds
```

## Extending the Tests

To add new tests, edit `test-app.js` and add a new test function to the `tests` object:

```javascript
const tests = {
  // ... existing tests ...

  async testMyNewFeature() {
    logSection('My New Feature Tests');

    // Your test code here
    const element = await page.isVisible('#myElement');
    logTest('My element is visible', element);

    return element; // true = pass, false = fail
  }
};
```

## Notes

- Tests run in headless mode (no visible browser window)
- The HTTP server is automatically started and stopped
- Console messages are captured and checked for errors
- Tests are independent and can run in any order
- Each test returns a boolean: `true` = pass, `false` = fail
