// ============ 小金店旧料管理系统 - 后端入口 ============
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import cron from 'node-cron'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { prisma } from './lib/prisma.js'
import { syncGoldPrice } from './services/goldPriceSync.js'
import { SERVER_ROOT, UPLOADS_ROOT } from './services/dataPaths.js'
import { acquireDataLock } from './services/dataLock.js'
import maintenanceRoutes from './routes/maintenance.js'

import configRoutes from './routes/config.js'
import goldPriceRoutes from './routes/goldPrice.js'
import partyRoutes from './routes/party.js'
import recycleRoutes from './routes/recycle.js'
import inventoryRoutes from './routes/inventory.js'
import exchangeRoutes from './routes/exchange.js'
import sellRoutes from './routes/sell.js'
import stocktakingRoutes from './routes/stocktaking.js'
import reportRoutes from './routes/report.js'
import auditRoutes from './routes/audit.js'
import printRoutes from './routes/print.js'
import photoRoutes from './routes/photo.js'

const app = express()
const PORT = process.env.PORT || 3000

// 中间件
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(morgan('dev'))

// 静态资源：照片文件托管
app.use('/uploads', express.static(UPLOADS_ROOT, {
  maxAge: '7d',
  immutable: true
}))

// 路由挂载
app.use('/api/config', configRoutes)
app.use('/api/gold-price', goldPriceRoutes)
app.use('/api/parties', partyRoutes)
app.use('/api/recycle', recycleRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/exchange', exchangeRoutes)
app.use('/api/sell', sellRoutes)
app.use('/api/stocktaking', stocktakingRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/audit-logs', auditRoutes)
app.use('/api/print', printRoutes)
app.use('/api/photos', photoRoutes)
app.use('/api/maintenance', maintenanceRoutes)

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('[ERROR]', err)
  const status = err.status || 500
  const message = err.message || '服务器内部错误'
  // Prisma 已知错误码映射
  if (err.code === 'P2025') {
    return res.status(404).json({ error: '记录不存在或状态已变更（可能被其他操作占用）' })
  }
  if (err.code === 'P2002') {
    return res.status(409).json({ error: '编号重复，请重试' })
  }
  res.status(status).json({ error: message, code: err.code })
})

// 启动
async function bootstrap() {
  if (existsSync(resolve(SERVER_ROOT, '.restore-in-progress.json'))) {
    throw new Error('上次数据恢复未结束，请先运行 data-maintenance.bat 完成“恢复中断回滚”')
  }
  const release = acquireDataLock('server')
  process.once('exit', release)
  if (process.env.DATABASE_URL?.startsWith('file:') && !existsSync(resolve(SERVER_ROOT, 'prisma', process.env.DATABASE_URL.slice(5)))) {
    throw new Error('数据库文件不存在，请先从备份恢复；新店初始化请参照数据维护说明')
  }
  // 测试数据库连接
  try {
    await prisma.$connect()
    console.log('✓ 数据库连接成功')
  } catch (e) {
    console.error('✗ 数据库连接失败:', e.message)
    console.error('  请检查 DATABASE_URL 配置，并执行 npm run prisma:migrate')
    process.exit(1)
  }

  // 金价定时同步（每小时）
  if (process.env.AUTO_SYNC_PRICE === 'true') {
    cron.schedule('0 * * * *', () => syncGoldPrice().catch(console.error))
    console.log('✓ 金价自动同步已启用（每小时）')
  }

  const server = app.listen(PORT, () => {
    console.log(`\n========================================`)
    console.log(`  小金店旧料管理系统 V1.0`)
    console.log(`  后端服务: http://localhost:${PORT}`)
    console.log(`  前端地址: http://localhost:5173`)
    console.log(`========================================\n`)
  })
  server.once('error', error => { console.error(error.message); process.exit(1) })
  let stopping = false
  const shutdown = () => {
    if (stopping) return
    stopping = true
    server.close(async () => { await prisma.$disconnect(); process.exit(0) })
    setTimeout(() => process.exit(1), 5000).unref()
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
  if (process.platform === 'win32') process.once('SIGBREAK', shutdown)
}

bootstrap().catch(error => { console.error('启动失败：' + error.message); process.exit(1) })

export default app
