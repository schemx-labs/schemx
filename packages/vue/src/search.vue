<script setup lang="ts" generic="TValues extends Values = Values">
  import { computed, getCurrentInstance, ref, useSlots } from "vue"
  import type { Slot, Slots } from "vue"

  import { getFormCreator, getFormUi } from "./adapter/formCreators"
  import ActionButtons from "./components/Action/buttons.vue"
  import SchemaList from "./components/SchemaList"
  import SearchCollapse from "./components/SearchCollapse/index.vue"
  import { formComponentDefaults } from "./config/formComponentDefaults"
  import { useFormComponent, useScrollToField, useViewSchemas } from "./hooks"

  import type {
    SchemxFormAction,
    SchemxRowConfig,
    SchemxSearchCollapseSlotProps,
    SchemxSearchProps,
  } from "./types"
  import type { SchemxViewSchema, Values } from "@schemx/core"

  import "./styles/index.css"

  defineOptions({ name: "SchemxSearch", inheritAttrs: false })

  /**
   * 规范化表单组件的公开输入，并为未提供的可选项补充默认值。
   *
   * 具体字段语义由 `SchemxSearchProps<TValues>` 定义；其中 `modelValue`、
   * `schemas` 和 `form` 共同决定表单数据与实例来源。
   */
  const props = withDefaults(defineProps<SchemxSearchProps<TValues>>(), {
    modelValue: () => ({}) as TValues,
    initialValues: () => ({}) as TValues,
    ...formComponentDefaults,
    collapse: true,
  })

  /**
   * 同步表单值；折叠变更通过 collapse 配置中的回调通知。
   * 外部 modelValue 同步窗口内不回发模型更新。
   */
  const emit = defineEmits<{
    "update:modelValue": [value: TValues]
  }>()

  /**
   * 读取插槽，将操作区保留插槽与字段插槽分别下传。
   */
  const slots = useSlots()

  /**
   * 折叠触发器的插槽契约；字段与操作插槽仍沿用 Form 的透传方式。
   */
  defineSlots<{
    collapse?: Slot<SchemxSearchCollapseSlotProps>
    [name: string]: Slot | undefined
  }>()

  // 当前入口读取自己的创建器，同步建立实例及后代上下文。
  const ownerInstance = getCurrentInstance()

  // 绑定当前组件定义的实例创建器。
  const creator = ownerInstance === null ? undefined : getFormCreator(ownerInstance.type)

  // 搜索入口使用自身的 UI 作用域，避免同页其他适配包覆盖变量。
  const ui = ownerInstance === null ? undefined : getFormUi(ownerInstance.type)

  // 共享接入逻辑返回当前实例和合并后的展示配置。
  const { form, config } = useFormComponent<TValues>(
    props,
    // values 是 Core 同步出的完整业务模型。
    (values) => emit("update:modelValue", values),
    creator
  )

  // 搜索布局沿用表单的 Row 配置。
  const rowConfig = computed(
    () => config.value.schemaConfig?.row as SchemxRowConfig | undefined
  )

  // 查询文案通过已有 submitter.text 补充，不另设按钮文本参数。
  const submitter = computed<SchemxFormAction | undefined>(() => {
    // 保留显式关闭及调用方配置，包括 UI 包提供的 buttonProps。
    const action = config.value.submitter

    if (action === false || action === undefined) {
      return action
    }

    if (action === true) {
      return { text: "查询" }
    }

    return { ...action, text: action.text ?? "查询" }
  })

  /**
   * 在每次渲染时读取最新字段插槽，支持动态增删。
   */
  const getFieldSlots = (): Slots =>
    Object.fromEntries(
      Object.entries(slots).filter(
        // name 是业务插槽名。
        ([name]) => name !== "submitter" && name !== "resetter" && name !== "collapse"
      )
    )

  // 完整视图用于渲染和字段定位，折叠不裁剪列表。
  const viewSchemas = useViewSchemas(form)

  // Core 不可见节点不参与 DOM 测量。
  const visibleSchemas = computed(() =>
    viewSchemas.value.filter(
      // schema 是 Core 当前投影的根级节点。
      (schema) => schema.visible !== false
    )
  )

  // 折叠组件独立管理展示，Search 只接入字段定位前的展开方法。
  const collapseRef = ref<InstanceType<typeof SearchCollapse>>()

  /**
   * 将字段定位请求交给折叠容器；受控调用方拒绝展开时返回 false。
   */
  const prepareFieldForScroll = (): Promise<boolean> =>
    collapseRef.value?.prepareFieldForScroll() ?? Promise.resolve(false)

  // 定位前先展开搜索区，滚动注册表同步提供给全部字段后代。
  useScrollToField({
    form,
    viewSchemas,
    prepareField: prepareFieldForScroll,
  })

  defineExpose(form)
</script>

<template>
  <SearchCollapse
    v-bind="$attrs"
    ref="collapseRef"
    :class="['schemx', props.class]"
    :style="props.style"
    :data-schemx-ui="ui"
    :collapse="props.collapse"
  >
    <SchemaList
      :schemas="visibleSchemas as readonly SchemxViewSchema[]"
      :view-schemas="visibleSchemas as readonly SchemxViewSchema[]"
      :row-config="rowConfig"
      :field-slots="getFieldSlots()"
    />
    <template #actions>
      <ActionButtons
        class="schemx-search-buttons"
        :form="form"
        :loading="props.loading"
        :submitter="submitter"
        :resetter="config.resetter"
      >
        <template v-if="slots.submitter" #submitter="slotProps">
          <component :is="slots.submitter" v-bind="slotProps" />
        </template>
        <template v-if="slots.resetter" #resetter="slotProps">
          <component :is="slots.resetter" v-bind="slotProps" />
        </template>
      </ActionButtons>
    </template>
    <template v-if="slots.collapse" #collapse="slotProps">
      <component :is="slots.collapse" v-bind="slotProps" />
    </template>
  </SearchCollapse>
</template>

<style scoped>
  .schemx-search-buttons {
    flex-wrap: wrap;
    max-width: 100%;
    padding: 0;
    min-height: var(--schemx-control-height);
  }
</style>
