# LLM API Integration Research

**Date:** 2026-01-15
**Status:** Research complete, not yet in scope
**Related todos:** `todos/pending/2026-01-15-llm-chat-recipe-*.md`

## Context

Researched browser-based LLM API integration for potential future features (recipe suggestions, troubleshooting chat, ingredient recommendations). Key question: Can we call LLM APIs from a static GitHub Pages site without a backend?

## Key Findings

### The Core Problem: API Key Security

Any API key embedded in client-side JavaScript is extractable by anyone viewing page source or network requests. This is true regardless of obfuscation.

### Provider CORS Support

| Provider | Browser Support | Method |
|----------|----------------|--------|
| **Anthropic Claude** | Yes (opt-in) | Header: `anthropic-dangerous-direct-browser-access: true` |
| **OpenAI** | Blocked by default | `dangerouslyAllowBrowser: true` (not recommended) |
| **Google Gemini** | Limited | CORS issues reported |

Anthropic named it "dangerous" intentionally - embedding API keys in client code is a security anti-pattern.

## Architecture Options

### Option 1: Bring Your Own Key (BYOK)

```
User provides their own API key → stored in localStorage → calls API directly
```

**Pros:** No backend needed, user controls costs, works on GitHub Pages
**Cons:** Requires user to have API account, friction for casual users

**Best for:** Power users, internal tools, personal projects

### Option 2: Cloudflare Workers Proxy

```
Ice Ed → Cloudflare Worker (holds API key) → LLM API
```

**Pros:** API key stays secret, add rate limiting, usage tracking
**Cons:** Extra infrastructure, still pay for LLM API usage

**Free tier:** 100K requests/day, 10ms CPU/request

**Ready-made:** [llm-proxy-on-cloudflare-workers](https://github.com/blue-pen5805/llm-proxy-on-cloudflare-workers)

### Option 3: Cloudflare Workers AI (Built-in Models)

```
Ice Ed → Cloudflare Workers AI (Llama, Mistral, etc.)
```

**Pros:** No external API keys, free tier (10K Neurons/day), low latency
**Cons:** Open-source models less capable than Claude/GPT-4o

**Available models:**
- Llama 3.2 (1B, 3B, 11B vision)
- Mistral Small 3.1 (128K context)
- Qwen 2.5 (up to 72B)

**Best for:** Basic suggestions, simple Q&A, cost-sensitive use cases

### Option 4: Cloudflare AI Gateway

```
Ice Ed → CF AI Gateway → Any LLM API
```

Managed proxy with caching, analytics, single endpoint for multiple providers.

## Recommended Path for Ice Ed

| If you want... | Use... |
|----------------|--------|
| Simple recipe suggestions | Workers AI (Llama 3.2 3B) - free, no external keys |
| High-quality AI features | Worker proxy + Claude API - best quality, costs $ |
| User-controlled AI | BYOK pattern - user provides their own key |

### Implementation Sequence

1. Start with Workers AI for basic features (free)
2. If quality insufficient, add Claude proxy
3. Optionally offer BYOK for power users who want their own keys

## Cloudflare Workers Quick Reference

### Free Tier Limits
- 100,000 requests/day
- 10ms CPU time/request
- Workers KV: 100K reads, 1K writes/day, 1GB storage
- Workers AI: 10,000 Neurons/day

### Setup
```bash
npm create cloudflare@latest my-proxy
cd my-proxy
npx wrangler dev      # local development
npx wrangler deploy   # deploy to workers.dev
npx wrangler secret put API_KEY  # store secrets
```

## Sources

- [Claude API CORS support](https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/)
- [OpenAI CORS discussion](https://community.openai.com/t/cross-origin-resource-sharing-cors/28905)
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Workers AI Models](https://developers.cloudflare.com/workers-ai/models/)
- [LLM Proxy on CF Workers](https://github.com/blue-pen5805/llm-proxy-on-cloudflare-workers)
- [BFF Pattern for API Security](https://blog.gitguardian.com/stop-leaking-api-keys-the-backend-for-frontend-bff-pattern-explained/)

---

*Research conducted 2026-01-15. Update when implementing LLM features.*
