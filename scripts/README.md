# 项目工作流脚本

根目录 `package.json` 的开发、构建、质量、测试和发布命令统一由
`scripts/workflow.sh` 分派。

```text
scripts/
├── workflow.sh           # 项目级命令入口
├── lib/                  # terminal、interaction、task 等通用基建
├── modules/              # workspace、packages、release 的可组合业务步骤
├── commands/             # workspace、工具与 release 最终命令编排
├── fixtures/             # UI 预览与测试使用的静态输入
└── tests/                # lib、modules 与命令域测试
```

本地 TTY 下，workspace 命令通过 Clack 选择 `packages`、`plugins`、`examples` 中定义了
对应 script 的目标；`dev` 使用单选，其余批处理任务使用多选。CI 和管道环境默认执行所有
符合条件的目标。`build`、`lint`、`type-check`
和 `test` 由 Turborepo 编排依赖与缓存。发布命令的参数、计划冻结和不可逆操作边界由
`commands/release.sh` 负责。

`modules/packages/` 中保留需要 Node 读取复杂产物或 JSON 结构的底层实现；它们不再作为根命令
入口，统一由 `commands/tools.sh` 包装并通过 `lib/ui.sh` 显示生命周期反馈。

## Shell UI 约定

`scripts/lib/ui.sh` 是工作流唯一的 UI 边界。业务脚本只使用以下公共方法，底层的
`_ui_*` 函数、Gum 和 Clack 实现不属于业务 API：

| 方法 | 职责 |
| --- | --- |
| `ui_flow_begin` / `ui_flow_end` | 开始和结束一个顶层工作流；结束状态为 `success`、`failed` 或 `cancelled`。 |
| `ui_flow_group` | 在一个流程内划分有业务含义的步骤组，例如“发布前检查”“执行发布”。它不是额外的执行阶段，也不重复任务结果。 |
| `ui_note` | 输出上下文说明，不表示执行结果。 |
| `ui_prompt` | 统一处理 `select`、`multiselect`、`group-multiselect`、`input` 和 `confirm`；返回值只写入 stdout。 |
| `ui_task` | 执行一次有明确结束状态的命令，显示命令、耗时和退出码；支持 `--log live` 与 `--log capture`。 |
| `ui_service` | 执行持续运行的开发服务，Ctrl+C 映射为取消状态（退出码 130）。 |
| `ui_status` | 输出单条 `info`、`success`、`warning` 或 `error` 状态。 |
| `ui_summary` | 输出计划或结果等结构化摘要；不承担任务执行。 |

输出边界固定为：UI 反馈写入 stderr（交互控件使用 TTY），提示结果写入 stdout，`ui_task`
包装的原生命令 stdout/stderr 保持原样透传。这样可以安全地用命令替换读取选择结果，也可以
把原生命令日志交给 CI 或其他工具处理。脚本不再使用“阶段”作为独立反馈层；需要分组时使用
`ui_flow_group`，需要结果时使用 `ui_status` 或 `ui_summary`。

布局边界固定为：相邻 UI 输出块之间保留 1 条带前置 `│` 的导轨间隔行；任务原始日志视为
任务块内容，任务完成状态与日志末尾之间保留 1–2 条导轨间隔行。卡片、分组说明、摘要多行
内容属于同一个输出块，不会把其中的普通换行误判为额外步骤。该约束同时适用于 plain 和
pretty 格式，以及提示结果通过命令替换返回父 Shell 的场景。

终端格式可以通过环境变量控制：

```bash
SCHEMX_UI_FORMAT=auto    # 默认；TTY 使用 pretty，其他环境使用 plain
SCHEMX_UI_FORMAT=pretty  # 强制 Gum 样式（仍需安装 gum）
SCHEMX_UI_FORMAT=plain   # 稳定的纯文本输出
SCHEMX_UI_ASSUME_YES=true # 非交互环境下让 ui_prompt confirm 返回 true
```

需要机器消费 UI 生命周期时，可设置 `SCHEMX_UI_EVENTS_FILE`。每个事件追加一行
`schemx.ui/v1` JSONL，事件包含 `runId`、时间戳和事件类型；事件文件独立于命令日志，适合
CI 收集。当前事件类型包括 `flow.started`、`group.started`、`note`、`prompt.completed`、
`prompt.cancelled`、`task.started`、`task.finished`、`status`、`summary` 和 `flow.finished`。
