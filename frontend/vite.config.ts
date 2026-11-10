import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 開發時將 /api 代理到 FastAPI 後端
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
