# Element Plus API 示例

紧凑的示例页，使用仓库根目录的 `logo.png`，通过顶部标签切换内容。保留实际控件与 API 操作，不设置侧栏、介绍页或装饰性展示区。

| 标签            | 地址         | 主要 API                                                                                                      |
| --------------- | ------------ | ------------------------------------------------------------------------------------------------------------- |
| 表单与 Renderer | `#renderers` | `schemas`、`componentProps`、`readonly`、`disabled`、`validate()`、`submit()`、`reset()`、`scrollToField()`。 |
| 搜索与折叠      | `#search`    | `SchemxSearch`、`collapse`、`col`、`onFinish`、字段定位及查询条件快照。                                       |
| 列布局          | `#layout`    | 字段 `col: "auto"` 与栅格混排、`row.gutter`、320px 容器及校验提示。                                           |

每个标签下均提供可展开的“API 用法”。Renderer 按类别切换，避免一次展示全部控件；全部类别共用同一份表单模型。分组示例可通过按钮调用 `scrollToField('basic.age')`，提交结果以内联 JSON 展示。

搜索使用本地项目数据，点击查询后更新表格；收起的字段仍参与查询。上传只使用本地预览地址，不向服务器发送文件。切换顶部标签保留输入，地址 hash 支持直接访问与浏览器前进、后退。

```bash
pnpm install
pnpm --filter element-plus-demo dev
```

在 `.env` 中设置 `VITE_USE_SOURCE=true` 时，开发环境通过 `workspace-source.config.ts` 解析依赖源码，并同步 TypeScript 路径。切换为依赖产物时设置 `VITE_USE_SOURCE=false`，再从仓库根目录运行 `pnpm source:sync`。包 API 统一从 `@schemx/element-plus` 根入口导入。

主要文件：

- `src/App.vue`：Logo、标签与地址同步。
- `src/styles/demo.css`：紧凑布局和公共样式。
- `src/renderers/RenderersExample.vue`：控件分类与表单实例方法。
- `src/search/SearchExample.vue`：搜索、折叠与查询结果。
- `src/AutoColExample.vue`：自动列与栅格混排。
