// ============ 打印路由 ============
// 返回结构化小票数据，前端用浏览器打印预览
// 若配置了网络打印机（PRINTER_TYPE=network），同时尝试 escpos 推送
import { Router, wrap } from '../utils/route.js'
import { prisma } from '../lib/prisma.js'
import { fenToYuan, liangToGram, permilToPercent, priceToYuanPerGram } from '../utils/calc.js'

const router = Router()

// 打印小票
router.post('/:type/:id', wrap(async (req, res) => {
  const { type, id } = req.params
  const orderId = parseInt(id)
  if (!['recycle', 'exchange', 'sell', 'inventory'].includes(type)) {
    return res.status(400).json({ error: '不支持的打印类型' })
  }

  const config = await prisma.systemConfig.findMany()
  const cfg = {}
  for (const c of config) cfg[c.key] = c.value

  let ticket
  if (type === 'recycle') ticket = await buildRecycleTicket(orderId, cfg)
  else if (type === 'exchange') ticket = await buildExchangeTicket(orderId, cfg)
  else if (type === 'sell') ticket = await buildSellTicket(orderId, cfg)
  else if (type === 'inventory') ticket = await buildInventoryTicket(orderId, cfg)

  // 尝试 escpos 网络打印（可选，失败不影响主流程）
  if (process.env.PRINTER_TYPE === 'network') {
    try {
      await sendToNetworkPrinter(ticket.text)
    } catch (e) {
      console.warn('[打印] 网络打印机推送失败，已返回数据供前端打印:', e.message)
    }
  }

  res.json(ticket)
}))

// 打印份数（从配置读取）
router.get('/copies', wrap(async (req, res) => {
  const c = await prisma.systemConfig.findUnique({ where: { key: 'PRINT_COPIES' } })
  res.json({ copies: parseInt(c?.value || '1') })
}))

// ============ 小票构建函数 ============

async function buildRecycleTicket(orderId, cfg) {
  const order = await prisma.recycleOrder.findUnique({
    where: { id: orderId },
    include: { party: true, items: true, payments: true }
  })
  if (!order) throw Object.assign(new Error('回收单不存在'), { status: 404 })

  const lines = []
  lines.push(`======== ${cfg.SHOP_NAME || '小金店'} ========`)
  lines.push(`回收单据  ${order.orderNo}`)
  lines.push(`时间: ${fmtDateTime(order.createdAt)}`)
  if (order.party) lines.push(`客户: ${order.party.name || '-'} ${order.party.phone || ''}`)
  lines.push(`黄金回收价: ${priceToYuanPerGram(order.recyclePrice)} 元/克`)
  lines.push('------------------------------')
  lines.push('物品          金属  毛重    纯金重   金额')
  for (const it of order.items) {
    lines.push(`${pad(it.itemName, 12)} ${padR(metalLabel(it.metalType), 4)} ${padR(liangToGram(it.grossWeight), 6)} ${padR(liangToGram(it.pureWeight), 8)} ${padR(fenToYuan(it.amount), 8)}`)
  }
  lines.push('------------------------------')
  lines.push(`合计纯金重: ${liangToGram(order.totalPureWeight)} 克`)
  lines.push(`合计金额: ${fenToYuan(order.totalAmount)} 元`)
  lines.push('--- 支付方式 ---')
  for (const p of order.payments) {
    lines.push(`${methodLabel(p.method)}: ${fenToYuan(p.amount)} 元`)
  }
  lines.push('------------------------------')
  lines.push(`电话: ${cfg.SHOP_PHONE || ''}`)
  lines.push('欢迎下次光临！')
  lines.push('==============================')

  return { type: 'recycle', orderNo: order.orderNo, text: lines.join('\n'), data: order }
}

async function buildExchangeTicket(orderId, cfg) {
  const order = await prisma.exchangeOrder.findUnique({
    where: { id: orderId },
    include: { party: true, oldItems: { include: { inventory: true } }, newItems: true, payments: true }
  })
  if (!order) throw Object.assign(new Error('换新单不存在'), { status: 404 })

  const lines = []
  lines.push(`======== ${cfg.SHOP_NAME || '小金店'} ========`)
  lines.push(`以旧换新单据  ${order.orderNo}`)
  lines.push(`时间: ${fmtDateTime(order.createdAt)}`)
  if (order.party) lines.push(`客户: ${order.party.name || '-'} ${order.party.phone || ''}`)
  lines.push('--- 旧料抵扣 ---')
  for (const o of order.oldItems) {
    lines.push(`${o.inventory.uniqueCode} ${pad(o.inventory.itemName, 10)} 抵扣 ${fenToYuan(o.deductAmount)} 元`)
  }
  lines.push(`旧料抵扣合计: ${fenToYuan(order.totalOldDeduct)} 元`)
  lines.push('--- 新品 ---')
  for (const n of order.newItems) {
    lines.push(`${pad(n.productName, 14)} 售价 ${fenToYuan(n.salePrice)} 元 工费 ${fenToYuan(n.laborFeeItem)} 元`)
  }
  lines.push(`新品合计: ${fenToYuan(order.totalNewPrice)} 元`)
  lines.push(`工费合计: ${fenToYuan(order.laborFee)} 元`)
  lines.push('------------------------------')
  lines.push(`应收金额: ${fenToYuan(order.receiveAmount)} 元`)
  lines.push('--- 支付方式 ---')
  for (const p of order.payments) {
    lines.push(`${methodLabel(p.method)}: ${fenToYuan(p.amount)} 元`)
  }
  lines.push('------------------------------')
  lines.push(`电话: ${cfg.SHOP_PHONE || ''}`)
  lines.push('感谢惠顾！')
  lines.push('==============================')

  return { type: 'exchange', orderNo: order.orderNo, text: lines.join('\n'), data: order }
}

