<template>
  <div>
    <!-- 筛选区 -->
    <div class="page-card">
      <el-form :inline="true" size="default">
        <el-form-item label="扫码/搜索">
          <el-input
            ref="searchInput"
            v-model="keyword"
            placeholder="扫码或输入编号/名称"
            clearable
            style="width: 260px"
            @keyup.enter="loadList"
            @clear="loadList"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="status" clearable placeholder="全部" style="width: 120px" @change="loadList">
            <el-option label="在库" value="IN_STOCK" />
            <el-option label="已换新" value="EXCHANGED" />
            <el-option label="已出售" value="SOLD" />
          </el-select>
        </el-form-item>
        <el-form-item label="金属">
          <el-select v-model="metalType" clearable placeholder="全部" style="width: 110px" @change="loadList">
            <el-option v-for="m in METAL_TYPES" :key="m.value" :label="m.label" :value="m.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="位置">
          <el-select v-model="location" clearable placeholder="全部" style="width: 140px" @change="loadList">
            <el-option v-for="l in locations" :key="l" :label="l" :value="l" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadList">查询</el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 概览 -->
    <div class="stat-grid" v-if="stats">
      <div class="stat-card">
        <div class="stat-card-icon" style="background: #F0E6D0; color: #9C7E3F;">
          <el-icon><Box /></el-icon>
        </div>
        <div class="stat-label">在库件数</div>
        <div class="stat-value">{{ stats.totalInStock }}</div>
        <div class="stat-sub">件</div>
      </div>
      <div class="stat-card stat-card-gold" v-if="metalWeight('GOLD') > 0">
        <div class="stat-card-icon" style="background: #FFF8E1; color: #B8860B;">
          <el-icon><Present /></el-icon>
        </div>
        <div class="stat-label">在库黄金纯重</div>
        <div class="stat-value">{{ liangToGram(metalWeight('GOLD')) }}</div>
        <div class="stat-sub">克 / {{ metalCount('GOLD') }} 件</div>
      </div>
      <div class="stat-card stat-card-silver" v-if="metalWeight('SILVER') > 0">
        <div class="stat-card-icon" style="background: #ECEFF1; color: #607D8B;">
          <el-icon><Coin /></el-icon>
        </div>
        <div class="stat-label">在库白银纯重</div>
        <div class="stat-value">{{ liangToGram(metalWeight('SILVER')) }}</div>
        <div class="stat-sub">克 / {{ metalCount('SILVER') }} 件</div>
      </div>
      <div class="stat-card stat-card-platinum" v-if="metalWeight('PLATINUM') > 0">
        <div class="stat-card-icon" style="background: #E3F2FD; color: #1565C0;">
          <el-icon><Star /></el-icon>
        </div>
        <div class="stat-label">在库铂金纯重</div>
        <div class="stat-value">{{ liangToGram(metalWeight('PLATINUM')) }}</div>
        <div class="stat-sub">克 / {{ metalCount('PLATINUM') }} 件</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon" style="background: #F3E5F5; color: #7B1FA2;">
          <el-icon><Money /></el-icon>
        </div>
        <div class="stat-label">在库总成本</div>
        <div class="stat-value">{{ fenToYuan(stats.totalCost) }}</div>
        <div class="stat-sub">元</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon" style="background: #E0F2F1; color: #00695C;">
          <el-icon><LocationFilled /></el-icon>
        </div>
        <div class="stat-label">位置数</div>
        <div class="stat-value">{{ Object.keys(stats.byLocation || {}).length }}</div>
        <div class="stat-sub">处</div>
      </div>
    </div>

    <!-- 库存表格 -->
    <div class="page-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 class="section-title" style="margin: 0;">库存列表</h3>
        <el-button :icon="Refresh" size="small" @click="loadAll">刷新</el-button>
      </div>
      <el-table :data="list" border size="small" v-loading="loading">
        <el-table-column prop="uniqueCode" label="编号" width="170" fixed />
        <el-table-column prop="itemName" label="物品名称" min-width="120" />
        <el-table-column label="金属" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="metalTagType(row.metalType)" size="small">{{ metalShort(row.metalType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="毛重" width="100" align="right">
          <template #default="{ row }">{{ liangToGram(row.grossWeight) }} 克</template>
        </el-table-column>
        <el-table-column label="纯度" width="100" align="center">
          <template #default="{ row }">{{ permilToPercent(row.purity) }}</template>
        </el-table-column>
        <el-table-column label="纯金重" width="100" align="right">
          <template #default="{ row }"><span class="col-weight">{{ liangToGram(row.pureWeight) }} 克</span></template>
        </el-table-column>
        <el-table-column label="成本" width="110" align="right">
          <template #default="{ row }"><span class="col-money">{{ fenToYuan(row.costAmount) }}</span></template>
        </el-table-column>
        <el-table-column label="收旧时回收价" width="120" align="right">
          <template #default="{ row }">
            <span v-if="row.recyclePriceAtReceive" class="col-money">{{ priceToYuanPerGram(row.recyclePriceAtReceive) }}</span>
            <span v-else style="color: var(--text-secondary);">-</span>
          </template>
        </el-table-column>
        <el-table-column label="收旧时市场行情价" width="140" align="right">
          <template #default="{ row }">
            <!-- 按金属种类显示对应的市场行情价快照 -->
            <span v-if="row.metalType === 'GOLD' && row.rongtongjinPriceAtReceive" style="color: var(--gold-dark);">{{ priceToYuanPerGram(row.rongtongjinPriceAtReceive) }}</span>
            <span v-else-if="row.metalType === 'SILVER' && row.silverMarketPriceAtReceive" style="color: var(--gold-dark);">{{ priceToYuanPerGram(row.silverMarketPriceAtReceive) }}</span>
            <span v-else-if="row.metalType === 'PLATINUM' && row.platinumMarketPriceAtReceive" style="color: var(--gold-dark);">{{ priceToYuanPerGram(row.platinumMarketPriceAtReceive) }}</span>
            <span v-else style="color: var(--text-secondary);">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="location" label="位置" width="100" />
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="入库时间" width="160">
          <template #default="{ row }">{{ fmtDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link size="small" type="primary" v-if="row.status === 'IN_STOCK'" @click="goExchange(row)">换新</el-button>
            <el-button link size="small" type="warning" v-if="row.status === 'IN_STOCK'" @click="goSell(row)">出售</el-button>
            <el-button link size="small" :icon="Picture" @click="viewPhotos(row)">影像</el-button>
            <el-button link size="small" @click="editLocation(row)">改位置</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 修改位置弹窗 -->
    <el-dialog v-model="locVisible" title="修改位置" width="360px">
      <el-form label-width="80px">
        <el-form-item label="编号">{{ editing?.uniqueCode }}</el-form-item>
        <el-form-item label="新位置">
          <el-input v-model="newLocation" placeholder="如：柜台B、保险柜" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="locVisible = false">取消</el-button>
        <el-button type="primary" @click="saveLocation">保存</el-button>
      </template>
    </el-dialog>

    <!-- 影像档案弹窗（复用 PhotoCapture 组件，只读查看模式） -->
    <PhotoCapture v-model="photoVisible" :unique-code="photoCode" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Refresh, Picture, Box, Coin, Money, LocationFilled, Present, Star } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { inventoryApi } from '@/api'
import { fenToYuan, liangToGram, permilToPercent, priceToYuanPerGram, fmtDateTime,
  METAL_TYPES, metalShort, metalTagType } from '@/utils/format'
import PhotoCapture from '@/components/PhotoCapture.vue'

const router = useRouter()
const list = ref([])
const stats = ref(null)
const loading = ref(false)
const keyword = ref('')
const status = ref('IN_STOCK')
const metalType = ref('')
const location = ref('')
const locations = ref([])

// 影像档案
const photoVisible = ref(false)
const photoCode = ref('')

const locVisible = ref(false)
const editing = ref(null)
const newLocation = ref('')

function statusType(s) {
  return { IN_STOCK: 'success', EXCHANGED: 'warning', SOLD: 'info' }[s] || ''
}
function statusLabel(s) {
  return { IN_STOCK: '在库', EXCHANGED: '已换新', SOLD: '已出售' }[s] || s
}

// 按金属品类获取在库纯重/件数
function metalWeight(metal) {
  return stats.value?.byMetal?.[metal]?.pureWeight || 0
}
function metalCount(metal) {
  return stats.value?.byMetal?.[metal]?.count || 0
}

async function loadList() {
  loading.value = true
  try {
    const params = {}
    if (keyword.value) params.keyword = keyword.value
    if (status.value) params.status = status.value
    if (metalType.value) params.metalType = metalType.value
    if (location.value) params.location = location.value
    list.value = await inventoryApi.list(params)
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  stats.value = await inventoryApi.stats()
  // 从 stats 提取位置列表
  if (stats.value?.byLocation) {
    locations.value = Object.keys(stats.value.byLocation)
  }
}

function resetFilter() {
  keyword.value = ''; status.value = 'IN_STOCK'; metalType.value = ''; location.value = ''
  loadList()
}

async function loadAll() {
  await Promise.all([loadList(), loadStats()])
}

function editLocation(row) {
  editing.value = row
  newLocation.value = row.location
  locVisible.value = true
}

async function saveLocation() {
  if (!newLocation.value) { ElMessage.warning('位置不能为空'); return }
  await inventoryApi.updateLocation(editing.value.uniqueCode, newLocation.value)
  ElMessage.success('位置已更新')
  locVisible.value = false
  loadAll()
}

function goExchange(row) {
  router.push({ path: '/exchange', query: { code: row.uniqueCode } })
}
function goSell(row) {
  router.push({ path: '/sell', query: { code: row.uniqueCode } })
}
function viewPhotos(row) {
  photoCode.value = row.uniqueCode
  photoVisible.value = true
}

onMounted(loadAll)
</script>
