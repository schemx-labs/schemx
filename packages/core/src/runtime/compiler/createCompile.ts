/**
 * Schema compiler 实现。
 *
 * 将用户传入的 SchemxField schema 编译为 SchemaNode。
 * 通过 WeakMap 以 schema 对象引用为键，并按父级与索引位置缓存配置 token。
 * version 机制在编译选项变化时失效 token，使位置未变的 schema 重新创建节点。
 *
 * @module core/runtime/compiler/createCompile
 */

import { mergeAndResolveSchemxConfig } from "../../config"
import { createComputed, createSignal } from "../../reactivity"
import { isDependencySchema, isDynamicSchema, isGroupSchema } from "../../utils"
import { isSchemaNode } from "../node/helper"
import { createScope } from "../node/scope"

import {
  buildFieldStaticSchema,
  createInitialDiagnostics,
  createNodeKey,
  DEFAULT_PRESENTATION_STATE,
  isValidationSchemaEqual,
  resolveComponentProps,
  resolvePresentationState,
} from "./helper"

import type { Compile, CompileOptions } from "./types"
import type {
  SchemxBaseField,
  SchemxDependencyField,
  SchemxDynamicField,
  SchemxField,
  SchemxGroupField,
  SchemxInstance,
  SchemxSchemaConfig,
  Values,
} from "../../types"
import type {
  DependencyNode,
  DynamicNode,
  FieldDynamicOverrides,
  FieldNode,
  FieldValidationSchema,
  GroupNode,
  PresentationDynamicOverrides,
  SchemaNode,
  Scope,
} from "../node"

/**
 * 创建 compiler 的私有配置 token 缓存。
 *
 * 每个 compiler 实例独立持有缓存，避免不同表单实例之间复用配置身份。
 */
type CompileCache<TValues extends Values = Values> = WeakMap<
  SchemxField<TValues>,
  Map<string, symbol>
>

/**
 * 创建空的 compiler 配置 token 缓存。
 *
 * @typeParam TValues - 表单值类型。
 * @returns 新的 compiler 缓存。
 */
function createCompileCache<TValues extends Values = Values>(): CompileCache<TValues> {
  return new WeakMap()
}

/**
 * 创建 schema compiler。
 *
 * 每个 compiler 实例维护自己的配置 token 缓存。调用方通过 `invalidate()`
 * 失效缓存，而不是直接操作缓存版本。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - 可选编译选项，包含默认属性和表单实例。
 * @returns Schema compiler 门面，提供 `createNode()` 和 `invalidate()`。
 *
 * @example
 * ```ts
 * const compile = createCompile()
 * const node = compile.createNode(schema, "schemx:root", 0)
 * ```
 */
