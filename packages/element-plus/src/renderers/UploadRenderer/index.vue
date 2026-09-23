<template>
  <Wrapper
    :class="['schemx-renderer', 'schemx-upload-renderer', props.className]"
    :readonly="props.readonly"
    :disabled="props.disabled"
  >
    <template #readonly>
      <div v-if="fileList.length" class="schemx-upload-renderer__readonly-list">
        <ElImage
          v-for="(file, index) in imageFiles"
          :key="file.uid ?? file.name"
          :src="file.url"
          :preview-src-list="imageUrls"
          :initial-index="index"
          :preview-teleported="true"
          fit="cover"
        />
        <span
          v-for="file in nonImageFiles"
          :key="file.uid ?? file.name"
          class="schemx-upload-renderer__readonly-file"
        >
          {{ file.name }}
        </span>
      </div>
      <span v-else>{{ props.readonlyPlaceholder }}</span>
    </template>
    <ElUpload
      ref="uploadRef"
      v-bind="uploadProps"
      v-model:file-list="fileList"
      @change="handleChange"
      @remove="handleRemove"
      @preview="handlePreview"
      @success="handleSuccess"
      @error="handleError"
    >
      <template v-if="props.showUpload !== false">
        <slot>
          <ElIcon v-if="props.listType === 'picture-card'"><Plus /></ElIcon>
          <ElButton v-else type="primary">选择文件</ElButton>
        </slot>
      </template>
      <template #file="{ file, index }">
        <FileDisplay
          :file="file"
          :index="index"
          :list-type="props.listType"
          :file-type="props.fileType"
          :crossorigin="props.crossorigin"
          :disabled="props.disabled || props.disableUpload"
          @preview="handlePreview"
          @download="handleDownload"
          @remove="handleDisplayRemove"
        />
      </template>
    </ElUpload>
  </Wrapper>

  <FilePreview
    ref="previewRef"
    :files="fileList"
    :file-type="props.fileType"
    :preview-full-image="props.previewFullImage"
    :crossorigin="props.crossorigin"
    :before-preview="props.beforePreview"
    :download-handler="props.downloadHandler"
  >
    <template v-if="$slots.viewer" #viewer="viewerProps">
      <slot name="viewer" v-bind="viewerProps" />
    </template>
  </FilePreview>
</template>

