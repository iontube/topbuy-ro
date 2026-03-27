import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const PRODUCTS_DIR = join(DATA_DIR, 'products');
const SEARCH_DIR = join(DATA_DIR, 'search-pages');

const MAX_INTENTS = 3000;

function slugify(text) {
  const map = {
    'ă': 'a', 'â': 'a', 'î': 'i', 'ș': 's', 'ş': 's', 'ț': 't', 'ţ': 't',
    'Ă': 'A', 'Â': 'A', 'Î': 'I', 'Ș': 'S', 'Ş': 'S', 'Ț': 'T', 'Ţ': 'T',
    'ä': 'a', 'ö': 'o', 'ü': 'u', 'é': 'e', 'è': 'e', 'ê': 'e',
  };
  let result = text;
  for (const [from, to] of Object.entries(map)) {
    result = result.split(from).join(to);
  }
  return result.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 80);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function stripDiacritics(text) {
  const map = {
    'ă': 'a', 'â': 'a', 'î': 'i', 'ș': 's', 'ş': 's', 'ț': 't', 'ţ': 't',
    'Ă': 'A', 'Â': 'A', 'Î': 'I', 'Ș': 'S', 'Ş': 'S', 'Ț': 'T', 'Ţ': 'T',
    'ä': 'a', 'ö': 'o', 'ü': 'u', 'é': 'e', 'è': 'e', 'ê': 'e',
  };
  let result = text;
  for (const [from, to] of Object.entries(map)) {
    result = result.split(from).join(to);
  }
  return result;
}

// ========== LOAD ALL PRODUCTS ==========
console.log('Loading all product shards...');
const shardFilesList = readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.json')).sort();
const allProducts = [];
for (const f of shardFilesList) {
  const data = JSON.parse(readFileSync(join(PRODUCTS_DIR, f), 'utf-8'));
  allProducts.push(...data);
}
console.log(`Loaded ${allProducts.length} products from ${shardFilesList.length} shards`);

const structure = JSON.parse(readFileSync(join(DATA_DIR, 'site-structure.json'), 'utf-8'));

// ========== BUILD INDEXES ==========
// Pre-compute lowercase search text for each product ONCE
const productTexts = allProducts.map(p => (p.t + ' ' + p.c + ' ' + (p.b || '')).toLowerCase());
const productTitleTexts = allProducts.map(p => stripDiacritics(p.t.toLowerCase()));

// Category index for fast filterCategory lookups
const categoryIndex = new Map();
for (let i = 0; i < allProducts.length; i++) {
  const cat = allProducts[i].c;
  if (cat) {
    if (!categoryIndex.has(cat)) categoryIndex.set(cat, []);
    categoryIndex.get(cat).push(i);
  }
}

// Map category -> megaCategory slug
const catToMega = new Map();
for (const [megaSlug, cat] of Object.entries(structure.megaCategories)) {
  for (const sub of cat.subcategories) {
    catToMega.set(sub.originalName || sub.name, megaSlug);
  }
  if (cat.shards) {
    for (const shard of cat.shards) {
      try {
        const data = JSON.parse(readFileSync(join(PRODUCTS_DIR, shard.file), 'utf-8'));
        for (const p of data) {
          if (p.c && !catToMega.has(p.c)) catToMega.set(p.c, megaSlug);
        }
      } catch {}
    }
  }
}

function getMegaForCategory(cat) {
  return catToMega.get(cat) || 'altele';
}

function getShardsForMega(megaSlug) {
  return structure.megaCategories[megaSlug]?.shards?.map(s => s.file) || [];
}

// ========== ACCESSORY EXCLUSION WORDS ==========
const ACCESSORY_EXCLUDE = ['husa', 'huse', 'folie', 'folii', 'protectie sticla',
  'protectie spate', 'protectie toc', 'bumper', 'skin', 'sticker',
  'suport telefon', 'suport auto', 'suport pentru telefon', 'stand telefon',
  'dock', 'cablu', 'incarcator', 'adaptor', 'stylus', 'curea smartwatch',
  'bratara smartwatch', 'carcasa', 'toc apple', 'toc samsung',
  'panou solar', 'proiector solar', 'lampa', 'cleste', 'suport hartie'];

const SHOE_EXCLUDE = ['dulap pantofi', 'dulap pentru pantofi', 'raft pantofi', 'raft pentru pantofi',
  'suport pantofi', 'organizator pantofi', 'cutie pantofi', 'crema pantofi',
  'perie pantofi', 'spray pantofi', 'talpici', 'branturi', 'siret'];

const BIKE_EXCLUDE = ['suport bicicleta', 'suport pentru bicicleta', 'remorca bicicleta',
  'remorca de bicicleta', 'carucior pentru caini', 'carucior si remorca',
  'far bicicleta', 'far pentru bicicleta', 'stop bicicleta', 'lampa bicicleta',
  'lampa cu led', 'pompa bicicleta', 'pompa de bicicleta',
  'suport telefon', 'suport husa', 'husa telefon',
  'manusi bicicleta', 'sonerie bicicleta', 'antifurt bicicleta',
  'cauciuc bicicleta', 'camera bicicleta', 'pedale bicicleta',
  'scaun bicicleta', 'cos bicicleta', 'portbagaj bicicleta',
  'charm', 'talisman', 'brosa', 'geanta shopper', 'pandantiv',
  'mentenanta', 'reparatie bicicleta', 'stand mentenanta',
  'brat intermediar', 'brat lung', 'extensie suport', 'adaptor suport',
  'prindere suport', 'camera video mini', 'recuperare', 'reabilitare',
  'exercitii', 'fitness bicicleta', 'suport de telefon', 'tricicleta si bicicleta',
  'tricicleta', 'aparatoare noroi', 'bidon bicicleta', 'suport bidon',
  'kit reparatie', 'set reparatie', 'oglinda bicicleta', 'claxon bicicleta'];

// Telefon: exclude stands/holders (suport de telefon already in ACCESSORY_EXCLUDE but need more)
const PHONE_EXCLUDE = [...ACCESSORY_EXCLUDE, 'suport de telefon', 'suport de brat',
  'suport brat', 'suport reglabil', 'suport podea', 'suport de podea',
  'suport universal', 'suport engros', 'suport tetiera', 'statie wireless',
  'suport pentru telefon', 'suport magnetic', 'selfie stick', 'selfie-stick',
  'suport numar', 'amplificator video', 'suport pliabil', 'suport ghidon',
  'suport auto', 'tripod', 'trepied', 'centrala telefonica',
  'suport premium numar', 'suport numar telefon',
  'baza dp', 'baza pentru telefon', 'port telefon', 'portofel si port',
  'set baza', 'statie dect', 'receptor dect',
  'suport creativ'];

// Monitor: exclude gaming desks that mention "suport pentru monitor"
const MONITOR_EXCLUDE = ['birou gaming', 'birou de gaming', 'birou pe colt',
  'masa gaming', 'birou reversibil'];

// Tablete: exclude stands and organizers
const TABLET_EXCLUDE = [...ACCESSORY_EXCLUDE, 'suport reglabil', 'suport de birou',
  'organizator auto'];

// TV: exclude TV furniture/stands
const TV_EXCLUDE = ['suport tv', 'mobilier tv', 'comoda tv', 'dulap tv',
  'meuble tele', 'unitate de divertisment', 'mobilier suspendat'];

// Cuptoare microunde: exclude shelves/racks
const MICROWAVE_EXCLUDE = ['raft pentru cuptor', 'etajera tip raft', 'etajera pentru',
  'capac de protectie', 'capac protectie'];

// Gantere: exclude stands/racks for dumbbells
const DUMBBELL_EXCLUDE = ['suport pentru gantere', 'suport pentru greutati',
  'raft de greutati', 'raft greutati', 'suport gantere'];

// Naluci pescuit: exclude tackle boxes
const LURE_EXCLUDE = ['cutie pentru naluci', 'cutie naluci', 'cutii pentru naluci',
  'set cutii', 'cutie savage', 'pt.naluci', 'cutie dubla', 'cutie plano',
  'editura', 'carte', 'roman', 'naluci flamande', 'geanta berkley',
  'geanta spinning', 'borseta pentru', 'cleste'];

// Placi video: exclude GPU support brackets
const GPU_EXCLUDE = ['suport pentru placa video', 'suport placa video',
  'placa de captura', 'placa captura', 'accesoriu carcasa', 'riser', 'extensie slot',
  'powermeter', 'power meter', 'cablu extensie', 'cablu de montaj', 'cablu coaxial',
  'montura placa de surf', 'serviciu curatare'];

// Jante: exclude tools/protectors
const RIM_EXCLUDE = ['tubulare', 'protectie pentru jante'];

// Saltea: exclude inflatable play items, baby changers
const MATTRESS_EXCLUDE = ['gonflabil', 'gonflabila', 'de joaca', 'de sarit',
  'saltea de infasat', 'patut pliabil', 'patut cu saltea', 'complex de joaca',
  'happy hop', 'tobogan', 'saltea plaja', 'saltea camping', 'saltea auto',
  'saltea yoga', 'saltea fitness', 'saltea gimnastica'];

// ========== INTENT COLLECTOR ==========
const intents = [];
const seenSlugs = new Set();

function addIntent(intent) {
  if (!intent.slug || seenSlugs.has(intent.slug)) return false;
  if (intent.slug.length < 3) return false;
  seenSlugs.add(intent.slug);
  intents.push(intent);
  return true;
}

// ========================================================================
//  SECTION 1: CURATED "CEL MAI BUN / CELE MAI BUNE / TOP" INTENTS
// ========================================================================
console.log('\n=== SECTION 1: Curated cel mai bun / cele mai bune / top intents ===\n');

