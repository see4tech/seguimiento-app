import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // En desarrollo local, redirige /api/* a netlify dev (puerto 8888)
      // Correr: netlify dev (en lugar de npm run dev)
      // O apuntar al puerto de tu función local:
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        rewrite: path => path
      }
    }
  }
})
