import {
  assertCanonicalProductContract,
  type ProductContract,
} from '@github-decrypter/context/project-genesis';
import type { LocalDatabase } from './database.js';

export const PRODUCT_CONTRACT_STORE_BUILD=67 as const;
export const PRODUCT_CONTRACT_STORE_SCHEMA='gd-product-contract-store/1' as const;

export interface ProductContractStoreStatus {
  readonly ready:boolean;
  readonly schema:typeof PRODUCT_CONTRACT_STORE_SCHEMA;
  readonly schemaVersion:number;
  readonly contractCount:number;
  readonly projectCount:number;
  readonly durable:true;
  readonly appendOnly:true;
  readonly authoritative:true;
  readonly localOnly:true;
}

export class ProductContractStore {
  readonly #database:LocalDatabase;
  #ready=false;
  constructor(database:LocalDatabase){this.#database=database;}

  initialize():ProductContractStoreStatus{
    const schemaVersion=this.#database.status?.schemaVersion??0;
    if(!this.#database.isOpen||schemaVersion<14)throw new Error('Product Contract Store requires Local Database schema 14 or newer.');
    this.#ready=true;return this.status();
  }
  shutdown():void{this.#ready=false;}
  status():ProductContractStoreStatus{
    const schemaVersion=this.#database.status?.schemaVersion??0;
    if(!this.#database.isOpen||schemaVersion<14)return Object.freeze({
      ready:false,schema:PRODUCT_CONTRACT_STORE_SCHEMA,schemaVersion,contractCount:0,projectCount:0,durable:true,appendOnly:true,authoritative:true,localOnly:true,
    });
    const row=this.#database.read(db=>db.prepare(
      'SELECT COUNT(*) AS total, COUNT(DISTINCT workspace_id || char(0) || project_id) AS projects FROM gd_product_contracts',
    ).get() as unknown as {total:unknown;projects:unknown});
    return Object.freeze({
      ready:this.#ready,schema:PRODUCT_CONTRACT_STORE_SCHEMA,schemaVersion,
      contractCount:Number(row.total),projectCount:Number(row.projects),durable:true,appendOnly:true,authoritative:true,localOnly:true,
    });
  }

  append(contract:ProductContract):ProductContract{
    this.#assertReady();assertCanonicalProductContract(contract);
    this.#database.transaction(db=>{
      const workspace=db.prepare('SELECT id FROM gd_workspaces WHERE id=?').get(contract.workspaceId);
      if(!workspace)throw new Error('Product Contract workspace is not registered.');
      const existing=db.prepare('SELECT id FROM gd_product_contracts WHERE id=?').get(contract.id);
      if(existing)throw new Error('Product Contract already exists: '+contract.id+'.');
      const latest=db.prepare(
        'SELECT id, revision FROM gd_product_contracts WHERE workspace_id=? AND project_id=? ORDER BY revision DESC LIMIT 1',
      ).get(contract.workspaceId,contract.projectId) as unknown as {id?:unknown;revision?:unknown}|undefined;
      if(contract.revision===1){
        if(latest)throw new Error('Product Contract revision 1 cannot be appended after existing revisions.');
      }else{
        if(!latest||String(latest.id)!==contract.supersedesId||Number(latest.revision)!==contract.revision-1){
          throw new Error('Product Contract revision must supersede the latest contiguous revision.');
        }
      }
      db.prepare(`
        INSERT INTO gd_product_contracts (
          id, workspace_id, project_id, revision, created_at, supersedes_id,
          status, contract_json, authoritative, truth_role
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'product-contract')
      `).run(
        contract.id,contract.workspaceId,contract.projectId,contract.revision,contract.createdAt,contract.supersedesId,
        contract.status,JSON.stringify(contract),
      );
    });
    return this.getById(contract.id)!;
  }

  getById(id:string):ProductContract|null{
    if(!this.#database.isOpen||(this.#database.status?.schemaVersion??0)<14)return null;
    const row=this.#database.read(db=>db.prepare('SELECT contract_json FROM gd_product_contracts WHERE id=?').get(id) as unknown as {contract_json?:unknown}|undefined);
    if(!row||typeof row.contract_json!=='string')return null;
    const contract=JSON.parse(row.contract_json) as unknown;assertCanonicalProductContract(contract);return contract;
  }

  getLatest(workspaceId:string,projectId:string):ProductContract|null{
    this.#assertReady();
    const row=this.#database.read(db=>db.prepare(
      'SELECT contract_json FROM gd_product_contracts WHERE workspace_id=? AND project_id=? ORDER BY revision DESC LIMIT 1',
    ).get(workspaceId,projectId) as unknown as {contract_json?:unknown}|undefined);
    if(!row||typeof row.contract_json!=='string')return null;
    const contract=JSON.parse(row.contract_json) as unknown;assertCanonicalProductContract(contract);return contract;
  }

  listRevisions(workspaceId:string,projectId:string,limit=100):readonly ProductContract[]{
    this.#assertReady();
    if(!Number.isInteger(limit)||limit<1||limit>500)throw new RangeError('Product Contract revision limit is invalid.');
    const rows=this.#database.read(db=>db.prepare(
      'SELECT contract_json FROM gd_product_contracts WHERE workspace_id=? AND project_id=? ORDER BY revision ASC LIMIT ?',
    ).all(workspaceId,projectId,limit) as unknown as {contract_json:unknown}[]);
    return Object.freeze(rows.map(row=>{
      if(typeof row.contract_json!=='string')throw new Error('SQLite returned invalid Product Contract JSON.');
      const contract=JSON.parse(row.contract_json) as unknown;assertCanonicalProductContract(contract);return contract;
    }));
  }

  #assertReady():void{if(!this.#ready)throw new Error('Product Contract Store is not ready.');}
}
export function createProductContractStore(database:LocalDatabase):ProductContractStore{return new ProductContractStore(database);}
