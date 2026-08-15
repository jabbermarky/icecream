# The printed sheet — capture instrument, physical constraints, machine-readable band

**Status:** DESIGNED 2026-08-15, from a working session with the maintainer. Not implemented.
**Covers:** P0.7 (print persists a snapshot), P2.1/P2.2 (print surface and churn sheet),
P3.1 (QR mechanism), and the parts of P0.4 the session changed.
**Evidence:** `.planning/binder-audit.md` (29 Ice Ed sheets, Aug 2024 – Apr 2026), a
five-page olive-oil sheet in a different format, and three web recipe printouts (Serious
Eats, Epicurious, and one from 2012) — all photographed 2026-08-15
(`IMG_2485`–`IMG_2489`, continuing the binder's series). Raw photos are deliberately not
committed — the binder precedent is to transcribe findings, not to carry 27 MB of JPEG.
**Related:** `p3.1-qr-mechanism.md`, `p0.4-decision16-amendment.md`, `p0.4-data-model.mmd`.

---

## Why this document exists

The UI/UX replacement frees the print format. Until now every proposal fitted symbols and
fields into the leftovers of a layout designed to print formulas. With the format open, the
sheet and its machine-readable band get designed together — and the sheet turns out to be
the more important half.

**The sheet is the primary capture surface. The app screen is transcription.** Writing
happens at the bench, on paper, with cold hands; typing happens afterward, sometimes never.
That inverts P0.4's assumption that the outcome instrument is an app screen (task B6). The
paper form's ergonomics should drive the schema's, because paper is where the data is born.

---

## The controlled experiment

The olive-oil sheet is a different format from the binder's 29, made by the same person for
the same job. It functions as a control, and it settles arguments the binder alone could not.

### Prompts work. This is now demonstrated, not argued.

| | Binder (no prompt) | Olive-oil sheet (pre-printed prompt) |
|---|---|---|
| Draw temperature | **2 of 29** | filled: `−6` |
| Come-up time | not a field | filled: `~20 minutes` |
| Draw notes | ad hoc | filled: *"Soft. Not greasy."* |
| Tasting axes | ad hoc prose | three scores filled |

The audit's §2.6 finding was that across three print generations every field the app gained
was a *planning* field and the outcome side never gained a structured one. This sheet added
outcome fields and they came back filled. **The 14-of-29 blank rate is a property of the
sheet, not of the maintainer.**

### But only prompt for what is measurable at the bench

Two prompts came back unanswered, and both are the same kind:

- `Cream butterfat (calculated)` — blank
- `Overrun %` — `?`

Neither can be produced standing at the machine. **A prompt for a number the operator cannot
determine in the moment does not get filled; it gets a question mark.** Compute those in the
app and print them, or leave them off the bench sheet.

### The 1–5 scale fails on the page

> `Tasting −12°C — bitterness 1–5:` **5**

Unreadable. For an olive-oil ice cream, is 5 "pleasantly bitter, as good EVOO should be" or
"far too bitter"? The page cannot say, and neither can a reader in a year. Same ambiguity on
`sweetness 1–5: 4`.

This is the collapse the audit predicted, caught in the act, and it is the strongest support
decision 24's signed scale will get: `0 = Good`, `+2 = far too much` removes the ambiguity at
no cost.

**One complication.** The maintainer wrote **4.5** on a five-point integer scale. He wants
finer resolution than five steps, and a −2…+2 scale has fewer. Half-steps on the signed axes
need a decision.

### Tasting axes are partly per-recipe

The sheet's axes are `oil character`, `bitterness`, `sweetness`. The first two are
meaningless for Mango. P0.4 specifies a fixed nine axes; the evidence says **a default set
plus recipe-specific axes**. `OBSERVATION.axis` in the data model is already a string, so the
model supports it — the design did not.

### A struck-through step is a data type the model lacks

Process step 1 — *"Lecithin into the oil"* — is scored through in its entirety. The data
model has `PROCESS_RECORD.method_step_id` with *"null means improvised"*, covering a step
performed but not printed. **It has no state for the inverse: a printed step deliberately not
performed.** Here that is the first step of the method.

Also observed, and already covered by the as-made overlay: `45 seconds → 60`, milk
`~250 g → 263`, cream `252.8 → 241`, whole milk `370.4 → 383`.

### The binder is heterogeneous by origin — and half of it is unmodeled

Three more sheets photographed 2026-08-15 are **web recipe printouts**: Serious Eats
(Falkowitz, banana bread), Epicurious/Bon Appétit December 1997 (rum-raisin), and one from
December 2012 (brown sugar–bourbon). Added to the 29 Ice Ed printouts and the five-page
olive-oil format, this establishes that **"the binder" is not a format — it is whatever the
source produced.** The app models only the case where the recipe originated in the app.

**They are volumetric** — `1 cup whole milk`, `2/3 cup dark rum`, `8 large egg yolks`,
`1 pound very ripe bananas` — while every Ice Ed sheet is gravimetric.

**This is already planned, not an open fork.** `.planning/todos/pending/2026-01-15-ai-recipe-importer-from-web.md`
owns it, and names the same example: *"Volume to weight conversion (1 cup milk → 244 g)"*,
*"Ingredient density database for volume→weight"*, *"Confidence scores for conversions"*.
**Maintainer decision (2026-08-15): the baker's approach — metric weights for everything,
including liquids.** Grams is the only unit in the model; conversion happens once, at import,
and never at display.

Two consequences the import design should carry:

- **Countables are not densities.** `8 large egg yolks` and `1 pound bananas (about 4)` need
  per-unit masses, not g/mL. The library needs both kinds of conversion factor.
- **Keep what the source said.** If `1 cup` becomes 244 g, the row should retain `1 cup` as
  as-sourced provenance. Densities get corrected, sources get re-read, and a row that only
  remembers 244 g cannot be re-derived. This is a third layer beneath as-planned and as-made.

Note what these three sheets are *not*: they were never in Ice Ed. They are recipes made
straight from the web and annotated on the printout. The importer is what would bring them
in — and once in, they are ordinary recipes that print, get churned and get annotated like
any other.

**Lineage can point outside the app.** Issue #16's parent pointer must accept a URL plus a
retrieval date, not only a `RecipeId`. Provenance survives only by accident today: the
Epicurious sheet carries its URL and print timestamp because the browser's print footer put
them there; the other two carry an author name or nothing.

**The hole punch destroys third-party content.** On the banana-bread sheet the punch ate part
of `sugar` in an ingredient line and part of the `Special Equipment` heading. Ice Ed's own
layout can honour the 25 mm dead zone; a recipe site's cannot.

**Printed checkboxes went unused.** The brown-sugar sheet prints `□` beside every ingredient
and all are empty, while on the olive-oil sheet the maintainer drew his own ✓ marks. One
sheet is thin evidence, but it hints the check-off habit attaches to *weighing* rather than
to measuring by volume.

### The annotation taxonomy, from the external sheets

On Ice Ed sheets the ink is mostly as-made override. On adopted recipes it is **editing
someone else's work**, and four distinct kinds appear:

| Kind | Evidence |
|---|---|
| Verdict | *"Too eggy"* · *"Too Sweet – Too small"* |
| Method edit | `stir over ~~medium~~ low heat`; a whole sentence struck out |
| Method insertion | *"Add Pinch of Kosher Salt + Pinch of Nutmeg"* · *"Churn 20 minutes, then Add Raisins"* |
| **Proposed delta, unapplied** | *"try 7"* · *"Try with 4 TBS rum in mix"* |

The last row validates `DELTA_GROUP.applied` and `applied_in_recipe_id` directly: intent for
next time, recorded on the sheet before it has been acted on.

**Strikethrough is the maintainer's consistent notation for "not this,"** across all three
formats — `medium` struck here, process step 1 struck on the olive-oil sheet,
`Sweetness ~~Good~~ Perfect` in the binder. **The method editor should mark a step removed
rather than delete it**, because the record of what was rejected is wanted. Same argument as
no-verdict-being-a-value.

### Churn is recorded as a series, not a scalar

> `Speed A @ 20 minutes` · `Really thick @ 24 minutes` · `Full churn 30 minutes`

Three time-stamped observations inside one churn. The schema models `churn_duration` as a
single number. The bench produces a timeline. Elsewhere on the same sheet: *"Fast, Soft,
Prechill 15min."*

### The ordering is wrong, and it is why five pages feels long

**"Before you start" is on page 4 of 5.** Taste the oil, check the cream's real butterfat,
confirm the machine's minimum fill — every one a pre-flight check, all of them behind three
pages of formula and process.

### Physical evidence

Three-hole punched on the left edge. Visibly wrinkled on four of five pages. Staining near
the left edge on two. **Not folded** — the failure mode is crumpling and splashing, not
creasing, which is the damage profile the QR error-correction level has to survive.

---

## The sheet

### Structure: five pages to two, duplex

| Face | Contents |
|---|---|
| **1 front** | Before you start · formula table with the ✓ column already in use · jar fill |
| **1 back** | Process, numbered, with annotation room |
| **2 front** | Batch log — the whole page, not the top third |
| **2 back** | Machine-readable band, if it does not fit elsewhere |

Removed from the bench sheet: the **Balance** table, **Carried forward**, and the long
explanatory sub-notes. That material is *design-time* reading, wanted when planning the next
version rather than with cold hands. It belongs in the app and in the archival QR.

`Carried forward` is the best idea in the olive-oil format — rationale travelling with the
version is audit failure #5 solved. It simply does not belong at the bench.

**The batch-log page is 90 % empty** in the current format: ten short prompts occupy the top
third. Either the prompt set is too thin for a page, or the white space is meant to invite
prose and does not. The binder's richest pages have eight process lines and four outcome
lines written freehand — space gets used when it sits next to what it describes, not as a
blank area under a form.

### Physical constraints

| Zone | Status | Why |
|---|---|---|
| Left 25 mm | dead | 3-hole punch: 6.35 mm holes centred 12.7 mm from the edge, plus tear-out and ring wear |
| Top ~45 mm | occupied while clipped | clipboard clip grips and creases the strip |
| Horizontal thirds | **not a constraint** | clipboard → binder; the sheets are never folded |

The fold constraint in the QR spec's §6 was inherited from a mailing workflow that does not
exist here. Dropping it returns the middle of the page.

**Duplex tension, unresolved.** Duplex is right for the binder and for a long process
section, but on a clipboard it costs an unclip–flip–reclip at the moment hands are dirty. Two
simplex pages clip together and flip freely. Binder economy versus bench ergonomics.

### Identity in a running header

Code A repeats in the header of every page, so any page reattaches on its own and a page
separated in the binder is still identifiable. 33 bytes, ~25 mm, twice.

### Three things a free format buys

1. **Prompted fields for the variables that go unrecorded** — `Draw temp ___°C` is the
   highest-leverage mark on the page, being the variable most predictive of the dominant
   complaint.
2. **The diff block, printed.** The previous version's deltas at the top: *what changed from
   V2.1, and why*. Audit failure #5 was that the reason for a change is never on the page
   that makes it — Strawberry V2 rebuilt the fruit strategy and said only "Don't Cook Fruit."
3. **The no-verdict checkbox.** Decision 17 makes "no verdict" a value rather than a blank,
   but the ambiguity *originates on paper*. Two pre-printed boxes — *made it, nothing to
   note* / *made it, didn't evaluate* — put the tap where it actually happens.

---

## The machine-readable band

Full mechanism in `p3.1-qr-mechanism.md`. What this session settled on top of it:

**Multiple independent codes, never Structured Append.** QR's native multi-symbol mode is
all-or-nothing: lose one symbol and the payload is gone. On a sheet that gets crumpled and
splashed that is the wrong failure mode. Application-level splitting into self-identifying
codes — each with a type byte — degrades gracefully, decodes in any order, and contributes
whatever survived.

**More, smaller codes beat fewer, larger ones.** At equal total capacity, splitting localises
damage and buys higher error correction: three 40 mm codes at EC-Q carry roughly what one
90 mm code carries at EC-L, and each tolerates 25 % damage instead of 7 %. Cost is ~20 %
per-symbol overhead.

**One photo decodes many codes.** A phone photo of a letter page yields ~18 px/mm, so a
0.5 mm module lands around 9 px. There is no per-code scanning cost; the cost is page area.

**What the capacity is for**, ranked by what the binder lost:

1. Method steps — reconstructible from nothing else, and the audit's highest-variance axis
2. The previous version's formula — lets the sheet print its own diff
3. Ingredient coefficients — upgrades drift *detection* to *recomputation*
4. Lineage — parent id and name snapshot, issue #16 on paper

**The property this unlocks:** a sheet carrying formula, method, coefficients and lineage
reconstructs its recipe into a fresh install with no sync, no Drive and no account.
Photograph the binder, rebuild the library. It does not help the existing 29 sheets, but from
here every sheet is a self-contained backup of its recipe.

**The deadline nobody else has.** Encoding at print is cheap; decoding needs a camera
pipeline and lands much later. Sheets will therefore be printed for months before anything
can read them — which is fine, and good, *provided the payload format is settled before the
first sheet prints*. Every sheet printed against a format that later changes is
unrecoverable. Most decisions here defer cheaply; this one accrues dead paper while open.

---

## What this changes elsewhere

### Method is per-version, and decision 18 must be scoped

**Method belongs in the recipe container, versioned with the formula.** Sous vide temperature
drifted 75 → 77 → 80 °C across the binder and the record never states it; versioned method
makes that a diff line.

**Decision 18 is FORMULA-SCOPED.** It says ingredient order is not meaningful — keyed diff,
no move operations. **Method inverts it: order is meaningful, and a reorder is a real
change.** If that scoping is not recorded, someone applies "order is not meaningful" one
level wider than its evidence and reorderings vanish from the diff — the same shape as the
duplicate-ingredient own-goal, where a decision was generalised past what it was decided
about.

**Row and step ids survive versioning while `RecipeId` mints.** For a diff between V2.1 and
V2.2 to be readable, unchanged rows and steps must keep their ids across the save that mints
the new version. Otherwise everything reads as removed-and-added and the diff is noise. This
is the opposite of the instinct that a new version gets new everything.

**Data-model gap:** `SNAPSHOT_ROW` and `SNAPSHOT_INGREDIENT_DEF` freeze the formula and its
coefficients. There is no `SNAPSHOT_METHOD_STEP`. A batch that records what was made must
freeze the method too, or it says exactly what went in and nothing about what was done to it.

**Sequencing:** do not fold method into P0.4 — that schema is already gate-failed with 13 P1s
and adding an entity to a design under revision stops it converging. But **design the sheet
as though method exists**, now. Paper is cheap to reprint; uncollected data is gone. Labelled
blank lines capture structured-enough method from the first sheet, and `METHOD_STEP` absorbs
it later. Same logic as decision 20's photograph-don't-parse.

### Reprint is not a concept in this app

There is saving and there is printing. Print-versus-reprint is beyond the app's semantics.
Every print is a print event; two prints are two events. This removes `chain_root`, removes
"reprint must name a `BatchId`", and dissolves the decision 15/16 contradiction rather than
patching it.

### The event log, on Drive

Generalise the proposed print log into a **recipe event log** — `saved`, `printed`,
`batch_recorded`, `deleted`. It buys three things a print log does not: a `deleted` event
**is** a tombstone (issue #21 for free); it supplies the version history the binder's failure
#5 is about; and the nudge becomes a query — *printed events with no `batch_recorded` after
them* — rather than a `nudge_state` to keep consistent across devices.

**Sync constraint, and it is hard.** The log cannot be one file that gets appended to.
Sync is last-write-wins on whole records, so two devices appending means one device's events
are silently overwritten — the silent-clobber class T4 exists to prevent. **One immutable
record per event, individually keyed.** Written once, never updated, so LWW has nothing to
resolve and sync is a union.

This also clears the objection that killed the separate identity store in P0.3. That store
was rejected because identity must stay atomically consistent with the recipe. **Events do
not need that** — an event is a fact about the past, so a partial sync leaves you with fewer
facts, not wrong ones.

Consequence to accept: with immutable events, state changes become new events. Dismissing a
nudge is a `print_dismissed` event, not a field update.

---

## Open questions

1. **Duplex or two simplex pages** — binder economy versus unclip-flip at the bench.
2. **Half-steps on the signed marks scale** — the maintainer wrote 4.5 on a 5-point scale.
3. **Where the churn timeline lives** — a series of time-stamped observations, not a scalar.
4. **Payload format version, byte one** — must be settled before the first sheet prints.
5. **Which event types earn their place** — `saved` on every save may be noise.
6. **Photos portable or local-only** — unchanged, and still load-bearing since decision 20
   makes the photograph the medium for the highest-value fifth of the record.
