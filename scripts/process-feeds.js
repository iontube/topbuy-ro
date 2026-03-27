import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RAW_DIR = join(ROOT, 'raw-feeds');
const DATA_DIR = join(ROOT, 'public', 'data');
const PRODUCTS_DIR = join(DATA_DIR, 'products');
const CATEGORIES_DIR = join(DATA_DIR, 'categories');

// Clean old data
rmSync(PRODUCTS_DIR, { recursive: true, force: true });
rmSync(CATEGORIES_DIR, { recursive: true, force: true });
mkdirSync(PRODUCTS_DIR, { recursive: true });
mkdirSync(CATEGORIES_DIR, { recursive: true });

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
  return result
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

function cleanHtml(desc) {
  if (!desc) return '';
  return desc
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function shortDesc(desc, maxLen = 200) {
  const clean = cleanHtml(desc);
  if (clean.length <= maxLen) return clean;
  return clean.substring(0, maxLen).replace(/\s\S*$/, '') + '...';
}

// ========== MERCHANT -> MEGA CATEGORY MAP (PRIMARY CLASSIFICATION) ==========
// 96 merchants from 2Performant feeds. null = multi-category, falls through to keyword scoring.
const MERCHANT_MAP = {
  // ── Electronice & IT ──
  'evomag.ro': 'electronice-it',
  'flanco.ro': 'electronice-it',
  'bestvalue.eu': 'electronice-it',
  'bitmi.ro': 'electronice-it',
  'flip.ro': 'electronice-it',
  'ihunt.ro': 'electronice-it',
  'soundhouse.ro': 'electronice-it',
  'spy-shop.ro': 'electronice-it',
  'techstar.ro': 'electronice-it',

  // ── Casa & Gradina ──
  'aosom.ro': 'casa-gradina',
  'aqualine.ro': 'casa-gradina',
  'fornello.ro': 'casa-gradina',
  'inpuff.ro': 'casa-gradina',
  'mobilalaguna.ro': 'casa-gradina',
  'pefoc.ro': 'casa-gradina',
  'scule365.ro': 'casa-gradina',
  'sofiline.ro': 'casa-gradina',
  'xxxlutz.ro': 'casa-gradina',
  'agroland.ro': 'casa-gradina',

  // ── Fashion ──
  'answear.ro': 'fashion',
  'benvenuti.com/ro': 'fashion',
  'dyfashion.ro': 'fashion',
  'edenboutique.ro': 'fashion',
  'eyerim.ro': 'fashion',
  'gryxx.ro': 'fashion',
  'intimax.ro': 'fashion',
  'otter.ro': 'fashion',
  'pandera.ro': 'fashion',
  'picadili.ro': 'fashion',
  'priveboutique.net': 'fashion',
  'shopika.ro': 'fashion',
  'teilor.ro': 'fashion',
  'tezyo.ro': 'fashion',
  'various-brands.ro': 'fashion',

  // ── Auto & Moto ──
  'automobilus.ro': 'auto-moto',
  'anvelope-autobon.ro': 'auto-moto',
  'cauciucuridirect.ro': 'auto-moto',
  'pieseautoscan.ro': 'auto-moto',
  'a2t.ro': 'auto-moto',
  'mxenduro.ro': 'auto-moto',

  // ── Sport & Pescuit ──
  'claumarpescar.ro': 'pescuit',
  'decathlon.ro': 'sport',
  'sportdepot.ro': 'sport',
  'sportmaniac.ro': 'sport',
  'piese-biciclete.eu': 'sport',
  '4fstore.ro': 'sport',

  // ── Sanatate & Frumusete ──
  'notino.ro': 'sanatate-frumusete',
  'drmax.ro': 'sanatate-frumusete',
  'esteto.ro': 'sanatate-frumusete',
  'farmaciilenapofarm.ro': 'sanatate-frumusete',
  'fragranza.ro': 'sanatate-frumusete',
  'greeno.ro': 'sanatate-frumusete',
  'herbagetica.ro': 'sanatate-frumusete',
  'kitunghii.ro': 'sanatate-frumusete',
  'luxurybeauty.ro': 'sanatate-frumusete',
  'makeupshop.ro': 'sanatate-frumusete',
  'minuneanaturii.ro': 'sanatate-frumusete',
  'nailshop.ro': 'sanatate-frumusete',
  'pensulemachiaj.ro': 'sanatate-frumusete',
  'pfarma.ro': 'sanatate-frumusete',
  'sabon.ro': 'sanatate-frumusete',
  'scentoparfum.ro': 'sanatate-frumusete',
  'springfarma.com': 'sanatate-frumusete',
  'vegis.ro': 'sanatate-frumusete',
  'aronia-charlottenburg.ro': 'sanatate-frumusete',

  // ── Carti & Birou ──
  'carturesti.ro': 'carti-birou',
  'libhumanitas.ro': 'carti-birou',
  'librex.ro': 'carti-birou',
  'libris.ro': 'carti-birou',
  'litera.ro': 'carti-birou',
  'dacris.net': 'carti-birou',
  'megadepot.ro': 'carti-birou',

  // ── Copii & Jucarii ──
  'babyneeds.ro': 'copii-jucarii',
  'jocurinoi.ro': 'copii-jucarii',
  'kinderauto.ro': 'copii-jucarii',
  'nichiduta.ro': 'copii-jucarii',
  'noriel.ro': 'copii-jucarii',

  // ── Animale de Companie ──
  'animax.ro': 'animale',
  'happypets.ro': 'animale',
  'maxi-pet.ro': 'animale',
  'nevertebrate.ro': 'animale',
  'pentruanimale.ro': 'animale',
  'petmart.ro': 'animale',
  'petmax.ro': 'animale',

  // ── Alimentare & Bauturi ──
  'apiland.ro': 'alimentare-bauturi',
  'espressocafe.ro': 'alimentare-bauturi',
  'fermier.ro': 'alimentare-bauturi',
  'manukashop.ro': 'alimentare-bauturi',

  // ── Multi-category (fall through to keyword scoring) ──
  'bazarulonline.ro': null,
  'elefant.ro': null,
  'robazar.ro': null,
  'ookee.ro': null,
  'gave.ro': null,
  'cumparamisim.ro': null,
  'micul-meserias.ro': null,
  'magazintraditional.ro': null,
};

// ========== EXPLICIT RAW CATEGORY OVERRIDES ==========
// For multi-category merchants: raw category name (lowercased) -> mega slug
const CATEGORY_OVERRIDES = {
  // Phone accessories -> electronice-it
  'huse telefoane': 'electronice-it',
  'folii protectie telefoane': 'electronice-it',
  'huse tablete': 'electronice-it',
  'accesorii telefoane mobile': 'electronice-it',
  'cabluri de date': 'electronice-it',
  'incarcator laptop': 'electronice-it',
  'incarcatoare': 'electronice-it',
  'tastaturi laptop': 'electronice-it',
  'tastaturi pc': 'electronice-it',
  'baterii si acumulatori laptop': 'electronice-it',
  'pachete de difuzoare dedicate': 'electronice-it',
  'monitoare led': 'electronice-it',
  'mouse pc / gaming': 'electronice-it',
  'casti bluetooth, wireless, airpods si audio': 'electronice-it',
  'casti - microfoane': 'electronice-it',
  'laptopuri si notebook': 'electronice-it',
  'laptopuri / notebook': 'electronice-it',
  'calculatoare refurbished': 'electronice-it',
  'navigatii': 'electronice-it',
  'tonere': 'electronice-it',
  'cartuse': 'electronice-it',
  'cartuse & tonere': 'electronice-it',
  'carcase': 'electronice-it',
  'televizoare': 'electronice-it',
  'telefoane': 'electronice-it',
  'mobile phones': 'electronice-it',
  'tablete': 'electronice-it',
  'periferice': 'electronice-it',
  'accesorii monitoare': 'electronice-it',
  'solid-state drive (ssd)': 'electronice-it',
  'switch-uri': 'electronice-it',
  'diverse retea': 'electronice-it',
  'placi de baza': 'electronice-it',
  'coolere cpu': 'electronice-it',
  'memorii': 'electronice-it',
  'prelungitoare & prize': 'electronice-it',
  'routere wireless': 'electronice-it',
  'acumulatori externi': 'electronice-it',
  'cabluri hdmi': 'electronice-it',
  'cabluri audio-video': 'electronice-it',
  'cabluri': 'electronice-it',
  'hub usb': 'electronice-it',
  'stick usb': 'electronice-it',
  'carduri memorie': 'electronice-it',
  'mouse pad': 'electronice-it',
  'mouse': 'electronice-it',
  'ups': 'electronice-it',
  'surse de alimentare pc': 'electronice-it',
  'ventilatoare': 'electronice-it',
  'camere supraveghere video pentru exterior': 'electronice-it',
  'suporturi tv': 'electronice-it',
  'suport auto pentru telefon, universal sau popsocket': 'electronice-it',
  'boxe portabile cu bluetooth': 'electronice-it',
  'electronice': 'electronice-it',
  'accesorii si componente aspiratoare': 'electronice-it',
  'smartwatch': 'electronice-it',
  'curea smartwatch': 'electronice-it',
  'acumulatori foto': 'electronice-it',
  'multifunctionale': 'electronice-it',
  'car audio': 'electronice-it',
  'piese trotinete electrice': 'electronice-it',
  // Children -> copii-jucarii
  'camera copilului': 'copii-jucarii',
  'scaune auto copii': 'copii-jucarii',
  'scaune auto copii si inaltatoare': 'copii-jucarii',
  'carucioare copii': 'copii-jucarii',
  'la plimbare': 'copii-jucarii',
  'jucarii de exterior': 'copii-jucarii',
  'jucarii de plus': 'copii-jucarii',
  'jucarii': 'copii-jucarii',
  'jocuri educative': 'copii-jucarii',
  'jocuri de constructii': 'copii-jucarii',
  'figurine': 'copii-jucarii',
  'papusi': 'copii-jucarii',
  'masinute': 'copii-jucarii',
  'puzzle': 'copii-jucarii',
  'carti pentru copii': 'copii-jucarii',
  'articole hranire bebelusi': 'copii-jucarii',
  'suzete': 'copii-jucarii',
  'igiena si ingrijire': 'copii-jucarii',
  'alimentatie': 'copii-jucarii',
  'produse noi': null,
  'accesorii': null,
  'alte accesorii': null,
  'reduceri finale': null,
  'branduri': null,
  'lifestyle': null,
  // Fashion
  'imbracaminte': 'fashion',
  'incaltaminte': 'fashion',
  'imbracaminte, incaltaminte, accesorii > imbracaminte': 'fashion',
  'imbracaminte, incaltaminte, accesorii > incaltaminte': 'fashion',
  'imbracaminte, incaltaminte, accesorii > accesorii': 'fashion',
  'accesorii dama': 'fashion',
  'rochii': 'fashion',
  'bagajerie': 'fashion',
  'femei': 'fashion',
  'femei > ghete': 'fashion',
  'femei, genti si posete': 'fashion',
  'barbati > pantofi sport': 'fashion',
  'bijuterii': 'fashion',
  'baieti': 'fashion',
  'fete': 'fashion',
  // Auto
  'anvelope de vara': 'auto-moto',
  'anvelope de iarna': 'auto-moto',
  'anvelope all season': 'auto-moto',
  'anvelope moto': 'auto-moto',
  'anvelope camioane': 'auto-moto',
  'anvelope & camera': 'auto-moto',
  'piese de schimb': 'auto-moto',
  'suspensie cadru': 'auto-moto',
  'frana': 'auto-moto',
  'motor': 'auto-moto',
  'transmisie': 'auto-moto',
  'filtre': 'auto-moto',
  'electrica & lumini': 'auto-moto',
  'auto - moto': 'auto-moto',
  // Sport & Pescuit
  'pescuit la rapitor': 'pescuit',
  'pescuit la stationar': 'pescuit',
  'pescuit la crap': 'pescuit',
  'pescuit la feeder': 'pescuit',
  'pescuit la somn': 'pescuit',
  'pescuit la musca': 'pescuit',
  'nade si momeli': 'pescuit',
  'componente lansete si mulinete': 'pescuit',
  'suporturi si rod pod-uri': 'pescuit',
  'vanatoare si airsoft': 'pescuit',
  'camping': 'sport',
  'drumetii de o zi': 'sport',
  'fitness cardio': 'sport',
  'natatie': 'sport',
  'biciclete': 'sport',
  'piese biciclete si accesorii': 'sport',
  // Casa & Gradina
  'paturi tapitate': 'casa-gradina',
  'living si dormitor': 'casa-gradina',
  'pompe apa': 'casa-gradina',
  'agricultura si gradinarit': 'casa-gradina',
  'utile in bucatarie': 'casa-gradina',
  'bucatarie': 'casa-gradina',
  'bucatarie si bar': 'casa-gradina',
  'ventilatie, climatizare': 'casa-gradina',
  'trusa chei & unelte': 'casa-gradina',
  'unelte de gradina': 'casa-gradina',
  'scule': 'casa-gradina',
  'scule si unelte': 'casa-gradina',
  'sisteme de irigare': 'casa-gradina',
  'utilaje constructii': 'casa-gradina',
  'plite incorporabile': 'casa-gradina',
  'cuptoare incorporabile': 'casa-gradina',
  'aragazuri': 'casa-gradina',
  'fierbatoare apa': 'casa-gradina',
  'mixere': 'casa-gradina',
  'aparate profesionale bucatarie': 'casa-gradina',
  'masini de spalat rufe': 'casa-gradina',
  'utilaje uz casnic': 'casa-gradina',
  'combine frigorifice': 'casa-gradina',
  'aparate de aer conditionat': 'casa-gradina',
  'iluminat interior': 'casa-gradina',
  'iluminat': 'casa-gradina',
  'casa': 'casa-gradina',
  'instalatii hidro si termice': 'casa-gradina',
  'vase pentru bucatarie': 'casa-gradina',
  'pompe': 'casa-gradina',
  'mobila si decoratiuni > mobila bucatarie > dulapuri de bucatarie': 'casa-gradina',
  // Sanatate & Frumusete
  'ingrijire personala': 'sanatate-frumusete',
  'parfumuri': 'sanatate-frumusete',
  'parfumuri barbati': 'sanatate-frumusete',
  'parfumuri dama': 'sanatate-frumusete',
  'parfumuri unisex': 'sanatate-frumusete',
  'cosmetice': 'sanatate-frumusete',
  'cosmetice fata': 'sanatate-frumusete',
  'cosmetice ochi': 'sanatate-frumusete',
  'cosmetice buze': 'sanatate-frumusete',
  'ingrijire corp': 'sanatate-frumusete',
  'ingrijire par': 'sanatate-frumusete',
  'ingrijire fata': 'sanatate-frumusete',
  'igiena orala': 'sanatate-frumusete',
  'protectie solara': 'sanatate-frumusete',
  'dermatocosmetice': 'sanatate-frumusete',
  'medicamente': 'sanatate-frumusete',
  'vitamine si minerale': 'sanatate-frumusete',
  'suplimente alimentare': 'sanatate-frumusete',
  // Fashion (common multi-cat merchant categories)
  'dama': 'fashion',
  'barbati': 'fashion',
  'femei > pantofi': 'fashion',
  'femei > sandale': 'fashion',
  'femei > cizme': 'fashion',
  'barbati > ghete': 'fashion',
  'barbati > pantofi': 'fashion',
  'barbati > adidasi': 'fashion',
  'genti': 'fashion',
  'genti dama': 'fashion',
  'ceasuri': 'fashion',
  'ceasuri barbati': 'fashion',
  'ceasuri dama': 'fashion',
  'ochelari': 'fashion',
  'ochelari de soare': 'fashion',
  'palarii si sepci': 'fashion',
  'curele': 'fashion',
  'esarfe si fulare': 'fashion',
  // Auto
  'bare transversale': 'auto-moto',
  'portbagaje auto': 'auto-moto',
  'accesorii auto': 'auto-moto',
  'suporturi biciclete': 'auto-moto',
  'huse auto': 'auto-moto',
  'covorase auto': 'auto-moto',
  'ulei motor': 'auto-moto',
  'lichid de frana': 'auto-moto',
  'antigel': 'auto-moto',
  // Alimentare
  'dulciuri': 'alimentare-bauturi',
  'ciocolata': 'alimentare-bauturi',
  'cafea': 'alimentare-bauturi',
  'ceaiuri': 'alimentare-bauturi',
  'condimente': 'alimentare-bauturi',
  'conserve': 'alimentare-bauturi',
  'alimente': 'alimentare-bauturi',
  'alimente bio': 'alimentare-bauturi',
  'miere': 'alimentare-bauturi',
  'sucuri': 'alimentare-bauturi',
  'apa minerala': 'alimentare-bauturi',
  'vinuri': 'alimentare-bauturi',
  'bauturi alcoolice': 'alimentare-bauturi',
  'bauturi spirtoase': 'alimentare-bauturi',
  // Animale
  'pentru animale - transport pentru animale - carucioare': 'animale',
  'hrana caini': 'animale',
  'hrana pisici': 'animale',
  'accesorii caini': 'animale',
  'accesorii pisici': 'animale',
  'accesorii acvariu': 'animale',
  // Copii
  'articole pentru copii': 'copii-jucarii',
  'jocuri si jucarii': 'copii-jucarii',
  'jocuri de societate': 'copii-jucarii',
  'jocuri video': 'copii-jucarii',
  'jocuri pentru copii': 'copii-jucarii',
  'rechizite scolare': 'copii-jucarii',
  'nintendo switch': 'copii-jucarii',
  'ps4': 'copii-jucarii',
  'ps5': 'copii-jucarii',
  'pc digital': 'copii-jucarii',
  'figurine jocuri': 'copii-jucarii',
  'studiouri de creatie': 'copii-jucarii',
  'playmobil': 'copii-jucarii',
  'plusuri simple': 'copii-jucarii',
  'carnaval': 'copii-jucarii',
  'desen si pictura': 'copii-jucarii',
  // Casa & Gradina
  'mobilier': 'casa-gradina',
  'decoratiuni': 'casa-gradina',
  'textile casa': 'casa-gradina',
  'menaj': 'casa-gradina',
  'detergenti': 'casa-gradina',
  'articole menaj': 'casa-gradina',
  'gradinarit': 'casa-gradina',
  'seminturi si bulbi': 'casa-gradina',
  'instalatii sanitare': 'casa-gradina',
  'feronerie': 'casa-gradina',
  'materiale constructii': 'casa-gradina',
  'electrice si automatizari': 'casa-gradina',
  'pesticide': 'casa-gradina',
  'material saditor': 'casa-gradina',
  'ingrasaminte': 'casa-gradina',
  'vinificatie primara': 'casa-gradina',
  'filtrare': 'casa-gradina',
  'imbuteliere la sticla': 'casa-gradina',
  'huse cu elastic': 'casa-gradina',
  'lenjerii de pat': 'casa-gradina',
  'paturi cocolino': 'casa-gradina',
  'pilote si perne': 'casa-gradina',
  'cuverturi si paturi': 'casa-gradina',
  'prosoape': 'casa-gradina',
  'perdele si draperii': 'casa-gradina',
  'decoratiuni geam si perete': 'casa-gradina',
  'echipamente protectia muncii': 'casa-gradina',
  // Sport
  'imbracaminte sport': 'sport',
  'echipament sportiv': 'sport',
  'incaltaminte sport': 'sport',
  'articole sportive': 'sport',
  // Carti & Birou
  'carti': 'carti-birou',
  'carti pentru adulti': 'carti-birou',
  'carti pentru copii': 'carti-birou',
  'carti copii': 'carti-birou',
  'beletristica': 'carti-birou',
  'literatura': 'carti-birou',
  'literatura straina': 'carti-birou',
  'literatura pentru copii': 'carti-birou',
  'literatura romana': 'carti-birou',
  'benzi desenate': 'carti-birou',
  'fictiune': 'carti-birou',
  'carte straina': 'carti-birou',
  'ebooks': 'carti-birou',
  'manga': 'carti-birou',
  'povesti': 'carti-birou',
  'stiinte umaniste': 'carti-birou',
  'istorie': 'carti-birou',
  'istorie & politologie': 'carti-birou',
  'filosofie': 'carti-birou',
  'religie': 'carti-birou',
  'spiritualitate': 'carti-birou',
  'spiritualitate & ezoterism': 'carti-birou',
  'biografii': 'carti-birou',
  'biografii, memorii, jurnale': 'carti-birou',
  'manuale & auxiliare scolare': 'carti-birou',
  'manuale scolare': 'carti-birou',
  'auxiliare scolare': 'carti-birou',
  'enciclopedii': 'carti-birou',
  'dictionare': 'carti-birou',
  'psihologie': 'carti-birou',
  'dezvoltare personala': 'carti-birou',
  'stiinte exacte': 'carti-birou',
  'drept': 'carti-birou',
  'economie': 'carti-birou',
  'medicina': 'carti-birou',
  'arta si arhitectura': 'carti-birou',
  'muzica': 'carti-birou',
  'turism si calatorii': 'carti-birou',
  'practic & util & hobby': 'carti-birou',
  'it-c': 'carti-birou',
  'produse promotionale': 'carti-birou',
  // Fashion extras
  'talismane din argint (toate)': 'fashion',
  'cercei din argint': 'fashion',
  'inele din argint': 'fashion',
  'bratari din argint': 'fashion',
  'coliere din argint': 'fashion',
  'rings': 'fashion',
  'earrings': 'fashion',
  'necklaces': 'fashion',
  'bracelets': 'fashion',
  'glasses': 'fashion',
  'sunglasses': 'fashion',
  // Sanatate
  'dieta si nutritie': 'sanatate-frumusete',
  'frumusete si ingrijire': 'sanatate-frumusete',
  'ingrijirea pielii': 'sanatate-frumusete',
  'makeup': 'sanatate-frumusete',
  'remedii': 'sanatate-frumusete',
  // Alimentare
  'alimentare': 'alimentare-bauturi',
  'mama si copilul': 'copii-jucarii',
  // Book categories from unexpected merchants
  'limbi straine': 'carti-birou',
  'limbi straine > engleza': 'carti-birou',
  'limbi straine > franceza': 'carti-birou',
  'limbi straine > germana': 'carti-birou',
  'poezie': 'carti-birou',
  'teatru': 'carti-birou',
  'eseistica': 'carti-birou',
  'critica literara': 'carti-birou',
  'sociologie': 'carti-birou',
  'politica': 'carti-birou',
  'geografie': 'carti-birou',
  'astronomie': 'carti-birou',
};

// Word-start keyword match (avoids "ruj" matching inside "drujba")
// Only checks left boundary — allows prefix/stem matching (parfum -> parfumuri)
function wordMatch(text, keyword) {
  // For multi-word phrases, simple includes is fine (low false-positive risk)
  if (keyword.includes(' ')) return text.includes(keyword);
  // For single words, require word boundary on the LEFT side only
  const idx = text.indexOf(keyword);
  if (idx === -1) return false;
  if (idx === 0) return true;
  const before = text[idx - 1];
  return !/[a-z0-9]/.test(before);
}

// Normalize for lookup: strip diacritics + lowercase
function normCat(cat) {
  const dmap = {
    'ă': 'a', 'â': 'a', 'î': 'i', 'ș': 's', 'ş': 's', 'ț': 't', 'ţ': 't',
    'Ă': 'a', 'Â': 'a', 'Î': 'i', 'Ș': 's', 'Ş': 's', 'Ț': 't', 'Ţ': 't',
    'ä': 'a', 'ö': 'o', 'ü': 'u', 'é': 'e', 'è': 'e', 'ê': 'e',
  };
  let r = cat.toLowerCase();
  for (const [from, to] of Object.entries(dmap)) r = r.split(from).join(to);
  return r;
}

// Build normalized override map
const NORM_OVERRIDES = new Map();
for (const [cat, mega] of Object.entries(CATEGORY_OVERRIDES)) {
  NORM_OVERRIDES.set(normCat(cat), mega);
}

// ========== MEGA CATEGORIES (keyword scoring for multi-category merchants) ==========
const MEGA_CATEGORIES = {
  'electronice-it': {
    name: 'Electronice & IT',
    phrases: ['huse telefoane', 'folii protectie', 'husa telefon', 'folie protectie',
      'difuzoare dedicate', 'cabluri de date', 'incarcator laptop', 'tastaturi laptop',
      'baterii laptop', 'acumulatori laptop', 'camera web', 'placa video', 'power bank',
      'boxe bluetooth', 'boxe portabile', 'casti bluetooth', 'casti wireless',
      'mouse gaming', 'mouse pad', 'camera supraveghere', 'accesorii telefon',
      'huse tablete', 'car audio', 'curea smartwatch'],
    keywords: ['laptop', 'telefon', 'tablet', 'monitor', 'televizor', 'calculator', 'pc',
      'incarcator', 'cablu', 'tastatur', 'mouse', 'hdd', 'ssd', 'memori',
      'imprimant', 'toner', 'cartus', 'navigati', 'gps', 'smart', 'casti', 'boxe',
      'difuzor', 'adaptor', 'hub', 'switch', 'router', 'procesor', 'sursa', 'cooler',
      'server', 'rack', 'retea', 'hard disk', 'usb', 'display', 'electroni', 'gadget',
      'consola', 'playstation', 'xbox', 'nintendo', 'charger', 'ups'],
  },
  'casa-gradina': {
    name: 'Casa & Gradina',
    phrases: ['aer conditionat', 'masina de spalat', 'lenjerie pat', 'set gradina',
      'cuptor incorporabil', 'plita incorporabil', 'masina spalat rufe', 'masina spalat vase'],
    keywords: ['mobilier', 'canapea', 'dulap', 'living', 'dormitor',
      'bucatarie', 'baie', 'gradina', 'terasa', 'centrala', 'cazan', 'boiler', 'puffer',
      'pompa', 'solar', 'climatizare', 'aspirator', 'frigider',
      'cuptor', 'aragaz', 'hota', 'electrocasnic', 'iluminat', 'bec', 'lampa', 'lustre', 'covoare',
      'tapet', 'perdea', 'draperie', 'cuvertura', 'perna', 'saltea', 'decoratiun',
      'vaza', 'oglinda', 'robinet', 'chiuveta', 'cada', 'dus', 'wc', 'toalet', 'gresie', 'faianta',
      'parchet', 'unelt', 'bormasina', 'fierastrau', 'compresor', 'generator',
      'gazon', 'gard', 'foarfec', 'furtun', 'pavaj'],
  },
  'fashion': {
    name: 'Fashion',
    phrases: ['accesorii dama', 'ochelari soare', 'pantofi sport'],
    keywords: ['imbracaminte', 'pantalon', 'bluza', 'rochie', 'fusta', 'camasa', 'tricou',
      'geaca', 'palton', 'sacou', 'costum', 'jeans', 'pulover', 'incaltaminte',
      'pantofi', 'adidasi', 'ghete', 'cizme', 'sandale', 'papuci', 'bocanci', 'tenisi',
      'genti', 'poseta', 'portofel', 'bijuterii', 'esarfa',
      'palarie', 'sapca', 'manusi', 'bagajerie', 'valize', 'rucsac', 'borseta'],
  },
  'copii-jucarii': {
    name: 'Copii & Jucarii',
    phrases: ['scaun auto copii', 'camera copil', 'bicicleta copii', 'pat copil',
      'piscina copii', 'siguranta copii', 'masinuta electric'],
    keywords: ['copil', 'bebe', 'carucior', 'jucarii', 'lego',
      'puzzle', 'papusa', 'masinuta', 'educativ',
      'tricicleta', 'leagan', 'tobogan', 'biberon', 'suzeta',
      'scutec', 'marsupiu', 'landou'],
  },
  'auto-moto': {
    name: 'Auto & Moto',
    phrases: ['piese auto', 'piese schimb', 'anvelope iarna', 'anvelope vara',
      'anvelope all season', 'radiator auto'],
    keywords: ['anvelope', 'suspensie', 'frana', 'amortizor',
      'bujie', 'alternator', 'demaror', 'turbo', 'evacuare', 'parbriz',
      'stergatoare', 'capota', 'portiera',
      'jante', 'cauciuc',
      'camioane', 'camion', 'atv', 'motocicleta'],
  },
  'sport': {
    name: 'Sport',
    phrases: ['pantaloni sport', 'incaltaminte sport', 'imbracaminte sport',
      'echipament sportiv', 'sac dormit'],
    keywords: ['fitness', 'bicicleta', 'trotineta', 'role', 'schi', 'snowboard', 'camping',
      'cort', 'lanterna', 'drumetii', 'alergare', 'antrenament', 'sport',
      'jogging', 'yoga', 'pilates', 'fotbal', 'basket', 'tenis', 'box',
      'ciclism', 'natatie', 'escalada', 'alpinism'],
  },
  'pescuit': {
    name: 'Pescuit & Vanatoare',
    phrases: ['cort pescuit', 'scaun pescuit', 'geanta pescuit', 'rod pod',
      'naluci artificiale', 'pescuit la crap', 'pescuit la feeder',
      'pescuit la rapitor', 'pescuit la stationar'],
    keywords: ['pescuit', 'rapitor', 'crap', 'feeder', 'stationar', 'naluci', 'momeli', 'nade',
      'lanseta', 'mulineta', 'montura', 'plumb', 'carlige', 'plase', 'minciog', 'juvelnic',
      'swinger', 'avertizor', 'vanatoare', 'airsoft'],
  },
  'sanatate-frumusete': {
    name: 'Sanatate & Frumusete',
    phrases: ['placa par', 'aparat ras', 'fond ten', 'ingrijire ten', 'gel dus'],
    keywords: ['cosmetice', 'parfum', 'crema', 'sampon', 'balsam', 'sapun', 'deodorant',
      'machiaj', 'ruj', 'mascara', 'fard', 'oja', 'manichiura', 'perie',
      'uscator', 'trimmer', 'epilator', 'sanatate', 'vitamine', 'suplimente',
      'farmaci', 'tensiune', 'termometru', 'lentile', 'ingrijire ten'],
  },
  'carti-birou': {
    name: 'Carti & Birou',
    phrases: ['carti pentru', 'carte straina', 'literatura straina', 'benzi desenate',
      'manuale scolare', 'auxiliare scolare', 'dezvoltare personala'],
    keywords: ['carte', 'carti', 'roman', 'manual', 'dictionar', 'enciclopedie', 'papetarie',
      'stilou', 'pix', 'caiet', 'agenda', 'calendar', 'dosare', 'biblioraft', 'hartie',
      'beletristic', 'fictiune', 'literatur', 'povesti', 'nuvele', 'povestiri',
      'manga', 'ebook', 'biografi', 'memorii', 'istorie', 'filosofie', 'religie',
      'psihologie', 'stiinte', 'drept', 'economie', 'spiritualitate'],
  },
  'alimentare-bauturi': {
    name: 'Alimentare & Bauturi',
    phrases: ['ulei masline', 'filtru cafea'],
    keywords: ['cafea', 'ceai', 'ciocolata', 'dulciuri', 'conserve', 'paste', 'orez',
      'condiment', 'vin', 'bere', 'whisky', 'vodka', 'bauturi', 'espressor',
      'rasnita'],
  },
  'animale': {
    name: 'Animale de Companie',
    phrases: ['hrana animale', 'jucarii animale', 'pentru animale'],
    keywords: ['animale', 'caini', 'pisici', 'cusca', 'litiera', 'zgarda',
      'acvariu', 'terariu', 'pasari', 'rozatoare', 'pet'],
  },
};

// ========== SMART SAMPLING (applied per-file to avoid OOM) ==========
const MAX_PER_MERCHANT_CATEGORY = 200;
const MAX_PER_MERCHANT = 50000;

function sampleProducts(products, merchantName) {
  if (products.length <= MAX_PER_MERCHANT) return products;

  // Group by raw category
  const byCat = new Map();
  for (const p of products) {
    const cat = p.rc || 'uncategorized';
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(p);
  }

  // Calculate per-cat limit
  const perCatLimit = Math.min(MAX_PER_MERCHANT_CATEGORY, Math.ceil(MAX_PER_MERCHANT / byCat.size));

  const sampled = [];
  for (const [cat, prods] of byCat) {
    prods.sort((a, b) => {
      const aDisc = a.op > a.p ? 1 : 0;
      const bDisc = b.op > b.p ? 1 : 0;
      if (bDisc !== aDisc) return bDisc - aDisc;
      return b.p - a.p;
    });
    sampled.push(...prods.slice(0, perCatLimit));
  }

  // Final trim if still over
  const result = sampled.length > MAX_PER_MERCHANT ? sampled.slice(0, MAX_PER_MERCHANT) : sampled;
  console.log(`  [SAMPLE] ${merchantName}: ${products.length} -> ${result.length} (${byCat.size} categories)`);
  return result;
}

// ========== PARSE ALL FEEDS (with per-file sampling) ==========
const csvFiles = readdirSync(RAW_DIR).filter(f => f.endsWith('.csv')).sort();
console.log(`Processing ${csvFiles.length} feed files...`);

const allProducts = [];
const rawCategoryMap = new Map();
const brandMap = new Map();
const campaignMap = new Map();
let skipped = 0;
let duplicates = 0;
let totalBeforeSampling = 0;
const seenKeys = new Set();

for (const file of csvFiles) {
  const content = readFileSync(join(RAW_DIR, file), 'utf-8');

  let records;
  try {
    records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
      quote: '"',
      escape: '"',
    });
  } catch (err) {
    console.error(`  Error parsing ${file}: ${err.message}`);
    continue;
  }

  // Collect products for this file
  const fileProducts = [];
  let merchantName = '';
  for (const row of records) {
    if (row.product_active === '0') { skipped++; continue; }

    const title = (row.title || '').trim();
    if (!title || title.length < 5) continue;

    // Dedup by title+price
    const key = title.toLowerCase() + '|' + (row.price || '');
    if (seenKeys.has(key)) { duplicates++; continue; }
    seenKeys.add(key);

    const price = parseFloat((row.price || '0').replace(',', '.'));
    if (price <= 0) continue;

    const oldPrice = parseFloat((row.old_price || '0').replace(',', '.'));
    const rawCategory = (row.category || 'Altele').trim();
    const brand = (row.brand || '').trim();
    const campaign = (row.campaign_name || '').replace(/\/$/, '').trim();
    const image = (row.image_urls || '').split(',')[0].trim();
    const affLink = (row.aff_code || '').trim();
    const desc = shortDesc(row.description);

    if (!affLink || !image) continue;
    if (!merchantName && campaign) merchantName = campaign;

    fileProducts.push({
      t: title,
      p: price,
      op: oldPrice > price ? oldPrice : 0,
      rc: rawCategory,
      b: brand,
      m: campaign,
      i: image,
      l: affLink,
      d: desc,
    });

    rawCategoryMap.set(rawCategory, (rawCategoryMap.get(rawCategory) || 0) + 1);
    if (brand) brandMap.set(brand, (brandMap.get(brand) || 0) + 1);
    if (campaign) campaignMap.set(campaign, (campaignMap.get(campaign) || 0) + 1);
  }

  totalBeforeSampling += fileProducts.length;

  // Sample immediately per-file to keep memory bounded
  const sampled = sampleProducts(fileProducts, merchantName || file);
  allProducts.push(...sampled);

  console.log(`  ${file} (${merchantName}): ${fileProducts.length} parsed -> ${sampled.length} kept`);
  // Let GC reclaim fileProducts
}

