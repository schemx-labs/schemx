<p align="center">
  <img src="./logo.png" alt="schemx logo" width="360"/>
</p>

<p align="center">
  Schema 驱动的动态表单引擎，统一处理字段状态、校验、联动与动态结构，将表单业务规则与具体 UI 组件解耦。
</p>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.zh-CN.md">中文</a>
</p>

<p align="center">
  <a href="#包说明">包说明</a> · <a href="#快速开始">快速开始</a> · <a href="#示例项目">示例项目</a> · <a href="#本地开发">本地开发</a> · <a href="#发布脚本">发布脚本</a> · <a href="#按包生成-release-note">Release Note</a>
</p>

schemx 聚焦动态表单中最容易失控的部分：字段状态、校验、联动、运行时 Schema 更新、可渲染视图投影和 UI 适配边界。业务只描述 Schema，Core 负责将其编译为稳定的运行时结构，上层适配器再把 ViewSchemas 渲染为具体界面。

## 包说明

| 包                                          | 职责                         | 适用场景                                         |
| ------------------------------------------- | ---------------------------- | ------------------------------------------------ |
| [`@schemx/core`](./packages/core)           | 框架无关的 headless 表单引擎 | 构建表单运行时、字段依赖、校验和 ViewSchemas     |
| [`@schemx/vue`](./packages/vue)             | Vue 3 适配层                 | 把 ViewSchemas 渲染为 Vue 组件树                 |
| [`@schemx/vant`](./packages/vant)           | Vant renderer 适配包         | 使用 Vant 4 快速落地移动端动态表单               |

## 快速开始

根据项目所需的层级安装依赖：

```bash
# 仅使用框架无关的表单运行时
pnpm add @schemx/core

# 运行下方 Zod Standard Schema 示例
pnpm add @schemx/core zod

# 使用 Core 内置的 async-validator 规则
pnpm add @schemx/core

# 接入自定义 Vue Renderer
pnpm add @schemx/vue vue

# 使用内置 Vant Renderer
pnpm add @schemx/vant vant vue
```

各入口的完整示例、样式导入方式和 API 说明见对应的包文档：

- [`@schemx/core` 使用说明](./packages/core/README.md)
- [`@schemx/vue` 使用说明](./packages/vue/README.md)
- [`@schemx/vant` 使用说明](./packages/vant/README.md)

Core 校验使用 `required` 字段、命名规则 Registry，以及以 `valid` 为判别字段的扁平结果：

```ts
import { createForm, createPresetRuleRegistry } from "@schemx/core"
import { z } from "zod"

const registry = createPresetRuleRegistry()
registry.register("email", z.string().email("邮箱格式错误"))

const form = createForm<{ email: string }>({
  initialValues: { email: "" },
  schemas: [
    {
      name: "email",
      label: "邮箱",
      componentType: "input",
      required: { message: "请输入邮箱" },
      rules: ["email"],
    },
  ],
  presetRuleRegistry: registry,
})

const result = await form.validate()
if (!result.valid) console.log(result.errors)
```

## 架构边界

```text
raw schemas
  -> @schemx/core
  -> runtime Schema Node
  -> validation / dependency / scheduler
  -> ViewSchemas
  -> @schemx/vue
  -> renderer registry
  -> @schemx/vant 或业务 renderer
```

`@schemx/core` 不依赖具体 UI 框架，也不渲染 DOM。它只负责把表单规则、字段状态和运行时 Schema 维护好，并输出 UI 层可消费的 ViewSchemas。

`@schemx/core/adapter` 是 UI 适配层的公开集成边界。可使用 `createFormStateAdapter(form)` 获取表单值、touched 字段、pending 字段、loading 和单字段状态的稳定快照与订阅；使用 `createRendererRegistry()` 注册 Renderer。

`@schemx/vue` 只负责 Vue 组件树的适配，不绑定具体组件库。业务可以通过 `rendererRegistry` 接入自己的输入框、选择器、上传组件或设计系统组件。

`@schemx/vant` 是基于 Vant 4 的 renderer 集合，面向移动端表单场景。它复用 `@schemx/core` 和 `@schemx/vue` 的能力，并在包入口自动注册默认 renderer。

`@schemx/core` 内置 async-validator 规则支持。`@schemx/vue` 和 `@schemx/vant` 会自动安装必需的 Schemx 下层包；Vue 和 Vant 仍是 peer dependencies，使用时需由业务项目显式声明。

## 何时使用

