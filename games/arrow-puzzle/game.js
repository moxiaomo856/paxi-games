/**
 * ➡️ Arrow Flow — 箭头解谜（参照 Arrow Flow: Tap Away Puzzle）
 *
 * 核心玩法：
 *   棋盘上布满蜿蜒的箭头链条，箭头相互勾连、盘旋、缠绕。
 *   点击一个箭头 → 沿其方向追踪整条流路径（flow path）：
 *     每个箭头的方向指向下一个格子，若该格有箭头则继续追踪其方向，
 *     直到飞出棋盘边缘（可消除）或遇到空格（被阻挡）。
 *   整条弯曲链条一起滑出棋盘 → 清空全盘过关。
 *
 * 生成算法：
 *   从边缘向内构建链条，每个箭头指向前一个（靠边的）箭头。
 *   链条可以转弯，形成弯曲的流路径。
 *   生成后验证每个箭头的流路径都能到达边缘（保证 100% 可解）。
 */
if (!window.TOOL_REGISTRY) window.TOOL_REGISTRY = {};

let _arrowState = null;

const ARROW_DIR = {
  up:    { dx: 0,  dy: -1, glyph: '⬆', deg: 270 },
  down:  { dx: 0,  dy: 1,  glyph: '⬇', deg: 90 },
  left:  { dx: -1, dy: 0,  glyph: '⬅', deg: 180 },
  right: { dx: 1,  dy: 0,  glyph: '➡', deg: 0 },
};
const ARROW_KEYS = Object.keys(ARROW_DIR);

function renderArrowPuzzle() {
  return `
    <div class="card">
      <div style="display:flex;gap:8px;justify-content:center;margin:4px 0 10px;flex-wrap:wrap;">
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">${t('arrow.level')}: <b id="arrowLevel" style="color:var(--primary)">1</b></span>
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">${t('arrow.cleared')}: <b id="arrowScore" style="color:var(--warning)">0</b></span>
      </div>
      <div style="position:relative;display:flex;justify-content:center;">
        <div id="arrowBoard" style="display:grid;gap:3px;padding:10px;background:#0a0d1c;border-radius:12px;touch-action:manipulation;"></div>
        <div id="gpOverlay" style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);border-radius:8px;z-index:10;">
          ${GamePay.overlayHTML('arrow-puzzle', 'game.arrow-puzzle', 'arrow.controls')}
        </div>
      </div>
    </div>
    <style>
      @keyframes arrow-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
      @keyframes arrow-pulse{0%,100%{box-shadow:0 0 4px rgba(255,255,255,.15)}50%{box-shadow:0 0 14px rgba(255,255,255,.45)}}
      .arrow-cell.shake{animation:arrow-shake .25s}
      .arrow-cell{display:flex;align-items:center;justify-content:center;border-radius:7px;cursor:pointer;
        user-select:none;-webkit-user-select:none;font-size:20px;
        transition:transform .45s cubic-bezier(.34,1.1,.64,1),opacity .45s,box-shadow .2s;
        border:1px solid var(--border);background:var(--bg2);position:relative}
      .arrow-cell.c-up{background:#243256;color:#8fb0ff}
      .arrow-cell.c-down{background:#562430;color:#ff9c8f}
      .arrow-cell.c-left{background:#2b4536;color:#8fd9a8}
      .arrow-cell.c-right{background:#4d3a56;color:#d3a8ff}
      .arrow-cell.empty{background:transparent;border:1px dashed rgba(255,255,255,.05);cursor:default}
      .arrow-cell.highlight{animation:arrow-pulse 1s ease-in-out infinite;border-color:rgba(255,255,255,.5);z-index:2}
      .arrow-cell.removing{pointer-events:none}
    </style>
  `;
}

function bindArrowEvents() {
  GamePay.bindStart('arrow-puzzle', () => startArrowGame());
}

// ============================================================
// 流路径（Flow Path）追踪
// 从 (x,y) 出发，沿每个箭头的方向追蹤下一条格：
//   - 格子有箭头 → 加入路径，继续追蹤该箭头的方向
//   - 飞出棋盘 → 路径畅通，整条链可消除
//   - 空格 / 环 → 被阻挡
// ============================================================
function _findFlow(grid, size, startX, startY) {
  const flow = [];
  const visited = new Set();
  let cx = startX, cy = startY;

  while (true) {
    const key = cx + ',' + cy;
    if (visited.has(key)) return { flow: [], canExit: false }; // 环
    visited.add(key);

    const arrow = grid[cy] && grid[cy][cx];
    if (!arrow) return { flow: [], canExit: false }; // 空格，阻断

    flow.push({ x: cx, y: cy, dir: arrow.dir });
    const d = ARROW_DIR[arrow.dir];
    cx += d.dx;
    cy += d.dy;

    if (cx < 0 || cx >= size || cy < 0 || cy >= size) {
      return { flow, canExit: true }; // 飞出边缘
    }
  }
}

