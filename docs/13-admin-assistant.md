# 13 — Admin Assistant

> A chat interface inside the LandLens web app where admins drive the platform with natural language. Bring Your Own Key (BYOK) — admins paste their own LLM API key. Same tools as the [MCP Server](./12-mcp-server.md), different surface.

## Why This Exists

Not every admin runs Claude Desktop or Cursor. Some want to triage corrections from a phone, on a train, with no local setup. The in-app assistant is the answer.

It also doubles as the demo surface — when we show LandLens to a potential partner, the assistant is what makes "AI-first" tangible.

## What It Looks Like

A page at `/admin/assistant`:

```
┌────────────────────────────────────────────────┐
│ LandLens Admin Assistant                       │
│ ──────────────────────────────────────────────│
│ Using Claude Sonnet 4.6 · your key            │
│                                                │
│ > How many corrections are pending in Pune?    │
│                                                │
│   Calling list_pending_corrections...          │
│                                                │
│   There are 23 pending corrections in Pune     │
│   district. 17 are from Khadki village.        │
│   Would you like me to review them?            │
│                                                │
│ > Yes, approve any with area delta under 5%    │
│                                                │
│   Calling list_pending_corrections,            │
│   then approve_correction (×12)...             │
│                                                │
│   Approved 12 corrections. 11 remain pending   │
│   with area deltas above 5%. Want a summary?   │
│                                                │
│ [textbox: type a message]              [send] │
└────────────────────────────────────────────────┘
```

## BYOK — Bring Your Own Key

LandLens does not pay for the LLM. The admin does. Reasons:

- LandLens stays free to host during Phase 1
- Admin chooses their preferred model (Claude / GPT / Gemini / Mistral)
- No central LLM bill that could be abused
- Compliance: the admin's prompts and data never touch a LandLens-owned LLM contract

The admin pastes their key once at `/admin/api-keys`. It is encrypted and stored. They can rotate or delete it at any time.

## Provider Abstraction: Vercel AI SDK

```bash
npm install ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google
```

The Vercel AI SDK normalizes provider differences. The assistant code is provider-agnostic:

```ts
// app/api/chat/route.ts
import { streamText } from 'ai';
import { resolveProvider } from '@/lib/ai/providers';

export async function POST(req: Request) {
  const { messages, provider, model } = await req.json();
  const sdkProvider = await resolveProvider(provider, req); // decrypts BYOK key

  const result = streamText({
    model: sdkProvider(model),
    system: SYSTEM_PROMPT,
    messages,
    tools: ADMIN_TOOLS,        // same definitions as MCP
    toolChoice: 'auto',
  });

  return result.toDataStreamResponse();
}
```

Adding a new provider is a one-file change in `lib/ai/providers.ts`.

## Same Tools as MCP

The tool definitions live in `lib/ai/tools.ts` and are imported by **both** the assistant API route and the MCP package. One source of truth.

```
search_parcels
get_parcel
get_parcel_at_location
list_parcels_in_bbox
get_ownership_history

list_pending_corrections
approve_correction
reject_correction
list_unverified_parcels
bulk_mark_verified

trigger_segmentation_job
get_segmentation_status
ingest_state_data
run_data_quality_check

export_parcels
generate_district_report
get_admin_stats
```

When we add a new tool, both surfaces gain it automatically.

## BYOK Encryption

Keys are encrypted with Supabase Vault (`pgsodium`) and stored in `admin_api_keys.encrypted_key BYTEA` (see [Database Schema](./02-database-schema.md#admin_api_keys--byok-encryption)).

```sql
INSERT INTO admin_api_keys (user_id, provider, encrypted_key, key_label)
VALUES (
  '...',
  'anthropic',
  pgsodium.crypto_aead_det_encrypt(
    convert_to($1, 'utf8'),
    convert_to('', 'utf8'),
    'admin_api_keys'::pgsodium.key_id
  ),
  'My Claude key'
);
```

Decryption happens **only** in the admin's session, in-memory, and never logged. The decrypted key is held for the duration of one chat request, then released.

Anti-patterns we explicitly avoid:

- Storing plaintext anywhere — including logs, metrics, error traces
- Sending the key to any third party other than the LLM provider it's for
- Caching the decrypted key across requests
- Including the key in client-bundled JS (it stays server-side)

## Conversation Storage

Conversations are stored for the admin's reference:

```
admin_assistant_conversations (id, user_id, title, created_at)
admin_assistant_messages      (id, conversation_id, role, content, tokens_used, created_at)
```

Stored: user prompts, assistant replies, tool calls and tool results. Not stored: the decrypted API key, model logits, anything in `Authorization` headers.

The admin can delete a conversation at any time. Hard-delete cascades from `admin_assistant_conversations`.

## Streaming

Responses stream via Server-Sent Events. `/app/api/chat/route.ts` returns `result.toDataStreamResponse()`; the client uses `useChat()` from `ai/react`. Tool calls stream as part of the same SSE so the UI can render "Calling X..." immediately.

## System Prompt

The system prompt establishes:

- Persona: "You are LandLens's admin assistant. You help the admin operate the cadastral platform."
- Capabilities: enumerated tool list with example use cases
- Safety: "Confirm before destructive operations (rejecting corrections, bulk operations on more than 10 records)."
- Provenance: "When you report numbers, cite the tool you got them from."
- Locale: "Reply in the admin's UI locale."

The full system prompt lives in `lib/ai/system-prompt.ts` and is version-controlled. Changes go through PR review.

## Confirmation Pattern for Destructive Actions

Tools that modify many records or are hard to reverse require an explicit confirmation flag:

```ts
bulk_mark_verified({ parcel_ids: [...], notes: '...', confirm: true })
```

The model is instructed in the system prompt to ask the admin before setting `confirm: true`. The UI also pops a one-time modal showing the affected count before any tool call with `confirm: true` is dispatched.

This is belt-and-suspenders: model behavior + UI gate. Either alone is insufficient.

## Cost Visibility

Every assistant response shows token counts and an estimated cost based on the provider's published per-token rate. The admin always knows what they're spending. Daily totals are surfaced on `/admin/api-keys`.

## When the Assistant Refuses

Tools have explicit error codes. The system prompt instructs the model to:

- Report the `code` and the `suggested_action` verbatim
- Not retry destructive operations without re-asking
- Not invent data when a tool returns nothing

If the admin asks for something that isn't covered by a tool, the model says so plainly rather than fabricating a workaround.

## Future: Multi-Admin Conversations

Phase 2 idea: shareable conversation links so two admins can co-review a correction queue. Not built yet; mentioned here to flag that `admin_assistant_conversations.user_id` may become `owner_user_id` with a separate `conversation_participants` table.

## What's Next

→ Read [Licensing & Commercial](./14-licensing.md) for how LandLens transitions to a paid product.
