// ============ 照片路由 ============
// 上传/查询/删除库存照片
// 照片属于审计资料，订单提交后永久保留，仅允许提交前删除
import { Router, wrap } from '../utils/route.js'
import { prisma } from '../lib/prisma.js'
import { randomUUID } from 'node:crypto'
import { tempPhotoWhere, attachPhotos } from '../services/photoAttachment.js'
import multer from 'multer'
import { processAndSavePhoto, deletePhotoFiles, PHOTO_CATEGORIES } from '../services/photoService.js'
import { writeAudit } from '../services/audit.js'
import { photoFileHealth } from '../services/dataFiles.js'

const router = Router()

// 将路径中的反斜杠统一转为正斜杠，确保前端可直接拼成有效 URL
function normalizePath(p) {
  return p ? p.replace(/\\/g, '/') : p
}

// multer 内存存储（处理后再落盘，避免临时文件）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('不支持的图片格式，仅支持 jpg/jpeg/png/webp'))
    }
  }
})

/**
 * 上传照片
 * POST /api/photos/upload
 * multipart/form-data: file=图片文件, uniqueCode=库存编号, category=OVERALL|HALLMARK|FLAW
 * 注：uniqueCode 可为临时ID（回收录入时还没正式编号），后续通过 /api/photos/reattach 关联到正式编号
 */
