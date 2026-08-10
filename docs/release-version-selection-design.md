# 发布通道版本选择设计

## 背景

当前发布脚本仅允许 `latest` 通道选择 `current`、`patch`、`minor`、`major`
或精确版本 `x.y.z`。`dev`、`alpha`、`beta`、`rc`、`next` 等预发布通道会从
当前包版本无条件递增 patch，并附加通道、时间戳和提交 SHA。

例如，当前包版本为 `0.2.3` 时：

```bash
pnpm release:publish beta core
```

会生成类似 `0.2.4-beta.20260730120000.abc1234` 的版本。该行为无法表达
「发布 `1.0.0` 的公开 Beta 测试版本」这一常见需求。

## 目标

- 所有发布通道都能选择目标正式版本基线。
- 支持以 `patch`、`minor`、`major` 或精确 `x.y.z` 计算版本基线。
- 对 `alpha`、`beta`、`rc`、`next` 使用可读、可排序且符合 SemVer 的预发布编号。
- 保持多包发布的独立版本线，避免精确版本误写入多个包。
- 让公开 Beta 与 RC 发布具备 Git Tag 和 GitHub Release 的可追溯性。
- 保留 `dev` 通道的快速临时验证能力。
- 以 Clack、Gum、pnpm 和新的发布模块彻底重构现有发布流程。
- 保持当前终端体验的识别度，但不复用旧发布或终端反馈实现。

## 非目标

- 不自动将预发布版本写回开发分支的 `package.json`。
- 不自动把预发布版本升级为正式版。
- 不允许通过发布命令修改任意已发布版本。
- 不复用旧发布流程、Node 终端反馈或其 UI 实现。
- 旧发布流程完成双轨验证后由新 Shell 模块完全替代。

## 重构边界与模块架构

新流程是项目级工作流系统，不是旧发布实现的增量改造。实现统一放在
`scripts/`；根目录的开发、质量、构建、测试与 `release:*` 入口都通过 `scripts/workflow.sh` 分派。

```text
scripts/
├── workflow.sh                   # 项目级 CLI 入口与命令分派
├── workflow/
│   ├── commands/                  # workspace 与 release 命令编排
│   ├── domains/                   # workspace、packages、release 领域逻辑
│   ├── shared/                    # 无 UI 的基础能力
│   └── ui/                        # terminal、interaction、task 等 UI 能力
└── tests/
    └── release/                  # 发布域的单元与集成测试
```

模块职责必须单向依赖：

```text
CLI / Terminal UI -> 命令域 -> 工作流步骤 -> 基础设施适配器
                       -> pnpm / npm / Git / GitHub
```

- `workflow/domains/workspace/api.sh`、`workflow/domains/release/targets.sh`、
  `workflow/domains/release/versions.sh` 与 `workflow/domains/release/plan.sh` 不渲染终端、不执行发布，也不修改文件。
- `plan.sh` 输出完整、稳定的发布计划；后续阶段只能消费该计划，不能重新计算版本。
- `release/preflight.sh`、`release/quality.sh`、`release/artifacts.sh`、`release/publish.sh`
  是发布工作流步骤，负责返回
  成功、失败和可诊断信息，不自行决定下一步。
- `core/ui.sh` 只收集输入、展示计划和渲染状态，不包含版本或发布业务判断。
- `workflow/commands/release/main.sh` 是发布状态机；`workflow/commands/workspace.sh` 负责通用任务的目标选择与执行。

发布计划应是新系统的核心契约。它至少包含通道、目标包、当前版本、目标基线、实际版本、
npm dist-tag、是否创建提交、Tag 与 GitHub Release。计划先在内存或临时 JSON 文件中
生成，确认后冻结，避免质量检查、发布和 Tag 阶段各自计算出不同版本。

## 核心模型

发布版本由「目标正式版本基线」和「发布通道」共同确定：

```text
<正式版本基线>-<通道>.<序号>
```

其中正式版本基线始终为无预发布标识的 `x.y.z`。`latest` 不追加预发布标识，
其他通道按各自策略生成唯一版本。

