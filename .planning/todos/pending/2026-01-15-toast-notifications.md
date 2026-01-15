---
created: 2026-01-15T12:30
title: Replace status bar with toast notifications
area: ui
files:
  - js/ui/components.js
---

## Problem

The current status bar at the bottom of the page shows info/warning/error messages, but they are easy to miss. Messages appear and user may not notice them, especially when focused on other parts of the UI.

A toast notification pattern would be more noticeable - appearing briefly near the top or corner of the screen and auto-dismissing after a few seconds.

## Solution

- Create toast notification component (slide in, auto-dismiss after 3-5s)
- Position at top-right or top-center for visibility
- Different styles for Info (blue), Warning (yellow), Error (red)
- Allow manual dismiss with X button
- Stack multiple toasts if needed
- Replace Info(), Warning(), ErrorMsg() implementations in components.js