// Each entry: { sing, plur, gs (gender singular), gp (gender plural), kw, mega, exclude }
// gs/gp: 'm' = masculine, 'f' = feminine, 'n' = neuter
// Singular: m/n -> "Cel mai bun", f -> "Cea mai buna"
// Plural:   m -> "Cei mai buni", f/n -> "Cele mai bune"
// No year in title.
const CURATED_INTENTS = [
  // ── Electronice & IT ──
  // laptop: n (un laptop / laptopuri)
  { sing: 'laptop', plur: 'laptopuri', gs: 'n', gp: 'n', kw: ['laptop'], mega: 'electronice-it', exclude: ACCESSORY_EXCLUDE },
  { sing: 'laptop gaming', plur: 'laptopuri gaming', gs: 'n', gp: 'n', kw: ['laptop', 'gaming'], mega: 'electronice-it', exclude: ACCESSORY_EXCLUDE },
  { sing: 'laptop business', plur: 'laptopuri business', gs: 'n', gp: 'n', kw: ['laptop', 'business'], mega: 'electronice-it', exclude: ACCESSORY_EXCLUDE },
  { sing: 'laptop ieftin', plur: 'laptopuri ieftine', gs: 'n', gp: 'n', kw: ['laptop'], mega: 'electronice-it', exclude: ACCESSORY_EXCLUDE },
  // monitor: n
  { sing: 'monitor gaming', plur: 'monitoare gaming', gs: 'n', gp: 'n', kw: ['monitor', 'gaming'], mega: 'electronice-it', exclude: MONITOR_EXCLUDE },
  { sing: 'monitor 4k', plur: 'monitoare 4k', gs: 'n', gp: 'n', kw: ['monitor', '4k'], mega: 'electronice-it' },
  { sing: 'monitor ultrawide', plur: 'monitoare ultrawide', gs: 'n', gp: 'n', kw: ['monitor', 'ultrawide'], mega: 'electronice-it' },
  // televizor: n
  { sing: 'televizor smart', plur: 'televizoare smart', gs: 'n', gp: 'n', kw: ['televizor', 'smart'], mega: 'electronice-it' },
  { sing: 'televizor 4k', plur: 'televizoare 4k', gs: 'n', gp: 'n', kw: ['televizor', '4k'], mega: 'electronice-it' },
  { sing: 'televizor oled', plur: 'televizoare oled', gs: 'n', gp: 'n', kw: ['televizor', 'oled'], mega: 'electronice-it' },
  { sing: 'televizor qled', plur: 'televizoare qled', gs: 'n', gp: 'n', kw: ['televizor', 'qled'], mega: 'electronice-it' },
  // casti: f plur
  { sing: null, plur: 'casti bluetooth', gp: 'f', kw: ['casti', 'bluetooth'], mega: 'electronice-it' },
  { sing: null, plur: 'casti wireless', gp: 'f', kw: ['casti', 'wireless'], mega: 'electronice-it' },
  { sing: null, plur: 'casti gaming', gp: 'f', kw: ['casti', 'gaming'], mega: 'electronice-it' },
  { sing: null, plur: 'casti in-ear', gp: 'f', kw: ['casti', 'ear'], mega: 'electronice-it' },
  { sing: null, plur: 'casti over-ear', gp: 'f', kw: ['casti', 'over'], mega: 'electronice-it' },
  // tastatura: f
  { sing: 'tastatura mecanica', plur: 'tastaturi mecanice', gs: 'f', gp: 'f', kw: ['tastatur', 'mecanic'], mega: 'electronice-it' },
  { sing: 'tastatura gaming', plur: 'tastaturi gaming', gs: 'f', gp: 'f', kw: ['tastatur', 'gaming'], mega: 'electronice-it' },
  { sing: 'tastatura wireless', plur: 'tastaturi wireless', gs: 'f', gp: 'f', kw: ['tastatur', 'wireless'], mega: 'electronice-it' },
  // mouse: n
  { sing: 'mouse gaming', plur: 'mouse-uri gaming', gs: 'n', gp: 'n', kw: ['mouse', 'gaming'], mega: 'electronice-it' },
  { sing: 'mouse wireless', plur: 'mouse-uri wireless', gs: 'n', gp: 'n', kw: ['mouse', 'wireless'], mega: 'electronice-it' },
  // imprimanta: f
  { sing: 'imprimanta laser', plur: 'imprimante laser', gs: 'f', gp: 'f', kw: ['imprimant', 'laser'], mega: 'electronice-it' },
  { sing: 'imprimanta multifunctionala', plur: 'imprimante multifunctionale', gs: 'f', gp: 'f', kw: ['imprimant', 'multifunctional'], mega: 'electronice-it' },
  // tableta: f
  { sing: 'tableta samsung', plur: 'tablete samsung', gs: 'f', gp: 'f', kw: ['tablet', 'samsung'], mega: 'electronice-it', exclude: TABLET_EXCLUDE },
  { sing: 'tableta', plur: 'tablete', gs: 'f', gp: 'f', kw: ['tableta'], mega: 'electronice-it', exclude: TABLET_EXCLUDE },
  // camera: f
  { sing: 'camera web', plur: 'camere web', gs: 'f', gp: 'f', kw: ['camera', 'web'], mega: 'electronice-it' },
  { sing: 'camera supraveghere', plur: 'camere supraveghere', gs: 'f', gp: 'f', kw: ['camera', 'supraveghere'], mega: 'electronice-it' },
  // boxe: f plur
  { sing: null, plur: 'boxe bluetooth', gp: 'f', kw: ['boxe', 'bluetooth'], mega: 'electronice-it' },
  { sing: null, plur: 'boxe portabile', gp: 'f', kw: ['boxe', 'portabil'], mega: 'electronice-it' },
  // router: n
  { sing: 'router wifi', plur: 'routere wifi', gs: 'n', gp: 'n', kw: ['router', 'wifi'], mega: 'electronice-it' },
  // ssd: n
  { sing: 'ssd extern', plur: 'ssd-uri externe', gs: 'n', gp: 'n', kw: ['ssd', 'extern'], mega: 'electronice-it' },
  { sing: 'ssd', plur: 'ssd-uri', gs: 'n', gp: 'n', kw: ['ssd'], mega: 'electronice-it' },
  // placa: f
  { sing: 'placa video', plur: 'placi video', gs: 'f', gp: 'f', kw: ['placa', 'video'], mega: 'electronice-it', exclude: GPU_EXCLUDE },
  // procesor: n
  { sing: 'procesor', plur: 'procesoare', gs: 'n', gp: 'n', kw: ['procesor'], mega: 'electronice-it' },
  // power bank: n
  { sing: 'power bank', plur: 'power bank-uri', gs: 'n', gp: 'n', kw: ['power bank'], mega: 'electronice-it' },
  // incarcator: n
  { sing: 'incarcator wireless', plur: 'incarcatoare wireless', gs: 'n', gp: 'n', kw: ['incarcator', 'wireless'], mega: 'electronice-it' },
  // husa: f, folie: f
  { sing: 'husa telefon', plur: 'huse telefon', gs: 'f', gp: 'f', kw: ['husa', 'telefon'], mega: 'electronice-it' },
  { sing: 'folie protectie', plur: 'folii protectie', gs: 'f', gp: 'f', kw: ['folie', 'protectie'], mega: 'electronice-it' },
  // smartwatch: n
  { sing: 'smartwatch', plur: 'smartwatch-uri', gs: 'n', gp: 'n', kw: ['smartwatch'], mega: 'electronice-it', exclude: ACCESSORY_EXCLUDE },
  // consola: f
  { sing: 'consola gaming', plur: 'console gaming', gs: 'f', gp: 'f', kw: ['consol', 'gaming'], mega: 'electronice-it' },
  // soundbar: n, proiector: n, drona: f
  { sing: 'soundbar', plur: 'soundbar-uri', gs: 'n', gp: 'n', kw: ['soundbar'], mega: 'electronice-it' },
  { sing: 'proiector', plur: 'proiectoare', gs: 'n', gp: 'n', kw: ['proiector'], mega: 'electronice-it' },
  { sing: 'drona', plur: 'drone', gs: 'f', gp: 'f', kw: ['drona'], mega: 'electronice-it' },
  // telefon: n
  { sing: 'telefon samsung', plur: 'telefoane samsung', gs: 'n', gp: 'n', kw: ['telefon', 'samsung'], mega: 'electronice-it', exclude: PHONE_EXCLUDE },
  { sing: 'telefon iphone', plur: null, gs: 'n', kw: ['iphone'], mega: 'electronice-it', exclude: ACCESSORY_EXCLUDE },

  // ── Casa & Gradina ──
  // aspirator: n
  { sing: 'aspirator robot', plur: 'aspiratoare robot', gs: 'n', gp: 'n', kw: ['aspirator', 'robot'], mega: 'casa-gradina' },
  { sing: 'aspirator vertical', plur: 'aspiratoare verticale', gs: 'n', gp: 'n', kw: ['aspirator', 'vertical'], mega: 'casa-gradina' },
  { sing: 'aspirator fara sac', plur: 'aspiratoare fara sac', gs: 'n', gp: 'n', kw: ['aspirator', 'sac'], mega: 'casa-gradina' },
  // frigider: n
  { sing: 'frigider side by side', plur: 'frigidere side by side', gs: 'n', gp: 'n', kw: ['frigider', 'side'], mega: 'casa-gradina' },
  { sing: 'frigider incorporabil', plur: 'frigidere incorporabile', gs: 'n', gp: 'n', kw: ['frigider', 'incorporabil'], mega: 'casa-gradina' },
  // combina: f
  { sing: 'combina frigorifica', plur: 'combine frigorifice', gs: 'f', gp: 'f', kw: ['combina', 'frigorific'], mega: 'casa-gradina' },
  // masina: f
  { sing: 'masina de spalat rufe', plur: 'masini de spalat rufe', gs: 'f', gp: 'f', kw: ['masina', 'spalat', 'rufe'], mega: 'casa-gradina' },
  { sing: 'masina de spalat vase', plur: 'masini de spalat vase', gs: 'f', gp: 'f', kw: ['masina', 'spalat', 'vase'], mega: 'casa-gradina' },
  // uscator: n
  { sing: 'uscator rufe', plur: 'uscatoare rufe', gs: 'n', gp: 'n', kw: ['uscator', 'rufe'], mega: 'casa-gradina' },
  // cuptor: n
  { sing: 'cuptor microunde', plur: 'cuptoare microunde', gs: 'n', gp: 'n', kw: ['cuptor', 'microunde'], mega: 'casa-gradina', exclude: MICROWAVE_EXCLUDE },
  { sing: 'cuptor electric', plur: 'cuptoare electrice', gs: 'n', gp: 'n', kw: ['cuptor', 'electric'], mega: 'casa-gradina' },
  { sing: 'cuptor incorporabil', plur: 'cuptoare incorporabile', gs: 'n', gp: 'n', kw: ['cuptor', 'incorporabil'], mega: 'casa-gradina' },
  // aer conditionat: n
  { sing: 'aer conditionat', plur: 'aere conditionate', gs: 'n', gp: 'n', kw: ['aer', 'conditionat'], mega: 'casa-gradina' },
  // centrala: f
  { sing: 'centrala termica', plur: 'centrale termice', gs: 'f', gp: 'f', kw: ['centrala', 'termic'], mega: 'casa-gradina' },
  // canapea: f
  { sing: 'canapea extensibila', plur: 'canapele extensibile', gs: 'f', gp: 'f', kw: ['canapea', 'extensibil'], mega: 'casa-gradina' },
  { sing: 'canapea coltar', plur: 'canapele coltar', gs: 'f', gp: 'f', kw: ['canapea', 'coltar'], mega: 'casa-gradina' },
  // saltea: f
  { sing: 'saltea ortopedica', plur: 'saltele ortopedice', gs: 'f', gp: 'f', kw: ['saltea', 'ortopedic'], mega: 'casa-gradina' },
  { sing: 'saltea memory foam', plur: 'saltele memory foam', gs: 'f', gp: 'f', kw: ['saltea', 'memory'], mega: 'casa-gradina' },
  // pat: n
  { sing: 'pat tapitat', plur: 'paturi tapitate', gs: 'n', gp: 'n', kw: ['pat', 'tapitat'], mega: 'casa-gradina' },
  { sing: 'pat matrimonial', plur: 'paturi matrimoniale', gs: 'n', gp: 'n', kw: ['pat', 'matrimonial'], mega: 'casa-gradina' },
  // scaun: n
  { sing: 'scaun de birou', plur: 'scaune de birou', gs: 'n', gp: 'n', kw: ['scaun', 'birou'], mega: 'casa-gradina' },
  { sing: 'scaun gaming', plur: 'scaune gaming', gs: 'n', gp: 'n', kw: ['scaun', 'gaming'], mega: 'casa-gradina' },
  { sing: 'scaun ergonomic', plur: 'scaune ergonomice', gs: 'n', gp: 'n', kw: ['scaun', 'ergonomic'], mega: 'casa-gradina' },
  // birou: n
  { sing: 'birou gaming', plur: 'birouri gaming', gs: 'n', gp: 'n', kw: ['birou', 'gaming'], mega: 'casa-gradina' },
  // boiler: n
  { sing: 'boiler electric', plur: 'boilere electrice', gs: 'n', gp: 'n', kw: ['boiler', 'electric'], mega: 'casa-gradina' },
  // pompa: f
  { sing: 'pompa submersibila', plur: 'pompe submersibile', gs: 'f', gp: 'f', kw: ['pompa', 'submersibil'], mega: 'casa-gradina' },
  // generator: n
  { sing: 'generator curent', plur: 'generatoare curent', gs: 'n', gp: 'n', kw: ['generator', 'curent'], mega: 'casa-gradina' },
  // espressor: n
  { sing: 'espressor cafea', plur: 'espressoare cafea', gs: 'n', gp: 'n', kw: ['espressor', 'cafea'], mega: 'casa-gradina' },
  // fierbator: n
  { sing: 'fierbator electric', plur: 'fierbatoare electrice', gs: 'n', gp: 'n', kw: ['fierbator', 'electric'], mega: 'casa-gradina' },
  // robot: m
  { sing: 'robot de bucatarie', plur: 'roboti de bucatarie', gs: 'm', gp: 'm', kw: ['robot', 'bucatarie'], mega: 'casa-gradina' },
  // friteuza: f
  { sing: 'friteuza air fryer', plur: 'friteuze air fryer', gs: 'f', gp: 'f', kw: ['friteuza'], mega: 'casa-gradina' },
  // multicooker: n
  { sing: 'multicooker', plur: 'multicookere', gs: 'n', gp: 'n', kw: ['multicooker'], mega: 'casa-gradina' },
  // panouri: n plur, covoare: n plur, lenjerii: f plur
  { sing: null, plur: 'panouri solare', gp: 'n', kw: ['panou', 'solar'], mega: 'casa-gradina' },
  { sing: null, plur: 'covoare living', gp: 'n', kw: ['covor', 'living'], mega: 'casa-gradina' },
  { sing: null, plur: 'lenjerii de pat', gp: 'f', kw: ['lenjerie', 'pat'], mega: 'casa-gradina' },

  // ── Auto & Moto ──
  // anvelope: f plur
  { sing: null, plur: 'anvelope vara', gp: 'f', kw: ['anvelope', 'var'], mega: 'auto-moto' },
  { sing: null, plur: 'anvelope iarna', gp: 'f', kw: ['anvelope', 'iarn'], mega: 'auto-moto' },
  { sing: null, plur: 'anvelope all season', gp: 'f', kw: ['anvelope', 'all season'], mega: 'auto-moto' },
  // jante: f plur
  { sing: null, plur: 'jante aliaj', gp: 'f', kw: ['jante', 'aliaj'], mega: 'auto-moto', exclude: RIM_EXCLUDE },
  // ulei: n
  { sing: 'ulei motor', plur: 'uleiuri motor', gs: 'n', gp: 'n', kw: ['ulei', 'motor'], mega: 'auto-moto' },
  // baterie: f
  { sing: 'baterie auto', plur: 'baterii auto', gs: 'f', gp: 'f', kw: ['baterie auto'], mega: 'auto-moto' },
  // camera: f
  { sing: 'camera marsarier', plur: 'camere marsarier', gs: 'f', gp: 'f', kw: ['camera', 'marsarier'], mega: 'auto-moto' },

  // ── Fashion ──
  // adidasi: m plur, ghete: f plur, pantofi: m plur
  { sing: null, plur: 'adidasi barbati', gp: 'm', kw: ['adidasi', 'barbat'], mega: 'fashion' },
  { sing: null, plur: 'adidasi dama', gp: 'm', kw: ['adidasi', 'dama'], mega: 'fashion' },
  { sing: null, plur: 'ghete barbati', gp: 'f', kw: ['ghete', 'barbat'], mega: 'fashion' },
  { sing: null, plur: 'ghete dama', gp: 'f', kw: ['ghete', 'dama'], mega: 'fashion' },
  { sing: null, plur: 'pantofi sport', gp: 'm', kw: ['pantofi', 'sport'], mega: 'fashion', exclude: SHOE_EXCLUDE },
  { sing: null, plur: 'pantofi barbati', gp: 'm', kw: ['pantofi', 'barbat'], mega: 'fashion', exclude: SHOE_EXCLUDE },
  { sing: null, plur: 'pantofi dama', gp: 'm', kw: ['pantofi', 'dama'], mega: 'fashion', exclude: SHOE_EXCLUDE },
  // sandale: f plur, cizme: f plur, bocanci: m plur
  { sing: null, plur: 'sandale dama', gp: 'f', kw: ['sandale', 'dama'], mega: 'fashion' },
  { sing: null, plur: 'cizme dama', gp: 'f', kw: ['cizme', 'dama'], mega: 'fashion' },
  { sing: null, plur: 'bocanci barbati', gp: 'm', kw: ['bocanci', 'barbat'], mega: 'fashion' },
  // geaca: f
  { sing: 'geaca barbati', plur: 'geci barbati', gs: 'f', gp: 'f', kw: ['geaca', 'barbat'], mega: 'fashion' },
  { sing: 'geaca dama', plur: 'geci dama', gs: 'f', gp: 'f', kw: ['geaca', 'dama'], mega: 'fashion' },
  // rochie: f
  { sing: 'rochie eleganta', plur: 'rochii elegante', gs: 'f', gp: 'f', kw: ['rochie', 'elegant'], mega: 'fashion' },
  // rucsac: n
  { sing: 'rucsac laptop', plur: 'rucsacuri laptop', gs: 'n', gp: 'n', kw: ['rucsac', 'laptop'], mega: 'fashion' },
  // geanta: f
  { sing: 'geanta dama', plur: 'genti dama', gs: 'f', gp: 'f', kw: ['geanta', 'dama'], mega: 'fashion' },
  // valiza: f
  { sing: 'valiza calatorie', plur: 'valize calatorie', gs: 'f', gp: 'f', kw: ['valiz', 'calatori'], mega: 'fashion' },
  // ochelari: m plur
  { sing: null, plur: 'ochelari de soare', gp: 'm', kw: ['ochelari', 'soare'], mega: 'fashion' },
  // ceas: n
  { sing: 'ceas barbati', plur: 'ceasuri barbati', gs: 'n', gp: 'n', kw: ['ceas', 'barbat'], mega: 'fashion' },
  { sing: 'ceas dama', plur: 'ceasuri dama', gs: 'n', gp: 'n', kw: ['ceas', 'dama'], mega: 'fashion' },
  // portofel: n
  { sing: 'portofel barbati', plur: 'portofele barbati', gs: 'n', gp: 'n', kw: ['portofel', 'barbat'], mega: 'fashion' },

  // ── Copii & Jucarii ──
  // carucior: n
  { sing: 'carucior copii', plur: 'carucioare copii', gs: 'n', gp: 'n', kw: ['carucior', 'copii'], mega: 'copii-jucarii' },
  { sing: 'carucior 2 in 1', plur: 'carucioare 2 in 1', gs: 'n', gp: 'n', kw: ['carucior', '2in1'], mega: 'copii-jucarii' },
  { sing: 'carucior 3 in 1', plur: 'carucioare 3 in 1', gs: 'n', gp: 'n', kw: ['carucior', '3in1'], mega: 'copii-jucarii' },
  // scaun: n
  { sing: 'scaun auto copii', plur: 'scaune auto copii', gs: 'n', gp: 'n', kw: ['scaun', 'auto', 'copii'], mega: 'copii-jucarii' },
  // bicicleta: f, tricicleta: f
  { sing: 'bicicleta copii', plur: 'biciclete copii', gs: 'f', gp: 'f', kw: ['bicicleta', 'copii'], mega: 'copii-jucarii', exclude: BIKE_EXCLUDE },
  { sing: 'tricicleta copii', plur: 'triciclete copii', gs: 'f', gp: 'f', kw: ['tricicleta', 'copii'], mega: 'copii-jucarii' },
  // jucarii: f plur
  { sing: null, plur: 'jucarii educative', gp: 'f', kw: ['jucar', 'educativ'], mega: 'copii-jucarii' },
  // seturi: n plur
  { sing: null, plur: 'seturi lego', gp: 'n', kw: ['lego'], mega: 'copii-jucarii' },
  // pat: n
  { sing: 'pat copii', plur: 'paturi copii', gs: 'n', gp: 'n', kw: ['pat', 'copii'], mega: 'copii-jucarii' },
  // masinuta: f
  { sing: 'masinuta electrica copii', plur: 'masinute electrice copii', gs: 'f', gp: 'f', kw: ['masinuta', 'electric'], mega: 'copii-jucarii' },

  // ── Sport & Pescuit ──
  // bicicleta: f
  { sing: 'bicicleta mtb', plur: 'biciclete mtb', gs: 'f', gp: 'f', kw: ['bicicleta', 'mtb'], mega: 'sport', exclude: BIKE_EXCLUDE },
  { sing: 'bicicleta electrica', plur: 'biciclete electrice', gs: 'f', gp: 'f', kw: ['bicicleta', 'electric'], mega: 'sport', exclude: BIKE_EXCLUDE },
  { sing: 'bicicleta fitness', plur: 'biciclete fitness', gs: 'f', gp: 'f', kw: ['bicicleta', 'fitness'], mega: 'sport', exclude: BIKE_EXCLUDE },
  // trotineta: f
  { sing: 'trotineta electrica', plur: 'trotinete electrice', gs: 'f', gp: 'f', kw: ['trotineta', 'electric'], mega: 'sport' },
  // lanseta: f
  { sing: 'lanseta pescuit', plur: 'lansete pescuit', gs: 'f', gp: 'f', kw: ['lanseta', 'pescuit'], mega: 'pescuit' },
  { sing: 'lanseta spinning', plur: 'lansete spinning', gs: 'f', gp: 'f', kw: ['lanseta', 'spinning'], mega: 'pescuit' },
  // mulineta: f
  { sing: 'mulineta spinning', plur: 'mulinete spinning', gs: 'f', gp: 'f', kw: ['mulineta', 'spinning'], mega: 'pescuit' },
  // naluci: f plur
  { sing: null, plur: 'naluci siliconic', gp: 'f', kw: ['naluc', 'silicon'], mega: 'pescuit', exclude: LURE_EXCLUDE },
  // cort: n
  { sing: 'cort camping', plur: 'corturi camping', gs: 'n', gp: 'n', kw: ['cort', 'camping'], mega: 'sport' },
  { sing: 'cort pescuit', plur: 'corturi pescuit', gs: 'n', gp: 'n', kw: ['cort', 'pescuit'], mega: 'pescuit' },
  // scaun: n
  { sing: 'scaun pescuit', plur: 'scaune pescuit', gs: 'n', gp: 'n', kw: ['scaun', 'pescuit'], mega: 'pescuit' },
  // sac: m
  { sing: 'sac de dormit', plur: 'sacuri de dormit', gs: 'm', gp: 'n', kw: ['sac', 'dormit'], mega: 'sport' },
  // saltea: f
  { sing: 'saltea fitness', plur: 'saltele fitness', gs: 'f', gp: 'f', kw: ['saltea', 'fitness'], mega: 'sport' },
  // banda: f
  { sing: 'banda de alergare', plur: 'benzi de alergare', gs: 'f', gp: 'f', kw: ['banda', 'alergare'], mega: 'sport' },

  // ── Sanatate & Frumusete ──
  // parfum: n
  { sing: 'parfum barbati', plur: 'parfumuri barbati', gs: 'n', gp: 'n', kw: ['parfum', 'barbat'], mega: 'sanatate-frumusete' },
  { sing: 'parfum dama', plur: 'parfumuri dama', gs: 'n', gp: 'n', kw: ['parfum', 'dama'], mega: 'sanatate-frumusete' },
  // placa: f
  { sing: 'placa de par', plur: 'placi de par', gs: 'f', gp: 'f', kw: ['plac', 'par'], mega: 'sanatate-frumusete' },
  // uscator: n
  { sing: 'uscator de par', plur: 'uscatoare de par', gs: 'n', gp: 'n', kw: ['uscator', 'par'], mega: 'sanatate-frumusete' },
  // aparat: n
  { sing: 'aparat de ras', plur: 'aparate de ras', gs: 'n', gp: 'n', kw: ['aparat', 'ras'], mega: 'sanatate-frumusete' },
  // periuta: f
  { sing: 'periuta electrica', plur: 'periute electrice', gs: 'f', gp: 'f', kw: ['periut', 'electric'], mega: 'sanatate-frumusete' },

  // ── Alimentare ──
  // espressor: n
  { sing: 'espressor cafea automat', plur: 'espressoare cafea automate', gs: 'n', gp: 'n', kw: ['espressor', 'automat'], mega: 'alimentare-bauturi' },

  // ========================================================
  // VARIAȚII BAZĂ (fără specificare tip - generic)
  // ========================================================

  // ── Electronice generic ──
  { sing: 'laptop', plur: 'laptopuri', gs: 'n', gp: 'n', kw: ['laptop'], mega: 'electronice-it', exclude: ACCESSORY_EXCLUDE },
  { sing: 'monitor', plur: 'monitoare', gs: 'n', gp: 'n', kw: ['monitor'], mega: 'electronice-it' },
  { sing: 'televizor', plur: 'televizoare', gs: 'n', gp: 'n', kw: ['televizor'], mega: 'electronice-it', exclude: TV_EXCLUDE },
  { sing: 'telefon', plur: 'telefoane', gs: 'n', gp: 'n', kw: ['telefon'], mega: 'electronice-it', exclude: PHONE_EXCLUDE },
  { sing: null, plur: 'casti', gp: 'f', kw: ['casti'], mega: 'electronice-it' },
  { sing: 'camera foto', plur: 'camere foto', gs: 'f', gp: 'f', kw: ['camera', 'foto'], mega: 'electronice-it' },
  { sing: 'videoproiector', plur: 'videoproiectoare', gs: 'n', gp: 'n', kw: ['videoproiector'], mega: 'electronice-it' },
  { sing: 'e-reader', plur: 'e-readere', gs: 'n', gp: 'n', kw: ['reader'], mega: 'electronice-it', exclude: ['card'] },
  // ── Casa generic ──
  { sing: 'aspirator', plur: 'aspiratoare', gs: 'n', gp: 'n', kw: ['aspirator'], mega: 'casa-gradina' },
  { sing: 'frigider', plur: 'frigidere', gs: 'n', gp: 'n', kw: ['frigider'], mega: 'casa-gradina' },
  { sing: 'cuptor', plur: 'cuptoare', gs: 'n', gp: 'n', kw: ['cuptor'], mega: 'casa-gradina' },
  { sing: 'hota', plur: 'hote', gs: 'f', gp: 'f', kw: ['hota'], mega: 'casa-gradina' },
  { sing: 'plita', plur: 'plite', gs: 'f', gp: 'f', kw: ['plita'], mega: 'casa-gradina' },
  { sing: 'espressor', plur: 'espressoare', gs: 'n', gp: 'n', kw: ['espressor'], mega: 'casa-gradina' },
  { sing: 'canapea', plur: 'canapele', gs: 'f', gp: 'f', kw: ['canapea'], mega: 'casa-gradina' },
  { sing: 'saltea', plur: 'saltele', gs: 'f', gp: 'f', kw: ['saltea'], mega: 'casa-gradina', exclude: MATTRESS_EXCLUDE },
  { sing: 'scaun de birou', plur: 'scaune de birou', gs: 'n', gp: 'n', kw: ['scaun', 'birou'], mega: 'casa-gradina' },

  // ========================================================
  // CATEGORII NOI NEACOPERITE
  // ========================================================

  // ── Animale de companie ──
  { sing: null, plur: 'hrana uscata caini', gp: 'f', kw: ['hrana', 'uscat', 'caini'], mega: 'animale' },
  { sing: null, plur: 'hrana umeda caini', gp: 'f', kw: ['hrana', 'umed', 'caini'], mega: 'animale' },
  { sing: null, plur: 'hrana uscata pisici', gp: 'f', kw: ['hrana', 'uscat', 'pisici'], mega: 'animale' },
  { sing: null, plur: 'hrana umeda pisici', gp: 'f', kw: ['hrana', 'umed', 'pisici'], mega: 'animale' },
  { sing: null, plur: 'hrana caini', gp: 'f', kw: ['hrana', 'caini'], mega: 'animale' },
  { sing: null, plur: 'hrana pisici', gp: 'f', kw: ['hrana', 'pisici'], mega: 'animale' },
  { sing: 'zgarda caini', plur: 'zgarzi caini', gs: 'f', gp: 'f', kw: ['zgard', 'caini'], mega: 'animale' },
  { sing: 'ham caini', plur: 'hamuri caini', gs: 'n', gp: 'n', kw: ['ham', 'caini'], mega: 'animale' },
  { sing: 'cusca caini', plur: 'custi caini', gs: 'f', gp: 'f', kw: ['cusc', 'caini'], mega: 'animale' },
  { sing: 'litiera pisici', plur: 'litiere pisici', gs: 'f', gp: 'f', kw: ['litier', 'pisici'], mega: 'animale' },
  { sing: 'acvariu', plur: 'acvarii', gs: 'n', gp: 'n', kw: ['acvariu'], mega: 'animale' },

  // ── Carti & Birou ──
  { sing: null, plur: 'carti pentru copii', gp: 'f', kw: ['cart', 'copii'], mega: 'carti-birou' },
  { sing: null, plur: 'carti beletristica', gp: 'f', kw: ['beletristic'], mega: 'carti-birou' },
  { sing: null, plur: 'carti dezvoltare personala', gp: 'f', kw: ['dezvoltare', 'personal'], mega: 'carti-birou' },
  { sing: null, plur: 'manga', gp: 'f', kw: ['manga'], mega: 'carti-birou' },
  { sing: null, plur: 'manuale scolare', gp: 'n', kw: ['manual', 'scolar'], mega: 'carti-birou' },
  { sing: null, plur: 'articole de birou', gp: 'n', kw: ['articol', 'birou'], mega: 'carti-birou' },
  { sing: 'agenda', plur: 'agende', gs: 'f', gp: 'f', kw: ['agenda'], mega: 'carti-birou' },
  { sing: null, plur: 'pixuri', gp: 'n', kw: ['pix'], mega: 'carti-birou' },

  // ── Sanatate & Frumusete (noi) ──
  { sing: null, plur: 'suplimente alimentare', gp: 'n', kw: ['supliment'], mega: 'sanatate-frumusete' },
  { sing: null, plur: 'vitamine', gp: 'f', kw: ['vitamin'], mega: 'sanatate-frumusete' },
  { sing: null, plur: 'proteine', gp: 'f', kw: ['protein'], mega: 'sanatate-frumusete' },
  { sing: 'crema de fata', plur: 'creme de fata', gs: 'f', gp: 'f', kw: ['crem', 'fata'], mega: 'sanatate-frumusete' },
  { sing: 'fond de ten', plur: 'fonduri de ten', gs: 'n', gp: 'n', kw: ['fond', 'ten'], mega: 'sanatate-frumusete' },
  { sing: 'ruj', plur: 'rujuri', gs: 'n', gp: 'n', kw: ['ruj'], mega: 'sanatate-frumusete' },
  { sing: 'parfum', plur: 'parfumuri', gs: 'n', gp: 'n', kw: ['parfum'], mega: 'sanatate-frumusete' },
  { sing: 'aparat de tuns', plur: 'aparate de tuns', gs: 'n', gp: 'n', kw: ['aparat', 'tuns'], mega: 'sanatate-frumusete' },
  { sing: 'epilator', plur: 'epilatoare', gs: 'n', gp: 'n', kw: ['epilator'], mega: 'sanatate-frumusete' },
  { sing: 'ondulator par', plur: 'ondulatoare par', gs: 'n', gp: 'n', kw: ['ondulator', 'par'], mega: 'sanatate-frumusete' },
  { sing: 'tensiometru', plur: 'tensiometre', gs: 'n', gp: 'n', kw: ['tensiometru'], mega: 'sanatate-frumusete' },
  { sing: 'cantar digital', plur: 'cantare digitale', gs: 'n', gp: 'n', kw: ['cantar', 'digital'], mega: 'sanatate-frumusete' },

  // ── Copii & Jucarii (noi) ──
  { sing: null, plur: 'jucarii de exterior', gp: 'f', kw: ['jucar', 'exterior'], mega: 'copii-jucarii' },
  { sing: null, plur: 'jocuri de societate', gp: 'n', kw: ['joc', 'societate'], mega: 'copii-jucarii' },
  { sing: null, plur: 'puzzle-uri', gp: 'n', kw: ['puzzle'], mega: 'copii-jucarii' },
  { sing: 'balansoar copii', plur: 'balansoare copii', gs: 'n', gp: 'n', kw: ['balansoar', 'copii'], mega: 'copii-jucarii' },
  { sing: 'leagan copii', plur: 'leagane copii', gs: 'n', gp: 'n', kw: ['leagan', 'copii'], mega: 'copii-jucarii' },
  { sing: 'premergator', plur: 'premergatoare', gs: 'n', gp: 'n', kw: ['premergator'], mega: 'copii-jucarii' },
  { sing: null, plur: 'scutece', gp: 'n', kw: ['scutec'], mega: 'copii-jucarii' },
  { sing: 'marsupiu bebe', plur: 'marsupiuri bebe', gs: 'n', gp: 'n', kw: ['marsupiu'], mega: 'copii-jucarii' },
  { sing: 'patut bebe', plur: 'patuturi bebe', gs: 'n', gp: 'n', kw: ['patut', 'bebe'], mega: 'copii-jucarii' },
  { sing: null, plur: 'jocuri ps5', gp: 'n', kw: ['ps5'], mega: 'copii-jucarii' },
  { sing: null, plur: 'jocuri nintendo switch', gp: 'n', kw: ['nintendo', 'switch'], mega: 'copii-jucarii' },

  // ── Sport (noi) ──
  { sing: 'bicicleta', plur: 'biciclete', gs: 'f', gp: 'f', kw: ['bicicleta'], mega: 'sport', exclude: BIKE_EXCLUDE },
  { sing: 'bicicleta de oras', plur: 'biciclete de oras', gs: 'f', gp: 'f', kw: ['bicicleta', 'oras'], mega: 'sport', exclude: BIKE_EXCLUDE },
  { sing: 'bicicleta pliabila', plur: 'biciclete pliabile', gs: 'f', gp: 'f', kw: ['bicicleta', 'pliabil'], mega: 'sport', exclude: BIKE_EXCLUDE },
  { sing: 'trotineta electrica adulti', plur: 'trotinete electrice adulti', gs: 'f', gp: 'f', kw: ['trotineta', 'electric', 'adult'], mega: 'sport' },
  { sing: 'aparat fitness', plur: 'aparate fitness', gs: 'n', gp: 'n', kw: ['aparat', 'fitness'], mega: 'sport' },
  { sing: null, plur: 'gantere', gp: 'f', kw: ['ganter'], mega: 'sport', exclude: DUMBBELL_EXCLUDE },
  { sing: 'banca de exercitii', plur: 'banci de exercitii', gs: 'f', gp: 'f', kw: ['banc', 'exercit'], mega: 'sport' },
  { sing: 'eliptica', plur: 'eliptice', gs: 'f', gp: 'f', kw: ['eliptic'], mega: 'sport' },
  { sing: null, plur: 'role inline', gp: 'f', kw: ['role', 'inline'], mega: 'sport' },
  { sing: 'skateboard', plur: 'skateboard-uri', gs: 'n', gp: 'n', kw: ['skateboard'], mega: 'sport' },
  { sing: 'cort', plur: 'corturi', gs: 'n', gp: 'n', kw: ['cort'], mega: 'sport' },
  { sing: null, plur: 'ghete munte', gp: 'f', kw: ['ghete', 'munte'], mega: 'sport' },
  { sing: null, plur: 'skiuri', gp: 'n', kw: ['ski'], mega: 'sport' },

  // ── Auto & Moto (noi) ──
  { sing: null, plur: 'anvelope', gp: 'f', kw: ['anvelope'], mega: 'auto-moto' },
  { sing: null, plur: 'anvelope moto', gp: 'f', kw: ['anvelope', 'moto'], mega: 'auto-moto' },
  { sing: null, plur: 'jante', gp: 'f', kw: ['jante'], mega: 'auto-moto', exclude: RIM_EXCLUDE },
  { sing: 'camera video auto', plur: 'camere video auto', gs: 'f', gp: 'f', kw: ['camera', 'video', 'auto'], mega: 'auto-moto' },
  { sing: 'navigatie gps', plur: 'navigatii gps', gs: 'f', gp: 'f', kw: ['navigat', 'gps'], mega: 'auto-moto' },
  { sing: 'compressor auto', plur: 'compresoare auto', gs: 'n', gp: 'n', kw: ['compresor', 'auto'], mega: 'auto-moto' },
  { sing: null, plur: 'bare transversale', gp: 'f', kw: ['bare', 'transversal'], mega: 'auto-moto' },
  { sing: 'casca moto', plur: 'casti moto', gs: 'f', gp: 'f', kw: ['casc', 'moto'], mega: 'auto-moto' },

  // ── Fashion (noi) ──
  { sing: null, plur: 'adidasi', gp: 'm', kw: ['adidasi'], mega: 'fashion' },
  { sing: null, plur: 'sneakers', gp: 'm', kw: ['sneaker'], mega: 'fashion' },
  { sing: null, plur: 'pantofi', gp: 'm', kw: ['pantofi'], mega: 'fashion', exclude: SHOE_EXCLUDE },
  { sing: 'hanorac barbati', plur: 'hanorace barbati', gs: 'n', gp: 'n', kw: ['hanorac', 'barbat'], mega: 'fashion' },
  { sing: 'hanorac dama', plur: 'hanorace dama', gs: 'n', gp: 'n', kw: ['hanorac', 'dama'], mega: 'fashion' },
  { sing: 'tricou barbati', plur: 'tricouri barbati', gs: 'n', gp: 'n', kw: ['tricou', 'barbat'], mega: 'fashion' },
  { sing: 'tricou dama', plur: 'tricouri dama', gs: 'n', gp: 'n', kw: ['tricou', 'dama'], mega: 'fashion' },
  { sing: null, plur: 'pantaloni barbati', gp: 'm', kw: ['pantalon', 'barbat'], mega: 'fashion' },
  { sing: null, plur: 'jeans barbati', gp: 'm', kw: ['jeans', 'barbat'], mega: 'fashion' },
  { sing: null, plur: 'jeans dama', gp: 'm', kw: ['jeans', 'dama'], mega: 'fashion' },
  { sing: 'rochie de vara', plur: 'rochii de vara', gs: 'f', gp: 'f', kw: ['rochie', 'var'], mega: 'fashion' },
  { sing: 'rochie de seara', plur: 'rochii de seara', gs: 'f', gp: 'f', kw: ['rochie', 'sear'], mega: 'fashion' },
  { sing: 'curea barbati', plur: 'curele barbati', gs: 'f', gp: 'f', kw: ['curea', 'barbat'], mega: 'fashion' },

  // ── Casa & Gradina (noi) ──
  { sing: 'purificator aer', plur: 'purificatoare aer', gs: 'n', gp: 'n', kw: ['purificator', 'aer'], mega: 'casa-gradina' },
  { sing: 'dezumidificator', plur: 'dezumidificatoare', gs: 'n', gp: 'n', kw: ['dezumidificator'], mega: 'casa-gradina' },
  { sing: 'umidificator', plur: 'umidificatoare', gs: 'n', gp: 'n', kw: ['umidificator'], mega: 'casa-gradina' },
  { sing: 'statie de calcat', plur: 'statii de calcat', gs: 'f', gp: 'f', kw: ['stati', 'calcat'], mega: 'casa-gradina' },
  { sing: 'fier de calcat', plur: 'fiare de calcat', gs: 'n', gp: 'n', kw: ['fier', 'calcat'], mega: 'casa-gradina' },
  { sing: 'masina de tocat carne', plur: 'masini de tocat carne', gs: 'f', gp: 'f', kw: ['masina', 'tocat', 'carne'], mega: 'casa-gradina' },
  { sing: 'blender', plur: 'blendere', gs: 'n', gp: 'n', kw: ['blender'], mega: 'casa-gradina' },
  { sing: 'mixer', plur: 'mixere', gs: 'n', gp: 'n', kw: ['mixer'], mega: 'casa-gradina' },
  { sing: 'aparat de facut paine', plur: 'aparate de facut paine', gs: 'n', gp: 'n', kw: ['aparat', 'paine'], mega: 'casa-gradina' },
  { sing: 'masina de tuns iarba', plur: 'masini de tuns iarba', gs: 'f', gp: 'f', kw: ['masina', 'tuns', 'iarba'], mega: 'casa-gradina' },
  { sing: 'motocoasa', plur: 'motocoase', gs: 'f', gp: 'f', kw: ['motocoasa'], mega: 'casa-gradina' },
  { sing: 'motosapa', plur: 'motosape', gs: 'f', gp: 'f', kw: ['motosapa'], mega: 'casa-gradina' },
  { sing: 'drujba', plur: 'drujbe', gs: 'f', gp: 'f', kw: ['drujba'], mega: 'casa-gradina' },
  { sing: 'bormasina', plur: 'bormasini', gs: 'f', gp: 'f', kw: ['bormasin'], mega: 'casa-gradina' },
  { sing: 'invertor sudura', plur: 'invertoare sudura', gs: 'n', gp: 'n', kw: ['invertor', 'sudur'], mega: 'casa-gradina' },
  { sing: null, plur: 'lenjerii de pat', gp: 'f', kw: ['lenjeri', 'pat'], mega: 'casa-gradina' },
  { sing: null, plur: 'perdele', gp: 'f', kw: ['perdel'], mega: 'casa-gradina' },
  { sing: null, plur: 'draperii', gp: 'f', kw: ['draper'], mega: 'casa-gradina' },
  { sing: 'dulap', plur: 'dulapuri', gs: 'n', gp: 'n', kw: ['dulap'], mega: 'casa-gradina' },
  { sing: 'comoda', plur: 'comode', gs: 'f', gp: 'f', kw: ['comod'], mega: 'casa-gradina' },

  // ── Pescuit (noi) ──
  { sing: 'lanseta', plur: 'lansete', gs: 'f', gp: 'f', kw: ['lanseta'], mega: 'pescuit' },
  { sing: 'mulineta', plur: 'mulinete', gs: 'f', gp: 'f', kw: ['mulineta'], mega: 'pescuit' },
  { sing: null, plur: 'naluci pescuit', gp: 'f', kw: ['naluc'], mega: 'pescuit', exclude: LURE_EXCLUDE },
  { sing: 'rucsac pescuit', plur: 'rucsacuri pescuit', gs: 'n', gp: 'n', kw: ['rucsac', 'pescuit'], mega: 'pescuit' },
];

