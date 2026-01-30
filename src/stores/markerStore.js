import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

// 检查是否在 Electron 环境中
const isElectron = typeof window !== 'undefined' && window.electronAPI

// 浏览器环境下的 localStorage 存储键
const STORAGE_KEY = 'map-record-markers'

export const useMarkerStore = defineStore('marker', () => {
  const markers = ref([])
  const loading = ref(false)

  // 浏览器环境：从 localStorage 加载
  function loadFromLocalStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) {
        const parsed = JSON.parse(data)
        return parsed.markers || []
      }
    } catch (error) {
      console.error('从 localStorage 加载失败:', error)
    }
    return []
  }

  // 浏览器环境：保存到 localStorage
  function saveToLocalStorage(markersData) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ markers: markersData }))
      return true
    } catch (error) {
      console.error('保存到 localStorage 失败:', error)
      return false
    }
  }

  // 加载所有标记
  async function loadMarkers() {
    loading.value = true
    try {
      if (isElectron) {
        // Electron 环境：使用 IPC
        const result = await window.electronAPI.getAllMarkers()
        if (result.success) {
          markers.value = result.data
        } else {
          console.error('加载标记失败:', result.error)
          ElMessage.error('加载标记失败: ' + result.error)
        }
      } else {
        // 浏览器环境：使用 localStorage
        markers.value = loadFromLocalStorage()
      }
    } catch (error) {
      console.error('加载标记错误:', error)
      ElMessage.error('加载标记错误: ' + error.message)
      if (!isElectron) {
        // 浏览器环境失败时，尝试从 localStorage 加载
        markers.value = loadFromLocalStorage()
      }
    } finally {
      loading.value = false
    }
  }

  // 保存标记
  async function saveMarker(markerData) {
    try {
      if (isElectron) {
        // Electron 环境：使用 IPC
        const result = await window.electronAPI.saveMarker(markerData)
        if (result.success) {
          await loadMarkers() // 重新加载
          ElMessage.success('保存成功')
          return { success: true, id: result.data.id }
        } else {
          ElMessage.error('保存失败: ' + result.error)
          return { success: false, error: result.error }
        }
      } else {
        // 浏览器环境：使用 localStorage
        const { marker, info } = markerData
        const now = Date.now()
        
        // 检查标记是否存在
        const index = markers.value.findIndex(m => m.id === marker.id)
        
        if (index >= 0 && marker.id) {
          // 更新
          markers.value[index] = {
            ...markers.value[index],
            type: marker.type,
            lng: marker.lng,
            lat: marker.lat,
            updated_at: now,
            info: { ...info }
          }
        } else {
          // 插入
          marker.id = marker.id || `marker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          markers.value.push({
            id: marker.id,
            type: marker.type,
            lng: marker.lng,
            lat: marker.lat,
            created_at: now,
            updated_at: now,
            info: { ...info }
          })
        }
        
        if (saveToLocalStorage(markers.value)) {
          ElMessage.success('保存成功（浏览器模式）')
          return { success: true, id: marker.id }
        } else {
          ElMessage.error('保存到本地存储失败')
          return { success: false, error: '保存到本地存储失败' }
        }
      }
    } catch (error) {
      ElMessage.error('保存错误: ' + error.message)
      return { success: false, error: error.message }
    }
  }

  // 删除标记
  async function deleteMarker(markerId) {
    try {
      if (isElectron) {
        // Electron 环境：使用 IPC
        const result = await window.electronAPI.deleteMarker(markerId)
        if (result.success) {
          markers.value = markers.value.filter(m => m.id !== markerId)
          ElMessage.success('删除成功')
          return { success: true }
        } else {
          ElMessage.error('删除失败: ' + result.error)
          return { success: false, error: result.error }
        }
      } else {
        // 浏览器环境：使用 localStorage
        markers.value = markers.value.filter(m => m.id !== markerId)
        if (saveToLocalStorage(markers.value)) {
          ElMessage.success('删除成功（浏览器模式）')
          return { success: true }
        } else {
          ElMessage.error('删除失败')
          return { success: false, error: '删除失败' }
        }
      }
    } catch (error) {
      ElMessage.error('删除错误: ' + error.message)
      return { success: false, error: error.message }
    }
  }

  // 获取标记
  function getMarkerById(markerId) {
    return markers.value.find(m => m.id === markerId)
  }

  // 导出数据（生成 JSON 文件）
  function exportData() {
    try {
      const data = {
        markers: markers.value,
        exportTime: new Date().toISOString(),
        version: '1.0'
      }
      const jsonStr = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `map-record-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      ElMessage.success('数据导出成功')
      return { success: true }
    } catch (error) {
      ElMessage.error('导出失败: ' + error.message)
      return { success: false, error: error.message }
    }
  }

  // 生成唯一 ID
  function generateUniqueId() {
    return `marker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 导入数据（从 JSON 文件）
  async function importData(file, options = {}) {
    const { avoidOverwrite = false } = options
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result)
          const importedMarkers = data.markers || []
          
          if (!Array.isArray(importedMarkers)) {
            throw new Error('数据格式错误：markers 必须是数组')
          }

          // 获取现有标记的 ID 集合
          const existingIds = new Set(markers.value.map(m => m.id))
          
          // 统计新增和覆盖的数量
          let newCount = 0
          let overwrittenCount = 0

          if (isElectron) {
            // Electron 环境：通过 IPC 批量保存
            for (const marker of importedMarkers) {
              let finalId = marker.id
              let isDuplicate = existingIds.has(finalId)
              
              if (isDuplicate) {
                if (avoidOverwrite) {
                  // 避免覆盖：生成新 ID
                  finalId = generateUniqueId()
                  newCount++
                } else {
                  // 覆盖现有标记
                  overwrittenCount++
                }
              } else {
                newCount++
              }
              
              await window.electronAPI.saveMarker({
                marker: {
                  id: finalId,
                  type: marker.type,
                  lng: marker.lng,
                  lat: marker.lat
                },
                info: marker.info || {}
              })
              
              // 更新 ID 集合（将最终使用的 ID 添加到集合中，以便后续检查）
              existingIds.add(finalId)
            }
            await loadMarkers()
          } else {
            // 浏览器环境：合并到现有数据
            const markerMap = new Map()
            // 先添加现有标记
            markers.value.forEach(m => markerMap.set(m.id, m))
            
            // 处理导入的标记
            importedMarkers.forEach(m => {
              let finalId = m.id
              let isDuplicate = markerMap.has(finalId)
              
              if (isDuplicate) {
                if (avoidOverwrite) {
                  // 避免覆盖：生成新 ID
                  finalId = generateUniqueId()
                  newCount++
                } else {
                  // 覆盖现有标记
                  overwrittenCount++
                }
              } else {
                newCount++
              }
              
              // 使用新 ID 创建标记
              markerMap.set(finalId, {
                ...m,
                id: finalId
              })
            })
            
            markers.value = Array.from(markerMap.values())
            saveToLocalStorage(markers.value)
          }
          
          // 显示导入结果
          let message = `成功导入 ${importedMarkers.length} 条标记`
          if (avoidOverwrite) {
            if (overwrittenCount > 0) {
              message += `（新增 ${newCount} 条，${overwrittenCount} 条重复已生成新 ID）`
            } else {
              message += `（新增 ${newCount} 条）`
            }
          } else {
            if (overwrittenCount > 0) {
              message += `（新增 ${newCount} 条，覆盖 ${overwrittenCount} 条）`
            } else {
              message += `（新增 ${newCount} 条）`
            }
          }
          ElMessage.success(message)
          
          resolve({ 
            success: true, 
            count: importedMarkers.length,
            newCount,
            overwrittenCount
          })
        } catch (error) {
          ElMessage.error('导入失败: ' + error.message)
          resolve({ success: false, error: error.message })
        }
      }
      reader.onerror = () => {
        ElMessage.error('文件读取失败')
        resolve({ success: false, error: '文件读取失败' })
      }
      reader.readAsText(file)
    })
  }

  return {
    markers,
    loading,
    loadMarkers,
    saveMarker,
    deleteMarker,
    getMarkerById,
    exportData,
    importData
  }
})
