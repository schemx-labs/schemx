// @ts-check

/**
 * @typedef {import("vite").Plugin} Plugin
 */

/**
 * 创建用于库模式构建的样式入口注入插件。
 *
 * Vite library mode 会把源码中的 CSS import 提取成独立的 `style.css`，
 * 但默认不会在构建后的 JS 入口中继续保留这条样式依赖。对于 `@schemx/vue`
 * 和 `@schemx/vant` 这类希望用户只导入包入口即可获得样式的库，需要在 ES
 * 入口产物中显式补回 `import "./style.css"`。
 *
 * 插件只处理 ES module 入口文件，避免在 CommonJS 或 UMD 产物里生成
 * `require("./style.css")` 一类容易破坏 Node/SSR 兼容性的语句。
 *
 * @param {string} [styleFileName="style.css"] - 需要注入到 ES 入口中的 CSS 文件名。
 * @returns {Plugin} Vite 构建插件。
 */
export function injectStyleCss(styleFileName = "style.css") {
  return {
    name: "schemx:inject-style-css",
    generateBundle(_, bundle) {
      const cssImport = `import "./${styleFileName}";\n`

      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk" || !chunk.isEntry || !chunk.fileName.endsWith(".mjs")) {
          continue
        }

        if (!chunk.code.startsWith(cssImport)) {
          chunk.code = cssImport + chunk.code
        }
      }
    },
  }
}
