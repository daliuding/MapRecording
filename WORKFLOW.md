# 项目工作流程详解

本文档以**用户在前端录入一个小区信息**为例，详细讲解数据从 Vue 前端到本地文件系统的完整流程。

## 架构概览

```
┌─────────────────┐
│   Vue 前端      │  (渲染进程)
│  - MapContainer │
│  - MarkerForm   │
│  - markerStore  │
└────────┬────────┘
         │
         │ IPC 通信 (通过 window.electronAPI)
         │
┌────────▼────────┐
│  Preload 脚本   │  (上下文隔离桥接)
│  - preload.js   │
└────────┬────────┘
         │
         │ IPC 消息传递
         │
┌────────▼────────┐
│ Electron 主进程 │  (Node.js 环境)
│  - main.js      │
│  - IPC Handlers │
└────────┬────────┘
         │
         │ 文件系统操作
         │
┌────────▼────────┐
│  本地文件系统   │
│  - markers.json │
└─────────────────┘
```

---

## 完整工作流程（录入小区信息）

### 第一步：Vue 前端 - 用户交互

**位置：** `src/components/MapContainer.vue`

**触发点：** 用户在地图上点击

```javascript
// 第 77-82 行
map.on('click', (e) => {
  clickedPosition.value = [e.lnglat.getLng(), e.lnglat.getLat()]
  selectedMarkerType.value = 'house' // 默认房屋
  editingMarker.value = null
  showForm.value = true  // 显示表单
})
```

**关键代码位置：**
- **第 23-31 行**：`MarkerForm` 组件被渲染，接收点击位置和标记类型
- **第 77-82 行**：地图点击事件监听器

---

### 第二步：Vue 前端 - 表单填写

**位置：** `src/components/MarkerForm.vue`

**用户操作：** 在表单中填写小区信息

**关键代码位置：**

1. **表单数据结构（第 143-148 行）**：
```javascript
const formData = ref({
  type: 'house',      // 或 'community'
  lng: 0,            // 经度
  lat: 0,            // 纬度
  info: {}           // 详细信息对象
})
```

2. **小区信息字段（第 67-109 行）**：
   - 小区名称 (`info.name`)
   - 建筑年代 (`info.build_year`)
   - 物业公司 (`info.property`)
   - 物业费 (`info.property_fee`)
   - 总户数 (`info.total_units`)
   - 备注 (`info.notes`)

3. **保存按钮点击（第 204-231 行）**：
```javascript
async function handleSave() {
  await formRef.value.validate((valid) => {
    if (valid) {
      const markerData = {
        marker: {
          id: formData.value.id,
          type: formData.value.type,
          lng: formData.value.lng,
          lat: formData.value.lat
        },
        info: { ...formData.value.info }
      }
      
      // 清理空值
      Object.keys(markerData.info).forEach(key => {
        if (markerData.info[key] === '' || markerData.info[key] === null) {
          delete markerData.info[key]
        }
      })
      
      emit('save', markerData)  // 触发 save 事件
    }
  })
}
```

**数据格式示例：**
```javascript
{
  marker: {
    id: undefined,           // 新建时为空，由后端生成
    type: 'community',       // 标记类型
    lng: 121.6126,          // 经度
    lat: 38.9122            // 纬度
  },
  info: {
    name: '某某小区',
    build_year: 2010,
    property: '某某物业公司',
    property_fee: 2.5,
    total_units: 500,
    notes: '备注信息'
  }
}
```

---

### 第三步：Vue 前端 - Store 处理

**位置：** `src/components/MapContainer.vue` → `src/stores/markerStore.js`

**数据流向：**

1. **MapContainer 接收保存事件（第 157-165 行）**：
```javascript
async function handleMarkerSave(markerData) {
  const result = await markerStore.saveMarker(markerData)
  if (result.success) {
    showForm.value = false
    editingMarker.value = null
  }
}
```

2. **markerStore.saveMarker 方法（第 70-127 行）**：

**关键代码：**
```javascript
async function saveMarker(markerData) {
  try {
    if (isElectron) {
      // Electron 环境：使用 IPC
      const result = await window.electronAPI.saveMarker(markerData)
      // ↑ 这里调用 IPC 接口
      
      if (result.success) {
        await loadMarkers() // 重新加载所有标记
        ElMessage.success('保存成功')
        return { success: true, id: result.data.id }
      }
    } else {
      // 浏览器环境：使用 localStorage（开发/测试用）
      // ...
    }
  } catch (error) {
    // 错误处理
  }
}
```

