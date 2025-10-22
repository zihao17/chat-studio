# Chat Studio

<div align="center">
  <p>
    <a href="#中文">🇨🇳 中文</a> | 
    <a href="README.en.md">🇺🇸 English</a>
  </p>
  
  <!-- 在线体验 -->
[![Live Demo](https://img.shields.io/badge/✨_在线体验-Chat_Studio-007ACC?style=flat&logo=vercel)](https://chat-studio-pzh.vercel.app/)

  <p>
    <strong>👉 在线体验：</strong>
    <a href="https://chat-studio-pzh.vercel.app/" target="_blank">
      <code>https://chat-studio-pzh.vercel.app/</code>
    </a>
    <br>
  </p>

  <!-- GitHub Badges -->
  <p>
    <a href="https://github.com/zihao17/chat-studio/stargazers">
      <img src="https://img.shields.io/github/stars/zihao17/chat-studio?style=social" alt="GitHub stars">
    </a>
    <a href="https://github.com/zihao17/chat-studio/network/members">
      <img src="https://img.shields.io/github/forks/zihao17/chat-studio?style=social" alt="GitHub forks">
    </a>
    <a href="https://github.com/zihao17/chat-studio/watchers">
      <img src="https://img.shields.io/github/watchers/zihao17/chat-studio?style=social" alt="GitHub watchers">
    </a>
  </p>
  
  <!-- Star 呼吁与建议征集 -->
  <p>
    <strong> 如果这个项目对你有帮助，请给个 Star🌟 支持一下！</strong><br>
    <strong>欢迎提出宝贵建议和功能需求，让我们一起完善这个项目！</strong>
  </p>
</div>

<div align="center">
  <img src="./client/public/images/Chat-Studio.png" alt="Chat Studio" width="1000" />
</div>

**Chat Studio：** 一个开源的 AI 对话平台，支持多会话并发、知识库增强与自动化工作流。前端基于 React + TypeScript 构建，后端采用 Node.js。

## 技术栈

- **前端**: React 19 + TypeScript + Vite
- **UI**: Ant Design + Tailwind CSS
- **工程化**: Vite + ESLint + PostCSS + pnpm
- **后端**: Node.js + Express
- **数据库**: SQLite（本地开发）
- **认证**: JWT Token
- **Markdown**: react-markdown + remark-gfm + rehype-highlight
- **代码高亮**: highlight.js

## 功能特性

- **AI 智能对话聊天**

  - **AI 集成** ：支持 Qwen3、ChatGPT、DeepSeek、GLM 等多个 AI 模型，支持模型实时切换
  - **持久化会话** ：对话历史本地存储，刷新后数据不丢失
  - **多会话并发** ：支持多个对话同时发送消息，各会话具备独立的输入状态、上下文和 UI，互不干扰
  - **智能标题** ：根据用户首条消息自动生成会话标题，提高可读性
  - **实时交互** ：加载状态反馈，智能滚动控制，流式回复底部吸附
  - **停止生成** ：支持中断 AI 消息生成，提供更好的用户控制体验
  - **Markdown 渲染** ：完整支持 Markdown 语法、代码高亮、表格、列表等格式化显示
  - **流式输出** ：实时显示 AI 回复内容，支持流式语法修复和智能渲染
  - **统计信息** ：显示 AI 回复的模型信息、响应时间、Token 消耗统计
  - **错误处理** ：网络异常、API 错误的友好提示和处理机制
  - **响应式设计** ：适配桌面端和移动端，侧边栏折叠功能，在小窗口也有良好的用户体验

- **用户系统与云端同步**

  - **用户认证** ：支持用户注册、登录功能
  - **云端同步** ：登录用户的对话历史自动云端备份和同步
  - **会话管理** ：本地与云端会话数据的智能合并和管理

- **知识库**（开发中）
- **工作流**（开发中）

## 快速开始

**环境要求**：Node.js ≥18，pnpm ≥8

```bash
# 克隆项目
git clone https://github.com/your-username/chat-studio.git
cd chat-studio

# 安装依赖（前后端一键安装）
pnpm install:all

# 启动开发服务器（前后端同时启动）
pnpm dev

# 仅启动前端（http://localhost:5173）
pnpm client:dev

# 仅启动后端（http://localhost:3001）
pnpm server:dev

# 仅启动后端
pnpm server:dev

# 构建生产版本
pnpm build
```

## 项目结构

```
chat-studio/
├── client/          # 前端代码（React + TypeScript）
│   ├── src/
│   │   ├── components/  # 组件库
│   │   ├── contexts/    # React Context
│   │   ├── hooks/       # 自定义 Hooks
│   │   ├── pages/       # 页面组件
│   │   ├── types/       # TypeScript 类型定义
│   │   └── utils/       # 工具函数
│   └── package.json
├── server/          # 后端代码（Node.js + Express）
│   ├── routes/      # API 路由
│   ├── db/          # 数据库相关
│   └── package.json
└── package.json     # 根目录配置
```
