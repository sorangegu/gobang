const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

// 生成房间 ID (6 位字母数字)
function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

class Room {
  constructor(roomId, hostSocket, difficulty = 'medium') {
    this.roomId = roomId;
    this.host = hostSocket;
    this.guest = null;
    this.status = 'waiting'; // waiting, ready, playing, finished
    this.board = Array(15).fill(null).map(() => Array(15).fill(0));
    this.currentPlayer = 1; // 1: 黑棋，2: 白棋
    this.moveHistory = [];
    this.undoRequested = false;
    this.restartRequested = false;
    this.winner = null;
    this.hostReady = false;
    this.guestReady = false;
    this.difficulty = difficulty; // AI 难度

    // 断开连接状态
    this.hostDisconnected = false;
    this.guestDisconnected = false;
    this.hostDisconnectTime = 0;
    this.guestDisconnectTime = 0;
  }

  getPlayerColor(socket) {
    if (socket.id === this.host.id) return 1;
    if (this.guest && socket.id === this.guest.id) return 2;
    return null;
  }

  isFull() {
    return this.guest !== null;
  }

  isBothReady() {
    return this.hostReady && this.guestReady;
  }

  // 序列化为可存储的格式
  toJSON() {
    return {
      roomId: this.roomId,
      status: this.status,
      board: this.board,
      currentPlayer: this.currentPlayer,
      moveHistory: this.moveHistory,
      winner: this.winner,
      hostReady: this.hostReady,
      guestReady: this.guestReady,
      difficulty: this.difficulty,
      hostDisconnected: this.hostDisconnected,
      guestDisconnected: this.guestDisconnected,
      hostDisconnectTime: this.hostDisconnectTime,
      guestDisconnectTime: this.guestDisconnectTime
    };
  }

  // 从存储恢复
  static fromJSON(data, hostSocket) {
    const room = new Room(data.roomId, hostSocket, data.difficulty);
    room.status = data.status;
    room.board = data.board;
    room.currentPlayer = data.currentPlayer;
    room.moveHistory = data.moveHistory;
    room.winner = data.winner;
    room.hostReady = data.hostReady;
    room.guestReady = data.guestReady;
    room.hostDisconnected = data.hostDisconnected;
    room.guestDisconnected = data.guestDisconnected;
    room.hostDisconnectTime = data.hostDisconnectTime;
    room.guestDisconnectTime = data.guestDisconnectTime;
    return room;
  }
}

