import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const CONTENT_DIR = join(DATA_DIR, 'content');
mkdirSync(CONTENT_DIR, { recursive: true });

const apiKeys = readFileSync(join(ROOT, 'gemini api.txt'), 'utf-8')
  .split('\n').map(l => l.trim()).filter(Boolean);

const MODEL = 'gemini-2.5-flash';
const DELAY_MS = 8000;

let keyIdx = 0;
function nextKey() { return apiKeys[keyIdx++ % apiKeys.length]; }

async function callGemini(prompt) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const key = nextKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        const msg = body?.error?.message || '';
        const match = msg.match(/retry in ([\d.]+)s/);
        const wait = match ? Math.ceil(parseFloat(match[1])) + 2 : 15;
        console.log(`  429, waiting ${wait}s...`);
        await new Promise(r => setTimeout(r, wait * 1000));
        continue;
      }
      if (!res.ok) { console.error(`  HTTP ${res.status}`); continue; }
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (e) { console.error(`  Error: ${e.message}`); }
    await new Promise(r => setTimeout(r, 3000));
  }
  return null;
}

function parseJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
    try { return JSON.parse(match[0].replace(/,\s*([}\]])/g, '$1')); } catch {}
  }
  return null;
}

// stripCliches from generate-content.js
function stripCliches(text) {
  if (!text) return text;
  const replacements = [
    [/\bDe asemenea,?\s*/gi, ''],
    [/\bIn plus,?\s*/gi, ''],
    [/\bPrin urmare,?\s*/gi, ''],
    [/\bTotodata,?\s*/gi, ''],
    [/\bAsadar,?\s*/gi, ''],
    [/\bCu toate acestea,?\s*/gi, ''],
    [/\bNu in ultimul rand,?\s*/gi, ''],
    [/\bIn concluzie,?\s*/gi, ''],
    [/\bEste important de mentionat ca\s*/gi, ''],
    [/\bIn era actuala,?\s*/gi, ''],
    [/\bFara indoiala,?\s*/gi, ''],
    [/\bIn cele ce urmeaza,?\s*/gi, ''],
    [/\bIn continuare vom\s*/gi, ''],
    [/\bFie ca\s*/gi, ''],
    [/\bIndiferent daca\s*/gi, ''],
    [/\bIndiferent de\s*/gi, ''],
    [/\bbeneficiaza de\b/gi, 'are'],
    [/\bdispune de\b/gi, 'are'],
    [/\bcontribuie la\b/gi, 'ajuta la'],
    [/\bse traduce prin\b/gi, 'inseamna'],
    [/\bse traduce in\b/gi, 'inseamna'],
    [/\bse pozitioneaza ca\b/gi, 'este'],
    [/\bse plaseaza ca\b/gi, 'este'],
    [/\bse distinge prin\b/gi, 'are'],
    [/\bse impune ca\b/gi, 'este'],
    [/\bse remarca prin\b/gi, 'are'],
    [/\bvine echipat cu\b/gi, 'are'],
    [/\bvine echipata cu\b/gi, 'are'],
    [/\bpromitand\b/gi, 'cu'],
    [/\beste proiectat(a)? sa\b/gi, 'poate'],
    [/\bcontribuie semnificativ\b/gi, 'ajuta'],
    [/\bun accent puternic pe\b/gi, 'accent pe'],
    [/\bse adreseaza celor care\b/gi, 'e pentru cei care'],
    [/\bse adreseaza\b/gi, 'e pentru'],
    [/\bjoaca un rol\b/gi, 'conteaza'],
    [/\bofera o experienta\b/gi, 'ofera'],
    [/\bo optiune viabila\b/gi, 'o varianta'],
    [/\bo optiune solida\b/gi, 'o varianta buna'],
    [/\bo optiune excelenta\b/gi, 'o varianta buna'],
    [/\bo solutie (eficienta|buna|excelenta)\b/gi, 'o varianta buna'],
    [/\bo alegere excelenta\b/gi, 'o varianta buna'],
    [/\beste o caracteristica esentiala\b/gi, 'conteaza'],
    [/\bremarcabil(a|e)?\b/gi, 'bun'],
    [/\bexceptional(a|e)?\b/gi, 'foarte bun'],
    [/\brevolutionar(a|e)?\b/gi, 'nou'],
    [/\binovativ(a|e)?\b/gi, 'modern'],
    [/\beste esential(a)?\b/gi, 'conteaza'],
    [/\beste crucial(a)?\b/gi, 'conteaza'],
    [/\bo gama variata\b/gi, 'mai multe optiuni'],
    [/\bo gama larga\b/gi, 'multe optiuni'],
    [/\bo selectie impresionanta\b/gi, 'multe optiuni'],
    [/\bcalitate premium\b/gi, 'calitate buna'],
    [/\braport calitate-pret\b/gi, 'pret corect'],
  ];
  for (const [p, r] of replacements) text = text.replace(p, r);
  return text.replace(/\s{2,}/g, ' ');
}

