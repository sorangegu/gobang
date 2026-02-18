# Gomoku Online

一个前后端分离的在线五子棋项目，支持人机对战与在线房间对战。

## 功能概览

- 人机对战（本地 AI，支持难度选择）
- 在线对战（创建房间 / 加入房间 / 邀请链接）
- 对战准备机制（双方准备后开局）
- 悔棋与重新开始（联机模式为双方协商）
- 断线重连与房间状态恢复
- 响应式 UI（桌面与移动端）
- Docker 化部署（前端 + 后端）

## 技术栈

- 前端：HTML / CSS / Vanilla JavaScript / Canvas / Socket.IO Client
- 后端：Node.js / Express / Socket.IO / Redis / Winston
- 部署：Docker Compose + Nginx（反向代理 WebSocket）

## 目录结构

```text
gobang/
├── backend/
│   ├── src/
│   │   ├── index.js
│   │   ├── room.js
│   │   ├── ai.js
│   │   ├── redis.js
│   │   └── logger.js
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── css/style.css
│   ├── js/game.js
│   ├── js/socket.js
│   ├── js/ui.js
│   ├── index.html
│   └── Dockerfile
├── nginx/
│   └── host-nginx.conf
├── docker-compose.yml
├── auto-deploy.sh
├── REDIS_SETUP.md
└── README.md
```

## 路由说明

- `/`：首页
- `/ai`：人机对战
- `/multiplayer`：玩家对战入口
- `/room`：玩家对战入口（兼容路径）
- `/room/:roomId`：指定房间页面

## 本地开发

### 1) 启动后端

```bash
cd backend
npm install
npm start
```

默认端口：`5001`

### 2) 启动前端

```bash
cd frontend
npx serve -p 8080 .
```

默认访问：`http://localhost:8080`

## Docker 部署

```bash
docker-compose up -d --build
docker-compose logs -f
```

默认端口：

- 前端：`8080`
- 后端：`5001`

## 环境变量

复制并按需修改：

```bash
cp .env.example .env
```

关键项：

- `PORT`：后端端口
- `FRONTEND_PORT`：前端端口
- `ALLOWED_ORIGINS`：允许的前端域名（逗号分隔）
- `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_DB`
- `LOG_LEVEL`

Redis 连接细节可参考：`REDIS_SETUP.md`

## 自动部署（auto-deploy.sh）

脚本会执行：

1. `git add -A`
2. `git commit`
3. `git push origin main`
4. SSH 到远端拉取代码并重启服务

使用方式：

```bash
./auto-deploy.sh "chore: your commit message"
```

执行前请在 `.env` 提供：

- `SSH_HOST`
- `DEPLOY_PATH`
- `FRONTEND_PATH`

## 本次优化（当前版本）

- 修复重连事件名不一致（后端与前端统一并做兼容）
- 修复 Redis 房间恢复未正确等待异步结果的问题
- 修复重连流程中对手在线状态判断不准确的问题
- 修复 AI 分支潜在变量引用错误
- 修复前端多人模式路径识别不一致（`/room` 与 `/multiplayer`）
- 更新文档与真实代码结构保持一致

## 测试说明

目前仓库未内置完整自动化测试用例（根目录仅有 Playwright 依赖）。
建议在部署前至少做一轮手工回归：

- 创建房间 / 加入房间 / 准备开始
- 对战落子同步
- 悔棋与重开
- 断线重连

## License

MIT
