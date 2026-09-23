<script setup lang="ts">
  // 所有文件共用 Element Plus 查看器；非图片通过默认插槽展示提示。
  import { computed, onBeforeUnmount, ref, watch } from "vue"

  import {
    Back,
    DArrowLeft,
    DArrowRight,
    Document,
    Download,
    RefreshLeft,
    RefreshRight,
    Right,
    ZoomIn,
    ZoomOut,
  } from "@element-plus/icons-vue"
  import { ElButton, ElIcon, ElImageViewer } from "element-plus"

  import type { UploadBeforePreview, UploadDownloadHandler, UploadFile } from "./types"
  import type { ImageViewerInstance, ImageViewerProps, UploadRawFile } from "element-plus"

  interface PreviewFile extends UploadFile {
    type?: string
    previewUrl?: string
    downloadUrl?: string
  }

  interface PreviewFileWithRaw extends PreviewFile {
    raw: UploadRawFile
  }

  interface PreviewEntry {
    file: PreviewFile
    sourceIndex: number
  }

  interface CachedObjectUrl {
    raw: UploadRawFile
    url: string
  }

  type PreviewSource = PreviewFile | string | null | undefined

  interface PreviewProps extends ImageViewerProps {
    modelValue?: boolean
    files?: PreviewSource[]
    fileType?: string
    previewFullImage?: boolean
    beforePreview?: UploadBeforePreview
    downloadHandler?: UploadDownloadHandler
  }

  const props = withDefaults(defineProps<PreviewProps>(), {
    modelValue: false,
    urlList: () => [],
    files: () => [],
    initialIndex: 0,
    infinite: true,
    hideOnClickModal: false,
    teleported: true,
    closeOnPressEscape: true,
    showProgress: true,
    zoomRate: 1.2,
    minScale: 0.2,
    maxScale: 7,
    crossorigin: "",
    fileType: "",
    previewFullImage: true,
  })

  const emit = defineEmits<{
    "update:modelValue": [value: boolean]
    close: []
    switch: [index: number]
    error: [event: Event]
    rotate: [degree: number]
    download: [file: PreviewFile, index: number]
    "download-error": [error: Error, file: PreviewFile]
    preview: [file: PreviewFile]
  }>()

  // internalVisible 支持 open() 命令式调用，同时保留 modelValue 控制方式。
  const activeIndex = ref(0)

  const internalVisible = ref(false)

  const imageViewerRef = ref<ImageViewerInstance>()

  let activeFileKey: unknown

  // Ignore stale results when asynchronous beforePreview hooks overlap.
  let previewRequestId = 0

  // Blob URL 由当前组件创建，并在组件卸载时统一释放。
  const objectUrls = new Map<unknown, CachedObjectUrl>()

  /**
   * 从 URL 中提取用户可见的文件名。
   *
   * @param {string} url 文件 URL。
   * @returns {string} URL 最后的路径片段，无法提取时返回默认文件名。
   */
  const getFileName = (url: string): string => {
    const cleanUrl = url.split(/[?#]/)[0]

    return cleanUrl.split("/").pop() || "文件"
  }

  /**
   * 将字符串 URL 转换为统一的预览文件结构。
   *
   * @param {PreviewSource} file 文件 URL 或文件元数据。
   * @returns {PreviewFile|null|undefined} 统一后的文件元数据。
   */
  const normalizeFile = (file: PreviewSource): PreviewFile | null | undefined => {
    if (typeof file === "string") {
      return {
        url: file,
        name: getFileName(file),
        type: props.fileType || "",
        status: "success",
      }
    }

    return file
  }

  /**
   * 提取不含查询参数和片段标识的文件扩展名，并转换为小写。
   *
   * @param {string} name 文件名或文件 URL。
   * @returns {string} 小写文件扩展名。
   */
  const getExtension = (name?: string): string => {
    const cleanName = String(name).split(/[?#]/)[0].split("/").pop() || ""

    const extensionIndex = cleanName.lastIndexOf(".")

    return extensionIndex > 0 ? cleanName.slice(extensionIndex + 1).toLowerCase() : ""
  }

  const imageExtensions = new Set([
    "avif",
    "bmp",
    "gif",
    "heic",
    "heif",
    "ico",
    "jpeg",
    "jpg",
    "png",
    "svg",
    "webp",
  ])

  const transparentImageUrl = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="

  // Generic MIME values fall back to the filename extension.
  const genericMimeTypes = new Set([
    "application/octet-stream",
    "application/x-unknown",
    "binary/octet-stream",
  ])

  /**
   * 判断文件是否为图片；其他类型使用查看器默认插槽显示提示。
   *
   * @param {PreviewFile} file 文件元数据或浏览器原始文件。
   * @returns {boolean} 是否为图片。
   */
  const isImageFile = (file?: PreviewFile): boolean => {
    const configuredType = String(props.fileType || "").toLowerCase()

    if (
      ["image", "img", "picture"].includes(configuredType) ||
      configuredType.startsWith("image/") ||
      imageExtensions.has(configuredType)
    ) {
      return true
    }

    if (configuredType && !genericMimeTypes.has(configuredType)) {
      return false
    }

    const mime = String(file?.raw?.type || file?.type || "")
      .toLowerCase()
      .split(";")[0]
      .trim()

    if (mime === "image" || mime.startsWith("image/")) {
      return true
    }

    if (mime && !genericMimeTypes.has(mime)) {
      return false
    }

    return [file?.name, file?.url, file?.previewUrl, file?.downloadUrl].some((name) =>
      imageExtensions.has(getExtension(name))
    )
  }

  /**
   * 为 Blob URL 缓存和图片切换生成稳定的文件标识。
   *
   * @param {PreviewFile} file 文件元数据或浏览器原始文件。
   * @returns {unknown} 稳定的文件标识。
   */
  const getObjectUrlKey = (file?: PreviewFile): unknown => file?.uid ?? file?.raw ?? file

  const isBlobFile = (file?: PreviewFile): file is PreviewFileWithRaw =>
    typeof Blob !== "undefined" && file?.raw instanceof Blob

  const hasPreviewSource = (file?: PreviewFile): boolean =>
    Boolean(file?.previewUrl || file?.url || file?.downloadUrl || isBlobFile(file))

  /**
   * 解析预览 URL，必要时创建并缓存 Blob URL。
   *
   * @param {PreviewFile} file 文件元数据或浏览器原始文件。
   * @returns {string} 可供预览渲染器使用的 URL。
   */
  const getFileUrl = (file?: PreviewFile): string => {
    if (file?.previewUrl) {
      return file.previewUrl
    }

    if (file?.url) {
      return file.url
    }

    if (file?.downloadUrl) {
      return file.downloadUrl
    }

    if (isBlobFile(file)) {
      const key = getObjectUrlKey(file)

      let cached = objectUrls.get(key)

      if (cached?.raw !== file.raw) {
        if (cached) URL.revokeObjectURL(cached.url)
        cached = { raw: file.raw, url: URL.createObjectURL(file.raw) }
        objectUrls.set(key, cached)
      }

      return cached.url
    }

    return ""
  }

  /**
   * 生成稳定标识，用于比较过滤前后的预览文件。
   *
   * @param {PreviewFile} file 文件元数据。
   * @returns {unknown} 稳定的文件标识。
   */
  const getFileKey = (file?: PreviewFile): unknown =>
    file?.uid ?? file?.raw ?? file?.url ?? file?.previewUrl ?? file?.downloadUrl ?? file

  // 保留原始文件索引，下载回调需要与 Upload fileList 的索引一致。
  const previewEntries = computed<PreviewEntry[]>(() => {
    const source: PreviewSource[] = props.files.length ? props.files : props.urlList

    return source
      .map((sourceFile, sourceIndex) => ({
        file: normalizeFile(sourceFile),
        sourceIndex,
      }))
      .filter((entry): entry is PreviewEntry => Boolean(entry.file))
  })

  const previewFiles = computed(() => previewEntries.value.map(({ file }) => file))

  /**
   * 将预览条目映射回输入列表索引，供下载回调使用。
   *
   * @param {PreviewFile} target 预览文件。
   * @returns {number} 输入列表索引；找不到时返回 -1。
   */
  const getSourceIndex = (target: PreviewFile): number => {
    const targetKey = getFileKey(target)

    return (
      previewEntries.value.find(
        ({ file }) => file === target || getFileKey(file) === targetKey
      )?.sourceIndex ?? -1
    )
  }

  const activeFile = computed(() => previewFiles.value[activeIndex.value])

  const activeFileIsImage = computed(() => isImageFile(activeFile.value))

  const activeFileCanRenderImage = computed(
    () => activeFileIsImage.value && hasPreviewSource(activeFile.value)
  )

  const viewerUrls = computed(() =>
    previewFiles.value.map((file) =>
      isImageFile(file) && hasPreviewSource(file) ? getFileUrl(file) : transparentImageUrl
    )
  )

  const isVisible = computed(() => props.modelValue || internalVisible.value)

  const previewVisible = computed(() => isVisible.value && Boolean(activeFile.value))

  /**
   * 将当前索引限制在可用预览文件范围内。
   *
   * @param {number} index 请求打开的文件索引。
   */
  const setActiveIndex = (index: number): void => {
    if (!previewFiles.value.length) {
      activeIndex.value = 0
      activeFileKey = undefined

      return
    }

    const safeIndex = Number.isFinite(index) ? Math.floor(index) : 0

    activeIndex.value = Math.min(Math.max(safeIndex, 0), previewFiles.value.length - 1)
    activeFileKey = getFileKey(previewFiles.value[activeIndex.value])
  }

  /**
   * 将数字索引或文件对象解析为预览列表索引。
   *
   * @param {number|PreviewFile|null|undefined} target 文件索引或文件标识。
   * @returns {number} 匹配的索引，不存在时返回 -1。
   */
  const resolveFileIndex = (target: number | PreviewFile | null | undefined): number => {
    if (typeof target === "number") {
      return previewEntries.value.findIndex((entry) => entry.sourceIndex === target)
    }

    if (!target) {
      return -1
    }

    const targetKey = getFileKey(target)

    return previewFiles.value.findIndex(
      (file) => file === target || getFileKey(file) === targetKey
    )
  }

  /**
   * 打开对应的预览界面，必要时等待自定义预览拦截器放行。
   *
   * @param {number|PreviewFile} target 文件索引或文件标识。
   */
  const openPreview = (target: number | PreviewFile): void => {
    const index = resolveFileIndex(target)

    const file = previewFiles.value[index]

    if (index < 0 || !file) {
      return
    }

    if (!props.previewFullImage && isImageFile(file) && hasPreviewSource(file)) {
      return
    }

    const requestId = ++previewRequestId

    const show = () => {
      if (requestId !== previewRequestId) return

      const currentIndex = resolveFileIndex(file)

      if (currentIndex < 0) {
        return
      }

      setActiveIndex(currentIndex)
      internalVisible.value = true
      emit("preview", file)
    }

    if (typeof props.beforePreview !== "function") {
      show()

      return
    }

    let handled = false

    const done = () => {
      if (handled) {
        return
      }

      handled = true
      show()
    }

    try {
      const result = props.beforePreview(file, done)

      if (result && typeof result.then === "function") {
        result
          .then((value) => {
            if (value !== false) {
              done()
            }
          })
          .catch(() => undefined)
      } else if (result !== undefined && result !== false) {
        done()
      }
    } catch {
      return
    }
  }

  // 关闭当前预览，并同步 v-model 状态。
  const handleClose = (): void => {
    previewRequestId += 1
    internalVisible.value = false
    emit("update:modelValue", false)
    emit("close")
  }

  /**
   * 同步 Element Plus 查看器当前文件索引。
   *
   * @param {number} index 完整预览文件列表中的索引。
   */
  const handleViewerSwitch = (index: number): void => {
    const currentFile = previewFiles.value[index]

    if (!currentFile) return

    setActiveIndex(index)
    emit("switch", activeIndex.value)
  }

  /**
   * 将图片查看器错误转发给父组件。
   *
   * @param {Event} event 查看器错误事件。
   */
  const handleError = (event: Event): void => {
    emit("error", event)
  }

  /**
   * 将图片旋转事件转发给父组件。
   *
   * @param {number} degree 查看器报告的旋转角度。
   */
  const handleRotate = (degree: number): void => {
    emit("rotate", degree)
  }

  /**
   * 根据解析后的 URL 触发浏览器下载。
   *
   * @param {string} url 解析后的文件 URL。
   * @param {string} name 下载时使用的文件名。
   */
  const triggerDownload = (url: string, name: string): void => {
    const link = document.createElement("a")

    link.href = url
    link.download = name
    link.target = "_blank"
    link.rel = "noopener noreferrer"
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  /**
   * 优先使用自定义处理器下载，否则通过带认证的 fetch 兜底下载。
   *
   * @param {number|PreviewFile} target 文件索引或文件标识。
   * @param {number} [sourceIndex] 输入文件列表索引。
   * @returns {Promise<void>} 下载触发后结束。
   */
  const handleDownload = async (
    target: number | PreviewFile,
    sourceIndex?: number
  ): Promise<void> => {
    const previewIndex = resolveFileIndex(target)

    const file = previewFiles.value[previewIndex]

    const url = file?.downloadUrl || getFileUrl(file)

    if (!file || !url) {
      return
    }

    const resolvedSourceIndex = getSourceIndex(file)

    const index =
      typeof sourceIndex === "number" && Number.isInteger(sourceIndex) && sourceIndex >= 0
        ? sourceIndex
        : resolvedSourceIndex >= 0
          ? resolvedSourceIndex
          : previewIndex

    emit("download", file, index)

    if (props.downloadHandler) {
      try {
        await props.downloadHandler(file, index)
      } catch (error) {
        const downloadError = error instanceof Error ? error : new Error("文件下载失败")

        emit("download-error", downloadError, file)
      }

      return
    }

    if (/^(?:blob:|data:)/i.test(url)) {
      triggerDownload(url, file.name || getFileName(url))

      return
    }

    try {
      const response = await fetch(url, { credentials: "include" })

      if (!response.ok) {
        throw new Error(`文件下载失败：${response.status}`)
      }

      const blobUrl = URL.createObjectURL(await response.blob())

      triggerDownload(blobUrl, file.name || getFileName(url))
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch {
      triggerDownload(url, file.name || getFileName(url))
    }
  }

  /**
   * 下载查看器当前选中的文件。
   *
   * @param {number} viewerIndex 查看器列表中的索引。
   * @returns {Promise<void>|undefined} 文件存在且可下载时返回下载 Promise。
   */
  const handleViewerDownload = (viewerIndex: number): Promise<void> | undefined => {
    const file = previewFiles.value[viewerIndex]

    if (file && hasPreviewSource(file)) {
      return handleDownload(file)
    }
  }

  /**
   * 为自定义工具栏图标补充键盘操作，同时保持点击行为不变。
   *
   * @param {KeyboardEvent} event 键盘事件。
   * @param {() => void} action 待执行的工具栏操作。
   */
  const handleToolbarKeydown = (event: KeyboardEvent, action: () => void): void => {
    if (event.key !== "Enter" && event.key !== " ") {
      return
    }

    event.preventDefault()
    action()
  }

  // 外部控制显隐时使用 initialIndex；命令式打开则保留当前选中的文件。
  watch(
    () => props.modelValue,
    (value) => {
      if (!value) {
        previewRequestId += 1
        internalVisible.value = false

        return
      }

      if (!previewFiles.value.length) {
        emit("update:modelValue", false)

        return
      }

      setActiveIndex(resolveFileIndex(props.initialIndex))
    },
    { immediate: true }
  )

  watch(
    () => props.initialIndex,
    (index) => {
      if (props.modelValue) setActiveIndex(resolveFileIndex(index))
    }
  )

  watch(
    activeIndex,
    (index) => {
      imageViewerRef.value?.setActiveItem(index)
    },
    { flush: "post" }
  )

  watch(previewFiles, (files) => {
    const availableObjectUrls = new Map(
      files
        .filter(
          (file) => isBlobFile(file) && !file.previewUrl && !file.url && !file.downloadUrl
        )
        .map((file) => [getObjectUrlKey(file), file.raw])
    )

    for (const [key, cached] of objectUrls) {
      if (availableObjectUrls.get(key) !== cached.raw) {
        URL.revokeObjectURL(cached.url)
        objectUrls.delete(key)
      }
    }

    if (!isVisible.value) return
    if (!files.length) {
      handleClose()

      return
    }

    const currentIndex = files.findIndex((file) => getFileKey(file) === activeFileKey)

    if (currentIndex >= 0) {
      activeIndex.value = currentIndex
    } else {
      setActiveIndex(activeIndex.value)
    }
  })

  // 释放当前组件创建的所有 Blob URL，避免浏览器资源持续占用。
  onBeforeUnmount(() => {
    objectUrls.forEach(({ url }) => URL.revokeObjectURL(url))
    objectUrls.clear()
  })

  // FileDisplay 只通过这些方法控制预览，无需了解内部实现。
  defineExpose({
    open: openPreview,
    close: handleClose,
    download: handleDownload,
  })
</script>

<template>
  <!-- 图片使用内置画布，其他文件通过查看器默认插槽显示提示。 -->
  <ElImageViewer
    v-if="previewVisible"
    ref="imageViewerRef"
    class="upload-renderer-viewer"
    :url-list="viewerUrls"
    :initial-index="activeIndex"
    :infinite="infinite"
    :hide-on-click-modal="hideOnClickModal"
    :teleported="teleported"
    :close-on-press-escape="closeOnPressEscape"
    :show-progress="showProgress"
    :zoom-rate="zoomRate"
    :min-scale="minScale"
    :max-scale="maxScale"
    :crossorigin="crossorigin"
    @close="handleClose"
    @switch="handleViewerSwitch"
    @error="handleError"
    @rotate="handleRotate"
  >
    <template #toolbar="toolbar">
      <slot name="toolbar" v-bind="toolbar">
        <template v-if="previewFiles.length > 1">
          <ElIcon
            class="file-preview__action"
            title="上一张"
            aria-label="上一张"
            role="button"
            tabindex="0"
            @click="toolbar.prev"
            @keydown="handleToolbarKeydown($event, toolbar.prev)"
          >
            <Back />
          </ElIcon>
          <ElIcon
            class="file-preview__action"
            title="下一张"
            aria-label="下一张"
            role="button"
            tabindex="0"
            @click="toolbar.next"
            @keydown="handleToolbarKeydown($event, toolbar.next)"
          >
            <Right />
          </ElIcon>
          <ElIcon
            class="file-preview__action"
            title="第一张"
            aria-label="第一张"
            role="button"
            tabindex="0"
            @click="toolbar.setActiveItem(0)"
            @keydown="handleToolbarKeydown($event, () => toolbar.setActiveItem(0))"
          >
            <DArrowLeft />
          </ElIcon>
          <ElIcon
            class="file-preview__action"
            title="最后一张"
            aria-label="最后一张"
            role="button"
            tabindex="0"
            @click="toolbar.setActiveItem(previewFiles.length - 1)"
            @keydown="
              handleToolbarKeydown($event, () =>
                toolbar.setActiveItem(previewFiles.length - 1)
              )
            "
          >
            <DArrowRight />
          </ElIcon>
        </template>
        <template v-if="activeFileCanRenderImage">
          <ElIcon
            class="file-preview__action"
            title="缩小"
            aria-label="缩小"
            role="button"
            tabindex="0"
            @click="toolbar.actions('zoomOut')"
            @keydown="handleToolbarKeydown($event, () => toolbar.actions('zoomOut'))"
          >
            <ZoomOut />
          </ElIcon>
          <ElIcon
            class="file-preview__action"
            title="放大"
            aria-label="放大"
            role="button"
            tabindex="0"
            @click="toolbar.actions('zoomIn', { enableTransition: false, zoomRate })"
            @keydown="
              handleToolbarKeydown($event, () =>
                toolbar.actions('zoomIn', { enableTransition: false, zoomRate })
              )
            "
          >
            <ZoomIn />
          </ElIcon>
          <ElIcon
            class="file-preview__action"
            title="顺时针旋转"
            aria-label="顺时针旋转"
            role="button"
            tabindex="0"
            @click="
              toolbar.actions('clockwise', { rotateDeg: 180, enableTransition: false })
            "
            @keydown="
              handleToolbarKeydown($event, () =>
                toolbar.actions('clockwise', { rotateDeg: 180, enableTransition: false })
              )
            "
          >
            <RefreshRight />
          </ElIcon>
          <ElIcon
            class="file-preview__action"
            title="逆时针旋转"
            aria-label="逆时针旋转"
            role="button"
            tabindex="0"
            @click="
              toolbar.actions('anticlockwise', {
                rotateDeg: 180,
                enableTransition: false,
              })
            "
            @keydown="
              handleToolbarKeydown($event, () =>
                toolbar.actions('anticlockwise', {
                  rotateDeg: 180,
                  enableTransition: false,
                })
              )
            "
          >
            <RefreshLeft />
          </ElIcon>
        </template>
        <ElIcon
          v-if="activeFileCanRenderImage"
          class="file-preview__action"
          title="下载"
          aria-label="下载"
          role="button"
          tabindex="0"
          @click="handleViewerDownload(toolbar.activeIndex)"
          @keydown="
            handleToolbarKeydown($event, () => handleViewerDownload(toolbar.activeIndex))
          "
        >
          <Download />
        </ElIcon>
      </slot>
    </template>

    <div v-if="!activeFileCanRenderImage" class="file-preview__content">
      <slot
        name="viewer"
        :file="activeFile"
        :download="() => handleDownload(activeFile)"
        :close="handleClose"
      >
        <div class="file-preview__unsupported">
          <el-icon class="file-preview__unsupported-icon"><Document /></el-icon>
          <p>
            {{
              hasPreviewSource(activeFile)
                ? "该文件不支持预览，请下载后查看。"
                : "该文件暂无可预览内容。"
            }}
          </p>
          <ElButton
            v-if="hasPreviewSource(activeFile)"
            type="primary"
            link
            @click="handleDownload(activeFile)"
          >
            下载文件
          </ElButton>
        </div>
      </slot>
    </div>
  </ElImageViewer>
</template>

<style lang="scss">
  .file-preview {
    &__action {
      cursor: pointer;
      outline: none;

      &:focus-visible {
        outline: 2px solid currentColor;
        outline-offset: 2px;
        border-radius: 2px;
      }
    }

    &__content {
      position: absolute;
      inset: 0;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;

      > * {
        pointer-events: auto;
      }
    }

    &__unsupported {
      display: flex;
      align-items: center;
      flex-direction: column;
      gap: 24px;
      color: var(--el-fill-color-light);

      &-icon {
        flex-shrink: 0;
        font-size: 48px;
      }

      p {
        margin: 0;
        font-size: 15px;
      }
    }
  }

  .el-image-viewer__mask {
    backdrop-filter: blur(2px);
    opacity: 1;
    background-color: rgb(0 0 0 / 35%);
  }
</style>
