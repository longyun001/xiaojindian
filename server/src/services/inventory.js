// ============ 库存锁定与消费服务 ============
// 适配两种数据库：
//   PostgreSQL → SELECT ... FOR UPDATE 行级锁
//   SQLite     → updateMany 条件更新（WHERE status='IN_STOCK'）+ 事务串行化
import { Prisma } from '@prisma/client'

export function getDbStrategy() {
  const url = process.env.DATABASE_URL || ''
  return url.startsWith('postgres') ? 'PG' : 'SQLITE'
}

/**
 * 锁定并消费库存：将指定 uniqueCode 的在库旧料状态改为 newStatus
 * 在事务内调用。若任一件不可用则抛错（事务回滚）。
 * @param {PrismaTransaction} tx 事务客户端
 * @param {string[]} codes 库存唯一编号列表
 * @param {string} newStatus 目标状态 EXCHANGED | SOLD
 * @returns {Promise<InventoryItem[]>} 被消费的库存项
 */
export async function lockAndConsume(tx, codes, newStatus) {
  if (!codes || codes.length === 0) return []
  const strategy = getDbStrategy()

  if (strategy === 'PG') {
    // PostgreSQL：行级锁
    const items = await tx.$queryRaw`
      SELECT * FROM "InventoryItem"
      WHERE "uniqueCode" IN (${Prisma.join(codes)})
        AND status = 'IN_STOCK'
      FOR UPDATE`
    if (items.length !== codes.length) {
      const found = new Set(items.map((i) => i.uniqueCode))
      const missing = codes.filter((c) => !found.has(c))
      const err = new Error(`库存不可用：${missing.join(', ')}`)
      err.status = 409
      throw err
    }
    for (const item of items) {
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { status: newStatus }
      })
    }
    // $queryRaw 返回的是普通对象，转回 Prisma model 以便后续使用
    return items.map((i) => ({ ...i }))
  }

  // SQLite：条件更新（乐观锁）+ 事务串行化
  // SQLite 默认 journal mode 下，写入事务会串行化，配合条件更新可防超卖
  const items = []
  for (const code of codes) {
    const inv = await tx.inventoryItem.findUnique({ where: { uniqueCode: code } })
    if (!inv || inv.status !== 'IN_STOCK') {
      const err = new Error(`库存 ${code} 不可用（${inv ? '当前状态：' + inv.status : '不存在'}）`)
      err.status = 409
      throw err
    }
    // 条件更新：仅当状态仍为 IN_STOCK 时才生效
    const result = await tx.inventoryItem.updateMany({
      where: { id: inv.id, status: 'IN_STOCK' },
      data: { status: newStatus }
    })
    if (result.count === 0) {
      // 并发竞争导致状态已变
      const err = new Error(`库存 ${code} 已被其他操作占用，请刷新后重试`)
      err.status = 409
      throw err
    }
    items.push(inv)
  }
  return items
}

/**
 * 校验库存可用性（不锁定，用于前置校验）
 */
export async function verifyInStock(tx, codes) {
  const items = await tx.inventoryItem.findMany({
    where: { uniqueCode: { in: codes } }
  })
  const unavailable = items.filter((i) => i.status !== 'IN_STOCK')
  if (unavailable.length > 0) {
    const err = new Error(`以下库存不在库：${unavailable.map((i) => i.uniqueCode).join(', ')}`)
    err.status = 409
    throw err
  }
  if (items.length !== codes.length) {
    const found = new Set(items.map((i) => i.uniqueCode))
    const missing = codes.filter((c) => !found.has(c))
    const err = new Error(`库存编号不存在：${missing.join(', ')}`)
    err.status = 404
    throw err
  }
  return items
}
