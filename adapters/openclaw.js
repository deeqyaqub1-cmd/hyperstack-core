/**
 * hyperstack-core/adapters/openclaw.js
 * 
 * OpenClaw adapter for HyperStack.
 * Replaces GOALS.md / DECISIONS.md with typed graph memory.
 * 
 * Usage in OpenClaw config (openclaw.json):
 * {
 *   "skills": ["hyperstack-core/adapters/openclaw"],
 *   "env": {
 *     "HYPERSTACK_API_KEY": "hs_your_key"
 *   }
 * }
 * 
 * Or use programmatically:
 *   import { createOpenClawAdapter } from "hyperstack-core/adapters/openclaw";
 *   const adapter = createOpenClawAdapter({ agentId: "researcher" });
 */

import { HyperStackClient } from "../src/client.js";

/**
 * Create an OpenClaw-compatible adapter that provides tools
 * for multi-agent coordination via HyperStack.
 * 
 * @param {object} opts
 * @param {string} opts.agentId — this agent's unique ID
 * @param {string} [opts.apiKey] — HyperStack API key
 * @param {string} [opts.workspace] — workspace slug
 */
function createOpenClawAdapter(opts = {}) {
  const agentId = opts.agentId || process.env.OPENCLAW_AGENT_ID || "main";
  
  const client = new HyperStackClient({
    apiKey: opts.apiKey,
    workspace: opts.workspace,
    agentId,
  });

  return {
    client,
    agentId,

    /**
     * Tools that get exposed to the OpenClaw agent.
     * These can be called via OpenClaw's tool system.
     */
    tools: {
      /**
       * Search the shared knowledge graph.
       */
      async hs_search({ query }) {
        const result = await client.search(query);
        const cards = result.results || [];
        if (!cards.length) return { text: "No matching cards found." };

        return {
          text: cards.slice(0, 5).map(c => {
            let line = `[${c.slug}] ${c.title} (${c.cardType || "general"})`;
            if (c.body) line += `\n  ${c.body.slice(0, 200)}`;
            if (c.links?.length) {
              line += `\n  Links: ${c.links.map(l => `${l.relation}→${l.target}`).join(", ")}`;
            }
            return line;
          }).join("\n\n"),
          cards,
        };
      },

      /**
       * Store a card in the shared graph. Auto-tags with agent ID.
       */
      async hs_store({ slug, title, body, type, links, keywords }) {
        const parsedLinks = [];
        if (links) {
          // Accept "target:relation,target:relation" format
          for (const l of (typeof links === "string" ? links.split(",") : links)) {
            if (typeof l === "string") {
              const [target, relation] = l.trim().split(":");
              parsedLinks.push({ target: target.trim(), relation: (relation || "related").trim() });
            } else {
              parsedLinks.push(l);
            }
          }
        }

        const result = await client.store({
          slug,
          title,
          body: body || "",
          cardType: type || "general",
          keywords: typeof keywords === "string" ? keywords.split(",").map(k => k.trim()) : (keywords || []),
          links: parsedLinks,
        });

        return {
          text: `${result.updated ? "Updated" : "Created"} [${slug}]: ${title}`,
          result,
        };
      },

      /**
       * Record a decision with full provenance.
       */
      async hs_decide({ slug, title, rationale, affects, blocks }) {
        const result = await client.decide({
          slug,
          title,
          body: rationale,
          decidedBy: `agent-${agentId}`,
          affects: affects ? (typeof affects === "string" ? affects.split(",").map(s => s.trim()) : affects) : [],
          blocks: blocks ? (typeof blocks === "string" ? blocks.split(",").map(s => s.trim()) : blocks) : [],
        });

        return {
          text: `Decision recorded: [${slug}] ${title} (by ${agentId})`,
          result,
        };
      },

      /**
       * Check what blocks a task/card.
       */
      async hs_blockers({ slug }) {
        const result = await client.blockers(slug);
        const blockers = result.blockers || [];

        if (!blockers.length) {
          return { text: `Nothing blocks [${slug}].`, blockers: [] };
        }

        return {
          text: `${blockers.length} blocker(s) for [${slug}]:\n` +
            blockers.map(b => `  [${b.slug}] ${b.title || "?"}`).join("\n"),
          blockers,
        };
      },

      /**
       * Traverse the graph from a card.
       */
      async hs_graph({ from, depth, relation }) {
        const result = await client.graph(from, {
          depth: depth || 2,
          relation: relation || undefined,
        });

        const nodes = result.nodes || [];
        const edges = result.edges || [];

        if (!nodes.length) {
          return { text: `No graph found from [${from}].`, nodes: [], edges: [] };
        }

        let text = `Graph from [${from}]: ${nodes.length} nodes, ${edges.length} edges\n\n`;
        text += "Nodes:\n" + nodes.map(n =>
          `  [${n.slug}] ${n.title || "?"} (${n.cardType || "?"})`
        ).join("\n");
        text += "\n\nEdges:\n" + edges.map(e =>
          `  ${e.from} --${e.relation}--> ${e.to}`
        ).join("\n");

        return { text, nodes, edges };
      },

      /**
       * List all cards by this agent.
       */
      async hs_my_cards() {
        const result = await client.agentCards(agentId);
        const cards = result.results || [];

        return {
          text: `${cards.length} cards by agent "${agentId}":\n` +
            cards.map(c => `  [${c.slug}] ${c.title}`).join("\n"),
          cards,
        };
      },
    },

    /**
     * Hook: called when agent session starts.
     * Registers the agent and loads relevant context.
     */
    async onSessionStart({ agentName, agentRole }) {
      // Register this agent in the graph
      await client.registerAgent({
        id: agentId,
        name: agentName || agentId,
        role: agentRole || "OpenClaw agent",
      });

      // Load recent context for this agent
      const context = await client.search(`agent:${agentId}`);
      return {
        cards: context.results || [],
        text: `HyperStack: ${(context.results || []).length} cards loaded for agent "${agentId}"`,
      };
    },

    /**
     * Hook: called when agent session ends.
     * Good place to save working state.
     */
    async onSessionEnd({ summary }) {
      if (summary) {
        await client.store({
          slug: `session-${agentId}-${Date.now()}`,
          title: `Session summary (${agentId})`,
          body: summary.slice(0, 500),
          cardType: "event",
          stack: "general",
          keywords: ["session", "summary"],
        });
      }
    },
  };
}

export { createOpenClawAdapter };
export default createOpenClawAdapter;
