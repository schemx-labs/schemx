import path from "node:path"

import js from "@eslint/js"
import { defineConfig } from "eslint/config"
import prettier from "eslint-config-prettier/flat"
import importPlugin from "eslint-plugin-import"
import jsxA11y from "eslint-plugin-jsx-a11y"
import unusedImports from "eslint-plugin-unused-imports"
import vue from "eslint-plugin-vue"
import globals from "globals"
import tseslint from "typescript-eslint"
import vueParser from "vue-eslint-parser"

export default defineConfig([
  {
    ignores: [
      "uni_modules/**",
      "static/**",
      "**/*.d.ts",
      "**/formRuntime.js",
      "**/vite.config.ts",
      "**/vitest.config.ts",
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/*.min.js",
      ".agent/**",
      "examples/uniapp-vant/**",
      "eslint.config.js",
    ],
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,vue}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...vue.configs["flat/recommended"],
      jsxA11y.flatConfigs.recommended,
      {
        languageOptions: {
          parser: vueParser,
          ecmaVersion: 2022,
          globals: { ...globals.browser, ...globals.node },
          parserOptions: {
            parser: tseslint.parser,
            ecmaFeatures: { jsx: true },
            extraFileExtensions: [".vue"],
          },
        },
        plugins: {
          import: importPlugin,
          "unused-imports": unusedImports,
        },
        settings: {
          "import/parsers": {
            "@typescript-eslint/parser": [".ts", ".tsx"],
          },
          "import/resolver": {
            typescript: {
              alwaysTryTypes: true,
              noWarnOnMultipleProjects: true,
              project: [
                "./tsconfig.eslint.json",
                "./scripts/tsconfig.json",
                "./tsconfig.json",
                "./packages/core/tsconfig.json",
                "./packages/vue/tsconfig.json",
                "./packages/vant/tsconfig.json",
                "./packages/element-plus/tsconfig.json",
                "./examples/tsconfig.json",
              ].map((project) => path.resolve(import.meta.dirname, project)),
            },
            node: {
              extensions: [".js", ".jsx", ".ts", ".tsx", ".vue", ".d.ts"],
            },
          },
          "import/internal-regex": "^@/|^src/",
        },
        rules: {
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
          "unused-imports/no-unused-imports": "error",
          "@typescript-eslint/no-unused-vars": [
            "warn",
            {
              argsIgnorePattern: "^_",
              varsIgnorePattern: "^_",
              ignoreRestSiblings: true,
            },
          ],
          // 保留声明合并扩展接口；旧规则只禁止空对象类型。
          "@typescript-eslint/no-empty-object-type": [
            "error",
            { allowInterfaces: "always" },
          ],
          "@typescript-eslint/no-explicit-any": "off",
          "@typescript-eslint/explicit-function-return-type": "off",
          "@typescript-eslint/no-non-null-assertion": "warn",
          "@typescript-eslint/no-namespace": "off",
          "no-console": [
            "error",
            {
              allow: ["warn", "error", "log", "count"],
            },
          ],
          "no-debugger": "warn",
          "padding-line-between-statements": [
            "warn",
            {
              blankLine: "always",
              prev: ["const", "let", "var"],
              next: "*",
            },
            {
              blankLine: "always",
              prev: "*",
              next: "function",
            },
            {
              blankLine: "always",
              prev: "function",
              next: "*",
            },
            {
              blankLine: "always",
              prev: "*",
              next: "export",
            },
            {
              blankLine: "always",
              prev: "*",
              next: "class",
            },
            {
              blankLine: "always",
              prev: "class",
              next: "*",
            },
            {
              blankLine: "always",
              prev: "*",
              next: "return",
            },
            {
              blankLine: "always",
              prev: "block-like",
              next: "*",
            },
            {
              blankLine: "any",
              prev: "export",
              next: "export",
            },
          ],
          "no-unused-vars": "off",
          "import/no-unresolved": "error",
          "import/named": "error",
          "import/namespace": "error",
          "import/default": "error",
          "import/export": "error",
          "jsx-a11y/alt-text": "warn",
          "jsx-a11y/click-events-have-key-events": "warn",
          "jsx-a11y/no-static-element-interactions": "warn",
        },
      },
      {
        files: ["**/__tests__/**", "**/*.test.*", "**/*.spec.*"],
        rules: {
          "vue/one-component-per-file": "off",
          "vue/require-default-prop": "off",
          "vue/require-prop-types": "off",
        },
      },
      {
        files: ["**/*.vue"],
        rules: {
          "vue/multi-word-component-names": "off",
          "vue/no-v-html": "off",
          "vue/require-default-prop": "off",
          "vue/require-prop-types": "off",
        },
      },
      {
        files: ["plugins/vite-plugin-compat/src/**/*.ts"],
        rules: {
          "no-console": [
            "error",
            {
              allow: ["warn", "error", "log", "count", "debug", "info"],
            },
          ],
        },
      },
      prettier,
    ],
  },
])
