import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// no proxy needed, API is called directly on port 8000
export default defineConfig({
  plugins: [react()],
})
