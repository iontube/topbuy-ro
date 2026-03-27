import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const SEARCH_DIR = join(DATA_DIR, 'search-pages');

function strip(t) {
  const m = {'ă':'a','â':'a','î':'i','ș':'s','ş':'s','ț':'t','ţ':'t','Ă':'A','Â':'A','Î':'I','Ș':'S','Ş':'S','Ț':'T','Ţ':'T'};
  let r = t; for (const [f,to] of Object.entries(m)) r = r.split(f).join(to); return r;
}

// ========== LOAD ==========
console.log('Loading products...');
const allProducts = [];
for (const f of readdirSync(join(DATA_DIR, 'products')).filter(f => f.endsWith('.json'))) {
  allProducts.push(...JSON.parse(readFileSync(join(DATA_DIR, 'products', f), 'utf-8')));
}
console.log(`${allProducts.length} products`);

// Pre-compute per product
const titles = allProducts.map(p => strip(p.t.toLowerCase()));
const brands = allProducts.map(p => strip((p.b || '').toLowerCase()));
const cats = allProducts.map(p => strip((p.c || '').toLowerCase()));

const structure = JSON.parse(readFileSync(join(DATA_DIR, 'site-structure.json'), 'utf-8'));
const catToMega = new Map();
for (const [megaSlug, cat] of Object.entries(structure.megaCategories)) {
  for (const sub of cat.subcategories) catToMega.set(sub.originalName || sub.name, megaSlug);
  if (cat.shards) {
    for (const shard of cat.shards) {
      try {
        for (const p of JSON.parse(readFileSync(join(DATA_DIR, 'products', shard.file), 'utf-8'))) {
          if (p.c && !catToMega.has(p.c)) catToMega.set(p.c, megaSlug);
        }
      } catch {}
    }
  }
}

// ========== BUILD INVERTED INDEX ON TITLES ==========
console.log('Building inverted index...');
const titleIndex = new Map(); // word -> Set of product indices
const fullIndex = new Map();  // word -> Set of product indices (title+brand+cat)

for (let i = 0; i < allProducts.length; i++) {
  // Title words
  const tWords = new Set(titles[i].split(/[^a-z0-9]+/).filter(w => w.length > 2));
  for (const w of tWords) {
    if (!titleIndex.has(w)) titleIndex.set(w, new Set());
    titleIndex.get(w).add(i);
  }
  // Full text words (title + brand + cat)
  const fWords = new Set((titles[i] + ' ' + brands[i] + ' ' + cats[i]).split(/[^a-z0-9]+/).filter(w => w.length > 2));
  for (const w of fWords) {
    if (!fullIndex.has(w)) fullIndex.set(w, new Set());
    fullIndex.get(w).add(i);
  }
}
console.log(`Title index: ${titleIndex.size} words, Full index: ${fullIndex.size} words`);

const MODIFIERS = new Set(['ieftin','ieftine','ieftina','ieftini','bune','bun','buna','buni',
  'cele','mai','cel','cea','cei','top','recomandari','pareri','recenzie',
  'pentru','din','romania','nou','noi','noua','sub']);

