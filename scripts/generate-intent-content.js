import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const CONTENT_PATH = join(DATA_DIR, 'content', 'seo-content.json');

const API_KEY = 'sk-62fa26ecca5648a48ffe24f5e2896c81';
const API_URL = 'https://api.deepseek.com/chat/completions';
const CONCURRENCY = 300;
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
        max_tokens: 1000, temperature: 0.75,
      }),
    });
    if (res.status === 429) {
      await sleep(10000);
      if (retries < MAX_RETRIES) return callDeepSeek(system, user, retries + 1);
      return null;
    }
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

const INTENT_PROMPTS = {

'best-of': `Userul cauta CELE MAI BUNE produse. Vrea sa stie ce merita si de ce.
Scrie 3-4 paragrafe (150-200 cuvinte):
P1: Raspunde direct - pe ce criterii se judeca ce e "cel mai bun" in aceasta categorie. Numere concrete.
P2: Ce diferentiaza un produs bun de unul mediocru. Specificatii care conteaza.
P3: Greseli frecvente. Ce ignora lumea cand alege.
P4 (optional): Un sfat practic din experienta.`,

'top': `Userul cauta un TOP de produse. Vrea sa vada ce e popular si merita atentia.
Scrie 3-4 paragrafe (150-200 cuvinte):
P1: Ce inseamna "top" la acest tip de produs. Ce criterii conteaza.
P2: Diferente intre gama entry-level si cea premium. Cu numere.
P3: La ce sa fie atent cand alege. Un detaliu tehnic important.
P4 (optional): Ce brand sau tip ofera cel mai bun raport calitate-pret.`,

'cheap': `Userul cauta produse IEFTINE. Are buget limitat, vrea cel mai mult pentru banii lui.
Scrie 3-4 paragrafe (150-200 cuvinte):
P1: Ce gasesti realistic la pret mic. La ce te poti astepta ca specificatii.
P2: La ce sa NU faci compromis chiar daca iei ieftin. O specificatie critica, cu numar.
P3: Diferenta de pret intre magazine pentru acelasi produs. De ce merita sa verifici.
P4 (optional): Un tip concret de produs care ofera mult la bani putini.`,

'budget': `Userul cauta produse la un BUGET FIX (sub X lei). Stie cat vrea sa dea.
Scrie 3-4 paragrafe (150-200 cuvinte):
P1: Ce optiuni concrete exista la acest buget. Ce specificatii sunt realiste.
P2: Ce branduri sau modele se gasesc in aceasta gama de pret.
P3: Merita sa mai adauge putin? Ce castiga cu 20-30% buget in plus.
P4 (optional): Un sfat de timing - reduceri, oferte sezoniere.`,

'review': `Userul cauta PARERI. Vrea sa stie daca un produs merita inainte sa cumpere.
Scrie 3-4 paragrafe (150-200 cuvinte):
P1: Ce trebuie sa verifice la acest tip de produs. Criterii obiective, cu numere.
P2: Puncte forte tipice si puncte slabe frecvente la aceasta categorie de produse.
P3: La ce sa fie atent in recenzii - ce e relevant si ce e subiectiv.
P4 (optional): Un detaliu pe care recenziile il omit de obicei.`,

'guide': `Userul NU STIE ce sa aleaga. E la inceput si are nevoie de directie.
Scrie 3-4 paragrafe (150-200 cuvinte):
P1: Prima intrebare pe care trebuie sa si-o puna (utilizare, spatiu, buget, frecventa).
P2: Criteriul nr. 1 de alegere, explicat simplu. Cu un numar concret.
P3: Criteriul nr. 2. Alt aspect important cu detalii practice.
P4 (optional): Un sfat pe care l-ar da cineva care a cumparat deja.`,

'comparison': `Userul compara optiuni. Vrea sa inteleaga diferentele.
Scrie 3-4 paragrafe (150-200 cuvinte):
P1: Ce diferentiaza optiunile din aceasta categorie. Criterii concrete.
P2: Pentru cine e mai buna fiecare varianta. Scenarii de utilizare.
P3: Ce conteaza mai mult - pretul, specificatiile, sau brandul. Un raspuns sincer.
P4 (optional): Ce ar alege cineva cu experienta si de ce.`,

'product': `Userul cauta informatii despre un tip de produs.
Scrie 3-4 paragrafe (150-200 cuvinte):
P1: Ce e acest produs concret, pentru ce se foloseste, cine il cumpara de obicei.
P2: Criteriile importante de alegere. Numere, specificatii, materiale.
P3: La ce sa fie atent la pret si la oferte. Ce variaza intre magazine.
P4 (optional): Un sfat practic bazat pe utilizare reala.`,
};

