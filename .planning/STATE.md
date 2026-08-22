# Project state

**Written when things change, not at the end of a session.**

The section between the `BRIEFING` markers is injected into every new session
by `.claude/hooks/session-briefing.sh` — including after `/clear` and after
compaction. Everything below the markers is read only on demand.

**This file does not carry status.** What is open, what it depends on, what
ships together and what state each thing is in all live in GitHub. It does not
carry the hook machinery either — that is in `CLAUDE.md`, which is injected
into every prompt, so repeating it here pays for it twice.

What is left is the residue: things that were expensive to learn, traps that
return success, and conclusions that were reversed. **If it can be answered by
reading the board or `CLAUDE.md`, delete it from here.**

<!-- BRIEFING:START -->
### Read the board first

Status is in GitHub and nowhere else. The **Project board** for where things
are, **#41** for what the batch loop is made of and in what order. Do not
reconstruct a plan from this file — it deliberately no longer holds one.

**If a task's state changes, change the issue.** One `issue_write` call and the
board follows.

### Merging is the deploy, and nothing tells you it happened

GitHub Pages serves the repo directly — no build step, no workflow, no CI.
**Merging to `main` IS the deploy.**

The trap is the other half: **there is no cache-busting (#26)**, and a
4-hour Cloudflare TTL sits in front of unversioned paths. A device can run
stale JS for hours after a merge, so every deploy needs the hard-reload ritual
by hand until #40 closes this.

**So never tell the maintainer a fix is visible before it is live AND
reloaded.** This already cost them a round of testing across three browsers on
a device where every browser is WebKit anyway.

The Info & FAQ panel reports which build this device is actually running —
version, schema version, and record counts. `newer > 0` means another device is
ahead of this tab, so the verdict names the hard reload.

### Recipe identity is closed — do not re-raise it

`RecipeId` + author-time `SavedAt` live inside the container behind
`SchemaVersion: 2`. **Designed, built, deployed and rolled out on every device
with zero skips** (#44, confirmed 2026-08-17). Reasoning in
`designs/p0.3-identity-design.md`.

The consequence that matters: identity is uniform across the whole library, so
decision 14's `SYNC_WARNINGS.LEGACY_CONFLICT` should never fire again. **If it
does, it is new information** — a device that was missed, or a record from
somewhere unexpected — not residue from the backlog.

### Two conclusions that were reversed

**`(220 - 230)` was never the type's PAC range.** There is no per-type PAC
range anywhere in the codebase — `cTarget` carries Fat, MSNF, Solids, POD and
Stabilizer, never PAC. The band was the upstream author's gelato numbers,
inherited from `IceEd.html:1743` and compared to nothing. So Cranberry v1.2's
"347 PAC" was **not** a spec violation; two documents still say otherwise
(**#48**). #16 is undisturbed — its evidence is that v1.2 is formula-identical
to v1.0, found by diffing tables, not by reading the band.

**Estimates here have twice survived as facts.** "#15 and #16, about an hour
each, either would have caught the regression" was quoted for days as though
measured. Both halves were wrong: #16 is 2–3 hours, and #15 was measured
against the fiction above, so only #16 would have caught it. Say "unmeasured"
or measure it.

### Tool traps

- **A 200 does NOT mean the field was written.** `issue_write` silently
  discarded `type`, and separately `state: closed` on create — four issues came
  back open. **Verify after writing.**
- **Not available:** Projects v2 (status moves are the maintainer's), issue
  types (org-only), custom issue fields (need an org), issue dependencies
  (readable, not writable), milestone *creation*.
- `labels` **REPLACES** on update. Send the full intended set.
- Sub-issues nest to **6 levels**, one parent each. **Rollup is one level, not
  recursive.**
- `pkill -f "http.server"` **kills its own shell here**. Use `pkill -f "[h]ttp\.server"`.
- Throwaway Playwright probes must live in the **repo root**, or module
  specifiers fail to resolve.

### At the start of a session

- `./.claude/hooks/wait-for-setup.sh && xvfb-run -a npm test` for the browser
  suite; `npm run test:unit` needs neither.
- **Re-arm `subscribe_pr_activity` on any open PR** — the one piece of session
  state no hook can restore.
- **An artifact is not published until its URL is in this file.** Nothing
  mirrors it, and compaction takes every trace of it with the turn that made it.
- **A second session can be live on this branch.** One committed
  mid-`/context-save` and moved the repo five commits underneath. Check
  `git log` before assuming the tree is where you left it.

### Conventions worth not violating

- Draft PR on the **first** commit of a branch. Its body carries the live
  checklist.
- **An open decision is a task ("settle X"); a settled decision is that same
  issue, closed, with the rationale in it.**
- **Token discipline is in CLAUDE.md and it is load-bearing.** One review round
  per build step, then bank. Full fan-out at most ONCE per PR, at the merge
  boundary. **No polling automations.**
- **N=1.** One user. A threat needing a second concurrent writer, a hostile
  file author, or a fleet is a documented limit, not code.
<!-- BRIEFING:END -->

## Where the work is

Branch `claude/batch-loop-design`, tracked by **PR #25** (draft). The old
`claude/garry-tan-gstack-install-lp58z2` is merged; its remote ref survives
because the git proxy refuses branch deletion — remove it from the GitHub UI
when convenient.

Shipped: v0.5.0 (#4), identity and sync (#11), build info (#28), the in-app
migration (#29), the range check (#46). Node lane at 224.

**The batch loop** — epic #41. The maintainer already runs a working manual
version-control system: versioned recipe names, print as an immutable snapshot,
annotate during the churn, file by base recipe, copy-and-tweak for the next
version. **The design feeds that paper workflow rather than replacing it** —
paper wins at capture. `designs/p0.4-batch-schema.md` for reasoning,
`designs/p0.4-data-model.mmd` for the normative schema.

**Ingredient onboarding** — `designs/ingredient-onboarding-design.md` lists
every finding against its issue. `/ship` once overrode its coverage gate at 25%
on the understanding that the node lane landed next; **that promise is
outstanding** (#7).

## Code facts worth not rediscovering

- `recipe-manager.js` is **1,820 lines**, `ingredients.js` **862** — both over
  the 600-line bound v1.0 set. recipe-manager broke it *after* the
  modularization project closed, by absorbing the identity work, so splitting
  it is unscheduled work rather than unfinished work.
  `.planning/codebase/STRUCTURE.md` still omits recipe-manager entirely, after
  a sync commit that claimed to fix it.
- **The cloud write race is fixed.** `buildRecipeContainer` returns a detached,
  deeply frozen `structuredClone` and both backends receive that same object.
  Before, save passed the live `Recipe` to a fire-and-forget cloud write that
  stringified only after Drive's `findFileByName` round trip, so edits in that
  window entered the cloud payload while IndexedDB held the earlier state.
  Pinned by `tests/unit/recipe-roundtrip.test.js`.
- `recipe-sync-join.js` is the pure decision core (id-first join, name
  fallback, `SavedAt` clock, fixpoint placement so plans are order-independent);
  `recipe-sync-executor.js` executes (listing failure aborts before any write;
  any write failure skips all deletes). Legacy conflicts REJECT — an id-less
  body never replaces an identified record.
- Writing the in-app migration surfaced four defects the console script it
  replaced had carried: it downgraded records from newer builds, restamped the
  `SavedAt` clock sync orders by, listed with the lossy `listRecipes`, and
  duplicated `mintRecipeId`.

**Deployed:** https://www.marklummus.com/icecream/
