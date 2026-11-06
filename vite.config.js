import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          motion: ['gsap', 'lenis'],
        },
      },
    },
  },
});
