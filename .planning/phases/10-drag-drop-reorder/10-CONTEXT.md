# Phase 10: drag-drop-reorder - Context

**Gathered:** 2026-01-13
**Status:** Ready for planning

<vision>
## How This Should Work

When looking at the recipe ingredient table, each row has a visible grab handle (likely a grip icon on the left side). Users click and hold the handle, then drag the row to reorder ingredients however they want.

The interaction should be obvious — the handle makes it clear where to grab, and the drag-drop just works reliably without glitches.

</vision>

<essential>
## What Must Be Nailed

- **Clear drag handle** — Obvious visual cue on each row showing where to grab for reordering
- **Reliable behavior** — Drag-drop works smoothly without glitches or unexpected behavior

</essential>

<boundaries>
## What's Out of Scope

- Persistence (saving order to recipe) — that's Phase 11
- Touch/mobile support — desktop drag only for now
- Sort button integration — Phase 11 handles the "last action wins" behavior

</boundaries>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for the grab handle icon and drag behavior.

</specifics>

<notes>
## Additional Context

This is visual-only reordering within the current session. When the user reloads or loads a different recipe, any drag ordering is lost. Phase 11 adds persistence.

</notes>

---

*Phase: 10-drag-drop-reorder*
*Context gathered: 2026-01-13*
