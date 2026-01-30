# 数据同步功能实现指南

本文档介绍如何为房源记录应用添加多设备数据同步功能。

## 方案选择：GitHub Gist API

### 为什么选择 GitHub Gist？

1. **完全免费**：个人使用无任何限制
2. **简单易用**：只需一个 Personal Access Token
3. **自动版本控制**：每次同步都会保存历史版本
4. **安全可靠**：GitHub 提供，数据加密传输
5. **适合小数据量**：单个 Gist 文件最大 1MB，对于房源记录足够

### 限制说明

- 单个 Gist 文件最大 1MB
- 未认证用户：每小时 60 次请求
- 认证用户：每小时 5000 次请求（足够使用）

## 实现步骤

### 1. 创建 GitHub Personal Access Token

1. 登录 GitHub，进入 **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. 点击 **Generate new token (classic)**
3. 设置名称（如：`MapRecord Sync`）
4. 选择过期时间（建议选择较长时间或永不过期）
5. 勾选权限：**`gist`**（只需要这一个权限）
6. 点击 **Generate token**
7. **重要**：复制生成的 token（只显示一次，请妥善保存）

### 2. 安装依赖

```bash
npm install axios
```

### 3. 实现同步功能

#### 3.1 创建同步服务

创建 `src/services/syncService.js`：

```javascript
import axios from 'axios'

const GIST_API_BASE = 'https://api.github.com/gists'
let gistId = null // 存储 Gist ID
let githubToken = null // 存储 GitHub Token

// 初始化：设置 GitHub Token
export function initSync(token) {
  githubToken = token
  // 从 localStorage 读取已保存的 Gist ID
  if (typeof window !== 'undefined') {
    gistId = localStorage.getItem('maprecord_gist_id')
  }
}

// 获取已保存的 Gist ID
export function getGistId() {
  return gistId
}

// 创建新的 Gist
async function createGist(data) {
  try {
    const response = await axios.post(
      GIST_API_BASE,
      {
        description: '房源记录数据同步',
        public: false, // 私有 Gist
        files: {
          'markers.json': {
            content: JSON.stringify(data, null, 2)
          }
        }
      },
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    )
    gistId = response.data.id
    // 保存 Gist ID 到 localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('maprecord_gist_id', gistId)
    }
    return { success: true, gistId }
  } catch (error) {
    console.error('创建 Gist 失败:', error)
    return { 
      success: false, 
      error: error.response?.data?.message || error.message 
    }
  }
}

// 更新现有 Gist
async function updateGist(data) {
  if (!gistId) {
    return { success: false, error: 'Gist ID 未设置' }
  }
  
  try {
    await axios.patch(
      `${GIST_API_BASE}/${gistId}`,
      {
        description: '房源记录数据同步',
        files: {
          'markers.json': {
            content: JSON.stringify(data, null, 2)
          }
        }
      },
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    )
    return { success: true }
  } catch (error) {
    console.error('更新 Gist 失败:', error)
    // 如果 Gist 不存在，尝试创建新的
    if (error.response?.status === 404) {
      gistId = null
      if (typeof window !== 'undefined') {
        localStorage.removeItem('maprecord_gist_id')
      }
      return createGist(data)
    }
    return { 
      success: false, 
      error: error.response?.data?.message || error.message 
    }
  }
}

// 从 Gist 获取数据
export async function syncFromCloud() {
  if (!githubToken) {
    return { success: false, error: '未设置 GitHub Token' }
  }
  
  if (!gistId) {
    return { success: false, error: '未找到同步数据，请先上传数据' }
  }
  
  try {
    const response = await axios.get(
      `${GIST_API_BASE}/${gistId}`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    )
    
    const file = response.data.files['markers.json']
    if (!file) {
      return { success: false, error: 'Gist 中未找到数据文件' }
    }
    
    const data = JSON.parse(file.content)
    return { success: true, data }
  } catch (error) {
    console.error('从云端同步失败:', error)
    return { 
      success: false, 
      error: error.response?.data?.message || error.message 
    }
  }
}

// 上传数据到云端
export async function syncToCloud(markersData) {
  if (!githubToken) {
    return { success: false, error: '未设置 GitHub Token' }
  }
  
  const data = {
    markers: markersData,
    syncTime: new Date().toISOString(),
    version: '1.0'
  }
  
  if (gistId) {
    return updateGist(data)
  } else {
    return createGist(data)
  }
}

// 检查同步状态
export async function checkSyncStatus() {
  if (!githubToken || !gistId) {
    return { synced: false }
  }
  
  try {
    const response = await axios.get(
      `${GIST_API_BASE}/${gistId}`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    )
    
    const file = response.data.files['markers.json']
    if (file) {
      const data = JSON.parse(file.content)
      return { 
        synced: true, 
        lastSync: response.data.updated_at,
        markerCount: data.markers?.length || 0
      }
    }
    return { synced: false }
  } catch (error) {
    return { synced: false, error: error.message }
  }
}
```

