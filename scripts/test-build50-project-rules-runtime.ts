import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createProjectRules, selectProjectRulesForStage } from '../packages/plan/src/project-rules.js';
import { createLocalDatabase } from '../apps/local/src/database.js';
import { createLocalProjectRulesStore } from '../apps/local/src/project-rules-store.js';

const directory = mkdtempSync(path.join(tmpdir(), 'gd-build50-'));
const databasePath = path.join(directory, 'runtime.sqlite3');
const workspaceId = 'gd_ws_12345678-1234-4234-8234-123456789abc';
const missingWorkspaceId = 'gd_ws_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

try {
  const database = createLocalDatabase({ path: databasePath, now: () => '2026-09-09T17:30:00.000Z' });
  database.open();
  database.transaction((sqlite) => {
    sqlite.prepare(`INSERT INTO gd_workspaces (id, root_path, display_name, registered_at, last_opened_at) VALUES (?, ?, ?, ?, NULL)`)
      .run(workspaceId, '/tmp/project-rules-fixture', 'Project Rules Fixture', '2026-09-09T17:29:00.000Z');
  });
  const jobsBefore = database.read((sqlite) => Number((sqlite.prepare('SELECT COUNT(*) AS count FROM gd_jobs').get() as { count:number|bigint }).count));

  const rules = createProjectRules({
    workspaceId,
    rules: [
      { category:'architecture', directive:'require', statement:'Keep provider boundaries explicit.', stages:['plan','decision','build'] },
      { category:'security', directive:'forbid', statement:'Do not place secrets in ordinary frontend state.', stages:['plan','build'] },
      { category:'testing', directive:'prefer', statement:'Prefer focused tests before broad regression suites.', stages:['build'] },
    ],
  });

  assert.equal(rules.schema, 'gd-project-rules/1');
  assert.equal(rules.workspaceId, workspaceId);
  assert.equal(rules.rules.length, 3);
  assert.equal(rules.rules[0]?.mandatory, true);
  assert.equal(rules.rules[2]?.mandatory, false);
  assert.equal(rules.semanticInference, false);
  assert.equal(rules.automaticComplianceDecision, false);
  assert.equal(rules.impactSimulationApplied, false);
  assert.equal(rules.buildTransitionAuthorized, false);
  assert.equal(Object.isFrozen(rules), true);
  assert.equal(Object.isFrozen(rules.rules), true);
  assert.equal(Object.isFrozen(rules.rules[0]?.stages), true);
  assert.match(rules.rulesDigest.hex, /^[0-9a-f]{64}$/);

  const deterministic = createProjectRules({
    workspaceId,
    rules: [
      { category:'architecture', directive:'require', statement:'Keep provider boundaries explicit.', stages:['build','plan','decision'] },
      { category:'security', directive:'forbid', statement:'Do not place secrets in ordinary frontend state.', stages:['build','plan'] },
      { category:'testing', directive:'prefer', statement:'Prefer focused tests before broad regression suites.', stages:['build'] },
    ],
  });
  assert.deepEqual(deterministic, rules);

  const planRules = selectProjectRulesForStage({ rules, stage:'plan' });
  assert.deepEqual(planRules.rules.map((rule) => rule.id), ['rule-0001','rule-0002']);
  assert.deepEqual(planRules.mandatoryRules.map((rule) => rule.id), ['rule-0001','rule-0002']);
  assert.deepEqual(planRules.advisoryRules, []);
  assert.equal(planRules.semanticEvaluation, false);
  assert.equal(planRules.impactSimulationApplied, false);
  assert.equal(planRules.buildTransitionAuthorized, false);

  const buildRules = selectProjectRulesForStage({ rules, stage:'build' });
  assert.deepEqual(buildRules.rules.map((rule) => rule.id), ['rule-0001','rule-0002','rule-0003']);
  assert.deepEqual(buildRules.advisoryRules.map((rule) => rule.id), ['rule-0003']);

  const store = createLocalProjectRulesStore(database, () => '2026-09-09T17:31:00.000Z');
  const saved = store.save(rules);
  assert.equal(saved.storageRevision, 1);
  assert.deepEqual(store.get(workspaceId)?.record, rules);
  assert.throws(() => store.save(createProjectRules({ workspaceId:missingWorkspaceId, rules:[{ category:'workflow', directive:'require', statement:'Missing workspace must reject.', stages:['plan'] }] })), /Workspace not found/i);

  database.close();
  const reopened = createLocalDatabase({ path: databasePath, now: () => '2026-09-09T17:32:00.000Z' });
  reopened.open();
  const reopenedStore = createLocalProjectRulesStore(reopened, () => '2026-09-09T17:33:00.000Z');
  assert.deepEqual(reopenedStore.get(workspaceId)?.record, rules);

  const revisedRules = createProjectRules({
    workspaceId,
    rules: [
      { category:'architecture', directive:'require', statement:'Keep provider boundaries explicit.', stages:['plan','decision','build'] },
      { category:'testing', directive:'require', statement:'Run validation before approved execution.', stages:['build'] },
    ],
  });
  const revised = reopenedStore.save(revisedRules);
  assert.equal(revised.storageRevision, 2);
  assert.equal(revised.createdAt, '2026-09-09T17:31:00.000Z');
  assert.equal(revised.updatedAt, '2026-09-09T17:33:00.000Z');
  assert.deepEqual(reopenedStore.get(workspaceId)?.record, revisedRules);

  const jobsAfter = reopened.read((sqlite) => Number((sqlite.prepare('SELECT COUNT(*) AS count FROM gd_jobs').get() as { count:number|bigint }).count));
  assert.equal(jobsAfter, jobsBefore);
  assert.equal(reopenedStore.clear(workspaceId), true);
  assert.equal(reopenedStore.get(workspaceId), undefined);
  reopened.close();

  assert.throws(() => createProjectRules({ workspaceId, rules:[] }), /between 1 and 256/i);
  assert.throws(() => createProjectRules({ workspaceId, rules:[{ category:'architecture', directive:'require', statement:'x', stages:['plan','plan'] }] }), /duplicate stages/i);
  assert.throws(() => createProjectRules({ workspaceId, rules:[
    { category:'architecture', directive:'require', statement:'same', stages:['plan'] },
    { category:'architecture', directive:'require', statement:'same', stages:['plan'] },
  ] }), /duplicate canonical rules/i);

  console.log(JSON.stringify({
    ok:true,
    schema:'gd-build50-project-rules-runtime/1',
    build:50,
    workspaceScoped:true,
    persistence:'gd_metadata',
    storageRevision:2,
    semanticInference:false,
    impactSimulationApplied:false,
    buildTransitionAuthorized:false,
    jobsCreated:0,
  }, null, 2));
} finally {
  rmSync(directory, { recursive:true, force:true });
}
