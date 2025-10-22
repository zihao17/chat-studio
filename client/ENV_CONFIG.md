# 环境变量配置说明

## 📋 概述

本项目使用环境变量来管理不同环境下的 API 配置，避免硬编码后端地址，提高项目的可维护性和协作性。

## 🔧 配置文件

### 环境变量文件

- `.env.development` - 开发环境配置（本地开发）
- `.env.production` - 生产环境配置（线上部署）
- `.env.example` - 配置模板文件（供参考）
- `.env.local` - 个人本地配置（不提交到 git）

### 配置项说明

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `VITE_API_BASE_URL` | 后端 API 基础地址 | `http://localhost:3001` |
| `VITE_NODE_ENV` | 环境标识 | `development` / `production` |

## 🚀 使用方法

### 1. 开发环境（默认）

项目默认使用 `.env.development` 配置：

```bash
# 启动开发服务器
npm run dev
```

### 2. 生产环境

构建生产版本时使用 `.env.production` 配置：

```bash
# 构建生产版本
npm run build
```

### 3. 个人配置

如需个人定制配置，创建 `.env.local` 文件：

```bash
# 复制模板文件
cp .env.example .env.local

# 编辑个人配置
# .env.local 文件不会被提交到 git
```

## 📝 代码中的使用

在 TypeScript/JavaScript 代码中使用环境变量：

```typescript
// 获取 API 基础地址
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// 检查环境
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;
```

## 🔒 安全注意事项

1. **敏感信息保护**：`.env.local` 和 `.env.*.local` 文件已添加到 `.gitignore`
2. **公开变量**：只有以 `VITE_` 开头的变量才会暴露给客户端
3. **生产环境**：生产环境的敏感配置应通过部署平台的环境变量设置

## 🛠️ 故障排除

### 环境变量未生效

1. 确认变量名以 `VITE_` 开头
2. 重启开发服务器
3. 检查浏览器控制台的环境变量输出

### 调试环境变量

在浏览器控制台查看当前环境变量：

```javascript
console.log('环境变量:', import.meta.env);
```

## 📚 相关文件

- `src/utils/configApi.ts` - 配置 API
- `src/utils/aiApi.ts` - AI API
- `src/contexts/AuthContext.tsx` - 认证上下文
- `src/utils/chatSyncApi.ts` - 聊天同步 API

## 🤝 团队协作

1. **新成员加入**：复制 `.env.example` 为 `.env.local` 并配置
2. **环境切换**：通过不同的 `.env` 文件管理多环境
3. **配置更新**：更新 `.env.example` 模板，通知团队成员

---

> 💡 **提示**：环境变量配置是现代前端项目的最佳实践，有助于项目的可维护性和安全性。