// 本机离线维护。Node.js 24+，不新增 npm 依赖，不保存 .env 或密码。
import { DatabaseSync, backup as sqliteBackup } from 'node:sqlite'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, renameSync, unlinkSync, lstatSync, realpathSync } from 'node:fs'
import { resolve, dirname, basename, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { listRegularFiles, scanPhotoFiles } from '../server/src/services/dataFiles.js'
import { within, safeRelativePath } from '../server/src/services/dataPaths.js'
import { acquireDataLock, clearStaleDataLock } from '../server/src/services/dataLock.js'

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FORMAT = 'gold-shop-backup-v1'

function assertPlainPath(path, root) {
  if (!within(root, path)) throw new Error('目标超出项目目录')
  let current = resolve(path)
  while (within(root, current)) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error(`路径含链接：${current}`)
    current = dirname(current)
  }
}

export function context(root = DEFAULT_ROOT) {
  root = realpathSync(resolve(root))
  const server = resolve(root, 'server')
  const envFile = resolve(server, '.env')
  const text = existsSync(envFile) ? readFileSync(envFile, 'utf8') : ''
  const match = text.match(/^\s*DATABASE_URL\s*=\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s#]+))/m)
  const url = process.env.DATABASE_URL || (match ? (match[1] ?? match[2] ?? match[3]) : 'file:./dev.db')
  if (!url.startsWith('file:') || /[?\0]/.test(url)) throw new Error('此工具仅支持本地 SQLite 文件；请检查 server/.env')
  const db = resolve(server, 'prisma', url.slice(5))
  assertPlainPath(db, server)
  assertPlainPath(resolve(server, 'uploads'), server)
  return { root, server, db, uploads: resolve(server, 'uploads'), schema: resolve(server, 'prisma/schema.prisma'), journal: resolve(server, '.restore-in-progress.json') }
}

async function hash(path) {
  const digest = createHash('sha256')
  for await (const chunk of createReadStream(path)) digest.update(chunk)
  return digest.digest('hex')
}

function copyFile(source, target) {
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(source, target, 1) // COPYFILE_EXCL：不覆盖已有文件
}

// Windows 防病毒/索引程序可能短暂占用刚关闭的文件；只重试临时占用错误。
async function move(source, target) {
  for (let attempt = 0; ; attempt++) {
    try { renameSync(source, target); return }
    catch (error) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt >= 5) throw error
      await new Promise(resolve => setTimeout(resolve, 50 * 2 ** attempt))
    }
  }
}

export async function inspectDatabase(dbPath, uploads) {
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    const quickCheck = db.prepare('PRAGMA quick_check').all().map(row => Object.values(row)[0])
    const foreignKeyErrors = db.prepare('PRAGMA foreign_key_check').all()
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name)
    const tables = {}
    const shape = {}
    for (const name of names) {
      const quoted = '"' + name.replaceAll('"', '""') + '"'
      tables[name] = db.prepare(`SELECT COUNT(*) AS count FROM ${quoted}`).get().count
      shape[name] = db.prepare(`PRAGMA table_info(${quoted})`).all().map(row => ({ name: row.name, type: row.type, notnull: row.notnull, pk: row.pk }))
    }
    const required = ['InventoryItem', 'InventoryPhoto', 'RecycleOrder', 'SellOrder', 'Payment', 'AuditLog']
    if (required.some(name => !names.includes(name))) throw new Error('不是完整的小金店数据库')
    const photos = db.prepare('SELECT p.*, i.uniqueCode FROM InventoryPhoto p LEFT JOIN InventoryItem i ON i.id=p.inventoryId ORDER BY p.id').all()
      .map(row => ({ ...row, inventory: row.uniqueCode ? { uniqueCode: row.uniqueCode } : null }))
    return {
      checkedAt: new Date().toISOString(),
      database: { ok: quickCheck.length === 1 && quickCheck[0] === 'ok' && foreignKeyErrors.length === 0, quickCheck, foreignKeyErrors, tables, shape },
      images: await scanPhotoFiles(photos, uploads)
    }
  } finally { db.close() }
}

function assertNoJournal(ctx) {
  if (existsSync(ctx.journal)) throw new Error('检测到未结束的恢复，请在维护菜单先执行“恢复中断回滚”')
}

