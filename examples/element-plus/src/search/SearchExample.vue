<script setup lang="ts">
  import { computed, ref } from "vue"

  import { SchemxSearch } from "@schemx/element-plus"
  import { ElButton, ElTable, ElTableColumn } from "element-plus"

  import type { SchemxField, SchemxInstance } from "@schemx/element-plus"

  /**
   * 搜索条件独立于下方 Renderer 表单的数据。
   */
  interface SearchValues {
    /**
     * 项目名称关键字。
     */
    keyword: string
    /**
     * 项目当前状态，空字符串表示不限。
     */
    status: string
    /**
     * 所属部门，空字符串表示不限。
     */
    department: string
    /**
     * 负责人姓名关键字。
     */
    owner: string
    /**
     * 所在城市，空字符串表示不限。
     */
    city: string
    /**
     * 项目来源，空字符串表示不限。
     */
    source: string
  }

  /**
   * 本地查询结果的展示字段。
   */
  interface ProjectRecord extends Omit<SearchValues, "keyword"> {
    /**
     * 表格行的唯一标识。
     */
    id: number
    /**
     * 供关键字搜索的项目名称。
     */
    name: string
  }

  // 提供定位能力的完整表单实例。
  const searchRef = ref<SchemxInstance<SearchValues>>()

  // 自动列由浏览器自然换行，Search 按实际第一行高度折叠。
  const autoColumns = ref(false)

  // 双向控制收起状态，同时展示当前状态。
  const collapsed = ref(true)

  /**
   * 接受折叠切换请求，并同步示例中的状态标签。
   * @param next - 搜索区请求的折叠状态。
   */
  const handleCollapsedChange = (next: boolean): void => {
    collapsed.value = next
  }

  // 查询与重置共用的空条件基线。
  const initialValues: SearchValues = {
    keyword: "",
    status: "",
    department: "",
    owner: "",
    city: "",
    source: "",
  }

  // 当前编辑中的条件；输入变化不会立即过滤结果。
  const values = ref<SearchValues>({ ...initialValues })

  // 只有查询或重置后才更新的条件快照。
  const appliedValues = ref<SearchValues>({ ...initialValues })

  // 每行三个字段，第二行包含可通过定位按钮自动展开的负责人。
  const schemas: SchemxField<SearchValues>[] = [
    {
      name: "keyword",
      label: "项目名称",
      componentType: "input",
      componentProps: { placeholder: "输入项目名称", clearable: true },
    },
    {
      name: "status",
      label: "状态",
      componentType: "select",
      componentProps: {
        placeholder: "全部状态",
        clearable: true,
        options: [
          { label: "进行中", value: "进行中" },
          { label: "已完成", value: "已完成" },
        ],
      },
    },
    {
      name: "department",
      label: "部门",
      componentType: "select",
      componentProps: {
        placeholder: "全部部门",
        clearable: true,
        options: [
          { label: "产品部", value: "产品部" },
          { label: "研发部", value: "研发部" },
        ],
      },
    },
    {
      name: "owner",
      label: "负责人",
      componentType: "input",
      componentProps: { placeholder: "输入负责人", clearable: true },
    },
    {
      name: "city",
      label: "城市",
      componentType: "select",
      componentProps: {
        placeholder: "全部城市",
        clearable: true,
        options: [
          { label: "上海", value: "上海" },
          { label: "杭州", value: "杭州" },
        ],
      },
    },
    {
      name: "source",
      label: "来源",
      componentType: "select",
      componentProps: {
        placeholder: "全部来源",
        clearable: true,
        options: [
          { label: "内部立项", value: "内部立项" },
          { label: "客户需求", value: "客户需求" },
        ],
      },
    },
  ]

  // 示例查询在本地完成，不依赖网络接口。
  const projects: ProjectRecord[] = [
    {
      id: 1,
      name: "课程管理平台",
      status: "进行中",
      department: "研发部",
      owner: "张明",
      city: "上海",
      source: "内部立项",
    },
    {
      id: 2,
      name: "学员服务中心",
      status: "已完成",
      department: "产品部",
      owner: "李华",
      city: "杭州",
      source: "客户需求",
    },
    {
      id: 3,
      name: "教学数据看板",
      status: "进行中",
      department: "产品部",
      owner: "张明",
      city: "上海",
      source: "客户需求",
    },
    {
      id: 4,
      name: "课程预约系统",
      status: "已完成",
      department: "研发部",
      owner: "王琳",
      city: "杭州",
      source: "内部立项",
    },
  ]

  // 展示最近一次提交的完整条件，包括当前已折叠的字段。
  const filteredProjects = computed(() => {
    // 读取提交快照而非编辑值，保持“点击查询才更新”的行为。
    const conditions = appliedValues.value

    // project 是待匹配的项目，各下拉条件为空时不限制结果。
    return projects.filter(
      (project) =>
        project.name.includes(conditions.keyword.trim()) &&
        project.owner.includes(conditions.owner.trim()) &&
        (!conditions.status || project.status === conditions.status) &&
        (!conditions.department || project.department === conditions.department) &&
        (!conditions.city || project.city === conditions.city) &&
        (!conditions.source || project.source === conditions.source)
    )
  })

  /**
   * 使用查询按钮提交的完整条件刷新结果。
   * @param conditions - 包含已折叠字段的当前表单快照。
   */
  const handleSearch = (conditions: SearchValues): void => {
    appliedValues.value = { ...conditions }
  }

  /**
   * 重置结果列表，折叠状态由 Search 保持。
   */
  const handleReset = (): void => {
    appliedValues.value = { ...initialValues }
  }

  /**
   * 自动展开第二行并滚动到负责人字段。
   */
  const scrollToOwner = async (): Promise<void> => {
    await searchRef.value?.scrollToField("owner", {
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      highlight: { duration: 100000 },
    })
  }

  // 折叠状态和布局可直接通过 SchemxSearch 的 Props 配置。
  const usageCode = `<SchemxSearch
  ref="searchRef"
  v-model="values"
  :schemas="schemas"
  :collapse="true"
  :col="{ span: 8 }"
  :on-finish="handleSearch"
/>

// 自动列：col="auto"
await searchRef.value?.scrollToField("owner")`
</script>