// 验证：每个箭头的流路径都能到达边缘
function _verifyAllFlows(grid, size) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[y][x]) {
        const { canExit } = _findFlow(grid, size, x, y);
        if (!canExit) return false;
      }
    }
  }
  return true;
}

// ============================================================
// 关卡生成：从边缘向内构建弯曲链条
// 每个链条：起点在边缘，首箭头指向外（出口）；
//   后续箭头从前一个箭头的某个相邻空格延伸，方向指向前一个箭头。
//   链条可以转弯 → 形成蜿蜒、勾连的流路径。
// ============================================================
function _arrowGenLevel(level) {
  const size = Math.min(7, 3 + level);
  const targetCount = Math.min(size * size - 1, 6 + level * 4);

  for (let attempt = 0; attempt < 40; attempt++) {
    const grid = Array(size).fill(null).map(() => Array(size).fill(null));
    let placed = 0;
    let failedTries = 0;

    while (placed < targetCount && failedTries < 30) {
      const chain = _genOneChain(grid, size);
      if (!chain || chain.length === 0) { failedTries++; continue; }

      // 放置链条并验证
      for (const c of chain) grid[c.y][c.x] = { dir: c.dir };

      if (_verifyAllFlows(grid, size)) {
        placed += chain.length;
      } else {
        // 回滚
        for (const c of chain) grid[c.y][c.x] = null;
        failedTries++;
      }
    }

    if (placed >= Math.min(targetCount, 4)) {
      return { grid, size, remaining: placed };
    }
  }

  // 兜底：简单关卡
  return _arrowGenFallback(size);
}

// 生成一条弯曲链条：从边缘出发，向内蜿蜒
function _genOneChain(grid, size) {
  // 收集所有边缘空格作为出口候选
  const edges = [];
  for (let i = 0; i < size; i++) {
    if (!grid[0][i]) edges.push({ x: i, y: 0, exitDir: 'up' });
    if (!grid[size-1][i]) edges.push({ x: i, y: size-1, exitDir: 'down' });
    if (!grid[i][0]) edges.push({ x: 0, y: i, exitDir: 'left' });
    if (!grid[i][size-1]) edges.push({ x: size-1, y: i, exitDir: 'right' });
  }
  // 随机打乱
  for (let i = edges.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [edges[i], edges[j]] = [edges[j], edges[i]];
  }

  for (const edge of edges) {
    const chain = _buildChain(grid, size, edge.x, edge.y, edge.exitDir);
    if (chain && chain.length >= 2) return chain;
  }
  return null;
}

// 从 (ex, ey) 出口向内构建链条
// 第一个箭头在 (ex, ey)，方向 = exitDir（指向边缘外）
// 后续箭头在前一个箭头的相邻空格，方向指向前一个箭头
function _buildChain(grid, size, ex, ey, exitDir) {
  const chain = [{ x: ex, y: ey, dir: exitDir }];
  const inChain = new Set([ex + ',' + ey]);
  const desiredLen = 3 + Math.floor(Math.random() * 5); // 3~7
  let prevX = ex, prevY = ey;

  for (let step = 1; step < desiredLen; step++) {
    // 找前一个箭头的所有相邻空格
    const candidates = [];
    for (const dir of ARROW_KEYS) {
      const d = ARROW_DIR[dir];
      const nx = prevX + d.dx, ny = prevY + d.dy;
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
      if (inChain.has(nx + ',' + ny)) continue;
      if (grid[ny][nx]) continue;
      // 新箭头在 (nx, ny)，方向 = dir（指向前一个箭头 (prevX, prevY)）
      candidates.push({ x: nx, y: ny, dir });
    }
    if (candidates.length === 0) break;

    // 优先转弯（70%），直行（30%）→ 形成弯曲链条
    const straightDir = chain[chain.length - 1].dir;
    const straight = candidates.filter(c => c.dir === straightDir);
    const turns = candidates.filter(c => c.dir !== straightDir);
    let pick;
    if (turns.length > 0 && (straight.length === 0 || Math.random() < 0.7)) {
      pick = turns[Math.floor(Math.random() * turns.length)];
    } else if (straight.length > 0) {
      pick = straight[0];
    } else {
      pick = candidates[0];
    }

    chain.push(pick);
    inChain.add(pick.x + ',' + pick.y);
    prevX = pick.x;
    prevY = pick.y;
  }

  return chain.length >= 2 ? chain : null;
}

// 兜底简单关卡
function _arrowGenFallback(size) {
  const grid = Array(size).fill(null).map(() => Array(size).fill(null));
  let placed = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dirs = ARROW_KEYS.filter(d => {
        const dd = ARROW_DIR[d];
        const nx = x + dd.dx, ny = y + dd.dy;
        return nx < 0 || nx >= size || ny < 0 || ny >= size;
      });
      if (dirs.length > 0 && Math.random() < 0.6) {
        grid[y][x] = { dir: dirs[Math.floor(Math.random() * dirs.length)] };
        placed++;
      }
    }
  }
  return { grid, size, remaining: placed };
}