function cleanObj(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(i => typeof i === 'string' ? stripCliches(i) : typeof i === 'object' ? cleanObj(i) : i);
  const c = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') c[k] = stripCliches(v);
    else if (typeof v === 'object') c[k] = cleanObj(v);
    else c[k] = v;
  }
  return c;
}

// Load cache
const CACHE_FILE = join(CONTENT_DIR, 'seo-content.json');
let cache = {};
if (existsSync(CACHE_FILE)) cache = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));

// Load intents
const allIntents = JSON.parse(readFileSync(join(DATA_DIR, 'search-intents.json'), 'utf-8')).intents;
const testSlugs = ['cel-mai-bun-laptop','top-laptopuri','cel-mai-bun-aspirator-robot','top-aspiratoare-robot','cele-mai-bune-anvelope-vara'];
const testIntents = testSlugs.map(s => allIntents.find(i => i.slug === s)).filter(Boolean);

console.log(`\nGenerating ${testIntents.length} test intents...\n`);

const ANTI_CLICHE = `REGULI STRICTE DE SCRIERE:
- Scrie FARA diacritice (a nu ă, i nu î, s nu ș, t nu ț)
- CUVINTE SI EXPRESII INTERZISE (nu le folosi NICIODATA): "Asadar", "De asemenea", "Cu toate acestea", "Este important de mentionat", "Nu in ultimul rand", "in era actuala", "in era digitala", "descopera", "fara indoiala", "in concluzie", "este esential", "este crucial", "o alegere excelenta", "ghid complet", "exploreaza", "aprofundam", "remarcabil", "exceptional", "revolutionar", "inovativ", "vom detalia", "vom analiza", "vom explora", "vom prezenta", "in cele ce urmeaza", "in continuare vom", "sa aruncam o privire", "beneficiaza de", "se traduce prin", "se pozitioneaza ca", "vine echipat cu", "promitand", "contribuie semnificativ", "fie ca", "nu mai este un secret", "indiferent daca", "pe piata actuala", "cu siguranta", "joaca un rol", "ofera o experienta", "o gama variata", "o gama larga", "o selectie impresionanta", "calitate premium", "raport calitate-pret", "intr-o lume"
- NU incepe propozitii cu "Fie ca", "Indiferent de", "Cu o gama", "De la ... pana la", "In era", "Intr-o lume"
- TopBuy.ro RECOMANDA produse. NU compara preturi, NU este un comparator. Nu mentiona niciodata preturi, reduceri, economisire, buget
- Scrie ca un prieten care se pricepe la domeniu si iti da sfaturi concrete, nu ca un robot de marketing
- Amesteca paragrafe scurte (1-2 propozitii) cu medii (3-4 propozitii)
- Fiecare text trebuie sa fie UNIC - nu repeta aceleasi structuri de propozitii
- Fii DIRECT - nu incepe cu introduceri lungi, intra direct in subiect. Prima propozitie RASPUNDE la ce cauta cititorul
- NU pune NICIODATA un an in text (nu "2024", "2025", "2026" etc.) - textul trebuie sa fie evergreen
- Critici oneste: mentioneaza si dezavantaje sau compromisuri reale, nu doar laude
- Limbaj natural dar nu excesiv informal`;

