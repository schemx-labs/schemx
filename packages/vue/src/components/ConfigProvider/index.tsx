/**
 * ConfigProvider - Vue 组件树级默认配置。
 *
 * 不渲染额外 DOM，只为后代 Form 提供 Vue 层配置。
 *
 * @module components/ConfigProvider
 */

import { computed, defineComponent, type PropType } from "vue"

import { provideConfigProviderContext } from "../../context/configProviderContext"

import type {
  SchemxColComponent,
  SchemxIconComponent,
  SchemxRowComponent,
} from "../../types"
import type { CreateSchemxOptions } from "@schemx/core"
import type {
  PresetRuleRegistry,
  RendererRegistry,
  SchedulerOptions,
  SchemxRendererKey,
  SchemxRendererPropsMap,
  ValidationAdapterOption,
  Values,
} from "@schemx/core"

/**
 * ConfigProvider 的公开 Props。
 *
 * 配置会按组件树继承；子级 Provider 的非空配置覆盖父级同名配置。
 *
 * @typeParam TValues - 表单值类型。
 */
export type ConfigProviderProps<TValues extends Values = Values> =
  CreateSchemxOptions<TValues>

const ConfigProvider = defineComponent({
  name: "SchemxConfigProvider",
  inheritAttrs: false,

  props: {
    debug: { type: Boolean, default: undefined },
    schedulerOptions: { type: Object as PropType<SchedulerOptions>, default: undefined },
    validationConcurrency: { type: Number, default: undefined },
    schemaConfig: {
      type: Object as PropType<CreateSchemxOptions["schemaConfig"]>,
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
    colComponent: {
      type: [Object, Function] as PropType<SchemxColComponent>,
      default: undefined,
    },
    rowComponent: {
      type: [Object, Function] as PropType<SchemxRowComponent>,
      default: undefined,
    },
    iconComponent: {
      type: [Object, Function] as PropType<SchemxIconComponent>,
      default: undefined,
    },
  },

  /**
   * 合并 Props 与 fallthrough attrs，并向后代提供配置上下文。
   *
   * @param props - 当前 ConfigProvider 的 Schemx 配置。
   * @param setupContext - 父级传入的默认插槽与额外配置属性。
   */
  setup(props, setupContext) {
    const { slots, attrs } = setupContext

    const config = computed<CreateSchemxOptions>(() => ({
      ...props,
      ...attrs,
    }))

    provideConfigProviderContext(config)

    return () => slots.default?.()
  },
})

export default ConfigProvider
