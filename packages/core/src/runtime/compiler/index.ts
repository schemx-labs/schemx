/**
 * Schema 编译器入口。
 *
 * 聚合 createCompile 工厂函数与 Compile/CompileOptions/CompileError 类型。
 * 实现见 `./createCompile`，类型见 `./types`。
 *
 * @module core/runtime/compiler
 */

export { createCompile } from "./createCompile"
export { CompileError } from "./types"

export type { Compile, CompileOptions } from "./types"