export function createCompile<TValues extends Values = Values>(
  options: Partial<Omit<CompileOptions<TValues>, "schemaConfig">> & {
    schemaConfig?: SchemxSchemaConfig
  } = {}
): Compile<TValues> {
  // 将可选配置归一为节点编译所需的完整选项。
  const compileOptions: CompileOptions<TValues> = {
    schemaConfig: options.schemaConfig ?? mergeAndResolveSchemxConfig().schemaConfig,
    rendererProps: options.rendererProps,
    formInstance: options.formInstance ?? ({} as SchemxInstance<TValues>),
    debug: options.debug,
  }

  // 节点 id 仅在当前 compiler 实例内递增。
  let nextId = 1

  // schema 引用与运行时 key 共同决定配置 token 的复用边界。
  let compileCache = createCompileCache<TValues>()

  /**
   * 编译单个 Schema 并创建一个尚未挂载的 SchemaNode。
   *
   * @param schema - 要编译的字段、分组或 dependency Schema。
   * @param parentKey - 父节点的稳定 key。
   * @param index - Schema 在父节点 children 中的位置。
   * @param scope - 可选的节点资源作用域。
   * @returns 尚未挂入 NodeManager 的运行时节点。
   */
  function createNode(
    schema: SchemxField<TValues>,
    parentKey: string,
    index: number,
    scope?: Scope
  ): SchemaNode<TValues> {
    const key = createNodeKey(schema, index, parentKey)

    const configToken = getConfigToken(schema, key, compileCache)

    const id = nextId++

    // Dynamic 节点只保存数组容器状态；其 item 模板由数组结构 effect 展开。
    if (isDynamicSchema(schema)) {
      const runtimeStaticSchema: SchemxDynamicField<TValues> = {
        ...schema,
        key,
        visible: schema.visible ?? compileOptions.schemaConfig.visible,
        readonly: schema.readonly ?? compileOptions.schemaConfig.readonly,
        disabled: schema.disabled ?? compileOptions.schemaConfig.disabled,
      }

      const staticSchema = createSignal(runtimeStaticSchema, {
        name: `dynamic:${id}:staticSchema`,
      })

      const dynamicOverrides = createSignal<PresentationDynamicOverrides>(
        {},
        {
          name: `presentation:${id}:dynamicOverrides`,
        }
      )

      const inheritedState = createComputed(() => {
        const parent = node.parent

        return parent && isSchemaNode(parent)
          ? parent.effectiveState.value
          : DEFAULT_PRESENTATION_STATE
      })

      const effectiveState = createComputed(() =>
        resolvePresentationState(
          staticSchema.value,
          dynamicOverrides.value,
          inheritedState.value
        )
      )

      const node: DynamicNode<TValues> = {
        id,
        key,
        type: "dynamic",
        parent: null,
        scope: scope ?? createScope(),
        disposed: createSignal(false),
        configToken,
        staticSchema,
        dynamicOverrides,
        effectiveState,
        presentationEffectScope: null,
        dynamicEffectScope: null,
        dynamicRows: createSignal([]),
        viewSchemas: null,
        childNodes: createSignal([]),
      }

      return node
    }

    // Group 节点只保存静态配置和呈现状态，children 由 reconciler 继续编译。
    if (isGroupSchema(schema)) {
      const runtimeStaticSchema: SchemxGroupField<TValues> = {
        ...schema,
        key,
        children: [],
        visible: schema.visible ?? compileOptions.schemaConfig.visible,
        readonly: schema.readonly ?? compileOptions.schemaConfig.readonly,
        disabled: schema.disabled ?? compileOptions.schemaConfig.disabled,
      }

      const staticSchemaSignal = createSignal(runtimeStaticSchema, {
        name: `group:${id}:staticSchema`,
      })

      const dynamicOverrides = createSignal<PresentationDynamicOverrides>(
        {},
        {
          name: `presentation:${id}:dynamicOverrides`,
        }
      )

      const inheritedState = createComputed(() => {
        const parent = node.parent

        return parent && isSchemaNode(parent)
          ? parent.effectiveState.value
          : DEFAULT_PRESENTATION_STATE
      })

      const effectiveState = createComputed(() => {
        return resolvePresentationState(
          staticSchemaSignal.value,
          dynamicOverrides.value,
          inheritedState.value
        )
      })

      const node: GroupNode<TValues> = {
        id,
        key,
        type: "group",
        parent: null,
        scope: scope ?? createScope(),
        disposed: createSignal(false),
        configToken,
        staticSchema: staticSchemaSignal,
        dynamicOverrides,
        effectiveState,
        viewSchemas: null,
        presentationEffectScope: null,
        childNodes: createSignal([]),
      }

      return node
    }

    // Dependency 节点的 children 由动态 renderer 产生，静态节点只保存触发配置。
    if (isDependencySchema(schema)) {
      const rendererContextKey = readDynamicDependencyContextKey(schema)

      const runtimeStaticSchema: SchemxDependencyField<TValues> = {
        ...schema,
        key,
        visible: schema.visible ?? compileOptions.schemaConfig.visible,
        readonly: schema.readonly ?? compileOptions.schemaConfig.readonly,
        disabled: schema.disabled ?? compileOptions.schemaConfig.disabled,
      }

      const staticSchema = createSignal(runtimeStaticSchema, {
        name: `dependency:${id}:staticSchema`,
      })

      const dynamicOverrides = createSignal<PresentationDynamicOverrides>(
        {},
        {
          name: `presentation:${id}:dynamicOverrides`,
        }
      )

      const inheritedState = createComputed(() => {
        const parent = node.parent

        return parent && isSchemaNode(parent)
          ? parent.effectiveState.value
          : DEFAULT_PRESENTATION_STATE
      })

      const effectiveState = createComputed(() => {
        return resolvePresentationState(
          staticSchema.value,
          dynamicOverrides.value,
          inheritedState.value
        )
      })

      const node: DependencyNode<TValues> = {
        id,
        key,
        type: "dependency",
        parent: null,
        scope: scope ?? createScope(),
        disposed: createSignal(false),
        configToken,
        staticSchema,
        rendererContextKey,
        dynamicOverrides,
        effectiveState,
        viewSchemas: null,
        rendererEffect: null,
        presentationEffectScope: null,
        childNodes: createSignal([]),
      }

      return node
    }

    // Field 节点将字段默认值与 Schema 合并为静态配置，动态覆盖另行保存。
    const staticSchema = buildFieldStaticSchema(schema, key, compileOptions)

    const runtimeStaticSchema: SchemxBaseField<TValues> = {
      ...staticSchema,
      dependencies: schema.dependencies,
    }

    const staticSchemaSignal = createSignal(runtimeStaticSchema, {
      name: `field:${id}:staticSchema`,
    })

    const dynamicOverrides = createSignal<FieldDynamicOverrides<TValues>>(
      {},
      {
        name: `field:${id}:dynamicOverrides`,
      }
    )

    const diagnostics =
      compileOptions.debug === true
        ? createSignal(createInitialDiagnostics<TValues>(), {
            name: `field:${id}:diagnostics`,
          })
        : undefined

    const nameSignal = createSignal(schema.name, {
      name: `field:${id}:name`,
    })

    const inheritedState = createComputed(() => {
      const parent = node.parent

      return parent && isSchemaNode(parent)
        ? parent.effectiveState.value
        : DEFAULT_PRESENTATION_STATE
    })

    let previousValidationSchema: FieldValidationSchema<TValues> | undefined

    // Validator 只依赖校验相关切片；无关展示更新复用上一次对象引用。
    const validationSchema = createComputed(() => {
      const base = staticSchemaSignal.value

      const overrides = dynamicOverrides.value

      const presentationState = resolvePresentationState(
        base,
        overrides,
        inheritedState.value
      )

      const nextValidationSchema: FieldValidationSchema<TValues> = {
        visible: presentationState.visible,
        disabled: presentationState.disabled,
        readonly: presentationState.readonly,
        label: base.label || "",
        required: overrides.required ?? base.required ?? false,
        rules: overrides.rules ?? base.rules ?? [],
      }

      if (
        previousValidationSchema &&
        isValidationSchemaEqual(previousValidationSchema, nextValidationSchema)
      ) {
        return previousValidationSchema
      }

      previousValidationSchema = nextValidationSchema

      return nextValidationSchema
    })

    // Renderer 使用完整有效配置，包含继承后的展示状态和动态 Props。
    const effectiveSchema = createComputed(() => {
      const base = staticSchemaSignal.value

      const overrides = dynamicOverrides.value

      const validation = validationSchema.value

      const readonlyPlaceholder =
        overrides.readonlyPlaceholder ?? base.readonlyPlaceholder

      const placeholder = overrides.placeholder ?? base.placeholder ?? ""

      const showRequiredMark =
        overrides.showRequiredMark ??
        base.showRequiredMark ??
        Boolean(validation.required)

      return {
        key,
        name: nameSignal.value,
        componentType: base.componentType,
        label: validation.label,
        visible: validation.visible,
        disabled: validation.disabled,
        readonly: validation.readonly,
        required: validation.required,
        showRequiredMark,
        placeholder,
        readonlyPlaceholder,
        componentProps: resolveComponentProps({
          staticProps: base.componentProps,
          dynamicComponentProps: overrides.componentProps,
          effectiveProps: {
            disabled: validation.disabled,
            readonly: validation.readonly,
            placeholder,
            readonlyPlaceholder,
          },
          staticEffectiveProps: {
            disabled: base.disabled ?? false,
            readonly: base.readonly ?? false,
            placeholder: base.placeholder ?? "",
            readonlyPlaceholder: base.readonlyPlaceholder,
          },
        }),
        rules: validation.rules,
        validationTrigger: base.validationTrigger,
      }
    })

    const node: FieldNode<TValues> = {
      id,
      key,
      type: "field",
      parent: null,
      scope: scope ?? createScope(),
      disposed: createSignal(false),
      configToken,
      name: nameSignal,
      staticSchema: staticSchemaSignal,
      dynamicOverrides,
      effectiveSchema,
      validationSchema,
      diagnostics,
      viewSchemas: null,
      validationEffectScope: null,
      dependenciesEffectScope: null,
    }

    return node
  }

  /**
   * 替换完整 WeakMap，使旧缓存可以随 schema 引用一同回收。
   */
  function invalidate(): void {
    compileCache = createCompileCache<TValues>()
  }

  return {
    createNode,
    invalidate,
  }
}

