# Modularization Workflow - Quick Reference

## Test-First Approach

For each extraction step, follow this exact workflow:

```
┌─────────────────────────────────────────────────────────┐
│ STEP 1: PRE-EXTRACTION (Establish Baseline)            │
└─────────────────────────────────────────────────────────┘

1. npm test                    # All should pass ✓
2. Document current state      # Note any existing bugs
3. Scan code for issues        # Check for 'this' usage, strict mode issues
4. Commit current state        # Create rollback point

┌─────────────────────────────────────────────────────────┐
│ STEP 2: EXTRACTION (Move Code)                         │
└─────────────────────────────────────────────────────────┘

1. Create new module file      # e.g., js/models/core.js
2. Copy functions to module    # Don't delete from app.js yet
3. Add export statements       # export { ... }
4. Add import to app.js        # import { ... } from './models/core.js'
5. Test imports work           # npm test
6. Delete old code from app.js # Only after imports confirmed working

┌─────────────────────────────────────────────────────────┐
│ STEP 3: VERIFICATION (Test & Commit)                   │
└─────────────────────────────────────────────────────────┘

1. npm test                    # Verify all pass ✓
2. Manual smoke test           # Open browser, click around
3. Check console               # Should be clean
4. git add -A                  # Stage changes
5. git commit -m "..."         # Commit with descriptive message

┌─────────────────────────────────────────────────────────┐
│ IF SOMETHING BREAKS                                     │
└─────────────────────────────────────────────────────────┘

1. git status                  # See what changed
2. git diff                    # Review changes
3. Fix the issue               # Debug
4. npm test                    # Re-verify
5. OR git reset --hard HEAD    # Rollback if needed
```

## Quick Commands

### Run Tests
```bash
npm test                       # Run all tests (~6-7 seconds)
node test-app.js              # Same as above
```

### Check Status
```bash
git status                     # What's changed?
git diff js/app.js            # Review changes to main file
git log --oneline -5          # Recent commits
```

### Commit
```bash
git add -A                     # Stage everything
git commit -m "Step N: ..."   # Commit with message
git log -1 --stat             # Review what was committed
```

### Rollback
```bash
git reset --hard HEAD         # Undo all uncommitted changes (DESTRUCTIVE!)
git reset --soft HEAD~1       # Undo last commit (keep changes)
git revert HEAD               # Create new commit that undoes last commit
```

## Test Status Indicators

When you run `npm test`, you'll see:

```
✓ Test passed                  # Green - good!
✗ Test failed                  # Red - something broke
```

**Exit codes:**
- `0` = All tests passed
- `1` = At least one test failed

## Common Issues

### ES6 Strict Mode
ES6 modules enable strict mode automatically. Watch for:
- `this` is `undefined` in regular functions
- Must declare variables with `var`, `let`, or `const`
- No `with` statements
- Duplicate parameter names forbidden

### Import/Export Gotchas
```javascript
// ✓ GOOD: Named exports
export function foo() { }
export const bar = 42;

// ✓ GOOD: Batch export
export { foo, bar, baz };

// ✓ GOOD: Named import
import { foo, bar } from './module.js';

// ✗ BAD: Forgetting file extension
import { foo } from './module';  // Missing .js

// ✗ BAD: Circular dependencies
// a.js imports b.js AND b.js imports a.js
```

### Global State
When moving code that uses global variables:
1. Export them from their home module
2. Import where needed
3. Consider if state should be encapsulated

## Extraction Checklist

Before extracting:
- [ ] Tests pass (`npm test`)
- [ ] Code scanned for strict mode issues
- [ ] Current state committed

After extracting:
- [ ] Tests pass (`npm test`)
- [ ] Manual smoke test performed
- [ ] Console clean (no new errors)
- [ ] Changes committed

## Current Progress

✅ Step 1: Helper Functions (`js/utils/helpers.js`) - 72 lines
- toFloat(), clickOn(), getHtmlContent(), decimalSeparator

⏭️ Next: Step 2: Core Models (`js/models/core.js`)

## Files to Track

### Main Files
- `js/app.js` - Main application (2,643 lines currently)
- `index.html` - HTML entry point (377 lines)
- `css/styles.css` - Styles (455 lines)

### Test Files
- `test-app.js` - Automated test suite
- `package.json` - Node.js configuration
- `TEST_README.md` - Test documentation

### Planning Files
- `MODULARIZATION_PLAN.md` - Overall plan
- `WORKFLOW.md` - This file

## Tips

1. **Small commits** - Commit after each successful extraction
2. **Descriptive messages** - Future you will thank you
3. **Test often** - Run `npm test` liberally
4. **Don't rush** - Better to be slow and correct than fast and broken
5. **Document issues** - If you find bugs, note them separately
6. **One step at a time** - Don't extract multiple modules at once

## Success Criteria

After each extraction:
- ✓ All tests pass
- ✓ No new console errors
- ✓ Application works identically to before
- ✓ Code is more organized
- ✓ Changes are committed

When all extractions are complete:
- ✓ ~10 focused modules instead of 1 monolith
- ✓ No file exceeds 600 lines
- ✓ Clear separation of concerns
- ✓ Easier to maintain and extend
