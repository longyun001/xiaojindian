<template>
  <div class="dashboard" :aria-busy="!data">
    <section class="dashboard-welcome">
      <div><p class="view-eyebrow"><span class="eyebrow-line"></span> 门店经营概览</p><h1>今日经营，一目了然。</h1><p class="welcome-description" v-if="data"><span class="welcome-fact">今日已记录 <strong>{{ todayCount }}</strong> 笔业务</span><span class="welcome-divider">·</span><span class="welcome-fact">当前在库 <strong>{{ data.inventory.totalInStock }}</strong> 件旧料</span></p><p class="welcome-description" v-else>正在整理门店经营数据…</p></div>
      <div class="welcome-actions"><router-link to="/inventory" class="button-link secondary">查看库存 <el-icon><ArrowRight /></el-icon></router-link><router-link to="/recycle" class="button-link primary"><el-icon><Plus /></el-icon> 开始收旧</router-link></div>
    </section>

    <div class="dashboard-metrics">
      <article class="metric-card" v-for="metric in metrics" :key="metric.label">
        <div class="metric-top"><span>{{ metric.label }}</span><span class="metric-icon" :class="metric.tone"><el-icon><component :is="metric.icon" /></el-icon></span></div>
        <div class="metric-number"><small>¥</small>{{ money(metric.value) }}</div><div class="metric-bottom">{{ metric.detail }}</div>
      </article>
    </div>

    <div class="dashboard-main-grid">
      <section class="page-card asset-panel">
        <div class="panel-heading"><div><p class="panel-eyebrow">库存资产</p><h2>每一件价值，清楚在册</h2></div><router-link to="/inventory" class="text-link">查看明细 <el-icon><ArrowRight /></el-icon></router-link></div>
        <div class="asset-overview">
          <div><span class="asset-value-label">当前参考估值 <el-tooltip content="按已录入的金、银、铂对应价格估算，仅作库存参考。" placement="top"><el-icon><InfoFilled /></el-icon></el-tooltip></span><div class="asset-value"><small>¥</small>{{ money(data?.inventory.inventoryValue) }}</div></div>
          <div class="asset-stock-count"><strong>{{ data?.inventory.totalInStock ?? '—' }}</strong><span>件旧料在库</span></div>
        </div>
        <div class="asset-book-values"><div><span>在库成本</span><strong>{{ fenToYuan(data?.inventory.totalCost) }}</strong></div><div><span>估算价差</span><strong :class="(data?.inventory.potentialProfit ?? 0) < 0 ? 'amount-negative' : 'amount-positive'">{{ fenToYuan(data?.inventory.potentialProfit) }}</strong></div></div>
        <div class="metal-holdings">
          <div v-for="metal in metals" :key="metal.type" class="metal-holding" :class="'metal-' + metal.type.toLowerCase()">
            <div class="metal-label"><span class="metal-dot"></span>{{ metal.label }}<small>{{ metal.count }} 件</small></div>
            <strong>{{ liangToGram(metal.weight) }}<small>克</small></strong><span class="metal-cost">成本 {{ fenToYuan(metal.cost) }}</span>
          </div>
        </div>
        <div class="valuation-note"><el-icon><InfoFilled /></el-icon><span>黄金按{{ valuationLabel }}估值，银铂按各自出售价估值。<template v-if="data?.currentPrice">牌价录入于 {{ fmtDateTime(data.currentPrice.createdAt) }}。</template></span></div>
      </section>

      <section class="page-card quick-panel">
        <div class="panel-heading"><div><p class="panel-eyebrow">常用入口</p><h2>日常业务，随手办理</h2></div><span class="panel-corner-icon"><el-icon><Grid /></el-icon></span></div>
        <div class="quick-actions"><router-link v-for="action in shortcuts" :key="action.path" :to="action.path" class="quick-action"><span class="quick-action-icon" :class="action.tone"><el-icon><component :is="action.icon" /></el-icon></span><span class="quick-action-copy"><strong>{{ action.title }}</strong><small>{{ action.description }}</small></span><el-icon class="quick-action-arrow"><ArrowRight /></el-icon></router-link></div>
      </section>
    </div>

    <div class="dashboard-bottom-grid">
      <section class="page-card location-panel">
        <div class="panel-heading"><div><p class="panel-eyebrow">实物管理</p><h2>库存放在哪里</h2></div><span class="panel-count">{{ locationRows.length }} 个位置</span></div>
        <el-table :data="locationRows" v-if="locationRows.length" class="location-table">
          <el-table-column label="存放位置" min-width="120"><template #default="{ row }"><span class="location-name"><el-icon><Location /></el-icon>{{ row.location }}</span></template></el-table-column>
          <el-table-column label="在库件数" width="90" align="right"><template #default="{ row }">{{ row.count }} 件</template></el-table-column>
          <el-table-column label="在库成本" min-width="120" align="right"><template #default="{ row }"><strong class="table-amount">{{ fenToYuan(row.cost) }}</strong></template></el-table-column>
        </el-table>
        <div v-else class="dashboard-empty"><el-icon><Box /></el-icon><strong>还没有在库旧料</strong><p>完成回收后，旧料会按位置显示在这里。</p><router-link to="/recycle" class="text-link">登记第一笔回收 <el-icon><ArrowRight /></el-icon></router-link></div>
        <div class="location-footer" v-if="locationRows.length"><el-icon><DocumentChecked /></el-icon><span>定期核对实物，让库存始终有数。</span><router-link to="/stocktaking" class="text-link">去盘点 <el-icon><ArrowRight /></el-icon></router-link></div>
      </section>

      <section class="page-card activity-panel">
        <div class="panel-heading"><div><p class="panel-eyebrow">经营留痕</p><h2>最近操作</h2></div><router-link to="/logs" class="text-link">全部记录 <el-icon><ArrowRight /></el-icon></router-link></div>
        <div v-if="data?.recentLogs?.length" class="activity-list"><div v-for="log in data.recentLogs.slice(0, 5)" :key="log.id" class="activity-row"><span class="activity-dot" :class="activityTone(log.action)"></span><div class="activity-copy"><strong>{{ activityLabel(log) }}</strong><span>{{ summarize(log.newValue) || entityLabel(log.entityType) }}</span></div><time>{{ shortDate(log.createdAt) }}</time></div></div>
        <div v-else class="dashboard-empty"><el-icon><Document /></el-icon><strong>操作记录会留在这里</strong><p>回收、出售和库存变动都可随时回看。</p></div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import { Download, Upload, Switch, Box, DocumentChecked, Setting } from '@element-plus/icons-vue'
