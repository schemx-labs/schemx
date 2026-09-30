import { posix } from "node:path"

import type { Plugin } from "vite-plus"

/**
 * 在库的 ESM 入口中引入构建出的 CSS，保留消费者自动加载样式的行为。
 *
 * @example
 * plugins: [injectStyleCss()]
 */
export function injectStyleCss(): Plugin {
  return {
    name: "schemx:inject-style-css",
    generateBundle: {
      order: "post",
      handler(_outputOptions, bundle) {
        const styleAsset = Object.values(bundle).find(
          (output) =>
            output.type === "asset" && posix.basename(output.fileName) === "style.css"
        )

        if (!styleAsset) return

        for (const output of Object.values(bundle)) {
          if (
            output.type !== "chunk" ||
            !output.isEntry ||
            !output.fileName.endsWith(".mjs")
          ) {
            continue
          }

          const relativePath = posix.relative(
            posix.dirname(output.fileName),
            styleAsset.fileName
          )

          const importPath = relativePath.startsWith(".")
            ? relativePath
            : `./${relativePath}`

          const importStatement = `import "${importPath}";\n`

          if (!output.code.includes(importStatement.trim())) {
            output.code = importStatement + output.code
          }
        }
      },
    },
  }
}