<script setup lang="ts">
  /** 使用 Element Plus ElUpload 管理文件选择、上传和预览。 */
  import { computed, ref, useAttrs, watch } from "vue"

  import { Plus } from "@element-plus/icons-vue"
  import { useFieldContext, Wrapper } from "@schemx/vue"
  import { ElButton, ElIcon, ElImage, ElMessage, ElUpload } from "element-plus"

  import { getElementProps } from "@/renderers/shared/props"

  import FileDisplay from "./file-display.vue"
  import FilePreview from "./preview.vue"

  import type { UploadRendererProps, UploadValue } from "./types"
  import type {
    UploadFile as ElementUploadFile,
    UploadFiles,
    UploadInstance,
    UploadProps,
    UploadRawFile,
    UploadRequestHandler,
    UploadUserFile,
  } from "element-plus"

  defineOptions({
    name: "UploadRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<UploadRendererProps>(), {
    value: () => [],
    readonly: false,
    disabled: false,
    readonlyPlaceholder: "-",
    className: "",
    showUpload: true,
    disableUpload: false,
    previewFullImage: true,
    listType: "picture-card",
    multiple: true,
    showFileList: true,
    propsHttp: () => ({
      data: "data",
      url: "url",
      name: "name",
    }),
  })

  const attrs = useAttrs() as Record<string, unknown>

  console.log(" > ~ props:", props, attrs)

  const valueModel = defineModel<UploadValue>("value")

  const fileList = ref<UploadUserFile[]>(normalizeFiles(props.value))

  const previewRef = ref<{
    open: (file: ElementUploadFile) => void
    download: (file: ElementUploadFile, index?: number) => Promise<void>
  }>()

  const uploadRef = ref<UploadInstance>()

  const field = resolveFieldContext()

  watch(
    () => props.value,
    (value) => {
      fileList.value = normalizeFiles(value)
    },
    { deep: true }
  )

  const imageFiles = computed(() =>
    fileList.value.filter((file) => Boolean(file.url && isImageFile(file)))
  )

  const nonImageFiles = computed(() =>
    fileList.value.filter((file) => !file.url || !isImageFile(file))
  )

  const imageUrls = computed(() =>
    imageFiles.value.map((file) => file.url).filter((url): url is string => Boolean(url))
  )

  /** 将 accept 字符串拆分为可逐项比对的文件类型规则。 */
  const acceptRules = computed(() =>
    String(props.accept ?? attrs.accept ?? "")
      .split(",")
      .map((rule) => rule.trim())
      .filter(Boolean)
  )

  /** 判断文件是否符合扩展名、精确 MIME 或 MIME 通配规则。 */
  const isAcceptedFile = (file: File): boolean => {
    if (!acceptRules.value.length) return true

    const fileName = file.name.toLowerCase()

    const mimeType = file.type.toLowerCase()

    return acceptRules.value.some((rule) => {
      const normalizedRule = rule.toLowerCase()

      if (normalizedRule === "*" || normalizedRule === "*/*") return true
      if (normalizedRule.startsWith(".")) return fileName.endsWith(normalizedRule)

      if (normalizedRule.endsWith("/*")) {
        return mimeType.startsWith(normalizedRule.slice(0, -1))
      }

      if (normalizedRule.includes("/")) return mimeType === normalizedRule

      return fileName.endsWith(`.${normalizedRule}`)
    })
  }

  /** 提示文件类型不符合 accept 配置。 */
  const showInvalidTypeWarning = (fileName: string): void => {
    ElMessage.warning(
      `${fileName} 类型不符合要求，仅支持：${acceptRules.value.join("、")}`
    )
  }

  /** 强制校验文件类型，通过后再执行调用方的 beforeUpload。 */
  const handleBeforeUpload: NonNullable<UploadProps["beforeUpload"]> = (
    rawFile: UploadRawFile
  ) => {
    if (!isAcceptedFile(rawFile)) {
      showInvalidTypeWarning(rawFile.name)

      return false
    }

    const configuredBeforeUpload = props.beforeUpload ?? attrs.beforeUpload

    if (typeof configuredBeforeUpload !== "function") return true

    const beforeUpload = configuredBeforeUpload as NonNullable<
      UploadProps["beforeUpload"]
    >

    return beforeUpload(rawFile)
  }

  const uploadProps = computed(() => ({
    ...getElementProps(props, attrs, [
      "value",
      "showUpload",
      "disableUpload",
      "previewFullImage",
      "fileType",
      "beforePreview",
      "downloadHandler",
      "propsHttp",
      "uploader",
      "fileList",
      "onChange",
      "onRemove",
      "onPreview",
      "onSuccess",
      "onError",
      "beforeUpload",
    ]),
    disabled: props.disabled || props.disableUpload,
    beforeUpload: handleBeforeUpload,
    httpRequest: httpRequest.value,
  }))

  const httpRequest = computed<UploadRequestHandler | undefined>(() => {
    if (!props.uploader) return undefined

    return async (options) => {
      field?.setPending(true)

      try {
        const response = await props.uploader?.(options.file)

        options.onSuccess(response)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)

        const uploadError = new Error(message) as Parameters<typeof options.onError>[0]

        options.onError(uploadError)
      } finally {
        field?.setPending(false)
      }
    }
  })

  /**
   * 规范化外部文件列表。
   *
   * @param files - 外部传入的 Element Plus 文件列表。
   * @returns 可直接绑定到 ElUpload 的文件列表。
   */
  function normalizeFiles(files: UploadValue | undefined): UploadUserFile[] {
    return (files ?? []).map((file, index) => ({
      ...file,
      name: file.name || `file-${index + 1}`,
      uid: file.uid ?? index + 1,
      status: file.status ?? "success",
    }))
  }

  /**
   * 根据文件名或 MIME 类型判断是否为图片。
   *
   * @param file - Element Plus 文件项。
   * @returns 是否按图片展示。
   */
  function isImageFile(file: UploadUserFile): boolean {
    const rawFile = file.raw

    if (rawFile?.type) return rawFile.type.startsWith("image/")

    return /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(file.name)
  }

  /**
   * 将 Element Plus 文件列表同步到 Schemx 字段。
   *
   * @param files - Element Plus 当前文件列表。
   */
  const syncFiles = (files: UploadFiles): void => {
    const nextFiles = files.map((file) => ({
      name: file.name,
      uid: file.uid,
      status: file.status,
      percentage: file.percentage,
      size: file.size,
      response: file.response,
      url: file.url,
      raw: file.raw,
    }))

    fileList.value = nextFiles
    valueModel.value = nextFiles
    props.onChange?.(nextFiles)
  }

  /**
   * 处理文件列表变化。
   *
   * @param _file - 本次发生变化的文件。
   * @param files - Element Plus 当前文件列表。
   */
  const handleChange: NonNullable<UploadProps["onChange"]> = (
    _file: ElementUploadFile,
    files: UploadFiles
  ): void => {
    syncFiles(files)
  }

  /**
   * 处理文件删除。
   *
   * @param file - 被删除的文件。
   * @param files - 删除后的文件列表。
   */
  const handleRemove: NonNullable<UploadProps["onRemove"]> = (
    file: ElementUploadFile,
    files: UploadFiles
  ): void => {
    syncFiles(files)
    props.onRemove?.(file, files)
  }

  const handleDisplayRemove = (file: ElementUploadFile): void => {
    uploadRef.value?.handleRemove(file)
  }

  const handleDownload = (file: ElementUploadFile, index: number): void => {
    void previewRef.value?.download(file, index)
  }

  /**
   * 处理文件预览。
   *
   * @param file - 被预览的文件。
   */
  const handlePreview: NonNullable<UploadProps["onPreview"]> = (
    file: ElementUploadFile
  ): void => {
    previewRef.value?.open(file)
    props.onPreview?.(file)
  }

  /**
   * 处理上传成功并补充服务端文件信息。
   *
   * @param response - 服务端响应。
   * @param file - 上传完成的文件。
   * @param files - Element Plus 当前文件列表。
   */
  const handleSuccess: NonNullable<UploadProps["onSuccess"]> = (
    response: unknown,
    file: ElementUploadFile,
    files: UploadFiles
  ): void => {
    const responseData = getResponseValue(response, props.propsHttp?.data)

    const responseUrl = getResponseValue(responseData, props.propsHttp?.url)

    const responseName = getResponseValue(responseData, props.propsHttp?.name)

    if (typeof responseUrl === "string") file.url = responseUrl
    if (typeof responseName === "string") file.name = responseName

    syncFiles(files)
    props.onSuccess?.(response, file, files)
  }

  /**
   * 处理上传失败。
   *
   * @param error - Element Plus 上传错误。
   * @param file - 上传失败的文件。
   * @param files - Element Plus 当前文件列表。
   */
  const handleError: NonNullable<UploadProps["onError"]> = (
    error: Error,
    file: ElementUploadFile,
    files: UploadFiles
  ): void => {
    syncFiles(files)
    props.onError?.(error, file, files)
  }

  /**
   * 读取响应对象的指定字段。
   *
   * @param value - 待读取的响应值。
   * @param path - 点号分隔的字段路径。
   * @returns 字段值；路径不存在时返回 undefined。
   */
  function getResponseValue(value: unknown, path: string | undefined): unknown {
    if (!path) return value

    return path.split(".").reduce<unknown>((current, key) => {
      if (!current || typeof current !== "object") return undefined

      return (current as Record<string, unknown>)[key]
    }, value)
  }

  /** 尝试获取字段上下文，允许 Upload 作为独立组件测试。 */
  function resolveFieldContext() {
    try {
      return useFieldContext()
    } catch {
      return null
    }
  }
</script>

<style lang="scss">
  .schemx-renderer {
    box-sizing: border-box;
    width: 100%;

    .el-upload-list,
    .el-upload {
      --el-upload-list-picture-card-size: 125px;
      --el-upload-picture-card-size: 125px;
    }
  }

  .schemx-upload-renderer__readonly-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .schemx-upload-renderer__readonly-list .el-image {
    width: 80px;
    height: 80px;
  }

  .schemx-upload-renderer__readonly-file {
    color: var(--el-text-color-regular);
  }
</style>