<template>
  <section class="example-panel">
    <header class="panel-heading">
      <div>
        <h2>搜索与折叠</h2>
        <p class="panel-description">
          通过 collapse 配置折叠，onFinish 接收完整查询条件。
        </p>
      </div>
    </header>
    <div class="demo-toolbar">
      <div class="demo-segmented" role="group" aria-label="列布局">
        <button type="button" :aria-pressed="!autoColumns" @click="autoColumns = false">
          col: { span: 8 }</button
        ><button type="button" :aria-pressed="autoColumns" @click="autoColumns = true">
          col: 'auto'
        </button>
      </div>
      <ElButton size="small" @click="scrollToOwner">scrollToField('owner')</ElButton>
    </div>
    <div class="filter-preview">
      <SchemxSearch
        ref="searchRef"
        v-model="values"
        :collapse="{
          collapsed,
          onCollapsedChange: handleCollapsedChange,
          buttonProps: { type: 'primary', link: true },
        }"
        :schemas="schemas"
        :col="autoColumns ? 'auto' : { span: 8, xs: 24, sm: 12, lg: 8 }"
        :row="{ gutter: [14, 16] }"
        :label-width="72"
        :on-finish="handleSearch"
        :on-reset="handleReset"
      />
    </div>
    <ElTable
      :data="filteredProjects"
      row-key="id"
      size="small"
      empty-text="没有匹配项，请重置条件。"
      ><ElTableColumn prop="name" label="项目名称" min-width="170" /><ElTableColumn
        prop="status"
        label="状态"
        min-width="90" /><ElTableColumn
        prop="department"
        label="部门"
        min-width="90" /><ElTableColumn
        prop="owner"
        label="负责人"
        min-width="90" /><ElTableColumn prop="city" label="城市" min-width="80"
    /></ElTable>
    <p class="result-count" aria-live="polite">
      匹配 {{ filteredProjects.length }} / {{ projects.length }} 项
    </p>
  </section>
  <details class="api-source">
    <summary>API 用法</summary>
    <pre class="data-preview">{{ usageCode }}</pre>
  </details>
  <details class="api-source">
    <summary>查询条件</summary>
    <pre class="data-preview">{{ JSON.stringify(appliedValues, null, 2) }}</pre>
  </details>
</template>

<style scoped>
  .filter-preview {
    padding: 14px 16px;
  }
  .filter-preview :deep(.schemx-field__label) {
    font-size: 12px;
  }
  .filter-preview :deep(.schemx-search-fields) {
    container-type: inline-size;
  }
  /*
   * 根据字段区可用宽度调整栅格，自动列仍按内容自然换行。
   */
  @container (max-width: 760px) {
    .filter-preview :deep(.schemx-col:not(.schemx-col--auto)) {
      flex: 0 0 50%;
      max-width: 50%;
    }
  }
  @container (max-width: 520px) {
    .filter-preview :deep(.schemx-col:not(.schemx-col--auto)) {
      flex: 0 0 100%;
      max-width: 100%;
    }
  }
  .result-count {
    margin: 10px 16px;
    color: var(--demo-muted);
    font-size: 12px;
  }
</style>
