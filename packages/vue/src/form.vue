<!--
  schemx - 主组件

  基于 Schema 配置的表单组件，使用 useForm Hook 管理状态。

  @module schemx
-->

<script lang="ts" setup generic="T extends Values = Values">
  import { watch, watchEffect } from "vue"

  import { omit } from "es-toolkit"

  import FormItem from "./components/FormItem"
  import { createContext } from "./hooks/useContext"
  import { useForm } from "./hooks/useForm"
  import { useViewSchemas } from "./hooks/useViewSchemas"

  import type { SchemxFormProps } from "./types/index"
  import type { SchemxViewSchema, Values } from "@schemx/core"

  import "./styles/index.css"
  import { getSectionPosition } from "./utils/helpers"

  defineOptions({ name: "SchemxForm" })

  const props = withDefaults(defineProps<SchemxFormProps<T>>(), {
    modelValue: () => ({}) as T,
    initialValues: () => ({}) as T,
    form: undefined,
    schemas: () => [],
    class: "",
    style: () => ({}),
    onFinish: undefined,
    onFinishFailed: undefined,
    onValuesChange: undefined,
    onFieldsChange: undefined,
    rendererRegistry: undefined,
    validatorRegistry: undefined,
  })

  const emit = defineEmits<{
    "update:modelValue": [value: T]
  }>()

  /**
   * 创建 FormContext 上下文
   *
   * 为子组件提供表单配置信息。
   */
  createContext(
    omit(props, [
      "form",
      "modelValue",
      "rendererRegistry",
      "defaultRendererType",
      "validatorRegistry",
      "onFinish",
      "onFinishFailed",
      "onValuesChange",
      "onFieldsChange",
    ])
  )

  /**
   * 获取或创建表单实例
   *
   * 优先使用外部传入的 form，否则内部通过 useForm 创建。
   * 必须在 setup 同步阶段调用，确保 provide 正确注入。
   */
  const form = props.form
    ? props.form
    : useForm<T>({
        schemas: props.schemas,
        initialValues: props.initialValues,
        rendererRegistry: props.rendererRegistry,
        defaultRendererType: props.defaultRendererType,
        validatorRegistry: props.validatorRegistry,

        readonly: props.readonly,
        disabled: props.disabled,

        onFinish: async (values) => {
          props.onFinish?.(values)
        },
        onFinishFailed: async (errors) => {
          props.onFinishFailed?.(errors)
        },
        onValuesChange: (changedValues, latestSnapshot) => {
          emit("update:modelValue", latestSnapshot as T)
          props.onValuesChange?.(changedValues, latestSnapshot)
        },
        onFieldsChange: (changedPaths, allPaths) => {
          props.onFieldsChange?.(changedPaths, allPaths)
        },
      })

  watch(
    () => props.schemas,
    (schemas) => {
      form.setSchemas(schemas)
    },
    { deep: false, immediate: !!props.form }
  )

  const viewSchemas = useViewSchemas(form)

  const getFormItemClass = (schema: SchemxViewSchema<T>) => {
    const { isFirst, isLast } = getSectionPosition(
      viewSchemas.value as SchemxViewSchema[],
      schema.key
    )

    return {
      "schemx-item-wrapper--first": isFirst,
      "schemx-item-wrapper--last": isLast,
    }
  }

  watchEffect(() => {
    form.updateDefaultProps(props)
  })

  defineExpose({
    ...form,
  })
</script>

<template>
  <div :class="['schemx', props.class]">
    <FormItem
      v-for="schema in viewSchemas"
      :key="schema.key"
      :schema="schema as SchemxViewSchema"
      :class="getFormItemClass(schema as SchemxViewSchema<T>)"
    >
      <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
        <slot :name="slotName" v-bind="slotProps ?? {}" />
      </template>
    </FormItem>
  </div>
</template>
