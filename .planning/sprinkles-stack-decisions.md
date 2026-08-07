# Stack Decision — Recipe App Rewrite (Sprinkles)

**Written:** 2026-08-07, from a working session that started as "resolve the react/jsx decision" and ended up deciding the full frontend and backend stack, plus the editing/versioning/AI-chat model.
**Revised:** 2026-08-07, after an external architecture review pressure-tested D1–D12. Several decisions changed as a result (D7, D8) and one new foundational decision was added (D13). Where the review's reasoning was rejected, that's noted explicitly rather than silently dropped.
**Revised again:** 2026-08-07 (second review session). D7/D8A refined — optimistic revision checks now apply only to explicit Save, and non-primary devices are viewers by default. New D14 (connectivity + account model) decided: anonymous-first via invisible Supabase account, verified-email gates. Golden-master validation added to D2. Backend consolidation onto Supabase Edge Functions recommended (not yet locked). Kitchen/churn mode requirements captured.
**Read this first if you're picking up implementation.** It captures what's locked, why, and what's still genuinely open.

---

## TL;DR

- **Recipe domain is the durable center.** Calculation, validation, optimization, and command handling live in a framework-independent package (D13). React, Zustand, Hono, and Supabase are replaceable infrastructure around it.
- **Frontend:** React + Vite, client-side only, no meta-framework, no SSR. State management: Zustand, with explicit lifecycle boundaries — persisted version, working draft, ephemeral interaction state (D4).
- **Backend:** Supabase (Postgres + Auth + Row-Level Security) for data and accounts, plus a small Hono service for the LLM proxy and orchestration. Recommended deploy target for Hono: Supabase Edge Functions, keeping the stack on one platform (see Open items — verify limits before locking).
- **Account model:** anonymous-first. First visit silently creates a Supabase anonymous session; all data lives in the one cloud schema from day one. A verified email is required at hard gates (first Save, chat), via the email-conversion flow (`updateUser` + confirmation) — the linking flow itself is the verification (D14).
- **No Python anywhere in the stack.** No CRDT/operational transforms. No full-stack JS meta-framework (SvelteKit/Next/Nuxt/SolidStart).
- **Multi-user model:** editing stays single-owner forever. Sharing (when built) means view/fork/copy, never two people co-editing the same recipe.
- **Concurrency:** optimistic revision check on explicit Save only. The draft-sync channel is last-write-wins with presence; non-primary devices open as viewers by default (D7/D8A, revised twice).
- **Editing model:** a persisted working draft, diverging from the last saved version, visible across the owner's devices via debounced sync, until an explicit Save creates a new immutable version. AI chat (live-editing *and* troubleshooting) is one mechanism, not two — both propose typed, validated commands into the current draft.
- **Kitchen/churn mode:** the mid-churn use case is view + notes + chat. Offline support means cached reads and queued append-only notes — not offline editing (D14).

---

## Why this came up

Two stated problems drove the rewrite: the single-file app was hard to maintain, and there was no central place to store recipes. Neither of those is actually a frontend-framework problem — the maintainability issue was (partly) already being addressed by the existing `.planning/phases/08-extract-models/` modularization of the vanilla-JS codebase, and "central storage" turned out to mean a real backend (auth + database) was needed, which no choice of frontend library provides on its own.

The ~25 existing `.jsx` design mockups (`icecream-*.jsx`) are **design references only** — Claude-artifact-style prototypes, never intended to ship as-is (confirmed: "The JSX files are accidents of how the mockups got drawn"). They mattered to the frontend decision only because reusing their syntax has real value if the framework choice is JSX-compatible — see D3 for how much weight that argument should actually carry.

---

## Decisions locked

**D1 — Client-side interactive computation.** Keep local, browser-side calculation for PAC/POD/freezing-curve and other interactive recalculation — a network round trip per edit would add latency and coupling nothing else in the stack needs. Revised: don't collapse every downstream concern into one hard 16ms number. Input responsiveness, basic derived values, complex calculations, chart/canvas rendering, persistence, and cross-device sync are different requirements with different budgets — only the interactive number-update path (typing a percentage, seeing PAC/POD move) was ever actually required to be sub-frame; chart redraw, save, and sync were never on that clock. Establish the finer-grained budgets by profiling representative recipes rather than assuming one number covers everything.

