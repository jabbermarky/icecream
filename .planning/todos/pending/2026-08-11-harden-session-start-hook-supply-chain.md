---
created: 2026-08-11T21:10
title: Harden the SessionStart hook against npm supply-chain exposure
area: infra
files:
  - .claude/hooks/session-start.sh
  - .claude/settings.json
---

## Problem

Raised by the Codex outside voice on 2026-08-11 and rated its merge blocker.
Deferred deliberately: it is a workflow tradeoff, not a defect.

`.claude/settings.json` registers a `SessionStart` command hook, and
[Claude's hook documentation](https://code.claude.com/docs/en/hooks#security-considerations)
confirms command hooks run with full user permissions. The hook then:

1. runs `npm install` (`session-start.sh`), which executes whatever `postinstall`
   and other lifecycle scripts the checked-out branch's dependencies declare
2. runs `npm install -g @openai/codex` **unpinned**, so it takes whatever the
   registry serves at that moment
3. does both while `OPENAI_API_KEY` is present in the environment

The exposure: checking out a branch is enough to execute code from it, and that
code can read the API key. This is fine for branches you wrote. It is not fine
as a standing pattern if you ever check out a contributor's branch, and it is
not fine if an upstream package is compromised between sessions.

## Solution

Three changes, in order of value:

1. **`npm install --ignore-scripts`.** Removes lifecycle-script execution
   entirely. Verify nothing in the dependency tree genuinely needs postinstall
   first: this project's only dependency is `playwright`, whose browser download
   is already invoked explicitly on the next line, so `--ignore-scripts` is very
   likely safe here.
2. **Pin the codex version** (`@openai/codex@<version>`) so a compromised or
   simply broken publish cannot land silently. Costs a manual bump to pick up
   upstream fixes.
3. **Keep the key out of the install environment.** Move the `codex login` step
   so `OPENAI_API_KEY` is not in scope during any `npm install`, or unset it for
   the duration of the installs and re-read it from a file afterwards.

Item 1 alone removes most of the exposure for a few characters.

## Context

The hook exists because a fresh container has no `node_modules`, no matching
chromium build, and no codex CLI, and rediscovering that cost three rounds on
2026-08-11. Removing the hook is not the answer; hardening it is.

Not urgent while this repository is single-maintainer and branches are
self-authored. It becomes urgent the first time an outside branch is checked
out, so it should land before any collaboration.
