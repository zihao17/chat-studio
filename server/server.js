/**
 * Chat Studio 后端服务器
 * 提供 AI 对话代理接口和其他 API 服务
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');

// 加载环境变量
dotenv.config();

// 导入数据库和路由模块
const { getDatabase, initializeTables, closeDatabase } = require('./db/database');
const chatRoutes = require('./routes/chat');
const { router: authRoutes } = require('./routes/auth');
const chatSyncRoutes = require('./routes/chatSync');
const configRoutes = require('./routes/config');

/**
 * 环境变量校验函数
 * 确保必要的配置项存在，避免运行时错误
 */
function validateEnvironment() {
  const requiredEnvVars = [
    'DASHSCOPE_API_KEY',
    'DASHSCOPE_BASE_URL'
  ];

  // 可选的环境变量（至少需要一个AI服务配置）
  const optionalEnvVars = [
    'MODELSCOPE_API_KEY',
    'MODELSCOPE_BASE_URL',
    'OPENAI_API_KEY',
    'OPENAI_BASE_URL'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ 环境变量校验失败！');
    console.error('缺失的必要环境变量:');
    missingVars.forEach(varName => {
      console.error(`  - ${varName}`);
    });
    console.error('请检查 .env 文件配置');
    process.exit(1);
  }

  // 校验 API Key 格式
  if (!process.env.DASHSCOPE_API_KEY.startsWith('sk-')) {
    console.error('❌ DASHSCOPE_API_KEY 格式错误，应以 "sk-" 开头');
    process.exit(1);
  }

  // 校验可选的ModelScope配置
  if (process.env.MODELSCOPE_API_KEY && !process.env.MODELSCOPE_API_KEY.startsWith('ms-')) {
    console.error('❌ MODELSCOPE_API_KEY 格式错误，应以 "ms-" 开头');
    process.exit(1);
  }

  console.log('✅ 环境变量校验通过');
  
  // 显示已配置的AI服务
  const configuredServices = ['阿里百炼(DashScope)'];
  if (process.env.MODELSCOPE_API_KEY && process.env.MODELSCOPE_BASE_URL) {
    configuredServices.push('魔搭社区(ModelScope)');
  }
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_BASE_URL) {
    configuredServices.push('OpenAI');
  }
  console.log(`🤖 已配置的AI服务: ${configuredServices.join(', ')}`);
}

// 执行环境变量校验
validateEnvironment();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS 配置 - 支持多个本地开发端口
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174', 
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5177'
];

// 中间件配置
app.use(cors({
  origin: function (origin, callback) {
    // 允许没有 origin 的请求（如移动应用、Postman等）
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS 策略不允许此来源'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // 解析 Cookie

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'chat-studio-server'
  });
});

// 路由配置
app.use('/api/auth', authRoutes);
app.use('/api/chat-sync', chatSyncRoutes);
app.use('/api/config', configRoutes);
app.use('/api', chatRoutes);

// API 路由占位符
app.get('/api', (req, res) => {
  res.json({
    message: 'Chat Studio API Server',
    version: '1.0.0',
    endpoints: [
      'GET /health - 健康检查',
      'POST /api/chat - AI 对话代理',
      'POST /api/auth/register - 用户注册',
      'POST /api/auth/login - 用户登录',
      'POST /api/auth/logout - 用户登出',
      'GET /api/auth/verify - 身份验证',
      'GET /api/chat-sync/sessions - 获取用户会话',
      'POST /api/chat-sync/sync-guest-data - 同步游客数据'
    ]
  });
});

// 404 处理 - 捕获所有未匹配的路由
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `路径 ${req.originalUrl} 不存在`
  });
});

// 全局错误处理
app.use((err, req, res, next) => {
  // 记录详细错误信息，包含请求 URL
  console.error(`服务器错误 [${req.method} ${req.url}]:`, err);
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误',
    path: req.url
  });
});

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库
    const db = getDatabase();
    await initializeTables(db);
    
    app.listen(PORT, () => {
      console.log(`🚀 Chat Studio 服务器启动成功`);
      console.log(`📍 服务地址: http://localhost:${PORT}`);
      console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔑 API Key: ${process.env.DASHSCOPE_API_KEY.substring(0, 8)}...`);
      console.log(`💾 数据库: SQLite (WAL模式)`);
      console.log(`⏰ 启动时间: ${new Date().toISOString()}`);
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();

// 优雅关闭处理
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务器...');
  closeDatabase();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到 SIGINT 信号，正在关闭服务器...');
  closeDatabase();
  process.exit(0);
});