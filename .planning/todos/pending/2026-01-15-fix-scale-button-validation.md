---
created: 2026-01-15T10:21
title: Fix Scale button enabled without valid input (ISS-003)
area: ui
files:
  - js/features/recipe-manager.js
  - index.html
---

## Problem

The Scale button is enabled by default. Clicking it without proper input causes odd behavior:
- Error message appears at the bottom
- Sum amount is displayed in the Scale Amount text field

This is a pre-existing bug discovered during Phase 10 UAT (2026-01-13).

## Solution

Scale button should be disabled by default and only enabled when:
1. A value has been entered in the Scale Amount input, OR
2. The "By Ingredient" checkbox is checked AND a value has been entered into one of the ingredient scale amount text inputs

Implementation:
- Add input event listeners to Scale Amount field
- Add change listener to "By Ingredient" checkbox
- Add input listeners to ingredient scale inputs (when By Ingredient mode)
- Update button disabled state based on validation
- Consider visual feedback for why button is disabled
