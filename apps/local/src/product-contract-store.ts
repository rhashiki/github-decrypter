import { randomUUID } from 'node:crypto';
import {
  PRODUCT_CONTRACT_SCHEMA,
  type ProductContract,
} from '@github-decrypter/context/final-context';
import type { LocalDatabase } from './database.js';

export interface ProductContractRevision {
  readonly rowId: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly contractId: string;
  readonly revision: number;
  readonly contract: ProductContract;
  readonly storedAt: string;
  readonly supersedesRowId: string | null;
}

export interface ProductContractStoreStatus {
  readonly ready: boolean;
  readonly schemaVersion: number;
  readonly revisionCount: number;
  readonly activeContractCount: number;
  readonly durable: true;
  readonly appendOnly: true;
  readonly localOnly: true;
  readonly productIntentAuthority: true;
  readonly architectureAuthority: false;
  readonly validationAuthority: false;
  readonly externalTransport: false;
}

export interface ProductContractStoreOptions {
  readonly database: LocalDatabase;
  readonly now?: () => string;
  readonly idFactory?: () => string;
}

interface ProductContractRow {
  readonly row_id: unknown;
  readonly workspace_id: unknown;
  readonly project_id: unknown;
  readonly contract_id: unknown;
  readonly revision: unknown;
  readonly contract_json: unknown;
  readonly stored_at: unknown;
  readonly supersedes_row_id: unknown;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error('SQLite returned invalid text for ' + label + '.');
  return value;
}

function integer(value: unknown, label: string): number {
  const normalized = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isSafeInteger(normalized)) throw new Error('SQLite returned invalid integer for ' + label + '.');
  return normalized as number;
}

function nullableText(value: unknown, label: string): string | null {
  return value === null ? null : text(value, label);
}

function assertStoredContract(value: unknown): asserts value is ProductContract {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Stored Product Contract must be an object.');
  }
  const row = value as Record<string, unknown>;
  if (
    row.schema !== PRODUCT_CONTRACT_SCHEMA
    || row.build !== 67
    || row.authoritative !== true
    || row.truthRole !== 'product-intent-authority'
    || row.durable !== true
    || row.architectureAuthority !== false
    || row.gitAuthority !== false
    || row.validationAuthority !== false
    || row.capabilityAuthority !== false
    || row.executionAuthority !== false
  ) {
    throw new Error('Stored Product Contract boundary is invalid.');
  }
  if (
    typeof row.id !== 'string'
    || typeof row.workspaceId !== 'string'
    || typeof row.projectId !== 'string'
    || !Number.isInteger(row.revision)
    || !Array.isArray(row.acceptanceCriteria)
    || !Array.isArray(row.representativeJourneys)
    || !Array.isArray(row.externalDependencies)
  ) {
    throw new Error('Stored Product Contract shape is invalid.');
  }
}

export class ProductContractStore {
  readonly #database: LocalDatabase;
  readonly #now: () => string;
  readonly #idFactory: () => string;
  #ready = false;

  constructor(options: ProductContractStoreOptions) {
    this.#database = options.database;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#idFactory = options.idFactory ?? (() => 'pcontract-rev:' + randomUUID());
  }

  initialize(): ProductContractStoreStatus {
    const schemaVersion = this.#database.status?.schemaVersion ?? 0;
    if (!this.#database.isOpen || schemaVersion < 14) {
      throw new Error('Product Contract Store requires Local Database schema 14 or newer.');
    }
    this.#ready = true;
    return this.status();
  }

  shutdown(): void {
    this.#ready = false;
  }

