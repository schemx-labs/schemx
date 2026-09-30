import { defineConfig } from "vite-plus"
import vue from "@vitejs/plugin-vue"
import vueJsx from "@vitejs/plugin-vue-jsx"
import { resolve } from "path"

export default defineConfig({
  plugins: [vue() as any, vueJsx() as any],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@schemx/core": resolve(__dirname, "../core/src"),
    },
  },
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    environment: "happy-dom",
    include: ["src/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    globals: true,
  },
})
