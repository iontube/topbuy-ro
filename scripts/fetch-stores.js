import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');

const EMAIL = 'lucgrecu@gmail.com';
const PASSWORD = '@Arisgrecu29';
const BASE = 'https://api.2performant.com';

let auth = {};

async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth.token) { headers['access-token'] = auth.token; headers['client'] = auth.client; headers['uid'] = auth.uid; }
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const nt = res.headers.get('access-token'); if (nt) auth.token = nt;
  const nc = res.headers.get('client'); if (nc) auth.client = nc;
  const nu = res.headers.get('uid'); if (nu) auth.uid = nu;
  if (!res.ok) { console.error(`API ${res.status}: ${await res.text()}`); return null; }
  return res.json();
}

function slugify(t) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function run() {
  // Login
  const login = await req('POST', '/users/sign_in', { user: { email: EMAIL, password: PASSWORD } });
  if (!login?.user) { console.error('Login failed'); process.exit(1); }
  const affiliateId = login.user.unique_code || login.user.id;
  console.log(`Logged in as ${login.user.login} (${login.user.role})`);

  // Fetch all accepted programs (= stores)
  const allPrograms = [];
  let page = 1;
  while (true) {
    const data = await req('GET', `/affiliate/programs?filter[status]=accepted&page=${page}&perpage=50`);
    if (!data?.programs?.length) break;
    allPrograms.push(...data.programs);
    console.log(`  Page ${page}: ${data.programs.length} programs (total: ${allPrograms.length})`);
    if (allPrograms.length >= (data.metadata?.pagination?.total || 0)) break;
    page++;
  }

  console.log(`\nTotal programs: ${allPrograms.length}`);

  // Clean description: remove affiliate program info
  function cleanDescription(text) {
    if (!text) return '';
    // Cut at first mention of affiliate/commission/program keywords
    const cutPatterns = [
      /\b(comision|cookie life|afiliat|afiliere|promov[aă]|2performant|program de afiliere)/i,
      /\b(Ce castigi|Cum poti sa ne|Cum poți promova|De ce să te alături|Restricții|Google Ads|PPC|Facebook Ads)/i,
      /\b(valoare medie a cosului|rata de retur|feeduri extra|acceptam orice)/i,
      /\b(bannere|email marketing|cashback|agregatoare|comparatoare de preturi)/i,
      /\b(grila de comisioane|tipologia clientilor|top affiliates|our commission)/i,
    ];
    let cutIdx = text.length;
    for (const pattern of cutPatterns) {
      const match = text.search(pattern);
      if (match > 50 && match < cutIdx) cutIdx = match;
    }
    let clean = text.substring(0, cutIdx).trim();
    // Remove trailing incomplete sentence
    const lastDot = clean.lastIndexOf('.');
    if (lastDot > clean.length * 0.5) clean = clean.substring(0, lastDot + 1);
    return clean;
  }

  // Build store data
  const stores = allPrograms
    .filter(p => p.status === 'active' && p.products_count > 0)
    .map(p => {
      // Affiliate link to store homepage
      const affLink = `https://event.2performant.com/events/click?ad_type=quicklink&aff_code=${affiliateId}&unique=${p.unique_code}&redirect_to=${encodeURIComponent(p.main_url)}`;

      return {
        name: p.name.trim().replace(/\/+$/, '').trim(),
        slug: slugify(p.name),
        url: p.main_url,
        affLink,
        logo: p.logo_path || '',
        description: cleanDescription((p.description || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()),
        category: p.category?.name || '',
        productCount: p.products_count || 0,
        commission: p.default_sale_commission_rate ? parseFloat(p.default_sale_commission_rate) : 0,
        cookieLife: p.cookie_life || 0,
      };
    })
    .sort((a, b) => b.productCount - a.productCount);

  console.log(`Active stores with products: ${stores.length}`);

  // Save
  writeFileSync(join(DATA_DIR, 'stores.json'), JSON.stringify(stores, null, 2));
  console.log(`\nSaved to stores.json`);

  // Stats
  const totalProducts = stores.reduce((s, st) => s + st.productCount, 0);
  console.log(`Total products across stores: ${totalProducts.toLocaleString()}`);
  console.log(`\nTop 15:`);
  for (const s of stores.slice(0, 15)) {
    console.log(`  ${s.name} - ${s.productCount.toLocaleString()} prod - ${s.commission}% - ${s.category}`);
  }
}

run().catch(console.error);
