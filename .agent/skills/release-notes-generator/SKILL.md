---
name: release-notes-generator
description: 分析 Git 仓库从当前 HEAD 可达的最近 Tag 到 HEAD 的提交、完整 Diff、公共 API、类型声明、导出、依赖和运行时行为变化，生成并原子覆盖发布范围对应目录的 release-notes.md。在 Monorepo 中输出到目标包根目录；仓库级发布日志输出到主项目根目录。用户要求生成、更新、整理或审查版本发布日志，或需要识别 Features、Fixes、Improvements、Deprecations、Breaking Changes 及迁移说明时使用。
---

# 发布日志生成器

## 适用场景

在 Git 仓库中生成面向使用者的发布日志。默认只分析已提交内容，输出中文 Markdown；保留 API、包名、命令、代码和依赖名称的原文。

## 输入与前置条件

- 以当前工作目录为起点，先定位 Git 根目录；无法定位时终止。
- 在 Monorepo 中先解析目标包：优先使用用户指定的包名或包路径；其次使用当前工作目录所属的包；仅有一个受影响包时可使用该包。多个受影响包且未指定目标包时，先请求用户选择，不得覆盖任一包的日志。
- 使用当前 HEAD 作为目标提交，不纳入未提交或未跟踪内容。
- 检查当前分支、HEAD、工作区状态、Tag 可用性和浅克隆状态。
- 读取根目录 package.json、workspace 配置及各包 package.json（存在时）。
- 仓库级发布日志的输出文件为 Git 根目录 release-notes.md；Monorepo 包级发布日志的输出文件为目标包根目录 release-notes.md。
- 仅在分析完成、内容非空且验证通过后覆盖已解析的输出文件。

## 强制工作流

按以下顺序执行，不得跳过证据收集或验证：

1. 定位仓库根目录并检查状态。
2. 在 Monorepo 中解析目标包及输出路径。
3. 解析基准 Tag 和比较范围。
4. 收集 Commit、文件状态、统计信息和完整 Diff。
5. 识别直接及间接受影响的包和模块。
6. 分析公共 API、类型声明、导出、依赖、配置和运行时行为。
7. 检测 Breaking Changes 和 Deprecations。
8. 过滤噪音，合并同一事项的重复 Commit，并按类别精炼。
9. 为 Breaking Changes 生成可证实的迁移说明。
10. 将每条结论映射回 Commit 或 Diff，完成内容和 Markdown 校验。
11. 生成临时 Markdown，校验通过后原子替换已解析的输出文件。

## Git 范围解析

先执行并记录：

```bash
git rev-parse --show-toplevel
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --is-shallow-repository
git describe --tags --abbrev=0 HEAD
```

- 基准必须是 HEAD 可达的最近 Tag，不得使用全仓库创建时间最新的 Tag。
- 默认范围为 <tag>..HEAD，并记录基准版本、基准 Commit、目标 Commit、分支和生成日期。
- HEAD 本身带 Tag 时，使用前一个可达 Tag 到当前 Tag 的范围；若没有变更，明确输出“没有可发布变更”。
- 无 Tag 时从首个 Commit 分析，并标明仓库暂无 Tag；首个 Commit 需按实际范围补入。
- 对 alpha、beta、rc 等预发布 Tag 保留其语义，不得静默跳过。
- 浅克隆缺少历史或 Tag 时，明确说明结果可能不完整；不得声称完成完整分析。

收集至少以下信息：

```bash
git log <range> --format=fuller
git diff --stat <range>
git diff --name-status <range>
git diff <range>
```

Commit Message 只用于理解意图、初步分类和关联事项；最终结论必须以实际 Diff、类型、导出和配置为依据。

## Monorepo 规则

- 从 workspace 配置和各 package.json 建立目录到包名的映射，不凭目录名臆测。
- 包级模式必须将目标包的 package.json 所在目录作为包根目录，并将输出路径固定为 <package-root>/release-notes.md。
- 仓库级模式仅在用户明确要求仓库整体日志时使用，输出路径为 <repository-root>/release-notes.md。
- 不得因主项目根目录存在 release-notes.md 而将包级日志写入主项目根目录。
- 区分直接修改、直接依赖影响、间接依赖影响和仅内部影响。
- 基础包的公共 API 变化可能传播到依赖包，但只有确认影响用户时才标记依赖包受影响。
- 识别独立包 Tag；支持仓库级汇总和包级范围，不能混用 Tag 规则。
- 将每条日志归属到具体包或模块；无法归属时使用仓库级分类。

## API 变化检测

以源代码、构建产物或 .d.ts（可用时）交叉检查，不只搜索 export。

### 公共表面

检查命名/默认/重新导出、子路径、package.json#exports、类型与样式入口，以及函数、Hook、组件、配置、事件、Slots、Expose API。

### TypeScript 类型

检查 interface、type、enum、class、方法和构造函数的新增、删除、重命名、参数/返回类型、泛型参数与约束、联合成员、枚举值、可选性、readonly、可空性和索引签名。

- 新增可选属性或兼容重载通常不破坏兼容性。
- 删除属性、可选改必填、类型或泛型约束收紧、返回结构不兼容通常是 Breaking Change。

### 运行时与 UI

检查默认值、生命周期顺序、事件名称/参数、异步性、错误类型或时机、缓存和副作用；组件还检查 Props、CSS 类名/变量、DOM 结构、主题和样式导入路径。

