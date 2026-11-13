<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="打印预览"
    width="380px"
    :modal="false"
    append-to-body
  >
    <div id="printArea" class="print-area">
      <div class="print-ticket">{{ ticket?.text }}</div>
    </div>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">关闭</el-button>
      <el-button type="primary" :icon="Printer" @click="doPrint">打印</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { Printer } from '@element-plus/icons-vue'

defineProps({
  modelValue: Boolean,
  ticket: Object
})
const emit = defineEmits(['update:modelValue'])

function doPrint() {
  window.print()
}
</script>

<!--
  打印样式必须放在「非 scoped」style 块中：
  1. scoped 样式会自动给选择器追加 [data-v-xxx]，body、.el-overlay 等全局元素匹配不到
  2. 之前用 :global(@media print) 包裹是错误写法，编译产物错乱导致打印空白
-->
<style>
@media print {
  body * {
    visibility: hidden;
  }
  #printArea,
  #printArea * {
    visibility: visible;
  }
  /* 重置 dialog 容器：transform 会让 fixed 定位失效，overflow 会裁剪内容 */
  .el-overlay,
  .el-overlay-dialog,
  .el-dialog {
    transform: none !important;
    overflow: visible !important;
    box-shadow: none !important;
    background: transparent !important;
  }
  #printArea {
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    background: #fff;
    padding: 20px;
    z-index: 99999;
  }
  .print-ticket {
    font-family: 'Courier New', monospace;
    white-space: pre-wrap;
    font-size: 12px;
    line-height: 1.6;
  }
}
</style>