router.post('/upload', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请选择图片文件' })
  }
  const { uniqueCode, category } = req.body
  if (!uniqueCode) {
    return res.status(400).json({ error: '缺少 uniqueCode（库存编号或临时ID）' })
  }
  // 安全校验：uniqueCode 只允许字母数字下划线连字符，防止目录穿越（../../）
  if (!/^[A-Za-z0-9_-]+$/.test(uniqueCode)) {
    return res.status(400).json({ error: 'uniqueCode 格式不合法，仅允许字母/数字/下划线/连字符' })
  }
  if (!category || !PHOTO_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category 必须为 ${PHOTO_CATEGORIES.join('/')}` })
  }

  // 查询该库存+分类下已有照片数（限制5张/件）
  // 注：uniqueCode 可能是临时ID（不以INV开头），此时跳过库存关联检查
  const isTemp = uniqueCode.startsWith('TEMP')
  if (!isTemp) return res.status(403).json({ error: '已提交库存照片仅供查阅，请在收旧提交前上传' })
  const inventoryItem = null
  const existCount = await prisma.inventoryPhoto.count({ where: tempPhotoWhere(uniqueCode) })
  if (existCount >= 5) return res.status(400).json({ error: '每件最多5张照片' })
  const sortOrder = existCount + 1

  // 处理图片：压缩 + 缩略图 + 落盘
  const result = await processAndSavePhoto(
    req.file.buffer,
    uniqueCode, // 用 uniqueCode 作为目录名（临时ID时用临时ID命名目录）
    category,
    randomUUID(),
    req.file.originalname
  )

  // 写入数据库
  // 临时ID（isTemp=true）时 inventoryId 存 null，后续 reattach 时更新为真实ID
  // Prisma Int 字段不允许 0 作为外键值（会触发外键约束），用 null 表示未关联
  const photo = await prisma.inventoryPhoto.create({
    data: {
      inventoryId: inventoryItem ? inventoryItem.id : null,
      category,
      sortOrder,
      originalPath: result.originalPath,
      thumbPath: result.thumbPath,
      largePath: result.largePath,
      fileName: result.fileName,
      fileSize: result.fileSize
    }
  })

  // 审计
  await writeAudit(prisma, {
    entityType: 'InventoryPhoto',
    entityId: photo.id,
    action: 'UPLOAD',
    newValue: { uniqueCode, category, sortOrder, fileSize: result.fileSize },
    operator: 'ADMIN'
  })

  res.json({
    id: photo.id,
    category,
    sortOrder,
    originalPath: normalizePath(result.originalPath),
    thumbPath: normalizePath(result.thumbPath),
    fileName: result.fileName,
    fileSize: result.fileSize
  })
}))

/**
 * 将临时照片关联到正式库存编号
 * POST /api/photos/reattach
 * body: { tempCode: '临时ID', uniqueCode: 'INV20260630-0001' }
 * 回收成功后调用：把录入阶段用临时ID上传的照片，关联到刚生成的正式库存编号
 */
router.post('/reattach', wrap(async (req, res) => {
  const { tempCode, uniqueCode } = req.body
  if (!tempCode || !uniqueCode) {
    return res.status(400).json({ error: '缺少 tempCode 或 uniqueCode' })
  }

  const inventoryItem = await prisma.inventoryItem.findUnique({ where: { uniqueCode } })
  if (!inventoryItem) {
    return res.status(404).json({ error: `库存 ${uniqueCode} 不存在` })
  }

  // 兼容旧客户端；正式库存尚无照片时才允许补关联。
  const count = await prisma.$transaction(async tx => {
    if (await tx.inventoryPhoto.count({ where: { inventoryId: inventoryItem.id } })) {
      throw Object.assign(new Error('正式影像档案已归档，不可重新关联'), { status: 403 })
    }
    return attachPhotos(tx, tempCode, inventoryItem.id)
  })

  await writeAudit(prisma, {
    entityType: 'InventoryPhoto',
    entityId: inventoryItem.id,
    action: 'REATTACH',
    newValue: { tempCode, uniqueCode, count },
    operator: 'ADMIN'
  })

  res.json({ reattached: count })
}))

/**
 * 查询某库存的所有照片
 * GET /api/photos/:uniqueCode
 * 返回按分类分组的数据
 */
router.get('/:uniqueCode', wrap(async (req, res) => {
  const { uniqueCode } = req.params
  let inventoryItem = null
  let where
  if (uniqueCode.startsWith('TEMP')) where = tempPhotoWhere(uniqueCode)
  else {
    inventoryItem = await prisma.inventoryItem.findUnique({ where: { uniqueCode } })
    if (!inventoryItem) return res.status(404).json({ error: '库存不存在' })
    where = { inventoryId: inventoryItem.id }
  }
  const photos = await prisma.inventoryPhoto.findMany({ where, orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] })

  // 按分类分组
  const grouped = {}
  for (const cat of PHOTO_CATEGORIES) {
    grouped[cat] = []
  }
  for (const p of photos) {
    if (!grouped[p.category]) grouped[p.category] = []
    grouped[p.category].push({
      id: p.id,
      sortOrder: p.sortOrder,
      originalPath: normalizePath(p.originalPath),
      thumbPath: normalizePath(p.thumbPath),
      fileName: p.fileName,
      fileSize: p.fileSize,
      createdAt: p.createdAt,
      fileHealth: await photoFileHealth(p)
    })
  }

  res.json({
    uniqueCode,
    total: photos.length,
    grouped
  })
}))

/**
 * 删除照片（仅允许提交前删除）
 * DELETE /api/photos/:id
 * 库存件出售/换新/作废时不删除照片
 */
router.delete('/:id', wrap(async (req, res) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) {
    return res.status(400).json({ error: '无效的照片ID' })
  }
  const photo = await prisma.inventoryPhoto.findUnique({ where: { id } })
  if (!photo) {
    return res.status(404).json({ error: '照片不存在' })
  }

  if (photo.inventoryId !== null) {
    return res.status(403).json({ error: '回收已提交，照片为永久影像档案，不可删除' })
  }

  // 先删数据库记录，再删文件（DB 失败时文件保留可重试，避免孤儿文件）
  const deleted = await prisma.inventoryPhoto.deleteMany({ where: { id, inventoryId: null } })
  if (!deleted.count) return res.status(409).json({ error: '照片已归档，不可删除' })

  await writeAudit(prisma, {
    entityType: 'InventoryPhoto',
    entityId: id,
    action: 'DELETE',
    oldValue: { category: photo.category, originalPath: photo.originalPath },
    operator: 'ADMIN'
  })

  // 文件删除失败可容忍（遗留孤儿文件，不影响数据一致性）
  await deletePhotoFiles(photo.originalPath, photo.thumbPath).catch(() => {})

  res.json({ success: true })
}))

export default router
