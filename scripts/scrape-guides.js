import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const OUTPUT_FILE = join(DATA_DIR, 'google-suggestions-guides.json');

const DELAY_MS = 250;

function slugify(text) {
  const map = { 'ă':'a','â':'a','î':'i','ș':'s','ş':'s','ț':'t','ţ':'t','Ă':'A','Â':'A','Î':'I','Ș':'S','Ş':'S','Ț':'T','Ţ':'T','ä':'a','ö':'o','ü':'u','é':'e' };
  let r = text;
  for (const [f, t] of Object.entries(map)) r = r.split(f).join(t);
  return r.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 80);
}

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
    if (res.status === 429) { console.warn('Rate limited, pausing 30s'); await sleep(30000); return googleSuggest(query); }
    if (!res.ok) return [];
    const data = await res.json();
    return (data[1] || []).map(s => s.trim().toLowerCase());
  } catch { return []; }
}

// Load products
console.log('Loading products...');
const structure = JSON.parse(readFileSync(join(DATA_DIR, 'site-structure.json'), 'utf-8'));
const productsDir = join(DATA_DIR, 'products');
const allProducts = [];
for (const f of readdirSync(productsDir).filter(f => f.endsWith('.json'))) {
  allProducts.push(...JSON.parse(readFileSync(join(productsDir, f), 'utf-8')));
}
const productTexts = allProducts.map(p => stripDiacritics((p.t + ' ' + (p.b||'') + ' ' + (p.c||'')).toLowerCase()));
console.log(`${allProducts.length} products loaded`);

const catToMega = new Map();
for (const [megaSlug, cat] of Object.entries(structure.megaCategories)) {
  for (const sub of cat.subcategories) catToMega.set(sub.originalName || sub.name, megaSlug);
  if (cat.shards) {
    for (const shard of cat.shards) {
      try {
        for (const p of JSON.parse(readFileSync(join(productsDir, shard.file), 'utf-8'))) {
          if (p.c && !catToMega.has(p.c)) catToMega.set(p.c, megaSlug);
        }
      } catch {}
    }
  }
}

const SKIP_WORDS = new Set(['cele','mai','bune','bun','buna','cel','cea','cei','top','best','sub','lei',
  'ieftine','ieftin','ieftina','recomandari','pareri','recenzie','sau','cumpar','pentru','din','romania']);

function findProducts(keywords) {
  const kws = keywords.map(k => stripDiacritics(k.toLowerCase()));
  const matches = [];
  for (let i = 0; i < allProducts.length; i++) {
    if (kws.every(kw => productTexts[i].includes(kw))) matches.push(i);
  }
  return matches;
}

function guessMega(indices) {
  const counts = {};
  for (const idx of indices.slice(0, 300)) {
    const m = catToMega.get(allProducts[idx].c) || 'altele';
    counts[m] = (counts[m] || 0) + 1;
  }
  let best = 'altele', bc = 0;
  for (const [m, c] of Object.entries(counts)) if (c > bc) { best = m; bc = c; }
  return best;
}

// Guide-specific patterns
const SEEDS = [
  'laptop', 'laptopuri', 'telefon', 'telefoane', 'televizor', 'televizoare',
  'casti', 'tableta', 'monitor', 'camera', 'smartwatch', 'consola',
  'aspirator', 'frigider', 'masina de spalat', 'cuptor', 'aer conditionat',
  'canapea', 'saltea', 'scaun', 'scaun birou', 'scaun gaming', 'birou',
  'espressor', 'friteuza', 'robot bucatarie', 'fierbator',
  'bicicleta', 'trotineta', 'banda alergare', 'gantere',
  'adidasi', 'ghete', 'pantofi', 'geaca', 'rucsac', 'valiza', 'ceas',
  'carucior', 'scaun auto copii', 'bicicleta copii', 'jucarii', 'lego', 'patut',
  'anvelope', 'jante', 'ulei motor', 'baterie auto',
  'lanseta', 'mulineta', 'naluci',
  'parfum', 'crema', 'sampon', 'periuta electrica', 'epilator', 'aparat tuns',
  'hrana caini', 'hrana pisici',
  'cafea', 'vin', 'whisky',
  'imprimanta', 'router', 'ssd', 'placa video', 'procesor',
  'boiler', 'centrala termica', 'generator',
  'pat', 'dulap', 'covor', 'saltea copii',
  'drujba', 'motocoasa', 'motosapa',
  'cort', 'sac dormit', 'tensiometru',
  'masina spalat vase', 'uscator rufe', 'combina frigorifica',
  'panouri solare', 'pompa apa',
];

