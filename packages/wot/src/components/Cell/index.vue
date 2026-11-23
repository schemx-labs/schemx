<script setup lang="ts">
  /**
   * 单元格展示组件
   *
   * 统一处理 disabled、readonly、view 状态下的 Cell 展示。
   *
   * @module components/Cell
   */
  import { computed, useAttrs } from "vue"

  import WdCell from "@wot-ui/ui/components/wd-cell/wd-cell.vue"

  interface Props {
    value?: string | number
    placeholder?: string
    disabled?: boolean
    readonly?: boolean
    view?: boolean
    contentAlign?: "left" | "right" | "center"
    className?: string
    customValueClass?: string
  }

  defineOptions({
    name: "SchemxCell",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<Props>(), {
    value: "",
    placeholder: "",
    disabled: false,
    readonly: false,
    view: false,
    contentAlign: "right",
    className: "",
    customValueClass: "",
  })

  const emit = defineEmits<{
    click: [event?: MouseEvent]
  }>()

  const attrs = useAttrs()

  const isDisabled = computed(() => props.disabled)
  const isReadonly = computed(() => !isDisabled.value && props.readonly)
  const isView = computed(() => !isDisabled.value && !isReadonly.value && props.view)
  const isEditable = computed(() => !isReadonly.value && !isView.value)

  const customValueClass = computed(() =>
    [
      props.customValueClass,
      isDisabled.value && "schemx-cell__value--disabled",
      isReadonly.value && "schemx-cell__value--readonly",
      isView.value && "schemx-cell__value--view",
    ]
      .filter(Boolean)
      .join(" ")
  )

  const handleClick = (event?: MouseEvent): void => {
    if (!isEditable.value) return

    emit("click", event)
  }
</script>

<template>
  <WdCell
    v-bind="attrs"
    :class="['schemx-cell', props.className]"
    :value="props.value"
    :placeholder="placeholder"
    :is-link="isEditable"
    :clickable="isEditable"
    :disabled="isDisabled"
    :value-align="props.contentAlign"
    :custom-value-class="customValueClass"
    @click="handleClick"
  />
</template>

<style lang="scss" scoped>
  .schemx-cell {
    --schemx-cell-readonly-color: var(--wot-color-info, #909399);
    --schemx-cell-disabled-color: var(
      --wot-cell-disabled-color,
      var(--wot-color-placeholder, #c8c9cc)
    );

    padding-inline: 0;
    padding-block: 4px;

    :deep(.schemx-cell__value--disabled) {
      color: var(--schemx-cell-disabled-color);
    }

    :deep(.schemx-cell__value--readonly) {
      color: var(--schemx-cell-readonly-color);
    }
  }
</style>
