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
  - **文件上传与解析** ：支持 txt、md、docx、css、html、js、py；单次最多 10 个，单文件 ≤ 10MB；自动提取摘要并在输入区展示附件卡片（类型图标、大小/字数、进度、移除）
  - **代码块增强** ：语言角标与一键复制按钮；表格、引用块亮/暗主题配色优化；流式输出自动补全未闭合代码块
  - **高级设置** ：可调 Temperature、Top_P，自定义系统提示词（可选，默认不发送），并持久化到本地
  - **主题与视觉** ：新增暗色主题与瞬时切换策略，统一文本与控件配色；新对话按钮专属色
  - **交互与易用性** ：新对话自动聚焦输入框；更稳定的底部吸附与流式跟随；错误提示统一并自动滚动可见
  - **性能优化** ：连接复用与压缩，提升流式响应速度与稳定性
  - **统计信息** ：显示 AI 回复的模型信息、响应时间、Token 消耗统计
  - **错误处理** ：网络异常、API 错误的友好提示和处理机制
  - **响应式设计** ：适配桌面端和移动端，侧边栏折叠功能，在小窗口也有良好的用户体验
  - **知识库集成** ：支持开启 RAG 模式，选择知识库后 AI 自动检索相关文档作为上下文，回复底部展示引用卡片（文档名、片段索引、相关度分数），点击可展开查看完整引用内容

- **用户系统与云端同步**

  - **用户认证** ：支持用户注册、登录功能
  - **云端同步** ：登录用户的对话历史自动云端备份和同步
  - **会话管理** ：本地与云端会话数据的智能合并和管理

- **知识库与 RAG 增强**

  - **知识库管理** ：支持创建多个知识库集合，每个集合可独立管理文档，支持行内重命名、描述编辑和删除操作
  - **文档上传与入库** ：支持拖拽上传或点击上传文档（txt、md、docx、css、html、js、py），单次最多 10 个，单文件 ≤ 10MB；自动解析文档内容并进行智能切分（约 3200 字符/块，重叠 600 字符），生成向量嵌入并入库
  - **文档状态追踪** ：实时显示文档上传、解析、入库进度（0-100%），支持状态标识（已上传、处理中、就绪、错误），入库失败时展示详细错误信息
  - **混合检索** ：结合 BM25 全文检索与向量相似度检索，融合双路召回结果，提升检索准确率和召回率
  - **智能重排** ：使用 DashScope Qwen3-Rerank 模型对检索结果进行语义重排，优先返回与用户问题最相关的内容
  - **RAG 对话增强** ：聊天时可开启 RAG 模式并选择知识库，AI 自动检索相关文档片段作为上下文，生成更准确、更具针对性的回答
  - **引用溯源** ：AI 回复底部展示引用卡片，包含文档名称、片段索引、相关度分数（仅展示 > 0.8 的高质量引用），支持点击展开查看完整引用内容
  - **搜索调试** ：知识库管理页面提供搜索测试功能，可直接查看检索结果、BM25 分数、向量分数和重排分数，便于调试和优化
  - **侧边栏快捷操作** ：侧边栏知识库面板支持快速创建知识库、拖拽上传文档、展开查看文档列表、删除管理，与管理页面数据实时同步
  - **管理页面** ：网格布局展示所有知识库，支持拖拽上传带高亮反馈、文档状态实时更新、批量操作和粘贴文本创建文档
  - **性能优化** ：向量嵌入批处理（每批最多 10 条，自动分批），进度轮询智能停止，引用卡片懒加载与缓存，减少不必要的 API 请求
  - **错误处理** ：空文档拦截并即时失败，入库失败自动标记为错误状态，前端上传/拖拽错误提示增强，网络异常、API 错误的友好提示

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
