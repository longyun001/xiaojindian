<template>
  <div>
    <el-tabs v-model="activeTab">
      <!-- 当前盘点 -->
      <el-tab-pane label="当前盘点" name="current">
        <div class="page-card" v-if="!currentOrder">
          <div style="text-align: center; padding: 30px;">
            <p style="color: var(--text-secondary); margin-bottom: 16px;">暂无进行中的盘点单</p>
            <el-button type="primary" :icon="Plus" @click="createDialog = true">新建盘点单</el-button>
          </div>
        </div>

        <template v-else>
          <div class="page-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <h3 class="section-title" style="margin: 0;">盘点单 {{ currentOrder.orderNo }}</h3>
                <div style="color: var(--text-secondary); font-size: 13px; margin-top: 6px;">
                  位置：{{ currentOrder.location || '全部' }} · 状态：{{ statusLabel(currentOrder.status) }} · 共 {{ currentOrder.items.length }} 项
                </div>
              </div>
              <div>
                <el-button type="success" :icon="Check" @click="submitOrder" :disabled="currentOrder.status !== 'CHECKING'">提交盘点</el-button>
                <el-button @click="cancelOrder" :disabled="currentOrder.status !== 'CHECKING'">取消</el-button>
                <el-button @click="currentOrder = null">关闭</el-button>
              </div>
            </div>
          </div>

          <div class="page-card">
            <el-table :data="currentOrder.items" border size="small" show-summary :summary-method="getSummary">
              <el-table-column prop="inventory.uniqueCode" label="编号" width="170" />
              <el-table-column prop="inventory.itemName" label="物品" min-width="120" />
              <el-table-column label="系统纯金重" width="120" align="right">
                <template #default="{ row }">{{ liangToGram(row.systemPureWeight) }} 克</template>
              </el-table-column>
              <el-table-column label="实盘纯金重（克）" width="160">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.actualGram"
                    :min="0"
                    :precision="2"
                    :controls="false"
                    size="small"
                    style="width: 100%"
                    :disabled="currentOrder.status !== 'CHECKING'"
                    @input="saveItem(row)"
                  />
                </template>
              </el-table-column>
              <el-table-column label="差异" width="120" align="right">
                <template #default="{ row }">
                  <span v-if="row.difference === null || row.difference === undefined" style="color: var(--text-secondary);">未录入</span>
                  <span v-else :style="{ color: row.difference === 0 ? 'var(--el-color-success)' : row.difference > 0 ? 'var(--el-color-warning)' : 'var(--el-color-danger)', fontWeight: 600 }">
                    {{ row.difference > 0 ? '+' : '' }}{{ liangToGram(row.difference) }} 克
                  </span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>
      </el-tab-pane>

      <!-- 历史记录 -->
      <el-tab-pane label="历史记录" name="history">
        <div class="page-card">
          <el-table :data="history" border size="small">
            <el-table-column prop="orderNo" label="盘点单号" width="180" />
            <el-table-column prop="location" label="位置" width="120">
              <template #default="{ row }">{{ row.location || '全部' }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="项数" width="80" align="center">
              <template #default="{ row }">{{ row.items.length }}</template>
            </el-table-column>
            <el-table-column label="创建时间" width="170">
              <template #default="{ row }">{{ fmtDateTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="100" align="center">
              <template #default="{ row }">
                <el-button link size="small" type="primary" @click="viewOrder(row)">查看</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 新建盘点弹窗 -->
    <el-dialog v-model="createDialog" title="新建盘点单" width="380px">
      <el-form label-width="80px">
        <el-form-item label="盘点位置">
          <el-select v-model="newOrderLocation" clearable placeholder="全部位置" style="width: 100%">
            <el-option v-for="l in locations" :key="l" :label="l" :value="l" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="newOrderRemark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialog = false">取消</el-button>
        <el-button type="primary" @click="createOrder">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Plus, Check } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { stocktakingApi, inventoryApi } from '@/api'
import { liangToGram, fmtDateTime, gramToLiang } from '@/utils/format'

