---
created: 2026-01-15T10:14
title: Elevate Library from modal to dedicated page
area: ui
depends: [2026-01-15-modernize-ui-ux-design]
files:
  - js/ui/recipe-library.js
  - index.html
---

## Problem

The current Recipe Library is implemented as a modal dialog. This works for basic list/load/delete but is limiting:
- Limited screen real estate for recipe information
- Can't show recipe previews or cards
- No room for advanced management features
- Modal pattern feels cramped for browsing/exploration
- Can't easily compare recipes side-by-side

## Solution

TBD - Consider elevating Library to a full page/tab:

**Layout possibilities:**
- Dedicated Library page with navigation
- Tab-based interface (Library | Editor | ...)
- Card-based recipe grid with previews

**Enhanced capabilities with more space:**
- Recipe preview cards showing key stats (PAC, POD, fat %)
- Thumbnail or color-coded visual for each recipe
- Sort/filter/search controls
- Bulk selection and management
- Recipe comparison view
- Detailed recipe info panel

**Navigation considerations:**
- How to switch between Library and Editor views?
- Should editing happen inline or open separate view?
- Relationship with Welcome page (todo #4)
