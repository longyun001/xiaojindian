// ============ 库存路由 ============
import { Router, wrap } from '../utils/route.js'
import { prisma } from '../lib/prisma.js'
import { writeAudit } from '../services/audit.js'

const router = Router()

// 库存列表（支持状态、金属、位置、关键字筛选）
router.get('/', wrap(async (req, res) => {
  const { status, metalType, location, keyword, sourceType } = req.query
  const where = {}
  if (status) where.status = status
  if (metalType) where.metalType = metalType
  if (location) where.location = location
  if (sourceType) where.sourceType = sourceType
  if (keyword) {
    where.OR = [
      { uniqueCode: { contains: keyword } },
      { itemName: { contains: keyword } },
      { remark: { contains: keyword } }
    ]
  }
  const list = await prisma.inventoryItem.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 500
  })
  res.json(list)
}))

// 库存详情
router.get('/:code', wrap(async (req, res) => {
  const item = await prisma.inventoryItem.findUnique({
    where: { uniqueCode: req.params.code }
  })
  if (!item) return res.status(404).json({ error: '库存不存在' })
  res.json(item)
}))

// 修改位置
router.put('/:code/location', wrap(async (req, res) => {
  const { location } = req.body
  if (!location) return res.status(400).json({ error: '位置不能为空' })
  const old = await prisma.inventoryItem.findUnique({ where: { uniqueCode: req.params.code } })
  if (!old) return res.status(404).json({ error: '库存不存在' })

  const updated = await prisma.inventoryItem.update({
    where: { uniqueCode: req.params.code },
    data: { location }
  })
  await writeAudit(prisma, {
    entityType: 'InventoryItem',
    entityId: updated.id,
    action: 'UPDATE_LOCATION',
    oldValue: { location: old.location },
    newValue: { location },
    operator: 'ADMIN'
  })
  res.json(updated)
}))

// 修改备注
router.put('/:code/remark', wrap(async (req, res) => {
  const { remark } = req.body
  const old = await prisma.inventoryItem.findUnique({ where: { uniqueCode: req.params.code } })
  if (!old) return res.status(404).json({ error: '库存不存在' })

  const updated = await prisma.inventoryItem.update({
    where: { uniqueCode: req.params.code },
    data: { remark: remark || null }
  })
  await writeAudit(prisma, {
    entityType: 'InventoryItem',
    entityId: updated.id,
    action: 'UPDATE_REMARK',
    oldValue: { remark: old.remark },
    newValue: { remark },
    operator: 'ADMIN'
  })
  res.json(updated)
}))

// 库存统计概览
router.get('/stats/overview', wrap(async (req, res) => {
  const inStock = await prisma.inventoryItem.findMany({
    where: { status: 'IN_STOCK' },
    select: { pureWeight: true, costAmount: true, costPureWeight: true, location: true, metalType: true }
  })
  const byLocation = {}
  const byMetal = {}
  for (const it of inStock) {
    // 按位置汇总
    if (!byLocation[it.location]) {
      byLocation[it.location] = { count: 0, pureWeight: 0, costAmount: 0 }
    }
    byLocation[it.location].count++
    byLocation[it.location].pureWeight += it.pureWeight
    byLocation[it.location].costAmount += it.costAmount
    // 按金属汇总
    const mt = it.metalType || 'GOLD'
    if (!byMetal[mt]) {
      byMetal[mt] = { count: 0, pureWeight: 0, costAmount: 0 }
    }
    byMetal[mt].count++
    byMetal[mt].pureWeight += it.pureWeight
    byMetal[mt].costAmount += it.costAmount
  }
  res.json({
    totalInStock: inStock.length,
    totalPureWeight: inStock.reduce((s, i) => s + i.pureWeight, 0),
    totalCost: inStock.reduce((s, i) => s + i.costAmount, 0),
    byLocation,
    byMetal
  })
}))

export default router
