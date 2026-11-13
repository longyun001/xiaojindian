export function tempPhotoWhere(tempCode) {
  if (!/^TEMP[A-Za-z0-9_-]+$/.test(tempCode)) throw Object.assign(new Error('临时照片编号无效'), { status: 400 })
  return { inventoryId: null, OR: [
    { originalPath: { contains: '/' + tempCode + '/' } },
    { originalPath: { contains: '\\' + tempCode + '\\' } }
  ] }
}
export async function attachPhotos(tx, tempCode, inventoryId, expectedCount) {
  const where = tempPhotoWhere(tempCode)
  const photos = await tx.inventoryPhoto.findMany({ where })
  const existing = await tx.inventoryPhoto.count({ where: { inventoryId } })
  if (existing + photos.length > 5 || (expectedCount !== undefined && photos.length !== expectedCount)) {
    throw Object.assign(new Error('照片数量已变化，请重新打开照片窗口核对后提交'), { status: 409 })
  }
  const result = await tx.inventoryPhoto.updateMany({ where, data: { inventoryId } })
  if (result.count !== photos.length) throw Object.assign(new Error('照片已被其他订单关联'), { status: 409 })
  return result.count
}
