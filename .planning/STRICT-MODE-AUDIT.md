# Strict Mode Audit Guide

ES6 modules automatically run in strict mode. Code that worked in "sloppy mode" can break when extracted to modules. Run this audit **before** extracting code.

## Quick Scan Commands

```bash
# Find undeclared variable assignments (most common issue)
# Look for "name = value" without var/let/const
grep -n '^\s*[a-z][a-zA-Z0-9_]*\s*=' js/app.js | grep -v 'var\|let\|const\|function\|//\|export\|import'

# Check if variables are declared vs just assigned
for var in <suspicious_var_names>; do
  declared=$(grep -c "var $var\|let $var\|const $var" js/app.js)
  echo "$var: declared=$declared"
done

# Other strict mode issues
grep -n 'with\s*(' js/app.js           # 'with' statements (not allowed)
grep -n 'arguments.callee' js/app.js   # arguments.callee (not allowed)
grep -n 'eval(' js/app.js              # eval (restricted)
```

## Common Issues to Find

### 1. Undeclared Variables (Most Common)

**Sloppy mode:** Creates global variable
**Strict mode:** ReferenceError

```javascript
// BAD - works in sloppy, fails in strict
function foo() {
    myVar = 123;  // ReferenceError: myVar is not defined
}

// GOOD
function foo() {
    var myVar = 123;
}
```

**How to find:** Variables assigned without `var/let/const` that aren't declared elsewhere in scope.

### 2. Implicit Global `this`

**Sloppy mode:** `this` is `window` in plain functions
**Strict mode:** `this` is `undefined`

```javascript
// BAD - works in sloppy, fails in strict
function foo() {
    this.bar = 123;  // TypeError: Cannot set property 'bar' of undefined
}

// GOOD - use explicit reference
function foo() {
    window.bar = 123;
}
```

### 3. `with` Statements

**Strict mode:** SyntaxError

```javascript
// BAD - not allowed in strict mode
with (obj) {
    x = 1;
}

// GOOD - explicit property access
obj.x = 1;
```

### 4. `arguments.callee`

**Strict mode:** TypeError

```javascript
// BAD - not allowed
function factorial(n) {
    return n <= 1 ? 1 : n * arguments.callee(n - 1);
}

// GOOD - use named function
function factorial(n) {
    return n <= 1 ? 1 : n * factorial(n - 1);
}
```

### 5. Duplicate Parameter Names

**Strict mode:** SyntaxError

```javascript
// BAD - not allowed
function foo(a, a) { }

// GOOD
function foo(a, b) { }
```

### 6. Octal Literals

**Strict mode:** SyntaxError for `0NNN` format

```javascript
// BAD
var x = 0755;

// GOOD
var x = 0o755;  // ES6 octal
var x = 493;    // decimal
```

### 7. Deleting Variables/Functions

**Strict mode:** SyntaxError

```javascript
// BAD
var x = 1;
delete x;  // SyntaxError

// Properties can still be deleted
delete obj.prop;  // OK
```

## Audit Workflow

1. **Before extraction:** Run quick scan commands on code section to be extracted
2. **Review results:** Check each flagged line - is variable declared elsewhere?
3. **Fix in place:** Add `var/let/const` declarations before extraction
4. **Document:** Note fixes in SUMMARY.md deviations section
5. **Test:** Run `npm test` after fixes, before extraction

## Known Issues in This Project

| Location | Issue | Status |
|----------|-------|--------|
| app.js:1268,1282 | `httpRequest` undeclared | ISS-001/002 - will remove feature |

## References

- [MDN: Strict mode](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode)
- [MDN: ES6 Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
