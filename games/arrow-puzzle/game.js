/**
 * ➡️ 箭头迷宫（Arrow Maze）
 * 在箭头组成的方阵里，从 🚀 起点出发，按每个格子箭头的指向，
 * 一步步走到 🏁 终点。中途不能乱走。
 */
if (!window.TOOL_REGISTRY) window.TOOL_REGISTRY = {};

let _arrowMazeState = null;
let _arrowMazeHintTimer = null;

const ARROW_MAZE_MAX_LEVEL = 268;

const ARROW_MAZE_DIR = {
  '↑': { dr: -1, dc: 0 },
  '↓': { dr: 1,  dc: 0 },
  '←': { dr: 0,  dc: -1 },
  '→': { dr: 0,  dc: 1 }
};
const ARROW_MAZE_ARROWS = ['↑', '↓', '←', '→'];

function _getArrowMazeSize(level) {
  if (level <= 10)  return { rows: 8,  cols: 5 };
  if (level <= 30)  return { rows: 10, cols: 5 };
  if (level <= 60)  return { rows: 12, cols: 5 };
  if (level <= 100) return { rows: 14, cols: 5 };
  if (level <= 150) return { rows: 16, cols: 6 };
  if (level <= 200) return { rows: 18, cols: 6 };
  return { rows: 22, cols: 6 };
}

/**
 * 生成一个有解的箭头迷宫：
 * 1) 从 (0,0) 做随机游走，覆盖 ~65% 的格子，形成一条"主路径"
 * 2) 主路径上每格的箭头指向路径的下一格
 * 3) 终点 = 主路径的最后一个格子
 * 4) 其余空格子随机填一个箭头作为干扰
 */
function _generateArrowMaze(level) {
  const size = _getArrowMazeSize(level);
  const rows = size.rows, cols = size.cols;

  const dirs = [
    { arrow: '↑', dr: -1, dc: 0 },
    { arrow: '↓', dr:  1, dc: 0 },
    { arrow: '←', dr:  0, dc: -1 },
    { arrow: '→', dr:  0, dc:  1 }
  ];

  const grid = Array(rows).fill(null).map(() => Array(cols).fill(null));
  const start = { r: 0, c: 0 };

  let curR = start.r, curC = start.c;
  const visited = new Set([`${curR},${curC}`]);
  const path = [{ r: curR, c: curC }];

  const target = Math.max(rows * 2, Math.floor(rows * cols * (0.65 + Math.random() * 0.2)));
  let guard = 0;

  while (path.length < target && guard++ < 6000) {
    const moves = [];
    for (const d of dirs) {
      const nr = curR + d.dr, nc = curC + d.dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited.has(`${nr},${nc}`)) {
        moves.push({ ...d, nr, nc });
      }
    }
    if (moves.length === 0) {
      if (path.length > 5) break;
      // 重新开始
      curR = start.r; curC = start.c;
      visited.clear();
      visited.add(`${start.r},${start.c}`);
      path.length = 0;
      path.push({ r: curR, c: curC });
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) grid[r][c] = null;
      continue;
    }
    const m = moves[Math.floor(Math.random() * moves.length)];
    grid[curR][curC] = m.arrow;
    curR = m.nr; curC = m.nc;
    visited.add(`${curR},${curC}`);
    path.push({ r: curR, c: curC });
  }

  // 终点格箭头随便指一个合法方向即可（玩家不会再从它出发）
  const endValid = dirs.filter(d => {
    const nr = curR + d.dr, nc = curC + d.dc;
    return nr >= 0 && nr < rows && nc >= 0 && nc < cols;
  });
  if (endValid.length) grid[curR][curC] = endValid[Math.floor(Math.random() * endValid.length)].arrow;

  // 其余空格随机填箭头（干扰）
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === null) {
        grid[r][c] = ARROW_MAZE_ARROWS[Math.floor(Math.random() * 4)];
      }
    }
  }

  const end = { r: curR, c: curC };
  return { grid, start, end, size };
}

