# Transcript Save Contract (Step 13.10)

## Goal

Define how the iPhone Safari capture frontend saves a completed conversation transcript into the existing raw writing backend flow.

## Authentication

- Use existing Google login + allowlist enforcement.
- Request must include valid backend auth context (same mechanism as current `/writings` endpoint).
- Unauthorized -> `401`.
- Authenticated but not allowlisted -> `403`.

## Endpoint Choice

- Reuse existing endpoint: `POST /writings`.
- Add explicit payload type marker: `kind: "conversation_transcript"`.
- No new endpoint required for v1.

## Request Schema

```json
{
  "kind": "conversation_transcript",
  "content": "# rendered markdown transcript...",
  "meta": {
    "conversationId": "conv-...",
    "provider": "openai",
    "model": "unknown",
    "startedAt": "2026-03-08T18:30:12.123Z",
    "endedAt": "2026-03-08T18:42:09.999Z",
    "messageCount": 24,
    "source": "iphone_safari_extension"
  }
}
```

Notes:
- `content` is the final markdown body (verbatim transcript rendering).
- `meta` is optional for backend storage, but recommended for logs/debug.

## Markdown Rendering Contract

The frontend renders markdown before calling backend.

Required sections:
1. Title line: `# LLM Conversation Transcript`
2. Metadata block:
   - `conversationId`
   - `provider`
   - `model`
   - `startedAt`
   - `endedAt`
   - `messageCount`
3. Transcript body in strict sequence order.

Message format per entry:
- User:
  - `## [N] USER — <timestamp>`
  - raw prompt text verbatim
- Assistant:
  - `## [N+1] ASSISTANT — <timestamp>`
  - raw response text verbatim

## Response Schema

Success (`200`):

```json
{
  "status": "ok",
  "path": "Writing/RawWrittings/2026-03-08-...-conversation.md",
  "commitId": "<git-commit-sha>"
}
```

Error (`4xx/5xx`):

```json
{
  "error": "human-readable message",
  "code": "AUTH_REQUIRED|FORBIDDEN|VALIDATION_ERROR|WRITE_FAILED"
}
```

## Validation Rules (Frontend Before Submit)

- Must have `conversationId`.
- Must have at least 2 messages (1 user + 1 assistant).
- `messages[]` must be ordered by `sequence`.
- `content` must be non-empty markdown.

## Verification Gate for Step 13.10

- Contract doc exists and is committed.
- Frontend and backend both align to `POST /writings` payload shape above.
- Team can run one dry run request and map success/error handling paths.
