---
created: 2026-01-15T10:21
title: Mobile UI/UX enhancements
area: ui
depends: [2026-01-15-modernize-ui-ux-design]
files:
  - index.html
  - css/style.css
  - js/features/recipe-manager.js
---

## Problem

The app was designed for desktop use. Mobile experience has several gaps:
- Touch/mobile drag-drop not supported for ingredient reordering (noted in Phase 10)
- Layout not optimized for small screens
- Touch targets may be too small
- No consideration for mobile-specific interactions

## Solution

TBD - Consider:

**Touch interactions:**
- Touch-friendly drag-drop for ingredient reordering (touch events API or library)
- Swipe gestures for common actions
- Long-press for context menus
- Larger touch targets for buttons and inputs

**Responsive layout:**
- Mobile-first or responsive CSS
- Collapsible sections for small screens
- Bottom navigation for key actions
- Full-screen modals on mobile

**Mobile-specific UX:**
- Virtual keyboard handling (viewport adjustments)
- Orientation changes
- Pull-to-refresh where appropriate
- Mobile-optimized number inputs

**Testing:**
- Test on various screen sizes
- Test touch interactions on real devices
- Consider PWA features (installable, offline)
