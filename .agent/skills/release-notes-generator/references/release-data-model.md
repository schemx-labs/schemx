# Release Data 模型

将每次发布的事实、归类和证据表示为一个 `ReleaseData` 对象。它是 Markdown、GitHub Release 正文和官网版本记录的唯一来源；不得只在渲染后的文案中保留关键事实。

## 顶层字段

```ts
type ReleaseData = {
  version: string
  date: string
  from: ReleasePoint
  to: ReleasePoint
  range: string
  branch?: string
  scope: "repository" | "package"
  packages: string[]
  summary: string
  notices?: ReleaseNotice[]
  changes: ReleaseChange[]
  validation?: ValidationResult[]
  knownIssues?: KnownIssue[]
  fullChangelog?: string
}

type ReleasePoint = {
  tag?: string
  commit: string
}
```

- `version`：目标发布版本。优先使用用户指定值；否则从目标 Tag 或目标包版本推断，并明确标记推断来源。
- `date`：生成或发布日期，采用 `YYYY-MM-DD`。
- `from`、`to`、`range`：可复核的 Git 比较范围。保留 Commit，即使 Tag 不存在。
- `branch`：可选的收集时当前分支；HEAD 游离时使用 `detached HEAD`。旧 Release Data 缺少该字段时，渲染为 `unknown`。
- `scope`：`repository` 表示仓库汇总发布；`package` 表示单个包发布。
- `packages`：受影响且对用户可见的包。不要把仅测试或内部工具包列入。
- `summary`：一至三句面向使用者的版本摘要，不重复章节条目。

## Monorepo 批次

在 Monorepo 的 `packages` 模式中，为每个包建立独立的 `ReleaseData`，不要以单一数据对象承载所有包的正式发布说明。可选地使用批次对象保存本次运行的索引：

```ts
type ReleaseBatch = {
  scope: "packages"
  sourceRange: string
  releases: PackageRelease[]
}

type PackageRelease = {
  package: {
    name: string
    root: string
    impact: "direct" | "indirect"
  }
  data: ReleaseData
  output: {
    markdown: string
    data?: string
  }
  skipped?: { reason: string }
}
```

- 直接修改包使用 `impact: "direct"`。
- 只有公共 API、类型、运行时、依赖或兼容性变化能证实会影响下游使用者时，才将内部依赖包标为 `impact: "indirect"`。
- 每个 `PackageRelease.data` 必须使用该包自己的版本、基准 Tag 和过滤后的变更；不要共享其他包的 Release Data。
- 只因内部噪音发生修改且没有可发布变更的包，使用 `skipped.reason` 记录，不生成正式 `release-notes.md`。

## 变更字段

```ts
type ReleaseChange = {
  id: string
  package?: string
  title: string
  summary: string
  primaryCategory: PrimaryCategory
  facets?: Facet[]
  userImpact?: string
  migration?: Migration
  references?: ChangeReference[]
  evidence: Evidence
}

type PrimaryCategory =
  | "breaking"
  | "security"
  | "feature"
  | "improvement"
  | "fix"
  | "deprecation"
  | "dependency"
  | "documentation"

type Facet = "api" | "typescript" | "runtime" | "ui" | "compatibility"

type Evidence = {
  commits: string[]
  files?: string[]
  publicSymbols?: string[]
  notes?: string[]
}
```

- `id`：本次 Release 内稳定且唯一的标识；推荐使用包名、主分类和简短语义组合，不要使用随机值。
- `package`：变更所属的发布包。无法归属时省略，并按仓库级分类渲染。
- `title`：短标题，说明用户可识别的变化；不得是 Commit Message 的直译。
- `summary`：说明变化、适用场景或结果。普通条目通常一至两句。
- `primaryCategory`：决定正文唯一的主位置。每条变更必须且只能有一个。
- `facets`：记录交叉属性，不创建第二份长文。例如删除公开函数应为 `primaryCategory: "breaking"` 与 `facets: ["api", "typescript"]`。
- `userImpact`：说明受影响的用户、包、运行环境或升级场景。只在重要、潜在不兼容或安全相关变化中要求。
- `migration`：仅用于 Breaking Change 或 Deprecation；参见下方迁移模型。
- `references`：可选 PR、Issue、文档链接。只有链接真实可访问且适合对外展示时才渲染。
- `evidence`：仅供审核和追溯。至少有一个 Commit；如涉及公共 API，尽量保留符号和文件证据。不得将 `evidence.commits` 拼接到 `title`、`summary`、迁移说明、提示或已知问题中；默认 Markdown 不展示 SHA。

## 分类语义

| 分类 | 使用条件 | 不应包含 |
|---|---|---|
| `breaking` | 已确认或需人工确认的不兼容变化 | 单纯新增功能或内部重构 |
| `security` | 有证据的安全修复或安全兼容性调整 | 未公开漏洞的可利用细节 |
| `feature` | 新增用户可用能力、公共 API、组件、配置或平台支持 | 仅内部工具或测试能力 |
| `improvement` | 用户可感知的性能、稳定性、类型推导、构建体积或开发体验改进 | 无行为变化的代码整理 |
| `fix` | 修复可复现的错误、兼容性或边界行为 | 不确定的猜测性修复 |
| `deprecation` | 功能仍可用但已建议迁移 | 已直接删除的 API |
| `dependency` | 安装、运行、构建、安全或兼容性受影响的依赖/环境变化 | 无用户影响的开发依赖或锁文件更新 |
| `documentation` | 迁移指南、关键示例或显著改善使用方式的文档 | 拼写、格式或内部文档更新 |

## 迁移、验证与已知问题

```ts
type Migration = {
  affected?: string
  before?: string
  after?: string
  steps?: string[]
  replacement?: string
  status: "verified" | "needs-maintainer-input"
}

type ValidationResult = {
  name: string
  status: "passed" | "failed" | "skipped"
  environment?: string
  notes?: string
}

type KnownIssue = {
  summary: string
  affected?: string
  workaround?: string
  references?: ChangeReference[]
}
```

- 对明确 Breaking Change，`migration.status` 必须为 `verified`，或明确为 `needs-maintainer-input`。
- `before`、`after` 只在代码对比能减少升级歧义时填写；不得编造示例。
- 只有实际执行过或用户提供的验证结果才能写入 `validation`。
- 已知问题必须是已确认、尚未解决且对使用者有价值的问题；不得记录猜测。

## 数据完整性规则

- 任何面向用户的结论都必须可回溯到 `evidence`。
- 合并同一事项的多个 Commit，避免一个事项产生多条内容相同的变更。
- 若证据不足以确认不兼容性，保留为 `breaking` 并在摘要中写“需要人工确认”，或不进入正式发布说明，取决于仓库策略。
- Release Data 可以保留内部 SHA 和文件路径；默认 Markdown 不展示这些字段。
