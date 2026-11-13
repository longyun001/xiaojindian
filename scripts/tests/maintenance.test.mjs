import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync, unlinkSync, cpSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fixture, addPhotoFixture, ROOT } from './fixture.mjs'
import { context, inspectDatabase, createBackup, verifyBackup, restoreBackup, recoverRestore } from '../data-maintenance.mjs'
import { acquireDataLock, clearStaleDataLock } from '../../server/src/services/dataLock.js'
import { imageFileState } from '../../server/src/services/dataFiles.js'

test('检查缺图按不同文件计数，大图共用路径不重复', async () => {
  const f = fixture(); addPhotoFixture(f, { missing: true })
  const result = await inspectDatabase(f.dbPath, f.uploads)
  assert.equal(result.database.ok, true)
  assert.equal(result.images.problemFiles, 2)
  assert.equal(result.images.affectedPhotos, 1)
  assert.deepEqual(result.images.issues[0].paths[0].roles, ['original', 'large'])
  assert.equal(await imageFileState('../outside.jpg', f.uploads), 'invalid')
  assert.equal(await imageFileState('C:\\outside.jpg', f.uploads), 'invalid')
  assert.equal(await imageFileState('/absolute.jpg', f.uploads), 'invalid')
})

test('备份含 SQLite WAL 中已提交的数据、照片和校验清单', async () => {
  const f = fixture(); addPhotoFixture(f)
  const db = new DatabaseSync(f.dbPath)
  db.exec("PRAGMA journal_mode=WAL; INSERT INTO Party (type,name) VALUES ('CUSTOMER','WAL提交')")
  assert.equal(existsSync(f.dbPath + '-wal'), true)
  const result = await createBackup(f.root)
  assert.equal(result.integrity.database.tables.Party, 1)
  assert.equal(result.integrity.images.problemFiles, 0)
  assert.equal(result.manifest.files.filter(file => file.path.startsWith('uploads/')).length, 2)
  assert.equal(existsSync(resolve(result.path, '.env')), false)
  const checked = await verifyBackup(result.path, f.root)
  assert.equal(checked.integrity.database.tables.Party, 1)
  assert.equal(readFileSync(resolve(result.path, 'uploads/2026/photo.jpg'), 'utf8'), 'PHOTO')
  assert.equal(existsSync(resolve(result.path, 'database.sqlite-wal')), false)
  db.close()
})

test('损坏、缺失或多余文件均不能通过备份校验', async () => {
  const f = fixture(); addPhotoFixture(f)
  const backup = await createBackup(f.root)
  const path = resolve(backup.path, 'uploads/2026/photo.jpg')
  writeFileSync(path, 'BROKEN')
  await assert.rejects(verifyBackup(backup.path, f.root), /校验失败/)
  writeFileSync(path, 'PHOTO')
  unlinkSync(path)
  await assert.rejects(verifyBackup(backup.path, f.root), /ENOENT/)
  writeFileSync(path, 'PHOTO')
  const extra = resolve(backup.path, 'uploads/extra.jpg')
  writeFileSync(extra, 'extra')
  await assert.rejects(verifyBackup(backup.path, f.root), /清单不一致/)
})

test('拒绝路径穿越和结构版本不符的备份', async () => {
  const f = fixture(); addPhotoFixture(f)
  const backup = await createBackup(f.root)
  const path = resolve(backup.path, 'manifest.json')
  const original = readFileSync(path, 'utf8')
  const manifest = JSON.parse(original)
  manifest.files[0].path = '../outside'
  writeFileSync(path, JSON.stringify(manifest))
  await assert.rejects(verifyBackup(backup.path, f.root), /路径不合法/)
  writeFileSync(path, original)
  writeFileSync(context(f.root).schema, '\n// incompatible', { flag: 'a' })
  await assert.rejects(verifyBackup(backup.path, f.root), /结构版本不匹配/)
})

test('恢复需要确认；恢复前备份保留恢复点之后的数据与照片', async () => {
  const f = fixture(); addPhotoFixture(f)
  const backup = await createBackup(f.root)
  const db = new DatabaseSync(f.dbPath)
  db.exec("INSERT INTO Party (type,name) VALUES ('CUSTOMER','恢复前新增')")
  db.close()
  writeFileSync(resolve(f.uploads, 'later.jpg'), 'later')
  await assert.rejects(restoreBackup(backup.path, f.root), /明确确认/)
  const restored = await restoreBackup(backup.path, f.root, { confirmed: true })
  assert.equal(restored.integrity.database.tables.Party, 0)
  assert.equal(existsSync(resolve(f.uploads, 'later.jpg')), false)
  const safety = await verifyBackup(restored.safetyBackup, f.root)
  assert.equal(safety.integrity.database.tables.Party, 1)
  assert.equal(readFileSync(resolve(safety.path, 'uploads/later.jpg'), 'utf8'), 'later')
  assert.equal(readFileSync(resolve(restored.previousData, 'uploads/later.jpg'), 'utf8'), 'later')
  assert.equal(existsSync(context(f.root).journal), false)
})

