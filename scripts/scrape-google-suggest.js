import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');

// ========== CONFIG ==========
const DELAY_MS = 250;          // safe delay between requests
const MIN_PRODUCTS = 5;        // minimum products to keep a suggestion
const OUTPUT_FILE = join(DATA_DIR, 'google-suggestions.json');

// ========== HELPERS ==========
function slugify(text) {
  const map = {
    'ă': 'a', 'â': 'a', 'î': 'i', 'ș': 's', 'ş': 's', 'ț': 't', 'ţ': 't',
    'Ă': 'A', 'Â': 'A', 'Î': 'I', 'Ș': 'S', 'Ş': 'S', 'Ț': 'T', 'Ţ': 'T',
    'ä': 'a', 'ö': 'o', 'ü': 'u', 'é': 'e', 'è': 'e', 'ê': 'e',
  };
  let result = text;
  for (const [from, to] of Object.entries(map)) result = result.split(from).join(to);
  return result.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 80);
}

function stripDiacritics(text) {
  const map = {
    'ă': 'a', 'â': 'a', 'î': 'i', 'ș': 's', 'ş': 's', 'ț': 't', 'ţ': 't',
    'Ă': 'A', 'Â': 'A', 'Î': 'I', 'Ș': 'S', 'Ş': 'S', 'Ț': 'T', 'Ţ': 'T',
  };
  let result = text;
  for (const [from, to] of Object.entries(map)) result = result.split(from).join(to);
  return result;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ========== GOOGLE SUGGEST ==========
let consecutiveErrors = 0;
async function googleSuggest(query) {
  const url = `http://suggestqueries.google.com/complete/search?client=firefox&hl=ro&gl=ro&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url);
    if (res.status === 429) {
      console.warn(`  ⚠ Rate limited! Pausing 30s...`);
      await sleep(30000);
      consecutiveErrors++;
      if (consecutiveErrors > 5) { console.error('Too many rate limits, stopping.'); process.exit(1); }
      return googleSuggest(query); // retry once
    }
    if (!res.ok) return [];
    consecutiveErrors = 0;
    const data = await res.json();
    return (data[1] || []).map(s => s.trim().toLowerCase());
  } catch (e) {
    console.error(`  Error: "${query}": ${e.message}`);
    consecutiveErrors++;
    if (consecutiveErrors > 10) { console.error('Too many errors, stopping.'); process.exit(1); }
    return [];
  }
}

// ========== LOAD PRODUCT DATA ==========
console.log('Loading product data...');
const structure = JSON.parse(readFileSync(join(DATA_DIR, 'site-structure.json'), 'utf-8'));

const productsDir = join(DATA_DIR, 'products');
const allProducts = [];
for (const f of readdirSync(productsDir).filter(f => f.endsWith('.json'))) {
  allProducts.push(...JSON.parse(readFileSync(join(productsDir, f), 'utf-8')));
}
console.log(`Loaded ${allProducts.length} products`);

// Pre-compute lowercase search text
const productSearchTexts = allProducts.map(p =>
  stripDiacritics((p.t + ' ' + (p.b || '') + ' ' + (p.c || '')).toLowerCase())
);

// Map category -> megaCategory
const catToMega = new Map();
for (const [megaSlug, cat] of Object.entries(structure.megaCategories)) {
  for (const sub of cat.subcategories) {
    catToMega.set(sub.originalName || sub.name, megaSlug);
  }
  if (cat.shards) {
    for (const shard of cat.shards) {
      try {
        const data = JSON.parse(readFileSync(join(productsDir, shard.file), 'utf-8'));
        for (const p of data) {
          if (p.c && !catToMega.has(p.c)) catToMega.set(p.c, megaSlug);
        }
      } catch {}
    }
  }
}

function findProducts(keywords) {
  const kws = keywords.map(k => stripDiacritics(k.toLowerCase()));
  const matches = [];
  for (let i = 0; i < allProducts.length; i++) {
    if (kws.every(kw => productSearchTexts[i].includes(kw))) matches.push(i);
  }
  return matches;
}

function guessMegaCategory(productIndices) {
  const megaCounts = {};
  for (const idx of productIndices.slice(0, 300)) {
    const mega = catToMega.get(allProducts[idx].c) || 'altele';
    megaCounts[mega] = (megaCounts[mega] || 0) + 1;
  }
  let best = 'altele', bestCount = 0;
  for (const [m, c] of Object.entries(megaCounts)) {
    if (c > bestCount) { best = m; bestCount = c; }
  }
  return best;
}

// ========== FILTER & CLASSIFY ==========
function isRomanian(text) {
  const EN_MARKERS = /\b(best|worst|cheap|buy|price|how to|what is|where to|near me|for sale|online shop|free shipping|deals|discount|amazon|ebay|aliexpress|walmart|the best|which|should i|worth it)\b/i;
  if (EN_MARKERS.test(text)) return false;
  // Accept if it has Romanian markers OR if the query is just a product name (no language markers needed)
  const RO_MARKERS = /\b(cele|cel|cea|cei|mai|bune|bun|buna|buni|top|sau|pentru|din|lei|ieftin|ieftine|ieftina|recomandari|pareri|recenzie|ghid|cum|unde|pret|calitate|magazin|romania|copii|barbati|dama|femei|electric|electrica|automat|automata|fara|cele|sub)\b|[ăâîșț]/i;
  return RO_MARKERS.test(text);
}

const SKIP_WORDS = new Set(['cele', 'mai', 'bune', 'bun', 'buna', 'cel', 'cea', 'cei',
  'top', 'best', 'sub', 'lei', 'ieftine', 'ieftin', 'ieftina',
  'recomandari', 'pareri', 'recenzie', 'sau', 'cumpar',
  'pentru', 'din', 'romania', 'ron']);

function classifyType(text) {
  if (/^(cele mai bune|cel mai bun|cea mai buna)/.test(text)) return 'best-of';
  if (/^top\s/.test(text)) return 'top';
  if (/sub\s+\d+\s*(lei|ron)?/.test(text)) return 'budget';
  if (/ieftin|ieftine|ieftina/.test(text)) return 'cheap';
  if (/pareri|recenzie/.test(text)) return 'review';
  if (/\bsau\b/.test(text)) return 'comparison';
  if (/ce\s+.*sa\s+(cumpar|aleg)|cum\s+aleg|ghid/.test(text)) return 'guide';
  return 'product';
}

// ========== COLLECTION ==========
const allSuggestions = new Map();
let requestCount = 0;

function addSuggestion(suggestion, source) {
  let clean = suggestion.trim().toLowerCase().replace(/\s+/g, ' ').replace(/["""]/g, '');
  if (clean.length < 5 || clean.length > 80) return;
  if (!isRomanian(clean)) return;
  if (clean.includes('http') || clean.includes('www.') || /\.(ro|com|net)\b/.test(clean)) return;
  if (/[{}[\]<>]/.test(clean)) return;
  // Strip store names
  if (/\b(emag|altex|pcgarage|flanco|dedeman|mediagalaxy|olx|okazii)\b/.test(clean)) return;

  // Normalize years: strip all years
  clean = clean.replace(/\b(20[0-9]{2})\b/g, '').replace(/\s+/g, ' ').trim();
  if (clean.length < 5) return;

  const slug = slugify(clean);
  if (!slug || slug.length < 3) return;
  if (allSuggestions.has(slug)) return;

  const words = stripDiacritics(clean).split(/\s+/).filter(w => w.length > 2);
  const searchWords = words.filter(w => !SKIP_WORDS.has(w));
  if (searchWords.length === 0) return;

  const matches = findProducts(searchWords);
  if (matches.length < MIN_PRODUCTS) return;

  const mega = guessMegaCategory(matches);
  const type = classifyType(clean);
  const title = clean.charAt(0).toUpperCase() + clean.slice(1);

  allSuggestions.set(slug, {
    title, slug, keywords: searchWords, type,
    megaCategory: mega, productCount: matches.length, source,
  });
}

// ========== SEEDS ==========
// Manual seeds: products people actually search for in Romania
const MANUAL_SEEDS = [
  // Electronice & IT
  'laptop', 'laptopuri', 'laptop gaming', 'laptop ieftin',
  'telefon', 'telefoane', 'telefon samsung', 'telefon xiaomi', 'telefon iphone', 'telefon motorola', 'telefon huawei',
  'televizor', 'televizoare', 'televizor smart', 'televizor 4k', 'televizor oled',
  'casti', 'casti bluetooth', 'casti wireless', 'casti gaming',
  'tableta', 'tablete', 'tableta samsung', 'tableta copii',
  'monitor', 'monitoare', 'monitor gaming', 'monitor 4k',
  'camera', 'camere', 'camera supraveghere', 'camera web',
  'tastatura', 'tastaturi', 'tastatura mecanica', 'tastatura gaming',
  'mouse', 'mouse gaming', 'mouse wireless',
  'imprimanta', 'imprimante', 'imprimanta laser', 'imprimanta multifunctionala',
  'router', 'routere', 'router wifi',
  'ssd', 'hard disk', 'memorie ram',
  'placa video', 'procesor', 'placa de baza', 'sursa pc', 'carcasa pc',
  'smartwatch', 'smartwatch barbati', 'smartwatch dama',
  'power bank', 'incarcator', 'incarcator wireless',
  'boxe', 'boxe bluetooth', 'boxe portabile', 'soundbar',
  'consola', 'playstation', 'xbox', 'nintendo switch',
  'proiector', 'drona', 'e-reader', 'kindle',
  'husa telefon', 'folie protectie', 'cablu usb',
  // Casa & Gradina
  'aspirator', 'aspiratoare', 'aspirator robot', 'aspirator vertical', 'aspirator fara sac', 'aspirator cu spalare',
  'frigider', 'frigidere', 'frigider side by side', 'frigider incorporabil',
  'combina frigorifica', 'combine frigorifice',
  'masina de spalat', 'masina de spalat rufe', 'masina de spalat vase',
  'uscator rufe', 'cuptor', 'cuptor microunde', 'cuptor electric', 'cuptor incorporabil',
  'aer conditionat', 'centrala termica', 'calorifer electric', 'convector',
  'boiler', 'boiler electric',
  'canapea', 'canapea extensibila', 'canapea coltar',
  'saltea', 'saltea ortopedica', 'saltea memory foam',
  'pat', 'pat tapitat', 'pat matrimonial', 'pat copii',
  'scaun', 'scaun birou', 'scaun gaming', 'scaun ergonomic',
  'birou', 'birou gaming', 'birou copii',
  'dulap', 'dulap haine', 'comoda',
  'masa', 'masa extensibila', 'masa bucatarie',
  'covor', 'covoare', 'covor living',
  'espressor', 'espressor cafea', 'espressor automat', 'cafetiera',
  'friteuza', 'friteuza cu aer cald', 'air fryer',
  'robot bucatarie', 'multicooker', 'blender', 'mixer', 'toaster',
  'fierbator', 'fierbator electric',
  'panouri solare', 'generator curent', 'invertor',
  'pompa submersibila', 'pompa apa', 'hidrofor',
  'motosapa', 'motocoasa', 'drujba', 'fierastrau',
  'masina de tuns iarba', 'scarificator', 'tocator crengi',
  'aparat sudura', 'compresor', 'bormasina',
  'lenjerie pat', 'perna', 'pilota', 'perdea', 'draperie',
  'cada', 'cabina dus', 'baterie baie', 'chiuveta',
  // Fashion
  'adidasi', 'adidasi barbati', 'adidasi dama', 'adidasi copii', 'adidasi nike', 'adidasi adidas', 'adidasi puma',
  'ghete', 'ghete barbati', 'ghete dama', 'ghete iarna',
  'pantofi', 'pantofi barbati', 'pantofi dama', 'pantofi sport',
  'sandale', 'sandale dama', 'sandale barbati', 'sandale copii',
  'cizme', 'cizme dama', 'cizme barbati',
  'bocanci', 'bocanci barbati', 'bocanci dama', 'bocanci iarna',
  'geaca', 'geaca barbati', 'geaca dama', 'geaca iarna', 'geaca puf',
  'rochie', 'rochii', 'rochie eleganta', 'rochie de seara',
  'tricou', 'tricouri', 'tricou barbati', 'tricou dama',
  'blugi', 'blugi barbati', 'blugi dama', 'pantaloni',
  'camasa', 'camasa barbati', 'camasa dama',
  'fusta', 'fuste', 'palton', 'palton dama',
  'geanta', 'genti', 'geanta dama', 'geanta laptop',
  'rucsac', 'rucsac laptop', 'rucsac scoala', 'rucsac munte',
  'valiza', 'valize', 'troller',
  'ochelari de soare', 'ochelari barbati', 'ochelari dama',
  'ceas', 'ceasuri', 'ceas barbati', 'ceas dama', 'ceas automatic',
  'portofel', 'portofel barbati', 'portofel dama',
  'curea', 'curele', 'curea barbati',
  'esarfa', 'fular', 'sapca', 'palarie',
  // Copii & Jucarii
  'carucior', 'carucior copii', 'carucior 3 in 1', 'carucior 2 in 1', 'carucior sport',
  'scaun auto copii', 'scaun auto bebe',
  'bicicleta copii', 'tricicleta copii',
  'jucarii', 'jucarii educative', 'jucarii copii', 'jucarii baieti', 'jucarii fete',
  'lego', 'set lego', 'puzzle', 'puzzle copii',
  'masinuta electrica', 'masinuta electrica copii',
  'patut', 'patut bebe', 'leagan', 'leagan copii',
  'scutece', 'scutece pampers', 'biberoane',
  'premergator', 'saltea landou',
  // Auto & Moto
  'anvelope', 'anvelope vara', 'anvelope iarna', 'anvelope all season',
  'anvelope 205 55 r16', 'anvelope 195 65 r15', 'anvelope 225 45 r17',
  'jante', 'jante aliaj', 'jante tabla',
  'ulei motor', 'ulei 5w30', 'ulei 5w40',
  'baterie auto', 'acumulator auto',
  'camera marsarier', 'navigator gps',
  'scaun auto', 'husa auto', 'covorase auto',
  'amortizoare', 'placute frana', 'filtru ulei', 'filtru aer',
  'bara portbagaj', 'portbagaj plafon',
  // Sport
  'bicicleta', 'biciclete', 'bicicleta mtb', 'bicicleta electrica', 'bicicleta fitness',
  'trotineta', 'trotineta electrica', 'trotinete electrice',
  'banda alergare', 'banda de alergat', 'bicicleta eliptica',
  'gantere', 'bara tractiuni', 'banca fitness', 'aparat multifunctional',
  'cort camping', 'sac dormit', 'saltea camping',
  'ghete munte', 'bocanci munte', 'rucsac munte',
  'minge fotbal', 'racheta tenis', 'racheta badminton',
  'skateboard', 'longboard', 'role', 'patine',
  // Pescuit
  'lanseta', 'lansete', 'lanseta feeder', 'lanseta spinning', 'lanseta crap',
  'mulineta', 'mulinete', 'mulineta feeder', 'mulineta spinning',
  'naluci', 'naluci spinning', 'naluci siliconic',
  'fir pescuit', 'carlige pescuit', 'plumbi pescuit',
  'cort pescuit', 'scaun pescuit', 'juvelnic',
  // Sanatate & Frumusete
  'parfum', 'parfum barbati', 'parfum dama', 'parfum original',
  'crema fata', 'crema antirid', 'crema hidratanta',
  'sampon', 'sampon antimatreata', 'sampon par gras',
  'periuta electrica', 'periuta de dinti electrica',
  'aparat tuns', 'trimmer', 'epilator',
  'tensiometru', 'pulsoximetru', 'termometru',
  'vitamine', 'suplimente', 'proteina', 'creatina',
  'ulei esential', 'difuzor uleiuri esentiale',
  // Animale
  'hrana caini', 'hrana pisici', 'hrana uscata caini', 'hrana uscata pisici',
  'cusca caini', 'cusca pisici', 'pat caini', 'pat pisici',
  'zgarda caini', 'lesa caini', 'jucarii caini',
  'litiera pisici', 'nisip pisici',
  'acvariu', 'filtru acvariu', 'hrana pesti',
  // Carti & Birou
  'carti', 'carti copii', 'carti dezvoltare personala', 'roman',
  'carte colorat', 'carte povesti',
  'scaun birou', 'birou', 'laptop stand',
  // Alimentare
  'cafea boabe', 'cafea macinata', 'ceai',
  'vin rosu', 'vin alb', 'whisky', 'bere',
];

// Subcategory names from feed data
function getSubcatSeeds() {
  const seeds = [];
  const SKIP = new Set(['altele', 'vara', 'bauturi', 'electronice', 'electronica', 'accesorii',
    'electronice', 'diverse', 'other', 'others', 'general', 'produse']);
  for (const [megaSlug, cat] of Object.entries(structure.megaCategories)) {
    for (const sub of cat.subcategories) {
      const name = sub.name.toLowerCase();
      if (SKIP.has(name) || name.length < 4) continue;
      // Skip names that are clearly English
      if (/^(mobile phones|switch-uri|home|garden|baby)$/i.test(name)) continue;
      seeds.push(name);
    }
  }
  return seeds;
}

// Top brands from our data
function getBrandSeeds() {
  const brands = JSON.parse(readFileSync(join(DATA_DIR, 'brands.json'), 'utf-8'));
  // Only brands with decent product count and recognizable names
  return brands
    .filter(b => b.count >= 50 && b.name.length >= 3 && !/^[A-Z]{2,3}$/.test(b.name))
    .slice(0, 100)
    .map(b => b.name.toLowerCase());
}

const SEED_PATTERNS = [
  q => `cele mai bune ${q}`,
  q => `cel mai bun ${q}`,
  q => `top ${q}`,
  q => `${q} ieftine`,
  q => `${q} ieftin`,
  q => `${q} sub `,
  q => `${q} recomandari`,
  q => `${q} pareri`,
  q => `${q} sau `,
  q => `ce ${q} sa cumpar`,
  q => q,
];

// Extra patterns for more volume
const EXTRA_PATTERNS = [
  q => `${q} pret`,
  q => `${q} oferta`,
  q => `${q} reduceri`,
  q => `${q} calitate pret`,
  q => `${q} pentru copii`,
  q => `${q} pentru casa`,
  q => `cum aleg ${q}`,
  q => `ghid ${q}`,
  q => `${q} profesional`,
];

const ALPHABET = 'abcdefghijklmnoprstuvz'.split('');

// ========== PROGRESS SAVE (resume support) ==========
const PROGRESS_FILE = join(DATA_DIR, 'scrape-progress.json');
function saveProgress() {
  const data = {
    savedAt: new Date().toISOString(),
    requestCount,
    suggestions: [...allSuggestions.values()],
  };
  writeFileSync(PROGRESS_FILE, JSON.stringify(data));
  console.log(`  💾 Progress saved: ${allSuggestions.size} suggestions, ${requestCount} requests`);
}

// ========== MAIN ==========
async function scrapeAll() {
  const subcatSeeds = getSubcatSeeds();
  const brandSeeds = getBrandSeeds();

  console.log(`Manual seeds: ${MANUAL_SEEDS.length}`);
  console.log(`Subcategory seeds: ${subcatSeeds.length}`);
  console.log(`Brand seeds: ${brandSeeds.length}`);

  // Combine all seeds, deduped
  const seedSet = new Set([...MANUAL_SEEDS, ...subcatSeeds]);
  const allSeeds = [...seedSet];
  console.log(`Total unique seeds: ${allSeeds.length}`);

  // Estimate request count
  const estPhase1 = allSeeds.length * SEED_PATTERNS.length;
  const estPhase2 = allSeeds.length * ALPHABET.length;
  const estPhase3 = MANUAL_SEEDS.length * EXTRA_PATTERNS.length;
  const estPhase4 = brandSeeds.length * 3; // 3 patterns per brand
  const estPhase5 = 500; // re-query
  const estTotal = estPhase1 + estPhase2 + estPhase3 + estPhase4 + estPhase5;
  const estMinutes = Math.ceil(estTotal * DELAY_MS / 60000);
  console.log(`\nEstimated requests: ~${estTotal} (~${estMinutes} min at ${DELAY_MS}ms delay)\n`);

  // ====== PHASE 1: Core patterns on all seeds ======
  console.log('=== Phase 1: Core patterns ===');
  for (let si = 0; si < allSeeds.length; si++) {
    const seed = allSeeds[si];
    if (si % 30 === 0) {
      console.log(`  [${si}/${allSeeds.length}] "${seed}" — ${allSuggestions.size} found`);
    }
    for (const pattern of SEED_PATTERNS) {
      const suggestions = await googleSuggest(pattern(seed));
      requestCount++;
      for (const s of suggestions) addSuggestion(s, 'phase1');
      await sleep(DELAY_MS);
    }
    // Save progress every 50 seeds
    if (si % 50 === 49) saveProgress();
  }
  console.log(`Phase 1 done: ${allSuggestions.size} found (${requestCount} requests)\n`);
  saveProgress();

  // ====== PHASE 2: Alphabet expansion on ALL seeds ======
  console.log('=== Phase 2: Alphabet expansion ===');
  for (let si = 0; si < allSeeds.length; si++) {
    const seed = allSeeds[si];
    if (si % 30 === 0) {
      console.log(`  [${si}/${allSeeds.length}] "${seed}" — ${allSuggestions.size} found`);
    }
    for (const letter of ALPHABET) {
      const suggestions = await googleSuggest(`${seed} ${letter}`);
      requestCount++;
      for (const s of suggestions) addSuggestion(s, 'phase2');
      await sleep(DELAY_MS);
    }
    if (si % 30 === 29) saveProgress();
  }
  console.log(`Phase 2 done: ${allSuggestions.size} found (${requestCount} requests)\n`);
  saveProgress();

  // ====== PHASE 3: Extra patterns on manual seeds ======
  console.log('=== Phase 3: Extra patterns ===');
  for (let si = 0; si < MANUAL_SEEDS.length; si++) {
    const seed = MANUAL_SEEDS[si];
    if (si % 30 === 0) {
      console.log(`  [${si}/${MANUAL_SEEDS.length}] "${seed}" — ${allSuggestions.size} found`);
    }
    for (const pattern of EXTRA_PATTERNS) {
      const suggestions = await googleSuggest(pattern(seed));
      requestCount++;
      for (const s of suggestions) addSuggestion(s, 'phase3');
      await sleep(DELAY_MS);
    }
    if (si % 50 === 49) saveProgress();
  }
  console.log(`Phase 3 done: ${allSuggestions.size} found (${requestCount} requests)\n`);
  saveProgress();

  // ====== PHASE 4: Brand + product combos ======
  console.log('=== Phase 4: Brand combinations ===');
  const BRAND_PATTERNS = [
    b => `${b} pareri`,
    b => `cele mai bune ${b}`,
    b => `${b} recomandari`,
  ];
  for (let bi = 0; bi < brandSeeds.length; bi++) {
    const brand = brandSeeds[bi];
    if (bi % 20 === 0) {
      console.log(`  [${bi}/${brandSeeds.length}] "${brand}" — ${allSuggestions.size} found`);
    }
    for (const pattern of BRAND_PATTERNS) {
      const suggestions = await googleSuggest(pattern(brand));
      requestCount++;
      for (const s of suggestions) addSuggestion(s, 'phase4');
      await sleep(DELAY_MS);
    }
    // Also alphabet for top brands
    if (bi < 30) {
      for (const letter of ALPHABET) {
        const suggestions = await googleSuggest(`${brand} ${letter}`);
        requestCount++;
        for (const s of suggestions) addSuggestion(s, 'phase4');
        await sleep(DELAY_MS);
      }
    }
  }
  console.log(`Phase 4 done: ${allSuggestions.size} found (${requestCount} requests)\n`);
  saveProgress();

  // ====== PHASE 5: Re-query top results for depth ======
  console.log('=== Phase 5: Re-query top suggestions ===');
  const topResults = [...allSuggestions.values()]
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, 500);
  for (let i = 0; i < topResults.length; i++) {
    const s = topResults[i];
    if (i % 50 === 0) {
      console.log(`  [${i}/${topResults.length}] "${s.title}" — ${allSuggestions.size} found`);
    }
    const suggestions = await googleSuggest(s.title.toLowerCase());
    requestCount++;
    for (const sug of suggestions) addSuggestion(sug, 'phase5');
    await sleep(DELAY_MS);
    // Also alphabet on top 100
    if (i < 100) {
      for (const letter of ALPHABET) {
        const suggestions2 = await googleSuggest(`${s.title.toLowerCase()} ${letter}`);
        requestCount++;
        for (const sug of suggestions2) addSuggestion(sug, 'phase5');
        await sleep(DELAY_MS);
      }
    }
    if (i % 50 === 49) saveProgress();
  }
  console.log(`Phase 5 done: ${allSuggestions.size} found (${requestCount} requests)\n`);

  // ========== DEDUPLICATION ==========
  console.log('=== Deduplication ===');
  const results = [...allSuggestions.values()];
  results.sort((a, b) => b.productCount - a.productCount);

  const MODIFIER_WORDS = new Set(['ieftin', 'ieftine', 'ieftina', 'bune', 'bun', 'buna',
    'buni', 'top', 'recomandari', 'pareri', 'recenzie', 'pret', 'oferta', 'reduceri']);

  const deduped = [];
  const seenBases = new Map(); // simpleBase+type -> index in deduped

  for (const r of results) {
    const simpleBase = r.keywords
      .filter(w => !MODIFIER_WORDS.has(w))
      .sort().join(' ');

    const key = `${simpleBase}::${r.type}`;
    if (seenBases.has(key)) continue; // exact same product keywords + same type = cannibal

    seenBases.set(key, deduped.length);
    deduped.push(r);
  }
  console.log(`After dedup: ${deduped.length} (from ${results.length})`);

  // ========== SAVE ==========
  const output = {
    scrapedAt: new Date().toISOString(),
    totalRequests: requestCount,
    totalRaw: results.length,
    total: deduped.length,
    suggestions: deduped,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nSaved ${deduped.length} suggestions to ${OUTPUT_FILE}`);

  // Stats
  const byType = {}, byMega = {};
  for (const s of deduped) {
    byType[s.type] = (byType[s.type] || 0) + 1;
    byMega[s.megaCategory] = (byMega[s.megaCategory] || 0) + 1;
  }
  console.log('\nBy type:');
  for (const [t, c] of Object.entries(byType).sort((a, b) => b[1] - a[1])) console.log(`  ${t}: ${c}`);
  console.log('\nBy mega category:');
  for (const [m, c] of Object.entries(byMega).sort((a, b) => b[1] - a[1])) console.log(`  ${m}: ${c}`);
}

scrapeAll().catch(console.error);
