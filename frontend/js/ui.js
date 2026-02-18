// UI 交互模块 - 函数式重构版本

// ========== 状态管理 ==========
const UIState = {
  canvas: null,
  ctx: null,
  cellSize: 40,
  boardSize: 15,
  padding: 22,
  dpr: 1,
  canvasSize: 0,

  // 统计数据
  stats: {
    totalGames: 0,
    winGames: 0,
    totalMoves: 0
  },

  // 多人对战准备状态
  mpOpponentPresent: false,
  mpMyReady: false,
  mpOpponentReady: false,

  // 待重连信息
  pendingReconnect: null,
  pendingRoomId: null,

  // 当前模式
  currentMode: null,
  aiDifficulty: 'medium' // easy, medium, hard
};

// DOM 元素引用
const Elements = {};

// ========== 初始化模块 ==========

function init() {
  initCanvas();
  initElements();
  loadStats();
  loadTheme();

  // 解析当前路径，决定显示哪个面板
  const mode = detectModeFromURL();
  UIState.currentMode = mode;
  console.log('[DEBUG] init mode:', mode);

  // 根据模式初始化
  handleModeInit(mode);

  updateUI();
  updateStats();
  document.body.classList.remove('pre-init');
}

// 从 URL 检测当前模式
function detectModeFromURL() {
  const path = window.location.pathname;

  // /room/XXXXXX - 具体房间
  const roomMatch = path.match(/^\/room\/([A-Z0-9]{6})\/?$/i);
  if (roomMatch) {
    return { type: 'room', roomId: roomMatch[1].toUpperCase() };
  }

  // /room - 玩家对战选择页面
  if (path === '/room' || path === '/room/') {
    return { type: 'multiplayer' };
  }

  // /ai - 人机对战（带难度参数）
  if (path === '/ai' || path === '/ai/') {
    return { type: 'ai' };
  }

  // / 或 /index.html - 首页选择面板
  return { type: 'home' };
}

// 根据模式初始化
function handleModeInit(mode) {
  switch (mode.type) {
    case 'home':
      // 首页选择面板
      showHomePanel();
      break;

    case 'ai':
      // 人机模式：完全独立，不检查房间信息
      initAIGame();
      break;

    case 'multiplayer':
      // 玩家对战选择页面
      initMultiplayerSelect();
      break;

    case 'room':
      // 具体房间页面
      initRoomPage(mode.roomId);
      break;
  }
}

// 初始化首页选择面板
function showHomePanel() {
  // 清除所有游戏状态
  clearGameForNewMode();

  // 隐藏所有面板
  hideAllPanels();

  // 显示首页选择面板
  const homeSelect = document.getElementById('homeSelect');
  if (homeSelect) {
    homeSelect.style.display = 'flex';
  }

  // 更新导航状态
  updateNavState('home');

  // 更新 URL
  window.history.replaceState({}, '', '/');

  // 绘制空棋盘背景
  drawBoard();
}

// 初始化人机游戏
function initAIGame(difficulty = 'medium') {
  UIState.aiDifficulty = difficulty;

  game.init('ai');
  game.myColor = 1;

  // 尝试加载保存的游戏状态
  const loaded = game.loadGame();
  if (!loaded) {
    game.isPlaying = true;
    game.board = Array(15).fill(null).map(() => Array(15).fill(0));
  }

  // 隐藏其他面板
  hideAllPanels();

  // 显示对手卡片
  const opponentCard = document.getElementById('opponentCard');
  if (opponentCard) {
    opponentCard.style.display = 'flex';
    const label = opponentCard.querySelector('.player-label');
    if (label) label.textContent = `AI (${UIState.aiDifficulty === 'easy' ? '简单' : UIState.aiDifficulty === 'medium' ? '中等' : '困难'})`;
  }

  updateModeUI('ai');
  drawBoard();
}

// 初始化玩家对战选择
function initMultiplayerSelect() {
  // 检查是否有保存的房间
  const savedRoom = getValidSavedRoom();
  console.log('[DEBUG] multiplayer mode, savedRoom:', savedRoom);

  if (savedRoom) {
    // 有保存的房间，设置待重连
    game.init(savedRoom.isHost ? 'create' : 'join');
    game.myColor = savedRoom.playerColor;
    game.roomId = savedRoom.roomId;

    // 更新 URL 为房间页
    window.history.replaceState({}, '', `/room/${savedRoom.roomId}`);

    // 显示房间信息
    setRoomInfoSectionDisplay('block');
    updateRoomIdDisplay(savedRoom.roomId);
    setInviteSectionDisplay('block');
    const inviteUrl = `${window.location.origin}/room/${savedRoom.roomId}`;
    setInviteLinkValue(inviteUrl);

    // 设置待重连
    UIState.pendingReconnect = {
      roomId: savedRoom.roomId,
      playerColor: savedRoom.playerColor
    };

    updateModeUI('room');
    drawBoard();
  } else {
    // 没有保存的房间，显示玩家对战选择面板
    clearGameForNewMode();
    game.gameMode = 'multiplayer';
    game.board = Array(15).fill(null).map(() => Array(15).fill(0));
    game.currentPlayer = 1;
    game.isPlaying = false;
    game.moveHistory = [];
    game.winner = null;
    game.lastMove = null;

    hideAllPanels();
    setRoomInfoSectionDisplay('none');

    const multiplayerSelectPanel = document.getElementById('multiplayerSelectPanel');
    if (multiplayerSelectPanel) {
      multiplayerSelectPanel.style.display = 'block';
    }

    updateModeUI('multiplayer');
    drawBoard();
  }
}

// 初始化房间页面
function initRoomPage(roomId) {
  const savedRoom = getValidSavedRoom();

  if (savedRoom && savedRoom.roomId === roomId) {
    // 有保存的房间信息，设置待重连
    game.init(savedRoom.isHost ? 'create' : 'join');
    game.myColor = savedRoom.playerColor;
    game.roomId = savedRoom.roomId;

    // 显示房间信息
    setRoomInfoSectionDisplay('block');
    updateRoomIdDisplay(savedRoom.roomId);
    setInviteSectionDisplay('block');
    const inviteUrl = `${window.location.origin}/room/${savedRoom.roomId}`;
    setInviteLinkValue(inviteUrl);

    updateModeUI('room');

    // 设置待重连
    UIState.pendingReconnect = {
      roomId: savedRoom.roomId,
      playerColor: savedRoom.playerColor
    };
  } else {
    // 没有保存的房间信息，通过邀请链接进来的
    console.log('[DEBUG] 通过邀请链接进入，设置待加入房间:', roomId);
    UIState.pendingRoomId = roomId;

    clearGameForNewMode();
    game.gameMode = 'multiplayer';
    game.board = Array(15).fill(null).map(() => Array(15).fill(0));
    game.currentPlayer = 1;
    game.isPlaying = false;
    game.moveHistory = [];
    game.winner = null;
    game.lastMove = null;

    hideAllPanels();
    setRoomInfoSectionDisplay('none');

    const multiplayerSelectPanel = document.getElementById('multiplayerSelectPanel');
    if (multiplayerSelectPanel) {
      multiplayerSelectPanel.style.display = 'block';
    }

    updateModeUI('multiplayer');
  }

  drawBoard();
}

