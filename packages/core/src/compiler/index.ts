/**
 * Schema 编译器入口。
 *
 * 聚合 createSchemaCompiler 工厂函数与 SchemaCompiler/SchemaCompilerOptions/CompileError 类型。
 * 实现见 `./createSchemaCompiler`，类型见 `./types`。
 *
 * @module core/compiler
 */

export { createSchemaCompiler } from "./createSchemaCompiler"
export { CompileError } from "./types"

export type {
  SchemaCompileResult,
  CreateDynamicRowOptions,
  SchemaNodeFactoryOptions,
  SchemaCompiler,
  SchemaCompilerOptions,
  SchemaCompilerConfig,
} from "./types"

export {
  createNodeKey,
  DEFAULT_PRESENTATION_STATE,
  resolvePresentationState,
  compileFieldSchema,
  createInitialDiagnostics,
  isValidationStateEqual,
  resolveComponentProps,
} from "./helper"