/**
 * 读取 Dynamic 行内 Dependency 的内部上下文 token。
 *
 * Dynamic 模块通过非枚举 Symbol 写入该值，因此不会污染公开 ViewSchema 或
 * 用户可见的 Schema 属性。
 */
function readDynamicDependencyContextKey<TValues extends Values>(
  schema: SchemxDependencyField<TValues>
): string | undefined {
  const value = Reflect.get(schema, Symbol.for("schemx.dynamicDependencyContext"))

  return typeof value === "string" ? value : undefined
}

/**
 * 获取当前 schema/key 对应的稳定配置 token。
 *
 * @typeParam TValues - 表单值类型。
 * @param schema - 配置 token 所属的 Schema 引用。
 * @param key - 运行时节点的稳定 key。
 * @param compileCache - 当前 compiler 使用的 token 缓存。
 * @returns 当前 schema/key 对应的配置 token。
 */
function getConfigToken<TValues extends Values>(
  schema: SchemxField<TValues>,
  key: string,
  compileCache: CompileCache<TValues>
): symbol {
  const schemaEntries = compileCache.get(schema)

  const cached = schemaEntries?.get(key)

  if (cached) {
    return cached
  }

  const configToken = Symbol(key)

  const nextSchemaEntries = schemaEntries ?? new Map<string, symbol>()

  nextSchemaEntries.set(key, configToken)
  compileCache.set(schema, nextSchemaEntries)

  return configToken
}
