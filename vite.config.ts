// Author: nattapat2871 (https://nattapat2871.me)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/live-translate/',
  plugins: [react(), tailwindcss()],
})
