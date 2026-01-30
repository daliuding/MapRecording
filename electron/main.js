import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 数据库文件路径（使用 JSON 文件）
// 开发模式：使用项目根目录下的 data 文件夹
// 生产模式：使用应用安装目录下的 data 文件夹（可写位置）
let dataDir, dbPath

if (app.isPackaged) {
  // 生产模式：使用应用安装目录（可执行文件所在目录）
  const appPath = dirname(app.getPath('exe'))
  dataDir = join(appPath, 'data')
  dbPath = join(dataDir, 'markers.json')
} else {
  // 开发模式：使用项目根目录
  const projectRoot = join(__dirname, '..')
  dataDir = join(projectRoot, 'data')
  dbPath = join(dataDir, 'markers.json')
}

// 确保数据目录存在
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

// 数据存储
let markersData = {
  markers: []
}

// 初始化数据库
function initDatabase() {
  try {
    if (existsSync(dbPath)) {
      const data = readFileSync(dbPath, 'utf-8')
      markersData = JSON.parse(data)
    } else {
      saveDatabase()
    }
  } catch (error) {
    console.error('加载数据库失败:', error)
    markersData = { markers: [] }
    saveDatabase()
  }
}

function saveDatabase() {
  try {
    writeFileSync(dbPath, JSON.stringify(markersData, null, 2), 'utf-8')
  } catch (error) {
    console.error('保存数据库失败:', error)
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js')
    }
  })

  // 开发环境加载本地服务器，生产环境加载构建文件
  // 检查是否为开发模式（通过检查是否有 dist 目录或环境变量）
  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development'
  
  if (isDev) {
    // 开发模式：等待 Vite 服务器启动后加载
    const devUrl = 'http://localhost:5173'
    win.loadURL(devUrl).catch(err => {
      console.error('加载开发服务器失败:', err)
      // 如果加载失败，等待一下再重试
      setTimeout(() => {
        win.loadURL(devUrl).catch(e => {
          console.error('重试加载失败:', e)
        })
      }, 2000)
    })
    win.webContents.openDevTools()
  } else {
    // 生产模式：加载构建文件
    win.loadFile(join(__dirname, '../dist/index.html'))
  }
  
  // 监听页面加载错误
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('页面加载失败:', errorCode, errorDescription)
    if (isDev) {
      // 开发模式下，如果加载失败，等待后重试
      setTimeout(() => {
        win.loadURL('http://localhost:5173')
      }, 2000)
    }
  })
}

app.whenReady().then(() => {
  initDatabase()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    saveDatabase()
    app.quit()
  }
})

// IPC 处理程序 - 数据库操作
ipcMain.handle('db:getAllMarkers', () => {
  try {
    const result = markersData.markers.map(marker => {
      return { ...marker }
    })
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('db:saveMarker', (event, markerData) => {
  try {
    const { marker, info } = markerData
    const now = Date.now()
    
    // 检查标记是否存在
    const index = markersData.markers.findIndex(m => m.id === marker.id)
    
    if (index >= 0 && marker.id) {
      // 更新
      markersData.markers[index] = {
        ...markersData.markers[index],
        type: marker.type,
        lng: marker.lng,
        lat: marker.lat,
        updated_at: now,
        info: { ...info }
      }
    } else {
      // 插入
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
    
    saveDatabase()
    return { success: true, data: { id: marker.id } }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('db:deleteMarker', (event, markerId) => {
  try {
    const index = markersData.markers.findIndex(m => m.id === markerId)
    if (index >= 0) {
      markersData.markers.splice(index, 1)
      saveDatabase()
      return { success: true }
    }
    return { success: false, error: 'Marker not found' }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('db:getMarker', (event, markerId) => {
  try {
    const marker = markersData.markers.find(m => m.id === markerId)
    if (!marker) {
      return { success: false, error: 'Marker not found' }
    }
    return { success: true, data: { ...marker } }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
