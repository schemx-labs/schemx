/**
 * 插槽系统 JSX 写法示例
 *
 * 演示在 TSX 中通过插槽对象使用 Schemx 的完整插槽体系。
 * 与 SlotsForm.vue 功能对等，展示 JSX 下的等价写法。
 *
 * @remarks
 * JSX 中插槽通过 Schemx 组件的 children 对象定义，
 * 每个 key 对应一个插槽名，value 为渲染函数。
 * kebab-case 插槽名需用引号包裹作为对象 key。
 */

import { defineComponent, ref } from "vue"

import "./slots.css"

import Schemx from "@schemx/vant"
import { z } from "zod"

import type { SchemxField, SchemxInstance } from "@schemx/vant"

/**
 * 表单 Schema 配置
 *
 * 包含字段区域、Renderer 子 Slot 和 Group 区域 Slot 的完整示例。
 */
const schemas: SchemxField[] = [
  // 普通字段（无插槽，作为对比）
  {
    name: "age",
    label: "年龄",
    componentType: "number",
    componentProps: { min: 0, max: 150 },
  },
  // 1. 整体插槽演示 — username（蓝色）
  {
    name: "username",
    label: "用户名",
    componentType: "text",
    required: true,
  },
  // 2 & 3. Label + Error 插槽演示 — emailLabel（绿色）+ emailError（红色）
  {
    name: "email",
    label: "邮箱",
    labelPosition: "top",
    componentType: "input",
    required: true,
    rules: z.string().email("请输入有效的邮箱地址"),
    validationTrigger: "onChange",
  },
  // 4. Content 插槽演示 — phoneContent（橙色）
  {
    name: "phone",
    label: "手机号",
    componentType: "input",
    componentProps: { placeholder: "请输入手机号", maxlength: 11 },
    rules: z
      .string()
      .min(11, "手机号至少11位")
      .regex(/^1[3-9]\d{9}$/, "请输入正确的手机号"),
  },
  // 5. kebab-case 插槽演示 — "user-level-label"（紫色）
  {
    name: "user-level",
    label: "用户等级",
    labelPosition: "top",
    componentType: "number",
    componentProps: { min: 1, max: 10 },
  },
  // 6. 子渲染器插槽演示 — "remark:extra"（粉色）
  {
    name: "remark",
    label: "备注",
    componentType: "input",
    componentProps: { placeholder: "请输入备注" },
  },
  {
    key: "slot-group",
    label: "Header 插槽分组",
    collapsible: true,
    children: [{ name: "groupNote", label: "分组说明", componentType: "text" }],
  },
  {
    key: "slot-label-group",
    label: "Label 插槽分组",
    children: [
      { name: "labelGroupNote", label: "Label 分组说明", componentType: "text" },
    ],
  },
  {
    key: "slot-content-group",
    label: "Content 插槽分组",
    children: [
      { name: "contentGroupNote", label: "Content 分组说明", componentType: "text" },
    ],
  },
]