/* ------------------------------------------------------------------ */
/*  HTML 渲染                                                          */
/* ------------------------------------------------------------------ */
function renderArrowMaze() {
  return `
    <div class="card" style="position:relative;overflow:visible;">
      <div style="display:flex;gap:8px;justify-content:center;margin:4px 0 10px;flex-wrap:wrap;">
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">📚 ${t('arrow.level')}: <b id="arrowMazeLevel" style="color:var(--primary)">1</b>/268</span>
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">🛤 ${t('arrow.length')}: <b id="arrowMazeScore" style="color:var(--warning)">0</b></span>
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">❤️ <b id="arrowMazeHearts" style="color:var(--danger)">5</b></span>
        ${GamePay.roundsBadge('arrow-maze')}
      </div>

      <!-- 迷宫盘：白底圆角，模仿截图 -->
      <div style="position:relative;width:100%;max-width:420px;margin:0 auto;">
        <div id="arrowMazeBoard" style="display:grid;gap:6px;padding:14px;background:#ffffff;border-radius:16px;width:100%;touch-action:manipulation;border:1px solid #e8edf5;"></div>
      </div>

      <!-- 底部三个圆形工具按钮：橡皮 / 星星棒 / 时钟 -->
      <div style="display:flex;justify-content:center;align-items:center;gap:26px;margin-top:18px;padding:8px 0;">
        <button id="arrowMazeEraserBtn" class="am-tool-btn" type="button" aria-label="橡皮擦">
          <span class="am-tool-emoji">🧽</span>
          <span class="am-tool-badge">+</span>
        </button>
        <button id="arrowMazeStarBtn" class="am-tool-btn" type="button" aria-label="星星提示">
          <span class="am-tool-emoji">🪄</span>
          <span class="am-tool-badge">+</span>
        </button>
        <button id="arrowMazeClockBtn" class="am-tool-btn" type="button" aria-label="时钟重排">
          <span class="am-tool-emoji">⏰</span>
          <span class="am-tool-badge">+</span>
        </button>
      </div>

      <div style="display:flex;gap:8px;justify-content:center;margin-top:6px;">
        <button id="arrowMazeHintBtn" class="btn sec" style="flex:1;">💡 ${t('arrow.hint')}</button>
        <button id="arrowMazeRestartBtn" class="btn sec" style="flex:1;">🔄 ${t('arrow.restart')}</button>
      </div>

      <div id="arrowMazeStatus" style="text-align:center;color:var(--text-muted);font-size:13px;margin-top:10px;min-height:20px;">
        沿着 🚀 起点出发，按每个格子的箭头方向走到 🏁 终点
      </div>
    </div>

    <!-- 全屏遮罩（沿用项目原有风格） -->
    <div id="gpOverlay" style="position:fixed;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.88);z-index:9999;padding:30px;box-sizing:border-box;">
      ${GamePay.overlayHTML('arrow-maze', 'game.arrow-maze', 'arrow.controls')}
    </div>

    <style>
      .am-cell{
        aspect-ratio:1;
        background:transparent;
        border-radius:6px;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:clamp(20px, 5.5vw, 36px);
        font-weight:900;
        color:#1a1a2e;
        cursor:pointer;
        touch-action:manipulation;
        position:relative;
        transition:transform .12s, background .12s;
      }
      .am-cell:active{transform:scale(.92);}

      .am-cell .am-cell-arrow{
        display:block;
        line-height:1;
      }

      .am-cell.start-cell{
        background:rgba(102,187,106,.18);
        box-shadow:inset 0 0 0 1px #66bb6a;
      }
      .am-cell.start-cell .am-cell-arrow{color:#2e7d32;}
      .am-cell.start-cell::before{
        content:'🚀';
        position:absolute;
        top:0; right:1px;
        font-size:10px;
        line-height:1;
      }

      .am-cell.end-cell{
        background:rgba(239,83,80,.18);
        box-shadow:inset 0 0 0 1px #ef5350;
      }
      .am-cell.end-cell .am-cell-arrow{color:#c62828;}
      .am-cell.end-cell::after{
        content:'🏁';
        position:absolute;
        bottom:0; left:1px;
        font-size:10px;
        line-height:1;
      }

      .am-cell.in-path{
        background:#fce38a !important;
        box-shadow:inset 0 0 0 2px #f38181;
      }
      .am-cell.current-cell{
        background:#95e1d3 !important;
        box-shadow:0 0 0 3px #38ada9;
      }
      .am-cell.reached-end{
        background:#b9f6ca !important;
        box-shadow:inset 0 0 0 3px #00c853;
      }
      .am-cell.wrong{
        background:#ff6b6b !important;
        animation:amShake .25s;
      }
      .am-cell.hint-cell{
        background:rgba(125,223,125,.45) !important;
        box-shadow:0 0 14px #7ddf7d, inset 0 0 0 2px #4caf50;
      }

      /* 圆形工具按钮 */
      .am-tool-btn{
        position:relative;
        width:64px; height:64px;
        border-radius:50%;
        background:#c8d6ff;
        border:3px solid #fff;
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:center;
        transition:transform .12s, box-shadow .12s;
        box-shadow:0 4px 0 #8fa3d8, 0 6px 12px rgba(143,163,216,.4);
        padding:0;
        outline:none;
      }
      .am-tool-btn:active{
        transform:translateY(3px);
        box-shadow:0 1px 0 #8fa3d8, 0 2px 4px rgba(143,163,216,.4);
      }
      .am-tool-emoji{font-size:30px;line-height:1;}
      .am-tool-badge{
        position:absolute;
        bottom:-4px; right:-4px;
        width:24px; height:24px;
        border-radius:50%;
        background:#4caf50;
        color:#fff;
        font-size:14px;
        font-weight:900;
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 2px 4px rgba(0,0,0,.25);
        border:2px solid #fff;
        line-height:1;
      }

      @keyframes amShake{
        0%{transform:translateX(0)}
        25%{transform:translateX(-6px)}
        75%{transform:translateX(6px)}
        100%{transform:translateX(0)}
      }

      /* 全屏遮罩样式（沿用） */
      #gpOverlay #gpOverlayTitle{
        font-size:30px!important;margin-bottom:12px!important;text-align:center;color:#fff!important;
      }
      #gpOverlay #gpOverlaySub{
        font-size:18px!important;margin-bottom:20px!important;line-height:1.8;max-width:100%;text-align:center;color:#b0c4e8!important;
      }
      #gpOverlay #gpStartBtn{
        min-width:240px!important;font-size:22px!important;padding:16px 32px!important;border-radius:60px!important;
        background:linear-gradient(90deg,#8fb0ff,#6d8dff)!important;
      }
      #gpOverlay .btn{
        font-size:20px!important;padding:14px 28px!important;min-height:56px!important;border-radius:60px!important;
      }
      #gpOverlay div[style*="font-size:11px"]{
        font-size:15px!important;color:#8b93bd!important;margin-top:10px!important;
      }
    </style>
  `;
}