const activeTab = ref('current')
const currentOrder = ref(null)
const history = ref([])
const locations = ref([])
const createDialog = ref(false)
const newOrderLocation = ref('')
const newOrderRemark = ref('')

function statusType(s) {
  return { DRAFT: 'info', CHECKING: 'warning', COMPLETED: 'success', CANCELLED: 'danger' }[s] || ''
}
function statusLabel(s) {
  return { DRAFT: '草稿', CHECKING: '盘点中', COMPLETED: '已完成', CANCELLED: '已取消' }[s] || s
}

function getSummary({ columns, data }) {
  const sums = []
  columns.forEach((col, i) => {
    if (i === 0) sums[i] = '合计'
    else if (i === 2) sums[i] = liangToGram(data.reduce((s, r) => s + r.systemPureWeight, 0)) + ' 克'
    else if (i === 3) {
      const recorded = data.filter((r) => r.actualGram !== null && r.actualGram !== undefined)
      sums[i] = recorded.length ? liangToGram(recorded.reduce((s, r) => s + gramToLiang(r.actualGram), 0)) + ' 克' : '-'
    } else if (i === 4) {
      const recorded = data.filter((r) => r.difference !== null && r.difference !== undefined)
      if (recorded.length === 0) { sums[i] = '-'; return }
      const diff = recorded.reduce((s, r) => s + r.difference, 0)
      sums[i] = (diff > 0 ? '+' : '') + liangToGram(diff) + ' 克'
    } else sums[i] = ''
  })
  return sums
}

async function createOrder() {
  const order = await stocktakingApi.create({ location: newOrderLocation.value || null, remark: newOrderRemark.value })
  // 初始化 actualGram 字段（从 actualPureWeight 转换）
  order.items.forEach((it) => {
    it.actualGram = it.actualPureWeight !== null ? (it.actualPureWeight / 100) : null
  })
  currentOrder.value = order
  createDialog.value = false
  newOrderLocation.value = ''
  newOrderRemark.value = ''
  ElMessage.success('盘点单已创建')
  loadHistory()
}

async function saveItem(row) {
  if (row.actualGram === null || row.actualGram === undefined) return
  const actualPureWeight = gramToLiang(row.actualGram)
  const updated = await stocktakingApi.updateItem(currentOrder.value.id, row.id, { actualPureWeight })
  row.actualPureWeight = updated.actualPureWeight
  row.difference = updated.difference
}

async function submitOrder() {
  const missing = currentOrder.value.items.filter((r) => r.actualGram === null || r.actualGram === undefined)
  if (missing.length > 0) {
    ElMessage.warning(`还有 ${missing.length} 项未录入实盘重量`)
    return
  }
  try {
    await ElMessageBox.confirm('确认提交盘点？提交后将固化差异记录。', '提示', { type: 'warning' })
    const res = await stocktakingApi.submit(currentOrder.value.id)
    ElMessage.success(`盘点完成：${res.diffSummary.matched} 项一致，${res.diffSummary.surplus} 项盈，${res.diffSummary.loss} 项亏`)
    await loadHistory()
    currentOrder.value = null
    activeTab.value = 'history'
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

async function cancelOrder() {
  try {
    await ElMessageBox.confirm('确认取消该盘点单？', '提示', { type: 'warning' })
    await stocktakingApi.cancel(currentOrder.value.id)
    ElMessage.success('已取消')
    currentOrder.value = null
    loadHistory()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

async function viewOrder(row) {
  const full = await stocktakingApi.get(row.id)
  full.items.forEach((it) => {
    it.actualGram = it.actualPureWeight !== null ? (it.actualPureWeight / 100) : null
  })
  currentOrder.value = full
  activeTab.value = 'current'
}

async function loadHistory() {
  history.value = await stocktakingApi.list({})
}

async function loadLocations() {
  const stats = await inventoryApi.stats()
  if (stats?.byLocation) locations.value = Object.keys(stats.byLocation)
}

onMounted(async () => {
  await Promise.all([loadHistory(), loadLocations()])
})
</script>
