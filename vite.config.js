/* global process */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Duas entradas: o site (index.html) e a página de piloto de senhas (piloto-senha/index.html), que é independente do site.
export default defineConfig({
  plugins: [react()],
  // build de preview da Vercel: o site sai INERTE (sem banco real). Veja src/ambiente.js e scripts/checar-ambiente.mjs.
  define: { __PREVIEW_VERCEL__: JSON.stringify(process.env.VERCEL_ENV === 'preview') },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        pilotoSenha: 'piloto-senha/index.html',
      },
    },
  },
})