**关键位置：**
- **第 6 行**：检测是否在 Electron 环境
- **第 74 行**：调用 `window.electronAPI.saveMarker(markerData)`

---

### 第四步：IPC 通信 - Preload 桥接

**位置：** `electron/preload.js`

**作用：** 在渲染进程（Vue）和主进程（Node.js）之间建立安全的通信桥梁

**关键代码（第 1-10 行）：**
```javascript
import { contextBridge, ipcRenderer } from 'electron'

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  getAllMarkers: () => ipcRenderer.invoke('db:getAllMarkers'),
  saveMarker: (markerData) => ipcRenderer.invoke('db:saveMarker', markerData),
  // ↑ 将 IPC 调用封装为 window.electronAPI.saveMarker
  deleteMarker: (markerId) => ipcRenderer.invoke('db:deleteMarker', markerId),
  getMarker: (markerId) => ipcRenderer.invoke('db:getMarker', markerId)
})
```

**工作原理：**
1. `contextBridge.exposeInMainWorld` 将 API 暴露到 `window.electronAPI`
2. `ipcRenderer.invoke('db:saveMarker', markerData)` 发送 IPC 消息到主进程
3. 主进程处理完成后返回 Promise，前端通过 `await` 等待结果

**数据传递：**
- **发送：** `markerData` 对象（包含 marker 和 info）
- **接收：** `{ success: true, data: { id: '...' } }` 或 `{ success: false, error: '...' }`

---

### 第五步：Electron 主进程 - IPC 处理

**位置：** `electron/main.js`

**IPC 处理器注册（第 135-172 行）：**
```javascript
ipcMain.handle('db:saveMarker', (event, markerData) => {
  try {
    const { marker, info } = markerData
    const now = Date.now()
    
    // 检查标记是否存在
    const index = markersData.markers.findIndex(m => m.id === marker.id)
    
    if (index >= 0 && marker.id) {
      // 更新现有标记
      markersData.markers[index] = {
        ...markersData.markers[index],
        type: marker.type,
        lng: marker.lng,
        lat: marker.lat,
        updated_at: now,
        info: { ...info }
      }
    } else {
      // 插入新标记
      marker.id = marker.id || `marker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      markersData.markers.push({
        id: marker.id,
        type: marker.type,
        lng: marker.lng,
        lat: marker.lat,
        created_at: now,
        updated_at: now,
        info: { ...info }
      })
    }
    
    saveDatabase()  // 保存到文件系统
    return { success: true, data: { id: marker.id } }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
```

**关键位置：**
- **第 1 行**：导入 `ipcMain` 用于处理 IPC 消息
- **第 135 行**：注册 `db:saveMarker` 处理器
- **第 155 行**：生成唯一 ID（如果不存在）
- **第 167 行**：调用 `saveDatabase()` 保存到文件

**内存数据结构（第 32-34 行）：**
```javascript
let markersData = {
  markers: []  // 所有标记的数组
}
```

---

### 第六步：Electron 主进程 - 文件系统操作

**位置：** `electron/main.js`

**文件路径确定（第 12-24 行）：**
```javascript
let dataDir, dbPath

if (app.isPackaged) {
  // 生产模式：使用应用安装目录
  const appPath = dirname(app.getPath('exe'))
  dataDir = join(appPath, 'data')
  dbPath = join(dataDir, 'markers.json')
} else {
  // 开发模式：使用项目根目录
  const projectRoot = join(__dirname, '..')
  dataDir = join(projectRoot, 'data')
  dbPath = join(dataDir, 'markers.json')
}
```

**保存到文件（第 52-58 行）：**
```javascript
function saveDatabase() {
  try {
    writeFileSync(dbPath, JSON.stringify(markersData, null, 2), 'utf-8')
    // ↑ 将内存中的 markersData 对象序列化为 JSON 并写入文件
  } catch (error) {
    console.error('保存数据库失败:', error)
  }
}
```

**文件内容示例：**
```json
{
  "markers": [
    {
      "id": "marker_1234567890_abc123",
      "type": "community",
      "lng": 121.6126,
      "lat": 38.9122,
      "created_at": 1234567890000,
      "updated_at": 1234567890000,
      "info": {
        "name": "某某小区",
        "build_year": 2010,
        "property": "某某物业公司",
        "property_fee": 2.5,
        "total_units": 500,
        "notes": "备注信息"
      }
    }
  ]
}
```

**关键位置：**
- **第 4 行**：导入 Node.js 文件系统模块 `fs`
- **第 27-29 行**：确保数据目录存在
- **第 37-50 行**：初始化数据库（从文件加载）
- **第 52-58 行**：保存数据库（写入文件）

---

## 数据流总结

### 完整数据流图

```
用户点击地图
    ↓
