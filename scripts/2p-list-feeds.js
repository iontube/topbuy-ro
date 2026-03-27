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
  try { return JSON.parse(text); } catch { return text; }
}

(async () => {
  await req('POST', '/users/sign_in', { user: { email: EMAIL, password: PASSWORD } });

  // Get ALL feeds (these are definitely mine)
  const allFeeds = [];
  for (let page = 1; page <= 10; page++) {
    const data = await req('GET', '/affiliate/product_feeds?page=' + page + '&perpage=50');
    if (!data.product_feeds || data.product_feeds.length === 0) break;
    allFeeds.push(...data.product_feeds);
    console.error('Feeds page ' + page + ': +' + data.product_feeds.length);
    if (data.product_feeds.length < 50) break;
  }

  console.log('Total feeds: ' + allFeeds.length);
  console.log('');

  // Show feed details
  for (const f of allFeeds) {
    console.log(JSON.stringify(f));
  }
})();