// 清除游戏状态以便切换模式
function clearGameForNewMode() {
  game.gameMode = null;
  game.roomId = null;
  game.isHost = false;
  game.board = Array(15).fill(null).map(() => Array(15).fill(0));
  game.currentPlayer = 1;
  game.isPlaying = false;
  game.moveHistory = [];
  game.winner = null;
  game.lastMove = null;

  // 清除本地存储的房间信息
  localStorage.removeItem('gobang-room');
}

// 隐藏所有面板
function hideAllPanels() {
  const panels = ['homeSelect', 'aiSelect', 'multiplayerSelectPanel', 'roomPanel'];
  panels.forEach(panelId => {
    const panel = document.getElementById(panelId);
    if (panel) {
      panel.style.display = 'none';
    }
  });
  setRoomInfoSectionDisplay('none');
}

// ========== Canvas 绘制 ==========

function initCanvas() {
  UIState.canvas = document.getElementById('board');
  if (!UIState.canvas) return;

  UIState.ctx = UIState.canvas.getContext('2d');
  const { boardSize } = UIState;
  const dpr = window.devicePixelRatio || 1;

  let canvasSize;
  let padding;
  if (window.innerWidth <= 768) {
    const wrapperOuter = Math.min(window.innerWidth - 20, 604);
    const wrapperPadding = 10;
    canvasSize = Math.max(240, wrapperOuter - wrapperPadding * 2);
    padding = canvasSize <= 320 ? 8 : 10;
  } else {
    canvasSize = 604;
    padding = 22;
  }

  UIState.padding = padding;
  UIState.cellSize = (canvasSize - padding * 2) / (boardSize - 1);

  UIState.canvas.width = canvasSize * dpr;
  UIState.canvas.height = canvasSize * dpr;
  UIState.canvas.style.width = canvasSize + 'px';
  UIState.canvas.style.height = canvasSize + 'px';

  UIState.dpr = dpr;
  UIState.canvasSize = canvasSize;

  drawInitialBoard();
}

function drawInitialBoard() {
  const { ctx, cellSize, boardSize, padding, dpr, canvasSize } = UIState;
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

function drawBoard() {
  const { ctx, cellSize, boardSize, padding, dpr, canvasSize } = UIState;
  const totalSize = cellSize * (boardSize - 1);

  // 重置变换矩阵并清空画布
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
        drawStone(x, y, game.board[y][x]);
      }
    }
  }

  // 绘制最后落子标记
  if (game.lastMove) {
    const centerX = padding + game.lastMove.x * cellSize;
    const centerY = padding + game.lastMove.y * cellSize;
    const markerRadius = Math.max(3, cellSize / 8);
    ctx.beginPath();
    ctx.arc(centerX, centerY, markerRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#e94560';
    ctx.fill();
  }
}

function drawStone(x, y, player) {
  const { ctx, cellSize, padding } = UIState;
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

// ========== DOM 元素初始化 ==========

function initElements() {
  Elements.navBtns = document.querySelectorAll('.nav-btn');
  Elements.themeToggle = document.getElementById('themeToggle');
  Elements.roomPanel = document.getElementById('roomPanel');
  Elements.playerCard = document.getElementById('playerCard');
  Elements.opponentCard = document.getElementById('opponentCard');
  Elements.currentTurnDisplay = document.getElementById('currentTurn');
  Elements.gameModeDisplay = document.getElementById('gameMode');
  Elements.undoBtn = document.getElementById('undoBtn');
  Elements.restartBtn = document.getElementById('restartBtn');
  Elements.resultModal = document.getElementById('resultModal');
  Elements.resultMessage = document.getElementById('resultMessage');
  Elements.toast = document.getElementById('toast');
  Elements.toastMessage = document.getElementById('toastMessage');
  Elements.resetStatsBtn = document.getElementById('resetStatsBtn');
  Elements.roomInfoSection = document.getElementById('roomInfoSection');
  Elements.leaveRoomBtn = document.getElementById('leaveRoomBtn');

  // Board overlay (multiplayer pre-start)
  Elements.boardOverlay = document.getElementById('boardOverlay');
  Elements.overlayTitle = document.getElementById('overlayTitle');
  Elements.overlayDesc = document.getElementById('overlayDesc');
  Elements.overlayStartBtn = document.getElementById('overlayStartBtn');

  initEventListeners();
}

function initEventListeners() {
  // 主题切换
  Elements.themeToggle?.addEventListener('click', () => toggleTheme());

  // 模式选择（桌面端导航）
  Elements.navBtns.forEach(btn => {
    btn.addEventListener('click', () => handleModeChange(btn.dataset.mode));
  });

  // 移动端导航按钮
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      handleModeChange(btn.dataset.mode);
    });
  });

  // 悔棋
  Elements.undoBtn?.addEventListener('click', () => handleUndo());

  // 重新开始
  Elements.restartBtn?.addEventListener('click', () => handleRestart());

  // 棋盘点击
  UIState.canvas?.addEventListener('click', (e) => handleBoardClick(e));

  // 触摸事件
  UIState.canvas?.addEventListener('touchstart', handleTouchStart, { passive: false });

  // 窗口大小改变
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => handleResize(), 250);
  });

  // 结果弹窗
  document.getElementById('restartGameBtn')?.addEventListener('click', () => {
    hideModal(Elements.resultModal);
    handleRestart();
  });

  document.getElementById('backHomeBtn')?.addEventListener('click', () => {
    hideModal(Elements.resultModal);
    if (game.gameMode === 'ai') {
      window.history.pushState({}, '', '/');
      showHomePanel();
    } else {
      handleLeaveRoom();
    }
  });

  // 重置统计
  Elements.resetStatsBtn?.addEventListener('click', () => resetStats());

  // 离开房间
  Elements.leaveRoomBtn?.addEventListener('click', () => handleLeaveRoom());

  // 首页选择按钮事件
  document.getElementById('aiModeBtn')?.addEventListener('click', () => {
    window.history.pushState({}, '', '/ai');
    showDifficultyPanel();
  });

  document.getElementById('multiplayerModeBtn')?.addEventListener('click', () => {
    window.history.pushState({}, '', '/room');
    showMultiplayerSelect();
  });

  // 难度选择按钮事件
  document.getElementById('easyBtn')?.addEventListener('click', () => startAIGameWithDifficulty('easy'));
  document.getElementById('mediumBtn')?.addEventListener('click', () => startAIGameWithDifficulty('medium'));
  document.getElementById('hardBtn')?.addEventListener('click', () => startAIGameWithDifficulty('hard'));
  document.getElementById('backToHomeFromDifficulty')?.addEventListener('click', () => {
    window.history.pushState({}, '', '/');
    showHomePanel();
  });

  // 创建房间按钮
  document.getElementById('createRoomBtn')?.addEventListener('click', () => createRoom());

  // 显示加入房间输入框
  document.getElementById('showJoinBtn')?.addEventListener('click', () => {
    document.getElementById('joinInputSection').style.display = 'block';
  });

  // 加入房间按钮
  document.getElementById('joinRoomBtnPanel')?.addEventListener('click', () => joinRoomFromPanel());
  document.getElementById('roomIdInputPanel')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinRoomFromPanel();
  });

  // 复制房间号
  document.getElementById('copyRoomId')?.addEventListener('click', () => {
    const roomId = document.getElementById('displayRoomId').textContent;
    navigator.clipboard.writeText(roomId);
    showToast('房间号已复制');
  });

  // 切换邀请链接显示
  document.getElementById('toggleInviteLink')?.addEventListener('click', () => {
    const inviteSection = document.getElementById('inviteSection');
    const inviteUrl = `${window.location.origin}/room/${document.getElementById('displayRoomId').textContent}`;
    setInviteLinkValue(inviteUrl);

    if (inviteSection.style.display === 'none' || !inviteSection.style.display) {
      inviteSection.style.display = 'block';
    } else {
      inviteSection.style.display = 'none';
    }

    navigator.clipboard.writeText(inviteUrl);
    showToast('邀请链接已复制');
  });

  // 复制邀请链接
  document.getElementById('copyInviteLink')?.addEventListener('click', () => {
    const link = document.getElementById('inviteLink').value;
    navigator.clipboard.writeText(link);
    showToast('邀请链接已复制');
  });

  // 准备按钮
  document.getElementById('readyBtn')?.addEventListener('click', () => handleReady());

  // Board overlay start button
  Elements.overlayStartBtn?.addEventListener('click', () => handleReady());

  // 房间信息按钮（手机端弹出层）
  const showRoomInfoBtn = document.getElementById('showRoomInfoBtn');
  if (showRoomInfoBtn) {
    showRoomInfoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const popup = document.getElementById('roomDetailPopup');
      if (popup) {
        const isVisible = popup.style.display === 'block';
        popup.style.display = isVisible ? 'none' : 'block';
      }
    });
  }

  // ========== PC 端房间信息事件监听 ==========
  document.getElementById('copyRoomIdDesktop')?.addEventListener('click', () => {
    const roomId = document.getElementById('displayRoomIdDesktop').textContent;
    navigator.clipboard.writeText(roomId);
    showToast('房间号已复制');
  });

  document.getElementById('toggleInviteLinkDesktop')?.addEventListener('click', () => {
    const inviteSectionDesktop = document.getElementById('inviteSectionDesktop');
    const inviteUrl = `${window.location.origin}/room/${document.getElementById('displayRoomIdDesktop').textContent}`;
    setInviteLinkValue(inviteUrl);

    if (inviteSectionDesktop.style.display === 'none' || !inviteSectionDesktop.style.display) {
      inviteSectionDesktop.style.display = 'block';
    } else {
      inviteSectionDesktop.style.display = 'none';
    }

    navigator.clipboard.writeText(inviteUrl);
    showToast('邀请链接已复制');
  });

  document.getElementById('copyInviteLinkDesktop')?.addEventListener('click', () => {
    const link = document.getElementById('inviteLinkDesktop').value;
    navigator.clipboard.writeText(link);
    showToast('邀请链接已复制');
  });

  document.getElementById('leaveRoomBtnDesktop')?.addEventListener('click', () => handleLeaveRoom());
  document.getElementById('readyBtnDesktop')?.addEventListener('click', () => handleReady());

  const showRoomInfoBtnDesktop = document.getElementById('showRoomInfoBtnDesktop');
  if (showRoomInfoBtnDesktop) {
    showRoomInfoBtnDesktop.addEventListener('click', (e) => {
      e.stopPropagation();
      const popup = document.getElementById('roomDetailPopupDesktop');
      if (popup) {
        const isVisible = popup.style.display === 'block';
        popup.style.display = isVisible ? 'none' : 'block';
      }
    });
  }

  // 点击其他地方关闭房间详情弹出层
  document.addEventListener('click', (e) => {
    const popup = document.getElementById('roomDetailPopup');
    const roomInfoSection = document.getElementById('roomInfoSection');
    if (popup && popup.style.display === 'block') {
      if (!roomInfoSection.contains(e.target)) {
        popup.style.display = 'none';
      }
    }

    const popupDesktop = document.getElementById('roomDetailPopupDesktop');
    const roomInfoSectionDesktop = document.getElementById('roomInfoSectionDesktop');
    if (popupDesktop && popupDesktop.style.display === 'block') {
      if (!roomInfoSectionDesktop.contains(e.target)) {
        popupDesktop.style.display = 'none';
      }
    }
  });

  // 初始化 Socket 监听
  initSocketListeners();
}

