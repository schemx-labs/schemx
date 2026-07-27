<template>
  <div class="example-container">
    <h2>动态表单示例</h2>
    <p class="description">
      演示字段与 Group 容器的 dependencies 联动：通过“显示配送详情”和“配送方式”控制
      可见、只读、禁用、必填及 Renderer Props。
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
      <Button type="primary" @click="formRef?.submit()">提交</Button>
      <Button @click="formRef?.reset()">重置</Button>
    </div>

    <div class="form-data-preview">
      <h3>表单数据预览</h3>
      <pre>{{ JSON.stringify(formData, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from "vue"

  import { Button } from "vant"

  import Schemx from "@schemx/vant"

  import type { DynamicFormValues } from "../types"
  import type { SchemxField, SchemxInstance } from "@schemx/vant"

  /** 表单实例引用，提供 submit、reset 等方法 */
  const formRef = ref<SchemxInstance<DynamicFormValues>>()

  /** 表单数据，通过 v-model 双向绑定实时同步联动效果 */
  const formData = ref<DynamicFormValues>({})

  /**
   * 表单 Schema 配置
   *
   * 通过 dependencies 声明字段和容器依赖关系：
   * - Group 容器：统一控制配送详情子树的 visible、readonly、disabled
   * - visible 函数：开关控制整组配送详情是否显示
   * - dict + dependsOn：省份变化时自动请求城市列表（picker）
   * - readonly 函数：自提时整组配送详情只读
   * - disabled 函数：选择其他配送方式时整组配送详情禁用
   * - required 函数：选择其他时备注必填（textarea）
   * - componentProps 函数：服务评分 count 随配送方式动态变化（rate）
   */
  const schemas: SchemxField<DynamicFormValues>[] = [
    {
      name: "showDeliveryDetails",
      label: "显示配送详情",
      componentType: "switch",
      initialValue: true,
    },
    {
      name: "deliveryMethod",
      label: "配送方式",
      componentType: "radio",
      initialValue: "express",
      componentProps: {
        options: [
          { label: "快递配送", value: "express" },
          { label: "自提", value: "selfPickup" },
          { label: "其他", value: "other" },
        ],
      },
    },

    {
      key: "delivery-details",
      label: "配送详情（Group 容器状态）",
      collapsible: true,
      destroyOnCollapse: false,
      dependencies: {
        triggerFields: ["showDeliveryDetails", "deliveryMethod"],
        visible: (values) => values.showDeliveryDetails !== false,
        readonly: (values) => values.deliveryMethod === "selfPickup",
        disabled: (values) => values.deliveryMethod === "other",
        trigger: (values) => console.log("配送详情（Group 容器状态） - trigger", values),
      },
      children: [
        {
          name: "province",
          label: "省市选择",
          componentType: "picker",
          componentProps: {
            options: [
              { text: "广东省", value: "guangdong" },
              { text: "浙江省", value: "zhejiang" },
              { text: "北京市", value: "beijing" },
              { text: "上海市", value: "shanghai" },
              { text: "江苏省", value: "jiangsu" },
            ],
          },
        },
        {
          name: "city",
          label: "城市选择",
          componentType: "picker",
          componentProps: {
            dict: {
              api: (values) => {
                const cityMap: Record<string, { text: string; value: string }[]> = {
                  guangdong: [
                    { text: "广州", value: "guangzhou" },
                    { text: "深圳", value: "shenzhen" },
                    { text: "东莞", value: "dongguan" },
                  ],
                  zhejiang: [
                    { text: "杭州", value: "hangzhou" },
                    { text: "宁波", value: "ningbo" },
                    { text: "温州", value: "wenzhou" },
                  ],
                  beijing: [{ text: "北京市", value: "beijing" }],
                  shanghai: [{ text: "上海市", value: "shanghai" }],
                  jiangsu: [
                    { text: "南京", value: "nanjing" },
                    { text: "苏州", value: "suzhou" },
                    { text: "无锡", value: "wuxi" },
                  ],
                }

                return cityMap[values.province as string] ?? []
              },
              dependsOn: ["province"],
              // shouldFetch: (values) => !!values.province,
              resetOnDepsChange: true,
              immediate: true,
            },
          },
        },
        {
          name: "distance",
          label: "配送距离",
          componentType: "slider",
          componentProps: { min: 0, max: 50, step: 1 },
        },
        {
          name: "quantity",
          label: "购买数量",
          componentType: "stepper",
          initialValue: 1,
          componentProps: { min: 1, max: 99, integer: true },
        },
      ],
    },

    // required 联动：选择其他时备注必填
    {
      name: "remark",
      label: "备注",
      componentType: "textarea",
      componentProps: {
        maxlength: 200,
        showWordLimit: true,
        placeholder: "请输入备注信息",
      },
      dependencies: {
        triggerFields: ["deliveryMethod"],
        required: (values) => values.deliveryMethod === "other",
        trigger: (values) => console.log("备注 - trigger", values),
      },
    },

    // componentProps 联动：服务评分 count 随配送方式动态变化
    {
      name: "serviceRating",
      label: "服务评分",
      componentType: "rate",
      dependencies: {
        triggerFields: ["deliveryMethod"],
        componentProps: (values) => {
          const countMap: Record<string, number> = {
            express: 5,
            selfPickup: 3,
            other: 7,
          }

          return {
            count: countMap[values.deliveryMethod as string] ?? 5,
          }
        },
      },
    },
  ]

  /**
   * 表单值变化回调
   *
   * 同步表单数据到预览区域。
   *
   * @param changedValues - 本次变化的字段键值对
   * @param latestValues - 变化后的完整表单数据
   */
  const handleValuesChange = (
    changedValues: Partial<DynamicFormValues>,
    latestValues: DynamicFormValues
  ) => {
    formData.value = latestValues
  }

  /**
   * 表单提交回调
   *
   * 校验通过后触发，输出表单数据到控制台。
   *
   * @param values - 校验通过的表单数据
   */
  const handleSubmit = (values: DynamicFormValues) => {
    console.log("提交数据:", values)
    alert("提交成功！数据已打印到控制台")

    console.log(
      " > ~ handleSubmit ~ formRef.value?.getViewSchemas():",
      formRef.value?.getViewSchemas()
    )
  }

  /**
   * 表单校验失败回调
   *
   * 校验未通过时触发，输出错误信息到控制台。
   *
   * @param errorInfo - 校验失败的错误信息
   */
  const handleSubmitFailed = (errorInfo: any) => {
    console.error("验证失败:", errorInfo)
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
