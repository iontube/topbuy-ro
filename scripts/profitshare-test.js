import crypto from 'crypto';

const API_USER = 'lucian_grecu_68e7a5acc020d';
const API_KEY = 'db232a91eb85cc2b2dcede0fe51c7c28c379eba1';
const BASE = 'https://api.profitshare.ro';

const date = new Date().toUTCString();
const path = '/affiliate-programs/';

// From PHP source: signature = type + api + '/?' + query_string + '/' + api_user + date
// $api = 'affiliate-programs' (without leading/trailing slashes)
// URL = API_URL + '/' + api + '/?'

async function psRequest(endpoint, params = {}) {
  const date = new Date().toUTCString();
  const method = 'GET';
  const queryString = new URLSearchParams(params).toString();

  // Exact PHP format: $type . $api . '/?' . $query_string . '/' . $api_user . $date
  const sig = method + endpoint + '/?' + queryString + '/' + API_USER + date;
  const hash = crypto.createHmac('sha1', API_KEY).update(sig).digest('hex');

  const url = BASE + '/' + endpoint + '/?' + queryString;
  const res = await fetch(url, {
    headers: {
      'Date': date,
      'X-PS-Client': API_USER,
      'X-PS-Auth': hash,
      'X-PS-Accept': 'json',
    }
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`API ${res.status}: ${text.substring(0, 200)}`);
    return null;
  }
  try { return JSON.parse(text); } catch { return text; }
}

// Test
const result = await psRequest('affiliate-programs');
if (result) {
  console.log('SUCCESS!');
  console.log(JSON.stringify(result, null, 2).substring(0, 1500));
} else {
  console.log('Failed');
}
