# Schema 字段值类型推导问题与方案

## 1. 背景

自定义 Renderer 使用对象值时，字段规则中的 `value` 目前可能被推导为字段值联合，而不是当前字段的实际值类型。

示例表单值：

```ts
interface ContactCardValue {
  name: string
  phone: string
}

interface CustomRendererValues {
  contact: ContactCardValue
  note: string
}
```

期望的 Schema 写法是：

```ts
const schemas: SchemxField<CustomRendererValues>[] = [
  {
    name: "contact",
    label: "联系人",
    componentType: "contact-card",
    rules: [
      {
        validate: (value) => {
          value?.phone
          // value 应为 ContactCardValue | undefined
          return { valid: true }
        },
      },
    ],
  },
]
```

当前实际推导结果类似：

```ts
string | ContactCardValue | undefined
```

因此访问 `value.phone` 会报错。

## 2. 根因

### 2.1 `SchemxField` 只按 Renderer 分发

注册 Renderer 后，当前普通字段分支的核心结构等价于（省略未注册 Renderer 时的回退分支）：

```ts
type SchemxRendererField<TValues extends Values> = {
  [TKey in SchemxRendererKey<TValues>]: SchemxBase<
    TValues,
    NamePath<TValues>,
    TKey
  >
}[SchemxRendererKey<TValues>]
```

这里 `TName` 被固定成完整的 `NamePath<TValues>`，没有随着字段对象中的 `name` 字面量继续分发。

### 2.2 `rules` 依赖 `TName`

`SchemxBase` 的规则类型是：

```ts
rules?: FieldRules<TValues, TName>
```

而 `FieldRules` 最终使用：

```ts
FieldValue<TValues, TName>
```

当 `TName` 是多个字段路径的联合时，`FieldValue` 也会变成对应字段值的联合。因此 `contact` 字段会把 `note: string` 的值一起带入规则回调。

### 2.3 Renderer key 不是字段名类型

`componentType: "contact-card"` 只能收窄 Renderer Props，例如 `componentProps` 和 `value` 的契约；它不能反向证明当前 `name` 一定是 `contact`。问题发生在 `name → TName → rules` 这一条链路中。

## 3. 当前已有的精确类型

Core 已经存在 `SchemxExactBaseField<TValues>`：

```ts
export type SchemxExactBaseField<TValues extends Values = Values> = {
  [TName in NamePath<TValues>]: SchemxBaseFieldByName<TValues, TName>
}[NamePath<TValues>]
```

它会同时按字段名和 Renderer key 分发，因此可以得到精确的规则值类型。最小用例已确认：

- `contact` 的规则参数为 `ContactCardValue | undefined`。
- `required.isEmpty` 的参数为 `ContactCardValue | null | undefined`。
- 数值字段规则参数为 `number | undefined`，调用 `trim()` 会报错。

但 `initialValue` 和 `onChange` 当前没有关联 `TName`：

```ts
initialValue?: FieldValue<TValues, NamePath<TValues>>
onChange?: (value: FieldValue<TValues>, form: SchemxInstance<TValues>) => void
```

因此即使使用精确字段类型，这两个属性仍使用所有字段路径的值联合。在包含 `age: number` 的验证用例中，`contact` 字段仍接受 `initialValue: 123`，`onChange` 参数仍混入字符串和数值类型。要获得字段级类型，需要分别将它们改为使用 `FieldValue<TValues, TName>`，并验证兼容性。

当前可用的临时写法是：

```ts
const contactSchema = {
  name: "contact",
  label: "联系人",
  componentType: "contact-card",
  rules: [
    {
      validate: (value) => value?.phone ? { valid: true } : {
        valid: false,
        issues: [{ message: "请完整填写姓名和电话" }],
      },
    },
  ],
} satisfies SchemxExactBaseField<CustomRendererValues>
```

这能解决推导问题，但会在消费端增加额外语法，不符合期望的 `SchemxField<TValues>[]` 体验。

## 4. 已验证的 Core 内部方案

复核使用当前工作区和 TypeScript 5.9.3，通过 Compiler API 在内存中替换类型并执行类型检查，没有修改仓库源码。

