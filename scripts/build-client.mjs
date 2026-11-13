import { build } from '../client/node_modules/vite/dist/node/index.js'
import vue from '../client/node_modules/@vitejs/plugin-vue/dist/index.mjs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../client')
await build({
  root, configFile: false, plugins: [vue()],
  resolve: { alias: { '@': resolve(root, 'src') } },
  cacheDir: resolve(root, '../.test-work/vite-cache'),
  build: { outDir: resolve(root, 'dist'), emptyOutDir: true }
})
