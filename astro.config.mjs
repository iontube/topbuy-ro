import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://topbuy.ro',
  output: 'static',
  build: {
    format: 'directory',
    inlineStylesheets: 'never',
  },
  vite: {
    build: {
      cssMinify: true,
    },
  },
});
