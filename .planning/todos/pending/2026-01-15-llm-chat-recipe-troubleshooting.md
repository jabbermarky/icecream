---
created: 2026-01-15T10:10
title: LLM Chat for recipe diagnosis and troubleshooting
area: feature
files: []
---

## Problem

After making ice cream, users often encounter issues they want to fix:
- "This recipe was not very scoopable directly out of the freezer"
- "The texture was too icy"
- "It melted too quickly"
- "The flavor was muted"

Currently, troubleshooting requires external research or trial-and-error. An LLM assistant with access to the recipe data could diagnose issues and suggest specific adjustments.

## Solution

TBD - Consider:
- LLM chat with current recipe context (ingredients, quantities, calculated properties)
- User describes the problem experienced
- LLM analyzes recipe properties (PAC, POD, fat %, etc.) against the reported issue
- Suggests specific adjustments: "Your PAC is 245, which is low for scoopability. Try increasing sugar by X or adding Y"
- Could reference ice cream science principles in explanations
- May integrate with the "research new recipes" chat feature as a unified interface
