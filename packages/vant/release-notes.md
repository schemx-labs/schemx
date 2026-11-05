# Release Notes - 2.0.0

## 版本信息

- 目标版本：2.0.0。
- 发布包：`@schemx/vant`。
- 说明更新日期：2026-11-05。
- 发布状态：发布准备中。

接入上游 Core 2.0 的兼容 API 移除，不再透传全局配置 getter；本包默认配置方法和 Registry 保持独立。

## Important Notices

- 2.0.0 包含公共 API 与 TypeScript 类型的破坏性变更，升级方式见 [Core 2.0 迁移指南](../core/MIGRATION.md)。
- 本说明面向即将发布的 2.0.0，包含此前确认纳入的暂存变更；正式发布操作尚未执行。

## Breaking Changes

### 根入口不再透传 getGlobalSchemxConfig

`@schemx/vant` 不再透传上游 Core 的模块级 `getGlobalSchemxConfig()`。

```ts
// 旧写法：读取 Core 模块级全局配置。
import { getGlobalSchemxConfig } from "@schemx/vant"

const config = getGlobalSchemxConfig()
```

```ts
// 读取当前 UI 包的默认配置。
import { getConfig } from "@schemx/vant"

const config = getConfig()
```

`getConfig()` 返回本包默认配置，不是某个 App / Form 的当前配置。若需要独立共享配置，请使用 `createSchemx(config)` 工厂，再调用该工厂的 `getConfig()`；不要依赖已移除的 Core 全局状态。

### 透传的 Core Renderer Props 泛型调整

`SchemxBaseComponentProps<TValues, TName, TValue>` 改为 `SchemxBaseComponentProps<TValues>`。特定字段值类型请在 Renderer 自有 Props 中声明；Vue 声明合并继续提供值与事件类型。

## Improvements

本包导出的 `configureSchemx()`、`getConfig()`、`createForm()`、`useForm()` 继续绑定本包工厂，Registry 保持独立；被删除的是 Core 全局入口，不是本包默认配置方法。只读字段布局由 Vue Field 接管，保留原有显示效果。Vue 的 `SchemxLayout` 兼容别名仍保留，推荐使用 `SchemxColConfig` / `SchemxRowConfig`。

## Dependencies and Compatibility

本次属于上游 Core / Vue 公共 API 变化的已确认影响，需与兼容 Core 2.0 的框架与 UI 适配版本一起升级；本次未调整依赖版本范围。

## Documentation

更新根入口的兼容说明。全局配置、展示属性及 Renderer 类型的完整迁移方式见 [Core 2.0 迁移指南](../core/MIGRATION.md)。

## Validation

本包 75 项测试通过，相关类型检查与构建通过。
