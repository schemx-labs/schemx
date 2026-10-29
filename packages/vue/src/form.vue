<!--
  schemx - 主组件

  基于 Schema 配置的表单组件，使用 useForm Hook 管理状态。

  @module schemx
-->

<script lang="ts" setup generic="TValues extends Values = Values">
  import { computed, getCurrentInstance, useSlots } from "vue"

  import { getFormCreator } from "./adapter"
  import Action from "./components/Action"
  import Row from "./components/Row"
  import SchemaList from "./components/SchemaList"
  import { useFormComponent, useScrollToField, useViewSchemas } from "./hooks"
  import { getSectionPosition } from "./utils"

  import type { SchemxFormProps, SchemxInstance, SchemxRowConfig } from "./types"
  import type { SchemxViewSchema, Values } from "@schemx/core"

  import "./styles/index.css"

  defineOptions({ name: "SchemxForm" })

  /**
   * 规范化表单组件的公开输入，并为未提供的可选项补充默认值。
   *
   * 具体字段语义由 `SchemxFormProps<TValues>` 定义；其中 `modelValue`、
   * `schemas` 和 `form` 共同决定表单数据与实例来源。
   */
  const props = withDefaults(defineProps<SchemxFormProps<TValues>>(), {
    modelValue: () => ({}) as TValues,
    initialValues: () => ({}) as TValues,
    form: undefined,
    schemas: () => [],
    class: "",
    style: () => ({}),
    onFinish: undefined,
    onFinishFailed: undefined,
    onReset: undefined,
    onLoadingChange: undefined,
    onValuesChange: undefined,
    onFieldsChange: undefined,
    loading: undefined,
    actionCol: undefined,
    submitter: undefined,
    resetter: undefined,
    rendererProps: undefined,
    rendererRegistry: undefined,
    presetRuleRegistry: undefined,
    fieldRules: undefined,
    debug: undefined,
    schedulerOptions: undefined,
    validationConcurrency: undefined,
    visible: undefined,
    validationTrigger: undefined,
    readonly: undefined,
    required: undefined,
    disabled: undefined,
    colon: undefined,
    showRequiredMark: undefined,
    bordered: undefined,
    col: undefined,
    colComponent: undefined,
    buttonComponent: undefined,
    iconComponent: undefined,
    row: undefined,
    rowComponent: undefined,
  })

  /**
   * 定义表单 v-model 的同步事件。
   *
   * 仅在内部表单值变化且不是外部 `modelValue` 同步窗口时发出更新。
   */
  const emit = defineEmits<{
    "update:modelValue": [value: TValues]
  }>()

  /**
   * 读取插槽，将操作区保留插槽与字段插槽分别下传。
   */
  const slots = useSlots()

  // 创建器仅与当前组件定义关联。
  const owner = getCurrentInstance()

  const { form: formInstance, config: effectiveConfig } = useFormComponent<TValues>(
    props,
    (values) => emit("update:modelValue", values),
    owner === null ? undefined : getFormCreator(owner.type)
  )

  const resolvedRowConfig = computed(
    () => effectiveConfig.value.schemaConfig?.row as SchemxRowConfig | undefined
  )

  /**
   * Form 根节点的 class 来源：组件内部标识与调用方自定义 class。
   */
  const formRootClass = computed(() => ["schemx", props.class])

  /**
   * Form 根节点的 style 来源；保留 Vue StyleValue 的对象/数组合并能力。
   */
  const formRootStyle = computed(() => props.style)

  /**
   * 操作区保留插槽不能下传给字段，避免与同名字段插槽冲突。
   */
  const fieldSlots = computed(() =>
    Object.fromEntries(
      Object.entries(slots).filter(
        ([slotName]) => slotName !== "submitter" && slotName !== "resetter"
      )
    )
  )

  // 当前 Form 的响应式 ViewSchema 列表。
  const viewSchemas = useViewSchemas(formInstance)

  useScrollToField({ form: formInstance, viewSchemas })

  /**
   * 根据 ViewSchema 在当前列表中的位置生成首尾样式类。
   *
   * @param schema - 当前需要计算样式的 ViewSchema。
   * @returns 用于包裹元素的首尾位置 class 映射。
   */
  const getFieldClass = (schema: SchemxViewSchema) => {
    const { isFirst, isLast } = getSectionPosition(
      viewSchemas.value as SchemxViewSchema[],
      schema.key
    )

    return {
      "schemx-field-wrapper--first": isFirst,
      "schemx-field-wrapper--last": isLast,
    }
  }

  /**
   * 暴露当前表单 Instance 的完整控制 API，供模板 ref 调用。
   */
  defineExpose<SchemxInstance<TValues>>({ ...formInstance })
</script>

<template>
  <div :class="formRootClass" :style="formRootStyle">
    <Row :row="resolvedRowConfig" class="schemx-schema-list">
      <SchemaList
        :schemas="viewSchemas as SchemxViewSchema[]"
        :view-schemas="viewSchemas as SchemxViewSchema[]"
        :row-enabled="false"
        :row-config="resolvedRowConfig"
        :field-class-resolver="getFieldClass"
      >
        <template v-for="(_, slotName) in fieldSlots" #[slotName]="slotProps">
          <slot :name="slotName" v-bind="slotProps ?? {}" />
        </template>
      </SchemaList>

      <Action
        :form="formInstance"
        :action-col="effectiveConfig?.actionCol"
        :loading="props.loading"
        :submitter="effectiveConfig.submitter"
        :resetter="effectiveConfig.resetter"
      >
        <template v-if="slots.resetter" #resetter="slotProps">
          <slot name="resetter" v-bind="slotProps" />
        </template>
        <template v-if="slots.submitter" #submitter="slotProps">
          <slot name="submitter" v-bind="slotProps" />
        </template>
      </Action>
    </Row>
  </div>
</template>
