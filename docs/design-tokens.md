# Schemx 样式变量契约

状态：公共变量和适配映射已定义，组件消费已接通；不额外处理弹层主题同步，完整视觉验收留待后续步骤。

本规范确定变量的命名、职责、默认来源、覆盖行为和实施边界。后续步骤按此契约修改代码。无需兼容旧变量名，不增加旧名称别名、双写或弃用期。实现按后续确认收敛为公共默认值、适配映射和组件直接引用，不引入私有 CSS 解析层。

## 1. 职责分层

| 层级     | 职责                                                     | 是否公开                         |
| -------- | -------------------------------------------------------- | -------------------------------- |
| 基础尺度 | 字号、行高、字重，以及后续整理的间距、圆角尺度           | 仅公开有实际消费场景的配置入口   |
| 语义变量 | 文字、背景、边框、品牌、状态等用途                       | 公开，供业务和适配层共同遵守     |
| 组件变量 | Field 标签、错误提示、Group 标题等公共组件部位的特殊配置 | 公开必要入口，默认回落到语义变量 |

组件默认消费语义变量；只有需要单独配置的部位才增加组件变量。初期不公开完整颜色色盘，不为每个颜色和状态机械生成全部变量组合。

公共层只维护自身实现的组件样式及其变量。Picker、Selector、上传预览等 UI 自绘组件不在公共层声明专用变量；UI 层可以直接消费通用语义和排版变量，或自行维护私有配置。弹层沿用对应 UI 库的原生行为。本次不增加浮层主题 Hook、CSS 变量复制、祖先主题监听或 Wrapper 主题注入。

`@schemx/core` 不承担 CSS、主题生成或 DOM 同步。`@schemx/vue` 维护公共语义与结构样式；UI 适配包维护宿主映射和已接通的原生控件入口。

## 2. 命名

全部使用小写 kebab-case，公共前缀为 `--schemx-`。

| 类型     | 格式                             | 示例                                                     |
| -------- | -------------------------------- | -------------------------------------------------------- |
| 语义颜色 | `--schemx-color-{用途}[-{角色}]` | `--schemx-color-text-primary`、`--schemx-color-error-bg` |
| 排版基础 | `--schemx-{属性}[-{档位}]`       | `--schemx-font-size-base`、`--schemx-line-height-sm`     |

命名中的约定：

- `primary` 在 `color-primary` 中表示品牌，在 `color-text-primary` 中表示正文层级。
- `bg` 只表示背景，`border` 只表示描边，`text` 只表示文字。相同默认值不代表职责可以互换。
- `on-primary` 表示实色品牌背景上的前景，不预设为白色，也不等同于一般的反色文字。
- 交互状态统一使用 `hover`、`active`、`selected`、`disabled`；`active` 表示按下，`selected` 表示持续选中。
- 校验与反馈语义统一使用 `error`。第三方 UI 的 `danger` 名称只出现在适配中。
- 控件高度使用 `control-height`，文字行高使用 `line-height`，间距使用 `space` 或具体部位的 `gap`、`padding`。不再使用含义不明的 `component-size`。

间距、圆角和动画不在本步骤扩充清单。后续整理时遵守同一命名原则；运行时布局变量与主题变量分开管理。

## 3. 首批颜色入口

下表定义公开输入。默认来源是解析规则，不表示必须在 `:root` 上为该变量声明默认值。

