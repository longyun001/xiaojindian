<template>
  <div>
    <div class="page-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <h3 class="section-title" style="margin: 0;">订单信息</h3>
        <el-button :icon="Plus" size="small" @click="addParty = true">新增客户</el-button>
      </div>
      <el-form :model="order" label-width="100px" size="default">
        <el-row :gutter="16">
          <el-col :span="6">
            <el-form-item label="客户">
              <el-select v-model="order.partyId" clearable filterable placeholder="选择客户（可选）">
                <el-option v-for="p in parties" :key="p.id" :label="`${p.name || ''} ${p.phone || ''}`" :value="p.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="存放位置">
              <el-input v-model="order.location" placeholder="柜台A" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-divider content-position="left" style="margin: 8px 0 16px;">
          <span style="font-size: 12px; color: var(--text-secondary);">黄金时点价（用于黄金项的回收单价与库存快照）</span>
        </el-divider>
        <el-row :gutter="16">
          <el-col :span="5">
            <el-form-item label="黄金回收价">
              <el-input-number v-model="recyclePriceYuan" :min="0" :precision="2" :controls="false" style="width: 100%">
                <template #suffix>元/克</template>
              </el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="5">
            <el-form-item label="融通金价">
              <el-input-number v-model="rongtongjinYuan" :min="0" :precision="2" :controls="false" style="width: 100%">
                <template #suffix>元/克</template>
              </el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="5">
            <el-form-item label="国际金价">
              <el-input-number v-model="internationalYuan" :min="0" :precision="2" :controls="false" style="width: 100%">
                <template #suffix>元/克</template>
              </el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="5">
            <el-form-item label="白银回收价">
              <el-input-number v-model="silverRecycleYuan" :min="0" :precision="2" :controls="false" style="width: 100%">
                <template #suffix>元/克</template>
              </el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="铂金回收价">
              <el-input-number v-model="platinumRecycleYuan" :min="0" :precision="2" :controls="false" style="width: 100%">
                <template #suffix>元/克</template>
              </el-input-number>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="6">
            <el-form-item label="白银行情价">
              <el-input-number v-model="silverMarketYuan" :min="0" :precision="3" :controls="false" style="width: 100%">
                <template #suffix>元/克</template>
              </el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="铂金行情价">
              <el-input-number v-model="platinumMarketYuan" :min="0" :precision="2" :controls="false" style="width: 100%">
                <template #suffix>元/克</template>
              </el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label=" ">
              <span style="font-size: 12px; color: var(--text-secondary);">银铂行情价来自融通金网页，用于库存时点追溯</span>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </div>

    <div class="page-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 class="section-title" style="margin: 0;">旧料明细</h3>
        <el-button type="primary" :icon="Plus" size="small" @click="addItem">添加一行</el-button>
      </div>

      <el-table :data="order.items" border size="small" show-summary :summary-method="getSummary">
        <el-table-column type="index" label="#" width="45" align="center" />
        <el-table-column label="金属" width="100">
          <template #default="{ row }">
            <el-select v-model="row.metalType" size="small" style="width: 100%" @change="onMetalChange(row)">
              <el-option v-for="m in METAL_TYPES" :key="m.value" :label="m.label" :value="m.value" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="物品名称" min-width="140">
          <template #default="{ row }">
            <el-input v-model="row.itemName" placeholder="如：金项链" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="毛重（克）" width="120">
          <template #default="{ row }">
            <el-input-number v-model="row.grossWeightGram" :min="0" :precision="2" :controls="false" size="small" style="width: 100%" @input="calcRow(row)" />
          </template>
        </el-table-column>
        <el-table-column label="纯度" width="180">
          <template #default="{ row }">
            <el-select v-model="row.purity" size="small" style="width: 100%" @change="calcRow(row)">
              <el-option v-for="p in getPurityOptions(row.metalType)" :key="p.value" :label="p.label" :value="p.value" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="回收单价" width="120">
          <template #default="{ row }">
            <el-input-number v-model="row.unitPriceYuan" :min="0" :precision="2" :controls="false" size="small" style="width: 100%" @input="calcRow(row)">
              <template #suffix>元/g</template>
            </el-input-number>
          </template>
        </el-table-column>
        <el-table-column label="纯金重（克）" width="110" align="right">
          <template #default="{ row }">
            <span class="col-weight">{{ row.pureWeightGram }}</span>
          </template>
        </el-table-column>
        <el-table-column label="金额（元）" width="120" align="right">
          <template #default="{ row }">
            <span class="col-money">{{ row.amountYuan }}</span>
          </template>
        </el-table-column>
        <el-table-column label="照片" width="70" align="center">
          <template #default="{ row, $index }">
            <el-button link size="small" :icon="Camera" @click="openPhotoCapture(row, $index)" :type="row.photoCount ? 'success' : ''">
              {{ row.photoCount || 0 }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="65" align="center">
          <template #default="{ $index }">
            <el-button type="danger" link size="small" @click="order.items.splice($index, 1)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="page-card" style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <span style="margin-right: 24px;">合计纯金重：<b style="color: var(--gold-dark); font-size: 18px;">{{ totalPureWeightGram }} 克</b></span>
        <span>合计金额：<b style="color: var(--gold-dark); font-size: 18px;">¥{{ totalAmountYuan }}</b></span>
      </div>
      <div>
        <el-button @click="resetForm">重置</el-button>
        <el-button type="primary" :icon="Check" @click="goPay" :disabled="!canSubmit">提交并支付</el-button>
      </div>
    </div>

    <!-- 支付弹窗 -->
    <PaymentDialog
      v-model="payVisible"
      :expected-amount="totalAmountFen"
      direction="OUT"
      @confirm="submitOrder"
    />

    <!-- 拍照弹窗 -->
    <PhotoCapture
      ref="photoCaptureRef"
      v-model="photoVisible"
      :unique-code="currentPhotoCode"
    />

    <!-- 成功结果弹窗（含条码） -->
    <el-dialog v-model="resultVisible" title="回收成功" width="520px" :close-on-click-modal="false">
      <el-result icon="success" title="回收完成" :sub-title="`单号 ${result?.order?.orderNo}`">
        <template #extra>
          <div style="margin-bottom: 12px;">
            <div>共入库 {{ result?.inventoryItems?.length || 0 }} 件，合计纯金重 {{ liangToGram(result?.summary?.totalPureWeight) }} 克，金额 {{ fenToYuan(result?.summary?.totalAmount) }}</div>
          </div>
          <el-button :icon="Printer" @click="printOrder">打印小票</el-button>
          <el-button type="primary" @click="resultVisible = false; resetForm()">继续收旧</el-button>
        </template>
      </el-result>
      <div v-if="result?.inventoryItems?.length" style="margin-top: 12px;">
        <div style="font-weight: 600; margin-bottom: 8px;">入库条码：</div>
        <div v-for="inv in result.inventoryItems" :key="inv.id" style="margin-bottom: 8px; text-align: center;">
          <Barcode :value="inv.uniqueCode" :height="40" />
        </div>
      </div>
    </el-dialog>

    <PrintDialog v-model="printVisible" :ticket="ticket" />

    <!-- 新增客户弹窗 -->
    <el-dialog v-model="addParty" title="新增客户" width="420px">
      <el-form :model="newParty" label-width="80px" size="small">
        <el-form-item label="姓名"><el-input v-model="newParty.name" /></el-form-item>
        <el-form-item label="电话"><el-input v-model="newParty.phone" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="newParty.remark" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addParty = false">取消</el-button>
        <el-button type="primary" @click="createParty">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { Plus, Check, Printer, Camera } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { recycleApi, partyApi, printApi } from '@/api'
import { useGoldPriceStore } from '@/stores/global'
import PaymentDialog from '@/components/PaymentDialog.vue'
import PrintDialog from '@/components/PrintDialog.vue'
import Barcode from '@/components/Barcode.vue'
import PhotoCapture from '@/components/PhotoCapture.vue'
import { fenToYuan, liangToGram, gramToLiang, yuanToFen, yuanPerGramToPrice,
  bankerRoundScaled, METAL_TYPES, getPurityOptions, getRecyclePriceByMetal } from '@/utils/format'

const priceStore = useGoldPriceStore()
const parties = ref([])
// 黄金时点价（必须在 order 之前声明，因为 newItem 初始化时会引用）
const recyclePriceYuan = ref(0)
const rongtongjinYuan = ref(0)
const internationalYuan = ref(0)
// 银铂回收价（订单级别快照）
const silverRecycleYuan = ref(0)
const platinumRecycleYuan = ref(0)
// 银铂市场行情价（融通金网页价，用于库存时点快照）
const silverMarketYuan = ref(0)
const platinumMarketYuan = ref(0)

const order = reactive({
  partyId: null,
  location: '柜台A',
  items: [newItem()]
})

const addParty = ref(false)
const newParty = reactive({ name: '', phone: '', remark: '' })

const payVisible = ref(false)
const resultVisible = ref(false)
const printVisible = ref(false)
const result = ref(null)
const ticket = ref(null)

// 拍照相关
const photoVisible = ref(false)
const photoCaptureRef = ref(null)
const currentPhotoCode = ref('') // 当前拍照的库存编号（临时或正式）


function newItem(metalType = 'GOLD') {
  const unitPriceYuan = getDefaultUnitPriceYuan(metalType)
  const purityOptions = getPurityOptions(metalType)
  return {
    photoTempCode: 'TEMP' + (globalThis.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2))),
    photoCount: 0,
    itemName: '',
    metalType,
    grossWeightGram: 0,
    purity: purityOptions[0].value,
    unitPriceYuan,
    pureWeightGram: '0.00',
    amountYuan: '0.00',
    _pureWeightFen: 0,
    _amountFen: 0
  }
}

