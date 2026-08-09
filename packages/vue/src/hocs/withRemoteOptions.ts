/**
 * WithRemoteOptions - 选项高阶组件
 *
 * 包装任意渲染器组件，自动注入 useDictionary 的选项加载能力。
 * 被包装组件会额外收到 options、loading 两个 props，
 * 无需自行调用 useDictionary。
 *
 * @module hocs/withRemoteOptions
 */

import { Component, computed, defineComponent, h, PropType, SetupContext } from "vue"

import type { SchemxDictionary } from "@/types/dictionary"

import { useFieldContext } from "../hooks/provideFieldContext"
import { useDictionary } from "../hooks/useDictionary"


/**
 * WithRemoteOptions 注入给被包装组件的额外 Props
 */
export interface RemoteOptionsInjectedProps {
  /** 加载的选项列表 */
  options: unknown[]
  /** 加载状态 */
  loading: boolean
}

type SchemxDictionaryInput = SchemxDictionary | SchemxDictionary["api"]

/**
 * 将 api 简写规范化为完整的字典配置。
 */
function normalizeDictionary(
  dictionary: SchemxDictionaryInput | undefined
): SchemxDictionary | undefined {
  if (typeof dictionary === "function") {
    return { api: dictionary }
  }

  return dictionary
}

/**
 * 选项高阶组件
 *
 * 包装一个渲染器组件，当 dict prop 存在时，
 * 调用 useDictionary 加载选项，并将结果作为 options prop 注入。
 *
 * 当组件自身已传入非空 options 且无 dict 时，优先使用静态 options。
 *
 * @param WrappedComponent - 被包装的渲染器组件
 * @returns 增强后的组件，自动具备选项加载能力
 *
 * @example
 * ```ts
 * import { WithRemoteOptions } from '@schemx/vue'
 * import MySelect from './MySelect.vue'
 *
 * const RemoteSelect = WithRemoteOptions(MySelect)
 *
 * // 在 schema 中使用
 * const schema = {
 *   name: 'city',
 *   label: '城市',
 *   componentType: 'select',
 *   componentProps: {
 *     dict: {
 *       api: async (values) => fetchCities(values.province),
 *       dependsOn: ['province'],
 *       shouldFetch: (values) => !!values.province,
 *       resetOnDepsChange: true,
 *       immediate: false,
 *     },
 *   },
 * }
 * ```
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

      // 内嵌于 FormItem 时自动从字段 Context 获取目标字段；显式 fieldName
      // 保留给脱离 FormItem 的独立使用场景。
      const fieldName = dictionary ? useFieldContext().name : undefined

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