| 变量                              | 用途与消费位置                           | 默认来源                                         |
| --------------------------------- | ---------------------------------------- | ------------------------------------------------ |
| `--schemx-color-primary`          | 品牌实色、主要操作填充                   | 宿主主色；无适配时使用公共主色                   |
| `--schemx-color-primary-text`     | 品牌文字、链接、选中项文字               | 宿主对应前景；无对应入口时使用经配对检查的主题值 |
| `--schemx-color-primary-bg`       | 选中项、普通字段定位提示的浅背景         | 宿主选中背景或主题配套值                         |
| `--schemx-color-primary-border`   | 品牌描边、普通字段定位提示描边           | 宿主品牌描边或主题配套值                         |
| `--schemx-color-on-primary`       | 主要操作填充上的文字和图标               | 与品牌实色配套的前景                             |
| `--schemx-color-text-primary`     | 正文、普通只读内容                       | 宿主主要文字                                     |
| `--schemx-color-text-secondary`   | 辅助文字、默认标签、弱化图标             | 宿主次要文字                                     |
| `--schemx-color-text-placeholder` | 输入占位和空值占位                       | 宿主占位文字                                     |
| `--schemx-color-text-disabled`    | 禁用内容                                 | 宿主禁用文字                                     |
| `--schemx-color-text-readonly`    | 允许单独调整的只读内容                   | 当前作用域的主要文字；默认保持可读性             |
| `--schemx-color-bg-surface`       | 字段、分组等普通内容容器                 | 宿主容器背景                                     |
| `--schemx-color-bg-elevated`      | 浮层内容容器                             | 宿主浮层背景；无独立入口时回落到容器背景         |
| `--schemx-color-bg-muted`         | 默认选择项、弱填充区域                   | 宿主弱填充                                       |
| `--schemx-color-bg-disabled`      | 由 Schemx 绘制的禁用背景                 | 宿主禁用填充                                     |
| `--schemx-color-border-default`   | 控件、选择项等普通描边                   | 宿主控件边框                                     |
| `--schemx-color-border-subtle`    | 字段、弹层等分隔线                       | 宿主分隔线                                       |
| `--schemx-color-focus-ring`       | 由 Schemx 绘制的可交互部位的键盘焦点提示 | 宿主焦点提示或主题配套值                         |
| `--schemx-color-error-text`       | 错误提示、必填标记                       | 宿主错误前景或主题配套值                         |
| `--schemx-color-error-bg`         | 错误字段定位提示背景                     | 宿主错误弱背景或主题配套值                       |
| `--schemx-color-error-border`     | 错误字段定位提示、已支持控件的错误描边   | 宿主错误描边或主题配套值                         |
| `--schemx-color-warning-text`     | 警告提示前景                             | 宿主警告前景或主题配套值                         |
| `--schemx-color-warning-bg`       | 警告字段定位提示背景                     | 宿主警告弱背景或主题配套值                       |
| `--schemx-color-warning-border`   | 警告字段定位提示描边                     | 宿主警告描边或主题配套值                         |

`success`、`info` 按相同规则扩展，但必须先确认实际消费场景，再进入首批实施清单。品牌 hover、active 也在需要消费它们的组件接入时增加，不提前承诺完整色盘。

不强制公开 tertiary、quaternary。文字层级按实际用途定义，适配包可以让不同角色暂时采用相同色值。

只读和空值占位分别处理：只读值使用 readonly 角色；没有值时显示的占位仍使用 placeholder 角色。是否禁用、是否只读及何时显示错误，继续由既有组件状态决定，主题配置不改变业务状态。

## 4. 默认来源与 UI 适配

公共默认主题应具备完整取值，单独使用 `@schemx/vue` 时不依赖 `--el-*`、`--van-*`。

UI 适配优先读取宿主的语义变量。以下是步骤 3 必须核对的映射基准，不是本步骤已经完成的适配实现。

| Schemx 角色 | Element Plus 来源             | Vant 来源                                           |
| ----------- | ----------------------------- | --------------------------------------------------- |
| 品牌实色    | `--el-color-primary`          | `--van-primary-color`                               |
| 主要文字    | `--el-text-color-primary`     | `--van-text-color`                                  |
| 次要文字    | `--el-text-color-regular`     | `--van-text-color-2`                                |
| 占位文字    | `--el-text-color-placeholder` | `--van-text-color-3`                                |
| 禁用文字    | `--el-disabled-text-color`    | 控件禁用变量；无独立入口时使用 `--van-text-color-3` |
| 容器背景    | `--el-bg-color`               | `--van-background-2`                                |
| 浮层背景    | `--el-bg-color-overlay`       | `--van-background-3`，逐组件核对实际浮层来源        |
| 弱填充      | `--el-fill-color-light`       | `--van-background`                                  |
| 普通边框    | `--el-border-color`           | `--van-border-color`                                |
| 分隔线      | `--el-border-color-lighter`   | `--van-border-color`                                |
| 基础字号    | `--el-font-size-base`         | `--van-font-size-md`                                |
| 字族        | `--el-font-family`            | `--van-base-font`                                   |

