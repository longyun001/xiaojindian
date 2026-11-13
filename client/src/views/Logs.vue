<template>
  <div>
    <div class="page-card">
      <el-form :inline="true">
        <el-form-item label="实体类型">
          <el-select v-model="filter.entityType" clearable placeholder="全部" style="width: 160px" @change="loadList(1)">
            <el-option v-for="t in entityTypes" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="动作">
          <el-input v-model="filter.action" clearable placeholder="如 CREATE" style="width: 160px" @change="loadList(1)" />
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="filter.dateRange" type="daterange" value-format="YYYY-MM-DD" @change="loadList(1)" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadList(1)">查询</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="page-card">
      <el-table :data="list" border size="small" v-loading="loading">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div style="padding: 12px 24px;">
              <el-row :gutter="20">
                <el-col :span="12">
                  <div style="font-weight: 600; margin-bottom: 6px;">旧值</div>
                  <pre style="background: #f5f5f5; padding: 8px; border-radius: 4px; font-size: 12px; max-height: 200px; overflow: auto;">{{ formatJson(row.oldValue) }}</pre>
                </el-col>
                <el-col :span="12">
                  <div style="font-weight: 600; margin-bottom: 6px;">新值</div>
                  <pre style="background: #f5f5f5; padding: 8px; border-radius: 4px; font-size: 12px; max-height: 200px; overflow: auto;">{{ formatJson(row.newValue) }}</pre>
                </el-col>
              </el-row>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="entityType" label="实体类型" width="150" />
        <el-table-column prop="entityId" label="实体ID" width="80" align="center" />
        <el-table-column label="动作" width="160">
          <template #default="{ row }">
            <el-tag :type="actionType(row.action)" size="small">{{ row.action }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="100" />
        <el-table-column label="时间" width="180">
          <template #default="{ row }">{{ fmtDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="摘要" min-width="200">
          <template #default="{ row }">{{ summarize(row.newValue) }}</template>
        </el-table-column>
      </el-table>

      <div style="margin-top: 16px; text-align: right;">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @current-change="loadList()"
          @size-change="loadList(1)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { auditApi } from '@/api'
import { fmtDateTime } from '@/utils/format'

const list = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const filter = reactive({ entityType: '', action: '', dateRange: [] })

const entityTypes = ['RecycleOrder', 'ExchangeOrder', 'SellOrder', 'InventoryItem', 'Party', 'GoldPrice', 'SystemConfig', 'StocktakingOrder']

function actionType(action) {
  if (action?.includes('CREATE')) return 'success'
  if (action?.includes('UPDATE') || action?.includes('SUBMIT')) return 'warning'
  if (action?.includes('DELETE') || action?.includes('CANCEL')) return 'danger'
  if (action?.includes('PRICE')) return 'primary'
  return 'info'
}

function formatJson(val) {
  if (!val) return '-'
  if (typeof val === 'string') return val
  return JSON.stringify(val, null, 2)
}

function summarize(val) {
  if (!val) return ''
  if (typeof val === 'object') {
    if (val.orderNo) return val.orderNo
    if (val.uniqueCode) return val.uniqueCode
    if (val.status) return `状态: ${val.status}`
    return Object.entries(val).slice(0, 3).map(([k, v]) => `${k}:${v}`).join('  ')
  }
  return String(val)
}

async function loadList(p) {
  if (p) page.value = p
  loading.value = true
  try {
    const params = { page: page.value, pageSize: pageSize.value }
    if (filter.entityType) params.entityType = filter.entityType
    if (filter.action) params.action = filter.action
    if (filter.dateRange?.length === 2) {
      params.startDate = filter.dateRange[0]
      params.endDate = filter.dateRange[1]
    }
    const res = await auditApi.list(params)
    list.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

onMounted(() => loadList(1))
</script>
