<template>
  <div
    :class="
      classNames('schemx-renderer', 'schemx-upload-renderer', props.className, {
        'schemx-renderer-readonly': readonlyComputed,
        'schemx-renderer-disabled': disabledComputed,
      })
    "
  >
    <WdUpload
      v-bind="uploadProps"
      ref="uploadRef"
      :file-list="innerFileList"
      :limit="uploadLimit"
      :disabled="disabledComputed"
      :auto-upload="false"
      :accept="props.accept"
      @update:file-list="handleFileListUpdate"
      @change="handleUploadChange"
      @remove="handleRemove"
    />
  </div>
</template>

<script setup lang="ts">
  /**
   * 上传渲染器组件
   *
   * 基于 Wot UI Upload 封装，支持文件状态管理、
   * 只读/禁用状态继承等能力。
   *
   * @module renderers/UploadRenderer
   */
  import { computed, ref, useAttrs } from "vue"

  import WdUpload from "@wot-ui/ui/components/wd-upload/wd-upload.vue"

  import classNames from "classnames"

  import type { UploadFile, UploadRendererProps, UploadValue } from "./types"

  import "./index.scss"

  defineOptions({
    name: "UploadRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<UploadRendererProps>(), {
    value: () => [],
    accept: "image",
    onChange: () => {},
    className: "",
    showUpload: true,
    disableUpload: false,
    deletable: true,
    readonly: false,
    disabled: false,
    uploader: () => Promise.resolve({}),
    propsHttp: () => ({
      res: "data",
      url: "link",
      name: "originalName",
    }),
  })

  const uploadValue = defineModel<UploadValue>("value")

  const uploadRef = ref<InstanceType<typeof WdUpload> | null>(null)
  const attrs = useAttrs()

  const getFileUid = (url: string): number => {
    return Array.from(String(url)).reduce((hash, char) => {
      return (hash * 31 + char.charCodeAt(0)) >>> 0
    }, 0)
  }

  /**
   * 将外部值标准化为文件对象
   */
  const normalizeFile = (item: any): UploadFile | null => {
    if (!item) return null
    const url = String(item?.url || item || "")
    if (!url) return null

    return {
      ...(typeof item === "string" ? {} : item),
      url,
      uid: typeof item?.uid === "number" ? item.uid : getFileUid(url),
      status: item?.status || "success",
    }
  }

  /**
   * 将外部值转换为 Wot Upload 可识别的文件列表。
   */
  const innerFileList = computed(() => {
    return (Array.isArray(uploadValue.value) ? uploadValue.value : [uploadValue.value])
      .filter(Boolean)
      .map(normalizeFile)
      .filter(Boolean) as UploadFile[]
  })

  const readonlyComputed = computed(() => props.readonly)
  const disabledComputed = computed(() => props.disabled)
  const uploadLimit = computed(() => {
    if (readonlyComputed.value || props.showUpload === false || props.disableUpload) {
      return innerFileList.value.length
    }

    return props.limit
  })

  const omitInternalFields = (source: Record<string, any>): Record<string, any> => {
    const {
      value: _value,
      valueModifiers: _valueModifiers,
      onChange: _onChange,
      onBlur: _onBlur,
      className: _className,
      placeholder: _placeholder,
      readonlyPlaceholder: _readonlyPlaceholder,
      formItemProps: _formItemProps,
      showUpload: _showUpload,
      disableUpload: _disableUpload,
      readonly: _readonly,
      deletable: _deletable,
      uploader: _uploader,
      propsHttp: _propsHttp,
      ...rest
    } = source

    return rest
  }

  // 剔除 Schemx 契约字段，避免内部事件和表单元信息透传给 Wot 组件。
  const uploadProps = computed(() => {
    return {
      ...omitInternalFields(attrs as Record<string, any>),
      ...omitInternalFields(props as Record<string, any>),
    }
  })

  const syncFiles = (files: UploadFile[]): void => {
    uploadValue.value = files
    props.onChange?.(files)
  }

  const handleFileListUpdate = (files: UploadFile[]): void => {
    syncFiles(files)
  }

  const handleUploadChange = ({ fileList }: { fileList: UploadFile[] }): void => {
    syncFiles(fileList)
  }

  const handleRemove = ({ file }: { file: UploadFile }): void => {
    const nextFiles = innerFileList.value.filter((item) => item.uid !== file.uid)
    syncFiles(nextFiles)
  }
</script>
