// 门店日界统一为北京时间，与服务器操作系统时区无关。
export function shopDay(date = new Date()) {
  return new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10)
}
export function shopRange(startDate, endDate) {
  const range = {}
  for (const value of [startDate, endDate]) {
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value + 'T00:00:00+08:00')) ||
        shopDay(new Date(value + 'T00:00:00+08:00')) !== value)) {
      throw Object.assign(new Error('日期格式无效'), { status: 400 })
    }
  }
  if (startDate) range.gte = new Date(startDate + 'T00:00:00+08:00')
  if (endDate) range.lte = new Date(endDate + 'T23:59:59.999+08:00')
  if (range.gte && range.lte && range.gte > range.lte) throw Object.assign(new Error('开始日期不能晚于结束日期'), { status: 400 })
  return range
}
