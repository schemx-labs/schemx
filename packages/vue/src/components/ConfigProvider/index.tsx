/**
 * ConfigProvider - Vue 组件树级默认配置。
 *
 * 不渲染额外 DOM，只为后代 Form 提供 SchemxConfig。
 *
 * @module components/ConfigProvider
 */

import { computed, defineComponent, type PropType } from "vue"

import { provideSchemxConfigProvider } from "../../config"

import type {
  PresetRuleRegistry,
  RendererRegistry,
  SchemxConfig,
  SchemxRendererKey,
  SchemxRendererPropsMap,
  SchemxSchemaConfig,
  ValidationAdapterOption,
  Values,
} from "@schemx/core"

/** ConfigProvider 的公开 Props。 */
export type ConfigProviderProps<TValues extends Values = Values> = SchemxConfig<TValues>

const ConfigProvider = defineComponent({
  name: "SchemxConfigProvider",
  inheritAttrs: false,

  props: {
    schemaConfig: {
      type: Object as PropType<Partial<SchemxSchemaConfig>>,
      default: undefined,
    },
    rendererProps: {
      type: Object as PropType<SchemxRendererPropsMap>,
      default: undefined,
    },
    validatorAdapters: {
      type: Array as PropType<readonly ValidationAdapterOption[]>,
      default: undefined,
    },
    defaultRendererType: {
      type: String as PropType<SchemxRendererKey>,
      default: undefined,
    },
    rendererRegistry: {
      type: Object as PropType<RendererRegistry>,
      default: undefined,
    },
    presetRuleRegistry: {
      type: Object as PropType<PresetRuleRegistry>,
      default: undefined,
    },
  },

  setup(props, { slots }) {
    const config = computed<SchemxConfig>(() => ({
      schemaConfig: props.schemaConfig,
      rendererProps: props.rendererProps,
      validatorAdapters: props.validatorAdapters,
      defaultRendererType: props.defaultRendererType,
      rendererRegistry: props.rendererRegistry,
      presetRuleRegistry: props.presetRuleRegistry,
    }))

    provideSchemxConfigProvider(config)

    return () => slots.default?.()
  },
})

export default ConfigProvider
