export const packageIdentity = '@github-decrypter/plan' as const;

export const PROMPT_INTAKE_BUILD = 38 as const;
export const PROMPT_INTAKE_SCHEMA = 'gd-prompt-intake/1' as const;
export const PROMPT_INTAKE_SOURCE = 'user' as const;
export const PROMPT_INTAKE_DIGEST_ALGORITHM = 'sha256' as const;
export const PROMPT_INTAKE_MAX_CHARACTERS = 262_144 as const;

export type PromptIntakeShape = 'single-line' | 'multi-line';

export interface PromptIntakeInput {
  readonly text: string;
}

export interface PromptIntakeDigest {
  readonly algorithm: typeof PROMPT_INTAKE_DIGEST_ALGORITHM;
  readonly hex: string;
}

export interface PromptIntakeRecord {
  readonly schema: typeof PROMPT_INTAKE_SCHEMA;
  readonly source: typeof PROMPT_INTAKE_SOURCE;
  readonly normalizedText: string;
  readonly digest: PromptIntakeDigest;
  readonly characterCount: number;
  readonly lineCount: number;
  readonly shape: PromptIntakeShape;
  readonly hasFencedCode: boolean;
  readonly normalized: true;
  readonly semanticInterpretation: false;
  readonly requirementCompilation: false;
  readonly taskGraphCompilation: false;
  readonly contextCompilation: false;
  readonly attachmentIngestion: false;
  readonly mentionResolution: false;
  readonly conversationHistory: false;
  readonly aiExecution: false;
  readonly persistence: false;
}

const SHA256_K = Object.freeze([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
] as const);

function rotateRight(value: number, shift: number): number {
  return (value >>> shift) | (value << (32 - shift));
}

function sha256Hex(text: string): string {
  const input = new TextEncoder().encode(text);
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input);
  bytes[input.length] = 0x80;
  const bitLength = input.length * 8;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const words = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const x = words[index - 15]!;
      const y = words[index - 2]!;
      const s0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3);
      const s1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10);
      words[index] = (words[index - 16]! + s0 + words[index - 7]! + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choice + SHA256_K[index]! + words[index]!) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  return [h0,h1,h2,h3,h4,h5,h6,h7].map((value) => value.toString(16).padStart(8, '0')).join('');
}

function asExactInput(value: unknown): PromptIntakeInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Prompt intake input must be an object.');
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== 'text') throw new TypeError('Prompt intake input accepts only the text field.');
  if (typeof record.text !== 'string') throw new TypeError('Prompt intake text must be a string.');
  return { text: record.text };
}

export function normalizePromptText(text: string): string {
  if (typeof text !== 'string') throw new TypeError('Prompt intake text must be a string.');
  const normalized = text.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  if (normalized.length === 0) throw new TypeError('Prompt intake text must not be empty.');
  if (normalized.length > PROMPT_INTAKE_MAX_CHARACTERS) {
    throw new RangeError(`Prompt intake text exceeds ${PROMPT_INTAKE_MAX_CHARACTERS} characters.`);
  }
  return normalized;
}

export function createPromptIntakeRecord(input: PromptIntakeInput): PromptIntakeRecord {
  const exact = asExactInput(input);
  const normalizedText = normalizePromptText(exact.text);
  const lineCount = normalizedText.split('\n').length;
  const digest = Object.freeze({ algorithm: PROMPT_INTAKE_DIGEST_ALGORITHM, hex: sha256Hex(normalizedText) });
  return Object.freeze({
    schema: PROMPT_INTAKE_SCHEMA,
    source: PROMPT_INTAKE_SOURCE,
    normalizedText,
    digest,
    characterCount: normalizedText.length,
    lineCount,
    shape: lineCount === 1 ? 'single-line' : 'multi-line',
    hasFencedCode: /(?:^|\n)[ \t]*```/.test(normalizedText),
    normalized: true,
    semanticInterpretation: false,
    requirementCompilation: false,
    taskGraphCompilation: false,
    contextCompilation: false,
    attachmentIngestion: false,
    mentionResolution: false,
    conversationHistory: false,
    aiExecution: false,
    persistence: false,
  });
}
