import type { WorkspaceSourceConfig } from "vite-plugin-workspace-source"

/** Workspace source entry points shared by Vite, editors and type checks. */
export default {
  packages: {
    "@schemx/core": {
      root: "packages/core",
      entries: {
        ".": "src/index.ts",
      },
    },
    "@schemx/vue": {
      root: "packages/vue",
      entries: {
        ".": "src/index.ts",
        "./style.css": "src/styles/index.css",
      },
    },
    "@schemx/element-plus": {
      root: "packages/element-plus",
      entries: {
        ".": "src/index.ts",
        "./style.css": "src/styles/index.scss",
      },
    },
    "@schemx/vant": {
      root: "packages/vant",
      entries: {
        ".": "src/index.ts",
        "./style.css": "src/styles/index.scss",
      },
    },
  },
  projects: [
    { root: "packages/core", kind: "library" },
    { root: "packages/vue", kind: "library" },
    { root: "packages/element-plus", kind: "library" },
    { root: "packages/vant", kind: "library" },
    { root: "examples/element-plus", kind: "application" },
    { root: "examples/vant", kind: "application" },
  ],
} satisfies WorkspaceSourceConfig