let curatedCount = 0;
for (const item of CURATED_INTENTS) {
  let count = 0;
  for (let i = 0; i < allProducts.length; i++) {
    if (!item.kw.every(k => productTexts[i].includes(k))) continue;
    if (item.exclude) {
      if (item.exclude.some(ex => productTitleTexts[i].includes(ex))) continue;
    }
    count++;
  }

  if (count < 5) continue;

  const mega = item.mega || 'altele';

  // Singular: m/n -> "Cel mai bun", f -> "Cea mai buna"
  if (item.sing) {
    const gs = item.gs || 'n';
    const prefix = gs === 'f' ? 'Cea mai buna' : 'Cel mai bun';
    const slugPrefix = gs === 'f' ? 'cea-mai-buna' : 'cel-mai-bun';
    addIntent({
      slug: slugify(`${slugPrefix}-${item.sing}`),
      title: `${prefix} ${item.sing}`,
      keywords: item.kw,
      exclude: item.exclude,
      megaCategory: mega,
      shardFiles: getShardsForMega(mega),
      productCount: count,
      type: 'best-of',
    });
    curatedCount++;
  }

  // Plural: m -> "Cei mai buni", f/n -> "Cele mai bune"
  if (item.plur) {
    const gp = item.gp || 'n';
    const prefix = gp === 'm' ? 'Cei mai buni' : 'Cele mai bune';
    const slugPrefix = gp === 'm' ? 'cei-mai-buni' : 'cele-mai-bune';
    addIntent({
      slug: slugify(`${slugPrefix}-${item.plur}`),
      title: `${prefix} ${item.plur}`,
      keywords: item.kw,
      exclude: item.exclude,
      megaCategory: mega,
      shardFiles: getShardsForMega(mega),
      productCount: count,
      type: 'best-of',
    });
    curatedCount++;
  }

  // "Top {plur or sing}" (Top works with both)
  const topName = item.plur || item.sing;
  addIntent({
    slug: slugify(`top-${topName}`),
    title: `Top ${topName}`,
    keywords: item.kw,
    exclude: item.exclude,
    megaCategory: mega,
    shardFiles: getShardsForMega(mega),
    productCount: count,
    type: 'top',
  });
  curatedCount++;
}
console.log(`  Generated: ${curatedCount}`);

