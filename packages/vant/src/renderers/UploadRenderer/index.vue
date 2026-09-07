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

  import { ImagePreview, Uploader } from "vant"

  import { useFieldContext, Wrapper } from "@schemx/vue"
  import classNames from "classnames"

  import { getFileName } from "@/utils"

  import UploadCardList from "./UploadCardList.vue"
  import UploadList from "./UploadList.vue"

  import type {
    UploadDisplayFile,
    UploadFile,
    UploadRendererProps,
    UploadValue,
  } from "./types"

  defineOptions({
    name: "UploadRendererComponent",
    inheritAttrs: false,
  })

  /** UploadRenderer 的公开配置及其默认值。 */
  const props = withDefaults(defineProps<UploadRendererProps>(), {
    value: () => [],
    accept: "*",
    onChange: () => {},
    className: "",
    showUpload: true,
    listType: "card",
    disableUpload: false,
    deletable: true,
    readonly: false,
    readonlyPlaceholder: "-",
    disabled: false,
    multiple: true,
    imageFit: "cover",
    previewFullImage: true,
    uploader: () => Promise.resolve({}),
    propsHttp: () => ({
      res: "data",
      url: "link",
      name: "originalName",
    }),
  })

  /** 未声明的 Uploader 原生属性与事件。 */
  const attrs = useAttrs()

  /** 以便按 Uploader 契约读取透传属性。 */
  const uploadAttrs = attrs as Record<string, any>

  /** 对外双向绑定的已完成文件列表。 */
  const uploadValue = defineModel<UploadValue>("value")

  /** 用于同步上传过程的表单 pending 状态。 */
  const field = useFieldContext()

  /** 保留 Uploader 实例，兼容其公开选择文件能力。 */
  const uploadRef = ref<InstanceType<typeof Uploader> | null>(null)

  /** 内部上传中的文件列表（status 为 uploading 的文件） */
  const uploadingFiles = ref<UploadFile[]>([])

  /** 合并默认值和用户配置后的上传响应字段映射。 */
  const httpRes = computed(() => ({
    res: "data",
    url: "link",
    name: "originalName",
    ...props.propsHttp,
  }))

  /** 在缺少 MIME 类型时用于识别可预览图片的文件后缀。 */
  const imageExtensions = new Set([
    "jpeg",
    "jpg",
    "gif",
    "png",
    "svg",
    "webp",
    "jfif",
    "bmp",
    "dpg",
    "avif",
  ])

  /** 控制受控 ImagePreview 的开闭状态。 */
  const imagePreviewVisible = ref(false)

  /** 记录当前图片在预览图片数组中的起始下标。 */
  const imagePreviewStartPosition = ref(0)

  /**
   * 将外部值标准化为文件对象，并为缺失状态和唯一标识补齐默认值。
   *
   * @param item - 外部传入的 URL 字符串或文件对象。
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
   * 解析文件当前可用的展示地址。
   *
   * @param file - 待展示的上传文件。
   */
  const getFileSource = (file: UploadFile): string => {
    const source = file.objectUrl || file.content || file.url

    return typeof source === "string" ? source : ""
  }

  /**
   * 解析展示名称，优先保留服务端返回的原始文件名。
   *
   * @param file - 待解析名称的上传文件。
   */
  const getDisplayFileName = (file: UploadFile): string => {
    if (typeof file.name === "string" && file.name) {
      return file.name
    }

    if (file.file?.name) {
      return file.file.name
    }

    return getFileName(getFileSource(file))
  }

  /**
   * 将文件后缀转为展示标签；无后缀时以 FILE 兜底。
   *
   * @param fileName - 包含扩展名的文件名称。
   */
  const getFileExtension = (fileName: string): string => {
    const extension = fileName.split(".").pop()

    if (!extension || extension === fileName) {
      return "FILE"
    }

    return extension.toUpperCase()
  }

  /**
   * 去除扩展名以供横向卡片列表单独展示后缀。
   *
   * @param fileName - 包含扩展名的文件名称。
   */
  const getFileBaseName = (fileName: string): string => {
    const extension = getFileExtension(fileName)

    if (extension === "FILE") {
      return fileName
    }

    return fileName.slice(0, -(extension.length + 1))
  }

  /**
   * 判断文件是否可进入图片缩略图与全屏预览流程。
   *
   * @param file - 待识别的上传文件。
   * @param extension - 已解析的大写文件后缀。
   */
  const isImageFile = (file: UploadFile, extension: string): boolean => {
    if (file.isImage === true) {
      return true
    }

    if (file.file?.type) {
      return file.file.type.startsWith("image")
    }

    return imageExtensions.has(extension.toLowerCase())
  }

  /**
   * 合并已完成与上传中的文件，按 uid 去重以避免上传完成过渡期间重复展示。
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

  /** 为两种展示组件生成一致的名称、后缀、地址与图片标识。 */
  const displayFiles = computed<UploadDisplayFile[]>(() =>
    innerFileList.value.map((file, index) => {
      const fileName = getDisplayFileName(file)

      const extension = getFileExtension(fileName)

      return {
        file,
        index,
        source: getFileSource(file),
        fileName,
        baseName: getFileBaseName(fileName),
        extension,
        isImage: isImageFile(file, extension),
      }
    })
  )

  /** 仅保留具备地址的图片，避免 ImagePreview 出现无效页。 */
  const previewFiles = computed(() =>
    displayFiles.value.filter((displayFile) => displayFile.isImage && displayFile.source)
  )

  /** 将预览文件转换为 ImagePreview 所需的 URL 数组。 */
  const previewImages = computed(() =>
    previewFiles.value.map((displayFile) => displayFile.source)
  )

  /**
   * 透传可配置的预览行为；show、images 与 startPosition 仍由当前组件受控。
   */
  const imagePreviewOptions = computed(
    () => props.previewOptions ?? uploadAttrs.previewOptions ?? {}
  )

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

  /** 统一只读状态，供上传入口与删除操作共同消费。 */
  const readonlyComputed = computed(() => props.readonly)

  /** 统一禁用状态，避免触发原生文件选择。 */
  const disabledComputed = computed(() => props.disabled)

  /** 优先使用显式 props，其次读取透传的 multiple 配置。 */
  const multiple = computed(() => {
    const rendererProps = props as typeof props & { multiple?: boolean }

    return rendererProps.multiple ?? uploadAttrs.multiple ?? true
  })

  /** 只读模式始终禁止删除，其他模式沿用用户配置。 */
  const deletableComputed = computed(() =>
    readonlyComputed.value ? false : props.deletable
  )

  /** 只读或 disableUpload 时隐藏新增文件入口。 */
  const showUploadComputed = computed(() =>
    readonlyComputed.value || props.disableUpload ? false : props.showUpload
  )

  /** 映射到 Uploader 的只读状态。 */
  const uploaderReadonlyComputed = computed(() => readonlyComputed.value)

  /**
   * 过滤渲染器私有字段，仅向 Uploader 透传其可识别的原生属性。
   */
  const uploadProps = computed(() => {
    const rendererProps = props

    const {
      value: _value,
      onChange: _onChange,
      className: _className,
      showUpload: _showUpload,
      listType: _listType,
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
      beforeDelete: _beforeDelete,
      previewImage: _previewImage,
      previewFullImage: _previewFullImage,
      previewOptions: _previewOptions,
      formItemProps: _formItemProps,
      formInstance: _formInstance,
      ...rest
    } = rendererProps

    const {
      value: _attrsValue,
      onChange: _attrsOnChange,
      className: _attrsClassName,
      showUpload: _attrsShowUpload,
      listType: _attrsListType,
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
      beforeDelete: _attrsBeforeDelete,
      previewImage: _attrsPreviewImage,
      previewFullImage: _attrsPreviewFullImage,
      previewOptions: _attrsPreviewOptions,
      onClosePreview: _attrsOnClosePreview,
      onDelete: _attrsOnDelete,
      formItemProps: _attrsFormItemProps,
      formInstance: _attrsFormInstance,
      ...attrsRest
    } = attrs

    return { ...attrsRest, ...rest }
  })

  /** 组合渲染器基础类与调用方自定义类。 */
  const rootClass = computed(() =>
    classNames("schemx-renderer", "schemx-upload-renderer", props.className)
  )

  /** 根据 listType 选择卡片网格或横向附件卡片组件。 */
  const listComponent = computed(() =>
    props.listType === "list" ? UploadList : UploadCardList
  )

  /**
   * 在没有进行中的请求时清除表单的 pending 状态。
   */
  const resetFieldPending = () => {
    const isPending = uploadingFiles.value.some((i) => i.status === "uploading")

    if (!isPending) {
      field.setPending(false)
    }
  }

  /**
   * 将上传响应映射为已完成文件，并提交给双向绑定值。
   *
   * @param res - 自定义 uploader 返回的接口响应。
   * @param file - 对应的上传中临时文件。
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
   * 将上传中临时文件标记为失败，以便展示 Vant 风格错误遮罩。
   *
   * @param _error - 自定义 uploader 抛出的错误，仅用于触发失败状态。
   * @param file - 对应的上传中临时文件。
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

  /**
   * 优先调用调用方的读取前拦截器，未配置时允许继续读取。
   *
   * @param file - 用户刚选择的单个或多个原始文件。
   * @param detail - Uploader 提供的字段名和插入位置。
   */
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

  /**
   * 将已读取的文件加入上传队列，或交由调用方完整接管 afterRead 行为。
   *
   * @param files - Uploader 读取后的单个或多个文件项。
   * @param detail - Uploader 提供的字段名和插入位置。
   */
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

  /**
   * 从上传中临时队列或已完成双向绑定值中移除文件。
   *
   * @param file - 已通过删除拦截的目标文件。
   * @param detail - 目标文件在当前展示列表中的位置。
   */
  const onDelete = (file: UploadFile, detail: { index: number }): void => {
    const customDelete = uploadAttrs.onDelete

    if (customDelete) {
      customDelete(file, detail)

      return
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

  /**
   * 在真正删除前执行 Vant 兼容的 beforeDelete 拦截。
   *
   * @param displayFile - 用户请求删除的展示文件。
   */
  const handleFileDelete = (displayFile: UploadDisplayFile): void => {
    const detail = {
      name: props.name ?? uploadAttrs.name ?? "",
      index: displayFile.index,
    }

    const beforeDelete = props.beforeDelete || uploadAttrs.beforeDelete

    if (!beforeDelete) {
      onDelete(displayFile.file, detail)

      return
    }

    const deletionResult = beforeDelete(displayFile.file, detail)

    if (deletionResult instanceof Promise) {
      void deletionResult
        .then((shouldDelete) => {
          if (shouldDelete) {
            onDelete(displayFile.file, detail)
          }
        })
        .catch((error: unknown) => {
          console.error("Delete failed:", error)
        })

      return
    }

    if (deletionResult) {
      onDelete(displayFile.file, detail)
    }
  }

  /**
   * 打开图片预览，并从当前点击图片开始浏览所有可预览图片。
   *
   * @param displayFile - 用户点击的展示文件。
   */
  const handleFilePreview = (displayFile: UploadDisplayFile): void => {
    if (!props.previewFullImage || !displayFile.isImage || !displayFile.source) {
      return
    }

    const previewIndex = previewFiles.value.findIndex(
      (previewFile) => previewFile.index === displayFile.index
    )

    if (previewIndex === -1) {
      return
    }

    imagePreviewStartPosition.value = previewIndex
    imagePreviewVisible.value = true
  }

  /** 关闭预览后通知透传的 Uploader closePreview 监听器。 */
  const handlePreviewClose = (): void => {
    const closePreview = uploadAttrs.onClosePreview

    closePreview?.()
  }
</script>

<template>
  <Wrapper :class="rootClass" :readonly="props.readonly" :disabled="props.disabled">
    <template #readonly>
      <span v-if="innerFileList.length === 0">{{ props.readonlyPlaceholder }}</span>
      <component
        :is="listComponent"
        v-else
        :files="displayFiles"
        :deletable="false"
        :image-fit="props.imageFit"
        :lazy-load="props.lazyLoad"
        :preview-size="props.previewSize"
        @delete="handleFileDelete"
        @preview="handleFilePreview"
      />

      <ImagePreview
        v-bind="imagePreviewOptions"
        v-model:show="imagePreviewVisible"
        :images="previewImages"
        :start-position="imagePreviewStartPosition"
        @close="handlePreviewClose"
      />
    </template>

    <component
      :is="listComponent"
      :files="displayFiles"
      :deletable="deletableComputed"
      :image-fit="props.imageFit"
      :lazy-load="props.lazyLoad"
      :preview-size="props.previewSize"
      @delete="handleFileDelete"
      @preview="handleFilePreview"
    >
      <Uploader
        v-bind="uploadProps"
        ref="uploadRef"
        result-type="file"
        :multiple="multiple"
        :model-value="innerFileList"
        :show-upload="showUploadComputed"
        :deletable="deletableComputed"
        :disabled="disabledComputed"
        :readonly="uploaderReadonlyComputed"
        :before-read="handleBeforeRead"
        :after-read="afterRead"
        :accept="accept"
        :preview-image="false"
        @delete="onDelete"
      />
    </component>

    <ImagePreview
      v-bind="imagePreviewOptions"
      v-model:show="imagePreviewVisible"
      :images="previewImages"
      :start-position="imagePreviewStartPosition"
      @close="handlePreviewClose"
    />
  </Wrapper>
</template>