function buildPrompt(intent) {
  const t = intent.type;
  let typeHint = '', introGuide = '';
  if (t === 'best-of') {
    typeHint = 'Pagina de tip "cel mai bun / cele mai bune". Cititorul vrea sa stie CE sa aleaga concret si DE CE.';
    introGuide = `Primul paragraf RASPUNDE DIRECT la intentia de cautare. Daca cineva cauta "${intent.title}", ce vrea sa afle? Raspunde-i imediat cu o recomandare concreta. Apoi detaliaza criteriile care conteaza.`;
  } else if (t === 'top') {
    typeHint = 'Pagina de tip "top produse". Cititorul vrea un clasament cu ce merita.';
    introGuide = 'Incepe cu raspunsul: care sunt produsele care merita si de ce. Nu incepe cu "daca vrei" sau "piata e plina de optiuni". Incepe cu RASPUNSUL.';
  } else if (t === 'brand') {
    typeHint = 'Pagina dedicata unui brand.';
    introGuide = 'Incepe cu ce e relevant despre acest brand: pentru ce e cunoscut, la ce e bun, pentru cine.';
  } else {
    typeHint = `Pagina de categorie/cautare.`;
    introGuide = 'Primul paragraf raspunde direct: ce gaseste aici cititorul si ce trebuie sa stie.';
  }

  return `Scrii continut editorial pe TopBuy.ro (site recomandari produse Romania). Stilul e informativ si directionat spre decizie — ajuti cititorul sa aleaga.
${intent.productCount} produse disponibile.
${typeHint}

Keyword: "${intent.title}"

=== TONUL SI STILUL (CRITIC) ===
INTRO:
- ${introGuide}
- Exemplu bun pentru "cele mai bune laptopuri gaming": "Pentru gaming serios ai nevoie de minim o placa video RTX 4060, 16 GB RAM si un ecran de 144Hz. Diferenta intre un laptop de gaming si unul obisnuit se simte instant in FPS si temperaturi."
- Exemplu PROST: "Daca iti doresti sa gasesti cel mai bun laptop, ai ajuns unde trebuie. Piata e plina de optiuni si poate fi greu sa alegi..."
- NU incepe cu anecdote, NU incepe cu "tu" sau "daca vrei". Incepe cu INFORMATIA.

PARAGRAFE CU INTREBARI (IMPORTANT PENTRU AI SEARCH):
- Minim 2 paragrafe din intro sa inceapa cu o INTREBARE directa urmata de raspuns
- FAQ-urile sa fie intrebari reale, cum le tasteaza un roman in Google
- Exemplu bun: "Cat consuma un frigider side-by-side? In medie, un model A consuma 250-300 kWh pe an, adica ~15 lei pe luna la pretul curent al energiei."

Genereaza JSON EXACT in acest format:
{
  "metaTitle": "${intent.title} - Recomandari | TopBuy.ro",
  "metaDescription": "140-155 char, direct si convingator, contine cuvantul cheie",
  "h1": "${intent.title}",
  "intro": "150-250 cuvinte. OBLIGATORIU: '${intent.title}' apare in primele 10 cuvinte. Raspunde DIRECT la intentia de cautare. Include minim 2 paragrafe care incep cu intrebare. Criterii concrete de alegere specifice. Fiecare propozitie aduce informatie noua.",
  "proscons": [{"name":"aspect tehnic specific","pro":"avantaj concret cu cifre/detalii","con":"dezavantaj real sau compromis"}] (4-5 elemente),
  "verdict": "30-50 cuvinte. Sfat final practic. Incepe direct cu recomandarea.",
  "tips": ["4 sfaturi SPECIFICE pentru ${intent.title} - lucruri pe care un prieten expert ti le-ar spune inainte sa cumperi. Fiecare sfat contine un detaliu concret, nu sfaturi generice."],
  "faq": [{"q":"intrebare exacta cum o scrie un roman in Google","a":"raspuns direct, 2-3 propozitii cu informatii concrete si cifre"},{"q":"...","a":"..."},{"q":"...","a":"..."}]
}

${ANTI_CLICHE}
REGULI SUPLIMENTARE:
- h1 = EXACT cuvantul cheie "${intent.title}", nimic in plus, FARA an
- proscons: aspect REAL si SPECIFIC. Bun: {"name":"Autonomie","pro":"Modelele noi tin 10-12 ore normal","con":"Scade la 4-5 ore sub gaming"}. PROST: {"name":"Calitate","pro":"Calitate buna","con":"Poate fi scump"}
- verdict: NU "concluzie", "per ansamblu", "in final". Incepe cu sfatul
- FAQ: intrebari REALE. Ce scrie un roman cand cauta "${intent.title}"? Ex: "ce marca de X e mai buna", "cat costa un X bun", "merita X sau Y", "cat tine un X". NU "ce trebuie sa stiu despre X"
- intro: keyword-ul "${intent.title}" in primele 10 cuvinte. Fara fluff introductiv`;
}

for (let i = 0; i < testIntents.length; i++) {
  const intent = testIntents[i];
  console.log(`[${i+1}/${testIntents.length}] ${intent.title} (${intent.type})...`);

  const prompt = buildPrompt(intent);
  const raw = await callGemini(prompt);
  const parsed = parseJson(raw);

  if (parsed?.intro) {
    const cleaned = cleanObj(parsed);
    cache[`search:${intent.slug}`] = cleaned;
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log(`  OK - intro: ${cleaned.intro.substring(0, 150)}...`);
  } else {
    console.log(`  FAIL - ${raw ? 'parse error' : 'null response'}`);
    if (raw) console.log(`  Raw: ${raw.substring(0, 200)}`);
  }

  if (i < testIntents.length - 1) {
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
}

console.log('\nDone! Check seo-content.json for results.');
