# Optimization: mirror RecipeId into Drive appProperties

**Status:** deferred — take only if per-sync body downloads are ever actually
felt. Filed from the P0.3 identity design review (2026-08-12).

## What

When saving a recipe to Drive, also write its `RecipeId` into the file's
`appProperties`, next to the `app`/`type` keys already written there
(`google-drive-storage.js:390-393`), so `listRecipes` can return ids in one
`files.list` round trip (`:363` already requests `appProperties`).

## Why

The id-first sync join (P0.3 decision 3) reads cloud file bodies to see ids.
At dozens of recipes that is fine; this todo exists for the day it is not.

## The trap — do NOT implement this naively

`updateFile` uses `uploadType=media` (`google-drive-storage.js:431-445`),
which **never rewrites `appProperties`**. Mirror the id without also switching
updates to a multipart upload (metadata + content) and any client that
rewrites the body — including a pre-P0.2 client stripping the id — leaves
metadata asserting an id the content no longer holds. Two copies of one fact
with no reconciliation rule is the failure class the P0.3 design exists to
avoid; if this todo is taken, the rule is: **the body wins, metadata is a
cache**, and the join must fall back to a body read on any mismatch.

## Depends on

P0.3 landed (ids exist in bodies first).