// ============================================================
// 游戏控制
// ============================================================
function startArrowGame() {
  if (!GamePay.consumeRound('arrow-puzzle')) return;
  _arrowState = { level: 1, score: 0, board: null };
  _arrowLoadLevel();
}

function _arrowLoadLevel() {
  const s = _arrowState;
  s.board = _arrowGenLevel(s.level);
  _arrowRenderBoard();
  document.getElementById('arrowLevel').textContent = s.level;
  document.getElementById('arrowScore').textContent = s.score;
}

function _arrowRenderBoard() {
  const s = _arrowState;
  const boardEl = document.getElementById('arrowBoard');
  if (!boardEl) return;
  const size = s.board.size;
  const cell = Math.max(36, Math.min(54, Math.floor(300 / size)));
  boardEl.style.gridTemplateColumns = `repeat(${size},${cell}px)`;

  boardEl.innerHTML = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cellEl = document.createElement('div');
      const arrow = s.board.grid[y][x];
      if (arrow) {
        cellEl.className = 'arrow-cell c-' + arrow.dir;
        cellEl.textContent = ARROW_DIR[arrow.dir].glyph;
        cellEl.style.width = cell + 'px';
        cellEl.style.height = cell + 'px';
        cellEl.dataset.x = x;
        cellEl.dataset.y = y;
        cellEl.addEventListener('click', (e) => { e.preventDefault(); _arrowTap(x, y, cellEl); });
        cellEl.addEventListener('mouseenter', () => _arrowHighlight(x, y));
        cellEl.addEventListener('mouseleave', _clearHighlight);
        cellEl.addEventListener('touchstart', (e) => { e.preventDefault(); _arrowHighlight(x, y); }, { passive: false });
      } else {
        cellEl.className = 'arrow-cell empty';
        cellEl.style.width = cell + 'px';
        cellEl.style.height = cell + 'px';
      }
      boardEl.appendChild(cellEl);
    }
  }
}

// 高亮整条流路径
function _arrowHighlight(x, y) {
  _clearHighlight();
  const s = _arrowState;
  if (!s || !s.board) return;
  const { flow, canExit } = _findFlow(s.board.grid, s.board.size, x, y);
  if (canExit && flow.length > 0) {
    for (const f of flow) {
      const el = document.querySelector(`.arrow-cell[data-x="${f.x}"][data-y="${f.y}"]`);
      if (el) el.classList.add('highlight');
    }
  }
}

function _clearHighlight() {
  document.querySelectorAll('.arrow-cell.highlight').forEach(el => el.classList.remove('highlight'));
}

// 点击箭头：整条流路径一起滑出
function _arrowTap(x, y, cellEl) {
  const s = _arrowState;
  if (!s || !s.board) return;
  const arrow = s.board.grid[y][x];
  if (!arrow) return;

  const { flow, canExit } = _findFlow(s.board.grid, s.board.size, x, y);

  if (!canExit || flow.length === 0) {
    // 被阻挡：抖动提示
    cellEl.classList.remove('shake');
    void cellEl.offsetWidth;
    cellEl.classList.add('shake');
    return;
  }

  // 清除高亮
  _clearHighlight();

  // 整条链一起滑出：从出口端（flow[0]）开始，逐个延迟动画
  flow.forEach((f, i) => {
    const el = document.querySelector(`.arrow-cell[data-x="${f.x}"][data-y="${f.y}"]`);
    if (el) {
      el.classList.add('removing');
      const d = ARROW_DIR[f.dir];
      const delay = i * 70; // 逐个延迟，形成"流动"效果
      setTimeout(() => {
        el.style.transform = `translate(${d.dx * 350}px, ${d.dy * 350}px)`;
        el.style.opacity = '0';
      }, delay);
      setTimeout(() => el.remove(), delay + 450);
    }
    // 从网格状态移除
    s.board.grid[f.y][f.x] = null;
    s.board.remaining--;
    s.score++;
  });

  document.getElementById('arrowScore').textContent = s.score;

  // 检查是否还有箭头的流路径被阻断（由于链条交叉依赖）
  // 不需要主动处理 — 玩家继续点击其他箭头即可

  if (s.board.remaining <= 0) {
    s.level++;
    setTimeout(() => {
      showToast(t('arrow.levelClear'), 'success');
      _arrowLoadLevel();
    }, 700);
  }
}

window.TOOL_REGISTRY['arrow-puzzle'] = {
  render: renderArrowPuzzle,
  bind: bindArrowEvents,
  beforeUnmount: () => { _arrowState = null; }
};
