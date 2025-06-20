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
      'vue', // It's good practice to dedupe vue as well
      '@codemirror/state',
      '@codemirror/view',
      // You might need to add other @codemirror/* packages here if the issue persists
    ],
    // REMOVE THE 'alias' SECTION ENTIRELY
    // alias: {
    //     "@codemirror/state": "@codemirror/state/dist/index.js",
    //     "@codemirror/view": "@codemirror/view/dist/index.js",
    // }
  }
})