- 表单字段来自后端配置、低代码配置或业务 Schema。
- 字段显隐、禁用、只读、必填、校验规则需要根据其他字段动态变化。
- 表单结构会在运行时增删，例如条件字段、多步骤问卷或远程 Schema。
- 同一套表单能力需要复用到多个 UI 组件库或多个业务端。
- 需要把表单运行时能力和 UI 组件实现解耦。

如果只是少量静态字段，且没有字段联动、动态 Schema 或跨端复用诉求，直接使用 UI 组件库自带表单能力通常更简单。

## 选择入口

- 只需要表单运行时、校验、依赖和 ViewSchemas：使用 `@schemx/core`。
- 已有 Vue 组件库或业务组件，需要自己注册 renderer：安装 `@schemx/vue` 和 `vue`。
- 项目使用 Vue 3 + Vant 4，希望直接使用内置移动端 renderer：安装 `@schemx/vant`、`vant` 和 `vue`。

具体 API 和使用示例见各包文档。

## 容器状态与动态子树

Group 和 Dependency 都可以作为容器使用 `visible`、`readonly`、`disabled` 与 `dependencies`。Group 通过 `children` 声明，Dependency 通过 `to` 和 `renderer` 声明；容器不使用 `componentType`。容器状态会递归传递给所有后代字段：祖先隐藏时后代不可见，祖先只读或禁用时后代不能通过自身配置解除限制。

```ts
const schemas = [
  { name: "editable", label: "允许编辑", componentType: "switch" },
  {
    key: "profile",
    label: "资料",
    collapsible: true,
    destroyOnCollapse: false,
    dependencies: {
      triggerFields: ["editable"],
      readonly: (values) => !values.editable,
    },
    children: [{ name: "name", label: "姓名", componentType: "input" }],
  },
]
```

Dependency 的 `to` 只负责重建动态子树；容器 `dependencies.triggerFields` 只负责更新呈现状态。两者可以监听同一字段，但需要分别声明。容器 dependencies 只支持 `visible`、`readonly`、`disabled`，不支持副作用型 `trigger`。

可在 [Vant 示例项目](./examples/vant) 中直接操作 Group 和 Dependency 的容器状态。

## 示例项目

- [Vant 示例](./examples/vant/README.md)：覆盖内置 Renderer、校验、联动、动态 Schema、容器状态和插槽。
- [uni-app + Vant 示例](./examples/uniapp-vant)：验证 H5 与多种小程序构建目标下的集成方式。

## 本地开发

仓库使用 pnpm workspace。先安装依赖，再通过根命令交互选择要运行的包、构建插件或示例：

```bash
pnpm install
pnpm dev
```

也可以绕过交互选择，直接运行指定 workspace：

```bash
pnpm --filter vant-demo dev
```

| 命令                  | 作用                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------- |
| `pnpm dev`            | 交互单选并启动一个具有 `dev` 或 `dev:h5` 脚本的目标；非交互环境必须显式指定单个目标。 |
| `pnpm build`          | 交互选择并构建目标；非交互环境默认构建全部目标。                                      |
| `pnpm build:analyze`  | 交互选择并执行构建分析脚本。                                                          |
| `pnpm test`           | 交互选择并运行测试；非交互环境默认运行全部测试。                                      |
| `pnpm type-check`     | 交互选择并执行 TypeScript 类型检查。                                                  |
| `pnpm lint`           | 交互选择并执行 ESLint 检查。                                                          |
| `pnpm lint:fix`       | 交互选择并执行 ESLint 自动修复。                                                      |
| `pnpm format`         | 交互选择并执行 Prettier 格式化。                                                      |
| `pnpm format:check`   | 交互选择并执行 Prettier 格式检查。                                                    |
| `pnpm check`          | 交互选择并执行目标自身的完整静态检查。                                                |
| `pnpm fix`            | 执行全部代码自动修复；提交钩子使用 `--staged` 模式。                                   |
| `pnpm code-check`     | 执行所有 workspace 包的完整代码检查。                                                 |
| `pnpm pack-local`     | 交互选择可打包的 `packages` / `plugins` 目标并生成 tarball。                          |
| `pnpm check:packages` | 检查 workspace 包配置与构建产物 external 边界。                                       |
| `pnpm preview`        | 启动 Vite Preview。                                                                   |

## 项目工作流

