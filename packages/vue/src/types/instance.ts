import type { ScrollToFieldOptions } from "./index"
import type { SchemxInstance as CoreInstance, NamePath, Values } from "@schemx/core"

/**
 * 在 Core 原生实例上组合 Vue 能力，不修改 Core 的声明合并入口。
 * @typeParam TValues - 表单值类型。
 */
export interface SchemxInstance<
  TValues extends Values = Values,
> extends CoreInstance<TValues> {
  /**
   * 定位已挂载的字段，并展开折叠的祖先 Group；未找到时返回 false。
   * 返回 true 表示已发起定位，不等待滚动结束或高亮消失；被新请求取代时返回 false。
   * @typeParam TName - 目标字段路径。
   * @param name - 要定位的字段路径。
   * @param options - 滚动行为、对齐方式和定位高亮。
   * @example await form.scrollToField("profile.nickname", { block: "center", highlight: true })
   */
  scrollToField<TName extends NamePath<TValues>>(
    this: void,
    name: TName,
    options?: ScrollToFieldOptions
  ): Promise<boolean>
}
