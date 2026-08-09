# Core Major 架构精简与迁移方案

## 1. 目标与范围

本方案定义下一次 `@schemx/core` Major 版本的架构、公共 API 与迁移顺序。目标是将 Core 收敛为一个框架无关、资源所有权明确、运行路径可预测的表单引擎。

本次调整覆盖 `core`，以及必须同步迁移的 `vue`、`vant`、`validator` 包。采用一次性 Major 发布：不保留 deprecated alias、兼容代理或双版本 API。

### 目标

- 消除同一状态的多处事实源。
- 将 Renderer 和 Vue 绑定协议移出 Core。
- 让每个 Scope、异步任务和订阅只有一个 owner。
- 让单次表单变更最多经过一次快照构建、一次子树遍历和一次必要的 Effect 更新。
- 将用户 API、Adapter SPI 和 Runtime 内部实现分离。

### 非目标

- 不将 `field`、`presentation`、`dependency` 合并为一个通用状态模块。
- 不新增 `ResourceManager`、`ContainerManager` 等泛化资源层。
- 不承诺 deep import 或已删除内部类型的兼容性。
- 不在目录移动阶段混入行为调整。

## 2. 已锁定的设计决策

| 决策 | 最终选择 |
| --- | --- |
| 发布策略 | 一次性 Major，不提供兼容 alias 或代理。 |
| `NamePath` | 仅接受点分字符串，如 `user.name`、`items.0.id`。 |
| 同名 Field | 单个 Runtime 中全局唯一，含 Dependency 动态子树。 |
| 包导出 | 拆分 `@schemx/core` 与 `@schemx/core/adapter`。 |
| 全局配置 | 删除 Core 模块级 `configureSchemx`；只支持 per-form options。 |
| Renderer 绑定 | value、事件、Form context 由 Adapter 装配；Core 不注入框架 props。 |
| Core 领域边界 | 保留 Field、Presentation、Dependency 三个领域模块，共享基础设施。 |

### `NamePath` 规范

公共 API 仅接受 `DeepNamePath<TValues>` 产生的字符串路径。数组元组路径和 bracket 语法不再受支持。

```ts
type NamePath<TValues> = DeepNamePath<TValues>

// 合法
"user.name"
"items.0.id"

// 非法
["user", "name"]
"items[0].id"
```

内部使用 `PathSegment = string | number` 处理路径，并以 JSON 编码后的 `FieldKey` 作为 FieldIndex、Scheduler task ID 和 Compiler cache 的唯一 key。字段名不支持字面量 `.`。

## 3. 目标架构

### 依赖方向

```text
contracts ← model ← runtime ← form
    ↑          ↑        ↑
    └──────── adapter ──┘
```

- `contracts`：Schema、Form、Validation、Dependency、NamePath 等纯类型与 DTO；不得依赖 Runtime、Config 或 Store 实现。
- `model`：Store 和 Validation；只依赖 contracts。
- `runtime`：Compiler、Reconciler、领域运行态和 View 投影；通过窄端口访问 model。
- `form`：唯一 composition root，负责创建 Store、Validator、Runtime 和公共 facade。
- `adapter`：Renderer Registry、ViewSchema 与框架适配所需 SPI；不得反向影响 Runtime。

### 目标目录

```text
src/
├── contracts/
├── form/
├── model/
│   ├── store/
│   └── validation/
├── runtime/
│   ├── compiler/
│   ├── reconciler/
│   ├── field/
│   ├── presentation/
│   ├── dependency/
│   ├── view/
│   └── infrastructure/
│       ├── scope.ts
│       ├── scheduler.ts
│       └── asyncTask.ts
└── adapter/
```

目录只在行为、测试和消费包迁移完成后移动。移动前先通过 import 边界实现相同的依赖方向。

### 资源所有权

```text
RuntimeRootScope
├── Scheduler
├── SchemaSourceSubscription
├── ViewSubscriptions
└── NodeScope
    ├── ValidationEffectScope
    ├── DependenciesEffectScope
    └── RendererEffectScope
```

规则：创建者拥有 child scope；父 Scope 销毁时递归销毁 child scope；不得同时使用 child ownership 与 `parent.add(child.dispose)` 管理同一资源。

