// ============ 路由辅助工具 ============
import { Router } from 'express'

/**
 * 包装异步路由处理器，自动捕获错误
 */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

/**
 * 校验支付数组总额与方向
 * @param {Array} payments 支付数组 [{method, amount, direction}]
 * @param {number} expectedAmount 期望总额（分）
 * @param {string} expectedDirection 期望方向 IN | OUT
 */
export function validatePayments(payments, expectedAmount, expectedDirection) {
  if (!Array.isArray(payments) || payments.length === 0) {
    const err = new Error('支付方式不能为空')
    err.status = 400
    throw err
  }
  if (!Number.isSafeInteger(expectedAmount) || expectedAmount < 0) {
    throw Object.assign(new Error('应付金额必须为非负安全整数'), { status: 400 })
  }
  for (const p of payments) {
    if (!p || !['cash', 'wechat', 'alipay', 'bank'].includes(p.method) ||
        !Number.isSafeInteger(p.amount) || p.amount < 0) {
      throw Object.assign(new Error('支付方式无效或金额不是非负整数（分）'), { status: 400 })
    }
  }
  const total = payments.reduce((sum, p) => sum + p.amount, 0)
  if (total !== expectedAmount) {
    const err = new Error(`支付总额不匹配：应付 ${expectedAmount}，实付 ${total}`)
    err.status = 400
    throw err
  }
  for (const p of payments) {
    if (p.direction && p.direction !== expectedDirection) {
      const err = new Error(`支付方向错误：应为 ${expectedDirection}，收到 ${p.direction}`)
      err.status = 400
      throw err
    }
  }
  return true
}

export { Router }
