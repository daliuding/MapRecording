# Electron 进程架构与 IPC 通信详解

## 一、Electron 的进程架构

### 1. 主进程（Main Process）

**定义：** Electron 应用的核心进程，负责管理应用的生命周期和创建窗口。

**特点：**
- ✅ 只有一个主进程（整个应用只有一个）
- ✅ 可以访问 Node.js 的所有 API（`fs`、`path`、`os` 等）
- ✅ 可以操作文件系统、创建窗口、注册 IPC 处理器
- ✅ 运行在 Node.js 环境中

**在你的项目中：**
- **文件位置：** `electron/main.js`
- **主要职责：**
  1. 创建应用窗口（`createWindow()`）
  2. 管理应用生命周期（启动、关闭）
  3. 处理 IPC 消息（`ipcMain.handle()`）
  4. 操作文件系统（读取/写入 `markers.json`）

**代码示例：**
```javascript
// electron/main.js
import { app, BrowserWindow, ipcMain } from 'electron'
import { writeFileSync } from 'fs'

// 这是主进程代码
app.whenReady().then(() => {
  createWindow()  // 创建窗口
})

// 注册 IPC 处理器（主进程监听来自渲染进程的消息）
ipcMain.handle('db:saveMarker', (event, markerData) => {
  // 可以访问 Node.js API
  writeFileSync('data/markers.json', JSON.stringify(data))
  return { success: true }
})
```

---

### 2. 渲染进程（Renderer Process）

**定义：** 每个窗口都是一个独立的渲染进程，负责显示网页内容。

**特点：**
- ✅ 可以有多个渲染进程（每个窗口一个）
- ✅ 运行在浏览器环境中（类似 Chrome 浏览器标签页）
- ✅ 可以运行 HTML、CSS、JavaScript（包括 Vue、React 等框架）
- ❌ **不能直接访问 Node.js API**（出于安全考虑）
- ❌ 不能直接操作文件系统

**在你的项目中：**
- **文件位置：** `src/` 目录下的所有 Vue 文件
- **主要职责：**
  1. 显示用户界面（Vue 组件）
  2. 处理用户交互（点击、输入等）
  3. 通过 IPC 与主进程通信

**代码示例：**
```javascript
// src/stores/markerStore.js
// 这是渲染进程代码（Vue 应用运行在这里）

// ❌ 这样不行！渲染进程不能直接使用 Node.js API
// const fs = require('fs')  // 错误！

// ✅ 必须通过 IPC 与主进程通信
const result = await window.electronAPI.saveMarker(markerData)
```

---

### 3. 进程关系图

```
┌─────────────────────────────────────────┐
│          Electron 应用                  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │      主进程 (Main Process)        │  │
│  │  - electron/main.js               │  │
│  │  - 可以访问 Node.js API           │  │
│  │  - 可以操作文件系统               │  │
│  │  - 创建和管理窗口                 │  │
│  └──────────────┬───────────────────┘  │
│                 │                        │
│                 │ 创建窗口                │
│                 │                        │
│  ┌──────────────▼───────────────────┐  │
│  │   渲染进程 (Renderer Process)    │  │
│  │  - src/ 目录下的 Vue 代码        │  │
│  │  - 显示用户界面                  │  │
│  │  - 不能直接访问 Node.js API      │  │
│  │  - 通过 IPC 与主进程通信         │  │
│  └──────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

---

## 二、为什么需要两个进程？

### 安全考虑

如果渲染进程可以直接访问 Node.js API，网页中的恶意代码就可以：
- ❌ 删除你的文件
- ❌ 读取你的密码
- ❌ 执行系统命令
- ❌ 访问你的所有数据

**解决方案：** 将危险操作隔离在主进程中，渲染进程只能通过受控的 IPC 通道与主进程通信。

---

## 三、IPC 通信机制

### IPC 是什么？

**IPC = Inter-Process Communication（进程间通信）**

主进程和渲染进程之间传递消息的机制。

### 通信流程

```
渲染进程 (Vue)                   主进程 (Node.js)
     │                                │
     │  1. 发送消息                    │
     │  ipcRenderer.invoke()          │
     │  ────────────────────────────> │
     │                                │  2. 接收消息
     │                                │  ipcMain.handle()
     │                                │  3. 处理业务逻辑
     │                                │  4. 返回结果
     │  5. 接收结果                    │
     │  <──────────────────────────── │
     │                                │
