/**
 * 2Performant My Feeds Manager
 * Endpoint: /affiliate/feeds (not /affiliate/product_feeds)
 *
 * Usage: node scripts/2p-manage-feeds.js <command>
 * Commands: list, delete-all, create-all, full-reset
 */

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
  const nt = res.headers.get('access-token');
  if (nt) { auth.token = nt; auth.client = res.headers.get('client'); auth.uid = res.headers.get('uid'); }
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

async function login() {
  const r = await req('POST', '/users/sign_in', { user: { email: EMAIL, password: PASSWORD } });
  if (!r.ok) throw new Error('Login failed');
  console.log('Logged in as:', r.data.user?.login);
}

// Get all MY feeds (the ones I created in Tools > My Feeds)
async function getMyFeeds() {
  const r = await req('GET', '/affiliate/feeds');
  return r.ok ? (r.data.feeds || []) : [];
}

// Get all merchant product feeds (sources I can use)
async function getMerchantFeeds() {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const r = await req('GET', `/affiliate/product_feeds?page=${page}&perpage=50`);
    if (!r.ok || !r.data.product_feeds?.length) break;
    all.push(...r.data.product_feeds);
    if (r.data.product_feeds.length < 50) break;
  }
  return all;
}

async function deleteMyFeed(id) {
  return await req('DELETE', `/affiliate/feeds/${id}`);
}

async function createMyFeed(name, toolIds) {
  return await req('POST', '/affiliate/feeds', {
    feed: {
      name: name,
      tool_ids: toolIds,
      fields: [
        'title', 'aff_code', 'price', 'old_price', 'campaign_name',
        'created_at', 'product_active', 'brand', 'image_urls',
        'category', 'description'
      ]
    }
  });
}

const cmd = process.argv[2] || 'list';

(async () => {
  try {
    await login();

    if (cmd === 'list') {
      const myFeeds = await getMyFeeds();
      console.log(`\n=== MY FEEDS (${myFeeds.length}) ===`);
      for (const f of myFeeds) {
        console.log(`  [${f.id}] ${f.name} - ${f.products_count} products - sources: ${f.tool_ids?.length || 0}`);
        console.log(`    CSV: ${f.csv_link}`);
      }

      console.log('\n=== MERCHANT PRODUCT FEEDS ===');
      const merchantFeeds = await getMerchantFeeds();
      // Group by program
      const byProg = {};
      for (const f of merchantFeeds) {
        const pid = f.program.id;
        if (!byProg[pid]) byProg[pid] = { name: f.program.name, feeds: [] };
        byProg[pid].feeds.push(f);
      }
      const programs = Object.entries(byProg).sort((a, b) => a[1].name.localeCompare(b[1].name));
      console.log(`Total merchant feeds: ${merchantFeeds.length} from ${programs.length} programs`);

      // Show which programs have ALL feeds vs just some
      for (const [pid, info] of programs) {
        // Find biggest feed per program
        const biggest = info.feeds.reduce((a, b) => a.products_count > b.products_count ? a : b);
        console.log(`  [${pid}] ${info.name.trim().padEnd(30)} best_feed:${biggest.id} (${biggest.products_count} products) total_feeds:${info.feeds.length}`);
      }
    }

    else if (cmd === 'delete-all') {
      const myFeeds = await getMyFeeds();
      console.log(`\nDeleting ${myFeeds.length} feeds...`);
      let ok = 0, fail = 0;
      for (const f of myFeeds) {
        const r = await deleteMyFeed(f.id);
        if (r.ok) { ok++; console.log(`  Deleted [${f.id}] ${f.name}`); }
        else { fail++; console.error(`  Failed [${f.id}]: ${r.status} ${JSON.stringify(r.data)}`); }
      }
      console.log(`Done: ${ok} deleted, ${fail} failed`);
    }

    else if (cmd === 'create-all') {
      // Get all merchant feeds, pick the biggest one per program
      const merchantFeeds = await getMerchantFeeds();
      const byProg = {};
      for (const f of merchantFeeds) {
        const pid = f.program.id;
        if (!byProg[pid]) byProg[pid] = { name: f.program.name, feeds: [] };
        byProg[pid].feeds.push(f);
      }

      console.log(`\nCreating 1 feed per program (${Object.keys(byProg).length} programs)...`);
      let created = 0, failed = 0;

      for (const [pid, info] of Object.entries(byProg)) {
        // Pick the feed with most products
        const biggest = info.feeds.reduce((a, b) => a.products_count > b.products_count ? a : b);
        const name = info.name.trim().replace(/[\/\s]+$/, '');

        const r = await createMyFeed(name, [biggest.id]);
        if (r.ok) {
          created++;
          const csv = r.data?.feed?.csv_link || '';
          console.log(`  [${created}] ${name} (feed ${biggest.id}, ${biggest.products_count} products) -> ${csv}`);
        } else {
          failed++;
          console.error(`  FAIL: ${name}: ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
        }
      }
      console.log(`\nDone: ${created} created, ${failed} failed`);
    }

    else if (cmd === 'full-reset') {
      // Step 1: Delete all existing feeds
      console.log('\n=== STEP 1: Delete existing feeds ===');
      const myFeeds = await getMyFeeds();
      console.log(`Found ${myFeeds.length} feeds to delete`);
      for (const f of myFeeds) {
        const r = await deleteMyFeed(f.id);
        if (r.ok) console.log(`  Deleted [${f.id}] ${f.name}`);
        else console.error(`  Failed [${f.id}]: ${r.status}`);
      }

      // Step 2: Get merchant feeds and create 1 per program
      console.log('\n=== STEP 2: Create 1 feed per program ===');
      const merchantFeeds = await getMerchantFeeds();
      const byProg = {};
      for (const f of merchantFeeds) {
        const pid = f.program.id;
        if (!byProg[pid]) byProg[pid] = { name: f.program.name, feeds: [] };
        byProg[pid].feeds.push(f);
      }

      const programs = Object.entries(byProg).sort((a, b) => a[1].name.localeCompare(b[1].name));
      console.log(`Found ${programs.length} programs with feeds`);

      let created = 0, failed = 0;
      const newFeedUrls = [];

      for (const [pid, info] of programs) {
        const biggest = info.feeds.reduce((a, b) => a.products_count > b.products_count ? a : b);
        const name = info.name.trim().replace(/[\/\s]+$/, '');

        const r = await createMyFeed(name, [biggest.id]);
        if (r.ok) {
          created++;
          const csv = r.data?.feed?.csv_link || '';
          newFeedUrls.push(csv);
          console.log(`  [${created}] ${name} -> ${csv}`);
        } else {
          failed++;
          console.error(`  FAIL: ${name}: ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
        }
      }

      console.log(`\n=== DONE ===`);
      console.log(`Deleted: ${myFeeds.length} old feeds`);
      console.log(`Created: ${created} new feeds, ${failed} failed`);

      // Save new feed URLs
      if (newFeedUrls.length > 0) {
        const { writeFileSync } = require('fs');
        const { join } = require('path');
        writeFileSync(join(process.cwd(), 'linkuri feeduri.txt'), newFeedUrls.join('\n') + '\n');
        console.log(`\nSaved ${newFeedUrls.length} feed URLs to 'linkuri feeduri.txt'`);
      }
    }

  } catch (e) {
    console.error('Fatal:', e.message);
    process.exit(1);
  }
})();
