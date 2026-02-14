FROM node:18-alpine

WORKDIR /app

# 复制静态文件
COPY index.html ./
COPY css/ ./css/
COPY js/ ./js/

# 安装 serve
RUN npm install -g serve

EXPOSE 80

CMD ["serve", "-p", "80", "."]
