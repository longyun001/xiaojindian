// ============ 报表路由 ============
import { Router, wrap } from '../utils/route.js'
import { prisma } from '../lib/prisma.js'

import { shopDay, shopRange } from '../utils/shopDate.js'
import { calcItemAmount } from '../utils/calc.js'

const router = Router()

function todayRange() { return shopRange(shopDay(), shopDay()) }

// 首页仪表盘：今日统计 + 库存估值 + 最近日志
router.get('/dashboard', wrap(async (req, res) => {
  const today = todayRange()

  // 今日三类交易
  const [todayRecycle, todaySell, todayExchange] = await Promise.all([
    prisma.recycleOrder.aggregate({
      _count: { _all: true },
      _sum: { totalAmount: true, totalPureWeight: true },
      where: { createdAt: today }
    }),
    prisma.sellOrder.aggregate({
      _count: { _all: true },
      _sum: { totalAmount: true, totalPureWeight: true },
      where: { createdAt: today }
    }),
    prisma.exchangeOrder.aggregate({
      _count: { _all: true },
      _sum: { receiveAmount: true, totalOldDeduct: true, laborFee: true },
      where: { createdAt: today }
    })
  ])

  // 今日支付流水
  const todayPayments = await prisma.payment.groupBy({
    by: ['direction', 'method'],
    _sum: { amount: true },
    where: { createdAt: today }
  })

  // 库存概览（按金属分类，用于差异化估值）
  const inStockItems = await prisma.inventoryItem.findMany({
    where: { status: 'IN_STOCK' },
    select: { pureWeight: true, costAmount: true, costPureWeight: true, location: true, metalType: true }
  })
  const totalPureWeight = inStockItems.reduce((s, i) => s + i.pureWeight, 0)
  const totalCost = inStockItems.reduce((s, i) => s + i.costAmount, 0)

  // 当前金价（用于估值）
  const currentPrice = await prisma.goldPrice.findFirst({ orderBy: { createdAt: 'desc' } })

  // 配置中的估值方式（仅影响黄金估值价取融通金还是国际金；银铂用各自的出售价估值）
  const valuationConfig = await prisma.systemConfig.findUnique({ where: { key: 'VALUATION_METHOD' } })
  const valuationMethod = valuationConfig?.value || 'rongtongjin'

  // 按金属分类估值：黄金用融通金/国际金价，白银用 silverSalePrice，铂金用 platinumSalePrice
  let inventoryValue = 0
  for (const it of inStockItems) {
    let priceFen = 0
    if (it.metalType === 'GOLD') {
      priceFen = currentPrice
        ? (valuationMethod === 'international'
            ? currentPrice.internationalPrice
            : currentPrice.rongtongjinPrice)
        : 0
    } else if (it.metalType === 'SILVER') {
      priceFen = currentPrice ? (currentPrice.silverSalePrice || 0) : 0
    } else if (it.metalType === 'PLATINUM') {
      priceFen = currentPrice ? (currentPrice.platinumSalePrice || 0) : 0
    }
    // 估值金额 = 纯金重(0.01g) × 估值价(分/克) / 100
    inventoryValue += calcItemAmount(it.pureWeight, priceFen)
  }
  // 估值用的黄金单价（前端展示用）
  const valuationPrice = currentPrice
    ? (valuationMethod === 'international'
        ? currentPrice.internationalPrice
        : currentPrice.rongtongjinPrice)
    : 0
  const potentialProfit = inventoryValue - totalCost

  // 按位置汇总
  const byLocation = {}
  for (const it of inStockItems) {
    if (!byLocation[it.location]) byLocation[it.location] = { count: 0, pureWeight: 0, cost: 0 }
    byLocation[it.location].count++
    byLocation[it.location].pureWeight += it.pureWeight
    byLocation[it.location].cost += it.costAmount
  }

  // 按金属汇总
  const byMetal = {}
  for (const it of inStockItems) {
    const m = it.metalType || 'GOLD'
    if (!byMetal[m]) byMetal[m] = { count: 0, pureWeight: 0, cost: 0 }
    byMetal[m].count++
    byMetal[m].pureWeight += it.pureWeight
    byMetal[m].cost += it.costAmount
  }

  // 最近操作日志
  const recentLogs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  res.json({
    today: {
      recycle: {
        count: todayRecycle._count._all,
        totalAmount: todayRecycle._sum.totalAmount || 0,
        totalPureWeight: todayRecycle._sum.totalPureWeight || 0
      },
      sell: {
        count: todaySell._count._all,
        totalAmount: todaySell._sum.totalAmount || 0,
        totalPureWeight: todaySell._sum.totalPureWeight || 0
      },
      exchange: {
        count: todayExchange._count._all,
        receiveAmount: todayExchange._sum.receiveAmount || 0,
        oldDeduct: todayExchange._sum.totalOldDeduct || 0,
        laborFee: todayExchange._sum.laborFee || 0
      },
      payments: todayPayments
    },
    inventory: {
      totalInStock: inStockItems.length,
      totalPureWeight,
      totalCost,
      valuationPrice,
      valuationMethod,
      inventoryValue,
      potentialProfit,
      byLocation,
      byMetal
    },
    currentPrice,
    recentLogs
  })
}))

