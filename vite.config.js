// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from 'tailwindcss' // For v3, the plugin is directly from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// --- PASTE YOUR TAILWIND CONFIG DIRECTLY HERE ---
// (This is the entire content of your tailwind.config.js)
const tailwindConfig = {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
// --- END PASTE ---

console.log("Tailwind Config Loaded:", tailwindConfig.content); // <--- ADD THIS LINE


export default defineConfig({
  plugins: [vue()],
  css: {
    postcss: {
      plugins: [
        // Pass the tailwindConfig object directly to the tailwindcss plugin
        tailwindcss(tailwindConfig), // <-- IMPORTANT: Pass the config here
        autoprefixer(),
      ],
    },
  },
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
  test: {
    environment: 'jsdom',
    globals: true,
  },
})