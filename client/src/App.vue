<template>
  <div class="app-layout" :class="{ 'sidebar-open': sidebarOpen }" @keydown.esc="sidebarOpen = false">
    <button v-if="sidebarOpen" class="sidebar-scrim" aria-label="关闭导航" @click="sidebarOpen = false"></button>
    <aside class="app-sidebar" aria-label="主导航">
      <router-link to="/dashboard" class="brand">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 40 40" fill="none"><path d="m20 6 12 12-12 16L8 18 20 6Z"/><path d="M8 18h24M20 6l5 12-5 16-5-16 5-12Z"/></svg>
        </span>
        <span class="brand-copy"><strong>{{ shopName }}</strong><small>旧料管理 · 门店工作台</small></span>
      </router-link>

      <nav class="app-menu">
        <div v-for="group in menuGroups" :key="group.label" class="menu-group">
          <p class="menu-group-label">{{ group.label }}</p>
          <router-link v-for="item in group.items" :key="item.path" :to="item.path" class="menu-item" :class="{ active: route.path === item.path }" :aria-current="route.path === item.path ? 'page' : undefined">
            <el-icon><component :is="item.icon" /></el-icon><span>{{ item.title }}</span>
            <span v-if="route.path === item.path" class="menu-current-dot" aria-hidden="true"></span>
          </router-link>
        </div>
      </nav>

      <div class="sidebar-note"><span class="sidebar-note-mark" aria-hidden="true">◇</span><div><strong>每一件，都有迹可循</strong><p>收旧 · 留档 · 库存 · 出售</p></div></div>
      <div class="sidebar-footer"><span>{{ shopName }}</span><span>门店版</span></div>
    </aside>

    <main class="app-main">
      <header class="app-header">
        <div class="header-location">
          <button class="menu-toggle" aria-label="打开导航" :aria-expanded="sidebarOpen" @click="sidebarOpen = !sidebarOpen"><el-icon><Menu /></el-icon></button>
          <span class="header-store">门店工作台</span><span class="breadcrumb-divider">/</span><span class="header-page">{{ currentPage.title }}</span>
        </div>
        <div class="header-right">
          <div class="price-bar" v-if="priceDisplay" aria-label="已录入的黄金参考价，单位元每克">
            <div class="price-bar-caption"><span class="reference-dot"></span><span>黄金参考价</span><small>元 / 克</small></div>
            <div class="price-chip"><span class="label">融通金</span><strong class="value">{{ priceDisplay.rongtongjin }}</strong></div>
            <div class="price-chip"><span class="label">回收</span><strong class="value">{{ priceDisplay.recycle }}</strong></div>
            <div class="price-chip"><span class="label">出售</span><strong class="value">{{ priceDisplay.sale }}</strong></div>
            <el-button class="refresh-price" :icon="Refresh" circle :loading="refreshing" @click="refreshAll" :title="priceUpdatedAt ? `刷新已录入牌价，上次录入 ${priceUpdatedAt}` : '刷新已录入牌价'" aria-label="刷新金价" />
          </div>
          <span class="header-date">{{ today }}</span>
        </div>
      </header>

      <div class="app-content" :class="'route-' + (route.name || '').toLowerCase()" id="main-content">
        <div class="content-container">
          <div class="view-heading" v-if="route.path !== '/dashboard'">
            <div><p class="view-eyebrow">{{ currentPage.group }}</p><h1>{{ currentPage.heading }}</h1><p class="view-description">{{ currentPage.description }}</p></div>
            <span class="workspace-stamp"><el-icon><Shop /></el-icon> 门店工作区</span>
          </div>
          <div class="view-body">
            <router-view v-slot="{ Component }"><keep-alive :include="['Dashboard']"><component :is="Component" /></keep-alive></router-view>
          </div>
          <footer class="content-footer"><span>{{ shopName }} · 旧料管理</span><span>一件一码，安心留档。</span></footer>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Refresh } from '@element-plus/icons-vue'
import { useConfigStore, useGoldPriceStore } from '@/stores/global'
import { fmtDateTime } from '@/utils/format'

const route = useRoute()
const configStore = useConfigStore()
const priceStore = useGoldPriceStore()
const sidebarOpen = ref(false)
const refreshing = ref(false)
const menuGroups = [
  { label: '日常经营', items: [
    { path: '/dashboard', title: '首页', heading: '经营概览', icon: 'Odometer', description: '' },
    { path: '/recycle', title: '收旧', heading: '旧料回收', icon: 'Download', description: '记录每一件旧料，留住重量、价格与影像。' },
    { path: '/inventory', title: '库存', heading: '库存管理', icon: 'Box', description: '一件一码，随时查清每件旧料的状态与去向。' },
    { path: '/exchange', title: '以旧换新', heading: '以旧换新', icon: 'Switch', description: '选择旧料、登记新品，清楚核对抵扣与收款。' },
    { path: '/sell', title: '旧料出售', heading: '旧料出售', icon: 'Upload', description: '按件选择库存，核对售价、成本与毛利。' }
  ] },
  { label: '门店管理', items: [
    { path: '/stocktaking', title: '盘点', heading: '库存盘点', icon: 'DocumentChecked', description: '让实物与记录逐一对应，清楚留下每次盘点。' },
    { path: '/reports', title: '报表', heading: '经营报表', icon: 'TrendCharts', description: '按日期回看收支与毛利，把账目看得更明白。' },
    { path: '/logs', title: '日志', heading: '操作记录', icon: 'List', description: '回看单据与库存的每一次变动。' },
    { path: '/settings', title: '设置', heading: '门店设置', icon: 'Setting', description: '维护价格、交易方与门店资料，也照看好经营数据。' }
  ] }
]
const currentPage = computed(() => {
  for (const group of menuGroups) {
    const page = group.items.find(item => route.path === item.path)
    if (page) return { ...page, group: group.label }
  }
  return { title: '小金店', heading: '门店工作台' }
})
const shopName = computed(() => configStore.config.SHOP_NAME || '小金店')
const priceDisplay = computed(() => priceStore.display())
const priceUpdatedAt = computed(() => fmtDateTime(priceStore.current?.createdAt))
const today = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())
watch(() => route.path, () => { sidebarOpen.value = false })
async function refreshAll() {
  if (refreshing.value) return
  refreshing.value = true
  try { await Promise.all([priceStore.load(), configStore.load()]) }
  finally { refreshing.value = false }
}
onMounted(() => refreshAll().catch(error => console.error('初始化失败', error)))
</script>
