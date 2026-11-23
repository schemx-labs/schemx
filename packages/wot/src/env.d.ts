/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue"
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare const uni: any

declare namespace UniApp {
  interface NodeInfo {
    [key: string]: any
  }

  interface SafeArea {
    [key: string]: any
  }

  interface SafeAreaInsets {
    [key: string]: any
  }

  interface UploadFileSuccessCallbackResult {
    [key: string]: any
  }

  interface GeneralCallbackResult {
    [key: string]: any
  }

  interface OnProgressUpdateResult {
    [key: string]: any
  }

  interface UploadTask {
    abort?: () => void
    onProgressUpdate?: (callback: (result: OnProgressUpdateResult) => void) => void
  }

  interface GetImageInfoSuccessData {
    [key: string]: any
  }

  interface ChooseImageSuccessCallbackResult {
    tempFilePaths?: string[]
    tempFiles?: any[]
    [key: string]: any
  }

  interface ChooseVideoSuccess {
    tempFilePath?: string
    tempFile?: any
    [key: string]: any
  }

  interface ChooseMediaSuccessCallbackResult {
    tempFiles: any[]
    [key: string]: any
  }
}
