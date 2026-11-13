// ============ 回收路由 ============
// 业务流程：
//   1. 接收订单数据（交易方、回收单价、融通金价、明细、支付）
//   2. 后端用精度函数重算每项纯金重和金额（不信任前端）
//   3. 创建回收单 + 明细
//   4. 为每件旧料创建库存项（一件一码，状态 IN_STOCK）
//   5. 创建支付记录（方向 OUT，店方支出给客户）
//   6. 写入审计日志
import { Router, wrap, validatePayments } from '../utils/route.js'
import { prisma } from '../lib/prisma.js'
import { calcPureWeight, calcItemAmount, sumWeights, sumAmounts } from '../utils/calc.js'
import { generateOrderNo, generateInventoryCodes } from '../utils/code.js'
import { writeAudit, writeAuditBatch } from '../services/audit.js'

import { attachPhotos } from '../services/photoAttachment.js'

const router = Router()

// 列表查询
router.get('/', wrap(async (req, res) => {
  const { startDate, endDate, partyId, keyword } = req.query
  const where = {}
  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = new Date(startDate)
    if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59')
  }
  if (partyId) where.partyId = parseInt(partyId)
  if (keyword) where.orderNo = { contains: keyword }

  const list = await prisma.recycleOrder.findMany({
    where,
    include: {
      party: true,
      items: true,
      payments: true
    },
    orderBy: { createdAt: 'desc' },
    take: 200
  })
  res.json(list)
}))

// 详情
router.get('/:id', wrap(async (req, res) => {
  const id = parseInt(req.params.id)
  const order = await prisma.recycleOrder.findUnique({
    where: { id },
    include: { party: true, items: true, payments: true }
  })
  if (!order) return res.status(404).json({ error: '回收单不存在' })
  res.json(order)
}))

