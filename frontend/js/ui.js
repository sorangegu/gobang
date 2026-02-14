// UI 交互模块

class UI {
  constructor() {
    this.canvas = document.getElementById('board');
    this.ctx = this.canvas.getContext('2d');
    this.cellSize = 40;
    this.boardSize = 15;
    this.padding = 22;

    // 初始化 canvas 尺寸（只执行一次）
    this.initCanvas();

    // 初始化统计
    this.stats = this.loadStats();

    this.initElements();
    this.initEventListeners();
    this.loadTheme();

    // 解析当前路径，决定初始化模式
    this.initMode = this.detectModeFromURL();

    // 根据模式初始化
    if (this.initMode.type === 'ai') {
      // 人机模式：加载保存的进度
      game.init('ai');
      game.myColor = 1;
      // 尝试加载保存的游戏状态
      const loaded = game.loadGame();
      if (!loaded) {
        game.isPlaying = true;
        game.board = Array(15).fill(null).map(() => Array(15).fill(0));
      }
      this.updateModeUI('ai');
      // 加载完棋局后再绘制棋盘
      this.drawBoard();
    } else if (this.initMode.type === 'create') {
      // 创建房间模式：先检查是否有保存的房间信息
      const savedRoom = this.getValidSavedRoom();
      if (savedRoom && savedRoom.isHost) {
        // 有保存的房间信息且是房主，尝试重连
        game.init('create');
        game.myColor = savedRoom.playerColor;
        this.pendingReconnect = savedRoom;
        this.drawBoard();
      } else {
        // 没有保存的房间信息或不是房主，创建新房间
        game.init('create');
        // 立即显示面板（邀请链接稍后填充）
        this.roomInfoSection.style.display = 'block';
        document.getElementById('inviteSection').style.display = 'block';
        document.getElementById('joinSectionPanel').style.display = 'none';
        this.opponentCard.style.display = 'none';
        this.updateModeUI('create');
      }
    } else if (this.initMode.type === 'join') {
      // 加入房间模式：立即显示输入框
      game.init('join');
      this.roomInfoSection.style.display = 'block';
      document.getElementById('inviteSection').style.display = 'none';
      document.getElementById('joinSectionPanel').style.display = 'block';
      this.opponentCard.style.display = 'none';
      this.updateModeUI('join');
    } else if (this.initMode.type === 'room') {
      // 具体房间：检查重连还是新加入
      const savedRoom = this.getValidSavedRoom();
      if (savedRoom && savedRoom.roomId === this.initMode.roomId) {
        // 重连
        game.init(savedRoom.isHost ? 'create' : 'join');
        game.myColor = savedRoom.playerColor;
        this.pendingReconnect = savedRoom;
      } else {
        // 新加入
        game.init('join');
        this.pendingRoomId = this.initMode.roomId;
      }
      this.updateModeUI('room');
      this.drawBoard();
    }

    this.updateUI();
    this.updateStats();
  }

  // 从 URL 检测当前模式
  detectModeFromURL() {
    const path = window.location.pathname;

    // /room/create - 创建房间（必须先于房间号匹配）
    if (path === '/room/create') {
      return { type: 'create' };
    }

    // /room/join - 加入房间
    if (path === '/room/join') {
      return { type: 'join' };
    }

    // /room/XXXXXX - 具体房间
    const roomMatch = path.match(/^\/room\/([A-Z0-9]{6})$/i);
    if (roomMatch) {
      return { type: 'room', roomId: roomMatch[1].toUpperCase() };
    }

    // / 或 /ai - 人机对战（默认）
    return { type: 'ai' };
  }

  // 获取有效的保存房间信息
  getValidSavedRoom() {
    const savedRoom = localStorage.getItem('gobang-room');
    if (!savedRoom) return null;

    try {
      const roomData = JSON.parse(savedRoom);
      if (roomData.roomId && roomData.playerColor && Date.now() - roomData.timestamp < 5 * 60 * 1000) {
        return roomData;
      }
    } catch (e) {}
    localStorage.removeItem('gobang-room');
    return null;
  }