- `packages/core/tsconfig.type-tests.json` 的专用类型用例：原定义及以下两种改法均无诊断，未覆盖联合复杂度问题。
- `packages/core/tsconfig.json` 的完整编译范围：两种改法均新增 `TS2590`。
- 完整 Core 基线另有 4 个已有配置属性错误，涉及 `labelWidth` 和 `showRequiredMark`，未计入改法新增问题。
- 本次未执行 Vue/Vant 完整检查或声明产物大小验证。

### 4.1 直接把 `SchemxField` 替换成精确字段联合

方案：将普通字段分支改成 `SchemxExactBaseField<TValues>`，再与 Group、Dependency、Dynamic 联合。

优点：

- 消费端无需增加语法。
- `rules`、`required` 可以通过 `name` 获得字段级值类型；`initialValue` 和 `onChange` 仍需单独修改。

问题：

- 完整 Core 编译在 `packages/core/src/__tests__/createForm.test.ts` 第 53、678、786 行等位置复现多处 `TS2590: Expression produces a union type that is too complex to represent`。
- 最小用例中，精确普通字段与 Group、Dependency、Dynamic 联合后，顶层规则参数仍正确推导。此前关于隐式 `any` 的描述缺少具体失败用例，尚不能归因于这些类型的联合本身。
- `SchemxField` 被 Runtime、Schema source、Instance、Reconciler 等大量 API 共同使用，复杂度会扩散到更新 Schema 和表单 API。

结论：当前实现不能直接采用。

### 4.2 只把 `name/rules` 作为额外精确联合叠加

方案：保留原 Renderer 联合，再增加一个按 `name` 分发的 `{ name, rules }` 联合并求交集。

结果：

- 完整 Core 编译的联合复杂度错误位置减少，但不能据此认定整体类型检查性能改善。
- 在 `packages/core/src/__tests__/createForm.test.ts` 第 1556 行复现 `TS2590`。
- 上下文函数推导不稳定的具体条件仍待补充用例验证。

结论：不能作为稳定的公共类型实现。

## 5. 可选方案

以下是待评估的设计方向，不代表已通过全部验收标准。

### 方案 A：引入精确公共 Schema 类型

保留当前 `SchemxField<TValues>` 的宽松定义，新增：

```ts
type SchemxExactSchema<TValues extends Values> =
  | SchemxExactBaseField<TValues>
  | SchemxGroupField<TValues>
  | SchemxDependencyField<TValues>
  | SchemxDynamicField<TValues>
```

优点：

- 可以单独提供精确输入类型，保留现有内部 API 定义。
- 最小用例中，顶层普通字段可以获得精确规则值。

缺点：

- 消费端仍需显式使用新类型，或由 `<Schemx>` Props 单独采用该类型。
- 不能完全满足“现有 `SchemxField<T>[]` 自动变精确”的目标。
- 原样复用的 Group `children` 和 Dependency `renderer` 返回值仍使用宽 `SchemxField`；实测 Group 内规则参数仍为字段值联合。若要求递归精确，需要调整这些输入边界。
- Dynamic item 已使用 `SchemxExactBaseField<TItem>`，与上述宽子树不同，仍需验证其嵌套组合。
- 精确输入传入现有宽 API 时的可赋值性、复杂度，以及 `initialValue`、`onChange` 的字段关联仍需验证或补齐。

适合：优先保证类型性能和兼容性的渐进迁移。

### 方案 B：增加 `defineField` / `defineSchemas` 工厂

提供 Core 工厂，让函数参数中的 `name` 字面量参与泛型推导：

```ts
const defineField = defineFieldFactory<CustomRendererValues>()

const contact = defineField({
  name: "contact",
  label: "联系人",
  componentType: "contact-card",
  rules: [
    {
      validate: (value) => value?.phone ? { valid: true } : {
        valid: false,
        issues: [{ message: "请完整填写姓名和电话" }],
      },
    },
  ],
})
```

优点：

- 单字段工厂有望从函数参数推导 `TName`，避免展开完整字段联合。
- 可将 `TName` 与 Renderer key 分别传递给规则、Renderer Props 和依赖配置；实际效果取决于工厂签名。

缺点：

- 消费端增加函数调用语法。
- `defineField` 不会改变未经过工厂的数组对象推导；`defineSchemas` 能否逐项提供精确上下文需要单独验证。
- 本次未实现工厂，尚未验证泛型推导、返回值与现有 API 的兼容性；也不能自动修复基础类型中未使用 `TName` 的属性。

