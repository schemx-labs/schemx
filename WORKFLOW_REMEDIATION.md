# Workflow 整改记录

## 第一部分：TypeScript 重构（2026-09-30）

`scripts/workflow/` 已从 53 个 Shell 文件（5275 行）整体重写为 26 个 TypeScript 模块
（约 3200 行实现 + 约 2400 行测试），由 `scripts/workflow.ts` 单一入口分派。冻结计划的磁盘
格式保持不变，历史计划文件继续可用。

### 重写期间发现并修复的缺陷

| 编号 | 位置 | 问题与影响 | 处理 |
| --- | --- | --- | --- |
| B1 | `commands/release/execute.sh:110,119` + `domains/release/state.sh:115` | 状态文件损坏时 `exit(2)` 被两个调用点吞掉，`published_packages` 退化为空串，执行器据此回滚**全部**已发布包的 `package.json` 并删除备份，而对应版本已存在于 npm 上。 | 已修复。状态读取失败一律抛出错误；`finalizeVersions` 在状态不可信时保留备份、报错中止，不做任何回滚。`state.test.ts` 有专门回归用例。 |
| B2 | `commands/release/planning.sh:90` | `target=all` 且无可发布包时，空数组 `"${records[@]}"` 在 bash 3.2 + `set -u` 下致命退出。 | 已消除。目标解析返回数组，空结果显式报错。 |
| B3 | `commands/release/notes.sh:105,111` | 摘要实际按 `a..b` 计算，展示文案却写成 `a...b`，用户审计的区间从未被使用过。 | 已修复。展示的对比范围与实际使用的 `commitRange` 同源。 |
| B4 | `commands/fix.sh:64-65` + `scripts/workflow.sh:29` | 入口把 130 映射为 0，一次 Ctrl+C 之后 `format` 仍会继续执行。 | 已修复。两步之间检查取消码。 |
| B5 | `commands/release/test.sh:12` | 硬编码 6 个 `SCHEMX_UI_*` 环境变量名用于隔离子测试，新增一个布局状态变量就会静默污染子测试。 | 已消除。子 shell 状态传递整体不再存在。 |
| B6 | `domains/packages/local-pack.sh:74-98` | 依赖图硬编码成三条 `if`（vue/vant/element-plus 依赖 core 等），新增内部依赖必须改代码。 | 已修复。依赖闭包从各包 `workspace:` 声明推导。 |
| B7 | `domains/packages/pack-vite-plugin.sh` | 4 处手动恢复版本且没有 trap，中断会把插件版本留在工作区；`find` 匹配含秒级时间戳的历史 tarball。 | 已修复。`try/finally` 保证恢复，产物按版本精确定位。 |
| B8 | `domains/packages/check-bundle-boundaries.sh:61,96,136` | `"${arr[@]:-}"` 在空数组上展开成一个空串，导致每条规则多一次无意义的 `rg` 调用。 | 已消除。正则与空数组在 TypeScript 侧处理。 |
| B9 | `ui/internal/*`（11 个文件） | JSONL 事件流（`ui__event`）在全仓库没有任何外部消费者，只有自己的测试在读，每次事件还要 fork 两次 `jq`。 | 已删除。 |
| B10 | `ui/internal/terminal/output.sh`、`ui/internal/terminal/theme.ts` | 终端颜色与符号依赖外部 `gum` 二进制，但它既不在 `package.json` 中声明也不在 CI 安装，缺失时静默降级成无样式输出。 | 已消除。改用 Node 内置 `util.styleText`。 |
| B11 | `ui/internal/terminal/output.sh:145-214` + `domains/packages/local-pack.sh:148` | UI 层保存/恢复 trap，与 domain 层的 trap 互相覆盖：Ctrl+C 期间不再产生 cancelled 事件，正常路径结束时 domain 的恢复 trap 被 UI 层销毁。 | 已消除。改用 `process.on` 与 `try/finally`。 |
| B12 | `commands/build.sh` vs `commands/workspace.sh` | 两份逐字相同的执行规则，只差 usage 文案。 | 已合并。`build` 走统一 workspace 任务入口。 |
| B13 | macOS 系统 bash 3.2 | `set -e` 对 `[[ ]]` 与 `(( ))` 不生效，测试套件里 62 处裸 `[[ ]]` 断言在 macOS 上是空断言。 | 已消除。测试改用 vitest，跨平台行为一致。 |

### 结构上被删除的机制

