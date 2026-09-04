<script setup lang="ts">
  import { computed, ref } from "vue"

  import { Button } from "vant"

  import Schemx from "@schemx/vant"

  import { createInitialFormData } from "./initialValues"
  import {
    campusOptions,
    cityOptions,
    deliveryMethodOptions,
    deliveryModeOptions,
    deliveryProvinceOptions,
    educationOptions,
    expressLevelOptions,
    genderOptions,
    hobbyOptions,
    memberAccessOptions,
    memberRoleOptions,
    orderAccessOptions,
    orderTypeOptions,
    pickupStoreOptions,
    regionOptions,
  } from "./options"

  import type { SchemxField, SchemxInstance } from "@schemx/vant"
  import type { FormGroupsValues } from "./types"

  /** 表单实例引用，统一管理合并示例的所有功能 Group。 */
  const formRef = ref<SchemxInstance<FormGroupsValues>>()

  /** 表单当前值，实时展示四个分区和 Dynamic 数组的完整结果。 */
  const formData = ref(createInitialFormData())

  /** 合并表单 Schema，覆盖全部内置 Renderer、Dynamic 和 Dependency 能力。 */
  const schemas: SchemxField<FormGroupsValues>[] = [
    {
      key: "basic-group",
      label: "基础表单 · 全部 Renderer",
      collapsible: true,
      children: [
        {
          key: "basic-information",
          label: "基础信息",
          children: [
            {
              name: "basic.username",
              label: "用户名（text）",
              componentType: "text",
              required: true,
              componentProps: { placeholder: "请输入用户名" },
            },
            {
              name: "basic.website",
              label: "个人网站（input）",
              componentType: "input",
              componentProps: { clearable: true, maxlength: 100 },
            },
            {
              name: "basic.phone",
              label: "手机号（sensitiveInput）",
              componentType: "sensitiveInput",
              componentProps: { clearable: true, hideOnBlur: false },
            },
            {
              name: "basic.bio",
              label: "个人简介（textarea）",
              componentType: "textarea",
              labelPosition: "top",
              componentProps: { maxlength: 200, showWordLimit: true },
            },
            {
              name: "basic.age",
              label: "年龄（number）",
              componentType: "number",
              componentProps: { min: 0, max: 150 },
            },
            {
              name: "basic.notification",
              label: "通知开关（switch）",
              componentType: "switch",
            },
            {
              name: "basic.gender",
              label: "性别（radio）",
              componentType: "radio",
              componentProps: { options: genderOptions },
            },
            {
              name: "basic.hobbies",
              label: "兴趣爱好（checkbox）",
              componentType: "checkbox",
              componentProps: { options: hobbyOptions },
            },
          ],
        },
        {
          key: "basic-choices",
          label: "日期、选择与数值 Renderer",
          children: [
            {
              name: "basic.birthday",
              label: "生日（date）",
              componentType: "date",
            },
            {
              name: "basic.travelDate",
              label: "出行日期（calendar）",
              componentType: "calendar",
            },
            {
              name: "basic.city",
              label: "城市（picker）",
              componentType: "picker",
              componentProps: { options: cityOptions },
            },
            {
              name: "basic.frequentCampus",
              label: "常用校区（picker）",
              componentType: "picker",
              componentProps: { options: campusOptions },
            },
            {
              name: "basic.preferredCities",
              label: "偏好城市（selectPicker）",
              componentType: "selectPicker",
              componentProps: {
                title: "请选择偏好城市",
                type: "checkbox",
                options: cityOptions.map(({ text, value }) => ({ label: text, value })),
              },
            },
            {
              name: "basic.education",
              label: "学历（selector）",
              componentType: "selector",
              componentProps: { options: educationOptions },
            },
            {
              name: "basic.satisfaction",
              label: "满意度（rate）",
              componentType: "rate",
              componentProps: { count: 5, allowHalf: true },
            },
            {
              name: "basic.volume",
              label: "音量（slider）",
              componentType: "slider",
              componentProps: { min: 0, max: 100, step: 5 },
            },
            {
              name: "basic.quantity",
              label: "数量（stepper）",
              componentType: "stepper",
              componentProps: { min: 1, max: 99, integer: true },
            },
            {
              name: "basic.avatar",
              label: "头像（upload）",
              componentType: "upload",
              componentProps: { accept: "image/*" },
            },
            {
              name: "basic.region",
              label: "地区（cascader）",
              componentType: "cascader",
              componentProps: { options: regionOptions },
            },
          ],
        },
      ],
    },
    {
      key: "dynamic-group",
      label: "动态表单 · Group 状态联动",
      collapsible: true,
      children: [
        {
          name: "dynamic.showDeliveryDetails",
          label: "显示配送详情",
          componentType: "switch",
        },
        {
          name: "dynamic.deliveryMethod",
          label: "配送方式",
          componentType: "radio",
          componentProps: { options: deliveryMethodOptions },
        },
        {
          key: "dynamic-details-group",
          label: "配送详情（visible / readonly / disabled）",
          collapsible: true,
          destroyOnCollapse: false,
          dependencies: {
            triggerFields: ["dynamic.showDeliveryDetails", "dynamic.deliveryMethod"],
            visible: ({ dynamic }) => dynamic.showDeliveryDetails,
            readonly: ({ dynamic }) => dynamic.deliveryMethod === "selfPickup",
            disabled: ({ dynamic }) => dynamic.deliveryMethod === "other",
          },
          children: [
            {
              name: "dynamic.province",
              label: "省份",
              componentType: "picker",
              componentProps: { options: deliveryProvinceOptions },
            },
            {
              name: "dynamic.city",
              label: "城市",
              componentType: "picker",
              componentProps: { options: cityOptions },
            },
            {
              name: "dynamic.distance",
              label: "配送距离",
              componentType: "slider",
              componentProps: { min: 0, max: 50, step: 1 },
            },
            {
              name: "dynamic.quantity",
              label: "购买数量",
              componentType: "stepper",
              componentProps: { min: 1, max: 99, integer: true },
            },
          ],
        },
        {
          name: "dynamic.remark",
          label: "配送备注",
          componentType: "textarea",
          componentProps: { maxlength: 200, showWordLimit: true },
          dependencies: {
            triggerFields: ["dynamic.deliveryMethod"],
            required: ({ dynamic }) => dynamic.deliveryMethod === "other",
          },
        },
        {
          name: "dynamic.serviceRating",
          label: "服务评分",
          componentType: "rate",
          dependencies: {
            triggerFields: ["dynamic.deliveryMethod"],
            componentProps: ({ dynamic }) => ({
              count: dynamic.deliveryMethod === "other" ? 7 : 5,
            }),
          },
        },
      ],
    },
    {
      key: "dependency-group",
      label: "字段联动 · Dependency 动态子树",
      collapsible: true,
      children: [
        {
          name: "dependency.orderType",
          label: "订单类型",
          componentType: "selector",
          componentProps: { options: orderTypeOptions },
        },
        {
          name: "dependency.showConfiguration",
          label: "显示订单配置",
          componentType: "switch",
        },
        {
          name: "dependency.orderAccess",
          label: "订单配置权限",
          componentType: "radio",
          componentProps: { options: orderAccessOptions },
        },
        {
          key: "dependency-configuration",
          to: ["dependency.orderType"],
          dependencies: {
            triggerFields: ["dependency.showConfiguration", "dependency.orderAccess"],
            visible: ({ dependency }) => dependency.showConfiguration,
            readonly: ({ dependency }) => dependency.orderAccess === "review",
            disabled: ({ dependency }) => dependency.orderAccess === "locked",
          },
          renderer: ({ dependency }): SchemxField<FormGroupsValues>[] => [
            {
              key: "dependency-configuration-fields",
              label: dependency.orderType === "express" ? "加急订单配置" : "标准订单配置",
              children:
                dependency.orderType === "express"
                  ? [
                      {
                        name: "dependency.expressLevel",
                        label: "加急等级",
                        componentType: "selector",
                        componentProps: { options: expressLevelOptions },
                      },
                      {
                        name: "dependency.expressFee",
                        label: "加急费用",
                        componentType: "slider",
                        componentProps: { min: 50, max: 500, step: 50 },
                      },
                    ]
                  : [
                      {
                        name: "dependency.quantity",
                        label: "数量",
                        componentType: "stepper",
                        componentProps: { min: 1, max: 999, integer: true },
                      },
                      {
                        name: "dependency.expectedDate",
                        label: "预计日期",
                        componentType: "date",
                      },
                      {
                        name: "dependency.deliveryMode",
                        label: "配送方式",
                        componentType: "radio",
                        componentProps: { options: deliveryModeOptions },
                      },
                      {
                        name: "dependency.pickupStore",
                        label: "自提门店",
                        componentType: "selector",
                        componentProps: { options: pickupStoreOptions },
                      },
                      {
                        name: "dependency.pickupCode",
                        label: "自提暗号",
                        componentType: "input",
                        componentProps: { placeholder: "选填" },
                      },
                    ],
            },
          ],
        },
      ],
    },
    /** Dynamic 数组 Schema；dependencies 控制整个数组及其行内字段的状态。 */
    {
      key: "dynamic-array-group",
      label: "动态数组 · Dynamic dependencies",
      collapsible: true,
      children: [
        {
          name: "dynamicArray.showMembers",
          label: "显示团队成员",
          componentType: "switch",
        },
        {
          name: "dynamicArray.memberAccess",
          label: "成员编辑权限",
          componentType: "radio",
          componentProps: { options: memberAccessOptions },
        },
        {
          key: "members-dynamic",
          name: "dynamicArray.members",
          label: "团队成员",
          dependencies: {
            triggerFields: ["dynamicArray.showMembers", "dynamicArray.memberAccess"],
            visible: ({ dynamicArray }) => dynamicArray.showMembers,
            readonly: ({ dynamicArray }) => dynamicArray.memberAccess === "readonly",
            disabled: ({ dynamicArray }) => dynamicArray.memberAccess === "disabled",
          },
          item: [
            {
              key: "member-row",
              label: "成员信息",
              children: [
                {
                  name: "name",
                  label: "姓名",
                  componentType: "input",
                  required: true,
                  componentProps: { placeholder: "请输入成员姓名" },
                },
                {
                  name: "role",
                  label: "角色",
                  componentType: "selector",
                  componentProps: { options: memberRoleOptions },
                },
                {
                  name: "enabled",
                  label: "启用",
                  componentType: "switch",
                },
              ],
            },
          ],
        },
      ],
    },
  ]

  /** 当前 Dynamic 数组行数。 */
  const memberCount = computed(() => formData.value.dynamicArray.members.length)

  /** 追加一个新的 Dynamic 数组项。 */
  const appendMember = (): void => {
    formRef.value?.setFieldValue("dynamicArray.members", (members) => [
      ...(members ?? []),
      {
        name: "新成员",
        role: "developer",
        enabled: true,
      },
    ])
  }

  /** 删除 Dynamic 数组末项。 */
  const removeLastMember = (): void => {
    formRef.value?.setFieldValue("dynamicArray.members", (members) => {
      const next = [...(members ?? [])]

      next.pop()

      return next
    })
  }

  /** 将 Dynamic 数组末项移动到首位。 */
  const moveLastMemberToFirst = (): void => {
    formRef.value?.setFieldValue("dynamicArray.members", (members) => {
      const next = [...(members ?? [])]
      const moved = next.pop()

      if (moved) {
        next.unshift(moved)
      }

      return next
    })
  }

  /** 输出合并表单的提交结果。 */
  const handleSubmit = (values: Readonly<Record<string, unknown>>): void => {
    console.log("基础 / 动态 / 联动 / 动态数组表单提交数据:", values)
  }

  /** 写入一组示例值，便于快速查看 v-model 的完整结构。 */
  const handleSetValues = (): void => {
    formRef.value?.setFieldsValue(({ basic, dynamic, dependency }) => ({
      basic: { ...basic, username: "李四", age: 30 },
      dynamic: { ...dynamic, deliveryMethod: "selfPickup" },
      dependency: { ...dependency, orderType: "express" },
    }))
  }

  /** 输出当前表单快照。 */
  const handleGetSnapshot = (): void => {
    console.log("合并表单快照:", formRef.value?.getFieldsSnapshot())
  }