  // 更新模式相关的 UI
  updateModeUI(mode) {
    // 更新导航按钮状态
    this.navBtns.forEach(btn => {
      const btnMode = btn.dataset.mode;
      btn.classList.toggle('active',
        (mode === 'ai' && btnMode === 'ai') ||
        (mode === 'create' && btnMode === 'create') ||
        (mode === 'join' && btnMode === 'join') ||
        (mode === 'room' && btnMode === 'join')
      );
    });

    if (mode === 'ai') {
      this.roomPanel.style.display = 'none';
      this.roomInfoSection.style.display = 'none';
      this.opponentCard.style.display = 'flex';
      this.opponentCard.querySelector('.player-label').textContent = 'AI (白方)';
    } else if (mode === 'create' || mode === 'join' || mode === 'room') {
      // create/join/room 模式的面板在 DOMContentLoaded 中处理
      this.opponentCard.style.display = 'none';
    }
  }

  // 初始�� Canvas 尺寸（只在构造函数中调用一次）
  initCanvas() {
    const { canvas, boardSize, padding } = this;
    const dpr = window.devicePixelRatio || 1;

    // 读取 CSS 已设置的尺寸，避免重新计算导致抖动
    const computedStyle = getComputedStyle(canvas);
    const cssWidth = parseFloat(computedStyle.width);
    const cssHeight = parseFloat(computedStyle.height);

    // 使用 CSS 设置的尺寸，如果无效则使用默认值
    let canvasSize;
    if (cssWidth > 0 && cssHeight > 0) {
      canvasSize = Math.min(cssWidth, cssHeight);
    } else if (window.innerWidth <= 768) {
      canvasSize = window.innerWidth <= 400 ? 304 : 340;
    } else {
      canvasSize = 604;
    }

    // 根据最终尺寸计算格子大小
    this.cellSize = (canvasSize - padding * 2) / (boardSize - 1);

    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    canvas.style.width = canvasSize + 'px';
    canvas.style.height = canvasSize + 'px';

    // 保存 dpr 供后续使用
    this.dpr = dpr;
    this.canvasSize = canvasSize;

    // 设置 canvas 尺寸后会清空画布，立即绘制完整棋盘避免闪烁
    this.drawInitialBoard();
  }

