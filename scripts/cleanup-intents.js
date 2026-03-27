import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
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

const data = JSON.parse(readFileSync(join(DATA_DIR, 'google-suggestions.json'), 'utf-8'));
let suggestions = data.suggestions;
console.log(`Starting with ${suggestions.length} intents\n`);

// ========== 1. FIX MEGA CATEGORIES ==========
console.log('=== Fixing mega categories ===');

// Explicit keyword -> mega mapping (overrides auto-detection)
const KEYWORD_MEGA = {
  // Electronice
  'laptop': 'electronice-it', 'laptopuri': 'electronice-it',
  'telefon': 'electronice-it', 'telefoane': 'electronice-it', 'iphone': 'electronice-it', 'samsung galaxy': 'electronice-it',
  'televizor': 'electronice-it', 'televizoare': 'electronice-it',
  'casti': 'electronice-it', 'boxe': 'electronice-it', 'soundbar': 'electronice-it',
  'monitor': 'electronice-it', 'monitoare': 'electronice-it',
  'tableta': 'electronice-it', 'tablete': 'electronice-it',
  'smartwatch': 'electronice-it', 'power bank': 'electronice-it',
  'imprimanta': 'electronice-it', 'router': 'electronice-it',
  'ssd': 'electronice-it', 'placa video': 'electronice-it', 'procesor': 'electronice-it',
  'camera foto': 'electronice-it', 'aparat foto': 'electronice-it',
  'camera supraveghere': 'electronice-it', 'camera ip': 'electronice-it',
  'consola': 'electronice-it', 'playstation': 'electronice-it', 'xbox': 'electronice-it',
  'drona': 'electronice-it', 'proiector': 'electronice-it',
  'tastatura': 'electronice-it', 'mouse': 'electronice-it',
  // Auto
  'anvelope': 'auto-moto', 'jante': 'auto-moto', 'ulei motor': 'auto-moto',
  'baterie auto': 'auto-moto', 'acumulator auto': 'auto-moto',
  'camera marsarier': 'auto-moto',
  // Casa
  'aspirator': 'casa-gradina', 'frigider': 'casa-gradina', 'combina frigorifica': 'casa-gradina',
  'masina de spalat': 'casa-gradina', 'cuptor': 'casa-gradina', 'aer conditionat': 'casa-gradina',
  'canapea': 'casa-gradina', 'saltea': 'casa-gradina', 'pat tapitat': 'casa-gradina',
  'espressor': 'casa-gradina', 'friteuza': 'casa-gradina', 'fierbator': 'casa-gradina',
  'boiler': 'casa-gradina', 'centrala termica': 'casa-gradina',
  'drujba': 'casa-gradina', 'motocoasa': 'casa-gradina', 'motosapa': 'casa-gradina',
  'covor': 'casa-gradina', 'lenjerie pat': 'casa-gradina',
  // Copii
  'carucior': 'copii-jucarii', 'scaun auto copii': 'copii-jucarii',
  'jucarii': 'copii-jucarii', 'lego': 'copii-jucarii',
  'bicicleta copii': 'copii-jucarii', 'tricicleta': 'copii-jucarii',
  'patut': 'copii-jucarii', 'masinuta electrica': 'copii-jucarii',
  // Fashion
  'adidasi': 'fashion', 'ghete': 'fashion', 'pantofi': 'fashion', 'bocanci': 'fashion',
  'sandale': 'fashion', 'cizme': 'fashion',
  'geaca': 'fashion', 'rochie': 'fashion', 'rochii': 'fashion',
  'rucsac': 'fashion', 'geanta': 'fashion', 'valiza': 'fashion', 'troller': 'fashion',
  'ochelari': 'fashion', 'ceas barbati': 'fashion', 'ceas dama': 'fashion',
  // Sport
  'bicicleta': 'sport', 'trotineta': 'sport', 'banda alergare': 'sport',
  'gantere': 'sport', 'cort camping': 'sport', 'sac dormit': 'sport',
  // Pescuit
  'lanseta': 'pescuit', 'mulineta': 'pescuit', 'naluci': 'pescuit',
  // Sanatate
  'parfum': 'sanatate-frumusete', 'parfumuri': 'sanatate-frumusete',
  'crema': 'sanatate-frumusete', 'sampon': 'sanatate-frumusete',
  'periuta electrica': 'sanatate-frumusete', 'epilator': 'sanatate-frumusete',
  'tensiometru': 'sanatate-frumusete',
  // Animale
  'hrana caini': 'animale', 'hrana pisici': 'animale',
};

let megaFixes = 0;
for (const s of suggestions) {
  const t = s.title.toLowerCase();
  for (const [kw, mega] of Object.entries(KEYWORD_MEGA)) {
    if (t.includes(kw) && s.megaCategory !== mega) {
      s.megaCategory = mega;
      megaFixes++;
      break;
    }
  }
}
console.log(`  Fixed ${megaFixes} mega categories`);

// ========== 2. REMOVE IRRELEVANT / VAGUE INTENTS ==========
console.log('\n=== Removing irrelevant intents ===');

const beforeCount = suggestions.length;

// Keywords that are too vague and match random products
const VAGUE_KEYWORDS = new Set(['sub', 'apa', 'camera', 'pat', 'masa', 'casa', 'set',
  'suport', 'capac', 'raft', 'cutie', 'sac', 'cos', 'bol']);