export async function createBackup(root = DEFAULT_ROOT, { reason = 'manual' } = {}) {
  const ctx = context(root)
  assertNoJournal(ctx)
  const parent = resolve(ctx.root, 'backups')
  assertPlainPath(parent, ctx.root)
  mkdirSync(parent, { recursive: true })
  const stamp = new Date(Date.now() + 8 * 3600_000).toISOString().replace(/[-:]/g, '').slice(0, 15)
  const name = `${stamp}-${reason === 'before-restore' ? 'before-restore-' : ''}${randomUUID().slice(0, 8)}`
  const partial = resolve(parent, `.partial-${name}`)
  const destination = resolve(parent, name)
  mkdirSync(partial)
  mkdirSync(resolve(partial, 'uploads'))
  const source = new DatabaseSync(ctx.db, { readOnly: true })
  try { await sqliteBackup(source, resolve(partial, 'database.sqlite')) }
  finally { source.close() }
  // 独立备份文件不依赖 WAL/SHM 边车文件。
  const snapshot = new DatabaseSync(resolve(partial, 'database.sqlite'))
  try { snapshot.exec('PRAGMA journal_mode=DELETE') } finally { snapshot.close() }
  if (existsSync(ctx.uploads)) {
    for (const file of await listRegularFiles(ctx.uploads)) copyFile(resolve(ctx.uploads, file), resolve(partial, 'uploads', file))
  }
  copyFile(ctx.schema, resolve(partial, 'schema.prisma'))
  const integrity = await inspectDatabase(resolve(partial, 'database.sqlite'), resolve(partial, 'uploads'))
  if (!integrity.database.ok) throw new Error(`数据库校验失败，未生成有效备份；临时目录：${partial}`)
  writeFileSync(resolve(partial, 'integrity.json'), JSON.stringify(integrity, null, 2), { flag: 'wx' })
  const files = []
  for (const file of await listRegularFiles(partial)) files.push({ path: file, bytes: lstatSync(resolve(partial, file)).size, sha256: await hash(resolve(partial, file)) })
  const manifest = { format: FORMAT, createdAt: new Date().toISOString(), reason, schemaSha256: await hash(ctx.schema), knownMissingFiles: integrity.images.problemFiles, files }
  writeFileSync(resolve(partial, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' })
  await verifyBackup(partial, root)
  await move(partial, destination)
  return { path: destination, manifest, integrity }
}

export async function verifyBackup(backupPath, root = DEFAULT_ROOT) {
  const ctx = context(root)
  backupPath = resolve(backupPath)
  if (lstatSync(backupPath).isSymbolicLink() || !lstatSync(backupPath).isDirectory()) throw new Error('备份必须为普通目录')
  const actual = await listRegularFiles(backupPath)
  if (!actual.includes('manifest.json')) throw new Error('缺少备份清单')
  const manifest = JSON.parse(readFileSync(resolve(backupPath, 'manifest.json'), 'utf8'))
  if (manifest.format !== FORMAT || !Array.isArray(manifest.files)) throw new Error('不支持的备份格式')
  const expected = new Set(['manifest.json'])
  for (const file of manifest.files) {
    const path = safeRelativePath(file.path)
    if (!['database.sqlite', 'schema.prisma', 'integrity.json'].includes(path) && !path.startsWith('uploads/')) throw new Error('备份清单包含非业务文件')
    if (expected.has(path.toLowerCase())) throw new Error('备份清单包含重复路径')
    expected.add(path.toLowerCase())
    const target = resolve(backupPath, path)
    assertPlainPath(target, backupPath)
    const stat = lstatSync(target)
    if (!stat.isFile() || stat.size !== file.bytes || await hash(target) !== file.sha256) throw new Error(`备份文件校验失败：${path}`)
  }
  if (actual.length !== expected.size || actual.some(file => !expected.has(file.toLowerCase()))) throw new Error('备份文件与清单不一致')
  if (!['database.sqlite', 'schema.prisma', 'integrity.json'].every(file => expected.has(file))) throw new Error('备份缺少关键文件')
  if (await hash(ctx.schema) !== manifest.schemaSha256 || await hash(resolve(backupPath, 'schema.prisma')) !== manifest.schemaSha256) throw new Error('数据库结构版本不匹配，不能直接恢复')
  const integrity = await inspectDatabase(resolve(backupPath, 'database.sqlite'), resolve(backupPath, 'uploads'))
  const saved = JSON.parse(readFileSync(resolve(backupPath, 'integrity.json'), 'utf8'))
  if (!integrity.database.ok || JSON.stringify(integrity.database.tables) !== JSON.stringify(saved.database.tables) || JSON.stringify(integrity.database.shape) !== JSON.stringify(saved.database.shape)) throw new Error('备份数据库内容与检查记录不一致')
  if (JSON.stringify(integrity.images) !== JSON.stringify(saved.images) || integrity.images.problemFiles !== manifest.knownMissingFiles) throw new Error('备份影像与检查记录不一致')
  return { path: backupPath, manifest, integrity }
}

function restoreTargets(ctx) {
  return [
    ['database', ctx.db], ['wal', ctx.db + '-wal'], ['shm', ctx.db + '-shm'],
    ['journal', ctx.db + '-journal'], ['uploads', ctx.uploads]
  ]
}

// 中断后也能按留存旧文件回滚；新文件转移留存，不删除业务资料。
export async function recoverRestore(root = DEFAULT_ROOT) {
  const ctx = context(root)
  if (!existsSync(ctx.journal)) throw new Error('没有待回滚的恢复')
  const journal = JSON.parse(readFileSync(ctx.journal, 'utf8'))
  if (!/^[a-f0-9-]{36}$/.test(journal.token) || journal.database !== relative(ctx.server, ctx.db) || !Array.isArray(journal.originals)) throw new Error('恢复日志不合法，请保留现场')
  const stage = resolve(ctx.server, `.restore-stage-${journal.token}`)
  const old = resolve(ctx.server, `.restore-old-${journal.token}`)
  assertPlainPath(stage, ctx.server)
  assertPlainPath(old, ctx.server)
  if (journal.committed) {
    if (!(await inspectDatabase(ctx.db, ctx.uploads)).database.ok) throw new Error('恢复后的数据库检查失败，请保留现场')
  } else {
    for (const [key, target] of restoreTargets(ctx)) {
      assertPlainPath(target, ctx.server)
      const previous = resolve(old, key)
      const hadOriginal = journal.originals.includes(key)
      if (existsSync(previous) || !hadOriginal) {
        if (existsSync(target)) {
          const retained = resolve(stage, `interrupted-${key}`)
          if (existsSync(retained)) throw new Error('回滚留存路径已存在，请保留现场')
          await move(target, retained)
        }
        if (existsSync(previous)) await move(previous, target)
      }
    }
  }
  unlinkSync(ctx.journal)
  return { recovered: true, retainedAt: stage }
}

export async function restoreBackup(backupPath, root = DEFAULT_ROOT, { confirmed = false, allowMissing = false } = {}) {
  const ctx = context(root)
  assertNoJournal(ctx)
  const checked = await verifyBackup(backupPath, root)
  if (!confirmed) throw new Error('恢复需明确确认覆盖当前数据')
  if (checked.integrity.images.problemFiles && !allowMissing) throw new Error('此备份含已知缺图，需另行确认后才能恢复')
  const safety = existsSync(ctx.db) ? await createBackup(root, { reason: 'before-restore' }) : null
  const token = randomUUID()
  const stage = resolve(ctx.server, `.restore-stage-${token}`)
  const old = resolve(ctx.server, `.restore-old-${token}`)
  assertPlainPath(stage, ctx.server)
  assertPlainPath(old, ctx.server)
  mkdirSync(stage)
  mkdirSync(resolve(stage, 'uploads'))
  mkdirSync(old)
  for (const file of checked.manifest.files) {
    if (file.path === 'database.sqlite' || file.path.startsWith('uploads/')) {
      copyFile(resolve(checked.path, file.path), resolve(stage, file.path))
      if (await hash(resolve(stage, file.path)) !== file.sha256) throw new Error('恢复暂存文件校验失败')
    }
  }
  const targets = restoreTargets(ctx)
  for (const [, target] of targets) assertPlainPath(target, ctx.server)
  const journal = { token, database: relative(ctx.server, ctx.db), originals: targets.filter(([, path]) => existsSync(path)).map(([key]) => key), safetyBackup: safety?.path, committed: false }
  writeFileSync(ctx.journal, JSON.stringify(journal, null, 2), { flag: 'wx' })
  try {
    for (const [key, target] of targets) if (existsSync(target)) await move(target, resolve(old, key))
    mkdirSync(dirname(ctx.db), { recursive: true })
    await move(resolve(stage, 'database.sqlite'), ctx.db)
    await move(resolve(stage, 'uploads'), ctx.uploads)
    const restored = await inspectDatabase(ctx.db, ctx.uploads)
    if (!restored.database.ok || JSON.stringify(restored.database.tables) !== JSON.stringify(checked.integrity.database.tables) || JSON.stringify(restored.images) !== JSON.stringify(checked.integrity.images)) throw new Error('恢复后复核失败')
    const committed = ctx.journal + '.committed'
    writeFileSync(committed, JSON.stringify({ ...journal, committed: true }, null, 2), { flag: 'wx' })
    await move(committed, ctx.journal)
    unlinkSync(ctx.journal)
    return { restored: true, safetyBackup: safety?.path, previousData: old, integrity: restored }
  } catch (error) {
    try { await recoverRestore(root) }
    catch (recoveryError) { throw new Error(`${error.message}；自动回滚未完成：${recoveryError.message}。禁止启动业务，请保留恢复日志。`) }
    throw new Error(`${error.message}；已自动回滚`)
  }
}

async function ask(question) {
  const input = createInterface({ input: process.stdin, output: process.stdout })
  try { return (await input.question(question)).trim().replace(/^"|"$/g, '') }
  finally { input.close() }
}

export async function main(args = process.argv.slice(2)) {
  let [command = 'menu', backupPath] = args
  const rootIndex = args.indexOf('--root')
  const root = rootIndex === -1 ? DEFAULT_ROOT : args[rootIndex + 1]
  const ctx = context(root)
  if (command === 'menu') {
    console.log('\n小金店 · 数据维护（请先关闭服务启动器）\n1 检查数据与影像\n2 备份数据库与全部照片\n3 校验备份\n4 从备份恢复\n5 解除异常退出残留锁\n6 恢复中断回滚\n0 退出\n')
    command = ({ 1: 'check', 2: 'backup', 3: 'verify', 4: 'restore', 5: 'unlock', 6: 'recover' })[await ask('请选择：')]
    if (!command) return
  }
  if (command === 'unlock') { console.log(clearStaleDataLock(ctx.server) ? '已解除残留锁' : '没有残留锁'); return }
  if (command === 'verify' || command === 'restore') {
    backupPath ||= await ask('请输入含 manifest.json 的备份目录（可拖入文件夹）：')
  }
  // 所有触碰当前数据的操作都与后端互斥；校验历史备份保持只读。
  const release = command === 'verify' ? () => {} : acquireDataLock('maintenance', ctx.server)
  try {
    let result
    if (command === 'check') result = await inspectDatabase(ctx.db, ctx.uploads)
    else if (command === 'backup') result = await createBackup(root)
    else if (command === 'verify') result = await verifyBackup(backupPath, root)
    else if (command === 'recover') result = await recoverRestore(root)
    else if (command === 'restore') {
      const preview = await verifyBackup(backupPath, root)
      console.log(JSON.stringify({ createdAt: preview.manifest.createdAt, tables: preview.integrity.database.tables, problemImages: preview.integrity.images.problemFiles }, null, 2))
      const expected = preview.integrity.images.problemFiles ? 'RESTORE WITH MISSING PHOTOS' : 'RESTORE'
      console.log('恢复会覆盖当前数据；执行前会自动保存当前数据库和照片。')
      if (await ask(`确认恢复请输入 ${expected}：`) !== expected) { console.log('已取消恢复'); return }
      result = await restoreBackup(backupPath, root, { confirmed: true, allowMissing: preview.integrity.images.problemFiles > 0 })
    } else throw new Error('未知命令，可用 menu / check / backup / verify / restore / unlock / recover')
    const report = result.integrity || (result.database ? result : null)
    console.log(JSON.stringify({
      path: result.path, createdAt: result.manifest?.createdAt, restored: result.restored,
      safetyBackup: result.safetyBackup, previousData: result.previousData, recovered: result.recovered, retainedAt: result.retainedAt,
      database: report ? { ok: report.database.ok, tables: report.database.tables } : undefined,
      images: report?.images
    }, null, 2))
    if ((result.integrity || result).images?.problemFiles) console.log('注意：含缺失或异常影像，记录已保留；备份不能补回原本缺失的照片。')
  } finally { release() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error('维护失败：' + error.message); process.exitCode = 1 })
}
