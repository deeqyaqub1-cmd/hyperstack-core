# Self-Hosting HyperStack

Run the full HyperStack backend on your own infrastructure. Point it at your Postgres — done.

Your data never leaves your servers. Full feature parity with the hosted version.

---

## What You Get

Everything in the hosted version, on your own infrastructure:

- ✅ Typed knowledge graph (cards + 10 relation types)
- ✅ Git-style memory branching (fork/diff/merge/discard)
- ✅ Agent identity + trust scoring
- ✅ Time-travel graph reconstruction
- ✅ Provenance layer (confidence, truthStratum, verifiedBy, sourceAgent)
- ✅ Semantic + keyword hybrid search
- ✅ All 14 MCP tools via `hyperstack-mcp`
- ✅ Webhooks, analytics, team workspaces

---

## Prerequisites

- **Docker** — [docs.docker.com/get-docker](https://docs.docker.com/get-docker/)
- **PostgreSQL with pgvector** — recommended providers (all free tier available):
  - [Neon](https://neon.tech) — serverless Postgres, pgvector built-in ✅ recommended
  - [Supabase](https://supabase.com) — managed Postgres, pgvector built-in ✅
  - [Railway](https://railway.app) — simple managed Postgres

---

## Quick Start

**1. Pull the image**
```bash
docker pull ghcr.io/deeqyaqub1-cmd/hyperstack:latest
```

**2. Create your `.env` file**
```bash
cp .env.example .env
# Edit .env — minimum required: DATABASE_URL, JWT_SECRET, OPENAI_API_KEY
```

**3. Run database migrations**
```bash
docker run --rm --env-file .env \
  ghcr.io/deeqyaqub1-cmd/hyperstack:latest \
  npx prisma@6 migrate deploy
```

**4. Start the server**
```bash
docker run -d \
  --name hyperstack \
  -p 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  ghcr.io/deeqyaqub1-cmd/hyperstack:latest
```

**5. Verify**
```bash
curl http://localhost:3000/health
# → {"status":"ok"}
```

---

## Docker Compose (Recommended)

```yaml
# docker-compose.yml
version: "3.9"
services:
  hyperstack:
    image: ghcr.io/deeqyaqub1-cmd/hyperstack:latest
    ports:
      - "3000:3000"
    env_file:
      - .env
    restart: unless-stopped
```

```bash
docker compose run --rm hyperstack npx prisma@6 migrate deploy
docker compose up -d
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string with `?sslmode=require` |
| `JWT_SECRET` | ✅ | Random secret for signing JWTs — `openssl rand -base64 32` |
| `OPENAI_API_KEY` | Recommended | Enables semantic search + embeddings (~$0.39/mo at 1K cards) |
| `GROQ_API_KEY` | Optional | AI-powered workspace onboarding (free tier at console.groq.com) |
| `STRIPE_SECRET_KEY` | Optional | Only needed for paid plan enforcement |
| `STRIPE_WEBHOOK_SECRET` | Optional | Only needed if using Stripe webhooks |
| `PORT` | Optional | Server port (default: `3000`) |

---

## Create Your First Account

```bash
curl -X POST http://localhost:3000/api/auth?action=signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword"}'

# Returns your API key: "hs_..."
```

Use `hs_...` as your `X-API-Key` header or `HYPERSTACK_API_KEY` env var in your SDK.

---

## Connect Your SDK

**MCP (Cursor / Claude Desktop)**
```json
{
  "hyperstack": {
    "command": "node",
    "args": ["/path/to/hyperstack-mcp/index.js"],
    "env": {
      "HYPERSTACK_API_KEY": "hs_your_key",
      "HYPERSTACK_BASE_URL": "http://localhost:3000"
    }
  }
}
```

**Python**
```python
import os
os.environ["HYPERSTACK_BASE_URL"] = "http://localhost:3000"
from hyperstack import HyperStack
hs = HyperStack(api_key="hs_...")
```

**LangGraph**
```python
import os
os.environ["HYPERSTACK_BASE_URL"] = "http://localhost:3000"
from hyperstack_langgraph import HyperStackMemory
```

---

## Production Tips

- Put a reverse proxy (Nginx, Caddy) in front for HTTPS
- Use a managed Postgres (Neon free tier handles most workloads)
- Set `NODE_ENV=production` in your `.env`
- Monitor with `docker logs hyperstack -f`

---

## Prefer Managed?

Use the hosted version at [cascadeai.dev](https://cascadeai.dev) — free tier available, no infrastructure to manage. Same API, same features.

---

## Support

- Issues: [github.com/deeqyaqub1-cmd/hyperstack-core/issues](https://github.com/deeqyaqub1-cmd/hyperstack-core/issues)
- Email: deeq.yaqub1@gmail.com