// ========== 面板切换逻辑 ==========

// 显示难度选择面板
function showDifficultyPanel() {
  hideAllPanels();

  const aiSelect = document.getElementById('aiSelect');
  if (aiSelect) {
    aiSelect.style.display = 'flex';
  }

  updateNavState('ai');
  drawBoard();
}

// 开始指定难度的人机游戏
function startAIGameWithDifficulty(difficulty) {
  UIState.aiDifficulty = difficulty;
  window.history.pushState({}, '', '/ai');
  initAIGame(difficulty);

  const difficultyText = difficulty === 'easy' ? '简单' : difficulty === 'medium' ? '中等' : '困难';
  showToast(`已开始${difficultyText}难度的人机对战`);
}

// 显示玩家对战选择
function showMultiplayerSelect() {
  // 如果是人机对战模式，先保存当前状态
  if (game.gameMode === 'ai' && game.isPlaying) {
    game.saveGame();
  }

  const savedRoom = getValidSavedRoom();
  console.log('[DEBUG] showMultiplayerSelect - savedRoom:', savedRoom);

  if (savedRoom) {
    console.log('[DEBUG] Found saved room, attempting reconnect...', savedRoom);

    document.getElementById('multiplayerSelectPanel').style.display = 'none';
    UIState.pendingReconnect = savedRoom;
    showToast('正在恢复房间连接...', 2000);
    socketManager.reconnectRoom(savedRoom.roomId, savedRoom.playerColor);
    return;
  }

  clearGameForNewMode();
  game.gameMode = 'multiplayer';
  game.board = Array(15).fill(null).map(() => Array(15).fill(0));
  game.currentPlayer = 1;
  game.isPlaying = false;
  game.moveHistory = [];
  game.winner = null;
  game.lastMove = null;

  hideAllPanels();
  setRoomInfoSectionDisplay('none');

  const multiplayerSelectPanel = document.getElementById('multiplayerSelectPanel');
  if (multiplayerSelectPanel) {
    multiplayerSelectPanel.style.display = 'block';
  }

  updateModeUI('multiplayer');
  window.history.pushState({}, '', '/room');
  drawBoard();
  updateUI();
}

// ========== 房间操作 ==========

function createRoom() {
  game.gameMode = 'create';
  game.isPlaying = false;
  resetMultiplayerReadyState();
  setBoardOverlayVisible(false);

  socketManager.createRoom();

  document.getElementById('multiplayerSelectPanel').style.display = 'none';
  document.body.setAttribute('data-game-status', 'waiting');
  setInviteSectionDisplay('none');

  const opponentCard = document.getElementById('opponentCard');
  const playerCard = document.getElementById('playerCard');
  if (opponentCard) {
    opponentCard.style.display = 'flex';
    const label = opponentCard.querySelector('.player-label');
    if (label) label.textContent = '等待加入...';
  }
  if (playerCard) {
    const label = playerCard.querySelector('.player-label');
    if (label) label.textContent = '你 (黑方)';
  }

  updateModeUI('room');
  updateUI();
}