export default defineComponent({
  name: "SlotsFormJsx",

  setup() {
    /** 表单实例引用，提供 submit、validate、reset 等方法 */
    const formRef = ref<SchemxInstance>()

    /** 表单数据，通过 v-model 双向绑定实时同步 */
    const formData = ref<Record<string, any>>({})

    /**
     * 表单提交回调
     *
     * 校验通过后触发，弹窗展示表单数据。
     *
     * @param values - 校验通过的表单数据
     */
    const handleSubmit = (values: Record<string, any>) => {
      console.log("提交数据:", values)
      alert("提交成功！数据已打印到控制台")
    }

    /**
     * 表单值变化回调
     *
     * 同步表单数据到预览区域。
     */
    const handleValuesChange = (
      _changedValues: Record<string, any>,
      latestValues: Record<string, any>
    ) => {
      formData.value = latestValues
    }

    return () => (
      <div class="example-container">
        <h2>插槽系统示例（JSX 写法）</h2>
        <p class="description">
          演示在 TSX 中通过插槽对象使用 Schemx 的完整插槽体系。 所有插槽名均支持 camelCase
          和 kebab-case 两种格式。
        </p>

        <Schemx
          v-model={formData.value}
          ref={formRef}
          schemas={schemas}
          labelWidth="100px"
          labelAlign="right"
          colon={true}
          onFinish={handleSubmit}
          onValuesChange={handleValuesChange}
        >
          {{
            /**
             * 1. 整体插槽 #{name}
             * 替换标签和控件主体，保留 Before / Error / After
             */
            username: ({ schema, value, componentProps }: any) => (
              <div class="slot-demo slot-demo--item">
                <div class="slot-demo__header">
                  <span class="slot-badge slot-badge--blue">整体插槽（JSX）</span>
                  <code>#{schema.name}</code>
                </div>
                <div class="slot-demo__body">
                  <label class="slot-demo__label">
                    {schema.required && <span class="slot-demo__star">*</span>}
                    {schema.label}:
                  </label>
                  <input
                    value={value ?? ""}
                    disabled={componentProps.disabled}
                    readonly={componentProps.readonly}
                    placeholder="由整体插槽接管内容"
                    class="slot-demo__input"
                    onInput={(e: Event) =>
                      componentProps.onChange?.((e.target as HTMLInputElement).value)
                    }
                    onBlur={() => componentProps.onBlur?.(value)}
                  />
                </div>
                <p class="slot-demo__note">
                  整体插槽替换标签和控件主体；Before、Error、After 继续渲染。 通过
                  componentProps.onChange / onBlur 同步值并触发配置的校验。
                </p>
              </div>
            ),

            /**
             * 2. Label 插槽 #{name}Label
             * 仅替换标签区域，使用规范字段上下文
             */
            emailLabel: ({ schema }: any) => (
              <span class="slot-demo slot-demo--label">
                <span class="slot-badge slot-badge--green">Label 插槽（JSX）</span>
                <span class="slot-demo__custom-label">
                  {schema.required && <span class="slot-demo__star">*</span>}
                  📧 {schema.label}
                </span>
              </span>
            ),

            emailBefore: ({ schema, value }: any) => (
              <span class="slot-demo__inline slot-demo__inline--before">
                {schema.label}当前值：{value || "未填写"}
              </span>
            ),

            /**
             * 3. Error 插槽 #{name}Error
             * 仅替换错误区域，参数含 errors 数组
             */
            emailError: ({ errors }: any) =>
              errors?.length > 0 && (
                <div class="slot-demo slot-demo--error">
                  <span class="slot-badge slot-badge--red">Error 插槽（JSX）</span>
                  <ul class="slot-demo__error-list">
                    {errors.map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              ),

            /**
             * 4. Content 插槽 #{name}Content
             * 替换内容区域，columnElement 直接作为 JSX 子节点渲染
             */
            phoneContent: ({ columnElement }: any) => (
              <div class="slot-demo slot-demo--content">
                <div class="slot-demo__header">
                  <span class="slot-badge slot-badge--orange">Content 插槽（JSX）</span>
                  <span class="slot-demo__note-inline">
                    columnElement 是渲染器生成的 VNode
                  </span>
                </div>
                <div class="slot-demo__renderer-wrap">{columnElement}</div>
                <p class="slot-demo__note">
                  JSX 中 columnElement 可直接作为子节点渲染，无需 component :is
                </p>
              </div>
            ),

            phoneAfter: ({ componentProps }: any) => (
              <span class="slot-demo__inline slot-demo__inline--after">
                提示：{componentProps.placeholder}
              </span>
            ),

            /**
             * 5. kebab-case 格式的 Label 插槽
             * JSX 中 kebab-case 插槽名需用引号包裹作为对象 key
             */
            "user-level-label": () => (
              <span class="slot-demo slot-demo--label">
                <span class="slot-badge slot-badge--purple">kebab-case Label（JSX）</span>
                <span class="slot-demo__custom-label">🏷️ 用户等级</span>
              </span>
            ),

            /**
             * 6. 子渲染器插槽 #{name}:{childSlotName}
             * 透传到渲染器内部的具名插槽，冒号分隔
             */
            "remark:extra": () => (
              <div class="slot-demo slot-demo--child">
                <span class="slot-badge slot-badge--pink">子渲染器插槽（JSX）</span>
                <span>
                  remark:extra — 通过 children 对象的 "name:child" key 透传到渲染器内部
                </span>
              </div>
            ),

            "slot-groupHeader": ({ schema, collapsed, toggle }: any) => (
              <span class="slot-demo__group-header">
                <strong>{schema.label}</strong>
                <button
                  type="button"
                  onClick={(event: MouseEvent) => {
                    event.stopPropagation()
                    toggle()
                  }}
                >
                  {collapsed ? "展开" : "收起"}
                </button>
              </span>
            ),

            "slot-label-groupLabel": ({ schema }: any) => (
              <span class="slot-demo__group-label">🏷️ {schema.label}（Label Slot）</span>
            ),

            "slot-content-groupContent": ({ schema }: any) => (
              <div class="slot-demo slot-demo--content">
                Group Content Slot 已接管 {schema.children.length} 个子字段的 Body 布局
              </div>
            ),
          }}
        </Schemx>

        {/* 操作按钮：提交、校验、重置 */}
        <div class="form-actions">
          <button class="btn btn-primary" onClick={() => formRef.value?.submit()}>
            提交
          </button>
          <button class="btn" onClick={() => formRef.value?.validate()}>
            校验
          </button>
          <button class="btn" onClick={() => formRef.value?.reset()}>
            重置
          </button>
        </div>

        {/* 表单数据实时预览 */}
        <div class="form-data-preview">
          <h3>表单数据预览</h3>
          <pre>{JSON.stringify(formData.value, null, 2)}</pre>
        </div>
      </div>
    )
  },
})
