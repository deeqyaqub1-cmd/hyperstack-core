---
name: HyperStack — Memory Hub for AI Agents
description: "The Memory Hub for AI agents — deterministic, typed, temporal graph memory with trust propagation, safety constraints, and decision replay. Ask 'what blocks deploy?' → exact typed answer. Git-style branching. Episodic/semantic/working memory APIs. Decision replay with hindsight bias detection. Utility-weighted edges that self-improve from agent feedback. Agent identity + trust scoring. Time-travel to any past graph state. Works in Cursor, Claude Desktop, LangGraph, any MCP client. Self-hostable. $0 per operation at any scale."
user-invocable: true
homepage: https://cascadeai.dev/hyperstack
metadata:
  openclaw:
    emoji: "🧠"
    requires:
      env:
        - HYPERSTACK_API_KEY
        - HYPERSTACK_WORKSPACE
    primaryEnv: HYPERSTACK_API_KEY
---

# HyperStack — Memory Hub for AI Agents

## What this does

HyperStack is the Memory Hub for AI agents. Typed graph memory with three distinct memory surfaces, decision replay, utility-weighted edges that self-improve from feedback, and full provenance on every card. The only memory layer where agents can verify what they know, trace why they know it, and coordinate without an LLM in the loop.

**The problem it solves:**
```
# DECISIONS.md (what everyone uses today)
- 2026-02-15: Use Clerk for auth
- 2026-02-16: Migration blocks deploy
"What breaks if auth changes?" → grep → manual → fragile
```

**What you get instead:**
```
"What breaks if auth changes?"  → hs_impact use-clerk         → [auth-api, deploy-prod, billing-v2]
"What blocks deploy?"           → hs_blockers deploy-prod      → [migration-23]
"What's related to stripe?"     → hs_recommend use-stripe      → scored list
"Anything about auth?"          → hs_smart_search              → auto-routed
"Fork memory for experiment"    → hs_fork                      → branch workspace
"What changed in the branch?"   → hs_diff                      → added/changed/deleted
"Trust this agent?"             → hs_profile                   → trustScore: 0.84
"Why did we make this call?"    → mode=replay                  → decision timeline + hindsight flags
"Show episodic memory"          → memoryType=episodic          → decay-scored event traces
"Did this card help agents?"    → hs_feedback outcome=success  → utility score updated
```

Typed relations. Exact answers. Zero LLM cost. Works across Cursor, Claude Desktop, LangGraph, any MCP client simultaneously.

---

## Tools (15 total)

### hs_smart_search ✨ Recommended starting point
Agentic RAG — automatically routes to the best retrieval mode. Use this when unsure which tool to call.
```
hs_smart_search({ query: "what depends on the auth system?" })
→ routed to: impact
→ [auth-api] API Service — via: triggers
→ [billing-v2] Billing v2 — via: depends-on

hs_smart_search({ query: "authentication setup" })
→ routed to: search
→ Found 3 memories

# Hint a starting slug for better routing
hs_smart_search({ query: "what breaks if this changes?", slug: "use-clerk" })
```

---

### hs_store
Store or update a card. Supports pinning, TTL scratchpad, trust/provenance, and agent identity stamping.
```
# Basic store
hs_store({
  slug: "use-clerk",
  title: "Use Clerk for auth",
  body: "Better DX, lower cost, native Next.js support",
  type: "decision",
  links: "auth-api:triggers,alice:decided"
})

# With trust/provenance
hs_store({
  slug: "finding-clerk-pricing",
  title: "Clerk pricing confirmed",
  body: "Clerk free tier: 10k MAU. Verified on clerk.com/pricing",
  type: "decision",
  confidence: 0.95,
  truthStratum: "confirmed",
  verifiedBy: "tool:web_search"
})

# Pin — never pruned
hs_store({ slug: "core-arch", title: "Core Architecture", body: "...", pinned: true })

# Scratchpad with TTL — auto-deletes
hs_store({ slug: "scratch-001", title: "Working memory", body: "...",
  type: "scratchpad", ttl: "2026-02-21T10:00:00Z" })
```

**Trust/Provenance fields (all optional):**
| Field | Type | Values | Meaning |
|-------|------|--------|---------|
| `confidence` | float | 0.0–1.0 | Writer's self-reported certainty |
| `truthStratum` | string | `draft` \| `hypothesis` \| `confirmed` | Epistemic status |
| `verifiedBy` | string | any string | Who/what confirmed this |
| `verifiedAt` | datetime | — | Auto-set server-side |
| `sourceAgent` | string | — | Immutable after creation |

