const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const RoomManager = require('./room');
const logger = require('./logger');
const redisClient = require('./redis');

const app = express();
const server = http.createServer(app);

// 允许的源列表（根据实际部署环境配置）
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:8080'];

// Socket.IO 配置
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // 允许无 origin 的请求（如移动端、Postman）
      if (!origin) return callback(null, true);

      // 检查是否在允许列表中
      if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app') || origin.endsWith('.netlify.app')) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e8,
  // 连接速率限制
  maxConnections: 1000
});

// 基础中间件
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app') || origin.endsWith('.netlify.app')) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

// API 速率限制
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 100, // 每个 IP 最多 100 次请求
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    redis: redisClient.isConnected() ? 'connected' : 'disconnected',
    rooms: roomManager.getRoomCount()
  });
});

// API 路由使用速率限制
app.use('/api', apiLimiter);

// 房间管理
const roomManager = new RoomManager(io);

// Socket.IO 连接处理
io.on('connection', (socket) => {
  logger.info(`客户端连接：${socket.id}, IP: ${socket.handshake.address}`);

  // 创建房间
  socket.on('create_room', (data, callback) => {
    try {
      // 验证数据
      if (data && data.difficulty && !['easy', 'medium', 'hard'].includes(data.difficulty)) {
        return callback({ success: false, error: '无效的难度设置' });
      }

      const result = roomManager.createRoom(socket, data?.difficulty);
      logger.info(`房间创建：${result.roomId}, 用户：${socket.id}`);
      if (callback) callback(result);
    } catch (error) {
      logger.error('创建房间失败:', error.message);
      if (callback) callback({ success: false, error: '创建房间失败' });
    }
  });

  // 加入房间
  socket.on('join_room', (roomId, callback) => {
    try {
      // 验证房间号格式
      if (!roomId || typeof roomId !== 'string' || !/^[A-Z0-9]{6}$/i.test(roomId)) {
        return callback({ success: false, error: '无效的房间号格式' });
      }

      const result = roomManager.joinRoom(socket, roomId.toUpperCase());
      logger.info(`房间加入：${roomId}, 用户：${socket.id}, 结果：${result.success}`);
      if (callback) callback(result);
    } catch (error) {
      logger.error('加入房间失败:', error.message);
      if (callback) callback({ success: false, error: '加入房间失败' });
    }
  });

  // 落子
  socket.on('make_move', (data) => {
    try {
      // 验证落子数据
      if (!data || typeof data.x !== 'number' || typeof data.y !== 'number') {
        return;
      }
      if (data.x < 0 || data.x >= 15 || data.y < 0 || data.y >= 15) {
        return;
      }
      roomManager.makeMove(socket, data);
    } catch (error) {
      logger.error('落子失败:', error.message);
    }
  });

  // 请求悔棋
  socket.on('request_undo', (callback) => {
    try {
      const result = roomManager.requestUndo(socket);
      if (callback) callback(result);
    } catch (error) {
      logger.error('悔棋请求失败:', error.message);
      if (callback) callback({ success: false, error: '悔棋请求失败' });
    }
  });

  // 响应悔棋
  socket.on('respond_undo', (accept, callback) => {
    try {
      const result = roomManager.respondUndo(socket, accept);
      if (callback) callback(result);
    } catch (error) {
      logger.error('悔棋响应失败:', error.message);
      if (callback) callback({ success: false, error: '悔棋响应失败' });
    }
  });

  // 重新开始
  socket.on('request_restart', (callback) => {
    try {
      const result = roomManager.requestRestart(socket);
      if (callback) callback(result);
    } catch (error) {
      logger.error('重新开始请求失败:', error.message);
      if (callback) callback({ success: false, error: '重新开始请求失败' });
    }
  });

  // 响应重新开始
  socket.on('respond_restart', (accept, callback) => {
    try {
      const result = roomManager.respondRestart(socket, accept);
      if (callback) callback(result);
    } catch (error) {
      logger.error('重新开始响应失败:', error.message);
      if (callback) callback({ success: false, error: '重新开始响应失败' });
    }
  });

  // 离开房间
  socket.on('leave_room', () => {
    try {
      roomManager.leaveRoom(socket);
      logger.info(`用户离开房间：${socket.id}`);
    } catch (error) {
      logger.error('离开房间失败:', error.message);
    }
  });

  // 玩家准备
  socket.on('player_ready', (callback) => {
    try {
      const result = roomManager.playerReady(socket);
      if (callback) callback(result);
    } catch (error) {
      logger.error('准备失败:', error.message);
      if (callback) callback({ success: false, error: '准备失败' });
    }
  });

  // 重连房间
  socket.on('reconnect_room', (data, callback) => {
    try {
      if (!data || !data.roomId || !data.playerColor) {
        return callback({ success: false, error: '无效的重连参数' });
      }

      // 验证房间号格式
      if (!/^[A-Z0-9]{6}$/i.test(data.roomId)) {
        return callback({ success: false, error: '无效的房间号格式' });
      }

      // 验证玩家颜色
      if (![1, 2].includes(data.playerColor)) {
        return callback({ success: false, error: '无效的玩家颜色' });
      }

      const result = roomManager.reconnectRoom(socket, data.roomId, data.playerColor);
      logger.info(`重连房间：${data.roomId}, 用户：${socket.id}, 结果：${result.success}`);
      if (callback) callback(result);
    } catch (error) {
      logger.error('重连房间失败:', error.message);
      if (callback) callback({ success: false, error: '重连失败' });
    }
  });

  // 断开连接
  socket.on('disconnect', () => {
    logger.info(`客户端断开：${socket.id}`);
    roomManager.handleDisconnect(socket);
  });

  // 错误处理
  socket.on('error', (error) => {
    logger.error(`Socket 错误 ${socket.id}:`, error.message);
  });
});

// 优雅关闭
process.on('SIGTERM', async () => {
  logger.info('收到 SIGTERM 信号，正在关闭...');
  await redisClient.disconnect();
  server.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('收到 SIGINT 信号，正在关闭...');
  await redisClient.disconnect();
  server.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

// 启动服务器
const PORT = process.env.PORT || 5001;

// 先连接 Redis，再启动服务器
(async () => {
  try {
    await redisClient.connect();

    // 将 Redis 客户端传递给 roomManager
    roomManager.setRedisClient(redisClient);

    server.listen(PORT, () => {
      logger.info(`五子棋服务器运行在端口 ${PORT}`);
      logger.info(`健康检查端点：http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('服务器启动失败:', error.message);
    process.exit(1);
  }
})();
