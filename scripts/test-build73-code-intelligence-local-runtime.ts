import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, linkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TOOL_RUNTIME_SCHEMA, type ToolExecutionContext } from '../packages/tools/src/index.js';
import type { ScopeLockRecord } from '../packages/scope/src/lock.js';
import {
  createCodeIntelligenceToolRegistrations, CODE_INTELLIGENCE_TOOL_ID, type CodeIntelligenceLocalOptions,
} from '../apps/local/src/code-intelligence-runtime.js';

const root=mkdtempSync(join(tmpdir(),'gd-ci-73-'));
const outside=mkdtempSync(join(tmpdir(),'gd-ci-outside-'));
try {
  mkdirSync(join(root,'src'));
  writeFileSync(join(root,'src','app.ts'),'export const hello = () => 4;\nhello();\n');
  writeFileSync(join(outside,'hidden.ts'),'export const forbidden = 1');
  const workspaces={
    get: () => ({rootPath:root}),
    resolveExistingPath: (_id:unknown,path:string) => join(root,path),
  } as unknown as CodeIntelligenceLocalOptions['workspaces'];
  const lock={schema:'gd-scope-lock/1',id:'lock-73',status:'locked'} as unknown as ScopeLockRecord;
  const registration=createCodeIntelligenceToolRegistrations({workspaces},lock)[0]!;
  assert.equal(registration.descriptor.id,CODE_INTELLIGENCE_TOOL_ID);
  assert.equal(registration.descriptor.mutating,false);
  assert.deepEqual(registration.descriptor.requiredCapabilities,['READ']);
  const ctx={
    schema:TOOL_RUNTIME_SCHEMA, tool:registration.descriptor,workspaceId:'gd_ws_11111111-1111-1111-1111-111111111111',
    verifiedCapabilities:['READ'],mutationAuthorized:false,sourceScopeLockId:'lock-73',
    sourceOrchestrationId:'orchestrator-73',invocationId:'invoke-73',
  } as unknown as ToolExecutionContext;
  const input={paths:['src/app.ts'],query:{kind:'definitions',term:'hello'}};
  const result=await registration.handler(ctx,input);
  assert.ok(result && typeof result==='object' && !Array.isArray(result));
  const row=result as Record<string,unknown>;
  assert.equal(row.readCapabilityVerified,true);
  assert.equal(row.mutationAuthority,false);
  assert.equal(row.semanticResolution,false);
  assert.equal((row.matches as unknown[]).length,1);
  assert.equal(JSON.stringify(row).includes('=> 4'),false);
  await assert.rejects(()=>registration.handler({...ctx,verifiedCapabilities:[]} as ToolExecutionContext,input));
  await assert.rejects(()=>registration.handler({...ctx,mutationAuthorized:true} as ToolExecutionContext,input));
  await assert.rejects(()=>registration.handler({...ctx,sourceScopeLockId:'another'} as ToolExecutionContext,input));
  await assert.rejects(()=>registration.handler(ctx,{paths:['../outside.ts'],query:{kind:'definitions',term:'hi'}}));
  await assert.rejects(()=>registration.handler(ctx,{paths:['.git/config.ts'],query:{kind:'definitions',term:'hi'}}));
  symlinkSync(join(outside,'hidden.ts'),join(root,'src','linked.ts'));
  await assert.rejects(()=>registration.handler(ctx,{paths:['src/linked.ts'],query:{kind:'definitions',term:'forbidden'}}));
  linkSync(join(root,'src','app.ts'),join(root,'src','hard.ts'));
  await assert.rejects(()=>registration.handler(ctx,{paths:['src/hard.ts'],query:{kind:'definitions',term:'hello'}}));
  console.log(JSON.stringify({ok:true,build:73,workspaceReadOnly:true,symlinkDenied:true,hardlinkDenied:true,missingCapabilityDenied:true}));
} finally {rmSync(root,{force:true,recursive:true});rmSync(outside,{force:true,recursive:true});}
