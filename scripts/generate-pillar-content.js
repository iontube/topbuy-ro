import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const CONTENT_PATH = join(DATA_DIR, 'content', 'seo-content.json');

const API_KEY = 'sk-62fa26ecca5648a48ffe24f5e2896c81';
const API_URL = 'https://api.deepseek.com/chat/completions';

async function callDeepSeek(system, user) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: 4000,
      temperature: 0.8,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

function parseJSON(text) {
  try {
    return JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) try { return JSON.parse(m[0]); } catch {}
    return null;
  }
}

const structure = JSON.parse(readFileSync(join(DATA_DIR, 'site-structure.json'), 'utf-8'));
const content = JSON.parse(readFileSync(CONTENT_PATH, 'utf-8'));

const SYSTEM = `Esti un editor roman care scrie pentru TopBuy.ro, un site de recomandare produse. Scrii ca un prieten care stie multe despre produse si explica simplu.

STIL DE SCRIERE - FOARTE IMPORTANT:
- Propozitii SCURTE. Maximum 15-20 cuvinte per propozitie.
- Fara paranteze explicative. Daca vrei sa explici ceva, fa o propozitie separata.
- Fara enumerari lungi in text. Maxim 3 elemente in aceeasi propozitie.
- Tonul e calm si direct. Ca si cum vorbesti cu cineva la o cafea.
- Paragrafe de 3-5 propozitii, nu mai mult.

CONTINUT:
- Scrie DOAR in romana, FARA diacritice
- NU mentiona: feeduri, partenere, afiliere, 2Performant, ghiduri
- NU folosi: "fie ca", "intr-o lume", "nu doar ci si", "de la pana la", "cu siguranta", "transforma", "revolutionar", "impresionant", "excelent", "perfect", "ideal", "gama larga", "o multime de"
- NU folosi cuvantul "comparare" sau "compara" - site-ul RECOMANDA produse
- Fii concret: numere, specificatii, exemple reale
- Fara emoji, fara ton promotional

Raspunde DOAR cu JSON valid:
{
  "metaTitle": "max 60 caractere, fara TopBuy.ro",
  "metaDescription": "max 155 caractere",
  "h1": "titlu scurt, 2-4 cuvinte",
  "intro": "MINIM 350 CUVINTE. 5 paragrafe scurte separate cu \\n. Fiecare paragraf are 3-5 propozitii scurte. P1: ce gasesti in aceasta categorie, cate produse. P2: ce se cauta cel mai mult si de ce. P3: la ce sa fii atent cand alegi - criterii concrete, numere. P4: cum e organizat totul pe site. P5: de ce merita sa verifici mai multe magazine.",
  "tips": ["sfat scurt si concret", "sfat 2", "sfat 3", "sfat 4", "sfat 5"],
  "faq": [
    {"q": "intrebare scurta 1", "a": "raspuns direct in 2-3 propozitii scurte"},
    {"q": "intrebare 2", "a": "raspuns"},
    {"q": "intrebare 3", "a": "raspuns"},
    {"q": "intrebare 4", "a": "raspuns"},
    {"q": "intrebare 5", "a": "raspuns"}
  ]
}`;

async function run() {
  const categories = Object.entries(structure.megaCategories);
  console.log(`Generating pillar content for ${categories.length} categories...\n`);

  // Run all 12 in parallel
  const results = await Promise.all(categories.map(async ([slug, cat]) => {
    const topSubcats = cat.subcategories
      .filter(s => s.count >= 50)
      .slice(0, 15)
      .map(s => s.name)
      .join(', ');

    const topBrands = (cat.topBrands || []).slice(0, 10).map(b => b.name).join(', ');

    const userPrompt = `Categorie: "${cat.name}"
Total produse: ${cat.totalProducts.toLocaleString('ro')}
Subcategorii: ${cat.subcategories.length}
Top subcategorii: ${topSubcats}
Top branduri: ${topBrands}

IMPORTANT: Intro-ul trebuie sa aiba MINIM 350 de cuvinte. Scrie 5 paragrafe consistente, fiecare cu 4-6 propozitii scurte. Aceasta e pagina principala a categoriei - trebuie sa fie cea mai bogata in continut de pe site. Subcategoriile au ~300 cuvinte, deci pillar-ul trebuie sa aiba mai mult.`;

    console.log(`  Generating: ${slug}...`);
    const response = await callDeepSeek(SYSTEM, userPrompt);
    if (!response) { console.error(`  FAILED: ${slug}`); return null; }

    const parsed = parseJSON(response);
    if (!parsed?.intro) { console.error(`  PARSE FAILED: ${slug}`); return null; }

    const words = parsed.intro.split(/\s+/).length;
    console.log(`  Done: ${slug} - ${words} words intro, ${parsed.faq?.length} FAQ, ${parsed.tips?.length} tips`);
    return { slug, data: parsed };
  }));

  // Save
  for (const r of results) {
    if (r) content[r.slug] = r.data;
  }
  writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2));
  console.log('\nAll saved!');
}

run().catch(console.error);
