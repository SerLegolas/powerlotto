import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const swPath = resolve(__dirname, '../public/service-worker.js');

const version = Date.now();
const content = readFileSync(swPath, 'utf-8');
const updated = content.replace(
  /const CACHE_NAME = "powerlotto-v\d+";/,
  `const CACHE_NAME = "powerlotto-v${version}";`
);

writeFileSync(swPath, updated, 'utf-8');
console.log(`[SW] Cache version aggiornata: powerlotto-v${version}`);
