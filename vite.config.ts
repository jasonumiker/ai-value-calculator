import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// A relative base lets the same build run locally and from the GitHub Pages project path.
export default defineConfig({
  base: './',
  plugins: [react()],
})
