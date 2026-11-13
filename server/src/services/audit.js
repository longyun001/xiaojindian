// ============ 审计日志服务 ============
// 所有状态变更、成本修改、金价更新均通过此服务记录
import { prisma } from '../lib/prisma.js'

/**
 * 写入审计日志（在事务内调用需传入 tx；否则用全局 prisma）
 * @param {object} txOrPrisma 事务客户端或 prisma
 * @param {object} params
 * @param {string} params.entityType 实体类型（如 RecycleOrder, InventoryItem）
 * @param {number} params.entityId 实体ID
 * @param {string} params.action 动作（CREATE/UPDATE/DELETE/STATUS_CHANGE/PRICE_UPDATE）
 * @param {object} params.oldValue 旧值（JSON 可序列化）
 * @param {object} params.newValue 新值
 * @param {string} params.operator 操作人
 */
export async function writeAudit(txOrPrisma, { entityType, entityId, action, oldValue, newValue, operator = 'SYSTEM' }) {
  const client = txOrPrisma || prisma
  return client.auditLog.create({
    data: {
      entityType,
      entityId,
      action,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
      operator
    }
  })
}

/**
 * 批量写入审计日志（事务内）
 */
export async function writeAuditBatch(tx, logs) {
  if (!logs || logs.length === 0) return
  await tx.auditLog.createMany({
    data: logs.map((l) => ({
      entityType: l.entityType,
      entityId: l.entityId,
      action: l.action,
      oldValue: l.oldValue ? JSON.stringify(l.oldValue) : null,
      newValue: l.newValue ? JSON.stringify(l.newValue) : null,
      operator: l.operator || 'SYSTEM'
    }))
  })
}