宿主语义的相对层级允许不同，不要求两个 UI 的实际色值完全一致。映射不能假定宿主存在某个色阶变量，例如当前 Vant 没有提供 `--van-blue-1`。

默认值缺失时使用与当前明暗模式匹配的主题值。若某项无法随宿主主题变化，适配说明中必须列明；不得静默用固定浅色值宣称已支持深色主题。

品牌色、品牌文字、浅背景、描边和 on-primary 是配套输入。第一阶段不提供自动色阶生成；仅修改品牌实色不保证其他入口自动变化。将来增加生成算法时，需要单独定义生成、显式覆盖与明暗主题的关系。

## 5. 默认值与覆盖

公共默认值集中在 `packages/vue/src/styles/variables.css` 的 `:root`。UI 适配包在自己的 `data-schemx-ui` 边界映射原生主题，并重新绑定该边界的组件别名。组件直接引用一项公开变量：

```css
.schemx-field__label {
  color: var(--schemx-field-label-color);
}
```

默认定义和映射允许直接引用其他变量，或为原生变量设置一个字面量 fallback；组件不重复声明默认值，不使用多层嵌套回落。

### 5.1 覆盖范围

同一入口遵循 CSS 级联与继承规则。业务类、内联样式可以覆盖同一节点上低优先级的适配映射；祖先配置不会覆盖后代节点的直接声明。不同部位使用不同变量，局部调整标签就覆盖 `--schemx-field-label-color` 或对应的标签排版变量。

组件别名在其声明边界计算。仅在更深节点修改通用颜色或基础字号，不保证祖先已计算的别名重新派生。全局调整在 `:root` 进行；表单级通用调整使用适配边界；字段级调整优先直接配置组件部位变量，不增加额外解析层来隐式重建全部依赖。

### 5.2 恢复默认值

删除配置声明后，按当前作用域的 CSS 规则恢复默认或继承值。不将空字符串或 `initial` 解释为“恢复 UI 主题”的专用指令；它们可能使具体样式声明失效。本阶段不增加主题重置 API。

## 6. 原生控件的边界

Schemx 自己绘制的标签、分组、说明、错误、只读展示和自定义选择项必须消费本规范。

第三方原生控件只承诺适配清单中已经接通的部位。不能以存在同名全局变量推断所有原生控件都已接通。

桥接时遵守以下约束：

- 默认尽量保留原生组件样式；不在 `:root`、`body` 修改第三方变量。
- 读取宿主默认值和写入原生目标变量必须有无循环的依赖关系。不得让 Schemx 的默认值读取被自身重新写入的目标变量，包括 fallback 中的自引用。
- 纯 CSS 无法保留某项宿主局部默认又安全桥接时，先将该部位标记为未接通，继续允许通过原生组件配置调整，不伪造支持。
- 原生组件 `style`、`class` 遵循其真实 CSS 级联；尺寸 `size` 等 Props 仍由原生组件处理。适配表说明其与 Schemx 变量的关系，不承诺统一覆盖全部原生配置。
- 自定义 Renderer、插槽内容默认由提供者管理，可选择遵守 Schemx 变量契约。

## 7. 排版规则

### 7.1 基础输入

