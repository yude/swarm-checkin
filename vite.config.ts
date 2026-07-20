import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/foursquare': {
        target: 'https://api.foursquare.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/foursquare/, ''),
      },
      '/oauth/foursquare': {
        target: 'https://foursquare.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/oauth\/foursquare/, ''),
      },
    },
  },
})