// 创建回收单
// 支持金/银/铂三类金属混收：每项 item 携带 metalType 与对应的 unitPrice
// 订单级别的 recyclePrice/rongtongjinPrice/internationalPrice 仅指黄金；
// 白银、铂金的回收单价从 item.unitPrice 传入（前端从金价 store 取对应金属的回收价）
router.post('/', wrap(async (req, res) => {
  const {
    partyId, recyclePrice, rongtongjinPrice, internationalPrice,
    silverMarketPrice, platinumMarketPrice,
    items, payments, location
  } = req.body

  // ===== 校验入参 =====
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: '回收明细不能为空' })
  }
  // recyclePrice 为黄金回收价（订单级别快照），可为 0 表示本单无黄金
  if (!Number.isSafeInteger(recyclePrice) || recyclePrice < 0) {
    return res.status(400).json({ error: '黄金回收价必须为非负整数（分/克）' })
  }
  if (rongtongjinPrice !== undefined && rongtongjinPrice !== null && !Number.isSafeInteger(rongtongjinPrice)) {
    return res.status(400).json({ error: '融通金价必须为整数（分/克）' })
  }
  if (internationalPrice !== undefined && internationalPrice !== null && !Number.isSafeInteger(internationalPrice)) {
    return res.status(400).json({ error: '国际金价必须为整数（分/克）' })
  }
  // 银铂市场行情价（融通金网页价），可选，用于银铂项的时点快照
  if (silverMarketPrice !== undefined && silverMarketPrice !== null && !Number.isSafeInteger(silverMarketPrice)) {
    return res.status(400).json({ error: '白银市场价必须为整数（分/克）' })
  }
  if (platinumMarketPrice !== undefined && platinumMarketPrice !== null && !Number.isSafeInteger(platinumMarketPrice)) {
    return res.status(400).json({ error: '铂金市场价必须为整数（分/克）' })
  }

  const tempCodes = items.map(i => i.photoTempCode).filter(Boolean)
  if (new Set(tempCodes).size !== tempCodes.length) return res.status(400).json({ error: '不同旧料不能共用临时照片编号' })
  for (const it of items) {
    if (it.photoTempCode && (!/^TEMP[A-Za-z0-9_-]+$/.test(it.photoTempCode) ||
        !Number.isInteger(it.photoCount) || it.photoCount < 0 || it.photoCount > 5)) {
      return res.status(400).json({ error: '临时照片编号或照片数量无效' })
    }
  }
  const VALID_METALS = ['GOLD', 'SILVER', 'PLATINUM']
  for (const it of items) {
    if (!Number.isSafeInteger(it.grossWeight) || it.grossWeight <= 0) {
      return res.status(400).json({ error: '毛重必须为正整数（0.01g）' })
    }
    // 纯度万分比：1-10000
    if (!Number.isSafeInteger(it.purity) || it.purity <= 0 || it.purity > 10000) {
      return res.status(400).json({ error: '纯度必须为 1-10000 的整数（万分比，如 9999=99.99%）' })
    }
    if (!it.itemName) {
      return res.status(400).json({ error: '物品名称不能为空' })
    }
    const metal = it.metalType || 'GOLD'
    if (!VALID_METALS.includes(metal)) {
      return res.status(400).json({ error: `金属种类必须为 ${VALID_METALS.join('/')}，收到 ${metal}` })
    }
    // 每项必须携带对应金属的回收单价（分/克）
    if (!Number.isSafeInteger(it.unitPrice) || it.unitPrice < 0) {
      return res.status(400).json({ error: `物品「${it.itemName}」缺少有效的回收单价（分/克）` })
    }
  }

  // ===== 后端重算（精度保证） =====
  // 每项按各自金属的 unitPrice 计算；纯金重统一用万分比公式
  const computedItems = items.map((it) => {
    const metalType = it.metalType || 'GOLD'
    const pureWeight = calcPureWeight(it.grossWeight, it.purity)
    const unitPrice = it.unitPrice // 分/克
    const amount = calcItemAmount(pureWeight, unitPrice)
    return {
      itemName: it.itemName,
      metalType,
      grossWeight: it.grossWeight,
      purity: it.purity,
      pureWeight,
      unitPrice,
      amount
    }
  })

  const totalPureWeight = sumWeights(computedItems.map((i) => i.pureWeight))
  const totalAmount = sumAmounts(computedItems.map((i) => i.amount))

  // ===== 校验支付 =====
  // 回收：店方付钱给客户 → 方向 OUT
  validatePayments(payments, totalAmount, 'OUT')

  // ===== 事务执行 =====
  const result = await prisma.$transaction(async (tx) => {
    const orderNo = await generateOrderNo('recycle', tx)

    // 1. 创建回收单
    const order = await tx.recycleOrder.create({
      data: {
        orderNo,
        partyId: partyId || null,
        totalPureWeight,
        totalAmount,
        recyclePrice,
        rongtongjinPrice: rongtongjinPrice || 0,
        items: { create: computedItems }
      },
      include: { items: { orderBy: { id: 'asc' } } }
    })

    // 2. 为每件旧料生成库存（一件一码）
    //    同时写入收旧时点的金价快照，便于终身追溯与按收旧时点估值
    //    金价快照：黄金项记 recyclePriceAtReceive + rongtongjin + international
    //             白银项记 recyclePriceAtReceive + silverMarketPriceAtReceive
    //             铂金项记 recyclePriceAtReceive + platinumMarketPriceAtReceive
    const codes = await generateInventoryCodes(computedItems.length, tx)
    const inventoryData = order.items.map((item, idx) => {
      const metal = item.metalType
      return {
        uniqueCode: codes[idx],
        sourceType: 'RECYCLE',
        sourceId: item.id,
        itemName: item.itemName,
        metalType: metal,
        grossWeight: item.grossWeight,
        purity: item.purity,
        pureWeight: item.pureWeight,
        costAmount: item.amount,        // 成本 = 回收金额
        costPureWeight: item.pureWeight, // 成本对应纯金重
        recyclePriceAtReceive: item.unitPrice, // 该件金属的回收单价快照
        // 黄金项记录黄金融通金/国际金价
        rongtongjinPriceAtReceive: metal === 'GOLD' ? (rongtongjinPrice || null) : null,
        internationalPriceAtReceive: metal === 'GOLD' ? (internationalPrice || null) : null,
        // 白银项记录白银市场行情价（融通金网页白银价）
        silverMarketPriceAtReceive: metal === 'SILVER' ? (silverMarketPrice || null) : null,
        // 铂金项记录铂金市场行情价（融通金网页铂金价）
        platinumMarketPriceAtReceive: metal === 'PLATINUM' ? (platinumMarketPrice || null) : null,
        location: location || '柜台A',
        status: 'IN_STOCK'
      }
    })
    await tx.inventoryItem.createMany({
      data: inventoryData
    })

    const savedInventory = await tx.inventoryItem.findMany({ where: { uniqueCode: { in: codes } } })
    const inventoryByCode = new Map(savedInventory.map(i => [i.uniqueCode, i]))
    for (let idx = 0; idx < items.length; idx++) {
      if (!items[idx].photoTempCode) continue
      const inventory = await tx.inventoryItem.findUnique({ where: { uniqueCode: codes[idx] } })
      await attachPhotos(tx, items[idx].photoTempCode, inventory.id, items[idx].photoCount)
    }

    // 3. 创建支付记录（方向 OUT）
    const paymentData = payments.map((p) => ({
      orderType: 'RECYCLE',
      orderId: order.id,
      recycleOrderId: order.id,
      method: p.method,
      amount: p.amount,
      direction: 'OUT'
    }))
    await tx.payment.createMany({ data: paymentData })

    // 4. 审计日志
    const auditLogs = [
      {
        entityType: 'RecycleOrder',
        entityId: order.id,
        action: 'CREATE',
        newValue: { orderNo, totalPureWeight, totalAmount, recyclePrice, itemCount: computedItems.length },
        operator: 'ADMIN'
      },
      ...order.items.map((item, idx) => ({
        entityType: 'InventoryItem',
        entityId: inventoryByCode.get(codes[idx]).id,
        action: 'CREATE_FROM_RECYCLE',
        newValue: { code: codes[idx], sourceOrderId: order.id, pureWeight: item.pureWeight, cost: item.amount },
        operator: 'ADMIN'
      }))
    ]
    await writeAuditBatch(tx, auditLogs)

    return { order, codes, totalPureWeight, totalAmount }
  })

  // 查询刚创建的库存项返回给前端（含 id）
  const createdInventory = await prisma.inventoryItem.findMany({
    where: { uniqueCode: { in: result.codes } },
    orderBy: { uniqueCode: 'asc' }
  })

  res.json({
    order: result.order,
    inventoryItems: createdInventory,
    summary: {
      totalPureWeight: result.totalPureWeight,
      totalAmount: result.totalAmount,
      itemCount: createdInventory.length
    }
  })
}))

export default router
