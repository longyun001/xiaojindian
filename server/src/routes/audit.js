// ============ 审计日志路由 ============
import { Router, wrap } from '../utils/route.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

// 日志列表（分页 + 筛选）
router.get('/', wrap(async (req, res) => {
  const { entityType, action, startDate, endDate, page = 1, pageSize = 50 } = req.query
  const where = {}
  if (entityType) where.entityType = entityType
  if (action) where.action = action
  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = new Date(startDate)
    if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59')
  }

  const skip = (parseInt(page) - 1) * parseInt(pageSize)
  const [list, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(pageSize)
    }),
    prisma.auditLog.count({ where })
  ])

  // 反序列化 JSON 字段
  const parsed = list.map((l) => ({
    ...l,
    oldValue: l.oldValue ? safeParse(l.oldValue) : null,
    newValue: l.newValue ? safeParse(l.newValue) : null
  }))

  res.json({
    list: parsed,
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
    totalPages: Math.ceil(total / parseInt(pageSize))
  })
}))

function safeParse(str) {
  try { return JSON.parse(str) } catch { return str }
}

export default router