function addItem() { order.items.push(newItem()) }

// 取某种金属当前的默认回收单价（元/克）
function getDefaultUnitPriceYuan(metalType) {
  const p = priceStore.current
  if (!p) return 0
  if (metalType === 'GOLD') return recyclePriceYuan.value || (p.recyclePrice / 100)
  if (metalType === 'SILVER') return silverRecycleYuan.value || (p.silverRecyclePrice || 0) / 100
  if (metalType === 'PLATINUM') return platinumRecycleYuan.value || (p.platinumRecyclePrice || 0) / 100
  return 0
}

// 切换金属种类：重置纯度选项与回收单价
function onMetalChange(row) {
  const options = getPurityOptions(row.metalType)
  row.purity = options[0].value
  row.unitPriceYuan = getDefaultUnitPriceYuan(row.metalType)
  calcRow(row)
}

// 前端预估计算（仅展示，后端会重算）
function calcRow(row) {
  const grossWeight = gramToLiang(row.grossWeightGram || 0)
  // 纯度万分比：pureWeight = grossWeight * purity / 10000
  const pureWeight = bankerRoundScaled(grossWeight * row.purity, 10000)
  row.pureWeightGram = (pureWeight / 100).toFixed(2)
  const unitPrice = yuanPerGramToPrice(row.unitPriceYuan || 0)
  const amount = bankerRoundScaled(pureWeight * unitPrice, 100)
  row.amountYuan = (amount / 100).toFixed(2)
  row._pureWeightFen = pureWeight
  row._amountFen = amount
}

