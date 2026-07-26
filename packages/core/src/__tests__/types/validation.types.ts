import type {
  FieldRules,
  RequiredOptions,
  RequiredRule,
  SchemxBaseField,
  SchemxDependencies,
  SchemxViewFieldSchema,
  StandardSchemaV1,
  AdapterRule,
  ValidationAdapterV1,
  ValidationAdapter,
  ValidationAdapterRule,
  ValidationRuleFactory,
  ValidationRuleEntry,
  ValidationError,
  ValidationResult,
} from "../../index"
import { createForm, createValidationRuleRegistry } from "../../index"
import * as Core from "../../index"

// @ts-expect-error 旧必填工厂已从 Core 公共入口删除。
Core.createRequiredRule
// @ts-expect-error 旧 Registry 工厂已从 Core 公共入口删除。
Core.createValidatorsRegistry
// @ts-expect-error 品牌规则工厂不得从 Core 公共入口导出。
Core.createAdapterRule

// @ts-expect-error 旧迁移别名不得从 Core 公共入口导出。
import type { SchemxRuleDefinition, SchemxRules } from "../../index"

interface FormValues {
  email: string
  age: number
  files: File[]
}

const externalAdapter: ValidationAdapter<{ readonly message: string }> = {
  id: "external",
  rule(input): AdapterRule {
    return { adapterId: "external", payload: input }
  },
  isRule: () => false,
  resolve(input) {
    const rule: ValidationAdapterRule<{ readonly message: string }> = input
    void rule
    return [{ validate: () => ({ valid: true as const }) }]
  },
}

const versionedExternalAdapter: ValidationAdapterV1<{ readonly message: string }> = {
  id: "external-v1",
  rule(input) {
    return { adapterId: "external-v1", payload: input }
  },
  isRule: () => false,
  resolve() {
    return [{ validate: () => ({ valid: true as const }) }]
  },
}

const versionedAdapterId: ValidationAdapterV1.ID = "external-v1"
const versionedRuleInput: ValidationAdapterV1.RuleInput<{ readonly message: string }> = {
  adapterId: versionedAdapterId,
  payload: { message: "校验失败" },
}

declare const stringSchema: StandardSchemaV1<string, string>
declare const numberSchema: StandardSchemaV1<number, number>
declare const filesSchema: StandardSchemaV1<File[], File[]>
declare const viewField: SchemxViewFieldSchema<FormValues>
const resolvedRequiredMark: boolean = viewField.showRequiredMark

const fields: SchemxBaseField<FormValues>[] = [
  {
    name: "email",
    label: "邮箱",
    componentType: "input",
    required: { isEmpty: (value) => value?.trim() === "" },
    rules: [stringSchema],
  },
  {
    name: "age",
    label: "年龄",
    componentType: "input",
    required: {
      isEmpty: (value) => {
        // @ts-expect-error 数值字段值不支持字符串专属的 trim 操作。
        return value?.trim() === ""
      },
    },
    rules: [numberSchema],
  },
  // @ts-expect-error age 字段不能使用 string Schema。
  {
    name: "age",
    label: "年龄",
    componentType: "input",
    rules: [stringSchema],
  },
  {
    name: "files",
    label: "附件",
    componentType: "input",
    showRequiredMark: false,
    dependencies: {
      triggerFields: ["email"],
      required: () => ({ isEmpty: (files) => !files?.length }),
      showRequiredMark: (values) => values.email.length > 0,
      rules: () => [filesSchema],
    },
  },
]

declare module "../../types/rule" {
  interface ValidationRuleDefinition {
    emailRule: string
    positive: number
  }
}

declare module "../../types/rule" {
  interface ValidationRuleDefinition {
    registryEmail: string
    registryPositive: number
  }
}

const emailRules: FieldRules<FormValues, "email"> = ["emailRule"]
// @ts-expect-error email 字段不能使用 number 规则名。
const invalidEmailRules: FieldRules<FormValues, "email"> = ["positive"]
const adapterObjectRules: FieldRules<FormValues, "email"> = [{ required: true }]

const registry = createValidationRuleRegistry()
const registryEmailEntry: ValidationRuleEntry<string> = stringSchema
const registryPositiveEntry: ValidationRuleEntry<number> = numberSchema

registry.register("registryEmail", registryEmailEntry)
registry.register("registryPositive", registryPositiveEntry)
// @ts-expect-error 注册表不接受未声明的规则名称。
registry.register("missingRegistryRule", registryEmailEntry)
// @ts-expect-error string 规则不能注册 number 条目。
registry.register("registryEmail", registryPositiveEntry)
registry.registerAll({
  emailRule: registryEmailEntry,
  positive: registryPositiveEntry,
  registryEmail: registryEmailEntry,
  registryPositive: registryPositiveEntry,
})
registry.registerAll({
  // @ts-expect-error registerAll 的已声明规则值必须与名称匹配。
  registryEmail: registryPositiveEntry,
  registryPositive: registryPositiveEntry,
})

const stableContextFactory: ValidationRuleFactory<string> = (context) => {
  const label: string = context.label
  const required: boolean = context.required
  void label
  void required
  return stringSchema
}

const required: RequiredRule<File[]> = {
  isEmpty: (files) => !files?.length,
}

const dynamicRequired: SchemxDependencies<FormValues, "files"> = {
  triggerFields: ["email"],
  required: (values): RequiredOptions<File[]> => ({
    message: values.email.trim().length > 0 ? "请上传文件" : "文件不能为空",
    isEmpty: (files) => {
      const count: number = files?.length ?? 0
      // @ts-expect-error File[] 字段值不支持字符串专属的 trim 操作。
      files?.trim()
      return count === 0
    },
  }),
  rules: () => [filesSchema],
}

const invalidDynamicRequired: SchemxDependencies<FormValues, "files"> = {
  triggerFields: ["email"],
  // @ts-expect-error files 字段的动态 required 不能使用 string 值判断器。
  required: () => ({ isEmpty: (value: string | null | undefined) => !value?.trim() }),
}

const invalidDynamicRules: SchemxDependencies<FormValues, "files"> = {
  triggerFields: ["email"],
  // @ts-expect-error files 字段的动态 rules 不能使用 number Schema。
  rules: () => [numberSchema],
}

const invalidDynamicRequiredMark: SchemxDependencies<FormValues, "files"> = {
  triggerFields: ["email"],
  // @ts-expect-error 动态 showRequiredMark 只能返回 boolean。
  showRequiredMark: () => "显示",
}

declare const result: ValidationResult<FormValues, "email">
const typedForm = createForm<FormValues>()
const inferredFieldResult: Promise<ValidationResult<FormValues, "email">> =
  typedForm.validateField("email")
declare const fieldErrors: ReturnType<
  import("../../index").Validator<FormValues>["getFieldErrors"]
>
// @ts-expect-error 字段错误快照是只读数组。
fieldErrors.push("外部修改")
if (!result.valid) {
  const error: ValidationError<"email"> = result.errors[0]
  if (error.scope === "field") {
    const name: "email" = error.name
    void name
  }
}

void fields
void emailRules
void invalidEmailRules
void adapterObjectRules
void stableContextFactory
void required
void resolvedRequiredMark
void invalidDynamicRules
void invalidDynamicRequiredMark
void dynamicRequired
void invalidDynamicRequired
void inferredFieldResult
void externalAdapter
void versionedExternalAdapter
void versionedRuleInput