| 原机制 | 规模 | 删除原因 |
| --- | --- | --- |
| bash → node 的 Clack 桥接 | 294 行（参数解析 + jq 拼 JSON + 临时文件 + 子进程 + 结果回读） | Clack 可直接调用；`clack.mjs` 中用 Proxy 劫持 stdout 改写 ANSI 颜色的 33 行 hack 随之消失。 |
| `domains/release/runner.sh` | 115 行 25 分支 case | 存在的唯一价值是让 Shell 获得独立的 `set -euo pipefail`；单进程内直接调用函数即等价。 |
| UI 布局状态文件 | 30 行 + 6 个导出环境变量 | 用于跨子 shell 传递层级；不再有子 shell。 |
| 子 shell 状态回写 | 散落各处 | 层级改用真实数组栈。 |
| `:::` 字符串协议 | 两处重复实现 | 分组选项改用结构化对象。 |
| 全局出参 | `workflow_root`、`BATCH_CURRENT_TARGET`、`WORKSPACE_BATCH_*`、`_RELEASE_EXECUTE_*` | 改为显式 `Context` 参数。 |
| `local-pack` 双执行形态 | orchestrate + leaf + TSV 结果文件 + stdout 哨兵行 | 统一为一条路径，依赖闭包自动展开。 |
| `jq` 逐字段读取 | 拓扑排序中每个包每次都重扫目录 | `Catalog` 按 scope 缓存扫描结果。 |

### 终端反馈样式（同一批次内完成）

| 编号 | 位置 | 问题与影响 | 处理 |
| --- | --- | --- | --- |
| U1 | `ui.ts` + `exec.ts` | Clack spinner 靠擦除当前行重绘，假设自己是该终端的唯一写入者；而 22 处任务用 `stdio: inherit` 让子进程直接写终端。两者物理互斥，混用后退化为逐字符刷屏（复现时任务标题逐字符竖排）。 | 移除转圈动画。终端输出只剩「追加流」一种控制方式，不再有互相破坏的假设。 |
| U2 | `ui.ts` | 每个任务输出三行——开始行、spinner 自绘的行、完成行；且开始行与完成行缩进不同，视觉上像两个任务。 | 任务只在结束时输出一行。 |
| U3 | `ui.ts` + `exec.ts` | 渲染层按 `WORKFLOW_LOG` 决定是否捕获，执行层却仍按各自的 `capture` 传参，两层不一致——「以为在捕获、实际在透传」，失败输出绕过 UI 结构直接写进终端。 | `Ui.exec` 成为子进程执行的唯一入口，日志模式在此统一翻译成 `capture`；`run()` 的 `capture` 默认改为 `true`，漏传时静默吞输出是安全的一侧。 |
| U4 | `theme.ts` | 颜色同时编码「位置」与「结果」：蓝色既表示分组也表示说明，绿色既表示进行中也表示成功，而蓝绿两色在深色终端上明度接近、几乎无法分辨。 | 颜色只编码结果（绿/红/黄/弱化灰四色），层级完全交给缩进；标题分三级明暗。 |
| U5 | `batch.ts` | 首错停止时只用一句「未执行：N 个目标」概括，看不出具体是哪些。 | 逐行把未执行目标标为 `○ … 未执行`。 |
| U6 | `ui.ts` | 硬编码 `width: 72`，且 Clack 的 `box` 读取的是 stdout 列数。当输出流为 stderr 而 stdout 未连接终端时，该值可能为 0 或 1，`box` 会以负数调用 `String.repeat` 并抛错，使整个命令失败。 | 宽度按实际终端列数收敛并设下限；`box` 输出先落到内存再逐行加层级前缀，卡片边框与 group 导轨衔接；渲染失败降级为标题加正文。 |
| U7 | `workspace.ts` + `release.ts` | 「flowBegin → note → groupBegin → batch → flowEndFromExitCode」骨架与三条结束文案在两个调用点重复。 | 收敛为 `runBatchFlow`，命令侧只剩「挑选目标」。 |
| U8 | `batch.ts` | 首次实现时未执行列表从失败项本身开始，把失败项也算作「未执行」。 | 由 `batch.test.ts` 的用例发现并修正为从下一项开始。 |

### 第二轮：反馈样式的第二轮修正

