# 快速开始指南

## 如果 npm install 很慢

### 方案 1：使用国内镜像（推荐）

项目已配置 `.npmrc` 文件使用淘宝镜像，如果还是很慢，可以手动设置：

```bash
# 设置 npm 镜像
npm config set registry https://registry.npmmirror.com

# 设置 electron 镜像
npm config set electron_mirror https://npmmirror.com/mirrors/electron/
npm config set electron_builder_binaries_mirror https://npmmirror.com/mirrors/electron-builder-binaries/
```

然后重新安装：
```bash
npm install
```

### 方案 2：分步安装

如果 electron 下载很慢，可以先安装其他依赖：

```bash
# 先安装非 electron 相关依赖
npm install --ignore-scripts @vitejs/plugin-vue vite concurrently wait-on @element-plus/icons-vue element-plus pinia vue

# 然后单独安装 electron（可能需要较长时间）
npm install --save-dev electron electron-builder
```

### 方案 3：使用 yarn（通常更快）

```bash
# 安装 yarn（如果还没有）
npm install -g yarn

# 使用 yarn 安装
yarn install
```

### 方案 4：跳过 electron-builder（仅开发）

如果只是开发，可以先不安装 electron-builder：

```bash
npm install --save-dev @vitejs/plugin-vue vite concurrently wait-on
npm install @element-plus/icons-vue element-plus pinia vue
npm install --save-dev electron --ignore-scripts
```

然后修改 `package.json`，临时移除 electron-builder 相关脚本。

## 安装完成后

运行开发模式：
```bash
npm run electron:dev
```

## 常见问题

### electron 下载失败

electron 二进制文件很大（100+ MB），如果下载失败：

1. 检查网络连接
2. 使用国内镜像（已配置在 .npmrc）
3. 手动下载：访问 https://npmmirror.com/mirrors/electron/ 下载对应版本

### 安装卡住不动

按 `Ctrl+C` 取消，然后：
1. 删除 `node_modules` 文件夹
2. 删除 `package-lock.json`
3. 使用方案 1 设置镜像后重新安装
