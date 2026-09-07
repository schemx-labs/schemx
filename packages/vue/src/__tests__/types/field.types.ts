import type { FieldInstance, SchemxFormProps } from "../../index"

interface FormValues {
  name: string
}

const componentProps: SchemxFormProps<FormValues> = {
  schemas: [],
  readonly: true,
}

const invalidComponentProps: SchemxFormProps<FormValues> = {
  schemas: [],
  // @ts-expect-error 组件 Props 不接受嵌套 schemaConfig。
  schemaConfig: { readonly: true },
}

const actionProps: SchemxFormProps<FormValues> = {
  submitter: {
    text: "保存",
    buttonProps: { disabled: true },
  },
  resetter: true,
  loading: false,
  onReset: () => {},
  onLoadingChange: (loading) => {
    const loadingState: boolean = loading

    void loadingState
  },
}

const invalidActionProps: SchemxFormProps<FormValues> = {
  submitter: {
    // @ts-expect-error 内置操作按钮不允许覆盖 type。
    buttonProps: { type: "submit" },
  },
}

void componentProps
void invalidComponentProps
void actionProps
void invalidActionProps

declare const field: FieldInstance<FormValues>

field.value.value = "下一值"

const errors: readonly string[] = field.errors.value

// @ts-expect-error computed 错误状态不可通过 value 赋值。
field.errors.value = []
// @ts-expect-error computed dirty 状态不可通过 value 赋值。
field.dirty.value = false
// @ts-expect-error computed pending 状态不可通过 value 赋值。
field.pending.value = false
// @ts-expect-error 错误数组是只读快照。
field.errors.value.push("外部错误")

void errors