| 编号 | 位置 | 问题与影响 | 处理 |
| --- | --- | --- | --- |
| U9 | `ui.ts` | 第一版把转圈动画连同捕获模式一起禁用了。结论过度收紧：捕获模式下子进程走管道、不写终端，动画本就是安全的；代价是长任务期间完全没有进行中反馈。 | 恢复动画，并把启用条件收敛为「捕获模式 **且** TTY」，透传模式下仍禁用。 |
| U10 | `ui.ts` | 动画帧写入后缺换行符。写入后光标停在本行行尾，下一帧的 `cursorUp(1)` 便再多退一行，逐帧累积后在终端里铺成一条斜线而不是原地转动。 | 帧尾补换行，光标稳定停在下一行行首。断言落在字节层，逐帧校验 `cursorUp + eraseLine + 行尾换行`。 |
| U11 | `exec.ts` + `ui.ts` | 失败详情取 `stderr \|\| stdout`，只取其一。pnpm 把 `error TS…` 写 stdout、把版本警告写 stderr，结果整块丢掉真正的错误结论，只剩几行 `$` 命令回显。 | `RunResult` 增加 `output` 合并视图，两个流都保留。 |
| U12 | `ui.ts` | 详情块整块染红。命令回显属于上下文而非结论，与错误一起染红会让整块输出失去可读性。 | 按行判定语义（命令 / 错误 / 其他）分色；跨流时序错位导致「跑了什么」落在「错在哪」之后，改为按语义重排。 |
| U13 | `ui.ts` | pnpm 在 stdout 与 stderr 各写一次 `[ELIFECYCLE]`，合并后重复出现。 | 相邻重复行去重。 |
| U14 | `ui.ts` | 类型不匹配错误的展开动辄数百字符，在终端反复折行把锚点列冲散；输出可达数百行，淹没结论。 | 单行截断到 140 列；行数预算 40，超出时为错误结论预留额度并显式提示剩余行数。 |
| U15 | `ui.ts` | 非 TTY 下没有动画，但「运行中」占位行仍会输出，同一个任务在 CI 日志里出现两次。 | 无动画时跳过占位行。 |
| U16 | `batch.ts` | 失败时既逐行标记失败项与未执行项，又弹一张摘要卡片，后者是前者的完整重复。 | 移除批处理路径上的摘要卡片；`summary` 只保留给确实需要卡片的内容（发布计划、tarball 安装命令）。 |

第二轮新增 20 个用例（共 247 个），覆盖动画的字节级契约、透传模式禁用、分色分类、详情重排与去重。

排版被拆成独立的 `layout.ts` 纯函数层（列宽计算、任务行排版、详情块缩进），
可在无 TTY、无颜色的环境下断言「应该长什么样」，新增 19 个用例。

### 迁移后仍然保留的设计

冻结计划与发布进度的磁盘格式、`stdout` 与 `stderr` 的输出分离、非交互环境的显式门控、
发布目标拓扑排序、SemVer 基线计算、`runBatch` 的 `--keep-going` 与「取消立即停止」语义、
`commands` / `domains` / `ui` 的单向依赖方向。

---

## 第二部分：Shell 实现阶段（2026-09-29）

范围：当时的 `scripts/workflow/` Shell 批处理与多包发布流程。共记录 4 项发布正确性问题、
3 项流程简化事项，以及 2 项整改过程中新发现的问题；R1–R4、S1–S3 已全部完成实现。
其问题均已在上面的 TypeScript 重构中彻底消除，其中 R1 的部分成功续跑能力被完整保留。

## 发布正确性问题