根目录的开发、构建、质量与测试命令统一通过 `scripts/workflow.sh` 执行。本地终端会按任务
使用 Clack 选择定义了对应 script 的 `packages`、`plugins`、`examples` 目标；`dev` 使用单选，
其余批处理任务使用多选；CI 或管道环境中，批处理默认执行所有符合条件的目标，`dev` 则必须
显式指定单个目标。每个目标都直接执行对应 package script。

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm fix
pnpm code-check
pnpm check:packages
```

`pnpm install` 会配置版本化 Git hook；配置完成后，每次提交都会先执行 `pnpm fix --staged`，
再执行 `pnpm code-check`。

有限批处理默认在首个失败后停止；构建、workspace 质量任务以及 `release check`、`release pack`、
`release verify` 可传入 `--keep-going`，继续执行剩余目标并最终返回首个失败码。取消始终立即停止：

```bash
bash scripts/workflow.sh lint all --keep-going
bash scripts/workflow.sh release pack all --keep-going
bash scripts/workflow.sh release verify /path/to/plan.json --keep-going
```

`pnpm pack-local` 也通过同一工作流选择多个目标；它只处理可本地打包的 `packages` 和
`plugins` 目标。在 CI 中可在命令后传入 `all`、`packages/core` 或 `plugins/<name>`，
也可使用 `SCHEMX_WORKFLOW_TARGETS` 提供逗号分隔的目标列表。

所有工作流共用同一套 Shell UI：一个命令内只允许一个顶层流程，任务负责命令、耗时和退出码，
`ui_group_begin` / `ui_group_end` 用于可嵌套的业务分组，不再额外渲染重复的“阶段”反馈。UI 写入 stderr；选择和输入
结果写入 stdout，确认则以退出码表示（确认 `0`、拒绝 `1`、取消 `130`）。`--log live` 的原生命令
stdout/stderr 保持原样透传，`--log capture` 则统一缓冲后渲染。可用 `SCHEMX_UI_FORMAT=plain` 强制
稳定纯文本，或用 `SCHEMX_UI_EVENTS_FILE=/path/to/events.jsonl` 追加机器可消费的 `schemx.ui/v2`
JSONL 生命周期事件；相邻 UI 输出块之间保持 1 条带前置 `│` 的导轨间隔行，任务完成状态与原始
日志末尾保持 1–2 条导轨间隔行；非交互确认可设置 `SCHEMX_UI_ASSUME_YES=true`。

发布是其中的独立命令域，使用 `release:*` 前缀。

## 发布脚本

发布脚本统一通过 `pnpm release:*` 执行。涉及包目标的命令都支持 `all`、`core`、`vue`、`vant`：

- `release:publish` 不传参数时会依次选择发布通道、发布目标和版本基线动作；发布目标支持空格多选。
- `release:pack` 默认目标为 `all`。
- CI 或非交互环境中建议显式传入参数。

正式发布使用 `latest` 通道。选择 `patch`、`minor`、`major` 或 `x.y.z` 时，脚本会自动提升版本、同步 `pnpm-lock.yaml`，并提交版本变更，再继续发布：

版本处理方式对应 SemVer 的 `x.y.z`：

- `patch`：提升 `z` 位，例如 `1.2.3` -> `1.2.4`
- `minor`：提升 `y` 位，例如 `1.2.3` -> `1.3.0`
- `major`：提升 `x` 位，例如 `1.2.3` -> `2.0.0`

```bash
pnpm release:publish latest vue patch
pnpm release:publish latest vue x.y.z
```

如果要发布当前已提交版本，可以选择 `current`：

```bash
pnpm release:publish latest vue current
```

精确版本（将示例中的 `x.y.z` 替换为目标版本）只允许用于单包目标，且必须是尚未发布的版本；
已发布版本应使用 `current`，避免把版本线不同的包强行设置成同一个版本。

预发布需要明确选择 `patch`、`minor`、`major` 或 `x.y.z` 版本基线。`alpha`、`beta`、`rc`、`next`
会生成可排序的 `0.1.0-beta.0` 版本；发布完成后恢复本地 `package.json`：

```bash
# 发布 1.0.0 的首个公开 Beta；再次发布会自动递增为 1.0.0-beta.1。
pnpm release:publish beta vue 1.0.0
```

### 自定义 GitHub Release 说明

`latest` 正式发布会为每个包创建 GitHub Release。默认说明按该包上一个 tag 到
`HEAD` 的 Conventional Commit 自动生成。需要人工确认时，可在对应包根目录放置
`release-notes.md`；也可以由 Agent 生成摘要。两种方式均只影响 GitHub Release notes，
不影响版本提交信息。

```bash
# 使用包级 Markdown 文件；例如 packages/core/release-notes.md。
pnpm release:publish latest core current

