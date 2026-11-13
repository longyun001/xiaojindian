// ============ 金价同步服务 ============
// 通过 node-cron 每小时抓取金价并写入 GoldPrice 表
// 实际生产中接入真实金价 API；此处提供框架，未配置 API 时跳过
import { prisma } from '../lib/prisma.js'
import { writeAudit } from './audit.js'

/**
 * 同步金价：从外部 API 抓取并写入数据库
 * 若未配置 GOLD_PRICE_API_URL，则跳过
 */
export async function syncGoldPrice() {
  const apiUrl = process.env.GOLD_PRICE_API_URL
  if (!apiUrl) {
    console.log('[金价同步] 未配置 GOLD_PRICE_API_URL，跳过')
    return null
  }

  try {
    const resp = await fetch(apiUrl)
    if (!resp.ok) throw new Error(`API 返回 ${resp.status}`)
    const data = await resp.json()

    const price = await prisma.$transaction(async tx => {
      const previous = await tx.goldPrice.findFirst({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })
      const fields = ['internationalPrice', 'rongtongjinPrice', 'recyclePrice', 'salePrice',
        'silverRecyclePrice', 'silverSalePrice', 'silverMarketPrice',
        'platinumRecyclePrice', 'platinumSalePrice', 'platinumMarketPrice']
      const values = {}
      for (const [index, key] of fields.entries()) {
        const value = data[key] === undefined && index >= 4 ? (previous?.[key] ?? 0) : data[key]
        if (!Number.isSafeInteger(value) || value < 0) {
          throw new Error(key + ' 必须为非负整数（分/克）')
        }
        values[key] = value
      }
      const saved = await tx.goldPrice.create({ data: values })
      await writeAudit(tx, { entityType: 'GoldPrice', entityId: saved.id,
        action: 'PRICE_SYNC', newValue: saved, operator: 'CRON' })
      return saved
    })
    console.log(`[金价同步] 成功 ${new Date().toISOString()}`)
    return price
  } catch (err) {
    console.error('[金价同步] 失败:', err.message)
    throw err
  }
}

/**
 * 手动更新金价（设置页面调用）
 * 含金、银、铂三类金属的市场价
 * 银铂的 marketPrice 对应融通金网页上的白银行情价/铂金行情价
 */
export async function manualUpdatePrice({
  internationalPrice, rongtongjinPrice, recyclePrice, salePrice,
  silverRecyclePrice = 0, silverSalePrice = 0, silverMarketPrice = 0,
  platinumRecyclePrice = 0, platinumSalePrice = 0, platinumMarketPrice = 0
}) {
  const price = await prisma.goldPrice.create({
    data: {
      internationalPrice,
      rongtongjinPrice,
      recyclePrice,
      salePrice,
      silverRecyclePrice,
      silverSalePrice,
      silverMarketPrice,
      platinumRecyclePrice,
      platinumSalePrice,
      platinumMarketPrice
    }
  })
  await writeAudit(prisma, {
    entityType: 'GoldPrice',
    entityId: price.id,
    action: 'PRICE_UPDATE',
    newValue: price,
    operator: 'ADMIN'
  })
  return price
}