// 利润报表
router.get('/profit', wrap(async (req, res) => {
  const { startDate, endDate } = req.query
  const range = shopRange(startDate, endDate)

  // 出售利润：sum(amount - costAmount)
  const sellItems = await prisma.sellOrderItem.findMany({
    where: { sellOrder: { createdAt: range.gte || range.lte ? { ...range } : undefined } },
    include: { sellOrder: { select: { orderNo: true, createdAt: true, partyId: true } } }
  })
  const sellRevenue = sellItems.reduce((s, i) => s + i.amount, 0)
  const sellCost = sellItems.reduce((s, i) => s + i.costAmount, 0)
  const sellProfit = sellRevenue - sellCost

  // 换新利润：旧料抵扣产生的毛利 = Σ(deductAmount - costAmount)
  const exchangeOldItems = await prisma.exchangeOldItem.findMany({
    where: { exchange: { createdAt: range.gte || range.lte ? { ...range } : undefined } }
  })
  const exchangeDeductTotal = exchangeOldItems.reduce((s, i) => s + i.deductAmount, 0)
  const exchangeCostTotal = exchangeOldItems.reduce((s, i) => s + i.costAmount, 0)
  const exchangeGrossProfit = exchangeDeductTotal - exchangeCostTotal
  // 换新工费收入
  const exchangeOrders = await prisma.exchangeOrder.findMany({
    where: range.gte || range.lte ? { createdAt: range } : {},
    select: { laborFee: true, receiveAmount: true }
  })
  const laborFeeIncome = exchangeOrders.reduce((s, o) => s + o.laborFee, 0)

  // 回收总额（成本支出）
  const recycleOrders = await prisma.recycleOrder.findMany({
    where: range.gte || range.lte ? { createdAt: range } : {},
    select: { totalAmount: true, totalPureWeight: true }
  })
  const recycleTotal = recycleOrders.reduce((s, o) => s + o.totalAmount, 0)
  const recyclePureWeight = recycleOrders.reduce((s, o) => s + o.totalPureWeight, 0)

  // 按日汇总
  const dailyMap = {}
  for (const si of sellItems) {
    const day = shopDay(si.sellOrder.createdAt)
    if (!dailyMap[day]) dailyMap[day] = { date: day, sellRevenue: 0, sellCost: 0, exchangeProfit: 0, laborFee: 0 }
    dailyMap[day].sellRevenue += si.amount
    dailyMap[day].sellCost += si.costAmount
  }
  // 简化：换新利润按日归集（用换新单日期）
  const exchangeOrdersFull = await prisma.exchangeOrder.findMany({
    where: range.gte || range.lte ? { createdAt: range } : {},
    include: { oldItems: true }
  })
  for (const eo of exchangeOrdersFull) {
    const day = shopDay(eo.createdAt)
    if (!dailyMap[day]) dailyMap[day] = { date: day, sellRevenue: 0, sellCost: 0, exchangeProfit: 0, laborFee: 0 }
    const dayDeduct = eo.oldItems.reduce((s, i) => s + i.deductAmount, 0)
    const dayCost = eo.oldItems.reduce((s, i) => s + i.costAmount, 0)
    dailyMap[day].exchangeProfit += (dayDeduct - dayCost)
    dailyMap[day].laborFee += eo.laborFee
  }
  const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))

  res.json({
    summary: {
      sellRevenue,
      sellCost,
      sellProfit,
      sellCount: sellItems.length,
      exchangeDeductTotal,
      exchangeCostTotal,
      exchangeGrossProfit,
      laborFeeIncome,
      exchangeCount: exchangeOrders.length,
      recycleTotal,
      recyclePureWeight,
      recycleCount: recycleOrders.length,
      // 综合毛利 = 出售利润 + 换新毛利 + 工费收入
      totalProfit: sellProfit + exchangeGrossProfit + laborFeeIncome
    },
    daily
  })
}))

export default router
