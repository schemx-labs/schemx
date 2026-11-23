<template>
  <div class="example-container">
    <h2>插槽系统示例</h2>
    <p class="description">
      演示 schemx 的完整插槽体系，每种插槽用不同颜色边框标识。 所有插槽名均支持 camelCase
      和 kebab-case 两种格式。
    </p>

    <Schemx
      ref="formRef"
      v-model="formData"
      :schemas="schemas"
      label-width="100px"
      label-align="right"
      :colon="true"
      @finish="handleSubmit"
    >
      <!--
        ╔══════════════════════════════════════════════╗
        ║  1. 整体插槽 #{name}                         ║
        ║  完全接管 FormItem 的渲染，参数为 formItemProps ║
        ╚══════════════════════════════════════════════╝
      -->
      <template #username="{ name, label, required }">
        <div class="slot-demo slot-demo--item">
          <div class="slot-demo__header">
            <span class="slot-badge slot-badge--blue">整体插槽</span>
            <code>#{{ name }}</code>
          </div>
          <div class="slot-demo__body">
            <label class="slot-demo__label">
              <span v-if="required" class="slot-demo__star">*</span>
              {{ label }}:
            </label>
            <input
              :value="formData.username"
              placeholder="由整体插槽完全接管渲染"
              class="slot-demo__input"
              @input="handleUsernameInput"
            />
          </div>
          <p class="slot-demo__note">
            整体插槽替换了整个 FormItem，label / error / content 均由插槽自行处理
          </p>
        </div>
      </template>

      <!--
        ╔══════════════════════════════════════════════╗
        ║  2. Label 插槽 #{name}Label                  ║
        ║  仅替换标签区域，参数为 formItemProps          ║
        ╚══════════════════════════════════════════════╝
      -->
      <template #emailLabel="{ label, required }">
        <div class="slot-demo slot-demo--label">
          <span class="slot-badge slot-badge--green">Label 插槽</span>
          <label class="slot-demo__custom-label">
            <span v-if="required" class="slot-demo__star">*</span>
            📧 {{ label }}
          </label>
        </div>
      </template>

      <!--
        ╔══════════════════════════════════════════════╗
        ║  3. Error 插槽 #{name}Error                  ║
        ║  仅替换错误区域，参数含 errors 数组            ║
        ╚══════════════════════════════════════════════╝
      -->
      <template #emailError="{ errors }">
        <div v-if="errors && errors.length" class="slot-demo slot-demo--error">
          <span class="slot-badge slot-badge--red">Error 插槽</span>
          <ul class="slot-demo__error-list">
            <li v-for="(err, i) in errors" :key="i">{{ err }}</li>
          </ul>
        </div>
      </template>

      <!--
        ╔══════════════════════════════════════════════╗
        ║  4. Content 插槽 #{name}Content              ║
        ║  替换内容区域，参数含 columnElement（渲染器 VNode）║
        ╚══════════════════════════════════════════════╝
      -->
      <template #phoneContent="{ columnElement }">
        <div class="slot-demo slot-demo--content">
          <div class="slot-demo__header">
            <span class="slot-badge slot-badge--orange">Content 插槽</span>
            <span class="slot-demo__note-inline">
              columnElement 是渲染器生成的 VNode
            </span>
          </div>
          <div class="slot-demo__renderer-wrap">
            <component :is="() => columnElement" />
          </div>
          <p class="slot-demo__note">
            Content 插槽可以在渲染器前后添加自定义内容，同时保留原始渲染器
          </p>
        </div>
      </template>

      <!--
        ╔══════════════════════════════════════════════╗
        ║  5. kebab-case 格式插槽                       ║
        ║  字段名含连字符时，插槽名自动支持 kebab-case    ║
        ╚══════════════════════════════════════════════╝
      -->
      <template #user-levelLabel>
        <div class="slot-demo slot-demo--label">
          <span class="slot-badge slot-badge--purple">kebab-case Label</span>
          <label class="slot-demo__custom-label">🏷️ 用户等级</label>
        </div>
      </template>

      <!--
        ╔══════════════════════════════════════════════╗
        ║  6. 子渲染器插槽 #{name}:{childSlotName}      ║
        ║  透传到渲染器内部的具名插槽                     ║
        ╚══════════════════════════════════════════════╝
      -->
      <template #remark:extra>
        <div class="slot-demo slot-demo--child">
          <span class="slot-badge slot-badge--pink">子渲染器插槽</span>
          <span>
            remark:extra — 此内容通过 extractChildSlots 透传到 InputRenderer 的 extra 插槽
          </span>
        </div>
      </template>
    </Schemx>

    <div class="form-actions">
      <button class="btn btn-primary" @click="formRef?.submit()">提交</button>
      <button class="btn" @click="formRef?.validate()">校验</button>
      <button class="btn" @click="formRef?.reset()">重置</button>
    </div>

    <div class="form-data-preview">
      <h3>表单数据预览</h3>
      <pre>{{ JSON.stringify(formData, null, 2) }}</pre>
    </div>

    <!-- 插槽速查表 -->
    <div class="slot-reference">
      <h3>插槽速查表</h3>
      <div class="slot-reference__grid">
        <div class="slot-reference__card slot-reference__card--blue">
          <div class="slot-reference__title">整体插槽</div>
          <code class="slot-reference__code">#{ name }</code>
          <div class="slot-reference__desc">完全替换 FormItem</div>
          <div class="slot-reference__params">参数: formItemProps</div>
        </div>
        <div class="slot-reference__card slot-reference__card--green">
          <div class="slot-reference__title">Label 插槽</div>
          <code class="slot-reference__code">#{ name }Label</code>
          <div class="slot-reference__desc">替换标签区域</div>
          <div class="slot-reference__params">参数: formItemProps</div>
        </div>
        <div class="slot-reference__card slot-reference__card--red">
          <div class="slot-reference__title">Error 插槽</div>
          <code class="slot-reference__code">#{ name }Error</code>
          <div class="slot-reference__desc">替换错误展示</div>
          <div class="slot-reference__params">参数: formItemProps + errors</div>
        </div>
        <div class="slot-reference__card slot-reference__card--orange">
          <div class="slot-reference__title">Content 插槽</div>
          <code class="slot-reference__code">#{ name }Content</code>
          <div class="slot-reference__desc">替换内容区域</div>
          <div class="slot-reference__params">参数: formItemProps + columnElement</div>
        </div>
        <div class="slot-reference__card slot-reference__card--purple">
          <div class="slot-reference__title">kebab-case 插槽</div>
          <code class="slot-reference__code">#user-levelLabel</code>
          <div class="slot-reference__desc">连字符字段名插槽</div>
          <div class="slot-reference__params">参数: formItemProps</div>
        </div>
        <div class="slot-reference__card slot-reference__card--pink">
          <div class="slot-reference__title">子渲染器插槽</div>
          <code class="slot-reference__code">#{ name }:{ childSlot }</code>
          <div class="slot-reference__desc">透传到渲染器内部</div>
          <div class="slot-reference__params">参数: 由渲染器定义</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from "vue"

  import "./slots.css"

  import Schemx from "@schemx/wot"
  import { z } from "zod"

  import type { SchemxField, SchemxInstance } from "@schemx/wot"

  /** 表单实例引用，提供 submit、validate、reset 等方法 */
  const formRef = ref<SchemxInstance>()

  /** 表单数据，通过 v-model 双向绑定实时同步 */
  const formData = ref<Record<string, any>>({})

  /**
   * 处理 username 输入事件
   *
   * 整体插槽完全接管渲染后，需手动同步输入值到表单状态。
   *
   * @param e - 原生 input 事件
   */
  const handleUsernameInput = (e: Event) => {
    formRef.value?.setFieldValue("username", (e.target as HTMLInputElement).value)
  }

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
      componentProps: {
        min: 0,
        max: 150,
      },
    },
    // 1. 整体插槽演示 — #username（蓝色）
    {
      name: "username",
      label: "用户名",
      componentType: "text",
      required: true,
    },
    // 2 & 3. Label + Error 插槽演示 — #emailLabel（绿色）+ #emailError（红色）
    {
      name: "email",
      label: "邮箱",
      componentType: "text",
      required: true,
      rules: z.string().email("请输入有效的邮箱地址"),
      validationTrigger: "onChange",
    },
    // 4. Content 插槽演示 — #phoneContent（橙色）
    {
      name: "phone",
      label: "手机号",
      componentType: "text",
      componentProps: {
        placeholder: "请输入手机号",
        maxlength: 11,
      },
      rules: z
        .string()
        .min(11, "手机号至少11位")
        .regex(/^1[3-9]\d{9}$/, "请输入正确的手机号"),
    },
    // 5. kebab-case 插槽演示 — #user-levelLabel（紫色）
    {
      name: "user-level",
      label: "用户等级",
      componentType: "number",
      componentProps: {
        min: 1,
        max: 10,
      },
    },
    // 6. 子渲染器插槽演示 — #remark:extra（粉色）
    {
      name: "remark",
      label: "备注",
      componentType: "input",
      componentProps: {
        placeholder: "请输入备注",
      },
    },
  ]

  /**
   * 表单提交回调
   *
   * 校验通过后触发，输出表单数据到控制台。
   *
   * @param values - 校验通过的表单数据
   */
  const handleSubmit = (values: Record<string, any>) => {
    console.log("提交数据:", values)
    alert("提交成功！数据已打印到控制台")
  }
</script>
