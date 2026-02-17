/**
 * example-openclaw-multiagent.js
 * 
 * Complete example: 3 OpenClaw agents coordinating via HyperStack
 * instead of GOALS.md + DECISIONS.md files.
 * 
 * Run: HYPERSTACK_API_KEY=hs_your_key node example-openclaw-multiagent.js
 */

import { HyperStackClient } from "hyperstack-core";

const hs = new HyperStackClient({ workspace: "my-project" });

// ─── Step 1: Register your agents ──────────────────────

async function setup() {
  // Register each agent as a card in the graph
  await hs.registerAgent({
    id: "coordinator",
    name: "Coordinator",
    role: "Routes tasks, monitors blockers, prevents duplicate work",
  });

  await hs.registerAgent({
    id: "researcher",
    name: "Research Agent",
    role: "Investigates technical questions, stores findings",
    owns: ["project-root"],
  });

  await hs.registerAgent({
    id: "builder",
    name: "Builder Agent",
    role: "Implements code, records architecture decisions",
  });

  // Create project root
  await hs.store({
    slug: "project-root",
    title: "SaaS Dashboard Project",
    body: "Next.js 14 + Clerk auth + Neon PostgreSQL. Deploying to Vercel.",
    cardType: "project",
    stack: "projects",
    keywords: ["project", "saas", "dashboard", "nextjs"],
  });

  console.log("✅ Setup complete: 3 agents + project root");
}

// ─── Step 2: Researcher investigates auth options ──────

async function researcherFlow() {
  const researcher = new HyperStackClient({
    workspace: "my-project",
    agentId: "researcher",
  });

  // Check if someone already researched this
  const existing = await researcher.search("authentication options");
  if (existing.results?.length) {
    console.log("📋 Already researched:", existing.results[0].title);
    return; // No duplicate work!
  }

  // Store findings
  await researcher.store({
    slug: "finding-clerk-pricing",
    title: "Clerk pricing: free to 10K MAU",
    body: "Clerk offers free tier up to 10,000 monthly active users. After that $0.02/MAU. Auth0 starts charging at 7,500 MAU at $23/mo. For our expected 5K users, Clerk is free vs Auth0 $23/mo.",
    cardType: "event",
    stack: "general",
    keywords: ["clerk", "auth0", "pricing", "authentication"],
    links: [{ target: "project-root", relation: "related" }],
  });

  await researcher.store({
    slug: "finding-nextauth-deprecated",
    title: "NextAuth.js → Auth.js migration ongoing",
    body: "NextAuth.js is being renamed to Auth.js. Migration guide exists but community reports rough edges with App Router. Not recommended for new projects right now.",
    cardType: "event",
    stack: "general",
    keywords: ["nextauth", "authjs", "migration", "risk"],
    links: [{ target: "project-root", relation: "related" }],
  });

  console.log("✅ Researcher stored 2 findings");
}

// ─── Step 3: Builder makes a decision based on research ─

async function builderFlow() {
  const builder = new HyperStackClient({
    workspace: "my-project",
    agentId: "builder",
  });

  // Search for research findings before deciding
  const research = await builder.search("authentication pricing comparison");
  console.log(`📋 Builder found ${research.results?.length || 0} relevant cards`);

  // Make and record a decision
  await builder.decide({
    slug: "decision-use-clerk",
    title: "Use Clerk for authentication",
    body: "Based on research: Clerk free at our scale (<10K MAU), better Next.js integration than Auth0, and NextAuth.js has migration risks. Clerk is the clear choice.",
    decidedBy: "agent-builder",
    affects: ["project-root"],
    keywords: ["clerk", "auth", "decision"],
  });

  // Record the implementation task
  await builder.store({
    slug: "task-clerk-integration",
    title: "Integrate Clerk with Next.js App Router",
    body: "Install @clerk/nextjs, configure middleware, add sign-in/sign-up pages, protect API routes.",
    cardType: "workflow",
    stack: "workflows",
    keywords: ["clerk", "integration", "nextjs", "task"],
    links: [
      { target: "decision-use-clerk", relation: "depends_on" },
      { target: "agent-builder", relation: "assigned_to" },
    ],
  });

  // Record a blocker
  await builder.store({
    slug: "blocker-env-vars",
    title: "Need Clerk API keys from team lead",
    body: "Cannot proceed with Clerk integration until CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY are provided.",
    cardType: "event",
    stack: "general",
    keywords: ["blocker", "clerk", "env", "keys"],
    links: [
      { target: "task-clerk-integration", relation: "blocks" },
    ],
  });

  console.log("✅ Builder: decision recorded, task created, blocker flagged");
}

// ─── Step 4: Coordinator checks status ─────────────────

async function coordinatorFlow() {
  const coordinator = new HyperStackClient({
    workspace: "my-project",
    agentId: "coordinator",
  });

  // What blocks the Clerk integration?
  const blockers = await coordinator.blockers("task-clerk-integration");
  console.log(`\n🚧 Blockers for Clerk integration: ${blockers.blockers?.length || 0}`);
  for (const b of blockers.blockers || []) {
    console.log(`   [${b.slug}] ${b.title}`);
  }

  // Full graph from project root
  try {
    const graph = await coordinator.graph("project-root", { depth: 2 });
    console.log(`\n📊 Project graph: ${graph.nodes?.length || 0} nodes, ${graph.edges?.length || 0} edges`);
    for (const e of graph.edges || []) {
      console.log(`   ${e.from} --${e.relation}--> ${e.to}`);
    }
  } catch (err) {
    // Graph traversal needs Pro plan
    if (err.status === 403) {
      console.log("\n📊 Graph traversal requires Pro plan. Using search fallback.");
      const all = await coordinator.list();
      console.log(`   Total cards: ${all.count}`);
    }
  }

  // Check: has anyone already done research on databases?
  const dbResearch = await coordinator.search("database postgresql selection");
  if (!dbResearch.results?.length) {
    console.log("\n⚠️  No database research found. Assigning to researcher.");
    await coordinator.store({
      slug: "task-research-database",
      title: "Research database options (Neon vs Supabase vs PlanetScale)",
      body: "Need comparison of managed PostgreSQL options for our Next.js project. Consider: pricing, connection pooling, branching, edge compatibility.",
      cardType: "workflow",
      stack: "workflows",
      keywords: ["database", "research", "neon", "supabase", "planetscale"],
      links: [
        { target: "agent-researcher", relation: "assigned_to" },
        { target: "project-root", relation: "related" },
      ],
    });
  }
}

// ─── Run the full flow ─────────────────────────────────

async function main() {
  console.log("🃏 HyperStack Multi-Agent Demo\n");

  await setup();
  console.log();

  await researcherFlow();
  console.log();

  await builderFlow();
  console.log();

  await coordinatorFlow();

  console.log("\n✅ Demo complete. All agents share one typed graph.");
  console.log("   No DECISIONS.md. No GOALS.md. Just queryable cards + relations.");
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
