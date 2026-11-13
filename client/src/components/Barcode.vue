<template>
  <svg ref="svgRef" :id="svgId"></svg>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import JsBarcode from 'jsbarcode'

const props = defineProps({
  value: { type: String, required: true },
  format: { type: String, default: 'CODE128' },
  width: { type: Number, default: 2 },
  height: { type: Number, default: 50 },
  displayValue: { type: Boolean, default: true }
})

const svgRef = ref(null)
const svgId = 'barcode-' + Math.random().toString(36).slice(2, 9)

function render() {
  if (!svgRef.value || !props.value) return
  try {
    JsBarcode(svgRef.value, props.value, {
      format: props.format,
      width: props.width,
      height: props.height,
      displayValue: props.displayValue,
      fontSize: 14,
      margin: 4
    })
  } catch (e) {
    console.error('条码生成失败', e)
  }
}

onMounted(render)
watch(() => props.value, render)
</script>
