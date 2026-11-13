// ============ 前端展示格式化 ============
// 后端存储为整数（分/0.01g/万分比），前端仅做展示转换
import dayjs from 'dayjs'

// 分 → 元（带 ¥ 符号）
export function fenToYuan(fen) {
  if (fen == null) return '-'
  return '¥' + (fen / 100).toFixed(2)
}

// 分 → 纯数字元
export function fenToYuanNum(fen) {
  if (fen == null) return 0
  return fen / 100
}

// 元 → 分（输入框反向转换）
export function yuanToFen(yuan) {
  return Math.round(parseFloat(yuan) * 100)
}

// 0.01g → 克
export function liangToGram(liang) {
  if (liang == null) return '-'
  return (liang / 100).toFixed(2)
}

export function liangToGramNum(liang) {
  if (liang == null) return 0
  return liang / 100
}

// 克 → 0.01g
export function gramToLiang(gram) {
  return Math.round(parseFloat(gram) * 100)
}

// 分/克 → 元/克
export function priceToYuanPerGram(priceFen) {
  if (priceFen == null) return '-'
  return (priceFen / 100).toFixed(2)
}

export function yuanPerGramToPrice(yuan) {
  return Math.round(parseFloat(yuan) * 100)
}

// 日期格式化
export function fmtDate(d) {
  return d ? dayjs(d).format('YYYY-MM-DD') : '-'
}

export function fmtDateTime(d) {
  return d ? dayjs(d).format('YYYY-MM-DD HH:mm:ss') : '-'
}

// 支付方式标签
export const PAYMENT_METHODS = [
  { value: 'cash', label: '现金' },
  { value: 'wechat', label: '微信' },
  { value: 'alipay', label: '支付宝' },
  { value: 'bank', label: '银行转账' }
]

// 万分比 → 百分比字符串：9999 => "99.99%"
export function permilToPercent(permil) {
  if (permil == null) return '-'
  return (permil / 100).toFixed(2) + '%'
}

export function methodLabel(m) {
  return PAYMENT_METHODS.find((p) => p.value === m)?.label || m
}

// 金属种类
export const METAL_TYPES = [
  { value: 'GOLD', label: '黄金', short: '金' },
  { value: 'SILVER', label: '白银', short: '银' },
  { value: 'PLATINUM', label: '铂金', short: '铂' }
]

export function metalLabel(m) {
  return METAL_TYPES.find((x) => x.value === m)?.label || m
}
export function metalShort(m) {
  return METAL_TYPES.find((x) => x.value === m)?.short || m
}

// 金属对应的标签颜色（Element Plus tag type）
export function metalTagType(m) {
  return { GOLD: 'warning', SILVER: 'info', PLATINUM: 'primary' }[m] || ''
}

// 纯度常用选项（万分比）
// 黄金：9999 万足金 / 9990 千足金 / 9900 足金 / 9160 22K / 7500 18K / 5850 14K
// 白银：9990 足银 / 9900
// 铂金：9500 Pt950 / 9000 Pt900
export const PURITY_OPTIONS_BY_METAL = {
  GOLD: [
    { value: 9999, label: '9999 (万足金 99.99%)' },
    { value: 9990, label: '9990 (千足金 99.90%)' },
    { value: 9900, label: '9900 (足金 99.00%)' },
    { value: 9160, label: '9160 (22K 91.60%)' },
    { value: 7500, label: '7500 (18K 75.00%)' },
    { value: 5850, label: '5850 (14K 58.50%)' }
  ],
  SILVER: [
    { value: 9999, label: '9999 (万足银 99.99%)' },
    { value: 9990, label: '9990 (足银 99.90%)' },
    { value: 9900, label: '9900 (99.00%)' },
    { value: 9250, label: '9250 (925银 92.50%)' }
  ],
  PLATINUM: [
    { value: 9999, label: '9999 (万足铂 99.99%)' },
    { value: 9500, label: '9500 (Pt950 95.00%)' },
    { value: 9000, label: '9000 (Pt900 90.00%)' },
    { value: 8500, label: '8500 (Pt850 85.00%)' }
  ]
}

// 默认纯度选项（向后兼容，未指定金属时用黄金）
export const PURITY_OPTIONS = PURITY_OPTIONS_BY_METAL.GOLD

// 按金属取纯度选项
export function getPurityOptions(metalType = 'GOLD') {
  return PURITY_OPTIONS_BY_METAL[metalType] || PURITY_OPTIONS_BY_METAL.GOLD
}

// 从金价记录取指定金属的回收价/出售价（分/克）
export function getRecyclePriceByMetal(price, metalType) {
  if (!price) return 0
  if (metalType === 'GOLD') return price.recyclePrice
  if (metalType === 'SILVER') return price.silverRecyclePrice || 0
  if (metalType === 'PLATINUM') return price.platinumRecyclePrice || 0
  return 0
}
export function getSalePriceByMetal(price, metalType) {
  if (!price) return 0
  if (metalType === 'GOLD') return price.salePrice
  if (metalType === 'SILVER') return price.silverSalePrice || 0
  if (metalType === 'PLATINUM') return price.platinumSalePrice || 0
  return 0
}

export function bankerRoundScaled(value, scale) {
  const q = Math.floor(value / scale), r = value % scale
  return r * 2 > scale ? q + 1 : r * 2 < scale ? q : q + (q % 2)
}
