// 游戏逻辑模块

class Game {
  constructor() {
    this.board = [];
    this.currentPlayer = 1; // 1: 黑棋, 2: 白棋
    this.myColor = 1; // 我的颜色
    this.gameMode = this.detectInitialMode(); // ai, create, join, multiplayer
    this.isPlaying = false;
    this.moveHistory = [];
    this.winner = null;
    this.roomId = null;
    this.isHost = false;
    this.lastMove = null; // {x, y}
  }

  // 根据当前 URL 检测初始模式
  detectInitialMode() {
    const path = window.location.pathname;

    // /room/XXXXXX - 具体房间
    const roomMatch = path.match(/^\/room\/([A-Z0-9]{6})\/?$/i);
    if (roomMatch) {
      return 'room';
    }

    // /room - 玩家对战选择页面
    if (path === '/room' || path === '/room/') {
      return 'multiplayer';
    }

    // /ai 或 / 或其他 - 人机对战
    return 'ai';
  }

  // 初始化游戏
  init(gameMode = 'ai') {
    this.gameMode = gameMode;
    this.board = Array(15).fill(null).map(() => Array(15).fill(0));
    this.currentPlayer = 1;
    this.isPlaying = false;
    this.moveHistory = [];
    this.winner = null;
    this.lastMove = null;
  }

  // 重置棋盘
  reset() {
    this.board = Array(15).fill(null).map(() => Array(15).fill(0));
    this.currentPlayer = 1;
    this.isPlaying = true;
    this.moveHistory = [];
    this.winner = null;
    this.lastMove = null;
  }

  // 落子
  makeMove(x, y, player) {
    if (x < 0 || x >= 15 || y < 0 || y >= 15) return false;
    if (this.board[y][x] !== 0) return false;
    if (this.winner !== null) return false;

    this.board[y][x] = player;
    this.moveHistory.push({ x, y, player });
    this.lastMove = { x, y };

    return true;
  }

  // 撤销落子
  undoMove() {
    if (this.moveHistory.length === 0) return false;

    const lastMove = this.moveHistory.pop();
    this.board[lastMove.y][lastMove.x] = 0;
    this.currentPlayer = lastMove.player;

    if (this.moveHistory.length > 0) {
      this.lastMove = this.moveHistory[this.moveHistory.length - 1];
    } else {
      this.lastMove = null;
    }

    return true;
  }

  // 检查胜利
  checkWin(x, y, player) {
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
        if (this.board[ny][nx] === player) count++;
        else break;
      }

      // 反方向
      for (let i = 1; i < 5; i++) {
        const nx = x - dx * i;
        const ny = y - dy * i;
        if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15) break;
        if (this.board[ny][nx] === player) count++;
        else break;
      }

      if (count >= 5) return true;
    }

    return false;
  }

  // 检查平局
  checkDraw() {
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 15; x++) {
        if (this.board[y][x] === 0) return false;
      }
    }
    return true;
  }

  // 切换玩家
  switchPlayer() {
    this.currentPlayer = 3 - this.currentPlayer;
  }

  // 获取当前位置是否可落子
  canMove(x, y) {
    return x >= 0 && x < 15 && y >= 0 && y < 15 && this.board[y][x] === 0;
  }

  // 是否轮到我落子
  isMyTurn() {
    return this.currentPlayer === this.myColor;
  }

  // 游戏是否结束
  isGameOver() {
    return this.winner !== null;
  }

  // 设置我的颜色
  setMyColor(color) {
    this.myColor = color;
  }

  // 设置房间信息
  setRoomInfo(roomId, isHost) {
    this.roomId = roomId;
    this.isHost = isHost;
    if (isHost) {
      this.myColor = 1;
    }
  }

  // 获取玩家名称
  getPlayerName(player) {
    return player === 1 ? '黑方' : '白方';
  }

  // 获取我的玩家名称
  getMyPlayerName() {
    return this.getPlayerName(this.myColor);
  }

  // 获取对手玩家名称
  getOpponentName() {
    return this.getPlayerName(3 - this.myColor);
  }

  // 保存游戏状态到 localStorage
  saveGame() {
    // 只在 AI 模式且有落子时保存
    if (this.gameMode !== 'ai' || this.moveHistory.length === 0) return;

    const gameState = {
      board: this.board,
      currentPlayer: this.currentPlayer,
      myColor: this.myColor,
      moveHistory: this.moveHistory,
      lastMove: this.lastMove,
      winner: this.winner
    };

    localStorage.setItem('gomoku_game_state', JSON.stringify(gameState));
  }

  // 从 localStorage 加载游戏状态
  loadGame() {
    // 只在 AI 模式下恢复
    if (this.gameMode !== 'ai') return false;

    const saved = localStorage.getItem('gomoku_game_state');
    if (!saved) return false;

    try {
      const gameState = JSON.parse(saved);
      this.board = gameState.board;
      this.currentPlayer = gameState.currentPlayer;
      this.myColor = gameState.myColor;
      this.moveHistory = gameState.moveHistory;
      this.lastMove = gameState.lastMove;
      this.winner = gameState.winner;
      this.isPlaying = true;
      return true;
    } catch (e) {
      console.error('加载游戏状态失败:', e);
      return false;
    }
  }

  // 清除保存的游戏状态
  clearSavedGame() {
    localStorage.removeItem('gomoku_game_state');
  }
}

// 全局实例
const game = new Game();
