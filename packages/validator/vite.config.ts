import { resolve } from "path"
import { defineConfig } from "vite"
import dts from "vite-plugin-dts"

// 作为 peer dependency 的包，构建时保持外部引用，不打入产物。
const externalPackages = ["@schemx/core", "async-validator"]

// 判断模块 id 是否属于外部包（含子路径导入），供 Rollup 不将其打包进产物。
function isExternal(id: string) {
  return externalPackages.some((pkg) => id === pkg || id.startsWith(`${pkg}/`))
}

export default defineConfig({
  plugins: [
    dts({
      include: ["src/**/*.ts"],
      outDir: "dist",
      // 构建期用独立 tsconfig 去掉 @schemx/* 路径映射，让 rollupTypes 把 @schemx/core 作为包名写入 d.ts。
      tsconfigPath: "tsconfig.build.json",
      // 将每个入口的类型声明合并为单个 .d.ts，与运行时子路径入口一一对应。
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      // 每个子路径入口单独构建，使 async-validator 等可选 peer 仅在使用方按需导入时加载。
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        "async-validator": resolve(__dirname, "src/async-validator.ts"),
        preset: resolve(__dirname, "src/preset.ts"),
      },
      formats: ["es", "cjs"],
      fileName: (format, entryName) =>
        `${entryName}.${format === "es" ? "mjs" : "cjs"}`,
    },
    rollupOptions: {
      external: isExternal,
      output: {
        // 仅命名导出，避免默认导出与 CJS 互操作产生意外。
        exports: "named",
      },
    },
    sourcemap: true,
    minify: "terser",
  },
})
