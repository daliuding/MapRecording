# 安装说明

## 前置要求

- Node.js 16+ 
- npm 或 yarn

## 安装步骤

### 1. 安装依赖

```bash
npm install
```

**注意**: `better-sqlite3` 是原生模块，安装时可能需要编译。如果遇到问题：

- Windows: 确保已安装 Visual Studio Build Tools 或 Windows SDK
- macOS: 确保已安装 Xcode Command Line Tools
- Linux: 确保已安装 `build-essential` 和 `python`

### 2. 开发模式运行

```bash
npm run electron:dev
```

这将：
1. 启动 Vite 开发服务器（http://localhost:5173）
2. 等待服务器就绪后启动 Electron 窗口
3. 自动打开开发者工具

### 3. 构建生产版本

```bash
npm run electron:build
```

构建完成后，可执行文件在 `release/` 目录。

## 常见问题

### 依赖安装问题

项目已使用 JSON 文件存储，无需编译原生模块，安装应该很顺利。如果遇到问题，可以尝试：

```bash
npm cache clean --force
npm install
```

### Electron 启动失败

确保已正确安装 Electron：

```bash
npm install electron --save-dev
```

### 高德地图不显示

检查网络连接，确保可以访问高德地图 API。如果 API Key 失效，需要在 `index.html` 中更新。

## 数据迁移

### Electron 环境

数据文件位置（JSON 格式）：

**开发模式**：
- **路径**：项目根目录下的 `data/markers.json`
- **示例**：`E:\self\tech study\github\MapRecord\data\markers.json`

**生产模式（打包后的应用）**：
- **路径**：应用安装目录下的 `data/markers.json`
- **示例**：`C:\Users\Administrator\AppData\Local\Programs\map-record\data\markers.json`

**迁移方法**（两种方式任选其一）：

**方法 1：直接复制文件**
1. 找到对应目录下的 `data/markers.json` 文件
2. 复制到新机器的对应目录下的 `data` 文件夹
3. 启动应用即可

**方法 2：使用导出/导入功能**
1. 在原机器上，点击应用右上角工具栏的"导出数据"按钮
2. 保存下载的 JSON 文件
3. 在新机器上打开应用
4. 点击"导入数据"按钮，选择之前导出的 JSON 文件
5. 数据会自动合并（相同 ID 的标记会被覆盖）

### 浏览器环境

浏览器环境的数据存储在 `localStorage` 中，不能直接迁移。

**迁移方法**：
1. 在原浏览器中，点击应用右上角工具栏的"导出数据"按钮
2. 保存下载的 JSON 文件
3. 在新机器/浏览器上打开应用
4. 点击"导入数据"按钮，选择之前导出的 JSON 文件
5. 数据会自动合并到现有数据中

**注意**: 
- JSON 文件是文本格式，可以直接查看，但不建议手动编辑，可能导致数据格式错误
- 浏览器环境的数据仅存储在本地，清除浏览器数据会导致数据丢失，建议定期导出备份
