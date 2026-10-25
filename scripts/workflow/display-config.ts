// 工作流的展示名称与默认说明，不定义任务路由或发布规则。

/**
 * 目录层级的展示名称，未知目录继续使用原目录名。
 */
export const WORKFLOW_SCOPE_LABEL: Readonly<Record<string, string>> = {
  packages: "Packages",
  plugins: "Plugins",
  examples: "Examples",
} as const

/**
 * 对外显示的任务名称，不改变对应的 npm script 标识。
 */
export const WORKFLOW_TASK_LABEL: Readonly<Record<string, string>> = {
  dev: "启动开发服务",
  build: "构建",
  "build:analyze": "构建分析",
  check: "静态检查",
  lint: "代码规范检查",
  "lint:fix": "修复代码规范",
  format: "格式化",
  "format:check": "检查格式",
  "type-check": "类型检查",
  "type-check:tests": "测试代码类型检查",
  test: "测试",
} as const

/**
 * 业务调用未提供说明时使用的展示文案。
 */
export const WORKFLOW_TEXT = {
  EXECUTE_PREFIX: "执行",
  PENDING: "未执行",
  EMPTY_SELECTION: "请至少选择一个目标后再继续。",
  DEFAULT_FLOW_DESCRIPTION: "逐个执行选中目标的对应 script。",
  DEFAULT_GROUP_DESCRIPTION: "按选中目标顺序执行；--keep-going 会在普通失败后继续。",
} as const
