import { createSchemx, createSearchComponent, SchemxSearch } from "../../index"

import type { SchemxSearchPlugin, SchemxSearchProps } from "../../index"

// 创建器绑定后仍保留 Search 的业务类型与更新事件。
const Search: SchemxSearchPlugin = createSearchComponent(createSchemx().createForm)

Search<{ keyword: string }>({
  modelValue: { keyword: "" },
  "onUpdate:modelValue": (values) => {
    // values 保持搜索条件类型。
    const keyword: string = values.keyword

    void keyword
    // @ts-expect-error 搜索条件不会退化为 any。
    const invalid: number = values.keyword

    void invalid
  },
  collapse: {
    onCollapsedChange: (collapsed) => {
      // collapsed 保留布尔类型。
      const value: boolean = collapsed

      void value
    },
  },
})

SchemxSearch<{ keyword: string }>({
  // @ts-expect-error 初始值必须符合业务字段类型。
  initialValues: { keyword: 1 },
})

// Search 的独立操作区不接受 Form 的 actionCol。
const props: SchemxSearchProps = {
  // @ts-expect-error 操作区不占字段栅格。
  actionCol: { span: 6 },
}

void props

// 折叠状态只能通过对象配置提供。
const invalidCollapse: SchemxSearchProps = {
  // @ts-expect-error 已移除顶层折叠状态。
  collapsed: true,
}

void invalidCollapse

SchemxSearch({ collapse: false })
SchemxSearch({ collapse: true })
SchemxSearch({
  collapse: {
    // @ts-expect-error 折叠状态必须是布尔值。
    collapsed: "true",
  },
})

// 属性名保持 collapse，不接受类型命名对应的 collapseAction。
const invalidCollapseAction: SchemxSearchProps = {
  // @ts-expect-error 使用 collapse 配置折叠操作。
  collapseAction: true,
}

void invalidCollapseAction

SchemxSearch({
  collapse: { buttonProps: { type: "primary", style: { color: "red" } } },
})
SchemxSearch({
  collapse: {
    buttonProps: {
      // @ts-expect-error 折叠按钮的点击行为由 Search 管理。
      onClick: () => {},
    },
  },
})
SchemxSearch({
  collapse: {
    buttonProps: {
      // @ts-expect-error 折叠按钮的原生行为由 Search 管理。
      nativeType: "submit",
    },
  },
})
