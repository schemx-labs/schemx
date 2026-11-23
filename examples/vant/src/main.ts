/**
 * Vant 示例应用入口。
 *
 * 引入 Vant 组件库样式并创建 Vue 应用实例，
 * 挂载到 #app 根节点。
 */
import { createApp } from "vue"

import "vant/lib/index.css"
import "@schemx/vant/style.css"

import App from "./App.vue"

const app = createApp(App)

app.mount("#app")
