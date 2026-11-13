// ============ 精度计算工具（防浮点穿透） ============
// 单位约定：
//   金额 → 分（INT）
//   重量 → 0.01克（INT）
//   纯度 → 万分比（INT），如 9999 = 99.99%，9990 = 99.90%，9500 = 95.00%
//   金价 → 分/克（INT）
// 所有计算在整数域完成，仅在前端展示时 /100。

/**
 * 通用整数舍入：将 scaledValue 按 scale 缩放并银行家舍入
 * 银行家舍入：四舍六入五成双（向最近偶数靠拢）
 * @param {number} scaledValue 被除数（已放大的整数）
 * @param {number} scale 除数
 * @returns {number} 舍入后的整数
 */
function bankerRoundScaled(scaledValue, scale) {
  const quotient = Math.floor(scaledValue / scale)
  const remainder = scaledValue % scale
  if (remainder * 2 > scale) return quotient + 1
  if (remainder * 2 < scale) return quotient
  // 正好一半：向偶数靠拢
  return quotient % 2 === 0 ? quotient : quotient + 1
}

/**
 * 计算纯金重（单位 0.01g）
 * 公式：pureWeight = grossWeight * purity / 10000
 *   grossWeight 是 0.01g，purity 是万分比（9999=99.99%）
 *   相乘后需 /10000 还原（原千分比方案为 /1000，升级为万分比以支持 99.99% 纯度）
 * @param {number} grossWeight 毛重（0.01g）
 * @param {number} purity 纯度（万分比，如 9999 表示 99.99%）
 * @returns {number} 纯金重（0.01g）
 */
function calcPureWeight(grossWeight, purity) {
  const numerator = grossWeight * purity
  return bankerRoundScaled(numerator, 10000)
}

/**
 * 计算单项金额（单位：分）
 * 公式：amount = pureWeight * pricePerGram / 100
 *   pureWeight 是 0.01g，pricePerGram 是 分/克，相乘后需 /100 还原
 * @param {number} pureWeight 纯金重（0.01g）
 * @param {number} pricePerGram 单价（分/克）
 * @returns {number} 金额（分）
 */
function calcItemAmount(pureWeight, pricePerGram) {
  const numerator = pureWeight * pricePerGram
  return bankerRoundScaled(numerator, 100)
}

/**
 * 金额求和（整数加法，天然无误差）
 */
function sumAmounts(amounts) {
  return amounts.reduce((a, b) => a + b, 0)
}

/**
 * 重量求和
 */
function sumWeights(weights) {
  return weights.reduce((a, b) => a + b, 0)
}

// ============ 前端展示辅助（仅用于打印模板等后端渲染场景） ============
/**
 * 分 → 元字符串：325 => "3.25"
 */
function fenToYuan(fen) {
  return (fen / 100).toFixed(2)
}

/**
 * 0.01g → 克字符串：15250 => "152.50"
 */
function liangToGram(liang) {
  return (liang / 100).toFixed(2)
}

/**
 * 万分比 → 百分比字符串：9999 => "99.99%"
 */
function permilToPercent(permil) {
  return (permil / 100).toFixed(2) + '%'
}

/**
 * 分/克 → 元/克字符串：85000 => "850.00"
 */
function priceToYuanPerGram(priceFen) {
  return (priceFen / 100).toFixed(2)
}

export {
  bankerRoundScaled,
  calcPureWeight,
  calcItemAmount,
  sumAmounts,
  sumWeights,
  fenToYuan,
  liangToGram,
  permilToPercent,
  priceToYuanPerGram
}
