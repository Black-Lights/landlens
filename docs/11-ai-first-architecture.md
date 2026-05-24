# 11 — AI-First Architecture

> LandLens is built so that AI agents can read it, understand it, and operate it as first-class users — alongside humans.

## Why This Matters

The world is shifting. Developers no longer just write code — they direct AI agents that write code. Admins no longer just click buttons — they tell AI assistants what they want done. If your app isn't readable and controllable by AI, you're already behind.

LandLens treats this as a design constraint from day one.

## The Three Pillars

### Pillar 1: The MCP Server

MCP (Model Context Protocol) is a standard for AI tool use. We expose LandLens admin operations as an MCP server. Any MCP-compatible AI tool — Claude Code, Claude Desktop, Cursor, custom agents — can connect and operate the platform.

```
You (in Claude Code) ───MCP───▶ landlens-mcp-server ───HTTP───▶ LandLens API
                                                                     │
                                                                     ▼
                                                              Supabase PostGIS
```

**What you can do from Claude Code or Claude Desktop:**

> *"Show me all AI-detected parcels in Pune district with confidence below 0.6. Run quality checks on them. Queue the failing ones for re-segmentation."*

The AI calls these tools in sequence:
1. `list_unverified_parcels(district="pune", max_confidence=0.6)`
2. `run_data_quality_check(parcel_ids=[...])`
3. `trigger_segmentation_job(parcel_ids=[failing ones])`

You review, approve, done. **What used to take half a day takes 5 minutes.**

### Pillar 2: The In-App Admin Assistant

The `/admin/assistant` page in the LandLens web app is a chat interface. You bring your own LLM API key (Anthropic, OpenAI, Google, etc.). The assistant has the same tools as the MCP server.

**Why BYOK (Bring Your Own Key)?**
- Zero cost to LandLens — admins pay their own LLM bills
- No legal liability for AI output — it's their model, their key
- Each admin can pick their preferred provider
- No central API key to leak

**How it's stored:** Encrypted at rest using Supabase Vault (`pgsodium`). Decrypted in-memory only during the admin's session. Never logged.

### Pillar 3: AI-Friendly Design Patterns

Six concrete patterns to bake in everywhere:

#### `llms.txt` at the site root

Like `robots.txt` but for AI agents. A markdown file that tells AI "what this site is and how to use it."

```markdown
# LandLens
> Pan-India cadastral land records platform.

## Core concepts
- Parcels: land plots with polygons and ownership
- Khasra: traditional plot number
- ULPIN: 14-digit national unique ID

## Machine endpoints
- /api/openapi.json — full API spec
- /api/parcels/{id} — single parcel
- /api/parcels/at?lat=X&lng=Y — point lookup

## For AI agents
- MCP server: mcp.land.trenlens.com
- Rate limit: 60 req/min

## Documentation
- Human: /docs
- Machine: /api/openapi.json
```

#### Auto-generated OpenAPI spec

Every Next.js API route is documented automatically. AI agents fetch `/api/openapi.json` and immediately know:
- What endpoints exist
- What parameters they take
- What they return
- What errors are possible

Tools to use: `zod-to-openapi`, `@asteasolutions/zod-to-openapi`, or `next-openapi-gen`.

#### Predictable REST URLs

Bad:
```
POST /api/get_owners
POST /api/getParcelDetails  
POST /api/fetch_history
```

Good:
```
GET /api/parcels/{id}
GET /api/parcels/{id}/owners
GET /api/parcels/{id}/history
```

If an AI sees one URL, it can infer the rest. Predictability = AI productivity.

#### Structured error responses

Bad:
```json
{ "error": "Not found" }
```

Good:
```json
{
  "error": {
    "code": "PARCEL_NOT_FOUND",
    "message": "No parcel exists at coordinates 18.52, 73.85",
    "suggested_action": "Try POST /api/parcels/detect to run AI segmentation",
    "docs_url": "https://docs.landlens.in/errors/PARCEL_NOT_FOUND"
  }
}
```

The AI can recover from errors automatically, even suggest the next call.

#### Idempotent mutations

Every POST/PUT should be safe to retry. If the AI calls "approve correction" twice by accident, the second call should be a no-op, not an error.

Implementation: include an `Idempotency-Key` header. Reject duplicates server-side.

#### Strict types everywhere

Every API has Zod schemas (runtime validation) that also generate TypeScript types. AI agents can introspect these and write correct code without trial-and-error.

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│ HUMAN USERS                                                  │
│ ├── Citizens browsing /                                      │
│ └── Admins in /admin                                         │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ AI USERS                                                     │
│ ├── Claude Code / Cursor / Codex (external) via MCP          │
│ ├── /admin/assistant (in-app, BYOK)                          │
│ └── 3rd-party agents reading /llms.txt + /api/openapi.json   │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────┐
              │  LandLens Web API            │
              │  (Next.js + Zod + OpenAPI)   │
              └──────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────┐
              │  Supabase PostGIS            │
              └──────────────────────────────┘
```

## What's Next

→ Read [MCP Server Details](./12-mcp-server.md) for the implementation.
→ Read [Admin Assistant](./13-admin-assistant.md) for the in-app chat.
