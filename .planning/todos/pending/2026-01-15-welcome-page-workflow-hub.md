---
created: 2026-01-15T10:11
title: Create Welcome page as workflow hub
area: ui
files:
  - index.html
  - js/app.js
---

## Problem

The current UI dumps users into a blank recipe screen on load. This is not inviting or friendly - users face an empty formulation grid with no guidance on what to do next.

New users don't know where to start. Returning users have to manually navigate to their recent work. There's no sense of continuity between sessions.

## Solution

TBD - Consider a Welcome page that:

**Core features:**
- Recent recipes list (quick access to continue work)
- "New Recipe" button with templates or starting points
- Workflow selection: "Create new" vs "Improve existing" vs "Browse library"

**LLM-enhanced features (future):**
- Recipe recommendations based on past work
- "What would you like to make today?" conversational starter
- Follow-up prompts after recipes saved: "How did the Vanilla Gelato turn out?"
- Suggestions for recipe modifications based on feedback

**UX considerations:**
- Should this be a separate page or an overlay/modal?
- How to handle first-time vs returning users?
- Balance between helpful and getting-in-the-way