function bindArrowMazeEvents() {
  GamePay.bindStart('arrow-maze', () => startArrowMazeGame());
}

/* ------------------------------------------------------------------ */
/*  启动 / 控制台                                                       */
/* ------------------------------------------------------------------ */
function startArrowMazeGame(keepScore) {
  if (!GamePay.consumeRound('arrow-maze')) return;

  const overlay = document.getElementById('gpOverlay');
  if (overlay) overlay.style.display = 'none';

  const prevScore  = (keepScore && _arrowMazeState) ? _arrowMazeState.score  : 0;
  const prevLevel  = (keepScore && _arrowMazeState) ? _arrowMazeState.level  : 1;
  const prevHearts = (keepScore && _arrowMazeState) ? _arrowMazeState.hearts : 5;

  _arrowMazeState = {
    level: prevLevel,
    score: prevScore,
    hearts: prevHearts,
    grid: null,
    start: null,
    end: null,
    path: [],
    size: null,
    gameOver: false,
    levelCompleted: false,
    hintCells: [],
    hintUsed: 0,
    hintLimit: 3
  };

  const m = _generateArrowMaze(_arrowMazeState.level);
  _arrowMazeState.grid  = m.grid;
  _arrowMazeState.start = m.start;
  _arrowMazeState.end   = m.end;
  _arrowMazeState.size  = m.size;

  GamePay.registerRevive('arrow-maze', () => {
    if (!_arrowMazeState) return;
    const s = _arrowMazeState;
    s.hearts = 5;
    s.gameOver = false;
    s.levelCompleted = false;
    s.path = [];
    s.hintCells = [];
    s.hintUsed = 0;
    const m2 = _generateArrowMaze(s.level);
    s.grid = m2.grid; s.start = m2.start; s.end = m2.end; s.size = m2.size;
    _renderArrowMazeBoard();
    _updateArrowMazeUI();
    _amStatus(`♻️ 已复活，第 ${s.level} 关`);
  });

  _renderArrowMazeBoard();
  _updateArrowMazeUI();
  _amStatus(`第 ${_arrowMazeState.level} 关：点击 🚀 起点开始`);

  document.getElementById('arrowMazeHintBtn').onclick     = () => _amGiveHint();
  document.getElementById('arrowMazeRestartBtn').onclick  = () => _amResetLevel();
  document.getElementById('arrowMazeEraserBtn').onclick   = () => _amUndo();
  document.getElementById('arrowMazeStarBtn').onclick     = () => _amGiveHint();
  document.getElementById('arrowMazeClockBtn').onclick    = () => _amReshuffle();

  const board = document.getElementById('arrowMazeBoard');
  board.onclick = (e) => {
    const cell = e.target.closest('.am-cell');
    if (!cell) return;
    if (_arrowMazeState.gameOver || _arrowMazeState.levelCompleted) return;
    const r = parseInt(cell.dataset.r, 10);
    const c = parseInt(cell.dataset.c, 10);
    if (isNaN(r) || isNaN(c)) return;
    _amOnClick(r, c, cell);
  };
}