| 变量                           | 含义                   | 初始解析规则                                    |
| ------------------------------ | ---------------------- | ----------------------------------------------- |
| `--schemx-font-family`         | 常规界面字体           | 宿主字族；无宿主时使用含中文回退的系统字体栈    |
| `--schemx-font-size-base`      | 正文基准字号           | 宿主基础字号；公共默认 14px                     |
| `--schemx-font-size-sm`        | 说明和错误字号         | 在当前作用域按 `max(12px, 基准字号 - 2px)` 派生 |
| `--schemx-font-size-lg`        | 分组、浮层标题字号     | 在当前作用域按 `基准字号 + 2px` 派生            |
| `--schemx-font-weight-regular` | 常规字重               | 400                                             |
| `--schemx-font-weight-medium`  | 中等强调               | 500                                             |
| `--schemx-font-weight-strong`  | 额外强调               | 600；只在需要该级强调的部位使用                 |
| `--schemx-line-height-base`    | 正文和标签的无单位行高 | 公共起点为 22 / 14，视觉验收时核定              |
| `--schemx-line-height-sm`      | 说明和错误的无单位行高 | 公共起点为 18 / 12，视觉验收时核定              |
| `--schemx-line-height-lg`      | 标题的无单位行高       | 公共起点为 24 / 16，视觉验收时核定              |

基础字号的受支持下限为 12px；更小的文字只允许用于显式指定的特殊部位。公共默认先采用 px，不修改宿主 `html` 字号；用户可提供 rem 等合法长度。无单位行高随对应字号计算，不绑定控件高度。

角色或组件字号一经显式指定，就作为该部位最终字号，不再叠乘缩放系数。首批不公开独立 font-scale。`font-size-sm`、`font-size-lg` 在公共根主题和适配边界根据基准字号派生；更深层的局部覆盖遵守第 5 节的边界规则。

### 7.2 部位映射与独立入口

| 部位                       | 默认字号 / 行高 / 字重 | 首批组件输入                                                                                                                           |
| -------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 字段标签                   | base / base / regular  | `--schemx-field-label-font-size`、`--schemx-field-label-line-height`、`--schemx-field-label-font-weight`、`--schemx-field-label-color` |
| 正文、自定义输入、普通只读 | base / base / regular  | 首批复用语义与基础入口；原生控件按接入清单支持                                                                                         |
| 字段辅助说明               | sm / sm / regular      | 复用基础排版与次要文字色；存在实际组件后再增加独立入口                                                                                 |
| 字段错误                   | sm / sm / regular      | `--schemx-field-error-font-size`、`--schemx-field-error-line-height`、`--schemx-field-error-color`                                     |
| 分组标题                   | lg / lg / medium       | `--schemx-group-title-font-size`、`--schemx-group-title-line-height`、`--schemx-group-title-font-weight`、`--schemx-group-title-color` |

组件字号与行高可独立覆盖。不提供 CSS `font` shorthand 的公开输入，避免意外重置未配置的排版属性。

### 7.3 排版与密度

文字行高负责阅读，控件高度负责尺寸，字段 padding 和 gap 负责密度。标签使用布局进行对齐，不使用控件高度作为文字行高。

`--schemx-control-height` 表示公共布局使用的控件高度基准，默认由适配层提供，公共起点为 28px。它不代表移动端触摸区域高度，也不等同于整行字段高度。单字段使用原生 small、large 尺寸时，适配层需要同步该字段的布局基准；不能只读取全局默认尺寸。

控件尺寸、行距、图标与文字放大需要联合验收。主题变量不承诺仅凭增大字号就自动修复第三方控件所有固定高度。

## 8. 组件颜色入口

组件颜色变量按需求保留，不为每个部位重复完整颜色矩阵。

| 入口                                    | 默认角色                              | 实际消费位置     |
| --------------------------------------- | ------------------------------------- | ---------------- |
| `--schemx-field-label-color`            | text-secondary                        | Field 标签       |
| `--schemx-field-error-color`            | error-text                            | Field 错误提示   |
| `--schemx-field-required-color`         | error-text                            | 必填标记         |
| `--schemx-group-title-color`            | text-primary                          | Group 标题       |
| `--schemx-field-highlight-bg`           | 按 normal / warning / error 选对应 bg | 字段定位提示底色 |
| `--schemx-field-highlight-border-color` | 按提示类型选对应 border               | 字段定位提示描边 |

字段高亮背景和描边是两个独立用途，不将描边色复用为普通正文色。在实际高亮字段节点显式配置组件高亮入口时，可以覆盖状态默认值；祖先上的同名配置仍遵循 CSS 继承和级联规则。

