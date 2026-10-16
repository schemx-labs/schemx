# Element Plus 示例

该示例展示 `@schemx/element-plus` 的输入、选项、日期时间、树选择、评分、滑块和上传 Renderer，包括自定义选项字段名。基础信息分组默认收起，可点击按钮调用 `scrollToField()` 自动展开并定位到年龄字段。

```bash
pnpm install
pnpm --filter element-plus-demo dev
```

项目的 `.env` 已设置 `VITE_USE_SOURCE=true`，开发时通过 `workspace-source.config.ts` 解析依赖源码，并同步 TypeScript 路径。切换为依赖产物时设置 `VITE_USE_SOURCE=false`，再从仓库根目录运行 `pnpm source:sync`。包 API 统一从 `@schemx/element-plus` 根入口导入。