const GUIDE_PATTERNS = [
  s => `ce ${s} sa cumpar`,
  s => `ce ${s} sa aleg`,
  s => `cum aleg ${s}`,
  s => `cum aleg un ${s}`,
  s => `cum aleg o ${s}`,
  s => `care ${s} e mai bun`,
  s => `care ${s} e mai buna`,
  s => `care sunt cele mai bune ${s}`,
  s => `care ${s} merita`,
  s => `merita ${s}`,
  s => `merita sa cumpar ${s}`,
  s => `ce ${s} recomandati`,
  s => `${s} sfaturi`,
  s => `cum alegi ${s}`,
  s => `ce ${s} sa iau`,
  s => `de ce ${s}`,
  s => `cand ${s}`,
  s => `cat costa ${s}`,
  s => `ce ${s} e bun`,
  s => `ce ${s} e buna`,
];

const ALPHABET = 'abcdefghijklmnoprstuvz'.split('');

const allSuggestions = new Map();
let requestCount = 0;

function isRomanian(text) {
  const EN = /\b(best|worst|cheap|buy|price|how to|what is|where to|near me|for sale|online shop|amazon|ebay)\b/i;
  if (EN.test(text)) return false;
  return true;
}

function addSuggestion(suggestion) {
  let clean = suggestion.trim().toLowerCase().replace(/\s+/g, ' ').replace(/["""]/g, '');
  if (clean.length < 8 || clean.length > 80) return;
  if (!isRomanian(clean)) return;
  if (/\.(ro|com|net)\b|emag|altex|olx/.test(clean)) return;
  clean = clean.replace(/\b(20[0-9]{2})\b/g, '').replace(/\s+/g, ' ').trim();
  if (clean.length < 8) return;

  const slug = slugify(clean);
  if (!slug || slug.length < 5) return;
  if (allSuggestions.has(slug)) return;

  const words = stripDiacritics(clean).split(/\s+/).filter(w => w.length > 2);
  const searchWords = words.filter(w => !SKIP_WORDS.has(w));
  if (searchWords.length === 0) return;

  const matches = findProducts(searchWords);
  if (matches.length < 3) return;

  const mega = guessMega(matches);
  const title = clean.charAt(0).toUpperCase() + clean.slice(1);

  allSuggestions.set(slug, {
    title, slug, keywords: searchWords, type: 'guide',
    megaCategory: mega, productCount: matches.length,
  });
}

async function run() {
  console.log(`\n=== Phase 1: Guide patterns (${SEEDS.length} seeds x ${GUIDE_PATTERNS.length} patterns) ===`);
  for (let si = 0; si < SEEDS.length; si++) {
    const seed = SEEDS[si];
    if (si % 20 === 0) console.log(`  [${si}/${SEEDS.length}] "${seed}" — ${allSuggestions.size} found`);
    for (const pattern of GUIDE_PATTERNS) {
      const suggestions = await googleSuggest(pattern(seed));
      requestCount++;
      for (const s of suggestions) addSuggestion(s);
      await sleep(DELAY_MS);
    }
  }
  console.log(`Phase 1 done: ${allSuggestions.size} guides (${requestCount} requests)\n`);

  console.log('=== Phase 2: Alphabet on top guide seeds ===');
  const guideSeeds = ['ce sa cumpar', 'cum aleg', 'care e mai bun', 'merita sa cumpar', 'sfaturi', 'cat costa'];
  for (const gs of guideSeeds) {
    for (const letter of ALPHABET) {
      const suggestions = await googleSuggest(`${gs} ${letter}`);
      requestCount++;
      for (const s of suggestions) addSuggestion(s);
      await sleep(DELAY_MS);
    }
    console.log(`  "${gs}" done — ${allSuggestions.size} total`);
  }
  console.log(`Phase 2 done: ${allSuggestions.size} guides (${requestCount} requests)\n`);

  // Save
  const results = [...allSuggestions.values()].sort((a, b) => b.productCount - a.productCount);
  writeFileSync(OUTPUT_FILE, JSON.stringify({ scrapedAt: new Date().toISOString(), total: results.length, suggestions: results }, null, 2));
  console.log(`Saved ${results.length} guide suggestions to ${OUTPUT_FILE}`);

  const byMega = {};
  for (const s of results) byMega[s.megaCategory] = (byMega[s.megaCategory] || 0) + 1;
  console.log('\nPer category:');
  for (const [m, c] of Object.entries(byMega).sort((a, b) => b[1] - a[1])) console.log(`  ${m}: ${c}`);
}

run().catch(console.error);
