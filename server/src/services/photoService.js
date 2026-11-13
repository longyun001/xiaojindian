// ============ 图片处理服务 ============
// 接收上传的图片，压缩为最长边1600px JPEG质量80%，生成300px缩略图
// 存储路径：uploads/YYYY/MM/INV编号/序号_分类.jpg
import sharp from 'sharp'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { UPLOADS_ROOT } from './dataPaths.js'

// 允许的分类
export const PHOTO_CATEGORIES = ['OVERALL', 'HALLMARK', 'FLAW']

/**
 * 处理上传的图片：压缩 + 生成缩略图 + 落盘
 * @param {Buffer} buffer 原始图片数据
 * @param {string} uniqueCode 库存编号，如 INV20260630-0001
 * @param {string} category 照片分类 OVERALL | HALLMARK | FLAW
 * @param {number} sortOrder 序号
 * @param {string} originalName 原始文件名（用于提取扩展名和下载命名）
 * @returns {Promise<{originalPath, thumbPath, largePath, fileName, fileSize}>}
 */
export async function processAndSavePhoto(buffer, uniqueCode, category, sortOrder, originalName = 'photo.jpg') {
  // 校验分类
  if (!PHOTO_CATEGORIES.includes(category)) {
    throw Object.assign(new Error(`无效的照片分类: ${category}，应为 ${PHOTO_CATEGORIES.join('/')}`), { status: 400 })
  }

  // 生成存储路径：uploads/2026/06/INV20260630-0001/
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const dir = join(UPLOADS_ROOT, String(year), month, uniqueCode)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  // 文件名：序号_分类.jpg（统一转 jpg）
  const baseName = `${sortOrder}_${category}.jpg`
  const thumbName = `thumb_${baseName}`
  // 用正斜杠拼接相对路径，确保存入 DB 的路径可直接作为 URL 使用（跨平台兼容）
  const originalPath = `${year}/${month}/${uniqueCode}/${baseName}`
  const thumbPath = `${year}/${month}/${uniqueCode}/${thumbName}`

  // 压缩原图：最长边 1600px，JPEG 质量 80%
  const originalBuffer = await sharp(buffer)
    .rotate() // 自动根据 EXIF 旋转
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer()

  // 缩略图：300px
  const thumbBuffer = await sharp(buffer)
    .rotate()
    .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 75 })
    .toBuffer()

  // 落盘
  const { writeFileSync } = await import('node:fs')
  writeFileSync(join(UPLOADS_ROOT, originalPath), originalBuffer)
  writeFileSync(join(UPLOADS_ROOT, thumbPath), thumbBuffer)

  return {
    originalPath,
    thumbPath,
    largePath: originalPath, // 当前大图与原图同路径，预留未来区分
    fileName: originalName,
    fileSize: originalBuffer.length
  }
}

/**
 * 删除照片文件（仅用于提交前用户主动删除）
 * 库存件出售/换新/作废时不删除照片
 */
export async function deletePhotoFiles(originalPath, thumbPath) {
  const { unlinkSync } = await import('node:fs')
  try {
    unlinkSync(join(UPLOADS_ROOT, originalPath))
  } catch {}
  try {
    unlinkSync(join(UPLOADS_ROOT, thumbPath))
  } catch {}
}

export { UPLOADS_ROOT }
