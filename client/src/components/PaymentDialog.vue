<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="混合支付"
    width="480px"
    :close-on-click-modal="false"
  >
    <div class="pay-info">
      <div class="pay-row">
        <span class="label">{{ direction === 'OUT' ? '应付金额' : '应收金额' }}</span>
        <span class="amount">{{ fenToYuan(expectedAmount) }}</span>
      </div>
    </div>

    <el-table :data="payRows" border size="small" style="margin: 12px 0;">
      <el-table-column label="支付方式" width="140">
        <template #default="{ row }">
          <el-select v-model="row.method" size="small" style="width: 100%">
            <el-option v-for="m in PAYMENT_METHODS" :key="m.value" :label="m.label" :value="m.value" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="金额（元）">
        <template #default="{ row }">
          <el-input-number
            v-model="row.yuan"
            :min="0"
            :precision="2"
            :controls="false"
            size="small"
            style="width: 100%"
            @input="calcDiff"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="70" align="center">
        <template #default="{ $index }">
          <el-button type="danger" link size="small" @click="removeRow($index)" :disabled="payRows.length <= 1">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-button :icon="Plus" size="small" @click="addRow">添加支付方式</el-button>

    <div class="pay-summary">
      <div class="summary-row">
        <span>已输入合计</span>
        <span class="value">{{ fenToYuan(totalInput) }}</span>
      </div>
      <div class="summary-row" :class="{ ok: diff === 0, err: diff !== 0 }">
        <span>{{ diff >= 0 ? '差额（待补）' : '差额（溢收）' }}</span>
        <span class="value">{{ fenToYuan(Math.abs(diff)) }}</span>
      </div>
    </div>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="diff !== 0" @click="confirm">确认支付</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { fenToYuan, yuanToFen, PAYMENT_METHODS } from '@/utils/format'

const props = defineProps({
  modelValue: Boolean,
  expectedAmount: { type: Number, default: 0 },
  direction: { type: String, default: 'IN' } // IN 收 / OUT 支
})
const emit = defineEmits(['update:modelValue', 'confirm'])

const payRows = ref([{ method: 'cash', yuan: 0 }])

watch(() => props.modelValue, (v) => {
  if (v) {
    // 打开时预填应付金额到第一行
    payRows.value = [{ method: 'cash', yuan: props.expectedAmount / 100 }]
  }
})

const totalInput = computed(() => payRows.value.reduce((s, r) => s + (r.yuan ? yuanToFen(r.yuan) : 0), 0))
const diff = computed(() => totalInput.value - props.expectedAmount)

function calcDiff() { /* 响应式自动计算，占位 */ }

function addRow() {
  payRows.value.push({ method: 'wechat', yuan: 0 })
}
function removeRow(idx) {
  payRows.value.splice(idx, 1)
}

function confirm() {
  if (diff.value !== 0) {
    ElMessage.warning('支付金额与应付金额不一致')
    return
  }
  const payments = payRows.value
    .filter((r) => r.yuan > 0)
    .map((r) => ({
      method: r.method,
      amount: yuanToFen(r.yuan),
      direction: props.direction
    }))
  emit('confirm', payments)
  emit('update:modelValue', false)
}
</script>

<style scoped>
.pay-info {
  background: linear-gradient(135deg, #FBF6EC, #F5EDD8);
  border: 1px solid var(--gold-light);
  border-radius: 8px;
  padding: 16px;
}
.pay-row { display: flex; justify-content: space-between; align-items: center; }
.pay-row .label { color: var(--text-secondary); font-size: 14px; }
.pay-row .amount { font-size: 24px; font-weight: 700; color: var(--gold-dark); }
.pay-summary { margin-top: 16px; border-top: 1px solid var(--border-light); padding-top: 12px; }
.summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
.summary-row .value { font-weight: 600; font-variant-numeric: tabular-nums; }
.summary-row.ok .value { color: #67C23A; }
.summary-row.err .value { color: #F56C6C; }
</style>
