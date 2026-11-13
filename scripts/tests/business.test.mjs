import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { fixture, ROOT } from './fixture.mjs'

test('隔离业务验收：回收、照片、盘点、出售、换新和报表', async t => {
  const f = fixture()
  const require = createRequire(resolve(ROOT, 'server/package.json'))
  const { PrismaClient } = require('@prisma/client')
  process.env.DATABASE_URL = 'file:' + f.dbPath.replaceAll('\\', '/')
  const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
  globalThis.__prisma = db
  const load = path => import(pathToFileURL(resolve(f.server, path)))
  const express = require('express')
  const app = express()
  app.use(express.json())
  for (const [route, file] of [['recycle','recycle'], ['sell','sell'], ['exchange','exchange'], ['photos','photo'], ['reports','report'], ['stocktaking','stocktaking'], ['maintenance','maintenance']]) app.use('/' + route, (await load('src/routes/' + file + '.js')).default)
  app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const url = 'http://127.0.0.1:' + server.address().port
  async function api(path, method = 'GET', body) {
    const response = await fetch(url + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    return { status: response.status, body: await response.json() }
  }
  const item = (metal, price, code, count = 1) => ({ itemName: metal, metalType: metal, grossWeight: 100, purity: 10000, unitPrice: price, photoTempCode: code, photoCount: count })
  const payload = (items, amount) => ({ recyclePrice: 83000, rongtongjinPrice: 84500, internationalPrice: 85000, silverMarketPrice: 1324, platinumMarketPrice: 34930, items, payments: [{ method: 'cash', amount, direction: 'OUT' }] })
  let photos, inventory
  try {
    await t.test('负数和非整数付款被拒绝，北京时间日期口径正确', async () => {
      const { validatePayments } = await load('src/utils/route.js')
      const { shopDay, shopRange } = await load('src/utils/shopDate.js')
      assert.throws(() => validatePayments([{ method: 'cash', amount: -100 }, { method: 'cash', amount: 200 }], 100, 'IN'))
      assert.throws(() => validatePayments([{ method: 'cash', amount: 1.5 }], 1.5, 'IN'))
      assert.equal(shopDay(new Date('2026-11-11T16:00:00Z')), '2026-11-12')
      assert.equal(shopRange('2026-11-12', '2026-11-12').gte.toISOString(), '2026-11-11T16:00:00.000Z')
    })
    await t.test('三类临时照片通过真实上传压缩并落盘', async () => {
      const sharp = require('sharp')
      const image = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#e8b840' } }).jpeg().toBuffer()
      photos = []
      for (const code of ['TEMPtestA', 'TEMPtestB', 'TEMPtestC']) {
        const form = new FormData()
        form.append('file', new Blob([image], { type: 'image/jpeg' }), 'test.jpg')
        form.append('uniqueCode', code); form.append('category', 'OVERALL')
        const response = await fetch(url + '/photos/upload', { method: 'POST', body: form })
        assert.equal(response.status, 200)
        photos.push(await response.json())
      }
    })
    await t.test('照片数量不符时订单与库存整体回滚', async () => {
      const result = await api('/recycle', 'POST', payload([item('GOLD', 83000, 'TEMPtestA', 2)], 83000))
      assert.equal(result.status, 409)
      assert.equal(await db.recycleOrder.count(), 0)
      assert.equal(await db.inventoryItem.count(), 0)
      assert.equal((await db.inventoryPhoto.findUnique({ where: { id: photos[0].id } })).inventoryId, null)
    })
    await t.test('金银铂混收保留独立单价和行情，照片随单归档且不能删除', async () => {
      const result = await api('/recycle', 'POST', payload([item('GOLD', 83000, 'TEMPtestA'), item('SILVER', 720, 'TEMPtestB'), item('PLATINUM', 21500, 'TEMPtestC')], 105220))
      assert.equal(result.status, 200, JSON.stringify(result.body))
      inventory = result.body.inventoryItems
      assert.equal(new Set(inventory.map(item => item.uniqueCode)).size, 3)
      assert.equal(inventory[1].silverMarketPriceAtReceive, 1324)
      assert.equal(inventory[2].platinumMarketPriceAtReceive, 34930)
      assert.equal(inventory[1].rongtongjinPriceAtReceive, null)
      const listed = (await api('/photos/' + inventory[0].uniqueCode)).body
      assert.deepEqual(listed.grouped.OVERALL[0].fileHealth, { original: 'ok', thumbnail: 'ok', large: 'ok' })
      assert.equal((await api('/photos/' + photos[0].id, 'DELETE')).status, 403)
      const integrity = (await api('/maintenance/integrity')).body
      assert.equal(integrity.ok, true)
      assert.equal(integrity.images.expectedFiles, 6)
    })
    await t.test('盘点未录全不能提交，差异计算且保留原库存重量', async () => {
      const result = await api('/stocktaking', 'POST', {})
      assert.equal(result.status, 200)
      assert.equal((await api(`/stocktaking/${result.body.id}/submit`, 'POST')).status, 400)
      for (const [index, entry] of result.body.items.entries()) {
        const actual = entry.systemPureWeight + [0, 1, -1][index]
        const changed = await api(`/stocktaking/${result.body.id}/item/${entry.id}`, 'PUT', { actualPureWeight: actual })
        assert.equal(changed.status, 200)
        assert.equal(changed.body.difference, [0, 1, -1][index])
      }
      const submitted = await api(`/stocktaking/${result.body.id}/submit`, 'POST')
      assert.equal(submitted.body.order.status, 'COMPLETED')
      assert.equal(submitted.body.diffSummary.totalDiff, 0)
      assert.equal((await db.inventoryItem.findUnique({ where: { id: inventory[1].id } })).pureWeight, 100)
    })
    await t.test('混售按金属计价，重复出售被拦截，报表毛利一致', async () => {
      const data = { sellPrice: 87000, itemCodes: inventory.map(item => item.uniqueCode), itemPrices: Object.fromEntries(inventory.map((item, index) => [item.uniqueCode, [87000, 880, 23500][index]])), payments: [{ method: 'cash', amount: 111380, direction: 'IN' }] }
      const sale = await api('/sell', 'POST', data)
      assert.equal(sale.status, 200, JSON.stringify(sale.body))
      assert.equal(sale.body.summary.totalAmount, 111380)
      assert.equal((await api('/sell', 'POST', data)).status, 409)
      assert.equal((await api('/reports/profit')).body.summary.sellProfit, 6160)
      assert.equal((await api('/photos/' + inventory[0].uniqueCode)).body.total, 1)
    })
    await t.test('现有换新流程固化抵扣、支付及库存状态', async () => {
      const received = await api('/recycle', 'POST', payload([item('GOLD', 83000, undefined, 0)], 83000))
      const code = received.body.inventoryItems[0].uniqueCode
      const exchange = await api('/exchange', 'POST', { oldItems: [{ uniqueCode: code, deductAmount: 85000 }], newItems: [{ productName: '新戒指', salePrice: 90000, laborFeeItem: 1000 }], payments: [{ method: 'cash', amount: 6000, direction: 'IN' }] })
      assert.equal(exchange.status, 200, JSON.stringify(exchange.body))
      assert.equal((await db.inventoryItem.findUnique({ where: { uniqueCode: code } })).status, 'EXCHANGED')
      assert.equal(await db.exchangeOrder.count(), 1)
      assert.equal((await api('/maintenance/integrity')).body.database.ok, true)
    })
  } finally {
    await new Promise(resolve => server.close(resolve))
    await db.$disconnect()
  }
})
