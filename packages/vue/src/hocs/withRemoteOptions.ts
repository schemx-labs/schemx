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

import { useDictionary } from "../hooks/useDictionary"

import type { NamePath, SchemxDictionary } from "@schemx/core"

export type { SchemxDictionary, SchemxWithDictionary } from "@schemx/core"

/**
 * WithRemoteOptions 注入给被包装组件的额外 Props
 */
export interface RemoteOptionsInjectedProps {
  /** 加载的选项列表 */
  options: any[]
  /** 加载状态 */
  loading: boolean
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
export function WithRemoteOptions(WrappedComponent: Component) {
  return defineComponent({
    name: `WithRemoteOptions(${WrappedComponent.name || "Anonymous"})`,
    inheritAttrs: false,
    props: {
      dict: {
        type: Object as PropType<SchemxDictionary>,
        default: undefined,
      },
      fieldName: {
        type: [String, Array] as PropType<NamePath>,
        default: undefined,
      },
    },
    setup(props, { attrs, slots }: SetupContext) {
      // 仅在 dict 配置存在时调用 useDictionary
      const dictResult = props.dict ? useDictionary(props.dict, props.fieldName) : null

      const childrenProps = computed(() => {
        return {
          ...attrs,
          dict: props.dict,
          options: props.dict ? dictResult?.list.value : attrs.options,
          loading: props.dict ? dictResult?.loading.value : attrs.loading,
        }
      })

      return () => h(WrappedComponent, childrenProps.value, slots)
    },
  })
}

export default WithRemoteOptions
