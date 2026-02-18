FROM node:18-alpine

WORKDIR /app

# 复制 package.json 和 package-lock.json (如果有)
COPY package*.json ./

# 安装所有依赖（包括 devDependencies 用于构建）
RUN npm install

# 复制源代码
COPY src/ ./src/

# 创建日志目录
RUN mkdir -p /app/logs

# 暴露端口
EXPOSE 5001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5001/health || exit 1

# 启动应用
CMD ["node", "src/index.js"]
