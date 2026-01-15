# Ice Ed - Roadmap

**Project:** Ice Ed ice cream recipe formulation tool

## Milestones

- ✅ **v1.0 Modularization** - [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) (Phases 7-9, shipped 2026-01-13)
- ✅ **v1.1 Recipe Organization** - [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) (Phases 10-11, shipped 2026-01-13)
- ✅ **v1.2 Recipe Library** - [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) (Phases 12-15, shipped 2026-01-14)
- ✅ **v1.3 Ingredient Persistence** - [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) (Phases 16-18, shipped 2026-01-15)
- 🚧 **v1.4 Multi-Device Access** - Phases 19-20 (in progress)

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

<details>
<summary>✅ v1.3 Ingredient Persistence (Phases 16-18) — SHIPPED 2026-01-15</summary>

**Milestone Goal:** Persist master ingredient list in IndexedDB so custom ingredients survive browser sessions

- [x] Phase 16: ingredient-storage (1/1 plans) — 2026-01-15
- [x] Phase 17: ingredient-sync (1/1 plans) — 2026-01-15
- [x] Phase 18: recipe-ingredient-merge (1/1 plans) — 2026-01-15

See [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) for full details.

</details>

### 🚧 v1.4 Multi-Device Access (In Progress)

**Milestone Goal:** Deploy to GitHub Pages with Google Drive sync so the app and data are accessible from any device/browser

**Why this milestone:** Enable regular app usage. Without deployment + cloud sync, data is trapped in one browser on one device.

**Key context:**
- App currently only works locally via Live Server
- IndexedDB data is trapped in one browser on one device
- Storage interface pattern from v1.2 enables pluggable backends

#### Phase 19: github-pages-deployment

**Goal**: Deploy app to GitHub Pages, ensure all paths and modules work in production
**Depends on**: None
**Status**: Not started

Plans: TBD

#### Phase 20: cloud-sync-google-drive

**Goal**: Implement Google Drive storage backend for recipes and ingredients with sync
**Depends on**: Phase 19 (need deployed app to test OAuth redirect)
**Research**: Google Drive API, OAuth 2.0 flow for SPAs
**Status**: Not started

Plans: TBD

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
| 18. recipe-ingredient-merge | v1.3 | 1/1 | Complete | 2026-01-15 |
| 19. github-pages-deployment | v1.4 | TBD | Not started | - |
| 20. cloud-sync-google-drive | v1.4 | TBD | Not started | - |

## References

- `MODULARIZATION_PLAN.md` - Detailed extraction strategy
- `WORKFLOW.md` - Testing workflow
- `.planning/codebase/` - Codebase analysis
- `.planning/STRICT-MODE-AUDIT.md` - Strict mode compatibility checklist
- `.planning/ISSUES.md` - Deferred issues log