const totalPureWeightGram = computed(() => {
  const total = order.items.reduce((s, r) => s + (r._pureWeightFen || 0), 0)
  return (total / 100).toFixed(2)
})
const totalAmountYuan = computed(() => {
  const total = order.items.reduce((s, r) => s + (r._amountFen || 0), 0)
  return (total / 100).toFixed(2)
})
const totalAmountFen = computed(() => order.items.reduce((s, r) => s + (r._amountFen || 0), 0))

const canSubmit = computed(() => {
  return !result.value && order.items.length > 0 &&
    order.items.every((r) => r.itemName && r.grossWeightGram > 0 && (r.unitPriceYuan || 0) > 0)
})

function getSummary({ columns, data }) {
  const sums = []
  columns.forEach((col, i) => {
    if (i === 0) { sums[i] = '合计'; return }
    // 列顺序：#0=index, 1=金属, 2=物品, 3=毛重, 4=纯度, 5=回收单价, 6=纯金重, 7=金额, 8=操作
    if (i === 6) { sums[i] = totalPureWeightGram.value + ' 克'; return }
    if (i === 7) { sums[i] = '¥' + totalAmountYuan.value; return }
    sums[i] = ''
  })
  return sums
}

function goPay() {
  if (!canSubmit.value) {
    ElMessage.warning('请完善物品名称和毛重，并设置各金属回收单价')
    return
  }
  // 友善提醒：有未拍照的旧料
  const noPhotoItems = order.items.filter(r => !(r.photoCount > 0))
  if (noPhotoItems.length > 0) {
    ElMessageBox.confirm(
      `有 ${noPhotoItems.length} 件旧料未拍照，是否继续提交？`,
      '拍照提醒',
      { confirmButtonText: '继续提交', cancelButtonText: '返回拍照', type: 'warning' }
    ).then(() => {
      payVisible.value = true
    }).catch(() => {
      // 返回拍照
    })
    return
  }
  payVisible.value = true
}

