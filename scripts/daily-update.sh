#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "=== $(date) - Daily Update ==="

# 1. Refresh feed URLs from 2Performant
echo "Step 1: Fetching feed URLs..."
node scripts/fetch-stores.js

# 2. Download feeds
echo "Step 2: Downloading feeds..."
npm run download-feeds

# 3. Process feeds
echo "Step 3: Processing feeds..."
npm run process-feeds

# 4. Rebuild search pages with scoring
echo "Step 4: Rebuilding search pages..."
node scripts/rebuild-search-pages.js

# 5. Regenerate sitemaps (drip: today's sitemap is newest)
echo "Step 5: Generating sitemaps..."
node scripts/generate-sitemaps.js

# 6. Build
echo "Step 6: Building site..."
npm run build

# 7. Clean astro traces
echo "Step 7: Cleaning build..."
mv dist/_astro dist/_assets 2>/dev/null || true
find dist -name "*.html" -exec sed -i 's/_astro/_assets/g' {} +
find dist -name "*.html" -exec sed -i 's/ data-astro-cid-[a-z0-9]*//g' {} +
find dist/_assets -name "*.css" -exec sed -i 's/\[data-astro-cid-[a-z0-9]*\]//g' {} +

# 8. Deploy
echo "Step 8: Deploying..."
npx wrangler pages deploy dist --project-name=topbuy-ro --branch=main

echo "=== Done: $(date) ==="
