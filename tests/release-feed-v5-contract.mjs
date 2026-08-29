import fs from 'node:fs';

const src = fs.readFileSync('supabase/functions/ld-release-feed/index.ts', 'utf8');
const fail = message => { throw new Error(`release-feed-v5-contract: ${message}`); };

if (!src.includes('requestUrl.searchParams.get("version")||requestUrl.searchParams.get("release")')) fail('release alias not supported');
if (!src.includes('githubStableFallback(version)')) fail('explicit-version GitHub fallback missing');
if (!src.includes('if(!release&&channel==="stable")release=await githubStableFallback(version);')) fail('stable explicit-version fallback contract missing');
if (!src.includes('LD_LICENSE_PRIVATE_JWK')) fail('backend signing secret contract missing');
if (!src.includes('crypto.subtle.sign')) fail('ECDSA signing contract missing');
if (!src.includes('Cache-Control":"no-store')) fail('no-store response contract missing');
if (/console\.log\([^\n]*(?:PRIVATE_JWK|service_role|SERVICE_ROLE)/i.test(src)) fail('secret-like logging detected');

console.log(JSON.stringify({ ok: true, contract: 'ld-release-feed-v5', alias: 'release', signed: true, explicit_version_fallback: true }, null, 2));
