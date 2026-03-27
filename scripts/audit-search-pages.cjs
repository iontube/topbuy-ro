const fs = require('fs');
const path = require('path');
const dir = 'public/data/search-pages/';
const intentsData = JSON.parse(fs.readFileSync('public/data/search-intents.json', 'utf-8'));
const intents = intentsData.intents || intentsData;

const intentMap = {};
for (const i of intents) intentMap[i.slug] = i;

// Common accessory/irrelevant patterns - things that are FOR a product, not the product itself
const ACCESSORY_PATTERNS = [
  'dulap pentru', 'dulap de', 'raft pentru', 'raft de',
  'suport pentru', 'suport de', 'organizator pentru', 'cutie pentru',
  'husa pentru', 'husa de', 'geanta pentru', 'geanta de transport',
  'remorca pentru', 'remorca de', 'carucior pentru caini',
  'charm', 'talisman', 'brosa metalica', 'pandantiv',
  'sticker', 'magnet frigider',
  'perie pentru', 'crema pentru', 'spray pentru',
  'set accesorii pentru', 'kit accesorii', 'kit reparatie',
  'mentenanta', 'stand reparatie', 'stand mentenanta',
  'adaptor pentru', 'cablu pentru', 'incarcator pentru',
  'prelata pentru', 'folie pentru', 'protectie pentru',
];

const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
const issues = [];

for (const f of files) {
  const slug = f.replace('.json', '');
  const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
  const intent = intentMap[slug];
  if (!intent || !data.length) continue;

  const top30 = data.slice(0, Math.min(30, data.length));
  const suspicious = [];
  const seen = new Set();

  for (const p of top30) {
    const t = p.t.toLowerCase();
    let dominated = false;

    // Check common accessory patterns
    for (const pat of ACCESSORY_PATTERNS) {
      if (t.includes(pat)) {
        dominated = true;
        break;
      }
    }

    // Check "pentru {keyword}" pattern (accessory FOR the product)
    if (!dominated && intent.keywords) {
      for (const kw of intent.keywords) {
        // If title contains "pentru {kw}" but doesn't start with {kw}, it's likely an accessory
        const idx = t.indexOf(kw);
        if (idx > 0) {
          const before = t.substring(Math.max(0, idx - 10), idx);
          if (before.includes('pentru ') || before.includes(' pt ')) {
            dominated = true;
            break;
          }
        }
      }
    }

    if (dominated) {
      const key = p.t.substring(0, 60);
      if (!seen.has(key)) {
        seen.add(key);
        suspicious.push(p.t.substring(0, 100));
      }
    }
  }

  if (suspicious.length >= 2) {
    issues.push({
      slug,
      count: suspicious.length,
      total: data.length,
      samples: suspicious.slice(0, 5),
    });
  }
}

issues.sort((a, b) => b.count - a.count);
console.log(`Pages with 2+ suspicious products in top 30: ${issues.length}\n`);
for (const i of issues) {
  console.log(`=== ${i.slug} (${i.count}/${Math.min(30, i.total)} suspicious) ===`);
  i.samples.forEach(s => console.log(`  ! ${s}`));
  console.log();
}
