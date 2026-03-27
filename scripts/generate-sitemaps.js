import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const OUT_DIR = join(ROOT, 'public');
const URLS_PER_SITEMAP = 200;

const structure = JSON.parse(readFileSync(join(DATA_DIR, 'site-structure.json'), 'utf-8'));

let allIntents = [];
const suggestPath = join(DATA_DIR, 'google-suggestions.json');
if (existsSync(suggestPath)) {
  allIntents = JSON.parse(readFileSync(suggestPath, 'utf-8')).suggestions || [];
}

const stores = JSON.parse(readFileSync(join(DATA_DIR, 'stores.json'), 'utf-8'));

// Collect ALL URLs with priority
const allUrls = [];

// Homepage
allUrls.push({ loc: 'https://topbuy.ro/', priority: '1.0', changefreq: 'daily' });

// Store pages
allUrls.push({ loc: 'https://topbuy.ro/magazine/', priority: '0.7', changefreq: 'weekly' });
for (const s of stores) {
  allUrls.push({ loc: `https://topbuy.ro/magazine/${s.slug}/`, priority: '0.5', changefreq: 'weekly' });
}

// Brand pages
const brandIndex = JSON.parse(readFileSync(join(DATA_DIR, 'brand-index.json'), 'utf-8'));
allUrls.push({ loc: 'https://topbuy.ro/brand/', priority: '0.7', changefreq: 'weekly' });
for (const b of brandIndex) {
  allUrls.push({ loc: `https://topbuy.ro/brand/${b.slug}/`, priority: '0.5', changefreq: 'weekly' });
}

// Pillar pages
for (const [slug, cat] of Object.entries(structure.megaCategories)) {
  allUrls.push({ loc: `https://topbuy.ro/${slug}/`, priority: '0.9', changefreq: 'weekly' });

  // Subcategories
  const subcats = cat.subcategories.filter(s => s.count >= 10 && s.name.length > 3).slice(0, 40);
  for (const sub of subcats) {
    allUrls.push({ loc: `https://topbuy.ro/${slug}/${sub.slug}/`, priority: '0.7', changefreq: 'weekly' });
  }
}

// Search intents
const intentSlugsUsed = new Set();
for (const intent of allIntents) {
  const mega = intent.megaCategory;
  if (!structure.megaCategories[mega]) continue;
  const key = `${mega}/${intent.slug}`;
  if (intentSlugsUsed.has(key)) continue;
  intentSlugsUsed.add(key);
  allUrls.push({ loc: `https://topbuy.ro/${mega}/${intent.slug}/`, priority: '0.6', changefreq: 'weekly' });
}

// Static pages
for (const p of ['despre', 'contact', 'termeni', 'politica-confidentialitate', 'politica-cookies']) {
  allUrls.push({ loc: `https://topbuy.ro/${p}/`, priority: '0.3', changefreq: 'monthly' });
}

console.log(`Total URLs: ${allUrls.length}`);

// Split into chunks of URLS_PER_SITEMAP
const chunks = [];
for (let i = 0; i < allUrls.length; i += URLS_PER_SITEMAP) {
  chunks.push(allUrls.slice(i, i + URLS_PER_SITEMAP));
}
console.log(`Sitemaps: ${chunks.length} (${URLS_PER_SITEMAP} URLs each)`);

// Generate drip dates - one sitemap "published" per day starting from today going back
const today = new Date();
const sitemapFiles = [];

for (let i = 0; i < chunks.length; i++) {
  const chunk = chunks[i];
  const filename = `sitemap-${String(i + 1).padStart(3, '0')}.xml`;

  // Drip: sitemap 1 = today, sitemap 2 = yesterday, etc.
  const dripDate = new Date(today);
  dripDate.setDate(dripDate.getDate() - i);
  const lastmod = dripDate.toISOString().split('T')[0];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${chunk.map(u => `<url><loc>${u.loc}</loc><lastmod>${lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;

  writeFileSync(join(OUT_DIR, filename), xml);
  sitemapFiles.push({ filename, lastmod, urls: chunk.length });
}

// Generate sitemap index
const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapFiles.map(s => `<sitemap><loc>https://topbuy.ro/${s.filename}</loc><lastmod>${s.lastmod}</lastmod></sitemap>`).join('\n')}
</sitemapindex>`;

writeFileSync(join(OUT_DIR, 'sitemap.xml'), indexXml);

console.log(`\nGenerated:`);
console.log(`  sitemap.xml (index with ${sitemapFiles.length} sitemaps)`);
console.log(`  sitemap-001.xml through sitemap-${String(chunks.length).padStart(3, '0')}.xml`);
console.log(`  Drip: newest sitemap = today, oldest = ${sitemapFiles[sitemapFiles.length - 1].lastmod}`);

// This was already run - brands are added in next run
