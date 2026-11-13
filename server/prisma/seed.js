// 初始化通用配置，不创建客户、行情、库存、单据或照片。
import { prisma } from '../src/lib/prisma.js'

async function main() {
  const defaults = {
    SHOP_NAME: '小金店', SHOP_PHONE: '', DEFAULT_LOCATION: '柜台A', PRINT_COPIES: '1',
    AUTO_SYNC_PRICE: 'false', VALUATION_METHOD: 'rongtongjin', RECYCLE_DISCOUNT: '0', SELL_PREMIUM: '0'
  }
  await prisma.$transaction(Object.entries(defaults).map(([key, value]) => prisma.systemConfig.upsert({
    where: { key }, update: {}, create: { key, value }
  })))
  console.log('默认配置已初始化；请在设置中录入店铺资料和金、银、铂价格。')
}

main().catch(error => { console.error(error.message); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect() })
