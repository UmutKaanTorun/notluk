import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Notluk Vite and Vitest configuration.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost',
      },
    },
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
