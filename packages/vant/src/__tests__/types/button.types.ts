import SchemxForm, { useForm } from "../../index"

import type {
  SchemxButtonProps,
  SchemxFormActionConfig,
  SchemxFormProps,
  UseFormOptions,
} from "../../index"
import type { SchemxButtonProps as VueButtonProps } from "@schemx/vue"

// Vant 配置保留自己的尺寸与专属属性。
const button: SchemxButtonProps = {
  type: "warning",
  size: "mini",
  square: true,
  hairline: true,
}

const action: SchemxFormActionConfig = { buttonProps: button }

const props: SchemxFormProps<{ name: string }> = { submitter: action }

const options: UseFormOptions<{ name: string }> = {
  initialValues: { name: "Ada" },
  submitter: action,
}

const form = useForm(options)

form.setFieldValue("name", "Grace")
// @ts-expect-error 扩展按钮后仍保留表单值类型推导。
form.setFieldValue("name", 1)

SchemxForm({
  submitter: { buttonProps: { type: "danger", size: "normal", loadingType: "spinner" } },
})
// @ts-expect-error Vant 不接受 Element Plus 的 default 尺寸。
SchemxForm({ submitter: { buttonProps: { size: "default" } } })
// @ts-expect-error Hook 入口同样使用声明合并后的 Vant 尺寸。
useForm({ submitter: { buttonProps: { size: "medium" } } })
// @ts-expect-error link 是 Element Plus 属性，不属于 Vant。
const invalidButton: SchemxButtonProps = { link: true }

// @ts-expect-error 操作按钮的点击事件由表单管理。
const invalidClick: SchemxFormActionConfig = { buttonProps: { onClick: () => {} } }

const invalidNativeType: SchemxFormActionConfig = {
  // @ts-expect-error 操作按钮不允许覆盖原生提交行为。
  buttonProps: { nativeType: "submit" },
}

// 导入 Vant 后直接扩展 Vue 公共按钮类型。
const vueButton: VueButtonProps = button

void [props, invalidButton, invalidClick, invalidNativeType, vueButton]
