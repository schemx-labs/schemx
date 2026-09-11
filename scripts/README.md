# 项目工作流脚本

根目录 `package.json` 的开发、构建、质量、测试和发布命令统一由
`scripts/workflow.sh` 分派。

```text
scripts/
├── workflow.sh           # 项目级命令入口
├── workflow/             # 工作流实现层
│   ├── commands/         # 可执行命令入口与最终编排
│   ├── domains/          # workspace、packages、release 的领域公共 API 与私有实现
│   ├── shared/           # package.json、workspace 目录发现等无 UI 通用能力
│   └── ui/               # UI 公共 API 与 internal/ 内部实现
├── fixtures/             # UI 预览与测试使用的静态输入
└── tests/                # shared、domains 与命令域测试
```

本地 TTY 下，workspace 命令通过 Clack 选择 `packages`、`plugins`、`examples` 中定义了
对应 script 的目标；`dev` 使用单选，其余批处理任务使用多选。CI 和管道环境中，有限批处理默认
执行所有符合条件的目标，`dev` 必须显式指定单个目标。每个目标直接执行对应 script。发布命令的参数、计划冻结和不可逆操作边界由
`workflow/commands/release/main.sh` 负责。

`workflow/domains/packages/` 中保留需要 Node 读取复杂产物或 JSON 结构的领域实现；它们不再作为
根命令入口，统一由 `workflow/commands/tools.sh` 包装并通过 `workflow/ui/api.sh` 显示生命周期反馈。

根目录提供两个提交前质量命令：`pnpm fix` 执行 `format` 和 `lint:fix`，`pnpm code-check`
执行 workspace 的完整代码检查。Git hooks 由 `pnpm install` 的 `prepare` script 配置；
`.githooks/pre-commit` 使用 `pnpm fix --staged` 和 `pnpm code-check`。

## Shell UI 约定

`scripts/workflow/ui/api.sh` 是工作流唯一的 UI 边界。业务脚本只使用以下公共方法，底层的
`ui__*` 函数、Gum 和 Clack 实现不属于业务 API：

| 方法 | 职责 |
| --- | --- |
| `ui_flow_begin` / `ui_flow_end` | 开始和结束一个顶层工作流；结束状态为 `success`、`failed` 或 `cancelled`。 |
| `ui_flow_cleanup` | 供调用方 EXIT/INT/TERM 清理逻辑幂等释放当前 flow 的 UI 临时资源。 |
| `ui_group_begin` / `ui_group_end` | 以 LIFO 栈开始和结束可嵌套业务分组；结束状态为 `success`、`failed`、`cancelled` 或 `skipped`。 |
| `ui_group_run` | 在自动收口的 group 中执行命令或函数，并保留被执行命令的退出码。 |
| `ui_note` | 输出上下文说明，不表示执行结果。 |
| `ui_prompt` | 统一处理 `select`、`multiselect`、`group-multiselect`、`input` 和 `confirm`；前四种结果写入 stdout，`confirm` 以退出码表示确认 `0`、拒绝 `1`、取消 `130`。 |
| `ui_task` | 执行一次有明确结束状态的命令，显示命令、耗时和退出码；支持 `--log live`、`--log capture` 和隐藏命令参数的 `--sensitive`。 |
| `ui_task_skip` | 记录因 script 缺失或前置条件不满足而跳过的任务及原因。 |
| `ui_service` | 执行持续运行的开发服务，Ctrl+C 映射为取消状态（退出码 130）；支持 `--sensitive`。 |
| `ui_status` | 输出单条 `info`、`success`、`warning` 或 `error` 状态。 |
| `ui_summary` | 输出计划或结果等结构化摘要；不承担任务执行。 |
| `ui_copyable_summary` | 输出结构化摘要与可直接复制的单行内容；复制内容前固定保留两条导轨间隔。 |

输出边界固定为：UI 反馈写入 stderr（交互控件使用 TTY），选择和输入结果写入 stdout，确认使用
退出码；`ui_task --log live` 包装的原生命令 stdout/stderr 保持原样透传，`--log capture` 将合并输出
为 UI 日志块。这样可以安全地用命令替换读取选择结果，也可以把 live 日志交给 CI 或其他工具处理。
脚本不再使用“阶段”作为独立反馈层；需要分组时使用 `ui_group_begin` / `ui_group_end`，需要结果时
使用 `ui_status` 或 `ui_summary`。成功结束 flow 前必须显式结束全部 group；失败或取消结束 flow 时，
UI 会按 LIFO 自动收口未闭合 group。一个 Shell 内不支持嵌套顶层 flow；group 只表达顺序结构，
当前不提供并行任务调度。

典型的多包嵌套组合如下；内层 group 的 `itemKey` 会由其中的任务继承：

```bash
ui_flow_begin --domain workspace --title '质量检查'
ui_group_begin --title '检查全部包'
ui_group_begin --title '[1/2] @schemx/core' --item-key '@schemx/core'
ui_task --title '类型检查' -- pnpm --dir packages/core type-check
ui_task_skip --title '单元测试' --reason 'package.json 未定义 test script'
ui_group_end success '@schemx/core 检查完成。'
ui_group_end success '全部包检查完成。'
ui_flow_end success '质量检查完成。'
```

有限批处理默认首错停止。`build`、workspace 质量任务和 release 的 `check`、`pack`、`verify` 支持
`--keep-going`；它只对普通失败继续，取消仍立即停止，最终返回首个失败码。`publish`、`execute`、
`dev`、release `test` 不支持该选项。

布局边界固定为：相邻 UI 输出块之间保留 1 条带前置 `│` 的导轨间隔行；任务原始日志视为
任务块内容，任务完成状态与日志末尾之间保留 1–2 条导轨间隔行。卡片、分组说明、摘要多行
内容属于同一个输出块，不会把其中的普通换行误判为额外步骤。该约束同时适用于 plain 和
pretty 格式，以及提示结果通过命令替换返回父 Shell 的场景。

终端格式可以通过环境变量控制：

```bash
SCHEMX_UI_FORMAT=auto    # 默认；TTY 使用 pretty，其他环境使用 plain
SCHEMX_UI_FORMAT=pretty  # 强制 Gum 样式（仍需安装 gum）
SCHEMX_UI_FORMAT=plain   # 稳定的纯文本输出
SCHEMX_UI_ASSUME_YES=true # 非交互环境下让 ui_prompt confirm 以退出码 0 确认
```

需要机器消费 UI 生命周期时，可设置 `SCHEMX_UI_EVENTS_FILE`。每个事件追加一行
`schemx.ui/v2` JSONL，顶层包含 `runId`（一次 workflow 命令）、`flowId`（一次顶层流程）、
`groupId`（当前分组）、`correlationId`（可选 `SCHEMX_UI_CORRELATION_ID`）和 `payload`；事件文件
独立于命令日志，适合 CI 收集。当前事件类型包括 `flow.started`、`group.started`、`group.finished`、
`note`、`prompt.completed`、`prompt.cancelled`、`task.started`、`task.finished`、`task.skipped`、
`status`、`summary` 和 `flow.finished`。group 事件还包含 `parentGroupId`、`depth`、耗时及后代统计；
task 开始和结束事件通过 `taskId` 配对，并可携带 `itemKey`。
