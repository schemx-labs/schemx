<template>
  <div class="example-container">
    <h2>表单验证示例</h2>
    <p class="description">
      演示 Zod 规则校验、required 必填声明、rules 数组形式、
      validationTrigger（onChange）、跨字段校验、validateField 单字段校验、 Zod email
      邮箱格式校验
    </p>

    <Schemx
      ref="formRef"
      v-model="formData"
      :schemas="schemas"
      @finish="handleSubmit"
      @finish-failed="handleSubmitFailed"
      @values-change="handleValuesChange"
    />

    <div class="form-actions">
      <button class="btn btn-primary" @click="formRef?.submit()">提交</button>
      <button class="btn" @click="handleValidateAll">全量校验</button>
      <button class="btn" @click="handleValidateUsername">校验用户名</button>
      <button class="btn" @click="handleValidatePhone">校验手机号</button>
      <button class="btn" @click="handleSetMailRules">设置/替换邮箱 rules</button>
      <button class="btn" @click="formRef?.reset()">重置</button>
    </div>

    <div class="form-data-preview">
      <h3>表单数据预览</h3>
      <pre>{{ JSON.stringify(formData, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from "vue"

  import Schemx from "@schemx/vant"
  import { z } from "zod"

  import type { ValidationFormValues } from "../../../../../../wot-demo/src/types"
  import type { SchemxField, SchemxInstance } from "@schemx/vant"

  /** 表单实例引用，提供 submit、validate、validateField、setFieldErrors 等方法 */
  const formRef = ref<SchemxInstance>()

  /** 表单数据，通过 v-model 双向绑定实时同步 */
  const formData = ref<Record<string, any>>({})

  /**
   * 表单 Schema 配置
   *
   * 覆盖多种校验方式：Zod schema rules、required 必填声明、rules 数组形式、
   * validationTrigger onChange 触发、z.number() 类型校验、z.string().regex() 正则校验、
   * z.string().email() 邮箱格式校验。
   */
  const schemas: SchemxField<ValidationFormValues>[] = [
    // Zod string min/max/regex 校验 + validationTrigger: "onChange"
    {
      name: "username",
      label: "用户名",
      componentType: "text",
      required: false,
      validationTrigger: "onChange",
      rules: z
        .string()
        .min(3, "用户名长度为 3-16 个字符")
        .max(16, "用户名长度为 3-16 个字符")
        .regex(
          /^[a-zA-Z][a-zA-Z0-9_]*$/,
          "用户名必须以字母开头，只能包含字母、数字和下划线"
        ),
      componentProps: {
        placeholder: "请输入用户名（字母开头，3-16位）",
        clearable: true,
      },
    },
    // required 负责必填语义，rules 负责格式校验
    {
      name: "email",
      label: "邮箱",
      componentType: "text",
      required: true,
      rules: z
        .string()
        .regex(
          /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
          "请输入正确的邮箱地址"
        ),
      componentProps: {
        placeholder: "请输入邮箱地址",
      },
    },
    {
      name: "phone",
      label: "手机号",
      componentType: "input",
      required: true,
      componentProps: {
        type: "text",
        placeholder: "请输入手机号",
        maxlength: 11,
      },
      rules: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号"),
    },
    // Zod string min + regex 密码复杂度校验
    {
      name: "password",
      label: "密码",
      componentType: "input",
      required: true,
      componentProps: {
        type: "safe-password",
        placeholder: "至少8位，包含大小写字母和数字",
      },
      labelPosition: "top",
      rules: z
        .string()
        .min(8, "密码至少8位")
        .regex(/\d/, "密码必须包含数字")
        .regex(/[a-z]/, "密码必须包含小写字母")
        .regex(/[A-Z]/, "密码必须包含大写字母"),
    },
    // 确认密码字段，跨字段校验在 @finish 回调中通过 setFieldErrors 实现
    {
      name: "confirmPassword",
      label: "确认密码",
      componentType: "input",
      required: true,
      componentProps: {
        type: "safe-password",
        placeholder: "请再次输入密码",
      },
      rules: z.string().min(1, "请确认密码"),
    },
    // Zod number min/max 数值范围校验
    {
      name: "age",
      label: "年龄",
      componentType: "stepper",
      componentProps: {
        min: 0,
        max: 150,
        integer: true,
      },
      rules: z.number().min(18, "年龄必须大于等于18岁").max(100, "年龄必须小于等于100岁"),
    },
    // Zod string regex 正则校验
    {
      name: "idCard",
      label: "身份证号",
      componentType: "text",
      required: true,
      componentProps: {
        placeholder: "请输入身份证号",
        maxlength: 18,
      },
      rules: z.string().regex(/^\d{17}[\dXx]$/, "请输入有效的身份证号"),
    },
    // Zod string email 邮箱格式校验（新增字段）
    {
      name: "contactEmail",
      label: "联系邮箱",
      componentType: "text",
      required: true,
      componentProps: {
        placeholder: "请输入联系邮箱",
        clearable: true,
      },
      rules: z.string().email("请输入有效的邮箱地址"),
    },
  ]

  /**
   * 表单值变化回调
   *
   * 同步表单数据到预览区域。
   *
   * @param _changedValues - 本次变化的字段键值对
   * @param latestValues - 变化后的完整表单数据
   */
  const handleValuesChange = (
    _changedValues: Record<string, any>,
    latestValues: Record<string, any>
  ) => {
    formData.value = latestValues
  }

  /**
   * 表单提交回调（含跨字段校验）
   *
   * 校验通过后检查密码与确认密码是否一致，
   * 不一致时调用 setFieldErrors 设置错误信息。
   *
   * @param values - 校验通过的表单数据
   */
  const handleSubmit = (values: ValidationFormValues) => {
    if (values.password !== values.confirmPassword) {
      formRef.value?.setFieldErrors("confirmPassword", ["两次输入的密码不一致"])

      return
    }

    console.log("注册信息:", values)
    alert("注册成功！")
  }

  /**
   * 表单校验失败回调
   *
   * 输出校验错误信息到控制台。
   *
   * @param errorInfo - 校验失败的错误信息对象
   */
  const handleSubmitFailed = (errorInfo: any) => {
    console.error("验证失败:", errorInfo)
  }

  /**
   * 校验用户名字段
   *
   * 演示 formRef.validateField() 对单个字段进行校验的用法。
   */
  const handleValidateUsername = async () => {
    const result = await formRef.value?.validateField("username")
    console.log("用户名校验结果:", result)
  }

  /**
   * 校验手机号字段
   *
   * 演示 formRef.validateField() 对单个字段进行校验的用法。
   */
  const handleValidatePhone = async () => {
    const result = await formRef.value?.validateField("phone")
    console.log("手机号校验结果:", result)
  }

  /**
   * 全量校验所有字段
   *
   * 演示 formRef.validate() 对全量字段进行校验的用法。
   */
  const handleValidateAll = async () => {
    const result = await formRef.value?.validate()
    if (result && !result.valid) {
      console.error("全量校验错误:", result.errors)
    }
    console.log("全量校验结果:", result)
  }

  const handleSetMailRules = () => {
    formRef.value?.setFieldRules("email", z.string().email("请输入正确的邮箱地址"))
    // do something
  }
</script>

<style scoped>
  .example-container {
    padding: 16px;
    max-width: 600px;
    margin: 0 auto;
  }

  .example-container h2 {
    margin-bottom: 8px;
    color: #333;
  }

  .description {
    margin-bottom: 20px;
    color: #666;
    font-size: 14px;
  }

  .form-data-preview {
    margin-top: 24px;
    padding: 16px;
    background: #f5f5f5;
    border-radius: 8px;
  }

  .form-data-preview h3 {
    margin-bottom: 12px;
    font-size: 14px;
    color: #666;
  }

  .form-data-preview pre {
    margin: 0;
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