禁用文字、禁用背景与整体透明度不重复叠加。后续逐控件确定由 Schemx 还是原生组件负责禁用外观，避免父子双方重复衰减。整体 opacity 不是文字颜色入口的替代品。

## 9. 作用域与浮层

- UI 身份、明暗模式、用户主题作用域分别表达。不得让两个适配包都仅以通用 `.schemx` 选择器覆盖同一套默认值。
- 无独立主题声明的嵌套表单继承祖先公开输入；适配默认值只影响未显式配置的部分。
- 明暗切换更新配套默认值，不自动替换用户显式配置。用户只配置固定浅色值时，不承诺该值自动变为深色。
- 弹层保留原生挂载策略，使用 UI 库自身的主题和 style/popperStyle 等配置入口，不自动复制表单或字段的 CSS 变量。
- 表单或字段的局部 CSS 变量只遵循 DOM 继承；传送到其他容器的浮层不承诺自动继承这些局部值。
- CSS-only 祖先配置和有类型的主题对象是不同入口。后续若引入对象 API，需明确其如何写入 DOM 和处理继承；当前 ConfigProvider 不自动获得这些能力。

## 10. 后续实施清单与验收

| 步骤          | 交付内容                                  | 本规范要求                                                 |
| ------------- | ----------------------------------------- | ---------------------------------------------------------- |
| 2. 公共层     | 默认主题、Field / Group 等公共样式        | 集中定义公开默认值，组件直接引用；去除旧命名，不加兼容别名 |
| 3. 适配层     | 独立 UI 作用域、来源映射、Renderer 支持表 | 核对已安装版本；默认读取与原生写入无循环；不污染宿主全局   |
| 4. 消费接通   | 自绘 Renderer、按钮、选择项等             | 主题颜色和文字样式通过新入口配置；装饰尺寸不机械替换成字号 |
| 5. 主题边界   | 局部继承与动态更新                        | 同页不同 UI、不同表单主题互不影响                          |
| 6. 验证与说明 | 视觉场景、使用示例、变量清单              | 说明支持范围及未接通部位，验证配置确实影响目标位置         |

验收至少覆盖：

1. 无 UI 适配、Element Plus、Vant 三种默认来源。
2. 应用祖先、表单、字段对同一个公开入口的覆盖，以及组件入口优先于通用入口。
3. 删除局部配置后，按当前作用域恢复默认或继承值。
4. 全局或适配边界的基准字号 14px 改为 16px，sm/lg 同步派生；字段部位字号可独立覆盖。
5. 原生 size 与 Field 对齐、多行标签、长错误提示、中文和英文混排。
6. 两套适配样式同页加载，交换导入顺序仍不串色。
7. 弹层原生 style/popperStyle、挂载目标及相关事件透传保持既有行为。
8. 浅色和深色下的正文、辅助、占位、选中、错误、只读与禁用状态。
9. 文字放大至 200% 后不丢失内容和功能；键盘焦点可识别。

颜色按实际前景和背景组合检查；透明颜色先与实际背景合成。普通文字、焦点提示和禁用内容使用各自适用的要求，不对所有部位套用同一阈值。跟随宿主主题不等于整个页面已经通过对比度验收。

公共默认色值和适配映射已定义；完整明暗配对和视觉验收仍需在后续步骤确认；本次不实现额外的弹层主题同步。

## 11. 参考依据

- [Ant Design：主题与 Token 分层](https://ant.design/docs/react/customize-theme/)
- [Chakra UI：语义 Token](https://chakra-ui.com/docs/theming/semantic-tokens)
- [Radix Themes：字号、行高与字重](https://www.radix-ui.com/themes/docs/theme/typography)
- [shadcn/ui：背景与前景配对](https://ui.shadcn.com/docs/theming)
- [Element Plus：CSS 变量与主题](https://element-plus.org/en-US/guide/theming.html)
- [Vant：主题与 ConfigProvider](https://github.com/youzan/vant/blob/main/packages/vant/src/config-provider/README.zh-CN.md)
- [CSS 变量规范：继承前解析与循环引用](https://www.w3.org/TR/css-variables-1/#cycles)
- [WCAG：文字缩放](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)
- [WCAG：文字对比度](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
