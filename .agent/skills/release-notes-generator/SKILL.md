---
name: release-notes-generator
description: 分析 Git 仓库指定发布范围内的提交、完整 Diff、公共 API、类型声明、导出、依赖和运行时行为，生成可审计的 Release Data，并按仓库配置渲染中文发布说明、版本归档或 GitHub Release 正文。适用于生成、更新、整理或审查 Release Note，识别 Features、Fixes、Improvements、Deprecations、Security、Breaking Changes、TypeScript 变化和迁移说明；支持 Monorepo 的仓库级与包级发布范围。
---

# 发布日志生成器

将 Git 证据转化为面向使用者的发布说明。始终先构造结构化 Release Data，再渲染 Markdown 或其他目标；不得从 Commit Message 直接拼接最终文案。

## 工作模式与输入

先识别用户的工作模式：

- `preview`：自动收集证据、分析并展示 Release Data 与 Markdown 预览；不得写正式发布文件。用户只说“分析”“生成”“预览”但未明确写入时，使用此模式。
- `write`：自动收集证据、分析、校验并写入已解析的 JSON 与 Markdown。仅当用户明确要求创建、更新、保存或覆盖文件时使用。
- `render`：读取用户提供或仓库中已审核的 Release Data，自动校验和渲染，不重新推断变更。
- `review`：审查现有 Release Data 或 Release Note 的证据、完整性、分类、迁移信息和格式；不得改写文件，除非用户同时要求修复。

解析下列输入，优先级为：用户本次明确指定 > 当前 Skill 的仓库发布配置 > 本 Skill 默认值。

- 发布范围：`from`、`to`、`version`，或可推导的 Tag 范围。
- 范围模式：`repository`、`package` 或 `packages`；`package` 需要目标包名或路径，`packages` 表示批量处理所有受影响包。
- 输出目标：`data`、`markdown`、`github`、`website`。
- 输出语言、模板、章节顺序、是否显示验证信息与完整变更。
- 写入策略：预览、版本归档、最新版本镜像或用户指定路径。

用户未指定 `from` 和 `to` 时，使用“当前 HEAD 可达的最近 Tag 到 HEAD”。若 HEAD 本身带 Tag，使用前一个可达 Tag 到该 Tag。用户提供明确范围时，以其范围为准并记录原因。

在 Monorepo 中，按以下优先级解析范围：用户明确指定仓库级汇总时使用 `repository`；用户指定单个包时使用 `package`；用户指定多个包或未指定范围时，使用 `packages`，为每个受影响包独立生成发布说明。不得因多个包受影响而要求用户逐个选择。

## 仓库配置约定

读取当前 Skill `references/` 中与目标仓库匹配的发布配置。配置不存在时仍可运行，不得要求用户在仓库中建立配置文件。

处理 `SchemaForm` 仓库时，先读取 [references/schemaform-release-config.json](references/schemaform-release-config.json)。该配置是此 Skill 的组成部分，不在目标仓库中创建副本。

支持以下概念，不要要求固定字段名或实现方式：

```yaml
tag:
  prefix: v
  baseline: reachable-previous-tag

scope:
  mode: package-or-repository
  packageLayout: grouped

output:
  language: zh-CN
  data: .release/releases/{version}.json
  archive: docs/releases/{version}.md
  latest: "{packageRoot}/release-notes.md"
  repositoryLatest: release-notes.md
  repositoryArchive: docs/releases/{version}.md

monorepo:
  packageReleaseMode: changed-packages
  packageTagPattern: "{packageName}@{version}"

render:
  omitEmptySections: true
  includeValidation: true
  includeFullChangelog: true
  includeInternalChanges: false

rules:
  requireEvidence: true
  requireMigrationForBreaking: true
  publicDependencyChangesOnly: true
```

将配置视为仓库策略，而非 Git 证据。配置缺失、字段未知或与用户本次明确要求冲突时，说明采用的回退策略。

## 仓库自动化适配