**D2 — TypeScript calculation engine.** Strong keep. The same recipe engine, in TypeScript, supports interactive calculation, server-side validation, optimization, tests, and AI-proposal simulation. Formalized as its own package in D13 — this decision and that one are the same principle, stated twice for emphasis because it's the one most worth not losing.

*Added (second review):* the port needs a validation harness, not just intent. `balance_engine.py` is the validated oracle (cross-checked against the old app's production output); generate **golden-master test vectors from the Python prototype now** — representative recipes in, full calculated results out — and check them into `recipe-domain`'s test suite before transcribing. The TS port is correct when it reproduces the vectors, not when it looks right.

**D3 — Frontend: React + Vite.** Client-side SPA, no Next.js/Remix/meta-framework, no SSR. Reasoning, in order of weight:
- Dropping the meta-framework layer removes most of what the original "why reconsider React" critique was actually about (hydration, server/client component split, SSR caching) — none of that applies without SSR.
- The app's real complexity (multiple writers into one recipe state, multiple dependent views) is a well-trodden React state-management problem with mature solutions (see D4).
- Largest ecosystem and AI-tooling fluency — real leverage for a solo build.
- Existing JSX mockup reuse is a **secondary, practical factor, not an architectural one** — an external review challenged this as weak, correctly on the architecture axis (design references don't tell you whether React is the right long-term technical choice) but the practical velocity argument still holds: 25 files of syntax-compatible markup is real solo-builder time saved, a different kind of value than the ecosystem argument, not a disqualified one.
- Runner-up: **Solid** — arguably a technically cleaner fit for fine-grained instant recalculation (no vdom diffing), and also JSX-compatible. Passed over for smaller ecosystem and less-trodden state-management patterns.
- **Not yet fully closed:** validate with one representative vertical slice (load a recipe → edit → recalculate → update a chart → maintain a working draft → receive and preview an AI proposal → accept/reject → save a version) before treating D3 as final. If React performs poorly on the actual Sprinkles workflow, reopen against Solid. *The slice now carries a second decision too:* deploy the Hono chat proxy to Supabase Edge Functions within it and measure a real server-orchestrated chat turn — the Edge-Functions-vs-Workers call (see Open items) is made from that data.

**D4 — State management: Zustand, with explicit lifecycle boundaries.** Keep Zustand; the earlier `committed`/`whatIf`/`pendingProposal` naming collapsed three different lifecycle categories into one flat shape. Revised to:
- **Persisted version state** — `baseVersionId`, `baseVersionSnapshot`: the saved, immutable recipe version the current draft is based on (see D11).
- **Working draft state** — `workingDraft`: the current mutable recipe being edited, including current ingredient values, calculated results, and a revision number (see D7).
- **Ephemeral interaction state** — `pendingProposal`, current selection, chat loading state, open panels, temporary errors: transient UI state with no persistence lifecycle at all.

Lifecycle: a saved version becomes the base for editing → a working draft is created from it → direct edits modify the working draft → AI actions create a pending proposal against the working draft → accepting a proposal modifies the working draft → rejecting leaves it unchanged → saving the working draft creates a new immutable version.

Mutations happen **only** through named store actions (`editIngredient()`, `proposeChange()`, `applyProposal()`, `save()`) — never raw `set()` calls from components. This is a convention, not enforced by the library; worth a lint rule.

**D5 — Editing model: draft + explicit apply, replace semantics.**
- Direct edits (typing, dragging) write straight into `workingDraft`, instantly.
- Optimize and chat both produce a `pendingProposal` — a diff computed against the *current* `workingDraft`, shown as a preview, not yet merged.
- **Replace, not compose:** a new chat proposal discards and replaces any existing `pendingProposal` entirely, computed against current `workingDraft`, not the previous rejected proposal.
- **Any direct edit invalidates any pending proposal** — computed against a draft snapshot that no longer exists. Symmetric across Optimize and chat.
- Chat-applied changes route through this **same** pipeline as Optimize — one writer path, not a separate one for each source.
- Treat this as a **V1 simplification, not a permanent invariant.** An AI proposal touching sucrose/cream/SMP while the user independently nudges vanilla by 1g don't inherently conflict, but the current rule discards the whole proposal anyway — acceptable for V1 because it keeps the state machine simple and predictable. Design the proposal format to record which fields/ingredients it touches, so a later version can support field-aware invalidation or proposal rebasing without a rework.

**D6 — Multi-user model: single-owner editing, forever.** No CRDT, no operational transforms — not needed because concurrent co-editing of the same recipe isn't the destination. Sharing with other people **is** the real destination, but takes the form of view/fork/copy — each recipe always has exactly one editor, its owner. Do not add collaboration infrastructure speculatively.

*Added (confirmed 2026-08-07):* `owner_id` is an **ordinary mutable column** — no transfer feature built, but no schema or RLS policy may assume ownership never changes. Costs nothing now; avoids a migration if sharing ever extends to handing off a recipe collection.

**D7 — Concurrency: optimistic revision check on explicit Save only.** *Revised twice.*

The original call was a Postgres-backed session lock (`locked_by`/`locked_at`, heartbeat, timeout). The first review correctly identified that a real pessimistic lock needs acquisition, heartbeats, expiration, crash handling, stale-lock recovery, multi-tab handling, takeover UX, and user messaging — substantial infrastructure for a product with exactly one human owner.

The first revision replaced it with optimistic concurrency on every draft write. The second review then caught that this contradicted D8A: with debounced draft writes flowing continuously from every open device into one revision-guarded row, draft-revision conflicts become a *routine* event in the everyday case (two tabs on one laptop; a laptop left open while the tablet is picked up) — and the rejected-write recovery path ("reload or save as new version") reintroduces the merge problem the design was trying to avoid, one layer down.

Current form — split the two channels' semantics:
- **Explicit Save** (creating a `recipe_versions` row) carries the optimistic revision check: the write is a single conditional update (`expected_revision == current_revision`), rejected on staleness. With one owner and viewer-by-default devices (D8A), genuine Save conflicts are rare, and resolution stays simple: "your other device saved changes since you started this — reload to see the latest, or keep working and save as a new version." No merge UI required.
- **The `recipe_draft` channel is last-write-wins with presence.** Track which device wrote last. A device holding local unsynced edits that receives a Realtime draft update shows "editing continued on another device" and offers take-theirs / keep-mine — a two-button choice, not a merge. This case should itself be rare because of D8A's viewer-by-default posture.

There is no lock anywhere. Any device can always read; only a stale explicit Save is ever rejected.

**D8 — Persistence: explicit immutable versions and an explicit mutable draft.** *Revised.* An external review caught a real gap: if a second device can retrieve the working draft, that draft is not browser-only Zustand state — it's a persisted entity, and it needs to exist explicitly in the data model, not live as an implementation detail of "however Realtime happens to sync Zustand." Two distinct persistence concepts:
- **`recipe_versions`** — immutable. Version ID, full recipe snapshot, creation timestamp, optional parent/source version, optional metadata. Never modified after creation (see D11).
- **`recipe_draft`** — mutable, one per recipe. Recipe ID, base version ID, current snapshot, revision number (see D7), updated timestamp, last-writing device (see D7/D8A).

Zustand holds the browser-side representation of the draft; `recipe_draft` in Supabase is its persisted representation, and what Realtime (D8A) actually subscribes to.

**D8A — Live draft visibility: debounced sync via Supabase Realtime; non-primary devices are viewers by default.** *Revised.*

Two different cross-device requirements are easy to conflate: full live observation (Google-Docs-style, sub-second) versus continuity-on-resume. The explicit ask was between them: *"Would prefer to see the live changes — not live like Google Docs, but latest draft visibility."* The mechanism: persist `recipe_draft` on a debounce (on each applied change, or every few seconds) and subscribe other devices via Supabase Realtime.

The second review resolved the posture question, and the kitchen use case (see D14) confirmed it from the product side — the second device is a *viewer and note-taker*, not an editor:
- **One device at a time holds the editing posture.** Other devices open the recipe in a view mode — rendered read-only, notes panel forward — receiving draft updates live.
- **"Take over editing here" is an explicit action**, not an ambient possibility. Taking over flips the posture; the previous editor becomes a viewer.
- Draft sync exists so a viewer sees the latest draft — not so two editors can interleave writes. This is posture/presence metadata ("last active editor"), not a lock: no heartbeats, no expiry machinery, no takeover negotiation. Any device can always take over; D7's Save-time revision check remains the only hard guard.

Debounce interval is an implementation tuning knob, not an architecture decision — default: 2s after the last applied change, with a 10s maximum between writes while the draft is dirty; finalize during the vertical slice.

**D9 — LLM and the deterministic calculation boundary.** Strong keep, strengthened. The LLM is never authoritative for PAC, POD, freezing point, ingredient totals, nutrition, optimization results, or recipe validity — those stay deterministic, computed by `recipe-domain` (D13), regardless of what triggered the change.

Strengthened with **typed domain commands**, replacing a generic `set(path, value)` mutation surface:
```
setIngredientAmount(id, grams)
addIngredient(id, grams)
removeIngredient(id)
setTargetPAC(value)
setTargetFat(value)
optimizeRecipe(constraints)
```
Typed commands can be schema-validated, domain-validated, logged, tested, simulated, presented to the user, and accepted or rejected individually — a generic path/value setter can't offer any of that. The same command model works for both human and AI actions: a human edit is a command applied directly to the working draft; an AI-proposed command is validated and simulated first, becomes a `pendingProposal`, and only modifies the working draft if accepted.

*Added (second review):* `optimizeRecipe(constraints)` is different in kind from the other commands — it invokes a search algorithm, not a declarative state change. For proposal preview and replay to be deterministic, either the optimizer must be seeded/deterministic, or the command must resolve to its *resulting* concrete commands (`setIngredientAmount(...)`) at proposal time. Prefer the latter: proposals then always contain only declarative commands.

**Rate limiting shape** *(confirmed 2026-08-07)*: a **per-user daily budget enforced in Hono** — check a small usage table before each chat turn, record consumption after, refuse at the cap with a friendly "you've hit today's limit." Chat already requires a verified user (D14c), so the identity to meter on always exists. Specific numbers are tuned once real cost data exists; the usage table is part of the initial Hono schema so the vertical slice builds against it.

**Where the chat tool-execution loop runs:** server-side orchestration, client-side simulation. Hono owns LLM credentials, model selection, auth, rate limits, tool definitions, conversation orchestration, and auditing — it never directly mutates a recipe. The browser receives the LLM's proposed typed commands from Hono, validates and simulates them locally using `recipe-domain` (the same package already trusted to compute PAC/POD for direct edits — no new trust boundary crossed), and builds the `pendingProposal` from the result. This reuses D5's pipeline exactly; Optimize and chat both ultimately produce the same shape of proposal.

**D10 — LLM API key never touches the client.** Confirmed by the January research (`.planning/RESEARCH-LLM-INTEGRATION.md`): any key embedded in client JS is extractable regardless of obfuscation. That research was scoped around avoiding a backend entirely (BYOK, Workers AI free tier) because at the time there was no other reason to run one. That framing is now obsolete — a full backend is being built anyway for auth and storage (D8), so the LLM proxy is one more responsibility of it. BYOK is a poor fit regardless, since chat is meant to be a central feature, not a power-user opt-in.

**D11 — Save creates an immutable version; it is not continuous autosave.** Save means "mark this as a version I'm happy with" — tied to a real-world batch ("churn"), and the anchor that feedback and troubleshooting attach to. `recipe_versions` (D8): one row per explicit Save, a full snapshot at that moment. `feedback` and `troubleshooting_session` records reference a specific `version_id`, not just the recipe — the workflow (edit → save → churn → troubleshoot → edit → save...) depends on pointing at exactly the version that produced a given real-world result. Immutable versions also provide rollback, comparison, AI context, and debugging history for free. Much smaller than full event-sourcing — this logs only explicit Saves, roughly once per batch, not every keystroke.

**D12 — Troubleshooting chat is the same feature as editing chat, entered from a different starting point.** No separate troubleshooting mode or pipeline. A troubleshooting session forks a new working draft from the **specific saved version the feedback is attached to** (`recipe_versions[N]`, not necessarily whatever is currently live), seeds the chat with that version's snapshot plus the feedback text, and from there it's D5/D9 unchanged: the model proposes typed commands, they're simulated client-side, the user reviews and applies. "Current recipe state" must mean the version tied to the feedback, not whatever the working draft happens to hold when the chat opens.

**D13 — Recipe domain as an explicit, framework-independent package.** *The largest gap the first review found in the original decision set.* React, Zustand, Hono, and Supabase are infrastructure choices; the durable product asset is the Sprinkles recipe domain itself, and it deserves to be named as its own architectural decision, not left implicit inside D2. Recommended structure:

```
/packages/recipe-domain
  ingredients.ts
  recipe.ts
  calculations.ts
  optimize.ts
  commands.ts
  validation.ts
/apps/web   — React + Zustand
/apps/api   — Hono + server-side integrations
```

**Dependency rule:** `recipe-domain` must not import React, Zustand, Hono, Supabase, or any LLM library. Everything else may depend on it; it depends on nothing else in the stack. Success criterion for this boundary actually holding: all recipe calculation, validation, optimization, and command handling can run — and be tested — with none of those four present. This is what makes React, Zustand, and Supabase individually replaceable later without touching the thing that actually is Sprinkles: the recipe representation, calculation logic, ingredient model, optimization logic, validation, editing semantics, and AI action semantics.

*Added (second review):* define a thin repository interface (e.g. `RecipeStore`) between the app and persistence, typed against domain entities. Today it has one implementation (Supabase); it keeps D13's replaceability claim honest and gives the legacy-import path (D14) a door to walk through.

**D14 — Connectivity and account model: cloud-first, anonymous-first, verified-email gates.** *New (second review).* The original decision set silently inverted the shipped app's model (local-first, no accounts, static page) into cloud-first without deciding it. Decided deliberately now, in four parts:

**(a) Seed ingredient data is app content, not user data.** The curated ingredient DB (the merged seed + legacy set) ships as a static, versioned JSON asset bundled with the app: service-worker cached, available offline, zero DB reads; updating it is a deploy, which for this project is a git push either way. Recipes reference ingredients by stable ID. Only user-created custom ingredients are user data, stored with recipes.

**(b) Anonymous-first via invisible account.** First visit silently creates a Supabase anonymous session (`signInAnonymously()`); all user data lives in the one cloud schema from day one. Creating a real account later is `updateUser({ email })` plus the email-confirmation round trip — *verified 2026-08-07: the user ID stays the same and all rows carry over; note `linkIdentity()` is for OAuth identities only (and requires the manual-linking project setting), while email conversion goes through `updateUser`.* The rows never move. This was chosen over a dual local/cloud storage tier (full IndexedDB mirror + import-on-sign-in) primarily because it keeps exactly one persistence surface for a solo maintainer, and because anonymous users hold JWTs and are therefore rate-limitable. Consequences accepted: the cloud is load-bearing for everything (see pausing note in Verify), and anonymous rows need a cleanup policy.

**Cleanup policy** *(confirmed 2026-08-07)*: never-linked anonymous accounts and their data are deleted after **30 days of inactivity** (scheduled job — Supabase has no automatic cleanup; run SQL on a schedule, e.g. pg_cron, which matches Supabase's own documented hygiene guidance). The stakes are bounded by the gates: anonymous users can't create versions, so what's deletable is only scratch drafts, notes, and custom ingredients their owner never once tried to keep. Part of the decision: the client must handle "my session no longer exists" by silently provisioning a fresh anonymous session — never an error screen.

**Abuse protection** *(added after verification, 2026-08-07)*: `signInAnonymously()` is an open endpoint that writes rows — Supabase strongly recommends CAPTCHA on it, and this design treats that as **required, not optional**: enable invisible CAPTCHA (Cloudflare Turnstile) on anonymous sign-ins so bots can't bloat `auth.users`. The default IP-based rate limit is 30 sign-ins/hour (adjustable).

**Free-tier pausing** *(verified 2026-08-07 — worse than assumed)*: free projects pause after **7 days without API activity**, and this app's usage is episodic, so an unmitigated free tier means the app is down almost every time anyone returns. Data survives a pause; one-click restore works for 90 days; after 90 days paused the infrastructure (including the project's unique API URL) is released and restoring is manual; beyond ~1 year, gone. Posture: during development, free tier plus a scheduled keep-alive ping (e.g. a weekly GitHub Actions cron hitting a lightweight endpoint) is sufficient — a silent keep-alive failure degrades to a visible pause with a 90-day recovery window, acceptable pre-launch. **The launch decision — keep-alive vs. Supabase Pro — is an open item.**

**(c) Verified email at hard gates.** *Confirmed 2026-08-07.* Requiring email at first launch would collapse this back into mandatory accounts — the gates go at trigger points instead. Constraint acknowledged: instant start, guaranteed recoverability, and never interrupting the user can't all three hold; recoverability wins at moments of commitment.

Note the gate protects the *key*, not the data: under (b) an anonymous user's work is already cloud-persisted from the first edit — what's fragile is the anonymous session token in browser storage. This is not hypothetical on iOS: Safari's ITP can purge script-writable storage (localStorage/IndexedDB) after ~7 days without a site visit, and this app's usage is episodic — on the platform the kitchen tablet most likely runs, weeks-long anonymous grace periods may not technically exist. (Home-screen PWA installs change this behavior — see Verify.)

- **First explicit Save → hard gate.** D11 defines Save as a deliberate ceremony tied to a real batch; "add an email so this survives your browser" is congruent with that moment. Everything before first Save is frictionless and anonymous.
- **Chat → hard gate, no exceptions.** Cost defense, not UX: anonymous JWTs are free to farm (clear storage → new identity → fresh quota), so any pre-verification chat allowance is an open tap on the API key. Verified email is the cheapest real meter.
- **Second device / sync → inherently gated** (can't sign in elsewhere without credentials).
- Implementation is nearly free: the email conversion flow (`updateUser({ email })` + confirmation email) *is* verification — proof of inbox possession by construction. Rate limits to design around: one magic link per 60s per user, links expire after 1 hour.

Three design commitments are part of this decision, not polish:
1. **Magic link only, no password** — the gate is a single email field.
2. **Editing is never blocked** — cancel the gate and the draft keeps working and persisting; only marking a version (and chat) requires the email. The wall blocks commitment, never work.
3. **The copy tells the truth** — "so your recipes aren't tied to this browser," not account-marketing language.

**Nag policy outside the gates — risk-triggered prompt only.** *Confirmed 2026-08-07.* Anonymity is a grace period ending at commitment, silent until risk. No ambient banners: the casual calculator user never sees identity UI at all. The one loss scenario the gates structurally can't catch is the *perpetual tinkerer* — someone editing a draft across sessions for weeks without churning, whose cloud-persisted work is keyed to a purgeable anonymous session. For that case only: when a user returns in a later session to a non-trivial unsaved draft, show one dismissible prompt ("this work-in-progress is tied to this browser — add an email to keep it"). It fires only when unprotected work actually exists. "Non-trivial" threshold (edit count / draft age) to be tuned at implementation.

**(d) Kitchen/churn mode: cached reads + queued notes, not offline editing.** The mid-churn use case is constrained (confirmed): viewing a recipe, taking notes, possibly asking chat questions. None of those touch `recipe_draft` — the churned version is immutable (D11), notes are `feedback` rows anchored to a `version_id`, and chat needs the network by physics regardless of architecture. Offline requirements are therefore exactly:
1. App opens and shows the recipe without network — PWA with service-worker-cached shell plus locally cached recently-viewed versions.
2. Notes capture locally and sync later — append-only records attached to a version ID are conflict-free by construction; queue and flush.
3. Chat degrades honestly — offline indicator; the note field is the capture path ("jot it now, ask later").

No offline editing, no offline draft writes, no local-first architecture. The kitchen view doubles as D8A's viewer posture: read-only, notes forward, big type for wet hands.

*Added after verification (2026-08-07):* in plain Safari, ITP's 7-day purge takes the service-worker cache too — the offline capability itself, not just the anonymous session. Consequences:
- **The kitchen tablet's supported posture is a home-screen install** — home-screen web apps are exempt from the ITP cap and their storage is isolated from Safari. iOS never prompts for installation, so the app should show an "add to home screen for kitchen use" nudge on iOS (Share → Add to Home Screen).
- **Call `navigator.storage.persist()` at startup** where available — honored heuristically on Chrome/Android, best-effort on iOS, costs one line.
- **Treat the offline cache as best-effort everywhere.** It caches cloud-persisted data, so eviction costs a reload-when-online, never data loss. Queued-but-unflushed kitchen notes are the one thing at genuine risk in an evicted cache — flush the queue eagerly, the moment connectivity allows, not on a timer.

**(e) Legacy migration.** Old-app recipes (IndexedDB / Google Drive sync) come in through an explicit import path: export-to-file in the old app, import into the new schema through the repository interface. Google Drive sync and Drive-based identity do not carry forward. Build the import door once; it serves both legacy migration and any future bulk-import need.

---

## Explicitly evaluated and not needed

- **CRDT / operational transforms** — solves concurrent co-editing, which isn't the product (D6).
- **Python anywhere in the stack** — neither the deterministic formulas nor the Optimize algorithm need it (D2); LLM API calls are backend-language-agnostic. The Python prototype's remaining job is generating golden-master test vectors (D2), then it retires.
- **A unified full-stack JS meta-framework** (SvelteKit/Next/Nuxt/SolidStart) — no unification benefit to capture once the backend is deliberately decoupled (D8).
- **Cloudflare Durable Objects** for concurrency — and pessimistic session locking generally — both solve a coordination problem at a scale (many users, high write contention, or infrastructure-grade single-writer enforcement) this product doesn't have. Save-only optimistic concurrency plus viewer-by-default posture (D7/D8A) covers the actual case for a fraction of the complexity.
- **Optimistic revision checks on every draft write** — the first revision of D7; contradicted D8A's continuous debounced writes and made conflicts routine instead of rare. Replaced by Save-only checks + last-write-wins draft channel.
- **A dual local/cloud storage tier for anonymous users** — full IndexedDB mirror with import-on-sign-in. Rejected in favor of the invisible-account model (D14b): one persistence surface instead of two that must stay schema-identical forever.
- **Full event-sourcing / per-keystroke journaling** — has real standalone value (undo-to-any-point, free attribution) but isn't required by the concurrency model. What *is* needed — versioned Saves — is a much smaller mechanism (D11), not this.
- **A separate troubleshooting-chat pipeline** — same mechanism as editing chat, different fork source (D12).
- **A generic `set(path, value)` mutation surface for AI actions** — replaced by typed domain commands (D9), which are the only thing that makes schema validation, testing, and simulation possible.

---

## Open — not yet decided

- **Hono deploy target: Supabase Edge Functions vs. standalone Cloudflare Workers.** *Limits verified 2026-08-07; decision deliberately deferred to the D3 vertical slice.* The facts: Edge Functions allow 150s to first response byte (free and paid; 504 after), ~400s total wall clock on paid (free historically capped at 150s total); CPU caps are low but irrelevant for an I/O-bound LLM proxy; streaming is supported. Workers have no duration limit at all (10ms CPU free / 30s CPU on the $5/mo tier). Both handle the realistic chat workload — so the call rides on consolidation (Edge Functions: one platform, same JWT, no extra CORS origin) vs. streaming headroom + cheaper paid footprint if Supabase stays on free tier (Workers). **Decision: build the vertical slice with the Hono service on Edge Functions and measure a real server-orchestrated chat turn against the limits; fall back to Workers only if the data says so.** Regardless of target, the chat endpoint **opens its SSE stream immediately and emits progress events during orchestration** — needed for UX anyway, and it satisfies the 150s time-to-first-byte clock. Cost interplay to keep in view: if free-tier pausing forces Supabase Pro anyway, consolidation is free; if a keep-alive avoids Pro, free-Supabase + $5 Workers is the cheaper paid footprint.
- **Permission check on the chat "apply" action.** It goes through the same write path as a direct edit, so it needs the same owner-only gate. Easy to miss when building the command-simulation layer — flagging so it isn't. (Implementation reminder, not a decision.)
- **Take-over-editing UX details** (D8A) — the mechanism (presence metadata, explicit takeover, keep-mine/take-theirs on the rare divergence) is decided; the exact screens aren't designed. (Design work, not a stack decision.)
- **LLM budget numbers** — the shape is decided (D9: per-user daily budget in Hono); the specific caps are tuned once real cost data exists.
- **Pausing mitigation at launch** — free tier + keep-alive cron vs. Supabase Pro (~$25/mo). Free + weekly keep-alive is the decided dev-time posture (D14b); the launch call also interacts with the Hono deploy target's cost interplay and with how much a silent keep-alive failure would matter once real users exist.

---

## Verify before treating this as final

- ~~Supabase anonymous sign-in + email conversion~~ — **verified 2026-08-07.** Anonymous → permanent keeps the same user ID; all rows carry over. Email conversion is `updateUser({ email })` + confirmation (not `linkIdentity()`, which is OAuth-only and needs the manual-linking setting). No automatic anon cleanup exists — scheduled SQL required. CAPTCHA on anonymous sign-ins strongly recommended (adopted as required, D14b). Residual spot-check at implementation: exact `updateUser` confirmation UX in the current JS SDK.
- ~~Safari ITP storage purge rules and PWA exemption~~ — **verified 2026-08-07.** Confirmed and slightly worse than assumed: ITP deletes *all* script-writable storage (localStorage, IndexedDB, **service-worker registrations and cache**) after 7 days of Safari use without visiting the site — so in plain Safari, both the anonymous session *and the offline kitchen cache itself* are on the 7-day clock. Home-screen web apps are exempt from the ITP cap (their storage is isolated from Safari and skipped by the removal algorithm), but iOS storage remains best-effort under device storage pressure; `navigator.storage.persist()` is supported from Safari 17 but is not a guarantee on iOS. Design consequences recorded in D14d.
- ~~Supabase free-tier project pausing~~ — **verified 2026-08-07: pauses after 7 days without API activity** (findings and posture recorded in D14b). Dev-time answer: keep-alive cron. Launch decision (keep-alive vs. Pro) moved to Open items.
- **Supabase Edge Function limits** — headline numbers verified 2026-08-07 (150s TTFB, ~400s wall clock paid, low CPU caps) via search results and GitHub discussions; the primary docs page was unreachable from the review environment, so spot-check `supabase.com/docs/guides/functions/limits` once before implementation.
- **Supabase RLS behavior and Realtime** (including RLS × Realtime interaction) — stated from general knowledge of both projects, not verified against this codebase.
- **Kitchen wifi reality check.** If chat-while-churning is a headline feature, kitchen connectivity is a hard dependency no stack choice can compensate for. Check signal where the churning machine actually lives before budgeting the chat-in-kitchen experience.
- `.planning/codebase/STACK.md` is dated 2026-01-13 — confirm nothing has drifted (framework additions, build step) before assuming vanilla JS is still accurate today.
- Confirm `js/features/recipe-manager.js` still contains `OptimizeRecipe()` as a hill-climbing implementation (D2 rests on that).
- Cloudflare specifics in `RESEARCH-LLM-INTEGRATION.md` (free tier limits, CORS support table) are from January 2026 — re-check before relying on exact numbers if the Hono service ever does deploy to Workers.
- D3's "verify with a representative vertical slice" is unfinished — treat React as the default candidate, not a fully closed decision, until that spike runs.

---

## Doc map

- This file (`.planning/sprinkles-stack-decisions.md`) — architecture decisions.
- `sprinkles-phase3-handoff.md` — ingredients library UI/UX, a parallel design track *(lives outside this repo)*.
- `.planning/codebase/STACK.md` — current (as of Jan 2026) production stack, vanilla JS.
- `.planning/RESEARCH-LLM-INTEGRATION.md` — prior LLM-integration research; partially superseded by D10 above (the backend-avoidance framing no longer applies), but the provider CORS/proxy findings are still relevant background.
- `.planning/todos/pending/2026-01-15-llm-chat-recipe-research.md` / `-troubleshooting.md` — the original feature todos that D12 unifies into one mechanism.
- `icecream-*.jsx` — design mockups, reference only, not shipping code *(live outside this repo)*.
