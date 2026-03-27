import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = join(__dirname, '..', 'public', 'data', 'content', 'seo-content.json');
const cache = JSON.parse(readFileSync(path, 'utf-8'));

function stripCliches(text) {
  if (!text || typeof text !== 'string') return text;
  const r = [
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
    [/\bSalut!\s*/gi, ''],
    [/\bSalut,?\s*/gi, ''],
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
    [/\bse adreseaza celor care\b/gi, 'e pentru cei care'],
    [/\bse adreseaza\b/gi, 'e pentru'],
    [/\bjoaca un rol\b/gi, 'conteaza'],
    [/\bofera o experienta\b/gi, 'ofera'],
    [/\bo optiune viabila\b/gi, 'o varianta'],
    [/\bo optiune solida\b/gi, 'o varianta buna'],
    [/\bo optiune excelenta\b/gi, 'o varianta buna'],
    [/\bo alegere excelenta\b/gi, 'o varianta buna'],
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
    [/\bte ajuta sa\b/gi, 'iti arata cum sa'],
    [/\bdescopera\b/gi, 'vezi'],
    [/\bghidul tau\b/gi, 'recomandari'],
    [/\bghid complet\b/gi, 'recomandari'],
  ];
  for (const [p, rep] of r) text = text.replace(p, rep);
  text = text.replace(/\s{2,}/g, ' ');
  text = text.replace(/\.\s+([a-z])/g, (_, c) => '. ' + c.toUpperCase());
  return text.trim();
}

function clean(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(i => typeof i === 'string' ? stripCliches(i) : typeof i === 'object' ? clean(i) : i);
  const c = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') c[k] = stripCliches(v);
    else if (typeof v === 'object') c[k] = clean(v);
    else c[k] = v;
  }
  return c;
}

let fixed = 0;
for (const [key, val] of Object.entries(cache)) {
  const before = JSON.stringify(val);
  cache[key] = clean(val);
  if (JSON.stringify(cache[key]) !== before) fixed++;
}

writeFileSync(path, JSON.stringify(cache, null, 2));
console.log(`Cleaned ${fixed} entries out of ${Object.keys(cache).length}`);

// Verify
const bad = ['ghidul tau', 'ghid complet', 'descopera', 'te ajuta sa', 'fie ca', 'intr-o lume', 'in era', 'salut!'];
let remaining = 0;
for (const [key, val] of Object.entries(cache)) {
  const text = JSON.stringify(val).toLowerCase();
  const found = bad.filter(b => text.includes(b));
  if (found.length > 0) { remaining++; console.log(`  STILL: ${key} -> ${found.join(', ')}`); }
}
console.log(`Remaining with cliches: ${remaining}`);
