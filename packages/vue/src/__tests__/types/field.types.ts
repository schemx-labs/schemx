import type {
  FieldInstance,
  SchemxField,
  SchemxFieldContentSlotProps,
  SchemxFieldErrorSlotProps,
  SchemxFieldSlotProps,
  SchemxFieldSlots,
  SchemxFieldSlotValue,
  SchemxFormProps,
  SchemxGroupSlotProps,
  SchemxGroupSlots,
  SchemxVueBaseComponentProps,
} from "../../index"

interface FormValues {
  name: string
}

const componentProps: SchemxFormProps<FormValues> = {
  schemas: [],
  readonly: true,
}

const vueSchema: SchemxField<FormValues> = {
  name: "name",
  label: "姓名",
  componentType: "input",
  layout: { span: 12, offset: 1 },
  labelAlign: "right",
  labelPosition: "top",
  labelWidth: "120px",
  contentAlign: "center",
  colon: false,
  placeholder: "请输入姓名",
  onChange: (value, form) => {
    const nextValue: string | undefined = value

    void nextValue
    void form
  },
  onBlur: (form) => {
    void form
  },
}

const vueRendererProps: SchemxVueBaseComponentProps<FormValues> = {
  align: "center",
  placeholder: "请输入姓名",
  readonlyPlaceholder: "-",
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
void vueSchema
void vueRendererProps
void invalidComponentProps
void actionProps
void invalidActionProps

declare const fieldSlotProps: SchemxFieldSlotProps<FormValues>
declare const contentSlotProps: SchemxFieldContentSlotProps<FormValues>
declare const errorSlotProps: SchemxFieldErrorSlotProps<FormValues>

const slotValue: SchemxFieldSlotValue<FormValues> = fieldSlotProps

const fieldSlots: SchemxFieldSlots<FormValues> = {
  name: fieldSlotProps,
  nameContent: contentSlotProps,
  nameError: errorSlotProps,
}

void slotValue
void fieldSlots

declare const groupSlotProps: SchemxGroupSlotProps<FormValues>

const groupSlots: SchemxGroupSlots<FormValues> = {
  profileHeader: groupSlotProps,
  profileLabel: groupSlotProps,
  profileContent: groupSlotProps,
}

void groupSlots

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
