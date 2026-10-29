import { createForm, createFormStateAdapter, createRendererRegistry } from "../../index"

import type {
  FormConfig,
  ResolvedFormConfig,
  SchemxConfig,
  SnapshotSource,
} from "../../index"

// 消费配置与生效状态保留表单值泛型和已有声明合并。
const form = createForm<{ name: string }>({ initialValues: { name: "Ada" } })

const config: FormConfig<{ name: string }> = {
  schemaConfig: {
    required: { isEmpty: (value) => !value?.trim() },
    schemaTypeTestCallback: (values) => ({ name: values.name }),
  },
  configTypeTestValues: { name: "Ada" },
}

form.setConfig(config)
form.setConfig({})
const effective: SnapshotSource<ResolvedFormConfig<{ name: string }>> =
  createFormStateAdapter(form).config

void effective
// @ts-expect-error 运行期消费配置不重建引擎选项。
form.setConfig({ debug: true })
// @ts-expect-error Registry 只能在创建表单时选择。
form.setConfig({ rendererRegistry: createRendererRegistry() })
// @ts-expect-error 完整创建配置变量不能绕过约束。
const invalid: FormConfig<{ name: string }> = {} as SchemxConfig<{ name: string }>

// @ts-expect-error 字段默认值保留字符串值类型。
form.setConfig({ schemaConfig: { required: { isEmpty: (value: number) => value < 1 } } })
// @ts-expect-error 顶层扩展不能丢失当前表单值类型。
form.setConfig({ configTypeTestValues: { name: 1 } })
// @ts-expect-error 生效配置只能通过消费更新入口修改。
effective.getSnapshot().schemaConfig.readonly = false
// @ts-expect-error 不提供运行期配置层列表 API。
void form.setConfigLayers
void invalid