// Simple Romanian stemming - get keyword variants to search for
function getVariants(kw) {
  const variants = new Set([kw]);
  // Remove common plural suffixes to get singular
  if (kw.endsWith('uri')) variants.add(kw.slice(0, -3)); // laptopuri -> laptop
  if (kw.endsWith('uri')) variants.add(kw.slice(0, -2) + 'l'); // not common but safe
  if (kw.endsWith('oare')) variants.add(kw.slice(0, -4) + 'or'); // aspiratoare -> aspirator
  if (kw.endsWith('ere')) variants.add(kw.slice(0, -3) + 'er'); // routere -> router
  if (kw.endsWith('ete')) variants.add(kw.slice(0, -3) + 'eta'); // tablete -> tableta
  if (kw.endsWith('ele')) variants.add(kw.slice(0, -3) + 'ea'); // canapele -> canapea
  if (kw.endsWith('te')) variants.add(kw.slice(0, -2) + 'ta'); // biciclete -> bicicleta
  if (kw.endsWith('ze')) variants.add(kw.slice(0, -2) + 'za'); // friteuze -> friteuza
  if (kw.endsWith('ii')) variants.add(kw.slice(0, -2) + 'ie'); // jucarii -> jucarie
  if (kw.endsWith('ne')) variants.add(kw.slice(0, -2) + 'na'); // drone -> drona
  if (kw.endsWith('le')) variants.add(kw.slice(0, -2) + 'la'); // saltele -> saltea
  if (kw.endsWith('me')) variants.add(kw.slice(0, -2) + 'ma'); // creme -> crema
  if (kw.endsWith('ci')) variants.add(kw.slice(0, -2) + 'ca'); // geci -> geaca (rough)
  if (kw.endsWith('i') && kw.length > 4) variants.add(kw.slice(0, -1)); // pantofi -> pantof
  if (kw.endsWith('e') && kw.length > 4) variants.add(kw.slice(0, -1)); // anvelope -> anvelop
  // Add singular -> plural too (for when query is singular)
  if (!kw.endsWith('i') && !kw.endsWith('e') && !kw.endsWith('uri')) {
    variants.add(kw + 'uri'); // laptop -> laptopuri
    variants.add(kw + 'e'); // anvelopa -> anvelope
    variants.add(kw + 'i'); // pantof -> pantofi
  }
  // Also add prefix match (minimum 4 chars)
  if (kw.length >= 5) variants.add(kw.slice(0, Math.max(4, kw.length - 2)));
  // Synonyms
  const synonyms = {
    'baterie': ['acumulator','acumulatoare','acumulatori'],
    'baterii': ['acumulatoare','acumulatori','acumulator'],
    'husa': ['carcasa','toc'],
    'casti': ['earbuds','headphones'],
    'frigider': ['combina frigorifica'],
  };
  if (synonyms[kw]) for (const syn of synonyms[kw]) variants.add(syn);
  return variants;
}

// Lookup in index with variants
function indexLookup(index, kw) {
  const variants = getVariants(kw);
  const combined = new Set();
  for (const v of variants) {
    const s = index.get(v);
    if (s) for (const idx of s) combined.add(idx);
  }
  return combined;
}

function intersectSets(sets) {
  if (sets.length === 0) return new Set();
  // Start with smallest set for speed
  sets.sort((a, b) => a.size - b.size);
  const result = new Set(sets[0]);
  for (let i = 1; i < sets.length; i++) {
    for (const v of result) {
      if (!sets[i].has(v)) result.delete(v);
    }
  }
  return result;
}

// ========== PROCESS ==========
const suggestions = JSON.parse(readFileSync(join(DATA_DIR, 'google-suggestions.json'), 'utf-8')).suggestions;
console.log(`\nProcessing ${suggestions.length} intents...`);

let totalPages = 0, totalProducts = 0, dropped = 0;
const MAX_PRODUCTS = 500;

