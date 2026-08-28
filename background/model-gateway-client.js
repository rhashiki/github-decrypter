import { DEFAULT_BACKEND_BASE } from '../settings/config.js';

export async function getModelGatewayStatus(settings = {}) {
  const base = String(settings?.auth?.backendBase || DEFAULT_BACKEND_BASE).replace(/\/+$/, '');
  const licenseKey = String(settings?.auth?.licenseKey || '');
  const deviceId = String(settings?.auth?.deviceId || '');
  if (!base || !licenseKey || !deviceId) return { ok: false, code: 'GATEWAY_AUTH_UNAVAILABLE' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${base}/ld-model-gateway`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-license-key': licenseKey,
        'x-device-id': deviceId
      },
      body: JSON.stringify({ action: 'status' }),
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok === false) return { ok: false, code: body?.code || `HTTP_${response.status}` };
    return body;
  } catch (error) {
    return { ok: false, code: error?.name === 'AbortError' ? 'GATEWAY_TIMEOUT' : (error?.message || 'GATEWAY_UNAVAILABLE') };
  } finally {
    clearTimeout(timer);
  }
}
