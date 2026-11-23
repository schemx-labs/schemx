/**
 * 插槽系统 JSX 写法示例
 *
 * 演示在 TSX 中通过 v-slots 使用 Schemx 的完整插槽体系。
 * 与 SlotsForm.vue 功能对等，展示 JSX 下的等价写法。
 *
 * @remarks
 * JSX 中插槽通过 Schemx 组件的 children 对象定义，
 * 每个 key 对应一个插槽名，value 为渲染函数。
 * kebab-case 插槽名需用引号包裹作为对象 key。
 */

import { defineComponent, ref } from "vue"
import { Button } from "vant"

import Schemx from "@schemx/vant"
import { z } from "zod"

import type { SchemxField, SchemxInstance } from "@schemx/vant"

import "./slots.css"

/**
 * 表单 Schema 配置
 *
 * 包含 6 个字段，分别用于演示整体插槽、Label 插槽、Error 插槽、
 * Content 插槽、kebab-case 插槽和子渲染器插槽。
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
    componentType: "text",
    required: true,
    rules: z.string().email("请输入有效的邮箱地址"),
    validationTrigger: "onChange",
  },
  // 4. Content 插槽演示 — phoneContent（橙色）
  {
    name: "phone",
    label: "手机号",
    componentType: "text",
    componentProps: { placeholder: "请输入手机号", maxlength: 11 },
    rules: z
      .string()
      .min(11, "手机号至少11位")
      .regex(/^1[3-9]\d{9}$/, "请输入正确的手机号"),
  },
  // 5. kebab-case 插槽演示 — "user-levelLabel"（紫色）
  {
    name: "user-level",
    label: "用户等级",
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
    const handleSubmit = (values) => {
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
          演示在 TSX 中通过 v-slots 使用 Schemx 的完整插槽体系。 所有插槽名均支持
          camelCase 和 kebab-case 两种格式。
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
             * 完全接管 FormItem 的渲染，参数为 formItemProps
             */
            username: ({ name, label, required }: any) => (
              <div class="slot-demo slot-demo--item">
                <div class="slot-demo__header">
                  <span class="slot-badge slot-badge--blue">整体插槽（JSX）</span>
                  <code>#{name}</code>
                </div>
                <div class="slot-demo__body">
                  <label class="slot-demo__label">
                    {required && <span class="slot-demo__star">*</span>}
                    {label}:
                  </label>
                  <input
                    value={formData.value.username ?? ""}
                    placeholder="由整体插槽完全接管渲染"
                    class="slot-demo__input"
                    onInput={(e: Event) =>
                      formRef.value?.setFieldValue(
                        "username",
                        (e.target as HTMLInputElement).value
                      )
                    }
                  />
                </div>
                <p class="slot-demo__note">
                  JSX 中通过 children 对象的 key 定义插槽名，value 为渲染函数
                </p>
              </div>
            ),

            /**
             * 2. Label 插槽 #{name}Label
             * 仅替换标签区域，参数为 formItemProps
             */
            emailLabel: ({ label, required }: any) => (
              <div class="slot-demo slot-demo--label">
                <span class="slot-badge slot-badge--green">Label 插槽（JSX）</span>
                <label class="slot-demo__custom-label">
                  {required && <span class="slot-demo__star">*</span>}
                  📧 {label}
                </label>
              </div>
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

            /**
             * 5. kebab-case 格式的 Label 插槽
             * JSX 中 kebab-case 插槽名需用引号包裹作为对象 key
             */
            "user-levelLabel": () => (
              <div class="slot-demo slot-demo--label">
                <span class="slot-badge slot-badge--purple">kebab-case Label（JSX）</span>
                <span class="slot-demo__custom-label">🏷️ 用户等级</span>
              </div>
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
          }}
        </Schemx>

        {/* 操作按钮：提交、校验、重置 */}
        <div class="form-actions">
          <Button type="primary" onClick={() => formRef.value?.submit()}>
            提交
          </Button>
          <Button onClick={() => formRef.value?.validate()}>校验</Button>
          <Button onClick={() => formRef.value?.reset()}>重置</Button>
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
