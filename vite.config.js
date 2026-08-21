import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  base: './',
  plugins: [react(), nodePolyfills()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 5173,
    allowedHosts: true,
    strictPort: true,
  },
  test: {
    environment: 'node',
  },
})