function _updateArrowMazeUI() {
  const s = _arrowMazeState;
  document.getElementById('arrowMazeLevel').textContent  = s.level;
  document.getElementById('arrowMazeScore').textContent  = s.score;
  document.getElementById('arrowMazeHearts').textContent = s.hearts;
}

function _amStatus(msg) {
  document.getElementById('arrowMazeStatus').textContent = msg;
}

/* ------------------------------------------------------------------ */
/*  玩法核心                                                            */
/* ------------------------------------------------------------------ */
function _amOnClick(r, c, cellEl) {
  const s = _arrowMazeState;
  if (!s || !s.grid) return;

  // 第一步必须是起点
  if (s.path.length === 0) {
    if (r !== s.start.r || c !== s.start.c) {
      s.hearts--;
      _updateArrowMazeUI();
      cellEl.classList.add('wrong');
      setTimeout(() => cellEl.classList.remove('wrong'), 300);
      _amStatus('❌ 请先点击 🚀 起点');
      if (s.hearts <= 0) {
        s.gameOver = true;
        GamePay.showGameOver('arrow-maze',
          `${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${s.score}</b>`,
          { score: s.score });
      }
      return;
    }
    s.path.push({ r, c });
    s.score++;
    _updateArrowMazeUI();
    s.hintCells = [];
    _renderArrowMazeBoard();
    _amStatus(`▶️ 起步成功，箭头方向是下一个目标`);
    return;
  }

  const last = s.path[s.path.length - 1];
  if (last.r === r && last.c === c) return; // 重复点同一格

  const pathSet = new Set(s.path.map(p => `${p.r},${p.c}`));
  const key = `${r},${c}`;
  if (pathSet.has(key)) return; // 已经走过的格子（除非是上一格用于撤销）

  // 必须相邻
  const dr = r - last.r, dc = c - last.c;
  if (Math.abs(dr) + Math.abs(dc) !== 1) {
    cellEl.classList.add('wrong');
    setTimeout(() => cellEl.classList.remove('wrong'), 300);
    _amStatus('❌ 只能点击相邻的格子');
    return;
  }

  // 当前格箭头必须指向(r,c)
  const lastArrow = s.grid[last.r][last.c];
  const exp = ARROW_MAZE_DIR[lastArrow];
  if (!exp || exp.dr !== dr || exp.dc !== dc) {
    s.hearts--;
    _updateArrowMazeUI();
    cellEl.classList.add('wrong');
    setTimeout(() => cellEl.classList.remove('wrong'), 300);
    _amStatus('❌ 这个箭头方向不对，-1 ❤️');
    if (s.hearts <= 0) {
      s.gameOver = true;
      GamePay.showGameOver('arrow-maze',
        `${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${s.score}</b>`,
        { score: s.score });
    }
    return;
  }

  // 合法移动
  s.path.push({ r, c });
  s.score++;
  _updateArrowMazeUI();
  s.hintCells = [];

  // 到达终点
  if (r === s.end.r && c === s.end.c) {
    s.levelCompleted = true;
    _renderArrowMazeBoard();
    if (s.level >= ARROW_MAZE_MAX_LEVEL) {
      _amStatus('🏆🏆🏆 通关全部 268 关！');
      s.gameOver = true;
      GamePay.showGameOver('arrow-maze',
        `${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${s.score}</b>`,
        { win: true, score: s.score });
    } else {
      _amStatus(`🎉 第 ${s.level} 关通过，用了 ${s.path.length} 步`);
      setTimeout(() => {
        s.level++;
        s.hearts = 5;
        s.gameOver = false;
        s.levelCompleted = false;
        s.path = [];
        s.hintCells = [];
        s.hintUsed = 0;
        const m = _generateArrowMaze(s.level);
        s.grid = m.grid; s.start = m.start; s.end = m.end; s.size = m.size;
        _renderArrowMazeBoard();
        _updateArrowMazeUI();
        _amStatus(`第 ${s.level} 关，加油！`);
      }, 1200);
    }
    return;
  }

  _renderArrowMazeBoard();
  _amStatus(`✔️ 已走 ${s.path.length} 步，继续`);
}

