import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA = join(ROOT, 'public', 'data');
const SEARCH = join(DATA, 'search-pages');
const CONTENT_PATH = join(DATA, 'content', 'seo-content.json');

function slugify(t) {
  const m = {'ă':'a','â':'a','î':'i','ș':'s','ş':'s','ț':'t','ţ':'t','Ă':'A','Â':'A','Î':'I','Ș':'S','Ş':'S','Ț':'T','Ţ':'T','ä':'a','ö':'o','ü':'u','é':'e'};
  let r = t; for (const [f,to] of Object.entries(m)) r = r.split(f).join(to);
  return r.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 80);
}

// Complete singular -> plural mapping
const S2P = {
  'laptop': 'laptopuri', 'telefon': 'telefoane', 'televizor': 'televizoare',
  'monitor': 'monitoare', 'tableta': 'tablete', 'tastatura': 'tastaturi',
  'imprimanta': 'imprimante', 'camera': 'camere', 'consola': 'console',
  'drona': 'drone', 'smartwatch': 'smartwatch-uri', 'mouse': 'mouse-uri',
  'router': 'routere', 'procesor': 'procesoare', 'soundbar': 'soundbar-uri',
  'aspirator': 'aspiratoare', 'frigider': 'frigidere', 'cuptor': 'cuptoare',
  'fierbator': 'fierbatoare', 'espressor': 'espressoare', 'generator': 'generatoare',
  'boiler': 'boilere', 'canapea': 'canapele', 'saltea': 'saltele',
  'covor': 'covoare', 'dulap': 'dulapuri', 'birou': 'birouri', 'pat': 'paturi',
  'scaun': 'scaune', 'masa': 'mese', 'lampa': 'lampi', 'perdea': 'perdele',
  'geaca': 'geci', 'rochie': 'rochii', 'camasa': 'camasi', 'fusta': 'fuste',
  'tricou': 'tricouri', 'pantalon': 'pantaloni', 'bluza': 'bluze',
  'geanta': 'genti', 'valiza': 'valize', 'rucsac': 'rucsacuri', 'troller': 'trollere',
  'ceas': 'ceasuri', 'portofel': 'portofele', 'curea': 'curele',
  'inel': 'inele', 'bratara': 'bratari', 'cercei': 'cercei',
  'carucior': 'carucioare', 'bicicleta': 'biciclete', 'tricicleta': 'triciclete',
  'trotineta': 'trotinete', 'jucarie': 'jucarii', 'masinuta': 'masinute',
  'lanseta': 'lansete', 'mulineta': 'mulinete', 'naluci': 'naluci',
  'parfum': 'parfumuri', 'crema': 'creme', 'sampon': 'sampoane',
  'epilator': 'epilatoare', 'periuta': 'periute', 'tensiometru': 'tensiometre',
  'carte': 'carti', 'roman': 'romane',
  'anvelopa': 'anvelope', 'janta': 'jante', 'baterie': 'baterii', 'filtru': 'filtre',
  'amortizor': 'amortizoare', 'cort': 'corturi', 'minge': 'mingi', 'racheta': 'rachete',
  'drujba': 'drujbe', 'motocoasa': 'motocoase', 'motosapa': 'motosape',
  'pompa': 'pompe', 'compresor': 'compresoare', 'bormasina': 'bormasini',
  'fierastrau': 'fierastraie', 'carcasa': 'carcase', 'husa': 'huse',
  'folie': 'folii', 'cablu': 'cabluri', 'acumulator': 'acumulatoare',
  'multicooker': 'multicookere', 'friteuza': 'friteuze',
  'perna': 'perne', 'pilota': 'pilote', 'lenjerie': 'lenjerii',
};

// Feminine nouns (for cel mai bun -> cea mai buna)
const FEMININE = new Set([
  'hrana','crema','saltea','canapea','geaca','rochie','camasa','fusta','bluza',
  'imprimanta','tastatura','camera','tableta','drujba','mulineta','lanseta',
  'friteuza','periuta','motocoasa','motosapa','pompa','bormasina',
  'cafea','bicicleta','trotineta','tricicleta','valiza','geanta',
  'masina','creatina','proteina','vitamina','casca','banda',
  'combina','centrala','curea','bratara','perna','pilota','lenjerie',
  'lampa','perdea','carte','racheta','minge',
]);

function isFeminine(word) {
  if (FEMININE.has(word)) return true;
  return false;
}

