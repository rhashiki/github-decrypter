export const PORTABLE_SKILL_SCHEMA = 'ld-portable-skill/2';
export const PORTABLE_SKILL_REGISTRY_SCHEMA = 'ld-portable-skill-registry/2';
export const PORTABLE_SKILL_STAGE_SCHEMA = 'ld-portable-skill-stage/1';

export const PORTABLE_SKILL_LIMITS = Object.freeze({
  nameChars:64,
  descriptionChars:1024,
  compatibilityChars:500,
  files:64,
  totalBytes:1_048_576,
  singleFileBytes:262_144,
  scriptBytes:131_072,
  bodyBytes:160_000,
  contextBytes:80_000,
  routeSkills:8
});

const te = new TextEncoder();
const td = new TextDecoder();
const TRUST_LEVELS = new Set(['builtin','verified','custom','imported','untrusted']);
const SAFE_TOP_DIRS = new Set(['references','assets','scripts']);
const SENSITIVE_NAMES = new Set(['.env','.npmrc','.netrc','credentials','credentials.json','service-account.json']);
const SENSITIVE_EXT = /\.(?:pem|key|p12|pfx|jks|keystore)$/i;
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const WRITE_TOOL_RE = /(?:write|patch|commit|delete|remove|rename|move|create|apply|execute|shell|terminal|sql|migration|deploy|publish)/i;

const text = (value,max=4000)=>String(value??'').trim().slice(0,max);
const clone = value => structuredClone(value);
const bytes = value => te.encode(String(value??'')).byteLength;

function skillError(code, details = {}) {
  return Object.assign(new Error(code), { code, ...details });
}

function parseScalar(raw = '') {
  const value = String(raw).trim();
  if (!value) return '';
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1,-1);
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith('[') && value.endsWith(']')) {
    return value.slice(1,-1).split(',').map(item=>parseScalar(item)).filter(item=>item!==''&&item!=null);
  }
  return value;
}

export function parseSkillMarkdown(source = '') {
  const input = String(source ?? '').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  if (!input.startsWith('---\n')) throw skillError('SKILL_FRONTMATTER_REQUIRED');
  const end = input.indexOf('\n---\n',4);
  if (end < 0) throw skillError('SKILL_FRONTMATTER_UNTERMINATED');
  const yaml = input.slice(4,end);
  const body = input.slice(end+5).trim();
  if (!body) throw skillError('SKILL_BODY_REQUIRED');
  if (bytes(body) > PORTABLE_SKILL_LIMITS.bodyBytes) throw skillError('SKILL_BODY_TOO_LARGE');

  const meta = {};
  const lines = yaml.split('\n');
  for (let i=0;i<lines.length;i++) {
    const line = lines[i];
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) throw skillError('SKILL_FRONTMATTER_INVALID',{ line:i+1 });
    const key = match[1].toLowerCase();
    let raw = match[2];
    if (raw === '|' || raw === '>') {
      const folded = raw === '>';
      const block = [];
      while (i+1 < lines.length && (/^\s+/.test(lines[i+1]) || !lines[i+1].trim())) {
        i += 1;
        block.push(lines[i].replace(/^\s{1,4}/,''));
      }
      raw = folded ? block.join(' ').replace(/\s+/g,' ') : block.join('\n');
    }
    meta[key] = parseScalar(raw);
  }

  const name = text(meta.name,PORTABLE_SKILL_LIMITS.nameChars+1).toLowerCase();
  const description = text(meta.description,PORTABLE_SKILL_LIMITS.descriptionChars+1);
  if (!name || name.length > PORTABLE_SKILL_LIMITS.nameChars || !NAME_RE.test(name) || name.includes('--')) throw skillError('SKILL_NAME_INVALID',{ name });
  if (!description || description.length > PORTABLE_SKILL_LIMITS.descriptionChars || /[<>]/.test(description)) throw skillError('SKILL_DESCRIPTION_INVALID');
  const compatibility = text(meta.compatibility,PORTABLE_SKILL_LIMITS.compatibilityChars+1);
  if (compatibility.length > PORTABLE_SKILL_LIMITS.compatibilityChars) throw skillError('SKILL_COMPATIBILITY_INVALID');
  const allowedToolsRaw = meta['allowed-tools'] ?? meta.allowed_tools ?? '';
  const allowedTools = Array.isArray(allowedToolsRaw)
    ? allowedToolsRaw.map(item=>text(item,160)).filter(Boolean)
    : String(allowedToolsRaw||'').split(/[\s,]+/).map(item=>text(item,160)).filter(Boolean);
  const tagsRaw = meta.tags;
  const tags = (Array.isArray(tagsRaw) ? tagsRaw : String(tagsRaw||'').split(',')).map(item=>text(item,80).toLowerCase()).filter(Boolean).slice(0,24);
  return {
    metadata:{
      name,
      description,
      license:text(meta.license,240)||null,
      compatibility:compatibility||null,
      allowedTools:[...new Set(allowedTools)].slice(0,64),
      owner:text(meta.owner,240)||null,
      tags:[...new Set(tags)],
      metadata:meta.metadata && typeof meta.metadata === 'object' ? clone(meta.metadata) : {}
    },
    body,
    rawFrontmatter:yaml
  };
}

