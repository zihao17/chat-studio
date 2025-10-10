# Chat Studio

<div align="center">
  <p>
    <a href="README.md">🇨🇳 中文</a> | 
    <a href="#english">🇺🇸 English</a>
  </p>
</div>

<div align="center">
  <img src="./client/public/images/Chat-Studio.png" alt="Chat Studio" width="1000" />
</div>

**Chat Studio：** An open-source AI conversation platform supporting multi-session concurrency, knowledge base enhancement, and automated workflows. Built with React + TypeScript frontend and Node.js backend.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **UI**: Ant Design + Tailwind CSS
- **Tooling**: Vite + ESLint + PostCSS + pnpm
- **Backend**: Node.js

## Features

- **AI Intelligent Chat**

  - **AI Integration**: Support for multiple AI models including Qwen3, ChatGPT, etc.
  - **Persistent Sessions**: Chat history stored locally, data persists after refresh
  - **Multi-Session Concurrency**: Support multiple conversations simultaneously with independent input states, contexts, and UI
  - **Smart Titles**: Auto-generate session titles based on user's first message for better readability
  - **Real-time Interaction**: Loading state feedback, auto-scroll to latest messages
  - **Error Handling**: Network exception and API error handling mechanisms
  - **Responsive Design**: Optimized for desktop and mobile with excellent user experience in small windows

- **Knowledge Base** (In Development)
- **Workflows** (In Development)

## Quick Start

**Requirements**: Node.js ≥18, pnpm ≥8

```bash
# Install dependencies
pnpm i

# Start development server (http://localhost:5173)
pnpm dev

# Build for production
pnpm build
```
