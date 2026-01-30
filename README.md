# 房源记录 - 桌面应用

基于 Electron + Vue 3 + SQLite 的大连市区看房记录桌面应用。

## 功能特性

- 🗺️ 高德地图集成，支持缩放和拖拽
- 📍 点击地图创建标记（房屋/小区）
- 🏠 房屋标记：记录小区名称、楼栋、楼层、电梯、户型、价格、面积等信息
- 🏘️ 小区标记：记录小区名称、建筑年代、物业、物业费等信息
- 💾 JSON 文件持久化存储（Electron）或 localStorage（浏览器）
- 🎨 不同类型标记颜色区分（房屋：蓝色，小区：绿色）
- ✏️ 支持编辑和删除标记
- 📤 支持数据导出/导入，方便数据迁移和备份

## 技术栈

- **前端框架**: Vue 3 (Composition API)
- **构建工具**: Vite
- **桌面框架**: Electron
- **数据存储**: JSON 文件（无需编译，易于迁移）
- **UI 组件**: Element Plus
- **状态管理**: Pinia
- **地图服务**: 高德地图 API

## 开发

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run electron:dev
```

这将同时启动 Vite 开发服务器和 Electron 应用。

### 构建

```bash
npm run electron:build
```

构建完成后，可执行文件在 `release/` 目录。

### 打包分发

要将应用打包成 Windows 安装程序，供其他没有安装依赖的机器使用，请参考：

📦 **[打包与分发指南](./DISTRIBUTION.md)** - 详细说明如何打包和分发应用

**快速步骤**：
1. 执行 `npm run electron:build`
2. 在 `release/` 目录找到 `房源记录 Setup 1.0.0.exe`
3. 将此文件分发给用户，用户双击即可安装使用

**注意**：用户机器无需安装 Node.js 或其他任何依赖，只需要 Windows 操作系统。

## 数据存储与迁移

### Electron 环境

数据文件存储位置（JSON 格式）：

**开发模式**：
- 路径：项目根目录下的 `data/markers.json`
- 示例：`E:\self\tech study\github\MapRecord\data\markers.json`

**生产模式（打包后的应用）**：
- 路径：应用安装目录下的 `data/markers.json`
- 示例：`C:\Users\Administrator\AppData\Local\Programs\map-record\data\markers.json`
- 或者：`C:\Program Files\房源记录\data\markers.json`（取决于安装位置）

**迁移方法**：
1. 直接复制：将 `data/markers.json` 文件复制到新机器的对应目录下的 `data` 文件夹即可
2. 使用导出/导入功能：点击右上角工具栏的"导出数据"按钮，在新机器上使用"导入数据"按钮导入

### 浏览器环境

数据存储在浏览器的 `localStorage` 中，不能直接迁移到另一台机器。

**迁移方法**：
1. 点击右上角工具栏的"导出数据"按钮，下载 JSON 文件
2. 在新机器/浏览器上打开应用
3. 点击"导入数据"按钮，选择之前导出的 JSON 文件
4. 数据会自动合并到现有数据中（相同 ID 的标记会被覆盖）

**注意**：浏览器环境的数据仅存储在本地浏览器中，清除浏览器数据会导致数据丢失，建议定期导出备份。

## 项目结构

```
MapRecord/
├── electron/          # Electron 主进程
│   ├── main.js       # 主进程入口
│   └── preload.js    # 预加载脚本
├── src/
│   ├── components/   # Vue 组件
│   ├── stores/       # Pinia 状态管理
│   ├── App.vue       # 根组件
│   └── main.js       # 应用入口
├── index.html        # HTML 模板
└── package.json      # 项目配置
```

## 为什么不需要后端服务器？

这个项目是一个**桌面应用**（Electron），不需要额外的后端服务器，原因如下：

1. **Electron 主进程已运行在 Node.js 环境**：
   - `electron/main.js` 运行在 Node.js 环境中，可以直接访问文件系统
   - 通过 IPC（进程间通信）与渲染进程（Vue 前端）进行数据交互

2. **数据存储在本地**：
   - 数据以 JSON 文件形式存储在本地磁盘（`data/markers.json`）
   - 所有 CRUD 操作都在本地完成，无需网络请求

3. **架构设计**：
   ```
   渲染进程（Vue） ←→ IPC ←→ 主进程（Node.js） ←→ 本地文件系统
   ```
   - 前端通过 `window.electronAPI` 调用主进程的 IPC 方法
   - 主进程直接读写本地 JSON 文件
   - 无需 HTTP 服务器、数据库服务器等

4. **优势**：
   - 离线可用：不需要网络连接
   - 数据隐私：数据完全存储在本地
   - 部署简单：只需打包成可执行文件
   - 性能好：无网络延迟

## 多设备数据同步方案

如果需要**在 2 台机器上运行程序并同步数据**，有以下免费方案：

### 方案 1：GitHub Gist API（推荐，最简单）

**优点**：
- 完全免费，个人使用无限制
- 使用简单，只需 GitHub Personal Access Token
- 数据自动版本控制
- 适合小数据量（< 1MB）

**实现步骤**：
1. 在 GitHub 创建 Personal Access Token（Settings → Developer settings → Personal access tokens）
2. 在应用中添加同步功能，使用 GitHub Gist API 存储数据
3. 每次保存时自动上传到 Gist，启动时自动下载

详见：[SYNC_GUIDE.md](./SYNC_GUIDE.md)

### 方案 2：Firebase（免费额度充足）

**优点**：
- Google 提供，稳定可靠
- 免费额度：1GB 存储，10GB/月 传输
- 实时同步，支持离线缓存

### 方案 3：Supabase（开源 Firebase 替代）

**优点**：
- 开源，免费额度：500MB 数据库，1GB 文件存储
- PostgreSQL 数据库，功能强大

### 方案 4：WebDAV（如坚果云）

**优点**：
- 使用现有网盘服务
- 坚果云个人版免费：每月 1GB 上传，3GB 下载
- 实现简单，类似文件同步

### 方案 5：手动同步（当前方案）

**优点**：
- 无需额外开发
- 完全免费，无限制

**使用方法**：
1. 在机器 A 上点击"导出数据"，保存 JSON 文件
2. 将文件复制到机器 B（通过 U盘、网盘、邮件等）
3. 在机器 B 上点击"导入数据"，选择 JSON 文件

## 注意事项

- 高德地图 API Key 已硬编码在 `index.html` 中，生产环境建议使用环境变量
- 数据文件会自动创建，首次运行时会创建空的 JSON 文件
- 数据以 JSON 格式存储，可以直接查看和编辑（不推荐手动编辑，可能导致数据损坏）