发布配置提供 `automation` 时，将其中的命令数组视为本 Skill 的确定性执行工具。数组的第一个元素是可执行程序，其余元素是固定参数；将 `{skillRoot}` 替换为当前 Skill 目录，并以目标仓库作为工作目录执行。只可追加本 Skill 已解析的参数，不得通过 Shell 拼接或执行未配置命令。

```yaml
automation:
  collectContext: ["node", "{skillRoot}/scripts/collect-context.mjs"]
  validateData: ["node", "{skillRoot}/scripts/validate-release-data.mjs"]
  renderNotes: ["node", "{skillRoot}/scripts/render-release-notes.mjs"]
```

在支持该适配的仓库中，执行以下规则：

- `preview`：调用 `collectContext` 并捕获标准输出；不得要求用户运行命令、创建临时文件或手动传递上下文。
- `write`：调用 `collectContext`，为每个候选包完成语义分析，在临时路径写入 Release Data，调用一次 `validateData` 校验全部候选数据，再原子移动至配置的正式 JSON 路径，最后调用 `renderNotes` 生成每包 Markdown。
- `render`：调用 `validateData` 后调用 `renderNotes`；默认使用配置的包级输出路径。用户明确要求归档时才追加 `--archive`。
- `review`：可以调用 `collectContext` 对照现有数据，但不得调用会写入文件的渲染命令。
- 缺少 `automation` 配置时，保留本 Skill 的通用 Git 分析流程；不得要求用户补充脚本。

将脚本视为 Skill 的内部实现，不要在面向维护者的日常说明中要求逐步运行它们。脚本仍可作为 CI、故障排查和无 Agent 环境下的高级入口。

## 强制工作流

按顺序执行，不得跳过证据收集、结构化分类或验证：

1. 定位 Git 根目录，检查工作区、分支、HEAD、Tag 可用性和浅克隆状态。
2. 解析仓库配置、发布范围、范围模式、受影响包、版本号和输出目标。
3. 存在 `automation.collectContext` 时先调用它收集包级事实；再收集完整 Commit、文件状态、统计信息和 Diff。不得纳入未提交或未跟踪内容。
4. 建立工作区目录到包名的映射，识别直接修改、依赖传播、间接影响和纯内部影响。
5. 分析公共 API、类型、导出、依赖、配置、运行时与 UI 公共约定。
6. 构造 Release Data；每一项都附带可复核的证据。
7. 检测 Breaking Change、Deprecation 与 Security；为可证实的不兼容变更生成迁移说明。
8. 合并同一事项的重复 Commit，过滤无用户影响噪音，并完成分类与文案精炼。
9. 在 `packages` 模式中，为每个包独立构造、校验和渲染 Release Data，不得将所有包合并为单个 `release-notes.md`。
10. 存在 `automation.validateData` 时调用它校验所有候选 Release Data；同时校验证据、迁移信息和渲染结果。
11. 在 `preview` 或 `review` 模式展示结果；在 `write` 或 `render` 模式中，仅在校验通过后调用 `automation.renderNotes` 或写入已解析路径。

## Monorepo 包级批量生成

先从 workspace 配置、根目录 `package.json` 和每个包的 `package.json` 建立“包名 → 包根目录 → 内部依赖”的映射；不得仅凭目录名推断包名。

在 `packages` 模式中执行：

1. 找出比较范围内直接修改的发布包。
2. 分析内部依赖图；仅在基础包的公开 API、类型、运行时或兼容性变化可证实影响下游使用者时，将依赖包纳入“间接影响包”。
3. 为每个候选包单独解析基准 Tag、目标版本、相关 Diff 和 Release Data。不得将某一包的版本、基准 Tag 或文案套用到其他包。
4. 对每个有可发布用户变更的包渲染独立的 `release-notes.md`；默认路径是 `<package-root>/release-notes.md`。
5. 在预览中输出包级结果清单：包名、直接或间接影响、比较范围、版本、将写入的路径和跳过原因。

