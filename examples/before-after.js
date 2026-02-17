/**
 * example-before-after.js
 * 
 * Side-by-side: markdown files vs HyperStack
 * 
 * THE PROBLEM:
 * Your 3 OpenClaw agents coordinate via shared markdown files.
 * Agent A appends to DECISIONS.md. Agent B reads it. Agent C greps for blockers.
 * 
 * Question: "What blocks the production deploy?"
 * Old way: grep -r "blocks.*deploy" *.md → fragile, returns text blobs
 * New way: hs.blockers("deploy-prod") → exact typed cards
 */

import { HyperStackClient } from "hyperstack-core";

const hs = new HyperStackClient({ workspace: "demo" });

async function main() {
  // ─── What agents used to write in DECISIONS.md ────────
  //
  // # DECISIONS.md
  // - 2026-02-15: Use Clerk for auth (coder-agent)
  //   Rationale: Better DX, lower cost, native Next.js support
  //
  // - 2026-02-15: Deploy needs auth migration first (deploy-agent)
  //   Migration to Clerk must complete before we can deploy v2
  //
  // - 2026-02-16: Staging tests failing, blocks deploy (ops-agent)
  //   3 integration tests broken after Clerk middleware change

  // ─── Same info, structured as typed cards ─────────────

  await hs.store({
    slug: "decision-use-clerk",
    title: "Use Clerk for auth",
    body: "Better DX, lower cost, native Next.js support. Chose over Auth0 and NextAuth.",
    cardType: "decision",
    keywords: ["clerk", "auth", "auth0"],
    links: [
      { target: "agent-coder", relation: "decided" },
      { target: "auth-api", relation: "triggers" },
    ],
  });

  await hs.store({
    slug: "migration-clerk",
    title: "Auth migration to Clerk",
    body: "Migration to Clerk must complete before v2 deploy. Estimated 2 days.",
    cardType: "workflow",
    keywords: ["migration", "clerk", "deploy"],
    links: [
      { target: "deploy-prod", relation: "blocks" },
      { target: "decision-use-clerk", relation: "depends_on" },
    ],
  });

  await hs.store({
    slug: "staging-tests-broken",
    title: "3 integration tests failing after Clerk middleware",
    body: "Tests auth-flow-1, auth-flow-2, session-persist broken. Clerk middleware changed req.auth shape.",
    cardType: "event",
    keywords: ["tests", "staging", "broken", "clerk"],
    links: [
      { target: "deploy-prod", relation: "blocks" },
      { target: "migration-clerk", relation: "related" },
    ],
  });

  await hs.store({
    slug: "deploy-prod",
    title: "Deploy v2 to production",
    body: "Production deploy of v2 with new auth system.",
    cardType: "workflow",
    keywords: ["deploy", "production", "v2"],
  });

  // ─── Now ask: "What blocks the production deploy?" ────

  console.log('Question: "What blocks the production deploy?"\n');

  console.log("Old way (grep DECISIONS.md):");
  console.log('  $ grep -r "blocks.*deploy" *.md');
  console.log('  DECISIONS.md:- Deploy needs auth migration first');
  console.log('  DECISIONS.md:- Staging tests failing, blocks deploy');
  console.log("  → Text blobs. No structure. Which is resolved? Who owns it?\n");

  console.log("New way (HyperStack):");
  const result = await hs.blockers("deploy-prod");
  console.log(`  ${result.blockers?.length || 0} typed blockers:`);
  for (const b of result.blockers || []) {
    console.log(`    [${b.slug}] ${b.title} (${b.cardType})`);
  }
  console.log("  → Exact cards. Typed relations. Queryable.\n");

  // ─── Bonus: follow the decision trail ─────────────────

  console.log('Bonus: "Why did we choose Clerk?"');
  const search = await hs.search("clerk decision rationale");
  const decision = search.results?.[0];
  if (decision) {
    console.log(`  [${decision.slug}] ${decision.title}`);
    console.log(`  ${decision.body}`);
    if (decision.links?.length) {
      console.log(`  Links: ${decision.links.map(l => `${l.relation}→${l.target}`).join(", ")}`);
    }
  }
}

main().catch(err => console.error(err.message));
