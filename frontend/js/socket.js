// Socket 通信模块

class SocketManager {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  // 初始化连接
  connect() {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const host = window.location.host;
    const socketUrl = `${protocol}//${host}`;

    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts
    });

    this.setupEventHandlers();
    return this.socket;
  }

  // 等待连接成功
  waitForConnection() {
    return new Promise((resolve) => {
      if (this.socket && this.socket.connected) {
        resolve();
      } else {
        this.socket.once('connect', () => {
          resolve();
        });
      }
    });
  }

  // 设置事件处理
  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.reconnectAttempts = 0;
      this.emit('connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.emit('disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.reconnectAttempts++;
      this.emit('error', error.message);
    });

    // 房间事件 - 注意：room_created 和 room_joined 使用回调方式，不需要事件监听
    this.socket.on('player_joined', (data) => {
      this.emit('playerJoined', data);
    });

    // 游戏事件
    this.socket.on('game_start', (data) => {
      this.emit('gameStart', data);
    });

    this.socket.on('move_made', (data) => {
      this.emit('moveMade', data);
    });

    // 悔棋事件
    this.socket.on('undo_requested', (data) => {
      this.emit('undoRequested', data);
    });

    this.socket.on('undo_response', (data) => {
      this.emit('undoResponse', data);
    });

    this.socket.on('undo_success', (data) => {
      this.emit('undoSuccess', data);
    });

    // 重新开始事件
    this.socket.on('restart_requested', (data) => {
      this.emit('restartRequested', data);
    });

    this.socket.on('restart_response', (data) => {
      this.emit('restartResponse', data);
    });

    this.socket.on('restart_success', (data) => {
      this.emit('restartSuccess', data);
    });

    // 游戏结束
    this.socket.on('game_over', (data) => {
      this.emit('gameOver', data);
    });

    // 玩家离开
    this.socket.on('player_left', (data) => {
      this.emit('playerLeft', data);
    });

    // 对手断开连接
    this.socket.on('opponent_disconnected', (data) => {
      this.emit('opponentDisconnected', data);
    });

    // 对手重连
    this.socket.on('opponent_reconnected', (data) => {
      this.emit('opponentReconnected', data);
    });

    // 错误
    this.socket.on('error', (data) => {
      this.emit('socketError', data);
    });
  }

  // 创建房间
  createRoom() {
    this.socket.emit('create_room', (response) => {
      console.log('createRoom callback:', response);
      this.emit('roomCreated', response);
    });
  }

  // 加入房间
  joinRoom(roomId) {
    console.log('joinRoom called with roomId:', roomId);
    this.socket.emit('join_room', roomId, (response) => {
      console.log('joinRoom callback:', response);
      this.emit('roomJoined', response);
    });
  }

  // 落子
  makeMove(x, y) {
    this.socket.emit('make_move', { x, y });
  }

  // 请求悔棋
  requestUndo() {
    this.socket.emit('request_undo', (response) => {
      this.emit('undoRequestResult', response);
    });
  }

  // 响应悔棋
  respondUndo(accept) {
    this.socket.emit('respond_undo', accept, (response) => {
      this.emit('undoResponseResult', response);
    });
  }

  // 请求重新开始
  requestRestart() {
    this.socket.emit('request_restart', (response) => {
      this.emit('restartRequestResult', response);
    });
  }

  // 响应重新开始
  respondRestart(accept) {
    this.socket.emit('respond_restart', accept, (response) => {
      this.emit('restartResponseResult', response);
    });
  }

  // 离开房间
  leaveRoom() {
    this.socket.emit('leave_room');
  }

  // 重连房间
  reconnectRoom(roomId, playerColor) {
    this.socket.emit('reconnect_room', { roomId, playerColor }, (response) => {
      this.emit('roomReconnected', response);
    });
  }

  // 断���连接
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  // 事件监听
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  // 移除监听
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // 触发事件
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }
}

// 全局实例
const socketManager = new SocketManager();
