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
  try { return { status: res.status, data: JSON.parse(text) }; } catch { return { status: res.status, data: text }; }
}

(async () => {
  await req('POST', '/users/sign_in', { user: { email: EMAIL, password: PASSWORD } });

  // Try different filter combinations
  const endpoints = [
    '/affiliate/programs?filter[relationship]=accepted&page=1&perpage=5',
    '/affiliate/programs?filter[mine]=true&page=1&perpage=5',
    '/affiliate/advertiser_programs?page=1&perpage=5',
    '/affiliate/merchants?page=1&perpage=5',
    '/affiliate/programs?filter[affrequest_status]=accepted&filter[status]=active&page=1&perpage=5',
  ];

  for (const ep of endpoints) {
    const r = await req('GET', ep);
    const keys = r.data && typeof r.data === 'object' ? Object.keys(r.data) : [];
    const programs = r.data?.programs;
    const total = r.data?.metadata?.pagination?.results;
    const facetAccepted = r.data?.metadata?.facets?.search?.affrequest_status;
    console.log(ep);
    console.log('  Status:', r.status, '| Keys:', keys.join(','));
    if (programs) console.log('  Programs:', programs.length, '| Pagination total:', total);
    if (facetAccepted) console.log('  Facet accepted:', JSON.stringify(facetAccepted));
    if (r.status >= 400) console.log('  Response:', JSON.stringify(r.data).slice(0, 200));
    console.log('');
  }

  // Now check: the first endpoint returned programs - let's see if the facets show the real count
  console.log('--- Checking accepted programs properly ---');
  const r = await req('GET', '/affiliate/programs?filter[affrequest_status]=accepted&page=1&perpage=1');
  const acceptedFacet = r.data?.metadata?.facets?.search?.affrequest_status;
  const availAccepted = r.data?.metadata?.facets?.available?.affrequest_status;
  console.log('Search facets:', JSON.stringify(acceptedFacet));
  console.log('Available facets:', JSON.stringify(availAccepted));
  console.log('Pagination:', JSON.stringify(r.data?.metadata?.pagination));
})();