// ========================================================================
//  SECTION 2: AUTO-DISCOVERED "TOP [subcategory]" FROM SITE STRUCTURE
// ========================================================================
console.log('\n=== SECTION 2: Auto-discovered top subcategory intents ===\n');

// Pre-compute: for each subcategory name, find the mega where it has most products
const bestMegaForSub = new Map();
for (const [megaSlug, cat] of Object.entries(structure.megaCategories)) {
  for (const sub of cat.subcategories) {
    const key = stripDiacritics(sub.name).replace(/[>]/g, '').trim().toLowerCase();
    const existing = bestMegaForSub.get(key);
    if (!existing || sub.count > existing.count) {
      bestMegaForSub.set(key, { megaSlug, count: sub.count });
    }
  }
}

let autoTopCount = 0;
for (const [megaSlug, cat] of Object.entries(structure.megaCategories)) {
  for (const sub of cat.subcategories) {
    if (sub.count < 50) continue;
    const cleanName = stripDiacritics(sub.name).replace(/[>]/g, '').trim().toLowerCase();
    // Skip if this subcategory belongs to a different mega (has more products elsewhere)
    const best = bestMegaForSub.get(cleanName);
    if (best && best.megaSlug !== megaSlug) continue;
    if (cleanName.length < 3) continue;

    if (addIntent({
      slug: slugify(`top-${cleanName}`),
      title: `Top ${cleanName}`,
      keywords: cleanName.split(' ').filter(w => w.length > 2).slice(0, 4),
      megaCategory: megaSlug,
      shardFiles: getShardsForMega(megaSlug),
      productCount: sub.count,
      type: 'top-auto',
      filterCategory: sub.originalName || sub.name,
    })) {
      autoTopCount++;
    }
  }
}
console.log(`  Generated: ${autoTopCount}`);

