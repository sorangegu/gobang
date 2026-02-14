const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const RoomManager = require('./room');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors());
app.use(express.json());

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 房间管理
const roomManager = new RoomManager(io);

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // 创建房间
  socket.on('create_room', (callback) => {
    const result = roomManager.createRoom(socket);
    if (callback) callback(result);
  });

  // 加入房间
  socket.on('join_room', (roomId, callback) => {
    const result = roomManager.joinRoom(socket, roomId);
    if (callback) callback(result);
  });

  // 落子
  socket.on('make_move', (data) => {
    roomManager.makeMove(socket, data);
  });

  // 请求悔棋
  socket.on('request_undo', (callback) => {
    const result = roomManager.requestUndo(socket);
    if (callback) callback(result);
  });

  // 响应悔棋
  socket.on('respond_undo', (accept, callback) => {
    const result = roomManager.respondUndo(socket, accept);
    if (callback) callback(result);
  });

  // 重新开始
  socket.on('request_restart', (callback) => {
    const result = roomManager.requestRestart(socket);
    if (callback) callback(result);
  });

  // 响应重新开始
  socket.on('respond_restart', (accept, callback) => {
    const result = roomManager.respondRestart(socket, accept);
    if (callback) callback(result);
  });

  // 离开房间
  socket.on('leave_room', () => {
    roomManager.leaveRoom(socket);
  });

  // 玩家准备
  socket.on('player_ready', (callback) => {
    const result = roomManager.playerReady(socket);
    if (callback) callback(result);
  });

  // 重连房间
  socket.on('reconnect_room', (data, callback) => {
    const result = roomManager.reconnectRoom(socket, data.roomId, data.playerColor);
    if (callback) callback(result);
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    roomManager.handleDisconnect(socket);
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Gobang server running on port ${PORT}`);
});
