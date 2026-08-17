---
created: 2026-08-11T16:20
title: Outbound egress in the Claude Code environment — status and remaining gap
area: infra
files:
  - js/storage/google-auth.js
---

## Status: mostly resolved. One host still blocked, one lesson worth keeping.

Egress was opened for three hosts on 2026-08-11. What actually happened is more
interesting than the original request, and the most important fix turned out not
to be an egress change at all.

## Resolved

**`esm.sh` — resolved by vendoring, NOT by egress.**
`js/storage/indexeddb-storage.js:4` imported `idb` straight from a CDN, inside
the startup module graph. With it unreachable the app never initialized and the
test suite was unrunnable.

Allowing `esm.sh` through the proxy **did not fix it.** Playwright's Chromium
does not inherit the shell's `HTTPS_PROXY`, so while `curl https://esm.sh`
returned 200, the browser still got `ERR_CONNECTION_RESET`. Passing
`proxy: { server: process.env.HTTPS_PROXY }` with `ignoreHTTPSErrors` did not
fix it either.

The fix was T0: vendor `idb` to `js/vendor/idb.js`. Suite went from
**10 passed / 15 failed to 113 passed / 1 failed**, runtime 358s → 49s.

**Lesson worth keeping: a runtime CDN import inside the startup path is a
liability regardless of proxies.** It made the app unrunnable in a sandbox, and
in production it made a third-party CDN a single point of failure for the whole
app. Prefer vendoring over allowlisting.

**`cdn.playwright.dev` — resolved by egress.** This was the real cause of the
Playwright install trouble. `npm install` succeeded (the registry was always
allowlisted) but the postinstall could not download browsers, so it finished in
3 seconds having fetched nothing, leaving the pinned `playwright@1.62.1`
expecting `chromium-1234` against a container shipping 1194 and 1208. With
egress open, `npx playwright install chromium` works and the mismatch is gone.

**`api.nal.usda.gov` — resolved by egress, and it paid for itself.** It allowed
premise P2 to be measured rather than inferred, which overturned the review's
diagnosis: the PAC/POD gate fails on nutrient-name drift, not galactose
coverage. It also surfaced that the `Sugar` field had never populated on import,
which nobody was looking for.

**`api.openai.com` — open.** Codex CLI is still not installed. Installing it
plus an API key would enable a genuine cross-model outside voice.

## Remaining gap

**`apis.google.com` is still blocked**, and it is the sole remaining test
failure:

```
Failed to initialize Google Auth: Error: Timeout waiting for gapi library
  at js/storage/google-auth.js:148
```

`testNoConsoleErrors` fails on it. Everything else passes.

Two ways to close it, and the second is better:

1. Allow `apis.google.com`. Cheapest, but Drive sync does not carry forward
   into the rewrite (`.planning/designs/sprinkles-stack-decisions.md:183`), so this
   spends policy surface on a feature being retired.
2. Make Google Auth initialization non-fatal and skip it when `gapi` is
   unreachable. This is the same architectural pattern T0 just fixed: an
   external runtime dependency loaded during startup that fails hard when
   absent. The app should degrade to local-only storage rather than logging
   errors, which is also the correct behavior for any user who is offline.

Option 2 is recommended. It fixes a real robustness gap rather than papering
over it with network policy, and it takes the suite to fully green.

## Also worth fixing

`test-app.js:114` launches with `headless: false`, which needs an X server. It
works here under `xvfb-run -a npm test`, but making headless the default (with
an opt-in env var for headed debugging) would let the suite run anywhere with no
wrapper.

## Context

Surfaced during `/plan-eng-review` on 2026-08-11, then largely resolved the same
day. Kept open for the `apis.google.com` / Google Auth item.
