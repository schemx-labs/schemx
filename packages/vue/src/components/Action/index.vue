<script lang="ts" setup generic="TValues extends Values = Values">
  import { computed, useSlots } from "vue"

  import Col from "../Col"

  import ActionButtons from "./buttons.vue"

  import type { ActionProps } from "./types"
  import type { SchemxColConfig } from "../../types"
  import type { Values } from "@schemx/core"

  defineOptions({ name: "SchemxAction" })

  // 保留 Form 的操作列配置，按钮主体可独立用于 Search。
  const props = defineProps<ActionProps<TValues>>()

  // 仅转发实际存在的插槽，避免空插槽占据操作区。
  const slots = useSlots()

  // 操作列不继承字段默认 Col。
  const resolvedActionColConfig = computed(
    () => props.actionCol as SchemxColConfig | undefined
  )

  // 与按钮主体使用相同的可见性规则，隐藏全部按钮时不创建列。
  const isActionsVisible = computed(
    () =>
      (props.submitter !== false &&
        (props.submitter !== undefined || Boolean(slots.submitter))) ||
      (props.resetter !== false &&
        (props.resetter !== undefined || Boolean(slots.resetter)))
  )
</script>

<template>
  <Col v-if="isActionsVisible" :col="resolvedActionColConfig">
    <ActionButtons
      :form="props.form"
      :loading="props.loading"
      :submitter="props.submitter"
      :resetter="props.resetter"
    >
      <template v-if="slots.resetter" #resetter="slotProps">
        <slot name="resetter" v-bind="slotProps" />
      </template>
      <template v-if="slots.submitter" #submitter="slotProps">
        <slot name="submitter" v-bind="slotProps" />
      </template>
    </ActionButtons>
  </Col>
</template>
