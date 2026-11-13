import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'Dashboard', component: () => import('@/views/Dashboard.vue'), meta: { title: '首页', icon: 'Odometer' } },
  { path: '/recycle', name: 'Recycle', component: () => import('@/views/Recycle.vue'), meta: { title: '收旧', icon: 'Download' } },
  { path: '/inventory', name: 'Inventory', component: () => import('@/views/Inventory.vue'), meta: { title: '库存', icon: 'Box' } },
  { path: '/exchange', name: 'Exchange', component: () => import('@/views/Exchange.vue'), meta: { title: '以旧换新', icon: 'Switch' } },
  { path: '/sell', name: 'Sell', component: () => import('@/views/Sell.vue'), meta: { title: '旧料出售', icon: 'Upload' } },
  { path: '/stocktaking', name: 'Stocktaking', component: () => import('@/views/Stocktaking.vue'), meta: { title: '盘点', icon: 'DocumentChecked' } },
  { path: '/reports', name: 'Reports', component: () => import('@/views/Reports.vue'), meta: { title: '报表', icon: 'TrendCharts' } },
  { path: '/logs', name: 'Logs', component: () => import('@/views/Logs.vue'), meta: { title: '日志', icon: 'List' } },
  { path: '/settings', name: 'Settings', component: () => import('@/views/Settings.vue'), meta: { title: '设置', icon: 'Setting' } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
