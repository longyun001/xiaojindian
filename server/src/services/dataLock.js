import { mkdirSync, readFileSync, writeFileSync, unlinkSync, rmdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { SERVER_ROOT } from './dataPaths.js'

export function readDataLock(serverRoot = SERVER_ROOT) {
  const path = resolve(serverRoot, '.data-lock')
  if (!existsSync(path)) return null
  try { return JSON.parse(readFileSync(resolve(path, 'owner.json'), 'utf8')) }
  catch { return { kind: 'unknown', pid: null } }
}

export function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return true
  try { process.kill(pid, 0); return true }
  catch (error) { return error.code !== 'ESRCH' }
}

export function acquireDataLock(kind, serverRoot = SERVER_ROOT) {
  const path = resolve(serverRoot, '.data-lock')
  try { mkdirSync(path) }
  catch (error) {
    if (error.code !== 'EEXIST') throw error
    const owner = readDataLock(serverRoot)
    if (owner && !isProcessAlive(owner.pid)) {
      clearStaleDataLock(serverRoot)
      return acquireDataLock(kind, serverRoot)
    }
    throw new Error(`数据正被占用或上次异常退出（${owner?.kind}，PID ${owner?.pid}）。请先关闭启动器；若已关闭，运行 data-maintenance.bat 的“解除残留锁”。`)
  }
  const owner = { kind, pid: process.pid, token: randomUUID(), createdAt: new Date().toISOString() }
  try { writeFileSync(resolve(path, 'owner.json'), JSON.stringify(owner), { flag: 'wx' }) }
  catch (error) { rmdirSync(path); throw error }
  let released = false
  return () => {
    if (released) return
    const current = readDataLock(serverRoot)
    if (current?.token !== owner.token) throw new Error('数据锁已变更，拒绝解除')
    unlinkSync(resolve(path, 'owner.json'))
    rmdirSync(path)
    released = true
  }
}

// 只由本机维护菜单显式调用；绝不结束任何进程。
export function clearStaleDataLock(serverRoot = SERVER_ROOT) {
  const owner = readDataLock(serverRoot)
  if (!owner) return false
  if (isProcessAlive(owner.pid)) throw new Error('锁对应进程仍在运行，或无法确认状态，不能解除')
  const path = resolve(serverRoot, '.data-lock')
  // wx 避免同时运行两个解锁操作。
  writeFileSync(resolve(path, 'unlocking'), '', { flag: 'wx' })
  try {
    if (readDataLock(serverRoot)?.token !== owner.token) throw new Error('数据锁已变更')
    unlinkSync(resolve(path, 'owner.json'))
  } finally { unlinkSync(resolve(path, 'unlocking')) }
  rmdirSync(path)
  return true
}
