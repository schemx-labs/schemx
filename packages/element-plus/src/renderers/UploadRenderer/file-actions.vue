<script setup lang="ts">
  import { Delete, Download, View } from "@element-plus/icons-vue"
  import { ElButton, ElTooltip } from "element-plus"

  interface FileActionsProps {
    canPreview?: boolean
    canDownload?: boolean
    canRemove?: boolean
    layout?: "inline" | "overlay" | "footer"
    showPreview?: boolean
    showDownload?: boolean
    showRemove?: boolean
  }

  const props = withDefaults(defineProps<FileActionsProps>(), {
    canPreview: false,
    canDownload: false,
    canRemove: false,
    layout: "inline",
    showPreview: true,
    showDownload: true,
    showRemove: true,
  })

  const emit = defineEmits<{
    preview: []
    download: []
    remove: []
  }>()
</script>

<template>
  <div class="file-actions" :class="`file-actions--${props.layout}`">
    <ElTooltip
      v-if="props.showPreview && props.canPreview"
      content="预览"
      :disabled="props.layout !== 'inline'"
    >
      <ElButton
        link
        :icon="View"
        title="预览"
        aria-label="预览"
        @click.stop="emit('preview')"
      />
    </ElTooltip>
    <ElTooltip
      v-if="props.showDownload && props.canDownload"
      content="下载"
      :disabled="props.layout !== 'inline'"
    >
      <ElButton
        link
        :icon="Download"
        title="下载"
        aria-label="下载"
        @click.stop="emit('download')"
      />
    </ElTooltip>
    <ElTooltip
      v-if="props.showRemove && props.canRemove"
      content="删除"
      :disabled="props.layout !== 'inline'"
    >
      <ElButton
        link
        type="danger"
        :icon="Delete"
        title="删除"
        aria-label="删除"
        @click.stop="emit('remove')"
      />
    </ElTooltip>
  </div>
</template>

<style scoped lang="scss">
  .file-actions {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 11px;

    &--inline {
      margin-left: 12px;
    }

    &--overlay {
      position: absolute;
      inset: 0;
      justify-content: center;
      gap: 10px;
      background: rgb(0 0 0 / 45%);
      opacity: 0;
      transition: opacity 0.2s;

      :deep(.el-button:not(.el-button--danger)) {
        color: #fff;
      }
    }

    :deep(.el-button) {
      margin-left: 0px;

      --el-font-size-base: 16px;
    }
  }

  :global(
    .file-display--picture-card .file-display__card-body:hover .file-actions--overlay
  ),
  :global(
    .file-display--picture-card
      .file-display__card-body:focus-within
      .file-actions--overlay
  ) {
    opacity: 1;
  }
</style>
