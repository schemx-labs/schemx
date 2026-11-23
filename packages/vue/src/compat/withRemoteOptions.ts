/**
 * WithRemoteOptions - 选项高阶组件（历史兼容）。
 *
 * 包装任意渲染器组件，自动注入 `useDictionary` 的选项加载能力。
 * 已被 Core 的字段级 `dict` 配置取代，此处仅保留旧行为，不再演进。
 *
 * @module compat/withRemoteOptions
 * @deprecated 请改用字段顶层的 `dict` 配置（由 `@schemx/core` 提供）。
 */

import { Component, computed, defineComponent, h, PropType, SetupContext } from "vue"

import { useFieldContext } from "../context"

import { useDictionary } from "./dictionary"

import type { SchemxDictionary } from "@schemx/core"

/**
 * WithRemoteOptions 注入给被包装组件的额外 Props。
 *
 * @deprecated 请改用字段级 `dict` 配置。
 */
export interface RemoteOptionsInjectedProps {
  /** 加载的选项列表 */
  options: unknown[]
  /** 加载状态 */
  loading: boolean
}

type SchemxDictionaryInput = SchemxDictionary | SchemxDictionary["api"]

function normalizeDictionary(
  dictionary: SchemxDictionaryInput | undefined
): SchemxDictionary | undefined {
  if (typeof dictionary === "function") {
    return { api: dictionary }
  }

  return dictionary
}

/**
 * 选项高阶组件（历史兼容）。
 *
 * @deprecated 请改用字段级 `dict` 配置。
 */
export function WithRemoteOptions(WrappedComponent: Component): Component {
  return defineComponent({
    name: `WithRemoteOptions(${WrappedComponent.name || "Anonymous"})`,
    inheritAttrs: false,
    props: {
      dict: {
        type: [Object, Function] as PropType<SchemxDictionaryInput>,
        default: undefined,
      },
    },
    setup(props, { attrs, slots }: SetupContext) {
      const dictionary = normalizeDictionary(props.dict)

      const fieldName = dictionary
        ? ((attrs.fieldName as string | undefined) ?? useFieldContext().name)
        : undefined

      const dictResult = dictionary ? useDictionary(dictionary, fieldName) : null

      const childrenProps = computed(() => {
        return {
          ...attrs,
          dict: dictionary,
          options: dictionary ? dictResult?.list.value : attrs.options,
          loading: dictionary ? dictResult?.loading.value : attrs.loading,
        }
      })

      return () => h(WrappedComponent, childrenProps.value, slots)
    },
  })
}

export default WithRemoteOptions
