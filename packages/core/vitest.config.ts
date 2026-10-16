import { defineConfig } from "vite-plus"
import { workspaceSource } from "vite-plugin-workspace-source"

export default defineConfig({
  plugins: [workspaceSource({ projectRoot: __dirname })],
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    globals: true,
  },
})