**Valid cardTypes:** `general`, `person`, `project`, `decision`, `preference`, `workflow`, `event`, `account`, `signal`, `scratchpad`

---

### hs_search
Hybrid semantic + keyword search across the graph.
```
hs_search({ query: "authentication setup" })
```

---

### hs_decide
Record a decision with full provenance.
```
hs_decide({
  slug: "use-clerk",
  title: "Use Clerk for auth",
  rationale: "Better DX, lower cost vs Auth0",
  affects: "auth-api,user-service",
  blocks: ""
})
```

---

### hs_commit
Commit a successful agent outcome as a permanent decision card, auto-linked via `decided` relation.
```
hs_commit({
  taskSlug: "task-auth-refactor",
  outcome: "Successfully migrated all auth middleware to Clerk. Zero regressions.",
  title: "Auth Refactor Completed",
  keywords: ["clerk", "auth", "completed"]
})
→ { committed: true, slug: "commit-task-auth-refactor-...", relation: "decided" }
```

---

### hs_feedback ✨ NEW in v1.0.23
Report whether a set of cards helped an agent succeed or fail. Promotes winners, decays losers. Makes the graph self-improving over time.
```
# Cards that were in context when the task succeeded
hs_feedback({
  cardSlugs: ["use-clerk", "auth-api", "migration-23"],
  outcome: "success",
  taskId: "task-auth-refactor"
})
→ { feedback: true, outcome: "success", cardsAffected: 3, edgesUpdated: 5 }

# Cards that were in context when the task failed
hs_feedback({
  cardSlugs: ["wrong-approach"],
  outcome: "failure",
  taskId: "task-auth-refactor"
})
→ { feedback: true, outcome: "failure", cardsAffected: 1, edgesUpdated: 2 }
```

**How it works:** Each card's edges carry a `utilityScore`. On success, scores increase. On failure, scores decrease. Over time, cards that consistently help agents rank higher in `?sortBy=utility` queries. The graph learns what's actually useful.

**When to call it:** At the end of every agent task — win or lose. Even a few signals per day significantly improve retrieval quality.

---

### hs_prune
Remove stale cards not updated in N days that aren't referenced by other cards. Always dry-run first.
```
# Preview — safe, no deletions
hs_prune({ days: 30, dry: true })
→ { dryRun: true, wouldPrune: 3, skipped: 2, cards: [...], protected: [...] }

# Execute
hs_prune({ days: 30 })
→ { pruned: 3, skipped: 2 }
```

**Safety guarantees:** linked cards never pruned · pinned cards never pruned · TTL cards managed separately

---

### hs_blockers
Exact typed blockers for a card.
```
hs_blockers({ slug: "deploy-prod" })
→ "1 blocker: [migration-23] Auth migration to Clerk"
```

---

### hs_graph
Forward graph traversal. Supports time-travel and utility-weighted sorting.
```
hs_graph({ from: "auth-api", depth: 2 })
→ nodes: [auth-api, use-clerk, migration-23, alice]

# Time-travel — graph at any past moment
hs_graph({ from: "auth-api", depth: 2, at: "2026-02-15T03:00:00Z" })

# Utility-weighted — highest-value edges first
hs_graph({ from: "auth-api", depth: 2, weightBy: "utility" })

# Decision replay — what did agent know when this card was created?
hs_graph({ from: "use-clerk", mode: "replay" })
```

---

### hs_impact
Reverse traversal — find everything that depends on a card.
```
hs_impact({ slug: "use-clerk" })
→ "Impact of [use-clerk]: 3 cards depend on this
   [auth-api] API Service — via: triggers
   [billing-v2] Billing v2 — via: depends-on
   [deploy-prod] Production Deploy — via: blocks"

# Filter by relation
hs_impact({ slug: "use-clerk", relation: "depends-on" })
```

---

### hs_recommend
Co-citation scoring — find topically related cards without direct links.
```
hs_recommend({ slug: "use-stripe" })
→ "[billing-v2] Billing v2 — score: 4"
```

---

### hs_fork
Fork a workspace into a branch for safe experimentation. All cards copied. Parent untouched.
```
hs_fork({ branchName: "experiment-v2" })
→ {
    branchWorkspaceId: "clx...",
    branchName: "experiment-v2",
    cardsCopied: 24,
    forkedAt: "2026-02-21T..."
  }
```

