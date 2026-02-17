/**
 * hyperstack-core
 * 
 * Typed graph memory for AI agents.
 * 
 * Usage:
 *   import { HyperStackClient } from "hyperstack-core";
 *   const hs = new HyperStackClient({ apiKey: "hs_..." });
 *   await hs.store({ slug: "use-clerk", title: "Use Clerk for auth", cardType: "decision" });
 *   await hs.blockers("deploy-prod"); // → typed blockers
 * 
 * OpenClaw:
 *   import { createOpenClawAdapter } from "hyperstack-core/adapters/openclaw";
 *   const adapter = createOpenClawAdapter({ agentId: "researcher" });
 */

export { HyperStackClient } from "./src/client.js";
export { createOpenClawAdapter } from "./adapters/openclaw.js";
