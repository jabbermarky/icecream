# Ice Ed - Roadmap

**Project:** Ice Ed ice cream recipe formulation tool

## Milestones

- ✅ **v1.0 Modularization** - [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) (Phases 7-9, shipped 2026-01-13)
- ✅ **v1.1 Recipe Organization** - [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) (Phases 10-11, shipped 2026-01-13)
- ✅ **v1.2 Recipe Library** - [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) (Phases 12-15, shipped 2026-01-14)
- 🚧 **v1.3 Ingredient Persistence** - Phases 16-18 (in progress)

## Phases

<details>
<summary>✅ v1.1 Recipe Organization (Phases 10-11) — SHIPPED 2026-01-13</summary>

**Milestone Goal:** Give users control over ingredient display order in recipes

- [x] Phase 10: drag-drop-reorder (1/1 plans) — 2026-01-13
- [x] Phase 11: order-persistence (1/1 plans) — 2026-01-13

See [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) for full details.

</details>

<details>
<summary>✅ v1.2 Recipe Library (Phases 12-15) — SHIPPED 2026-01-14</summary>

**Milestone Goal:** Move from download/upload file mechanics to a proper recipe library with local storage, architected for future cloud sync

- [x] Phase 12: storage-interface (1/1 plans) — 2026-01-14
- [x] Phase 13: recipe-library-ui (2/2 plans) — 2026-01-14
- [x] Phase 14: save-workflow (1/1 plans) — 2026-01-14
- [x] Phase 15: polish (1/1 plans) — 2026-01-14

See [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) for full details.

</details>

### 🚧 v1.3 Ingredient Persistence (In Progress)

**Milestone Goal:** Persist master ingredient list in IndexedDB so custom ingredients survive browser sessions

**Key context:**
- App has default ingredient list (JSON) used for first recipe / new recipes
- Once library ingredients exist, they become the master list for new recipes
- Existing merge behavior when loading recipes needs investigation

#### Phase 16: ingredient-storage

**Goal**: Add ingredients store to IndexedDB, load library ingredients on startup (fall back to default JSON)
**Depends on**: Phase 15 (v1.2 complete)
**Status**: Complete

Plans:
- [x] 16-01: Ingredient storage infrastructure (2026-01-15)

#### Phase 17: ingredient-sync

**Goal**: Auto-sync ingredient changes to storage when user modifies ingredients
**Depends on**: Phase 16
**Research**: None needed (followed established patterns)
**Status**: Complete

Plans:
- [x] 17-01: Ingredient sync implementation (2026-01-15)

#### Phase 18: recipe-ingredient-merge

**Goal**: Handle ingredient conflicts when loading recipes (leverage existing merge behavior)
**Depends on**: Phase 17
**Research**: Likely (UX decision on conflict handling)
**Status**: Not started

Plans:
- [ ] 18-01: TBD

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 10. drag-drop-reorder | v1.1 | 1/1 | Complete | 2026-01-13 |
| 11. order-persistence | v1.1 | 1/1 | Complete | 2026-01-13 |
| 12. storage-interface | v1.2 | 1/1 | Complete | 2026-01-14 |
| 13. recipe-library-ui | v1.2 | 2/2 | Complete | 2026-01-14 |
| 14. save-workflow | v1.2 | 1/1 | Complete | 2026-01-14 |
| 15. polish | v1.2 | 1/1 | Complete | 2026-01-14 |
| 16. ingredient-storage | v1.3 | 1/1 | Complete | 2026-01-15 |
| 17. ingredient-sync | v1.3 | 1/1 | Complete | 2026-01-15 |
| 18. recipe-ingredient-merge | v1.3 | 0/? | Not started | - |

## References

- `MODULARIZATION_PLAN.md` - Detailed extraction strategy
- `WORKFLOW.md` - Testing workflow
- `.planning/codebase/` - Codebase analysis
- `.planning/STRICT-MODE-AUDIT.md` - Strict mode compatibility checklist
- `.planning/ISSUES.md` - Deferred issues log