function joinRoomFromPanel() {
  const roomId = document.getElementById('roomIdInputPanel').value.trim().toUpperCase();
  if (roomId.length !== 6) {
    showToast('请输入 6 位房间号');
    return;
  }
  resetMultiplayerReadyState();
  setBoardOverlayVisible(false);
  socketManager.joinRoom(roomId);
}

function handleLeaveRoom() {
  if (game.gameMode !== 'ai') {
    socketManager.leaveRoom();
  }

  clearRoomInfo();
  resetBoardToWaiting();
  window.history.pushState({}, '', '/room');
  showMultiplayerSelect();
  showToast('已离开房间');
}

function handleReady() {
  socketManager.playerReady();
}

// ========== 游戏操作 ==========

function handleBoardClick(e) {
  if (!game.isPlaying) return;
  if (game.winner !== null) return;
  if (game.currentPlayer !== game.myColor) return;

  const rect = UIState.canvas.getBoundingClientRect();
  const scaleX = (UIState.canvas.width / window.devicePixelRatio) / rect.width;
  const scaleY = (UIState.canvas.height / window.devicePixelRatio) / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  const cellX = Math.round((x - UIState.padding) / UIState.cellSize);
  const cellY = Math.round((y - UIState.padding) / UIState.cellSize);

  if (cellX < 0 || cellX >= 15 || cellY < 0 || cellY >= 15) return;
  if (!game.canMove(cellX, cellY)) return;

  if (game.gameMode !== 'ai') {
    socketManager.makeMove(cellX, cellY);
    return;
  }

  // 人机模式：玩家落子
  game.makeMove(cellX, cellY, game.myColor);
  drawBoard();
  updateUI();

  if (game.checkWin(cellX, cellY, game.myColor)) {
    showGameOver(game.myColor);
    game.clearSavedGame();
    return;
  }

  game.switchPlayer();
  updateUI();

  setTimeout(() => makeAIMove(), 300);
}

function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = UIState.canvas.getBoundingClientRect();
  const scaleX = (UIState.canvas.width / window.devicePixelRatio) / rect.width;
  const scaleY = (UIState.canvas.height / window.devicePixelRatio) / rect.height;
  const x = (touch.clientX - rect.left) * scaleX;
  const y = (touch.clientY - rect.top) * scaleY;

  const cellX = Math.round((x - UIState.padding) / UIState.cellSize);
  const cellY = Math.round((y - UIState.padding) / UIState.cellSize);

  if (cellX >= 0 && cellX < 15 && cellY >= 0 && cellY < 15) {
    const mouseEvent = new MouseEvent('click', {
      clientX: touch.clientX,
      clientY: touch.clientY,
      bubbles: true
    });
    UIState.canvas.dispatchEvent(mouseEvent);
  }
}

// AI 落子（支持难度配置）
function makeAIMove() {
  const emptyPoints = [];
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      if (game.board[y][x] === 0) {
        emptyPoints.push({ x, y });
      }
    }
  }

  if (emptyPoints.length === 0) return;

  let bestPoint;
  const difficulty = UIState.aiDifficulty || 'medium';

  if (difficulty === 'easy') {
    // 简单难度：随机选择
    bestPoint = emptyPoints[Math.floor(Math.random() * emptyPoints.length)];
  } else if (difficulty === 'medium') {
    // 中等难度：使用评分算法，但有一定概率犯错
    if (Math.random() < 0.2) {
      // 20% 概率随机落子
      bestPoint = emptyPoints[Math.floor(Math.random() * emptyPoints.length)];
    } else {
      bestPoint = evaluateBestPoint(emptyPoints);
    }
  } else {
    // 困难难度：使用完整评分算法
    bestPoint = evaluateBestPoint(emptyPoints);
  }

  // AI 落子
  game.makeMove(bestPoint.x, bestPoint.y, 2);
  drawBoard();
  updateUI();

  if (game.checkWin(bestPoint.x, bestPoint.y, 2)) {
    showGameOver(2);
    game.clearSavedGame();
    return;
  }

  game.switchPlayer();
  game.saveGame();
  updateUI();
}

// 评估最佳落子点
function evaluateBestPoint(emptyPoints) {
  let bestPoint = emptyPoints[0];
  let bestScore = -Infinity;

  for (const point of emptyPoints) {
    const score = evaluatePoint(point.x, point.y, 2) +
      evaluatePoint(point.x, point.y, 1) * 0.9;
    if (score > bestScore) {
      bestScore = score;
      bestPoint = point;
    }
  }

  return bestPoint;
}

// 评估落子点分数
function evaluatePoint(x, y, player) {
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

function handleUndo() {
  if (game.gameMode === 'ai') {
    if (game.moveHistory.length > 0) {
      game.undoMove();
      game.undoMove();
      game.saveGame();
      drawBoard();
      updateUI();
    }
    return;
  }

  if (!game.roomId) {
    showToast('未在房间中');
    return;
  }
  socketManager.requestUndo();
}

function handleRestart() {
  if (game.gameMode === 'ai') {
    game.reset();
    game.clearSavedGame();
    setRoomInfoSectionDisplay('none');
    updateModeUI('ai');
    drawBoard();
    updateUI();
    return;
  }

  if (!game.roomId) {
    showToast('未在房间中');
    return;
  }
  socketManager.requestRestart();
}

// ========== 模式切换处理 ==========

function handleModeChange(mode) {
  if (mode === 'ai') {
    window.history.pushState({}, '', '/ai');
    showDifficultyPanel();
  } else if (mode === 'multiplayer') {
    window.history.pushState({}, '', '/room');
    showMultiplayerSelect();
  }
}

function updateNavState(mode) {
  // 更新桌面端导航按钮状态
  Elements.navBtns.forEach(btn => {
    const btnMode = btn.dataset.mode;
    btn.classList.toggle('active',
      (mode === 'ai' && btnMode === 'ai') ||
      (mode === 'multiplayer' && btnMode === 'multiplayer') ||
      (mode === 'home' && !btnMode)
    );
  });

  // 更新移动端导航按钮状态
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    const btnMode = btn.dataset.mode;
    btn.classList.toggle('active',
      (mode === 'ai' && btnMode === 'ai') ||
      (mode === 'multiplayer' && btnMode === 'multiplayer') ||
      (mode === 'home' && !btnMode)
    );
  });
}

