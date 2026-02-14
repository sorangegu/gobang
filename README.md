# 🎮 Gomoku 在线五子棋

一个现代化的在线五子棋游戏，支持人机对战和多人对战模式。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)

## ✨ 功能特性

### 🎯 游戏模式
- 🤖 **人机对战** - 与 AI 对弈，智能评估算法
- 👥 **多人对��** - 创建房间邀请好友对战
- 🔗 **邀请链接** - 一键分享房间链接

### 🎨 游戏体验
- 📱 **响应式设计** - 完美适配手机、平板、桌面端
- 🌓 **主题切换** - 深色/浅色主题自由切换
- 📊 **游戏统计** - 记录游戏次数、胜率等数据
- 🔄 **断线重连** - 30秒内重连保留游戏进度
- ↩️ **悔棋功能** - 人机模式支持悔棋

### 🛠️ 技术亮点
- 🎯 **Canvas 渲染** - 流畅的棋盘绘制
- 🔌 **实时通信** - Socket.IO 实现多人对战
- 🐳 **Docker 部署** - 一键部署到服务器
- 📦 **前后端分离** - 清晰的项目架构

## 🚀 快速开始

### 📋 前置要求
- Node.js >= 18.0.0
- Docker & Docker Compose（可选）

### 💻 本地开发

```bash
# 克隆项目
git clone https://github.com/sorangegu/gobang.git
cd gobang

# 安装后端依赖
cd backend
npm install

# 启动后端服务
npm start

# 在另一个终端，启动前端服务
cd ../frontend
# 使用任意静态服务器，例如：
npx serve .
# 或
python -m http.server 8080
```

### 🐳 Docker 部署

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f
```

### 🖥️ 服务器部署

```bash
# 克隆到服务器
git clone https://github.com/sorangegu/gobang.git /opt/gobang

# 复制前端文件
cp -r /opt/gobang/frontend/* /var/www/gobang/

# 启动后端
cd /opt/gobang
docker-compose up -d

# 或使用部署脚本
./deploy.sh
```

## 📖 使用说明

### 🤖 人机对战
1. 点击导航栏「人机对战」按钮
2. 点击棋盘落子，黑方先行
3. AI 会自动回应

### 👥 多人对战
1. **创建房间**：点击「创建房间」，获取房间号和邀请链接
2. **加入房间**：对方通过房间号或邀请链接加入
3. **开始游戏**：双方就绪后自动开始

### 📜 游戏规则
- 黑方先行，双方轮流落子
- 先连成五子（横、竖、斜）者获胜

## 🏗️ 项目结构

```
gobang/
├── backend/              # 后端代码
│   ├── src/
│   │   ├── index.js      # 主入口
│   │   ├── room.js       # 房间管理
│   │   └── ai.js         # AI 算法
│   ├── Dockerfile
│   └── package.json
├── frontend/             # 前端代码
│   ├── css/
│   │   └── style.css     # 样式文件
│   ├── js/
│   │   ├── ui.js         # UI 交互
│   │   ├── game.js       # 游戏逻辑
│   │   └── socket.js     # Socket 通信
│   ├── index.html
│   └── Dockerfile
├── nginx/                # Nginx 配置
│   ├── nginx.conf
│   └── host-nginx.conf   # 宿主机 Nginx 配置示例
├── docker-compose.yml    # Docker Compose 配置
├── deploy.sh            # 部署脚本
└── README.md
```

## 🔧 技术栈

### 🎨 前端
- **原生 JavaScript** - 无框架依赖
- **Canvas API** - 棋盘渲染
- **Socket.IO Client** - 实时通信
- **CSS3** - 响应式布局与动画

### ⚙️ 后端
- **Node.js** - 运行环境
- **Express** - Web 框架
- **Socket.IO** - WebSocket 通信
- **Docker** - 容器化部署

## 🤖 AI 算法

AI 采用启发式评估算法：
- 评估每个空位的进攻和防守价值
- 识别活四、冲四、活三等棋型
- 综合考虑进攻和防守因素

```javascript
// 评分示例
if (count >= 4) score += 100000;        // 成五
else if (count === 3 && openEnds === 2) // 活四
  score += 10000;
else if (count === 3 && openEnds === 1) // 冲四
  score += 1000;
```

## 📝 更新日志

### v1.0.0 (2024-02-14)
- ✅ 人机对战功能
- ✅ 多人对战功能
- ✅ 房间系统与邀请链接
- ✅ 断线重连
- ✅ 响应式设计
- ✅ 主题切换
- ✅ 游戏统计

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- 感谢所有贡献者的付出
- 灵感来源于经典的五子棋游戏
- 使用 [Socket.IO](https://socket.io/) 实现实时通信

## 📮 联系方式

- 项目地址: [https://github.com/sorangegu/gobang](https://github.com/sorangegu/gobang)
- 问题反馈: [Issues](https://github.com/sorangegu/gobang/issues)

---

⭐ 如果这个项目对你有帮助，欢迎 Star 支持！