// ========================================================================
//  SECTION 3: CURATED BRAND INTENTS ("Top [brand] [category]")
// ========================================================================
console.log('\n=== SECTION 3: Curated brand intents ===\n');

const BRAND_INTENTS = [
  // Laptop brands
  { brand: 'Lenovo', kw: ['lenovo', 'laptop'], mega: 'electronice-it' },
  { brand: 'ASUS', kw: ['asus', 'laptop'], mega: 'electronice-it' },
  { brand: 'HP', kw: ['hp', 'laptop'], mega: 'electronice-it' },
  { brand: 'Dell', kw: ['dell', 'laptop'], mega: 'electronice-it' },
  { brand: 'Acer', kw: ['acer', 'laptop'], mega: 'electronice-it' },
  { brand: 'Apple MacBook', kw: ['macbook'], mega: 'electronice-it' },
  { brand: 'MSI', kw: ['msi', 'laptop'], mega: 'electronice-it' },

  // Laptop lines
  { brand: 'ASUS ROG', kw: ['asus', 'rog'], mega: 'electronice-it' },
  { brand: 'ASUS VivoBook', kw: ['asus', 'vivobook'], mega: 'electronice-it' },
  { brand: 'ASUS TUF', kw: ['asus', 'tuf'], mega: 'electronice-it' },
  { brand: 'ASUS ZenBook', kw: ['asus', 'zenbook'], mega: 'electronice-it' },
  { brand: 'Lenovo ThinkPad', kw: ['lenovo', 'thinkpad'], mega: 'electronice-it' },
  { brand: 'Lenovo IdeaPad', kw: ['lenovo', 'ideapad'], mega: 'electronice-it' },
  { brand: 'Lenovo Legion', kw: ['lenovo', 'legion'], mega: 'electronice-it' },

  // Monitor brands
  { brand: 'Samsung Monitor', kw: ['samsung', 'monitor'], mega: 'electronice-it' },
  { brand: 'LG Monitor', kw: ['lg', 'monitor'], mega: 'electronice-it' },
  { brand: 'Dell Monitor', kw: ['dell', 'monitor'], mega: 'electronice-it' },
  { brand: 'ASUS Monitor', kw: ['asus', 'monitor'], mega: 'electronice-it' },
  { brand: 'BenQ Monitor', kw: ['benq', 'monitor'], mega: 'electronice-it' },

  // Electrocasnice brands
  { brand: 'Bosch', kw: ['bosch'], mega: 'casa-gradina' },
  { brand: 'Whirlpool', kw: ['whirlpool'], mega: 'casa-gradina' },
  { brand: 'Beko', kw: ['beko'], mega: 'casa-gradina' },
  { brand: 'Heinner', kw: ['heinner'], mega: 'casa-gradina' },
  { brand: 'Dyson', kw: ['dyson'], mega: 'casa-gradina' },
  { brand: 'Roborock', kw: ['roborock'], mega: 'casa-gradina' },
  { brand: 'DeLonghi', kw: ['delonghi'], mega: 'casa-gradina' },

  // Anvelope brands
  { brand: 'Continental anvelope', kw: ['continental', 'anvelope'], mega: 'auto-moto' },
  { brand: 'Michelin anvelope', kw: ['michelin', 'anvelope'], mega: 'auto-moto' },
  { brand: 'Pirelli anvelope', kw: ['pirelli', 'anvelope'], mega: 'auto-moto' },
  { brand: 'Hankook anvelope', kw: ['hankook', 'anvelope'], mega: 'auto-moto' },
  { brand: 'Bridgestone anvelope', kw: ['bridgestone', 'anvelope'], mega: 'auto-moto' },
  { brand: 'Goodyear anvelope', kw: ['goodyear', 'anvelope'], mega: 'auto-moto' },

  // Fashion brands
  { brand: 'Adidas', kw: ['adidas'], mega: 'fashion' },
  { brand: 'Puma', kw: ['puma'], mega: 'fashion' },
  { brand: 'Nike', kw: ['nike'], mega: 'fashion' },
  { brand: 'New Balance', kw: ['new balance'], mega: 'fashion' },
  { brand: 'Converse', kw: ['converse'], mega: 'fashion' },
  { brand: 'Tommy Hilfiger', kw: ['tommy hilfiger'], mega: 'fashion' },
  { brand: 'Calvin Klein', kw: ['calvin klein'], mega: 'fashion' },
  { brand: 'Hugo Boss', kw: ['boss'], mega: 'fashion' },
  { brand: 'Michael Kors', kw: ['michael kors'], mega: 'fashion' },
  { brand: 'Ralph Lauren', kw: ['ralph lauren'], mega: 'fashion' },

  // Mobilier
  { brand: 'HOMCOM', kw: ['homcom'], mega: 'casa-gradina' },
  { brand: 'Outsunny', kw: ['outsunny'], mega: 'casa-gradina' },

  // Copii
  { brand: 'LORELLI', kw: ['lorelli'], mega: 'copii-jucarii' },
  { brand: 'Chicco', kw: ['chicco'], mega: 'copii-jucarii' },

  // Pescuit
  { brand: 'Savage Gear', kw: ['savage gear'], mega: 'pescuit' },
  { brand: 'Rapala', kw: ['rapala'], mega: 'pescuit' },
  { brand: 'Shimano', kw: ['shimano'], mega: 'pescuit' },
  { brand: 'Daiwa', kw: ['daiwa'], mega: 'pescuit' },

  // Parfumuri brands
  { brand: 'Dior parfumuri', kw: ['dior', 'parfum'], mega: 'sanatate-frumusete' },
  { brand: 'Chanel parfumuri', kw: ['chanel', 'parfum'], mega: 'sanatate-frumusete' },
  { brand: 'Armani parfumuri', kw: ['armani', 'parfum'], mega: 'sanatate-frumusete' },
  { brand: 'Hugo Boss parfumuri', kw: ['boss', 'parfum'], mega: 'sanatate-frumusete' },
  { brand: 'Versace parfumuri', kw: ['versace', 'parfum'], mega: 'sanatate-frumusete' },
];

