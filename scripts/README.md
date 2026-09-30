# 项目工作流脚本

根目录 `package.json` 的开发、构建、质量、测试和发布命令统一由 `scripts/workflow.ts` 分派。
使用 Node 原生类型剥离直接运行 `.ts`，没有构建步骤。

```text
scripts/
├── workflow.ts             # 项目级命令入口
├── workflow/
│   ├── commands/           # 命令编排：workspace、dev、tools、fix、release
│   ├── core/               # 进程执行、目录发现、package.json 读写、执行上下文
│   ├── packages/           # 包配置检查、产物边界检查、本地 tarball 打包
│   ├── release/            # 发布领域逻辑与 adapters/ 外部适配器
│   └── ui/                 # 终端 UI、交互控件、目标选择、批处理执行器
└── vite/                   # Vite 相关辅助脚本
```

## 运行环境

- Node ≥ 22.18（`package.json` 的 `engines` 声明），由原生类型剥离执行 TypeScript，无编译产物。
- 外部工具只有 `git`、`pnpm`、`gh` 和 `npm`。终端颜色使用 Node 内置的 `util.styleText`，
  交互控件使用 `@clack/prompts`；没有额外的二进制依赖。

## 输出边界

视觉输出全部写 **stderr**，`release plan` 的计划路径写 **stdout**。这样可以用命令替换读取
计划路径而不污染 UI 文本，CI 日志也不会混入交互控件的绘制内容。

## 目标选择

本地 TTY 下，workspace 命令通过 Clack 分组多选 `packages`、`plugins`、`examples` 中定义了对应
script 的目标；`dev` 使用单选。目标来源优先级为：命令行参数 → `SCHEMX_WORKFLOW_TARGETS` →
`SCHEMX_WORKFLOW_TARGET` → 非交互默认 `all` → 交互控件。

CI 和管道环境中，有限批处理默认执行所有符合条件的目标，`dev` 必须显式指定单个目标。
目标标识接受 `packages/core`、`core` 和 `@schemx/core` 三种形式，匹配使用精确比较。

## UI 约定

`Ui` 类是工作流唯一的 UI 边界，业务代码只使用它的公共方法：

| 方法                                            | 职责                                                     |
| ----------------------------------------------- | -------------------------------------------------------- |
| `flowBegin` / `flowEnd` / `flowEndFromExitCode` | 顶层工作流的开始与结束；后者按退出码自动选择语气。       |
| `groupBegin` / `groupEnd`                       | 以 LIFO 栈表达可嵌套的业务分组。                         |
| `task`                                          | 执行一次操作，结束时输出一行结果；失败时附缩进的输出块。 |
| `taskRow` / `taskPending` / `taskSkip`          | 渲染已完成、未执行与已跳过的目标行。                     |
| `service`                                       | 透传运行 dev / preview 一类的长驻服务，Ctrl+C 记为取消。 |
| `exec`                                          | 按当前日志模式运行子进程的唯一入口。                     |
| `note` / `status` / `summary`                   | 上下文说明、单条状态、结构化摘要卡片。                   |
| `interactive`                                   | 环境是否支持交互控件。                                   |

取消统一由 `WorkflowError` 表达：退出码 `130` 表示用户取消，`2` 表示用法或校验错误。
`flowEndFromExitCode` 把「成功 / 失败 / 取消」三态映射收敛到一处。

### 视觉约定

两条通道各司其职，互不重叠：

- **缩进表达位置**。每深入一层 group 缩进两格；批处理内用 `├─` / `└─` 标明兄弟关系与
  列表终点；子进程输出缩进到所属分组之下。
- **颜色只表达结果**。

| 结果          | 符号 | 颜色   |
| ------------- | ---- | ------ |
| 成功          | `✔`  | 绿     |
| 失败          | `✖`  | 红     |
| 取消          | `■`  | 黄     |
| 跳过 / 未执行 | `○`  | 弱化灰 |

标题分三级明暗：流程与分组标题加粗、任务标题默认色、说明与耗时弱化。分组标题不带结果色，
避免「蓝色既表示分组也表示说明」这类同色异义。

批处理内任务按三列对齐渲染：目标、任务名、耗时。列宽由该批次的实际内容算出，并受最小值与
上限约束，因此包名长短不一时列也不会错位。

### 子进程输出与转圈动画

任务的子进程输出**默认捕获**：成功时静默，失败时渲染成缩进的详情块。

```
    ⠋ ├─ @schemx/core          check         （转圈中）
    ✔ ├─ @schemx/core          check        13.4s
    ✖ └─ @schemx/vue           check        11.3s
│   ┌ $ pnpm run lint && pnpm run format:check && pnpm run type-check
│   │ $ vue-tsc -p tsconfig.json --noEmit
│   │ src/bridge/formBridge.ts(171,7): error TS2322: Type 'ShallowRef<unknown>' is not
│   │ assignable to type 'ShallowRef<TValues>'.
│   └ … 另有 12 行，设置 WORKFLOW_LOG=live 查看完整输出
```