MapContainer.vue (第 77 行)
    ↓ 显示表单
MarkerForm.vue
    ↓ 用户填写信息
用户点击保存按钮
    ↓ emit('save', markerData)
MapContainer.vue (第 157 行)
    ↓ markerStore.saveMarker(markerData)
markerStore.js (第 74 行)
    ↓ window.electronAPI.saveMarker(markerData)
preload.js (第 7 行)
    ↓ ipcRenderer.invoke('db:saveMarker', markerData)
main.js (第 135 行)
    ↓ ipcMain.handle('db:saveMarker')
main.js (第 135-172 行)
    ↓ 处理数据，更新内存中的 markersData
main.js (第 167 行)
    ↓ saveDatabase()
main.js (第 52 行)
    ↓ writeFileSync(dbPath, JSON.stringify(...))
本地文件系统
    ↓ markers.json 文件更新
```

### 关键数据结构

**前端发送的数据：**
```javascript
{
  marker: {
    id: undefined,        // 新建时为空
    type: 'community',    // 'house' 或 'community'
    lng: 121.6126,        // 经度
    lat: 38.9122          // 纬度
  },
  info: {
    name: '某某小区',
    build_year: 2010,
    property: '某某物业公司',
    property_fee: 2.5,
    total_units: 500,
    notes: '备注信息'
  }
}
```

**主进程处理后存储的数据：**
```javascript
{
  id: 'marker_1234567890_abc123',  // 自动生成
  type: 'community',
  lng: 121.6126,
  lat: 38.9122,
  created_at: 1234567890000,       // 时间戳
  updated_at: 1234567890000,       // 时间戳
  info: {
    name: '某某小区',
    build_year: 2010,
    property: '某某物业公司',
    property_fee: 2.5,
    total_units: 500,
    notes: '备注信息'
  }
}
```

---

## 关键文件位置索引

| 功能 | 文件路径 | 关键行数 |
|------|---------|---------|
| 地图容器组件 | `src/components/MapContainer.vue` | 77-82, 157-165 |
| 表单组件 | `src/components/MarkerForm.vue` | 67-109, 204-231 |
| 状态管理 | `src/stores/markerStore.js` | 70-127 |
| IPC 桥接 | `electron/preload.js` | 1-10 |
| 主进程入口 | `electron/main.js` | 135-172, 52-58 |
| 文件存储 | `electron/main.js` | 12-24, 52-58 |

---

## 安全机制说明

1. **上下文隔离（Context Isolation）**：
   - `main.js` 第 66 行：`contextIsolation: true`
   - 渲染进程无法直接访问 Node.js API
   - 必须通过 `preload.js` 暴露的 API

2. **Node 集成禁用**：
   - `main.js` 第 65 行：`nodeIntegration: false`
   - 渲染进程无法直接使用 `require` 等 Node.js 功能

3. **IPC 通信安全**：
   - 使用 `contextBridge` 安全地暴露 API
   - 使用 `ipcRenderer.invoke` 进行双向通信（比 `send/on` 更安全）

---

## 扩展阅读

- **加载数据流程**：`markerStore.loadMarkers()` → `window.electronAPI.getAllMarkers()` → `ipcMain.handle('db:getAllMarkers')` → `readFileSync()`
- **删除数据流程**：类似保存流程，最终调用 `splice()` 和 `saveDatabase()`
- **导入/导出功能**：在浏览器端直接处理文件，不经过 IPC（见 `markerStore.js` 第 166-245 行）