</script>

<template>
  <div class="example-container">
    <h2>基础 / 动态 / 联动 / 动态数组</h2>
    <p class="description">
      一个 Schemx 组件承载全部示例，并通过 Group 进行分区。基础表单集中展示内置
      Renderer；动态表单演示 Group 状态联动；字段联动演示 Dependency 动态子树；动态数组
      演示 item 相对路径、增删移动，以及本组 dependencies 对数组容器状态的控制。
    </p>

    <Schemx
      ref="formRef"
      v-model="formData"
      :schemas="schemas"
      label-width="118px"
      :colon="true"
      :submitter="false"
      :resetter="false"
      @finish="handleSubmit"
    />

    <div class="form-actions">
      <Button type="primary" @click="formRef?.submit()">提交</Button>
      <Button @click="formRef?.validate()">校验</Button>
      <Button @click="formRef?.reset()">重置</Button>
      <Button @click="handleSetValues">设置示例值</Button>
      <Button @click="handleGetSnapshot">获取快照</Button>
    </div>

    <div class="form-actions array-actions">
      <Button type="primary" @click="appendMember">添加成员</Button>
      <Button :disabled="memberCount === 0" @click="removeLastMember">删除末项</Button>
      <Button :disabled="memberCount < 2" @click="moveLastMemberToFirst">
        末项移到首位
      </Button>
      <span class="array-meta">当前成员：{{ memberCount }} 人</span>
    </div>

    <div class="form-data-preview">
      <h3>合并表单数据预览</h3>
      <pre>{{ JSON.stringify(formData, null, 2) }}</pre>
    </div>
  </div>
</template>

<style scoped>
  .example-container {
    padding: 16px;
    max-width: 760px;
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
    line-height: 1.6;
  }

  .form-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }

  .array-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
  }

  .array-meta {
    color: #666;
    font-size: 13px;
  }

  .form-data-preview {
    margin-top: 24px;
    padding: 16px;
    background: #f5f5f5;
    border-radius: 8px;
  }

  .form-data-preview h3 {
    margin-bottom: 12px;
    color: #666;
    font-size: 14px;
  }

  .form-data-preview pre {
    margin: 0;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