const SYSTEM_PROMPT = `Scrii texte pentru pagini de produse pe TopBuy.ro. Fiecare text raspunde DIRECT la ce cauta userul pe Google.

IMPORTANT - ASTA E CEL MAI IMPORTANT LUCRU:
Textul trebuie sa sune ca un om care stie despre produse si raspunde unui prieten. Nu ca un site, nu ca un robot, nu ca o reclama.

STIL:
- Propozitii scurte. Max 15-20 cuvinte. Majoritatea sub 12.
- Fara paranteze explicative. Fara enumerari lungi.
- Ton calm, direct. Ca o conversatie.
- Concret: numere, specificatii, exemple. Nu generic.
- 3-4 paragrafe, separate cu \\n

INTERZIS (daca folosesti oricare din astea, textul e respins):
- "fie ca", "intr-o lume", "nu doar ci si", "de la pana la"
- "cu siguranta", "transforma", "revolutionar", "impresionant"
- "excelent", "perfect", "ideal", "remarcabil", "deosebit"
- "o alegere", "gama larga", "o multime de", "varietate"
- orice cuvant cu "compar" (comparare, compara etc)
- "ghid", "ghiduri", "feeduri", "partenere", "afiliere"
- ton promotional, exagerari, superlatve false
- emoji

DOAR romana, FARA diacritice.

Raspunde DOAR cu JSON valid:
{
  "metaTitle": "exact cautarea userului + - Recomandari 2026 | TopBuy.ro",
  "metaDescription": "max 155 char, raspunde la intentia userului",
  "intro": "150-200 cuvinte, 3-4 paragrafe separate cu \\n"
}`;

// ========== MAIN ==========
const suggestions = JSON.parse(readFileSync(join(DATA_DIR, 'google-suggestions.json'), 'utf-8')).suggestions;
const content = JSON.parse(readFileSync(CONTENT_PATH, 'utf-8'));

const jobs = suggestions.filter(s => {
  const key = `search:${s.slug}`;
  const existing = content[key]?.intro || '';
  return existing.split(/\s+/).length < 100;
});

console.log(`Total intents: ${suggestions.length}`);
console.log(`Need content: ${jobs.length}`);
console.log(`Already have: ${suggestions.length - jobs.length}`);
console.log(`Estimated cost: ~$${(jobs.length * 500 * 0.42 / 1000000).toFixed(2)}\n`);

let completed = 0, errors = 0;
const startTime = Date.now();

async function processJob(job) {
  const intentPrompt = INTENT_PROMPTS[job.type] || INTENT_PROMPTS['product'];
  const userMsg = `Cautare Google: "${job.title}"
Categorie: ${job.megaCategory}
Produse disponibile: ${job.productCount}
Tip intent: ${job.type}

${intentPrompt}`;

  const response = await callDeepSeek(SYSTEM_PROMPT, userMsg);
  if (!response) { errors++; return; }

  const parsed = parseJSON(response);
  if (!parsed?.intro) { errors++; return; }

  let intro = parsed.intro;
  intro = intro.replace(/[Cc]ompar[aă]\w*/g, 'verifica');
  intro = intro.replace(/ghid(uri)?/gi, 'recomandari');

  content[`search:${job.slug}`] = {
    metaTitle: `${job.title} - Recomandari ${new Date().getFullYear()} | TopBuy.ro`,
    metaDescription: parsed.metaDescription || '',
    h1: job.title,
    intro,
  };
  completed++;
}

async function run() {
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(processJob));

    if ((i + CONCURRENCY) % 1000 < CONCURRENCY) {
      writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2));
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = (completed / (elapsed / 60)).toFixed(0);
      console.log(`[${completed}/${jobs.length}] ${errors} errors, ${elapsed}s, ${rate}/min`);
    }
    await sleep(DELAY_MS);
  }

  writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2));
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\nDone: ${completed} generated, ${errors} errors, ${elapsed}s`);

  const intros = Object.entries(content)
    .filter(([k]) => k.startsWith('search:'))
    .map(([, v]) => v.intro?.split(/\s+/).length || 0);
  console.log(`Avg words: ${(intros.reduce((a, b) => a + b, 0) / intros.length).toFixed(0)}`);
  console.log(`Min: ${Math.min(...intros)}, Max: ${Math.max(...intros)}`);
}

run().catch(console.error);
