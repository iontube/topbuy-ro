// Quick test: scrape a few seeds to see what Google Suggest returns
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');

function stripDiacritics(text) {
  const map = { 'ă':'a','â':'a','î':'i','ș':'s','ş':'s','ț':'t','ţ':'t','Ă':'A','Â':'A','Î':'I','Ș':'S','Ş':'S','Ț':'T','Ţ':'T' };
  let r = text;
  for (const [f, t] of Object.entries(map)) r = r.split(f).join(t);
  return r;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function googleSuggest(query) {
  const url = `http://suggestqueries.google.com/complete/search?client=firefox&hl=ro&gl=ro&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data[1] || []).map(s => s.trim());
  } catch (e) { return []; }
}

// Load products for matching
console.log('Loading products...');
const productsDir = join(DATA_DIR, 'products');
const allProducts = [];
for (const f of readdirSync(productsDir).filter(f => f.endsWith('.json'))) {
  allProducts.push(...JSON.parse(readFileSync(join(productsDir, f), 'utf-8')));
}
const productTexts = allProducts.map(p => stripDiacritics((p.t + ' ' + (p.b||'') + ' ' + (p.c||'')).toLowerCase()));
console.log(`${allProducts.length} products loaded\n`);

function countProducts(keywords) {
  const kws = keywords.map(k => stripDiacritics(k.toLowerCase()));
  let count = 0;
  for (const text of productTexts) {
    if (kws.every(kw => text.includes(kw))) count++;
  }
  return count;
}

const TEST_SEEDS = ['laptop', 'aspirator', 'adidasi', 'telefon', 'friteuza', 'carucior'];
const PATTERNS = [
  q => `cele mai bune ${q}`,
  q => `top ${q}`,
  q => `${q} ieftine`,
  q => `${q} sub `,
  q => `${q} pareri`,
  q => `ce ${q} sa cumpar`,
];

let total = 0;
for (const seed of TEST_SEEDS) {
  console.log(`\n===== ${seed.toUpperCase()} =====`);
  for (const pattern of PATTERNS) {
    const query = pattern(seed);
    const suggestions = await googleSuggest(query);
    for (const s of suggestions) {
      const words = stripDiacritics(s.toLowerCase()).split(/\s+/).filter(w => w.length > 2);
      const skip = new Set(['cele','mai','bune','bun','buna','cel','cea','top','sub','lei','ieftine','ieftin','recomandari','pareri','sau','cumpar','pentru','din']);
      const kws = words.filter(w => !skip.has(w));
      const count = kws.length ? countProducts(kws) : 0;
      const marker = count >= 5 ? '✓' : '✗';
      console.log(`  ${marker} [${count}] "${s}"`);
      total++;
    }
    await sleep(250);
  }
}
console.log(`\n\nTotal suggestions: ${total}`);
