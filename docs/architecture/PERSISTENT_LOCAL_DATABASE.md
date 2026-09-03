# Persistent Local Database

Build 11 establishes the durable local state substrate owned exclusively by `apps/local`.

## Authority

`apps/local` is the only Build 11 authority allowed to import `node:sqlite`.

The browser extension, Studio and reusable packages do not own database connections. They will consume higher-level runtime contracts in later Builds rather than opening the SQLite file directly.

## Engine

GitHub Decrypter uses the SQLite implementation bundled with the project's Node 22 runtime through `node:sqlite`.

No external database server, hosted service, native third-party database package or cloud dependency is required.

## Default storage

The database filename is:

`runtime.sqlite3`

Default data roots follow the operating system:

- Windows: `%LOCALAPPDATA%/GitHub Decrypter/`
- macOS: `~/Library/Application Support/GitHub Decrypter/`
- Linux/Unix: `$XDG_DATA_HOME/github-decrypter/` or `~/.local/share/github-decrypter/`

Overrides:

- `GD_LOCAL_DB_PATH` — explicit database file;
- `GD_LOCAL_DATA_DIR` — explicit data directory when no database file is supplied.

The parent directory is created with restrictive POSIX permissions where supported, and a newly created database file is tightened to mode `0600` on non-Windows systems where the filesystem permits it.

## SQLite policy

On open, the Local Runtime configures:

- `busy_timeout = 5000`;
- `foreign_keys = ON`;
- `trusted_schema = OFF`;
- `synchronous = NORMAL`;
- `journal_mode = WAL`.

An integrity `PRAGMA quick_check` must return `ok` before the database is considered ready.

## Migration authority

`gd_schema_migrations` is the migration ledger. Each version records:

- integer version;
- migration name;
- SHA-256 checksum;
- application timestamp.

Migrations run inside `BEGIN IMMEDIATE` transactions. A migration checksum/name mismatch fails closed instead of silently accepting edited history. A database with a `user_version` newer than the runtime supports also fails closed.

Schema version 1 contains only:

- `gd_schema_migrations`;
- `gd_metadata`.

`gd_metadata` is a small JSON metadata substrate for runtime-owned state. It is not exposed through HTTP/SQL RPC.

## Transaction boundary

`LocalDatabase.transaction()` provides synchronous SQLite transactions with explicit commit/rollback behavior. Async callbacks are rejected because keeping a SQLite transaction open across arbitrary awaited work would create ambiguous ownership and locking behavior.

## Daemon lifecycle

Startup order:

1. enter `starting`;
2. acquire the single-instance runtime lock;
3. open/configure/migrate/check SQLite;
4. publish `gd.local.database.opened`;
5. bind the loopback HTTP server;
6. enter `running`.

Shutdown closes the HTTP server, closes SQLite, emits `gd.local.database.closed`, releases the process lock and then reaches `stopped`.

`/healthz` reports non-sensitive database readiness metadata, not the local filesystem path. `/readyz` requires both the daemon and database to be ready.

## Build boundary

Build 11 intentionally does **not** create:

- job or queue tables;
- durable scheduler state;
- checkpoints or crash-resume records;
- workspace/Git tables;
- secrets;
- audit ledger tables;
- generic SQL/database HTTP endpoints.

Those belong to their owning later Builds. The Architecture Guardian blocks `node:sqlite` outside `apps/local` and blocks Durable Job Engine schema before Build 12.