执行中的任务在 TTY 下默认显示转圈动画，包括发布计划、前置检查、质量任务和长驻服务。
捕获与实时模式都由 UI 管理输出：新日志写入前清除底部动画行，写入后恢复 loading，
让等待期间始终可见当前任务。长任务名仅在动画行缩短显示，完成结果保留全文。

每帧都以换行结束，光标控制始终针对最后一个物理行；成功、失败和取消后停止动画并显示结果。
非 TTY 不使用光标控制，改为输出静态「执行中」和完成状态。

| 模式 | TTY | 行为                                          |
| ---- | --- | --------------------------------------------- |
| 捕获 | 是  | 占位行显示转圈动画，完成后原地替换为结果行    |
| 实时 | 是  | 日志追加在 loading 上方，任务等待期间持续转圈 |
| 捕获 | 否  | 输出静态进行中状态，完成后追加结果            |
| 实时 | 否  | 输出静态进行中状态、实时日志及最终结果        |

失败详情按语义分色与重排：命令回显（`$ …`）是上下文，弱化处理并排在最前；明确的错误
标记（`error TS…`、`ELIFECYCLE`、`ERR_*`）染红并排在最后；其余输出居中弱化。跨流的重复
行只保留一份（pnpm 会在 stdout 与 stderr 各写一次 `[ELIFECYCLE]`）。超长行截断到 140 列，
避免类型展开在终端反复折行把锚点列冲散；行数超预算时优先保留错误结论。

`dev`、`preview` 等长驻服务始终实时显示日志，并持续展示运行状态。

设置 `WORKFLOW_LOG=live` 可实时显示任务日志，TTY 下同时保留 loading：

```bash
WORKFLOW_LOG=live pnpm build
```

## 批处理

`runBatch` 是 `build`、workspace 质量任务和 `release pack` 共用的目标循环：统一
`--keep-going` 语义、失败汇总和收尾消息。命令只负责挑选目标并提供 `execute` 回调，
`identify` 回调提供失败汇总中的目标标识。

有限批处理默认首错停止。`--keep-going` 只对普通失败继续，取消仍立即停止，最终返回首个失败码。

## 发布顺序与中断恢复

发布目标按 workspace 依赖拓扑排序：`dependencies` 与 `optionalDependencies` 中的 `workspace:`
依赖总是先发布，`devDependencies` 与 `peerDependencies` 不参与排序。发布前检查会确认未选中依赖的
当前版本已在 registry 可获得。

`publish` 会把冻结计划写到 `.release/plans/<时间戳>-<通道>.json`（目录已在 `.gitignore` 中），
并在旁边维护同名 `.state.json`，逐包记录 `published`、`tagged`、`released` 三个不可逆步骤：

- 发布中断时，已成功发布的包仍会完成版本提交、Tag 推送和 GitHub Release；未发布包的版本
  改动会回滚，工作区保持干净。
- 修复原因后执行 `release execute <plan>` 即可续跑：已完成的步骤被跳过，未完成的步骤继续执行。
- 进度文件与冻结计划的版本不一致时，续跑会被拒绝，需要删除进度文件重新发布。
- **进度文件损坏时不做任何版本回滚**：状态不可信时无法判断哪些包已经上线，回滚会造成
  工作区版本与 npm 版本不一致。此时工作流保留版本备份、报错中止，由人工确认。

## 环境变量

| 变量                                                         | 作用                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------- |
| `SCHEMX_WORKFLOW_TARGET(S)`                                  | 预选 workspace 目标。                                       |
| `SCHEMX_RELEASE_CHANNEL`                                     | 预选发布通道。                                              |
| `SCHEMX_RELEASE_TARGET`                                      | 预选发布目标。                                              |
| `SCHEMX_RELEASE_VERSION_ACTION`                              | 预选版本动作。                                              |
| `SCHEMX_RELEASE_CUSTOM_VERSION`                              | 预选精确版本基线。                                          |
| `SCHEMX_UI_ASSUME_YES`                                       | 非交互环境下让发布确认视为通过。                            |
| `SCHEMX_RELEASE_SHA` / `_TIMESTAMP` / `_PRERELEASE_SEQUENCE` | 注入可复现测试所需的版本输入。                              |
| `SCHEMX_RELEASE_NOTES_FILE`                                  | 指定包级发布说明文件；指定后文件缺失即报错。                |
| `SCHEMX_RELEASE_NOTES_GENERATOR`                             | 外部 Release notes 生成器可执行文件。                       |
| `WORKFLOW_LOG`                                               | `live` 让任务子进程输出透传；默认 `capture`，仅失败时显示。 |
| `WORKFLOW_DEBUG`                                             | 为 `true` 时输出未处理异常的堆栈。                          |

## 测试

```bash
pnpm test:scripts        # vitest，覆盖工作流脚本自身
pnpm type-check:scripts  # tsc -p scripts/tsconfig.json
```

`WORKFLOW_REMEDIATION.md` 记录了本次 TypeScript 重构之前的历史整改项。
