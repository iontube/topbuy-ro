import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const CONTENT_PATH = join(DATA_DIR, 'content', 'seo-content.json');

const API_KEY = 'sk-62fa26ecca5648a48ffe24f5e2896c81';
const API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-chat';
const CONCURRENCY = 200;      // parallel requests
const DELAY_MS = 200;          // delay between batches
const MAX_RETRIES = 3;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callDeepSeek(systemPrompt, userPrompt, retries = 0) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (res.status === 429) {
      console.warn(`  Rate limited, waiting 10s...`);
      await sleep(10000);
      if (retries < MAX_RETRIES) return callDeepSeek(systemPrompt, userPrompt, retries + 1);
      return null;
    }

    if (!res.ok) {
      console.error(`  API error ${res.status}: ${await res.text()}`);
      if (retries < MAX_RETRIES) { await sleep(2000); return callDeepSeek(systemPrompt, userPrompt, retries + 1); }
      return null;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error(`  Fetch error: ${e.message}`);
    if (retries < MAX_RETRIES) { await sleep(2000); return callDeepSeek(systemPrompt, userPrompt, retries + 1); }
    return null;
  }
}

function parseJSON(text) {
  // Try to extract JSON from the response
  try {
    // Remove markdown code fences if present
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    // Try to find JSON object in text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return null;
  }
}

// ========== MAIN ==========
const structure = JSON.parse(readFileSync(join(DATA_DIR, 'site-structure.json'), 'utf-8'));
const content = JSON.parse(readFileSync(CONTENT_PATH, 'utf-8'));

// Collect all subcategories that need content
const jobs = [];
for (const [megaSlug, cat] of Object.entries(structure.megaCategories)) {
  for (const sub of cat.subcategories) {
    const key = `sub:${megaSlug}/${sub.slug}`;
    // Regenerate all - force rewrite
    // const existingWords = (content[key]?.intro || '').split(/\s+/).length;
    // if (existingWords >= 180) continue;
    jobs.push({ megaSlug, megaName: cat.name, sub, key });
  }
}

console.log(`Subcategories needing content: ${jobs.length}`);
console.log(`Already have content: ${Object.keys(content).filter(k => k.startsWith('sub:')).length}`);
console.log(`Estimated cost: ~$${(jobs.length * 400 * 1.1 / 1000000).toFixed(2)} (output tokens)\n`);

const SYSTEM_PROMPT = `Scrii texte scurte pentru pagini de subcategorie pe TopBuy.ro, un site de recomandare produse.

STIL:
- Propozitii SCURTE. Max 15-20 cuvinte per propozitie.
- Fara paranteze explicative.
- Ton calm si direct. Ca un prieten care stie despre produse.
- 3 paragrafe scurte, fiecare cu 3-4 propozitii.

REGULI:
- DOAR romana, FARA diacritice
- NU mentiona: feeduri, partenere, afiliere, ghiduri, comparare, compara
- INTERZIS: "fie ca", "intr-o lume", "nu doar ci si", "de la pana la", "cu siguranta", "transforma", "revolutionar", "impresionant", "excelent", "perfect", "ideal", "gama larga", "o multime de", "o alegere"
- Daca numele e in engleza, traduce-l
- Daca numele e generic, scrie ceva sensibil bazat pe categoria parinte
- Fara emoji, fara ton promotional

Raspunde DOAR cu JSON valid:
{
  "metaTitle": "max 60 caractere",
  "metaDescription": "max 155 caractere",
  "h1": "titlu scurt in romana",
  "intro": "120-170 cuvinte. 3 paragrafe separate cu \\n. P1: ce produse gasesti aici concret (3-4 propozitii scurte). P2: la ce sa fii atent - criterii concrete cu numere (3-4 propozitii). P3: sfat practic sau observatie utila (2-3 propozitii).",
  "tips": ["sfat scurt si concret", "sfat 2", "sfat 3"]
}`;

let completed = 0;
let errors = 0;
const startTime = Date.now();

async function processJob(job) {
  const { megaSlug, megaName, sub, key } = job;

  const userPrompt = `Subcategorie: "${sub.name}"
Categorie parinte: "${megaName}"
Numar produse: ${sub.count}
Slug URL: /${megaSlug}/${sub.slug}/`;

  const response = await callDeepSeek(SYSTEM_PROMPT, userPrompt);
  if (!response) {
    errors++;
    return;
  }

  const parsed = parseJSON(response);
  if (!parsed || !parsed.intro) {
    console.error(`  Failed to parse response for ${key}`);
    errors++;
    return;
  }

  content[key] = parsed;
  completed++;
}

async function run() {
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(processJob));

    // Save progress every 50
    if ((i + CONCURRENCY) % 50 < CONCURRENCY) {
      writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2));
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = (completed / (elapsed / 60)).toFixed(1);
      console.log(`[${completed}/${jobs.length}] ${errors} errors, ${elapsed}s elapsed, ${rate}/min`);
    }

    await sleep(DELAY_MS);
  }

  // Final save
  writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2));
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\nDone: ${completed} generated, ${errors} errors, ${elapsed}s total`);
}

run().catch(console.error);