// 打开拍照弹窗
function openPhotoCapture(row, index) {
  currentPhotoCode.value = row.photoTempCode
  photoVisible.value = true
}

// 拍照弹窗关闭后更新照片计数
watch(photoVisible, (v) => {
  if (!v && photoCaptureRef.value) {
    const count = photoCaptureRef.value.getPhotoCount()
    const row = order.items.find(r => r.photoTempCode === currentPhotoCode.value)
    if (row) row.photoCount = count
  }
})

async function submitOrder(payments) {
  try {
    const payload = {
      partyId: order.partyId || null,
      // 订单级别记录黄金时点价（黄金项的回收单价与库存快照用）
      recyclePrice: yuanPerGramToPrice(recyclePriceYuan.value),
      rongtongjinPrice: yuanPerGramToPrice(rongtongjinYuan.value),
      internationalPrice: internationalYuan.value ? yuanPerGramToPrice(internationalYuan.value) : null,
      // 银铂市场行情价（融通金网页价，用于银铂项库存快照）
      silverMarketPrice: yuanPerGramToPrice(silverMarketYuan.value),
      platinumMarketPrice: yuanPerGramToPrice(platinumMarketYuan.value),
      location: order.location,
      items: order.items.map((r) => ({
        photoTempCode: r.photoTempCode,
        photoCount: r.photoCount,
        itemName: r.itemName,
        metalType: r.metalType,
        grossWeight: gramToLiang(r.grossWeightGram),
        purity: r.purity,
        unitPrice: yuanPerGramToPrice(r.unitPriceYuan)
      })),
      payments
    }
    result.value = await recycleApi.create(payload)
    resultVisible.value = true
    ElMessage.success('回收成功')
  } catch (e) {
    console.error(e)
  }
}

async function printOrder() {
  ticket.value = await printApi.print('recycle', result.value.order.id)
  printVisible.value = true
}

async function createParty() {
  const p = await partyApi.create({ ...newParty, type: 'CUSTOMER' })
  parties.value.unshift(p)
  order.partyId = p.id
  addParty.value = false
  newParty.name = ''; newParty.phone = ''; newParty.remark = ''
  ElMessage.success('客户已添加')
}

function resetForm() {
  order.partyId = null
  order.items = [newItem()]
  result.value = null

}

async function loadParties() {
  parties.value = await partyApi.list({ type: 'CUSTOMER' })
}

onMounted(async () => {
  await loadParties()
  // 确保金价已加载（App.vue 也会加载，但这里兜底防止竞态）
  if (!priceStore.current) {
    await priceStore.load()
  }
  // 默认填入当前金价（金/银/铂）
  if (priceStore.current) {
    const p = priceStore.current
    recyclePriceYuan.value = (p.recyclePrice / 100)
    rongtongjinYuan.value = (p.rongtongjinPrice / 100)
    internationalYuan.value = (p.internationalPrice / 100)
    silverRecycleYuan.value = ((p.silverRecyclePrice || 0) / 100)
    platinumRecycleYuan.value = ((p.platinumRecyclePrice || 0) / 100)
    silverMarketYuan.value = ((p.silverMarketPrice || 0) / 100)
    platinumMarketYuan.value = ((p.platinumMarketPrice || 0) / 100)
  }
  // 金价加载后，重新填充每行的 unitPriceYuan 并重算（setup 阶段 store 可能还没加载，导致首行单价为 0）
  order.items.forEach((r) => {
    r.unitPriceYuan = getDefaultUnitPriceYuan(r.metalType)
    calcRow(r)
  })
})
</script>
