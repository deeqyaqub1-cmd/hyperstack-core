/**
 * hyperstack-core — HyperStack SDK for typed graph memory
 * 
 * Lightweight client for the HyperStack API. Works in Node.js 18+.
 * No dependencies. Used by the OpenClaw adapter and CLI.
 */

const DEFAULT_BASE = "https://hyperstack-cloud.vercel.app";

// ESM-compatible sync file reading
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

function loadCredApiKey() {
  try {
    const credFile = join(homedir(), ".hyperstack", "credentials.json");
    if (existsSync(credFile)) {
      const creds = JSON.parse(readFileSync(credFile, "utf-8"));
      if (creds.api_key) return creds.api_key;
    }
  } catch {}
  return "";
}

class HyperStackClient {
  /**
   * @param {object} opts
   * @param {string} opts.apiKey — HyperStack API key (hs_...)
   * @param {string} [opts.workspace="default"] — workspace slug
   * @param {string} [opts.baseUrl] — API base URL
   * @param {string} [opts.agentId] — agent identifier for multi-agent setups
   */
  constructor(opts = {}) {
    this.apiKey = opts.apiKey || process.env.HYPERSTACK_API_KEY || loadCredApiKey();
    this.workspace = opts.workspace || process.env.HYPERSTACK_WORKSPACE || "default";
    this.baseUrl = opts.baseUrl || process.env.HYPERSTACK_BASE_URL || DEFAULT_BASE;
    this.agentId = opts.agentId || null;

    if (!this.apiKey) {
      throw new Error(
        "HYPERSTACK_API_KEY required.\n" +
        "Run: npx hyperstack-core login\n" +
        "Or:  export HYPERSTACK_API_KEY=hs_your_key\n" +
        "Get a free account: https://cascadeai.dev/hyperstack"
      );
    }
  }

