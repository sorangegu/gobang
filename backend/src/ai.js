// 简单五子棋 AI - 评分函数 + 贪心算法

// 评分模式
const SCORES = {
  // 活四 (两边都空)
  OPEN_FOUR: 100000,
  // 冲四 (一边被挡)
  FOUR: 10000,
  // 活三 (两边都空)
  OPEN_THREE: 1000,
  // 眠三 (一边被挡)
  THREE: 100,
  // 活二
  OPEN_TWO: 10,
  // 眠二
  TWO: 1
};

// 四个方向
const DIRECTIONS = [
  [1, 0],   // 水平
  [0, 1],   // 垂直
  [1, 1],   // 对角线
  [1, -1]   // 反对角线
];

// 评估整个棋盘
function evaluateBoard(board, aiPlayer) {
  const humanPlayer = 3 - aiPlayer;
  let aiScore = 0;
  let humanScore = 0;

  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      if (board[y][x] !== 0) continue;

      aiScore += evaluatePoint(board, x, y, aiPlayer);
      humanScore += evaluatePoint(board, x, y, humanPlayer);
    }
  }

  return { aiScore, humanScore, total: aiScore - humanScore };
}

// 评估单个落子点
function evaluatePoint(board, x, y, player) {
  let totalScore = 0;

  for (const [dx, dy] of DIRECTIONS) {
    const lineScore = evaluateLine(board, x, y, dx, dy, player);
    totalScore += lineScore;
  }

  return totalScore;
}

// 评估一个方向上的连子情况
function evaluateLine(board, x, y, dx, dy, player) {
  // 收集该方向上的棋子
  let count = 0;
  let openEnds = 0;
  let blocked = 0;

  // 正方向
  let nx = x + dx;
  let ny = y + dy;
  while (nx >= 0 && nx < 15 && ny >= 0 && ny < 15) {
    if (board[ny][nx] === player) {
      count++;
    } else if (board[ny][nx] === 0) {
      openEnds++;
      break;
    } else {
      blocked++;
      break;
    }
    nx += dx;
    ny += dy;
  }

  // 反方向
  nx = x - dx;
  ny = y - dy;
  while (nx >= 0 && nx < 15 && ny >= 0 && ny < 15) {
    if (board[ny][nx] === player) {
      count++;
    } else if (board[ny][nx] === 0) {
      openEnds++;
      break;
    } else {
      blocked++;
      break;
    }
    nx -= dx;
    ny -= dy;
  }

  // 根据连子数和空端数评分
  if (count >= 5) return SCORES.OPEN_FOUR;
  if (count === 4) {
    if (openEnds === 2) return SCORES.OPEN_FOUR;
    if (openEnds === 1) return SCORES.FOUR;
  }
  if (count === 3) {
    if (openEnds === 2) return SCORES.OPEN_THREE;
    if (openEnds === 1) return SCORES.THREE;
  }
  if (count === 2) {
    if (openEnds === 2) return SCORES.OPEN_TWO;
    if (openEnds === 1) return SCORES.TWO;
  }
  if (count === 1 && openEnds === 2) return 1;

  return 0;
}

// 获取最佳落子点
function getBestMove(board, aiPlayer = 2) {
  let bestScore = -Infinity;
  let bestX = -1;
  let bestY = -1;

  // 先检查是否需要防守 (对手有活四)
  const humanPlayer = 3 - aiPlayer;
  const attackMove = findCriticalMove(board, aiPlayer);
  const defendMove = findCriticalMove(board, humanPlayer);

  // 优先攻击
  if (attackMove) {
    return attackMove;
  }

  // 其次防守
  if (defendMove) {
    return defendMove;
  }

  // 否则找最高评分点
  // 限制搜索范围在已有棋子附近
  const candidates = getCandidateMoves(board);

  for (const { x, y } of candidates) {
    // 模拟落子
    board[y][x] = aiPlayer;
    const { total } = evaluateBoard(board, aiPlayer);
    board[y][x] = 0;

    if (total > bestScore) {
      bestScore = total;
      bestX = x;
      bestY = y;
    }
  }

  // 如果没有候选点，随机落子
  if (bestX === -1) {
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 15; x++) {
        if (board[y][x] === 0) {
          return { x, y };
        }
      }
    }
  }

  return { x: bestX, y: bestY };
}

// 找到关键点 (活四或冲四)
function findCriticalMove(board, player) {
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      if (board[y][x] !== 0) continue;

      // 检查这个点是否能形成活四或冲四
      for (const [dx, dy] of DIRECTIONS) {
        const lineScore = evaluateLine(board, x, y, dx, dy, player);
        if (lineScore >= SCORES.FOUR) {
          return { x, y };
        }
      }
    }
  }
  return null;
}

// 获取候选落子点 (已有棋子周围)
function getCandidateMoves(board) {
  const candidates = new Set();
  const visited = new Set();

  // 找到所有已有棋子
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      if (board[y][x] !== 0) {
        // 添加周围落子点
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15) continue;
            if (board[ny][nx] === 0) {
              const key = `${nx},${ny}`;
              if (!visited.has(key)) {
                visited.add(key);

                // 评估这个点
                const aiScore = evaluatePoint(board, nx, ny, 2);
                const humanScore = evaluatePoint(board, nx, ny, 1);
                const score = aiScore + humanScore;

                candidates.add({ x: nx, y: ny, score });
              }
            }
          }
        }
      }
    }
  }

  // 如果没有候选点，返回中心和四周
  if (candidates.size === 0) {
    return [{ x: 7, y: 7, score: Infinity }];
  }

  // 按评分排序
  const sorted = Array.from(candidates).sort((a, b) => b.score - a.score);

  // 返回前N个候选点
  return sorted.slice(0, 15);
}

module.exports = {
  getBestMove,
  evaluateBoard,
  evaluatePoint
};
