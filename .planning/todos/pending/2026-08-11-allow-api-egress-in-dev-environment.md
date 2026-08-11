---
created: 2026-08-11T16:20
title: Allow outbound API egress to api.nal.usda.gov in the Claude Code environment
area: infra
files: []
---

## Problem

The Claude Code remote environment routes outbound HTTPS through an agent proxy
whose network policy does not permit `api.nal.usda.gov`. A request to the USDA
FoodData Central API fails at the tunnel:

```
curl: (56) CONNECT tunnel failed, response 403
```

This blocked real work during the 2026-08-11 eng review. The load-bearing
premise of the ingredient onboarding design — **P2, that the PAC/POD derivation
almost never fires because USDA rarely reports galactose** — could have been
settled empirically in about two minutes by querying FDC for a handful of
representative ingredients and checking which sugars come back. Instead it was
resolved from documentation and left at confidence 8/10, with a manual
assignment handed back to the developer to verify by hand.

The same block will recur for any future session that needs to:

- verify FDC response shapes before changing parsing code
- measure how often individual sugars are actually present (open question 1 in
  the design doc)
- test the new error-handling paths against real 429 / 403 / 5xx responses
- check whether an ingredient exists in FDC at all before designing a fallback

## Solution

Allow egress to `api.nal.usda.gov` in the environment's network policy.

The environment and its network policy are configured per
https://code.claude.com/docs/en/claude-code-on-the-web — the policy is chosen
when the environment is created, so this is an environment setting rather than a
code change.

Notes:

- Read-only, unauthenticated-ish traffic. FDC keys are free, rate-limited, and
  not billable, so the risk of allowing this host is minimal.
- This is the same host the shipped app already calls directly from the user's
  browser (`js/features/ingredients.js:650`), so allowing it in the dev
  environment grants nothing the production app does not already do.
- If a broader policy is undesirable, an allowlist entry for this single host is
  sufficient.

## Context

Surfaced during `/plan-eng-review` on 2026-08-11. Not a blocker for implementing
G1/G2/B1 — the design proceeds on documented USDA behavior — but it is the
difference between "verified against the live API" and "inferred from docs, go
check it yourself" on the one premise the whole design rests on.
