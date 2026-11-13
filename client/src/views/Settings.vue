<template>
  <div>
    <el-tabs v-model="activeTab">
      <el-tab-pane label="数据维护" name="maintenance">
        <DataMaintenance />
      </el-tab-pane>
      <!-- 金价设置 -->
      <el-tab-pane label="金价设置" name="price">
        <div class="page-card">
          <div class="price-settings-toolbar"><div><h3 class="section-title">门店牌价</h3><p>分别维护金、银、铂的价格，收旧与出售时按对应材质取用。</p></div><el-link type="primary" :underline="false" href="https://i.jzj9999.com/quoteh5/?ivk_sa=1025883i" target="_blank">打开融通金行情 ↗</el-link></div>
          <div class="price-settings-grid">
          <section class="price-settings-card">
          <h3 class="price-metal-title"><span class="metal-symbol">Au</span>黄金<small>元 / 克</small></h3>
          <el-form label-width="85px" class="price-settings-form">
            <el-form-item label="国际金价">
              <el-input-number v-model="priceForm.international" :min="0" :precision="2" :controls="false" style="width: 200px">
                <template #suffix>元/克</template>
              </el-input-number>
            </el-form-item>
            <el-form-item label="融通金价">
              <el-input-number v-model="priceForm.rongtongjin" :min="0" :precision="2" :controls="false" style="width: 200px">
                <template #suffix>元/克</template>
              </el-input-number>
            </el-form-item>
            <el-form-item label="回收价">
              <el-input-number v-model="priceForm.recycle" :min="0" :precision="2" :controls="false" style="width: 200px">
                <template #suffix>元/克</template>
              </el-input-number>
            </el-form-item>
            <el-form-item label="出售价">
              <el-input-number v-model="priceForm.sale" :min="0" :precision="2" :controls="false" style="width: 200px">
                <template #suffix>元/克</template>
              </el-input-number>
            </el-form-item>
          </el-form>

          </section>
          <section class="price-settings-card price-settings-silver">
          <h3 class="price-metal-title"><span class="metal-symbol">Ag</span>白银<small>元 / 克</small></h3>
          <el-form label-width="85px" class="price-settings-form">
            <el-form-item label="白银回收价">
              <el-input-number v-model="priceForm.silverRecycle" :min="0" :precision="2" :controls="false" style="width: 200px">
                <template #suffix>元/克</template>
              </el-input-number>
            </el-form-item>
            <el-form-item label="白银出售价">
              <el-input-number v-model="priceForm.silverSale" :min="0" :precision="2" :controls="false" style="width: 200px">
                <template #suffix>元/克</template>
              </el-input-number>
            </el-form-item>
            <el-form-item label="白银行情价">
              <el-input-number v-model="priceForm.silverMarket" :min="0" :precision="3" :controls="false" style="width: 200px">
                <template #suffix>元/克</template>
              </el-input-number>
              <span style="margin-left: 8px; color: var(--text-secondary); font-size: 12px;">融通金网页白银价</span>
            </el-form-item>
          </el-form>

          </section>
          <section class="price-settings-card price-settings-platinum">
          <h3 class="price-metal-title"><span class="metal-symbol">Pt</span>铂金<small>元 / 克</small></h3>
          <el-form label-width="85px" class="price-settings-form">
            <el-form-item label="铂金回收价">
              <el-input-number v-model="priceForm.platinumRecycle" :min="0" :precision="2" :controls="false" style="width: 200px">
                <template #suffix>元/克</template>
              </el-input-number>
            </el-form-item>
            <el-form-item label="铂金出售价">
              <el-input-number v-model="priceForm.platinumSale" :min="0" :precision="2" :controls="false" style="width: 200px">
                <template #suffix>元/克</template>
              </el-input-number>
            </el-form-item>
            <el-form-item label="铂金行情价">
              <el-input-number v-model="priceForm.platinumMarket" :min="0" :precision="2" :controls="false" style="width: 200px">
                <template #suffix>元/克</template>
              </el-input-number>
              <span style="margin-left: 8px; color: var(--text-secondary); font-size: 12px;">融通金网页铂金价</span>
            </el-form-item>

          </el-form>

          </section>
          </div>
          <div class="price-settings-footer"><el-button type="primary" @click="savePrice">保存全部金价</el-button><span>不收的金属填 0 即可</span></div>
          <h3 class="section-title" style="margin-top: 28px;">金价历史</h3>
          <el-table :data="priceHistory" border size="small" max-height="300">
            <el-table-column label="时间" width="160">
              <template #default="{ row }">{{ fmtDateTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="金-回收" align="right" width="80">
              <template #default="{ row }">{{ priceToYuanPerGram(row.recyclePrice) }}</template>
            </el-table-column>
            <el-table-column label="金-出售" align="right" width="80">
              <template #default="{ row }">{{ priceToYuanPerGram(row.salePrice) }}</template>
            </el-table-column>
            <el-table-column label="银-回收" align="right" width="80">
              <template #default="{ row }">{{ priceToYuanPerGram(row.silverRecyclePrice) }}</template>
            </el-table-column>
            <el-table-column label="银-出售" align="right" width="80">
              <template #default="{ row }">{{ priceToYuanPerGram(row.silverSalePrice) }}</template>
            </el-table-column>
            <el-table-column label="银-行情" align="right" width="80">
              <template #default="{ row }">{{ priceToYuanPerGram(row.silverMarketPrice) }}</template>
            </el-table-column>
            <el-table-column label="铂-回收" align="right" width="80">
              <template #default="{ row }">{{ priceToYuanPerGram(row.platinumRecyclePrice) }}</template>
            </el-table-column>
            <el-table-column label="铂-出售" align="right" width="80">
              <template #default="{ row }">{{ priceToYuanPerGram(row.platinumSalePrice) }}</template>
            </el-table-column>
            <el-table-column label="铂-行情" align="right" width="80">
              <template #default="{ row }">{{ priceToYuanPerGram(row.platinumMarketPrice) }}</template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- 系统配置 -->
      <el-tab-pane label="系统配置" name="config">
        <div class="page-card">
          <h3 class="section-title">店铺信息与默认设置</h3>
          <el-form label-width="140px" style="max-width: 600px;">
            <el-form-item label="店名">
              <el-input v-model="configForm.SHOP_NAME" />
            </el-form-item>
            <el-form-item label="电话">
              <el-input v-model="configForm.SHOP_PHONE" />
            </el-form-item>
            <el-form-item label="默认存放位置">
              <el-input v-model="configForm.DEFAULT_LOCATION" placeholder="如：柜台A" />
            </el-form-item>
            <el-form-item label="打印份数">
              <el-input-number v-model.number="configForm.PRINT_COPIES" :min="1" :max="5" />
            </el-form-item>
            <el-form-item label="库存估值方式">
              <el-select v-model="configForm.VALUATION_METHOD" style="width: 200px">
                <el-option label="融通金价" value="rongtongjin" />
                <el-option label="国际金价" value="international" />
              </el-select>
            </el-form-item>
            <el-form-item label="自动同步金价">
              <el-switch v-model="configForm.AUTO_SYNC_PRICE" active-value="true" inactive-value="false" />
              <span style="margin-left: 12px; color: var(--text-secondary); font-size: 13px;">需配置 GOLD_PRICE_API_URL</span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveConfig">保存配置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <!-- 交易方管理 -->
      <el-tab-pane label="交易方管理" name="party">
        <div class="page-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 class="section-title" style="margin: 0;">交易方列表</h3>
            <el-button type="primary" :icon="Plus" size="small" @click="openPartyDialog()">新增</el-button>
          </div>
          <el-table :data="partyList" border size="small">
            <el-table-column prop="type" label="类型" width="100">
              <template #default="{ row }">
                <el-tag size="small">{{ typeLabel(row.type) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="name" label="姓名" width="120" />
            <el-table-column prop="phone" label="电话" width="140" />
            <el-table-column prop="company" label="公司" width="180" />
            <el-table-column prop="remark" label="备注" min-width="120" />
            <el-table-column label="操作" width="140" align="center">
              <template #default="{ row }">
                <el-button link size="small" type="primary" @click="openPartyDialog(row)">编辑</el-button>
                <el-button link size="small" type="danger" @click="deleteParty(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 交易方编辑弹窗 -->
    <el-dialog v-model="partyDialog" :title="editingParty.id ? '编辑交易方' : '新增交易方'" width="440px">
      <el-form :model="editingParty" label-width="80px">
        <el-form-item label="类型">
          <el-select v-model="editingParty.type" style="width: 100%">
            <el-option label="客户" value="CUSTOMER" />
            <el-option label="买方" value="BUYER" />
            <el-option label="供应商" value="SUPPLIER" />
            <el-option label="其他" value="OTHER" />
          </el-select>
        </el-form-item>
        <el-form-item label="姓名"><el-input v-model="editingParty.name" /></el-form-item>
        <el-form-item label="电话"><el-input v-model="editingParty.phone" /></el-form-item>
        <el-form-item label="公司"><el-input v-model="editingParty.company" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="editingParty.remark" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="partyDialog = false">取消</el-button>
        <el-button type="primary" @click="saveParty">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import DataMaintenance from '@/components/DataMaintenance.vue'
import { ref, reactive, onMounted } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { goldPriceApi, configApi, partyApi } from '@/api'
import { useConfigStore, useGoldPriceStore } from '@/stores/global'
import { fmtDateTime, priceToYuanPerGram } from '@/utils/format'

const activeTab = ref('price')
const configStore = useConfigStore()
const priceStore = useGoldPriceStore()

// 金价（金/银/铂）
const priceForm = reactive({
  international: 0, rongtongjin: 0, recycle: 0, sale: 0,
  silverRecycle: 0, silverSale: 0, silverMarket: 0,
  platinumRecycle: 0, platinumSale: 0, platinumMarket: 0
})
const priceHistory = ref([])

// 配置
const configForm = reactive({})

// 交易方
const partyList = ref([])
const partyDialog = ref(false)
const editingParty = reactive({ id: null, type: 'CUSTOMER', name: '', phone: '', company: '', remark: '' })

function typeLabel(t) {
  return { CUSTOMER: '客户', BUYER: '买方', SUPPLIER: '供应商', OTHER: '其他' }[t] || t
}

async function loadPrice() {
  await priceStore.load()
  if (priceStore.current) {
    const p = priceStore.current
    priceForm.international = p.internationalPrice / 100
    priceForm.rongtongjin = p.rongtongjinPrice / 100
    priceForm.recycle = p.recyclePrice / 100
    priceForm.sale = p.salePrice / 100
    priceForm.silverRecycle = (p.silverRecyclePrice || 0) / 100
    priceForm.silverSale = (p.silverSalePrice || 0) / 100
    priceForm.silverMarket = (p.silverMarketPrice || 0) / 100
    priceForm.platinumRecycle = (p.platinumRecyclePrice || 0) / 100
    priceForm.platinumSale = (p.platinumSalePrice || 0) / 100
    priceForm.platinumMarket = (p.platinumMarketPrice || 0) / 100
  }
  priceHistory.value = await goldPriceApi.history(20)
}

async function savePrice() {
  await priceStore.update({
    internationalPrice: Math.round(priceForm.international * 100),
    rongtongjinPrice: Math.round(priceForm.rongtongjin * 100),
    recyclePrice: Math.round(priceForm.recycle * 100),
    salePrice: Math.round(priceForm.sale * 100),
    silverRecyclePrice: Math.round(priceForm.silverRecycle * 100),
    silverSalePrice: Math.round(priceForm.silverSale * 100),
    silverMarketPrice: Math.round(priceForm.silverMarket * 100),
    platinumRecyclePrice: Math.round(priceForm.platinumRecycle * 100),
    platinumSalePrice: Math.round(priceForm.platinumSale * 100),
    platinumMarketPrice: Math.round(priceForm.platinumMarket * 100)
  })
  ElMessage.success('金价已更新（金/银/铂）')
  loadPrice()
}

async function loadConfig() {
  await configStore.load()
  Object.assign(configForm, configStore.config)
}

async function saveConfig() {
  await configStore.update(configForm)
  ElMessage.success('配置已保存')
}

async function loadParties() {
  partyList.value = await partyApi.list({})
}

function openPartyDialog(row) {
  if (row) {
    Object.assign(editingParty, row)
  } else {
    Object.assign(editingParty, { id: null, type: 'CUSTOMER', name: '', phone: '', company: '', remark: '' })
  }
  partyDialog.value = true
}

async function saveParty() {
  if (editingParty.id) {
    await partyApi.update(editingParty.id, { ...editingParty })
  } else {
    await partyApi.create({ ...editingParty })
  }
  ElMessage.success('已保存')
  partyDialog.value = false
  loadParties()
}

async function deleteParty(row) {
  try {
    await ElMessageBox.confirm(`确认删除交易方「${row.name || row.company}」？`, '提示', { type: 'warning' })
    await partyApi.remove(row.id)
    ElMessage.success('已删除')
    loadParties()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

onMounted(async () => {
  await Promise.all([loadPrice(), loadConfig(), loadParties()])
})
</script>
