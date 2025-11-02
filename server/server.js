/**
 * Chat Studio 后端服务器
 * 提供 AI 对话代理接口和其他 API 服务
 */

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");

// 加载环境变量
dotenv.config();

// 导入数据库和路由模块
const {
  getDatabase,
  initializeTables,
  closeDatabase,
} = require("./db/database");
// 路由模块延后加载，确保环境校验与变量初始化先完成
const chatRoutesPath = "./routes/chat";
const authRoutesPath = "./routes/auth";
const chatSyncRoutesPath = "./routes/chatSync";
const configRoutesPath = "./routes/config";
const filesRoutesPath = "./routes/files";

// 检测部署平台
const isZeabur = process.env.ZEABUR || process.env.ZEABUR_ENVIRONMENT_NAME;
const isRailway = process.env.RAILWAY_ENVIRONMENT_NAME;
const isProduction =
  process.env.NODE_ENV === "production" || isZeabur || isRailway;

console.log(
  `🚀 运行环境: ${isZeabur ? "Zeabur" : isRailway ? "Railway" : "本地开发"}`
);
console.log(`🌍 生产模式: ${isProduction ? "是" : "否"}`);

/**
 * 环境变量校验函数
 * 确保必要的配置项存在，避免运行时错误
 * 针对 Zeabur 部署环境进行优化
 */
function validateEnvironment() {
  const requiredEnvVars = ["DASHSCOPE_API_KEY", "DASHSCOPE_BASE_URL"];

  // JWT 密钥校验：生产环境必须显式配置；开发环境提供稳定默认值
  if (!process.env.JWT_SECRET) {
    if (isProduction) {
      console.error("❌ 未设置 JWT_SECRET 环境变量（生产环境必须设置）");
      process.exit(1);
    } else {
      console.warn("⚠️  未设置 JWT_SECRET，使用开发环境默认密钥（仅限本地开发）");
      process.env.JWT_SECRET = "chat-studio-dev-secret";
    }
  }

  // 可选的环境变量（至少需要一个AI服务配置）
  const optionalEnvVars = [
    "MODELSCOPE_API_KEY",
    "MODELSCOPE_BASE_URL",
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    console.error("❌ 环境变量校验失败！");
    console.error("缺失的必要环境变量:");
    missingVars.forEach((varName) => {
      console.error(`  - ${varName}`);
    });
    console.error("请检查 .env 文件配置");
    process.exit(1);
  }

  // 生产环境额外检查
  if (isProduction) {
    if (!process.env.FRONTEND_URL) {
      console.warn("⚠️  生产环境建议设置 FRONTEND_URL 环境变量");
    }

    // 检查 JWT 密钥强度
    if (process.env.JWT_SECRET.length < 32) {
      console.error("❌ JWT_SECRET 长度不足32位，安全性不够");
      process.exit(1);
    }
  }

  // 校验 API Key 格式
  if (!process.env.DASHSCOPE_API_KEY.startsWith("sk-")) {
    console.error('❌ DASHSCOPE_API_KEY 格式错误，应以 "sk-" 开头');
    process.exit(1);
  }

  // 校验可选的ModelScope配置
  if (
    process.env.MODELSCOPE_API_KEY &&
    !process.env.MODELSCOPE_API_KEY.startsWith("ms-")
  ) {
    console.error('❌ MODELSCOPE_API_KEY 格式错误，应以 "ms-" 开头');
    process.exit(1);
  }

  console.log("✅ 环境变量校验通过");

  // 显示配置信息（隐藏敏感信息）
  console.log("📋 当前配置:");
  console.log(`  - 端口: ${process.env.PORT || 3001}`);
  console.log(`  - 环境: ${process.env.NODE_ENV || "development"}`);
  console.log(`  - JWT密钥: ${process.env.JWT_SECRET.substring(0, 8)}...`);
  console.log(
    `  - 通义千问API: ${process.env.DASHSCOPE_API_KEY.substring(0, 8)}...`
  );
  if (process.env.FRONTEND_URL) {
    console.log(`  - 前端域名: ${process.env.FRONTEND_URL}`);
  }
  if (process.env.RAILWAY_ENVIRONMENT_NAME) {
    console.log(`  - Railway环境: ${process.env.RAILWAY_ENVIRONMENT_NAME}`);
  }
  if (isZeabur) {
    console.log(`  - Zeabur环境: 已检测到`);
  }
}

// 调用环境变量校验
validateEnvironment();

const app = express();
// 在反向代理/平台（如 Zeabur、Railway）后面时，确保获取到正确的协议信息
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3001;

// CORS 允许的来源列表
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:5177",
  "http://localhost:3000", // 添加常用的本地开发端口
  "http://localhost:3001", // 添加常用的本地开发端口
  "http://127.0.0.1:5173", // 添加 127.0.0.1 地址
  "http://127.0.0.1:3000", // 添加 127.0.0.1 地址
  "https://chat-studio-git-master-zihao17s-projects.vercel.app", // Vercel 部署域名1
  "https://chat-studio-eight.vercel.app", // Vercel 部署域名2
  "https://chat-studio.vercel.app",
  "https://chat-studio-pzh.vercel.app", // 主要 Vercel 域名
  "https://chat-studio-zihao17s-projects.vercel.app", // 可能的其他 Vercel 域名
  "https://chat-studio.zeabur.app", // Zeabur 部署域名
];

