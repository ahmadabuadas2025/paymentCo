/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' makes the static build work from any folder (or file host).
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { chunkSizeWarningLimit: 1000 }, // one bundle is fine for a classroom tool
  test: {
    include: ['src/**/*.test.ts'],
  },
});
