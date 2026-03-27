/**
 * 2Performant Feed Manager
 * 1. Lists all YOUR feeds (affiliate/product_feeds)
 * 2. Deletes them all
 * 3. Creates 1 new feed per approved program
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
  if (!r.ok) throw new Error('Login failed: ' + JSON.stringify(r.data));
  console.log('Logged in as:', r.data.user?.login);
}

async function getAllFeeds() {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const r = await req('GET', `/affiliate/product_feeds?page=${page}&perpage=50`);
    if (!r.ok || !r.data.product_feeds?.length) break;
    all.push(...r.data.product_feeds);
    if (r.data.product_feeds.length < 50) break;
  }
  return all;
}

async function getAllMyPrograms() {
  // Get unique program IDs from feeds (these are definitely programs we're connected to)
  const feeds = await getAllFeeds();
  const programIds = new Set();
  const programNames = {};
  for (const f of feeds) {
    programIds.add(f.program.id);
    programNames[f.program.id] = f.program.name;
  }

  // Also try to get programs from the programs endpoint
  // We'll page through and check which ones have product_feeds_count > 0 or are in our feeds
  const allProgs = [];
  for (let page = 1; page <= 20; page++) {
    const r = await req('GET', `/affiliate/programs?page=${page}&perpage=50`);
    if (!r.ok || !r.data.programs?.length) break;
    allProgs.push(...r.data.programs);
    if (r.data.programs.length < 50) break;
  }

  // Merge: programs where we have feeds + programs from API that have product_feeds_count > 0
  const myPrograms = new Map();

  // From feeds
  for (const pid of programIds) {
    myPrograms.set(pid, { id: pid, name: programNames[pid], source: 'feeds' });
  }

  // From programs endpoint - only include ones that seem to be ours
  // (have feeds or appear in first ~100 results which are sorted by relevance)
  for (const p of allProgs) {
    if (!myPrograms.has(p.id)) {
      myPrograms.set(p.id, { id: p.id, name: p.name, status: p.status, feeds_count: p.product_feeds_count, source: 'api' });
    } else {
      const existing = myPrograms.get(p.id);
      existing.status = p.status;
      existing.feeds_count = p.product_feeds_count;
    }
  }

  return { feeds, programs: myPrograms };
}

const cmd = process.argv[2] || 'status';

(async () => {
  try {
    await login();

    if (cmd === 'status') {
      const { feeds, programs } = await getAllMyPrograms();

      console.log('\n=== CURRENT FEEDS ===');
      console.log('Total feeds:', feeds.length);

      // Group feeds by program
      const byProg = {};
      for (const f of feeds) {
        if (!byProg[f.program.id]) byProg[f.program.id] = [];
        byProg[f.program.id].push(f);
      }

      const multiFeeds = Object.entries(byProg).filter(([,v]) => v.length > 1);
      console.log('Programs with multiple feeds:', multiFeeds.length);
      console.log('Unique programs from feeds:', Object.keys(byProg).length);

      console.log('\n=== PROGRAMS ===');
      console.log('Total programs found:', programs.size);
      for (const [id, p] of programs) {
        const feedCount = byProg[id]?.length || 0;
        console.log(`  [${id}] ${(p.name||'').trim().padEnd(30)} status:${(p.status||'?').padEnd(10)} feeds:${feedCount}`);
      }
    }

    else if (cmd === 'delete-feeds') {
      const feeds = await getAllFeeds();
      console.log(`\nDeleting ${feeds.length} feeds...`);
      let deleted = 0, failed = 0;
      for (const f of feeds) {
        const r = await req('DELETE', `/affiliate/product_feeds/${f.id}`);
        if (r.ok) {
          deleted++;
          if (deleted % 10 === 0) console.log(`  Deleted ${deleted}/${feeds.length}...`);
        } else {
          failed++;
          console.error(`  Failed to delete feed ${f.id}: ${r.status} ${JSON.stringify(r.data)}`);
        }
      }
      console.log(`Done: ${deleted} deleted, ${failed} failed`);
    }

    else if (cmd === 'create-feeds') {
      // Get all programs that we have access to (from existing feeds)
      const { feeds } = await getAllMyPrograms();
      const programIds = new Set();
      for (const f of feeds) programIds.add(f.program.id);

      // Check which already have feeds after deletion
      const currentFeeds = await getAllFeeds();
      const progsWithFeeds = new Set(currentFeeds.map(f => f.program.id));

      const toCreate = [...programIds].filter(id => !progsWithFeeds.has(id));
      console.log(`Programs needing feeds: ${toCreate.length}`);
      console.log(`Programs already with feeds: ${progsWithFeeds.size}`);

      let created = 0, failed = 0;
      for (const pid of toCreate) {
        const r = await req('POST', '/affiliate/product_feeds', { product_feed: { program_id: pid } });
        if (r.ok) {
          created++;
          const name = r.data?.product_feed?.program?.name || pid;
          console.log(`  [${created}] Created feed for ${name}`);
        } else {
          failed++;
          console.error(`  Failed for program ${pid}: ${r.status} ${JSON.stringify(r.data)}`);
        }
      }
      console.log(`\nDone: ${created} created, ${failed} failed`);
    }

  } catch (e) {
    console.error('Fatal:', e.message);
    process.exit(1);
  }
})();
