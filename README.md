# hyperstack-core

The Memory Hub for AI agents. Typed graph memory with episodic/semantic/working APIs, decision replay, utility-weighted edges, git-style branching, and agent identity. The only memory layer where agents can verify what they know, trace why they know it, and coordinate without an LLM in the loop. $0 per operation at any scale.

```
npm i hyperstack-core
npx hyperstack-core init openclaw-multiagent
```

---

## The Problem

AI agent setups use markdown files for coordination:

```
# DECISIONS.md (append-only)
- 2026-02-15: Use Clerk for auth (coder-agent)
- 2026-02-16: Migration blocks production deploy (ops-agent)
```

Try answering: **"What breaks if auth changes?"**

With markdown: `grep -r "auth" *.md` — manual, fragile, returns text blobs.

## The Solution

```javascript
import { HyperStackClient } from "hyperstack-core";

const hs = new HyperStackClient({ apiKey: "hs_..." });

// Store a decision with typed relations
await hs.decide({
  slug: "use-clerk",
  title: "Use Clerk for auth",
  body: "Better DX, lower cost, native Next.js support",
  affects: ["auth-api"],
});

// Store a blocker
await hs.store({
  slug: "migration-23",
  title: "Auth migration to Clerk",
  cardType: "task",
  links: [{ target: "deploy-prod", relation: "blocks" }],
});

// What blocks deploy?
const result = await hs.blockers("deploy-prod");
// → { blockers: [{ slug: "migration-23", title: "Auth migration to Clerk" }] }

// What breaks if auth changes?
const impact = await hs.impact("use-clerk");
// → [auth-api, deploy-prod, billing-v2]
```

Typed relations, not text blobs. `task→blocks→deploy` is queryable. A paragraph in DECISIONS.md is not.

---

## MCP — Works in Cursor, Claude Desktop, VS Code, Windsurf

```json
{
  "mcpServers": {
    "hyperstack": {
      "command": "npx",
      "args": ["-y", "hyperstack-mcp"],
      "env": {
        "HYPERSTACK_API_KEY": "hs_your_key",
        "HYPERSTACK_WORKSPACE": "my-project",
        "HYPERSTACK_AGENT_SLUG": "cursor-agent"
      }
    }
  }
}
```

15 MCP tools: `hs_store`, `hs_search`, `hs_smart_search`, `hs_decide`, `hs_commit`, `hs_feedback`, `hs_blockers`, `hs_graph`, `hs_impact`, `hs_recommend`, `hs_fork`, `hs_diff`, `hs_merge`, `hs_discard`, `hs_identify`, `hs_profile`, `hs_prune`, `hs_ingest`, `hs_inbox`, `hs_stats`

---

## The Memory Hub — Three Memory Surfaces

Same typed graph, three distinct APIs with different retention behaviour.

### Episodic Memory — what happened and when
```
GET /api/cards?workspace=X&memoryType=episodic
```
- Event traces, agent actions, session history
- 30-day soft decay curve (agent-used cards decay at half rate)
- Returns `decayScore`, `daysSinceCreated`, `isStale` per card

### Semantic Memory — facts that never age
```
GET /api/cards?workspace=X&memoryType=semantic
```
- Decisions, people, projects, workflows, preferences
- Permanent — no decay, no expiry
- Returns `confidence`, `truth_stratum`, `isVerified` per card

### Working Memory — TTL-based scratchpad
```
GET /api/cards?workspace=X&memoryType=working
GET /api/cards?workspace=X&memoryType=working&includeExpired=true
```
- Cards with TTL set — auto-hides expired by default
- Agent-used cards get 1.5x TTL extension
- Returns `expiresAt`, `isExpired`, `ttlExtended` per card

---

## Decision Replay

Reconstruct exactly what an agent knew when a decision was made.

```javascript
// What did the agent know when "use-clerk" was decided?
const replay = await hs.graph({ from: "use-clerk", mode: "replay" });

// replay.narrative:
// "Decision: [Use Clerk for Auth] made at 2026-02-19T20:59:00Z"
// "Agent knew 1 of 2 connected cards at decision time."
// "⚠️ 1 card(s) were modified after the decision (potential hindsight): [blocker-clerk-migration]"
```

Use cases: compliance audits, agent debugging, post-mortems.

---

## Utility-Weighted Edges

The graph gets smarter the more you use it. Report success/failure after every agent task.

```javascript
// Report which cards helped the agent succeed
await hs.feedback({
  cardSlugs: ["use-clerk", "auth-api"],
  outcome: "success",
  taskId: "task-auth-refactor"
});

// Retrieve most useful cards first
GET /api/cards?workspace=X&sortBy=utility

// Graph traversal weighted by utility
GET /api/graph?from=auth-api&weightBy=utility
```

Cards that consistently help agents succeed get promoted. Cards in failed tasks decay.

---

## Git-Style Memory Branching

Experiment safely without corrupting live memory.