| 通道 | 版本格式 | 用途 |
| --- | --- | --- |
| `latest` | `1.0.0` | 正式稳定发布 |
| `dev` | `1.0.0-dev.<时间戳>.<SHA>` | 日常构建或临时验证 |
| `alpha` | `1.0.0-alpha.0` | 早期内部预览 |
| `beta` | `1.0.0-beta.0` | 公开测试 |
| `rc` | `1.0.0-rc.0` | 正式发布候选 |
| `next` | `1.0.0-next.0` | 下一版本线预览 |

`alpha`、`beta`、`rc`、`next` 的序号从 `0` 开始。再次发布相同基线和通道时，
从 npm 已发布版本中查找最大序号并递增，例如：

```text
1.0.0-beta.0 -> 1.0.0-beta.1 -> 1.0.0-beta.2
```

这比时间戳版本更便于用户理解、比较和升级。时间戳 + SHA 保留给 `dev`，因为
该通道的目标是高频且短期的构建验证，而不是有序的测试阶段。

## 命令行设计

统一命令格式保持不变：

```bash
pnpm release:publish [channel] [target] [version-action]
```

`version-action` 对所有通道开放：

- `patch`：基线递增 patch，例如 `0.2.3` -> `0.2.4`。
- `minor`：基线递增 minor，例如 `0.2.3` -> `0.3.0`。
- `major`：基线递增 major，例如 `0.2.3` -> `1.0.0`。
- `x.y.z`：指定精确正式版本基线。
- `current`：仅用于 `latest`，发布当前 `package.json` 中的正式版本。

预发布通道不提供 `current`。若当前版本已经是稳定版，例如 `0.2.3`，
发布 `0.2.3-beta.0` 的 SemVer 优先级低于 `0.2.3`，不适合作为该稳定版之后的
预发布。因此预发布必须显式选择下一条版本线：`patch`、`minor`、`major` 或 `x.y.z`。

### 示例

```bash
# 发布 1.0.0 的首个公开 Beta
pnpm release:publish beta core 1.0.0
# => @schemx/core@1.0.0-beta.0

# 继续发布同一版本线的 Beta
pnpm release:publish beta core 1.0.0
# => @schemx/core@1.0.0-beta.1

# 从 0.2.3 开始下一条 major 版本线的 RC
pnpm release:publish rc core major
# => @schemx/core@1.0.0-rc.0

# 发布下一条 minor 版本线的预览版
pnpm release:publish next vue minor
# => @schemx/vue@0.3.0-next.0

# 高频开发验证版本
pnpm release:publish dev vant minor
# => @schemx/vant@0.3.0-dev.20260730120000.abc1234
```

精确版本仅允许单包目标：

```bash
pnpm release:publish beta core 1.0.0
```

多包目标只能使用 `patch`、`minor`、`major`。每个包根据自己的当前稳定版本
计算基线，避免不同版本线的包被强制改为同一个版本。

## 交互流程

交互式 `pnpm release:publish` 应按以下顺序选择：

1. 发布通道。
2. 发布目标。
3. 版本动作。
4. 当选择「指定版本」时，输入正式版本基线 `x.y.z`。
5. 输出最终版本计划并等待确认。

版本动作说明应随通道变化：

- `latest`：`current`、`patch`、`minor`、`major`、`custom`。
- `dev`、`alpha`、`beta`、`rc`、`next`：`patch`、`minor`、`major`、`custom`。

最终计划必须同时展示 npm dist-tag 和实际发布版本，例如：

```text
通道：beta
目标：core
版本基线：1.0.0
实际版本：@schemx/core@1.0.0-beta.0
npm tag：beta
```

## 终端体验、Clack 与 Gum

新流程以 Clack 和 Gum 重新实现终端体验，不依赖 `scripts/terminal.mjs` 或
`scripts/workflow/ui/internal/terminal-feedback`。保留的是现有体验的视觉与行为契约，而不是其代码。
Clack 提供选择、输入和确认控件；Gum 提供 Spinner、样式、布局和表格能力；Shell 发布流程不需要
直接维护 Bubbles、Bubble Tea 或 Lip Gloss 的 Go 运行时。

| 组件 | 职责 | 使用位置 |
| --- | --- | --- |
| Clack | 选择、文本输入、确认与取消处理 | `lib/interaction/clack.mjs` |
| Gum | Spinner、样式、布局及表格 | `lib/terminal`、`lib/task` |

