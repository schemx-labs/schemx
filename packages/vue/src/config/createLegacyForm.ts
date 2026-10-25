import { createForm, mergeConfig } from "@schemx/core"

import { presetRuleRegistry, rendererRegistry } from "../utils"

import { defaultConfig } from "./index"

import type { CreateFormOptions, SchemxInstance, Values } from "@schemx/core"

/**
 * 为旧 Vue 创建入口补齐展示与全局 Registry 默认值，再由 Core 继承全局基线。
 * 独立工厂不经过此入口，避免意外共享兼容 Registry。
 * @typeParam TValues - 本次表单值类型。
 * @param options - 当前 Form 与 App/Provider 已合并的局部创建选项。
 * @example const form = createLegacyForm({ initialValues: { name: "" } })
 */
export function createLegacyForm<TValues extends Values>(
  options: CreateFormOptions<TValues> = {}
): SchemxInstance<TValues> {
  // 合并只处理共享配置；实例数据和回调继续通过原始选项传入。
  const config = mergeConfig<TValues>(options, {
    schemaConfig: defaultConfig,
    rendererRegistry,
    presetRuleRegistry,
  })

  return createForm({ ...options, ...config })
}
