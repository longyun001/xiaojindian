import { lstat, realpath, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { UPLOADS_ROOT, within, safeRelativePath } from './dataPaths.js'

// 不跟随链接，不把损坏路径当作正常照片；兼容历史 Windows 分隔符。
export async function imageFileState(value, root = UPLOADS_ROOT) {
  try {
    const path = safeRelativePath(value)
    const target = resolve(root, path)
    if (!within(root, target)) return 'invalid'
    const stat = await lstat(target)
    if (stat.isSymbolicLink() || !within(await realpath(root), await realpath(target))) return 'invalid'
    if (!stat.isFile()) return 'invalid'
    return stat.size > 0 ? 'ok' : 'empty'
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return 'missing'
    if (error.code === 'EACCES' || error.code === 'EPERM') return 'unreadable'
    return 'invalid'
  }
}

export async function photoFileHealth(photo, root = UPLOADS_ROOT) {
  const [original, thumbnail, large] = await Promise.all([
    imageFileState(photo.originalPath, root),
    imageFileState(photo.thumbPath, root),
    imageFileState(photo.largePath || photo.originalPath, root)
  ])
  return { original, thumbnail, large }
}

export async function scanPhotoFiles(photos, root = UPLOADS_ROOT) {
  const files = new Map()
  const issues = []
  for (const photo of photos) {
    const paths = new Map()
    for (const [role, value] of Object.entries({ original: photo.originalPath, thumbnail: photo.thumbPath, large: photo.largePath || photo.originalPath })) {
      const key = typeof value === 'string' ? value.replace(/\\/g, '/') : String(value)
      if (!files.has(key)) files.set(key, await imageFileState(value, root))
      if (!paths.has(key)) paths.set(key, { path: key, roles: [], state: files.get(key) })
      paths.get(key).roles.push(role)
    }
    const broken = [...paths.values()].filter(file => file.state !== 'ok')
    if (broken.length) issues.push({
      photoId: photo.id, inventoryId: photo.inventoryId, uniqueCode: photo.inventory?.uniqueCode || null,
      category: photo.category, fileName: photo.fileName, paths: broken
    })
  }
  return {
    totalPhotos: photos.length,
    temporaryPhotos: photos.filter(photo => photo.inventoryId === null).length,
    expectedFiles: files.size,
    presentFiles: [...files.values()].filter(state => state === 'ok').length,
    missingFiles: [...files.values()].filter(state => state === 'missing').length,
    problemFiles: [...files.values()].filter(state => state !== 'ok').length,
    affectedPhotos: issues.length, issues
  }
}

export async function listRegularFiles(root, prefix = '') {
  const result = []
  for (const entry of await readdir(resolve(root, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isSymbolicLink()) throw new Error(`目录含链接，无法备份：${path}`)
    if (entry.isDirectory()) result.push(...await listRegularFiles(root, path))
    else if (entry.isFile()) result.push(path)
    else throw new Error(`不支持的文件类型：${path}`)
  }
  return result.sort()
}
