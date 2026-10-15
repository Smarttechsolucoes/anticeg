import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Duas entradas: o site (index.html) e a página de piloto de senhas (piloto-senha/index.html), que é independente do site.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        pilotoSenha: 'piloto-senha/index.html',
      },
    },
  },
})