| 编号 | 优先级 | 问题与影响 | 整改结果 |
| --- | --- | --- | --- |
| R1 | 高 | `latest` 批量发布会先改写所有目标包的版本、更新锁文件并创建一个本地提交，再逐包发布。中途失败时，已发布包与未发布包共处于同一版本提交；下一次完整重试还会遇到已发布版本冲突。当前代码只在全部 npm 发布成功后 push，因此中途 npm 失败不会直接 push 该提交。 | 已整改。新增 `domains/release/state.sh`，把 `published`、`tagged`、`released` 三个不可逆步骤按包记录在 `<plan>.state.json`。发布前完成全部目标检查；发布时逐包写入版本并记录进度；版本提交只包含已发布包的 `package.json`（锁文件确有变化时才加入）。中断后 `release publish` 保留计划与进度文件并输出续跑命令，`release execute <plan>` 会跳过已完成步骤；工作区在中断后保持干净，续跑前仍然执行全部发布前检查。 |
| R2 | 高 | 发布目标按目录名排序，当前顺序中 `element-plus`、`vant` 在 `vue` 之前；两者都依赖 `@schemx/vue`。批量提升依赖版本时，先发布的包可能指向尚未发布的依赖版本。 | 已整改。`targets_resolve` 按 `dependencies` 与 `optionalDependencies` 中的 `workspace:` 依赖做拓扑排序，同层保持输入顺序，环依赖按输入顺序兜底；`targets_order_by_dependencies`、`targets_dependency_records`、`targets_dependency_version` 提供基础能力。发布前检查额外校验未选中依赖的当前版本已在 registry 可获得（`assert-version-published`），计划内依赖由拓扑顺序保证先发布。 |
| R3 | 高 | 发布前的 `pack --dry-run` 失败可能被当作成功：`if ! ui_task ...; then exit_code=$?` 读取的是取反后的退出码 `0`。 | 已整改。改为 `if ...; then :; else exit_code=$?; fi`。整改中发现同类问题存在于质量任务循环、逐包检查循环、`release pack` 以及 `build` 与 `workspace` 命令的 `if ...; then continue; fi` 后读取 `$?`（bash 在该位置恒为 0，构建失败会被报成 `exit 0`），已一并修复。新增 `scripts/tests/release/unit/operations.test.sh` 覆盖退出码冒泡。 |
| R4 | 中 | 计划把所有非 `dev` 通道标记为创建 Git Tag 和 GitHub Release，执行器只对 `latest`、`next` 创建；`alpha`、`beta`、`rc` 的计划与实际行为不一致。 | 已整改。执行器不再判断通道名，统一消费计划中的 `createCommit`、`createTag`、`createGithubRelease` 与 `prerelease` 字段；发布前检查的 GitHub 相关校验同样由计划字段驱动。`release_plan_text` 在确认界面显示版本提交、Git Tag 与 GitHub Release 的实际约定。`alpha`、`beta`、`rc` 现在按计划声明创建 Tag 与预发布 GitHub Release。 |

## 整改过程中新发现的问题

| 编号 | 优先级 | 问题与影响 | 整改结果 |
| --- | --- | --- | --- |
| R5 | 高 | `preflight_assert_prerelease_baseline_available` 判断取反：`if ! preflight_assert_version_available`，而该断言成功恰好表示版本尚未发布。结果是 `alpha`、`beta`、`rc`、`next` 通道的发布前检查必然失败。 | 已整改。改为基线尚未发布时通过、基线已发布或查询失败时报错并返回 1。 |
| R6 | 中 | `plan_value` 用 `jq -er '.[$field] // empty'` 读取顶层字段，`false` 会被 `//` 当成空值，导致计划中的布尔字段读取退出码为 4。 | 已整改。改为 `if .[$field] == null then empty else (.[$field] | tostring) end`，布尔字段返回 `false` 字符串，字段缺失仍然返回非 0。 |

## 可合并或简化的流程

| 编号 | 现状 | 整改结果 |
| --- | --- | --- |
| S1 | `commands/build.sh` 与 `commands/workspace.sh` 各自维护目标循环、失败收集、`--keep-going` 和 UI 收尾。 | 已完成。新增 `shared/batch-runner.sh` 的 `batch_run_records`，统一目标循环、失败汇总与 `--keep-going` 语义；`build`、workspace 批处理任务和 `release pack` 共用，单目标执行仍由各自的回调负责。回调通过 `BATCH_CURRENT_TARGET` 向失败汇总提供目标标识。 |
| S2 | `release check` 每次先运行发布脚本测试，再生成计划并执行发布前检查；已有独立的 `release test` 命令。 | 已完成。`release check` 只保留当前发布计划的校验，脚本测试留在 `release test` 与 CI。 |
| S3 | 发布目标由 `domains/release/targets.sh` 单独扫描包目录，workspace 命令已有 `workspace-catalog.sh` 目标发现逻辑。 | 已完成。`targets_records` 复用 `workspace_catalog_discover packages plugins`，发布域只按 `private`、包名和版本筛选可公开发布的包；筛选条件收敛为 `package_json_is_publishable`。 |

## 遗留事项

- `.release/plans/` 下的冻结计划与进度文件只增不删，需要人工或后续清理策略。
- ~~`scripts/tests/lib/targets.test.mjs` 仍引用已迁移的路径~~ 已随 Shell 实现一并移除，
  目标发现规则由 `catalog.test.ts` 与 `targets.test.ts` 覆盖。
- `catalog.find` 接受 `scope/directory`、`directory` 与 npm 包名三种标识，但 `resolveTargets`
  的多选筛选只按 `directory` 匹配；传入 npm 包名做多选会静默返回空结果。发布流程文档只承诺
  目录名与 `all`，故未修改。
