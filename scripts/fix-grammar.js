import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const SEARCH_DIR = join(DATA_DIR, 'search-pages');
const CONTENT_PATH = join(DATA_DIR, 'content', 'seo-content.json');

function slugify(text) {
  const map = { 'ă':'a','â':'a','î':'i','ș':'s','ş':'s','ț':'t','ţ':'t','Ă':'A','Â':'A','Î':'I','Ș':'S','Ş':'S','Ț':'T','Ţ':'T','ä':'a','ö':'o','ü':'u','é':'e' };
  let r = text;
  for (const [f, t] of Object.entries(map)) r = r.split(f).join(t);
  return r.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 80);
}

// Singular -> Plural dictionary for Romanian product names
const SINGULAR_TO_PLURAL = {
  'laptop': 'laptopuri',
  'telefon': 'telefoane',
  'televizor': 'televizoare',
  'monitor': 'monitoare',
  'tableta': 'tablete',
  'tastatura': 'tastaturi',
  'imprimanta': 'imprimante',
  'camera': 'camere',
  'consola': 'console',
  'drona': 'drone',
  'boxa': 'boxe',
  'casca': 'casti',
  'smartwatch': 'smartwatch-uri',
  'mouse': 'mouse-uri',
  'router': 'routere',
  'procesor': 'procesoare',
  'aspirator': 'aspiratoare',
  'frigider': 'frigidere',
  'cuptor': 'cuptoare',
  'fierbator': 'fierbatoare',
  'espressor': 'espressoare',
  'generator': 'generatoare',
  'boiler': 'boilere',
  'canapea': 'canapele',
  'saltea': 'saltele',
  'perna': 'perne',
  'covor': 'covoare',
  'dulap': 'dulapuri',
  'birou': 'birouri',
  'pat': 'paturi',
  'scaun': 'scaune',
  'masa': 'mese',
  'lampa': 'lampi',
  'perdea': 'perdele',
  'geaca': 'geci',
  'rochie': 'rochii',
  'camasa': 'camasi',
  'fusta': 'fuste',
  'pantalon': 'pantaloni',
  'tricou': 'tricouri',
  'geanta': 'genti',
  'valiza': 'valize',
  'rucsac': 'rucsacuri',
  'ceas': 'ceasuri',
  'portofel': 'portofele',
  'inel': 'inele',
  'bratara': 'bratari',
  'lantisor': 'lantisoare',
  'cercei': 'cercei',
  'carucior': 'carucioare',
  'bicicleta': 'biciclete',
  'tricicleta': 'triciclete',
  'trotineta': 'trotinete',
  'jucarie': 'jucarii',
  'masinuta': 'masinute',
  'lanseta': 'lansete',
  'mulineta': 'mulinete',
  'parfum': 'parfumuri',
  'crema': 'creme',
  'sampon': 'sampoane',
  'epilator': 'epilatoare',
  'periuta': 'periute',
  'tensiometru': 'tensiometre',
  'vitamina': 'vitamine',
  'carte': 'carti',
  'roman': 'romane',
  'anvelopa': 'anvelope',
  'janta': 'jante',
  'baterie': 'baterii',
  'filtru': 'filtre',
  'amortizor': 'amortizoare',
  'cort': 'corturi',
  'gantere': 'gantere',
  'minge': 'mingi',
  'racheta': 'rachete',
  'cafea': 'cafele',
  'vin': 'vinuri',
  'ceai': 'ceaiuri',
  'drujba': 'drujbe',
  'motocoasa': 'motocoase',
  'motosapa': 'motosape',
  'pompa': 'pompe',
  'compresor': 'compresoare',
  'bormasina': 'bormasini',
  'fierastrau': 'fierastraie',
  'carcasa': 'carcase',
  'husa': 'huse',
  'folie': 'folii',
  'cablu': 'cabluri',
  'xbox': 'console xbox',
  'masina de spalat': 'masini de spalat',
  'combina frigorifica': 'combine frigorifice',
  'camera supraveghere': 'camere supraveghere',
  'camera auto': 'camere auto',
  'camera foto': 'camere foto',
  'camera video': 'camere video',
  'scaun auto': 'scaune auto',
  'scaun birou': 'scaune birou',
  'scaun gaming': 'scaune gaming',
  'placa video': 'placi video',
  'band alergare': 'benzi alergare',
  'carcasa pc': 'carcase pc',
};

// Gender mapping for adjective agreement
// m = masculine, f = feminine, n = neuter
const NOUN_GENDER = {
  'laptopuri': 'n', 'telefoane': 'n', 'televizoare': 'n', 'monitoare': 'n',
  'tablete': 'f', 'tastaturi': 'f', 'imprimante': 'f', 'camere': 'f',
  'console': 'f', 'drone': 'f', 'casti': 'f', 'boxe': 'f',
  'aspiratoare': 'n', 'frigidere': 'n', 'cuptoare': 'n',
  'canapele': 'f', 'saltele': 'f', 'scaune': 'n', 'paturi': 'n',
  'geci': 'f', 'rochii': 'f', 'genti': 'f', 'valize': 'f',
  'ceasuri': 'n', 'parfumuri': 'n', 'creme': 'f',
  'carucioare': 'n', 'biciclete': 'f', 'trotinete': 'f',
  'jucarii': 'f', 'anvelope': 'f', 'jante': 'f',
  'carti': 'f', 'corturi': 'n',
  'masini de spalat': 'f', 'camere supraveghere': 'f',
  'scaune auto': 'n', 'scaune birou': 'n', 'placi video': 'f',
};

