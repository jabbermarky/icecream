---
created: 2026-08-11T16:20
title: Allow outbound egress to three hosts in the Claude Code environment
area: infra
files:
  - js/storage/indexeddb-storage.js
  - js/features/ingredients.js
---

## Problem

The Claude Code remote environment routes outbound HTTPS through an agent proxy
whose network policy blocks every host except a small allowlist. Three blocked
hosts cause real, verified problems. One of them makes the test suite unrunnable.

Symptom for all three:

```
curl: (56) CONNECT tunnel failed, response 403
```

### 1. `esm.sh` — breaks the entire test suite (verified 2026-08-11)

`js/storage/indexeddb-storage.js:4` imports a dependency straight from a CDN:

```js
import { openDB } from 'https://esm.sh/idb@8';
```

`js/app.js:47` imports that module during startup, so it sits in the critical
path of the app's module graph. With `esm.sh` unreachable the graph never
resolves, `domcontentloaded` never fires, and everything collapses from there:

```
✗ Test "testPageLoads" failed with error:
  page.goto: Timeout 5000ms exceeded.
  - navigating to "http://localhost:8080/index.html", waiting until "domcontentloaded"
...
  ✗ Ingredients table visible
  ✗ Ingredients loaded
    Found 0 ingredients
```

Only tab navigation passes (static DOM). Every test that needs the app to have
actually initialized fails. **This means no remote session can verify any code
change against the test suite.** It is the highest-value host of the three.

This is also the app's *only* external runtime import, so it is a single point
of failure in production too: if `esm.sh` has an outage, Ice Ed does not load.
Worth considering vendoring `idb` regardless of the proxy question.

### 2. `api.nal.usda.gov` — blocks verifying the FDC integration

The endpoint at `js/features/ingredients.js:650`. Without it a session cannot:

- confirm how often USDA actually reports each individual sugar, which is
  **P2, the load-bearing premise of the ingredient onboarding design**
- verify FDC response shapes before changing parsing code
- exercise the new error-handling paths against real 429 / 403 / 5xx responses
- check whether an ingredient exists in FDC at all

During the 2026-08-11 eng review this forced P2 to be settled from documentation
at confidence 8/10, with a manual 20-ingredient assignment handed back to the
developer, when two minutes of live queries would have settled it outright.

Low risk to allow: read-only, and it is the same host the shipped app already
calls directly from every user's browser, so allowing it grants the environment
nothing production does not already do. FDC keys are free, rate-limited, and not
billable.

### 3. `api.openai.com` — blocks the Codex outside voice

gstack's plan reviews end with an independent cross-model challenge via the
Codex CLI. The skill is installed; the binary is not, and even installed it
cannot reach OpenAI from here. The fallback is a same-family Claude subagent,
which is weaker evidence than a genuine cross-model check.

API-key auth only. Do **not** bother allowing `chatgpt.com` or
`auth.openai.com` — interactive `codex login` cannot work in a headless
container, so `CODEX_API_KEY` or `OPENAI_API_KEY` is the only viable path.

## Solution

Add three hosts to the environment's network policy:

| Host | Why | Priority |
| --- | --- | --- |
| `esm.sh` | App will not load; test suite unrunnable | **High** |
| `api.nal.usda.gov` | Cannot verify the FDC integration or P2 | Medium |
| `api.openai.com` | Cannot run a real cross-model review | Low |

The policy is chosen when the environment is created — see
https://code.claude.com/docs/en/claude-code-on-the-web. This is an environment
setting, not a code change.

**Not needed:** `accounts.google.com`, `apis.google.com`, `docs.google.com`,
`www.googleapis.com` (Drive sync, which
`.planning/sprinkles-stack-decisions.md:183` already says does not carry
forward). `registry.npmjs.org` is already reachable via the proxy's noProxy
list, so npm installs work today.

## Related friction found while verifying this

Even with egress fixed, `npm test` does not run out of the box in a fresh remote
session. Three separate blockers, all reproduced 2026-08-11:

1. `node_modules` is absent on a fresh clone — `npm install` is required first,
   and nothing in the repo or CLAUDE.md says so.
2. `package.json` pins `playwright ^1.57.0`, which expects `chromium-1234`. The
   container ships `chromium-1194` and `chromium-1208` at
   `/opt/pw-browsers`, so the launch fails with "Executable doesn't exist".
   Needs an `executablePath` override or a matching pin.
3. `test-app.js:114` launches with `headless: false`, which cannot work in a
   container with no display.

Worth fixing separately — a `SessionStart` hook could handle 1, and 2 and 3 are
small changes to `test-app.js`. Together they are the difference between a
remote session being able to verify its own work and not.

## Context

Surfaced during `/plan-eng-review` on 2026-08-11 and confirmed by running the
suite. Not a blocker for *writing* the G1/G2/B1 code, but it is a blocker for
verifying it anywhere except the developer's own machine.
