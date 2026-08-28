#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { buildCurriculum, datasetManifest, validateCurriculum } from './lib/curriculum.mjs';

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find(value => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const outputDir = path.resolve(argValue('out', '/tmp/decrypter-coder-dataset'));
const examples = buildCurriculum();
const validation = validateCurriculum(examples);
if (!validation.ok) {
  console.error(validation.errors.join('\n'));
  process.exit(1);
}
const manifest = datasetManifest(examples);
if (!manifest.synthetic_only || manifest.private_customer_code_training !== false || !manifest.decrypterbench_holdout) {
  throw new Error('DATASET_PRIVACY_CONTRACT_FAILED');
}
if (outputDir.split(path.sep).includes('benchmark')) throw new Error('REFUSE_BENCHMARK_AS_TRAINING_OUTPUT');

fs.mkdirSync(outputDir, { recursive: true });
const train = examples.filter(example => example.split === 'train');
const validationSet = examples.filter(example => example.split === 'validation');
const writeJsonl = (file, rows) => fs.writeFileSync(file, `${rows.map(row => JSON.stringify(row)).join('\n')}\n`, 'utf8');
writeJsonl(path.join(outputDir, 'train.jsonl'), train);
writeJsonl(path.join(outputDir, 'validation.jsonl'), validationSet);
fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({ ok: true, output_dir: outputDir, manifest }, null, 2));