export function canonicalSkillPath(input = '') {
  const raw = String(input??'');
  if (!raw || raw.includes('\0') || raw.includes('\\')) throw skillError('SKILL_PATH_INVALID');
  if (/^[A-Za-z]:/.test(raw) || raw.startsWith('/') || raw.startsWith('~')) throw skillError('SKILL_PATH_ABSOLUTE');
  const parts = raw.split('/').filter(Boolean);
  if (!parts.length || parts.some(part=>part==='.'||part==='..')) throw skillError('SKILL_PATH_TRAVERSAL');
  const normalized = parts.join('/');
  if (normalized.length > 300) throw skillError('SKILL_PATH_TOO_LONG');
  if (SENSITIVE_NAMES.has(normalized.toLowerCase()) || SENSITIVE_EXT.test(normalized)) throw skillError('SKILL_SENSITIVE_FILE_FORBIDDEN');
  if (normalized !== 'SKILL.md') {
    const top = normalized.split('/')[0];
    if (!SAFE_TOP_DIRS.has(top)) throw skillError('SKILL_PATH_ROOT_FORBIDDEN',{ path:normalized });
  }
  return normalized;
}

function privateIpv4(host) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const nums = m.slice(1).map(Number);
  if (nums.some(n=>n<0||n>255)) return true;
  const [a,b] = nums;
  return a===10 || a===127 || a===0 || (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&b===168) || a>=224;
}