  // 绘制初始棋盘（包含背景和网格）
  drawInitialBoard() {
    const { ctx, cellSize, boardSize, padding, dpr, canvasSize } = this;
    const totalSize = cellSize * (boardSize - 1);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // 绘制棋盘背景
    ctx.fillStyle = '#deb887';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // 绘制网格线
    ctx.strokeStyle = '#8b7355';
    ctx.lineWidth = 1;

    for (let i = 0; i < boardSize; i++) {
      // 横线
      ctx.beginPath();
      ctx.moveTo(padding, padding + i * cellSize);
      ctx.lineTo(padding + totalSize, padding + i * cellSize);
      ctx.stroke();

      // 竖线
      ctx.beginPath();
      ctx.moveTo(padding + i * cellSize, padding);
      ctx.lineTo(padding + i * cellSize, padding + totalSize);
      ctx.stroke();
    }

    // 绘制星位点
    ctx.fillStyle = '#8b7355';
    const starPoints = [[3, 3], [11, 3], [7, 7], [3, 11], [11, 11]];
    const starRadius = Math.max(2.5, cellSize / 10);
    starPoints.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(padding + x * cellSize, padding + y * cellSize, starRadius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // 初始化DOM元素
  initElements() {
    this.navBtns = document.querySelectorAll('.nav-btn');
    this.themeToggle = document.getElementById('themeToggle');
    this.roomPanel = document.getElementById('roomPanel');
    this.playerCard = document.getElementById('playerCard');
    this.opponentCard = document.getElementById('opponentCard');
    this.currentTurnDisplay = document.getElementById('currentTurn');
    this.gameModeDisplay = document.getElementById('gameMode');
    this.undoBtn = document.getElementById('undoBtn');
    this.restartBtn = document.getElementById('restartBtn');
    this.resultModal = document.getElementById('resultModal');
    this.resultMessage = document.getElementById('resultMessage');
    this.toast = document.getElementById('toast');
    this.toastMessage = document.getElementById('toastMessage');
    this.resetStatsBtn = document.getElementById('resetStatsBtn');
    this.roomInfoSection = document.getElementById('roomInfoSection');
    this.leaveRoomBtn = document.getElementById('leaveRoomBtn');
  }

  // 初始化事件监听
  initEventListeners() {
    // 主题切换
    this.themeToggle.addEventListener('click', () => this.toggleTheme());

    // 模式选择
    this.navBtns.forEach(btn => {
      btn.addEventListener('click', () => this.handleModeChange(btn.dataset.mode));
    });

    // 悔棋
    this.undoBtn.addEventListener('click', () => this.handleUndo());

    // 重新开始
    this.restartBtn.addEventListener('click', () => this.handleRestart());

    // 棋盘点击
    this.canvas.addEventListener('click', (e) => this.handleBoardClick(e));

    // 结果弹窗
    document.getElementById('restartGameBtn').addEventListener('click', () => {
      this.hideModal(this.resultModal);
      this.handleRestart();
    });
    document.getElementById('backHomeBtn').addEventListener('click', () => {
      this.hideModal(this.resultModal);
      game.reset();
      this.drawBoard();
      this.updateUI();
    });

    // 重置统计
    this.resetStatsBtn.addEventListener('click', () => this.resetStats());

    // 离开房间
    this.leaveRoomBtn.addEventListener('click', () => this.handleLeaveRoom());

    // 加入房间按钮（左侧面板）
    document.getElementById('joinRoomBtnPanel')?.addEventListener('click', () => this.joinRoomFromPanel());
    document.getElementById('joinRoomBtnPanel')?.addEventListener('click', () => this.joinRoomFromPanel());
    document.getElementById('roomIdInputPanel')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.joinRoomFromPanel();
    });

    // 复制房间号
    document.getElementById('copyRoomId')?.addEventListener('click', () => {
      const roomId = document.getElementById('displayRoomId').textContent;
      navigator.clipboard.writeText(roomId);
      this.showToast('房间号已复制');
    });

    // 复制邀请链接
    document.getElementById('copyInviteLink')?.addEventListener('click', () => {
      const link = document.getElementById('inviteLink').value;
      navigator.clipboard.writeText(link);
      this.showToast('邀请链接已复制');
    });

    // 初始化Socket监听
    this.initSocketListeners();
  }

