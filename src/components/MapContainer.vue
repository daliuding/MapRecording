<template>
  <div id="map-container" ref="mapContainer"></div>
  
  <!-- 工具栏 -->
  <div class="toolbar">
    <el-button-group>
      <el-button type="primary" @click="handleExport" :icon="Download">
        导出数据
      </el-button>
      <el-button type="success" @click="handleImport" :icon="Upload">
        导入数据
      </el-button>
    </el-button-group>
    <input
      ref="fileInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleFileSelect"
    />
  </div>

  <MarkerForm 
    v-if="showForm"
    :visible="showForm"
    :marker-type="selectedMarkerType"
    :position="clickedPosition"
    :marker-data="editingMarker"
    @close="handleFormClose"
    @save="handleMarkerSave"
  />
  <MarkerInfo
    v-if="showInfo"
    :visible="showInfo"
    :marker="selectedMarker"
    @close="handleInfoClose"
    @edit="handleEdit"
    @delete="handleDelete"
  />
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useMarkerStore } from '../stores/markerStore'
import MarkerForm from './MarkerForm.vue'
import MarkerInfo from './MarkerInfo.vue'
import { Download, Upload } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'

const mapContainer = ref(null)
let map = null
let amapMarkers = [] // 高德地图标记实例

const markerStore = useMarkerStore()

const showForm = ref(false)
const showInfo = ref(false)
const selectedMarkerType = ref('house')
const clickedPosition = ref(null)
const editingMarker = ref(null)
const selectedMarker = ref(null)
const fileInput = ref(null)

// 初始化地图
onMounted(async () => {
  if (typeof AMap === 'undefined') {
    console.error('高德地图 API 未加载')
    return
  }

  map = new AMap.Map('map-container', {
    zoom: 13,
    center: [121.6126, 38.9122] // 大连市区中心
  })

  // 监听地图点击事件
  map.on('click', (e) => {
    clickedPosition.value = [e.lnglat.getLng(), e.lnglat.getLat()]
    selectedMarkerType.value = 'house' // 默认房屋
    editingMarker.value = null
    showForm.value = true
  })

  // 加载已保存的标记
  await markerStore.loadMarkers()
  renderMarkers()
})

// 监听标记数据变化，重新渲染
watch(() => markerStore.markers, () => {
  renderMarkers()
}, { deep: true })

// 渲染标记
function renderMarkers() {
  // 清除现有标记
  amapMarkers.forEach(marker => {
    map.remove(marker)
  })
  amapMarkers = []

  // 渲染新标记
  markerStore.markers.forEach(markerData => {
    const marker = createMarker(markerData)
    if (marker) {
      amapMarkers.push(marker)
      map.add(marker)
    }
  })
}

// 创建标记
function createMarker(markerData) {
  const { id, type, lng, lat, info } = markerData
  
  // 根据类型设置不同颜色
  const iconColor = type === 'house' ? '#409EFF' : '#67C23A' // 房屋蓝色，小区绿色
  
  const marker = new AMap.Marker({
    position: [lng, lat],
    icon: new AMap.Icon({
      size: new AMap.Size(32, 32),
      image: `data:image/svg+xml;base64,${getMarkerIcon(iconColor)}`,
      imageSize: new AMap.Size(32, 32)
    }),
    title: type === 'house' ? (info?.community_name || '房屋') : (info?.name || '小区')
  })

  // 点击标记显示详情
  marker.on('click', () => {
    selectedMarker.value = markerData
    showInfo.value = true
  })

  return marker
}

// 生成标记图标（SVG base64）
function getMarkerIcon(color) {
  const svg = `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="12" fill="${color}" stroke="#fff" stroke-width="2"/>
      <circle cx="16" cy="16" r="6" fill="#fff"/>
    </svg>
  `
  return btoa(unescape(encodeURIComponent(svg)))
}

// 表单关闭
function handleFormClose() {
  showForm.value = false
  editingMarker.value = null
  clickedPosition.value = null
}

// 保存标记
async function handleMarkerSave(markerData) {
  const result = await markerStore.saveMarker(markerData)
  if (result.success) {
    showForm.value = false
    editingMarker.value = null
  } else {
    console.error('保存失败:', result.error)
  }
}

// 信息窗口关闭
function handleInfoClose() {
  showInfo.value = false
  selectedMarker.value = null
}

// 编辑标记
function handleEdit() {
  const marker = selectedMarker.value
  editingMarker.value = marker
  clickedPosition.value = [marker.lng, marker.lat]
  selectedMarkerType.value = marker.type
  showInfo.value = false
  showForm.value = true
}

// 删除标记
async function handleDelete() {
  const marker = selectedMarker.value
  if (confirm('确定要删除这个标记吗？')) {
    const result = await markerStore.deleteMarker(marker.id)
    if (result.success) {
      showInfo.value = false
      selectedMarker.value = null
    } else {
      console.error('删除失败:', result.error)
    }
  }
}

// 导出数据
function handleExport() {
  markerStore.exportData()
}

// 导入数据
function handleImport() {
  fileInput.value?.click()
}

// 处理文件选择
async function handleFileSelect(event) {
  const file = event.target.files?.[0]
  if (!file) return

  // 确认导入
  try {
    // 第一步：确认是否导入
    await ElMessageBox.confirm(
      '导入数据将合并到现有数据中。如果存在相同 ID 的标记，您可以选择覆盖或避免覆盖。',
      '确认导入',
      {
        confirmButtonText: '继续',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
    
    // 第二步：选择导入模式
    let avoidOverwrite = false
    try {
      await ElMessageBox.confirm(
        '检测到可能存在相同 ID 的标记，请选择处理方式：\n\n• 点击"避免覆盖"：为重复 ID 的标记生成新 ID，保留现有数据\n• 点击"覆盖"：用导入数据覆盖相同 ID 的标记',
        '选择导入模式',
        {
          confirmButtonText: '避免覆盖',
          cancelButtonText: '覆盖',
          distinguishCancelAndClose: true,
          type: 'warning'
        }
      )
      avoidOverwrite = true
    } catch {
      // 用户选择覆盖模式（点击了"覆盖"按钮）
      avoidOverwrite = false
    }
    
    const importResult = await markerStore.importData(file, { avoidOverwrite })
    if (importResult.success) {
      // 重新渲染标记
      renderMarkers()
    }
  } catch (error) {
    // 用户取消导入（第一步取消）
    if (error !== 'cancel') {
      console.error('导入错误:', error)
    }
  } finally {
    // 清空文件选择，以便可以重复选择同一文件
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}
</script>

<style scoped>
#map-container {
  width: 100%;
  height: 100%;
}

.toolbar {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.9);
  padding: 10px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
</style>
