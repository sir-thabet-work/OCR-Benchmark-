import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the built dist/ works from any folder or host.
export default defineConfig({
  plugins: [react()],
  base: './',
})
