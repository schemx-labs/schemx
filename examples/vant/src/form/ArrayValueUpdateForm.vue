<script setup lang="ts">
  import { computed, ref } from "vue"

  import { Button } from "vant"

  import Schemx from "@schemx/vant"

  import type { SchemxField, SchemxInstance, UploadFile } from "@schemx/vant"

  /** Dynamic 数组中的成员值。 */
  interface ArrayMember {
    name: string
  }

  /** 数组赋值示例使用的表单值。 */
  interface ArrayValueFormValues {
    student: string[]
    attachment: UploadFile[]
    members: ArrayMember[]
    remark: string
  }

  /** 复用的空数组值，模拟业务代码中的 emptyValues。 */
  const emptyValues: Pick<ArrayValueFormValues, "student" | "attachment" | "members"> = {
    student: [],
    attachment: [],
    members: [],
  }

  /** 创建初始数据，保证每次重置都得到独立的数组。 */
  const createInitialValues = (): ArrayValueFormValues => ({
    student: ["math", "physics"],
    attachment: [
      {
        name: "成绩单.pdf",
        url: "https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg",
      },
    ],
    members: [{ name: "Ada" }, { name: "Grace" }],
    remark: "这个字段用于确认对象兄弟字段仍然保留。",
  })

  /** 表单实例引用。 */
  const formRef = ref<SchemxInstance<ArrayValueFormValues>>()

  /** 表单当前值，通过 v-model 观察 Store 的实际结果。 */
  const formData = ref<ArrayValueFormValues>(createInitialValues())

  /** 最近一次操作，用于明确当前结果由哪种 API 写入。 */
  const lastAction = ref("初始值")

  /** 普通数组和 Dynamic 数组的当前长度。 */
  const arraySummary = computed(() => ({
    student: formData.value.student.length,
    attachment: formData.value.attachment.length,
    members: formData.value.members.length,
  }))

  /** Schema 中同时包含普通数组字段和 Dynamic 数组字段。 */
  const schemas: SchemxField<ArrayValueFormValues>[] = [
    {
      key: "ordinary-arrays",
      label: "普通数组字段",
      children: [
        {
          name: "student",
          label: "学生课程",
          componentType: "checkbox",
          componentProps: {
            options: [
              { label: "数学", value: "math" },
              { label: "物理", value: "physics" },
              { label: "化学", value: "chemistry" },
            ],
          },
        },
        {
          name: "attachment",
          label: "附件",
          componentType: "upload",
          componentProps: {
            accept: "image/*,.pdf",
            maxCount: 3,
          },
        },
        {
          name: "remark",
          label: "备注",
          componentType: "input",
          componentProps: { clearable: true },
        },
      ],
    },
    {
      label: "Dynamic 数组对照",
      children: [
        {
          key: "members-dynamic",
          name: "members",
          label: "成员",
          item: [
            {
              key: "member-item",
              label: "成员信息",
              children: [
                {
                  name: "name",
                  label: "姓名",
                  componentType: "input",
                  componentProps: { placeholder: "请输入姓名" },
                },
              ],
            },
          ],
        },
      ],
    },
  ]

  /** 先写入非空数组，方便再次点击清空按钮观察结果。 */
  const fillArraysByBatch = (): void => {
    formRef.value?.setFieldsValue({
      student: ["math", "physics", "chemistry"],
      attachment: [
        {
          name: "成绩单.pdf",
          url: "https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg",
        },
        {
          name: "获奖证书.pdf",
          url: "https://fastly.jsdelivr.net/npm/@vant/assets/dog.jpeg",
        },
      ],
      members: [{ name: "Ada" }, { name: "Grace" }],
      remark: "通过 setFieldsValue 一次写入多个数组。",
    })
    lastAction.value = "setFieldsValue：写入非空数组"
  }

  /** 使用与问题相同的批量写法清空多个数组。 */
  const clearArraysByBatch = (): void => {
    formRef.value?.setFieldsValue({
      ...emptyValues,
      student: [],
      attachment: [],
    })
    lastAction.value = "setFieldsValue：批量清空 student、attachment、members"
  }

  /** 单独清空普通数组字段，作为对照组。 */
  const clearStudentBySingle = (): void => {
    formRef.value?.setFieldValue("student", [])
    lastAction.value = "setFieldValue：清空 student"
  }

  /** 单独清空 Dynamic 数组字段，验证数组根的结构同步。 */
  const clearMembersBySingle = (): void => {
    formRef.value?.setFieldValue("members", [])
    lastAction.value = "setFieldValue：清空 members"
  }

  const appendMembersBySingle = (): void => {
    formRef.value?.setFieldValue("members", (members) => [
      ...(members ?? []),
      { name: "Lin" },
    ])
    lastAction.value = "setFieldValue：清空 members"
  }

  /** 恢复非空初始值，方便重复验证。 */
  const resetForm = (): void => {
    formRef.value?.reset()
    lastAction.value = "reset：恢复初始值"
  }
</script>

<template>
  <div class="example-container">
    <h2>数组字段批量赋值</h2>
    <p class="description">
      用同一组操作对比普通数组字段和 Dynamic
      数组字段。先写入非空数组，再点击“批量清空”验证
      <code>setFieldsValue</code> 是否能整体替换数组；单字段按钮用于和
      <code>setFieldValue</code> 对照。
    </p>

    <Schemx
      ref="formRef"
      v-model="formData"
      :schemas="schemas"
      label-width="92px"
      :colon="true"
      :submitter="false"
      :resetter="false"
    />

    <div class="form-actions">
      <Button type="primary" @click="fillArraysByBatch">批量写入非空数组</Button>
      <Button @click="clearArraysByBatch">批量清空数组</Button>
      <Button @click="clearStudentBySingle">单独清空 student</Button>
      <Button @click="clearMembersBySingle">单独清空 members</Button>
      <Button @click="appendMembersBySingle">添加 members</Button>
      <Button @click="resetForm">恢复初始值</Button>
    </div>

    <div class="result-card">
      <p class="last-action">最近操作：{{ lastAction }}</p>
      <div class="array-summary">
        <span>student：{{ arraySummary.student }} 项</span>
        <span>attachment：{{ arraySummary.attachment }} 项</span>
        <span>members：{{ arraySummary.members }} 项</span>
      </div>
      <h3>当前表单值</h3>
      <pre>{{ JSON.stringify(formData, null, 2) }}</pre>
    </div>
  </div>
</template>

<style scoped>
  .example-container {
    max-width: 760px;
    margin: 0 auto;
    padding: 16px;
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

  .description code {
    padding: 2px 4px;
    color: #1989fa;
    background: #f0f7ff;
    border-radius: 3px;
  }

  .form-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }

  .result-card {
    margin-top: 24px;
    padding: 16px;
    background: #f5f5f5;
    border-radius: 8px;
  }

  .last-action {
    margin: 0 0 12px;
    color: #1989fa;
    font-size: 14px;
  }

  .array-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    margin-bottom: 16px;
    color: #555;
    font-size: 13px;
  }

  .result-card h3 {
    margin: 0 0 12px;
    color: #666;
    font-size: 14px;
  }

  .result-card pre {
    margin: 0;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
