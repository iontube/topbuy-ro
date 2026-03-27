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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callDeepSeek(system, user, retries = 0) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        max_tokens: 400, temperature: 0.7,
      }),
    });
    if (res.status === 429) { await sleep(10000); if (retries < 3) return callDeepSeek(system, user, retries + 1); return null; }
    if (!res.ok) { if (retries < 3) { await sleep(2000); return callDeepSeek(system, user, retries + 1); } return null; }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch {
    if (retries < 3) { await sleep(2000); return callDeepSeek(system, user, retries + 1); }
    return null;
  }
}

function parseJSON(text) {
  try { return JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()); }
  catch { const m = text.match(/\{[\s\S]*\}/); if (m) try { return JSON.parse(m[0]); } catch {} return null; }
}

function strip(t) {
  if (!t || typeof t !== 'string') return '';
  return t.replace(/[ăĂ]/g,'a').replace(/[âÂ]/g,'a').replace(/[îÎ]/g,'i').replace(/[șşȘŞ]/g,'s').replace(/[țţȚŢ]/g,'t');
}

const SYSTEM = `Scrii un text scurt despre un brand de produse pentru TopBuy.ro.

STIL:
- 2-3 propozitii scurte (60-80 cuvinte). Ce produce brandul, pentru cine e, ce il diferentiaza.
- Ton direct, fara clisee, fara ton promotional
- DOAR romana, FARA diacritice
- Daca nu cunosti brandul, scrie generic: ce tip de produse ofera si pentru cine sunt

Raspunde DOAR cu JSON:
{
  "metaDescription": "max 155 char",
  "intro": "60-80 cuvinte, 2-3 propozitii"
}`;

const brands = JSON.parse(readFileSync(join(DATA_DIR, 'brand-index.json'), 'utf-8'));
const content = JSON.parse(readFileSync(CONTENT_PATH, 'utf-8'));

const jobs = brands.filter(b => !content[`brand:${b.slug}`]?.intro);
console.log(`Total brands: ${brands.length}`);
console.log(`Need content: ${jobs.length}`);
console.log(`Cost: ~$${(jobs.length * 200 * 0.42 / 1000000).toFixed(2)}\n`);

let completed = 0, errors = 0;
const startTime = Date.now();

async function processJob(b) {
  const response = await callDeepSeek(SYSTEM, `Brand: "${b.name}" (${b.productCount} produse)`);
  if (!response) { errors++; return; }
  const parsed = parseJSON(response);
  if (!parsed?.intro) { errors++; return; }
  content[`brand:${b.slug}`] = {
    metaDescription: strip(parsed.metaDescription || ''),
    intro: strip(parsed.intro || ''),
  };
  completed++;
}

async function run() {
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(processJob));
    if ((i + CONCURRENCY) % 1000 < CONCURRENCY) {
      writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2));
      console.log(`[${completed}/${jobs.length}] ${errors} errors, ${((Date.now()-startTime)/1000).toFixed(0)}s`);
    }
    await sleep(DELAY_MS);
  }
  writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2));
  console.log(`\nDone: ${completed} generated, ${errors} errors, ${((Date.now()-startTime)/1000).toFixed(0)}s`);
}

run().catch(console.error);
