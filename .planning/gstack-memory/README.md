# gstack memory (durable copy)

gstack stores its accumulated knowledge in `~/.gstack/projects/<slug>/`. In
Claude Code on the web that directory is **container-local**: it is destroyed
when the session's container is reclaimed, and `artifacts_sync_mode` is `off` by
default. Everything gstack learned about this repo was therefore being discarded
at the end of every session, so each new session started cold and re-derived the
same findings.

This directory is the durable copy, committed to the repository. The
`SessionStart` hook (`.claude/hooks/session-start.sh`) restores it into
`~/.gstack/projects/jabbermarky-icecream/` on session start, so the knowledge
compounds instead of evaporating.

## Contents

| File | What it is |
| --- | --- |
| `learnings.jsonl` | Non-obvious findings about this codebase. The highest-value file here. |
| `decisions.jsonl` | Durable architecture/scope decisions with rationale, so a future session does not silently re-litigate them. |
| `decisions.active.json` | gstack's index over the above. |
| `tasks-eng-review.jsonl` | Build-actionable tasks from `/plan-eng-review`, consumed by `/autoplan`. |
| `eng-review-test-plan.md` | What to test and where. Consumed by `/qa` and `/qa-only`. |
| `question-log.jsonl` | Decision-brief history, used by `/plan-tune`. |
| `timeline.jsonl` | Which skills ran on which branch. |
| `reviews/*.jsonl` | Every review that has run, per branch. `/ship`'s readiness gate reads these — without them a fresh session believes nothing has ever been reviewed. |
| `*-ship-test-plan-*.md` | Test plans emitted by `/ship`. |

### About the review filenames

gstack derives the review-log filename from the branch name and mangles
branches containing a slash — `claude/batch-loop-design` has produced both
`claudebatch-loop-design-reviews.jsonl` and
`claude-batch-loop-design-reviews.jsonl` in the same repo. The restore therefore
copies **whatever names are present** rather than reconstructing one, and
`gstack-review-read` is what should be used to query them.

## Keeping it current

This is a snapshot, not a live mirror. After a session that produces new
learnings or decisions, refresh it:

```bash
GS=~/.gstack/projects/jabbermarky-icecream
cp "$GS"/{learnings,decisions,question-log,timeline}.jsonl .planning/gstack-memory/
cp "$GS"/decisions.active.json .planning/gstack-memory/
mkdir -p .planning/gstack-memory/reviews
cp "$GS"/*reviews.jsonl .planning/gstack-memory/reviews/
cp "$GS"/*test-plan*.md .planning/gstack-memory/ 2>/dev/null
```

Then commit. The restore is append-safe: the hook only writes files that are
absent, so it never clobbers a session's newer state.

## The alternative

`gstack-artifacts-init` makes `~/.gstack` itself a git repo that syncs to a
private remote, covering every project rather than just this one. That is the
better answer if you use gstack across several repositories. This directory is
the zero-setup version that works today and keeps the knowledge next to the code
it describes.
