import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const CONTENT_PATH = join(DATA_DIR, 'content', 'seo-content.json');

const API_KEY = 'sk-62fa26ecca5648a48ffe24f5e2896c81';
const API_URL = 'https://api.deepseek.com/chat/completions';
const CONCURRENCY = 400;
const DELAY_MS = 200;
const MAX_RETRIES = 3;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callDeepSeek(system, user, retries = 0) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        max_tokens: 1500, temperature: 0.75,
      }),
    });
    if (res.status === 429) { await sleep(10000); if (retries < MAX_RETRIES) return callDeepSeek(system, user, retries + 1); return null; }
    if (!res.ok) { if (retries < MAX_RETRIES) { await sleep(2000); return callDeepSeek(system, user, retries + 1); } return null; }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch {
    if (retries < MAX_RETRIES) { await sleep(2000); return callDeepSeek(system, user, retries + 1); }
    return null;
  }
}

function parseJSON(text) {
  try { return JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()); }
  catch { const m = text.match(/\{[\s\S]*\}/); if (m) try { return JSON.parse(m[0]); } catch {} return null; }
}

const INTENT_CONTEXT = {
  'best-of': 'Userul vrea sa stie care sunt cele mai bune produse si pe ce criterii sa aleaga.',
  'top': 'Userul vrea un clasament - ce e popular si de ce merita atentia lui.',
  'cheap': 'Userul are buget limitat. Vrea cel mai mult pentru banii lui.',
  'budget': 'Userul stie cat vrea sa cheltuiasca. Cauta optiuni la un pret fix.',
  'review': 'Userul vrea pareri sincere. Cauta puncte forte si slabe inainte sa cumpere.',
  'guide': 'Userul nu stie ce sa aleaga. E la inceput si are nevoie de directie clara.',
  'comparison': 'Userul compara doua optiuni. Vrea sa inteleaga diferentele concrete.',
  'product': 'Userul cauta informatii despre un tip de produs.',
};

const SYSTEM = `Generezi sectiuni suplimentare pentru o pagina de produse pe TopBuy.ro.

STIL - FOARTE IMPORTANT:
- Propozitii scurte. Max 15 cuvinte per propozitie.
- Ton calm si direct. Vorbesti ca un prieten care stie despre produse.
- Fii concret: numere, specificatii, exemple. Nu generic.
- ZERO clisee: "fie ca", "intr-o lume", "nu doar ci si", "cu siguranta", "transforma", "ideal", "perfect", "excelent"
- ZERO ton promotional
- DOAR romana, FARA diacritice
- NU mentiona: feeduri, partenere, afiliere, comparare, ghid, ghiduri

Raspunde DOAR cu JSON valid:
{
  "guide": "3-4 paragrafe (150-200 cuvinte) despre cum sa aleaga userul. Fiecare paragraf cu 3-4 propozitii scurte. Separa cu \\n. P1: primul criteriu important cu numere. P2: al doilea criteriu. P3: ce greseli sa evite. P4: un sfat practic din experienta.",
  "pros": ["avantaj concret 1 cu specificatie", "avantaj 2", "avantaj 3"],
  "cons": ["dezavantaj sau compromis 1", "dezavantaj 2", "dezavantaj 3"],
  "faq": [
    {"q": "intrebare scurta pe care ar pune-o userul", "a": "raspuns direct in 2-3 propozitii scurte"},
    {"q": "intrebare 2", "a": "raspuns"},
    {"q": "intrebare 3", "a": "raspuns"}
  ]
}`;

// ========== MAIN ==========
const suggestions = JSON.parse(readFileSync(join(DATA_DIR, 'google-suggestions.json'), 'utf-8')).suggestions;
const content = JSON.parse(readFileSync(CONTENT_PATH, 'utf-8'));

const jobs = suggestions.filter(s => {
  const key = `search:${s.slug}`;
  return !content[key]?.guide;
});

console.log(`Total intents: ${suggestions.length}`);
console.log(`Need extras: ${jobs.length}`);
console.log(`Already have: ${suggestions.length - jobs.length}`);
console.log(`Estimated cost: ~$${(jobs.length * 800 * 0.42 / 1000000).toFixed(2)}\n`);

let completed = 0, errors = 0;
const startTime = Date.now();

async function processJob(job) {
  const ctx = INTENT_CONTEXT[job.type] || INTENT_CONTEXT['product'];
  const userMsg = `Cautare: "${job.title}"
Categorie: ${job.megaCategory}
Tip: ${job.type}
Context: ${ctx}

Genereaza sectiunile pentru aceasta pagina.`;

  const response = await callDeepSeek(SYSTEM, userMsg);
  if (!response) { errors++; return; }

  const parsed = parseJSON(response);
  if (!parsed?.guide) { errors++; return; }

  // Strip diacritics
  function strip(t) {
    if (!t || typeof t !== 'string') return '';
    return t.replace(/[ăĂ]/g,'a').replace(/[âÂ]/g,'a').replace(/[îÎ]/g,'i').replace(/[șşȘŞ]/g,'s').replace(/[țţȚŢ]/g,'t');
  }

  const key = `search:${job.slug}`;
  if (!content[key]) content[key] = {};
  content[key].guide = strip(parsed.guide || '');
  content[key].pros = (parsed.pros || []).map(strip);
  content[key].cons = (parsed.cons || []).map(strip);
  content[key].faq = (parsed.faq || []).map(f => ({ q: strip(f.q), a: strip(f.a) }));
  completed++;
}

async function run() {
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(processJob));

    if ((i + CONCURRENCY) % 1000 < CONCURRENCY) {
      writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2));
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`[${completed}/${jobs.length}] ${errors} errors, ${elapsed}s`);
    }
    await sleep(DELAY_MS);
  }

  writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2));
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\nDone: ${completed} generated, ${errors} errors, ${elapsed}s`);
}

run().catch(console.error);
