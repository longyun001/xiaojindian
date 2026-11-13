// ============ 系统配置路由 ============
import { Router, wrap } from '../utils/route.js'
import { prisma } from '../lib/prisma.js'
import { writeAudit } from '../services/audit.js'

const router = Router()

// 获取全部配置（返回 key-value 对象）
router.get('/', wrap(async (req, res) => {
  const rows = await prisma.systemConfig.findMany()
  const config = {}
  for (const r of rows) config[r.key] = r.value
  res.json(config)
}))

// 批量更新配置
router.put('/', wrap(async (req, res) => {
  const updates = req.body
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: '请求体需为 key-value 对象' })
  }

  const oldConfig = {}
  const rows = await prisma.systemConfig.findMany()
  for (const r of rows) oldConfig[r.key] = r.value

  await prisma.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(updates)) {
      await tx.systemConfig.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      })
    }
    await writeAudit(tx, {
      entityType: 'SystemConfig',
      entityId: 0,
      action: 'UPDATE',
      oldValue: oldConfig,
      newValue: updates,
      operator: 'ADMIN'
    })
  })

  const refreshed = await prisma.systemConfig.findMany()
  const config = {}
  for (const r of refreshed) config[r.key] = r.value
  res.json(config)
}))

export default router
