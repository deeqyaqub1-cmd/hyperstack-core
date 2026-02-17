# OpenClaw Discord Post (copy-paste ready)

## Channel: #showcase or #multi-agent

---

🃏 **Typed graph memory for multi-agent coordination**

I run 3 OpenClaw agents (researcher, builder, coordinator) and was using GOALS.md + DECISIONS.md to coordinate them. It works, but barely:

```
# DECISIONS.md (append-only)
- 2026-02-15: Use Clerk for auth (coder-agent)
- 2026-02-15: Deploy needs auth migration first (deploy-agent)  
- 2026-02-16: Migration blocks production deploy (ops-agent)
```

Asking "what blocks the production deploy?" means grepping markdown files. Manual. Fragile. Returns text blobs.

I built **hyperstack-core** — an OSS SDK that replaces markdown coordination with typed cards + relations:

```js
import { HyperStackClient } from "hyperstack-core";
const hs = new HyperStackClient({ agentId: "builder" });

// Record a decision (instead of appending to DECISIONS.md)
await hs.decide({
  slug: "use-clerk",
  title: "Use Clerk for auth",
  body: "Better DX, lower cost vs Auth0",
  affects: ["auth-api"],
});

// Record a blocker (typed relation, not a text line)
await hs.store({
  slug: "migration-23",
  title: "Auth migration to Clerk",
  cardType: "task",
  links: [{ target: "deploy-prod", relation: "blocks" }],
});

// Ask: what blocks deploy?
const result = await hs.blockers("deploy-prod");
// → { blockers: [{ slug: "migration-23", title: "Auth migration to Clerk" }] }
```

**Why not just Mem0?** Mem0 returns "17 semantically similar tasks." HyperStack returns exactly the 2 cards with `blocks: deploy-prod`. Typed relations > vector similarity when you need precise answers.

```
npm i hyperstack-core
npx hyperstack-core init openclaw-multiagent
```

- MIT licensed, zero deps, Node 18+
- Free tier: 10 cards
- Includes OpenClaw adapter with agent-aware tools
- CLI for quick queries: `npx hyperstack-core blockers deploy-prod`

GitHub: https://github.com/deeqyaqub1-cmd/hyperstack-core
Docs: https://cascadeai.dev/hyperstack

Built this for my own workflow. Happy to hear what would make it useful for yours.

---

## Shorter version (if channel has length limits):

---

🃏 **hyperstack-core** — typed graph memory for multi-agent coordination

Tired of coordinating agents with DECISIONS.md?

```js
// Instead of grep -r "blocks.*deploy" *.md
const result = await hs.blockers("deploy-prod");
// → exact typed cards, not text blobs
```

`npm i hyperstack-core && npx hyperstack-core init openclaw-multiagent`

MIT | Zero deps | OpenClaw adapter built-in
GitHub: https://github.com/deeqyaqub1-cmd/hyperstack-core

---

## HN Post (for later):

---

**Title:** Typed graph memory for OpenClaw multi-agent coordination (OSS)

**Body:**

OpenClaw users coordinating multiple agents use shared markdown files (GOALS.md, DECISIONS.md) for state. It works, but "what blocks task X?" means grepping text files.

hyperstack-core replaces markdown coordination with typed cards and relations:

- `hs.blockers("deploy-prod")` → exact blockers, not text blobs
- `hs.decide({...affects, blocks})` → decisions with provenance
- `hs.graph("auth-api", {depth: 2})` → traverse the dependency graph
- Auto-tags cards by agent ID → no duplicate work

Zero deps, MIT, backed by PostgreSQL + pgvector. Built this for my own Cursor + Claude + OpenClaw workflow.

npm: `npm i hyperstack-core`  
GitHub: https://github.com/deeqyaqub1-cmd/hyperstack-core
