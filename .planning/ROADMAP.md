# Ice Ed - Roadmap

**Project:** Ice Ed ice cream recipe formulation tool

## Milestones

- ✅ **v1.0 Modularization** - [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) (Phases 7-9, shipped 2026-01-13)
- ✅ **v1.1 Recipe Organization** - [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) (Phases 10-11, shipped 2026-01-13)
- 🚧 **v1.2 Recipe Library** - Phases 12-15 (in progress)

## Phases

<details>
<summary>✅ v1.1 Recipe Organization (Phases 10-11) — SHIPPED 2026-01-13</summary>

**Milestone Goal:** Give users control over ingredient display order in recipes

- [x] Phase 10: drag-drop-reorder (1/1 plans) — 2026-01-13
- [x] Phase 11: order-persistence (1/1 plans) — 2026-01-13

See [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) for full details.

</details>

### 🚧 v1.2 Recipe Library (In Progress)

**Milestone Goal:** Move from download/upload file mechanics to a proper recipe library with local storage, architected for future cloud sync

#### Phase 12: storage-interface ✅

**Goal**: Create pluggable storage interface with IndexedDB implementation
**Depends on**: Phase 11 (previous milestone complete)
**Status**: Complete (2026-01-14)

Plans:
- [x] 12-01: Storage interface and IndexedDB implementation

#### Phase 13: recipe-library-ui ✅

**Goal**: Build recipe library UI with list view, load, and delete functionality
**Depends on**: Phase 12
**Status**: Complete (2026-01-14)

Plans:
- [x] 13-01: Recipe library UI module and button
- [x] 13-02: Load/delete functionality with tests

#### Phase 14: save-workflow ✅

**Goal**: Integrate save workflow to save to library instead of download
**Depends on**: Phase 13
**Status**: Complete (2026-01-14)

Plans:
- [x] 14-01: Save workflow integration (save to library, export to file)

#### Phase 15: polish

**Goal**: Polish and handle edge cases for the recipe library feature
**Depends on**: Phase 14
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Plans:
- [ ] 15-01: TBD

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 10. drag-drop-reorder | v1.1 | 1/1 | Complete | 2026-01-13 |
| 11. order-persistence | v1.1 | 1/1 | Complete | 2026-01-13 |
| 12. storage-interface | v1.2 | 1/1 | Complete | 2026-01-14 |
| 13. recipe-library-ui | v1.2 | 2/2 | Complete | 2026-01-14 |
| 14. save-workflow | v1.2 | 1/1 | Complete | 2026-01-14 |
| 15. polish | v1.2 | 0/? | Not started | - |

## References

- `MODULARIZATION_PLAN.md` - Detailed extraction strategy
- `WORKFLOW.md` - Testing workflow
- `.planning/codebase/` - Codebase analysis
- `.planning/STRICT-MODE-AUDIT.md` - Strict mode compatibility checklist
- `.planning/ISSUES.md` - Deferred issues log
