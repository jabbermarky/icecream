---
created: 2026-08-11T16:05
title: Rotate USDA API key and move it out of source
area: chore
files:
  - js/features/ingredients.js
---

## Problem

`js/features/ingredients.js:650` embeds the USDA FoodData Central API key
directly in the request URL, in committed source.

Two separate issues:

1. The key is in git history.
2. The request is made client-side, so the key is visible to anyone using the
   app regardless of where it is stored. Moving it to config does not hide it.

Severity is genuinely low: FDC keys are free, rate-limited per key, and not
billable. The blast radius is someone else consuming the quota, which surfaces
as a 429 — and after the error-handling work from the 2026-08-11 eng review,
that failure is diagnosable rather than silent.

## Solution

Honest scope, given the constraint that this app has no backend:

- Rotate the key. This invalidates whatever has already leaked.
- Move it to configuration so the next one is not committed.
- Accept that the key stays publicly visible in the deployed app.

The only way to actually conceal it is to proxy the FDC call server-side, which
this project deliberately avoids today. If a backend ever arrives (see
`.planning/designs/sprinkles-stack-decisions.md`), route the FDC call through it and the
key stops being public.

## Context

Surfaced during `/plan-eng-review` on 2026-08-11 alongside the ingredient
onboarding work. Deliberately kept out of that branch to avoid mixing a
credential change into a functional one.

Depends on: nothing. Not blocked by, and does not block, the G1/G2/B1 work.
