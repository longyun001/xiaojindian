// ============ 金价路由 ============
import { Router, wrap } from '../utils/route.js'
import { prisma } from '../lib/prisma.js'
import { manualUpdatePrice } from '../services/goldPriceSync.js'

const router = Router()

// 获取最新金价
router.get('/current', wrap(async (req, res) => {
  const price = await prisma.goldPrice.findFirst({
    orderBy: { createdAt: 'desc' }
  })
  res.json(price)
}))

// 获取金价历史
router.get('/history', wrap(async (req, res) => {
  const limit = parseInt(req.query.limit) || 30
  const list = await prisma.goldPrice.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit
  })
  res.json(list)
}))

// 手动更新金价
router.put('/', wrap(async (req, res) => {
  const {
    internationalPrice, rongtongjinPrice, recyclePrice, salePrice,
    silverRecyclePrice, silverSalePrice, silverMarketPrice,
    platinumRecyclePrice, platinumSalePrice, platinumMarketPrice
  } = req.body

  // 黄金四项必填（核心金属）
  const goldFields = { internationalPrice, rongtongjinPrice, recyclePrice, salePrice }
  for (const [k, v] of Object.entries(goldFields)) {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
      return res.status(400).json({ error: `${k} 必须为非负整数（分/克）` })
    }
  }
  // 银铂可选：未提供时记为 0（表示门店不收该金属）
  const optionalFields = {
    silverRecyclePrice, silverSalePrice, silverMarketPrice,
    platinumRecyclePrice, platinumSalePrice, platinumMarketPrice
  }
  for (const [k, v] of Object.entries(optionalFields)) {
    if (v !== undefined && v !== null && (typeof v !== 'number' || !Number.isInteger(v) || v < 0)) {
      return res.status(400).json({ error: `${k} 必须为非负整数（分/克）` })
    }
  }

  const price = await manualUpdatePrice({
    internationalPrice, rongtongjinPrice, recyclePrice, salePrice,
    silverRecyclePrice: silverRecyclePrice || 0,
    silverSalePrice: silverSalePrice || 0,
    silverMarketPrice: silverMarketPrice || 0,
    platinumRecyclePrice: platinumRecyclePrice || 0,
    platinumSalePrice: platinumSalePrice || 0,
    platinumMarketPrice: platinumMarketPrice || 0
  })
  res.json(price)
}))

export default router
