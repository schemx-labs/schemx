<!--
  schemx - 主组件

  基于 Schema 配置的表单组件，使用 useForm Hook 管理状态。

  @module schemx
-->

<script lang="ts" setup generic="TValues extends Values = Values">
  import { onUnmounted, reactive, watch } from "vue"

  import { createWatch, defaultSchemxConfigKeys, isSchemxSchemas } from "@schemx/core"
  import { pick } from "es-toolkit"

  import FormItem from "./components/FormItem"
  import {
    createFormConfigContext,
    createFormContext,
    useForm,
    useViewSchemas,
  } from "./hooks"
  import { getSectionPosition } from "./utils/helpers"

  import type { SchemxFormProps } from "./types/index"
  import type { SchemxSchemaConfig, SchemxViewSchema, Values } from "@schemx/core"

  import "./styles/index.css"

  defineOptions({ name: "SchemxForm" })

  const props = withDefaults(defineProps<SchemxFormProps<TValues>>(), {
    modelValue: () => ({}) as TValues,
    initialValues: () => ({}) as TValues,
    form: undefined,
    schemas: () => [],
    class: "",
    style: () => ({}),
    onFinish: undefined,
    onFinishFailed: undefined,
    onValuesChange: undefined,
    onFieldsChange: undefined,
    rendererRegistry: undefined,
    validationRuleRegistry: undefined,
    visible: true,
  })

  const emit = defineEmits<{
    "update:modelValue": [value: TValues]
  }>()

  const pickSchemaConfig = (): Partial<SchemxSchemaConfig> => {
    // Vue 保留 `required` 对当前 TValues 的泛型约束；Core 的表单级配置使用
    // unknown 表示任意字段值。运行时该回调只会接收当前 Form 的字段值，因此在
    // Vue 到 Core 的适配边界收窄为 Core 配置类型。
    return pick(props, defaultSchemxConfigKeys) as Partial<SchemxSchemaConfig>
  }

  const formSchemaConfig = reactive<Partial<SchemxSchemaConfig>>(pickSchemaConfig())

  /**
   * 创建 FormContext 上下文
   *
   * 为子组件提供表单配置信息。
   */
  createFormConfigContext({ schemaConfig: formSchemaConfig })

  /**
   * 获取或创建表单实例
   *
   * 优先使用外部传入的 form，否则内部通过 useForm 创建。
   * 必须在 setup 同步阶段调用，确保 provide 正确注入。
   */
  const form = props.form
    ? props.form
    : useForm<TValues>({
        schemas: props.schemas,
        schemaConfig: pickSchemaConfig(),
        initialValues:
          Object.keys(props.modelValue).length > 0
            ? props.modelValue
            : props.initialValues,

        rendererRegistry: props.rendererRegistry,
        defaultRendererType: props.defaultRendererType,
        validationRuleRegistry: props.validationRuleRegistry,
        validatorAdapters: props.validatorAdapters,

        onFinish: async (values) => {
          props.onFinish?.(values)
        },
        onFinishFailed: async (errors) => {
          props.onFinishFailed?.(errors)
        },
        onValuesChange: (changedValues, latestSnapshot) => {
          props.onValuesChange?.(changedValues, latestSnapshot)
        },
        onFieldsChange: (changedPaths, allPaths) => {
          props.onFieldsChange?.(changedPaths, allPaths)
        },
      })

  const isExternalForm = props.form !== undefined

  /**
   * 注册表单上下文。
   *
   * 无论实例来自 props.form 还是 useForm，都必须同步注册，
   * 从而保证 FormItem、useField 等后代逻辑能够获取同一个实例。
   */
  createFormContext(form)

  let syncingFromModel = false

  watch(
    () => props.modelValue,
    (values) => {
      syncingFromModel = true
      form.setFieldsValue(values)
      syncingFromModel = false
    }
  )

  const disposeWatch = createWatch(form, (latestSnapshot) => {
    if (syncingFromModel) return

    emit("update:modelValue", latestSnapshot)
  })

  onUnmounted(disposeWatch)

  watch(
    () => props.schemas,
    (schemas) => {
      if (!isSchemxSchemas(schemas)) {
        form.setSchemas(schemas)
      }
    },
    { deep: false, immediate: !!props.form }
  )

  const viewSchemas = useViewSchemas(form)

  const getFormItemClass = (schema: SchemxViewSchema<TValues>) => {
    const { isFirst, isLast } = getSectionPosition(
      viewSchemas.value as SchemxViewSchema[],
      schema.key
    )

    return {
      "schemx-item-wrapper--first": isFirst,
      "schemx-item-wrapper--last": isLast,
    }
  }

  watch(
    pickSchemaConfig,
    (nextSchemaConfig) => {
      console.log(" > ~ nextSchemaConfig:", nextSchemaConfig)

      Object.assign(formSchemaConfig, nextSchemaConfig)
      form.updateSchemaConfig(nextSchemaConfig)
    },
    { deep: false, immediate: isExternalForm }
  )

  defineExpose({
    ...form,
  })
</script>

<template>
  <div :class="['schemx', props.class]" :style="props.style">
    <FormItem
      v-for="schema in viewSchemas"
      :key="schema.key"
      :schema="schema as SchemxViewSchema"
      :class="getFormItemClass(schema as SchemxViewSchema<TValues>)"
    >
      <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
        <slot :name="slotName" v-bind="slotProps ?? {}" />
      </template>
    </FormItem>
  </div>
</template>
