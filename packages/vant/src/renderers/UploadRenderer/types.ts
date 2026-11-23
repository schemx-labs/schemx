/**
 * 上传渲染器类型定义
 *
 * @module renderers/UploadRenderer/types
 */

import type { UploaderFileListItem, UploaderProps } from "vant"

import type { SchemxBaseComponentProps } from "@schemx/vue"

export type UploadValue = UploadFile[]

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
 * 上传渲染器 Props
 *
 * 定义上传组件的所有可配置属性。
 */
export interface UploadRendererProps
  extends
    Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">,
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
  /** 是否禁用上传 */
  disableUpload?: boolean
  /** 是否可删除 */
  deletable?: UploaderProps["deletable"]
  /** 是否只读 */
  readonly?: UploaderProps["readonly"]
  /** 是否详情展示 */
  view?: boolean
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
