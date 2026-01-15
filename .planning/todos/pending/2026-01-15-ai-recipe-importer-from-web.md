---
created: 2026-01-15T10:12
title: AI-powered recipe importer from web sources
area: feature
files:
  - js/features/ingredients.js
  - js/features/recipe-manager.js
---

## Problem

Many ice cream recipes exist on the web (cooking sites, subreddits, foodie blogs, etc.) but they're formatted for human reading, not formulation software:
- Measurements in volume (cups, tablespoons) not weight (grams)
- Ingredients listed by common names, not matching our ingredient library
- No nutritional/property data (PAC, POD, fat %)
- Instructions mixed with ingredient lists

Manually converting these recipes is tedious and error-prone. Users discovering a recipe online have no easy path to analyze it in Ice Ed.

## Solution

TBD - Consider an AI-powered importer:

**Input handling:**
- Paste raw recipe text or URL
- LLM parses and extracts structured data

**Conversion capabilities:**
- Volume to weight conversion (1 cup milk → 244g)
- Ingredient matching to library (fuzzy match "heavy cream" → "Cream, Heavy")
- Missing ingredient research/creation via USDA API
- Temperature/time extraction for process notes

**Output:**
- Preview of converted recipe before import
- Highlight uncertain conversions for user review
- Option to add missing ingredients to library

**Technical considerations:**
- LLM API integration for parsing
- Ingredient density database for volume→weight
- USDA API for unknown ingredients
- Confidence scores for conversions