直接修改包只有内部重构、格式化、测试快照或无用户影响变更时，默认跳过该包的正式 Release Note，并在结果清单说明原因。配置启用 `includeInternalChanges` 或用户明确要求时，才纳入内部变更。

优先使用仓库配置中的包 Tag 模式为每个包解析可达基准 Tag，例如 `{packageName}@{version}`。不存在包独立 Tag 时，回退到仓库级可达基准 Tag，并在每个包的元数据中标记该回退。用户明确指定范围时，对所有包使用该范围，但仍按包过滤和归类变更。

仓库级 `repository` 模式只在用户明确要求整体发布说明时使用，输出一份汇总说明。单包 `package` 模式只生成目标包的内容。三种模式不得混用输出文件。

## Git 范围与证据收集

执行并记录：

```bash
git rev-parse --show-toplevel
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --is-shallow-repository
git describe --tags --abbrev=0 HEAD
git log <range> --format=fuller
git diff --stat <range>
git diff --name-status <range>
git diff <range>
```

- 基准 Tag 必须是目标提交可达的最近 Tag，不得按创建时间挑选全仓库最新 Tag。
- 在 `packages` 模式中，先按每个包的 Tag 模式解析该包可达的最近 Tag；只有缺少包独立 Tag 时才回退到仓库级 Tag。
- 无 Tag 时从首个 Commit 分析，并在元数据中标记“无 Tag”。
- 保留 alpha、beta、rc 等预发布版本语义。
- 浅克隆缺少历史或 Tag 时，标记结果可能不完整；不得声称完成完整分析。
- Commit Message 只能辅助理解意图、分类和关联事项；结论必须由 Diff、类型、导出、配置、测试或可访问的 PR/Issue 证据支持。

## API、类型与兼容性分析

交叉检查源代码、构建产物与 `.d.ts`（可用时），而非只搜索 `export`。检查：

- 命名、默认与重新导出；子路径、`package.json#exports`、类型与样式入口。
- 函数、Hook、组件、配置、事件、Slots、Expose API。
- interface、type、enum、class、方法、构造函数、泛型、联合成员、可选性、readonly、可空性和索引签名。
- 默认值、生命周期顺序、事件名称/参数、异步性、错误类型或时机、缓存与副作用。
- 组件 Props、CSS 类名/变量、DOM 结构、主题和样式导入路径。
- `peerDependencies`、`engines`、框架/TypeScript 最低版本、构建目标、模块格式、浏览器范围、发布文件和关键依赖。

将删除或重命名公共 API/导出、参数收紧、返回结构变化、同步异步切换、可选改必填、泛型约束收紧、默认行为变化、运行时/框架最低版本提升、Peer Dependency 收紧和公共 CSS/DOM 约定变化视为明确或潜在的 Breaking Change。出现 `BREAKING CHANGE:`、`feat!`、`fix!` 或 `refactor!` 时仍须核对 Diff。

证据不足时标记“潜在不兼容变更，需要人工确认”，写明依据；不得将推测写成事实，也不得编造迁移方案。

## Release Data

先读取 [references/release-data-model.md](references/release-data-model.md)，再在内存中构造 Release Data。Release Data 是唯一的事实来源；字段可按仓库 Schema 序列化为 JSON，Markdown 标题不得成为唯一的数据结构。

每项变更必须有主分类、用户视角摘要和证据。使用 Facet 标记 API、TypeScript、兼容性等交叉影响；渲染时不得重复完整描述。

`evidence` 是内部审计数据：只写入 Release Data，不得把 Commit SHA、文件路径或 `（证据：…）` 拼进任何将被渲染的文案字段。对外仅可使用已验证、适合公开的 `references` 链接；校验器会拒绝内嵌“证据：”的 Release Data。

## 迁移、安全与验证

每个明确 Breaking Change 尽量包含：变化、受影响范围、迁移前后写法、替代 API、兼容方案和移除时间。只能使用可证实的信息；无法推导时写“迁移方式需要维护者补充”。

