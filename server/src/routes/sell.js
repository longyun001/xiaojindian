// ============ 旧料出售路由 ============
// 业务流程：
//   1. 接收：交易方、出售单价（分/克）、库存 uniqueCode 列表、支付
//   2. 锁定并消费库存（状态 → SOLD）
//   3. 后端重算每项金额 = pureWeight × sellPrice / 100
//   4. 记录成本（从库存项读取），便于毛利分析
//   5. 校验支付（方向 IN，店方收钱）
//   6. 创建出售单 + 明细 + 支付 + 审计
import { Router, wrap, validatePayments } from '../utils/route.js'
import { prisma } from '../lib/prisma.js'
import { calcItemAmount, sumWeights, sumAmounts } from '../utils/calc.js'
import { generateOrderNo } from '../utils/code.js'
import { lockAndConsume } from '../services/inventory.js'
import { writeAudit, writeAuditBatch } from '../services/audit.js'

const router = Router()

// 列表
router.get('/', wrap(async (req, res) => {
  const { startDate, endDate, partyId } = req.query
  const where = {}
  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = new Date(startDate)
    if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59')
  }
  if (partyId) where.partyId = parseInt(partyId)

  const list = await prisma.sellOrder.findMany({
    where,
    include: { party: true, items: { include: { inventory: true } }, payments: true },
    orderBy: { createdAt: 'desc' },
    take: 200
  })
  res.json(list)
}))

// 详情
router.get('/:id', wrap(async (req, res) => {
  const id = parseInt(req.params.id)
  const order = await prisma.sellOrder.findUnique({
    where: { id },
    include: { party: true, items: { include: { inventory: true } }, payments: true }
  })
  if (!order) return res.status(404).json({ error: '出售单不存在' })
  res.json(order)
}))

// 创建出售单
// 支持多金属混售：前端传 itemPrices（uniqueCode → 分/克），后端按库存 metalType 取对应单价
// 兼容旧接口：若未传 itemPrices，则用 sellPrice 统一计价（仅适合单金属场景）
router.post('/', wrap(async (req, res) => {
  const {
    partyId,
    sellPrice,    // 默认出售单价（分/克），仅当 itemPrices 未提供该项时使用
    itemCodes,    // 库存 uniqueCode 数组
    itemPrices,   // 可选：{ [uniqueCode]: 分/克 } 每件独立单价（多金属混售时必传）
    payments
  } = req.body

  // ===== 校验 =====
  if (!Array.isArray(itemCodes) || itemCodes.length === 0) {
    return res.status(400).json({ error: '出售库存不能为空' })
  }
  // sellPrice 可为 0（当所有项都通过 itemPrices 提供单价时）；但若都没提供则报错
  if (!Number.isSafeInteger(sellPrice) || sellPrice < 0) {
    return res.status(400).json({ error: '出售单价必须为非负整数（分/克）' })
  }
  if (itemPrices && typeof itemPrices !== 'object') {
    return res.status(400).json({ error: 'itemPrices 必须为对象 { [uniqueCode]: 分/克 }' })
  }

  // ===== 事务执行 =====
  const result = await prisma.$transaction(async (tx) => {
    // 1. 锁定并消费库存
    const consumed = await lockAndConsume(tx, itemCodes, 'SOLD')

    // 2. 后端重算每项金额（按金属种类取对应单价）
    const computedItems = consumed.map((inv) => {
      // 优先用 itemPrices 中的单价，其次用 sellPrice
      const unitPrice = (itemPrices && itemPrices[inv.uniqueCode] != null)
        ? itemPrices[inv.uniqueCode]
        : sellPrice
      if (!Number.isSafeInteger(unitPrice) || unitPrice <= 0) {
        const err = new Error(`库存 ${inv.uniqueCode}（${inv.metalType}）缺少有效的出售单价`)
        err.status = 400
        throw err
      }
      const amount = calcItemAmount(inv.pureWeight, unitPrice)
      return {
        inventoryItemId: inv.id,
        pureWeight: inv.pureWeight,
        unitPrice,
        amount,
        costAmount: inv.costAmount,
        costPureWeight: inv.costPureWeight
      }
    })

    const totalPureWeight = sumWeights(computedItems.map((i) => i.pureWeight))
    const totalAmount = sumAmounts(computedItems.map((i) => i.amount))

    // 3. 校验支付（方向 IN）
    validatePayments(payments, totalAmount, 'IN')

    // 4. 创建出售单（sellPrice 记录默认/黄金单价，明细 unitPrice 记录每项实际单价）
    const orderNo = await generateOrderNo('sell', tx)
    const order = await tx.sellOrder.create({
      data: {
        orderNo,
        partyId: partyId || null,
        totalPureWeight,
        totalAmount,
        sellPrice
      }
    })

    // 5. 明细
    await tx.sellOrderItem.createMany({
      data: computedItems.map((c) => ({ ...c, sellOrderId: order.id }))
    })

    // 6. 支付（方向 IN）
    const paymentData = payments.map((p) => ({
      orderType: 'SELL',
      orderId: order.id,
      sellOrderId: order.id,
      method: p.method,
      amount: p.amount,
      direction: 'IN'
    }))
    await tx.payment.createMany({ data: paymentData })

    // 7. 审计
    await writeAudit(tx, {
      entityType: 'SellOrder',
      entityId: order.id,
      action: 'CREATE',
      newValue: { orderNo, totalPureWeight, totalAmount, sellPrice, itemCount: consumed.length },
      operator: 'ADMIN'
    })
    await writeAuditBatch(tx, consumed.map((inv) => ({
      entityType: 'InventoryItem',
      entityId: inv.id,
      action: 'SOLD',
      oldValue: { status: 'IN_STOCK', uniqueCode: inv.uniqueCode },
      newValue: { status: 'SOLD', sellOrderId: order.id },
      operator: 'ADMIN'
    })))

    return { order, totalPureWeight, totalAmount, costTotal: sumAmounts(computedItems.map((i) => i.costAmount)) }
  })

  const full = await prisma.sellOrder.findUnique({
    where: { id: result.order.id },
    include: { party: true, items: { include: { inventory: true } }, payments: true }
  })
  res.json({
    order: full,
    summary: {
      totalPureWeight: result.totalPureWeight,
      totalAmount: result.totalAmount,
      costTotal: result.costTotal,
      profit: result.totalAmount - result.costTotal
    }
  })
}))

export default router
