/**
 * Vant 默认 Col 注册。
 *
 * 导入 @schemx/vant 后，将 Vant Col 设置为 @schemx/vue 的全局布局列组件。
 * Vue 层提供通用 flex 行容器，因此本适配只需注册 Col。
 *
 * @module layout/defaultCol
 */

import { Col as VanCol } from "vant"

import { registerCol } from "@schemx/vue"

registerCol(VanCol)
