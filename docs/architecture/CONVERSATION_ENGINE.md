# Conversation Engine — Build 44

## Ownership

Build 44 introduces the canonical Conversation Engine.

- Core contract owner: `@github-decrypter/chat`
- Core source: `packages/chat/src/index.ts`
- Persistence owner: Local Runtime (`apps/local`)
- Persistence implementation: `apps/local/src/conversation-store.ts`
- Persistence migration: Local SQLite migration 12

The reusable Chat package remains environment-neutral. It does not import SQLite, Node platform APIs, browser APIs, transport clients, Local Runtime, Studio, Extension, tools, Git, or GitHub providers.

## Canonical schemas

- Conversation: `gd-conversation/1`
- Conversation message: `gd-conversation-message/1`
- Conversation dispatch: `gd-conversation-dispatch/1`
- Local persistence store: `gd-local-conversation-store/1`
- Required upstream context: `gd-token-abstraction/1`

## Conversation model

A conversation belongs to one canonical workspace and carries an ordered immutable transcript. Build 44 accepts the roles `user` and `assistant`, limits a conversation to 256 committed messages, and uses caller-supplied canonical IDs and timestamps so the core does not hide randomness or environment authority.

`revision` equals the committed message count. Appends are monotonic and duplicate message IDs are rejected.

## Dispatch compilation

`compileConversationDispatch()` composes the complete committed transcript into the existing AI Provider request contract and binds the dispatch to one canonical `ctxwin-NNNN` envelope from Build 43.

Build 44 follows **full history or reject**. It does not silently truncate, summarize, compress, estimate tokens, claim infinite context, or pretend that unmetered content fits the selected model. The finite-window truth established by Build 43 remains authoritative.

Provider/model IDs are normalized through `@github-decrypter/ai`, but Build 44 does not execute a provider. Provider execution remains outside the reusable Chat core.

## Persistence

The V1 scope requires persistent conversations **independent from job lifecycle**. Build 44 implements that requirement in the Local Runtime SQLite authority.

Migration 12 creates:

- `gd_conversations`
- `gd_conversation_messages`

Both are workspace/conversation scoped. Neither table has a `job_id` column or foreign key to `gd_jobs`.

`LocalConversationStore` provides transactionally consistent create/get/list/append operations. Conversation data therefore survives Local Runtime/database reopen without requiring a Durable Job Engine record.

No generic SQL or conversation HTTP/RPC endpoint is introduced by this build.

## Voice continuity boundary

The conversation contract declares `voiceContextShared: true`: future voice interaction must use the same conversation/context history instead of creating a separate memory silo.

Build 44 does **not** implement voice capture, streaming, speech synthesis, microphone access, or voice transport.

## Deferred authorities

Build 44 deliberately does not implement:

- Build 45 — Attachment Engine
- Build 46 — Context Mentions
- provider execution inside `@github-decrypter/chat`
- Chat Studio transport/UI activation
- voice transport
- tool execution or task scheduling
- project memory/context packs
- Build 66 — Project Memory
- Build 67 — Context Engine vFinal
- deployment/release/domain/Chrome Store/Supabase mutations

Attachment ingestion and mention resolution remain `false` in the Build 44 dispatch contract. Project memory also remains deferred.

## Security and architecture boundary

The Chat package has no network, filesystem, database, browser, secret, process, or tool authority. SQLite remains owned by `apps/local`; the Conversation Store consumes that existing authority instead of duplicating it.

The Build 44 Architecture Guardian (AG420–AG429) locks these ownership and sequencing rules.
