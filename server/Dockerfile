# 使用官方 Node.js 运行时作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 仅复制 package.json 与 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# 启用 Corepack 并激活与锁文件兼容的 pnpm 版本（最佳实践）
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# 为原生模块（如 sqlite3）准备构建工具，避免构建阶段失败
RUN apk add --no-cache python3 make g++

# 安装生产依赖，严格遵循锁文件，避免漂移
RUN pnpm install --frozen-lockfile --prod

# 复制应用源代码
COPY . .

# 创建数据目录并设置权限
RUN mkdir -p data && chmod 755 data

# 暴露端口
EXPOSE 3001

# 设置环境变量
ENV NODE_ENV=production

# 启动应用
CMD ["npm", "start"]
