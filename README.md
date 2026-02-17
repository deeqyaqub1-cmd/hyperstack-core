# hyperstack-core

Typed graph memory for AI agents. Replace `GOALS.md` + `DECISIONS.md` with queryable cards and relations.

```
npm i hyperstack-core
npx hyperstack-core init openclaw-multiagent
```

## The Problem

OpenClaw multi-agent setups use markdown files for coordination:

```
# DECISIONS.md (append-only)
- 2026-02-15: Use Clerk for auth (coder-agent)
- 2026-02-15: Deploy needs auth migration first (deploy-agent)
- 2026-02-16: Migration blocks production deploy (ops-agent)
```

Try answering: **"What blocks the production deploy?"**

With markdown: `grep -r "blocks.*deploy" *.md` — manual, fragile, returns text blobs.

## The Solution

```js
import { HyperStackClient } from "hyperstack-core";

const hs = new HyperStackClient({ apiKey: "hs_..." });

// Coder agent records a decision
await hs.decide({
  slug: "use-clerk",
  title: "Use Clerk for auth",
  body: "Better DX, lower cost, native Next.js support",
  decidedBy: "agent-coder",
  affects: ["auth-api"],
});

// Deploy agent records a blocker
await hs.store({
  slug: "migration-23",
  title: "Auth migration to Clerk",
  cardType: "task",
  links: [
    { target: "deploy-prod", relation: "blocks" },
    { target: "use-clerk", relation: "depends_on" },
  ],
});

// Ops agent asks: what blocks deploy?
const result = await hs.blockers("deploy-prod");
// → { blockers: [{ slug: "migration-23", title: "Auth migration to Clerk" }] }
```

**Typed relations, not text blobs.** `task→blocks→deploy` is queryable. A paragraph in DECISIONS.md is not.

## OpenClaw Integration

```js
import { createOpenClawAdapter } from "hyperstack-core/adapters/openclaw";

// Each agent gets its own adapter
const researcher = createOpenClawAdapter({ agentId: "researcher" });
const builder = createOpenClawAdapter({ agentId: "builder" });

// Register on session start
await researcher.onSessionStart({
  agentName: "Research Agent",
  agentRole: "Investigate questions, store findings as context cards",
});

// Use tools in agent logic
await researcher.tools.hs_store({
  slug: "finding-clerk-pricing",
  title: "Clerk pricing analysis",
  body: "Free for 10K MAU, $0.02/MAU after. Cheaper than Auth0 at our scale.",
  type: "context",
  links: "use-clerk:related",
});

// Builder queries shared knowledge
const blockers = await builder.tools.hs_blockers({ slug: "deploy-prod" });
// → "1 blocker: [migration-23] Auth migration to Clerk"
```

## CLI

```bash
# Initialize with multi-agent template
npx hyperstack-core init openclaw-multiagent

# Store cards
npx hyperstack-core store --slug "use-clerk" --title "Use Clerk" --type decision

# Record decisions
npx hyperstack-core decide --slug "use-clerk" --title "Use Clerk" --rationale "Better DX"

# Check blockers
npx hyperstack-core blockers deploy-prod

# Traverse graph
npx hyperstack-core graph auth-api --depth 2

# Search
npx hyperstack-core search "authentication setup"

# List all cards
npx hyperstack-core list
```

## Why Not Mem0/Cognee?

| | hyperstack-core | Mem0 | Cognee |
|--|---|---|---|
| "What blocks deploy?" | Exact: 2 typed blockers | Fuzzy: 17 similar tasks | Generic entities |
| Relations | `task→blocks→deploy` (typed) | Auto-extracted (hallucinated) | Generic graph |
| Cost per op | **$0** (deterministic) | ~$0.002 (LLM extraction) | ~$0.002 |
| Multi-agent | Built-in agent tagging | Shared userId issues | No agent awareness |
| Setup | `npm i` + 1 env var | Docker + config | Docker + Neo4j |

Mem0 finds "similar" cards. HyperStack finds **exactly** what blocks task #42.

## How It Works

Cards are typed objects with explicit relations:

```
[task:deploy-prod] "Deploy to production"
    ←blocks— [task:migration-23] "Auth migration to Clerk"
    ←blocks— [blocker:staging-tests] "Staging tests failing"
    —assigned_to→ [agent:deploy-agent]
    —depends_on→ [decision:use-clerk]
```

Every card stores: slug, title, body, cardType, links (typed relations), keywords, meta.
Every relation is explicit — no LLM extraction, no hallucinated connections.

Backed by HyperStack API (Neon PostgreSQL + pgvector for hybrid search).

## Setup

1. Get a free API key: [cascadeai.dev/hyperstack](https://cascadeai.dev/hyperstack)
2. `export HYPERSTACK_API_KEY=hs_your_key`
3. `npm i hyperstack-core`
4. `npx hyperstack-core init openclaw-multiagent`

Free tier: 10 cards, keyword search.
Pro ($29/mo): 100 cards, graph traversal, time-travel, semantic search.

## License

MIT
