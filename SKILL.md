---
name: hyperstack
description: "Typed graph memory for multi-agent coordination. Replace GOALS.md + DECISIONS.md with queryable cards and relations. Ask 'what blocks task X?' and get exact answers, not text blobs."
user-invocable: true
homepage: https://cascadeai.dev/hyperstack
metadata:
  openclaw:
    emoji: "🃏"
    requires:
      env:
        - HYPERSTACK_API_KEY
    primaryEnv: HYPERSTACK_API_KEY
---

# HyperStack — Typed Graph Memory for Multi-Agent Coordination

## What this does

Replaces markdown-file coordination (GOALS.md, DECISIONS.md, WORKING.md) with a typed knowledge graph that any agent can query.

**Before** (current OpenClaw multi-agent):
```
# DECISIONS.md (append-only)
- 2026-02-15: Use Clerk for auth (coder-agent)
- 2026-02-16: Migration blocks production deploy (ops-agent)
```
"What blocks deploy?" → `grep -r "blocks.*deploy" *.md` → manual, fragile

**After** (HyperStack):
```
"What blocks deploy?" → hs_blockers deploy-prod → [migration-23] Auth migration to Clerk
```

Typed relations. Exact answers. Zero LLM cost.

## Tools

### hs_search
Search the shared knowledge graph.
```
hs_search({ query: "authentication setup" })
```

### hs_store  
Store a card in the graph. Auto-tags with your agent ID.
```
hs_store({
  slug: "use-clerk",
  title: "Use Clerk for auth",
  body: "Better DX, lower cost, native Next.js support",
  type: "decision",
  links: "auth-api:triggers,alice:decided"
})
```

### hs_decide
Record a decision with full provenance — who decided, what it affects, what it blocks.
```
hs_decide({
  slug: "use-clerk",
  title: "Use Clerk for auth",
  rationale: "Better DX, lower cost vs Auth0",
  affects: "auth-api,user-service",
  blocks: ""
})
```

### hs_blockers
Check what blocks a task/card. Returns exact typed blockers, not fuzzy search results.
```
hs_blockers({ slug: "deploy-prod" })
→ "1 blocker: [migration-23] Auth migration to Clerk"
```

### hs_graph
Traverse the knowledge graph from a starting card. See connections, ownership, dependencies.
```
hs_graph({ from: "auth-api", depth: 2 })
→ nodes: [auth-api, use-clerk, migration-23, alice]
→ edges: [auth-api→triggers→use-clerk, migration-23→blocks→deploy-prod]
```

### hs_my_cards
List all cards created by this agent.
```
hs_my_cards()
→ "3 cards by agent researcher: [finding-clerk-pricing] [finding-auth0-limits] [finding-nextauth-deprecated]"
```

## Multi-Agent Setup

Each agent gets its own ID. Cards are auto-tagged so you can see who created what.

Recommended roles:
- **coordinator**: Routes tasks, monitors blockers (`hs_blockers`, `hs_graph`, `hs_decide`)
- **researcher**: Investigates, stores findings (`hs_search`, `hs_store`)
- **builder**: Implements, records tech decisions (`hs_store`, `hs_decide`, `hs_blockers`)

## Setup

1. Get free API key: https://cascadeai.dev/hyperstack
2. Set `HYPERSTACK_API_KEY=hs_your_key` in your OpenClaw env
3. Tools are available immediately

Free: 10 cards, keyword search.
Pro ($29/mo): 100 cards, graph traversal, semantic search, time-travel debugging.

## When to use

- **Start of session**: `hs_search` for relevant context
- **Decision made**: `hs_decide` with rationale and links
- **Task blocked**: `hs_store` with `blocks` relation
- **Before starting work**: `hs_blockers` to check dependencies
- **New finding**: `hs_store` as context card

## Data safety

NEVER store passwords, API keys, tokens, PII, or credentials. Cards should be safe in a data breach. Always confirm with user before storing.