适合：类型精度优先、且可以接受轻量 API 语法的项目。

### 方案 C：让 `<Schemx>` Props 使用精确 Schema 类型

保留 Core 的 `SchemxField` 宽类型，但 Vue 适配层的 `SchemxFormProps<TValues>` 将 `schemas` 改为精确 Schema 类型。

优点：

- 有望改善 Vue 内联 Schema 的字段推导，需通过 Vue 模板类型检查验证；已经声明为宽类型的独立数组不会因 Props 改型而重新推导。
- 可保留 Core Runtime 的宽类型，但输入边界的可赋值性和复杂度仍需验证。

缺点：

- Core 直接调用 `createForm({ schemas })` 的用户仍然使用旧类型。
- Vue、Vant、Core 三层的 Schema 输入类型会出现差异。

适合：问题主要集中在 Vue/Vant 消费端的情况。

### 方案 D：完整重构 Schema 类型层

拆分为三层：

```text
用户 Schema 输入类型：按 name + componentType 精确分发
        ↓
编译/归一化类型：保留可处理的宽结构
        ↓
Runtime 节点类型：使用 SchemxBaseField 等宽类型
```

优点：

- 目标是在公共输入保持精度的同时，控制内部 Runtime 类型复杂度。
- 可统一处理 `rules`、`required`、`initialValue`、`onChange` 和依赖配置的字段关联，并保留 `componentProps` 按 Renderer key 收窄；具体效果和性能需实现后验证。

缺点：

- 改动范围最大。
- 需要调整 `CreateFormOptions`、`createSchemas`、`setSchemas`、`updateSchemas`、Dependency renderer 和 Dynamic item 的类型边界。
- 需要重新评估声明文件大小和 TypeScript 性能。

适合：下一次主版本或专门的类型架构重构。

## 6. 推荐路线

推荐优先验证方案 A + 方案 B 的最小实现，再决定是否采用：

1. 保留现有 `SchemxField<TValues>`，避免立即引入联合爆炸。
2. 将 `SchemxExactBaseField<TValues>` 公开文档化为精确普通字段类型。
3. 验证单字段工厂的推导与 API 兼容性，再独立评估数组工厂和嵌套 Schema。
4. 若目标包含 `initialValue` 和 `onChange` 的字段级类型，单独补齐它们与 `TName` 的关联。
5. 使用完整 Core 编译及 Vue/Vant 消费用例验证复杂度，再评估方案 D。

如果产品要求“所有已有 `SchemxField<T>[]` 写法都自动精确”，当前两种直接改法尚不能满足要求。方案 D 是可评估的架构方向，但现有实验不足以证明它是唯一解，也不足以确定必须完整重构。

## 7. 验收标准

以下是完整目标的验收标准，渐进方案应明确其覆盖范围和未解决项：

- `contact` 的规则值为 `ContactCardValue | undefined`。
- `note` 的规则值为 `string | undefined`。
- `age` 规则不能访问字符串方法。
- 普通字段的 `required.isEmpty`、`initialValue`、`onChange` 均关联当前字段值类型；保留各自的空值约定，如 `isEmpty` 额外接受 `null`。
- Renderer `componentProps` 仍按 `componentType` 收窄。
- Group、Dependency、Dynamic Schema 仍可直接放入 Schema 数组，嵌套普通字段也验证对应的字段值精度。
- `createForm`、`setSchemas`、`updateSchemas` 和 Schema source 不出现 `TS2590`。
- Core、Vue、Vant 的声明文件大小和类型检查时间保持在可接受范围。

## 8. 当前状态

当前 Core 的 `SchemxField` 仍保留仅按 Renderer 分发的普通字段分支，本次复核仅在内存中试验类型替换。

当前工作区的 `examples/vant/src/custom/CustomRendererForm.vue` 虽然导入了 `SchemxExactBaseField`，但没有实际应用该约束；Schema 数组仍直接声明为 `SchemxField<CustomRendererValues>[]`。因此不能再声称该示例已使用局部精确约束或已确认正常构建。本次确认的是 Core 最小用例中的推导行为，未验证该 Vue 示例的完整构建。
