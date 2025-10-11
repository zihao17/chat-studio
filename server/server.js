/**
 * Chat Studio 后端服务器
 * 提供 AI 对话代理接口和其他 API 服务
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 导入路由模块
const chatRoutes = require('./routes/chat');

/**
 * 环境变量校验函数
 * 确保必要的配置项存在，避免运行时错误
 */
function validateEnvironment() {
  const requiredEnvVars = [
    'DASHSCOPE_API_KEY',
    'DASHSCOPE_BASE_URL'
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

  console.log('✅ 环境变量校验通过');
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

// 注册路由
app.use('/api', chatRoutes);

// API 路由占位符
app.get('/api', (req, res) => {
  res.json({
    message: 'Chat Studio API Server',
    version: '1.0.0',
    endpoints: [
      'GET /health - 健康检查',
      'POST /api/chat - AI 对话代理'
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
app.listen(PORT, () => {
  console.log(`🚀 Chat Studio 服务器启动成功`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 API Key: ${process.env.DASHSCOPE_API_KEY.substring(0, 8)}...`);
  console.log(`⏰ 启动时间: ${new Date().toISOString()}`);
});

// 优雅关闭处理
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到 SIGINT 信号，正在关闭服务器...');
  process.exit(0);
});