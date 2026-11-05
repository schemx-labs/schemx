<script setup lang="ts">
  import { onScopeDispose, ref } from "vue"

  import logo from "../../../logo.png"

  import AutoColExample from "./AutoColExample.vue"
  import RenderersExample from "./renderers/RenderersExample.vue"
  import SearchExample from "./search/SearchExample.vue"

  import "./styles/demo.css"

  /**
   * 可独立访问的三个示例页面。
   */
  type ExamplePage = "search" | "renderers" | "layout"

  /**
   * 导航和页面标题使用同一份展示配置。
   */
  interface PageDefinition {
    /**
     * 同时作为 URL hash 和页面标识。
     */
    id: ExamplePage
    /**
     * 导航中展示的中文名称。
     */
    label: string
  }

  // 只按 API 用途划分示例，不增加独立站点的介绍和导航层级。
  const pages: PageDefinition[] = [
    { id: "renderers", label: "表单与 Renderer" },
    { id: "search", label: "搜索与折叠" },
    { id: "layout", label: "列布局" },
  ]

  /**
   * 从链接中恢复当前页面，未知地址回到表单示例。
   */
  const getPageFromHash = (): ExamplePage => {
    // hash 仅用于在本地页面配置中查找，不参与 HTML 或脚本拼接。
    const hash = window.location.hash.slice(1)

    // page 是已有的示例配置，过滤未知页面 ID。
    return pages.find((page) => page.id === hash)?.id ?? "renderers"
  }

  // 三个示例保持挂载，切换导航时保留用户输入。
  const activePage = ref<ExamplePage>(getPageFromHash())

  /**
   * 切换示例并更新地址，支持浏览器前进和后退。
   * @param page - 需要展示的示例 ID。
   */
  const navigate = (page: ExamplePage): void => {
    if (activePage.value === page) {
      return
    }

    activePage.value = page
    window.history.pushState(null, "", `#${page}`)
    window.scrollTo({ top: 0, behavior: "instant" })
  }

  /**
   * 浏览器历史或地址变化后恢复当前示例。
   */
  const syncPage = (): void => {
    activePage.value = getPageFromHash()
  }

  window.addEventListener("popstate", syncPage)
  window.addEventListener("hashchange", syncPage)
  onScopeDispose(() => {
    window.removeEventListener("popstate", syncPage)
    window.removeEventListener("hashchange", syncPage)
  })
</script>

<template>
  <main class="demo-app">
    <header class="demo-header">
      <a
        class="demo-logo"
        href="#renderers"
        aria-label="Schemx"
        @click.prevent="navigate('renderers')"
        ><img :src="logo" alt="Schemx"
      /></a>
      <h1>Element Plus 示例</h1>
      <a
        class="repository-link"
        href="https://github.com/Jiohon/schemx"
        target="_blank"
        rel="noopener noreferrer"
        >GitHub</a
      >
    </header>

    <nav class="demo-tabs" aria-label="API 示例">
      <button
        v-for="page in pages"
        :key="page.id"
        type="button"
        :aria-pressed="activePage === page.id"
        @click="navigate(page.id)"
      >
        {{ page.label }}
      </button>
    </nav>

    <div v-show="activePage === 'renderers'"><RenderersExample /></div>
    <div v-show="activePage === 'search'"><SearchExample /></div>
    <div v-show="activePage === 'layout'"><AutoColExample /></div>
  </main>
</template>