let brandCount = 0;
for (const b of BRAND_INTENTS) {
  // Count matching products
  let count = 0;
  for (let i = 0; i < allProducts.length; i++) {
    if (b.kw.every(k => productTexts[i].includes(k))) count++;
  }
  if (count < 5) continue;

  const mega = b.mega || 'altele';
  addIntent({
    slug: slugify(`top-${b.brand}`),
    title: `Top ${b.brand}`,
    keywords: b.kw,
    megaCategory: mega,
    shardFiles: getShardsForMega(mega),
    productCount: count,
    type: 'brand',
  });
  brandCount++;
}
console.log(`  Generated: ${brandCount}`);

// ========================================================================
//  SECTION 4: PRICE-BASED LONG-TAIL INTENTS ("sub X lei")
// ========================================================================
console.log('\n=== SECTION 4: Price-based long-tail intents ===\n');

const PRICE_INTENTS = [
  // Laptopuri pe buget
  { name: 'laptopuri sub 2000 lei', kw: ['laptop'], maxPrice: 2000, mega: 'electronice-it', exclude: ACCESSORY_EXCLUDE },
  { name: 'laptopuri sub 3000 lei', kw: ['laptop'], maxPrice: 3000, mega: 'electronice-it', exclude: ACCESSORY_EXCLUDE },
  { name: 'laptopuri sub 4000 lei', kw: ['laptop'], maxPrice: 4000, mega: 'electronice-it', exclude: ACCESSORY_EXCLUDE },
  // Telefoane pe buget
  { name: 'telefoane sub 1000 lei', kw: ['telefon'], maxPrice: 1000, mega: 'electronice-it', exclude: PHONE_EXCLUDE },
  { name: 'telefoane sub 1500 lei', kw: ['telefon'], maxPrice: 1500, mega: 'electronice-it', exclude: PHONE_EXCLUDE },
  { name: 'telefoane sub 2000 lei', kw: ['telefon'], maxPrice: 2000, mega: 'electronice-it', exclude: PHONE_EXCLUDE },
  // Monitoare pe buget
  { name: 'monitoare sub 1000 lei', kw: ['monitor'], maxPrice: 1000, mega: 'electronice-it' },
  { name: 'monitoare sub 1500 lei', kw: ['monitor'], maxPrice: 1500, mega: 'electronice-it' },
  // Televizoare pe buget
  { name: 'televizoare sub 1500 lei', kw: ['televizor'], maxPrice: 1500, mega: 'electronice-it' },
  { name: 'televizoare sub 2000 lei', kw: ['televizor'], maxPrice: 2000, mega: 'electronice-it' },
  { name: 'televizoare sub 3000 lei', kw: ['televizor'], maxPrice: 3000, mega: 'electronice-it' },
  // Casti pe buget
  { name: 'casti wireless sub 200 lei', kw: ['casti', 'wireless'], maxPrice: 200, mega: 'electronice-it' },
  { name: 'casti bluetooth sub 100 lei', kw: ['casti', 'bluetooth'], maxPrice: 100, mega: 'electronice-it' },
  { name: 'casti gaming sub 200 lei', kw: ['casti', 'gaming'], maxPrice: 200, mega: 'electronice-it' },
  // Aspiratoare pe buget
  { name: 'aspiratoare robot sub 1500 lei', kw: ['aspirator', 'robot'], maxPrice: 1500, mega: 'casa-gradina' },
  { name: 'aspiratoare robot sub 2000 lei', kw: ['aspirator', 'robot'], maxPrice: 2000, mega: 'casa-gradina' },
  // Electrocasnice pe buget
  { name: 'masini de spalat rufe sub 2000 lei', kw: ['masina', 'spalat', 'rufe'], maxPrice: 2000, mega: 'casa-gradina' },
  { name: 'frigidere sub 2000 lei', kw: ['frigider'], maxPrice: 2000, mega: 'casa-gradina' },
  { name: 'combine frigorifice sub 2500 lei', kw: ['combina', 'frigorific'], maxPrice: 2500, mega: 'casa-gradina' },
  { name: 'espressoare sub 1000 lei', kw: ['espressor'], maxPrice: 1000, mega: 'casa-gradina' },
  { name: 'friteuze air fryer sub 500 lei', kw: ['friteuza'], maxPrice: 500, mega: 'casa-gradina' },
  // Mobilier pe buget
  { name: 'scaune de birou sub 500 lei', kw: ['scaun', 'birou'], maxPrice: 500, mega: 'casa-gradina' },
  { name: 'scaune gaming sub 1000 lei', kw: ['scaun', 'gaming'], maxPrice: 1000, mega: 'casa-gradina' },
  { name: 'canapele sub 2000 lei', kw: ['canapea'], maxPrice: 2000, mega: 'casa-gradina' },
  { name: 'saltele sub 1000 lei', kw: ['saltea'], maxPrice: 1000, mega: 'casa-gradina' },
  // Sport pe buget
  { name: 'biciclete sub 1500 lei', kw: ['bicicleta'], maxPrice: 1500, mega: 'sport', exclude: BIKE_EXCLUDE },
  { name: 'biciclete electrice sub 3000 lei', kw: ['bicicleta', 'electric'], maxPrice: 3000, mega: 'sport', exclude: BIKE_EXCLUDE },
  { name: 'trotinete electrice sub 1500 lei', kw: ['trotineta', 'electric'], maxPrice: 1500, mega: 'sport' },
  { name: 'trotinete electrice sub 2000 lei', kw: ['trotineta', 'electric'], maxPrice: 2000, mega: 'sport' },
  // Fashion pe buget
  { name: 'adidasi sub 200 lei', kw: ['adidasi'], maxPrice: 200, mega: 'fashion' },
  { name: 'adidasi sub 300 lei', kw: ['adidasi'], maxPrice: 300, mega: 'fashion' },
  { name: 'ghete barbati sub 300 lei', kw: ['ghete', 'barbat'], maxPrice: 300, mega: 'fashion' },
  { name: 'geci barbati sub 500 lei', kw: ['geaca', 'barbat'], maxPrice: 500, mega: 'fashion' },
  { name: 'parfumuri sub 200 lei', kw: ['parfum'], maxPrice: 200, mega: 'sanatate-frumusete' },
  { name: 'parfumuri barbati sub 200 lei', kw: ['parfum', 'barbat'], maxPrice: 200, mega: 'sanatate-frumusete' },
  { name: 'parfumuri dama sub 200 lei', kw: ['parfum', 'dama'], maxPrice: 200, mega: 'sanatate-frumusete' },
  // Smartwatch pe buget
  { name: 'smartwatch sub 500 lei', kw: ['smartwatch'], maxPrice: 500, mega: 'electronice-it', exclude: ACCESSORY_EXCLUDE },
  { name: 'smartwatch sub 1000 lei', kw: ['smartwatch'], maxPrice: 1000, mega: 'electronice-it', exclude: ACCESSORY_EXCLUDE },
  // Copii pe buget
  { name: 'carucioare copii sub 1000 lei', kw: ['carucior', 'copii'], maxPrice: 1000, mega: 'copii-jucarii' },
  { name: 'scaune auto copii sub 500 lei', kw: ['scaun', 'auto', 'copii'], maxPrice: 500, mega: 'copii-jucarii' },
  { name: 'jucarii sub 50 lei', kw: ['jucari'], maxPrice: 50, mega: 'copii-jucarii' },
  { name: 'jucarii sub 100 lei', kw: ['jucari'], maxPrice: 100, mega: 'copii-jucarii' },
  { name: 'lego sub 100 lei', kw: ['lego'], maxPrice: 100, mega: 'copii-jucarii' },
  { name: 'lego sub 200 lei', kw: ['lego'], maxPrice: 200, mega: 'copii-jucarii' },
  { name: 'lego sub 300 lei', kw: ['lego'], maxPrice: 300, mega: 'copii-jucarii' },
  // Laptopuri extra
  { name: 'laptopuri sub 1500 lei', kw: ['laptop'], maxPrice: 1500, mega: 'electronice-it', exclude: ACCESSORY_EXCLUDE },
  { name: 'laptopuri sub 5000 lei', kw: ['laptop'], maxPrice: 5000, mega: 'electronice-it', exclude: ACCESSORY_EXCLUDE },
  { name: 'laptopuri gaming sub 3000 lei', kw: ['laptop', 'gaming'], maxPrice: 3000, mega: 'electronice-it', exclude: ACCESSORY_EXCLUDE },
  { name: 'laptopuri gaming sub 4000 lei', kw: ['laptop', 'gaming'], maxPrice: 4000, mega: 'electronice-it', exclude: ACCESSORY_EXCLUDE },
  { name: 'laptopuri gaming sub 5000 lei', kw: ['laptop', 'gaming'], maxPrice: 5000, mega: 'electronice-it', exclude: ACCESSORY_EXCLUDE },
  // Telefoane extra
  { name: 'telefoane sub 500 lei', kw: ['telefon'], maxPrice: 500, mega: 'electronice-it', exclude: PHONE_EXCLUDE },
  { name: 'telefoane sub 700 lei', kw: ['telefon'], maxPrice: 700, mega: 'electronice-it', exclude: PHONE_EXCLUDE },
  { name: 'telefoane sub 3000 lei', kw: ['telefon'], maxPrice: 3000, mega: 'electronice-it', exclude: PHONE_EXCLUDE },
  // Tablete
  { name: 'tablete sub 500 lei', kw: ['tableta'], maxPrice: 500, mega: 'electronice-it', exclude: TABLET_EXCLUDE },
  { name: 'tablete sub 1000 lei', kw: ['tableta'], maxPrice: 1000, mega: 'electronice-it', exclude: TABLET_EXCLUDE },
  { name: 'tablete sub 1500 lei', kw: ['tableta'], maxPrice: 1500, mega: 'electronice-it', exclude: TABLET_EXCLUDE },
  { name: 'tablete sub 2000 lei', kw: ['tableta'], maxPrice: 2000, mega: 'electronice-it', exclude: TABLET_EXCLUDE },
  // Monitoare extra
  { name: 'monitoare sub 500 lei', kw: ['monitor'], maxPrice: 500, mega: 'electronice-it' },
  { name: 'monitoare sub 2000 lei', kw: ['monitor'], maxPrice: 2000, mega: 'electronice-it' },
  { name: 'monitoare gaming sub 1000 lei', kw: ['monitor', 'gaming'], maxPrice: 1000, mega: 'electronice-it', exclude: MONITOR_EXCLUDE },
  { name: 'monitoare gaming sub 1500 lei', kw: ['monitor', 'gaming'], maxPrice: 1500, mega: 'electronice-it', exclude: MONITOR_EXCLUDE },
  // Televizoare extra
  { name: 'televizoare sub 1000 lei', kw: ['televizor'], maxPrice: 1000, mega: 'electronice-it', exclude: TV_EXCLUDE },
  { name: 'televizoare sub 5000 lei', kw: ['televizor'], maxPrice: 5000, mega: 'electronice-it', exclude: TV_EXCLUDE },
  // Casti extra
  { name: 'casti sub 50 lei', kw: ['casti'], maxPrice: 50, mega: 'electronice-it' },
  { name: 'casti sub 100 lei', kw: ['casti'], maxPrice: 100, mega: 'electronice-it' },
  { name: 'casti sub 300 lei', kw: ['casti'], maxPrice: 300, mega: 'electronice-it' },
  { name: 'casti gaming sub 100 lei', kw: ['casti', 'gaming'], maxPrice: 100, mega: 'electronice-it' },
  { name: 'casti gaming sub 300 lei', kw: ['casti', 'gaming'], maxPrice: 300, mega: 'electronice-it' },
  // Boxe si soundbar
  { name: 'boxe bluetooth sub 200 lei', kw: ['boxa', 'bluetooth'], maxPrice: 200, mega: 'electronice-it' },
  { name: 'boxe bluetooth sub 300 lei', kw: ['boxa', 'bluetooth'], maxPrice: 300, mega: 'electronice-it' },
  { name: 'soundbar sub 500 lei', kw: ['soundbar'], maxPrice: 500, mega: 'electronice-it' },
  { name: 'soundbar sub 1000 lei', kw: ['soundbar'], maxPrice: 1000, mega: 'electronice-it' },
  // Aparate foto / camera
  { name: 'aparate foto sub 2000 lei', kw: ['aparat', 'foto'], maxPrice: 2000, mega: 'electronice-it' },
  { name: 'aparate foto sub 3000 lei', kw: ['aparat', 'foto'], maxPrice: 3000, mega: 'electronice-it' },
  { name: 'camere de supraveghere sub 200 lei', kw: ['camera', 'supraveghere'], maxPrice: 200, mega: 'electronice-it' },
  { name: 'camere de supraveghere sub 500 lei', kw: ['camera', 'supraveghere'], maxPrice: 500, mega: 'electronice-it' },
  // Imprimante
  { name: 'imprimante sub 500 lei', kw: ['imprimanta'], maxPrice: 500, mega: 'electronice-it' },
  { name: 'imprimante sub 1000 lei', kw: ['imprimanta'], maxPrice: 1000, mega: 'electronice-it' },
  // Aspiratoare extra
  { name: 'aspiratoare sub 500 lei', kw: ['aspirator'], maxPrice: 500, mega: 'casa-gradina' },
  { name: 'aspiratoare sub 1000 lei', kw: ['aspirator'], maxPrice: 1000, mega: 'casa-gradina' },
  { name: 'aspiratoare verticale sub 1000 lei', kw: ['aspirator', 'vertical'], maxPrice: 1000, mega: 'casa-gradina' },
  { name: 'aspiratoare verticale sub 1500 lei', kw: ['aspirator', 'vertical'], maxPrice: 1500, mega: 'casa-gradina' },
  // Electrocasnice extra
  { name: 'masini de spalat rufe sub 1500 lei', kw: ['masina', 'spalat', 'rufe'], maxPrice: 1500, mega: 'casa-gradina' },
  { name: 'masini de spalat vase sub 1500 lei', kw: ['masina', 'spalat', 'vase'], maxPrice: 1500, mega: 'casa-gradina' },
  { name: 'masini de spalat vase sub 2000 lei', kw: ['masina', 'spalat', 'vase'], maxPrice: 2000, mega: 'casa-gradina' },
  { name: 'frigidere sub 1500 lei', kw: ['frigider'], maxPrice: 1500, mega: 'casa-gradina' },
  { name: 'frigidere sub 3000 lei', kw: ['frigider'], maxPrice: 3000, mega: 'casa-gradina' },
  { name: 'cuptoare cu microunde sub 300 lei', kw: ['cuptor', 'microunde'], maxPrice: 300, mega: 'casa-gradina', exclude: MICROWAVE_EXCLUDE },
  { name: 'cuptoare cu microunde sub 500 lei', kw: ['cuptor', 'microunde'], maxPrice: 500, mega: 'casa-gradina', exclude: MICROWAVE_EXCLUDE },
  { name: 'espressoare sub 500 lei', kw: ['espressor'], maxPrice: 500, mega: 'casa-gradina' },
  { name: 'espressoare sub 2000 lei', kw: ['espressor'], maxPrice: 2000, mega: 'casa-gradina' },
  { name: 'friteuze sub 300 lei', kw: ['friteuza'], maxPrice: 300, mega: 'casa-gradina' },
  { name: 'friteuze sub 700 lei', kw: ['friteuza'], maxPrice: 700, mega: 'casa-gradina' },
  { name: 'aer conditionat sub 2000 lei', kw: ['aer', 'conditionat'], maxPrice: 2000, mega: 'casa-gradina' },
  { name: 'aer conditionat sub 3000 lei', kw: ['aer', 'conditionat'], maxPrice: 3000, mega: 'casa-gradina' },
  { name: 'uscatoare de rufe sub 2000 lei', kw: ['uscator', 'rufe'], maxPrice: 2000, mega: 'casa-gradina' },
  { name: 'uscatoare de rufe sub 3000 lei', kw: ['uscator', 'rufe'], maxPrice: 3000, mega: 'casa-gradina' },
  // Mobilier extra
  { name: 'scaune de birou sub 300 lei', kw: ['scaun', 'birou'], maxPrice: 300, mega: 'casa-gradina' },
  { name: 'scaune de birou sub 1000 lei', kw: ['scaun', 'birou'], maxPrice: 1000, mega: 'casa-gradina' },
  { name: 'birouri sub 500 lei', kw: ['birou'], maxPrice: 500, mega: 'casa-gradina' },
  { name: 'birouri sub 1000 lei', kw: ['birou'], maxPrice: 1000, mega: 'casa-gradina' },
  { name: 'canapele sub 1500 lei', kw: ['canapea'], maxPrice: 1500, mega: 'casa-gradina' },
  { name: 'canapele sub 3000 lei', kw: ['canapea'], maxPrice: 3000, mega: 'casa-gradina' },
  { name: 'saltele sub 500 lei', kw: ['saltea'], maxPrice: 500, mega: 'casa-gradina' },
  { name: 'saltele sub 1500 lei', kw: ['saltea'], maxPrice: 1500, mega: 'casa-gradina' },
  { name: 'paturi sub 1000 lei', kw: ['pat'], maxPrice: 1000, mega: 'casa-gradina' },
  { name: 'paturi sub 2000 lei', kw: ['pat'], maxPrice: 2000, mega: 'casa-gradina' },
  { name: 'dulapuri sub 1000 lei', kw: ['dulap'], maxPrice: 1000, mega: 'casa-gradina' },
  { name: 'dulapuri sub 2000 lei', kw: ['dulap'], maxPrice: 2000, mega: 'casa-gradina' },
  // Sport extra
  { name: 'biciclete sub 1000 lei', kw: ['bicicleta'], maxPrice: 1000, mega: 'sport', exclude: BIKE_EXCLUDE },
  { name: 'biciclete sub 2000 lei', kw: ['bicicleta'], maxPrice: 2000, mega: 'sport', exclude: BIKE_EXCLUDE },
  { name: 'benzi de alergat sub 1500 lei', kw: ['banda', 'alergat'], maxPrice: 1500, mega: 'sport' },
  { name: 'benzi de alergat sub 2000 lei', kw: ['banda', 'alergat'], maxPrice: 2000, mega: 'sport' },
  { name: 'benzi de alergat sub 3000 lei', kw: ['banda', 'alergat'], maxPrice: 3000, mega: 'sport' },
  { name: 'trotinete electrice sub 1000 lei', kw: ['trotineta', 'electric'], maxPrice: 1000, mega: 'sport' },
  { name: 'trotinete electrice sub 3000 lei', kw: ['trotineta', 'electric'], maxPrice: 3000, mega: 'sport' },
  // Fashion extra
  { name: 'adidasi sub 100 lei', kw: ['adidasi'], maxPrice: 100, mega: 'fashion' },
  { name: 'adidasi sub 500 lei', kw: ['adidasi'], maxPrice: 500, mega: 'fashion' },
  { name: 'sneakers sub 200 lei', kw: ['sneaker'], maxPrice: 200, mega: 'fashion' },
  { name: 'sneakers sub 300 lei', kw: ['sneaker'], maxPrice: 300, mega: 'fashion' },
  { name: 'sneakers sub 500 lei', kw: ['sneaker'], maxPrice: 500, mega: 'fashion' },
  { name: 'ghete dama sub 300 lei', kw: ['ghete', 'dama'], maxPrice: 300, mega: 'fashion' },
  { name: 'geci dama sub 500 lei', kw: ['geaca', 'dama'], maxPrice: 500, mega: 'fashion' },
  { name: 'geci barbati sub 300 lei', kw: ['geaca', 'barbat'], maxPrice: 300, mega: 'fashion' },
  { name: 'ceasuri barbati sub 300 lei', kw: ['ceas', 'barbat'], maxPrice: 300, mega: 'fashion' },
  { name: 'ceasuri barbati sub 500 lei', kw: ['ceas', 'barbat'], maxPrice: 500, mega: 'fashion' },
  { name: 'ceasuri dama sub 300 lei', kw: ['ceas', 'dama'], maxPrice: 300, mega: 'fashion' },
  { name: 'ceasuri dama sub 500 lei', kw: ['ceas', 'dama'], maxPrice: 500, mega: 'fashion' },
  { name: 'genti dama sub 200 lei', kw: ['geanta', 'dama'], maxPrice: 200, mega: 'fashion' },
  { name: 'genti dama sub 300 lei', kw: ['geanta', 'dama'], maxPrice: 300, mega: 'fashion' },
  { name: 'ochelari de soare sub 200 lei', kw: ['ochelari', 'soare'], maxPrice: 200, mega: 'fashion' },
  { name: 'ochelari de soare sub 300 lei', kw: ['ochelari', 'soare'], maxPrice: 300, mega: 'fashion' },
  // Parfumuri extra
  { name: 'parfumuri sub 100 lei', kw: ['parfum'], maxPrice: 100, mega: 'sanatate-frumusete' },
  { name: 'parfumuri sub 300 lei', kw: ['parfum'], maxPrice: 300, mega: 'sanatate-frumusete' },
  { name: 'parfumuri barbati sub 100 lei', kw: ['parfum', 'barbat'], maxPrice: 100, mega: 'sanatate-frumusete' },
  { name: 'parfumuri barbati sub 300 lei', kw: ['parfum', 'barbat'], maxPrice: 300, mega: 'sanatate-frumusete' },
  { name: 'parfumuri dama sub 100 lei', kw: ['parfum', 'dama'], maxPrice: 100, mega: 'sanatate-frumusete' },
  { name: 'parfumuri dama sub 300 lei', kw: ['parfum', 'dama'], maxPrice: 300, mega: 'sanatate-frumusete' },
  // Smartwatch extra
  { name: 'smartwatch sub 200 lei', kw: ['smartwatch'], maxPrice: 200, mega: 'electronice-it', exclude: ACCESSORY_EXCLUDE },
  { name: 'smartwatch sub 300 lei', kw: ['smartwatch'], maxPrice: 300, mega: 'electronice-it', exclude: ACCESSORY_EXCLUDE },
  { name: 'smartwatch sub 1500 lei', kw: ['smartwatch'], maxPrice: 1500, mega: 'electronice-it', exclude: ACCESSORY_EXCLUDE },
  // Auto
  { name: 'anvelope sub 200 lei', kw: ['anvelop'], maxPrice: 200, mega: 'auto-moto' },
  { name: 'anvelope sub 300 lei', kw: ['anvelop'], maxPrice: 300, mega: 'auto-moto' },
  { name: 'anvelope sub 500 lei', kw: ['anvelop'], maxPrice: 500, mega: 'auto-moto' },
  { name: 'camera video auto sub 200 lei', kw: ['camera', 'auto'], maxPrice: 200, mega: 'auto-moto' },
  { name: 'camera video auto sub 500 lei', kw: ['camera', 'auto'], maxPrice: 500, mega: 'auto-moto' },
  // Carti
  { name: 'carti sub 30 lei', kw: ['carte'], maxPrice: 30, mega: 'carti-muzica-filme' },
  { name: 'carti sub 50 lei', kw: ['carte'], maxPrice: 50, mega: 'carti-muzica-filme' },
  // Animale
  { name: 'hrana caini sub 100 lei', kw: ['hrana', 'cain'], maxPrice: 100, mega: 'animale' },
  { name: 'hrana caini sub 200 lei', kw: ['hrana', 'cain'], maxPrice: 200, mega: 'animale' },
  { name: 'hrana pisici sub 100 lei', kw: ['hrana', 'pisic'], maxPrice: 100, mega: 'animale' },
  { name: 'hrana pisici sub 200 lei', kw: ['hrana', 'pisic'], maxPrice: 200, mega: 'animale' },
  // Gradina / bricolaj
  { name: 'masini de tuns iarba sub 500 lei', kw: ['masina', 'tuns', 'iarba'], maxPrice: 500, mega: 'casa-gradina' },
  { name: 'masini de tuns iarba sub 1000 lei', kw: ['masina', 'tuns', 'iarba'], maxPrice: 1000, mega: 'casa-gradina' },
  { name: 'bormasini sub 200 lei', kw: ['bormasina'], maxPrice: 200, mega: 'casa-gradina' },
  { name: 'bormasini sub 500 lei', kw: ['bormasina'], maxPrice: 500, mega: 'casa-gradina' },
  { name: 'drujbe sub 500 lei', kw: ['drujba'], maxPrice: 500, mega: 'casa-gradina' },
  { name: 'drujbe sub 1000 lei', kw: ['drujba'], maxPrice: 1000, mega: 'casa-gradina' },
  // Cosmetice / ingrijire
  { name: 'epilatoare sub 200 lei', kw: ['epilator'], maxPrice: 200, mega: 'sanatate-frumusete' },
  { name: 'epilatoare sub 500 lei', kw: ['epilator'], maxPrice: 500, mega: 'sanatate-frumusete' },
  { name: 'placi de par sub 100 lei', kw: ['placa', 'par'], maxPrice: 100, mega: 'sanatate-frumusete' },
  { name: 'placi de par sub 200 lei', kw: ['placa', 'par'], maxPrice: 200, mega: 'sanatate-frumusete' },
  { name: 'uscatoare de par sub 100 lei', kw: ['uscator', 'par'], maxPrice: 100, mega: 'sanatate-frumusete' },
  { name: 'uscatoare de par sub 200 lei', kw: ['uscator', 'par'], maxPrice: 200, mega: 'sanatate-frumusete' },
  { name: 'periute electrice sub 200 lei', kw: ['periuta', 'electric'], maxPrice: 200, mega: 'sanatate-frumusete' },
  { name: 'periute electrice sub 500 lei', kw: ['periuta', 'electric'], maxPrice: 500, mega: 'sanatate-frumusete' },
  // Gaming / console
  { name: 'console gaming sub 1500 lei', kw: ['consola'], maxPrice: 1500, mega: 'electronice-it' },
  { name: 'console gaming sub 2000 lei', kw: ['consola'], maxPrice: 2000, mega: 'electronice-it' },
  { name: 'console gaming sub 3000 lei', kw: ['consola'], maxPrice: 3000, mega: 'electronice-it' },
  { name: 'placi video sub 1500 lei', kw: ['placa', 'video'], maxPrice: 1500, mega: 'electronice-it', exclude: GPU_EXCLUDE },
  { name: 'placi video sub 2000 lei', kw: ['placa', 'video'], maxPrice: 2000, mega: 'electronice-it', exclude: GPU_EXCLUDE },
  { name: 'placi video sub 3000 lei', kw: ['placa', 'video'], maxPrice: 3000, mega: 'electronice-it', exclude: GPU_EXCLUDE },
  { name: 'tastaturi mecanice sub 200 lei', kw: ['tastatura', 'mecanic'], maxPrice: 200, mega: 'electronice-it' },
  { name: 'tastaturi mecanice sub 300 lei', kw: ['tastatura', 'mecanic'], maxPrice: 300, mega: 'electronice-it' },
  { name: 'mouse gaming sub 100 lei', kw: ['mouse', 'gaming'], maxPrice: 100, mega: 'electronice-it' },
  { name: 'mouse gaming sub 200 lei', kw: ['mouse', 'gaming'], maxPrice: 200, mega: 'electronice-it' },
  // Scaune gaming extra
  { name: 'scaune gaming sub 500 lei', kw: ['scaun', 'gaming'], maxPrice: 500, mega: 'casa-gradina' },
  { name: 'scaune gaming sub 1500 lei', kw: ['scaun', 'gaming'], maxPrice: 1500, mega: 'casa-gradina' },
];

