# Release Notes - 2.0.0

## 版本信息

- 目标版本：2.0.0。
- 发布包：`@schemx/core`。
- 说明更新日期：2026-11-05。
- 发布状态：发布准备中。

移除 Core 的模块级全局配置和旧布局、展示、Renderer Props 兼容声明，共享配置改用独立工厂，框架展示能力由适配层扩展。

## Important Notices

- 2.0.0 包含公共 API 与 TypeScript 类型的破坏性变更，升级方式见 [Core 2.0 迁移指南](./MIGRATION.md)。
- 本说明面向即将发布的 2.0.0，包含此前确认纳入的暂存变更；正式发布操作尚未执行。

## Breaking Changes

### 模块级全局配置改为独立工厂

删除 `@schemx/core` 根入口的 `configureSchemx()` 和 `getGlobalSchemxConfig()`。直接调用 `createForm(options)` 只使用显式选项和内置默认值，不再继承模块级全局配置。

```ts
// 旧写法
import { configureSchemx, createForm } from "@schemx/core"

configureSchemx({ schemaConfig: { readonly: true } })
const form = createForm({ initialValues: { name: "" } })
```

```ts
// 新写法
import { createSchemx } from "@schemx/core"

const api = createSchemx({ schemaConfig: { readonly: true } })
const form = api.createForm({ initialValues: { name: "" } })
const defaults = api.getConfig()

api.configureSchemx({ schemaConfig: { readonly: false } })
// 仅影响此工厂后续创建的表单。
api.configureSchemx() // 恢复创建工厂时的基线。
form.destroy()
```

### 布局、展示和分组交互交由框架适配层声明

| 移除的 Core 内置声明                                                                                           | 迁移方式                                                                                                         |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `SchemxLayout`，Field / Group / Dynamic 的 `layout`                                                            | 使用框架适配层的 `col` / `row`；Vue 类型为 `SchemxColConfig` / `SchemxRowConfig`。`row` 不是旧列对象的直接改名。 |
| Field 的 `labelIcon`、`labelAlign`、`labelPosition`、`labelWidth`、`contentAlign`、`colon`、`showRequiredMark` | 通过 `SchemxFieldDefinition` 声明框架展示属性。                                                                  |
| `defaultSchemxConfig` 中上述七个展示默认值                                                                     | 通过 `SchemxSchemaConfigDefinition` 声明默认配置类型，由框架适配层提供实际默认值。                               |
| `dependencies.showRequiredMark`                                                                                | 通过 `SchemxFieldDependenciesDefinition` 声明动态条件函数。                                                      |
| Group 的 `collapsible`、`defaultCollapsed`、`collapsed`、`onCollapsedChange`、`destroyOnCollapse`              | 通过 `SchemxGroupFieldDefinition` 声明折叠交互。                                                                 |

框架适配层（Vue、React、...）需提供这些类型及展示行为。Vue 已提供对应扩展，业务方从 `@schemx/vue` 或 UI 包公开入口导入即可加载。Vue 自己的旧布局兼容别名未在本次 Core 清理中移除。

Core 默认值现在只包含 `class`、`required`、`readonly`、`disabled`、`visible`、`validationTrigger`。例如，`labelWidth: undefined` 不再由 Core 自动回退成 `"auto"`，请由框架适配层提供展示默认值。必填校验仍由 `required` 控制，未显式设置的视觉标记仍跟随有效必填状态。

### Renderer 值、事件和对齐类型改为框架扩展

`SchemxBaseComponentProps` 不再内置 `align`、`value`、`"onUpdate:value"`、`onChange`、`onBlur`，并移除 `TName`、`TValue` 泛型，只保留 `SchemxBaseComponentProps<TValues>`。

公共值与事件通过 `SchemxComponentPropsDefinition` 声明；Renderer 专属 Props 通过 `SchemxRendererDefinition` 声明。需要特定字段值类型时，请在自己的 Renderer Props 中描述。Vue 已提供值与事件的类型和运行时绑定。

### Core 不再改写只读字段的框架展示属性

Core 不再因 `readonly: true` 强制把 `contentAlign` 改为 `"right"`、`labelPosition` 改为 `"left"`。自定义框架适配层需自行处理该展示策略；Vue Field 接管原有只读布局，Vue、Vant 和 Element Plus 的内置字段保持原有显示效果。

## Documentation

新增 [1.x → 2.0 迁移指南](./MIGRATION.md)，包含完整属性映射、框架扩展示例和全局配置迁移步骤，并随 npm 包分发。README 已同步移除旧 API 说明并添加迁移入口。

## 其他架构调整

- 删除 `createFormWithConfig`，显式继承配置改用 `createSchemx(config).createForm(options)`。
- 删除 `mergeSchemxConfig` 和 `mergeAndResolveSchemxConfig`，分别改用 `mergeConfig` 和 `resolveSchemxConfig(mergeConfig(...configs))`。
- 根入口不再公开 `normalizeSchemxConfig`、`defaultSchemxConfigKeys`、`excludeSchemxConfigKeys`、`SchemxConfigKey` 和 `ExcludeSchemxConfigKeys`；标准化与默认键列表保留为内部实现，未使用的排除键列表及类型删除。

- 保留独立的 `lifecycle` 模块处理通知和异常隔离，Reconciler 负责阶段编排及按需捕获快照。生命周期统一使用 `NodeSnapshot`：将 `node.name.value` 改为 `snapshot.name`，将 `node.compiledSchema.peek()` 改为 `snapshot.compiledSchema`。`updated` 接收新旧普通快照，不再暴露内部节点或 Scope；通知顺序及异常隔离保持原语义。
- 删除 Scheduler 的 idle 队列、`idleTimeout`、`includeIdle`、`SchedulerIdleOptions`、`SchedulerTrackOptions`。配置保留 `timeSliceMs` 与 `collectDiagnostics`，内部统一以 `whenIdle(timeout?)` 等待全部工作，跟踪异步任务不再指定优先级。
- 移除未使用的节点 `rulesOverride`；手动规则继续由 Validator 管理。撤销手动规则后恢复 Schema 规则。
- 资源更新使用普通配置快照，通知元数据只在对应 hook 存在时捕获。任务 runner 借用资源 Scope，独立释放不再创建或销毁额外子 Scope；移除内部 `throwOnError` 选项，过期任务不提交结果。
- ViewSchema 直接生成包含稳定 `formInstance` 的最终 Props，删除二次递归绑定和缓存。Compiler 仍不接收 Form 实例。
- Renderer 绑定直接返回公开 API，节点和数组行的 ID 序列由 Compiler 私有持有。

## Validation

本包 762 项测试通过，相关类型检查与构建通过。