When to use: before risky changes, experiments, or testing new agent reasoning strategies.

---

### hs_diff
See exactly what changed between a branch and its parent. SQL-driven — deterministic, not fuzzy.
```
hs_diff({ branchWorkspaceId: "clx..." })
→ {
    added:    [{ slug: "new-approach", title: "..." }],
    modified: [{ slug: "use-clerk", title: "..." }],
    removed:  []
  }
```

---

### hs_merge
Merge branch changes back to parent. Two strategies: `branch-wins` or `parent-wins`.
```
# Branch wins — apply all branch changes to parent
hs_merge({ branchWorkspaceId: "clx...", strategy: "branch-wins" })
→ { merged: 24, conflicts: 0, strategy: "branch-wins" }

# Parent wins — only copy cards that don't exist in parent
hs_merge({ branchWorkspaceId: "clx...", strategy: "parent-wins" })
→ { merged: 3, conflicts: 21, strategy: "parent-wins" }
```

---

### hs_discard
Discard a branch entirely. Deletes all branch cards and workspace. Parent untouched.
```
hs_discard({ branchWorkspaceId: "clx..." })
→ { discarded: true, branchWorkspaceId: "clx...", parentSlug: "default" }
```

---

### hs_identify
Register this agent with a SHA256 fingerprint. Idempotent — safe to call every session.
```
hs_identify({ agentSlug: "research-agent", displayName: "Research Agent" })
→ {
    registered: true,
    agentSlug: "research-agent",
    fingerprint: "sha256:a3f...",
    trustScore: 0.5
  }
```

When to use: at the start of every agent session for full provenance tracking.

---

### hs_profile
Get an agent's trust score. Computed from verified card ratio + activity.
```
hs_profile({ agentSlug: "research-agent" })
→ {
    agentSlug: "research-agent",
    displayName: "Research Agent",
    trustScore: 0.84,
    fingerprint: "sha256:a3f...",
    registeredAt: "...",
    lastActiveAt: "..."
  }
```

**Trust formula:** `(verifiedCards/totalCards) × 0.7 + min(cardCount/100, 1.0) × 0.3`

---

### hs_my_cards
List all cards created by this agent.
```
hs_my_cards()
→ "3 cards by agent researcher: [finding-clerk-pricing] [finding-auth0-limits]"
```

---

### hs_ingest
Auto-extract cards from raw text. Zero LLM cost (regex-based).
```
hs_ingest({ text: "We're using Next.js 14 and PostgreSQL. Alice decided to use Clerk for auth." })
→ "✅ Created 3 cards from 78 chars"
```

---

### hs_inbox
Check for cards directed at this agent by other agents.
```
hs_inbox({})
→ "Inbox for cursor-mcp: 1 card(s)"
```

---

### hs_stats (Pro+)
Token savings and memory usage stats.
```
hs_stats()
→ "Cards: 24 | Tokens stored: 246 | Saving: 94% — $2.07/mo"
```

---

## The Memory Hub — Three Memory Surfaces

HyperStack exposes three distinct memory APIs backed by the same typed graph. Each has different retention behaviour and decay rules.

### Episodic Memory — what happened and when
```
GET /api/cards?workspace=X&memoryType=episodic
```
- **Cards:** stack=general OR cardType=event — event traces, agent actions
- **Sort:** createdAt DESC (most recent first)
- **Retention:** 30-day soft decay
  - 0–7 days → decayScore: 1.0 (fresh)
  - 8–30 days → linear decay to 0.2
  - >30 days → decayScore: 0.1 (stale, not deleted)
- **Agent bonus:** if sourceAgent is set, decay is halved — useful memories survive longer
- **Extra fields per card:** `decayScore`, `daysSinceCreated`, `isStale`
- **Metadata:** `segment: "episodic"`, `retentionPolicy: "30-day-decay"`, `staleCount`

### Semantic Memory — facts and knowledge that never age
```
GET /api/cards?workspace=X&memoryType=semantic
```
- **Cards:** cardType IN (decision, person, project, workflow, preference, account)
- **Sort:** updatedAt DESC
- **Retention:** permanent — no decay, no expiry
- **Extra fields per card:** `confidence`, `truth_stratum`, `verified_by`, `verified_at`, `isVerified`
- **Metadata:** `segment: "semantic"`, `retentionPolicy: "permanent"`

