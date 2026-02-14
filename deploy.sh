#!/bin/bash
# Gomoku 部署脚本

set -e

echo "📦 开始部署 Gomuku..."

# 拉取最新代码
echo "⬇️  拉取最新代码..."
cd /opt/gobang
git pull

# 复制前端文件
echo "📋 复制前端文件..."
cp -r frontend/* /var/www/gobang/

# 重启后端容器
echo "🔄 重启后端容器..."
docker-compose down
docker-compose up -d --build

echo "✅ 部署完成！"
