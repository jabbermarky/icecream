# Ice Ed - Roadmap

**Project:** Ice Ed ice cream recipe formulation tool

## Milestones

- ✅ **v1.0 Modularization** - [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) (Phases 7-9, shipped 2026-01-13)
- ✅ **v1.1 Recipe Organization** - Phases 10-11 (shipped 2026-01-13)

## Phases

### ✅ v1.1 Recipe Organization (Complete)

**Milestone Goal:** Give users control over ingredient display order in recipes

#### Phase 10: drag-drop-reorder

**Goal**: Implement drag-drop UI for table rows (visual reordering)
**Depends on**: v1.0 complete
**Research**: Unlikely (HTML5 drag-drop is established, internal UI patterns)
**Plans**: 1

Plans:
- [x] 10-01: Drag-drop UI implementation

#### Phase 11: order-persistence

**Goal**: Persist order in recipe data structure and file format, sort button integration
**Depends on**: Phase 10
**Research**: Unlikely (internal data structure work)
**Plans**: 1

Plans:
- [x] 11-01: Sort indicator clearing, order persistence test

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 10. drag-drop-reorder | v1.1 | 1/1 | Complete | 2026-01-13 |
| 11. order-persistence | v1.1 | 1/1 | Complete | 2026-01-13 |

## References

- `MODULARIZATION_PLAN.md` - Detailed extraction strategy
- `WORKFLOW.md` - Testing workflow
- `.planning/codebase/` - Codebase analysis
- `.planning/STRICT-MODE-AUDIT.md` - Strict mode compatibility checklist
- `.planning/ISSUES.md` - Deferred issues log