/* ------------------------------------------------------------------ */
/*  三个圆形工具按钮                                                    */
/* ------------------------------------------------------------------ */
function _amUndo() {
  const s = _arrowMazeState;
  if (!s || s.path.length === 0) {
    _amStatus('🧽 当前没有可撤销的步数');
    return;
  }
  s.path.pop();
  s.hintCells = [];
  _renderArrowMazeBoard();
  _amStatus('🧽 已撤销一步');
}

function _amGiveHint() {
  const s = _arrowMazeState;
  if (!s || s.gameOver || s.levelCompleted) return;
  if (s.hintUsed >= s.hintLimit) {
    _amStatus('💡 本关提示次数已用完！');
    return;
  }

  let cells = [];
  if (s.path.length === 0) {
    cells = [[s.start.r, s.start.c]];
  } else {
    const last = s.path[s.path.length - 1];
    const arrow = s.grid[last.r][last.c];
    const d = ARROW_MAZE_DIR[arrow];
    if (!d) {
      _amStatus('💡 当前格箭头异常，请撤销重走');
      return;
    }
    const nr = last.r + d.dr, nc = last.c + d.dc;
    if (nr < 0 || nr >= s.size.rows || nc < 0 || nc >= s.size.cols) {
      _amStatus('💡 当前方向已无路可走，请用橡皮撤销');
      return;
    }
    cells = [[nr, nc]];
  }

  s.hintUsed++;
  if (s.score > 0) s.score--;
  _updateArrowMazeUI();
  s.hintCells = cells;
  _renderArrowMazeBoard();
  _amStatus(`💡 已用 ${s.hintUsed}/${s.hintLimit} 次提示（扣 1 分）`);

  if (s.hintUsed === s.hintLimit) {
    s.hearts--;
    _updateArrowMazeUI();
    _amStatus(`💔 提示用尽，扣 1 颗心！剩 ${s.hearts}`);
    if (s.hearts <= 0) {
      s.gameOver = true;
      GamePay.showGameOver('arrow-maze',
        `${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${s.score}</b>`,
        { score: s.score });
    }
  }

  if (_arrowMazeHintTimer) clearTimeout(_arrowMazeHintTimer);
  _arrowMazeHintTimer = setTimeout(() => {
    if (s) { s.hintCells = []; _renderArrowMazeBoard(); }
  }, 2500);
}

