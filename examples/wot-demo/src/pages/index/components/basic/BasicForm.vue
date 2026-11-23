<template>
  <div class="example-container">
    <h2>基础表单示例</h2>
    <p class="description">
      演示全部 17 种 ComponentType、initialValues 初始值、布局配置、实例方法调用、
      事件监听和实时数据预览
    </p>

    <Schemx
      ref="formRef"
      v-model="formData"
      :schemas="schemas"
      :initial-values="initialValues"
      label-width="80px"
      :disabled="globalDisibled"
      :colon="true"
      @finish="handleSubmit"
      @values-change="handleValuesChange"
    />

    <div class="form-actions">
      <button class="btn btn-primary" @click="formRef?.submit()">提交</button>
      <button class="btn" @click="formRef?.validate()">校验</button>
      <button class="btn" @click="formRef?.reset()">重置</button>
      <button class="btn" @click="handleSetValues">设置值</button>
      <button class="btn" @click="handleGetSnapshot">获取快照</button>
      <button class="btn" @click="handleSetGlobalDisibled">
        设置disabled:{{ globalDisibled }}
      </button>
      <button class="btn" @click="handleSetUsernameDisibled">
        设置用户名disabled:{{ usernameDisibled }}
      </button>
    </div>

    <div class="form-data-preview">
      <h3>表单数据预览</h3>
      <pre>{{ JSON.stringify(formData, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from "vue"

  import Schemx from "@schemx/wot"

  import type { BasicFormValues } from "@/types"
  import type { SchemxField, SchemxInstance } from "@schemx/wot"

  /** 表单实例引用，提供 submit、validate、reset 等方法 */
  const formRef = ref<SchemxInstance>()

  /** 表单数据，通过 v-model 双向绑定实时同步 */
  const formData = ref<Record<string, any>>({})

  /**
   * 表单初始值
   *
   * 设置 username、age、notification 的默认值，演示 initialValues 用法。
   */
  const initialValues = {
    username: "张三",
    age: 25,
    notification: true,
  }

  const globalDisibled = ref(false)
  const usernameDisibled = ref(false)

  const handleSetGlobalDisibled = () => {
    globalDisibled.value = !globalDisibled.value
    // do something
  }

  const handleSetUsernameDisibled = () => {
    usernameDisibled.value = !usernameDisibled.value
    // do something
  }

  /**
   * 表单 Schema 配置
   *
   * 覆盖全部 17 种 ComponentType：
   * text、input、textarea、number、switch、radio、checkbox、
   * date、calendar、picker、selector、selectPicker、rate、slider、stepper、upload、cascader
   */
  const schemas = computed<SchemxField<BasicFormValues>[]>(() => [
    {
      label: "基本信息",
      componentType: "group",
      children: [
        {
          name: "username",
          label: "用户名",
          componentType: "text",
          required: true,
          disabled: usernameDisibled.value,
          componentProps: {
            placeholder: "请输入用户名",
            clearable: true,
          },
        },
        {
          name: "website",
          label: "个人网站",
          componentType: "input",
          initialValue: "www.baidu.com",
          componentProps: {
            placeholder: "请输入个人网站地址",
            clearable: true,
            maxlength: 100,
            showWordLimit: true,
          },
        },
        {
          name: "bio",
          label: "个人简介",
          componentType: "textarea",
          labelPosition: "top",
          componentProps: {
            maxlength: 200,
            showWordLimit: true,
          },
        },
        {
          name: "age",
          label: "年龄",
          componentType: "number",
          componentProps: {
            min: 0,
            max: 150,
          },
        },
      ],
    },

    {
      name: "notification",
      label: "通知开关",
      componentType: "switch",
    },
    {
      name: "gender",
      label: "性别",
      componentType: "radio",
      componentProps: {
        options: [
          { label: "男", value: "male" },
          { label: "女", value: "female" },
        ],
      },
    },
    {
      name: "hobbies",
      label: "兴趣爱好",
      componentType: "checkbox",
      initialValue: [],
      componentProps: {
        options: [
          { label: "阅读", value: "reading" },
          { label: "运动", value: "sports" },
          { label: "音乐", value: "music" },
          { label: "旅行", value: "travel" },
        ],
      },
    },
    {
      name: "birthday",
      label: "生日",
      componentType: "date",
    },
    {
      name: "travelDate",
      label: "出行日期",
      componentType: "calendar",
    },
    {
      name: "city",
      label: "城市",
      componentType: "picker",
      componentProps: {
        options: [
          { label: "北京", value: "beijing" },
          { label: "上海", value: "shanghai" },
          { label: "广州", value: "guangzhou" },
          { label: "深圳", value: "shenzhen" },
          { label: "杭州", value: "hangzhou" },
        ],
      },
    },
    {
      name: "education",
      label: "学历",
      componentType: "selector",
      componentProps: {
        disabled: true,
        options: [
          { label: "高中", value: "high_school" },
          { label: "大专", value: "college" },
          { label: "本科", value: "bachelor" },
          { label: "硕士", value: "master" },
          { label: "博士", value: "doctor" },
        ],
      },
    },
    {
      name: "preferredCities",
      label: "偏好城市",
      componentType: "selectPicker",
      componentProps: {
        title: "请选择偏好城市",
        type: "checkbox",
        columns: [
          { label: "北京", value: "beijing" },
          { label: "上海", value: "shanghai" },
          { label: "广州", value: "guangzhou" },
          { label: "深圳", value: "shenzhen" },
          { label: "杭州", value: "hangzhou" },
        ],
      },
    },
    {
      name: "satisfaction",
      label: "满意度",
      componentType: "rate",
      componentProps: {
        count: 5,
        allowHalf: true,
      },
    },
    {
      name: "volume",
      label: "音量",
      componentType: "slider",
      componentProps: {
        min: 0,
        max: 100,
        step: 5,
      },
    },
    {
      name: "quantity",
      label: "数量",
      componentType: "stepper",
      componentProps: {
        min: 1,
        max: 99,
        integer: true,
      },
    },
    {
      label: "头像分组",
      componentType: "group",
      children: [
        {
          name: "avatar",
          label: "头像",
          componentType: "upload",
          componentProps: {
            accept: "image",
          },
        },
      ],
    },
    {
      name: "region",
      label: "地区",
      componentType: "cascader",
      componentProps: {
        options: [
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
            label: "江苏省",
            value: "jiangsu",
            children: [
              {
                label: "南京市",
                value: "nanjing",
                children: [
                  { label: "玄武区", value: "xuanwu" },
                  { label: "鼓楼区", value: "gulou" },
                ],
              },
              {
                label: "苏州市",
                value: "suzhou",
                children: [
                  { label: "姑苏区", value: "gusu" },
                  { label: "工业园区", value: "industrial_park" },
                ],
              },
            ],
          },
        ],
      },
    },
  ])

  /**
   * 表单提交回调
   *
   * 校验通过后触发，输出表单数据到控制台。
   *
   * @param values - 校验通过的表单数据
   */
  const handleSubmit = (values: BasicFormValues) => {
    console.log("表单提交:", values)
    alert("提交成功！数据已打印到控制台")
  }

  /**
   * 表单值变化回调
   *
   * 任意字段值变化时触发，输出变化字段和最新值。
   *
   * @param changedValues - 本次变化的字段键值对
   * @param latestValues - 变化后的完整表单数据
   */
  const handleValuesChange = (
    changedValues: Record<string, any>,
    latestValues: Record<string, any>
  ) => {
    formData.value = latestValues
    console.log("值变化:", changedValues, latestValues)
  }

  /**
   * 手动设置表单字段值
   *
   * 演示 formRef.setFieldsValue() 批量设置字段值的用法。
   */
  const handleSetValues = () => {
    formRef.value?.setFieldsValue({
      username: "李四",
      age: 30,
      gender: "female",
      notification: false,
      satisfaction: 4.5,
      volume: 60,
      quantity: 5,
    })
  }

  /**
   * 获取表单数据快照
   *
   * 演示 formRef.getFieldsSnapshot() 获取当前表单值快照的用法。
   */
  const handleGetSnapshot = () => {
    const snapshot = formRef.value?.getFieldsSnapshot()
    console.log("表单快照:", snapshot)
    alert("快照已打印到控制台")
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
