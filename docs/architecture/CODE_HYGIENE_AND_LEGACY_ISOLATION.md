# Code Hygiene & Legacy Isolation

Status: **Architecture doctrine — Amendment 009**

## Core rule

> **Git stores history. Active source stores the current implementation.**

Vortex must not preserve obsolete behavior inside active runtime paths merely because it may be useful someday.

## Legacy migration lifecycle

```text
legacy owner
   |
identify behavior/contracts/data
   |
modern owner implementation
   |
equivalence + migration evidence
   |
cut dependency on legacy behavior
   |
remove/quarantine obsolete implementation
```

A migration is incomplete while the modern implementation silently calls back into the legacy implementation for canonical behavior.

### Allowed during migration

- explicit adapters at a documented boundary;
- data migration readers;
- compatibility shims with owner + reason + removal condition;
- comparison harnesses used to prove equivalence;
- read-only legacy fixtures used by tests.

### Not allowed as steady state

- two active implementations deciding the same rule;
- fallback to old behavior because the new path is incomplete;
- new modules importing legacy roots permanently;
- dead exports/branches kept "for safety";
- duplicate code paths where only one is authoritative;
- compatibility shims with no removal condition.

## Comment doctrine

The best comment explains **why the code must be this way**, not what the syntax is doing.

### Keep

```ts
// The provider may report a smaller context window after model fallback.
// Re-evaluate fit before retrying to avoid a guaranteed overflow.
```

```ts
// Security invariant: the host owns the displayed operation label.
// Caller-supplied text is untrusted and cannot describe destructive consent.
```

### Remove

```ts
// Increment counter
counter += 1;
```

```ts
// OLD CODE - keep in case we need it
// legacyExecute(...)
```

```ts
// Fixed this in Build 67 because the old thing broke
```

Git already records old code and commit history.

## TODO / FIXME / HACK

Temporary markers are allowed only when all of the following are true:

- the condition is genuinely temporary;
- an owner/reference is traceable;
- the removal condition is clear;
- it does not hide an RC-blocking correctness/security issue.

Preferred form is a tracked task/issue or structured project work item rather than an anonymous source comment.

## Canonical truth

Comments never become an authority layer.

Business/product behavior belongs in Product Contract/requirements and executable acceptance evidence.

Architecture/security invariants belong in policy/contracts/Guardian and tests.

Schemas/protocol behavior belongs in machine-readable definitions.

Comments may explain these rules locally but may not redefine them.

## Review expectations

Strachey should avoid introducing comment noise or legacy coupling while implementing.

Weizenbaum should reject:

- unnecessary commentary;
- commented-out code;
- duplicate/superseded behavior;
- accidental legacy dependencies;
- compatibility shims without exit criteria.

Heimdall should treat active dual ownership and legacy dependency leakage as architecture drift.

Build 107 Health Score should surface dead/legacy accumulation, duplicated implementation responsibility and comment/TODO hygiene debt.

Build 124 CI may add language-aware/static checks for commented-out code, unowned TODO/FIXME/HACK markers, dead code and duplicate implementations where detection is reliable.

Build 133 RC blocks known unresolved legacy interference or comment-based hidden product/security truth.
