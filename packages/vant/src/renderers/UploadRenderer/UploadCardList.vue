<script setup lang="ts">
  import { computed } from "vue"

  import { Icon, Image, Loading } from "vant"

  import type { UploadDisplayFile } from "./types"
  import type { CSSProperties } from "@schemx/core"

  interface Props {
    /** 已统一解析的展示文件列表。 */
    files: UploadDisplayFile[]
    /** 是否显示每张卡片右上角的删除操作。 */
    deletable: boolean
    /** 图片缩略图的裁切方式。 */
    imageFit?: CSSProperties["objectFit"]
    /** 是否延迟加载图片缩略图。 */
    lazyLoad?: boolean
    /** 同时控制卡片宽高的预览尺寸。 */
    previewSize?: string | number | [string | number, string | number]
  }

  defineOptions({
    name: "UploadCardList",
  })

  /** 卡片展示配置。 */
  const props = defineProps<Props>()

  /** 向父级报告预览与删除意图，避免组件直接修改文件列表。 */
  const emit = defineEmits<{
    delete: [file: UploadDisplayFile]
    preview: [file: UploadDisplayFile]
  }>()

  /** 将 Vant 支持的单值或双值预览尺寸转换为卡片内联尺寸。 */
  const previewStyle = computed(() => {
    if (Array.isArray(props.previewSize)) {
      return {
        width: props.previewSize[0],
        height: props.previewSize[1],
      }
    }

    if (props.previewSize) {
      return {
        width: props.previewSize,
        height: props.previewSize,
      }
    }

    return undefined
  })

  /** 返回图片组件所需的预览宽度。 */
  const getPreviewWidth = (): string | number | undefined => {
    if (Array.isArray(props.previewSize)) {
      return props.previewSize[0]
    }

    return props.previewSize
  }

  /** 返回图片组件所需的预览高度。 */
  const getPreviewHeight = (): string | number | undefined => {
    if (Array.isArray(props.previewSize)) {
      return props.previewSize[1]
    }

    return props.previewSize
  }

  /**
   * 将图片预览请求交给父级统一管理 ImagePreview。
   *
   * @param file - 用户点击的展示文件。
   */
  const handlePreview = (file: UploadDisplayFile): void => {
    emit("preview", file)
  }

  /**
   * 将删除请求交给父级执行 beforeDelete 与数据同步。
   *
   * @param file - 用户请求删除的展示文件。
   */
  const handleDelete = (file: UploadDisplayFile): void => {
    emit("delete", file)
  }
</script>

<template>
  <div class="schemx-upload-card-list">
    <div
      v-for="displayFile in files"
      :key="displayFile.file.uid || displayFile.index"
      class="schemx-upload-card-list__item"
      :style="previewStyle"
    >
      <button
        type="button"
        class="schemx-upload-card-list__preview"
        :class="{
          'schemx-upload-card-list__preview--image': displayFile.isImage,
        }"
        :disabled="!displayFile.isImage || displayFile.file.status === 'uploading'"
        :aria-label="`预览 ${displayFile.fileName}`"
        @click="handlePreview(displayFile)"
      >
        <Image
          v-if="displayFile.isImage"
          :src="displayFile.source"
          :alt="displayFile.fileName"
          :fit="imageFit"
          :width="getPreviewWidth()"
          :height="getPreviewHeight()"
          :lazy-load="lazyLoad"
          class="schemx-upload-card-list__image"
        />
        <span v-else class="schemx-upload-card-list__extension">
          {{ displayFile.extension }}
        </span>

        <span
          v-if="
            displayFile.file.status === 'uploading' ||
            displayFile.file.status === 'failed'
          "
          class="schemx-upload-card-list__mask"
        >
          <Loading
            v-if="displayFile.file.status === 'uploading'"
            class="schemx-upload-card-list__loading"
          />
          <Icon v-else name="close" class="schemx-upload-card-list__mask-icon" />
          <span
            v-if="displayFile.file.message"
            class="schemx-upload-card-list__mask-message"
          >
            {{ displayFile.file.message }}
          </span>
        </span>
      </button>

      <button
        v-if="deletable && displayFile.file.status !== 'uploading'"
        type="button"
        class="schemx-upload-card-list__delete"
        :aria-label="`删除 ${displayFile.fileName}`"
        @click="handleDelete(displayFile)"
      >
        <Icon name="cross" />
      </button>

      <span class="schemx-upload-card-list__name van-ellipsis">
        {{ displayFile.fileName }}
      </span>
    </div>

    <slot />
  </div>
</template>

<style lang="scss">
  .schemx-upload-renderer {
    --schemx-upload-preview-size: var(--van-uploader-size);

    .schemx-upload-card-list {
      display: flex;
      flex-wrap: wrap;
      justify-content: var(--schemx-content-align);

      &__item {
        position: relative;
        width: var(--schemx-upload-preview-size);
        margin: 0 var(--van-padding-xs) var(--van-padding-xs) 0;
      }

      &__preview {
        position: relative;
        display: block;
        width: 100%;
        height: var(--schemx-upload-preview-size);
        padding: 0;
        overflow: hidden;
        color: inherit;
        background: var(--van-uploader-file-background);
        border: 0;
        border-radius: var(--van-uploader-border-radius);

        &--image {
          cursor: pointer;
        }

        &:focus-visible {
          outline: 2px solid var(--van-primary-color);
          outline-offset: 2px;
        }
      }

      &__image {
        display: block;
        width: 100%;
        height: 100%;
      }

      &__extension {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        padding: var(--van-padding-base);
        color: var(--van-uploader-text-color);
        font-size: var(--van-font-size-md);
        font-weight: var(--van-font-bold);
        background: var(--van-uploader-file-background);
        word-break: break-all;
      }

      &__mask {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: var(--van-uploader-mask-text-color);
        background: var(--van-uploader-mask-background);
        border-radius: inherit;
      }

      &__loading {
        width: var(--van-uploader-loading-icon-size);
        height: var(--van-uploader-loading-icon-size);
        color: var(--van-uploader-loading-icon-color);
      }

      &__mask-icon {
        font-size: var(--van-uploader-mask-icon-size);
      }

      &__mask-message {
        margin-top: 6px;
        padding: 0 var(--van-padding-base);
        font-size: var(--van-uploader-mask-message-font-size);
        line-height: var(--van-uploader-mask-message-line-height);
      }

      &__delete {
        position: absolute;
        top: 0;
        right: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: var(--van-uploader-delete-icon-size);
        height: var(--van-uploader-delete-icon-size);
        padding: 0;
        color: var(--van-uploader-delete-color);
        font-size: var(--van-uploader-delete-icon-size);
        background: var(--van-uploader-delete-background);
        border: 0;
        border-radius: 0 0 0 12px;
        cursor: pointer;

        &:focus-visible {
          outline: 2px solid var(--van-primary-color);
          outline-offset: 2px;
        }

        .van-icon {
          transform: scale(0.7) translate(10%, -10%);
        }
      }

      &__name {
        display: block;
        margin-top: var(--van-uploader-file-name-margin-top);
        color: var(--van-uploader-file-name-text-color);
        font-size: var(--van-uploader-file-name-font-size);
        text-align: center;
      }

      > .van-uploader {
        margin: 0 var(--van-padding-xs) var(--van-padding-xs) 0;
      }

      .van-uploader__wrapper {
        justify-content: var(--schemx-content-align);
      }
    }
  }
</style>
