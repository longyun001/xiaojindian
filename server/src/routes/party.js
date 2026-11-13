// ============ 交易方路由 ============
import { Router, wrap } from '../utils/route.js'
import { prisma } from '../lib/prisma.js'
import { writeAudit } from '../services/audit.js'

const router = Router()

// 列表（支持按类型、关键字筛选）
router.get('/', wrap(async (req, res) => {
  const { type, keyword } = req.query
  const where = {}
  if (type) where.type = type
  if (keyword) {
    where.OR = [
      { name: { contains: keyword } },
      { phone: { contains: keyword } },
      { company: { contains: keyword } }
    ]
  }
  const list = await prisma.party.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  })
  res.json(list)
}))

// 详情
router.get('/:id', wrap(async (req, res) => {
  const id = parseInt(req.params.id)
  const party = await prisma.party.findUnique({ where: { id } })
  if (!party) return res.status(404).json({ error: '交易方不存在' })
  res.json(party)
}))

// 新建
router.post('/', wrap(async (req, res) => {
  const { type, name, phone, company, remark } = req.body
  if (!type || !['CUSTOMER', 'BUYER', 'SUPPLIER', 'OTHER'].includes(type)) {
    return res.status(400).json({ error: 'type 必须为 CUSTOMER|BUYER|SUPPLIER|OTHER' })
  }
  const party = await prisma.party.create({
    data: { type, name, phone, company, remark }
  })
  await writeAudit(prisma, {
    entityType: 'Party',
    entityId: party.id,
    action: 'CREATE',
    newValue: party,
    operator: 'ADMIN'
  })
  res.json(party)
}))

// 更新
router.put('/:id', wrap(async (req, res) => {
  const id = parseInt(req.params.id)
  const old = await prisma.party.findUnique({ where: { id } })
  if (!old) return res.status(404).json({ error: '交易方不存在' })

  const { type, name, phone, company, remark } = req.body
  const party = await prisma.party.update({
    where: { id },
    data: { type, name, phone, company, remark }
  })
  await writeAudit(prisma, {
    entityType: 'Party',
    entityId: id,
    action: 'UPDATE',
    oldValue: old,
    newValue: party,
    operator: 'ADMIN'
  })
  res.json(party)
}))

// 删除（软校验：有交易关联则拒绝）
router.delete('/:id', wrap(async (req, res) => {
  const id = parseInt(req.params.id)
  const [recycleCount, exchangeCount, sellCount] = await Promise.all([
    prisma.recycleOrder.count({ where: { partyId: id } }),
    prisma.exchangeOrder.count({ where: { partyId: id } }),
    prisma.sellOrder.count({ where: { partyId: id } })
  ])
  if (recycleCount + exchangeCount + sellCount > 0) {
    return res.status(400).json({ error: '该交易方有交易记录，无法删除' })
  }
  const old = await prisma.party.findUnique({ where: { id } })
  await prisma.party.delete({ where: { id } })
  await writeAudit(prisma, {
    entityType: 'Party',
    entityId: id,
    action: 'DELETE',
    oldValue: old,
    operator: 'ADMIN'
  })
  res.json({ success: true })
}))

export default router