// 如果设置了 FRONTEND_URL 环境变量，添加到允许列表
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
  console.log(`🌐 添加前端域名到CORS白名单: ${process.env.FRONTEND_URL}`);
}

// Zeabur 部署时的特殊处理
if (isZeabur && !process.env.FRONTEND_URL) {
  console.warn("⚠️  Zeabur 部署建议设置 FRONTEND_URL 环境变量");
}

// 中间件配置 - 使用动态CORS配置
app.use(
  cors({
    origin: function (origin, callback) {
      // 允许没有 origin 的请求（如移动应用、Postman等）
      if (!origin) return callback(null, true);

      // 检查是否在允许列表中
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }

      // 允许所有 Vercel 域名（*.vercel.app）
      if (origin.endsWith(".vercel.app")) {
        console.log(`🌐 允许 Vercel 域名: ${origin}`);
        return callback(null, true);
      }

      // 开发环境允许所有本地域名
      if (
        !isProduction &&
        (origin.includes("localhost") || origin.includes("127.0.0.1"))
      ) {
        console.log(`🌐 开发环境允许本地域名: ${origin}`);
        return callback(null, true);
      }

      console.warn(`❌ CORS 阻止域名: ${origin}`);
      const error = new Error("CORS policy violation");
      error.status = 403;
      callback(error);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // 解析 Cookie

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 健康检查端点 - 增强版本，包含部署信息
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    platform: isZeabur ? "Zeabur" : isRailway ? "Railway" : "Local",
    environment: process.env.NODE_ENV || "development",
  });
});

// 路由按需加载（在环境校验后）
const chatRoutes = require(chatRoutesPath);
const { router: authRoutes } = require(authRoutesPath);
const chatSyncRoutes = require(chatSyncRoutesPath);
const configRoutes = require(configRoutesPath);
const filesRoutes = require(filesRoutesPath);

// API 路由
app.use("/api/auth", authRoutes);
app.use("/api/chat-sync", chatSyncRoutes);
app.use("/api/config", configRoutes);
app.use("/api/files", filesRoutes);
app.use("/api", chatRoutes);

// 根路径重定向到 API 信息
app.get("/", (req, res) => {
  res.json({
    message: "Chat Studio API Server",
    version: "1.0.0",
    platform: isZeabur ? "Zeabur" : isRailway ? "Railway" : "Local",
    environment: process.env.NODE_ENV || "development",
    status: "running",
    endpoints: {
      health: "/health",
      api_info: "/api",
      chat: "/api/chat",
      auth: "/api/auth",
      config: "/api/config",
      chatSync: "/api/chat-sync",
      files: "/api/files/upload",
    },
    timestamp: new Date().toISOString(),
  });
});

// API 根路径信息
app.get("/api", (req, res) => {
  res.json({
    message: "Chat Studio API Server",
    version: "1.0.0",
    platform: isZeabur ? "Zeabur" : isRailway ? "Railway" : "Local",
    environment: process.env.NODE_ENV || "development",
    endpoints: {
      health: "/health",
      chat: "/api/chat",
      auth: "/api/auth",
      config: "/api/config",
      chatSync: "/api/chat-sync",
      files: "/api/files/upload",
    },
    timestamp: new Date().toISOString(),
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    error: "API endpoint not found",
    path: req.path,
  });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error("❌ 全局错误处理:", err);
  res.status(500).json({
    success: false,
    message: "服务器内部错误",
  });
});

// 处理未捕获的 Promise rejection
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ 未处理的 Promise rejection:", reason);
  console.error("Promise:", promise);
});

// 处理未捕获的异常
process.on("uncaughtException", (error) => {
  console.error("❌ 未捕获的异常:", error);
  process.exit(1);
});

/**
 * 启动服务器函数
 * 包含数据库初始化和错误处理
 */
async function startServer() {
  try {
    // 初始化数据库
    console.log("🔧 正在初始化数据库...");
    const db = getDatabase();
    await initializeTables(db);
    console.log("✅ 数据库初始化完成");

    // 启动服务器 - 绑定到所有接口以支持容器部署
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Chat Studio 服务器已启动`);
      console.log(`📡 监听端口: ${PORT}`);
      console.log(`🌍 访问地址: http://localhost:${PORT}`);
      console.log(`🏥 健康检查: http://localhost:${PORT}/health`);
      console.log(`📚 API文档: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error("❌ 服务器启动失败:", error);
    process.exit(1);
  }
}

startServer();

// 优雅关闭处理
process.on("SIGTERM", () => {
  console.log("📴 收到 SIGTERM 信号，正在关闭服务器...");
  closeDatabase();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("📴 收到 SIGINT 信号，正在关闭服务器...");
  closeDatabase();
  process.exit(0);
});
