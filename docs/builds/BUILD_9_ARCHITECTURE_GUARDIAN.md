# Build 9 — Architecture Guardian

## Objective

Turn the GitHub Decrypter Constitution, North Star, V1 scope, non-goals and module boundaries into an enforceable architecture gate before privileged runtime implementation begins.

## Delivered

### North Star authority
- adopted `docs/product/NORTH_STAR_MANIFESTO.md` as repository-native normative authority;
- recorded the supplied source SHA-256 for provenance;
- preserved principles P01–P22;
- formalized the paid commercial model and 24-hour trial direction;
- formalized the local-first/no-false-infinite-resource rule.

### Constitutional governance
- added `CONSTITUTION_AMENDMENT_001_NORTH_STAR.md` instead of silently rewriting the frozen Constitution;
- incorporated the 11 owner-authorized North Star capability blocks into V1 planning;
- preserved RFC governance for future ideas not covered by adopted authorities.

### Roadmap integration
- added `NORTH_STAR_ROADMAP_MAPPING.md`;
- preserved canonical Build numbering 1–134;
- mapped adaptive profile, named agents, Mentor, Explain This, voice, Perception, Explore Mode, Visual Mapping, Interactive QA and adaptive explanations to existing owning Builds;
- did not implement those later capabilities early.

### Architecture Guardian
- added machine-readable `architecture.guardian.json`;
- added executable `scripts/architecture-guardian.mjs`;
- added stable violation codes;
- added phase gates for daemon, extension activation, Studio React/Vite and release authority;
- added monorepo import-boundary enforcement;
- added workflow write-permission/release checks;
- added legacy-authority regression checks;
- added North Star authority/provenance/mapping checks;
- added Build-number/version alignment checks.

### Review governance
- added a pull-request template containing the ten North Star review questions;
- made Architecture Guardian and North Star review part of the Global Definition of Done.

## Explicit non-goals

Build 9 does not implement:

- Local Runtime daemon (Build 10);
- SQLite/local persistent database (Build 11);
- durable Job Engine (Build 12);
- capability security model (Build 15);
- extension GitHub activation (Build 25+);
- Studio React/Vite (Build 27+);
- Adaptive User Profile runtime (Build 31/108);
- voice runtime (Build 44/45);
- agent-team runtime (Build 58–64);
- Perception/Explore/Visual Mapping (Build 70/103/104);
- Mentor/Learning Mode (Build 108);
- Release/publication authority.

## Acceptance criteria

Build 9 is accepted only when:

1. Build 4–8 regressions remain green.
2. `pnpm run guardian` exits zero.
3. the Guardian proves all required authority files are present.
4. P01–P22 and all 11 North Star roadmap blocks are detectable.
5. the North Star source SHA-256 is preserved.
6. Protocol and Shared remain environment-neutral.
7. apps/packages do not cross forbidden boundaries.
8. inherited Lovable authority is not reintroduced in active surfaces.
9. workflow write/release authority remains fail-closed.
10. phase-gated later features are still absent.
11. full workspace TypeScript typecheck passes.
12. modern inherited engines required for later migration remain preserved.

## Safety

No Release, OTA, Chrome Store publication, production deployment, production backend mutation or DNS change is authorized or performed by this Build.