  // 初始化Socket监听
  initSocketListeners() {
    socketManager.on('roomCreated', (data) => {
      if (data.success) {
        // 在左侧面板显示房间信息
        document.getElementById('displayRoomId').textContent = data.roomId;
        document.getElementById('inviteSection').style.display = 'block';
        const inviteUrl = `${window.location.origin}/room/${data.roomId}`;
        document.getElementById('inviteLink').value = inviteUrl;
        game.setRoomInfo(data.roomId, true);
        this.saveRoomInfo(data.roomId, 1);
      } else {
        this.showToast(data.error || '创建房间失败');
      }
    });

    socketManager.on('roomJoined', (data) => {
      if (data.success) {
        game.setRoomInfo(data.roomId, false);
        game.gameMode = 'join';
        game.myColor = data.playerColor || 2;
        game.reset();
        document.getElementById('displayRoomId').textContent = data.roomId;
        this.roomPanel.style.display = 'none';
        this.opponentCard.style.display = 'flex';
        this.opponentCard.querySelector('.player-label').textContent = '对手 (黑方)';
        this.playerCard.querySelector('.player-label').textContent = '你 (白方)';
        this.roomInfoSection.style.display = 'block';
        this.drawBoard();
        this.updateUI();
        this.saveRoomInfo(data.roomId, data.playerColor || 2);
      } else {
        this.showToast(data.error || '加入房间失败');
      }
    });

    socketManager.on('roomReconnected', (data) => {
      if (data.success) {
        game.setRoomInfo(data.roomId, data.isHost);
        game.gameMode = data.isHost ? 'create' : 'join';
        game.myColor = data.playerColor;
        game.board = data.board;
        game.currentPlayer = data.currentPlayer;
        game.isPlaying = data.status === 'playing';
        document.getElementById('displayRoomId').textContent = data.roomId;
        this.roomPanel.style.display = 'none';
        this.opponentCard.style.display = 'flex';
        this.opponentCard.querySelector('.player-label').textContent = data.isHost ? '对手 (白方)' : '对手 (黑方)';
        this.playerCard.querySelector('.player-label').textContent = data.isHost ? '你 (黑方)' : '你 (白方)';
        this.roomInfoSection.style.display = 'block';
        this.drawBoard();
        this.updateUI();
        this.showToast('重连成功！');
      } else {
        // 重连失败，清除本地存储
        this.clearRoomInfo();
        this.showToast(data.error || '重连失败');
      }
    });

    socketManager.on('playerJoined', (data) => {
      this.roomPanel.style.display = 'none';
      this.opponentCard.style.display = 'flex';
      this.opponentCard.querySelector('.player-label').textContent = '对手 (白方)';
      game.myColor = 1;
      game.gameMode = 'create';
      game.reset();
      this.drawBoard();
      this.updateUI();
      this.showToast('对手已加入，游戏开始！');
    });

    socketManager.on('gameStart', (data) => {
      game.isPlaying = true;
      game.board = data.board || Array(15).fill(null).map(() => Array(15).fill(0));
      game.currentPlayer = data.currentPlayer || 1;
      this.opponentCard.style.display = 'flex';
      this.drawBoard();
      this.updateUI();
      this.showToast('游戏开始！');
    });

    socketManager.on('moveMade', (data) => {
      game.makeMove(data.x, data.y, data.player);
      game.currentPlayer = data.currentPlayer;
      game.lastMove = { x: data.x, y: data.y };
      this.drawBoard();
      this.updateUI();

      if (game.checkWin(data.x, data.y, data.player)) {
        this.showGameOver(data.player);
      }
    });

    socketManager.on('undoRequested', (data) => {
      const playerName = data.from === 1 ? '黑方' : '白方';
      if (confirm(`${playerName}请求悔棋，是否同意？`)) {
        socketManager.respondUndo(true);
      } else {
        socketManager.respondUndo(false);
      }
    });

    socketManager.on('undoSuccess', (data) => {
      game.board = data.board;
      game.currentPlayer = data.currentPlayer;
      if (game.moveHistory.length > 0) {
        game.moveHistory.pop();
        game.lastMove = game.moveHistory.length > 0 ? game.moveHistory[game.moveHistory.length - 1] : null;
      }
      this.drawBoard();
      this.updateUI();
      this.showToast('悔棋成功');
    });

    socketManager.on('undoResponse', (data) => {
      if (!data.accepted) {
        this.showToast('对方拒绝了悔棋请求');
      }
    });

    socketManager.on('restartRequested', () => {
      if (confirm('对手请求重新开始，是否同意？')) {
        socketManager.respondRestart(true);
      } else {
        socketManager.respondRestart(false);
      }
    });

    socketManager.on('restartSuccess', () => {
      game.reset();
      this.drawBoard();
      this.updateUI();
      this.hideModal(this.resultModal);
      this.showToast('游戏重新开始');
    });

    socketManager.on('gameOver', (data) => {
      this.showGameOver(data.winner);
    });

    socketManager.on('playerLeft', (data) => {
      this.showToast(data.reason || '对手离开');
      this.clearRoomInfo();
      setTimeout(() => {
        game.reset();
        this.startAIGame();
      }, 2000);
    });

    socketManager.on('opponentDisconnected', (data) => {
      this.showToast(data.reason || '对手断开连接');
    });

    socketManager.on('opponentReconnected', () => {
      this.showToast('对手已重连');
    });

    socketManager.on('becameHost', (data) => {
      // 成为新房主
      game.isHost = true;
      game.myColor = 1;
      game.gameMode = 'create';
      this.saveRoomInfo(data.roomId, 1);

      // 在左侧面板显示邀请信息
      this.roomPanel.style.display = 'none';
      this.roomInfoSection.style.display = 'block';
      document.getElementById('displayRoomId').textContent = data.roomId;
      document.getElementById('inviteSection').style.display = 'block';
      const inviteUrl = `${window.location.origin}/room/${data.roomId}`;
      document.getElementById('inviteLink').value = inviteUrl;

      this.opponentCard.style.display = 'none';
      this.updateUI();
      this.showToast(data.reason || '你已成为新房主');
    });

    socketManager.on('socketError', (data) => {
      this.showToast(data.error || '发生错误');
    });
  }

