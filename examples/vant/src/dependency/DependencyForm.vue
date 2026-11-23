<template>
  <div class="example-container">
    <h2>字段联动示例</h2>
    <p class="description">
      演示 componentType: "dependency" 实现复杂字段联动：
      根据字段值动态生成不同的表单结构，多个 dependency 组合使用
    </p>

    <Schemx
      ref="formRef"
      v-model="formData"
      :schemas="schemas"
      :initial-values="{ orderType: 'standard' }"
      @finish="handleSubmit"
      @finish-failed="handleSubmitFailed"
      @values-change="handleValuesChange"
    />

    <div class="form-actions">
      <Button type="primary" @click="formRef?.submit()">提交</Button>
      <Button @click="formRef?.reset()">重置</Button>
      <Button @click="handleAsyncRace">快速切换异步依赖</Button>
      <Button @click="handleNestedCustom">切到嵌套定制</Button>
      <Button @click="handleUnmountValidation">验证卸载清理</Button>
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
  import { z } from "zod"

  import type { DependencyFormValues } from "../types"
  import type { SchemxField, SchemxInstance } from "@schemx/vant"

  /** 表单实例引用，提供 submit、reset 等方法 */
  const formRef = ref<SchemxInstance>()

  /** 表单数据，通过 v-model 双向绑定实时展示动态结构变化 */
  const formData = ref<Record<string, any>>({
    orderType: "standard",
  })

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms)
    })

  /**
   * 级联地址选项数据
   *
   * 用于定制订单分支的 cascader 级联地址选择，
   * 包含省 -> 市 -> 区三级结构。
   */
  const cascaderOptions = [
    {
      label: "浙江省",
      value: "zhejiang",
      children: [
        {
          label: "杭州市",
          value: "hangzhou",
          children: [
            { label: "西湖区", value: "xihu" },
            { label: "余杭区", value: "yuhang" },
          ],
        },
        {
          label: "宁波市",
          value: "ningbo",
          children: [
            { label: "海曙区", value: "haishu" },
            { label: "江北区", value: "jiangbei" },
          ],
        },
      ],
    },
    {
      label: "广东省",
      value: "guangdong",
      children: [
        {
          label: "广州市",
          value: "guangzhou",
          children: [
            { label: "天河区", value: "tianhe" },
            { label: "越秀区", value: "yuexiu" },
          ],
        },
        {
          label: "深圳市",
          value: "shenzhen",
          children: [
            { label: "南山区", value: "nanshan" },
            { label: "福田区", value: "futian" },
          ],
        },
      ],
    },
  ]

  /**
   * 表单 Schema 配置
   *
   * 通过 componentType: "dependency" 覆盖几类复杂场景：
   * - 多层嵌套 dependency：orderType -> deliveryMode/customCategory -> 子字段
   * - 异步 dependency 竞态：expressLevel 快速切换时旧结果应被丢弃
   * - 动态 group children：dependency renderer 返回 group + children
   * - 卸载清理：发票必填字段卸载后不应继续阻塞 submit
   */
  const schemas = <SchemxField<DependencyFormValues>[]>[
    /** 控制字段：订单类型（selector 选择 standard / express / custom 切换分支） */
    {
      name: "orderType",
      label: "订单类型",
      componentType: "selector",
      required: true,
      componentProps: {
        options: [
          { label: "标准订单", value: "standard" },
          { label: "加急订单", value: "express" },
          { label: "定制订单", value: "custom" },
        ],
      },
      initialValue: "standard",
    },

    /** 主 dependency：根据 orderType 动态生成不同订单结构 */
    {
      componentType: "dependency",
      to: ["orderType"],
      renderer: async (values) => {
        console.log("values.orderType", values.orderType)
        const orderType = values.orderType

        /** 标准订单分支：包含二级 deliveryMode dependency 和 quantity dependency */
        if (orderType === "standard") {
          return [
            {
              label: "标准订单配置",
              componentType: "group",
              children: [
                {
                  name: "quantity",
                  label: "数量",
                  componentType: "stepper",
                  required: true,
                  componentProps: { min: 1, max: 999, integer: true },
                  rules: z.number({ message: "请输入数量" }).min(1, "数量至少为 1"),
                },
                {
                  name: "expectedDate",
                  label: "预计日期",
                  componentType: "date",
                  required: true,
                  rules: "required",
                },
                {
                  name: "deliveryMode",
                  label: "配送方式",
                  componentType: "radio",
                  initialValue: "courier",
                  componentProps: {
                    options: [
                      { label: "快递配送", value: "courier" },
                      { label: "门店自提", value: "pickup" },
                    ],
                  },
                },
                {
                  componentType: "dependency",
                  to: ["deliveryMode"],
                  renderer: (deliveryValues) => {
                    if (deliveryValues.deliveryMode === "pickup") {
                      console.log(deliveryValues.deliveryMode)

                      return [
                        {
                          name: "pickupStore",
                          label: "自提门店",
                          componentType: "selector",
                          required: true,
                          componentProps: {
                            options: [
                              { label: "湖滨银泰店", value: "hubin" },
                              { label: "万象城店", value: "mixc" },
                              { label: "未来科技城店", value: "future" },
                            ],
                          },
                          rules: "required",
                        },
                        {
                          name: "pickupCode",
                          label: "自提暗号",
                          componentType: "input",
                          componentProps: {
                            placeholder: "选填，用于门店核验",
                          },
                        },
                      ]
                    }

                    return [
                      {
                        name: "receiverPhone",
                        label: "收件电话",
                        componentType: "input",
                        required: true,
                        componentProps: {
                          type: "number",
                          maxlength: 11,
                          placeholder: "请输入收件手机号",
                        },
                        rules: z
                          .string()
                          .regex(/^1[3-9]\d{9}$/, "请输入有效的收件手机号"),
                      },
                      {
                        name: "shippingAddress",
                        label: "配送地址",
                        componentType: "cascader",
                        required: true,
                        componentProps: {
                          options: cascaderOptions,
                        },
                        rules: "required",
                      },
                    ]
                  },
                },
                {
                  componentType: "dependency",
                  to: ["quantity"],
                  renderer: (quantityValues) => {
                    if ((quantityValues.quantity || 0) < 100) return []

                    return [
                      {
                        name: "bulkReason",
                        label: "大批量说明",
                        componentType: "textarea",
                        required: true,
                        labelPosition: "top",
                        componentProps: {
                          maxlength: 120,
                          showWordLimit: true,
                          placeholder: "数量超过 100 时需要填写用途说明",
                        },
                        rules: z.string().min(5, "请填写至少 5 个字符的说明"),
                      },
                    ]
                  },
                },
              ],
            },
          ]
        }

        /** 加急订单分支：异步 dependency 用于验证竞态和旧结果丢弃 */
        if (orderType === "express") {
          return [
            {
              label: "加急订单配置",
              componentType: "group",
              children: [
                {
                  name: "expressLevel",
                  label: "加急等级",
                  componentType: "selector",
                  initialValue: "priority",
                  required: true,
                  componentProps: {
                    options: [
                      { label: "优先处理", value: "priority" },
                      { label: "当日达", value: "same_day" },
                      { label: "专人跟进", value: "concierge" },
                    ],
                  },
                  rules: "required",
                },
                {
                  componentType: "dependency",
                  to: ["expressLevel"],
                  renderer: async (expressValues) => {
                    const level = expressValues.expressLevel

                    // same_day 故意慢一点，配合快速切换验证旧异步结果不会覆盖新 subtree。
                    await sleep(level === "same_day" ? 500 : 80)

                    if (level === "same_day") {
                      return [
                        {
                          name: "sameDayTime",
                          label: "当日达时段",
                          componentType: "picker",
                          required: true,
                          componentProps: {
                            options: [
                              { text: "12:00 前", value: "before_12" },
                              { text: "18:00 前", value: "before_18" },
                              { text: "22:00 前", value: "before_22" },
                            ],
                          },
                          rules: "required",
                        },
                        {
                          name: "sameDayContact",
                          label: "紧急联系人",
                          componentType: "input",
                          required: true,
                          rules: "required",
                        },
                      ]
                    }

                    if (level === "concierge") {
                      return [
                        {
                          name: "conciergeBudget",
                          label: "服务预算",
                          componentType: "slider",
                          required: true,
                          componentProps: { min: 300, max: 3000, step: 100 },
                          rules: z.number().min(300, "预算至少 300 元"),
                        },
                        {
                          name: "conciergeBrief",
                          label: "跟进要求",
                          componentType: "textarea",
                          required: true,
                          labelPosition: "top",
                          rules: z.string().min(5, "请描述跟进要求"),
                        },
                      ]
                    }

                    return [
                      {
                        name: "expressFee",
                        label: "加急费用",
                        componentType: "slider",
                        required: true,
                        componentProps: { min: 50, max: 500, step: 50 },
                        rules: z.number().min(50, "加急费用至少 50 元"),
                      },
                      {
                        name: "serviceRating",
                        label: "期望服务",
                        componentType: "rate",
                        required: true,
                        componentProps: { count: 5, allowHalf: true },
                        rules: z.number().min(1, "请至少给 1 分"),
                      },
                    ]
                  },
                },
              ],
            },
          ]
        }

        /** 定制订单分支：多层嵌套 dependency + 动态 group */
        return [
          {
            label: "定制订单配置",
            componentType: "group",
            children: [
              {
                name: "customCategory",
                label: "定制类型",
                componentType: "selector",
                initialValue: "gift",
                required: true,
                componentProps: {
                  options: [
                    { label: "礼盒定制", value: "gift" },
                    { label: "活动物料", value: "event" },
                    { label: "企业采购", value: "enterprise" },
                  ],
                },
                rules: "required",
              },
              {
                componentType: "dependency",
                to: ["customCategory"],
                renderer: (customValues) => {
                  if (customValues.customCategory === "event") {
                    return [
                      {
                        name: "eventDateRange",
                        label: "活动周期",
                        componentType: "calendar",
                        required: true,
                        componentProps: { type: "range" },
                        rules: "required",
                      },
                      {
                        name: "attendeeCount",
                        label: "参与人数",
                        componentType: "stepper",
                        required: true,
                        componentProps: { min: 1, max: 5000, integer: true },
                        rules: z.number().min(1, "请输入参与人数"),
                      },
                    ]
                  }

                  if (customValues.customCategory === "enterprise") {
                    return [
                      {
                        name: "companyName",
                        label: "企业名称",
                        componentType: "input",
                        required: true,
                        rules: z.string().min(2, "请输入企业名称"),
                      },
                      {
                        name: "approvalLevel",
                        label: "审批等级",
                        componentType: "radio",
                        initialValue: "normal",
                        componentProps: {
                          options: [
                            { label: "普通审批", value: "normal" },
                            { label: "法务审批", value: "legal" },
                          ],
                        },
                      },
                      {
                        componentType: "dependency",
                        to: ["approvalLevel"],
                        renderer: (approvalValues) => {
                          if (approvalValues.approvalLevel !== "legal") return []

                          return [
                            {
                              name: "contractAttachment",
                              label: "合同附件",
                              componentType: "upload",
                              required: true,
                              componentProps: { accept: ".pdf,.doc,.docx" },
                              rules: "required",
                            },
                          ]
                        },
                      },
                    ]
                  }

                  return [
                    {
                      name: "address",
                      label: "收货区域",
                      componentType: "cascader",
                      required: true,
                      componentProps: {
                        options: cascaderOptions,
                      },
                      rules: "required",
                    },
                    {
                      name: "giftMessage",
                      label: "礼盒文案",
                      componentType: "textarea",
                      labelPosition: "top",
                      componentProps: {
                        maxlength: 80,
                        showWordLimit: true,
                      },
                    },
                  ]
                },
              },
            ],
          },
        ]
      },
    },

    /** 控制字段：附加服务（checkbox 多选，选中"需要发票"时动态生成字段） */
    {
      name: "additionalServices",
      label: "附加服务",
      componentType: "checkbox",
      componentProps: {
        options: [
          { label: "需要发票", value: "invoice" },
          { label: "礼品包装", value: "gift_wrap" },
          { label: "延保服务", value: "warranty" },
        ],
      },
    },

    /** 全局 dependency：根据 additionalServices 动态生成多个可卸载子树 */
    {
      componentType: "dependency",
      to: ["additionalServices"],
      renderer: (values) => {
        const services = values.additionalServices || []

        const dynamicServices: SchemxField<DependencyFormValues>[] = []

        if (services.includes("invoice")) {
          dynamicServices.push({
            label: "发票信息",
            componentType: "group",
            children: [
              {
                name: "invoiceAttachment",
                label: "发票附件上传",
                componentType: "upload",
                required: true,
                componentProps: {
                  accept: "image/*,.pdf",
                },
                rules: "required",
              },
              {
                name: "invoiceAmount",
                label: "金额",
                componentType: "number",
                required: true,
                componentProps: {
                  min: 0,
                },
                rules: z.number({ message: "请输入金额" }).min(0.01, "金额必须大于 0"),
              },
            ],
          })
        }

        if (services.includes("gift_wrap")) {
          dynamicServices.push({
            label: "礼品包装",
            componentType: "group",
            children: [
              {
                name: "giftWrapStyle",
                label: "包装风格",
                componentType: "selector",
                required: true,
                componentProps: {
                  options: [
                    { label: "商务简洁", value: "business" },
                    { label: "节日氛围", value: "festival" },
                    { label: "儿童趣味", value: "kids" },
                  ],
                },
                rules: "required",
              },
              {
                componentType: "dependency",
                to: ["giftWrapStyle"],
                renderer: (giftValues) => {
                  if (giftValues.giftWrapStyle !== "festival") return []

                  return [
                    {
                      name: "festivalTheme",
                      label: "节日主题",
                      componentType: "picker",
                      required: true,
                      componentProps: {
                        options: [
                          { text: "春节", value: "spring" },
                          { text: "中秋", value: "mid_autumn" },
                          { text: "圣诞", value: "christmas" },
                        ],
                      },
                      rules: "required",
                    },
                  ]
                },
              },
            ],
          })
        }

        if (services.includes("warranty")) {
          dynamicServices.push({
            label: "延保服务",
            componentType: "group",
            children: [
              {
                name: "warrantyYears",
                label: "延保年限",
                componentType: "stepper",
                required: true,
                componentProps: { min: 1, max: 5, integer: true },
                rules: z.number().min(1, "请选择延保年限"),
              },
              {
                name: "warrantyContact",
                label: "售后联系人",
                componentType: "input",
                required: true,
                rules: "required",
              },
            ],
          })
        }

        return dynamicServices
      },
    },
  ]

  const handleAsyncRace = async () => {
    formRef.value?.setFieldValue("orderType", "express")
    await sleep(0)
    formRef.value?.setFieldValue("expressLevel", "same_day")
    await sleep(20)
    formRef.value?.setFieldValue("expressLevel", "concierge")
  }

  const handleNestedCustom = async () => {
    formRef.value?.setFieldValue("orderType", "custom")
    await sleep(0)
    formRef.value?.setFieldValue("customCategory", "enterprise")
    await sleep(0)
    formRef.value?.setFieldValue("approvalLevel", "legal")
  }

  const handleUnmountValidation = async () => {
    const form = formRef.value
    if (!form) return

    form.setFieldValue("orderType", "standard")
    await form.waitForDependencies()

    form.setFieldValue("quantity", 1)
    form.setFieldValue("expectedDate", "2026-05-09")
    form.setFieldValue("deliveryMode", "pickup")
    await form.waitForDependencies()

    form.setFieldValue("pickupStore", "hubin")
    form.setFieldValue("additionalServices", ["invoice"])
    await form.waitForDependencies()

    console.log(form.getFieldsSnapshot())
    await sleep(0)

    form.setFieldValue("additionalServices", [])
    await form.waitForDependencies()
    await form.submit()
  }

  /**
   * 表单值变化回调
   *
   * 同步表单数据到预览区域。
   *
   * @param changedValues - 本次变化的字段键值对
   * @param latestValues - 变化后的完整表单数据
   */
  const handleValuesChange = (
    _changedValues: Record<string, any>,
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
  const handleSubmit = (values: DependencyFormValues) => {
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