async function buildSellTicket(orderId, cfg) {
  const order = await prisma.sellOrder.findUnique({
    where: { id: orderId },
    include: { party: true, items: { include: { inventory: true } }, payments: true }
  })
  if (!order) throw Object.assign(new Error('出售单不存在'), { status: 404 })

  const lines = []
  lines.push(`======== ${cfg.SHOP_NAME || '小金店'} ========`)
  lines.push(`旧料出售单据  ${order.orderNo}`)
  lines.push(`时间: ${fmtDateTime(order.createdAt)}`)
  if (order.party) lines.push(`买方: ${order.party.name || '-'} ${order.party.phone || ''}`)
  lines.push(`出售价: ${priceToYuanPerGram(order.sellPrice)} 元/克`)
  lines.push('------------------------------')
  lines.push('编号            物品          纯金重   金额')
  for (const it of order.items) {
    lines.push(`${it.inventory.uniqueCode} ${pad(it.inventory.itemName, 12)} ${padR(liangToGram(it.pureWeight), 7)} ${padR(fenToYuan(it.amount), 8)}`)
  }
  lines.push('------------------------------')
  lines.push(`合计纯金重: ${liangToGram(order.totalPureWeight)} 克`)
  lines.push(`合计金额: ${fenToYuan(order.totalAmount)} 元`)
  lines.push('--- 支付方式 ---')
  for (const p of order.payments) {
    lines.push(`${methodLabel(p.method)}: ${fenToYuan(p.amount)} 元`)
  }
  lines.push('------------------------------')
  lines.push(`电话: ${cfg.SHOP_PHONE || ''}`)
  lines.push('感谢惠顾！')
  lines.push('==============================')

  return { type: 'sell', orderNo: order.orderNo, text: lines.join('\n'), data: order }
}

async function buildInventoryTicket(orderId, cfg) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: orderId } })
  if (!item) throw Object.assign(new Error('库存不存在'), { status: 404 })

  const lines = []
  lines.push(`======== ${cfg.SHOP_NAME || '小金店'} ========`)
  lines.push('库存标签')
  lines.push('------------------------------')
  lines.push(`编号: ${item.uniqueCode}`)
  lines.push(`物品: ${item.itemName}`)
  lines.push(`金属: ${metalLabel(item.metalType)}`)
  lines.push(`毛重: ${liangToGram(item.grossWeight)} 克`)
  lines.push(`纯度: ${permilToPercent(item.purity)}`)
  lines.push(`纯金重: ${liangToGram(item.pureWeight)} 克`)
  lines.push(`成本: ${fenToYuan(item.costAmount)} 元`)
  if (item.recyclePriceAtReceive) {
    lines.push(`收旧时回收价: ${priceToYuanPerGram(item.recyclePriceAtReceive)} 元/克`)
  }
  // 黄金项显示融通金/国际金价
  if (item.rongtongjinPriceAtReceive) {
    lines.push(`收旧时融通金: ${priceToYuanPerGram(item.rongtongjinPriceAtReceive)} 元/克`)
  }
  // 白银项显示白银市场行情价
  if (item.silverMarketPriceAtReceive) {
    lines.push(`收旧时白银行情: ${priceToYuanPerGram(item.silverMarketPriceAtReceive)} 元/克`)
  }
  // 铂金项显示铂金市场行情价
  if (item.platinumMarketPriceAtReceive) {
    lines.push(`收旧时铂金行情: ${priceToYuanPerGram(item.platinumMarketPriceAtReceive)} 元/克`)
  }
  lines.push(`位置: ${item.location}`)
  lines.push(`入库: ${fmtDateTime(item.createdAt)}`)
  lines.push('==============================')

  return { type: 'inventory', orderNo: item.uniqueCode, text: lines.join('\n'), data: item }
}

// ============ 辅助 ============
function fmtDateTime(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function methodLabel(m) {
  return { cash: '现金', wechat: '微信', alipay: '支付宝', bank: '银行转账' }[m] || m
}
function metalLabel(m) {
  return { GOLD: '金', SILVER: '银', PLATINUM: '铂' }[m] || m
}
function pad(s, len) {
  s = String(s || '')
  // 中文字符占2位
  let width = 0
  let out = ''
  for (const ch of s) {
    width += /[\u4e00-\u9fa5]/.test(ch) ? 2 : 1
    out += ch
  }
  while (width < len) { out += ' '; width++ }
  return out.slice(0, Math.max(s.length, len))
}
function padR(s, len) {
  s = String(s || '')
  let width = 0
  for (const ch of s) width += /[\u4e00-\u9fa5]/.test(ch) ? 2 : 1
  let out = s
  while (width < len) { out = ' ' + out; width++ }
  return out
}

// escpos 网络打印（可选，按需启用）
async function sendToNetworkPrinter(text) {
  // 动态引入，避免未配置时加载失败
  const escpos = await import('escpos')
  escpos.Network = (await import('escpos-network')).default || (await import('escpos-network'))
  const device = new escpos.Network(process.env.PRINTER_HOST || '192.168.1.100', parseInt(process.env.PRINTER_PORT || '9100'))
  const printer = new escpos.Printer(device)
  return new Promise((resolve, reject) => {
    device.open((err) => {
      if (err) return reject(err)
      printer
        .font('a')
        .align('ct')
        .style('normal')
        .size(1, 1)
        .text(text)
        .cut()
        .close(() => resolve())
    })
  })
}

export default router
