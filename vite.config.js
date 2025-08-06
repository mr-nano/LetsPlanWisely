// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

const tailwindConfig = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default defineConfig({
  plugins: [vue()],
  css: {
    postcss: {
      plugins: [
        tailwindcss(tailwindConfig),
        autoprefixer(),
      ],
    },
  },
  resolve: {
    // Keep 'vue' for general deduplication if needed, but remove the conflicting CodeMirror entries
    dedupe: [
      'vue'
    ],
  },
  
  // This is the correct, consolidated configuration for Vitest
  test: {
    environment: 'jsdom',
    globals: true,
    deps: {
      // Inline CodeMirror packages to ensure Vite handles them correctly
      inline: [
        '@codemirror/state',
        '@codemirror/view',
        '@codemirror/commands',
        '@codemirror/lint',
        '@codemirror/autocomplete',
        '@codemirror/basic-setup',
        '@codemirror/language',
        '@lezer/highlight'
      ],
      // The `dedupe` option ensures a single instance of these packages is used
      dedupe: [
        '@codemirror/state',
        '@codemirror/view',
        '@codemirror/commands',
        '@codemirror/lint',
        '@codemirror/autocomplete',
        '@codemirror/basic-setup',
        '@codemirror/language',
        '@lezer/highlight'
      ],
    },
  },

  // Removed the top-level `deps` and `optimizeDeps` blocks to avoid conflicts.
});