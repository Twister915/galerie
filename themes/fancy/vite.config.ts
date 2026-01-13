import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist/static',
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/main.tsx'),
      output: {
        // Single bundle - Rust pipeline hashes filenames but can't update
        // import statements inside JS, so chunk splitting doesn't work
        entryFileNames: 'app.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'style.css';
          }
          return '[name].[ext]';
        },
        // Inline all chunks into the main bundle
        inlineDynamicImports: true,
      },
      external: ['leaflet'],
    },
    cssCodeSplit: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [
    preact(),
    viteStaticCopy({
      targets: [
        {
          src: 'templates/*',
          dest: '../templates',
        },
      ],
    }),
  ],
});
