import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      sourcemap: true
    }
  },
  preload: {
    // electron-vite v5 forces ESM (.mjs) when package.json has "type": "module",
    // but Electron's sandboxed preloads require CJS. The preload is built separately
    // via esbuild (see build:preload script) — this section is intentionally empty.
  },
  renderer: {
    plugins: [react()],
    build: {
      sourcemap: true
    }
  }
})