let priceCount = 0;
for (const p of PRICE_INTENTS) {
  let count = 0;
  for (let i = 0; i < allProducts.length; i++) {
    if (!p.kw.every(k => productTexts[i].includes(k))) continue;
    if (p.exclude && p.exclude.some(ex => productTitleTexts[i].includes(ex))) continue;
    if (allProducts[i].p > p.maxPrice || allProducts[i].p <= 0) continue;
    count++;
  }
  if (count < 5) continue;

  const mega = p.mega || 'altele';
  addIntent({
    slug: slugify(p.name),
    title: capitalize(p.name),
    keywords: p.kw,
    exclude: p.exclude,
    maxPrice: p.maxPrice,
    megaCategory: mega,
    shardFiles: getShardsForMega(mega),
    productCount: count,
    type: 'budget',
  });
  priceCount++;
}
console.log(`  Generated: ${priceCount}`);

// ========================================================================
//  TRIM TO MAX_INTENTS
// ========================================================================
if (intents.length > MAX_INTENTS) {
  console.log(`\n=== Trimming from ${intents.length} to ${MAX_INTENTS} ===`);

  // Sort by priority: curated first (best-of, top), then brand, then auto-discovered
  const priority = { 'best-of': 0, 'top': 1, 'budget': 2, 'brand': 3, 'top-auto': 4 };
  intents.sort((a, b) => {
    const pa = priority[a.type] ?? 99;
    const pb = priority[b.type] ?? 99;
    if (pa !== pb) return pa - pb;
    return b.productCount - a.productCount;
  });

  intents.length = MAX_INTENTS;
  console.log(`  Trimmed to ${intents.length}`);
}

