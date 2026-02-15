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

    // Multiplayer stage state (pre-start overlay)
    this.mpOpponentPresent = false;
    this.mpMyReady = false;
    this.mpOpponentReady = false;

    this.initElements();
    this.initEventListeners();
    this.loadTheme();

    // 解析当前路径，决定初始化模式
    this.initMode = this.detectModeFromURL();
    console.log('[DEBUG] initMode:', this.initMode);

    // 根据模式初始化
    if (this.initMode.type === 'redirect-ai') {
      // 根路径重定向到 /ai
      window.history.replaceState({}, '', '/ai');
      this.initMode = { type: 'ai' };
    }

    if (this.initMode.type === 'ai') {
      // 人机模式：完全独立，不检查房间信息
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
    } else if (this.initMode.type === 'multiplayer') {
      // 玩家对战选择页面：检查是否有保存的房间
      const savedRoom = this.getValidSavedRoom();
      console.log('[DEBUG] multiplayer mode, savedRoom:', savedRoom);
      if (savedRoom) {
        // 有保存的房间，设置待重连
        game.init(savedRoom.isHost ? 'create' : 'join');
        game.myColor = savedRoom.playerColor;
        game.roomId = savedRoom.roomId;
        // 更新 URL 为房间页
        window.history.replaceState({}, '', `/room/${savedRoom.roomId}`);
        this.updateModeUI('room');
        this.setRoomInfoSectionDisplay('block');
        this.updateRoomIdDisplay(savedRoom.roomId);
        this.setInviteSectionDisplay('block');
        const inviteUrl = `${window.location.origin}/room/${savedRoom.roomId}`;
        this.setInviteLinkValue(inviteUrl);
        // 设置待重连
        this.pendingReconnect = {
          roomId: savedRoom.roomId,
          playerColor: savedRoom.playerColor
        };
        this.drawBoard();
      } else {
        // 没有保存的房间，显示玩家对战选择页面
        console.log('[DEBUG] No saved room, showing multiplayer select');
        // 直接设置游戏状态，不调用 game.init('ai')
        game.gameMode = 'multiplayer';
        game.board = Array(15).fill(null).map(() => Array(15).fill(0));
        game.currentPlayer = 1;
        game.isPlaying = false;
        game.moveHistory = [];
        game.winner = null;
        game.lastMove = null;
        this.roomPanel.style.display = 'none';
        this.setRoomInfoSectionDisplay('none');
        document.getElementById('multiplayerSelect').style.display = 'block';
        this.updateModeUI('multiplayer');
        // 不需要再调用 drawBoard()，initCanvas 已经绘制过了
      }
    } else if (this.initMode.type === 'room') {
      // 具体房间：检查是否有保存的房间信息
      const savedRoom = this.getValidSavedRoom();
      if (savedRoom && savedRoom.roomId === this.initMode.roomId) {
        // 有保存的房间信息，设置待重连
        game.init(savedRoom.isHost ? 'create' : 'join');
        game.myColor = savedRoom.playerColor;
        game.roomId = savedRoom.roomId;
        // 显示房间信息
        this.setRoomInfoSectionDisplay('block');
        this.updateRoomIdDisplay(savedRoom.roomId);
        this.setInviteSectionDisplay('block');
        const inviteUrl = `${window.location.origin}/room/${savedRoom.roomId}`;
        this.setInviteLinkValue(inviteUrl);
        this.updateModeUI('room');
        // 设置待重连
        this.pendingReconnect = {
          roomId: savedRoom.roomId,
          playerColor: savedRoom.playerColor
        };
      } else {
        // 没有保存的房间信息，但是通过邀请链接进来的，设置待加入房间
        console.log('[DEBUG] 通过邀请链接进入，设置待加入房间:', this.initMode.roomId);
        this.pendingRoomId = this.initMode.roomId;
        // 显示玩家对战选择页面
        game.gameMode = 'multiplayer';
        game.board = Array(15).fill(null).map(() => Array(15).fill(0));
        game.currentPlayer = 1;
        game.isPlaying = false;
        game.moveHistory = [];
        game.winner = null;
        game.lastMove = null;
        this.roomPanel.style.display = 'none';
        this.setRoomInfoSectionDisplay('none');
        document.getElementById('multiplayerSelect').style.display = 'block';
        this.updateModeUI('multiplayer');
      }
      this.drawBoard();
    }

    this.updateUI();
    this.updateStats();
    document.body.classList.remove('pre-init');
  }

  setBoardOverlayVisible(visible) {
    if (!this.boardOverlay) return;
    this.boardOverlay.style.display = visible ? 'flex' : 'none';
  }

  resetMultiplayerReadyState() {
    this.mpOpponentPresent = false;
    this.mpMyReady = false;
    this.mpOpponentReady = false;
  }

  updateBoardOverlay() {
    // Only used for multiplayer rooms before game start.
    if (!this.boardOverlay || game.gameMode === 'ai' || !game.roomId) {
      this.setBoardOverlayVisible(false);
      return;
    }

    if (game.isPlaying || game.winner !== null) {
      this.setBoardOverlayVisible(false);
      return;
    }

    // 没有对手时，显示等待加入的提示
    if (!this.mpOpponentPresent) {
      if (this.overlayTitle) this.overlayTitle.textContent = '等待对手';
      if (this.overlayDesc) this.overlayDesc.textContent = '请分享邀请链接给对手';
      if (this.overlayStartBtn) {
        this.overlayStartBtn.style.display = 'none';
      }
      this.setBoardOverlayVisible(true);
      return;
    }

    // 有对手时，显示开始按钮
    if (this.overlayStartBtn) {
      this.overlayStartBtn.style.display = 'block';
    }

    if (this.overlayTitle) this.overlayTitle.textContent = '开始游戏';

    if (this.mpMyReady && !this.mpOpponentReady) {
      if (this.overlayDesc) this.overlayDesc.textContent = '你已准备，等待对手开始...';
      if (this.overlayStartBtn) {
        this.overlayStartBtn.textContent = '等待对手...';
        this.overlayStartBtn.disabled = true;
      }
    } else if (!this.mpMyReady && this.mpOpponentReady) {
      if (this.overlayDesc) this.overlayDesc.textContent = '对手已准备，轮到你开始';
      if (this.overlayStartBtn) {
        this.overlayStartBtn.textContent = '开始游戏';
        this.overlayStartBtn.disabled = false;
      }
    } else if (this.mpMyReady && this.mpOpponentReady) {
      if (this.overlayDesc) this.overlayDesc.textContent = '双方已准备，正在开始...';
      if (this.overlayStartBtn) {
        this.overlayStartBtn.textContent = '正在开始...';
        this.overlayStartBtn.disabled = true;
      }
    } else {
      if (this.overlayDesc) this.overlayDesc.textContent = '双方点击开始后进入对局';
      if (this.overlayStartBtn) {
        this.overlayStartBtn.textContent = '开始游戏';
        this.overlayStartBtn.disabled = false;
      }
    }

    this.setBoardOverlayVisible(true);
  }

  // Multiplayer "waiting" state should NOT be treated as "playing".
  resetBoardToWaiting() {
    game.board = Array(15).fill(null).map(() => Array(15).fill(0));
    game.currentPlayer = 1;
    game.isPlaying = false;
    game.moveHistory = [];
    game.winner = null;
    game.lastMove = null;
  }

  // 从 URL 检测当前模式
  detectModeFromURL() {
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

    // /ai - 人机对战
    if (path === '/ai' || path === '/ai/') {
      return { type: 'ai' };
    }

    // / 或其他 - 重定向到 /ai
    return { type: 'redirect-ai' };
  }

  // 获取有效的保存房间信息
  getValidSavedRoom() {
    const saved = localStorage.getItem('gobang-room');
    if (!saved) return null;

    try {
      const roomInfo = JSON.parse(saved);
      // Basic validation
      if (roomInfo && roomInfo.roomId && (roomInfo.playerColor === 1 || roomInfo.playerColor === 2)) {
        // Check if it's too old (e.g., > 24 hours) - optional, but good for cleanup
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
        // Don't auto-clear immediately in case of minor format issues, just return null
        return null;
      }
    } catch (e) {
      console.error('Error parsing saved room:', e);
      return null;
    }
  }

  // 更新模式相关的 UI
  updateModeUI(mode) {
    // 更新桌面端导航按钮状态
    this.navBtns.forEach(btn => {
      const btnMode = btn.dataset.mode;
      btn.classList.toggle('active',
        (mode === 'ai' && btnMode === 'ai') ||
        (mode === 'multiplayer' && btnMode === 'multiplayer') ||
        (mode === 'create' && btnMode === 'multiplayer') ||
        (mode === 'join' && btnMode === 'multiplayer') ||
        (mode === 'room' && btnMode === 'multiplayer')
      );
    });

    // 更新移动端导航按钮状态
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      const btnMode = btn.dataset.mode;
      btn.classList.toggle('active',
        (mode === 'ai' && btnMode === 'ai') ||
        (mode === 'multiplayer' && btnMode === 'multiplayer') ||
        (mode === 'create' && btnMode === 'multiplayer') ||
        (mode === 'join' && btnMode === 'multiplayer') ||
        (mode === 'room' && btnMode === 'multiplayer')
      );
    });

    if (mode === 'ai') {
      this.roomPanel.style.display = 'none';
      this.setRoomInfoSectionDisplay('none');
      document.getElementById('multiplayerSelect').style.display = 'none';
      // 不使用内联样式，让CSS根据data-game-status控制显示
      this.opponentCard.style.display = 'flex';
      this.opponentCard.querySelector('.player-label').textContent = 'AI (白方)';
      // 人机模式：立即设置为playing状态
      this.updateGameStatus('playing');
      this.updateGameMode('ai');
    } else if (mode === 'multiplayer') {
      this.roomPanel.style.display = 'none';
      this.setRoomInfoSectionDisplay('none');
      document.getElementById('multiplayerSelect').style.display = 'block';
      // 不使用内联样式，让CSS根据data-game-status控制显示
      // 显示白棋卡片，标签设为"白方"
      this.opponentCard.style.display = 'flex';
      this.opponentCard.querySelector('.player-label').textContent = '白方';
      // 多人对战选择页面，还未开始游戏
      // 更新游戏模式（用于控制UI显示）
      this.updateGameStatus(null);
      this.updateGameMode('multiplayer');
    } else if (mode === 'create' || mode === 'join' || mode === 'room') {
      // create/join/room 模式：隐藏人机操作和选择面板，显示房间信息
      this.roomPanel.style.display = 'none';
      document.getElementById('multiplayerSelect').style.display = 'none';
      // 不使用内联样式，让CSS根据data-game-status控制显示
      this.setRoomInfoSectionDisplay('block');
      this.opponentCard.style.display = 'flex';
      this.updateGameMode('room');
    }
  }

  // 更新游戏状态（用于控制UI显示）
  updateGameStatus(status) {
    if (status === 'playing') {
      document.body.dataset.gameStatus = 'playing';
      // Ensure specific mode is retained or inferred if needed, but primarily rely on gameMode
    } else if (status === 'waiting') {
      document.body.dataset.gameStatus = 'waiting';
    } else {
      delete document.body.dataset.gameStatus;
    }
  }

  // 更新游戏模式（用于控制UI显示）
  updateGameMode(mode) {
    if (mode) {
      document.body.dataset.gameMode = mode;
    } else {
      delete document.body.dataset.gameMode;
    }
  }

  // 初始�� Canvas 尺寸（只在构造函数中调用一次）
  initCanvas() {
    const { canvas, boardSize } = this;
    const dpr = window.devicePixelRatio || 1;

    let canvasSize;
    let padding;
    if (window.innerWidth <= 768) {
      // Match CSS: board-wrapper is (100vw - 20px) with 10px padding on both sides.
      const wrapperOuter = Math.min(window.innerWidth - 20, 604);
      const wrapperPadding = 10;
      canvasSize = Math.max(240, wrapperOuter - wrapperPadding * 2);
      padding = canvasSize <= 320 ? 8 : 10;
    } else {
      canvasSize = 604;
      padding = 22;
    }

    this.padding = padding;
    this.cellSize = (canvasSize - padding * 2) / (boardSize - 1);

    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    canvas.style.width = canvasSize + 'px';
    canvas.style.height = canvasSize + 'px';

    this.dpr = dpr;
    this.canvasSize = canvasSize;

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

    // Board overlay (multiplayer pre-start)
    this.boardOverlay = document.getElementById('boardOverlay');
    this.overlayTitle = document.getElementById('overlayTitle');
    this.overlayDesc = document.getElementById('overlayDesc');
    this.overlayStartBtn = document.getElementById('overlayStartBtn');
  }

  // 更���房间号显示（同时更新PC端和移动端）
  updateRoomIdDisplay(roomId) {
    // 移动端
    document.getElementById('displayRoomId').textContent = roomId;
    const preview = document.getElementById('roomCodePreview');
    if (preview) {
      preview.textContent = roomId;
    }
    // PC端
    const displayRoomIdDesktop = document.getElementById('displayRoomIdDesktop');
    if (displayRoomIdDesktop) {
      displayRoomIdDesktop.textContent = roomId;
    }
    const previewDesktop = document.getElementById('roomCodePreviewDesktop');
    if (previewDesktop) {
      previewDesktop.textContent = roomId;
    }
  }

  // 设置房间信息区域显示
  // CSS已通过 data-game-mode="room" 完全控制显示/隐藏
  // 此���数主要用于需要强制隐藏时（离开房间等场景）
  setRoomInfoSectionDisplay(display) {
    const desktop = document.getElementById('roomInfoSectionDesktop');
    const mobile = this.roomInfoSection;

    if (display === 'none') {
      // 强制隐藏：设置内联样式
      if (desktop) desktop.style.display = 'none';
      if (mobile) mobile.style.display = 'none';
    } else {
      // 显示：清除内联样式，让CSS规则生效
      if (desktop) desktop.style.display = '';
      if (mobile) mobile.style.display = '';
    }
  }

  // 设置邀请链接区域显示（同时控制PC端和移动端）
  setInviteSectionDisplay(display) {
    document.getElementById('inviteSection').style.display = display;
    const desktop = document.getElementById('inviteSectionDesktop');
    if (desktop) {
      desktop.style.display = display;
    }
  }

  // 设置邀请链接值（同时控制PC端和移动端）
  setInviteLinkValue(url) {
    document.getElementById('inviteLink').value = url;
    const desktop = document.getElementById('inviteLinkDesktop');
    if (desktop) {
      desktop.value = url;
    }
  }

  // 设置准备区域显示（同时控制PC端和移动端）
  setReadySectionDisplay(display) {
    document.getElementById('readySection').style.display = display;
    const desktop = document.getElementById('readySectionDesktop');
    if (desktop) {
      desktop.style.display = display;
    }
  }

  // 设置我的准备状态（同时控制PC端和移动端）
  setMyReadyStatus(text, color) {
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

  // 设置对手准备状态（同时控制PC端和移动端）
  setOpponentReadyStatus(text, color) {
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

  // 设置准备按钮状态（同时控制PC端和移动端）
  setReadyButtonState(disabled, text) {
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

  // 初始化事件监听
  initEventListeners() {
    // 主题切换
    this.themeToggle.addEventListener('click', () => this.toggleTheme());

    // 模式选择（桌面端导航）
    this.navBtns.forEach(btn => {
      btn.addEventListener('click', () => this.handleModeChange(btn.dataset.mode));
    });

    // 移动端导航按钮
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // 更新按钮状态
        document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // 处理模式切换
        this.handleModeChange(btn.dataset.mode);
      });
    });

    // 悔棋
    this.undoBtn.addEventListener('click', () => this.handleUndo());

    // 重新开始
    this.restartBtn.addEventListener('click', () => this.handleRestart());

    // 棋盘点击（支持鼠标和触摸）
    this.canvas.addEventListener('click', (e) => this.handleBoardClick(e));

    // 触摸事件处理 - 使用 touchstart 提高响应速度
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = (this.canvas.width / window.devicePixelRatio) / rect.width;
      const scaleY = (this.canvas.height / window.devicePixelRatio) / rect.height;
      const x = (touch.clientX - rect.left) * scaleX;
      const y = (touch.clientY - rect.top) * scaleY;

      const cellX = Math.round((x - this.padding) / this.cellSize);
      const cellY = Math.round((y - this.padding) / this.cellSize);

      if (cellX >= 0 && cellX < 15 && cellY >= 0 && cellY < 15) {
        // 创建模拟点击事件
        const mouseEvent = new MouseEvent('click', {
          clientX: touch.clientX,
          clientY: touch.clientY,
          bubbles: true
        });
        this.canvas.dispatchEvent(mouseEvent);
      }
    }, { passive: false });

    // 窗口大小改变时重新计算 Canvas 尺寸
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.handleResize();
      }, 250);
    });

    // 结果弹窗
    document.getElementById('restartGameBtn').addEventListener('click', () => {
      this.hideModal(this.resultModal);
      this.handleRestart();
    });
    document.getElementById('backHomeBtn').addEventListener('click', () => {
      this.hideModal(this.resultModal);
      if (game.gameMode === 'ai') {
        // Back to AI home: start a fresh game.
        window.history.pushState({}, '', '/');
        this.startAIGame();
      } else {
        // Multiplayer: leave the room and go back to the multiplayer page.
        this.handleLeaveRoom();
      }
    });

    // 重置统计
    this.resetStatsBtn.addEventListener('click', () => this.resetStats());

    // 离开房间
    this.leaveRoomBtn.addEventListener('click', () => this.handleLeaveRoom());

    // 创建房间按钮
    document.getElementById('createRoomBtn')?.addEventListener('click', () => this.createRoom());

    // 显示加入房间输入框
    document.getElementById('showJoinBtn')?.addEventListener('click', () => {
      document.getElementById('joinInputSection').style.display = 'block';
    });

    // 加入房间按钮
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

    // 切换邀请链接显示 (点击显示/隐藏邀请链接区域，同时复制)
    document.getElementById('toggleInviteLink')?.addEventListener('click', () => {
      const inviteSection = document.getElementById('inviteSection');
      const inviteUrl = `${window.location.origin}/room/${document.getElementById('displayRoomId').textContent}`;
      this.setInviteLinkValue(inviteUrl);

      // 切换邀请链接区域的显示状态
      if (inviteSection.style.display === 'none' || !inviteSection.style.display) {
        inviteSection.style.display = 'block';
      } else {
        inviteSection.style.display = 'none';
      }

      // 复制链接到剪贴板
      navigator.clipboard.writeText(inviteUrl);
      this.showToast('邀请链接已复制');
    });

    // 复制邀请链接
    document.getElementById('copyInviteLink')?.addEventListener('click', () => {
      const link = document.getElementById('inviteLink').value;
      navigator.clipboard.writeText(link);
      this.showToast('邀请链接已复制');
    });

    // 准备按钮
    document.getElementById('readyBtn')?.addEventListener('click', () => this.handleReady());

    // Board overlay start button
    this.overlayStartBtn?.addEventListener('click', () => this.handleReady());

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

    // ========== PC端房间信息事件监听 ==========
    // 复制房间号 (PC端)
    document.getElementById('copyRoomIdDesktop')?.addEventListener('click', () => {
      const roomId = document.getElementById('displayRoomIdDesktop').textContent;
      navigator.clipboard.writeText(roomId);
      this.showToast('房间号已复制');
    });

    // 切换邀请链接显示 (PC端)
    document.getElementById('toggleInviteLinkDesktop')?.addEventListener('click', () => {
      const inviteSectionDesktop = document.getElementById('inviteSectionDesktop');
      const inviteUrl = `${window.location.origin}/room/${document.getElementById('displayRoomIdDesktop').textContent}`;
      this.setInviteLinkValue(inviteUrl);

      // 切换邀请链接区域的显示状态
      if (inviteSectionDesktop.style.display === 'none' || !inviteSectionDesktop.style.display) {
        inviteSectionDesktop.style.display = 'block';
      } else {
        inviteSectionDesktop.style.display = 'none';
      }

      // 复制链接到剪贴板
      navigator.clipboard.writeText(inviteUrl);
      this.showToast('邀请链接已复制');
    });

    // 复制邀请链接 (PC端)
    document.getElementById('copyInviteLinkDesktop')?.addEventListener('click', () => {
      const link = document.getElementById('inviteLinkDesktop').value;
      navigator.clipboard.writeText(link);
      this.showToast('邀请链接已复制');
    });

    // 离开房间 (PC端)
    document.getElementById('leaveRoomBtnDesktop')?.addEventListener('click', () => this.handleLeaveRoom());

    // 准备按钮 (PC端)
    document.getElementById('readyBtnDesktop')?.addEventListener('click', () => this.handleReady());

    // 房间信息按钮（PC端弹出层）
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

    // 点击其他地方关闭房间详情弹出层（同时处理PC端和移动端）
    document.addEventListener('click', (e) => {
      // 移动端弹出层
      const popup = document.getElementById('roomDetailPopup');
      const roomInfoSection = document.getElementById('roomInfoSection');
      if (popup && popup.style.display === 'block') {
        if (!roomInfoSection.contains(e.target)) {
          popup.style.display = 'none';
        }
      }
      // PC端弹出层
      const popupDesktop = document.getElementById('roomDetailPopupDesktop');
      const roomInfoSectionDesktop = document.getElementById('roomInfoSectionDesktop');
      if (popupDesktop && popupDesktop.style.display === 'block') {
        if (!roomInfoSectionDesktop.contains(e.target)) {
          popupDesktop.style.display = 'none';
        }
      }
    });

    // 初始化Socket监听
    this.initSocketListeners();
  }

  // 初始化Socket监听
  initSocketListeners() {
    socketManager.on('roomCreated', (data) => {
      if (data.success) {
        this.resetMultiplayerReadyState();

        // 在左侧面板显示房间信息
        this.updateRoomIdDisplay(data.roomId);
        // 桌面端：显示邀请链接区域，方便用户复制
        this.setInviteSectionDisplay('block');
        this.setReadySectionDisplay('none');
        const inviteUrl = `${window.location.origin}/room/${data.roomId}`;
        this.setInviteLinkValue(inviteUrl);

        // 显示对手卡片占位
        this.opponentCard.style.display = 'flex';
        this.opponentCard.querySelector('.player-label').textContent = '等待加入...';

        game.setRoomInfo(data.roomId, true);
        this.saveRoomInfo(data.roomId, 1);
        console.log('[DEBUG] roomCreated - 已保存房间信息:', localStorage.getItem('gobang-room'));
        // 更新 URL 为房间页
        window.history.pushState({}, '', `/room/${data.roomId}`);

        // 显示等待对手的 overlay
        this.updateBoardOverlay();

        // 显示创建成功的提示
        this.showToast('房间已创建！请分享邀请链接给对手');

        // 确保UI模式正确
        this.updateModeUI('room');
      } else {
        this.showToast(data.error || '创建房间失败');
      }
    });

    socketManager.on('roomJoined', (data) => {
      if (data.success) {
        game.setRoomInfo(data.roomId, false);
        game.gameMode = 'join';
        game.myColor = data.playerColor || 2;
        this.updateRoomIdDisplay(data.roomId);
        this.roomPanel.style.display = 'none';
        this.opponentCard.style.display = 'flex';
        this.opponentCard.querySelector('.player-label').textContent = '对手 (黑方)';
        this.playerCard.querySelector('.player-label').textContent = '你 (白方)';
        this.setRoomInfoSectionDisplay('block');

        // Join always receives a snapshot (may include existing record).
        game.board = data.board || Array(15).fill(null).map(() => Array(15).fill(0));
        game.moveHistory = data.moveHistory || [];
        game.currentPlayer = data.currentPlayer || 1;
        game.isPlaying = data.isPlaying;

        // Sync ready state
        this.mpOpponentPresent = true;

        this.updateModeUI('room'); // Establish room UI explicitly
        this.drawBoard();

        // Use board overlay if waiting
        if (!game.isPlaying) {
          this.updateBoardOverlay();
        } else {
          this.setBoardOverlayVisible(false);
        }

        // 更新 URL 为房间页
        window.history.pushState({}, '', `/room/${data.roomId}`);
        this.saveRoomInfo(data.roomId, 2);

        this.showToast('加入房间成功！');
      } else {
        this.showToast(data.error || '加入房间失败');
        // 加入房间失败时，跳转到多人选择页面，而不是人机页面
        window.history.pushState({}, '', '/room');
        this.showMultiplayerSelect();
      }
    });

    socketManager.on('roomReconnected', (data) => {
      console.log('[DEBUG] roomReconnected 收到:', data);
      if (data.success) {
        this.pendingReconnect = null;

        // 步骤 1：更新游戏状态
        game.setRoomInfo(data.roomId, data.isHost);
        game.myColor = data.playerColor;
        game.gameMode = data.isHost ? 'create' : 'join';

        // 从服务器数据恢复棋盘状态
        if (data.board) game.board = data.board;
        if (data.moveHistory) game.moveHistory = data.moveHistory;
        if (data.currentPlayer) game.currentPlayer = data.currentPlayer;
        game.winner = null;
        game.lastMove = game.moveHistory.length > 0 ? game.moveHistory[game.moveHistory.length - 1] : null;

        // 步骤 2：设置 DOM 属性（CSS 依赖这些属性）
        document.body.dataset.gameMode = 'room';
        document.body.dataset.gameStatus = data.status === 'playing' ? 'playing' : 'waiting';

        // 步骤 3：操作 DOM 显示
        this.roomPanel.style.display = 'none';
        document.getElementById('multiplayerSelect').style.display = 'none';
        this.setRoomInfoSectionDisplay('block');
        this.opponentCard.style.display = 'flex';
        this.updateRoomIdDisplay(data.roomId);

        // 更新导航按钮状态
        this.navBtns.forEach(btn => {
          btn.classList.toggle('active', btn.dataset.mode === 'multiplayer');
        });
        document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.mode === 'multiplayer');
        });

        // 步骤 4：根据游戏状态更新具体 UI
        if (data.status === 'playing') {
          // 游戏进行中
          game.isPlaying = true;
          this.setBoardOverlayVisible(false);
          this.setInviteSectionDisplay('none');
          this.setReadySectionDisplay('none');

          if (data.opponentOnline) {
            this.opponentCard.querySelector('.player-label').textContent = data.isHost ? '对手 (白方)' : '对手 (黑方)';
          } else {
            this.opponentCard.querySelector('.player-label').textContent = '等待重连...';
            this.showToast('对手已断开，等待对手重连...');
          }
        } else {
          // 等待状态：重置准备状态
          this.resetMultiplayerReadyState();
          game.isPlaying = false;

          if (data.isHost) {
            this.opponentCard.querySelector('.player-label').textContent = '等待加入...';
            this.setInviteSectionDisplay('block');
            this.setReadySectionDisplay('none');
            const inviteUrl = `${window.location.origin}/room/${data.roomId}`;
            this.setInviteLinkValue(inviteUrl);
          } else {
            this.setInviteSectionDisplay('none');
            this.setReadySectionDisplay('block');
            this.setReadyButtonState(false, '准备开始');
            this.setMyReadyStatus('未准备', 'var(--text-muted)');
            this.opponentCard.querySelector('.player-label').textContent = '对手 (黑方)';
          }
        }

        // 保存 initMode 以便离开/刷新时逻辑正常工作
        this.initMode = {
          type: data.isHost ? 'create' : 'join',
          roomId: data.roomId
        };

        // 更新 URL 为房间页面
        window.history.pushState({}, '', `/room/${data.roomId}`);

        // 步骤 5：渲染和更新
        this.drawBoard();
        this.updateUI();
        this.updateBoardOverlay();
        this.showToast('重连成功！');
      } else {
        // 重连失败（如房间已过期或服务重启）
        console.log('[DEBUG] Reconnect failed:', data.error);
        localStorage.removeItem('gobang-room');
        this.pendingReconnect = null;

        // 关闭覆盖层
        this.setBoardOverlayVisible(false);
        this.setRoomInfoSectionDisplay('none');

        // 检查当前 URL 是否在房间页面
        const currentPath = window.location.pathname;
        const roomMatch = currentPath.match(/^\/room\/([A-Z0-9]{6})\/?$/i);

        if (roomMatch) {
          this.showToast('房间已失效，请重新创建或加入');
          window.history.pushState({}, '', '/room');
          this.showMultiplayerSelect();
        } else {
          this.showToast('房间已失效，请重新创建或加入');
          this.showMultiplayerSelect();
        }
      }
    });

    socketManager.on('playerJoined', (data) => {
      this.roomPanel.style.display = 'none';
      this.opponentCard.style.display = 'flex';
      this.opponentCard.querySelector('.player-label').textContent = '对手 (白方)';
      game.myColor = 1;
      game.gameMode = 'create';

      // 检查是否是重新加入进行中对局
      if (data.isRejoining && game.isPlaying) {
        // 恢复对局，隐藏准备区域
        this.setInviteSectionDisplay('none');
        this.setReadySectionDisplay('none');
        this.drawBoard();
        this.updateUI();
        this.showToast('对手重新加入，继续对局！');
      } else {
        // 新玩家加入：保留对局记录，但需要双方重新点击开始
        game.isPlaying = false;
        game.winner = null;
        game.lastMove = game.moveHistory.length > 0 ? game.moveHistory[game.moveHistory.length - 1] : null;

        this.mpOpponentPresent = true;
        this.mpMyReady = false;
        this.mpOpponentReady = false;

        // 显示准备（改为 overlay）
        this.setInviteSectionDisplay('none');
        this.setReadySectionDisplay('none');

        this.drawBoard();
        this.updateUI();
        this.updateBoardOverlay();
        this.showToast('对手已加入，请准备开始游戏');
      }
    });

    socketManager.on('gameStart', (data) => {
      game.isPlaying = true;
      game.board = data.board || Array(15).fill(null).map(() => Array(15).fill(0));
      game.currentPlayer = data.currentPlayer || 1;
      this.opponentCard.style.display = 'flex';
      // 隐藏准备区域
      this.setReadySectionDisplay('none');
      // 设置游戏状态为playing，隐藏房间文字，显示游戏操作按钮
      this.updateGameStatus('playing');
      this.setBoardOverlayVisible(false);
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

    socketManager.on('undoRequestResult', (data) => {
      if (data.success && data.pending) {
        this.showToast('已发送悔棋请求，等待对手确认');
      } else if (!data.success) {
        this.showToast(data.error || '悔棋请求失败');
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
      // 重新开始后游戏又开始了，设置为playing
      this.updateGameStatus('playing');
      this.drawBoard();
      this.updateUI();
      this.hideModal(this.resultModal);
      this.showToast('游戏重新开始');
    });

    socketManager.on('restartRequestResult', (data) => {
      if (data.success && data.pending) {
        this.showToast('已发送重新开始请求，等待对手确认');
      } else if (!data.success) {
        this.showToast(data.error || '重新开始请求失败');
      }
    });

    socketManager.on('gameOver', (data) => {
      this.showGameOver(data.winner);
    });

    socketManager.on('playerLeft', (data) => {
      // 对手离开：保留对局记录，但进入等待状态（需对手重新加入并双方开始）
      // NOTE: backend logic changed to force reset.
      if (data.preserveGame) {
        game.board = data.board || game.board;
        game.moveHistory = data.moveHistory || game.moveHistory || [];
        game.currentPlayer = data.currentPlayer || game.currentPlayer || 1;
        game.isPlaying = data.isPlaying === true; // leaving pauses, typically false
        game.winner = null;
        game.lastMove = game.moveHistory.length > 0 ? game.moveHistory[game.moveHistory.length - 1] : null;

        this.mpOpponentPresent = false;
        this.mpMyReady = false;
        this.mpOpponentReady = false;
        this.setBoardOverlayVisible(false);

        this.drawBoard();
        this.opponentCard.style.display = 'none';
        this.updateUI();
        this.showToast(data.reason || '对手离开，对局已保留');
        return;
      }

      // 检查是否还在游戏中（可能已重连）
      if (game.isPlaying && game.gameMode !== 'ai') {
        // 如果还在对局中，可能是误报，尝试重连
        const savedRoom = this.getValidSavedRoom();
        if (savedRoom) {
          console.log('[DEBUG] 收到 playerLeft，但还在游戏中，尝试重连');
          socketManager.reconnectRoom(savedRoom.roomId, savedRoom.playerColor);
          return;
        }
      }

      this.showToast(data.reason || '对手离开');
      // 立即清空棋盘显示
      game.board = Array(15).fill(null).map(() => Array(15).fill(0));
      game.moveHistory = [];
      game.lastMove = null;
      game.winner = null;
      game.isPlaying = false;
      this.drawBoard();
      this.clearRoomInfo();

      // 跳转到多人选择页面，而不是人机页面
      window.history.pushState({}, '', '/room');
      setTimeout(() => {
        this.showMultiplayerSelect();
      }, 2000);
    });

    socketManager.on('opponentDisconnected', (data) => {
      this.mpOpponentPresent = false;
      this.updateBoardOverlay();
      this.showToast(data.reason || '对手断开连接');
    });

    socketManager.on('opponentReconnected', () => {
      this.mpOpponentPresent = true;
      this.updateBoardOverlay();
      this.showToast('对手已重连');
    });

    socketManager.on('becameHost', (data) => {
      // 成为新房主
      game.isHost = true;
      game.myColor = 1;
      game.gameMode = 'create';
      this.saveRoomInfo(data.roomId, 1);

      if (data.preserveGame) {
        // 房主转移：保留对局记录，但进入等待状态
        game.board = data.board || game.board;
        game.moveHistory = data.moveHistory || game.moveHistory || [];
        game.currentPlayer = data.currentPlayer || game.currentPlayer || 1;
        game.isPlaying = data.isPlaying === true;
        game.winner = null;
        game.lastMove = game.moveHistory.length > 0 ? game.moveHistory[game.moveHistory.length - 1] : null;

        this.mpOpponentPresent = false;
        this.mpMyReady = false;
        this.mpOpponentReady = false;
        this.setBoardOverlayVisible(false);

        this.drawBoard();

        this.roomPanel.style.display = 'none';
        this.setRoomInfoSectionDisplay('block');
        this.updateRoomIdDisplay(data.roomId);
        // 桌面端：显示邀请链接区域
        this.setInviteSectionDisplay('block');
        this.setReadySectionDisplay('none');
        const inviteUrl = `${window.location.origin}/room/${data.roomId}`;
        this.setInviteLinkValue(inviteUrl);

        this.opponentCard.style.display = 'flex';
        this.opponentCard.querySelector('.player-label').textContent = '等待加入...';
        this.updateUI();
        this.showToast(data.reason || '你已成为新房主，对局已保留');
      } else {
        // 不保留对局，重置状态
        // 强制重置本地所有状态
        game.gameMode = 'create'; // Ensure mode is create (Host)
        game.myColor = 1;         // Host is Black
        game.board = Array(15).fill(null).map(() => Array(15).fill(0));
        game.moveHistory = [];
        game.currentPlayer = 1;
        game.lastMove = null;
        game.winner = null;
        game.isPlaying = false;

        this.mpOpponentPresent = false;
        this.mpMyReady = false;
        this.mpOpponentReady = false;
        this.setBoardOverlayVisible(false);

        this.drawBoard();

        // 重置准备状态
        this.setMyReadyStatus('未准备', 'var(--text-muted)');
        this.setOpponentReadyStatus('未准备', 'var(--text-muted)');
        this.setReadyButtonState(false, '准备开始');

        // 在左侧面板显示邀请信息
        this.roomPanel.style.display = 'none';
        this.setRoomInfoSectionDisplay('block');
        this.updateRoomIdDisplay(data.roomId);
        // 桌面端：显示邀请链接区域
        this.setInviteSectionDisplay('block');
        this.setReadySectionDisplay('none');
        const inviteUrl = `${window.location.origin}/room/${data.roomId}`;
        this.setInviteLinkValue(inviteUrl);

        this.opponentCard.style.display = 'flex';
        this.opponentCard.querySelector('.player-label').textContent = '等待加入...';
        this.updateUI();
        this.showToast(data.reason || '你已成为新房主');
      }
    });

    socketManager.on('socketError', (data) => {
      this.showToast(data.error || '发生错误');
    });

    socketManager.on('opponentReady', (data) => {
      // 对手准备了
      this.mpOpponentReady = true;
      this.updateBoardOverlay();
      this.setOpponentReadyStatus('已准备', 'var(--success-color)');
      this.showToast('对手已准备');
    });

    socketManager.on('playerReadyResult', (data) => {
      if (data.success) {
        // 自己准备了
        this.mpMyReady = true;
        this.updateBoardOverlay();
        this.setMyReadyStatus('已准备', 'var(--success-color)');
        this.setReadyButtonState(true, '等待对手准备...');
      } else {
        this.showToast(data.error || '准备失败');
      }
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

  // 处理模式切换
  handleModeChange(mode) {
    if (mode === 'ai') {
      // 切换到人机模式：URL 变为 /ai
      this.resumeAIGame();
      window.history.pushState({}, '', '/ai');
    } else if (mode === 'multiplayer') {
      // 显示玩家对战选择面板
      this.showMultiplayerSelect();
      // URL 由 showMultiplayerSelect 内部根据是否有房间来决定
    }
  }

  // 显示玩家对战选择
  showMultiplayerSelect() {
    // 如果是人机对战模式，先保存当前状态
    if (game.gameMode === 'ai' && game.isPlaying) {
      game.saveGame();
    }

    // 检查是否有保存的房间
    const savedRoom = this.getValidSavedRoom();
    console.log('[DEBUG] showMultiplayerSelect - savedRoom:', savedRoom);
    console.log('[DEBUG] showMultiplayerSelect - localStorage gobang-room:', localStorage.getItem('gobang-room'));

    if (savedRoom) {
      console.log('[DEBUG] Found saved room, attempting reconnect...', savedRoom);

      // 先隐藏选择面板，防止闪烁
      document.getElementById('multiplayerSelect').style.display = 'none';

      this.pendingReconnect = savedRoom;

      // UX Improvement: Show loading state
      this.showToast('正在恢复房间连接...', 2000);

      // 尝试重连
      socketManager.reconnectRoom(savedRoom.roomId, savedRoom.playerColor);
      return;
    }

    // 没有保存的房间，显示选择面板
    this.roomPanel.style.display = 'none';
    this.setRoomInfoSectionDisplay('none');

    // Reset game state for clean multiplayer selection
    game.gameMode = 'multiplayer';
    game.board = Array(15).fill(null).map(() => Array(15).fill(0));
    game.currentPlayer = 1;
    game.isPlaying = false;
    game.moveHistory = [];
    game.winner = null;
    game.lastMove = null;

    document.getElementById('multiplayerSelect').style.display = 'block';
    this.updateModeUI('multiplayer');

    // 更新 URL 为 /room
    window.history.pushState({}, '', '/room');
    this.drawBoard();
    this.updateUI();
  }

  // 恢复人机对战状态
  resumeAIGame() {
    game.init('ai');
    game.myColor = 1;

    // 尝试加载保存的游戏状态
    const loaded = game.loadGame();
    if (!loaded) {
      // 没有保存的状态，开始新游戏
      game.isPlaying = true;
      game.board = Array(15).fill(null).map(() => Array(15).fill(0));
      game.winner = null;
      game.currentPlayer = 1;
      game.moveHistory = [];
      game.lastMove = null;
    }

    this.roomPanel.style.display = 'none';
    document.getElementById('multiplayerSelect').style.display = 'none';
    this.opponentCard.style.display = 'flex';
    this.opponentCard.querySelector('.player-label').textContent = 'AI (白方)';
    this.setRoomInfoSectionDisplay('none');
    this.updateModeUI('ai');
    this.updateUI();
    this.drawBoard();
  }

  // 创建房间
  createRoom() {
    game.gameMode = 'create';
    game.isPlaying = false;
    this.resetMultiplayerReadyState();
    this.setBoardOverlayVisible(false);

    socketManager.createRoom();

    // 隐藏选择面板，通过data-game-status让CSS控制房间信息显示
    document.getElementById('multiplayerSelect').style.display = 'none';
    // 设置waiting状态，让CSS控制房间信息栏显示
    document.body.setAttribute('data-game-status', 'waiting');
    // 桌面端：显示邀请链接区域（在 socket 回调中会设置）
    this.setInviteSectionDisplay('none');

    // 先显示对手卡片占位（等待socket回调更新文字）
    this.opponentCard.style.display = 'flex';
    this.opponentCard.querySelector('.player-label').textContent = '等待加入...';
    this.playerCard.querySelector('.player-label').textContent = '你 (黑方)';
    this.updateModeUI('room');
    this.updateUI();
  }

  // 显示加入房间面板
  showJoinPanel() {
    game.gameMode = 'join';
    game.isPlaying = false;
    this.resetMultiplayerReadyState();
    this.setBoardOverlayVisible(false);

    // 隐藏选择面板，通过data-game-status让CSS控制房间信息显示
    document.getElementById('multiplayerSelect').style.display = 'none';
    // 设置waiting状态，让CSS控制房间信息栏显示
    document.body.setAttribute('data-game-status', 'waiting');
    this.setInviteSectionDisplay('none');

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
    this.resetMultiplayerReadyState();
    this.setBoardOverlayVisible(false);
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
    document.getElementById('multiplayerSelect').style.display = 'none';
    this.opponentCard.style.display = 'flex';
    this.opponentCard.querySelector('.player-label').textContent = 'AI (白方)';
    this.setRoomInfoSectionDisplay('none');
    this.updateModeUI('ai');
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

  // 处理窗口大小改变
  handleResize() {
    const { canvas, boardSize } = this;
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

    // Mobile browsers can fire spurious resize events during scroll/address-bar changes.
    // Skip work unless the effective size actually changes.
    if (this.canvasSize === canvasSize && this.padding === padding && this.dpr === dpr) {
      return;
    }

    this.padding = padding;
    this.cellSize = (canvasSize - padding * 2) / (boardSize - 1);

    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    canvas.style.width = canvasSize + 'px';
    canvas.style.height = canvasSize + 'px';

    this.dpr = dpr;
    this.canvasSize = canvasSize;

    // 重新绘制棋盘
    this.drawBoard();
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
      return;
    }

    // 玩家对战：走 Socket 流程
    if (!game.roomId) {
      this.showToast('未在房间中');
      return;
    }
    socketManager.requestUndo();
  }

  // 处理重新开始
  handleRestart() {
    if (game.gameMode === 'ai') {
      game.reset();
      game.clearSavedGame(); // 清除保存的游戏状态
      // 确保隐藏房间信息框
      this.setRoomInfoSectionDisplay('none');
      this.updateModeUI('ai');
      this.drawBoard();
      this.updateUI();
      return;
    }

    if (!game.roomId) {
      this.showToast('未在房间中');
      return;
    }
    socketManager.requestRestart();
  }

  // 处理离开房间
  handleLeaveRoom() {
    // 如果在玩家对战模式中，通知服务器离开房间
    if (game.gameMode !== 'ai') {
      socketManager.leaveRoom();
    }

    // 清理房间信息
    this.clearRoomInfo();

    // 重置棋盘显示（回到玩家对战选择页）
    this.resetBoardToWaiting();

    // 更新 URL 为玩家对战选择页面
    window.history.pushState({}, '', '/room');

    // 显示玩家对战选择面板
    this.showMultiplayerSelect();

    this.showToast('已离开房间');
  }

  // 处理准备
  handleReady() {
    socketManager.playerReady();
  }

  // 清理房间信息
  clearRoomInfo() {
    game.roomId = null;
    game.isHost = false;
    localStorage.removeItem('gobang-room');
    this.setRoomInfoSectionDisplay('none');
    this.resetMultiplayerReadyState();
    this.setBoardOverlayVisible(false);
  }

  // 保存房间信息到本地存储
  saveRoomInfo(roomId, playerColor) {
    localStorage.setItem('gobang-room', JSON.stringify({
      roomId,
      playerColor,
      isHost: playerColor === 1,  // 黑棋是房主
      timestamp: Date.now()
    }));
  }

  // 更新UI状态
  updateUI() {
    // Drive UI visibility from game state to avoid refresh flicker.
    this.updateGameStatus(game.isPlaying && game.winner === null ? 'playing' : null);

    // 更新当前回合
    this.currentTurnDisplay.textContent = game.currentPlayer === 1 ? '黑方' : '白方';

    // 更新模式显示
    if (game.gameMode === 'ai') {
      this.gameModeDisplay.textContent = '人机对战';
    } else if (game.gameMode === 'multiplayer') {
      this.gameModeDisplay.textContent = '玩家对战';
    } else if (game.gameMode === 'create') {
      this.gameModeDisplay.textContent = '玩家对战 (房主)';
    } else if (game.gameMode === 'join') {
      this.gameModeDisplay.textContent = '玩家对战 (访客)';
    }

    // 更新回合指示
    const isMyTurn = game.isMyTurn();
    const yourTurnEl = document.getElementById('yourTurn');
    const opponentTurnEl = document.getElementById('opponentTurn');
    yourTurnEl.classList.toggle('visible', isMyTurn && game.isPlaying);
    opponentTurnEl.classList.toggle('visible', !isMyTurn && game.isPlaying);
    this.playerCard.classList.toggle('active', isMyTurn && game.isPlaying);
    this.opponentCard.classList.toggle('active', !isMyTurn && game.isPlaying);

    // 启用/禁用按钮（多人对战：仅对局开始后才可用）
    this.undoBtn.disabled = !game.isPlaying || game.moveHistory.length === 0;
    this.restartBtn.disabled = !game.isPlaying;

    // Subtle affordance: only show pointer when the user can place a stone.
    const canInteract = game.isPlaying && game.winner === null && isMyTurn;
    this.canvas.style.cursor = canInteract ? 'pointer' : 'default';

    // Multiplayer pre-start overlay
    this.updateBoardOverlay();
  }

  // 显示游戏结束
  showGameOver(winner) {
    game.winner = winner;
    game.isPlaying = false;

    // 清除playing状态，恢复显示房间信息
    this.updateGameStatus(null);

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

  // 根据初始化模式执行相应操作（注意：重连逻辑优先）
  if (ui.pendingReconnect) {
    // 处理待重连的房间
    socketManager.reconnectRoom(ui.pendingReconnect.roomId, ui.pendingReconnect.playerColor);
    ui.pendingReconnect = null;
  } else if (ui.pendingRoomId) {
    // 处理待加入的房间（URL 邀请链接）
    socketManager.joinRoom(ui.pendingRoomId);
    ui.pendingRoomId = null;
  }
  // multiplayer 模式不需要额外处理，已在构造函数中显示选择面板
});