// Adjective forms: ieftin
// m.pl: ieftini, f.pl: ieftine, n.pl: ieftine
// "bun": m.pl: buni, f.pl: bune, n.pl: bune

function fixTitle(title) {
  let t = title;

  // Fix "cele mai bune [singular]" -> "cele mai bune [plural]"
  for (const [sing, plur] of Object.entries(SINGULAR_TO_PLURAL)) {
    const singPattern = new RegExp(`(cele mai bune|cele mai buni) ${sing}\\b`, 'gi');
    if (singPattern.test(t)) {
      const gender = NOUN_GENDER[plur] || 'n';
      const adj = (gender === 'm') ? 'buni' : 'bune';
      t = t.replace(singPattern, `Cele mai ${adj} ${plur}`);
    }

    // Fix "cel mai bun [plural]" -> "cele mai bune [plural]"
    const celPattern = new RegExp(`cel mai bun ${plur}\\b`, 'gi');
    if (celPattern.test(t)) {
      const gender = NOUN_GENDER[plur] || 'n';
      const adj = (gender === 'm') ? 'buni' : 'bune';
      t = t.replace(celPattern, `Cele mai ${adj} ${plur}`);
    }

    // Fix "[singular] ieftine" -> "[plural] ieftine"
    const ieftinePattern = new RegExp(`\\b${sing} ieftine\\b`, 'gi');
    if (ieftinePattern.test(t)) {
      t = t.replace(ieftinePattern, `${plur.charAt(0).toUpperCase() + plur.slice(1)} ieftine`);
    }

    // Fix "[singular] ieftin" -> "[plural] ieftine" or keep singular form correct
    const ieftinPattern = new RegExp(`\\b${sing} ieftin\\b`, 'gi');
    if (ieftinPattern.test(t)) {
      // Keep as singular: "laptop ieftin" is OK
      // But capitalize properly
    }
  }

  // Fix "top [singular]" -> "Top [plural]"
  for (const [sing, plur] of Object.entries(SINGULAR_TO_PLURAL)) {
    const topPattern = new RegExp(`^top ${sing}$`, 'i');
    if (topPattern.test(t.trim())) {
      t = `Top ${plur}`;
    }
  }

  // Capitalize first letter
  t = t.charAt(0).toUpperCase() + t.slice(1);

  return t;
}

// ========== PROCESS ==========
const data = JSON.parse(readFileSync(join(DATA_DIR, 'google-suggestions.json'), 'utf-8'));
const content = JSON.parse(readFileSync(CONTENT_PATH, 'utf-8'));

let fixed = 0, renamed = 0;

for (const s of data.suggestions) {
  const oldTitle = s.title;
  const newTitle = fixTitle(s.title);

  if (newTitle !== oldTitle) {
    const oldSlug = s.slug;
    const newSlug = slugify(newTitle);

    s.title = newTitle;

    // Update slug if changed
    if (newSlug !== oldSlug && newSlug.length > 3) {
      s.slug = newSlug;

      // Rename search page JSON
      const oldPath = join(SEARCH_DIR, `${oldSlug}.json`);
      const newPath = join(SEARCH_DIR, `${newSlug}.json`);
      if (existsSync(oldPath) && !existsSync(newPath)) {
        renameSync(oldPath, newPath);
        renamed++;
      }

      // Move content entry
      const oldKey = `search:${oldSlug}`;
      const newKey = `search:${newSlug}`;
      if (content[oldKey] && !content[newKey]) {
        content[newKey] = content[oldKey];
        content[newKey].h1 = newTitle;
        content[newKey].metaTitle = `${newTitle} - Recomandari ${new Date().getFullYear()} | TopBuy.ro`;
        delete content[oldKey];
      }
    } else if (content[`search:${s.slug}`]) {
      // Just update title in content
      content[`search:${s.slug}`].h1 = newTitle;
      content[`search:${s.slug}`].metaTitle = `${newTitle} - Recomandari ${new Date().getFullYear()} | TopBuy.ro`;
    }

    fixed++;
  }
}

// Deduplicate after slug changes
const seen = new Set();
data.suggestions = data.suggestions.filter(s => {
  if (seen.has(s.slug)) return false;
  seen.add(s.slug);
  return true;
});

writeFileSync(join(DATA_DIR, 'google-suggestions.json'), JSON.stringify(data, null, 2));
writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2));

console.log(`Fixed ${fixed} titles, renamed ${renamed} files`);
console.log(`Final: ${data.suggestions.length} intents`);

// Show some fixes
console.log('\nSample fixes:');
const samples = data.suggestions.filter(s => s.title !== fixTitle(s.title.toLowerCase())).slice(0, 5);
// Instead show some we know we fixed
for (const s of data.suggestions) {
  if (s.title.includes('Cele mai bune telefoane') || s.title.includes('Laptopuri ieftine') || s.title.includes('Top monitoare')) {
    console.log(`  ${s.title} (${s.slug})`);
  }
}