function updateModeUI(mode) {
  updateNavState(mode);

  if (mode === 'ai') {
    Elements.roomPanel.style.display = 'none';
    setRoomInfoSectionDisplay('none');
    document.getElementById('multiplayerSelectPanel').style.display = 'none';
    document.getElementById('homeSelect').style.display = 'none';
    document.getElementById('aiSelect').style.display = 'none';

    const opponentCard = document.getElementById('opponentCard');
    if (opponentCard) {
      opponentCard.style.display = 'flex';
      const label = opponentCard.querySelector('.player-label');
      if (label) {
        const difficultyText = UIState.aiDifficulty === 'easy' ? '简单' : UIState.aiDifficulty === 'medium' ? '中等' : '困难';
        label.textContent = `AI (${difficultyText})`;
      }
    }

    updateGameStatus('playing');
    updateGameMode('ai');
  } else if (mode === 'multiplayer') {
    Elements.roomPanel.style.display = 'none';
    setRoomInfoSectionDisplay('none');
    document.getElementById('multiplayerSelectPanel').style.display = 'block';
    document.getElementById('homeSelect').style.display = 'none';
    document.getElementById('aiSelect').style.display = 'none';

    const opponentCard = document.getElementById('opponentCard');
    if (opponentCard) {
      opponentCard.style.display = 'flex';
      const label = opponentCard.querySelector('.player-label');
      if (label) label.textContent = '白方';
    }

    updateGameStatus(null);
    updateGameMode('multiplayer');
  } else if (mode === 'create' || mode === 'join' || mode === 'room') {
    Elements.roomPanel.style.display = 'none';
    document.getElementById('multiplayerSelectPanel').style.display = 'none';
    document.getElementById('homeSelect').style.display = 'none';
    document.getElementById('aiSelect').style.display = 'none';
    setRoomInfoSectionDisplay('block');

    const opponentCard = document.getElementById('opponentCard');
    if (opponentCard) opponentCard.style.display = 'flex';

    updateGameMode('room');
  } else if (mode === 'home') {
    Elements.roomPanel.style.display = 'none';
    setRoomInfoSectionDisplay('none');
    document.getElementById('multiplayerSelectPanel').style.display = 'none';
    document.getElementById('aiSelect').style.display = 'none';
    document.getElementById('homeSelect').style.display = 'flex';

    updateGameStatus(null);
    updateGameMode(null);
  }
}

function updateGameStatus(status) {
  if (status === 'playing') {
    document.body.dataset.gameStatus = 'playing';
  } else if (status === 'waiting') {
    document.body.dataset.gameStatus = 'waiting';
  } else {
    delete document.body.dataset.gameStatus;
  }
}

function updateGameMode(mode) {
  if (mode) {
    document.body.dataset.gameMode = mode;
  } else {
    delete document.body.dataset.gameMode;
  }
}

// ========== Socket 监听 ==========

