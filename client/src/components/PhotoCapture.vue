<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :title="`影像档案 - ${uniqueCode || '新件（临时）'}`"
    width="720px"
    :close-on-click-modal="false"
    :close-on-press-escape="!uploading"
    :show-close="!uploading"
    :before-close="beforeClose"
    class="photo-capture-dialog"
  >
    <!-- 分类标签切换 -->
    <div class="category-tabs">
      <div
        v-for="cat in CATEGORIES"
        :key="cat.value"
        class="category-tab"
        :class="{ active: currentCategory === cat.value }"
        @click="currentCategory = cat.value"
      >
        <el-badge :value="getCount(cat.value)" :hidden="getCount(cat.value) === 0" type="primary">
          <span>{{ cat.label }}</span>
        </el-badge>
      </div>
    </div>

    <!-- 当前分类的照片网格 -->
    <div class="photo-grid" v-if="currentPhotos.length">
      <div v-for="(photo, idx) in currentPhotos" :key="photo.id || photo.tempId" class="photo-item">
        <el-image
          :src="photo.fileHealth?.thumbnail === 'ok' || !photo.fileHealth ? getThumbUrl(photo) : (photo.fileHealth.original === 'ok' ? getOriginalUrl(photo) : '')"
          :alt="`${currentCategoryLabel} ${idx + 1}`"
          fit="cover"
          style="width: 100%; height: 100%"
          @click="previewPhoto(photo)"
        >
          <template #error><div class="missing-photo">影像文件不可用<br>记录 #{{ photo.id }} 已保留</div></template>
        </el-image>
        <div class="photo-actions" v-if="!isArchived">
          <el-button link size="small" type="danger" :icon="Delete" @click="removePhoto(photo)" />
        </div>
      </div>
    </div>
    <div v-else class="empty-photo-tip">
      <el-icon :size="32"><Picture /></el-icon>
      <p>暂无{{ currentCategoryLabel }}照片</p>
    </div>

    <!-- 操作按钮 -->
    <el-alert v-if="photos.some(p => p.fileHealth && Object.values(p.fileHealth).some(s => s !== 'ok'))" title="部分影像文件异常，原始记录已保留。可在设置 → 数据维护中查看详情。" type="warning" :closable="false" show-icon style="margin: 12px 0" />
    <div class="action-bar" v-if="!isArchived">
      <el-button type="primary" :icon="Camera" @click="openCamera" :disabled="uploading || totalPhotos >= 5">
        摄像头拍照
      </el-button>
      <el-upload
        :show-file-list="false"
        :before-upload="handleFileUpload"
        accept="image/jpeg,image/png,image/webp"
        :disabled="uploading || totalPhotos >= 5"
      >
        <el-button :icon="Upload" :disabled="uploading || totalPhotos >= 5">上传图片</el-button>
      </el-upload>
      <span class="photo-count">共 {{ totalPhotos }}/5 张</span>
    </div>

    <!-- 摄像头拍照弹窗 -->
    <el-dialog
      v-model="cameraVisible"
      title="摄像头拍照"
      width="520px"
      append-to-body
      :close-on-click-modal="false"
    >
      <div class="camera-container">
        <video ref="videoRef" autoplay playsinline class="camera-video"></video>
        <canvas ref="canvasRef" style="display: none;"></canvas>
      </div>
      <template #footer>
        <el-button @click="closeCamera">取消</el-button>
        <el-button type="primary" :icon="Camera" @click="capturePhoto">拍摄</el-button>
      </template>
    </el-dialog>

    <!-- 图片预览 -->
    <el-image-viewer
      v-if="viewerVisible"
      :url-list="viewerList"
      :initial-index="viewerIndex"
      @close="viewerVisible = false"
    />
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { Camera, Upload, Delete, Picture } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { photoApi } from '@/api'

const props = defineProps({
  modelValue: Boolean,
  uniqueCode: { type: String, default: '' } // 库存编号，为空时用临时ID
})
const emit = defineEmits(['update:modelValue'])

// 照片分类
const CATEGORIES = [
  { value: 'OVERALL', label: '整体照' },
  { value: 'HALLMARK', label: '钢印特写' },
  { value: 'FLAW', label: '瑕疵/特殊' }
]

const uploading = ref(false)
function beforeClose(done) { if (!uploading.value) done() }
const currentCategory = ref('OVERALL')
const photos = ref([]) // 当前库存的所有照片（含临时上传结果）
const currentCategoryLabel = computed(() => CATEGORIES.find(c => c.value === currentCategory.value)?.label || '')

// 临时ID（回收录入时还没正式编号，用时间戳生成）
const tempCode = ref('')

// 摄像头相关
const cameraVisible = ref(false)
const videoRef = ref(null)
const canvasRef = ref(null)
let mediaStream = null

// 图片预览
const viewerVisible = ref(false)
const viewerList = ref([])
const viewerIndex = ref(0)

// 计算属性
const currentPhotos = computed(() => photos.value.filter(p => p.category === currentCategory.value))
const isArchived = computed(() => props.uniqueCode.startsWith('INV'))
const totalPhotos = computed(() => photos.value.length)
function getCount(cat) {
  return photos.value.filter(p => p.category === cat).length
}

