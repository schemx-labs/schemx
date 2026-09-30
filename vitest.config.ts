import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["scripts/**/*.test.ts"],
    environment: "node",
    // 工作流脚本会读写临时目录与仓库内的 package.json，单进程串行执行避免相互干扰。
    pool: "forks",
    fileParallelism: false,
  },
})
