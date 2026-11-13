<template>
  <div class="page-card" v-loading="loading">
    <h3 class="section-title">数据与影像检查</h3>
    <p>检查数据库及照片是否齐全。发现缺图时保留原始记录，便于查找旧备份。</p>
    <div class="maintenance-actions">
      <el-button type="primary" @click="check" :loading="loading">检查数据完整性</el-button>
      <el-button @click="exportReport" :disabled="!report || loading">导出检查结果</el-button>
      <span v-if="report">检查时间：{{ fmtDateTime(report.checkedAt) }}</span>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <template v-if="report">
      <el-alert :title="statusTitle" :type="report.ok ? 'success' : 'warning'" :closable="false" show-icon />
      <dl class="maintenance-counts">
        <div><dt>数据库</dt><dd>{{ report.database.ok ? '检查通过' : '需处理' }}</dd></div>
        <div><dt>库存件数</dt><dd>{{ report.counts.inventory }}</dd></div>
        <div><dt>影像记录</dt><dd>{{ report.images.totalPhotos }}</dd></div>
        <div><dt>正常 / 应有文件</dt><dd>{{ report.images.presentFiles }} / {{ report.images.expectedFiles }}</dd></div>
        <div><dt>缺失文件</dt><dd>{{ report.images.missingFiles }}</dd></div>
        <div><dt>受影响影像</dt><dd>{{ report.images.affectedPhotos }}</dd></div>
      </dl>
      <el-table v-if="report.images.issues.length" :data="report.images.issues" border size="small" max-height="420">
        <el-table-column prop="photoId" label="影像 ID" width="90" />
        <el-table-column label="所属库存" min-width="180">
          <template #default="{ row }">{{ row.uniqueCode || '提交前临时照片' }}</template>
        </el-table-column>
        <el-table-column label="文件问题" min-width="300">
          <template #default="{ row }">
            <div v-for="file in row.paths" :key="file.path" class="file-issue">{{ stateLabel(file.state) }}：{{ file.path }}</div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }"><el-button v-if="row.uniqueCode" link type="primary" @click="openPhotos(row.uniqueCode)">查看影像</el-button></template>
        </el-table-column>
      </el-table>
      <p v-if="report.images.temporaryPhotos">另有 {{ report.images.temporaryPhotos }} 条提交前临时照片；备份会一起保留。</p>
    </template>
    <h3 class="section-title" style="margin-top: 28px">备份与恢复</h3>
    <ol class="maintenance-help">
      <li>双击 <strong>stop.bat</strong> 停止服务，再双击项目目录中的 <strong>backup-data.bat</strong> 备份。数据库、全部照片和检查结果会保存到同目录的 <strong>backups</strong> 文件夹。</li>
      <li>把完整的备份文件夹另存到 U 盘或其他磁盘。只留在本机的备份无法应对磁盘损坏。</li>
      <li>需要恢复时，双击 <strong>data-maintenance.bat</strong>，先选择“校验备份”，再选择“从备份恢复”。程序会展示备份日期和数据数量，确认后先备份当前数据，再恢复。</li>
    </ol>
    <p class="maintenance-note">备份会如实记录已有缺图，无法补回原本缺失的文件；恢复含缺图备份时会单独提示。</p>
    <PhotoCapture v-model="photosVisible" :unique-code="selectedCode" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { maintenanceApi } from '@/api'
import { fmtDateTime } from '@/utils/format'
import PhotoCapture from './PhotoCapture.vue'

const report = ref(null)
const loading = ref(false)
const error = ref('')
const photosVisible = ref(false)
const selectedCode = ref('')
const statusTitle = computed(() => !report.value?.database.ok ? '数据库检查未通过，请保留数据并导出检查结果' : report.value.images.problemFiles ? `数据库检查通过；${report.value.images.affectedPhotos} 条影像涉及 ${report.value.images.problemFiles} 个异常文件` : '数据库和影像文件检查通过')
function stateLabel(state) { return ({ missing: '文件缺失', invalid: '路径异常', empty: '文件为空', unreadable: '无法读取' })[state] || state }
async function check() {
  loading.value = true
  error.value = ''
  report.value = null
  try { report.value = await maintenanceApi.integrity() }
  catch { error.value = '检查未完成，请确认后端服务正常后重试' }
  finally { loading.value = false }
}
function openPhotos(code) { selectedCode.value = code; photosVisible.value = true }
function exportReport() {
  if (!report.value) return
  const url = URL.createObjectURL(new Blob([JSON.stringify(report.value, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = '小金店数据检查-' + report.value.checkedAt.replace(/[:.]/g, '-') + '.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<style scoped>
.maintenance-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 16px 0; }
.maintenance-actions span, .maintenance-note { color: var(--text-secondary); font-size: 13px; }
.maintenance-counts { display: flex; flex-wrap: wrap; gap: 16px 36px; margin: 24px 0; }
.maintenance-counts dt { color: var(--text-secondary); font-size: 13px; }
.maintenance-counts dd { font-size: 20px; margin: 6px 0 0; }
.file-issue { overflow-wrap: anywhere; padding: 3px 0; }
.maintenance-help { padding-left: 22px; line-height: 1.9; }
.maintenance-help li { margin-bottom: 8px; }
</style>
