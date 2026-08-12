<script setup lang="ts">
  import { Icon, Loading } from "vant"

  import type { UploadDisplayFile } from "./types"

  interface Props {
    /** 已统一解析的展示文件列表。 */
    files: UploadDisplayFile[]
    /** 是否显示每条横向附件卡片的删除操作。 */
    deletable: boolean
  }

  defineOptions({
    name: "UploadList",
  })

  /** 横向附件卡片展示配置。 */
  defineProps<Props>()

  /** 向父级报告预览与删除意图，保持文件状态由 UploadRenderer 统一维护。 */
  const emit = defineEmits<{
    delete: [file: UploadDisplayFile]
    preview: [file: UploadDisplayFile]
  }>()

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
  <div class="schemx-upload-list">
    <div
      v-for="displayFile in files"
      :key="displayFile.file.uid || displayFile.index"
      class="schemx-upload-list__item"
      :class="{
        'schemx-upload-list__item--previewable': displayFile.isImage,
      }"
      :role="displayFile.isImage ? 'button' : undefined"
      :tabindex="displayFile.isImage ? 0 : undefined"
      @click="displayFile.isImage && handlePreview(displayFile)"
      @keydown.enter="displayFile.isImage && handlePreview(displayFile)"
      @keydown.space.prevent="displayFile.isImage && handlePreview(displayFile)"
    >
      <span class="schemx-upload-list__name van-ellipsis">
        {{ displayFile.baseName }}
      </span>
      <span class="schemx-upload-list__extension">
        {{ displayFile.extension }}
      </span>

      <span
        v-if="
          displayFile.file.status === 'uploading' || displayFile.file.status === 'failed'
        "
        class="schemx-upload-list__status"
      >
        <Loading
          v-if="displayFile.file.status === 'uploading'"
          class="schemx-upload-list__loading"
        />
        <Icon v-else name="close" class="schemx-upload-list__status-icon" />
        <span v-if="displayFile.file.message" class="schemx-upload-list__status-message">
          {{ displayFile.file.message }}
        </span>
      </span>

      <button
        v-if="deletable && displayFile.file.status !== 'uploading'"
        type="button"
        class="schemx-upload-list__delete"
        :aria-label="`删除 ${displayFile.fileName}`"
        @click.stop="handleDelete(displayFile)"
      >
        <Icon name="cross" />
      </button>
    </div>

    <div class="schemx-upload-list__upload">
      <slot />
    </div>
  </div>
</template>

<style lang="scss">
  .schemx-upload-renderer {
    .schemx-upload-list {
      box-sizing: border-box;
      width: 100%;

      &__item {
        display: flex;
        gap: var(--van-padding-xs);
        align-items: center;
        box-sizing: border-box;
        width: 100%;
        min-height: 40px;
        padding: 0 var(--van-padding-sm);
        color: var(--van-text-color);
        text-align: left;
        background: var(--van-background-2);
        border: var(--van-border-width) solid var(--van-border-color);
        border-radius: var(--van-radius-md);

        &:not(:first-child) {
          margin-top: var(--van-padding-xs);
        }

        &--previewable {
          cursor: pointer;

          &:active {
            background: var(--van-active-color);
          }

          &:focus-visible {
            outline: 2px solid var(--van-primary-color);
            outline-offset: -2px;
          }
        }
      }

      &__name {
        flex: 1;
        min-width: 0;
        font-size: var(--van-font-size-md);
        line-height: var(--van-line-height-md);
        text-align: left;
      }

      &__extension {
        flex: none;
        min-width: 32px;
        padding: 3px 6px;
        color: var(--van-text-color-2);
        font-size: var(--van-font-size-xs);
        line-height: var(--van-line-height-xs);
        text-align: center;
        background: var(--van-background);
        border-radius: var(--van-radius-sm);
      }

      &__status {
        display: flex;
        flex: none;
        gap: var(--van-padding-base);
        align-items: center;
        color: var(--van-danger-color);
        font-size: var(--van-font-size-xs);
      }

      &__loading {
        width: 14px;
        height: 14px;
        color: var(--van-primary-color);
      }

      &__status-icon {
        font-size: 14px;
      }

      &__status-message {
        max-width: 96px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      &__delete {
        flex: none;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        color: var(--van-text-color-2);
        font-size: 16px;
        background: transparent;
        border: 0;
        cursor: pointer;

        &:focus-visible {
          outline: 2px solid var(--van-primary-color);
          outline-offset: 2px;
        }
      }

      &__upload {
        padding: var(--van-padding-xs) 0 0;
      }
    }
  }
</style>
