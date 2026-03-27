import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const SEARCH_DIR = join(DATA_DIR, 'search-pages');

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

// ========== LOAD ==========
console.log('Loading data...');
const structure = JSON.parse(readFileSync(join(DATA_DIR, 'site-structure.json'), 'utf-8'));

// Load all products
const productsDir = join(DATA_DIR, 'products');
const allProducts = [];
for (const f of readdirSync(productsDir).filter(f => f.endsWith('.json'))) {
  allProducts.push(...JSON.parse(readFileSync(join(productsDir, f), 'utf-8')));
}
const productTexts = allProducts.map(p => stripDiacritics((p.t + ' ' + (p.b || '') + ' ' + (p.c || '')).toLowerCase()));
console.log(`${allProducts.length} products loaded`);

// Category -> mega mapping
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

// Subcategory slugs (to avoid collisions)
const subcatSlugs = new Set();
for (const [megaSlug, cat] of Object.entries(structure.megaCategories)) {
  for (const sub of cat.subcategories) subcatSlugs.add(`${megaSlug}:${sub.slug}`);
}

// ========== MERGE SOURCES ==========
console.log('\n=== Merging sources ===');
let allRaw = [];

// Main scraper progress
const progressPath = join(DATA_DIR, 'scrape-progress.json');
if (existsSync(progressPath)) {
  const d = JSON.parse(readFileSync(progressPath, 'utf-8'));
  console.log(`  Main scraper: ${d.suggestions.length}`);
  allRaw.push(...d.suggestions);
}

// Guides
const guidesPath = join(DATA_DIR, 'google-suggestions-guides.json');
if (existsSync(guidesPath)) {
  const d = JSON.parse(readFileSync(guidesPath, 'utf-8'));
  console.log(`  Guides: ${d.total}`);
  allRaw.push(...d.suggestions);
}

console.log(`  Total raw: ${allRaw.length}`);

// ========== CLEAN ==========
console.log('\n=== Cleaning ===');
const SKIP_WORDS = new Set(['cele','mai','bune','bun','buna','cel','cea','cei',
  'top','best','sub','lei','ieftine','ieftin','ieftina',
  'recomandari','pareri','recenzie','sau','cumpar','pentru','din','romania','ron']);

const cleaned = [];
const seenSlugs = new Set();
let dropped = { short: 0, nonsense: 0, duplicate: 0, noProducts: 0, english: 0, subcatCollision: 0 };

for (const item of allRaw) {
  const title = item.title.toLowerCase().trim();
  const slug = item.slug || slugify(title);

  // Skip duplicates
  if (seenSlugs.has(slug)) { dropped.duplicate++; continue; }

  // Skip too short
  if (title.length < 6 || slug.length < 4) { dropped.short++; continue; }

  // Skip English
  if (/\b(best|worst|cheap|buy|price|how to|what is|near me|for sale|health care|default magento)\b/i.test(title)) { dropped.english++; continue; }

  // Skip nonsense patterns
  if (/^(de ce |lego de ce|copii sau copii|anvelope sau anvelope|casa sau|cat |sau )/.test(title)) { dropped.nonsense++; continue; }
  if (/^.{1,3} (sau|sub|pareri|ieftine)$/.test(title)) { dropped.nonsense++; continue; }
  if (title.endsWith(' sau') || title.endsWith(' sub') || title.endsWith(' in')) { dropped.nonsense++; continue; }

  // Skip store names
  if (/\b(emag|altex|pcgarage|flanco|dedeman|olx|okazii|lidl)\b/.test(title)) { dropped.nonsense++; continue; }

  // Recalculate product matches (keywords without stopwords)
  const words = stripDiacritics(title).split(/\s+/).filter(w => w.length > 2);
  const searchWords = words.filter(w => !SKIP_WORDS.has(w));
  if (searchWords.length === 0) { dropped.nonsense++; continue; }

  // Find matching products
  const kws = searchWords.map(k => k.toLowerCase());
  const matchIndices = [];
  for (let i = 0; i < allProducts.length; i++) {
    if (kws.every(kw => productTexts[i].includes(kw))) matchIndices.push(i);
    if (matchIndices.length >= 500) break; // cap for speed
  }

  if (matchIndices.length < 5) { dropped.noProducts++; continue; }

  // Fix mega category based on actual product matches
  const megaCounts = {};
  for (const idx of matchIndices.slice(0, 200)) {
    const m = catToMega.get(allProducts[idx].c) || 'altele';
    megaCounts[m] = (megaCounts[m] || 0) + 1;
  }
  let bestMega = 'altele', bestCount = 0;
  for (const [m, c] of Object.entries(megaCounts)) {
    if (c > bestCount) { bestMega = m; bestCount = c; }
  }

  // Skip if collides with a subcategory slug
  if (subcatSlugs.has(`${bestMega}:${slug}`)) { dropped.subcatCollision++; continue; }

  seenSlugs.add(slug);
  cleaned.push({
    title: item.title.charAt(0).toUpperCase() + item.title.slice(1),
    slug,
    keywords: searchWords,
    type: item.type || 'product',
    megaCategory: bestMega,
    productCount: matchIndices.length,
  });
}

