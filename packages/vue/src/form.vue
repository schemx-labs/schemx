<script setup lang="ts" generic="TValues extends Values = Values">
  import { computed, getCurrentInstance, useSlots } from "vue"
  import type { Slots } from "vue"

  import { getFormCreator, getFormUi } from "./adapter/formCreators"
  import Action from "./components/Action"
  import SchemaList from "./components/SchemaList"
  import { formComponentDefaults } from "./config/formComponentDefaults"
  import { useFormComponent, useScrollToField, useViewSchemas } from "./hooks"

  import type { SchemxFormProps, SchemxRowConfig } from "./types"
  import type { SchemxViewSchema, Values } from "@schemx/core"

  import "./styles/index.css"

  defineOptions({ name: "SchemxForm", inheritAttrs: false })

  // Form 保留省略 schemas 时使用空数组的既有行为。
  const props = withDefaults(defineProps<SchemxFormProps<TValues>>(), {
    ...formComponentDefaults,
    modelValue: () => ({}) as TValues,
    initialValues: () => ({}) as TValues,
    schemas: () => [],
    actionCol: undefined,
  })

  // 将共享接入逻辑产生的模型快照发送给消费端。
  const emit = defineEmits<{ "update:modelValue": [value: TValues] }>()

  // 创建器只从当前公开组件定义读取，保持工厂隔离。
  const owner = getCurrentInstance()

  // 绑定当前组件定义的实例创建器。
  const creator = owner === null ? undefined : getFormCreator(owner.type)

  // 入口自己的适配标识，与创建器一起绑定，不借用祖先表单的 UI。
  const ui = owner === null ? undefined : getFormUi(owner.type)

  // 当前入口持有唯一实例、配置及同步生命周期。
  const { form, config } = useFormComponent<TValues>(
    props,
    // values 是 Core 同步出的完整业务模型。
    (values) => emit("update:modelValue", values),
    creator
  )

  // 普通表单渲染和字段定位共用完整视图。
  const viewSchemas = useViewSchemas(form)

  // 根级字段沿用合并后的 Row 配置。
  const rowConfig = computed(
    () => config.value.schemaConfig?.row as SchemxRowConfig | undefined
  )

  // 将按钮插槽留在公开入口，只把字段插槽交给 SchemaList。
  const slots = useSlots()

  /**
   * 在每次渲染时读取最新字段插槽，支持动态增删。
   */
  const getFieldSlots = (): Slots =>
    Object.fromEntries(
      Object.entries(slots).filter(
        // name 是消费端提供的插槽名。
        ([name]) => name !== "submitter" && name !== "resetter"
      )
    )

  useScrollToField({ form, viewSchemas })
  defineExpose(form)
</script>

<template>
  <div
    v-bind="$attrs"
    :class="['schemx', props.class]"
    :style="props.style"
    :data-schemx-ui="ui"
  >
    <SchemaList
      :schemas="viewSchemas as readonly SchemxViewSchema[]"
      :view-schemas="viewSchemas as readonly SchemxViewSchema[]"
      :row-config="rowConfig"
      :field-slots="getFieldSlots()"
    >
      <Action
        :form="form"
        :loading="props.loading"
        :submitter="config.submitter"
        :resetter="config.resetter"
        :action-col="props.actionCol"
      >
        <template v-if="slots.submitter" #submitter="slotProps">
          <component :is="slots.submitter" v-bind="slotProps" />
        </template>
        <template v-if="slots.resetter" #resetter="slotProps">
          <component :is="slots.resetter" v-bind="slotProps" />
        </template>
      </Action>
    </SchemaList>
  </div>
</template>
