(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_ACTIVITY_CLOUD_SYNC__) return;
  window.__LOVABLE_DECRYPTER_ACTIVITY_CLOUD_SYNC__ = true;

  const synced = new Set();
  const EVENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  async function settings() {
    return window.LovableDecrypterV2?.runtime?.({ type: 'LD2_SETTINGS_GET' }) || {};
  }

  function sourceFor(value) {
    const source = String(value || '').toLowerCase();
    if (source.includes('queue')) return 'queue';
    if (source.includes('approval')) return 'plan_approval';
    if (source.includes('control')) return 'control_center';
    return 'native_composer';
  }

  function modeFor(value) {
    return String(value || '').toLowerCase() === 'plan' ? 'plan' : 'build';
  }

  async function record(operation) {
    if (!operation || !['completed', 'failed'].includes(String(operation.status || ''))) return null;
    const key = `${operation.id}:${operation.status}:${operation.commit?.sha || ''}`;
    if (synced.has(key)) return null;
    synced.add(key);
    try {
      const cfg = await settings();
      const base = String(cfg?.auth?.backendBase || '').replace(/\/+$/, '');
      const licenseKey = String(cfg?.auth?.licenseKey || '');
      const deviceId = String(cfg?.auth?.deviceId || '');
      if (!base || !licenseKey || !deviceId) throw new Error('ACTIVITY_CLOUD_AUTH_INCOMPLETE');
      const [owner = '', repo = ''] = String(operation.repo || '').split('/');
      const eventId = EVENT_ID.test(String(operation.id || '')) ? String(operation.id) : crypto.randomUUID();
      const response = await fetch(`${base}/ld-history`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-license-key': licenseKey,
          'x-device-id': deviceId
        },
        body: JSON.stringify({
          action: 'record',
          event_id: eventId,
          project_id: String(operation.projectId || ''),
          github_owner: owner,
          github_repo: repo,
          github_branch: String(operation.branch || 'main'),
          source: sourceFor(operation.source),
          mode: modeFor(operation.mode),
          prompt: String(operation.command || 'Operação Decrypter sem prompt armazenado').slice(0, 60000),
          skill_slugs: Array.isArray(operation.skills) ? operation.skills.slice(0, 12) : [],
          model: String(operation.model || ''),
          status: operation.status,
          summary: operation.error ? String(operation.error).slice(0, 4000) : `${String(operation.mode || 'operation')} concluída`,
          commit_sha: String(operation.commit?.sha || ''),
          duration_ms: Number(operation.durationMs || 0),
          metadata: {
            activity_version: 1,
            request_id: String(operation.requestId || ''),
            source_raw: String(operation.source || ''),
            rules_count: operation.rulesCount == null ? null : Number(operation.rulesCount),
            files: (operation.files || []).slice(0, 40).map(file => ({ path: file.path, action: file.action })),
            dependencies: (operation.dependencies || []).slice(0, 30),
            warnings: (operation.warnings || []).slice(0, 30),
            attachments: (operation.attachments || []).slice(0, 8),
            telemetry: operation.telemetry?.reported ? operation.telemetry : { reported: false },
            rag: { active: false, consulted: false, build: 16 }
          }
        })
      });
      const out = await response.json().catch(() => ({}));
      if (!response.ok || out?.ok === false) throw new Error(out?.code || `HTTP_${response.status}`);
      await chrome.storage.local.set({ ld2_activity_cloud_status: { ok: true, eventId, syncedAt: Date.now() } });
      window.dispatchEvent(new CustomEvent('ld2:activity-cloud-sync', { detail: { ok: true, eventId, operationId: operation.id } }));
      return out;
    } catch (error) {
      synced.delete(key);
      await chrome.storage.local.set({ ld2_activity_cloud_status: { ok: false, error: String(error?.message || error), at: Date.now() } }).catch(() => {});
      window.dispatchEvent(new CustomEvent('ld2:activity-cloud-sync', { detail: { ok: false, operationId: operation?.id || '', error: String(error?.message || error) } }));
      return null;
    }
  }

  window.addEventListener('ld2:activity-operation', event => {
    const detail = event.detail || {};
    if (!['completed', 'failed'].includes(String(detail.kind || ''))) return;
    record(detail.operation).catch(() => {});
  });

  window.LovableDecrypterActivityCloudSync = Object.freeze({ record, build: 13 });
})();