### 依赖与兼容性

检查 peerDependencies、engines、最低框架/TypeScript 版本、构建目标、ESM/CommonJS、浏览器范围、发布文件列表、关键依赖和安全更新。

## Breaking Change 判定

将以下内容作为明确或潜在 Breaking Change：

- Commit 中出现 BREAKING CHANGE: 或 feat!、fix!、refactor!；但仍须核对 Diff。
- 删除/重命名公共 API、子路径或导出；参数收紧、返回结构变化、同步/异步变化。
- 删除类型成员、可选改必填、泛型约束收紧、枚举值/错误结构变化。
- 默认行为、事件、生命周期、配置、序列化/持久化格式变化。
- 提升最低运行时或框架版本、收紧 Peer Dependency、改变 CSS/DOM 公共约定。
- 删除已废弃 API。

证据不足时标记“潜在 Breaking Change，需要人工确认”，写明受影响 API 和依据；不得把推测写成事实，也不得编造迁移方案。

## 分类与内容精炼

按以下优先级归类，单条变更只保留一个主要归属：

- Breaking Changes：不兼容变化及迁移说明。
- Features：新增用户能力、公共 API、组件、配置、适配器或平台支持。
- Fixes：修复错误、解析/构建、兼容性、状态、边界、内存或样式问题。
- Improvements：性能、类型推导、稳定性、开发体验、构建或包体积优化。
- Deprecations：仍可用但已废弃的 API，注明替代方案和计划移除信息。
- Dependencies and Compatibility：仅记录影响安装、构建、运行或升级的依赖和环境变化。
- Documentation：仅记录迁移指南、关键示例或有明显使用价值的文档变化。

通常过滤格式化、普通注释/拼写、纯测试快照、内部变量改名、无行为变化重构、构建缓存和无用户影响的锁文件/CI 变化；若影响安装、构建、类型检查、运行或升级，则重新纳入。

合并同一功能、问题或 PR 的多个 Commit，描述用户获得的结果，不逐条翻译 Commit，不夸大影响，不暴露无意义实现细节。去重概览与分类条目，空分类不输出。

## 迁移说明

每个 Breaking Change 尽量包含：变化内容、受影响范围、迁移前后写法、替代 API、兼容方案和移除时间。只能使用 Diff 或仓库现有文档可证实的信息；无法推导时写“迁移方式需要维护者补充”。

## 验证规则

逐条确认：

- 能关联至少一个 Commit、Diff、类型/导出、配置、测试或 PR/Issue 证据。
- 没有遗漏公共 API 删除、行为变化、依赖约束或受影响包。
- 没有把内部重构当作功能，也没有重复或矛盾描述。
- Breaking Change 有迁移说明或人工确认标记。
- 未提交内容未被纳入，所有结论均来自解析范围。
- Markdown 标题层级、列表、链接和代码围栏正确，文件非空且无错误提示。

## 输出模板

```markdown
# Release Notes

## 版本信息

- 基准版本：<tag 或“无 Tag”>
- 比较范围：<range>
- 目标提交：<short sha>
- 当前分支：<branch 或 detached HEAD>
- 生成日期：<YYYY-MM-DD>

## 概览

<面向用户的 1—3 句总结>

## Breaking Changes

### <package>

- <变化、影响和证据导出的结论>

#### 迁移说明

<迁移步骤，或“迁移方式需要维护者补充。”>

## Deprecations

- <API> 已废弃，请使用 <替代方案>。

## Features

### <package>

- <新增能力>

## Fixes

- <修复内容>

## Improvements

- <优化或调整>

## Dependencies and Compatibility

- <依赖或环境变化>

## Documentation

- <有用户价值的文档变化>

## Affected Packages

- <package>
```

仅输出有内容的分类；不得为了填充模板而生成条目。包级日志仅列出目标包及其可证实的依赖影响；正式日志默认不包含完整 Commit 列表，除非用户或仓库惯例要求。

## 文件写入与异常处理

- 先确定输出范围和输出路径：仓库级为 <repository-root>/release-notes.md；包级为 <package-root>/release-notes.md。
- 将完整结果先写入临时文件或内存；确认非空、无错误且校验通过后，再以同一文件系统内的原子替换覆盖已解析的输出文件。
- 分析失败时保留原文件，不得清空或写入半成品；说明失败原因和已知不完整范围。
- 不在 Git 仓库中时终止；无 Tag、浅克隆、超大 Diff、无新变更、无法判定兼容性，或 Monorepo 中存在多个候选目标包时按本 Skill 的规则明确标记。

## 禁止事项

- 不得只依据 Commit Message，不得逐 Commit 直译。
- 不得纳入未提交内容，不得使用不可达 Tag。
- 不得在 Monorepo 中未解析目标包时写入主项目根目录，也不得同时覆盖多个包的 release-notes.md。
- 不得忽略公共类型、导出、exports、Peer Dependency、运行时或 UI 公共约定。
- 不得在证据不足时断言 Breaking Change，不得编造 API、影响范围或迁移方案。
- 不得在失败时覆盖原文件，不得自动修改版本号、创建 Tag、发布或提交变更。

## 完成标准

仅当已确定正确范围和输出路径、读取 Commit 与完整 Diff、完成包和 API 分析、识别并分类变更、合并重复事项、验证证据和 Markdown，并成功原子覆盖目标范围对应的 release-notes.md 时，才报告任务完成。
