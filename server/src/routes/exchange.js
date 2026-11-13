// ============ 以旧换新路由 ============
// 业务流程：
//   1. 接收：交易方、旧料列表（uniqueCode + 抵扣金额）、新品列表、支付
//   2. 锁定并消费旧料（状态 → EXCHANGED），记录成本便于毛利分析
//   3. 计算：总抵扣 = Σ deductAmount；新品总价 = Σ salePrice；工费 = Σ laborFeeItem
//      应收 = 新品总价 + 工费 - 总抵扣（须 >= 0）
//   4. 校验支付（方向 IN，店方收钱）
//   5. 创建换新单 + 旧料明细 + 新品明细 + 支付 + 审计
import { Router, wrap, validatePayments } from '../utils/route.js'
import { prisma } from '../lib/prisma.js'
import { sumAmounts } from '../utils/calc.js'
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

  const list = await prisma.exchangeOrder.findMany({
    where,
    include: { party: true, oldItems: { include: { inventory: true } }, newItems: true, payments: true },
    orderBy: { createdAt: 'desc' },
    take: 200
  })
  res.json(list)
}))

// 详情
router.get('/:id', wrap(async (req, res) => {
  const id = parseInt(req.params.id)
  const order = await prisma.exchangeOrder.findUnique({
    where: { id },
    include: { party: true, oldItems: { include: { inventory: true } }, newItems: true, payments: true }
  })
  if (!order) return res.status(404).json({ error: '换新单不存在' })
  res.json(order)
}))

// 创建换新单
router.post('/', wrap(async (req, res) => {
  const {
    partyId,
    oldItems,   // [{ uniqueCode, deductAmount }]
    newItems,   // [{ productName, weight?, salePrice, laborFeeItem }]
    payments
  } = req.body

  // ===== 校验 =====
  if (!Array.isArray(oldItems) || oldItems.length === 0) {
    return res.status(400).json({ error: '旧料不能为空' })
  }
  if (!Array.isArray(newItems) || newItems.length === 0) {
    return res.status(400).json({ error: '新品不能为空' })
  }
  for (const o of oldItems) {
    if (!o.uniqueCode) return res.status(400).json({ error: '旧料缺少 uniqueCode' })
    if (!Number.isSafeInteger(o.deductAmount) || o.deductAmount < 0) {
      return res.status(400).json({ error: '抵扣金额必须为非负整数（分）' })
    }
  }
  for (const n of newItems) {
    if (!n.productName) return res.status(400).json({ error: '新品名称不能为空' })
    if (!Number.isSafeInteger(n.salePrice) || n.salePrice < 0) {
      return res.status(400).json({ error: '新品售价必须为非负整数（分）' })
    }
    if (!Number.isSafeInteger(n.laborFeeItem) || n.laborFeeItem < 0) {
      return res.status(400).json({ error: '工费必须为非负整数（分）' })
    }
  }

  // ===== 计算 =====
  const totalOldDeduct = sumAmounts(oldItems.map((o) => o.deductAmount))
  const totalNewPrice = sumAmounts(newItems.map((n) => n.salePrice))
  const laborFee = sumAmounts(newItems.map((n) => n.laborFeeItem))
  const receiveAmount = totalNewPrice + laborFee - totalOldDeduct

  if (receiveAmount < 0) {
    return res.status(400).json({
      error: `旧料抵扣（${totalOldDeduct}）超过新品总价+工费（${totalNewPrice + laborFee}），请调整抵扣金额或改用回收流程`
    })
  }

  // ===== 校验支付（方向 IN） =====
  validatePayments(payments, receiveAmount, 'IN')

  // ===== 事务执行 =====
  const result = await prisma.$transaction(async (tx) => {
    const orderNo = await generateOrderNo('exchange', tx)

    // 1. 锁定并消费旧料库存
    const codes = oldItems.map((o) => o.uniqueCode)
    const consumed = await lockAndConsume(tx, codes, 'EXCHANGED')

    // 建立 uniqueCode → inventory 映射（含成本）
    const invMap = new Map(consumed.map((i) => [i.uniqueCode, i]))

    // 2. 创建换新单
    const order = await tx.exchangeOrder.create({
      data: {
        orderNo,
        partyId: partyId || null,
        totalOldDeduct,
        totalNewPrice,
        laborFee,
        receiveAmount
      }
    })

    // 3. 旧料明细
    const oldItemData = oldItems.map((o) => {
      const inv = invMap.get(o.uniqueCode)
      return {
        exchangeId: order.id,
        inventoryItemId: inv.id,
        deductAmount: o.deductAmount,
        costAmount: inv.costAmount,
        costPureWeight: inv.costPureWeight
      }
    })
    await tx.exchangeOldItem.createMany({ data: oldItemData })

    // 4. 新品明细
    const newItemData = newItems.map((n) => ({
      exchangeId: order.id,
      productName: n.productName,
      weight: n.weight || null,
      salePrice: n.salePrice,
      laborFeeItem: n.laborFeeItem
    }))
    await tx.exchangeNewItem.createMany({ data: newItemData })

    // 5. 支付记录（方向 IN）
    const paymentData = payments.map((p) => ({
      orderType: 'EXCHANGE',
      orderId: order.id,
      exchangeOrderId: order.id,
      method: p.method,
      amount: p.amount,
      direction: 'IN'
    }))
    await tx.payment.createMany({ data: paymentData })

    // 6. 审计日志
    await writeAudit(tx, {
      entityType: 'ExchangeOrder',
      entityId: order.id,
      action: 'CREATE',
      newValue: { orderNo, totalOldDeduct, totalNewPrice, laborFee, receiveAmount, oldCount: oldItems.length, newCount: newItems.length },
      operator: 'ADMIN'
    })
    await writeAuditBatch(tx, consumed.map((inv) => ({
      entityType: 'InventoryItem',
      entityId: inv.id,
      action: 'EXCHANGED',
      oldValue: { status: 'IN_STOCK', uniqueCode: inv.uniqueCode },
      newValue: { status: 'EXCHANGED', exchangeOrderId: order.id },
      operator: 'ADMIN'
    })))

    return order
  })

  // 返回完整单据
  const full = await prisma.exchangeOrder.findUnique({
    where: { id: result.id },
    include: { party: true, oldItems: { include: { inventory: true } }, newItems: true, payments: true }
  })
  res.json(full)
}))

export default router
