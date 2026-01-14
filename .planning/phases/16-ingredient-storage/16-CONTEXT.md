# Phase 16: ingredient-storage - Context

**Gathered:** 2026-01-14
**Status:** Ready for research

<vision>
## How This Should Work

When the app starts for the first time (no library yet), bootstrap the library with the built-in ingredient list from the JSON file that ships with the app. Once there is a library, all new recipes start with the library ingredient list - this becomes the user's preferred/customized ingredient list.

When the user goes to the Ingredients List tab, they are editing the ingredients list for both:
1. The current loaded recipe
2. What is stored in the library

Each recipe file contains its own list of ingredients. When a recipe is loaded, attempt to merge/sync the ingredient list in the recipe with the current library ingredient list.

The experience should be seamless - users don't notice the change, their custom ingredients just persist automatically. The library becomes the single source of truth.

</vision>

<essential>
## What Must Be Nailed

- **Persistence works reliably** - Custom ingredients survive browser sessions without data loss
- **Seamless experience** - Users don't notice the change, it just works better
- **Library as source of truth** - Clear mental model: library IS the ingredient list
- **All ingredient fields captured** - Must store complete ingredient schema to handle field evolution

</essential>

<boundaries>
## What's Out of Scope

- UI for conflict resolution - no new dialogs asking user to resolve differences (use existing behavior)
- This phase focuses on storage infrastructure, not the sync/merge logic (Phase 17-18)

</boundaries>

<specifics>
## Specific Ideas

- **Use existing merge behavior** - The app already handles merging when loading recipes; investigate and preserve that logic
- **Schema evolution** - Old recipes may have ingredients with fewer fields than current library (e.g., new field added). Merge must handle this gracefully - a primary reason for conflicts
- **Bootstrap once** - First run seeds library from JSON, subsequent runs use library exclusively

</specifics>

<notes>
## Additional Context

The existing app already does some level of merging. If an existing recipe is open in the editor and another recipe is loaded from file, the ingredient lists are synced/merged. This behavior should be investigated during research phase and leveraged.

Key investigation needed:
- How are ingredients currently loaded? (default JSON path)
- Where does merge happen when loading recipes?
- What fields exist on ingredients currently?
- How are ingredient modifications tracked?

</notes>

---

*Phase: 16-ingredient-storage*
*Context gathered: 2026-01-14*
