<template>
  <div :class="['schemx-renderer', 'schemx-upload-renderer', props.className]">
    <SchemxCell
      v-if="props.readonly && innerFileList.length === 0"
      :value="''"
      :readonly="true"
      :disabled="props.disabled"
      :readonly-placeholder="props.readonlyPlaceholder"
    />
    <Uploader
      v-else
      v-bind="uploadProps"
      ref="uploadRef"
      result-type="file"
      :multiple="multiple"
      :class="rootClass"
      :model-value="innerFileList"
      :show-upload="showUploadComputed"
      :deletable="deletableComputed"
      :disabled="disabledComputed"
      :readonly="uploaderReadonlyComputed"
      :before-read="handleBeforeRead"
      :after-read="afterRead"
      :accept="accept"
      @delete="onDelete"
    />
  </div>
</template>

<script setup lang="ts">
  /**
   * 上传渲染器组件
   *
   * 基于 Vant Uploader 封装，支持自定义上传函数、文件状态管理、
   * 只读/禁用状态继承等能力。
   *
   * @module renderers/UploadRenderer
   */
  import { computed, ref, useAttrs, watch } from "vue"

  import { Uploader } from "vant"

  import { useFieldContext } from "@schemx/vue"
  import classNames from "classnames"

  import SchemxCell from "@/components/Cell/index.vue"
  import { getFileName } from "@/utils"

  import type { UploadFile, UploadRendererProps, UploadValue } from "./types"

  import "./index.scss"

  defineOptions({
    name: "UploadRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<UploadRendererProps>(), {
    value: () => [],
    accept: "*",
    onChange: () => {},
    className: "",
    showUpload: true,
    disableUpload: false,
    deletable: true,
    readonly: false,
    readonlyPlaceholder: "-",
    disabled: false,
    multiple: true,
    uploader: () => Promise.resolve({}),
    propsHttp: () => ({
      res: "data",
      url: "link",
      name: "originalName",
    }),
  })

  const attrs = useAttrs()

  const uploadAttrs = attrs as Record<string, any>

  const uploadValue = defineModel<UploadValue>("value")

  const field = useFieldContext()

  const uploadRef = ref<InstanceType<typeof Uploader> | null>(null)

  /** 内部上传中的文件列表（status 为 uploading 的文件） */
  const uploadingFiles = ref<UploadFile[]>([])

  const httpRes = computed(() => ({
    res: "data",
    url: "link",
    name: "originalName",
    ...props.propsHttp,
  }))

  /**
   * 将外部值标准化为文件对象
   */
  const normalizeFile = (item: any): UploadFile | null => {
    if (!item) return null
    const url = item?.url || item

    return {
      ...(typeof item === "string" ? {} : item),
      url,
      uid: item?.uid || getFileName(url),
      status: item?.status || "done",
    }
  }

  /**
   * 合并 props.value 和上传中的文件，去重
   */
  const innerFileList = computed(() => {
    const propsFiles = (
      Array.isArray(uploadValue.value) ? uploadValue.value : [uploadValue.value]
    )
      .filter(Boolean)
      .map(normalizeFile)
      .filter(Boolean) as UploadFile[]

    const fileMap = new Map<string, UploadFile>()

    propsFiles.forEach((file) => {
      if (file.uid) {
        fileMap.set(file.uid, file)
      }
    })

    uploadingFiles.value.forEach((file) => {
      if (file.uid) {
        fileMap.set(file.uid, file)
      }
    })

    return Array.from(fileMap.values())
  })

  // 监听外部 value 变化，清理已完成上传的文件
  watch(
    () => uploadValue.value,
    (newVal) => {
      if (!newVal || (Array.isArray(newVal) && newVal.length === 0)) {
        uploadingFiles.value = []
      }
    },
    { deep: true }
  )

  const readonlyComputed = computed(() => props.readonly)

  const disabledComputed = computed(() => props.disabled)

  const multiple = computed(() => {
    const rendererProps = props as typeof props & { multiple?: boolean }

    return rendererProps.multiple ?? uploadAttrs.multiple ?? true
  })

  const deletableComputed = computed(() =>
    readonlyComputed.value ? false : props.deletable
  )

  const showUploadComputed = computed(() =>
    readonlyComputed.value || props.disableUpload ? false : props.showUpload
  )

  const uploaderReadonlyComputed = computed(() => readonlyComputed.value)

  const uploadProps = computed(() => {
    const rendererProps = props as typeof props & { formInstance?: unknown }

    const {
      value: _value,
      onChange: _onChange,
      className: _className,
      showUpload: _showUpload,
      disableUpload: _disableUpload,
      deletable: _deletable,
      readonly: _readonly,
      readonlyPlaceholder: _readonlyPlaceholder,
      disabled: _disabled,
      uploader: _uploader,
      propsHttp: _propsHttp,
      accept: _accept,
      beforeRead: _beforeRead,
      afterRead: _afterRead,
      formItemProps: _formItemProps,
      formInstance: _formInstance,
      ...rest
    } = rendererProps

    const {
      value: _attrsValue,
      onChange: _attrsOnChange,
      className: _attrsClassName,
      showUpload: _attrsShowUpload,
      disableUpload: _attrsDisableUpload,
      deletable: _attrsDeletable,
      readonly: _attrsReadonly,
      readonlyPlaceholder: _attrsReadonlyPlaceholder,
      disabled: _attrsDisabled,
      uploader: _attrsUploader,
      propsHttp: _attrsPropsHttp,
      accept: _attrsAccept,
      beforeRead: _attrsBeforeRead,
      afterRead: _attrsAfterRead,
      onDelete: _attrsOnDelete,
      formItemProps: _attrsFormItemProps,
      formInstance: _attrsFormInstance,
      ...attrsRest
    } = attrs

    return { ...attrsRest, ...rest }
  })

  const rootClass = computed(() =>
    classNames("schemx-renderer", "schemx-upload-renderer", props.className)
  )

  /**
   * 重置操作标志
   */
  const resetFieldPending = () => {
    const isPending = uploadingFiles.value.some((i) => i.status === "uploading")

    if (!isPending) {
      // field.setPending(false)
    }
  }

  /**
   * 上传成功
   */
  const onSuccess = (res: any, file: UploadFile): void => {
    const index = uploadingFiles.value.findIndex((i) => i.uid === file.uid)

    if (index === -1) return

    const completedFile: UploadFile = {
      ...uploadingFiles.value[index],
      url: res[httpRes.value.res][httpRes.value.url],
      name: res[httpRes.value.res][httpRes.value.name],
      status: "done",
      message: "上传成功",
    }

    uploadingFiles.value = uploadingFiles.value.filter((i) => i.uid !== file.uid)

    const currentDoneFiles = (Array.isArray(uploadValue.value) ? uploadValue.value : [])
      .filter(Boolean)
      .map(normalizeFile)
      .filter(Boolean) as UploadFile[]

    const nextFiles = [...currentDoneFiles, completedFile]

    uploadValue.value = nextFiles
    props.onChange?.(nextFiles)

    resetFieldPending()
  }

  /**
   * 上传失败
   */
  const onFail = (_error: Error, file: UploadFile): void => {
    const index = uploadingFiles.value.findIndex((i) => i.uid === file.uid)

    if (index === -1) return

    uploadingFiles.value[index] = {
      ...uploadingFiles.value[index],
      status: "failed",
      message: "上传失败",
    }

    resetFieldPending()
  }

  const handleBeforeRead = (
    file: File | File[],
    detail: { name: string | number; index: number }
  ): boolean | Promise<File | File[] | undefined> | undefined => {
    const beforeRead = props.beforeRead || uploadAttrs.beforeRead

    if (beforeRead) {
      return beforeRead(file, detail)
    }

    return true
  }

  const afterRead = async (
    files: any | any[],
    detail: { name: string | number; index: number }
  ): Promise<void> => {
    try {
      const customAfterRead = props.afterRead || uploadAttrs.afterRead

      if (customAfterRead) {
        return customAfterRead(files, detail)
      }

      const _fileList = Array.isArray(files) ? files : [files]

      field.setPending(true, "文件上传中")

      const uploadList = _fileList.map((item) => {
        const newItem: UploadFile = {
          ...item,
          url: item.objectUrl,
          uid: getFileName(item.objectUrl),
          status: "uploading" as const,
          message: "上传中...",
        }

        if (!newItem.file) {
          throw "file is undefined"
        }

        props
          .uploader?.(newItem.file)
          .then((res) => {
            onSuccess(res, newItem)
          })
          .catch((error) => {
            onFail(error, newItem)
          })

        return newItem
      })

      uploadingFiles.value = [...uploadingFiles.value, ...uploadList]
    } catch (error: any) {
      console.error("Upload failed:", error.message || "上传失败")
    }
  }

  const onDelete = (file: UploadFile, detail: { index: number }): void => {
    if (uploadAttrs.onDelete) {
      return uploadAttrs.onDelete(file, detail)
    }

    if (file.status === "uploading" || file.status === "failed") {
      uploadingFiles.value = uploadingFiles.value.filter((i) => i.uid !== file.uid)

      return
    }

    const currentFiles = (Array.isArray(uploadValue.value) ? uploadValue.value : [])
      .filter(Boolean)
      .map(normalizeFile)
      .filter((i) => i && i.uid !== file.uid) as UploadFile[]

    uploadValue.value = currentFiles
    props.onChange?.(currentFiles)
  }
</script>
