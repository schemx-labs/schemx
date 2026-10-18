import type {
  SchemxButtonDefinition,
  SchemxButtonProps,
  SchemxFormProps,
  UseFormOptions,
} from "../../index"

declare module "@schemx/vue" {
  interface SchemxButtonDefinition {
    testTone?: "quiet" | "strong"
  }
}

// 扩展属性直接进入公共按钮属性，不需要注册键或 UI 泛型。
const definition: SchemxButtonDefinition = { testTone: "strong" }

const button: SchemxButtonProps = {
  ...definition,
  type: "primary",
  size: "medium",
}

const formProps: SchemxFormProps<{ name: string }> = {
  submitter: { buttonProps: button },
}

const options: UseFormOptions<{ name: string }> = {
  initialValues: { name: "Ada" },
  resetter: { buttonProps: { testTone: "quiet" } },
}

// @ts-expect-error 公共属性保留扩展属性的取值约束。
const invalidTone: SchemxButtonProps = { testTone: "unknown" }

// @ts-expect-error 未导入 UI 适配包时使用内部按钮尺寸。
const invalidSize: SchemxButtonProps = { size: "mini" }

// @ts-expect-error Definition 不使用 UI 名称注册配置。
const invalidRegistration: SchemxButtonDefinition = { elementPlus: {} }

void [formProps, options, invalidTone, invalidSize, invalidRegistration]
