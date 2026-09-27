# Build 69 — External Source Triage

## Dheeraj-Kumar-089/flowent

Source: https://github.com/Dheeraj-Kumar-089/flowent

Status: **AUDITED FOR BUILD 69**

Classification: **reference-only**

License: **not declared in the repository at audit time**

Primary language: JavaScript

Observed maintenance state at audit: active/recently pushed, but not mature enough and not permissively licensed enough to become a direct dependency.

### Useful patterns

- stable preview URL per running workspace;
- native Vite HMR rather than host-forced full refresh for ordinary source edits;
- health probing before declaring preview ready;
- long-running session keepalive;
- resume/reconnect semantics after leaving and returning;
- explicit preview lifecycle states;
- fallback recovery when the preview target is temporarily unavailable;
- dedicated browser-tab support as a UX idea for later UI work.

### Do not reuse

- Kubernetes/K3s sandbox architecture;
- AWS EC2/ECR/S3 coupling;
- Redis/Mongo/RabbitMQ operational dependencies;
- permissive wildcard CORS / frame-ancestor relaxation as a default security posture;
- localStorage as the canonical preview-session authority;
- cloud-hosted wildcard-subdomain routing;
- code copied from the repository while no license is declared.

### Vortex adaptation

Build 69 implements the same *product behavior* through the Build 68 local Chromium/CDP Preview Runtime:

- Preview target remains a stable normalized URL;
- HMR is owned by the generated application's dev server when available;
- Vortex observes/probes rather than replacing native HMR;
- readiness is evidence-based;
- Live Preview maintains session state across repeated operations;
- refresh/recovery is bounded and deterministic;
- desktop/tablet/mobile form factors are deterministic;
- visual capture waits for bounded visual settling before evidence is returned;
- no browser mutation bypasses Tool Runtime / Scope Lock.

### Decision

No direct dependency, vendoring or copied implementation.

Flowent is retained as an architectural reference for Live Preview session/HMR/recovery behavior only.
