import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RAW_DIR = join(ROOT, 'raw-feeds');

mkdirSync(RAW_DIR, { recursive: true });

const feedUrls = readFileSync(join(ROOT, 'linkuri feeduri.txt'), 'utf-8')
  .split('\n')
  .map(l => l.trim())
  .filter(Boolean);

console.log(`Found ${feedUrls.length} feed URLs`);

async function downloadFeed(url, index) {
  const filename = `feed-${String(index).padStart(3, '0')}.csv`;
  const filepath = join(RAW_DIR, filename);

  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    writeFileSync(filepath, text, 'utf-8');
    const lines = text.split('\n').length - 1;
    console.log(`  [${index + 1}/${feedUrls.length}] ${filename}: ${lines} products`);
    return { filename, lines, ok: true };
  } catch (err) {
    console.error(`  [${index + 1}/${feedUrls.length}] FAILED ${url}: ${err.message}`);
    return { filename, lines: 0, ok: false, error: err.message };
  }
}

console.log('Downloading feeds...');

// Download in batches of 5 to avoid overwhelming
const results = [];
const BATCH = 5;
for (let i = 0; i < feedUrls.length; i += BATCH) {
  const batch = feedUrls.slice(i, i + BATCH).map((url, j) => downloadFeed(url, i + j));
  const batchResults = await Promise.all(batch);
  results.push(...batchResults);
}

const successful = results.filter(r => r.ok);
const totalProducts = results.reduce((sum, r) => sum + r.lines, 0);
console.log(`\nDone: ${successful.length}/${feedUrls.length} feeds downloaded`);
console.log(`Total product lines: ~${totalProducts}`);

writeFileSync(join(RAW_DIR, 'download-report.json'), JSON.stringify(results, null, 2));