### Working Memory — active scratchpad, TTL-based
```
GET /api/cards?workspace=X&memoryType=working
GET /api/cards?workspace=X&memoryType=working&includeExpired=true
```
- **Cards:** ttl IS NOT NULL
- **Sort:** updatedAt DESC
- **Retention:** TTL-based auto-expiry. Default hides expired cards.
- **Agent bonus:** if sourceAgent is set, effective TTL extended 1.5x. Signalled as `ttlExtended: true`.
- **Extra fields per card:** `ttl`, `expiresAt`, `isExpired`, `ttlExtended`
- **Metadata:** `segment: "working"`, `retentionPolicy: "ttl-based"`, `expiredCount`
- TTL formats: `"30m"` · `"24h"` · `"7d"` · `"2w"` · raw milliseconds

---

## Decision Replay

Reconstruct exactly what the agent knew when a decision was made. Flags cards that didn't exist at decision time — potential hindsight bias in retrospective analysis.

```
hs_graph({ from: "use-clerk", mode: "replay" })
```

Response shape:
```json
{
  "mode": "replay",
  "root": "use-clerk",
  "anchorTime": "2026-02-19T20:59:00Z",
  "knownAtDecision": 1,
  "unknownAtDecision": 1,
  "timeline": [
    {
      "slug": "use-clerk",
      "timing": "decision",
      "modifiedAfterDecision": false
    },
    {
      "slug": "blocker-clerk-migration",
      "timing": "after_decision",
      "modifiedAfterDecision": true
    }
  ],
  "narrative": [
    "Decision: [Use Clerk for Auth] made at 2026-02-19T20:59:00Z",
    "Agent knew 1 of 2 connected cards at decision time.",
    "1 card(s) did not exist when this decision was made: [blocker-clerk-migration]",
    "⚠️ 1 card(s) were modified after the decision (potential hindsight): [blocker-clerk-migration]"
  ]
}
```

**Timing values:** `decision` · `prior_knowledge` · `same_day` · `just_before` · `after_decision`

**Use cases:** Compliance audits · agent debugging · post-mortems · "what did the agent actually know when it made this call?"

---

## Utility-Weighted Edges

Every edge carries a `utilityScore` that updates from agent feedback. Cards that consistently help agents succeed rank higher. Cards that appear in failed tasks decay.

```
# Retrieve most useful cards first
GET /api/cards?workspace=X&sortBy=utility

# Only high-utility cards
GET /api/cards?workspace=X&minUtility=0.7

# Graph traversal weighted by utility
GET /api/graph?from=auth-api&weightBy=utility
```

Feed the loop with `hs_feedback` at the end of every task. The graph gets smarter with every session.

---

## Git-Style Memory Branching

Branch your memory workspace like a Git repo. Experiment safely without corrupting live memory.

```
# 1. Fork before an experiment
hs_fork({ branchName: "try-new-routing" })

# 2. Make changes in the branch
hs_store({ slug: "new-approach", title: "...", ... })

# 3. See what changed
hs_diff({ branchWorkspaceId: "clx..." })

# 4a. Merge if it worked
hs_merge({ branchWorkspaceId: "clx...", strategy: "branch-wins" })

# 4b. Or discard if it didn't
hs_discard({ branchWorkspaceId: "clx..." })
```

**Branching requires Pro plan or above.**

---

## Agent Identity + Trust

Register agents for full provenance tracking and trust scoring.

```
# Register at session start (idempotent)
hs_identify({ agentSlug: "research-agent" })

# All subsequent hs_store calls auto-stamp sourceAgent
hs_store({ slug: "finding-001", ... })  # → auto-linked to research-agent

# Check trust score
hs_profile({ agentSlug: "research-agent" })
→ trustScore: 0.84
```

**Recommended:** Set `HYPERSTACK_AGENT_SLUG` env var for zero-config auto-identification.

---

## The Ten Graph Modes

