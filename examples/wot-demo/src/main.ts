import { createSSRApp } from "vue"
import WdIcon from "@wot-ui/ui/components/wd-icon/wd-icon.vue"
import WdLoading from "@wot-ui/ui/components/wd-loading/wd-loading.vue"
import WdSearch from "@wot-ui/ui/components/wd-search/wd-search.vue"

import App from "./App.vue"

export function createApp() {
  const app = createSSRApp(App)

  // Wot UI 部分按需组件内部依赖全局标签，demo 入口统一注册以避免 Vue 组件解析警告。
  app.component("wd-icon", WdIcon)
  app.component("wd-loading", WdLoading)
  app.component("wd-search", WdSearch)

  return {
    app,
  }
}