#### 3.2 更新 Store

在 `src/stores/markerStore.js` 中添加同步方法：

```javascript
import { syncFromCloud, syncToCloud, initSync, getGistId, checkSyncStatus } from '../services/syncService'

// 在 store 中添加：
async function syncToCloud() {
  try {
    const result = await syncToCloud(markers.value)
    if (result.success) {
      ElMessage.success('数据已同步到云端')
      return { success: true }
    } else {
      ElMessage.error('同步失败: ' + result.error)
      return { success: false, error: result.error }
    }
  } catch (error) {
    ElMessage.error('同步错误: ' + error.message)
    return { success: false, error: error.message }
  }
}

async function syncFromCloud() {
  try {
    const result = await syncFromCloud()
    if (result.success) {
      // 合并数据
      const markerMap = new Map()
      markers.value.forEach(m => markerMap.set(m.id, m))
      result.data.markers?.forEach(m => markerMap.set(m.id, m))
      markers.value = Array.from(markerMap.values())
      
      // 保存到本地
      if (isElectron) {
        // Electron 环境：批量保存
        for (const marker of markers.value) {
          await window.electronAPI.saveMarker({
            marker: {
              id: marker.id,
              type: marker.type,
              lng: marker.lng,
              lat: marker.lat
            },
            info: marker.info || {}
          })
        }
      } else {
        saveToLocalStorage(markers.value)
      }
      
      ElMessage.success('数据已从云端同步')
      return { success: true, count: result.data.markers?.length || 0 }
    } else {
      ElMessage.error('同步失败: ' + result.error)
      return { success: false, error: result.error }
    }
  } catch (error) {
    ElMessage.error('同步错误: ' + error.message)
    return { success: false, error: error.message }
  }
}

// 在 return 中导出：
return {
  // ... 其他方法
  syncToCloud,
  syncFromCloud,
  initSync,
  getGistId,
  checkSyncStatus
}
```

#### 3.3 添加同步 UI

在 `src/components/MapContainer.vue` 中添加同步按钮和设置对话框：

