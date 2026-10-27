import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In local dev, proxy API calls to the FastAPI server so the frontend can use
// relative `/api` URLs (same as the production nginx setup) with no CORS fuss.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
