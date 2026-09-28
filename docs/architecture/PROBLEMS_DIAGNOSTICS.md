# Problems & Diagnostics

Build 72 introduces the canonical read-only aggregation and source-correlation layer for runtime, browser, test, Preview and Validation evidence.

## Ownership

- contract owner: `@github-decrypter/diagnostics`
- contract source: `packages/diagnostics/src/index.ts`
- Local Runtime projection: `apps/local/src/problems-diagnostics-runtime.ts`
- Tool Runtime: Build 53
- Validation Pipeline: Build 57 remains canonical pass/fail authority
- Preview Bridge: Build 70 remains canonical browser telemetry owner
- Error Intelligence: Build 106 remains canonical root-cause/repair intelligence owner

## Normalized problem model

A diagnostic may contain:

- source: runtime, browser, test, preview or validation;
- severity: info, warning or error;
- bounded message;
- source reference;
- optional diagnostic code;
- optional file/line/column;
- evidence references;
- occurrence count.

Multiple equivalent inputs are deterministically deduplicated while preserving occurrence count and evidence refs.

## Diagnostic text

Build 72 may parse bounded runtime/test text into source locations.

The parser:

- removes ANSI control sequences;
- retains only the bounded tail of large output;
- recognizes common `file:line:column` and `file(line,column)` shapes;
- normalizes file URIs and path separators;
- rejects unsupported/malformed source locations;
- deduplicates results.

Parsing a line is not a root-cause claim.

## Aggregation

Diagnostics are grouped by source and, where available, source file.

Each group propagates the highest observed severity. Diagnostics that cannot be mapped to a source file remain visible instead of being silently discarded.

This follows the useful aggregation model observed in `ros/diagnostics` without adopting ROS runtime, topic, plugin or UI dependencies.

## Correlation

Diagnostics sharing an explicit source file and line may be correlated across producers.

Correlation means only “these observations point to the same source location.” It does not claim that one observation caused another or that the correlated location is the root cause.

## Existing evidence owners

### Preview

Build 72 reads Build 70 Preview telemetry through the existing browser session telemetry snapshot.

It does not:
- create another CDP collector;
- capture request/response bodies or credentials;
- change Preview privacy boundaries.

### Validation

Failed Validation Pipeline criteria may be projected as diagnostic evidence for human/agent inspection.

Build 72 does not revalidate, bless, forge or replace Validation Pipeline records. Its validation authority remains false.

### Capture reports

Failed or inconclusive Build 70 visual-capture reports may become Preview diagnostics. A camera failure cannot become application-validation truth.

## Authority boundaries

Problems & Diagnostics has:
- aggregation authority;
- source-location correlation authority.

It has no:
- mutation authority;
- auto-fix authority;
- root-cause authority;
- validation authority;
- release authority;
- architecture authority;
- persistence authority;
- filesystem/database/network authority.

Build 106 owns root-cause Error Intelligence.

## External-source adoption

Build 72 audited only the sources queued for this Build:

- `ros/diagnostics` — BSD-3-Clause, selective aggregation/data-model patterns;
- `ros/console_bridge` — BSD-3-Clause, reference-only;
- `dreamsxin/agent-ide` — MIT, selective problem normalization/source-location patterns.

No external repository becomes a runtime dependency.

## UI

Build 72 does not implement a Problems panel. Product-wide UI work remains deferred. The contract/runtime are ready for a later presentation layer without making that UI a source of truth.
