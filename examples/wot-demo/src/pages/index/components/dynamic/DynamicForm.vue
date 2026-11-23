<template>
  <div class="example-container">
    <h2>动态表单示例</h2>
    <p class="description">
      演示 dependencies 声明式字段联动：通过"配送方式"单选控制其他字段的
      visible、disabled、readonly、required、componentProps 动态状态
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

  import Schemx from "@schemx/wot"

  import type { DynamicFormValues } from "../../../../../../wot-demo/src/types"
  import type { SchemxField, SchemxInstance } from "@schemx/wot"

  /** 表单实例引用，提供 submit、reset 等方法 */
  const formRef = ref<SchemxInstance>()

  /** 表单数据，通过 v-model 双向绑定实时同步联动效果 */
  const formData = ref<Record<string, any>>({})

  /**
   * 表单 Schema 配置
   *
   * 通过 dependencies 声明字段依赖关系，展示五种动态属性联动：
   * - visible 函数：快递配送时显示省市选择（picker）
   * - dict + dependsOn：省份变化时自动请求城市列表（picker）
   * - disabled 函数：自提时禁用配送距离（slider）
   * - readonly 函数：自提时购买数量只读（stepper）
   * - required 函数：选择其他时备注必填（textarea）
   * - componentProps 函数：服务评分 count 随配送方式动态变化（rate）
   */
  const schemas: SchemxField<DynamicFormValues>[] = [
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

    // visible 联动：仅快递配送时显示省市选择
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
      dependencies: {
        triggerFields: ["deliveryMethod"],
        visible: (values) => {
          return values.deliveryMethod === "express"
        },
      },
    },

    // dict + dependsOn 联动：省份变化时自动请求城市列表
    {
      name: "city",
      label: "城市选择",
      componentType: "picker",
      componentProps: {
        dict: {
          api: (values) => {
            console.log(values)
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
          shouldFetch: (values) => !!values.province,
          resetOnDepsChange: true,
          immediate: false,
        },
      },
      dependencies: {
        triggerFields: ["deliveryMethod"],
        visible: (values) => values.deliveryMethod === "express",
      },
    },

    // disabled 联动：自提时禁用配送距离
    {
      name: "distance",
      label: "配送距离",
      componentType: "slider",
      componentProps: {
        min: 0,
        max: 50,
        step: 1,
      },
      dependencies: {
        triggerFields: ["deliveryMethod"],
        disabled: (values) => values.deliveryMethod === "selfPickup",
      },
    },

    // readonly 联动：自提时购买数量只读
    {
      name: "quantity",
      label: "购买数量",
      componentType: "stepper",
      initialValue: 1,
      componentProps: {
        min: 1,
        max: 99,
        integer: true,
      },
      dependencies: {
        triggerFields: ["deliveryMethod"],
        disabled: (values) => values.deliveryMethod === "selfPickup",
      },
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
        disabled: (values) => values.deliveryMethod === "other",
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
    changedValues: Record<string, any>,
    latestValues: Record<string, any>
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
