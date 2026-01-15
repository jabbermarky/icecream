---
created: 2026-01-15T10:23
title: Optimize for GitHub Pages deployment
area: tooling
files:
  - index.html
  - package.json
---

## Problem

Currently the app runs locally via Live Server during development. To access it from any computer or tablet, it needs to be hosted somewhere accessible. GitHub Pages is a natural fit since the code is already in a GitHub repo.

Need to ensure the project structure and paths work correctly when served from GitHub Pages.

## Solution

TBD - Consider:

**Structure changes:**
- Ensure all paths are relative (no absolute paths)
- Check ES module imports work with GitHub Pages MIME types
- Verify CDN dependencies (idb library) work in production

**Deployment setup:**
- Configure GitHub Pages in repo settings (main branch or /docs folder)
- Or use GitHub Actions for automated deployment
- Consider if build step is needed (currently no bundler)

**Path considerations:**
- GitHub Pages serves from `username.github.io/repo-name/`
- Base path may need adjustment for assets
- Check if `<base>` tag is needed

**Testing:**
- Test all features work when served from GitHub Pages
- Verify IndexedDB works in GitHub Pages context
- Test on multiple browsers/devices

**Nice to have:**
- Custom domain support
- HTTPS (automatic with GitHub Pages)
- Cache headers for performance