// 弹窗打开时加载已有照片
watch(() => props.modelValue, async (v) => {
  if (v) {
    currentCategory.value = 'OVERALL'
    photos.value = []
    // 如果有正式 uniqueCode，加载已有照片
    if (!props.uniqueCode) tempCode.value = 'TEMP' + (globalThis.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2)))
    else tempCode.value = props.uniqueCode
    if (getCurrentCode()) {
      try {
        const res = await photoApi.list(getCurrentCode())
        const all = []
        for (const cat of CATEGORIES) {
          if (res.grouped[cat.value]) {
            all.push(...res.grouped[cat.value].map(p => ({ ...p, category: cat.value })))
          }
        }
        photos.value = all
      } catch (e) {
        console.error('加载照片失败', e)
      }
    }
  }
})

// 弹窗关闭时停止摄像头
watch(() => props.modelValue, (v) => {
  if (!v) closeCamera()
})

// 当前用的编号（正式或临时）
function getCurrentCode() {
  return props.uniqueCode || tempCode.value
}

// 打开摄像头
async function openCamera() {
  if (totalPhotos.value >= 5) {
    ElMessage.warning('每件库存最多5张照片')
    return
  }
  cameraVisible.value = true
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    })
    // 等待 video 元素渲染
    await new Promise(r => setTimeout(r, 100))
    if (videoRef.value) {
      videoRef.value.srcObject = mediaStream
    }
  } catch (e) {
    ElMessage.error('无法访问摄像头：' + e.message)
    cameraVisible.value = false
  }
}

// 关闭摄像头
function closeCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop())
    mediaStream = null
  }
  cameraVisible.value = false
}

// 拍照
function capturePhoto() {
  if (!videoRef.value || !canvasRef.value) return
  const video = videoRef.value
  const canvas = canvasRef.value
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(video, 0, 0)
  canvas.toBlob((blob) => {
    const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' })
    uploadFile(file)
    closeCamera()
  }, 'image/jpeg', 0.9)
}

// 文件上传
async function handleFileUpload(file) {
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.error('单张图片不能超过5MB')
    return false
  }
  await uploadFile(file)
  return false // 阻止 el-upload 默认行为
}

// 上传文件到后端
async function uploadFile(file) {
  if (uploading.value || isArchived.value || totalPhotos.value >= 5) return
  uploading.value = true
  const category = currentCategory.value
  const formData = new FormData()
  formData.append('file', file)
  formData.append('uniqueCode', getCurrentCode())
  formData.append('category', category)

  try {
    const res = await photoApi.upload(formData)
    photos.value.push({
      id: res.id,
      category,
      sortOrder: res.sortOrder,
      originalPath: res.originalPath,
      thumbPath: res.thumbPath,
      fileName: res.fileName,
      fileSize: res.fileSize,
      tempId: Date.now() + Math.random()
    })
    ElMessage.success(`${currentCategoryLabel.value}已添加`)
  } catch (e) {
    ElMessage.error('上传失败：' + (e.response?.data?.error || e.message))
  } finally { uploading.value = false }
}

// 删除照片
async function removePhoto(photo) {
  try {
    await ElMessageBox.confirm('确认删除这张照片？', '提示', { type: 'warning' })
    if (photo.id) {
      await photoApi.remove(photo.id)
    }
    const idx = photos.value.findIndex(p => p === photo)
    if (idx >= 0) photos.value.splice(idx, 1)
    ElMessage.success('已删除')
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

// 获取缩略图URL
function getThumbUrl(photo) {
  return `/uploads/${photo.thumbPath}`
}

function getOriginalUrl(photo) { return `/uploads/${photo.originalPath}` }

// 预览大图
function previewPhoto(photo) {
  if (photo.fileHealth && photo.fileHealth.original !== 'ok') {
    ElMessage.warning('原图缺失或无法读取，影像记录已保留')
    return
  }
  const available = currentPhotos.value.filter(p => !p.fileHealth || p.fileHealth.original === 'ok')
  viewerList.value = available.map(getOriginalUrl)
  viewerIndex.value = available.findIndex(p => p === photo)
  if (viewerIndex.value < 0) viewerIndex.value = 0
  viewerVisible.value = true
}

// 组件卸载前清理摄像头
onBeforeUnmount(() => {
  closeCamera()
})

// 暴露方法给父组件
defineExpose({
  // 获取照片统计（用于提交前提醒）
  getPhotoCount: () => totalPhotos.value,
  // 获取临时编号（用于回收成功后关联）
  getTempCode: () => tempCode.value
})
</script>

<style scoped>
.missing-photo { padding: 12px; color: #8a5b0b; font-size: 12px; text-align: center; line-height: 1.8; }
.category-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.category-tab {
  padding: 8px 20px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  background: #fff;
}
.category-tab:hover {
  border-color: var(--gold-primary);
  color: var(--gold-dark);
}
.category-tab.active {
  background: var(--gold-primary);
  color: #fff;
  border-color: var(--gold-primary);
}
.photo-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  min-height: 120px;
  margin-bottom: 16px;
}
.photo-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-light);
  background: #f5f5f5;
}
.photo-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
  transition: transform 0.2s;
}
.photo-item img:hover {
  transform: scale(1.05);
}
.photo-actions {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(255,255,255,0.9);
  border-radius: 4px;
  padding: 2px;
}
.empty-photo-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  color: var(--text-secondary);
  background: #fafafa;
  border: 1px dashed var(--border-light);
  border-radius: 8px;
  margin-bottom: 16px;
}
.empty-photo-tip p {
  margin: 8px 0 0;
  font-size: 13px;
}
.action-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}
.photo-count {
  margin-left: auto;
  color: var(--text-secondary);
  font-size: 13px;
}
.camera-container {
  display: flex;
  justify-content: center;
}
.camera-video {
  max-width: 100%;
  max-height: 400px;
  border-radius: 8px;
  background: #000;
}
</style>
