import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/nfts': 'http://localhost:3000',
      '/my-nfts': 'http://localhost:3000',
      '/mint': 'http://localhost:3000',
      '/buy': 'http://localhost:3000',
      '/admin': 'http://localhost:3000',
    },
  },
})
