# Build 45 — Attachment Engine

Status: ✅ IMPLEMENTATION COMPLETE — ACCUMULATED CI GREEN

## Objective

Introduce bounded, integrity-verified attachment ingestion for the same workspace/conversation authority established in Build 44, including supported audio/media ingestion required by the North Star voice mapping, without creating a second voice state authority or prematurely implementing Context Mentions, Jobs, OCR, transcription, provider execution, or Studio transport.

## Implemented scope

- `@github-decrypter/chat` advanced to `0.0.45`
- `@github-decrypter/local` advanced to `0.0.45`
- Local Runtime identity advanced to Build 45 / `0.0.45`
- canonical `gd-attachment/1` contract
- canonical `gd-attachment-ingestion/1` result
- canonical `gd-local-attachment-store/1`
- supported kinds: image, document, code, log, screenshot, structured-data, audio, media
- 32 MiB per-attachment hard limit
- canonical filename/media-type validation
- SHA-256 payload digest and re-verification
- workspace + conversation binding
- optional committed-message binding
- audio uses the same conversation/project context
- no voice-specific state authority
- durable local filesystem store with atomic directory rename commit
- persistence across store/runtime reopen
- payload tamper detection
- maximum 256 persisted attachments per conversation
- no Durable Job creation
- no Attachment RPC
- Architecture Guardian AG430–AG439
- static, TypeScript, runtime and negative-guardian gates
- accumulated Build 4–45 CI workflow
- Build 45 AG435 negative probe made deterministic against the protected persisted-attachment limit

## Correctness boundaries

The Build 45 core treats attachment bytes as opaque binary data. A semantic kind and MIME type classify the payload but do not imply successful decoding, OCR, document parsing, transcription, vision understanding, or model compatibility.

The current AI Provider contract remains text-only. Build 45 therefore does not fabricate multimodal execution. An attachment can be ingested and persisted honestly even when no current provider can interpret that payload.

Voice/audio remains part of the same conversation authority. Build 45 stores audio as a supported attachment kind; it does not create a second conversation, voice session authority, or execution path.

## Explicitly deferred

- **Build 46 — Context Mentions**
- **Build 47 — Jobs Center**
- attachment semantic extraction/document parsing
- OCR
- speech-to-text/transcription
- microphone capture and streaming voice transport
- text-to-speech
- multimodal provider execution
- automatic attachment-to-prompt projection
- Build 66 — Project Memory
- Build 67 — Context Engine vFinal
- deployment/release/tag/DNS/Chrome Store/Supabase/production mutation

## Implementation validation

Implementation head `a827a62d02e834fa596bb33eaabea84ed9bc6678` passed GitHub Actions run `34264991810` with:

1. Architecture Guardian including AG430–AG439 ✅
2. Build 45 static contract gate ✅
3. Build 45 TypeScript gate ✅
4. Build 45 runtime gate ✅
5. Build 45 negative Guardian gate ✅
6. accumulated Builds 4–45 CI ✅
7. all workspace typechecks ✅
8. Build 4 modern-engine preservation ✅

The documentation/roadmap completion head created after this record must pass the same accumulated gate before a protected pull request is opened. The PR historical matrix must then be green on that exact final head before merge.
