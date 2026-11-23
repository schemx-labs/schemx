/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  parser: "vue-eslint-parser",
  parserOptions: {
    parser: "@typescript-eslint/parser",
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
    extraFileExtensions: [".vue"],
    tsconfigRootDir: __dirname,
    project: [
      "./tsconfig.eslint.json",
      "./tsconfig.json",
      "./packages/core/tsconfig.json",
      "./packages/vue/tsconfig.json",
      "./packages/vant/tsconfig.json",
      "./examples/vant/tsconfig.json",
    ],
  },
  plugins: ["@typescript-eslint", "import", "unused-imports", "jsx-a11y"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:vue/vue3-recommended",
    "plugin:jsx-a11y/recommended",
    "prettier",
  ],
  settings: {
    "import/parsers": {
      "@typescript-eslint/parser": [".ts", ".tsx"],
    },
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true,
        project: [
          "./tsconfig.json",
          "./packages/core/tsconfig.json",
          "./packages/vue/tsconfig.json",
          "./packages/vant/tsconfig.json",
          "./examples/tsconfig.json",
        ],
      },
      node: {
        extensions: [".js", ".jsx", ".ts", ".tsx", ".vue", ".d.ts"],
      },
    },
    "import/internal-regex": "^@/|^src/",
  },
  ignorePatterns: [
    "node_modules/**",
    "uni_modules/**",
    "dist/**",
    "build/**",
    "static/**",
    "**/*.d.ts",
    ".eslintrc.cjs",
    "packages/vue/src/formRuntime.js",
    "**/formRuntime.js",
    "**/vite.config.ts",
    "**/vitest.config.ts",
  ],
  rules: {
    // 导入排序
    "sort-imports": [
      "warn",
      {
        ignoreCase: true,
        ignoreDeclarationSort: true,
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ["none", "all", "multiple", "single"],
        allowSeparatedGroups: true,
      },
    ],
    "import/order": [
      "warn",
      {
        groups: [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index",
          "object",
          "type",
        ],
        "newlines-between": "always",
        alphabetize: {
          order: "asc",
          caseInsensitive: true,
        },
        pathGroups: [
          {
            pattern: "vue",
            group: "external",
            position: "before",
          },
          {
            pattern: "vant",
            group: "external",
            position: "before",
          },
          {
            pattern: "@/**",
            group: "internal",
            position: "after",
          },
        ],
        pathGroupsExcludedImportTypes: ["vue"],
      },
    ],

    // 未使用导入
    "unused-imports/no-unused-imports": "error",

    // TypeScript
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      },
    ],
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/no-namespace": "off",

    // 通用规则
    "no-console": ["error", { allow: ["warn", "error", "log", "count"] }],
    "no-debugger": "warn",

    // 函数/模块之间空行
    "padding-line-between-statements": [
      "warn",
      { blankLine: "always", prev: "*", next: "function" },
      { blankLine: "always", prev: "function", next: "*" },
      { blankLine: "always", prev: "*", next: "export" },
      { blankLine: "always", prev: "*", next: "class" },
      { blankLine: "always", prev: "class", next: "*" },
      { blankLine: "always", prev: "*", next: "return" },
      { blankLine: "always", prev: "block-like", next: "*" },
      { blankLine: "any", prev: "export", next: "export" },
    ],
    "no-unused-vars": "off",

    // Import 规则
    "import/no-unresolved": "error",
    "import/named": "error",
    "import/namespace": "error",
    "import/default": "error",
    "import/export": "error",

    // JSX 可访问性
    "jsx-a11y/alt-text": "warn",
    "jsx-a11y/click-events-have-key-events": "warn",
    "jsx-a11y/no-static-element-interactions": "warn",
  },
  overrides: [
    // Vue 文件
    {
      files: ["**/*.vue"],
      rules: {
        "vue/multi-word-component-names": "off",
        "vue/no-v-html": "off",
        "vue/require-default-prop": "off",
        "vue/require-prop-types": "off",
      },
    },
  ],
}