console.log(`\nTotal before sampling: ${totalBeforeSampling}`);
console.log(`Total after sampling: ${allProducts.length}`);
console.log(`Skipped inactive: ${skipped}, duplicates: ${duplicates}`);
console.log(`Raw categories: ${rawCategoryMap.size}`);
console.log(`Merchants: ${campaignMap.size}`);

// ========== CLASSIFY PRODUCTS INTO MEGA CATEGORIES ==========
// Cache: raw category -> mega (so we only classify each raw cat once)
const rawCatClassCache = new Map();

function classifyByRawCategory(rawCat) {
  if (rawCatClassCache.has(rawCat)) return rawCatClassCache.get(rawCat);

  const norm = normCat(rawCat);

  // 1. Check explicit overrides first (exact match on normalized form)
  if (NORM_OVERRIDES.has(norm)) {
    const result = NORM_OVERRIDES.get(norm);
    rawCatClassCache.set(rawCat, result);
    return result; // null means "skip, let scoring handle it"
  }

  // 2. Check if raw category starts with an override key (for hierarchical cats)
  for (const [overrideKey, mega] of NORM_OVERRIDES.entries()) {
    if (mega && norm.startsWith(overrideKey)) {
      rawCatClassCache.set(rawCat, mega);
      return mega;
    }
  }

  // 3. Score raw category name against mega phrases + keywords
  const text = norm;
  let bestMatch = null;
  let bestScore = 0;

  for (const [megaSlug, mega] of Object.entries(MEGA_CATEGORIES)) {
    let score = 0;
    for (const phrase of mega.phrases || []) {
      if (wordMatch(text, phrase)) score += 3;
    }
    for (const kw of mega.keywords) {
      if (wordMatch(text, kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = megaSlug;
    }
  }

  const result = bestScore >= 1 ? bestMatch : null;
  rawCatClassCache.set(rawCat, result);
  return result;
}

function classifyProduct(product) {
  // Priority 1: MERCHANT_MAP (covers ~85% of products)
  const merchantKey = product.m;
  if (merchantKey && MERCHANT_MAP.hasOwnProperty(merchantKey)) {
    const megaFromMerchant = MERCHANT_MAP[merchantKey];
    if (megaFromMerchant !== null) return megaFromMerchant;
    // null means multi-category merchant, fall through
  }

  // Priority 2: CATEGORY_OVERRIDES (exact + startsWith, for multi-category merchants)
  const catResult = classifyByRawCategory(product.rc);
  if (catResult) return catResult;

  // Priority 3: Title+brand+category keyword scoring
  const text = normCat(product.t + ' ' + product.rc + ' ' + product.b);

  let bestMatch = null;
  let bestScore = 0;

  for (const [megaSlug, mega] of Object.entries(MEGA_CATEGORIES)) {
    let score = 0;
    for (const phrase of mega.phrases || []) {
      if (wordMatch(text, phrase)) score += 3;
    }
    for (const kw of mega.keywords) {
      if (wordMatch(text, kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = megaSlug;
    }
  }

  return bestMatch || 'altele';
}

// Assign mega category to each product
console.log('\n=== Classification (pass 1) ===');
for (const product of allProducts) {
  product.mc = classifyProduct(product);
}

// ========== RECLASSIFICATION PASS ==========
// Two-phase reclassification:
// Phase A: For ALL products - if raw category EXACTLY matches a CATEGORY_OVERRIDE
//          pointing to a different mega, reclassify. This catches merchant-mapped products
//          like flanco.ro selling "Bare transversale" (auto) or "Parfumuri" (sanatate).
// Phase B: For multi-category merchants only - keyword scoring on raw category name.
console.log('\n=== Reclassification pass ===');
let reclassifiedExact = 0;
let reclassifiedScore = 0;

for (const product of allProducts) {
  const merchantKey = product.m;
  const hasMerchantMapping = merchantKey && MERCHANT_MAP.hasOwnProperty(merchantKey) && MERCHANT_MAP[merchantKey] !== null;

  // Phase A: Exact override match (for ALL products including merchant-mapped)
  // Extract the last segment of hierarchical categories for matching
  const parts = product.rc.split(/\s*>\s*/);
  const lastSegment = normCat(parts[parts.length - 1].trim());
  const fullNorm = normCat(product.rc);

  // Check exact match on last segment
  if (NORM_OVERRIDES.has(lastSegment)) {
    const overrideMega = NORM_OVERRIDES.get(lastSegment);
    if (overrideMega && overrideMega !== product.mc) {
      product.mc = overrideMega;
      reclassifiedExact++;
      continue;
    }
  }
  // Check exact match on full normalized category
  if (NORM_OVERRIDES.has(fullNorm)) {
    const overrideMega = NORM_OVERRIDES.get(fullNorm);
    if (overrideMega && overrideMega !== product.mc) {
      product.mc = overrideMega;
      reclassifiedExact++;
      continue;
    }
  }

  // Phase B: Keyword scoring (only for multi-category merchants)
  if (hasMerchantMapping) continue;

  const catNorm = normCat(product.rc);
  let bestMega = null;
  let bestScore = 0;
  for (const [megaSlug, mega] of Object.entries(MEGA_CATEGORIES)) {
    let score = 0;
    for (const phrase of mega.phrases || []) {
      if (wordMatch(catNorm, phrase)) score += 3;
    }
    for (const kw of mega.keywords) {
      if (wordMatch(catNorm, kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMega = megaSlug;
    }
  }

  if (bestMega && bestScore >= 1 && bestMega !== product.mc) {
    product.mc = bestMega;
    reclassifiedScore++;
  }
}
console.log(`  Reclassified (exact override): ${reclassifiedExact}`);
console.log(`  Reclassified (keyword score): ${reclassifiedScore}`);

const megaCounts = {};
for (const product of allProducts) {
  megaCounts[product.mc] = (megaCounts[product.mc] || 0) + 1;
}
console.log('\n=== Final classification ===');
for (const [mega, count] of Object.entries(megaCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${mega}: ${count}`);
}

// ========== BUILD SUBCATEGORIES (with dedup by clean display name) ==========
const megaCatProducts = {};
for (const product of allProducts) {
  if (!megaCatProducts[product.mc]) megaCatProducts[product.mc] = [];
  megaCatProducts[product.mc].push(product);
}

const subcategories = {};
for (const [megaSlug, products] of Object.entries(megaCatProducts)) {
  // Group by clean display name (last segment of hierarchical category)
  const subcatMap = new Map(); // cleanName -> { count, originalNames: Set }
  for (const p of products) {
    const parts = p.rc.split(/\s*>\s*/);
    let cleanName = parts[parts.length - 1].trim();
    // Cap display name at 40 chars
    if (cleanName.length > 40) {
      cleanName = cleanName.substring(0, 37) + '...';
    }
    if (!subcatMap.has(cleanName)) {
      subcatMap.set(cleanName, { count: 0, originalNames: new Set() });
    }
    const entry = subcatMap.get(cleanName);
    entry.count++;
    entry.originalNames.add(p.rc);
  }

  // Only keep subcategories with 10+ products
  const subcats = [...subcatMap.entries()]
    .filter(([, data]) => data.count >= 10)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([cleanName, data]) => {
      // Use the most common originalName for filtering
      const originalNames = [...data.originalNames];
      return {
        name: cleanName,
        originalName: originalNames.length === 1 ? originalNames[0] : originalNames[0],
        originalNames: originalNames,
        slug: slugify(cleanName),
        count: data.count,
      };
    });

  subcategories[megaSlug] = subcats;
}

// ========== SHARD PRODUCTS ==========
const SHARD_SIZE = 2000;
let shardIndex = 0;
const shardMap = {};

for (const [megaSlug, products] of Object.entries(megaCatProducts)) {
  // Sort by: has discount first, then by price desc
  products.sort((a, b) => {
    const aDiscount = a.op > 0 ? 1 : 0;
    const bDiscount = b.op > 0 ? 1 : 0;
    if (bDiscount !== aDiscount) return bDiscount - aDiscount;
    return b.p - a.p;
  });

  const shardFiles = [];
  for (let i = 0; i < products.length; i += SHARD_SIZE) {
    const chunk = products.slice(i, i + SHARD_SIZE).map(p => ({
      t: p.t, p: p.p, op: p.op, c: p.rc, b: p.b, m: p.m, i: p.i, l: p.l, d: p.d
    }));
    const shardFile = `s${String(shardIndex).padStart(4, '0')}.json`;
    writeFileSync(join(PRODUCTS_DIR, shardFile), JSON.stringify(chunk));
    shardFiles.push({ file: shardFile, count: chunk.length });
    shardIndex++;
  }

  shardMap[megaSlug] = {
    shards: shardFiles,
    totalProducts: products.length,
  };
}

console.log(`\nShards created: ${shardIndex} (SHARD_SIZE=${SHARD_SIZE})`);

// ========== BUILD SITE STRUCTURE ==========
const siteStructure = {
  megaCategories: {},
  lastUpdated: new Date().toISOString(),
};

for (const [megaSlug, mega] of Object.entries(MEGA_CATEGORIES)) {
  const products = megaCatProducts[megaSlug] || [];
  if (products.length === 0) continue;

  siteStructure.megaCategories[megaSlug] = {
    name: mega.name,
    slug: megaSlug,
    totalProducts: products.length,
    subcategories: (subcategories[megaSlug] || []).slice(0, 80),
    shards: (shardMap[megaSlug] || {}).shards || [],
    topBrands: getTopBrands(products, 20),
    topStores: getTopStores(products, 10),
    priceRange: getPriceRange(products),
  };
}

// Add "altele" if exists
if (megaCatProducts['altele'] && megaCatProducts['altele'].length > 0) {
  siteStructure.megaCategories['altele'] = {
    name: 'Alte Produse',
    slug: 'altele',
    totalProducts: megaCatProducts['altele'].length,
    subcategories: (subcategories['altele'] || []).slice(0, 50),
    shards: (shardMap['altele'] || {}).shards || [],
    topBrands: getTopBrands(megaCatProducts['altele'], 20),
    topStores: getTopStores(megaCatProducts['altele'], 10),
    priceRange: getPriceRange(megaCatProducts['altele']),
  };
}

function getTopBrands(products, limit) {
  const map = new Map();
  for (const p of products) {
    if (p.b) map.set(p.b, (map.get(p.b) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, slug: slugify(name), count }));
}

function getTopStores(products, limit) {
  const map = new Map();
  for (const p of products) {
    if (p.m) map.set(p.m, (map.get(p.m) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function getPriceRange(products) {
  let min = Infinity, max = 0;
  for (const p of products) {
    if (p.p < min) min = p.p;
    if (p.p > max) max = p.p;
  }
  return { min: Math.round(min), max: Math.round(max) };
}

// Save site structure
writeFileSync(join(DATA_DIR, 'site-structure.json'), JSON.stringify(siteStructure, null, 2));

// Save global stats
const stats = {
  totalProducts: allProducts.length,
  rawCategories: rawCategoryMap.size,
  megaCategories: Object.keys(siteStructure.megaCategories).length,
  totalBrands: brandMap.size,
  totalStores: campaignMap.size,
  totalShards: shardIndex,
  lastUpdated: new Date().toISOString(),
};
writeFileSync(join(DATA_DIR, 'stats.json'), JSON.stringify(stats, null, 2));

// Print summary
console.log('\n=== SITE STRUCTURE ===');
for (const [slug, cat] of Object.entries(siteStructure.megaCategories)) {
  console.log(`  ${cat.name}: ${cat.totalProducts} products, ${cat.subcategories.length} subcats, ${cat.shards.length} shards`);
}

const alteleCount = megaCatProducts['altele']?.length || 0;
const altelePercent = ((alteleCount / allProducts.length) * 100).toFixed(1);
console.log(`\n  "altele": ${alteleCount} products (${altelePercent}%)`);
console.log(`\nTotal files: ${shardIndex} shards + ~${Object.keys(siteStructure.megaCategories).length * 10} pages`);
console.log('Processing complete!');
