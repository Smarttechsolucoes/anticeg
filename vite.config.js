import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/superfrete": {
        target: "https://sandbox.superfrete.com",
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/superfrete/, ""),
        configure: (proxy) => {
          proxy.on("error", (err, _req, res) => {
            console.warn("[superfrete proxy error]", err.message);
            if (!res.headersSent) {
              res.writeHead(502, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "proxy: " + err.message }));
            }
          });
        },
      },
    },
  },
})