suggestions = suggestions.filter(s => {
  const t = s.title.toLowerCase();
  const kws = s.keywords;

  // Remove if ALL keywords are vague (no specific product word)
  if (kws.length <= 2 && kws.every(w => VAGUE_KEYWORDS.has(w))) return false;

  // Remove specific nonsense
  if (t === 'camera sub apa' || t === 'camera sub') return false;
  if (/^(de ce |cat costa un |lego de ce)/.test(t) && s.type !== 'guide') return false;
  if (t.endsWith(' sau') || t.endsWith(' sub') || t.endsWith(' in') || t.endsWith(' de')) return false;

  // Remove very short generic titles
  if (t.split(' ').length <= 1) return false;

  return true;
});

console.log(`  Removed ${beforeCount - suggestions.length} irrelevant intents`);

// ========== 3. PRODUCT RELEVANCE CHECK ==========
console.log('\n=== Checking product relevance ===');

// Load products
const productsDir = join(DATA_DIR, 'products');
const allProducts = [];
for (const f of readdirSync(productsDir).filter(f => f.endsWith('.json'))) {
  allProducts.push(...JSON.parse(readFileSync(join(productsDir, f), 'utf-8')));
}
const productTexts = allProducts.map(p => stripDiacritics(p.t.toLowerCase()));

// For each intent, check if products actually match the FULL phrase, not just individual words
let relevanceDropped = 0;
suggestions = suggestions.filter(s => {
  const kws = s.keywords;
  if (kws.length < 2) return true; // single keyword is always relevant

  // Check: do products contain the keywords NEAR each other (within same product title)?
  const fullPhrase = stripDiacritics(kws.join(' ').toLowerCase());
  let phraseMatches = 0;
  for (let i = 0; i < Math.min(allProducts.length, 100000); i++) {
    if (productTexts[i].includes(fullPhrase)) {
      phraseMatches++;
      if (phraseMatches >= 3) break;
    }
  }

  // If no phrase matches, check individual keyword matches but require the main keyword
  if (phraseMatches < 3) {
    // Get the most specific keyword (longest, not a modifier)
    const mainKw = kws.filter(w => !VAGUE_KEYWORDS.has(w) && w.length > 3)
      .sort((a, b) => b.length - a.length)[0];
    if (!mainKw) { relevanceDropped++; return false; }

    let mainMatches = 0;
    for (let i = 0; i < Math.min(allProducts.length, 100000); i++) {
      if (productTexts[i].includes(stripDiacritics(mainKw.toLowerCase()))) {
        mainMatches++;
        if (mainMatches >= 10) break;
      }
    }
    if (mainMatches < 10) { relevanceDropped++; return false; }
  }

  return true;
});
console.log(`  Dropped ${relevanceDropped} for low relevance`);

// ========== 4. REGENERATE SEARCH PAGE JSONs ==========
console.log('\n=== Regenerating search page JSONs ===');

// Build slug set for valid intents
const validSlugs = new Set(suggestions.map(s => s.slug));

// Remove old search pages that are no longer valid
let removed = 0;
for (const f of readdirSync(SEARCH_DIR).filter(f => f.endsWith('.json'))) {
  const slug = f.replace('.json', '');
  if (!validSlugs.has(slug)) {
    unlinkSync(join(SEARCH_DIR, f));
    removed++;
  }
}
console.log(`  Removed ${removed} obsolete search page JSONs`);

// Regenerate with stricter matching for problematic ones
let regenerated = 0;
for (const s of suggestions) {
  const pagePath = join(SEARCH_DIR, `${s.slug}.json`);
  // Only regenerate if keywords suggest potential issues
  const kws = s.keywords.map(k => stripDiacritics(k.toLowerCase()));

  const matches = [];
  for (let i = 0; i < allProducts.length; i++) {
    const title = productTexts[i];
    // All keywords must appear in the product TITLE (not just any field)
    if (kws.every(kw => title.includes(kw))) {
      const p = allProducts[i];
      if (p.i && p.t && p.l) {
        matches.push({ t: p.t, i: p.i, l: p.l, b: p.b || '', m: p.m || '', c: p.c || '' });
      }
    }
    if (matches.length >= 500) break;
  }

  if (matches.length >= 3) {
    writeFileSync(pagePath, JSON.stringify(matches));
    s.productCount = matches.length;
    regenerated++;
  }
}
console.log(`  Regenerated ${regenerated} search page JSONs`);

// Remove intents with too few products after strict matching
const beforeStrict = suggestions.length;
suggestions = suggestions.filter(s => s.productCount >= 3);
console.log(`  Dropped ${beforeStrict - suggestions.length} with <3 products after strict match`);

// ========== 5. SAVE ==========
const output = { scrapedAt: new Date().toISOString(), total: suggestions.length, suggestions };
writeFileSync(join(DATA_DIR, 'google-suggestions.json'), JSON.stringify(output, null, 2));

console.log(`\n=== FINAL: ${suggestions.length} intents ===`);

const byMega = {};
for (const s of suggestions) byMega[s.megaCategory] = (byMega[s.megaCategory] || 0) + 1;
for (const [m, c] of Object.entries(byMega).sort((a, b) => b[1] - a[1])) console.log(`  ${m}: ${c}`);

// Clean up orphaned content entries
const contentData = JSON.parse(readFileSync(join(DATA_DIR, 'content', 'seo-content.json'), 'utf-8'));
let orphaned = 0;
for (const key of Object.keys(contentData)) {
  if (key.startsWith('search:')) {
    const slug = key.replace('search:', '');
    if (!validSlugs.has(slug)) {
      delete contentData[key];
      orphaned++;
    }
  }
}
writeFileSync(join(DATA_DIR, 'content', 'seo-content.json'), JSON.stringify(contentData, null, 2));
console.log(`\nCleaned ${orphaned} orphaned content entries`);