export function assertSafeRemoteSkillSource(input, { githubOnly = true } = {}) {
  let url;
  try { url = new URL(String(input||'')); } catch { throw skillError('SKILL_SOURCE_URL_INVALID'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw skillError('SKILL_SOURCE_URL_INVALID');
  const host = url.hostname.toLowerCase();
  if (!host || host==='localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host==='::1' || host==='[::1]' || privateIpv4(host)) throw skillError('SKILL_SOURCE_PRIVATE_NETWORK_FORBIDDEN');
  if (githubOnly && !['github.com','api.github.com','raw.githubusercontent.com'].includes(host)) throw skillError('SKILL_SOURCE_HOST_FORBIDDEN',{ host });
  return url.toString();
}

function normalizeBundleFiles(files = []) {
  if (!Array.isArray(files) || !files.length) throw skillError('SKILL_FILES_REQUIRED');
  if (files.length > PORTABLE_SKILL_LIMITS.files) throw skillError('SKILL_FILE_COUNT_LIMIT');
  const seen = new Set();
  let total = 0;
  const normalized = [];
  for (const file of files) {
    const path = canonicalSkillPath(file?.path);
    if (seen.has(path)) throw skillError('SKILL_DUPLICATE_PATH',{ path });
    seen.add(path);
    let content = '';
    if (typeof file?.content === 'string') content = file.content;
    else if (typeof file?.base64 === 'string') {
      try {
        const raw = atob(file.base64);
        content = td.decode(Uint8Array.from(raw,c=>c.charCodeAt(0)));
      } catch { throw skillError('SKILL_FILE_ENCODING_INVALID',{ path }); }
    } else throw skillError('SKILL_FILE_CONTENT_REQUIRED',{ path });
    const size = bytes(content);
    if (size > PORTABLE_SKILL_LIMITS.singleFileBytes) throw skillError('SKILL_FILE_TOO_LARGE',{ path,size });
    if (path.startsWith('scripts/') && size > PORTABLE_SKILL_LIMITS.scriptBytes) throw skillError('SKILL_SCRIPT_TOO_LARGE',{ path,size });
    total += size;
    if (total > PORTABLE_SKILL_LIMITS.totalBytes) throw skillError('SKILL_TOTAL_SIZE_LIMIT',{ total });
    normalized.push({ path, content, size });
  }
  if (!seen.has('SKILL.md')) throw skillError('SKILL_MD_REQUIRED');
  return normalized.sort((a,b)=>a.path.localeCompare(b.path));
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256',typeof value === 'string' ? te.encode(value) : value);
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

export function normalizeSkillPermissions(metadata = {}, { trust = 'imported', scriptExecutionApproved = false } = {}) {
  const requestedTools = [...new Set((metadata.allowedTools||[]).map(item=>text(item,160)).filter(Boolean))];
  const requestedWrites = requestedTools.filter(tool=>WRITE_TOOL_RE.test(tool));
  const scriptsRequested = requestedTools.some(tool=>/script|shell|terminal|execute/i.test(tool));
  const scriptsAllowed = scriptExecutionApproved === true && ['builtin','verified'].includes(trust);
  return {
    requestedTools,
    requestedWrites,
    scriptsRequested,
    scriptsAllowed,
    canRead:true,
    canPropose:true,
    canWriteAuthoritative:false,
    canExpandScope:false,
    requiresDecrypterApproval:requestedWrites.length>0 || scriptsRequested,
    writeAuthority:false
  };
}

export async function buildPortableSkillPackage({ files = [], source = {}, trust = 'imported', enabled = true, pinned = false, scriptExecutionApproved = false } = {}) {
  const normalizedFiles = normalizeBundleFiles(files);
  const manifestFile = normalizedFiles.find(file=>file.path==='SKILL.md');
  const parsed = parseSkillMarkdown(manifestFile.content);
  const trustLevel = TRUST_LEVELS.has(String(trust)) ? String(trust) : 'untrusted';
  const sourceUrl = source?.url ? assertSafeRemoteSkillSource(source.url,{ githubOnly:source.githubOnly !== false }) : null;
  const digestInput = normalizedFiles.map(file=>`${file.path}\0${file.content}`).join('\0');
  const contentHash = await sha256Hex(digestInput);
  const sourceRevision = text(source?.revision,160)||null;
  const sourceKind = ['builtin','custom','github','bundle','legacy-cloud'].includes(String(source?.kind||'')) ? String(source.kind) : 'bundle';
  const provenance = {
    sourceKind,
    sourceUrl,
    sourceRevision,
    importedAt:new Date().toISOString(),
    contentHash,
    signature:text(source?.signature,2000)||null,
    signatureVerified:source?.signatureVerified===true
  };
  return {
    schema:PORTABLE_SKILL_SCHEMA,
    id:parsed.metadata.name,
    slug:parsed.metadata.name,
    display_name:text(source?.displayName,120)||parsed.metadata.name,
    description:parsed.metadata.description,
    metadata:parsed.metadata,
    body:parsed.body,
    files:normalizedFiles.map(file=>({ path:file.path, size:file.size, content:file.content })),
    contentHash,
    provenance,
    trust:trustLevel,
    permissions:normalizeSkillPermissions(parsed.metadata,{ trust:trustLevel, scriptExecutionApproved }),
    enabled:enabled!==false,
    pinned:Boolean(pinned),
    auto_activation:source?.autoActivation!==false,
    sourceImmutable:true,
    cloudRequired:false,
    writeAuthority:false
  };
}

function legacyName(skill = {}) {
  const raw = text(skill.slug || skill.name || skill.display_name || 'skill',64).toLowerCase().replace(/^custom-/,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/--+/g,'-');
  return (raw || 'skill').slice(0,64).replace(/-+$/,'') || 'skill';
}

function yamlQuote(value='') { return JSON.stringify(String(value??'')); }

export async function portableSkillFromLegacy(skill = {}) {
  const base = legacyName(skill);
  const custom = skill.custom===true || String(skill.slug||'').startsWith('custom-');
  const name = custom ? `custom-${base}`.slice(0,64).replace(/-+$/,'') : base;
  const description = text(skill.description || skill.use_when || `Use ${skill.display_name || name} when relevant to the request.`,PORTABLE_SKILL_LIMITS.descriptionChars).replace(/[<>]/g,'');
  const body = text(skill.content_md || skill.definition || skill.body || '',PORTABLE_SKILL_LIMITS.bodyBytes);
  const allowed = Array.isArray(skill.allowed_tools) ? skill.allowed_tools.join(' ') : text(skill.allowed_tools || '',1000);
  const skillMd = [
    '---',
    `name: ${name}`,
    `description: ${yamlQuote(description)}`,
    ...(allowed ? [`allowed-tools: ${yamlQuote(allowed)}`] : []),
    '---',
    '',
    `# ${text(skill.display_name || name,120)}`,
    '',
    body || `Use this skill only when its description matches the current request.`,
    '',
    skill.use_when ? `## Use When\n${text(skill.use_when,4000)}` : '',
    skill.avoid_when ? `## Avoid When\n${text(skill.avoid_when,4000)}` : ''
  ].filter(Boolean).join('\n');
  return buildPortableSkillPackage({
    files:[{path:'SKILL.md',content:skillMd}],
    trust:skill.official!==false && !custom ? 'builtin' : 'custom',
    enabled:skill.enabled!==false,
    pinned:Boolean(skill.pinned),
    source:{
      kind:'legacy-cloud',
      displayName:skill.display_name || name,
      revision:text(skill.updated_at || skill.revision || '',160)||null,
      autoActivation:skill.auto_activation!==false,
      githubOnly:false
    }
  });
}

function tokenSet(input='') {
  return new Set(String(input||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s_-]/g,' ').split(/[\s_-]+/).filter(token=>token.length>=3).slice(0,300));
}

export function routePortableSkills(command, skills = [], { explicit = [], limit = PORTABLE_SKILL_LIMITS.routeSkills } = {}) {
  const requested = new Set((explicit||[]).map(item=>String(item||'')).filter(Boolean));
  const cmd = tokenSet(command);
  const scored = [];
  for (const skill of Array.isArray(skills)?skills:[]) {
    if (!skill || skill.enabled===false || skill.auto_activation===false) continue;
    let score = requested.has(skill.slug) ? 10000 : (skill.pinned ? 1000 : 0);
    const metaTokens = tokenSet([skill.slug,skill.display_name,skill.description,skill.metadata?.tags?.join(' ')].join(' '));
    for (const token of cmd) if (metaTokens.has(token)) score += 12;
    const bodyTokens = tokenSet(String(skill.body||'').slice(0,12000));
    for (const token of cmd) if (bodyTokens.has(token)) score += 2;
    if (score>0) scored.push({ skill, score });
  }
  scored.sort((a,b)=>b.score-a.score || String(a.skill.slug).localeCompare(String(b.skill.slug)));
  return {
    method:'portable-local-v2',
    cloudUsed:false,
    skills:scored.slice(0,Math.max(1,Math.min(16,Number(limit)||PORTABLE_SKILL_LIMITS.routeSkills))).map(item=>({ slug:item.skill.slug, score:item.score, contentHash:item.skill.contentHash })),
    slugs:scored.slice(0,Math.max(1,Math.min(16,Number(limit)||PORTABLE_SKILL_LIMITS.routeSkills))).map(item=>item.skill.slug)
  };
}

export async function stagePortableSkillForRun(skill, { contextBytes = PORTABLE_SKILL_LIMITS.contextBytes, includeReferences = true, allowScripts = false } = {}) {
  if (!skill || skill.schema!==PORTABLE_SKILL_SCHEMA) throw skillError('SKILL_PACKAGE_INVALID');
  const max = Math.max(4096,Math.min(PORTABLE_SKILL_LIMITS.contextBytes,Number(contextBytes)||PORTABLE_SKILL_LIMITS.contextBytes));
  const stagedFiles = [];
  let used = 0;
  const ordered = skill.files.filter(file=>file.path==='SKILL.md' || (includeReferences && file.path.startsWith('references/')) || file.path.startsWith('assets/') || (allowScripts && skill.permissions.scriptsAllowed && file.path.startsWith('scripts/')));
  for (const file of ordered) {
    if (file.path.startsWith('assets/')) {
      stagedFiles.push({ path:file.path, size:file.size, contentOmitted:true });
      continue;
    }
    const remaining = max-used;
    if (remaining<=0) break;
    const content = String(file.content||'');
    let chunk = content;
    while (bytes(chunk)>remaining && chunk.length>0) chunk = chunk.slice(0,Math.floor(chunk.length*0.8));
    if (!chunk) continue;
    used += bytes(chunk);
    stagedFiles.push({ path:file.path, size:bytes(chunk), content:chunk, truncated:chunk.length<content.length });
  }
  const fingerprint = await sha256Hex(`${skill.contentHash}\0${stagedFiles.map(file=>`${file.path}:${file.size}`).join('|')}`);
  return {
    schema:PORTABLE_SKILL_STAGE_SCHEMA,
    skill:{ slug:skill.slug, display_name:skill.display_name, description:skill.description, trust:skill.trust, contentHash:skill.contentHash },
    files:clone(stagedFiles),
    budget:{ maxBytes:max, usedBytes:used },
    permissions:{ ...skill.permissions, canWriteAuthoritative:false, writeAuthority:false },
    sourceImmutable:true,
    stageFingerprint:fingerprint,
    createdAt:new Date().toISOString()
  };
}

export function skillPublicRecord(skill) {
  return {
    schema:PORTABLE_SKILL_SCHEMA,
    slug:skill.slug,
    display_name:skill.display_name,
    description:skill.description,
    category:skill.metadata?.tags?.[0] || (skill.trust==='custom'?'custom':'portable'),
    official:skill.trust==='builtin'||skill.trust==='verified',
    custom:skill.trust==='custom',
    enabled:skill.enabled!==false,
    pinned:Boolean(skill.pinned),
    auto_activation:skill.auto_activation!==false,
    trust:skill.trust,
    contentHash:skill.contentHash,
    provenance:clone(skill.provenance),
    permissions:clone(skill.permissions),
    cloudRequired:false,
    writeAuthority:false
  };
}