# 调用可执行生成器；生成器从 stdout 输出 Markdown。
SCHEMX_RELEASE_NOTES_GENERATOR=/path/to/release-notes-generator \
  pnpm release:publish latest core current
```

生成器会收到以下参数：`--repository`、`--package`、`--version`、`--tag`、
`--previous-tag` 和 `--commit-range`。可据此调用 Agent/LLM，并通过
`git diff <commit-range> -- packages/<package>` 获取包级变更。Skill 不能由 Bash
直接执行；应由具备相应 Skill 的 Agent CLI 或自动化服务实现该生成器。

如果设置了 `SCHEMX_RELEASE_NOTES_FILE`，它会覆盖包级默认路径，仅适用于临时单包发布。
多包发布时，每个包会读取自己的 `packages/<package>/release-notes.md`；若文件不存在，
则按该包自己的上一个 tag 生成说明。

### 按包生成 Release Note

仓库使用“结构化数据 → 校验 → 渲染”的方式维护发布说明。Agent 的
`release-notes-generator` Skill 负责分析 Git Diff、公共 API、TypeScript 类型和用户影响；
仓库脚本只处理可重复的事实收集、数据校验和 Markdown 渲染。

#### 日常使用

日常无需运行 `release:notes:*` 命令，也无需手动创建 JSON。直接向具备
`release-notes-generator` Skill 的 Agent 说明发布意图即可。

预览当前所有受影响包的发布说明：

```text
使用 release-notes-generator 分析当前 HEAD，预览所有受影响包的 Release Note。
```

预览不会写入文件。Agent 会自动收集每个包自己的 Tag、Diff、公开 API、类型和依赖影响，判断
哪些包有用户可见变更，并展示各包的摘要、Breaking Change 和 Markdown 预览。

确认内容后，明确要求写入：

```text
确认写入所有受影响包的 Release Note，并生成版本归档。
```

Skill 会自动完成以下操作：

1. 收集每个受影响发布包的 Git 证据；
2. 生成并审核各包独立的 Release Data；
3. 校验证据、分类和 Breaking Change 迁移说明；
4. 为每个包更新 `packages/<package>/release-notes.md`；
5. 生成 `docs/releases/<package>/<version>.md` 版本归档。

现有 `pnpm release:publish` 会直接读取包级 `release-notes.md` 创建 GitHub Release，因此生成说明后可
继续执行既有发布流程。

Skill 内部包含确定性脚本、发布策略、数据 Schema 与 Markdown 模板，分别负责收集证据、校验数据和
渲染 Markdown。它们不属于仓库日常命令；正常发布只需调用 Skill。

### 常用命令

| 命令                                                       | 作用                                                                                                                         | 使用                                                                                                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm release:check`                                       | 执行完整发布前检查：安装一致性、测试、lint、构建和发布包内容检查。                                                           | 发布前本地自检：`pnpm release:check`                                                                                                 |
| `pnpm release:pack [target]`                               | 生成本地 tarball，用于检查实际发布包内容。                                                                                   | 全部包：`pnpm release:pack`；单包：`pnpm release:pack vant`                                                                          |
| `pnpm release:publish [channel] [target] [version-action]` | 发布到指定通道。所有通道均支持 `patch`、`minor`、`major` 或 `x.y.z`；`current` 仅限 `latest`。目标可传 `all` 或 `core,vue`。 | 交互选择：`pnpm release:publish`；正式版：`pnpm release:publish latest vue patch`；公开 Beta：`pnpm release:publish beta core 1.0.0` |
| `pnpm release:dry-run <channel> <target> <version-action>` | 计算并展示冻结发布计划，不执行质量检查、版本写入、npm 发布、Git Tag 或 GitHub Release。                                      | `pnpm release:dry-run beta core 1.0.0`                                                                                               |
| `pnpm release:test`                                        | 运行发布脚本自身的测试，不发布、不改版本。                                                                                   | 修改发布脚本后执行：`pnpm release:test`                                                                                              |

### 发布通道

| 类型     | 用途                          |
| -------- | ----------------------------- |
| `latest` | 正式版                        |
| `dev`    | 日常开发测试，不稳定          |
| `alpha`  | 内部预览，API 可能还会变      |
| `beta`   | 外部测试，功能基本完整        |
| `rc`     | release candidate，候选正式版 |
| `next`   | 下一版本预览                  |
