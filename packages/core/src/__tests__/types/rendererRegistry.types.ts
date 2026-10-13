import { createRendererRegistry } from "../../index"

import type {
  RendererDescriptor,
  RendererPropsTransformer,
  RendererRegistration,
  SchemxInstance,
} from "../../index"

interface FormValues {
  name: string
}

const inputComponent = { name: "InputRenderer" } as const

const selectComponent = { name: "SelectRenderer" } as const

const component = inputComponent

const transformProps: RendererPropsTransformer<FormValues, "input"> = (
  props,
  context
) => {
  const placeholder: string | undefined = props.placeholder

  const fieldName = context.schema.name

  void placeholder

  void fieldName

  // @ts-expect-error 转换器不能替换 Core 提供的 Schema 引用。
  context.schema = { ...context.schema }
  // @ts-expect-error 转换器不能替换 Core 提供的表单引用。
  context.form = form
  if (context.schema.debug) {
    // @ts-expect-error 调试元数据成员仍由 Core 管理。
    context.schema.debug.runtimeNodeId = 0
  }

  // @ts-expect-error ViewSchema 的调试元数据引用仍然只读。
  context.schema.debug = undefined

  return { placeholder }
}

const descriptor: RendererDescriptor<typeof component, FormValues, "input"> = {
  component,
  transformProps,
}

// 注册输入允许调用方调整组件和转换器。
descriptor.component = { ...component }
descriptor.transformProps = (props) => ({ ...props, disabled: true })

const registration: RendererRegistration<typeof component, FormValues, "input"> =
  descriptor

const registry = createRendererRegistry<FormValues>("input")

const defaultRegistry = createRendererRegistry()

declare const form: SchemxInstance<FormValues>

registry.register("input", component)
registry.register("input", descriptor)
registry.register("input", {
  component,
  transformProps: (props, context) => {
    const inlinePlaceholder: string | undefined = props.placeholder

    void context.form

    return { placeholder: inlinePlaceholder }
  },
})
registry.registerAll({
  input: descriptor,
  select: selectComponent,
})

registry.registerAll({
  input: selectComponent,
  select: inputComponent,
})

registry.register("input", selectComponent)

const inputRenderer: unknown = registry.get("input")

const selectRenderer: unknown = registry.get("select")

void inputRenderer
void selectRenderer
defaultRegistry.registerAll({
  input: {
    component,
    transformProps: (props, context) => {
      const defaultPlaceholder: string | undefined = props.placeholder

      void context.form

      return { placeholder: defaultPlaceholder }
    },
  },
})

form.registerRenderer("input", {
  component,
  transformProps: (props, context) => {
    const formPlaceholder: string | undefined = props.placeholder

    void context.form

    return { placeholder: formPlaceholder }
  },
})

const formEntry = form.getRendererEntry("input")

registry.registerAll({
  input: descriptor,
  select: selectComponent,
})

const entry = registry.getEntry("input")

if (entry) {
  // @ts-expect-error Registry 返回的条目不能替换组件。
  entry.component = component
  // @ts-expect-error Registry 返回的条目不能替换转换器。
  entry.transformProps = transformProps
}

const entryComponent: unknown = entry?.component

const resolved = registry.resolveEntry("select")

if (entry?.transformProps) {
  const transformed = entry.transformProps(
    { placeholder: "请输入" },
    {} as Parameters<NonNullable<typeof entry.transformProps>>[1]
  )

  const transformedPlaceholder: unknown = transformed.placeholder

  void transformedPlaceholder
}

void registration

void resolved
void formEntry
void entryComponent
void component
void transformProps
