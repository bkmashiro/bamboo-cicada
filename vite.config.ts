import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'BambooCicada',
      formats: ['es', 'umd'],
      fileName: (format) => format === 'es' ? 'bamboo-cicada.js' : 'bamboo-cicada.umd.cjs',
    },
  },
  test: {
    environment: 'jsdom',
  },
});
