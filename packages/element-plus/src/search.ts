import { createSearchComponent } from "@schemx/vue"

import { schemx } from "./schemx"

// 与本包 Form 和 useForm 共用创建器，继承 Element Plus 的 Renderer 与布局实现。
export default createSearchComponent(schemx.createForm, "ElementPlusSchemxSearch")