import { reportApi } from '@/api'
import { fenToYuan, liangToGram, fmtDateTime } from '@/utils/format'

const data = ref(null)
const moneyFormat = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function money(fen) { return fen == null ? '—' : moneyFormat.format(fen / 100) }
const todayCount = computed(() => (data.value?.today.recycle.count || 0) + (data.value?.today.sell.count || 0) + (data.value?.today.exchange.count || 0))
const locationRows = computed(() => Object.entries(data.value?.inventory.byLocation || {}).map(([location, value]) => ({ location, ...value })))
const valuationLabel = computed(() => data.value?.inventory.valuationMethod === 'international' ? '国际金价' : '融通金价')
const metrics = computed(() => [
  { label: '今日回收', value: data.value?.today.recycle.totalAmount, detail: `${data.value?.today.recycle.count || 0} 单回收 · ${liangToGram(data.value?.today.recycle.totalPureWeight || 0)} 克`, icon: Download, tone: 'gold' },
  { label: '今日出售', value: data.value?.today.sell.totalAmount, detail: `${data.value?.today.sell.count || 0} 单出售 · ${liangToGram(data.value?.today.sell.totalPureWeight || 0)} 克`, icon: Upload, tone: 'green' },
  { label: '今日换新', value: data.value?.today.exchange.receiveAmount, detail: `${data.value?.today.exchange.count || 0} 单换新 · 工费 ${fenToYuan(data.value?.today.exchange.laborFee || 0)}`, icon: Switch, tone: 'clay' },
  { label: '库存参考估值', value: data.value?.inventory.inventoryValue, detail: `${data.value?.inventory.totalInStock || 0} 件在库 · 按已录入牌价估算`, icon: Box, tone: 'slate' }
])
const metals = computed(() => [{ type: 'GOLD', label: '黄金' }, { type: 'SILVER', label: '白银' }, { type: 'PLATINUM', label: '铂金' }].map(metal => {
  const value = data.value?.inventory.byMetal?.[metal.type]
  return { ...metal, count: value?.count || 0, weight: value?.pureWeight || 0, cost: value?.cost || 0 }
}))
const shortcuts = [
  { path: '/recycle', title: '旧料回收', description: '称重计价，拍照留档', icon: Download, tone: 'gold' },
  { path: '/sell', title: '旧料出售', description: '选择库存，核对收款', icon: Upload, tone: 'green' },
  { path: '/stocktaking', title: '库存盘点', description: '逐件核对，记录差异', icon: DocumentChecked, tone: 'slate' },
  { path: '/settings', title: '门店设置', description: '行情资料与数据维护', icon: Setting, tone: 'clay' }
]
function entityLabel(entity) { return ({ RecycleOrder: '回收单', InventoryItem: '库存档案', InventoryPhoto: '影像档案', SellOrder: '出售单', GoldPrice: '金价资料', Payment: '收付款', SystemConfig: '门店设置', StocktakingOrder: '盘点单', ExchangeOrder: '换新单', Party: '交易方资料' })[entity] || '门店记录' }
function activityLabel(log) {
  if (log.action === 'CREATE_FROM_RECYCLE') return '旧料已入库'
  if (log.action === 'UPLOAD') return '影像已留档'
  if (log.action === 'REATTACH') return '影像已归档'
  const prefix = log.action?.includes('CREATE') ? '新增' : log.action?.includes('DELETE') ? '删除' : log.action?.includes('CANCEL') ? '取消' : log.action?.includes('SUBMIT') ? '提交' : '更新'
  return prefix + entityLabel(log.entityType)
}
function activityTone(action) { return action?.includes('DELETE') || action?.includes('CANCEL') ? 'clay' : action?.includes('CREATE') ? 'green' : 'gold' }
function summarize(value) {
  if (typeof value === 'string') { try { value = JSON.parse(value) } catch { return '' } }
  if (!value || typeof value !== 'object') return ''
  const code = typeof value.uniqueCode === 'string' && value.uniqueCode.startsWith('INV') ? value.uniqueCode : ''
  return value.orderNo || code || value.location || ''
}
function shortDate(value) { return value ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '' }
async function load() { data.value = await reportApi.dashboard() }
onMounted(load)
onActivated(load)
</script>
