<script setup lang="ts">
  import { computed } from "vue"

  import { Document } from "@element-plus/icons-vue"

  import FileActions from "./file-actions.vue"

  import type { UploadListType } from "./types"
  import type { UploadFile as ElementUploadFile, UploadProps } from "element-plus"

  defineOptions({
    inheritAttrs: false,
  })

  interface UploadDisplayFile extends ElementUploadFile {
    type?: string
    previewUrl?: string
    downloadUrl?: string
  }

  interface FileDisplayProps {
    file: UploadDisplayFile
    index: number
    listType?: UploadListType | "picture-img"
    disabled?: boolean
    readonly?: boolean
    fileType?: string
    crossorigin?: UploadProps["crossorigin"]
    loadText?: string
  }

  const props = withDefaults(defineProps<FileDisplayProps>(), {
    listType: "text",
    disabled: false,
    readonly: false,
    fileType: "",
    crossorigin: "",
    loadText: "",
  })

  const emit = defineEmits<{
    preview: [file: UploadDisplayFile]
    download: [file: UploadDisplayFile, index: number]
    remove: [file: UploadDisplayFile]
  }>()

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

  const normalizedListType = computed<UploadListType>(() => {
    if (props.listType === "picture" || props.listType === "picture-card") {
      return props.listType
    }

    if (props.listType === "picture-img") {
      return "picture-card"
    }

    return "text"
  })

  const getExtension = (name?: string): string => {
    const cleanName = String(name).split(/[?#]/)[0].split("/").pop() || ""

    const extensionIndex = cleanName.lastIndexOf(".")

    return extensionIndex > 0 ? cleanName.slice(extensionIndex + 1).toLowerCase() : ""
  }

  const isImageFile = (file: UploadDisplayFile): boolean => {
    const configuredType = String(props.fileType || "").toLowerCase()

    if (["image", "img", "picture"].includes(configuredType)) {
      return true
    }

    if (["pdf", "video", "audio"].includes(configuredType)) {
      return false
    }

    const mime = String(file?.raw?.type || file?.type || "")
      .toLowerCase()
      .split(";")[0]
      .trim()

    if (mime === "image" || mime.startsWith("image/")) {
      return true
    }

    if (
      mime === "application/pdf" ||
      mime.startsWith("video/") ||
      mime.startsWith("audio/")
    ) {
      return false
    }

    return [file?.name, file?.url, file?.previewUrl, file?.downloadUrl].some((name) =>
      imageExtensions.has(getExtension(name))
    )
  }

  const canPreview = computed(() => Boolean(props.file))

  const canDownload = computed(() =>
    Boolean(
      props.file.previewUrl || props.file.url || props.file.downloadUrl || props.file.raw
    )
  )

  const canRemove = computed(() => !props.disabled && !props.readonly)

  const openPreview = () => {
    if (canPreview.value) {
      emit("preview", props.file)
    }
  }

  const handleDownload = () => {
    if (canDownload.value) {
      emit("download", props.file, props.index)
    }
  }

  const handleRemove = () => {
    if (canRemove.value) {
      emit("remove", props.file)
    }
  }
</script>

<template>
  <div class="file-display" :class="`file-display--${normalizedListType}`">
    <div
      v-if="normalizedListType === 'text'"
      class="file-display__text-item"
      :class="{ 'file-display__text-item--error': file.status === 'fail' }"
    >
      <div
        class="file-display__text-info"
        :class="{ 'file-display__text-info--clickable': canPreview }"
        @click="openPreview"
      >
        <el-icon class="file-display__text-icon"><Document /></el-icon>
        <span class="file-display__text-name" :title="file.name">
          {{ file.name || "未命名文件" }}
        </span>
        <span v-if="file.status === 'uploading'" class="file-display__text-status">
          {{ loadText || `${Math.round(file.percentage || 0)}%` }}
        </span>
        <span v-else-if="file.status === 'fail'" class="file-display__text-status">
          上传失败
        </span>
      </div>

      <FileActions
        :can-preview="canPreview"
        :can-download="canDownload"
        :can-remove="canRemove"
        @preview="openPreview"
        @download="handleDownload"
        @remove="handleRemove"
      />
    </div>

    <div
      v-else-if="normalizedListType === 'picture'"
      class="file-display__picture-item"
      :class="{ 'file-display__picture-item--error': file.status === 'fail' }"
    >
      <div
        class="file-display__picture-thumb"
        :class="{ 'file-display__picture-thumb--clickable': canPreview }"
        @click="openPreview"
      >
        <img
          v-if="isImageFile(file) && (file.previewUrl || file.url)"
          class="file-display__picture-image"
          :src="file.previewUrl || file.url"
          :crossorigin="crossorigin || undefined"
          :alt="file.name"
        />
        <el-icon v-else class="file-display__picture-file-icon"><Document /></el-icon>
      </div>

      <div
        class="file-display__picture-info"
        :class="{ 'file-display__picture-info--clickable': canPreview }"
        @click="openPreview"
      >
        <span class="file-display__picture-name" :title="file.name">
          {{ file.name || "未命名文件" }}
        </span>
        <span v-if="file.status === 'uploading'" class="file-display__picture-status">
          {{ loadText || `${Math.round(file.percentage || 0)}%` }}
        </span>
        <span v-else-if="file.status === 'fail'" class="file-display__picture-status">
          上传失败
        </span>
      </div>

      <FileActions
        :can-preview="canPreview"
        :can-download="canDownload"
        :can-remove="canRemove"
        @preview="openPreview"
        @download="handleDownload"
        @remove="handleRemove"
      />
    </div>

    <div
      v-else
      class="file-display__card"
      :class="{ 'file-display__card--error': file.status === 'fail' }"
    >
      <div
        class="file-display__card-body"
        :class="{ 'file-display__card-body--clickable': canPreview }"
        @click="openPreview"
      >
        <img
          v-if="isImageFile(file) && (file.previewUrl || file.url)"
          class="file-display__card-image"
          :src="file.previewUrl || file.url"
          :crossorigin="crossorigin || undefined"
          :alt="file.name"
        />
        <el-icon v-else class="file-display__card-file-icon"><Document /></el-icon>
        <FileActions
          layout="overlay"
          :can-preview="canPreview"
          :can-download="canDownload"
          :can-remove="canRemove"
          @preview="openPreview"
          @download="handleDownload"
          @remove="handleRemove"
        />
        <span v-if="file.status === 'uploading'" class="file-display__card-status">
          {{ loadText || `${Math.round(file.percentage || 0)}%` }}
        </span>
        <span v-else-if="file.status === 'fail'" class="file-display__card-status">
          上传失败
        </span>
      </div>

      <!-- <div class="file-display__card-footer">
        <span class="file-display__card-name" :title="file.name">
          {{ file.name || "未命名文件" }}
        </span>
        <FileActions
          layout="footer"
          :can-remove="canRemove"
          @preview="openPreview"
          @download="handleDownload"
          @remove="handleRemove"
        />
      </div> -->
    </div>
  </div>
</template>

<style scoped lang="scss">
  .file-display {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;

    &--text {
      .file-display__text-item {
        display: flex;
        align-items: center;
        min-height: 36px;
        padding: 0 10px;
        border-radius: 4px;
        background: var(--el-fill-color-lighter);
        transition: background-color 0.2s;

        &:hover {
          background: var(--el-fill-color-light);
        }

        &--error {
          color: var(--el-color-danger);
        }
      }

      .file-display__text-info {
        display: flex;
        flex: 1;
        align-items: center;
        min-width: 0;

        &--clickable {
          cursor: pointer;
        }
      }

      .file-display__text-icon {
        flex-shrink: 0;
        margin-right: 8px;
        color: var(--el-text-color-secondary);
      }

      .file-display__text-name {
        overflow: hidden;
        color: var(--el-text-color-regular);
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .file-display__text-status {
        flex-shrink: 0;
        margin-left: 8px;
        color: var(--el-text-color-secondary);
        font-size: 12px;
      }
    }

    &--picture {
      .file-display__picture-item {
        display: flex;
        align-items: center;
        min-height: 36px;
        border-radius: 4px;
        transition: background-color 0.2s;

        &--error {
          color: var(--el-color-danger);
        }
      }

      .file-display__picture-thumb {
        display: flex;
        flex: 0 0 48px;
        align-items: center;
        justify-content: center;
        width: 45px;
        height: 45px;
        margin-right: 10px;
        overflow: hidden;
        border-radius: 4px;
        background: var(--el-fill-color);

        &--clickable {
          cursor: pointer;
        }
      }

      .file-display__picture-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .file-display__picture-file-icon {
        color: var(--el-text-color-secondary);
        font-size: 24px;
      }

      .file-display__picture-info {
        display: flex;
        flex: 1;
        align-items: center;
        min-width: 0;

        &--clickable {
          cursor: pointer;
        }
      }

      .file-display__picture-name {
        overflow: hidden;
        color: var(--el-text-color-regular);
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .file-display__picture-status {
        flex-shrink: 0;
        margin-left: 8px;
        color: var(--el-text-color-secondary);
        font-size: 12px;
      }
    }

    &--picture-card {
      height: 100%;
      .file-display__card {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: var(--el-bg-color);

        &--error {
          color: var(--el-color-danger);
        }

        &-body {
          position: relative;
          display: flex;
          flex: 1;
          align-items: center;
          justify-content: center;
          min-height: 0;
          overflow: hidden;
          background: var(--el-fill-color-lighter);

          &--clickable {
            cursor: pointer;
          }
        }

        &-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        &-file-icon {
          color: var(--el-text-color-secondary);
          font-size: 36px;
        }

        &-status {
          position: absolute;
          right: 6px;
          bottom: 4px;
          padding: 1px 4px;
          border-radius: 3px;
          background: rgb(0 0 0 / 55%);
          color: #fff;
          font-size: 12px;
        }

        &-footer {
          display: flex;
          flex: 0 0 32px;
          align-items: center;
          gap: 4px;
          min-width: 0;
          padding: 0 6px;
        }

        &-name {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          color: var(--el-text-color-regular);
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }
  }
</style>