  // 绘制棋盘
  drawBoard() {
    const { ctx, cellSize, boardSize, padding, dpr, canvasSize } = this;
    const totalSize = cellSize * (boardSize - 1);

    // 重置变换矩阵并清空画布（不改变 canvas 尺寸，避免抖动）
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvasSize * dpr, canvasSize * dpr);
    ctx.scale(dpr, dpr);

    // 绘制棋盘背景
    ctx.fillStyle = '#deb887';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // 绘制网格线
    ctx.strokeStyle = '#8b7355';
    ctx.lineWidth = 1;

    for (let i = 0; i < boardSize; i++) {
      // 横线
      ctx.beginPath();
      ctx.moveTo(padding, padding + i * cellSize);
      ctx.lineTo(padding + totalSize, padding + i * cellSize);
      ctx.stroke();

      // 竖线
      ctx.beginPath();
      ctx.moveTo(padding + i * cellSize, padding);
      ctx.lineTo(padding + i * cellSize, padding + totalSize);
      ctx.stroke();
    }

    // 绘制星位点
    ctx.fillStyle = '#8b7355';
    const starPoints = [[3, 3], [11, 3], [7, 7], [3, 11], [11, 11]];
    // 根据格子大小动态调整星位点大小
    const starRadius = Math.max(2.5, cellSize / 10);
    starPoints.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(padding + x * cellSize, padding + y * cellSize, starRadius, 0, Math.PI * 2);
      ctx.fill();
    });

    // 绘制棋子
    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        if (game.board[y][x] !== 0) {
          this.drawStone(x, y, game.board[y][x]);
        }
      }
    }

    // 绘制最后落子标记
    if (game.lastMove) {
      const centerX = padding + game.lastMove.x * cellSize;
      const centerY = padding + game.lastMove.y * cellSize;
      // 根据格子大小动态调整标记点大小
      const markerRadius = Math.max(3, cellSize / 8);
      ctx.beginPath();
      ctx.arc(centerX, centerY, markerRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#e94560';
      ctx.fill();
    }
  }

  // 绘制棋子
  drawStone(x, y, player) {
    const { ctx, cellSize, padding } = this;
    const centerX = padding + x * cellSize;
    const centerY = padding + y * cellSize;
    const radius = cellSize / 2 - 2;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);

    if (player === 1) {
      // 黑棋
      const gradient = ctx.createRadialGradient(
        centerX - radius / 3, centerY - radius / 3, 0,
        centerX, centerY, radius
      );
      gradient.addColorStop(0, '#444');
      gradient.addColorStop(1, '#1a1a1a');
      ctx.fillStyle = gradient;
    } else {
      // 白棋
      const gradient = ctx.createRadialGradient(
        centerX - radius / 3, centerY - radius / 3, 0,
        centerX, centerY, radius
      );
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(1, '#dddddd');
      ctx.fillStyle = gradient;
    }

    ctx.fill();
  }

  // 处理模式切换 - 通过 URL 导航
  handleModeChange(mode) {
    if (mode === 'ai') {
      window.history.pushState({}, '', '/');
      location.reload();
    } else if (mode === 'create') {
      window.history.pushState({}, '', '/room/create');
      location.reload();
    } else if (mode === 'join') {
      window.history.pushState({}, '', '/room/join');
      location.reload();
    }
  }

  // 创建房间
  createRoom() {
    game.gameMode = 'create';
    game.isPlaying = false;

    socketManager.createRoom();

    // 在左侧面板显示等待信息
    this.roomPanel.style.display = 'none';
    this.roomInfoSection.style.display = 'block';
    document.getElementById('inviteSection').style.display = 'block';

    this.opponentCard.style.display = 'none';
    this.updateUI();
  }

  // 显示加入房间面板
  showJoinPanel() {
    game.gameMode = 'join';
    game.isPlaying = false;

    // 隐藏顶部面板，显示左侧面板
    this.roomPanel.style.display = 'none';
    this.roomInfoSection.style.display = 'block';
    document.getElementById('inviteSection').style.display = 'none';
    document.getElementById('joinSectionPanel').style.display = 'block';

    this.opponentCard.style.display = 'none';
    this.updateUI();
  }

  // 加入房间（从左侧面板）
  joinRoomFromPanel() {
    const roomId = document.getElementById('roomIdInputPanel').value.trim().toUpperCase();
    if (roomId.length !== 6) {
      this.showToast('请输入6位房间号');
      return;
    }
    socketManager.joinRoom(roomId);
  }

  // 开始人机对战
  startAIGame() {
    // 清除多人房间信息
    this.clearRoomInfo();
    // 清除人机保存的游戏进度
    game.clearSavedGame();

    game.init('ai');
    game.myColor = 1;
    game.isPlaying = true;
    game.reset();

    this.roomPanel.style.display = 'none';
    this.opponentCard.style.display = 'flex';
    this.opponentCard.querySelector('.player-label').textContent = 'AI (白方)';
    this.roomInfoSection.style.display = 'none';
    this.updateUI();
    this.drawBoard();
  }

  // 处理棋盘点击
  handleBoardClick(e) {
    if (!game.isPlaying) return;
    if (game.winner !== null) return;
    if (game.currentPlayer !== game.myColor) return;

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = (this.canvas.width / window.devicePixelRatio) / rect.width;
    const scaleY = (this.canvas.height / window.devicePixelRatio) / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const cellX = Math.round((x - this.padding) / this.cellSize);
    const cellY = Math.round((y - this.padding) / this.cellSize);

    if (cellX < 0 || cellX >= 15 || cellY < 0 || cellY >= 15) return;
    if (!game.canMove(cellX, cellY)) return;

    // 玩家对战模式
    if (game.gameMode !== 'ai') {
      socketManager.makeMove(cellX, cellY);
      return;
    }

    // 人机模式：玩家落子
    game.makeMove(cellX, cellY, game.myColor);
    this.drawBoard();
    this.updateUI();

    // 检查胜利
    if (game.checkWin(cellX, cellY, game.myColor)) {
      this.showGameOver(game.myColor);
      game.clearSavedGame(); // 游戏结束，清除保存的状态
      return;
    }

    // 切换到AI
    game.switchPlayer();
    this.updateUI();

    // AI 落子
    setTimeout(() => this.makeAIMove(), 300);
  }

  // AI 落子
  makeAIMove() {
    const emptyPoints = [];
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 15; x++) {
        if (game.board[y][x] === 0) {
          emptyPoints.push({ x, y });
        }
      }
    }

    if (emptyPoints.length === 0) return;

    // 简单评分算法
    let bestPoint = emptyPoints[0];
    let bestScore = -Infinity;

    for (const point of emptyPoints) {
      const score = this.evaluatePoint(point.x, point.y, 2) +
                    this.evaluatePoint(point.x, point.y, 1) * 0.9;
      if (score > bestScore) {
        bestScore = score;
        bestPoint = point;
      }
    }

    // AI落子
    game.makeMove(bestPoint.x, bestPoint.y, 2);
    this.drawBoard();
    this.updateUI();

    // 检查胜利
    if (game.checkWin(bestPoint.x, bestPoint.y, 2)) {
      this.showGameOver(2);
      game.clearSavedGame(); // 游戏结束，清除保存的状态
      return;
    }

    // 切换回玩家
    game.switchPlayer();
    game.saveGame(); // 保存游戏状态
    this.updateUI();
  }

  // 评估落子点
  evaluatePoint(x, y, player) {
    let score = 0;
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];

    for (const [dx, dy] of directions) {
      let count = 0;
      let openEnds = 0;

      // 正方向
      let nx = x + dx, ny = y + dy;
      while (nx >= 0 && nx < 15 && ny >= 0 && ny < 15 && game.board[ny][nx] === player) {
        count++;
        nx += dx;
        ny += dy;
      }
      if (nx >= 0 && nx < 15 && ny >= 0 && ny < 15 && game.board[ny][nx] === 0) openEnds++;

      // 反方向
      nx = x - dx; ny = y - dy;
      while (nx >= 0 && nx < 15 && ny >= 0 && ny < 15 && game.board[ny][nx] === player) {
        count++;
        nx -= dx;
        ny -= dy;
      }
      if (nx >= 0 && nx < 15 && ny >= 0 && ny < 15 && game.board[ny][nx] === 0) openEnds++;

      // 计分
      if (count >= 4) score += 100000;
      else if (count === 3 && openEnds === 2) score += 10000;
      else if (count === 3 && openEnds === 1) score += 1000;
      else if (count === 2 && openEnds === 2) score += 100;
      else if (count === 2 && openEnds === 1) score += 10;
      else if (count === 1 && openEnds === 2) score += 1;
    }

    return score;
  }

  // 处理悔棋
  handleUndo() {
    if (game.gameMode === 'ai') {
      // 人机模式：直接悔棋
      if (game.moveHistory.length > 0) {
        game.undoMove();
        game.undoMove(); // 悔两步 (玩家+AI)
        game.saveGame(); // 保存游戏状态
        this.drawBoard();
        this.updateUI();
      }
    }
  }

  // 处理重新开始
  handleRestart() {
    game.reset();
    game.clearSavedGame(); // 清除保存的游戏状态
    this.drawBoard();
    this.updateUI();
  }

  // 处理离开房间
  handleLeaveRoom() {
    if (game.gameMode !== 'ai') {
      socketManager.leaveRoom();
    }
    this.clearRoomInfo();
    // 重置到人机模式
    this.startAIGame();
    this.navBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === 'ai');
    });
    this.showToast('已离开房间');
  }

  // 清理房间信息
  clearRoomInfo() {
    game.roomId = null;
    game.isHost = false;
    localStorage.removeItem('gobang-room');
    this.roomInfoSection.style.display = 'none';
  }

  // 保存房间信息到本地存储
  saveRoomInfo(roomId, playerColor) {
    localStorage.setItem('gobang-room', JSON.stringify({
      roomId,
      playerColor,
      timestamp: Date.now()
    }));
  }

  // 更新UI状态
  updateUI() {
    // 更新当前回合
    this.currentTurnDisplay.textContent = game.currentPlayer === 1 ? '黑方' : '白方';

    // 更新模式显示
    if (game.gameMode === 'ai') {
      this.gameModeDisplay.textContent = '人机对战';
    } else if (game.gameMode === 'create') {
      this.gameModeDisplay.textContent = '玩家对战 (房主)';
    } else if (game.gameMode === 'join') {
      this.gameModeDisplay.textContent = '玩家对战 (访客)';
    }

    // 更新回合指示
    const isMyTurn = game.isMyTurn();
    const yourTurnEl = document.getElementById('yourTurn');
    yourTurnEl.classList.toggle('visible', isMyTurn);
    this.playerCard.classList.toggle('active', isMyTurn);
    this.opponentCard.classList.toggle('active', !isMyTurn);

    // 启用/禁用按钮
    this.undoBtn.disabled = game.moveHistory.length === 0;
    this.restartBtn.disabled = !game.isPlaying;
  }

  // 显示游戏结束
  showGameOver(winner) {
    game.winner = winner;
    game.isPlaying = false;

    // 记录统计
    this.recordGame(winner);

    let message = '';
    if (winner === 0) {
      message = '平局！';
    } else if (winner === game.myColor) {
      message = '恭喜，你赢了！';
    } else {
      // 玩家对战模式显示"你输了"，人机模式显示"AI 获胜"
      message = game.gameMode === 'ai' ? 'AI 获胜' : '你输了';
    }

    this.resultMessage.textContent = message;
    this.showModal(this.resultModal);
  }

  // 显示弹窗
  showModal(modal) {
    modal.style.display = 'flex';
  }

  // 隐藏弹窗
  hideModal(modal) {
    modal.style.display = 'none';
  }

  // 显示通知
  showToast(message) {
    this.toastMessage.textContent = message;
    this.toast.style.display = 'block';
    setTimeout(() => {
      this.toast.style.display = 'none';
    }, 3000);
  }

  // 主题切换
  toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  }

  // 加载主题
  loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
  }

  // 加载统计数据
  loadStats() {
    const saved = localStorage.getItem('gobang-stats');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      totalGames: 0,
      winGames: 0,
      totalMoves: 0
    };
  }

  // 保存统计数据
  saveStats() {
    localStorage.setItem('gobang-stats', JSON.stringify(this.stats));
  }

  // 更新统计显示
  updateStats() {
    document.getElementById('totalGames').textContent = this.stats.totalGames;
    document.getElementById('winGames').textContent = this.stats.winGames;
    document.getElementById('totalMoves').textContent = this.stats.totalMoves;

    const winRate = this.stats.totalGames > 0
      ? Math.round((this.stats.winGames / this.stats.totalGames) * 100)
      : 0;
    document.getElementById('winRate').textContent = winRate + '%';
  }

  // 记录游戏结果
  recordGame(winner) {
    this.stats.totalGames++;
    this.stats.totalMoves += game.moveHistory.length;

    if (winner === game.myColor) {
      this.stats.winGames++;
    }

    this.saveStats();
    this.updateStats();
  }

  // 重置统计
  resetStats() {
    this.stats = {
      totalGames: 0,
      winGames: 0,
      totalMoves: 0
    };
    this.saveStats();
    this.updateStats();
    this.showToast('统计已重置');
  }
}

// 初始化UI
let ui;
document.addEventListener('DOMContentLoaded', async () => {
  socketManager.connect();
  ui = new UI();

  // 等待 socket 连接成功
  await socketManager.waitForConnection();

  // 根据初始化模式执行相应操作
  if (ui.initMode.type === 'create') {
    // 创建房间模式：如果是重连，会在构造函数中处理；否则立即创建新房间
    const savedRoom = ui.getValidSavedRoom();
    if (!savedRoom || !savedRoom.isHost) {
      // 没有保存的房间信息，创建新房间
      ui.createRoom();
    }
  } else if (ui.initMode.type === 'join' && !ui.pendingRoomId) {
    // 加入房间模式（输入框已在构造函数中显示）
  } else if (ui.pendingRoomId) {
    // 处理待加入的房间（URL 邀请链接）
    socketManager.joinRoom(ui.pendingRoomId);
    ui.pendingRoomId = null;
  } else if (ui.pendingReconnect) {
    // 处理待重连的房间
    socketManager.reconnectRoom(ui.pendingReconnect.roomId, ui.pendingReconnect.playerColor);
    ui.pendingReconnect = null;
  }
});
