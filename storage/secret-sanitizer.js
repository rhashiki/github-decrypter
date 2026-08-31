const GLOBAL_FORBIDDEN = /(private.?key|refresh.?token|client.?secret|service.?role|installation.?token|webhook.?secret|database.?password)/i;

function forbiddenAtPath(path, key) {
  const joined = [...path, key].join('.').toLowerCase();
  if (GLOBAL_FORBIDDEN.test(key) || GLOBAL_FORBIDDEN.test(joined)) return true;
  if (/^github\.token$/i.test(joined)) return true;
  if (/^github\.(access.?token|installation.?token)$/i.test(joined)) return true;
  if (/^supabase\.(anon.?key|management.?token|access.?token|token|password)$/i.test(joined)) return true;
  if (/^supabase\..*(secret|token|password|service.?role|anon.?key)/i.test(joined)) return true;
  return false;
}

function scrub(value, path = []) {
  if (Array.isArray(value)) return value.map(item => scrub(item, path));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (forbiddenAtPath(path, key)) continue;
    out[key] = scrub(item, [...path, key]);
  }
  return out;
}

export function sanitizeDurableSettings(settings = {}) {
  const clean = scrub(settings);
  clean.github = { ...(clean.github || {}), authMode:'github_app', token:'' };
  clean.supabase = { ...(clean.supabase || {}), authMode:'oauth', anonKey:'', managementToken:'' };
  return clean;
}
