<template>
  <div>
    <div class="page-card">
      <el-steps :active="step" finish-status="success" align-center>
        <el-step title="选择旧料" description="扫码或勾选在库旧料" />
        <el-step title="录入新品" description="新品名称、售价、工费" />
        <el-step title="确认支付" description="核对差价并收款" />
      </el-steps>
    </div>

    <!-- 步骤1：旧料 -->
    <div class="page-card" v-show="step === 0">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 class="section-title" style="margin: 0;">选择旧料并设置抵扣金额</h3>
        <div>
          <el-input v-model="searchCode" placeholder="扫码添加" style="width: 200px" @keyup.enter="addByCode" />
          <el-button :icon="Plus" @click="addByCode">添加</el-button>
        </div>
      </div>
      <el-table :data="oldItems" border size="small" show-summary :summary-method="oldSummary">
        <el-table-column prop="uniqueCode" label="编号" width="170" />
        <el-table-column prop="itemName" label="物品" min-width="120" />
        <el-table-column label="纯金重" width="100" align="right">
          <template #default="{ row }">{{ liangToGram(row.pureWeight) }} 克</template>
        </el-table-column>
        <el-table-column label="成本" width="110" align="right">
          <template #default="{ row }">{{ fenToYuan(row.costAmount) }}</template>
        </el-table-column>
        <el-table-column label="抵扣金额（元）" width="160">
          <template #default="{ row }">
            <el-input-number v-model="row.deductYuan" :min="0" :precision="2" :controls="false" size="small" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="70" align="center">
          <template #default="{ $index }">
            <el-button type="danger" link size="small" @click="oldItems.splice($index, 1)">移除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="!oldItems.length" class="empty-tip">请扫码或点击添加选择旧料</div>
      <div style="margin-top: 16px; text-align: right;">
        <el-button type="primary" :disabled="!oldItems.length" @click="step = 1">下一步：录入新品</el-button>
      </div>
    </div>

    <!-- 步骤2：新品 -->
    <div class="page-card" v-show="step === 1">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 class="section-title" style="margin: 0;">录入新品</h3>
        <el-button type="primary" :icon="Plus" size="small" @click="newItems.push(newProduct())">添加新品</el-button>
      </div>
      <el-table :data="newItems" border size="small" show-summary :summary-method="newSummary">
        <el-table-column type="index" label="#" width="50" align="center" />
        <el-table-column label="新品名称" min-width="180">
          <template #default="{ row }"><el-input v-model="row.productName" size="small" placeholder="如：足金手镯" /></template>
        </el-table-column>
        <el-table-column label="重量（克）" width="140">
          <template #default="{ row }">
            <el-input-number v-model="row.weightGram" :min="0" :precision="2" :controls="false" size="small" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column label="售价（元）" width="140">
          <template #default="{ row }">
            <el-input-number v-model="row.salePriceYuan" :min="0" :precision="2" :controls="false" size="small" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column label="工费（元）" width="140">
          <template #default="{ row }">
            <el-input-number v-model="row.laborFeeYuan" :min="0" :precision="2" :controls="false" size="small" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="70" align="center">
          <template #default="{ $index }">
            <el-button type="danger" link size="small" @click="newItems.splice($index, 1)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="!newItems.length" class="empty-tip">请至少添加一件新品</div>
      <div style="margin-top: 16px; text-align: right;">
        <el-button @click="step = 0">上一步</el-button>
        <el-button type="primary" :disabled="!newItems.length || !newItems.every(n => n.productName && n.salePriceYuan >= 0)" @click="step = 2">下一步：确认支付</el-button>
      </div>
    </div>

    <!-- 步骤3：确认 -->
    <div class="page-card" v-show="step === 2">
      <el-form :inline="true" label-width="80px" style="margin-bottom: 12px;">
        <el-form-item label="客户">
          <el-select v-model="partyId" clearable filterable placeholder="选择客户（可选）">
            <el-option v-for="p in parties" :key="p.id" :label="`${p.name || ''} ${p.phone || ''}`" :value="p.id" />
          </el-select>
        </el-form-item>
      </el-form>

      <el-descriptions :column="2" border size="small" title="换新汇总">
        <el-descriptions-item label="旧料抵扣合计">{{ fenToYuan(totalOldDeduct) }}</el-descriptions-item>
        <el-descriptions-item label="旧料成本合计">{{ fenToYuan(totalOldCost) }}</el-descriptions-item>
        <el-descriptions-item label="新品售价合计">{{ fenToYuan(totalNewPrice) }}</el-descriptions-item>
        <el-descriptions-item label="工费合计">{{ fenToYuan(totalLaborFee) }}</el-descriptions-item>
        <el-descriptions-item label="应收金额">
          <span style="font-size: 20px; color: var(--gold-dark); font-weight: 700;">{{ fenToYuan(receiveAmount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="计算公式">新品售价 + 工费 - 旧料抵扣</el-descriptions-item>
      </el-descriptions>

      <div style="margin-top: 16px; text-align: right;">
        <el-button @click="step = 1">上一步</el-button>
        <el-button type="primary" :icon="Check" @click="goPay" :disabled="receiveAmount < 0">提交并收款</el-button>
      </div>
    </div>

    <PaymentDialog v-model="payVisible" :expected-amount="Math.max(receiveAmount, 0)" direction="IN" @confirm="submitOrder" />

    <el-dialog v-model="resultVisible" title="换新成功" width="460px">
      <el-result icon="success" title="换新完成" :sub-title="`单号 ${result?.orderNo}`">
        <template #extra>
          <el-button :icon="Printer" @click="printOrder">打印小票</el-button>
          <el-button type="primary" @click="resetAll">完成</el-button>
        </template>
      </el-result>
    </el-dialog>

    <PrintDialog v-model="printVisible" :ticket="ticket" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Plus, Check, Printer } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { exchangeApi, inventoryApi, partyApi, printApi } from '@/api'
import PaymentDialog from '@/components/PaymentDialog.vue'
import PrintDialog from '@/components/PrintDialog.vue'
import { fenToYuan, liangToGram, yuanToFen } from '@/utils/format'

const route = useRoute()
const step = ref(0)
const oldItems = ref([])
const newItems = ref([newProduct()])
const parties = ref([])
const partyId = ref(null)
const searchCode = ref('')

const payVisible = ref(false)
const resultVisible = ref(false)
const printVisible = ref(false)
const result = ref(null)
const ticket = ref(null)

function newProduct() {
  return { productName: '', weightGram: 0, salePriceYuan: 0, laborFeeYuan: 0 }
}

const totalOldDeduct = computed(() => oldItems.value.reduce((s, r) => s + yuanToFen(r.deductYuan || 0), 0))
const totalOldCost = computed(() => oldItems.value.reduce((s, r) => s + (r.costAmount || 0), 0))
const totalNewPrice = computed(() => newItems.value.reduce((s, r) => s + yuanToFen(r.salePriceYuan || 0), 0))
const totalLaborFee = computed(() => newItems.value.reduce((s, r) => s + yuanToFen(r.laborFeeYuan || 0), 0))
const receiveAmount = computed(() => totalNewPrice.value + totalLaborFee.value - totalOldDeduct.value)

function oldSummary({ columns }) {
  const sums = []
  columns.forEach((col, i) => {
    if (i === 0) sums[i] = '合计'
    else if (i === 2) sums[i] = liangToGram(oldItems.value.reduce((s, r) => s + r.pureWeight, 0)) + ' 克'
    else if (i === 3) sums[i] = fenToYuan(totalOldCost.value)
    else if (i === 4) sums[i] = fenToYuan(totalOldDeduct.value)
    else sums[i] = ''
  })
  return sums
}
function newSummary({ columns }) {
  const sums = []
  columns.forEach((col, i) => {
    if (i === 0) sums[i] = '合计'
    else if (i === 3) sums[i] = fenToYuan(totalNewPrice.value)
    else if (i === 4) sums[i] = fenToYuan(totalLaborFee.value)
    else sums[i] = ''
  })
  return sums
}

async function addByCode() {
  if (!searchCode.value) return
  try {
    const inv = await inventoryApi.get(searchCode.value.trim())
    if (inv.status !== 'IN_STOCK') {
      ElMessage.warning(`该库存状态为 ${inv.status}，不可换新`)
      return
    }
    if (oldItems.value.find((r) => r.uniqueCode === inv.uniqueCode)) {
      ElMessage.warning('已添加过该旧料')
      return
    }
    oldItems.value.push({ ...inv, deductYuan: (inv.costAmount / 100) })
    searchCode.value = ''
    ElMessage.success('已添加')
  } catch (e) {
    // 错误已由拦截器提示
  }
}

function goPay() {
  if (receiveAmount.value < 0) {
    ElMessage.warning('旧料抵扣超过新品总价，请调整或改用回收流程')
    return
  }
  payVisible.value = true
}

async function submitOrder(payments) {
  try {
    const payload = {
      partyId: partyId.value || null,
      oldItems: oldItems.value.map((o) => ({
        uniqueCode: o.uniqueCode,
        deductAmount: yuanToFen(o.deductYuan)
      })),
      newItems: newItems.value.map((n) => ({
        productName: n.productName,
        weight: n.weightGram ? Math.round(n.weightGram * 100) : null,
        salePrice: yuanToFen(n.salePriceYuan),
        laborFeeItem: yuanToFen(n.laborFeeYuan)
      })),
      payments
    }
    result.value = await exchangeApi.create(payload)
    resultVisible.value = true
    ElMessage.success('换新成功')
  } catch (e) {
    console.error(e)
  }
}

async function printOrder() {
  ticket.value = await printApi.print('exchange', result.value.id)
  printVisible.value = true
}

function resetAll() {
  step.value = 0
  oldItems.value = []
  newItems.value = [newProduct()]
  partyId.value = null
  result.value = null
  resultVisible.value = false
}

onMounted(async () => {
  parties.value = await partyApi.list({ type: 'CUSTOMER' })
  // 从库存页跳转携带 code
  if (route.query.code) {
    searchCode.value = route.query.code
    addByCode()
  }
})
</script>
