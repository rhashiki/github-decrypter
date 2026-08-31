function concatBytes(...parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function derLength(length) {
  if (!Number.isInteger(length) || length < 0) throw new Error('DER_LENGTH_INVALID');
  if (length < 0x80) return Uint8Array.of(length);
  const bytes = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>>= 8;
  }
  if (bytes.length > 4) throw new Error('DER_LENGTH_TOO_LARGE');
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function derWrap(tag, body) {
  return concatBytes(Uint8Array.of(tag), derLength(body.length), body);
}

function decodePem(pem) {
  const text = String(pem || '').trim();
  const match = text.match(/-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/);
  if (!match) throw new Error('RSA_PRIVATE_KEY_PEM_INVALID');
  const label = match[1];
  if (label !== 'PRIVATE KEY' && label !== 'RSA PRIVATE KEY') throw new Error(`RSA_PRIVATE_KEY_UNSUPPORTED:${label}`);
  const raw = match[2].replace(/\s+/g, '');
  if (!raw) throw new Error('RSA_PRIVATE_KEY_PEM_EMPTY');
  let binary;
  try { binary = atob(raw); } catch (_) { throw new Error('RSA_PRIVATE_KEY_BASE64_INVALID'); }
  const der = Uint8Array.from(binary, char => char.charCodeAt(0));
  if (!der.length) throw new Error('RSA_PRIVATE_KEY_DER_EMPTY');
  return { label, der };
}

function pkcs1ToPkcs8(pkcs1) {
  // PrivateKeyInfo ::= SEQUENCE {
  //   version                   INTEGER 0,
  //   privateKeyAlgorithm       AlgorithmIdentifier(rsaEncryption, NULL),
  //   privateKey                OCTET STRING (RSAPrivateKey)
  // }
  const version = Uint8Array.of(0x02, 0x01, 0x00);
  const rsaAlgorithmIdentifier = Uint8Array.of(
    0x30, 0x0d,
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
    0x05, 0x00
  );
  const privateKey = derWrap(0x04, pkcs1);
  return derWrap(0x30, concatBytes(version, rsaAlgorithmIdentifier, privateKey));
}

export function detectRsaPrivateKeyFormat(pem) {
  return decodePem(pem).label === 'RSA PRIVATE KEY' ? 'pkcs1' : 'pkcs8';
}

export function normalizeRsaPrivateKeyToPkcs8Der(pem) {
  const decoded = decodePem(pem);
  return decoded.label === 'RSA PRIVATE KEY' ? pkcs1ToPkcs8(decoded.der) : decoded.der;
}