`lib/ui.sh` 是 Shell 与 UI 的唯一边界。领域模块和工作流模块不得直接调用 Gum、输出
ANSI 转义序列或自行打印日志，而是仅调用 `ui_*` 接口。未来如果确实需要独立的全屏 TUI，
再单独评估是否引入 Bubble Tea、Bubbles 和 Lip Gloss，不改变当前发布业务模块。

视觉上采用「发布控制台」而不是传统流水日志：紫色作为发布主色、青色标示流程与交互、
绿色表示已完成、琥珀色表示需要注意、玫红色表示失败。开场使用产品标识和副标题，计划
以卡片、通道标签和“当前版本 → 目标版本”的版本流向呈现；任务执行显示实际命令、Gum
Spinner 和耗时。颜色只承担辅助语义，纯文本标签、图标和退出码仍是
信息主载体，以满足无色终端和可访问性需求。

UI 模块提供流程开场、可嵌套流程分组、说明、提示、任务、状态和摘要七类能力。计划和摘要读取
冻结后的计划 JSON；任务通过 `ui_task` 执行外部命令，并统一报告命令、日志策略、耗时和
退出码。流程分组只表达业务边界，不再作为独立的“阶段”反馈层。

体验要求如下：

- 有明确的流程标题、业务分组和相邻任务间隔；相邻 UI 输出块保持 1 条带前置 `│` 的导轨间隔行，任务完成状态与原始日志末尾保持 1–2 条导轨间隔行。
- 发布计划以对齐的键值对展示，确认前可完整审阅。
- 每个外部命令显示任务名称和实际命令，执行时有 Spinner，完成后显示耗时。
- 失败时保留命令、退出码和可读的失败摘要；多包发布中明确区分已发布、失败、未执行。
- TTY 使用颜色、Spinner 和选择控件；非 TTY 输出等价的纯文本信息。

`lib/ui.sh` 是新系统唯一的终端适配器。它封装 Clack 的 `select`、`multiselect`、
`group-multiselect`、`input`、`confirm` 以及 Gum 的样式和 Spinner，并向工作流提供稳定接口：

```text
ui_flow_begin
ui_group_begin
ui_group_end
ui_group_run
ui_note
ui_prompt
ui_task
ui_task_skip
ui_service
ui_status
ui_summary
ui_flow_end
```

工作流不得直接调用 `gum`、`echo` 或 ANSI 转义序列。所有 Turbo、pnpm、Git、npm 和
GitHub 命令通过 `ui_task` 或 `ui_service` 运行，由统一 UI 处理命令回显、Spinner、耗时、
退出码和失败状态。UI 写入 stderr，选择和输入结果写入 stdout，确认以退出码表达；`live` 任务
原样透传命令输出，`capture` 任务缓冲后渲染；另可
通过 `SCHEMX_UI_EVENTS_FILE` 追加 `schemx.ui/v2` JSONL 生命周期事件。

发布前检查与逐包质量任务使用两层 group：外层表达检查类别，内层以 `itemKey` 标识具体包。
`group.finished` 记录状态、耗时和后代统计，任务通过 `taskId` 配对。`release check`、`release pack`
和 `release verify` 可使用 `--keep-going` 收集普通失败；发布与执行命令保持 fail-fast。

Clack 与 Gum 的 TTY 与非 TTY 策略如下：

| 场景 | 输入 | 输出 |
| --- | --- | --- |
| 本地 TTY | Clack 选择、输入和确认 | Gum 样式、Spinner 和彩色摘要 |
| CI 或管道 | CLI 参数或环境变量 | `ui.sh` 输出稳定纯文本，不调用 Clack 交互命令 |
| 自动化 dry-run | 显式参数 | 输出可解析的发布计划与退出码 |

质量任务由 `ui_task` 逐包直接执行；`publish`、Tag 与 GitHub Release 仍由 Shell 状态机串行执行。

## 版本规划与可用性校验

发布流程应先构建完整计划，再执行质量检查、打包和发布。每个目标包的计划包含：

- 当前 `package.json` 版本。
- 目标正式版本基线。
- 实际 npm 版本。
- npm dist-tag。
- 预发布序号（非 `dev` 通道）。