## 4. 公共 API 与契约

### 根入口：`@schemx/core`

保留以下能力：

- `createForm`、`createField`、`createSchemas`、`createWatch`
- `createValidator`、`createValidationRuleRegistry`
- Schema、Form、Validation、Dependency、Renderer key 的用户类型
- `SchemxInstance`、`SchemxFieldInstance`

删除以下导出：

- `configureSchemx`、`getGlobalSchemxConfig`、全局配置合并器和 deprecated config aliases
- `ResolvedCreateFormOptions`、`SchemxGlobalContext`、`CSSProperties`
- RuntimeNode、Compiler、Scope、Scheduler、reactivity primitives
- path/schema 内部工具
- `createWatchField`、`createWatchFields`、`createWatchAll`
- deprecated dependency/container aliases

### Adapter 入口：`@schemx/core/adapter`

新增 `./adapter` export，提供：

- `createRendererRegistry` 与 `RendererRegistry` 接口
- Renderer 批量注册类型
- `SchemxViewSchema`、Field/Group ViewSchema 类型
- Adapter 订阅与 Renderer SPI 类型

Core Runtime 不再持有 Renderer component 或 Renderer Registry。`componentType` 和 `defaultRendererType` 仅是字符串语义；未声明两者时，编译抛出 `CompileError`。

### Form 和 Schema 类型

- `CreateFormOptions` 删除 `rendererRegistry`，保留 `defaultRendererType?: string`。
- 删除 Core 的模块级全局配置；Vue/Vant 在各自 App-local 配置中合并 defaults 后再调用 `createForm`。
- `SchemxInstance` 保留规范化方法名，例如 `getFieldValue`、`setFieldValue`。
- 删除 `SchemxFormApi` 的 `getValue/setValue` 等同义方法；Dependency 使用 `Pick<SchemxInstance, ...>` 定义窄 API。
- `initialValue`、schema `onChange` 等字段值类型统一为 `FieldValue<TValues, TName>`。

`createSchemas` 统一为：

```ts
interface SchemxSchemas<TValues> {
  get(): readonly SchemxField<TValues>[]
  set(next: readonly SchemxField<TValues>[]): void
  update(
    updater: (
      current: readonly SchemxField<TValues>[]
    ) => readonly SchemxField<TValues>[]
  ): void
  subscribe(listener: SchemxSchemasListener<TValues>): () => void
}
```

删除 `signal`、`value`、`peek`；内部使用 symbol brand，而非 duck typing。

### Dependency 异步上下文

所有条件函数、trigger 和动态 renderer 的第三参数统一为：

```ts
interface SchemxDependencyContext {
  readonly signal: AbortSignal
}
```

取消后的任务不得提交结果或阻塞 `waitForIdle()`；底层 Promise 即使忽略 `signal`，其 rejection 也必须被安全消费。

### ViewSchema 与 Renderer 绑定

Core ViewSchema 只包含稳定 `key`、显式 `kind`、有效的字段/分组语义状态和用户原始 `componentProps`。Core 不再注入：

- `formInstance`
- `formItemProps`
- `value`
- `onChange`、`onBlur`
- `"onUpdate:value"`

Core 不再深拷贝或清洗 `componentProps`，也不截断 placeholder。仅在 `CreateFormOptions.debug === true` 时创建 debug DTO 与诊断状态。

Vue Adapter 负责 value、change/blur/update 绑定、用户 handler 组合、Form context、required mark 和 Vue 专属默认展示。Vant Renderer 删除剔除 `formInstance` 的兼容代码。

## 5. 实施顺序

### 阶段 A：恢复可信基线

1. 修复 unknown validation rule 未实际 warning 的测试失败。
2. 删除或迁移遗留 `createEffect` 测试与现有示例。
3. Core 测试改为 Node 环境，移除仅为测试存在的 Vue devDependency。
4. 普通 build 禁用 analyzer；`build:analyze` 显式开启 analyzer。
5. 停止跟踪 `tsconfig.tsbuildinfo`。
6. 为后续每个确定性缺陷先写失败测试。

