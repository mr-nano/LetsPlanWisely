import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  optimizeDeps: {
    exclude: [
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/basic-setup',
      '@codemirror/language',
      '@codemirror/autocomplete',
      '@codemirror/lint',
      '@lezer/highlight'
    ]
  },
  resolve: {
    dedupe: [
      'vue',
      '@codemirror/state',
      '@codemirror/view',
    ],
  },
  // Add Vitest configuration
  test: {
    environment: 'jsdom', // Simulate browser DOM for editor-related tests
    globals: true, // Allow using `describe`, `it`, `expect` globally
  },
})