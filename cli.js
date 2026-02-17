#!/usr/bin/env node

/**
 * hyperstack-core CLI
 * 
 * Usage:
 *   npx hyperstack-core login                    ← NEW: OAuth device flow
 *   npx hyperstack-core init openclaw-multiagent
 *   npx hyperstack-core search "what blocks deploy"
 *   npx hyperstack-core store --slug task-1 --title "Deploy API" --type task
 *   npx hyperstack-core blockers task-1
 *   npx hyperstack-core graph task-1 --depth 2
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { HyperStackClient } from "./src/client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const command = args[0];

function getFlag(name, fallback = "") {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return args[idx + 1];
}

function help() {
  console.log(`
hyperstack-core — Typed graph memory for AI agents

Commands:
  login               Authenticate via browser (OAuth device flow)
  logout              Remove saved credentials
  init <template>     Initialize a project with a template
  search <query>      Search the knowledge graph
  store               Store a card (use --slug, --title, --body, --type, --links)
  decide              Record a decision (use --slug, --title, --rationale)
  blockers <slug>     Show what blocks a card
  graph <slug>        Traverse graph from a card
  list                List all cards

Templates:
  openclaw-multiagent   Multi-agent coordination for OpenClaw

Options:
  --workspace <slug>  Workspace (default: "default")
  --agent <id>        Agent ID for multi-agent setups

Environment:
  HYPERSTACK_API_KEY      Your API key (or use 'login' command)
  HYPERSTACK_WORKSPACE    Default workspace

Examples:
  npx hyperstack-core login
  npx hyperstack-core init openclaw-multiagent
  npx hyperstack-core store --slug "use-clerk" --title "Use Clerk for auth" --type decision
  npx hyperstack-core blockers deploy-prod
  npx hyperstack-core graph auth-api --depth 2
`);
}

async function init(template) {
  const templatePath = resolve(__dirname, "templates", `${template}.json`);
  if (!existsSync(templatePath)) {
    console.error(`Template "${template}" not found.`);
    console.error("Available: openclaw-multiagent");
    process.exit(1);
  }

  const tmpl = JSON.parse(readFileSync(templatePath, "utf-8"));
  console.log(`\n🃏 HyperStack — ${tmpl.name}\n`);
  console.log(`  ${tmpl.description}\n`);

  // Check for API key (env var or saved credentials)
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log("⚠️  Not authenticated.");
    console.log("   Run: npx hyperstack-core login");
    console.log("   Or:  export HYPERSTACK_API_KEY=hs_your_key\n");
    
    // Still create the config file
    const configDir = ".hyperstack";
    if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
    writeFileSync(
      resolve(configDir, "config.json"),
      JSON.stringify({
        workspace: "default",
        template: template,
        agents: tmpl.agentSetup?.agents || {},
      }, null, 2)
    );
    console.log(`✅ Created .hyperstack/config.json`);
    console.log(`   Set HYPERSTACK_API_KEY and run again to seed starter cards.\n`);
    return;
  }

  const client = new HyperStackClient({
    apiKey: apiKey,
    workspace: getFlag("workspace", "default"),
  });

  // Create starter cards
  console.log("Creating starter cards...\n");
  for (const card of tmpl.starterCards || []) {
    try {
      const result = await client.store(card);
      console.log(`  ✅ [${card.slug}] ${card.title} — ${result.updated ? "updated" : "created"}`);
    } catch (err) {
      console.log(`  ❌ [${card.slug}] ${err.message}`);
    }
  }

  // Register agents if template has them
  if (tmpl.agentSetup?.agents) {
    console.log("\nRegistering agents...\n");
    for (const [id, agent] of Object.entries(tmpl.agentSetup.agents)) {
      try {
        await client.registerAgent({
          id,
          name: id,
          role: agent.role,
        });
        console.log(`  ✅ Agent "${id}" registered (${agent.role.slice(0, 60)})`);
      } catch (err) {
        console.log(`  ❌ Agent "${id}": ${err.message}`);
      }
    }
  }

  // Save config
  const configDir = ".hyperstack";
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
  writeFileSync(
    resolve(configDir, "config.json"),
    JSON.stringify({
      workspace: getFlag("workspace", "default"),
      template: template,
      agents: tmpl.agentSetup?.agents || {},
      cardTypes: tmpl.cardTypes,
      relationTypes: tmpl.relationTypes,
    }, null, 2)
  );

  console.log(`\n✅ HyperStack initialized with "${template}" template`);
  console.log(`   Config: .hyperstack/config.json`);
  console.log(`   Cards: ${(tmpl.starterCards || []).length} starter cards created`);
  console.log(`   Agents: ${Object.keys(tmpl.agentSetup?.agents || {}).length} registered`);

  // Show next steps
  console.log(`
Next steps:

  1. In your OpenClaw config, add HyperStack tools:

     import { createOpenClawAdapter } from "hyperstack-core/adapters/openclaw";
     const adapter = createOpenClawAdapter({ agentId: "researcher" });

  2. Use typed graph instead of DECISIONS.md:

     // Old: append to DECISIONS.md
     // New:
     await adapter.tools.hs_decide({
       slug: "use-clerk",
       title: "Use Clerk for auth",
       rationale: "Better DX, lower cost, native Next.js support",
       affects: "auth-api",
     });

  3. Query the graph:

     await adapter.tools.hs_blockers({ slug: "deploy-prod" });
     // → "2 blockers: [migration-23] needs approval, [auth-api] not deployed"

  Docs: https://cascadeai.dev/hyperstack
  Discord: Share your setup in #multi-agent
`);
}

// ─── Credentials file ─────────────────────────────────

const CRED_DIR = join(homedir(), ".hyperstack");
const CRED_FILE = join(CRED_DIR, "credentials.json");
const BASE_URL = process.env.HYPERSTACK_BASE_URL || "https://hyperstack-cloud.vercel.app";

function loadCredentials() {
  try {
    if (existsSync(CRED_FILE)) {
      const creds = JSON.parse(readFileSync(CRED_FILE, "utf-8"));
      return creds;
    }
  } catch {}
  return null;
}

function saveCredentials(creds) {
  if (!existsSync(CRED_DIR)) mkdirSync(CRED_DIR, { recursive: true });
  writeFileSync(CRED_FILE, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

function deleteCredentials() {
  try {
    if (existsSync(CRED_FILE)) {
      writeFileSync(CRED_FILE, "{}", { mode: 0o600 });
    }
  } catch {}
}

function getApiKey() {
  // Priority: env var > credentials file
  if (process.env.HYPERSTACK_API_KEY) return process.env.HYPERSTACK_API_KEY;
  const creds = loadCredentials();
  if (creds?.api_key) return creds.api_key;
  return null;
}

// ─── Device flow login ────────────────────────────────

async function login() {
  console.log("\n🃏 HyperStack Login\n");

  // Check if already logged in
  const existing = loadCredentials();
  if (existing?.api_key) {
    console.log(`Already logged in as ${existing.user?.email || "unknown"}`);
    console.log(`API key: ${existing.api_key.slice(0, 8)}...`);
    console.log(`Run 'hyperstack-core logout' to sign out.\n`);
    return;
  }

  // Step 1: Request device code
  console.log("Requesting device code...\n");
  let deviceRes;
  try {
    const r = await fetch(BASE_URL + "/api/auth?action=device-code", { method: "POST" });
    deviceRes = await r.json();
    if (!r.ok) {
      console.error("Error:", deviceRes.error || "Failed to get device code");
      console.error("You can also set HYPERSTACK_API_KEY manually.");
      console.error("Get a key at: https://cascadeai.dev/hyperstack\n");
      process.exit(1);
    }
  } catch (err) {
    console.error("Connection error:", err.message);
    console.error("\nFallback: set HYPERSTACK_API_KEY manually.");
    console.error("Get a key at: https://cascadeai.dev/hyperstack\n");
    process.exit(1);
  }

  // Step 2: Show user the code and URL
  console.log("  ┌─────────────────────────────────────┐");
  console.log("  │                                     │");
  console.log(`  │   Code:  ${deviceRes.user_code}              │`);
  console.log("  │                                     │");
  console.log("  └─────────────────────────────────────┘\n");
  console.log("  Open this URL in your browser:\n");
  console.log(`  ${deviceRes.verification_uri_complete}\n`);
  console.log("  Waiting for approval...\n");

  // Try to open browser automatically
  try {
    const { exec } = await import("child_process");
    const url = deviceRes.verification_uri_complete;
    const platform = process.platform;
    if (platform === "darwin") exec(`open "${url}"`);
    else if (platform === "linux") exec(`xdg-open "${url}" 2>/dev/null || echo ""`);
    else if (platform === "win32") exec(`start "${url}"`);
  } catch {}

  // Step 3: Poll for approval
  const pollInterval = (deviceRes.interval || 5) * 1000;
  const maxAttempts = Math.ceil((deviceRes.expires_in || 600) / (deviceRes.interval || 5));
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    await new Promise(r => setTimeout(r, pollInterval));

    try {
      const r = await fetch(BASE_URL + "/api/auth?action=device-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_code: deviceRes.device_code }),
      });
      const data = await r.json();

      if (r.status === 428) {
        // Still pending
        process.stdout.write(".");
        continue;
      }

      if (r.status === 403) {
        console.log("\n\n❌ Device denied. Try again with 'hyperstack-core login'.\n");
        process.exit(1);
      }

      if (r.status === 410) {
        console.log("\n\n⏰ Code expired. Run 'hyperstack-core login' again.\n");
        process.exit(1);
      }

      if (r.ok && data.api_key) {
        // Success!
        saveCredentials({
          api_key: data.api_key,
          user: data.user,
          workspaces: data.workspaces,
          authenticated_at: new Date().toISOString(),
        });

        console.log("\n");
        console.log("  ✅ Logged in as " + data.user.email);
        console.log("  Plan: " + data.user.plan);
        console.log("  Workspaces: " + data.workspaces.map(w => w.slug).join(", "));
        console.log("  Credentials saved to: ~/.hyperstack/credentials.json\n");
        console.log("  You're ready! Try:");
        console.log("  npx hyperstack-core init openclaw-multiagent");
        console.log("  npx hyperstack-core list\n");
        return;
      }

      // Unknown error
      console.error("\n\nUnexpected response:", data);
      process.exit(1);

    } catch (err) {
      // Network error, keep trying
      process.stdout.write("x");
    }
  }

  console.log("\n\n⏰ Timed out. Run 'hyperstack-core login' again.\n");
  process.exit(1);
}

async function logout() {
  const creds = loadCredentials();
  if (!creds) {
    console.log("Not logged in.\n");
    return;
  }
  try {
    writeFileSync(CRED_FILE, "{}", { mode: 0o600 });
  } catch {}
  console.log(`Logged out. Removed ~/.hyperstack/credentials.json\n`);
}

async function run() {
  if (!command || command === "help" || command === "--help" || command === "-h") {
    help();
    return;
  }

  if (command === "login") {
    await login();
    return;
  }

  if (command === "logout") {
    await logout();
    return;
  }

  if (command === "init") {
    const template = args[1];
    if (!template) {
      console.error("Usage: npx hyperstack-core init <template>");
      console.error("Available: openclaw-multiagent");
      process.exit(1);
    }
    await init(template);
    return;
  }

  // All other commands need API key (from env or credentials file)
  const apiKey = getApiKey();
  let client;
  try {
    client = new HyperStackClient({
      apiKey: apiKey,
      workspace: getFlag("workspace", "default"),
      agentId: getFlag("agent", undefined),
    });
  } catch (err) {
    console.error(err.message);
    console.error("\nRun 'npx hyperstack-core login' to authenticate.\n");
    process.exit(1);
  }

  if (command === "search") {
    const query = args.slice(1).filter(a => !a.startsWith("--")).join(" ");
    if (!query) { console.error("Usage: hyperstack-core search <query>"); process.exit(1); }
    const result = await client.search(query);
    const cards = result.results || [];
    if (!cards.length) { console.log("No results."); return; }
    for (const c of cards.slice(0, 10)) {
      console.log(`[${c.slug}] ${c.title} (${c.cardType || "general"})`);
      if (c.body) console.log(`  ${c.body.slice(0, 150)}`);
      if (c.links?.length) console.log(`  Links: ${c.links.map(l => `${l.relation}→${l.target}`).join(", ")}`);
      console.log();
    }
    return;
  }

  if (command === "store") {
    const slug = getFlag("slug");
    const title = getFlag("title");
    if (!slug || !title) { console.error("Required: --slug and --title"); process.exit(1); }
    const result = await client.store({
      slug,
      title,
      body: getFlag("body"),
      cardType: getFlag("type", "general"),
      keywords: getFlag("keywords") ? getFlag("keywords").split(",").map(k => k.trim()) : [],
      links: getFlag("links") ? getFlag("links").split(",").map(l => {
        const [target, relation] = l.trim().split(":");
        return { target, relation: relation || "related" };
      }) : [],
    });
    console.log(`${result.updated ? "Updated" : "Created"} [${slug}]: ${title}`);
    return;
  }

  if (command === "decide") {
    const slug = getFlag("slug");
    const title = getFlag("title");
    if (!slug || !title) { console.error("Required: --slug and --title"); process.exit(1); }
    await client.decide({
      slug,
      title,
      body: getFlag("rationale", getFlag("body", "")),
      affects: getFlag("affects") ? getFlag("affects").split(",").map(s => s.trim()) : [],
      blocks: getFlag("blocks") ? getFlag("blocks").split(",").map(s => s.trim()) : [],
    });
    console.log(`Decision recorded: [${slug}] ${title}`);
    return;
  }

  if (command === "blockers") {
    const slug = args[1];
    if (!slug) { console.error("Usage: hyperstack-core blockers <slug>"); process.exit(1); }
    try {
      const result = await client.blockers(slug);
      const blockers = result.blockers || [];
      if (!blockers.length) { console.log(`Nothing blocks [${slug}].`); return; }
      console.log(`${blockers.length} blocker(s) for [${slug}]:`);
      for (const b of blockers) {
        console.log(`  [${b.slug}] ${b.title || "?"}`);
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
    }
    return;
  }

  if (command === "graph") {
    const from = args[1];
    if (!from) { console.error("Usage: hyperstack-core graph <slug>"); process.exit(1); }
    try {
      const result = await client.graph(from, {
        depth: parseInt(getFlag("depth", "2")),
        relation: getFlag("relation") || undefined,
      });
      console.log(`Graph from [${from}]: ${result.nodes?.length || 0} nodes, ${result.edges?.length || 0} edges\n`);
      for (const n of result.nodes || []) {
        console.log(`  [${n.slug}] ${n.title || "?"} (${n.cardType || "?"})`);
      }
      console.log();
      for (const e of result.edges || []) {
        console.log(`  ${e.from} --${e.relation}--> ${e.to}`);
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
    }
    return;
  }

  if (command === "list") {
    const result = await client.list();
    console.log(`HyperStack: ${result.count ?? 0}/${result.limit ?? "?"} cards (plan: ${result.plan || "?"})\n`);
    for (const c of result.cards || []) {
      console.log(`  [${c.slug}] ${c.title} (${c.cardType || "general"})`);
    }
    return;
  }

  console.error(`Unknown command: ${command}`);
  help();
  process.exit(1);
}

run().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
