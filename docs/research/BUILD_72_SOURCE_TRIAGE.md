# Build 72 — External Source Triage

## ros/diagnostics

Source family selected from the user-provided https://github.com/ros/ organization:
- https://github.com/ros/diagnostics

Status: **AUDITED FOR BUILD 72**

License: **BSD-3-Clause** (verified from repository LICENSE)

Activity at audit time:
- C++ / Python ROS 2 diagnostics stack;
- repository not archived;
- last push observed: 2026-09-10.

Classification: **direct-candidate — selective aggregation/data-model patterns only**

### Useful for Build 72

- normalize diagnostics from many independent producers;
- aggregate multiple sources into one diagnostic view;
- configurable grouping rather than forcing every producer into one schema internally;
- propagate the highest/worst diagnostic severity to a group/toplevel state;
- preserve unmatched diagnostics rather than silently dropping them;
- explicit analyzer/plugin boundary;
- distinguish collection from aggregation from visualization.

### Do not adopt

- ROS topics, nodes, pluginlib, QoS or runtime dependencies;
- robot/hardware-specific schemas;
- remote logging transport;
- ROS UI/runtime packages.

### Vortex adaptation

Problems & Diagnostics will use the aggregation principles only: multiple evidence sources become bounded normalized problem entries; groups expose their highest severity; uncorrelated diagnostics remain visible.

---

## ros/console_bridge

Source:
- https://github.com/ros/console_bridge

Status: **AUDITED AS SECONDARY ROS REFERENCE FOR BUILD 72**

License: **BSD-3-Clause**

Classification: **reference-only**

Useful only as a small example of normalizing logging levels across an external source boundary. Build 72 does not reuse its C++ runtime or logging transport.

---

## dreamsxin/agent-ide

Source: https://github.com/dreamsxin/agent-ide

Status: **AUDITED FOR BUILD 72**

License: **MIT** (verified from repository LICENSE)

Activity at audit time:
- Rust + React/TypeScript/Tauri;
- repository not archived;
- last push observed: 2026-09-27.

Relevant inspected files:
- `src-tauri/src/services/problem_parser.rs`
- `src/stores/useProblemStore.ts`
- `src/components/panels/ProblemsPanel.tsx`
- `src/components/editor/ProblemsMarkerBridge.tsx`

Classification: **direct-candidate — selective problem normalization/source-correlation patterns only**

### Useful for Build 72

- normalize problems to file/line/column/severity/source/message;
- parse common test/runtime output locations;
- bounded rolling text input before parsing;
- deduplicate normalized problems;
- group/sort by severity and source location;
- bridge diagnostics to source locations without making the UI the source of truth;
- distinguish diagnostic/LSP/test/agent/system producers.

### Do not adopt

- Tauri/Rust runtime;
- Monaco/UI implementation;
- Zustand store;
- Agent auto-fix/explain actions;
- its LLM/provider runtime;
- full IDE shell.

### Vortex adaptation

Build 72 uses only the diagnostic-entry shape, bounded parser concepts and source-location correlation ideas. Problems & Diagnostics remains advisory/read-only and does not gain mutation, auto-fix, validation or release authority.

---

## Decision

Build 72 will:
- adapt **ROS diagnostics aggregation principles** and worst-severity propagation;
- adapt **Agent IDE problem normalization and source-location correlation patterns**;
- keep `ros/console_bridge` reference-only;
- add no external runtime dependency;
- preserve Validation Pipeline as the only canonical pass/fail authority;
- preserve Preview Bridge as the browser telemetry owner;
- defer visual Problems panel work.
