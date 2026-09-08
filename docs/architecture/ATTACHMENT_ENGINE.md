# Attachment Engine — Build 45

## Authority

Build 45 is owned by `@github-decrypter/chat` for the environment-neutral attachment contract and by `apps/local` for durable local payload persistence.

Canonical schemas:

- `gd-attachment/1`
- `gd-attachment-ingestion/1`
- `gd-local-attachment-store/1`

## Purpose

The Attachment Engine accepts bounded binary payloads, assigns canonical attachment identity, validates metadata, computes a SHA-256 digest, and binds every attachment to the same workspace and conversation authority introduced in Build 44.

Supported semantic kinds are `image`, `document`, `code`, `log`, `screenshot`, `structured-data`, `audio`, and `media`. A kind indicates user intent/classification only. Build 45 does not decode or semantically interpret the payload.

## Conversation and voice model

An attachment always carries the canonical `workspaceId` and `conversationId`. It may optionally carry a canonical conversation `messageId` when the attachment belongs to a committed text turn.

Audio/voice uses the **same conversation** and project context. Build 45 does not create a voice conversation, voice session authority, or alternate state store. Voice is another input channel attached to the existing conversation model.

No OCR or speech-to-text is performed by this Build. There is no microphone capture, streaming voice transport, synthesized speech, or direct AI-provider execution.

## Integrity and limits

- maximum payload size: 32 MiB (`33,554,432` bytes)
- maximum canonical filename length: 255 characters
- payload digest: SHA-256 using Web Crypto in the environment-neutral core
- image/screenshot kinds require an `image/*` media type
- audio kind requires an `audio/*` media type
- path separators and control characters are rejected from attachment names
- payload verification recomputes size and digest before local persistence

The engine does not claim unlimited storage, media support, model context, transcription, or multimodal-model compatibility.

## Durable local store

`apps/local/src/attachment-store.ts` persists attachments under an explicitly supplied canonical root. Each attachment is written to a temporary private directory containing:

- `metadata.json`
- `content.bin`

The temporary directory is renamed to the canonical attachment directory only after both files are written. This provides an atomic same-filesystem commit boundary. Loaded bytes are revalidated against the canonical descriptor before use.

The store refuses persistence when:

- the referenced conversation does not exist;
- the attachment workspace differs from the conversation workspace;
- an optional `messageId` does not belong to that conversation;
- the payload size/digest differs from the descriptor;
- the canonical attachment already exists;
- the conversation already has 256 persisted attachments.

The Attachment Store does not create Durable Jobs and exposes no HTTP/RPC endpoint in Build 45.

## Explicit non-authorities

Build 45 does **not** own:

- attachment semantic extraction or document parsing;
- OCR;
- speech-to-text/transcription;
- microphone or audio streaming transport;
- multimodal AI Provider execution;
- automatic injection of attachments into model prompts;
- project-aware mention resolution — **Build 46 — Context Mentions**;
- Jobs Center or attachment-backed job execution — Build 47;
- Project Memory — Build 66;
- final Context Engine — Build 67;
- deployment, release, DNS, Chrome Store, Supabase, or production mutation.

Build 46 may resolve project-aware mentions while consuming attachment identity where appropriate, but it must not replace the Attachment Engine as the owner of binary ingestion or attachment integrity.
