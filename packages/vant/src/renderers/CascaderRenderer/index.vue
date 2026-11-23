<template>
  <div :class="['schemx-renderer', 'schemx-cascader-renderer', props.className]">
    <SchemxCell
      :value="fieldValue"
      :placeholder="placeholder"
      :readonly-placeholder="props.readonlyPlaceholder"
      :readonly="props.readonly"
      :disabled="props.disabled"
      @click="handleClick"
    />

    <Popup
      v-if="!props.readonly && !props.disabled"
      v-model:show="showCascader"
      :class="classNames('schemx-cascader-popup-renderer', props.popupClassName)"
      v-bind="popupProps"
      safe-area-inset-bottom
    >
      <Cascader
        v-bind="cascaderProps"
        :model-value="cascaderValue"
        @finish="handleConfirm"
        @close="handleClose"
      />
    </Popup>
  </div>
</template>

<script setup lang="ts">
  /**
   * 级联选择器渲染器组件
   *
   * 使用 Vant Cascader + Popup + Cell 组合实现。
   * 通过 popupProps 透传 Popup 原生属性与事件，避免命名冲突。
   *
   * @module renderers/CascaderRenderer
   */
  import { computed, ref, useAttrs } from "vue"

  import { Cascader, Popup } from "vant"
  import type { PopupProps } from "vant"

  import classNames from "classnames"
  import { omitBy } from "es-toolkit"

  import SchemxCell from "@/components/Cell/index.vue"
  import { findTreeItem } from "@/utils"

  import type { CascaderFieldNames, CascaderRendererProps, CascaderValue } from "./types"

  import "./index.scss"

  defineOptions({
    name: "CascaderRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<CascaderRendererProps>(), {
    value: () => [],
    onConfirm: undefined,
    className: "",
    showAllLevels: true,
    emitPath: true,
    fieldNames: () => ({ text: "label", value: "value", children: "children" }),
    separator: " - ",
    placeholder: undefined,
    readonlyPlaceholder: "-",
    readonly: false,
    disabled: false,
    onChange: undefined,
    options: () => [],
    title: undefined,
    popupProps: () => ({}) as PopupProps,
    popupClassName: "",
  })

  const attrs = useAttrs()

  const cascaderModel = defineModel<CascaderValue>("value")

  const showCascader = ref(false)

  // ==================== 计算属性 ====================

  const placeholder = computed(() => props.placeholder || "请选择")

  const fieldNames = computed<CascaderFieldNames>(() => props.fieldNames)
  const title = computed(() => props.title ?? placeholder.value)

  const cascaderProps = computed(() => {
    const {
      value: _value,
      onChange: _onChange,
      onConfirm: _onConfirm,
      className: _className,
      readonlyPlaceholder: _readonlyPlaceholder,
      showAllLevels: _showAllLevels,
      emitPath: _emitPath,
      separator: _separator,
      contentAlign: _contentAlign,
      placeholder: _placeholder,
      formItemProps: _formItemProps,
      popupProps: _popupProps,
      title: _title,
      ...rest
    } = props

    return { ...attrs, ...rest, placeholder: placeholder.value, title: title.value }
  })

  /** 数据源：优先使用 props.options，回退到 attrs.columns */
  const columns = computed(() => {
    if (Array.isArray(props.options) && props.options.length > 0) {
      return props.options
    }

    return []
  })

  /**
   * 级联选择器内部值
   *
   * Vant Cascader 仅接受叶子节点值，取路径最后一项。
   */
  const cascaderValue = computed(() => {
    if (!Array.isArray(cascaderModel.value) || cascaderModel.value.length === 0) {
      return undefined
    }

    return cascaderModel.value[cascaderModel.value.length - 1]
  })

  /**
   * Cell 展示文本
   *
   * 通过 findTreeItem 将 value 路径反向映射为 label 路径，
   * 支持 showAllLevels 控制显示全部层级或仅末级。
   */
  const fieldValue = computed(() => {
    const targetValue = Array.isArray(cascaderModel.value)
      ? cascaderModel.value[cascaderModel.value.length - 1]
      : cascaderModel.value

    const result = findTreeItem(columns.value, targetValue, {
      labelKey: fieldNames.value.text,
      valueKey: fieldNames.value.value,
      childrenKey: fieldNames.value.children,
    })

    if (!result.labels.length) return ""

    const labels = props.showAllLevels ? result.labels : result.labels.slice(-1)

    return labels.join(props.separator)
  })

  const popupProps = computed((): Partial<Omit<PopupProps, "show">> => {
    return {
      round: true,
      position: "bottom",
      safeAreaInsetBottom: true,
      teleport: "body",
      ...omitBy(props.popupProps as PopupProps, (_, key) => key === "show"),
    }
  })

  // ==================== 事件处理 ====================

  const handleClick = (): void => {
    if (props.readonly || props.disabled) return
    showCascader.value = true
  }

  const handleConfirm = (data: { selectedOptions: any[]; value: any }): void => {
    if (props.readonly || props.disabled) return

    const valueKey = fieldNames.value.value || "value"
    const valuePath = data.selectedOptions.map((i) => i[valueKey])
    const value = props.emitPath ? valuePath : [data.value]

    cascaderModel.value = value
    props.onConfirm?.(value)
    props.onChange?.(value)
    showCascader.value = false
  }

  const handleClose = (): void => {
    showCascader.value = false
    // onClose 由 watch(showCascader) 统一触发，避免重复
  }
</script>