```javascript
// Fork before an experiment
const branch = await hs.fork({ branchName: "try-new-routing" });

// Make changes in the branch
await hs.store({ slug: "new-approach", title: "...", ... });

// See what changed
await hs.diff({ branchWorkspaceId: branch.branchWorkspaceId });

// Merge if it worked
await hs.merge({ branchWorkspaceId: branch.branchWorkspaceId, strategy: "branch-wins" });

// Or discard if it didn't
await hs.discard({ branchWorkspaceId: branch.branchWorkspaceId });
```

Requires Pro plan or above.

---

## Agent Identity + Trust

```javascript
// Register at session start (idempotent)
await hs.identify({ agentSlug: "research-agent" });

// All hs.store() calls auto-stamp sourceAgent
await hs.store({ slug: "finding-001", ... });

// Check trust score
const profile = await hs.profile({ agentSlug: "research-agent" });
// → { trustScore: 0.84, verifiedCards: 42, cardCount: 50 }
// Formula: (verifiedCards/total)×0.7 + min(cardCount/100,1.0)×0.3
```

---

## Trust & Provenance

Every card carries epistemic metadata.

```javascript
// Store with provenance
await hs.store({
  slug: "finding-latency",
  body: "p99 latency ~200ms under load",
  confidence: 0.6,
  truthStratum: "hypothesis"  // draft | hypothesis | confirmed
});

// After verification
await hs.store({
  slug: "finding-latency",
  confidence: 0.95,
  truthStratum: "confirmed",
  verifiedBy: "human:deeq"
  // verifiedAt auto-set server-side
});
```

---

## CLI

```bash
# Store a card
npx hyperstack-core store --slug "use-clerk" --title "Use Clerk" --type decision

# Record a decision
npx hyperstack-core decide --slug "use-clerk" --title "Use Clerk" --rationale "Better DX"

# Check blockers
npx hyperstack-core blockers deploy-prod

# Traverse graph
npx hyperstack-core graph auth-api --depth 2

# Search
npx hyperstack-core search "authentication setup"

# List
npx hyperstack-core list
```

---

## Self-Hosted Docker

```bash
# With OpenAI embeddings
docker run -d -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=your-secret \
  -e OPENAI_API_KEY=sk-... \
  ghcr.io/deeqyaqub1-cmd/hyperstack:latest

# Fully local — Ollama embeddings
docker run -d -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=your-secret \
  -e EMBEDDING_BASE_URL=http://host.docker.internal:11434 \
  -e EMBEDDING_MODEL=nomic-embed-text \
  ghcr.io/deeqyaqub1-cmd/hyperstack:latest

# Keyword only — no embeddings needed
docker run -d -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=your-secret \
  ghcr.io/deeqyaqub1-cmd/hyperstack:latest
```

Then set `HYPERSTACK_BASE_URL=http://localhost:3000` in your config.

Full guide: [SELF_HOSTING.md](./SELF_HOSTING.md)

---

## Python + LangGraph

```bash
pip install hyperstack-py
pip install hyperstack-langgraph
```

```python
from hyperstack import HyperStack
hs = HyperStack(api_key="hs_...", workspace="my-project")
hs.identify(agent_slug="my-agent")
branch = hs.fork(branch_name="experiment")
hs.merge(branch_workspace_id=branch["branchWorkspaceId"], strategy="branch-wins")
```

```python
from hyperstack_langgraph import HyperStackMemory
memory = HyperStackMemory(api_key="hs_...", workspace="my-project")
```

---

## Why Not Mem0 / Zep / Engram?

| Feature | HyperStack | Mem0 | Zep | Engram |
|---|---|---|---|---|
| Typed directed relations | ✅ 10 types | ❌ LLM-extracted | ❌ | ❌ generic |
| Utility-weighted edges | ✅ | ❌ | ❌ | ❌ |
| Git-style branching | ✅ | ❌ | ❌ | ❌ |
| Agent identity + trust | ✅ | ❌ | ❌ | ❌ |
| Provenance layer | ✅ | ❌ | ❌ | ❌ |
| Time-travel | ✅ | ❌ | ❌ | ❌ |
| Decision replay | ✅ | ❌ | ❌ | ❌ |
| Memory Hub segmentation | ✅ | ❌ | ❌ | ❌ |
| Self-hosted Docker | ✅ 1 command | ✅ complex | ✅ | ✅ |
| Cross-tool MCP | ✅ Cursor+Claude | ❌ | ❌ | ❌ |
| Cost per retrieval | **$0** | ~$0.002 LLM | ~$0.002 LLM | usage-based |

Mem0 finds "similar" cards. HyperStack finds **exactly** what blocks task #42.

---

## Setup

1. Get a free API key: [cascadeai.dev/hyperstack](https://cascadeai.dev/hyperstack)
2. `export HYPERSTACK_API_KEY=hs_your_key`
3. `npm i hyperstack-core`

| Plan | Price | Cards | Features |
|------|-------|-------|---------|
| Free | $0 | 10 | Search only |
| Pro | $29/mo | 100 | All modes + branching + identity + Memory Hub |
| Team | $59/mo | 500 | All modes + webhooks + agent tokens |
| Business | $149/mo | 2,000 | All modes + SSO + 20 members |
| Self-hosted | $0 | Unlimited | Full feature parity |

---

## License

MIT
