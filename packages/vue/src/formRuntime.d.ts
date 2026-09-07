import type { PublicProps, VNode } from "vue"

import type { SchemxFormProps } from "./types"
import type { Values } from "@schemx/core"

/**
 * 保留 `form.vue` 中 `<script setup generic>` 的组件调用签名。
 */
declare const SchemxForm: <TValues extends Values = Values>(
  props: PublicProps &
    SchemxFormProps<TValues> & {
      "onUpdate:modelValue"?: (value: TValues) => unknown
    }
) => VNode

export default SchemxForm
