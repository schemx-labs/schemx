import type {
  FieldInstance,
  SchemxComponentProps,
  SchemxField,
  SchemxFieldContentSlotProps,
  SchemxFieldErrorSlotProps,
  SchemxFieldSlotProps,
  SchemxFieldSlots,
  SchemxFieldSlotValue,
  SchemxFormProps,
  SchemxGroupSlotProps,
  SchemxGroupSlots,
  SchemxInstance,
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
  col: { span: 12, offset: 1 },
  labelAlign: "right",
  labelPosition: "top",
  labelWidth: "120px",
  contentAlign: "center",
  errorAlign: "left",
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

const vueRendererProps: SchemxComponentProps<FormValues> = {
  placeholder: "请输入姓名",
  readonlyPlaceholder: "-",
}

const legacyVueRendererProps: SchemxComponentProps<FormValues> = {
  align: "center",
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
    // @ts-expect-error type 表示外观类型，不接受原生提交行为。
    buttonProps: { type: "submit" },
  },
}

void componentProps
void vueSchema
void vueRendererProps
void legacyVueRendererProps
void invalidComponentProps
void actionProps
void invalidActionProps

declare const formInstance: SchemxInstance<FormValues>

void formInstance.scrollToField("name", { behavior: "smooth", block: "center" })

// @ts-expect-error scroll behavior is limited to the supported library options.
void formInstance.scrollToField("name", { behavior: "instant" })

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

// 组件专属属性保留表单值泛型及 Vue class/style 的组合形式。
const componentOnlyProps: SchemxFormProps<FormValues> = {
  modelValue: { name: "姓名" },
  form: formInstance,
  loading: false,
  class: ["custom-form", { active: true }],
  style: [{ color: "red" }, "width: 100%"],
  actionCol: { span: 8, offset: 16 },
  submitter: { text: "保存" },
  resetter: false,
}

// 受控值必须与当前表单值类型一致。
const invalidModelProps: SchemxFormProps<FormValues> = {
  // @ts-expect-error name 的字段值类型为字符串。
  modelValue: { name: 1 },
}

void componentOnlyProps
void invalidModelProps
