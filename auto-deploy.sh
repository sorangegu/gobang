#!/bin/bash
# Gomoku 自动提交并部署脚本
# 用法: ./auto-deploy.sh [commit-message]

set -e

# 获取传入的消息或使用默认消息
COMMIT_MSG="${1:-fix: 修复离开房间后的状态管理问题}"

echo "🚀 开始自动提交并部署流程..."

# 加载环境变量
if [ -f ".env" ]; then
    source .env
else
    echo "❌ .env 文件不存在，请创建后再运行"
    exit 1
fi

# 验证必要的环境变量
if [ -z "$SSH_HOST" ] || [ -z "$DEPLOY_PATH" ] || [ -z "$FRONTEND_PATH" ]; then
    echo "❌ 环境变量配置不完整，请检查 .env 文件"
    exit 1
fi

# ========== 1. Git 提交 ==========
echo ""
echo "📝 步骤 1: 提交代码到 GitHub"

# 检查是否有未提交的更改
if [ -z "$(git status --porcelain)" ]; then
    echo "⚠️  没有需要提交的更改，跳过提交步骤"
else
    # 添加所有更改
    git add -A

    # 生成提交信息
    echo "📋 提交信息: $COMMIT_MSG"

    # 提交更改
    git commit -m "$COMMIT_MSG

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

    # 推送到远程仓库
    echo "⬆️  推送到 GitHub..."
    git push origin main

    echo "✅ 代码已提交并推送到 GitHub"
fi

# ========== 2. SSH 远程部署 ==========
echo ""
echo "🔐 步骤 2: 连接到远程服务器并部署"

# SSH 连接并执行部署命令
ssh $SSH_HOST << EOF
set -e

echo "📦 开始部署 Gomoku..."

# 切换到项目目录
cd $DEPLOY_PATH

# 拉取最新代码
echo "⬇️  拉取最新代码..."
git pull origin main

# 复制前端文件
echo "📋 复制前端文件..."
rm -rf $FRONTEND_PATH/*
cp -r frontend/* $FRONTEND_PATH/

# 重启后端容器
echo "🔄 重启后端容器..."
cd $DEPLOY_PATH/backend
docker-compose down
docker-compose up -d --build

echo "✅ 部署完成！"
echo "🌐 访问地址: https://gobang.667728.xyz"
EOF

echo ""
echo "🎉 部署完成！"
echo "🌐 访问地址: https://gobang.667728.xyz"