### 阶段 B：Store 与 Validation 单一事实源

1. `reset(values)` 直接替换整个 initial baseline，删除字段不能在后续 reset 中复活。
2. 无参 `isFieldsPending()` 使用 any 语义；传入路径列表使用 all 语义；空 Store 返回 `false`。
3. Store 每个 batch 只递增一次 revision，发布精确 changed FieldKey 集合。
4. full snapshot 以 revision 缓存；同一 batch 最多创建一次。
5. reset/delete 直接发布删除的 FieldKey，不再依赖叶子 diff 推断。
6. FormObserver、watch-all 和 Dependency values 使用相同 snapshot/cache。
7. 单字段/多字段 watch 先比较目标字段，仅在回调触发时读取 snapshot。
8. `touched` 只表示显式交互或 blur；`dirty` 从 current value 与 initial baseline 派生，不额外创建 Signal。
9. ValidationController 将 schema rules 与 imperative rules 分开保存；imperative override 优先，移除 override 后恢复 schema rules。
10. 删除 `setFieldRules/removeFieldRules` 的立即加延迟双重同步；`submit()` 只等待一次 idle。

### 阶段 C：Runtime 资源与状态瘦身

1. Scope 移到 `runtime/infrastructure`，仅保留 `Scope/createScope`；children 和 cleanup 改为 `Set`。
2. disposed Scope 创建 child 时返回立即 disposed 的 child。
3. 将 `subscribeViewSchemas` disposer 加入 RuntimeRootScope。
4. 删除 `RuntimeRegistry.nodes`，FieldIndex 保持 `Map<FieldKey, FieldNode>`。
5. RuntimeNode 仅保存当前 input、领域 state、Scope 和树关系；删除重复 `componentType`、compiled validation、固定 source 等无消费者数据。
6. 删除 `mounted` Signal、ValidationEffect `registered` Signal 和 renderer effect 的无人消费 Signals。
7. diagnostics 默认不创建；仅 debug 模式启用。
8. `SchemaRuntimeContext` 删除 `instance`、重复 validation port、schemaConfig 等无消费服务。

### 阶段 D：Compiler 与 Reconciler 事务化

协调流程固定为：

```text
normalize full source
→ compile reconciliation plan
→ validate keys and field uniqueness
→ create/mount new nodes with rollback list
→ atomically commit parent childNodes
→ post-order dispose removed subtree
```

具体规则：

1. normalize 仅在根边界执行一次；normalize 与 Compiler 同层，utils 不反向 import Compiler error。
2. Compiler cache 使用 schema identity、最终 node key 和 compiler epoch；不使用 index。
3. invalidate 时替换整个 WeakMap；cache/version 不公开。
4. 直接 children 全部编译并校验成功后才允许创建节点。
5. mount 失败时用 rollback list 清理所有未提交节点和 Effect。
6. FieldKey 冲突抛出携带两个 schema location 的 `CompileError`；动态子树冲突时保留旧子树。
7. Lifecycle hook 异常隔离，不能中断事务或资源释放。
8. LifecycleBus 改为创建时提供的 hooks dispatcher；删除动态 `.on()` 和空 `emitUpdate`。
9. 生命周期 payload 改为只读 DTO，不暴露 RuntimeNode。
10. 子树删除只执行一次 child-first 遍历；父 `childNodes` 一次性替换。
11. `updateFieldSchema` 递归更新 schema source，禁止直接修改 RuntimeNode；`componentProps` 保持浅合并。

### 阶段 E：Effect、Scheduler 与 View 热路径

1. Scheduler 只保留 keyed `normal/post` 两级队列。
2. 增加 `flushScheduled`，每个 tick 最多创建一个 microtask。
3. idle waiter 使用具名 record；timeout、idle、dispose 删除同一对象；dispose 以 `false` 完成全部 waiter。
4. AbortableTaskRunner 跟踪逻辑任务；被取消的旧任务不占用 idle。
5. Validation Effect 与 Field 同生命周期，仅 name 改变时重建，并只读取 validation slice。
6. Dependencies Effect 仅在 dependencies identity 或 triggerFields 改变时重建；移除配置时立即清空动态覆盖。
7. label、placeholder、componentProps 更新不得取消 validation 或重启 dependencies。
8. Group View computed 仅在 mount 创建，常规更新保持 identity。
9. 删除深度 componentProps sanitizer、placeholder 截断和默认 debug 热状态。