对于 `alpha`、`beta`、`rc`、`next`，流程应查询 npm registry 中同一包、同一基线、
同一通道的版本，并选择下一个可用整数序号。查询失败不得将「无法确认」视为
「版本可用」。

如果目标正式版 `x.y.z` 已经在 npm 发布，预发布流程应停止并提示用户选择下一条
版本线。这样可以避免在已稳定发布的版本线上创建语义倒退的预发布版本。

`dev` 版本仍使用时间戳和 SHA，并沿用现有 npm 版本可用性检查，确保不会重复发布。

## Git 与 GitHub Release

### `latest`

保持现有行为：

1. 将正式版本写入 `package.json` 和锁文件。
2. 提交版本变更。
3. 发布 npm。
4. 创建 Git Tag。
5. 创建 GitHub Release。

### `alpha`、`beta`、`rc`、`next`

面向测试者的预发布应在 npm 发布成功后创建带完整预发布版本的 Git Tag，并创建
标记为 prerelease 的 GitHub Release。Tag 示例：

```text
@schemx/core@1.0.0-beta.0
```

预发布仍不修改或提交开发分支的 `package.json`。Tag 指向发布时的源码提交，
GitHub Release 说明使用该包上一个同类或同包 Tag 到当前提交的范围生成。

`dev` 默认不创建 Git Tag 或 GitHub Release，以避免高频临时版本污染 Tag 列表。
如后续需要保留某次开发构建，可另行设计显式 `--create-release` 开关。

## 迁移影响

- 预发布命令新增必填的版本动作；现有 `pnpm release:publish beta core` 不再足够，
  应改为 `pnpm release:publish beta core patch`、`minor`、`major` 或 `x.y.z`。
- `alpha`、`beta`、`rc`、`next` 的版本格式从时间戳形式改为递增序号形式。npm dist-tag
  名称保持不变。
- 自动化任务必须显式传入版本动作，或通过新增的环境变量提供对应选择，不能依赖 TTY。

## 实施范围

实施时需要调整以下位置：

- `scripts/workflow/domains/release/`：实现版本动作解析、发布计划、预发布序号查询、预检、
  pnpm 质量任务、npm 发布、Tag、GitHub Release、Release notes 与测试；不复用旧
  发布流程或 Node 终端反馈实现。
- `scripts/workflow/ui/internal/`：按 `terminal`、`interaction`、`task` 拆分终端呈现、Clack 交互和任务生命周期，
  Spinner、耗时和失败摘要，并实现非 TTY 纯文本降级。
- `scripts/tests/`：覆盖各通道、各版本动作、序号递增、错误分支、多包
  限制、发布计划冻结、终端交互体验和非交互模式的输出边界。
- 根目录 `package.json`：将开发、质量、构建、测试与 `release:*` 入口统一指向
  `scripts/workflow.sh`、对应命令域或新测试入口。
- `README.md`：更新命令说明、版本格式和公开测试发布示例。

## 验收标准

- `pnpm release:publish beta core 1.0.0` 规划并发布 `1.0.0-beta.0`。
- 再次执行相同命令时，规划并发布 `1.0.0-beta.1`。
- `patch`、`minor`、`major` 在所有预发布通道均可用，并基于每个包自己的版本计算。
- 预发布通道拒绝 `current`，并给出可执行的替代命令。
- 精确版本在多包目标下被拒绝。
- 目标稳定版已发布时，预发布被拒绝，不生成低于稳定版的版本。
- `beta`、`rc`、`alpha`、`next` 发布成功后创建正确 Tag 与 GitHub prerelease。
- `dev` 发布不创建 Tag 或 GitHub Release，且保留时间戳 + SHA 版本格式。
- 新流程不依赖旧发布或终端反馈实现，但其 Clack 与 Gum 终端体验满足流程标题、任务命令、
  分隔线、耗时、失败摘要和非 TTY 输出标准。
- 所有发布计划必须在执行前冻结；任一后续阶段不得重新计算或改变实际版本。
- 发布失败、npm 查询失败或 Tag/Release 创建失败时，错误信息能够指出已发布与未完成的
  包，且不会修改开发分支版本文件。