| Mode | How to use | Question answered |
|------|------------|-------------------|
| Smart | `hs_smart_search` | Ask anything — auto-routes |
| Forward | `hs_graph` | What does this card connect to? |
| Impact | `hs_impact` | What depends on this? What breaks? |
| Recommend | `hs_recommend` | What's topically related? |
| Time-travel | `hs_graph` with `at=` | What did the graph look like then? |
| Replay | `hs_graph` with `mode=replay` | What did the agent know at decision time? |
| Utility | `?sortBy=utility` or `?weightBy=utility` | Which cards/edges are most useful? |
| Prune | `hs_prune` | What stale memory is safe to remove? |
| Branch diff | `hs_diff` | What changed in this branch? |
| Trust | `hs_profile` | How trustworthy is this agent? |

---

## Trust & Provenance

Every card carries epistemic metadata.

```
# Store a finding with low confidence
hs_store({ slug: "finding-latency", body: "p99 latency ~200ms under load",
  confidence: 0.6, truthStratum: "hypothesis" })

# After human verification
hs_store({ slug: "finding-latency", confidence: 0.95,
  truthStratum: "confirmed", verifiedBy: "human:deeq" })
# → verifiedAt auto-set server-side
```

**Key rules:**
- `confidence` is self-reported — display only, never use as hard guardrail
- `confirmed` = trusted working truth for this workspace, not objective truth
- `sourceAgent` is immutable — set on creation, never changes
- `verifiedAt` is server-set — not writable by clients

---

## Full Memory Lifecycle

| Memory type | Tool | Behaviour |
|-------------|------|-----------|
| Long-term facts | `hs_store` | Permanent, searchable, graph-linked |
| Working memory | `hs_store` with `ttl=` | Auto-expires after TTL |
| Outcomes / learning | `hs_commit` | Commits result as decided card |
| Utility feedback | `hs_feedback` | Promotes useful cards, decays useless ones |
| Stale cleanup | `hs_prune` | Removes unused cards, preserves graph integrity |
| Protected facts | `hs_store` with `pinned=true` | Never pruned |
| Branch experiment | `hs_fork` → `hs_diff` → `hs_merge` / `hs_discard` | Safe experimentation |
| Episodic view | `memoryType=episodic` | Time-decayed event traces |
| Semantic view | `memoryType=semantic` | Permanent facts + provenance |
| Working view | `memoryType=working` | TTL-based scratchpad surface |

---

## Multi-Agent Setup

Each agent gets its own ID. Cards auto-tagged for full traceability.

Recommended roles:
- **coordinator** — `hs_blockers`, `hs_impact`, `hs_graph`, `hs_decide`, `hs_fork`, `hs_merge`
- **researcher** — `hs_search`, `hs_recommend`, `hs_store`, `hs_ingest`, `hs_identify`
- **builder** — `hs_store`, `hs_decide`, `hs_commit`, `hs_blockers`, `hs_fork`, `hs_feedback`
- **memory-agent** — `hs_prune`, `hs_stats`, `hs_smart_search`, `hs_diff`, `hs_discard`, `hs_feedback`

---

## When to use each tool

| Moment | Tool |
|--------|------|
| Start of session | `hs_identify` → `hs_smart_search` |
| Not sure which mode | `hs_smart_search` — auto-routes |
| New project / onboarding | `hs_ingest` to auto-populate |
| Decision made | `hs_decide` with rationale and links |
| Task completed | `hs_commit` + `hs_feedback outcome=success` |
| Task failed | `hs_feedback outcome=failure` |
| Task blocked | `hs_store` with `blocks` relation |
| Before starting work | `hs_blockers` to check dependencies |
| Before changing a card | `hs_impact` to check blast radius |
| Before risky experiment | `hs_fork` → work in branch → `hs_merge` or `hs_discard` |
| Discovery | `hs_recommend` — find related context |
| Working memory | `hs_store` with `ttl=` |
| Periodic cleanup | `hs_prune dry=true` → inspect → execute |
| Debug a bad decision | `hs_graph` with `at=` timestamp |
| Audit a decision | `hs_graph` with `mode=replay` |
| Cross-agent signal | `hs_store` with `targetAgent` → `hs_inbox` |
| Check agent trust | `hs_profile` |
| Check efficiency | `hs_stats` |

---

## Setup

### MCP (Claude Desktop / Cursor / VS Code / Windsurf)
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

### Python SDK
```bash
pip install hyperstack-py
```
```python
from hyperstack import HyperStack
hs = HyperStack(api_key="hs_...", workspace="my-project")
hs.identify(agent_slug="my-agent")
branch = hs.fork(branch_name="experiment")
hs.diff(branch_workspace_id=branch["branchWorkspaceId"])
hs.merge(branch_workspace_id=branch["branchWorkspaceId"], strategy="branch-wins")
```