  /** @private */
  async _request(method, path, body = null) {
    const url = `${this.baseUrl}${path}`;
    const opts = {
      method,
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json",
        "User-Agent": "hyperstack-core/1.0.0",
      },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  // ─── Cards ───────────────────────────────────────────

  /**
   * Create or update a card (upsert by slug).
   * @param {object} card
   * @param {string} card.slug — unique identifier
   * @param {string} card.title — short title
   * @param {string} [card.body] — description (2-5 sentences)
   * @param {string} [card.cardType] — person|project|decision|preference|workflow|event|general
   * @param {string} [card.stack] — projects|people|decisions|preferences|workflows|general
   * @param {string[]} [card.keywords] — search terms
   * @param {Array<{target: string, relation: string}>} [card.links] — typed relations
   * @param {object} [card.meta] — freeform metadata
   * @returns {Promise<{slug: string, updated: boolean}>}
   */
  async store(card) {
    if (!card.slug) throw new Error("card.slug required");
    if (!card.title) throw new Error("card.title required");

    // Auto-tag with agentId if set
    if (this.agentId) {
      card.meta = card.meta || {};
      card.meta.agentId = this.agentId;
      card.keywords = card.keywords || [];
      if (!card.keywords.includes(`agent:${this.agentId}`)) {
        card.keywords.push(`agent:${this.agentId}`);
      }
    }

    return this._request("POST", `/api/cards?workspace=${this.workspace}`, card);
  }

  /**
   * Search cards by query (hybrid semantic + keyword).
   * @param {string} query
   * @returns {Promise<{results: Array}>}
   */
  async search(query) {
    return this._request("GET", `/api/search?workspace=${this.workspace}&q=${encodeURIComponent(query)}`);
  }

  /**
   * List all cards in workspace.
   * @returns {Promise<{cards: Array, count: number, plan: string}>}
   */
  async list() {
    return this._request("GET", `/api/cards?workspace=${this.workspace}`);
  }

  /**
   * Delete a card by slug.
   * @param {string} slug
   * @returns {Promise<{deleted: boolean}>}
   */
  async delete(slug) {
    return this._request("DELETE", `/api/cards?workspace=${this.workspace}&id=${slug}`);
  }

  // ─── Graph ───────────────────────────────────────────

  /**
   * Traverse the knowledge graph from a starting card.
   * @param {string} from — starting card slug
   * @param {object} [opts]
   * @param {number} [opts.depth=1] — hops to traverse (1-3)
   * @param {string} [opts.relation] — filter by relation type
   * @param {string} [opts.type] — filter by card type
   * @param {string} [opts.at] — ISO timestamp for time-travel
   * @returns {Promise<{nodes: Array, edges: Array}>}
   */
  async graph(from, opts = {}) {
    let url = `/api/graph?workspace=${this.workspace}&from=${from}`;
    if (opts.depth) url += `&depth=${opts.depth}`;
    if (opts.relation) url += `&relation=${opts.relation}`;
    if (opts.type) url += `&type=${opts.type}`;
    if (opts.at) url += `&at=${encodeURIComponent(opts.at)}`;
    return this._request("GET", url);
  }

  /**
   * Deterministic impact analysis — reverse traversal.
   * Answers: "what depends on X?" / "what would break if X changed?"
   * 
   * @param {string} slug — the card to analyse
   * @param {object} [opts]
   * @param {number} [opts.depth=2] — hops to traverse upstream (1-3)
   * @param {string} [opts.relation] — filter by relation type (e.g. "blocks", "depends_on")
   * @returns {Promise<{root: string, mode: "impact", nodes: Array, edges: Array}>}
   * 
   * @example
   * // What depends on the billing API?
   * const result = await hs.impact("billing-api", { depth: 2 });
   * // Returns all cards that link TO billing-api, up to 2 hops upstream
   * 
   * @example
   * // What specifically blocks the deploy?
   * const result = await hs.impact("prod-deploy", { relation: "blocks" });
   */
  async impact(slug, opts = {}) {
    const { depth = 2, relation } = opts;
    let url = `/api/graph?workspace=${this.workspace}&from=${slug}&mode=impact&depth=${depth}`;
    if (relation) url += `&relation=${encodeURIComponent(relation)}`;
    return this._request("GET", url);
  }

  // ─── Multi-Agent Helpers ──────────────────────────────

  /**
   * Query cards that block a specific card/task.
   * Shorthand for graph traversal with relation="blocks".
   * @param {string} slug — card being blocked
   * @returns {Promise<{blockers: Array}>}
   */
  async blockers(slug) {
    try {
      const result = await this.graph(slug, { depth: 2, relation: "blocks" });
      const blockers = (result.edges || [])
        .filter(e => e.relation === "blocks" && e.to === slug)
        .map(e => {
          const node = (result.nodes || []).find(n => n.slug === e.from);
          return node || { slug: e.from };
        });
      return { blockers, graph: result };
    } catch (err) {
      // If graph API not available (free tier), fallback to search
      if (err.status === 403) {
        const searchResult = await this.search(`blocks ${slug}`);
        return {
          blockers: (searchResult.results || []).filter(c =>
            c.links?.some(l => l.relation === "blocks" && l.target === slug)
          ),
          fallback: true,
        };
      }
      throw err;
    }
  }

  /**
   * Find cards owned by a specific agent.
   * @param {string} [agentId] — defaults to this.agentId
   * @returns {Promise<{cards: Array}>}
   */
  async agentCards(agentId) {
    const id = agentId || this.agentId;
    if (!id) throw new Error("agentId required");
    return this.search(`agent:${id}`);
  }

  /**
   * Record a decision with full provenance.
   * Creates a decision card + links to who decided and what it affects.
   * @param {object} decision
   * @param {string} decision.slug
   * @param {string} decision.title
   * @param {string} decision.body — rationale
   * @param {string} [decision.decidedBy] — agent/person slug
   * @param {string[]} [decision.affects] — slugs of affected cards
   * @param {string[]} [decision.blocks] — slugs of things this blocks
   * @param {object} [decision.meta]
   */
  async decide(decision) {
    const links = [];
    if (decision.decidedBy) {
      links.push({ target: decision.decidedBy, relation: "decided" });
    }
    if (decision.affects) {
      for (const a of decision.affects) {
        links.push({ target: a, relation: "triggers" });
      }
    }
    if (decision.blocks) {
      for (const b of decision.blocks) {
        links.push({ target: b, relation: "blocks" });
      }
    }

    return this.store({
      slug: decision.slug,
      title: decision.title,
      body: decision.body,
      cardType: "decision",
      stack: "decisions",
      links,
      meta: { ...decision.meta, decidedAt: new Date().toISOString() },
      keywords: decision.keywords || [],
    });
  }

  /**
   * Register an agent as a card in the graph.
   * @param {object} agent
   * @param {string} agent.id — unique agent ID
   * @param {string} agent.name — display name
   * @param {string} agent.role — what this agent does
   * @param {string[]} [agent.owns] — slugs this agent owns
   */
  async registerAgent(agent) {
    const links = [];
    if (agent.owns) {
      for (const o of agent.owns) {
        links.push({ target: o, relation: "owns" });
      }
    }

    return this.store({
      slug: `agent-${agent.id}`,
      title: `Agent: ${agent.name}`,
      body: agent.role,
      cardType: "person",
      stack: "people",
      links,
      keywords: ["agent", agent.id, agent.name],
      meta: { agentId: agent.id, registeredAt: new Date().toISOString() },
    });
  }
}

export { HyperStackClient };
export default HyperStackClient;