test('已有缺图可如实备份，恢复时要求另行确认', async () => {
  const f = fixture(); addPhotoFixture(f, { missing: true })
  const backup = await createBackup(f.root)
  assert.equal(backup.manifest.knownMissingFiles, 2)
  await assert.rejects(restoreBackup(backup.path, f.root, { confirmed: true }), /含已知缺图/)
  const restored = await restoreBackup(backup.path, f.root, { confirmed: true, allowMissing: true })
  assert.equal(restored.integrity.images.affectedPhotos, 1)
  assert.equal(restored.integrity.database.tables.InventoryPhoto, 1)
})

test('备份还原到没有数据库的同版本项目', async () => {
  const source = fixture(); addPhotoFixture(source)
  const backup = await createBackup(source.root)
  const target = fixture()
  unlinkSync(target.dbPath)
  const restored = await restoreBackup(backup.path, target.root, { confirmed: true })
  assert.equal(restored.safetyBackup, undefined)
  assert.equal(restored.integrity.database.tables.InventoryItem, 1)
  assert.equal(restored.integrity.images.problemFiles, 0)
})

test('服务占用时拒绝维护，解除活锁不会结束服务进程', () => {
  const f = fixture()
  const release = acquireDataLock('server', f.server)
  try {
    assert.throws(() => acquireDataLock('maintenance', f.server), /数据正被占用/)
    assert.throws(() => clearStaleDataLock(f.server), /仍在运行/)
    const result = spawnSync(process.execPath, [resolve(ROOT, 'scripts/data-maintenance.mjs'), 'backup', '--root', f.root], { encoding: 'utf8', windowsHide: true })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /数据正被占用/)
    assert.equal(existsSync(resolve(f.root, 'backups')), false)
  } finally { release() }
})

test('已退出进程的残留锁可自动清理', () => {
  const f = fixture()
  const child = spawnSync(process.execPath, ['-e', ''], { windowsHide: true })
  mkdirSync(resolve(f.server, '.data-lock'))
  writeFileSync(resolve(f.server, '.data-lock/owner.json'), JSON.stringify({ pid: child.pid, token: randomUUID(), kind: 'server' }))
  const release = acquireDataLock('maintenance', f.server)
  release()
  assert.equal(existsSync(resolve(f.server, '.data-lock')), false)
})

test('中断恢复：旧库已移动、新库已替换，但照片尚未移动时可回滚', async () => {
  const f = fixture(); addPhotoFixture(f)
  const original = readFileSync(f.dbPath)
  const ctx = context(f.root), token = randomUUID()
  const old = resolve(f.server, `.restore-old-${token}`), stage = resolve(f.server, `.restore-stage-${token}`)
  mkdirSync(old); mkdirSync(stage)
  renameSync(f.dbPath, resolve(old, 'database'))
  copyFileSyncCompat(resolve(old, 'database'), f.dbPath)
  const db = new DatabaseSync(f.dbPath)
  db.exec("INSERT INTO Party (type,name) VALUES ('CUSTOMER','中断中新增')")
  db.close()
  writeFileSync(ctx.journal, JSON.stringify({ token, database: relative(ctx.server, ctx.db), originals: ['database', 'uploads'], committed: false }))
  await recoverRestore(f.root)
  assert.deepEqual(readFileSync(f.dbPath), original)
  assert.equal(readFileSync(resolve(f.uploads, '2026/photo.jpg'), 'utf8'), 'PHOTO')
  assert.equal(existsSync(resolve(stage, 'interrupted-database')), true)
  assert.equal(existsSync(ctx.journal), false)
})

test('中断日志未处理时，禁止再次恢复或备份', async () => {
  const f = fixture()
  writeFileSync(context(f.root).journal, '{}')
  await assert.rejects(createBackup(f.root), /未结束的恢复/)
})

function copyFileSyncCompat(source, target) { cpSync(source, target, { errorOnExist: true, force: false }) }
