import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, mkdirSync, copyFileSync, cpSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export function fixture() {
  const parent = resolve(ROOT, '.test-work')
  mkdirSync(parent, { recursive: true })
  const root = mkdtempSync(resolve(parent, 'case-'))
  mkdirSync(resolve(root, 'server/prisma'), { recursive: true })
  mkdirSync(resolve(root, 'server/uploads'))
  copyFileSync(resolve(ROOT, 'server/prisma/schema.prisma'), resolve(root, 'server/prisma/schema.prisma'))
  copyFileSync(resolve(ROOT, 'server/package.json'), resolve(root, 'server/package.json'))
  cpSync(resolve(ROOT, 'server/src'), resolve(root, 'server/src'), { recursive: true })
  symlinkSync(resolve(ROOT, 'server/node_modules'), resolve(root, 'server/node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  writeFileSync(resolve(root, 'server/.env'), 'DATABASE_URL="file:./dev.db"\n')
  const dbPath = resolve(root, 'server/prisma/dev.db')
  const db = new DatabaseSync(dbPath)
  db.exec(readFileSync(resolve(ROOT, 'scripts/tests/schema.sql'), 'utf8'))
  db.close()
  return { root, server: resolve(root, 'server'), dbPath, uploads: resolve(root, 'server/uploads') }
}

export function addPhotoFixture(f, { missing = false } = {}) {
  const db = new DatabaseSync(f.dbPath)
  db.prepare("INSERT INTO InventoryItem (id,uniqueCode,sourceType,sourceId,itemName,metalType,grossWeight,purity,pureWeight,costAmount,costPureWeight,location,status,updatedAt) VALUES (1,'INV-TEST','RECYCLE',1,'测试戒指','GOLD',100,10000,100,83000,100,'测试柜','IN_STOCK',CURRENT_TIMESTAMP)").run()
  db.prepare("INSERT INTO InventoryPhoto (id,inventoryId,category,sortOrder,originalPath,thumbPath,largePath,fileName,fileSize) VALUES (1,1,'OVERALL',1,'2026/photo.jpg','2026/thumb.jpg','2026/photo.jpg','photo.jpg',5)").run()
  db.close()
  if (!missing) {
    mkdirSync(resolve(f.uploads, '2026'))
    writeFileSync(resolve(f.uploads, '2026/photo.jpg'), 'PHOTO')
    writeFileSync(resolve(f.uploads, '2026/thumb.jpg'), 'THUMB')
  }
}