class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.redisClient = null;
  }

  // 设置 Redis 客户端
  setRedisClient(redisClient) {
    this.redisClient = redisClient;
  }

  // 获取房间数量
  getRoomCount() {
    return this.rooms.size;
  }

  // 创建房间
  createRoom(socket, difficulty = 'medium') {
    let roomId;
    do {
      roomId = generateRoomId();
    } while (this.rooms.has(roomId));

    const room = new Room(roomId, socket, difficulty);
    this.rooms.set(roomId, room);

    socket.join(roomId);
    socket.roomId = roomId;
    socket.isHost = true;
    socket.playerColor = 1;

    // 保存到 Redis
    this.saveRoomToRedis(roomId, room);

    logger.info(`房间创建成功：${roomId}, 难度：${difficulty}`);
    return {
      success: true,
      roomId,
      isHost: true,
      playerColor: 1,
      difficulty
    };
  }

  // 加入房间
  joinRoom(socket, roomId) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return { success: false, error: '房间不存在' };
    }

    // 检查是否是重新加入（房间进行中但缺少玩家）
    const isRejoining = room.status === 'playing' && !room.guest;

    if (room.status !== 'waiting' && !isRejoining) {
      return { success: false, error: '房间已开始游戏' };
    }

    if (room.isFull()) {
      return { success: false, error: '房间已满' };
    }

    room.guest = socket;
    room.guestDisconnected = false;

    // 如果是重新加入，保持 playing 状态
    if (!isRejoining) {
      room.status = 'waiting';
    }

    socket.join(roomId);
    socket.roomId = roomId;
    socket.isHost = false;
    socket.playerColor = 2;

    // 通知房主有玩家加入
    room.host.emit('player_joined', {
      success: true,
      roomId,
      playerColor: 2,
      isRejoining
    });

    // 保存到 Redis
    this.saveRoomToRedis(roomId, room);

    logger.info(`玩家加入房间：${roomId}, 玩家：${socket.id}`);
    return {
      success: true,
      roomId,
      isHost: false,
      playerColor: 2,
      isRejoining,
      board: room.board,
      moveHistory: room.moveHistory,
      currentPlayer: room.currentPlayer,
      isPlaying: room.status === 'playing'
    };
  }

  // 落子
  makeMove(socket, { x, y }) {
    const roomId = socket.roomId;
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    // 检查是否轮到该玩家
    const playerColor = room.getPlayerColor(socket);
    if (playerColor !== room.currentPlayer) return;

    // 检查位置是否有效
    if (x < 0 || x >= 15 || y < 0 || y >= 15) return;
    if (room.board[y][x] !== 0) return;

    // 执行落子
    room.board[y][x] = playerColor;
    room.moveHistory.push({ x, y, player: playerColor });

    // 广播落子
    this.io.to(roomId).emit('move_made', {
      x,
      y,
      player: playerColor,
      board: room.board,
      currentPlayer: 3 - playerColor
    });

    // 检查胜利
    if (this.checkWin(room.board, x, y, playerColor)) {
      room.status = 'finished';
      room.winner = playerColor;
      this.io.to(roomId).emit('game_over', {
        winner: playerColor,
        reason: '五子连珠'
      });
      this.deleteRoomFromRedis(roomId);
      return;
    }

    // 检查平局
    if (this.checkDraw(room.board)) {
      room.status = 'finished';
      this.io.to(roomId).emit('game_over', {
        winner: 0,
        reason: '平局'
      });
      this.deleteRoomFromRedis(roomId);
      return;
    }

    // 更新当前玩家
    room.currentPlayer = 3 - playerColor;

    // 人机对战：AI 思考后落子
    if (room.aiPlayer && room.currentPlayer === 2) {
      setTimeout(() => {
        this.makeAIMove(room);
      }, 500);
    }

    // 保存到 Redis
    this.saveRoomToRedis(roomId, room);
  }

  // AI 落子
  makeAIMove(room) {
    const ai = require('./ai');
    const difficulty = room.difficulty || 'medium';
    const { x, y } = ai.getBestMove(room.board, 2, difficulty);

    if (x === -1) return; // 无可用位置

    room.board[y][x] = 2;
    room.moveHistory.push({ x, y, player: 2 });

    this.io.to(room.host.id).emit('move_made', {
      x,
      y,
      player: 2,
      board: room.board,
      currentPlayer: 1
    });

    // 检查胜利
    if (this.checkWin(room.board, x, y, 2)) {
      room.status = 'finished';
      room.winner = 2;
      this.io.to(room.roomId).emit('game_over', {
        winner: 2,
        reason: '五子连珠'
      });
      this.deleteRoomFromRedis(room.roomId);
      return;
    }

    room.currentPlayer = 1;
    this.saveRoomToRedis(room.roomId, room);
  }

  // 检查胜利
  checkWin(board, x, y, player) {
    const directions = [
      [1, 0],   // 水平
      [0, 1],   // 垂直
      [1, 1],   // 对角线
      [1, -1]   // 反对角线
    ];

    for (const [dx, dy] of directions) {
      let count = 1;

      // 正方向
      for (let i = 1; i < 5; i++) {
        const nx = x + dx * i;
        const ny = y + dy * i;
        if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15) break;
        if (board[ny][nx] === player) count++;
        else break;
      }

      // 反方向
      for (let i = 1; i < 5; i++) {
        const nx = x - dx * i;
        const ny = y - dy * i;
        if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15) break;
        if (board[ny][nx] === player) count++;
        else break;
      }

      if (count >= 5) return true;
    }

    return false;
  }

  // 检查平局
  checkDraw(board) {
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 15; x++) {
        if (board[y][x] === 0) return false;
      }
    }
    return true;
  }

  // 请求悔棋
  requestUndo(socket) {
    const roomId = socket.roomId;
    if (!roomId || roomId.startsWith('ai_')) {
      return { success: false, error: '无效房间' };
    }

    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: '房间不存在' };
    if (room.status !== 'playing') return { success: false, error: '游戏未进行' };
    if (room.moveHistory.length === 0) return { success: false, error: '无棋可悔' };

    // 人机模式：直接悔棋
    if (room.aiPlayer) {
      if (room.moveHistory.length >= 1) {
        const lastMove = room.moveHistory.pop();
        room.board[lastMove.y][lastMove.x] = 0;

        // 如果悔的是 AI 的棋，需要再悔一步玩家的
        if (room.moveHistory.length > 0 && room.currentPlayer === 2) {
          const prevMove = room.moveHistory.pop();
          room.board[prevMove.y][prevMove.x] = 0;
        }

        room.currentPlayer = 1;

        socket.emit('undo_success', {
          board: room.board,
          currentPlayer: room.currentPlayer
        });

        this.saveRoomToRedis(roomId, room);
        return { success: true };
      }
    }

    // 人人模式：请求对方同意
    if (room.undoRequested) {
      return { success: false, error: '已有待处理的悔棋请求' };
    }

    room.undoRequested = true;
    const opponent = socket.id === room.host.id ? room.guest : room.host;

    if (opponent) {
      opponent.emit('undo_requested', {
        from: socket.playerColor
      });
    }

    return { success: true, pending: true };
  }

  // 响应悔棋
  respondUndo(socket, accept) {
    const roomId = socket.roomId;
    if (!roomId) return { success: false, error: '无效房间' };

    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: '房间不存在' };

    room.undoRequested = false;
    const opponent = socket.id === room.host.id ? room.guest : room.host;

    if (!accept) {
      if (opponent) {
        opponent.emit('undo_response', { accepted: false });
      }
      return { success: false, accepted: false };
    }

    // 执行悔棋
    if (room.moveHistory.length > 0) {
      const lastMove = room.moveHistory.pop();
      room.board[lastMove.y][lastMove.x] = 0;
      room.currentPlayer = lastMove.player;

      this.io.to(roomId).emit('undo_success', {
        board: room.board,
        currentPlayer: room.currentPlayer
      });

      this.saveRoomToRedis(roomId, room);
    }

    if (opponent) {
      opponent.emit('undo_response', { accepted: true });
    }

    return { success: true, accepted: true };
  }

  // 请求重新开始
  requestRestart(socket) {
    const roomId = socket.roomId;
    if (!roomId) return { success: false };

    const room = this.rooms.get(roomId);
    if (!room) return { success: false };

    // 人机模式：直接重新开始
    if (room.aiPlayer) {
      room.board = Array(15).fill(null).map(() => Array(15).fill(0));
      room.currentPlayer = 1;
      room.moveHistory = [];
      room.status = 'playing';
      room.winner = null;

      socket.emit('restart_success', {
        board: room.board,
        currentPlayer: 1
      });

      this.saveRoomToRedis(roomId, room);
      return { success: true };
    }

    // 人人模式
    if (room.restartRequested) {
      return { success: false, error: '已有待处理的请求' };
    }

    room.restartRequested = true;
    const opponent = socket.id === room.host.id ? room.guest : room.host;

    if (opponent) {
      opponent.emit('restart_requested', {
        from: socket.playerColor
      });
    }

    return { success: true, pending: true };
  }

  // 响应重新开始
  respondRestart(socket, accept) {
    const roomId = socket.roomId;
    if (!roomId) return { success: false };

    const room = this.rooms.get(roomId);
    if (!room) return { success: false };

    room.restartRequested = false;
    const opponent = socket.id === room.host.id ? room.guest : room.host;

    if (!accept) {
      if (opponent) {
        opponent.emit('restart_response', { accepted: false });
      }
      return { success: false, accepted: false };
    }

    // 执行重新开始
    room.board = Array(15).fill(null).map(() => Array(15).fill(0));
    room.currentPlayer = 1;
    room.moveHistory = [];
    room.status = 'playing';
    room.winner = null;

    this.io.to(roomId).emit('restart_success', {
      board: room.board,
      currentPlayer: 1
    });

    if (opponent) {
      opponent.emit('restart_response', { accepted: true });
    }

    this.saveRoomToRedis(roomId, room);
    return { success: true, accepted: true };
  }

  // 重连房间（唯一版本）
  async reconnectRoom(socket, roomId, playerColor) {
    let room = this.rooms.get(roomId);
    let restored = false;

    // 如果内存中没有，尝试从 Redis 恢复
    if (!room && this.redisClient && this.redisClient.isConnected()) {
      const roomData = await this.redisClient.getRoom(roomId);
      if (roomData) {
        logger.info(`从 Redis 恢复房间：${roomId}`);
        // 恢复房间到内存
        room = Room.fromJSON(roomData, socket);

        // 如果先恢复的是 guest，先放一个离线占位 host，避免颜色映射错误。
        if (playerColor === 2) {
          room.host = {
            id: '__offline_host__',
            __placeholder: true,
            emit: () => {}
          };
        }

        this.rooms.set(roomId, room);
        restored = true;
      }
    }

    if (!room) {
      return { success: false, error: '房间不存在或已过期' };
    }

    // 验证身份并更新 socket
    let isHost = false;

    if (playerColor === 1) {
      room.host = socket;
      room.hostDisconnected = false;
      isHost = true;
    } else if (playerColor === 2) {
      room.guest = socket;
      room.guestDisconnected = false;
      isHost = false;
    } else {
      return { success: false, error: '无效的玩家颜色' };
    }

    // 更新 socket 属性
    socket.join(roomId);
    socket.roomId = roomId;
    socket.isHost = isHost;
    socket.playerColor = playerColor;

    // 状态同步
    const opponent = isHost ? room.guest : room.host;
    if (opponent && !opponent.__placeholder) {
      opponent.emit('opponent_reconnected', {
        playerColor: playerColor
      });
    }

    // 检查对手是否在线
    const opponentOnline = isHost
      ? !!(room.guest && !room.guest.__placeholder)
      : !!(room.host && !room.host.__placeholder);

    logger.info(`玩家重连房间：${roomId}, 玩家：${socket.id}`);

    // 更新 Redis
    this.saveRoomToRedis(roomId, room);

    return {
      success: true,
      restored,
      roomId,
      isHost,
      playerColor,
      status: room.status,
      board: room.board,
      currentPlayer: room.currentPlayer,
      moveHistory: room.moveHistory,
      isPlaying: room.status === 'playing',
      opponentOnline
    };
  }

  // 离开房间
  leaveRoom(socket) {
    const roomId = socket.roomId;
    if (!roomId || roomId.startsWith('ai_')) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const isHost = room.host && socket.id === room.host.id;
    const opponent = isHost ? room.guest : room.host;
    const hasOpponent = opponent && !opponent.__placeholder;

    if (isHost && hasOpponent) {
      // 房主离开，guest 变为新房主，重置对局
      room.host = opponent;
      room.guest = null;
      opponent.isHost = true;
      opponent.playerColor = 1;

      // 强制重置房间状态和游戏数据
      room.status = 'waiting';
      room.board = Array(15).fill(null).map(() => Array(15).fill(0));
      room.moveHistory = [];
      room.currentPlayer = 1;
      room.winner = null;
      room.hostReady = false;
      room.guestReady = false;

      // 通知新房主
      opponent.emit('became_host', {
        roomId,
        reason: '房主离开，你已成为新房主，对局已重置',
        preserveGame: false
      });

      this.saveRoomToRedis(roomId, room);
    } else if (!isHost && hasOpponent) {
      // Guest 离开
      room.guest = null;
      room.status = 'waiting';
      room.board = Array(15).fill(null).map(() => Array(15).fill(0));
      room.moveHistory = [];
      room.currentPlayer = 1;
      room.winner = null;
      room.hostReady = false;
      room.guestReady = false;

      // 通知房主
      opponent.emit('player_left', {
        reason: '对手离开，对局已重置',
        preserveGame: false
      });

      this.saveRoomToRedis(roomId, room);
    } else {
      // 两边都不在，清理房间
      this.rooms.delete(roomId);
      this.deleteRoomFromRedis(roomId);
    }

    socket.roomId = null;
    socket.isHost = false;
    socket.playerColor = null;
  }

  // 玩家准备
  playerReady(socket) {
    const roomId = socket.roomId;
    if (!roomId || roomId.startsWith('ai_')) {
      return { success: false, error: '无效房间' };
    }

    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: '房间不存在' };
    if (room.status !== 'waiting') return { success: false, error: '游戏已开始' };

    const isHost = room.host && socket.id === room.host.id;

    if (isHost) {
      room.hostReady = true;
    } else {
      room.guestReady = true;
    }

    // 通知对手
    const opponent = isHost ? room.guest : room.host;
    if (opponent) {
      opponent.emit('opponent_ready', {
        playerColor: isHost ? 1 : 2
      });
    }

    // 检查双方是否都准备好了
    if (room.isBothReady()) {
      room.status = 'playing';
      // 通知双方游戏开始
      this.io.to(roomId).emit('game_start', {
        roomId,
        currentPlayer: room.currentPlayer,
        board: room.board
      });

      this.saveRoomToRedis(roomId, room);
    }

    return { success: true, hostReady: room.hostReady, guestReady: room.guestReady };
  }

  // 处理断开连接
  handleDisconnect(socket) {
    const roomId = socket.roomId;
    if (!roomId) return;

    // 人机对战
    if (roomId.startsWith('ai_')) {
      this.rooms.delete(roomId);
      this.deleteRoomFromRedis(roomId);
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) return;

    // 标记玩家断开，给 15 分钟重连时间
    if (room.host && socket.id === room.host.id) {
      room.hostDisconnected = true;
      room.hostDisconnectTime = Date.now();
    } else if (room.guest && socket.id === room.guest.id) {
      room.guestDisconnected = true;
      room.guestDisconnectTime = Date.now();
    }

    // 通知对手
    const opponent = socket.id === room.host.id ? room.guest : room.host;
    if (opponent) {
      opponent.emit('opponent_disconnected', {
        reason: '对手断开连接，等待重连...'
      });
    }

    // 保存到 Redis
    this.saveRoomToRedis(roomId, room);

    // 15 分钟后清理房间（如果没有重连）
    setTimeout(() => {
      const currentRoom = this.rooms.get(roomId);
      if (!currentRoom) return;

      const now = Date.now();
      const hostTimeout = currentRoom.hostDisconnected && (now - currentRoom.hostDisconnectTime > 900000);
      const guestTimeout = currentRoom.guestDisconnected && (now - currentRoom.guestDisconnectTime > 900000);

      if (hostTimeout || guestTimeout) {
        // 通知还在的玩家
        if (!currentRoom.hostDisconnected && currentRoom.host) {
          currentRoom.host.emit('player_left', { reason: '对手离开' });
        }
        if (!currentRoom.guestDisconnected && currentRoom.guest) {
          currentRoom.guest.emit('player_left', { reason: '对手离开' });
        }
        this.rooms.delete(roomId);
        this.deleteRoomFromRedis(roomId);
      }
    }, 901000);
  }

  // 保存到 Redis
  async saveRoomToRedis(roomId, room) {
    if (!this.redisClient || !this.redisClient.isConnected()) return;

    try {
      await this.redisClient.saveRoom(roomId, room.toJSON());
    } catch (error) {
      logger.error('保存房间到 Redis 失败:', error.message);
    }
  }

  // 从 Redis 删除房间
  async deleteRoomFromRedis(roomId) {
    if (!this.redisClient || !this.redisClient.isConnected()) return;

    try {
      await this.redisClient.deleteRoom(roomId);
    } catch (error) {
      logger.error('从 Redis 删除房间失败:', error.message);
    }
  }
}

module.exports = RoomManager;