### 阶段 F：Adapter 与消费包迁移

1. 添加 `@schemx/core/adapter` 构建入口。
2. Core 删除 RendererRegistry 和完整 Form instance 依赖；Compiler 只处理 renderer key 字符串。
3. Vue `useForm` 将 App-local defaults 与 Form options 合并后传入 Core；Renderer Registry 仅由 Vue Adapter 使用。
4. Vue FormItem 装配所有 Renderer props，并组合用户事件 handler。
5. Vant Renderer 和类型删除 `formInstance`、`onUpdate:value` 兼容分支。
6. Validator 包删除对 `configureSchemx` 的依赖。
7. Vue 根入口只重导出 Core 的稳定用户 API，不重导出 Adapter SPI。
8. 删除 `csstype` 和无消费 CSS 类型。

### 阶段 G：物理目录整理

仅在前述行为通过后，按目标目录迁移文件，更新显式 export 清单。此阶段不得修改 API 或运行语义。

## 6. 测试与验收

### 正确性

- 删除 Field dependencies 后，所有动态覆盖回退静态值。
- `updateFieldSchema` 后执行 `updateSchemaConfig`，patch 不丢失。
- Runtime destroy 自动释放 View subscription。
- disposed Scope 不会产生可运行 child。
- `whenIdle` timeout 后 waiter 数为 0；destroy 后所有 waiter 返回 `false`。
- 永不 settle 的旧 dependency 被替代后，最新任务完成即可 idle。
- Store reset 新 baseline 后旧字段不复活。
- pending 的 any/all 语义正确。
- Renderer Registry 支持 falsy Renderer 和空字符串 key，删除 fallback 后状态正确。
- 静态和动态子树的同名 Field 被事务性拒绝。
- Reconciler mount 失败后不存在 orphan node、FieldIndex、validation 或 Effect。
- 删除字段、空对象和空数组能正确上报 changed paths。

### 类型

- 点分 NamePath 合法，tuple/bracket NamePath 编译失败。
- `FieldValue<TValues, TName>` 对当前字段精确推导。
- Dependency callback 的第三参数包含 `signal`。
- `componentProps` 不再有 Core 注入的 Form binding。
- 根入口不能导入 Runtime/Adapter internals。
- `@schemx/core/adapter` 可独立导入。

### 性能与资源

使用操作次数断言，不以墙钟时间作为验收：

- 连续调度 1000 个任务只创建一个 microtask。
- 删除 N 节点子树时每个节点只访问一次。
- 修改 placeholder 不重建 validation/dependency Effect。
- 同一 Store batch 最多创建一次 full snapshot。
- 单字段 watch 不遍历无关字段。
- componentProps 保持引用和原型。
- 多次 mount/update/destroy 后 disposer、subscription、waiter 数归零。
- 稳定 key 的字段 reorder 不产生无意义 Effect 重建。

### 发布前验证

```text
core: lint + format:check + type-check + type-test + test + build
validator: type-check + test + build
vue: type-check + test + build
vant: type-check + test + build
package export/import smoke test
```

额外检查：

- Core 生产代码不 import Vue/Vant。
- Core 中不存在 `formInstance` 或 `"onUpdate:value"` 注入逻辑。
- Core 默认路径不创建 diagnostics Signals。
- 普通 build 不生成 analyzer 产物。
- `tsconfig.tsbuildinfo` 不再被 Git 跟踪。
- ESM/CJS 均能导入根入口和 `./adapter`。
- 两个 Vue App 的配置和 Registry 不经由 Core singleton 相互污染。

## 7. 现有方案的关系

`docs/runtime-simplification-plan.md` 和 `docs/runtime-descriptor-removal-plan.md` 记录的是 Descriptor/Container 尚存在时的历史方案。它们不再作为当前实施依据；本文件以当前 Runtime 结构和上述已锁定的 Major 决策为准。