```

---

## 四、`ipcRenderer.invoke('db:saveMarker', markerData)` 详解

### 1. 代码位置

**发送端（渲染进程）：**
```javascript
// electron/preload.js 第 7 行
saveMarker: (markerData) => ipcRenderer.invoke('db:saveMarker', markerData)
```

**接收端（主进程）：**
```javascript
// electron/main.js 第 135 行
ipcMain.handle('db:saveMarker', (event, markerData) => {
  // 处理逻辑
  return { success: true, data: { id: marker.id } }
})
```

### 2. 参数解释

```javascript
ipcRenderer.invoke('db:saveMarker', markerData)
            │        │                │
            │        │                └─ 传递的数据（第二个参数）
            │        └─ 消息通道名称（第一个参数）
            └─ 方法名：发送 IPC 消息并等待响应
```

- **`'db:saveMarker'`**：消息通道名称（类似函数名），主进程必须注册同名的处理器
- **`markerData`**：要传递的数据对象
- **返回值**：Promise，主进程返回的结果

### 3. 完整执行流程

```javascript
// ========== 渲染进程（Vue）==========
// src/stores/markerStore.js 第 74 行
const result = await window.electronAPI.saveMarker(markerData)
//            │
//            └─ 调用 preload.js 暴露的 API

// ========== Preload 桥接层 ==========
// electron/preload.js 第 7 行
saveMarker: (markerData) => ipcRenderer.invoke('db:saveMarker', markerData)
//                          │
//                          └─ 发送 IPC 消息到主进程

// ========== 主进程 ==========
// electron/main.js 第 135 行
ipcMain.handle('db:saveMarker', (event, markerData) => {
//           │    │                │      │
//           │    │                │      └─ 接收到的数据
//           │    │                └─ 事件对象
//           │    └─ 消息通道名称（必须与 invoke 的第一个参数匹配）
//           └─ 注册 IPC 处理器
  
  // 处理业务逻辑
  const { marker, info } = markerData
  // ... 保存数据到内存
  saveDatabase()  // 保存到文件
  
  // 返回结果（会自动发送回渲染进程）
  return { success: true, data: { id: marker.id } }
})

// ========== 渲染进程接收结果 ==========
// result = { success: true, data: { id: 'marker_xxx' } }
if (result.success) {
  ElMessage.success('保存成功')
}
```

### 4. 为什么使用 `invoke` 而不是 `send`？

| 方法 | 特点 | 使用场景 |
|------|------|---------|
| `ipcRenderer.invoke()` | ✅ 双向通信（发送+接收响应）<br>✅ 返回 Promise<br>✅ 更安全 | **推荐使用**<br>需要等待处理结果的场景 |
| `ipcRenderer.send()` | ❌ 单向通信（只发送）<br>❌ 不返回结果<br>❌ 需要配合 `ipcMain.on()` | 只需要发送通知，不需要响应 |

**示例对比：**

```javascript
// ✅ 使用 invoke（推荐）
const result = await ipcRenderer.invoke('db:saveMarker', data)
// result 包含主进程返回的数据

// ❌ 使用 send（不推荐，需要额外监听）
ipcRenderer.send('db:saveMarker', data)
ipcRenderer.on('db:saveMarker-reply', (event, result) => {
  // 处理结果
})
```

---

## 五、Preload 脚本的作用

### 为什么需要 Preload？

由于安全限制，渲染进程不能直接使用 `ipcRenderer`。Preload 脚本在**特殊的上下文中运行**，可以访问 Electron API，然后通过 `contextBridge` 安全地暴露给渲染进程。

### Preload 工作流程

```
┌─────────────────────────────────────┐
│  渲染进程 (Vue)                      │
│  window.electronAPI.saveMarker()    │
└──────────────┬──────────────────────┘
               │
               │ 调用
               │
