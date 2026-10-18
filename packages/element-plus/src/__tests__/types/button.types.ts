import SchemxForm, { useForm } from "../../index"

import type {
  SchemxButtonProps,
  SchemxFormActionConfig,
  SchemxFormProps,
  UseFormOptions,
} from "../../index"
import type { SchemxButtonProps as VueButtonProps } from "@schemx/vue"

// 导入适配包后，声明合并直接扩展公共按钮属性。
const button: SchemxButtonProps = { type: "success", size: "default", link: true }

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
  submitter: { buttonProps: { type: "danger", size: "default", text: true } },
})
// @ts-expect-error Element Plus 不接受 Vant 的 mini 尺寸。
SchemxForm({ submitter: { buttonProps: { size: "mini" } } })
// @ts-expect-error Hook 入口同样使用声明合并后的 Element Plus 尺寸。
useForm({ submitter: { buttonProps: { size: "normal" } } })
// @ts-expect-error square 是 Vant 属性，不属于 Element Plus。
const invalidButton: SchemxButtonProps = { square: true }

// @ts-expect-error 操作按钮的点击事件由表单管理。
const invalidClick: SchemxFormActionConfig = { buttonProps: { onClick: () => {} } }

const invalidNativeType: SchemxFormActionConfig = {
  // @ts-expect-error 操作按钮不允许覆盖原生提交行为。
  buttonProps: { nativeType: "submit" },
}

// Vue 公共类型与 UI 包类型保持一致，不需要 UI 标识或专属别名。
const vueButton: VueButtonProps = button

void [props, invalidButton, invalidClick, invalidNativeType, vueButton]
