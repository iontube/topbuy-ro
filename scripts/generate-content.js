import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const CONTENT_DIR = join(DATA_DIR, 'content');

mkdirSync(CONTENT_DIR, { recursive: true });

// ========== API KEYS ==========
const apiKeys = readFileSync(join(ROOT, 'gemini api.txt'), 'utf-8')
  .split('\n').map(l => l.trim()).filter(Boolean);

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
// Free tier: 15 RPM (per key), 1000 RPD (per key).
// Response ~2-4s + 8s delay = ~10-12s/call = ~5-6 RPM. Very safe under 15 RPM.
const DELAY_BETWEEN_CALLS_MS = 8000;
const MAX_CALLS_PER_KEY = 900;
const keyExhausted = new Array(apiKeys.length).fill(false);

// ========== LOAD DATA ==========
const structure = JSON.parse(readFileSync(join(DATA_DIR, 'site-structure.json'), 'utf-8'));
const CACHE_FILE = join(CONTENT_DIR, 'seo-content.json');

let contentCache = {};
if (existsSync(CACHE_FILE)) {
  try {
    contentCache = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
    console.log(`Loaded cache: ${Object.keys(contentCache).length} existing entries.`);
  } catch { console.log('Could not load cache, starting fresh.'); }
} else {
  console.log('No existing cache, starting fresh.');
}

// ========== SINGLE-KEY GEMINI CALL ==========
let totalApiCalls = 0;
let totalSkipped = 0;
const callsPerKey = new Array(apiKeys.length).fill(0);

async function callGeminiWithKey(keyIndex, prompt) {
  if (keyExhausted[keyIndex] || callsPerKey[keyIndex] >= MAX_CALLS_PER_KEY) return null;
  const key = apiKeys[keyIndex];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

  // Up to 4 attempts. Daily quota 429 = stop key. RPM 429 = wait and retry.
  for (let attempt = 0; attempt < 4; attempt++) {
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
        let body;
        try { body = await res.json(); } catch { body = {}; }
        const msg = body?.error?.message || '';

        // Check if it's a DAILY quota — stop this key entirely
        if (msg.includes('PerDay') || msg.includes('per day') || msg.includes('per_day') || msg.includes('daily')) {
          console.log(`    [K${keyIndex}] DAILY LIMIT — stopping key (${callsPerKey[keyIndex]} calls done)`);
          keyExhausted[keyIndex] = true;
          return null;
        }

        // RPM/other limit — parse retry delay, wait, and retry
        const match = msg.match(/retry in ([\d.]+)s/);
        const waitSec = match ? Math.ceil(parseFloat(match[1])) + 2 : 15;
        console.log(`    [K${keyIndex}] 429 RPM, wait ${waitSec}s (attempt ${attempt + 1})`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        continue;
      }

      if (res.status === 503 || res.status === 500) {
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }
        return null;
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error(`    [K${keyIndex}] HTTP ${res.status}: ${errText.substring(0, 100)}`);
        return null;
      }

      totalApiCalls++;
      callsPerKey[keyIndex]++;
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (err) {
      console.error(`    [K${keyIndex}] Net: ${err.message}`);
      if (attempt === 0) await new Promise(r => setTimeout(r, 3000));
    }
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

function saveCache() {
  writeFileSync(CACHE_FILE, JSON.stringify(contentCache, null, 2));
}

// ========== STRIP AI CLICHÉS (post-processing) ==========
function stripCliches(text) {
  if (!text) return text;
  const replacements = [
    // Filler connectors
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
    // AI verb constructions
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
    // AI adjectives and phrases
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
    [/\beste esential(a|e)?\b/gi, 'conteaza'],
    [/\besentiale?\b/gi, 'importante'],
    [/\beste crucial(a|e)?\b/gi, 'conteaza'],
    [/\bcrucial(a|e)?\b/gi, 'important'],
    [/\bo gama variata\b/gi, 'mai multe optiuni'],
    [/\bo gama larga\b/gi, 'multe optiuni'],
    [/\bo selectie impresionanta\b/gi, 'multe optiuni'],
    [/\bcalitate premium\b/gi, 'calitate buna'],
    [/\braport calitate-pret\b/gi, 'pret corect'],
  ];
  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }
  text = text.replace(/\s{2,}/g, ' ');
  return text;
}

function cleanContentObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      cleaned[key] = stripCliches(value);
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map(item => {
        if (typeof item === 'string') return stripCliches(item);
        if (typeof item === 'object' && item !== null) return cleanContentObject(item);
        return item;
      });
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = cleanContentObject(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

// ========== ANTI-CLICHE RULES ==========
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

// ========== CONTENT GENERATORS (return {cacheKey, prompt, fallback}) ==========
function buildHomepageJob() {
  const totalProducts = Object.values(structure.megaCategories)
    .reduce((sum, c) => sum + c.totalProducts, 0);
  const categories = Object.values(structure.megaCategories).map(c => c.name).join(', ');

  return {
    cacheKey: 'homepage',
    label: 'Homepage',
    prompt: `Scrii textul pentru pagina principala a TopBuy.ro — site de recomandari produse din Romania.
${totalProducts} produse din: ${categories}.

Genereaza JSON:
{
  "metaTitle": "TopBuy.ro — Recomandari Produse din Romania | ${Math.round(totalProducts/1000)}K+ Produse",
  "metaDescription": "140-155 char, direct, fara clisee",
  "h1": "titlu scurt si memorabil, max 50 char",
  "intro": "80-120 cuvinte. Explica simplu ce gasesti pe TopBuy: recomandari de produse din ${Object.keys(structure.megaCategories).length} categorii, de la magazine romanesti verificate. Scrie natural, ca si cum explici unui prieten ce e site-ul.",
  "tagline": "slogan 4-6 cuvinte, memorabil"
}

${ANTI_CLICHE}`,
    fallback: {
      metaTitle: `TopBuy.ro — Recomandari Produse din Romania`,
      metaDescription: `Recomandari de produse de la magazine verificate din Romania. Gaseste exact ce ai nevoie.`,
      h1: 'Gaseste produsul potrivit',
      intro: `TopBuy.ro aduna recomandari din ${Object.keys(structure.megaCategories).length} categorii de produse de la magazine romanesti verificate.`,
      tagline: 'Recomandari reale, produse verificate.',
    },
  };
}

function buildMegaCategoryJob(slug, cat) {
  const subcats = cat.subcategories.slice(0, 10).map(s => s.name).join(', ');
  const brands = cat.topBrands.slice(0, 6).map(b => b.name).join(', ');
  const stores = cat.topStores?.slice(0, 4).map(s => s.name).join(', ') || '';

  return {
    cacheKey: slug,
    label: `Mega: ${cat.name}`,
    prompt: `Scrii un text de prezentare pentru categoria "${cat.name}" pe TopBuy.ro (site recomandari produse Romania).
Date: ${cat.totalProducts} produse.
Subcategorii: ${subcats}
Branduri populare: ${brands}
Magazine: ${stores}

Genereaza JSON:
{
  "metaTitle": "max 60 char - cum cauta romanii pe Google aceasta categorie",
  "metaDescription": "140-155 char, convingator si natural",
  "h1": "max 60 char, titlu direct",
  "intro": "120-200 cuvinte. Scrie ca un jurnalist care chiar testeaza produse din aceasta categorie. Mentioneaza 3-4 subcategorii CONCRET (cu detalii utile despre fiecare, nu doar enumera). Include 2-3 branduri in context natural. Spune-i cititorului ce va gasi si de ce merita sa exploreze. NU enumera pur si simplu - fiecare propozitie trebuie sa aduca informatie noua.",
  "tips": ["5 sfaturi CONCRETE si SPECIFICE pentru cumparatori din aceasta categorie - lucruri pe care un expert le-ar spune unui prieten"],
  "faq": [{"q":"intrebare exacta cum o tasteaza un roman in Google","a":"raspuns scurt, util, 2-3 propozitii cu informatii concrete"},{"q":"...","a":"..."},{"q":"...","a":"..."}]
}

${ANTI_CLICHE}
EXTRA: Intro-ul trebuie sa para scris de un om care chiar a cumparat si testat produse din aceasta categorie. Fiecare sfat trebuie sa fie ceva CE NU STIE TOATA LUMEA.`,
    fallback: {
      metaTitle: `${cat.name} - Recomandari | TopBuy.ro`,
      metaDescription: `Recomandari ${cat.name} de la magazine verificate din Romania.`,
      h1: cat.name, intro: '', tips: [], faq: [],
    },
  };
}

function buildSubcategoryJob(megaSlug, subcat, parentName) {
  return {
    cacheKey: `sub:${megaSlug}/${subcat.slug}`,
    label: `Sub: ${subcat.name}`,
    prompt: `Scrii un text scurt pentru subcategoria "${subcat.name}" din "${parentName}" pe TopBuy.ro.
${subcat.count} produse disponibile.

Genereaza JSON:
{
  "metaTitle": "max 60 char - exact cum ar cauta un roman pe Google",
  "metaDescription": "140-155 char, direct",
  "h1": "max 60 char",
  "intro": "60-100 cuvinte. Scrie 2-3 propozitii utile SPECIFICE pentru ${subcat.name}. Ce trebuie sa stie cineva care cauta asta? La ce sa fie atent? Scrie ca un prieten care se pricepe.",
  "tips": ["3 sfaturi practice SPECIFICE pentru ${subcat.name}"],
  "faq": [{"q":"intrebare reala","a":"raspuns scurt util"},{"q":"...","a":"..."}]
}

${ANTI_CLICHE}`,
    fallback: {
      metaTitle: `${subcat.name} - Recomandari | TopBuy.ro`,
      metaDescription: `Recomandari ${subcat.name} de la magazine verificate.`,
      h1: subcat.name, intro: '', tips: [], faq: [],
    },
  };
}

function buildSearchIntentJob(intent) {
  const intentType = intent.type;
  let typeHint = '';
  let introGuide = '';
  if (intentType === 'best-of') {
    typeHint = `Pagina de tip "cel mai bun / cele mai bune". Cititorul vrea sa stie CE sa aleaga concret si DE CE.`;
    introGuide = `Primul paragraf RASPUNDE DIRECT la intentia de cautare. Daca cineva cauta "${intent.title}", ce vrea sa afle? Raspunde-i imediat cu o recomandare concreta. Apoi detaliaza criteriile care conteaza.`;
  } else if (intentType === 'top') {
    typeHint = `Pagina de tip "top produse". Cititorul vrea un clasament cu ce merita.`;
    introGuide = `Incepe cu raspunsul: care sunt produsele care merita si de ce. Nu incepe cu "daca vrei" sau "piata e plina de optiuni". Incepe cu RASPUNSUL.`;
  } else if (intentType === 'brand') {
    typeHint = `Pagina dedicata unui brand. Spune ce face brandul bine, pentru cine sunt produsele, ce le diferentiaza concret.`;
    introGuide = `Incepe cu ce e relevant despre acest brand: pentru ce e cunoscut, la ce e bun, pentru cine. Nu incepe cu istoria brandului.`;
  } else {
    typeHint = `Pagina de categorie/cautare. Ajuta pe cineva care cauta exact "${intent.title}".`;
    introGuide = `Primul paragraf raspunde direct: ce gaseste aici cititorul si ce trebuie sa stie inainte sa aleaga.`;
  }

  return {
    cacheKey: `search:${intent.slug}`,
    label: intent.title,
    prompt: `Scrii continut editorial pe TopBuy.ro (site recomandari produse Romania). Stilul e informativ si directionat spre decizie — ajuti cititorul sa aleaga.
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
- intro: keyword-ul "${intent.title}" in primele 10 cuvinte. Fara fluff introductiv`,
    fallback: {
      metaTitle: `${intent.title} - Recomandari | TopBuy.ro`,
      metaDescription: `Recomandari ${intent.title} de la magazine verificate din Romania.`,
      h1: intent.title,
    },
  };
}

// ========== TRUE PARALLEL: INDEPENDENT WORKERS PER KEY ==========
// Each key runs as an independent worker pulling from a shared queue.
// If a key gets 429, only that worker waits - others continue.
async function processJobs(jobs) {
  const pending = jobs.filter(j => !contentCache[j.cacheKey]?.intro);
  const skipped = jobs.length - pending.length;
  totalSkipped += skipped;
  if (skipped > 0) console.log(`  Skipped ${skipped} cached, ${pending.length} to generate`);
  if (pending.length === 0) return;

  let completed = 0;
  let failed = 0;
  let jobQueue = [...pending]; // shared queue
  const total = Math.min(pending.length, apiKeys.length * MAX_CALLS_PER_KEY);

  async function worker(keyIdx) {
    while (!keyExhausted[keyIdx] && callsPerKey[keyIdx] < MAX_CALLS_PER_KEY) {
      const job = jobQueue.shift();
      if (!job) break;

      const resp = await callGeminiWithKey(keyIdx, job.prompt);

      // If key got exhausted during call, put job back
      if (resp === null && keyExhausted[keyIdx]) {
        jobQueue.unshift(job);
        break;
      }

      const parsed = parseJson(resp);

      if (parsed?.intro) {
        contentCache[job.cacheKey] = cleanContentObject(parsed);
        completed++;
      } else if (parsed) {
        // Got JSON but no intro — save what we have + log
        contentCache[job.cacheKey] = cleanContentObject(parsed);
        completed++;
        if (!parsed.intro) console.log(`    [K${keyIdx}] WARN: ${job.cacheKey} — no intro field in response`);
      } else {
        if (!keyExhausted[keyIdx]) {
          failed++;
          if (resp) console.log(`    [K${keyIdx}] PARSE FAIL: ${job.cacheKey} — ${String(resp).substring(0, 120)}`);
          else console.log(`    [K${keyIdx}] NULL resp: ${job.cacheKey}`);
        }
      }

      const done = completed + failed;
      if (done === 1 || done % 10 === 0) {
        saveCache();
        const pct = Math.round(done / total * 100);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const active = keyExhausted.filter(x => !x).length;
        console.log(`  [${pct}%] ${completed} ok / ${failed} fail, ${active}/${apiKeys.length} keys active, ${elapsed}s`);
      }

      await new Promise(r => setTimeout(r, DELAY_BETWEEN_CALLS_MS));
    }
  }

  // Start all workers with stagger (200ms apart)
  const workers = apiKeys.map((_, idx) =>
    new Promise(r => setTimeout(r, idx * 250)).then(() => worker(idx))
  );
  await Promise.all(workers);

  saveCache();
  console.log(`  Done: ${completed} ok, ${failed} fail, ${totalApiCalls} API calls`);
}

// ========== MAIN ==========
const startTime = Date.now();
console.log(`\n=== GENERATING SEO CONTENT (${MODEL}, ${apiKeys.length} keys, PARALLEL) ===\n`);

// Build ALL jobs
const allJobs = [];

// 1. Homepage
allJobs.push(buildHomepageJob());

// 2. Mega categories
for (const [slug, cat] of Object.entries(structure.megaCategories)) {
  allJobs.push(buildMegaCategoryJob(slug, cat));
}

// 3. Top 15 subcategories per mega
for (const [megaSlug, cat] of Object.entries(structure.megaCategories)) {
  const topSubs = cat.subcategories.slice(0, 15);
  for (const sub of topSubs) {
    allJobs.push(buildSubcategoryJob(megaSlug, sub, cat.name));
  }
}

// 4. All search intents
const intentsPath = join(DATA_DIR, 'search-intents.json');
let intents = [];
if (existsSync(intentsPath)) {
  intents = JSON.parse(readFileSync(intentsPath, 'utf-8')).intents;
  for (const intent of intents) {
    allJobs.push(buildSearchIntentJob(intent));
  }
}

const needGen = allJobs.filter(j => !contentCache[j.cacheKey]?.intro).length;
console.log(`Total jobs: ${allJobs.length}`);
console.log(`Already cached: ${allJobs.length - needGen}`);
console.log(`Need to generate: ${needGen}`);
console.log(`Workers: ${apiKeys.length} (parallel)`);
const maxThisRun = apiKeys.length * MAX_CALLS_PER_KEY;
const willGen = Math.min(needGen, maxThisRun);
const estSeconds = Math.ceil(willGen / apiKeys.length) * (DELAY_BETWEEN_CALLS_MS / 1000);
console.log(`Max this run: ${maxThisRun} (${MAX_CALLS_PER_KEY}/key x ${apiKeys.length} keys)`);
console.log(`Will generate: ~${willGen} (remaining ${needGen - willGen} for next run)`);
console.log(`Estimated time: ~${Math.ceil(estSeconds / 60)} min\n`);

// Process all jobs in batched rounds (20 concurrent per round)
await processJobs(allJobs);

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
const totalEntries = Object.keys(contentCache).length;
const withIntro = Object.values(contentCache).filter(v => v.intro).length;
const stillThin = Object.keys(contentCache).filter(k => !contentCache[k].intro).length;
const keysUsed = callsPerKey.filter(c => c > 0).length;
const keysExhausted = keyExhausted.filter(x => x).length;
console.log(`\n=== DONE ===`);
console.log(`Total entries: ${totalEntries} (${withIntro} with full content, ${stillThin} thin)`);
console.log(`API calls this run: ${totalApiCalls}`);
console.log(`Keys used: ${keysUsed}, exhausted (daily limit): ${keysExhausted}`);
console.log(`Calls per key: [${callsPerKey.join(', ')}]`);
console.log(`Skipped (cached): ${totalSkipped}`);
console.log(`Time: ${elapsed}s (${(elapsed / 60).toFixed(1)} min)`);
console.log(`\nRemaining to generate: ${allJobs.filter(j => !contentCache[j.cacheKey]?.intro).length}`);
console.log(`Run this script again tomorrow to continue.`);
