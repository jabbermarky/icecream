# Ice Ed - Claude Context

## Project Overview
Ice Ed is an ice cream recipe formulation tool. It helps users create balanced ice cream recipes by calculating properties like PAC (freezing point depression), POD (sweetening power), fat content, and more.

## Key Documentation

### Modularization
- **MODULARIZATION_PLAN.md** - Detailed plan for extracting js/app.js into focused modules
- **WORKFLOW.md** - Step-by-step workflow for safe code extraction with testing

### Current Status
- Step 1 complete: Helper functions extracted to `js/utils/helpers.js`
- Next: Steps 2-3 focus on ingredients (JSON data file + module)

## Testing
Run tests before and after any code changes:
```bash
npm test
```

## Tech Stack
- Vanilla JavaScript (ES6 modules)
- HTML/CSS
- Playwright for testing
- USDA FoodData Central API for ingredient data

## gstack (recommended)

This project uses [gstack](https://github.com/garrytan/gstack) for AI-assisted workflows.
Install it for the best experience:

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

Skills like /qa, /ship, /review, /investigate, and /browse become available after install.
Use /browse for all web browsing. Use ~/.claude/skills/gstack/... for gstack file paths.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
