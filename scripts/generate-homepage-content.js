import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_PATH = join(__dirname, '..', 'public', 'data', 'content', 'seo-content.json');
const API_KEY = 'sk-62fa26ecca5648a48ffe24f5e2896c81';

const res = await fetch('https://api.deepseek.com/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: `Esti un copywriter roman pragmatic. Scrii pentru homepage-ul TopBuy.ro, un site de RECOMANDARE produse (NU comparare, NU motor de cautare). Site-ul aduna produse de la magazine romanesti si le recomanda pe categorii.

OBLIGATORIU:
- DOAR romana, FARA diacritice
- INTERZIS: "fie ca", "intr-o lume", "nu doar...ci si", "transforma", "revolutionar", "impresionant", "excelent", "perfect", "ideal", "ghid", "ghiduri"
- Nu folosi cuvantul "compara" sau "comparare" - site-ul RECOMANDA, nu compara
- INTERZIS ton promotional. Fara emoji.
- Raspunde DOAR cu JSON valid, fara markdown.` },
      { role: 'user', content: `Genereaza content pentru homepage-ul TopBuy.ro.

TopBuy.ro e un site de RECOMANDARE produse. Aduna peste 845.000 de produse din 94 de magazine romanesti verificate (partenere 2Performant) si le organizeaza pe categorii. Cand utilizatorul gaseste ceva, e trimis direct pe site-ul magazinului sa cumpere. Preturile se actualizeaza zilnic din feedurile magazinelor.

12 categorii: Electronice & IT, Casa & Gradina, Fashion, Copii & Jucarii, Auto & Moto, Sport, Pescuit & Vanatoare, Sanatate & Frumusete, Carti & Birou, Alimentare & Bauturi, Animale de Companie, Alte Produse.

JSON:
{
  "metaTitle": "TopBuy.ro - Produse recomandate din 94 magazine (max 60 char)",
  "metaDescription": "max 155 char",
  "h1": "titlu scurt si clar, fara comparare",
  "tagline": "max 15 cuvinte sub h1, despre recomandare nu comparare",
  "intro": "300-400 cuvinte, 4 paragrafe separate cu \\n. P1: ce e TopBuy.ro - site de recomandare, nu magazin, aduna produse din 94 magazine. P2: cum functioneaza - feeduri zilnice, organizare pe categorii, redirect catre magazin. P3: ce categorii acopera cu exemple concrete. P4: de ce e util - economisesti timp, vezi produse din mai multe magazine intr-un singur loc.",
  "faq": [
    {"q": "Ce este TopBuy.ro?", "a": "raspuns concret - site de recomandare"},
    {"q": "Pot cumpara direct de pe TopBuy.ro?", "a": "nu, redirect catre magazin"},
    {"q": "Cat de actualizate sunt preturile?", "a": "zilnic"},
    {"q": "Ce magazine sunt listate?", "a": "94 magazine prin 2Performant"},
    {"q": "Este gratuit sa folosesc TopBuy.ro?", "a": "da"}
  ]
}` }
    ],
    max_tokens: 2000,
    temperature: 0.7,
  }),
});

const data = await res.json();
const text = data.choices[0].message.content;
const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

const content = JSON.parse(readFileSync(CONTENT_PATH, 'utf-8'));
let parsed;
try { parsed = JSON.parse(cleaned); } catch { const m = text.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; }

if (parsed?.intro) {
  content['homepage'] = parsed;
  writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2));
  console.log('Homepage saved!');
  console.log(`  Intro: ${parsed.intro.split(/\s+/).length} words`);
  console.log(`  FAQ: ${parsed.faq?.length}`);
  console.log(`  H1: ${parsed.h1}`);
  console.log(`  Tagline: ${parsed.tagline}`);
} else {
  console.error('Parse failed:', text.substring(0, 500));
}
