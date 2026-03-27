/**
 * 2Performant API helper - handles rotating token auth
 * Usage: node scripts/2p-api.js <command>
 * Commands: login, feeds, programs, create-feeds, delete-feeds
 */

const EMAIL = 'lucgrecu@gmail.com';
const PASSWORD = '@Arisgrecu29';
const BASE = 'https://api.2performant.com';

let auth = { token: null, client: null, uid: null };

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth.token) {
    headers['access-token'] = auth.token;
    headers['client'] = auth.client;
    headers['uid'] = auth.uid;
  }

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(BASE + path, opts);

  // Update auth from response headers (token rotates each request)
  const newToken = res.headers.get('access-token');
  const newClient = res.headers.get('client');
  const newUid = res.headers.get('uid');
  if (newToken) auth.token = newToken;
  if (newClient) auth.client = newClient;
  if (newUid) auth.uid = newUid;

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    console.error(`API Error ${res.status}:`, data);
    throw new Error(`API ${res.status}`);
  }

  return data;
}

async function login() {
  console.log('Logging in...');
  const data = await request('POST', '/users/sign_in', {
    user: { email: EMAIL, password: PASSWORD }
  });
  console.log(`Logged in as: ${data.user?.login} (${data.user?.role})`);
  return data;
}

async function getPrograms() {
  const allPrograms = [];
  let page = 1;
  while (true) {
    const data = await request('GET', `/affiliate/programs?filter[status]=accepted&page=${page}&perpage=50`);
    if (!data.programs || data.programs.length === 0) break;
    allPrograms.push(...data.programs);
    console.log(`  Page ${page}: ${data.programs.length} programs (total: ${allPrograms.length})`);
    if (allPrograms.length >= (data.metadata?.pagination?.total || 0)) break;
    page++;
  }
  return allPrograms;
}

async function getFeeds() {
  const allFeeds = [];
  let page = 1;
  while (true) {
    const data = await request('GET', `/affiliate/product_feeds?page=${page}&perpage=50`);
    if (!data.product_feeds || data.product_feeds.length === 0) break;
    allFeeds.push(...data.product_feeds);
    console.log(`  Page ${page}: ${data.product_feeds.length} feeds (total: ${allFeeds.length})`);
    if (allFeeds.length >= (data.metadata?.pagination?.total || 0)) break;
    page++;
  }
  return allFeeds;
}

async function deleteFeed(id) {
  return await request('DELETE', `/affiliate/product_feeds/${id}`);
}

async function createFeed(programId) {
  return await request('POST', '/affiliate/product_feeds', {
    product_feed: { program_id: programId }
  });
}

// Main
const cmd = process.argv[2] || 'status';

(async () => {
  try {
    await login();

    if (cmd === 'status') {
      console.log('\n--- Current Feeds ---');
      const feeds = await getFeeds();
      console.log(`\nTotal feeds: ${feeds.length}`);
      for (const f of feeds) {
        console.log(`  [${f.id}] ${f.advertiser_name || f.program_id} - ${f.status} - products: ${f.products_count || '?'}`);
        if (f.csv_url) console.log(`    URL: ${f.csv_url}`);
      }

      console.log('\n--- Accepted Programs ---');
      const programs = await getPrograms();
      console.log(`\nTotal accepted programs: ${programs.length}`);
      const withFeeds = programs.filter(p => p.product_feeds_count > 0);
      const withoutFeeds = programs.filter(p => !p.product_feeds_count);
      console.log(`Programs with feeds: ${withFeeds.length}`);
      console.log(`Programs without feeds: ${withoutFeeds.length}`);
      for (const p of programs) {
        console.log(`  [${p.id}] ${p.name} - feeds: ${p.product_feeds_count || 0} - status: ${p.status}`);
      }
    }

    else if (cmd === 'delete-all-feeds') {
      console.log('\n--- Deleting All Feeds ---');
      const feeds = await getFeeds();
      console.log(`Found ${feeds.length} feeds to delete`);
      for (const f of feeds) {
        try {
          await deleteFeed(f.id);
          console.log(`  Deleted feed ${f.id} (${f.advertiser_name || f.program_id})`);
        } catch (e) {
          console.error(`  Failed to delete feed ${f.id}: ${e.message}`);
        }
      }
      console.log('Done deleting feeds.');
    }

    else if (cmd === 'create-all-feeds') {
      console.log('\n--- Creating Feeds for All Programs ---');
      const programs = await getPrograms();
      console.log(`Found ${programs.length} accepted programs`);
      let created = 0, skipped = 0, failed = 0;
      for (const p of programs) {
        if (p.product_feeds_count > 0) {
          console.log(`  Skip ${p.name} - already has ${p.product_feeds_count} feed(s)`);
          skipped++;
          continue;
        }
        try {
          const feed = await createFeed(p.id);
          console.log(`  Created feed for ${p.name} (program ${p.id})`);
          created++;
        } catch (e) {
          console.error(`  Failed for ${p.name}: ${e.message}`);
          failed++;
        }
      }
      console.log(`\nDone: ${created} created, ${skipped} skipped, ${failed} failed`);
    }

    else if (cmd === 'full-reset') {
      // Step 1: Delete all existing feeds
      console.log('\n=== STEP 1: Delete All Existing Feeds ===');
      const feeds = await getFeeds();
      console.log(`Found ${feeds.length} feeds to delete`);
      for (const f of feeds) {
        try {
          await deleteFeed(f.id);
          console.log(`  Deleted feed ${f.id} (${f.advertiser_name || f.program_id})`);
        } catch (e) {
          console.error(`  Failed to delete feed ${f.id}: ${e.message}`);
        }
      }

      // Step 2: Create feeds for all accepted programs
      console.log('\n=== STEP 2: Create Feeds for All Programs ===');
      const programs = await getPrograms();
      console.log(`Found ${programs.length} accepted programs`);
      let created = 0, failed = 0;
      for (const p of programs) {
        try {
          const feed = await createFeed(p.id);
          console.log(`  Created feed for ${p.name} (program ${p.id})`);
          created++;
        } catch (e) {
          console.error(`  Failed for ${p.name}: ${e.message}`);
          failed++;
        }
      }
      console.log(`\n=== DONE ===`);
      console.log(`Deleted: ${feeds.length} old feeds`);
      console.log(`Created: ${created} new feeds, ${failed} failed`);
    }

  } catch (e) {
    console.error('Fatal:', e.message);
    process.exit(1);
  }
})();
