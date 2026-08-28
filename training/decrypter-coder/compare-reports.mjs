#!/usr/bin/env node
import fs from 'node:fs';
import { compareBenchmarkReports } from './lib/quality-gates.mjs';

function arg(name) {
  const prefix = `--${name}=`;
  return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length) || '';
}

const baselinePath = arg('baseline');
const candidatePath = arg('candidate');
const configPath = arg('config') || 'training/decrypter-coder/config/decrypter-coder-30b-qlora.json';
if (!baselinePath || !candidatePath) {
  console.error('Usage: node training/decrypter-coder/compare-reports.mjs --baseline=baseline.json --candidate=candidate.json');
  process.exit(2);
}
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const result = compareBenchmarkReports(baseline, candidate, config.promotion || {});
console.log(JSON.stringify(result, null, 2));
if (!result.promoted) process.exit(1);
