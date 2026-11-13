// ============ API 模块封装 ============
import request from './request'

export const maintenanceApi = {
  integrity: () => request.get('/maintenance/integrity', { timeout: 120000 })
}

// 系统配置
export const configApi = {
  get: () => request.get('/config'),
  update: (data) => request.put('/config', data)
}

// 金价
export const goldPriceApi = {
  current: () => request.get('/gold-price/current'),
  history: (limit = 30) => request.get('/gold-price/history', { params: { limit } }),
  update: (data) => request.put('/gold-price', data)
}

// 交易方
export const partyApi = {
  list: (params) => request.get('/parties', { params }),
  get: (id) => request.get(`/parties/${id}`),
  create: (data) => request.post('/parties', data),
  update: (id, data) => request.put(`/parties/${id}`, data),
  remove: (id) => request.delete(`/parties/${id}`)
}

// 回收
export const recycleApi = {
  list: (params) => request.get('/recycle', { params }),
  get: (id) => request.get(`/recycle/${id}`),
  create: (data) => request.post('/recycle', data)
}

// 库存
export const inventoryApi = {
  list: (params) => request.get('/inventory', { params }),
  get: (code) => request.get(`/inventory/${code}`),
  updateLocation: (code, location) => request.put(`/inventory/${code}/location`, { location }),
  updateRemark: (code, remark) => request.put(`/inventory/${code}/remark`, { remark }),
  stats: () => request.get('/inventory/stats/overview')
}

// 以旧换新
export const exchangeApi = {
  list: (params) => request.get('/exchange', { params }),
  get: (id) => request.get(`/exchange/${id}`),
  create: (data) => request.post('/exchange', data)
}

// 出售
export const sellApi = {
  list: (params) => request.get('/sell', { params }),
  get: (id) => request.get(`/sell/${id}`),
  create: (data) => request.post('/sell', data)
}

// 盘点
export const stocktakingApi = {
  list: (params) => request.get('/stocktaking', { params }),
  get: (id) => request.get(`/stocktaking/${id}`),
  create: (data) => request.post('/stocktaking', data),
  updateItem: (id, itemId, data) => request.put(`/stocktaking/${id}/item/${itemId}`, data),
  submit: (id) => request.post(`/stocktaking/${id}/submit`),
  cancel: (id) => request.post(`/stocktaking/${id}/cancel`)
}

// 报表
export const reportApi = {
  dashboard: () => request.get('/reports/dashboard'),
  profit: (params) => request.get('/reports/profit', { params })
}

// 审计日志
export const auditApi = {
  list: (params) => request.get('/audit-logs', { params })
}

// 打印
export const printApi = {
  print: (type, id) => request.post(`/print/${type}/${id}`),
  copies: () => request.get('/print/copies')
}

// 照片
export const photoApi = {
  upload: (formData, onProgress) => request.post('/photos/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress
  }),
  reattach: (tempCode, uniqueCode) => request.post('/photos/reattach', { tempCode, uniqueCode }),
  list: (uniqueCode) => request.get(`/photos/${uniqueCode}`),
  remove: (id) => request.delete(`/photos/${id}`)
}
