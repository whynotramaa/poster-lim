import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

const config = defineConfig(({ command }) => {
  const plugins = [devtools(), tailwindcss(), tanstackStart(), viteReact()]

  // Keep local dev on Node runtime for stable Better Auth persistence.
  if (command === 'build' || process.env.CLOUDFLARE_DEV === '1') {
    plugins.splice(1, 0, cloudflare({ viteEnvironment: { name: 'ssr' } }))
  }

  return {
    resolve: { tsconfigPaths: true },
    plugins,
  }
})

export default config
