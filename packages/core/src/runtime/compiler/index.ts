/**
 * Schema 编译器入口。
 *
 * 聚合 createSchemaCompiler 工厂函数与 SchemaCompiler/SchemaCompilerOptions/CompileError 类型。
 * 实现见 `./createSchemaCompiler`，类型见 `./types`。
 *
 * @module core/runtime/compiler
 */

export { createCompile, createSchemaCompiler } from "./createSchemaCompiler"
export { CompileError } from "./types"

export type {
  Compile,
  CompileOptions,
  CreateCompileOptions,
  CreateCompiledNodeOptions,
  CreateSchemaCompilerOptions,
  SchemaNodeFactoryOptions,
  SchemaCompiler,
  SchemaCompilerOptions,
} from "./types"
