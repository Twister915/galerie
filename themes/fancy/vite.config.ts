import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist/static',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'GalerieFancy',
      fileName: () => 'app.js',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          // Rename .css output to style.css
          if (assetInfo.name?.endsWith('.css')) {
            return 'style.css';
          }
          return '[name].[ext]';
        },
      },
    },
    cssCodeSplit: false,
  },
  plugins: [
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
