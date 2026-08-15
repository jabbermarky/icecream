---
status: in-progress
branch: claude/batch-loop-design
timestamp: 2026-08-15T21:56:26+00:00
files_modified: []
---

## Working on: printed sheet design from binder evidence

### Summary

A long design conversation with the maintainer produced `.planning/printed-sheet-design.md`
plus decisions 25–29. **No code was written.** The subject: the printed churn sheet as a
capture instrument, its physical constraints, and the machine-readable band — driven by
photographic evidence from the maintainer's binder. PR #25 (P0.4 schema revision after the
codex GATE FAIL) is still open and unstarted; this session fed it inputs rather than
resolving it. Tree clean, everything pushed, branch at `94decc6`.

### Decisions Made

- **Decision 25 — reprint is not a concept.** There is saving and printing. Every print is a
  print event; two prints are two events. Dissolves the decision 15/16 contradiction instead
  of patching it, and removes `chain_root` and the reprint-names-a-BatchId command.
- **Decision 26 — the print log generalises to a recipe event log** (`saved`, `printed`,
  `batch_recorded`, `deleted`) on Drive as **one immutable record per event, never an
  appended file**. Sync is LWW on whole records, so two devices appending to one file
  silently lose events; immutable per-event records make sync a union. A `deleted` event is
  a tombstone, closing issue #21. This also clears the objection that killed the separate
  identity store in P0.3 — events are facts about the past, so partial sync yields fewer
  facts, not wrong ones.
- **Decision 27 — method is per-version and diffable, and decision 18 is FORMULA-SCOPED.**
  Ingredient order is not meaningful; **method order IS**, and a reorder is a real change.
  Row and step ids must survive versioning while `RecipeId` mints, or every diff reads as
  removed-and-added.
- **Decision 28 — the printed sheet is the PRIMARY capture surface**; the app screen is
  transcription. Design the paper form first. Corollary: only prompt for what is measurable
  at the bench.
- **Decision 29 — the baker's approach.** Metric weights for everything including liquids.
  Grams is the only unit in the model; volumetric conversion happens once at import, never
  at display.
- **QR: multiple independent self-identifying codes, never Structured Append** (all-or-
  nothing failure is wrong for a sheet that gets splashed). More, smaller codes at higher EC
  beat fewer larger ones — damage locality plus ~20 % symbol overhead.
- **Sheet is duplex, five pages down to two, identity in a running header** so any page
  reattaches alone.

### Remaining Work

1. **PR #25 — the P0.4 schema revision.** Still the blocker; 13 P1s from the codex GATE
   FAIL, zero fixed. This session added inputs to it, not fixes.
2. **Deploy P0.3.** Still not done, still the highest-value non-design item: verify
   cache-busting, reload every device and tab, run `scripts/migrate-legacy-recipes.js`.
3. Answer the open questions in `printed-sheet-design.md` — duplex vs two simplex, half-steps
   on the signed marks scale, where the churn timeline lives, the QR payload format version
   (this one has a deadline: sheets printed before it is settled are unrecoverable), which
   event types earn their place, photos portable or local-only.
4. Issues #15 and #16 (~1 hr each), then the UI-replacement enablers (items 3, 8, 18).

### Notes

- **The evidence is the story.** Three sources now: the 29 Ice Ed binder sheets, a five-page
  olive-oil sheet in a different format, and three web recipe printouts (Serious Eats,
  Epicurious 1997, one from 2012). The olive-oil sheet functions as a **control** — same
  person, same job, different format — which is what let it settle arguments the binder
  alone could not.
- **Prompts work, demonstrated not argued.** Draw temperature: 2 of 29 binder sheets, versus
  filled in (`−6`) on the sheet that pre-printed the prompt. **The 14-of-29 blank rate is a
  property of the sheet, not of the maintainer.** But two prompts came back unanswered
  (`Cream butterfat` blank, `Overrun %` = `?`) — both numbers you cannot produce standing at
  the machine.
- **The 1–5 scale failed on the page:** `bitterness 1–5: 5` cannot distinguish pleasantly
  bitter from far too bitter. Strongest support decision 24's signed scale will get.
  Complication: the maintainer wrote **4.5**, wanting finer resolution than five steps where
  a signed scale offers fewer.
- **Model gaps found:** no state for a struck-through (printed but not performed) step; no
  `SNAPSHOT_METHOD_STEP` though method is now versioned; churn is recorded as a timeline
  (`Speed A @ 20 min · Really thick @ 24 · Full churn 30`) while the schema models a scalar;
  tasting axes are partly per-recipe.
- **Strikethrough is the maintainer's consistent notation for "not this"** across all three
  formats. The method editor should mark steps removed rather than delete them.
- **A correction worth remembering:** I raised "adopted external recipes are unmodeled" as
  the largest open question. It was not open —
  `.planning/todos/pending/2026-01-15-ai-recipe-importer-from-web.md` has owned it since
  January and names the same example (1 cup milk → 244 g). I had listed that todo myself
  earlier in the same session and failed to connect it. Two January todos have now turned out
  to be load-bearing for later work: that one and toast-notifications.
- Import design should carry two things the todo does not name: **countables are not
  densities** (`8 large egg yolks` needs per-unit mass), and **keep the as-sourced measure**
  so a row converted at a wrong density can be re-derived.
- Physical constraints, from the photos: 3-hole punch kills the left 25 mm (it destroyed
  printed text on the banana-bread sheet); the clipboard clip grips the top ~45 mm; **the
  sheets are never folded** — the damage profile is crumpling and liquid staining, so the
  QR spec's fold test case should be replaced.
- Uploads preserved to `.planning/` this session: the decision-16 amendment, the ER model,
  and the QR mechanism spec. **Raw photos deliberately not committed** (27 MB) — the binder
  precedent is to transcribe findings.
