import type { RendererRegistry } from "../registry"
import type { SchemxInstance, Values } from "../types"

/**
 * Renderer 注册表的公开操作。
 * @typeParam TValues - 表单值类型。
 */
export type FormRendererApi<TValues extends Values> = Pick<
  SchemxInstance<TValues>,
  "getRenderer" | "getRendererEntry" | "registerRenderer" | "hasRenderer"
>

/**
 * Renderer 域不拥有共享注册表。
 * @typeParam TValues - 表单值类型。
 */
export interface FormRenderer<TValues extends Values> {
  /**
   * 保持 Registry 接收者绑定的转发入口。
   */
  readonly api: FormRendererApi<TValues>
}

/**
 * 绑定当前 Form 使用的 Renderer 注册表。
 * @typeParam TValues - 表单值类型。
 * @param rendererRegistry - 当前生效的共享注册表。
 * @example const renderer = createFormRenderer<FormValues>(rendererRegistry)
 */
export function createFormRenderer<TValues extends Values>(
  rendererRegistry: RendererRegistry
): FormRenderer<TValues> {
  // 共享 Registry 擦除了表单值与 Renderer 键的泛型；仅在此恢复公开读取契约。
  const getRendererEntry = rendererRegistry.resolveEntry.bind(
    rendererRegistry
  ) as SchemxInstance<TValues>["getRendererEntry"]

  // unknown 已包含描述符，注册操作统一委托 Registry。
  const registerRenderer: SchemxInstance<TValues>["registerRenderer"] = (
    type,
    renderer,
    registryOptions
  ) => {
    rendererRegistry.register(type, renderer, registryOptions)
  }

  // 显式选择注册表能力，避免暴露注册表资源对象。
  const api: FormRendererApi<TValues> = {
    getRenderer: rendererRegistry.resolve.bind(rendererRegistry),
    getRendererEntry,
    registerRenderer,
    hasRenderer: rendererRegistry.has.bind(rendererRegistry),
  }

  return { api }
}
