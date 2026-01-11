#!/usr/bin/env node

/**
 * Ice Ed - Automated Test Suite
 * Tests all major functionality before/after modularization steps
 *
 * Usage: node test-app.js
 * Exit code: 0 = success, 1 = failure
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';

const PORT = 8080;
const BASE_URL = `http://localhost:${PORT}`;
const TIMEOUT = 5000;

let server;
let browser;
let context;
let page;

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name, passed, details = '') {
  const icon = passed ? '✓' : '✗';
  const color = passed ? 'green' : 'red';
  log(`  ${icon} ${name}`, color);
  if (details) {
    log(`    ${details}`, 'gray');
  }
}

function logSection(title) {
  log(`\n${title}`, 'blue');
  log('─'.repeat(60), 'gray');
}

// Start HTTP server
async function startServer() {
  return new Promise((resolve, reject) => {
    server = spawn('python3', ['-m', 'http.server', PORT.toString()], {
      stdio: 'pipe',
      cwd: process.cwd()
    });

    // Listen to both stdout and stderr
    const handleOutput = (data) => {
      const output = data.toString();
      if (output.includes('Serving HTTP') || output.includes('server_address')) {
        setTimeout(resolve, 500); // Give server time to fully start
      }
    };

    server.stdout.on('data', handleOutput);
    server.stderr.on('data', handleOutput);

    server.on('error', reject);

    // Fallback: assume server is ready after 2 seconds
    setTimeout(resolve, 2000);
  });
}

// Stop HTTP server
function stopServer() {
  if (server) {
    server.kill();
  }
}

// Initialize browser
async function initBrowser() {
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext();
  page = await context.newPage();

  // Collect console messages
  page.consoleMessages = [];
  page.on('console', msg => {
    page.consoleMessages.push({
      type: msg.type(),
      text: msg.text()
    });
  });
}

// Close browser
async function closeBrowser() {
  if (page) await page.close();
  if (context) await context.close();
  if (browser) await browser.close();
}

// Test Suite
const tests = {
  // Basic Loading Tests
  async testPageLoads() {
    logSection('Basic Loading Tests');

    const response = await page.goto(`${BASE_URL}/index.html`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT
    });

    logTest('Page loads successfully', response.ok());
    logTest('Page title is correct',
      await page.title() === 'Ice Ed – The friendly Ice Cream Editor');

    // Check for critical errors (excluding favicon 404)
    const errors = page.consoleMessages.filter(m =>
      m.type === 'error' && !m.text.includes('favicon')
    );
    logTest('No console errors', errors.length === 0,
      errors.length > 0 ? `Found ${errors.length} errors` : '');

    return errors.length === 0;
  },

  // Tab Navigation Tests
  async testTabNavigation() {
    logSection('Tab Navigation Tests');

    const tabs = [
      { buttonText: 'Recipe', tabId: 'Recipe' },
      { buttonText: 'Ingredients List', tabId: 'Ingredients List' },
      { buttonText: 'Tools', tabId: 'Tools' },
      { buttonText: 'Links', tabId: 'Links' },
      { buttonText: 'Info & FAQ', tabId: 'About' }
    ];
    let allPassed = true;

    for (const tab of tabs) {
      try {
        await page.click(`button:has-text("${tab.buttonText}")`, { timeout: TIMEOUT });
        await page.waitForTimeout(200);

        const isVisible = await page.isVisible(`[data-tabid="${tab.tabId}"]`);
        logTest(`Tab "${tab.buttonText}" opens`, isVisible);
        allPassed = allPassed && isVisible;
      } catch (error) {
        logTest(`Tab "${tab.buttonText}" opens`, false, error.message);
        allPassed = false;
      }
    }

    return allPassed;
  },

  // Recipe Tab Tests
  async testRecipeTab() {
    logSection('Recipe Tab Tests');

    await page.click('button:has-text("Recipe")');
    await page.waitForTimeout(200);

    // Test recipe name input
    const nameInput = await page.isVisible('#edRecipeName');
    logTest('Recipe name input visible', nameInput);

    // Test type selector
    const typeSelector = await page.isVisible('#tgtSelection');
    logTest('Ice cream type selector visible', typeSelector);

    // Test sliders
    const servingTemp = await page.isVisible('#slServingTemperature');
    logTest('Serving temperature slider visible', servingTemp);

    const hardness = await page.isVisible('#slHardness');
    logTest('Hardness slider visible', hardness);

    const overrun = await page.isVisible('#slOverrun');
    logTest('Overrun slider visible', overrun);

    // Test recipe table
    const recipeTable = await page.isVisible('#tblRecipe');
    logTest('Recipe table visible', recipeTable);

    // Test freezing graph
    const freezingGraph = await page.isVisible('#cvFreezingGraph');
    logTest('Freezing graph canvas visible', freezingGraph);

    return nameInput && typeSelector && servingTemp && hardness &&
           overrun && recipeTable && freezingGraph;
  },

  // Ingredients List Tests
  async testIngredientsList() {
    logSection('Ingredients List Tests');

    await page.click('button:has-text("Ingredients List")');
    await page.waitForTimeout(500);

    // Test ingredients table
    const ingredientsTable = await page.isVisible('#tblIngredientsList');
    logTest('Ingredients table visible', ingredientsTable);

    // Test filter input
    const filterInput = await page.isVisible('#edIngredientFilter');
    logTest('Filter input visible', filterInput);

    // Test that ingredients are loaded
    const ingredientCount = await page.$$eval(
      '#tblIngredientsList tbody tr',
      rows => rows.length
    );
    logTest('Ingredients loaded', ingredientCount > 0,
      `Found ${ingredientCount} ingredients`);

    // Test filter functionality
    if (filterInput) {
      await page.fill('#edIngredientFilter', 'milk');
      await page.waitForTimeout(300);

      const filteredCount = await page.$$eval(
        '#tblIngredientsList tbody tr:visible',
        rows => rows.length
      );
      logTest('Filter works', filteredCount < ingredientCount && filteredCount > 0,
        `Filtered to ${filteredCount} ingredients`);

      // Clear filter
      await page.click('#btnClearIngredientsFilter');
      await page.waitForTimeout(200);
    }

    return ingredientsTable && filterInput && ingredientCount > 0;
  },

  // Tools Tab Tests
  async testToolsTab() {
    logSection('Tools Tab Tests');

    await page.click('button:has-text("Tools")');
    await page.waitForTimeout(200);

    // Test PAC/POD calculator
    await page.click('button:has-text("PAC & POD")');
    await page.waitForTimeout(200);
    const pacPodCalc = await page.isVisible('#PacPodCalculator');
    logTest('PAC & POD calculator visible', pacPodCalc);

    // Test G/Mol calculator
    await page.click('button:has-text("PAC from g/mol")');
    await page.waitForTimeout(200);
    const gMolCalc = await page.isVisible('#edGMolCalculator');
    logTest('G/Mol calculator visible', gMolCalc);

    // Test Yolk calculator
    await page.click('button:has-text("Yolk")');
    await page.waitForTimeout(200);
    const yolkCalc = await page.isVisible('#YolkCalculator');
    logTest('Yolk calculator visible', yolkCalc);

    return pacPodCalc && gMolCalc && yolkCalc;
  },

  // Number Input Tests (tests toFloat and decimalSeparator)
  async testNumberInputs() {
    logSection('Number Input Tests (Locale Support)');

    await page.click('button:has-text("Recipe")');
    await page.waitForTimeout(200);

    // Test slider interaction (uses toFloat internally)
    const initialTemp = await page.$eval('#slServingTemperature', el => el.value);
    logTest('Can read slider value', initialTemp !== null);

    // Move slider
    await page.fill('#slServingTemperature', '-15');
    await page.waitForTimeout(200);

    const newTemp = await page.$eval('#slServingTemperature', el => el.value);
    logTest('Can change slider value', newTemp === '-15');

    return initialTemp !== null && newTemp === '-15';
  },

  // Console Error Check (final verification)
  async testNoConsoleErrors() {
    logSection('Final Console Check');

    // Filter out favicon errors which are not critical
    const errors = page.consoleMessages.filter(m =>
      m.type === 'error' && !m.text.includes('favicon')
    );

    if (errors.length > 0) {
      log('Console Errors Found:', 'red');
      errors.forEach(err => {
        log(`  ${err.text}`, 'gray');
      });
    }

    logTest('No console errors', errors.length === 0);
    return errors.length === 0;
  }
};

// Main test runner
async function runTests() {
  let allTestsPassed = true;
  const startTime = Date.now();

  log('\n╔══════════════════════════════════════════════════════════╗', 'blue');
  log('║          Ice Ed - Automated Test Suite                  ║', 'blue');
  log('╚══════════════════════════════════════════════════════════╝', 'blue');

  try {
    // Setup
    log('\n[Setup] Starting HTTP server...', 'yellow');
    await startServer();
    log('[Setup] Server started on port ' + PORT, 'green');

    log('[Setup] Launching browser...', 'yellow');
    await initBrowser();
    log('[Setup] Browser ready', 'green');

    // Run all tests
    for (const [testName, testFn] of Object.entries(tests)) {
      try {
        const result = await testFn();
        allTestsPassed = allTestsPassed && result;
      } catch (error) {
        log(`\n✗ Test "${testName}" failed with error:`, 'red');
        log(`  ${error.message}`, 'gray');
        allTestsPassed = false;
      }
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logSection('Test Summary');

    if (allTestsPassed) {
      log(`✓ All tests passed! (${duration}s)`, 'green');
    } else {
      log(`✗ Some tests failed (${duration}s)`, 'red');
    }

  } catch (error) {
    log('\n✗ Fatal error during test execution:', 'red');
    log(`  ${error.message}`, 'gray');
    allTestsPassed = false;
  } finally {
    // Cleanup
    log('\n[Cleanup] Closing browser...', 'yellow');
    await closeBrowser();
    log('[Cleanup] Stopping server...', 'yellow');
    stopServer();
    log('[Cleanup] Done\n', 'green');
  }

  process.exit(allTestsPassed ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('Unexpected error:', error);
  stopServer();
  process.exit(1);
});
