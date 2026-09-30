import { defineConfig } from "vite-plus"

export default defineConfig({
  lint: {
    ignorePatterns: [".agent/**", "examples/uniapp-vant/**"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    // Vue SFCs use vue-tsc in the package type-check scripts.
    options: { typeAware: true, typeCheck: false },
  },
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
  },
  fmt: {
    arrowParens: "always",
    bracketSpacing: true,
    endOfLine: "lf",
    htmlWhitespaceSensitivity: "css",
    printWidth: 90,
    proseWrap: "preserve",
    quoteProps: "as-needed",
    semi: false,
    singleQuote: false,
    tabWidth: 2,
    trailingComma: "es5",
    useTabs: false,
    vueIndentScriptAndStyle: true,
    embeddedLanguageFormatting: "auto",
    bracketSameLine: false,
    singleAttributePerLine: false,
    sortPackageJson: false,
    ignorePatterns: [
      ".agent/**",
      "examples/uniapp-vant/**",
      "WORKFLOW_REMEDIATION.md",
      "node_modules",
      "uni_modules",
      "dist",
      "build",
      "coverage",
      "static/",
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
    ],
  },
})
