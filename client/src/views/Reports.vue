<template>
  <div>
    <div class="page-card">
      <el-form :inline="true">
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            @change="loadProfit"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadProfit">查询</el-button>
          <el-button @click="setThisMonth">本月</el-button>
          <el-button @click="setLastMonth">上月</el-button>
        </el-form-item>
      </el-form>
    </div>

    <el-alert title="统计口径：换新部分仅统计旧料抵扣差额及工费，未计新品成本；综合毛利不代表门店净利润。" type="info" :closable="false" style="margin-bottom:16px" />
    <div class="stat-grid" v-if="profit">
      <div class="stat-card">
        <div class="stat-label">出售收入</div>
        <div class="stat-value">{{ fenToYuan(profit.summary.sellRevenue) }}</div>
        <div class="stat-sub">成本 {{ fenToYuan(profit.summary.sellCost) }} · {{ profit.summary.sellCount }} 件</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">出售毛利</div>
        <div class="stat-value" :style="{ color: profit.summary.sellProfit >= 0 ? 'var(--el-color-success)' : 'var(--el-color-danger)' }">{{ fenToYuan(profit.summary.sellProfit) }}</div>
        <div class="stat-sub">毛利率 {{ profit.summary.sellRevenue ? (profit.summary.sellProfit / profit.summary.sellRevenue * 100).toFixed(1) : 0 }}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">旧料抵扣差额 + 工费</div>
        <div class="stat-value">{{ fenToYuan(profit.summary.exchangeGrossProfit + profit.summary.laborFeeIncome) }}</div>
        <div class="stat-sub">旧料抵扣差额 {{ fenToYuan(profit.summary.exchangeGrossProfit) }} · 工费 {{ fenToYuan(profit.summary.laborFeeIncome) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">综合毛利</div>
        <div class="stat-value" style="color: var(--gold-dark);">{{ fenToYuan(profit.summary.totalProfit) }}</div>
        <div class="stat-sub">回收支出 {{ fenToYuan(profit.summary.recycleTotal) }} · {{ profit.summary.recycleCount }} 单</div>
      </div>
    </div>

    <div class="page-card">
      <h3 class="section-title">每日明细</h3>
      <el-table :data="profit?.daily || []" border size="small">
        <el-table-column prop="date" label="日期" width="120" />
        <el-table-column label="出售收入" align="right">
          <template #default="{ row }">{{ fenToYuan(row.sellRevenue) }}</template>
        </el-table-column>
        <el-table-column label="出售成本" align="right">
          <template #default="{ row }">{{ fenToYuan(row.sellCost) }}</template>
        </el-table-column>
        <el-table-column label="出售毛利" align="right">
          <template #default="{ row }">
            <span :style="{ color: row.sellRevenue - row.sellCost >= 0 ? 'var(--el-color-success)' : 'var(--el-color-danger)' }">{{ fenToYuan(row.sellRevenue - row.sellCost) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="旧料抵扣差额" align="right">
          <template #default="{ row }">{{ fenToYuan(row.exchangeProfit) }}</template>
        </el-table-column>
        <el-table-column label="工费收入" align="right">
          <template #default="{ row }">{{ fenToYuan(row.laborFee) }}</template>
        </el-table-column>
        <el-table-column label="日合计" align="right">
          <template #default="{ row }">
            <b style="color: var(--gold-dark);">{{ fenToYuan(row.sellRevenue - row.sellCost + row.exchangeProfit + row.laborFee) }}</b>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="!profit?.daily?.length" class="empty-tip">该日期范围内无数据</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import dayjs from 'dayjs'
import { reportApi } from '@/api'
import { fenToYuan } from '@/utils/format'

const profit = ref(null)
const dateRange = ref([])

async function loadProfit() {
  const params = {}
  if (dateRange.value && dateRange.value.length === 2) {
    params.startDate = dateRange.value[0]
    params.endDate = dateRange.value[1]
  }
  profit.value = await reportApi.profit(params)
}

function setThisMonth() {
  const start = dayjs().startOf('month').format('YYYY-MM-DD')
  const end = dayjs().endOf('month').format('YYYY-MM-DD')
  dateRange.value = [start, end]
  loadProfit()
}
function setLastMonth() {
  const start = dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD')
  const end = dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')
  dateRange.value = [start, end]
  loadProfit()
}

onMounted(() => {
  setThisMonth()
})
</script>