function _amReshuffle() {
  const s = _arrowMazeState;
  if (!s) return;
  if (s.hearts < 2) {
    _amStatus('⏰ 心数不足 2，无法重排迷宫');
    return;
  }
  s.hearts -= 2;
  s.path = [];
  s.hintCells = [];
  s.hintUsed = 0;
  const m = _generateArrowMaze(s.level);
  s.grid = m.grid; s.start = m.start; s.end = m.end; s.size = m.size;
  _updateArrowMazeUI();
  _renderArrowMazeBoard();
  _amStatus('⏰ 迷宫已重排（-2 ❤️）');
}

function _amResetLevel() {
  const s = _arrowMazeState;
  if (!s) return;
  s.path = [];
  s.hearts = 5;
  s.gameOver = false;
  s.levelCompleted = false;
  s.hintCells = [];
  s.hintUsed = 0;
  const m = _generateArrowMaze(s.level);
  s.grid = m.grid; s.start = m.start; s.end = m.end; s.size = m.size;
  _renderArrowMazeBoard();
  _updateArrowMazeUI();
  _amStatus(`🔄 已重置第 ${s.level} 关`);
}

/* ------------------------------------------------------------------ */
/*  重绘迷宫                                                            */
/* ------------------------------------------------------------------ */
function _renderArrowMazeBoard() {
  const s = _arrowMazeState;
  const board = document.getElementById('arrowMazeBoard');
  if (!board || !s) return;
  const { rows, cols } = s.size;

  board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  board.style.gridTemplateRows    = `repeat(${rows}, 1fr)`;
  board.innerHTML = '';

  const pathSet  = new Set(s.path.map(p => `${p.r},${p.c}`));
  const hintSet  = new Set(s.hintCells.map(([r, c]) => `${r},${c}`));
  const lastCell = s.path.length ? s.path[s.path.length - 1] : null;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'am-cell';
      const ch = s.grid[r][c];
      const key = `${r},${c}`;

      const span = document.createElement('span');
      span.className = 'am-cell-arrow';
      span.textContent = ch || '';
      cell.appendChild(span);

      if (s.start.r === r && s.start.c === c) cell.classList.add('start-cell');
      if (s.end.r   === r && s.end.c   === c) cell.classList.add('end-cell');
      if (pathSet.has(key))                   cell.classList.add('in-path');
      if (lastCell && lastCell.r === r && lastCell.c === c) cell.classList.add('current-cell');
      if (s.end.r === r && s.end.c === c && pathSet.has(key)) cell.classList.add('reached-end');
      if (hintSet.has(key))                   cell.classList.add('hint-cell');

      cell.dataset.r = r;
      cell.dataset.c = c;
      board.appendChild(cell);
    }
  }
}

window.TOOL_REGISTRY['arrow-maze'] = {
  render: renderArrowMaze,
  bind: bindArrowMazeEvents,
  beforeUnmount: () => {
    if (_arrowMazeHintTimer) clearTimeout(_arrowMazeHintTimer);
    _arrowMazeState = null;
  }
};