### LangGraph
```bash
pip install hyperstack-langgraph
```
```python
from hyperstack_langgraph import HyperStackMemory
memory = HyperStackMemory(api_key="hs_...", workspace="my-project")
```

### Self-Hosted
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
Set `HYPERSTACK_BASE_URL=http://localhost:3000` in your SDK config.

Full guide: https://github.com/deeqyaqub1-cmd/hyperstack-core/blob/main/SELF_HOSTING.md

---

## Data safety

NEVER store passwords, API keys, tokens, PII, or credentials in cards. Cards should be safe in a data breach. Always confirm with user before storing sensitive information.

---

## Pricing

| Plan | Price | Cards | Features |
|------|-------|-------|---------|
| Free | $0 | 10 | Search only |
| Pro | $29/mo | 100 | All modes + branching + identity + Memory Hub |
| Team | $59/mo | 500 | All modes + webhooks + agent tokens |
| Business | $149/mo | 2,000 | All modes + SSO + 20 members |
| Self-hosted | $0 | Unlimited | Full feature parity |

Get your free API key: https://cascadeai.dev/hyperstack

---

## Changelog

### v1.0.23 (Feb 21, 2026)

#### ✨ Memory Hub Segmentation — 3 new memory surfaces
- `?memoryType=episodic` — event traces with 30-day soft decay. Agent-used cards decay at half rate.
- `?memoryType=semantic` — permanent facts/entities. No decay. Returns confidence + provenance fields.
- `?memoryType=working` — TTL-based scratchpad. Expired cards hidden by default. Agent-used cards get 1.5x TTL extension.
- All three surfaces backed by same Card table — zero schema changes, zero storage cost

#### ✨ Decision Replay — audit what agents knew at decision time
- `mode=replay` on graph endpoint — reconstructs graph state at decision timestamp
- `modifiedAfterDecision` flag — detects cards created AFTER decision (potential hindsight bias)
- Plain English `narrative` array — audit-ready output for compliance

#### ✨ Utility-Weighted Edges — self-improving graph
- `hs_feedback` — report success/failure after every agent task
- `?sortBy=utility` — retrieve most useful cards first
- `?minUtility=0.7` — filter to high-utility cards
- `?weightBy=utility` — graph traversal prioritises highest-value edges

#### 🐛 Routing fixes
- Fork, diff, merge, discard — routing was broken in production, now fully fixed and tested
- Agent identity register/profile — plan gate was blocking PRO users, now fixed
- V2 Agent/AgentACL snake_case fields corrected throughout

#### 📦 SDK
- `hyperstack-mcp` → v1.9.2 (15 tools, was 14)
- Docker image rebuilt: `ghcr.io/deeqyaqub1-cmd/hyperstack:latest` (Phase 3+4 now included)

### v1.1.0 (Feb 20, 2026)

#### ✨ Git-Style Memory Branching — 4 new tools
- `hs_fork`, `hs_diff`, `hs_merge`, `hs_discard`

#### ✨ Agent Identity + Trust Scoring — 2 new tools
- `hs_identify`, `hs_profile`
- Trust formula: `(verifiedCards/total)×0.7 + min(cardCount/100,1.0)×0.3`

#### ✨ Self-Hosting via Docker
- `ghcr.io/deeqyaqub1-cmd/hyperstack:latest`

#### 📦 SDK
- `hyperstack-mcp` → v1.9.0 (14 tools)
- `hyperstack-py` → v1.4.0
- `hyperstack-langgraph` → v1.4.0

### v1.0.20 (Feb 20, 2026)
- Trust/Provenance fields on every card: `confidence`, `truthStratum`, `verifiedBy`, `verifiedAt`, `sourceAgent`

### v1.0.19 (Feb 20, 2026)
- `hs_prune`, `hs_commit`, `pinned` field, `scratchpad` cardType + TTL

### v1.0.18 (Feb 20, 2026)
- `hs_smart_search` — agentic RAG routing

### v1.0.16 (Feb 19, 2026)
- `hs_impact`, `hs_recommend`

### v1.0.13–v1.0.15
- Core: `hs_search`, `hs_store`, `hs_decide`, `hs_blockers`, `hs_graph`, `hs_my_cards`, `hs_ingest`, `hs_inbox`, `hs_stats`