  status(): ProductContractStoreStatus {
    const schemaVersion = this.#database.status?.schemaVersion ?? 0;
    if (!this.#database.isOpen || schemaVersion < 14) {
      return Object.freeze({
        ready: false,
        schemaVersion,
        revisionCount: 0,
        activeContractCount: 0,
        durable: true,
        appendOnly: true,
        localOnly: true,
        productIntentAuthority: true,
        architectureAuthority: false,
        validationAuthority: false,
        externalTransport: false,
      });
    }

    const summary = this.#database.read((database) => database.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN NOT EXISTS (
          SELECT 1 FROM gd_product_contract_revisions newer
          WHERE newer.supersedes_row_id = current.row_id
        ) THEN 1 ELSE 0 END) AS active
      FROM gd_product_contract_revisions current
    `).get() as unknown as { total: unknown; active: unknown });

    return Object.freeze({
      ready: this.#ready,
      schemaVersion,
      revisionCount: integer(summary.total, 'Product Contract revision total'),
      activeContractCount: integer(summary.active ?? 0, 'Product Contract active total'),
      durable: true,
      appendOnly: true,
      localOnly: true,
      productIntentAuthority: true,
      architectureAuthority: false,
      validationAuthority: false,
      externalTransport: false,
    });
  }

  append(contract: ProductContract, supersedesRowId: string | null = null): ProductContractRevision {
    this.#assertReady();
    assertStoredContract(contract);
    const rowId = this.#idFactory();
    const storedAt = this.#now();

    this.#database.transaction((database) => {
      const workspace = database.prepare('SELECT id FROM gd_workspaces WHERE id = ?')
        .get(contract.workspaceId) as { id?: unknown } | undefined;
      if (!workspace) throw new Error('Product Contract workspace is not registered.');

      const current = database.prepare(`
        SELECT row_id, workspace_id, project_id, contract_id, revision
        FROM gd_product_contract_revisions current
        WHERE current.workspace_id = ? AND current.contract_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM gd_product_contract_revisions newer
            WHERE newer.supersedes_row_id = current.row_id
          )
      `).get(contract.workspaceId, contract.id) as {
        row_id?: unknown; workspace_id?: unknown; project_id?: unknown; contract_id?: unknown; revision?: unknown;
      } | undefined;

      if (current) {
        if (!supersedesRowId) throw new Error('Product Contract active revision must be explicitly superseded.');
        if (text(current.row_id, 'active Product Contract row id') !== supersedesRowId) {
          throw new Error('Product Contract supersedesRowId is not the active revision.');
        }
        if (text(current.project_id, 'active Product Contract project id') !== contract.projectId) {
          throw new Error('Product Contract revision cannot change project.');
        }
        if (integer(current.revision, 'active Product Contract revision') + 1 !== contract.revision) {
          throw new Error('Product Contract revision must increment exactly by one.');
        }
      } else {
        if (supersedesRowId) throw new Error('Product Contract cannot supersede a missing active revision.');
        if (contract.revision !== 1) throw new Error('First Product Contract revision must be revision 1.');
      }

      database.prepare(`
        INSERT INTO gd_product_contract_revisions (
          row_id, workspace_id, project_id, contract_id, revision,
          contract_json, stored_at, supersedes_row_id, truth_role, authoritative
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'product-intent-authority', 1)
      `).run(
        rowId,
        contract.workspaceId,
        contract.projectId,
        contract.id,
        contract.revision,
        JSON.stringify(contract),
        storedAt,
        supersedesRowId,
      );
    });

    const persisted = this.getByRowId(rowId);
    if (!persisted) throw new Error('Product Contract revision disappeared after append.');
    return persisted;
  }

  getByRowId(rowId: string): ProductContractRevision | null {
    if (!this.#database.isOpen || (this.#database.status?.schemaVersion ?? 0) < 14) return null;
    const row = this.#database.read((database) => database.prepare(`
      SELECT row_id, workspace_id, project_id, contract_id, revision,
             contract_json, stored_at, supersedes_row_id
      FROM gd_product_contract_revisions
      WHERE row_id = ?
    `).get(rowId) as unknown as ProductContractRow | undefined);
    return row ? this.#record(row) : null;
  }

  getActive(workspaceId: string, contractId: string): ProductContractRevision | null {
    this.#assertReady();
    const row = this.#database.read((database) => database.prepare(`
      SELECT current.row_id, current.workspace_id, current.project_id, current.contract_id,
             current.revision, current.contract_json, current.stored_at, current.supersedes_row_id
      FROM gd_product_contract_revisions current
      WHERE current.workspace_id = ? AND current.contract_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM gd_product_contract_revisions newer
          WHERE newer.supersedes_row_id = current.row_id
        )
      ORDER BY current.revision DESC
      LIMIT 1
    `).get(workspaceId, contractId) as unknown as ProductContractRow | undefined);
    return row ? this.#record(row) : null;
  }

  history(workspaceId: string, contractId: string, limit = 100): readonly ProductContractRevision[] {
    this.#assertReady();
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new RangeError('Product Contract history limit is invalid.');
    const rows = this.#database.read((database) => database.prepare(`
      SELECT row_id, workspace_id, project_id, contract_id, revision,
             contract_json, stored_at, supersedes_row_id
      FROM gd_product_contract_revisions
      WHERE workspace_id = ? AND contract_id = ?
      ORDER BY revision ASC
      LIMIT ?
    `).all(workspaceId, contractId, limit) as unknown as ProductContractRow[]);
    return Object.freeze(rows.map((row) => this.#record(row)));
  }

  #record(row: ProductContractRow): ProductContractRevision {
    const parsed = JSON.parse(text(row.contract_json, 'Product Contract JSON')) as unknown;
    assertStoredContract(parsed);
    const workspaceId = text(row.workspace_id, 'Product Contract workspace id');
    const projectId = text(row.project_id, 'Product Contract project id');
    const contractId = text(row.contract_id, 'Product Contract id');
    const revision = integer(row.revision, 'Product Contract revision');
    if (
      parsed.workspaceId !== workspaceId
      || parsed.projectId !== projectId
      || parsed.id !== contractId
      || parsed.revision !== revision
    ) {
      throw new Error('Stored Product Contract row metadata does not match contract payload.');
    }
    return Object.freeze({
      rowId: text(row.row_id, 'Product Contract row id'),
      workspaceId,
      projectId,
      contractId,
      revision,
      contract: parsed,
      storedAt: text(row.stored_at, 'Product Contract stored at'),
      supersedesRowId: nullableText(row.supersedes_row_id, 'Product Contract supersedes row id'),
    });
  }

  #assertReady(): void {
    if (!this.#ready) throw new Error('Product Contract Store is not ready.');
  }
}

export function createProductContractStore(options: ProductContractStoreOptions): ProductContractStore {
  return new ProductContractStore(options);
}
