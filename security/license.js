const PUBLIC_SPKI_B64 = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEEp98fkRLasVVk4lZVbNVy8W3UaptsiAgvUVmFBV/2C5L0lZ5j56oEY1lEOgs0rSrX4jsPAf8F4qflUm2pOUoTQ==';
const AUDIENCE = 'lovable-decrypter';

function bytesFromB64url(value = '') {
  const base64 = String(value).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const raw = atob(base64);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

function textFromB64url(value = '') {
  return new TextDecoder().decode(bytesFromB64url(value));
}

async function importPublicKey() {
  const der = Uint8Array.from(atob(PUBLIC_SPKI_B64), c => c.charCodeAt(0));
  return crypto.subtle.importKey('spki', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
}

export async function verifyLicenseKey(licenseKey = '') {
  const key = String(licenseKey || '').trim();
  const parts = key.split('.');
  if (parts.length !== 3 || parts[0] !== 'LD2') throw new Error('KEY inválida. Use uma licença LD2 emitida pelo proprietário.');
  const [, payloadPart, signaturePart] = parts;
  let payload;
  try { payload = JSON.parse(textFromB64url(payloadPart)); } catch { throw new Error('KEY corrompida ou inválida.'); }
  if (payload?.aud !== AUDIENCE || Number(payload?.v) !== 1 || !payload?.license_id) throw new Error('KEY não pertence ao Lovable Decrypter v2.');
  const publicKey = await importPublicKey();
  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    bytesFromB64url(signaturePart),
    new TextEncoder().encode(payloadPart)
  );
  if (!valid) throw new Error('Assinatura da KEY inválida.');
  const now = Math.floor(Date.now() / 1000);
  if (payload.nbf && now < Number(payload.nbf)) throw new Error('Esta KEY ainda não está ativa.');
  if (payload.exp && now >= Number(payload.exp)) throw new Error('Esta KEY expirou.');
  return {
    valid: true,
    licenseId: String(payload.license_id),
    subject: String(payload.sub || payload.name || 'Licença ativa'),
    issuedAt: payload.iat ? Number(payload.iat) : null,
    expiresAt: payload.exp ? Number(payload.exp) : null,
    features: Array.isArray(payload.features) ? payload.features.map(String) : ['core'],
    payload,
    licenseKey: key
  };
}

export function publicLicenseKeyFingerprint() {
  return 'P256:LD2:2026-01';
}
