import { contextBridge, ipcRenderer } from 'electron'

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 数据库操作
  getAllMarkers: () => ipcRenderer.invoke('db:getAllMarkers'),
  saveMarker: (markerData) => ipcRenderer.invoke('db:saveMarker', markerData),
  deleteMarker: (markerId) => ipcRenderer.invoke('db:deleteMarker', markerId),
  getMarker: (markerId) => ipcRenderer.invoke('db:getMarker', markerId)
})