console.log(`  Cleaned: ${cleaned.length}`);
console.log(`  Dropped:`, dropped);

// ========== DEDUP by similar keywords + same type ==========
console.log('\n=== Deduplication ===');
const MODIFIER_WORDS = new Set(['ieftin','ieftine','ieftina','bune','bun','buna',
  'buni','top','recomandari','pareri','recenzie','pret','oferta','reduceri']);

const final = [];
const seenBases = new Set();

// Sort by productCount desc so we keep the best version
cleaned.sort((a, b) => b.productCount - a.productCount);

for (const item of cleaned) {
  const base = item.keywords.filter(w => !MODIFIER_WORDS.has(w)).sort().join(' ');
  const key = `${base}::${item.type}`;
  if (seenBases.has(key)) continue;
  seenBases.add(key);
  final.push(item);
}

console.log(`  After dedup: ${final.length}`);

// ========== SAVE google-suggestions.json ==========
const output = {
  scrapedAt: new Date().toISOString(),
  total: final.length,
  suggestions: final,
};
writeFileSync(join(DATA_DIR, 'google-suggestions.json'), JSON.stringify(output, null, 2));
console.log(`\nSaved ${final.length} intents to google-suggestions.json`);

// ========== GENERATE SEARCH PAGE JSONs ==========
console.log('\n=== Generating search page JSONs ===');
if (!existsSync(SEARCH_DIR)) mkdirSync(SEARCH_DIR, { recursive: true });

// Clear old search pages
for (const f of readdirSync(SEARCH_DIR)) {
  if (f.endsWith('.json')) {
    const { unlinkSync } = await import('fs');
    unlinkSync(join(SEARCH_DIR, f));
  }
}

let generated = 0;
for (const intent of final) {
  const kws = intent.keywords.map(k => stripDiacritics(k.toLowerCase()));
  const matches = [];
  for (let i = 0; i < allProducts.length; i++) {
    if (kws.every(kw => productTexts[i].includes(kw))) {
      const p = allProducts[i];
      if (p.i && p.t && p.l) {
        matches.push({ t: p.t, i: p.i, l: p.l, b: p.b || '', m: p.m || '', c: p.c || '' });
      }
    }
    if (matches.length >= 100) break; // max 100 products per page
  }

  if (matches.length > 0) {
    writeFileSync(join(SEARCH_DIR, `${intent.slug}.json`), JSON.stringify(matches));
    generated++;
  }
}
console.log(`Generated ${generated} search page JSONs`);

// ========== STATS ==========
const byType = {}, byMega = {};
for (const s of final) {
  byType[s.type] = (byType[s.type] || 0) + 1;
  byMega[s.megaCategory] = (byMega[s.megaCategory] || 0) + 1;
}
console.log('\nBy type:');
for (const [t, c] of Object.entries(byType).sort((a, b) => b[1] - a[1])) console.log(`  ${t}: ${c}`);
console.log('\nBy category:');
for (const [m, c] of Object.entries(byMega).sort((a, b) => b[1] - a[1])) console.log(`  ${m}: ${c}`);
