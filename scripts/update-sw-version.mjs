import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const swPath = resolve(__dirname, '../public/service-worker.js');
const buildVersionPath = resolve(__dirname, '../public/build-version.json');
const generatedVersionPath = resolve(__dirname, '../lib/generated/build-version.ts');
const packageJsonPath = resolve(__dirname, '../package.json');

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const buildStamp = new Date()
  .toISOString()
  .replace(/[-:]/g, '')
  .replace(/\.\d{3}Z$/, '')
  .replace('T', '-');
const appVersion = `${packageJson.version}-${buildStamp}`;
const cacheName = `powerlotto-v${String(packageJson.version).replace(/\./g, '-')}-${buildStamp}`;

const content = readFileSync(swPath, 'utf-8');
const updated = content.replace(
  /const APP_VERSION = ".*";/,
  `const APP_VERSION = "${appVersion}";`
).replace(
  /const CACHE_NAME = ".*";/,
  `const CACHE_NAME = "${cacheName}";`
);

if (updated === content) {
  throw new Error('[SW] Impossibile aggiornare APP_VERSION/CACHE_NAME in public/service-worker.js');
}

writeFileSync(swPath, updated, 'utf-8');
writeFileSync(
  buildVersionPath,
  `${JSON.stringify({ version: appVersion, generatedAt: buildStamp }, null, 2)}\n`,
  'utf-8'
);

mkdirSync(dirname(generatedVersionPath), { recursive: true });
writeFileSync(
  generatedVersionPath,
  `export const BUILD_VERSION = ${JSON.stringify(appVersion)};\n`,
  'utf-8'
);

console.log(`[SW] Build version aggiornata: ${appVersion}`);