// ========================================================================
//  PRE-COMPUTE PRODUCTS PER INTENT
// ========================================================================
rmSync(SEARCH_DIR, { recursive: true, force: true });
mkdirSync(SEARCH_DIR, { recursive: true });

console.log('\n=== Pre-computing products per intent ===\n');
console.log(`  Index ready: ${categoryIndex.size} categories`);

let emptyCount = 0;
const total = intents.length;
for (let idx = 0; idx < intents.length; idx++) {
  const intent = intents[idx];
  if (idx % 500 === 0) console.log(`  Processing ${idx}/${total}...`);

  let filteredIndices;
  if (intent.filterCategory) {
    // Use category index - instant lookup
    filteredIndices = categoryIndex.get(intent.filterCategory) || [];
  } else if (intent.keywords?.length) {
    filteredIndices = [];
    for (let i = 0; i < allProducts.length; i++) {
      const title = productTitleTexts[i];
      const full = productTexts[i];
      // All keywords must appear in title OR in full text
      // But at least half of keywords must be in the title for relevance
      let titleMatches = 0;
      let fullMatches = 0;
      for (const k of intent.keywords) {
        if (title.includes(k)) titleMatches++;
        if (full.includes(k)) fullMatches++;
      }
      // All must match somewhere
      if (fullMatches < intent.keywords.length) continue;
      // At least half must be in title (rounded up)
      const minTitleMatches = Math.ceil(intent.keywords.length / 2);
      if (titleMatches < minTitleMatches) continue;
      filteredIndices.push(i);
    }
  } else {
    filteredIndices = [];
  }

  let filtered = filteredIndices.map(i => allProducts[i]);

  // Apply exclusion keywords (normalize diacritics for matching)
  if (intent.exclude?.length) {
    filtered = filtered.filter(p => {
      const title = stripDiacritics(p.t.toLowerCase());
      return !intent.exclude.some(ex => title.includes(ex));
    });
  }

  if (intent.maxPrice) {
    filtered = filtered.filter(p => p.p <= intent.maxPrice && p.p > 0);
  }

  intent.totalFiltered = filtered.length;

  if (filtered.length === 0) {
    emptyCount++;
    writeFileSync(join(SEARCH_DIR, `${intent.slug}.json`), '[]');
    continue;
  }

  // Get products with images for display
  const withImages = filtered.filter(p => p.i && p.t && p.l);

  // Sort by keyword relevance (title matches weighted heavily)
  if (intent.keywords?.length && withImages.length > 0) {
    const kws = intent.keywords;
    withImages.sort((a, b) => {
      const aT = a.t.toLowerCase(), bT = b.t.toLowerCase();
      // Score: 2 points per keyword in title, 1 per keyword in category
      const aC = (a.c || '').toLowerCase();
      const bC = (b.c || '').toLowerCase();
      const aScore = kws.reduce((s, k) => s + (aT.includes(k) ? 2 : 0) + (aC.includes(k) ? 1 : 0), 0);
      const bScore = kws.reduce((s, k) => s + (bT.includes(k) ? 2 : 0) + (bC.includes(k) ? 1 : 0), 0);
      if (bScore !== aScore) return bScore - aScore;
      // Tie-break: prefer items with discount
      const aDisc = a.op > 0 ? 1 : 0;
      const bDisc = b.op > 0 ? 1 : 0;
      return bDisc - aDisc;
    });
  }

  const display = withImages.slice(0, 200);
  const compact = display.map(p => ({ t: p.t, p: p.p, op: p.op, b: p.b, m: p.m, i: p.i, l: p.l }));
  writeFileSync(join(SEARCH_DIR, `${intent.slug}.json`), JSON.stringify(compact));
}

console.log(`  Pre-computed ${total} pages (${emptyCount} empty)`);

// Remove empty intents
const validIntents = intents.filter(i => i.totalFiltered > 0);
console.log(`  Valid intents (with products): ${validIntents.length}`);

// ========================================================================
//  SAVE OUTPUT
// ========================================================================
const output = {
  intents: validIntents.map(i => ({
    slug: i.slug,
    title: stripDiacritics(i.title),
    megaCategory: i.megaCategory,
    productCount: i.totalFiltered,
    type: i.type,
  })),
  generated: new Date().toISOString(),
  totalIntents: validIntents.length,
  byType: {},
};

for (const i of validIntents) {
  output.byType[i.type] = (output.byType[i.type] || 0) + 1;
}

writeFileSync(join(DATA_DIR, 'search-intents.json'), JSON.stringify(output, null, 2));

console.log(`\n========================================`);
console.log(`  TOTAL INTENTS: ${validIntents.length}`);
console.log(`========================================`);
for (const [type, count] of Object.entries(output.byType).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${type}: ${count}`);
}
console.log(`\nSaved to: public/data/search-intents.json`);
console.log(`Product pages: public/data/search-pages/ (${validIntents.length} files)`);