function initSocketListeners() {
  socketManager.on('roomCreated', (data) => {
    if (data.success) {
      resetMultiplayerReadyState();

      updateRoomIdDisplay(data.roomId);
      setInviteSectionDisplay('block');
      setReadySectionDisplay('none');
      const inviteUrl = `${window.location.origin}/room/${data.roomId}`;
      setInviteLinkValue(inviteUrl);

      const opponentCard = document.getElementById('opponentCard');
      if (opponentCard) {
        opponentCard.style.display = 'flex';
        const label = opponentCard.querySelector('.player-label');
        if (label) label.textContent = '等待加入...';
      }

      game.setRoomInfo(data.roomId, true);
      saveRoomInfo(data.roomId, 1);
      console.log('[DEBUG] roomCreated - 已保存房间信息:', localStorage.getItem('gobang-room'));
      window.history.pushState({}, '', `/room/${data.roomId}`);

      updateBoardOverlay();
      showToast('房间已创建！请分享邀请链接给对手');
      updateModeUI('room');
    } else {
      showToast(data.error || '创建房间失败');
    }
  });

  socketManager.on('roomJoined', (data) => {
    if (data.success) {
      game.setRoomInfo(data.roomId, false);
      game.gameMode = 'join';
      game.myColor = data.playerColor || 2;
      updateRoomIdDisplay(data.roomId);
      Elements.roomPanel.style.display = 'none';

      const opponentCard = document.getElementById('opponentCard');
      const playerCard = document.getElementById('playerCard');
      if (opponentCard) {
        opponentCard.style.display = 'flex';
        const label = opponentCard.querySelector('.player-label');
        if (label) label.textContent = '对手 (黑方)';
      }
      if (playerCard) {
        const label = playerCard.querySelector('.player-label');
        if (label) label.textContent = '你 (白方)';
      }

      setRoomInfoSectionDisplay('block');

      game.board = data.board || Array(15).fill(null).map(() => Array(15).fill(0));
      game.moveHistory = data.moveHistory || [];
      game.currentPlayer = data.currentPlayer || 1;
      game.isPlaying = data.isPlaying;

      UIState.mpOpponentPresent = true;

      updateModeUI('room');
      drawBoard();

      if (!game.isPlaying) {
        updateBoardOverlay();
      } else {
        setBoardOverlayVisible(false);
      }

      window.history.pushState({}, '', `/room/${data.roomId}`);
      saveRoomInfo(data.roomId, 2);

      showToast('加入房间成功！');
    } else {
      showToast(data.error || '加入房间失败');
      window.history.pushState({}, '', '/room');
      showMultiplayerSelect();
    }
  });

  socketManager.on('roomReconnected', (data) => {
    console.log('[DEBUG] roomReconnected 收到:', data);
    if (data.success) {
      UIState.pendingReconnect = null;

      game.setRoomInfo(data.roomId, data.isHost);
      game.myColor = data.playerColor;
      game.gameMode = data.isHost ? 'create' : 'join';

      if (data.board) game.board = data.board;
      if (data.moveHistory) game.moveHistory = data.moveHistory;
      if (data.currentPlayer) game.currentPlayer = data.currentPlayer;
      game.winner = null;
      game.lastMove = game.moveHistory.length > 0 ? game.moveHistory[game.moveHistory.length - 1] : null;

      document.body.dataset.gameMode = 'room';
      document.body.dataset.gameStatus = data.status === 'playing' ? 'playing' : 'waiting';

      Elements.roomPanel.style.display = 'none';
      document.getElementById('multiplayerSelectPanel').style.display = 'none';
      setRoomInfoSectionDisplay('block');

      const opponentCard = document.getElementById('opponentCard');
      if (opponentCard) opponentCard.style.display = 'flex';

      updateRoomIdDisplay(data.roomId);

      Elements.navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === 'multiplayer');
      });
      document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === 'multiplayer');
      });

      if (data.status === 'playing') {
        game.isPlaying = true;
        setBoardOverlayVisible(false);
        setInviteSectionDisplay('none');
        setReadySectionDisplay('none');

        if (opponentCard) {
          const label = opponentCard.querySelector('.player-label');
          if (label) label.textContent = data.isHost ? '对手 (白方)' : '对手 (黑方)';
        }
      } else {
        resetMultiplayerReadyState();
        game.isPlaying = false;

        if (data.isHost) {
          if (opponentCard) {
            const label = opponentCard.querySelector('.player-label');
            if (label) label.textContent = '等待加入...';
          }
          setInviteSectionDisplay('block');
          setReadySectionDisplay('none');
          const inviteUrl = `${window.location.origin}/room/${data.roomId}`;
          setInviteLinkValue(inviteUrl);
        } else {
          setInviteSectionDisplay('none');
          setReadySectionDisplay('block');
          setReadyButtonState(false, '准备开始');
          setMyReadyStatus('未准备', 'var(--text-muted)');
          if (opponentCard) {
            const label = opponentCard.querySelector('.player-label');
            if (label) label.textContent = '对手 (黑方)';
          }
        }
      }

      UIState.initMode = {
        type: data.isHost ? 'create' : 'join',
        roomId: data.roomId
      };

      window.history.pushState({}, '', `/room/${data.roomId}`);

      drawBoard();
      updateUI();
      updateBoardOverlay();
      showToast('重连成功！');
    } else {
      console.log('[DEBUG] Reconnect failed:', data.error);
      localStorage.removeItem('gobang-room');
      UIState.pendingReconnect = null;

      setBoardOverlayVisible(false);
      setRoomInfoSectionDisplay('none');

      const currentPath = window.location.pathname;
      const roomMatch = currentPath.match(/^\/room\/([A-Z0-9]{6})\/?$/i);

      if (roomMatch) {
        showToast('房间已失效，请重新创建或加入');
        window.history.pushState({}, '', '/room');
        showMultiplayerSelect();
      } else {
        showToast('房间已失效，请重新创建或加入');
        showMultiplayerSelect();
      }
    }
  });

  socketManager.on('playerJoined', (data) => {
    Elements.roomPanel.style.display = 'none';

    const opponentCard = document.getElementById('opponentCard');
    if (opponentCard) {
      opponentCard.style.display = 'flex';
      const label = opponentCard.querySelector('.player-label');
      if (label) label.textContent = '对手 (白方)';
    }

    game.myColor = 1;
    game.gameMode = 'create';

    if (data.isRejoining && game.isPlaying) {
      setInviteSectionDisplay('none');
      setReadySectionDisplay('none');
      drawBoard();
      updateUI();
      showToast('对手重新加入，继续对局！');
    } else {
      game.isPlaying = false;
      game.winner = null;
      game.lastMove = game.moveHistory.length > 0 ? game.moveHistory[game.moveHistory.length - 1] : null;

      UIState.mpOpponentPresent = true;
      UIState.mpMyReady = false;
      UIState.mpOpponentReady = false;

      setInviteSectionDisplay('none');
      setReadySectionDisplay('none');

      drawBoard();
      updateUI();
      updateBoardOverlay();
      showToast('对手已加入，请准备开始游戏');
    }
  });

  socketManager.on('gameStart', (data) => {
    game.isPlaying = true;
    game.board = data.board || Array(15).fill(null).map(() => Array(15).fill(0));
    game.currentPlayer = data.currentPlayer || 1;

    const opponentCard = document.getElementById('opponentCard');
    if (opponentCard) opponentCard.style.display = 'flex';

    setReadySectionDisplay('none');
    updateGameStatus('playing');
    setBoardOverlayVisible(false);
    drawBoard();
    updateUI();
    showToast('游戏开始！');
  });

  socketManager.on('moveMade', (data) => {
    game.makeMove(data.x, data.y, data.player);
    game.currentPlayer = data.currentPlayer;
    game.lastMove = { x: data.x, y: data.y };
    drawBoard();
    updateUI();

    if (game.checkWin(data.x, data.y, data.player)) {
      showGameOver(data.player);
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
    drawBoard();
    updateUI();
    showToast('悔棋成功');
  });

  socketManager.on('undoResponse', (data) => {
    if (!data.accepted) {
      showToast('对方拒绝了悔棋请求');
    }
  });

  socketManager.on('undoRequestResult', (data) => {
    if (data.success && data.pending) {
      showToast('已发送悔棋请求，等待对手确认');
    } else if (!data.success) {
      showToast(data.error || '悔棋请求失败');
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
    updateGameStatus('playing');
    drawBoard();
    updateUI();
    hideModal(Elements.resultModal);
    showToast('游戏重新开始');
  });

  socketManager.on('restartRequestResult', (data) => {
    if (data.success && data.pending) {
      showToast('已发送重新开始请求，等待对手确认');
    } else if (!data.success) {
      showToast(data.error || '重新开始请求失败');
    }
  });

  socketManager.on('gameOver', (data) => {
    showGameOver(data.winner);
  });

  socketManager.on('playerLeft', (data) => {
    if (data.preserveGame) {
      game.board = data.board || game.board;
      game.moveHistory = data.moveHistory || game.moveHistory || [];
      game.currentPlayer = data.currentPlayer || game.currentPlayer || 1;
      game.isPlaying = data.isPlaying === true;
      game.winner = null;
      game.lastMove = game.moveHistory.length > 0 ? game.moveHistory[game.moveHistory.length - 1] : null;

      UIState.mpOpponentPresent = false;
      UIState.mpMyReady = false;
      UIState.mpOpponentReady = false;
      setBoardOverlayVisible(false);

      drawBoard();

      const opponentCard = document.getElementById('opponentCard');
      if (opponentCard) opponentCard.style.display = 'none';

      updateUI();
      showToast(data.reason || '对手离开，对局已保留');
      return;
    }

    if (game.isPlaying && game.gameMode !== 'ai') {
      const savedRoom = getValidSavedRoom();
      if (savedRoom) {
        console.log('[DEBUG] 收到 playerLeft，但还在游戏中，尝试重连');
        socketManager.reconnectRoom(savedRoom.roomId, savedRoom.playerColor);
        return;
      }
    }

    showToast(data.reason || '对手离开');
    game.board = Array(15).fill(null).map(() => Array(15).fill(0));
    game.moveHistory = [];
    game.lastMove = null;
    game.winner = null;
    game.isPlaying = false;
    drawBoard();
    clearRoomInfo();

    window.history.pushState({}, '', '/room');
    setTimeout(() => {
      showMultiplayerSelect();
    }, 2000);
  });

  socketManager.on('opponentDisconnected', (data) => {
    UIState.mpOpponentPresent = false;
    updateBoardOverlay();
    showToast(data.reason || '对手断开连接');
  });

  socketManager.on('opponentReconnected', () => {
    UIState.mpOpponentPresent = true;
    updateBoardOverlay();
    showToast('对手已重连');
  });

  socketManager.on('becameHost', (data) => {
    game.isHost = true;
    game.myColor = 1;
    game.gameMode = 'create';
    saveRoomInfo(data.roomId, 1);

    if (data.preserveGame) {
      game.board = data.board || game.board;
      game.moveHistory = data.moveHistory || game.moveHistory || [];
      game.currentPlayer = data.currentPlayer || game.currentPlayer || 1;
      game.isPlaying = data.isPlaying === true;
      game.winner = null;
      game.lastMove = game.moveHistory.length > 0 ? game.moveHistory[game.moveHistory.length - 1] : null;

      UIState.mpOpponentPresent = false;
      UIState.mpMyReady = false;
      UIState.mpOpponentReady = false;
      setBoardOverlayVisible(false);

      drawBoard();

      Elements.roomPanel.style.display = 'none';
      setRoomInfoSectionDisplay('block');
      updateRoomIdDisplay(data.roomId);
      setInviteSectionDisplay('block');
      setReadySectionDisplay('none');
      const inviteUrl = `${window.location.origin}/room/${data.roomId}`;
      setInviteLinkValue(inviteUrl);

      const opponentCard = document.getElementById('opponentCard');
      if (opponentCard) {
        opponentCard.style.display = 'flex';
        const label = opponentCard.querySelector('.player-label');
        if (label) label.textContent = '等待加入...';
      }

      updateUI();
      showToast(data.reason || '你已成为新房主，对局已保留');
    } else {
      game.gameMode = 'create';
      game.myColor = 1;
      game.board = Array(15).fill(null).map(() => Array(15).fill(0));
      game.moveHistory = [];
      game.currentPlayer = 1;
      game.lastMove = null;
      game.winner = null;
      game.isPlaying = false;

      UIState.mpOpponentPresent = false;
      UIState.mpMyReady = false;
      UIState.mpOpponentReady = false;
      setBoardOverlayVisible(false);

      drawBoard();

      setMyReadyStatus('未准备', 'var(--text-muted)');
      setOpponentReadyStatus('未准备', 'var(--text-muted)');
      setReadyButtonState(false, '准备开始');

      Elements.roomPanel.style.display = 'none';
      setRoomInfoSectionDisplay('block');
      updateRoomIdDisplay(data.roomId);
      setInviteSectionDisplay('block');
      setReadySectionDisplay('none');
      const inviteUrl = `${window.location.origin}/room/${data.roomId}`;
      setInviteLinkValue(inviteUrl);

      const opponentCard = document.getElementById('opponentCard');
      if (opponentCard) {
        opponentCard.style.display = 'flex';
        const label = opponentCard.querySelector('.player-label');
        if (label) label.textContent = '等待加入...';
      }

      updateUI();
      showToast(data.reason || '你已成为新房主');
    }
  });

  socketManager.on('socketError', (data) => {
    showToast(data.error || '发生错误');
  });

  socketManager.on('opponentReady', (data) => {
    UIState.mpOpponentReady = true;
    updateBoardOverlay();
    setOpponentReadyStatus('已准备', 'var(--success-color)');
    showToast('对手已准备');
  });

  socketManager.on('playerReadyResult', (data) => {
    if (data.success) {
      UIState.mpMyReady = true;
      updateBoardOverlay();
      setMyReadyStatus('已准备', 'var(--success-color)');
      setReadyButtonState(true, '等待对手准备...');
    } else {
      showToast(data.error || '准备失败');
    }
  });
}

// ========== 辅助函数 ==========

function setBoardOverlayVisible(visible) {
  if (!Elements.boardOverlay) return;
  Elements.boardOverlay.style.display = visible ? 'flex' : 'none';
}

function resetMultiplayerReadyState() {
  UIState.mpOpponentPresent = false;
  UIState.mpMyReady = false;
  UIState.mpOpponentReady = false;
}

function resetBoardToWaiting() {
  game.board = Array(15).fill(null).map(() => Array(15).fill(0));
  game.currentPlayer = 1;
  game.isPlaying = false;
  game.moveHistory = [];
  game.winner = null;
  game.lastMove = null;
}

function getValidSavedRoom() {
  const saved = localStorage.getItem('gobang-room');
  if (!saved) return null;

  try {
    const roomInfo = JSON.parse(saved);
    if (roomInfo && roomInfo.roomId && (roomInfo.playerColor === 1 || roomInfo.playerColor === 2)) {
      const timestamp = roomInfo.timestamp || 0;
      const now = Date.now();
      if (now - timestamp > 24 * 60 * 60 * 1000) {
        console.log('[DEBUG] Saved room is too old, ignoring.');
        localStorage.removeItem('gobang-room');
        return null;
      }
      return roomInfo;
    } else {
      console.warn('[DEBUG] Invalid saved room structure:', roomInfo);
      return null;
    }
  } catch (e) {
    console.error('Error parsing saved room:', e);
    return null;
  }
}

function updateRoomIdDisplay(roomId) {
  document.getElementById('displayRoomId').textContent = roomId;
  const preview = document.getElementById('roomCodePreview');
  if (preview) {
    preview.textContent = roomId;
  }
  const displayRoomIdDesktop = document.getElementById('displayRoomIdDesktop');
  if (displayRoomIdDesktop) {
    displayRoomIdDesktop.textContent = roomId;
  }
  const previewDesktop = document.getElementById('roomCodePreviewDesktop');
  if (previewDesktop) {
    previewDesktop.textContent = roomId;
  }
}

function setRoomInfoSectionDisplay(display) {
  const desktop = document.getElementById('roomInfoSectionDesktop');
  const mobile = Elements.roomInfoSection;

  if (display === 'none') {
    if (desktop) desktop.style.display = 'none';
    if (mobile) mobile.style.display = 'none';
  } else {
    if (desktop) desktop.style.display = '';
    if (mobile) mobile.style.display = '';
  }
}

function setInviteSectionDisplay(display) {
  document.getElementById('inviteSection').style.display = display;
  const desktop = document.getElementById('inviteSectionDesktop');
  if (desktop) {
    desktop.style.display = display;
  }
}

function setInviteLinkValue(url) {
  document.getElementById('inviteLink').value = url;
  const desktop = document.getElementById('inviteLinkDesktop');
  if (desktop) {
    desktop.value = url;
  }
}

function setReadySectionDisplay(display) {
  document.getElementById('readySection').style.display = display;
  const desktop = document.getElementById('readySectionDesktop');
  if (desktop) {
    desktop.style.display = display;
  }
}

function setMyReadyStatus(text, color) {
  const el = document.getElementById('myReadyStatus');
  if (el) {
    el.textContent = text;
    el.style.color = color;
  }
  const elDesktop = document.getElementById('myReadyStatusDesktop');
  if (elDesktop) {
    elDesktop.textContent = text;
    elDesktop.style.color = color;
  }
}

function setOpponentReadyStatus(text, color) {
  const el = document.getElementById('opponentReadyStatus');
  if (el) {
    el.textContent = text;
    el.style.color = color;
  }
  const elDesktop = document.getElementById('opponentReadyStatusDesktop');
  if (elDesktop) {
    elDesktop.textContent = text;
    elDesktop.style.color = color;
  }
}

function setReadyButtonState(disabled, text) {
  const btn = document.getElementById('readyBtn');
  if (btn) {
    btn.disabled = disabled;
    btn.textContent = text;
  }
  const btnDesktop = document.getElementById('readyBtnDesktop');
  if (btnDesktop) {
    btnDesktop.disabled = disabled;
    btnDesktop.textContent = text;
  }
}

function handleResize() {
  const { canvas, boardSize } = UIState;
  const dpr = window.devicePixelRatio || 1;

  let canvasSize;
  let padding;
  if (window.innerWidth <= 768) {
    const wrapperOuter = Math.min(window.innerWidth - 20, 604);
    const wrapperPadding = 10;
    canvasSize = Math.max(240, wrapperOuter - wrapperPadding * 2);
    padding = canvasSize <= 320 ? 8 : 10;
  } else {
    canvasSize = 604;
    padding = 22;
  }

  if (UIState.canvasSize === canvasSize && UIState.padding === padding && UIState.dpr === dpr) {
    return;
  }

  UIState.padding = padding;
  UIState.cellSize = (canvasSize - padding * 2) / (boardSize - 1);

  canvas.width = canvasSize * dpr;
  canvas.height = canvasSize * dpr;
  canvas.style.width = canvasSize + 'px';
  canvas.style.height = canvasSize + 'px';

  UIState.dpr = dpr;
  UIState.canvasSize = canvasSize;

  drawBoard();
}

function clearRoomInfo() {
  game.roomId = null;
  game.isHost = false;
  localStorage.removeItem('gobang-room');
  setRoomInfoSectionDisplay('none');
  resetMultiplayerReadyState();
  setBoardOverlayVisible(false);
}

function saveRoomInfo(roomId, playerColor) {
  localStorage.setItem('gobang-room', JSON.stringify({
    roomId,
    playerColor,
    isHost: playerColor === 1,
    timestamp: Date.now()
  }));
}

function updateUI() {
  updateGameStatus(game.isPlaying && game.winner === null ? 'playing' : null);

  if (Elements.currentTurnDisplay) {
    Elements.currentTurnDisplay.textContent = game.currentPlayer === 1 ? '黑方' : '白方';
  }

  if (Elements.gameModeDisplay) {
    if (game.gameMode === 'ai') {
      Elements.gameModeDisplay.textContent = '人机对战';
    } else if (game.gameMode === 'multiplayer') {
      Elements.gameModeDisplay.textContent = '玩家对战';
    } else if (game.gameMode === 'create') {
      Elements.gameModeDisplay.textContent = '玩家对战 (房主)';
    } else if (game.gameMode === 'join') {
      Elements.gameModeDisplay.textContent = '玩家对战 (访客)';
    }
  }

  const isMyTurn = game.isMyTurn();
  const yourTurnEl = document.getElementById('yourTurn');
  const opponentTurnEl = document.getElementById('opponentTurn');
  yourTurnEl?.classList.toggle('visible', isMyTurn && game.isPlaying);
  opponentTurnEl?.classList.toggle('visible', !isMyTurn && game.isPlaying);
  Elements.playerCard?.classList.toggle('active', isMyTurn && game.isPlaying);
  Elements.opponentCard?.classList.toggle('active', !isMyTurn && game.isPlaying);

  if (Elements.undoBtn) {
    Elements.undoBtn.disabled = !game.isPlaying || game.moveHistory.length === 0;
  }
  if (Elements.restartBtn) {
    Elements.restartBtn.disabled = !game.isPlaying;
  }

  const canInteract = game.isPlaying && game.winner === null && isMyTurn;
  if (UIState.canvas) {
    UIState.canvas.style.cursor = canInteract ? 'pointer' : 'default';
  }

  updateBoardOverlay();
}

function updateBoardOverlay() {
  if (!Elements.boardOverlay || game.gameMode === 'ai' || !game.roomId) {
    setBoardOverlayVisible(false);
    return;
  }

  if (game.isPlaying || game.winner !== null) {
    setBoardOverlayVisible(false);
    return;
  }

  if (!UIState.mpOpponentPresent) {
    if (Elements.overlayTitle) Elements.overlayTitle.textContent = '等待对手';
    if (Elements.overlayDesc) Elements.overlayDesc.textContent = '请分享邀请链接给对手';
    if (Elements.overlayStartBtn) {
      Elements.overlayStartBtn.style.display = 'none';
    }
    setBoardOverlayVisible(true);
    return;
  }

  if (Elements.overlayStartBtn) {
    Elements.overlayStartBtn.style.display = 'block';
  }

  if (Elements.overlayTitle) Elements.overlayTitle.textContent = '开始游戏';

  if (UIState.mpMyReady && !UIState.mpOpponentReady) {
    if (Elements.overlayDesc) Elements.overlayDesc.textContent = '你已准备，等待对手开始...';
    if (Elements.overlayStartBtn) {
      Elements.overlayStartBtn.textContent = '等待对手...';
      Elements.overlayStartBtn.disabled = true;
    }
  } else if (!UIState.mpMyReady && UIState.mpOpponentReady) {
    if (Elements.overlayDesc) Elements.overlayDesc.textContent = '对手已准备，轮到你开始';
    if (Elements.overlayStartBtn) {
      Elements.overlayStartBtn.textContent = '开始游戏';
      Elements.overlayStartBtn.disabled = false;
    }
  } else if (UIState.mpMyReady && UIState.mpOpponentReady) {
    if (Elements.overlayDesc) Elements.overlayDesc.textContent = '双方已准备，正在开始...';
    if (Elements.overlayStartBtn) {
      Elements.overlayStartBtn.textContent = '正在开始...';
      Elements.overlayStartBtn.disabled = true;
    }
  } else {
    if (Elements.overlayDesc) Elements.overlayDesc.textContent = '双方点击开始后进入对局';
    if (Elements.overlayStartBtn) {
      Elements.overlayStartBtn.textContent = '开始游戏';
      Elements.overlayStartBtn.disabled = false;
    }
  }

  setBoardOverlayVisible(true);
}

function showGameOver(winner) {
  game.winner = winner;
  game.isPlaying = false;

  updateGameStatus(null);
  recordGame(winner);

  let message = '';
  if (winner === 0) {
    message = '平局！';
  } else if (winner === game.myColor) {
    message = '恭喜，你赢了！';
  } else {
    message = game.gameMode === 'ai' ? 'AI 获胜' : '你输了';
  }

  if (Elements.resultMessage) {
    Elements.resultMessage.textContent = message;
  }
  showModal(Elements.resultModal);
}

function showModal(modal) {
  if (modal) {
    modal.style.display = 'flex';
  }
}

function hideModal(modal) {
  if (modal) {
    modal.style.display = 'none';
  }
}

function showToast(message, duration = 3000) {
  if (Elements.toastMessage) {
    Elements.toastMessage.textContent = message;
  }
  if (Elements.toast) {
    Elements.toast.style.display = 'block';
    setTimeout(() => {
      Elements.toast.style.display = 'none';
    }, duration);
  }
}

// ========== 主题和统计 ==========

function toggleTheme() {
  const currentTheme = document.body.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.body.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

function loadTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.body.setAttribute('data-theme', savedTheme);
}

function loadStats() {
  const saved = localStorage.getItem('gobang-stats');
  if (saved) {
    UIState.stats = JSON.parse(saved);
  }
}

function saveStats() {
  localStorage.setItem('gobang-stats', JSON.stringify(UIState.stats));
}

function updateStats() {
  document.getElementById('totalGames').textContent = UIState.stats.totalGames;
  document.getElementById('winGames').textContent = UIState.stats.winGames;
  document.getElementById('totalMoves').textContent = UIState.stats.totalMoves;

  const winRate = UIState.stats.totalGames > 0
    ? Math.round((UIState.stats.winGames / UIState.stats.totalGames) * 100)
    : 0;
  document.getElementById('winRate').textContent = winRate + '%';
}

function recordGame(winner) {
  UIState.stats.totalGames++;
  UIState.stats.totalMoves += game.moveHistory.length;

  if (winner === game.myColor) {
    UIState.stats.winGames++;
  }

  saveStats();
  updateStats();
}

function resetStats() {
  UIState.stats = {
    totalGames: 0,
    winGames: 0,
    totalMoves: 0
  };
  saveStats();
  updateStats();
  showToast('统计已重置');
}

// ========== 初始化入口 ==========

document.addEventListener('DOMContentLoaded', async () => {
  socketManager.connect();
  init();

  await socketManager.waitForConnection();

  if (UIState.pendingReconnect) {
    socketManager.reconnectRoom(UIState.pendingReconnect.roomId, UIState.pendingReconnect.playerColor);
    UIState.pendingReconnect = null;
  } else if (UIState.pendingRoomId) {
    socketManager.joinRoom(UIState.pendingRoomId);
    UIState.pendingRoomId = null;
  }
});
