import { defineStore } from 'pinia'
import { ref } from 'vue'
import { configApi, goldPriceApi } from '@/api'
import { priceToYuanPerGram } from '@/utils/format'

// 系统配置 store
export const useConfigStore = defineStore('config', () => {
  const config = ref({})
  const loaded = ref(false)

  async function load() {
    config.value = await configApi.get()
    loaded.value = true
    return config.value
  }

  async function update(data) {
    config.value = await configApi.update(data)
    return config.value
  }

  return { config, loaded, load, update }
})

// 金价 store
export const useGoldPriceStore = defineStore('goldPrice', () => {
  const current = ref(null)

  async function load() {
    current.value = await goldPriceApi.current()
    return current.value
  }

  async function update(data) {
    current.value = await goldPriceApi.update(data)
    return current.value
  }

  // 便捷访问
  function display() {
    if (!current.value) return null
    return {
      international: priceToYuanPerGram(current.value.internationalPrice),
      rongtongjin: priceToYuanPerGram(current.value.rongtongjinPrice),
      recycle: priceToYuanPerGram(current.value.recyclePrice),
      sale: priceToYuanPerGram(current.value.salePrice)
    }
  }

  return { current, load, update, display }
})
