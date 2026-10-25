import { nextTick, toRaw, watch } from "vue"

import { useFormSelector } from "./index"

import type { SchemxInstance, Values } from "@schemx/core"

/**
 * 同步组件模型与 Core 表单值，避免外部写入和标准 v-model 回传产生循环。
 *
 * @internal
 * @typeParam TValues - 表单值类型。
 * @param form - 当前组件接入的表单实例。
 * @param modelValue - 读取响应式的外部模型。
 * @param onModelValueChange - 将独立模型快照发送给消费端。
 * @param immediate - 是否立即将外部模型写入已有表单。
 * @example useFormModel(form, () => props.modelValue, values => emit("update:modelValue", values))
 */
export function useFormModel<TValues extends Values>(
  form: SchemxInstance<TValues>,
  modelValue: () => TValues,
  onModelValueChange: (values: TValues) => void,
  immediate = false
): void {
  // 外部写入期间不向父级回写模型。
  let syncingFromModel = false

  // 只跳过当前 Vue 更新周期中原样回传的内部快照。
  const internalModelEchoes = new Set<TValues>()

  /**
   * 发出独立快照，并在当前更新周期结束后撤销回传标记。
   * @param values - 最新的完整表单值快照。
   */
  const emitModelValue = (values: TValues): void => {
    const rawValues = toRaw(values)

    internalModelEchoes.add(rawValues)
    onModelValueChange(values)

    void nextTick(() => {
      internalModelEchoes.delete(rawValues)
    })
  }

  watch(
    modelValue,
    (values) => {
      if (internalModelEchoes.delete(toRaw(values))) {
        return
      }

      syncingFromModel = true

      try {
        form.setFieldsValue(values)
      } finally {
        syncingFromModel = false
      }
    },
    { deep: true, immediate }
  )

  // 共用状态桥接订阅，向消费端发出可写的独立快照。
  const formValues = useFormSelector(form, (values) => values)

  watch(
    formValues,
    () => {
      if (syncingFromModel) {
        return
      }

      emitModelValue(form.getFieldsSnapshot())
    },
    { flush: "sync" }
  )
}
