# 12 — MCP Server

> A separate package that exposes LandLens admin operations as Model Context Protocol tools, so Claude Desktop, Claude Code, Cursor, or any other MCP-compatible client can operate LandLens directly.

## Why MCP

LandLens is built so that AI agents are first-class users alongside humans. The [In-App Admin Assistant](./13-admin-assistant.md) handles the in-browser case. The MCP server handles the "I want to drive LandLens from my IDE / desktop" case.

A maintainer sitting in Claude Code can say:

> "How many parcels in Pune district are still flagged unverified, and approve all corrections from Khadki village that have over 90% area overlap with the existing geometry."

…and the model uses MCP tools to actually do it, against the real production database, with admin auth. No copy-pasting, no separate admin dashboard, no clicks.

## Package Layout

The MCP server is a **separate npm package** inside the LandLens monorepo:

```
packages/
  landlens-mcp/
    package.json
    README.md                 ← published-to-npm install instructions
    src/
      server.ts               ← MCP server entry, stdio + HTTP transports
      auth.ts                 ← admin token validation
      tools/
        parcels.ts            ← read queries
        corrections.ts        ← correction queue management
        pipeline.ts           ← scraper / AI job triggers
        exports.ts            ← bulk export + reports
      lib/
        db.ts                 ← Prisma client (read-only or read-write per tool)
```

Why a separate package: it ships independently to npm, has its own version, and can be installed in Claude Desktop without pulling in the whole web app.

## Transports

Two transports, same tool set:

1. **stdio** — for local Claude Desktop / Claude Code installs
2. **Streamable HTTP** — for remote use at `mcp.land.trenlens.com`

Local install (Claude Desktop):

```jsonc
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "landlens": {
      "command": "npx",
      "args": ["-y", "landlens-mcp"],
      "env": {
        "LANDLENS_ADMIN_TOKEN": "...",
        "LANDLENS_DATABASE_URL": "postgresql://..."
      }
    }
  }
}
```

Remote use (Claude Desktop, any MCP client):

```
URL:  https://mcp.land.trenlens.com
Auth: Bearer <admin token>
```

## Auth

There is one admin token (`MCP_SERVER_ADMIN_TOKEN`, defined in [Deployment](./07-deployment.md#environment-variables)). It is required on every tool call. There is no anonymous tier.

`auth.ts` validates the bearer token on every tool invocation. Rejection returns an MCP error, never silent partial behavior. Tokens can be rotated by changing the env var and redeploying — no schema change.

## Tool Catalog

### Data Queries (read-only)

```ts
search_parcels({ query, filters })
get_parcel({ id })
get_parcel_at_location({ lat, lng })
list_parcels_in_bbox({ bbox, limit })
get_ownership_history({ parcel_id })
```

These hit the same query layer as the public API but with no rate limit and no field masking.

### Admin Operations (write)

```ts
list_pending_corrections({ limit?, district? })
approve_correction({ id, notes? })
reject_correction({ id, reason })
list_unverified_parcels({ max_confidence?, district? })
bulk_mark_verified({ parcel_ids, notes? })
```

Every write tool logs to an audit table (`mcp_audit_log`) with `caller_token_hash`, `tool_name`, `args`, `result_summary`, `timestamp`.

### Data Pipeline

```ts
trigger_segmentation_job({ area, priority? })
get_segmentation_status({ job_id })
ingest_state_data({ state_code, dry_run? })
run_data_quality_check({ scope })
```

These enqueue jobs into the pipeline. The model doesn't wait for completion — it gets a `job_id` and can poll with `get_segmentation_status`.

### Export & Reporting

```ts
export_parcels({ filter, format })       // GeoJSON | KML | CSV
generate_district_report({ district_lgd_code })
get_admin_stats({})
```

Export tools bypass the Phase-1 100-parcel community cap. The MCP user is an admin by definition.

## Schema Discipline

Every tool input is validated with Zod. Every tool output is typed. The tool definitions are generated from the same schemas, so the MCP `listTools` response is always honest about its arguments.

```ts
// tools/corrections.ts
const approveCorrectionInput = z.object({
  id: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});

server.tool(
  'approve_correction',
  'Approve a pending parcel correction. The parcel geometry is updated to the corrected geometry, and the correction is marked approved.',
  approveCorrectionInput,
  async ({ id, notes }) => { /* ... */ }
);
```

## Error Handling

MCP tools return errors using the LandLens structured error format (see [AI-First Architecture](./11-ai-first-architecture.md)):

```jsonc
{
  "error": {
    "code": "CORRECTION_NOT_FOUND",
    "message": "No correction exists with id <uuid>.",
    "suggested_action": "Call list_pending_corrections to see valid IDs.",
    "docs_url": "https://land.trenlens.com/docs/12-mcp-server"
  }
}
```

The `suggested_action` field is for the model, not for humans. It lets the LLM recover without re-asking the user.

## Rate Limiting and Cost

The MCP server has no user-facing rate limit, but every tool call is recorded for cost-attribution. The same `api_usage` table that backs the public API (Phase 2) is used here with `api_key_id = NULL` and `caller_token_hash` distinguishing operators.

## Publishing

The package is published to npm under the LandLens scope:

```
@landlens/mcp
```

CI publishes on every tag matching `mcp-v*` (separate from the web app's version). The README on npm is the install guide for Claude Desktop and Claude Code.

## Security Notes

- Admin token leaks compromise the whole server. Rotate immediately if leaked.
- Do not commit `claude_desktop_config.json` with the token inline.
- Production HTTP transport is behind Cloudflare with WAF rules blocking obvious abuse patterns.
- All write tools require a confirmation field for destructive operations:
  ```ts
  reject_correction({ id, reason, confirm: true })
  ```
  The model has to set `confirm: true` explicitly. This is a small friction that catches accidents.

## What's Next

→ Read [Admin Assistant](./13-admin-assistant.md) for the in-app version that uses the same tool set with a BYOK chat UI.
