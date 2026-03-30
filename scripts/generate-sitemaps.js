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

// Drip state: tracks which sitemaps have been published and their lastmod dates
const today = new Date().toISOString().split('T')[0];
const DRIP_STATE_FILE = join(DATA_DIR, 'sitemap-drip-state.json');

let dripState = { count: 0, dates: {} };
try {
  dripState = JSON.parse(readFileSync(DRIP_STATE_FILE, 'utf-8'));
  if (!dripState.dates) dripState.dates = {};
} catch {
  // First run
}

// Increment drip count by 1
const dripCount = Math.min(dripState.count + 1, chunks.length);

// Assign today's date to the newly dripped sitemap, keep existing dates
for (let i = 1; i <= dripCount; i++) {
  if (!dripState.dates[i]) {
    dripState.dates[i] = today;
  }
}

writeFileSync(DRIP_STATE_FILE, JSON.stringify({ count: dripCount, dates: dripState.dates, lastRun: new Date().toISOString() }, null, 2));

// Generate all sitemap XML files
const sitemapFiles = [];
for (let i = 0; i < chunks.length; i++) {
  const chunk = chunks[i];
  const idx = i + 1;
  const filename = `sitemap-${idx}.xml`;
  const lastmod = dripState.dates[idx] || today;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${chunk.map(u => `<url><loc>${u.loc}</loc><lastmod>${lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;

  writeFileSync(join(OUT_DIR, filename), xml);
  sitemapFiles.push({ filename, lastmod, urls: chunk.length });
}

// Generate sitemap index - only include dripped sitemaps
const visibleSitemaps = sitemapFiles.slice(0, dripCount);
const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${visibleSitemaps.map(s => `<sitemap><loc>https://topbuy.ro/${s.filename}</loc><lastmod>${s.lastmod}</lastmod></sitemap>`).join('\n')}
</sitemapindex>`;

writeFileSync(join(OUT_DIR, 'sitemap.xml'), indexXml);

console.log(`\nGenerated:`);
console.log(`  ${chunks.length} sitemap files, ${dripCount} visible in index`);
console.log(`  Dripped today: sitemap-${dripCount}.xml (${today})`);
for (let i = 1; i <= dripCount; i++) {
  console.log(`    sitemap-${i}.xml → ${dripState.dates[i]}`);
}