for (let si = 0; si < suggestions.length; si++) {
  const s = suggestions[si];
  const keywords = s.keywords.map(k => strip(k.toLowerCase()));
  const coreKws = keywords.filter(k => !MODIFIERS.has(k));
  if (coreKws.length === 0) { dropped++; continue; }

  if (si % 500 === 0) console.log(`  [${si}/${suggestions.length}] ${totalPages} pages`);

  // TIER 1: All core keywords in TITLE (with stemming variants)
  const titleSets = coreKws.map(kw => indexLookup(titleIndex, kw));
  const tier1 = intersectSets(titleSets.filter(s => s.size > 0));

  // TIER 2: Main keyword in title, rest in full text
  let tier2 = new Set();
  if (tier1.size < 20 && coreKws.length > 1) {
    for (const anchorKw of coreKws) {
      const anchorSet = indexLookup(titleIndex, anchorKw);
      if (anchorSet.size === 0) continue;
      const otherKws = coreKws.filter(k => k !== anchorKw);
      const otherSets = otherKws.map(kw => indexLookup(fullIndex, kw));
      const others = intersectSets(otherSets.filter(s => s.size > 0));
      for (const idx of anchorSet) {
        if (others.has(idx) && !tier1.has(idx)) tier2.add(idx);
      }
    }
  }

  // TIER 3: All keywords in full text (weakest - only if we have very few)
  let tier3 = new Set();
  if (tier1.size + tier2.size < 10) {
    const fullSets = coreKws.map(kw => indexLookup(fullIndex, kw));
    const allFull = intersectSets(fullSets.filter(s => s.size > 0));
    for (const idx of allFull) {
      if (!tier1.has(idx) && !tier2.has(idx)) tier3.add(idx);
    }
  }

  // Combine with scores
  const scored = [];
  for (const idx of tier1) scored.push({ idx, score: 100 });
  for (const idx of tier2) scored.push({ idx, score: 50 });
  for (const idx of tier3) scored.push({ idx, score: 10 });

  // Bonus/penalties
  const phrase = strip(coreKws.join(' '));
  const firstCore = coreKws[0] || '';
  const firstVariants = firstCore ? getVariants(firstCore) : new Set();
  const kwSet = new Set(coreKws);

  for (const item of scored) {
    const title = titles[item.idx];
    const pMega = catToMega.get(allProducts[item.idx].c) || 'altele';

    // ── BONUSES ──
    // Mega category: big bonus for match, big penalty for mismatch
    if (pMega === s.megaCategory) item.score += 30;
    else item.score -= 40;
    // Phrase match in title (all keywords adjacent)
    if (phrase && title.includes(phrase)) item.score += 30;
    // Title STARTS with any variant of first core keyword
    if ([...firstVariants].some(v => title.startsWith(v + ' ') || title.startsWith(v + ','))) item.score += 20;
    // Keyword in first 3 words of title
    const first3words = title.split(/\s+/).slice(0, 3).join(' ');
    if ([...firstVariants].some(v => first3words.includes(v))) item.score += 15;
    // Phrase match with variants
    if (phrase && title.includes(phrase)) item.score += 25;
    // Short title = specific product, not a bundle description
    if (title.split(/\s+/).length < 12) item.score += 5;

    // ── PENALTIES: BULK / INDUSTRIAL ──
    // Large volumes (butoaie, bidoane industriale)
    const volMatch = title.match(/\b(\d+)\s*l\b/);
    if (volMatch) {
      const liters = parseInt(volMatch[1]);
      if (liters >= 200) item.score -= 80;
      else if (liters >= 50) item.score -= 60;
      else if (liters >= 20) item.score -= 40;
      else if (liters >= 10) item.score -= 20;
    }
    // Large weights
    const kgMatch = title.match(/\b(\d+)\s*kg\b/);
    if (kgMatch) {
      const kg = parseInt(kgMatch[1]);
      if (kg >= 100) item.score -= 40;
      else if (kg >= 25) item.score -= 20;
    }
    if (/\b(bulk|industrial|engros|paleti?|bax)\b/.test(title)) item.score -= 50;

    // ── PENALTIES: ACCESSORIES ──
    // Accessories when user searches for main product
    const accWords = ['suport','husa','folie','cablu','adaptor','stand','carcasa','protectie',
      'incarcator','bratara','curea','geanta','toc','bumper','skin','sticker',
      'suport pentru','rama','capac','sertar','raft','etajera'];
    if (accWords.some(w => title.includes(w) && !kwSet.has(w))) item.score -= 20;

    // ── PENALTIES: BUNDLES / SETS ──
    // Sets/packs when user searches for individual product
    const bundleWords = ['set ','kit ','pachet ','pachet revizie','combo ','lot ','2x ','3x ','4x ','5x ','6x ','10x '];
    if (bundleWords.some(w => title.includes(w)) && !kwSet.has('set') && !kwSet.has('kit') && !kwSet.has('pachet')) {
      item.score -= 25;
    }

    // ── PENALTIES: WRONG PRODUCT TYPE ──
    // Spare parts when searching for main product
    const partWords = ['piesa','piese','garnitura','o-ring','oring','filtru de aer','element filtrant'];
    if (partWords.some(w => title.includes(w) && !kwSet.has(w.split(' ')[0]))) item.score -= 15;

    // ── PENALTIES: GENERIC / IRRELEVANT ──
    // Very long titles (usually bundle descriptions)
    if (title.split(/\s+/).length > 25) item.score -= 10;
    // Title contains "compatibil" = aftermarket/clone
    if (title.includes('compatibil') && !kwSet.has('compatibil')) item.score -= 5;
    // "Garantie" or "Service" in title = not a product
    if (/\b(garantie|service|reparatie|mentenanta|montaj)\b/.test(title) && !kwSet.has('garantie')) item.score -= 30;

    // Peripheral/tool when searching for main product
    // "tester baterie" is NOT a "baterie", "incarcator laptop" is NOT a "laptop"
    const peripherals = ['tester','incarcator','redresor','robot incarcare','borna','borne',
      'cablu pornire','clema','cleste','geanta','dulap','raft','stativ','trepied',
      'telecomanda','prelungitor','rack','dispenser','dozator','pompa','compresor',
      'detector','senzor','indicator','afisaj','display profesional','ecran profesional',
      'monitor profesional','cooler','cooling pad'];
    const titleStart2 = title.split(/\s+/).slice(0, 3).join(' ');
    if (peripherals.some(pp => titleStart2.startsWith(pp)) && !coreKws.some(kw => titleStart2.startsWith(kw))) {
      item.score -= 50;
    }
  }

  // Sort: first by "title starts with keyword" (primary products first), then by score
  scored.sort((a, b) => {
    const aTitle = titles[a.idx];
    const bTitle = titles[b.idx];
    // Primary product: title starts with any variant of core keyword in first 3 words
    const aFirst3 = aTitle.split(/\s+/).slice(0, 3).join(' ');
    const bFirst3 = bTitle.split(/\s+/).slice(0, 3).join(' ');
    const allVariants = coreKws.flatMap(kw => [...getVariants(kw)]);
    const aPrimary = allVariants.some(v => aFirst3.includes(v)) ? 1 : 0;
    const bPrimary = allVariants.some(v => bFirst3.includes(v)) ? 1 : 0;
    if (aPrimary !== bPrimary) return bPrimary - aPrimary; // primaries first
    return b.score - a.score;
  });

  const topProducts = [];
  for (const item of scored) {
    if (topProducts.length >= MAX_PRODUCTS) break;
    if (item.score < 10) continue;
    const p = allProducts[item.idx];
    if (p.i && p.t && p.l) {
      topProducts.push({ t: p.t, i: p.i, l: p.l, b: p.b || '', m: p.m || '', c: p.c || '', p: parseFloat(p.p) || 0 });
    }
  }

  if (topProducts.length >= 3) {
    writeFileSync(join(SEARCH_DIR, `${s.slug}.json`), JSON.stringify(topProducts));
    s.productCount = topProducts.length;
    totalPages++;
    totalProducts += topProducts.length;
  } else {
    dropped++;
  }
}

const valid = suggestions.filter(s => s.productCount >= 3);
writeFileSync(join(DATA_DIR, 'google-suggestions.json'), JSON.stringify({
  scrapedAt: new Date().toISOString(), total: valid.length, suggestions: valid
}, null, 2));

console.log(`\n=== DONE ===`);
console.log(`Pages: ${totalPages}, Dropped: ${dropped}`);
console.log(`Avg products/page: ${Math.round(totalProducts / totalPages)}`);
console.log(`Final intents: ${valid.length}`);

// Samples
for (const slug of ['top-produse-ingrijire-ten', 'cele-mai-bune-laptopuri', 'parfum-ieftine-barbati', 'cele-mai-bune-carti-de-dezvoltare-personala']) {
  console.log(`\n=== ${slug} ===`);
  try {
    const prods = JSON.parse(readFileSync(join(SEARCH_DIR, `${slug}.json`), 'utf-8'));
    console.log(`${prods.length} products`);
    for (const p of prods.slice(0, 5)) console.log(`  ${p.t.substring(0, 65)} | ${p.c.substring(0, 35)}`);
  } catch { console.log('  (not found)'); }
}