const data = JSON.parse(readFileSync(join(DATA, 'google-suggestions.json'), 'utf-8'));
const content = JSON.parse(readFileSync(CONTENT_PATH, 'utf-8'));
const year = new Date().getFullYear();
let fixed = 0;

for (const s of data.suggestions) {
  let t = s.title;
  let changed = false;

  // Work on lowercase for matching, preserve case structure
  const tl = t.toLowerCase();
  const words = tl.split(/\s+/);

  // For each known singular, check if it needs to be plural
  for (const [sing, plur] of Object.entries(S2P)) {
    const singIdx = words.indexOf(sing);
    if (singIdx === -1) continue;

    const before = words.slice(Math.max(0, singIdx - 4), singIdx).join(' ');
    const after = words[singIdx + 1] || '';
    const afterAfter = words[singIdx + 2] || '';

    let needsPlural = false;

    // "cele mai bune [singular]" -> plural
    if (before.includes('cele mai bune') || before.includes('cele mai buni')) needsPlural = true;
    // "top [singular]" -> plural
    if (before === 'top' || before.endsWith(' top')) needsPlural = true;
    // "[singular] ieftine" -> plural
    if (after === 'ieftine' || after === 'ieftina') needsPlural = true;
    // "[singular] pareri" -> plural
    if (after === 'pareri') needsPlural = true;
    // "[singular] recomandari" -> plural
    if (after === 'recomandari') needsPlural = true;
    // "[singular] sub [number]" -> plural
    if (after === 'sub') needsPlural = true;
    // "[singular] [something] ieftine" -> plural
    if (afterAfter === 'ieftine' || afterAfter === 'ieftina' || afterAfter === 'pareri') needsPlural = true;
    // "[singular] copii ieftine" etc
    if (after === 'copii' || after === 'barbati' || after === 'dama' || after === 'femei') {
      const after3 = words[singIdx + 2] || '';
      if (after3 === 'ieftine' || after3 === 'ieftina' || after3 === 'pareri' || after3 === 'recomandari') needsPlural = true;
    }

    if (needsPlural) {
      // Replace singular with plural in the title (case-insensitive, preserve position)
      const regex = new RegExp(`\\b${sing}\\b`, 'gi');
      t = t.replace(regex, (match) => {
        // Preserve capitalization
        if (match[0] === match[0].toUpperCase()) return plur.charAt(0).toUpperCase() + plur.slice(1);
        return plur;
      });
      changed = true;
    }
  }

  // Fix "cel mai bun [feminine]" -> "cea mai buna [feminine]"
  const celMatch = t.toLowerCase().match(/^cel mai bun (\w+)/);
  if (celMatch && isFeminine(celMatch[1])) {
    t = t.replace(/^[Cc]el mai bun /i, 'Cea mai buna ');
    changed = true;
  }

  // Fix double words
  t = t.replace(/^(\w+) \1 /i, '$1 ');
  if (t !== s.title) changed = true;

  // Capitalize
  t = t.charAt(0).toUpperCase() + t.slice(1);

  if (changed && t !== s.title) {
    const oldSlug = s.slug;
    const newSlug = slugify(t);

    console.log(`  "${s.title}" -> "${t}"`);

    s.title = t;

    if (newSlug !== oldSlug && newSlug.length > 3) {
      const oldPath = join(SEARCH, `${oldSlug}.json`);
      const newPath = join(SEARCH, `${newSlug}.json`);
      if (existsSync(oldPath) && !existsSync(newPath)) {
        renameSync(oldPath, newPath);
      }
      const oldKey = `search:${oldSlug}`;
      const newKey = `search:${newSlug}`;
      if (content[oldKey] && !content[newKey]) {
        content[newKey] = content[oldKey];
        delete content[oldKey];
      }
      s.slug = newSlug;
    }

    const key = `search:${s.slug}`;
    if (content[key]) {
      content[key].h1 = t;
      content[key].metaTitle = `${t} - Recomandari ${year} | TopBuy.ro`;
    }

    fixed++;
  }
}

// Dedup by slug
const seen = new Set();
data.suggestions = data.suggestions.filter(s => {
  if (seen.has(s.slug)) return false;
  seen.add(s.slug);
  return true;
});

writeFileSync(join(DATA, 'google-suggestions.json'), JSON.stringify(data, null, 2));
writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2));

console.log(`\nFixed ${fixed} titles. Final: ${data.suggestions.length} intents`);
