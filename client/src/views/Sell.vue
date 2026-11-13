<template>
  <div>
    <div class="page-card">
      <h3 class="section-title">出售信息</h3>
      <el-form :inline="true" label-width="90px">
        <el-form-item label="买方">
          <el-select v-model="partyId" clearable filterable placeholder="选择买方（可选）">
            <el-option v-for="p in parties" :key="p.id" :label="`${p.name || p.company || ''} ${p.phone || ''}`" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="黄金出售价">
          <el-input-number v-model="sellPriceYuan" :min="0" :precision="2" :controls="false" style="width: 150px">
            <template #suffix>元/克</template>
          </el-input-number>
        </el-form-item>
        <el-form-item label="白银出售价">
          <el-input-number v-model="silverSellYuan" :min="0" :precision="2" :controls="false" style="width: 150px">
            <template #suffix>元/克</template>
          </el-input-number>
        </el-form-item>
        <el-form-item label="铂金出售价">
          <el-input-number v-model="platinumSellYuan" :min="0" :precision="2" :controls="false" style="width: 150px">
            <template #suffix>元/克</template>
          </el-input-number>
        </el-form-item>
      </el-form>
      <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
        提示：添加库存后，系统按每件金属种类自动套用对应出售价；如需单独调价，可在表格中修改"出售单价"列。
      </div>
    </div>

    <div class="page-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 class="section-title" style="margin: 0;">选择出售库存</h3>
        <div>
          <el-input v-model="searchCode" placeholder="扫码添加" style="width: 200px" @keyup.enter="addByCode" />
          <el-button :icon="Plus" @click="addByCode">添加</el-button>
        </div>
      </div>

      <el-table :data="sellItems" border size="small" show-summary :summary-method="getSummary" v-if="sellItems.length">
        <el-table-column prop="uniqueCode" label="编号" width="170" />
        <el-table-column prop="itemName" label="物品" min-width="100" />
        <el-table-column label="金属" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="metalTagType(row.metalType)" size="small">{{ metalShort(row.metalType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="纯金重" width="95" align="right">
          <template #default="{ row }">{{ liangToGram(row.pureWeight) }} 克</template>
        </el-table-column>
        <el-table-column label="成本" width="100" align="right">
          <template #default="{ row }">{{ fenToYuan(row.costAmount) }}</template>
        </el-table-column>
        <el-table-column label="出售单价" width="120">
          <template #default="{ row }">
            <el-input-number v-model="row.unitPriceYuan" :min="0" :precision="2" :controls="false" size="small" style="width: 100%" @input="recalcRow(row)">
              <template #suffix>元/g</template>
            </el-input-number>
          </template>
        </el-table-column>
        <el-table-column label="售价金额" width="110" align="right">
          <template #default="{ row }"><span class="col-money">{{ fenToYuan(row.amountFen) }}</span></template>
        </el-table-column>
        <el-table-column label="毛利" width="100" align="right">
          <template #default="{ row }">
            <span :style="{ color: row.profitFen >= 0 ? 'var(--el-color-success)' : 'var(--el-color-danger)' }">{{ fenToYuan(row.profitFen) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="65" align="center">
          <template #default="{ $index }">
            <el-button type="danger" link size="small" @click="sellItems.splice($index, 1)">移除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-else class="empty-tip">请扫码添加要出售的旧料</div>

      <div style="margin-top: 16px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <span style="margin-right: 20px;">合计纯金重：<b style="color: var(--gold-dark);">{{ liangToGram(totalPureWeight) }} 克</b></span>
          <span style="margin-right: 20px;">合计金额：<b style="color: var(--gold-dark); font-size: 18px;">{{ fenToYuan(totalAmount) }}</b></span>
          <span>合计毛利：<b :style="{ color: totalProfit >= 0 ? 'var(--el-color-success)' : 'var(--el-color-danger)' }">{{ fenToYuan(totalProfit) }}</b></span>
        </div>
        <div>
          <el-button @click="resetAll">重置</el-button>
          <el-button type="primary" :icon="Check" :disabled="!sellItems.length || sellPriceYuan <= 0" @click="goPay">提交并收款</el-button>
        </div>
      </div>
    </div>

    <PaymentDialog v-model="payVisible" :expected-amount="totalAmount" direction="IN" @confirm="submitOrder" />

    <el-dialog v-model="resultVisible" title="出售成功" width="460px">
      <el-result icon="success" title="出售完成" :sub-title="`单号 ${result?.order?.orderNo}`">
        <template #extra>
          <div style="margin-bottom: 12px;">
            合计金额 {{ fenToYuan(result?.summary?.totalAmount) }} · 毛利 {{ fenToYuan(result?.summary?.profit) }}
          </div>
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
import { sellApi, inventoryApi, partyApi, printApi } from '@/api'
import { useGoldPriceStore } from '@/stores/global'
import PaymentDialog from '@/components/PaymentDialog.vue'
import PrintDialog from '@/components/PrintDialog.vue'
import { bankerRoundScaled, fenToYuan, liangToGram, yuanPerGramToPrice, metalShort, metalTagType } from '@/utils/format'

const route = useRoute()
const priceStore = useGoldPriceStore()
const parties = ref([])
const partyId = ref(null)
// 三类金属的出售单价（元/克）
const sellPriceYuan = ref(0)       // 黄金
const silverSellYuan = ref(0)      // 白银
const platinumSellYuan = ref(0)    // 铂金
const sellItems = ref([])
const searchCode = ref('')

const payVisible = ref(false)
const resultVisible = ref(false)
const printVisible = ref(false)
const result = ref(null)
const ticket = ref(null)

// 实时重算全部项金额（金价调整时批量调用）
function recalc() {
  for (const item of sellItems.value) {
    recalcRow(item)
  }
}

// 重算单行金额（按该行的 unitPriceYuan）
function recalcRow(row) {
  const unitPrice = yuanPerGramToPrice(row.unitPriceYuan || 0)
  row.amountFen = bankerRoundScaled(row.pureWeight * unitPrice, 100)
  row.profitFen = row.amountFen - row.costAmount
}

const totalPureWeight = computed(() => sellItems.value.reduce((s, r) => s + r.pureWeight, 0))
const totalAmount = computed(() => sellItems.value.reduce((s, r) => s + r.amountFen, 0))
const totalProfit = computed(() => sellItems.value.reduce((s, r) => s + r.profitFen, 0))

function getSummary({ columns }) {
  const sums = []
  columns.forEach((col, i) => {
    if (i === 0) sums[i] = '合计'
    else if (i === 2) sums[i] = liangToGram(totalPureWeight.value) + ' 克'
    else if (i === 3) sums[i] = fenToYuan(sellItems.value.reduce((s, r) => s + r.costAmount, 0))
    else if (i === 4) sums[i] = fenToYuan(totalAmount.value)
    else if (i === 5) sums[i] = fenToYuan(totalProfit.value)
    else sums[i] = ''
  })
  return sums
}

async function addByCode() {
  if (!searchCode.value) return
  try {
    const inv = await inventoryApi.get(searchCode.value.trim())
    if (inv.status !== 'IN_STOCK') {
      ElMessage.warning(`该库存状态为 ${inv.status}，不可出售`)
      return
    }
    if (sellItems.value.find((r) => r.uniqueCode === inv.uniqueCode)) {
      ElMessage.warning('已添加过该库存')
      return
    }
    // 按金属种类取对应出售单价
    const unitPriceYuan = getUnitPriceYuanByMetal(inv.metalType)
    const unitPrice = yuanPerGramToPrice(unitPriceYuan)
    const amountFen = bankerRoundScaled(inv.pureWeight * unitPrice, 100)
    sellItems.value.push({ ...inv, unitPriceYuan, amountFen, profitFen: amountFen - inv.costAmount })
    searchCode.value = ''
    ElMessage.success('已添加')
  } catch (e) {}
}

function goPay() {
  payVisible.value = true
}

// 按金属种类取当前出售单价（元/克）
function getUnitPriceYuanByMetal(metalType) {
  if (metalType === 'SILVER') return silverSellYuan.value
  if (metalType === 'PLATINUM') return platinumSellYuan.value
  return sellPriceYuan.value // 默认黄金
}

async function submitOrder(payments) {
  try {
    // 构造 itemPrices：每件库存按其金属种类对应出售价
    const itemPrices = {}
    for (const r of sellItems.value) {
      itemPrices[r.uniqueCode] = yuanPerGramToPrice(r.unitPriceYuan)
    }
    const payload = {
      partyId: partyId.value || null,
      sellPrice: yuanPerGramToPrice(sellPriceYuan.value), // 默认/黄金单价
      itemCodes: sellItems.value.map((r) => r.uniqueCode),
      itemPrices,
      payments
    }
    result.value = await sellApi.create(payload)
    resultVisible.value = true
    ElMessage.success('出售成功')
  } catch (e) {
    console.error(e)
  }
}

async function printOrder() {
  ticket.value = await printApi.print('sell', result.value.order.id)
  printVisible.value = true
}

function resetAll() {
  sellItems.value = []
  partyId.value = null
  result.value = null
  resultVisible.value = false
}

import { watch } from 'vue'
// 金价调整时，重新套用到所有行（按金属种类匹配）
watch(sellPriceYuan, () => {
  for (const item of sellItems.value) {
    if (item.metalType === 'GOLD') {
      item.unitPriceYuan = sellPriceYuan.value
      recalcRow(item)
    }
  }
})
watch(silverSellYuan, () => {
  for (const item of sellItems.value) {
    if (item.metalType === 'SILVER') {
      item.unitPriceYuan = silverSellYuan.value
      recalcRow(item)
    }
  }
})
watch(platinumSellYuan, () => {
  for (const item of sellItems.value) {
    if (item.metalType === 'PLATINUM') {
      item.unitPriceYuan = platinumSellYuan.value
      recalcRow(item)
    }
  }
})

onMounted(async () => {
  parties.value = await partyApi.list({ type: 'BUYER' })
  if (!priceStore.current) {
    await priceStore.load()
  }
  if (priceStore.current) {
    const p = priceStore.current
    sellPriceYuan.value = p.salePrice / 100
    silverSellYuan.value = (p.silverSalePrice || 0) / 100
    platinumSellYuan.value = (p.platinumSalePrice || 0) / 100
  }
  if (route.query.code) {
    searchCode.value = route.query.code
    addByCode()
  }
})
</script>
