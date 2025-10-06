# Chat Studio

一个基于 React 的 AI 对话与知识库平台，提供智能对话和文档管理功能。

## 技术栈

- **前端**: React 19 + TypeScript + Vite
- **UI 组件**: Ant Design + Tailwind CSS
- **构建工具**: Vite + ESLint + PostCSS
- **包管理**: pnpm

## 功能特性

- 🤖 AI 智能对话
- 📚 知识库管理
- 💬 实时聊天界面
- 📱 响应式设计
- 🎨 现代化 UI

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

访问 http://localhost:5173

### 构建生产版本

```bash
pnpm build
```

### 代码检查

```bash
pnpm lint
```

## 项目结构

```
src/
├── components/     # 可复用组件
├── hooks/         # 自定义 Hooks
├── pages/         # 页面组件
├── types/         # TypeScript 类型定义
├── utils/         # 工具函数
└── App.tsx        # 应用入口
```

## 开发规范

- 使用 TypeScript 进行类型检查
- 遵循 ESLint 代码规范
- 使用 Prettier 格式化代码
- 组件采用函数式编程风格

## 许可证

MIT License
