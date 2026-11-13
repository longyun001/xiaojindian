// ============ 统一编号生成服务 ============
// 规则：{前缀}{日期}-{3位或4位流水}，每日重置
//   订单编号：REC20260701-001（回收）/ EXC20260701-001（换新）/ SEL20260701-001（出售）/ STK20260701-001（盘点）
//   库存编号：INV20260701-0001

import { prisma } from '../lib/prisma.js'
import { shopDay } from './shopDate.js'

const ORDER_PREFIXES = {
  recycle: 'REC',
  exchange: 'EXC',
  sell: 'SEL',
  stocktaking: 'STK'
}

function todayStr(date = new Date()) { return shopDay(date).replaceAll('-', '') }

/**
 * 生成订单编号：{前缀}{日期}-{3位流水}
 * 实现方式：查询当天该前缀最大编号，自增。并发场景下依靠唯一索引兜底。
 * @param {'recycle'|'exchange'|'sell'|'stocktaking'} type
 */
export async function generateOrderNo(type, db = prisma) {
  const prefix = ORDER_PREFIXES[type]
  if (!prefix) throw new Error(`未知订单类型: ${type}`)
  const dateStr = todayStr()
  const like = `${prefix}${dateStr}-`

  // 查询当天最大编号
  let model, field
  switch (type) {
    case 'recycle':
      model = db.recycleOrder; field = 'orderNo'; break
    case 'exchange':
      model = db.exchangeOrder; field = 'orderNo'; break
    case 'sell':
      model = db.sellOrder; field = 'orderNo'; break
    case 'stocktaking':
      model = db.stocktakingOrder; field = 'orderNo'; break
  }

  const rows = await model.findMany({ where: { orderNo: { startsWith: like } }, select: { orderNo: true } })
  const latest = rows.sort((a,b) => Number(b.orderNo.split('-')[1]) - Number(a.orderNo.split('-')[1]))[0]

  let seq = 1
  if (latest) {
    const parts = latest.orderNo.split('-')
    seq = parseInt(parts[1], 10) + 1
  }
  return `${like}${String(seq).padStart(3, '0')}`
}

/**
 * 生成库存编号：INV{日期}-{4位流水}
 * @param {number} sourceId 回收明细ID（用于关联，但不写入编号）
 */
export async function generateInventoryCode() {
  const dateStr = todayStr()
  const like = `INV${dateStr}-`

  const latest = await prisma.inventoryItem.findFirst({
    where: { uniqueCode: { startsWith: like } },
    orderBy: { uniqueCode: 'desc' },
    select: { uniqueCode: true }
  })

  let seq = 1
  if (latest) {
    const parts = latest.uniqueCode.split('-')
    seq = parseInt(parts[1], 10) + 1
  }
  return `${like}${String(seq).padStart(4, '0')}`
}

/**
 * 批量生成库存编号（同一回收单多件旧料）
 * 只查询一次数据库取当前最大序号，内存自增，避免事务内多次查询看不到自身写入导致编号重复
 * 并发场景依赖 unique 索引兜底（冲突则事务回滚，调用方重试）
 * @param {number} count 需要生成的编号数量
 */
export async function generateInventoryCodes(count, db = prisma) {
  const dateStr = todayStr()
  const like = `INV${dateStr}-`

  const rows = await db.inventoryItem.findMany({ where: { uniqueCode: { startsWith: like } }, select: { uniqueCode: true } })
  const latest = rows.sort((a,b) => Number(b.uniqueCode.split('-')[1]) - Number(a.uniqueCode.split('-')[1]))[0]

  let seq = 1
  if (latest) {
    seq = parseInt(latest.uniqueCode.split('-')[1], 10) + 1
  }

  const codes = []
  for (let i = 0; i < count; i++) {
    codes.push(`${like}${String(seq).padStart(4, '0')}`)
    seq++
  }
  return codes
}

export { todayStr }
