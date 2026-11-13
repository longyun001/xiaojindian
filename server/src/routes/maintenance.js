import { Router, wrap } from '../utils/route.js'
import { prisma } from '../lib/prisma.js'
import { scanPhotoFiles } from '../services/dataFiles.js'

const router = Router()
router.get('/integrity', wrap(async (req, res) => {
  const [database, foreignKeys, photos, inventory, recycleOrders, sellOrders, payments] = await prisma.$transaction([
    prisma.$queryRawUnsafe('PRAGMA quick_check'),
    prisma.$queryRawUnsafe('PRAGMA foreign_key_check'),
    prisma.inventoryPhoto.findMany({ include: { inventory: { select: { uniqueCode: true } } }, orderBy: { id: 'asc' } }),
    prisma.inventoryItem.count(), prisma.recycleOrder.count(), prisma.sellOrder.count(), prisma.payment.count()
  ])
  const images = await scanPhotoFiles(photos)
  const databaseOk = database.length === 1 && Object.values(database[0])[0] === 'ok'
  res.set('Cache-Control', 'no-store').json({
    checkedAt: new Date().toISOString(),
    database: { ok: databaseOk && foreignKeys.length === 0, foreignKeyErrors: foreignKeys.length },
    counts: { inventory, recycleOrders, sellOrders, payments }, images,
    ok: databaseOk && foreignKeys.length === 0 && images.problemFiles === 0
  })
}))
export default router
