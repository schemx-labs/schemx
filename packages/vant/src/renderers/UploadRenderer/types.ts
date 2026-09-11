/**
 * 上传渲染器类型定义
 *
 * @module renderers/UploadRenderer/types
 */

import type { ImagePreviewOptions, UploaderFileListItem, UploaderProps } from "vant"

import type { SchemxVueBaseComponentProps } from "@schemx/vue"

/** UploadRenderer 对外读写的文件列表值。 */
export type UploadValue = UploadFile[]

/** 上传文件列表展示方式 */
export type UploadListType = "card" | "list"

/**
 * 上传文件对象
 *
 * 描述单个上传文件的状态信息，兼容 Vant Uploader 的文件格式。
 */
export interface UploadFile {
  /** 文件 URL */
  url?: string
  /** 原始 File 对象 */
  file?: File
  /** 文件临时对象 URL */
  objectUrl?: string
  /** 文件内容 */
  content?: string
  /** 是否图片 */
  isImage?: boolean
  /** 上传状态 */
  status?: UploaderFileListItem["status"]
  /** 状态描述信息 */
  message?: string
  /** 文件唯一标识 */
  uid?: string
  /** 扩展字段 */
  [key: string]: any
}

/**
 * 文件列表的内部展示数据。
 *
 * 由 UploadRenderer 统一解析，避免不同展示组件对文件名和图片类型产生差异。
 */
export interface UploadDisplayFile {
  /** 原始文件 */
  file: UploadFile
  /** 原始列表索引 */
  index: number
  /** 可展示或预览的文件地址 */
  source: string
  /** 包含后缀的文件名 */
  fileName: string
  /** 不含后缀的文件名 */
  baseName: string
  /** 大写文件后缀，无后缀时为 FILE */
  extension: string
  /** 是否按图片处理 */
  isImage: boolean
}

/**
 * 上传渲染器 Props
 *
 * 定义上传组件的所有可配置属性。
 */
export interface UploadRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxVueBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<Omit<UploaderProps, "modelValue" | "onUpdate:modelValue" | "imageFit">> {
  /** 已上传的文件列表 */
  value?: UploadValue
  /** 文件列表变化回调 */
  onChange?: (files: UploadFile[]) => void
  /** 接受的文件类型 */
  accept?: UploaderProps["accept"]
  /** 自定义 CSS 类名 */
  className?: string
  /** 是否显示上传按钮 */
  showUpload?: UploaderProps["showUpload"]
  /** 图片缩略图填充方式 */
  imageFit?: UploaderProps["imageFit"]
  /** 是否允许点击图片打开全屏预览 */
  previewFullImage?: UploaderProps["previewFullImage"]
  /** 图片预览配置 */
  previewOptions?: Partial<ImagePreviewOptions>
  /** 文件列表展示方式 */
  listType?: UploadListType
  /** 是否禁用上传 */
  disableUpload?: boolean
  /** 是否可删除 */
  deletable?: UploaderProps["deletable"]
  /** 是否只读 */
  readonly?: UploaderProps["readonly"]
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 是否禁用 */
  disabled?: UploaderProps["disabled"]
  /** 自定义上传函数 */
  uploader?: (file: File) => Promise<any>
  /** HTTP 响应字段映射 */
  propsHttp?: {
    /** 响应数据字段名 */
    res?: string
    /** URL 字段名 */
    url?: string
    /** 文件名字段名 */
    name?: string
  }
}