┌──────────────▼──────────────────────┐
│  Preload 脚本 (preload.js)          │
│  - 可以访问 ipcRenderer             │
│  - 通过 contextBridge 暴露 API      │
│  - 作为安全桥梁                      │
└──────────────┬──────────────────────┘
               │
               │ IPC 消息
               │
┌──────────────▼──────────────────────┐
│  主进程 (main.js)                   │
│  ipcMain.handle()                   │
└─────────────────────────────────────┘
```

### 代码解析

```javascript
// electron/preload.js
import { contextBridge, ipcRenderer } from 'electron'

// contextBridge：安全地将 API 暴露到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 将 ipcRenderer.invoke 封装为普通函数
  saveMarker: (markerData) => ipcRenderer.invoke('db:saveMarker', markerData)
  //     │                      │
  //     │                      └─ 实际的 IPC 调用
  //     └─ 暴露为 window.electronAPI.saveMarker
})
```

**结果：** 在 Vue 代码中可以直接使用 `window.electronAPI.saveMarker()`，而不需要直接操作 `ipcRenderer`。

---

## 六、完整示例：保存小区信息

### 步骤 1：用户在 Vue 表单中填写信息

```javascript
// src/components/MarkerForm.vue
// 用户填写小区名称、建筑年代等信息
const markerData = {
  marker: { type: 'community', lng: 121.6126, lat: 38.9122 },
  info: { name: '某某小区', build_year: 2010 }
}
emit('save', markerData)
```

### 步骤 2：Store 调用 IPC

```javascript
// src/stores/markerStore.js
const result = await window.electronAPI.saveMarker(markerData)
//            │
//            └─ 这是 Preload 暴露的 API
```

### 步骤 3：Preload 转发 IPC 消息

```javascript
// electron/preload.js
saveMarker: (markerData) => ipcRenderer.invoke('db:saveMarker', markerData)
//                          │
//                          └─ 发送到主进程，等待响应
```

### 步骤 4：主进程处理

```javascript
// electron/main.js
ipcMain.handle('db:saveMarker', (event, markerData) => {
  // 1. 接收数据
  const { marker, info } = markerData
  
  // 2. 处理业务逻辑（保存到内存）
  markersData.markers.push({ ... })
  
  // 3. 保存到文件系统
  saveDatabase()  // 使用 Node.js fs 模块
  
  // 4. 返回结果
  return { success: true, data: { id: marker.id } }
})
```

### 步骤 5：结果返回渲染进程

```javascript
// src/stores/markerStore.js
// result = { success: true, data: { id: 'marker_xxx' } }
if (result.success) {
  ElMessage.success('保存成功')
}
```

---

## 七、关键概念总结

| 概念 | 说明 | 位置 |
|------|------|------|
| **主进程** | 应用的核心，可以访问 Node.js API | `electron/main.js` |
| **渲染进程** | 显示界面，运行 Vue 代码 | `src/` 目录 |
| **IPC** | 进程间通信机制 | `ipcRenderer` / `ipcMain` |
| **Preload** | 安全桥接层，暴露 API 给渲染进程 | `electron/preload.js` |
| **invoke** | 发送 IPC 消息并等待响应 | `ipcRenderer.invoke()` |
| **handle** | 注册 IPC 处理器，接收消息并返回结果 | `ipcMain.handle()` |

---

## 八、常见问题

### Q1: 为什么渲染进程不能直接使用 `require('fs')`？

**A:** 出于安全考虑。如果网页中的 JavaScript 可以直接访问文件系统，恶意网站就可以删除你的文件。Electron 通过进程隔离来防止这种情况。

### Q2: 可以创建多个主进程吗？

**A:** 不可以。每个 Electron 应用只有一个主进程，但可以有多个渲染进程（多个窗口）。

### Q3: `invoke` 和 `send` 的区别？

**A:** 
- `invoke`：双向通信，返回 Promise，推荐使用
- `send`：单向通信，不返回结果，需要配合 `on` 监听

### Q4: Preload 脚本必须吗？

**A:** 在现代 Electron 应用中，是的。因为 `contextIsolation: true` 和 `nodeIntegration: false` 是推荐的安全设置，Preload 是唯一的安全桥梁。