```vue
<template>
  <!-- ... 现有代码 ... -->
  
  <!-- 同步按钮 -->
  <el-button-group>
    <el-button type="primary" @click="handleExport" :icon="Download">
      导出数据
    </el-button>
    <el-button type="success" @click="handleImport" :icon="Upload">
      导入数据
    </el-button>
    <el-button type="warning" @click="handleSyncToCloud" :icon="CloudUpload">
      上传到云端
    </el-button>
    <el-button type="info" @click="handleSyncFromCloud" :icon="CloudDownload">
      从云端下载
    </el-button>
    <el-button type="default" @click="showSyncSettings = true" :icon="Setting">
      同步设置
    </el-button>
  </el-button-group>
  
  <!-- 同步设置对话框 -->
  <el-dialog v-model="showSyncSettings" title="同步设置" width="500px">
    <el-form>
      <el-form-item label="GitHub Token">
        <el-input
          v-model="githubToken"
          type="password"
          placeholder="输入 GitHub Personal Access Token"
          show-password
        />
        <el-text type="info" size="small" style="display: block; margin-top: 5px;">
          在 GitHub Settings → Developer settings → Personal access tokens 创建
        </el-text>
      </el-form-item>
      <el-form-item v-if="gistId" label="Gist ID">
        <el-input v-model="gistId" disabled />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="showSyncSettings = false">取消</el-button>
      <el-button type="primary" @click="saveSyncSettings">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { CloudUpload, CloudDownload, Setting } from '@element-plus/icons-vue'

const showSyncSettings = ref(false)
const githubToken = ref('')
const gistId = ref('')

// 加载已保存的设置
onMounted(() => {
  if (typeof window !== 'undefined') {
    githubToken.value = localStorage.getItem('maprecord_github_token') || ''
    gistId.value = markerStore.getGistId() || ''
  }
})

// 保存同步设置
function saveSyncSettings() {
  if (!githubToken.value) {
    ElMessage.warning('请输入 GitHub Token')
    return
  }
  
  localStorage.setItem('maprecord_github_token', githubToken.value)
  markerStore.initSync(githubToken.value)
  showSyncSettings.value = false
  ElMessage.success('设置已保存')
}

// 上传到云端
async function handleSyncToCloud() {
  if (!markerStore.getGistId() && !localStorage.getItem('maprecord_github_token')) {
    ElMessage.warning('请先设置 GitHub Token')
    showSyncSettings.value = true
    return
  }
  
  await markerStore.syncToCloud()
}

// 从云端下载
async function handleSyncFromCloud() {
  if (!localStorage.getItem('maprecord_github_token')) {
    ElMessage.warning('请先设置 GitHub Token')
    showSyncSettings.value = true
    return
  }
  
  await ElMessageBox.confirm(
    '从云端同步将合并到现有数据中（相同 ID 的标记会被覆盖）。是否继续？',
    '确认同步',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
  
  const result = await markerStore.syncFromCloud()
  if (result.success) {
    renderMarkers()
  }
}
</script>
```

### 4. 自动同步（可选）

可以在保存标记时自动同步到云端：

```javascript
// 在 markerStore.js 的 saveMarker 方法中
async function saveMarker(markerData) {
  // ... 现有保存逻辑 ...
  
  // 如果已设置同步，自动上传
  if (getGistId() && localStorage.getItem('maprecord_github_token')) {
    await syncToCloud(markers.value)
  }
  
  return result
}
```

## 使用流程

### 首次设置（机器 A）

1. 打开应用，点击"同步设置"
2. 输入 GitHub Personal Access Token
3. 点击"保存"
4. 点击"上传到云端"，将本地数据上传

### 在其他机器（机器 B）使用

1. 打开应用，点击"同步设置"
2. 输入**相同的** GitHub Personal Access Token
3. 点击"保存"
4. 点击"从云端下载"，下载云端数据

### 日常使用

- **自动同步**：每次保存标记时自动上传到云端
- **手动同步**：点击"上传到云端"或"从云端下载"按钮
- **双向同步**：支持多设备，最后保存的数据会覆盖旧数据

## 注意事项

1. **Token 安全**：
   - Token 存储在本地 localStorage，不会上传到服务器
   - 不要将 Token 分享给他人
   - 如果 Token 泄露，立即在 GitHub 撤销并重新生成

2. **数据冲突**：
   - 当前实现采用"最后写入获胜"策略
   - 如果需要更复杂的冲突解决，可以考虑添加时间戳比较

3. **网络要求**：
   - 同步需要网络连接
   - 如果网络不稳定，建议先导出备份

4. **数据大小**：
   - 单个 Gist 文件最大 1MB
   - 如果数据超过限制，考虑分批存储或使用其他方案

## 其他同步方案

如果需要更强大的功能，可以考虑：

- **Firebase**：实时同步，离线支持
- **Supabase**：PostgreSQL 数据库，功能更强大
- **WebDAV**：使用现有网盘服务

这些方案的实现方式类似，主要是 API 调用不同。
