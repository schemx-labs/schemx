/** Upload Renderer 类型。 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { UploadFile as ElementUploadFile, UploadProps } from "element-plus"

/** Element Plus 上传文件项。 */
export type UploadFile = NonNullable<UploadProps["fileList"]>[number]

/** Element Plus 上传 Renderer 的字段值。 */
export type UploadValue = NonNullable<UploadProps["fileList"]>

/** Element Plus 原生上传列表类型。 */
export type UploadListType = NonNullable<UploadProps["listType"]>

/** 上传响应字段映射。 */
export interface UploadResponseFields {
  /** 响应数据所在字段。 */
  data?: string
  /** 文件地址所在字段。 */
  url?: string
  /** 文件名所在字段。 */
  name?: string
}

/** Element Plus 上传 Renderer Props。 */
export interface UploadRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "value" | "onChange" | "onBlur" | "onUpdate:value">,
    /* @vue-ignore */
    Omit<
      Partial<UploadProps>,
      | "fileList"
      | "onChange"
      | "onRemove"
      | "onPreview"
      | "onSuccess"
      | "onError"
      | "httpRequest"
    > {
  /** 当前上传文件列表。 */
  value?: UploadValue
  /** 文件列表变化回调。 */
  onChange?: (files: UploadValue) => void
  /** 自定义上传函数。 */
  uploader?: (file: File) => Promise<unknown>
  /** 是否显示默认上传按钮。 */
  showUpload?: boolean
  /** 是否禁用上传动作但保留文件列表。 */
  disableUpload?: boolean
  /** 是否允许点击图片预览。 */
  previewFullImage?: boolean
  /** 自定义上传响应字段映射。 */
  propsHttp?: UploadResponseFields
  /** 上传完成回调。 */
  onSuccess?: UploadProps["onSuccess"]
  /** 上传失败回调。 */
  onError?: UploadProps["onError"]
  /** 文件删除回调。 */
  onRemove?: UploadProps["onRemove"]
  /** 文件预览回调。 */
  onPreview?: UploadProps["onPreview"]
  /** Renderer 根节点的 CSS 类名。 */
  className?: string
  /** 只读状态下的空值占位文本。 */
  readonlyPlaceholder?: string
}

/** Element Plus 上传文件运行时项。 */
export type UploadRuntimeFile = ElementUploadFile
