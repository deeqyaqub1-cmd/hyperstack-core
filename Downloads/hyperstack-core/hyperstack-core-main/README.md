# HyperStack

**Typed graph memory for AI agents. Deterministic. Provable. Self-hostable.**

Most memory systems return fuzzy guesses. HyperStack returns exact answers.

Ask *"what blocks deploy?"* → get **only** cards tagged `blocks→deploy`.  
No LLM extraction. No hallucinated relationships. No surprises.

[![npm](https://img.shields.io/npm/v/hyperstack-mcp?label=hyperstack-mcp)](https://www.npmjs.com/package/hyperstack-mcp)
[![npm](https://img.shields.io/npm/v/hyperstack-py?label=hyperstack-py)](https://pypi.org/project/hyperstack-py/)
[![npm](https://img.shields.io/npm/v/hyperstack-langgraph?label=hyperstack-langgraph)](https://pypi.org/project/hyperstack-langgraph/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Why HyperStack?

Every other agent memory tool has the same problem: they use LLMs to extract and retrieve relationships. That means:

- **Hallucinated links** between cards that were never connected
- **Fuzzy search** that returns vaguely related results instead of exact matches
- **No audit trail** — you can't prove why an agent made a decision
- **No branching** — agents can't experiment without corrupting live memory

HyperStack is built differently. Agents explicitly define typed relationships. Memory is a knowledge graph you can query, diff, branch, merge, and time-travel through — exactly like Git, but for agent memory.

---

## What Makes It Unique

| Feature | HyperStack | Mem0 | Engram |
|---|---|---|---|
| Exact typed relations | ✅ Deterministic | ❌ LLM-extracted | ❌ Generic |
| Git-style branching | ✅ fork/diff/merge/discard | ❌ | ❌ |
| Time-travel | ✅ Reconstruct any timestamp | ❌ | ❌ |
| Provenance layer | ✅ confidence, truthStratum, verifiedBy | ❌ | ❌ |
| Agent identity + trust | ✅ SHA256 fingerprint + trustScore | ❌ | ❌ |
| Self-hostable | ✅ One Docker command | ✅ Complex | ✅ |
| Cross-framework MCP | ✅ Cursor, Claude, LangGraph | ❌ | ❌ |
| Funded | No (solo founder) | Series A | No |

---

## Core Concepts

**Cards** — structured memory units with a title, body, type, keywords, and typed links to other cards.

**Typed Relations** — 10 explicit relation types: `related`, `owns`, `decided`, `approved`, `uses`, `triggers`, `blocks`, `depends-on`, `reviews`, `notifies`. You define them. HyperStack enforces them.

**Branching** — fork a workspace, run experiments, diff the changes, merge or discard. Agent memory that behaves like code.

**Provenance** — every card tracks `confidence`, `truthStratum` (draft/hypothesis/confirmed), `verifiedBy`, `sourceAgent`. Know exactly what your agents believe and why.

**Time-Travel** — reconstruct the full knowledge graph at any past timestamp. Debug agent decisions after the fact.

**Agent Identity** — register agents with SHA256 fingerprints. Compute trust scores based on verified card ratios. Know which agents to trust.

---

## Quickstart

**Install the MCP server (Cursor / Claude Desktop)**

```bash
npm install -g hyperstack-mcp
```

Add to your MCP config:
```json
{
  "hyperstack": {
    "command": "node",
    "args": ["/path/to/hyperstack-mcp/index.js"],
    "env": {
      "HYPERSTACK_API_KEY": "hs_your_key_here",
      "HYPERSTACK_BASE_URL": "https://hyperstack-cloud.vercel.app"
    }
  }
}
```

**Python SDK**
```bash
pip install hyperstack-py
```

```python
from hyperstack import HyperStack

hs = HyperStack(api_key="hs_...", workspace="my-project")

# Store a decision
hs.store(
    slug="use-postgres",
    title="Use PostgreSQL for persistence",
    body="Chose PostgreSQL over MongoDB for strong consistency guarantees.",
    card_type="decision",
    links=[{"slug": "backend-arch", "relation": "decided"}]
)

# Exact query — only cards that block deploy
results = hs.list(relation="blocks", target="deploy")
```

**LangGraph**
```bash
pip install hyperstack-langgraph
```

```python
from hyperstack_langgraph import HyperStackMemory

memory = HyperStackMemory(api_key="hs_...", workspace="my-agent")
```

---

## Git-Style Memory Branching

```python
# Fork your workspace before an experiment
branch = hs.fork(branch_name="experiment-v2")

# Make changes in the branch
branch.store(slug="new-approach", title="Try new routing logic", ...)

# See exactly what changed
diff = hs.diff(branch_workspace_id=branch.id)
# → { added: [...], changed: [...], deleted: [...] }

# Merge if it worked, discard if it didn't
hs.merge(branch_workspace_id=branch.id, strategy="ours")
# or
hs.discard(branch_workspace_id=branch.id)
```

---

## Agent Identity & Trust

```python
# Register an agent
identity = hs.identify(agent_slug="research-agent")
# → { fingerprint: "sha256...", is_new: True }

# Get trust score
profile = hs.profile(agent_slug="research-agent")
# → { trust_score: 0.84, verified_cards: 42, total_cards: 50 }
```

---

## Self-Hosting

Run HyperStack on your own infrastructure with one command:

```bash
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=your-secret \
  -e OPENAI_API_KEY=sk-... \
  ghcr.io/deeqyaqub1-cmd/hyperstack:latest
```

Point your SDK at it:
```bash
HYPERSTACK_BASE_URL=http://localhost:3000
```

Full guide: [SELF_HOSTING.md](SELF_HOSTING.md)

---

## Token Savings

Without HyperStack, agents stuff full context into every prompt:
- Average payload: ~6,000 tokens/message
- 3 agents × 50 messages/day = **~$81/mo per agent**

With HyperStack card retrieval:
- Average retrieval: ~350 tokens/message
- Same usage = **~$4.72/mo per agent**
- **94% cost reduction**

---

## Packages

| Package | Version | Description |
|---|---|---|
| [hyperstack-mcp](https://npmjs.com/package/hyperstack-mcp) | 1.9.0 | MCP server — 14 tools for Cursor + Claude |
| [hyperstack-py](https://pypi.org/project/hyperstack-py/) | 1.4.0 | Python SDK |
| [hyperstack-langgraph](https://pypi.org/project/hyperstack-langgraph/) | 1.4.0 | LangGraph integration |

---

## Links

- 🌐 **Hosted version**: [cascadeai.dev](https://cascadeai.dev)
- 📦 **Docker image**: `ghcr.io/deeqyaqub1-cmd/hyperstack:latest`
- 🐛 **Issues**: [github.com/deeqyaqub1-cmd/hyperstack-core/issues](https://github.com/deeqyaqub1-cmd/hyperstack-core/issues)
- 📧 **Contact**: deeq.yaqub1@gmail.com

---

*Built by a solo founder. No VC funding. No bloat. Just a better memory layer.*