Security 不得混入普通 Fix。仅在有证据时标为安全修复；避免公开尚未披露漏洞的可利用细节。

验证结果仅记录实际执行或用户提供的结果，例如 typecheck、test、build 与运行环境；不得臆测“通过”。若面向外部使用者价值不高，可由配置隐藏该章节。

## 渲染规则

先读取 [references/writing-rules.md](references/writing-rules.md)。该文件定义分类语义、章节文案、去重、迁移说明和安全信息的写作边界。

按以下顺序渲染，并省略空章节：

```text
Release Notes、版本信息与概览
Important Notices
Breaking Changes
Security
Deprecations / Features / Fixes / Improvements / Documentation（按包分组）
TypeScript Changes
Dependencies and Compatibility
Validation
Known Issues
Full Changelog
Affected Packages
```

- 版本标题、摘要与版本元数据默认存在；其余章节按数据动态输出。
- 单包与批量包级模式只列对应包及可证实的依赖影响；仓库级模式按包分组，无法归属的变更使用仓库级分类。
- 将迁移说明直接放在对应的 Breaking Change 后；只有多个变更需要组合操作时，才生成全局“升级指南”。
- API 与 TypeScript 章节使用 `facets` 形成简短索引；不得复制 Breaking Change 的完整描述。
- Patch Release 以简短修复说明为主；Minor Release 通常包含新增、优化、修复和 API 变化；Major Release 将不兼容变更和迁移信息置于新增功能之前。
- 叙述性文字输出简体中文；固定章节名使用英文，不添加 Emoji。保留包名、API、命令、代码、依赖名称和版本号原文。

没有仓库模板时，使用以下默认骨架：

```markdown
---
version: <version>
date: <YYYY-MM-DD>
previous: <tag 或 commit>
packages: [<package>]
---

# Release Notes

## 版本信息

- 基准版本：<tag 或“无 Tag”>
- 比较范围：<range>
- 目标提交：<short sha>
- 当前分支：<branch 或 detached HEAD>
- 生成日期：<YYYY-MM-DD>

## 概览

<1—3 句用户视角摘要>

## Important Notices
## Breaking Changes
## Security
## Deprecations
## Features
### <package>
## Fixes
## Improvements
## Documentation
## TypeScript Changes
## Dependencies and Compatibility
## Validation
## Known Issues
## Full Changelog
## Affected Packages
```

## 写入与失败处理

- 在 `preview` 和 `review` 模式中，不得写入或覆盖文件。
- 在 `write` 模式中，先验证内存中的 Release Data 和渲染结果，再通过同一文件系统内的临时文件原子替换目标文件。
- 仓库配置存在时，优先写入版本化 JSON 和 Markdown 归档；仅在配置启用或用户明确要求时更新 `release-notes.md` 最新镜像。仓库级模式使用 `output.repositoryLatest` 与 `output.repositoryArchive`；包级模式使用 `output.latest` 与 `output.archive`。
- 在 `packages` 模式中，为所有通过验证的包分别写入 `<package-root>/release-notes.md`，或配置的 `output.latest` 路径；不得写入仓库根目录的单一说明替代包级输出。
- 在批量写入前先完成所有候选包的数据与渲染校验；任一需要写入的包校验失败时，默认不写入任何包的正式 Release Note，并报告失败包与原因。
- 未配置版本化路径但用户明确要求更新 `release-notes.md` 时，兼容旧行为：仓库级写入 Git 根目录，单包或批量包级写入对应包根目录。
- 分析失败、范围不完整、数据为空或校验失败时，保留原文件，不得写入半成品。
- 不得自动修改版本号、创建 Tag、发布包、创建 GitHub Release、提交变更或创建 CI 工作流。

## 完成标准

仅当已解析正确的范围和作用域、读取完整 Git 证据、完成包与 API 分析、构造并验证 Release Data、生成无空章节且无矛盾的目标内容，并在需要写入时成功原子写入已解析路径，才报告完成。对于 `preview` 或 `review`，完成标准止于展示经验证的结果与明确的不确定项。
