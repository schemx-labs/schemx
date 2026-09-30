import { defineConfig } from "vite-plus"
import { resolve } from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    globals: true,
  },
})
