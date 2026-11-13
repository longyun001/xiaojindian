// ============ 盘点路由 ============
// 业务流程：
//   1. 创建盘点单（DRAFT）：选定位置，自动拉取该位置在库库存，写入 systemPureWeight 快照
//   2. 录入实盘重量（actualPureWeight），实时计算 difference = actual - system
//   3. 提交盘点（COMPLETED）：固化差异，写审计
//   4. 可取消盘点单（CANCELLED）
import { Router, wrap } from '../utils/route.js'
import { prisma } from '../lib/prisma.js'
import { generateOrderNo } from '../utils/code.js'
import { writeAudit } from '../services/audit.js'

const router = Router()

// 盘点单列表
router.get('/', wrap(async (req, res) => {
  const { status } = req.query
  const where = {}
  if (status) where.status = status
  const list = await prisma.stocktakingOrder.findMany({
    where,
    include: { items: { include: { inventory: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100
  })
  res.json(list)
}))

// 详情
router.get('/:id', wrap(async (req, res) => {
  const id = parseInt(req.params.id)
  const order = await prisma.stocktakingOrder.findUnique({
    where: { id },
    include: { items: { include: { inventory: true } } }
  })
  if (!order) return res.status(404).json({ error: '盘点单不存在' })
  res.json(order)
}))

// 创建盘点单（DRAFT）：选定位置，自动拉取在库库存快照
router.post('/', wrap(async (req, res) => {
  const { location, remark } = req.body

  const where = { status: 'IN_STOCK' }
  if (location) where.location = location

  const inStockItems = await prisma.inventoryItem.findMany({ where })

  const result = await prisma.$transaction(async (tx) => {
    const orderNo = await generateOrderNo('stocktaking', tx)
    const order = await tx.stocktakingOrder.create({
      data: {
        orderNo,
        location: location || null,
        status: 'CHECKING',
        remark: remark || null
      }
    })

    if (inStockItems.length > 0) {
      await tx.stocktakingItem.createMany({
        data: inStockItems.map((inv) => ({
          stocktakingId: order.id,
          inventoryItemId: inv.id,
          systemPureWeight: inv.pureWeight,
          actualPureWeight: null,
          difference: null
        }))
      })
    }

    await writeAudit(tx, {
      entityType: 'StocktakingOrder',
      entityId: order.id,
      action: 'CREATE',
      newValue: { orderNo, location, itemCount: inStockItems.length },
      operator: 'ADMIN'
    })
    return order
  })

  const full = await prisma.stocktakingOrder.findUnique({
    where: { id: result.id },
    include: { items: { include: { inventory: true } } }
  })
  res.json(full)
}))

// 录入实盘重量（单条更新）
router.put('/:id/item/:itemId', wrap(async (req, res) => {
  const id = parseInt(req.params.id)
  const itemId = parseInt(req.params.itemId)
  const { actualPureWeight } = req.body
  if (actualPureWeight !== null && (!Number.isSafeInteger(actualPureWeight) || actualPureWeight < 0)) {
    return res.status(400).json({ error: '实盘重量必须为非负整数（0.01克）' })
  }

  const order = await prisma.stocktakingOrder.findUnique({ where: { id } })
  if (!order) return res.status(404).json({ error: '盘点单不存在' })
  if (order.status !== 'CHECKING') {
    return res.status(400).json({ error: '盘点单状态不允许录入（仅 CHECKING 可录入）' })
  }

  const item = await prisma.stocktakingItem.findUnique({ where: { id: itemId } })
  if (!item || item.stocktakingId !== id) {
    return res.status(404).json({ error: '盘点明细不存在' })
  }

  const difference = (actualPureWeight ?? null) !== null
    ? actualPureWeight - item.systemPureWeight
    : null

  const updated = await prisma.stocktakingItem.update({
    where: { id: itemId },
    data: { actualPureWeight, difference }
  })
  res.json(updated)
}))

// 提交盘点（COMPLETED）：校验所有项已录入，固化
router.post('/:id/submit', wrap(async (req, res) => {
  const id = parseInt(req.params.id)
  const order = await prisma.stocktakingOrder.findUnique({
    where: { id },
    include: { items: true }
  })
  if (!order) return res.status(404).json({ error: '盘点单不存在' })
  if (order.status !== 'CHECKING') {
    return res.status(400).json({ error: '盘点单状态不允许提交' })
  }

  // 校验：所有项必须有实盘重量
  const missing = order.items.filter((i) => i.actualPureWeight === null)
  if (missing.length > 0) {
    return res.status(400).json({ error: `还有 ${missing.length} 项未录入实盘重量` })
  }

  const updated = await prisma.stocktakingOrder.update({
    where: { id },
    data: { status: 'COMPLETED' }
  })

  // 统计差异
  const diffSummary = {
    totalItems: order.items.length,
    matched: order.items.filter((i) => i.difference === 0).length,
    surplus: order.items.filter((i) => i.difference > 0).length,
    loss: order.items.filter((i) => i.difference < 0).length,
    totalDiff: order.items.reduce((s, i) => s + (i.difference || 0), 0)
  }

  await writeAudit(prisma, {
    entityType: 'StocktakingOrder',
    entityId: id,
    action: 'SUBMIT',
    newValue: { status: 'COMPLETED', diffSummary },
    operator: 'ADMIN'
  })

  res.json({ order: updated, diffSummary })
}))

// 取消盘点
router.post('/:id/cancel', wrap(async (req, res) => {
  const id = parseInt(req.params.id)
  const order = await prisma.stocktakingOrder.findUnique({ where: { id } })
  if (!order) return res.status(404).json({ error: '盘点单不存在' })
  if (order.status === 'COMPLETED') {
    return res.status(400).json({ error: '已完成的盘点单不可取消' })
  }

  const updated = await prisma.stocktakingOrder.update({
    where: { id },
    data: { status: 'CANCELLED' }
  })
  await writeAudit(prisma, {
    entityType: 'StocktakingOrder',
    entityId: id,
    action: 'CANCEL',
    oldValue: { status: order.status },
    newValue: { status: 'CANCELLED' },
    operator: 'ADMIN'
  })
  res.json(updated)
}))

export default router
