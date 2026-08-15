/**
 * ➡️ Arrow Puzzle — 箭头解谜（参照 Arrow Flow: Tap Away Puzzle）
 * 棋盘上布满四向箭头；点击一个箭头，若它朝向的一路到棋盘边缘没有
 * 其他箭头阻挡，它就飞出棋盘被消除；被挡住则抖动提示。
 * 生成算法保证每一关都 100% 可解（按放置的逆序消除即为解）。
 * 清空全盘 → 过关，自动进入下一关（更大棋盘、更多箭头）。
 */
if (!window.TOOL_REGISTRY) window.TOOL_REGISTRY = {};

let _arrowState = null;

const ARROW_DIR = {
  up:    { dx: 0,  dy: -1, glyph: '⬆' },
  down:  { dx: 0,  dy: 1,  glyph: '⬇' },
  left:  { dx: -1, dy: 0,  glyph: '⬅' },
  right: { dx: 1,  dy: 0,  glyph: '➡' },
};
const ARROW_KEYS = Object.keys(ARROW_DIR);

function renderArrowPuzzle() {
  return `
    <div class="card">
      <div class="card-title">➡️ ${t('game.arrow-puzzle')}</div>
      <div style="text-align:center;margin-bottom:10px;">
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">${t('arrow.desc')}</div>
        <div style="display:flex;gap:8px;justify-content:center;margin-bottom:8px;flex-wrap:wrap;">
          <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">${t('arrow.level')}: <b id="arrowLevel" style="color:var(--primary)">1</b></span>
          <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">${t('arrow.cleared')}: <b id="arrowScore" style="color:var(--warning)">0</b></span>
        </div>
      </div>
      <div style="position:relative;display:flex;justify-content:center;">
        <div id="arrowBoard" style="display:grid;gap:6px;padding:10px;background:#0a0d1c;border-radius:12px;touch-action:manipulation;"></div>
        <div id="gpOverlay" style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);border-radius:8px;z-index:10;">
          ${GamePay.overlayHTML('arrow-puzzle', 'game.arrow-puzzle', 'arrow.desc')}
        </div>
      </div>
      <div style="text-align:center;margin-top:12px;font-size:11px;color:var(--text-muted);">${t('arrow.controls')}</div>
    </div>
    <style>
      @keyframes arrow-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
      .arrow-cell.shake{animation:arrow-shake .25s}
      .arrow-cell{display:flex;align-items:center;justify-content:center;border-radius:8px;cursor:pointer;
        user-select:none;-webkit-user-select:none;font-size:24px;transition:transform .3s,opacity .3s;
        border:1px solid var(--border);background:var(--bg2)}
      .arrow-cell.c-up{background:#243256;color:#8fb0ff}
      .arrow-cell.c-down{background:#562430;color:#ff9c8f}
      .arrow-cell.c-left{background:#2b4536;color:#8fd9a8}
      .arrow-cell.c-right{background:#4d3a56;color:#d3a8ff}
      .arrow-cell.empty{background:transparent;border:1px dashed rgba(255,255,255,.06);cursor:default}
    </style>
  `;
}

function bindArrowEvents() {
  GamePay.bindStart('arrow-puzzle', () => startArrowGame());
}

// ---------- 关卡生成：每次放置的箭头当时出路畅通 → 逆序消除必为解 ----------
function _arrowGenLevel(level) {
  const size = Math.min(7, 3 + level);                       // 第1关 4x4，最多 7x7
  const count = Math.min(size * size, 5 + level * 3);        // 箭头数量
  const grid = Array(size).fill(null).map(() => Array(size).fill(null));

  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 200) {
    attempts++;
    const y = Math.floor(Math.random() * size);
    const x = Math.floor(Math.random() * size);
    if (grid[y][x]) continue;
    const dir = ARROW_KEYS[Math.floor(Math.random() * 4)];
    if (_arrowPathClear(grid, x, y, dir, size)) {
      grid[y][x] = { dir };
      placed++;
    }
  }
  return { grid, size, remaining: placed };
}

// 从 (x,y) 沿 dir 到棋盘边缘是否一路为空
function _arrowPathClear(grid, x, y, dir, size) {
  const d = ARROW_DIR[dir];
  let cx = x + d.dx, cy = y + d.dy;
  while (cx >= 0 && cx < size && cy >= 0 && cy < size) {
    if (grid[cy][cx]) return false;
    cx += d.dx; cy += d.dy;
  }
  return true;
}

function startArrowGame() {
  if (!GamePay.consumeRound('arrow-puzzle')) return;

  _arrowState = {
    level: 1,
    score: 0,
    board: null,
  };
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
  const cell = Math.max(38, Math.min(56, Math.floor(300 / size)));  // 手机适配格子尺寸
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
        const tap = (e) => { e.preventDefault(); _arrowTap(x, y, cellEl); };
        cellEl.addEventListener('click', tap);
      } else {
        cellEl.className = 'arrow-cell empty';
        cellEl.style.width = cell + 'px';
        cellEl.style.height = cell + 'px';
      }
      boardEl.appendChild(cellEl);
    }
  }
}

function _arrowTap(x, y, cellEl) {
  const s = _arrowState;
  if (!s || !s.board) return;
  const arrow = s.board.grid[y][x];
  if (!arrow) return;

  if (!_arrowPathClear(s.board.grid, x, y, arrow.dir, s.board.size)) {
    // 被挡住：抖动提示
    cellEl.classList.remove('shake');
    void cellEl.offsetWidth;
    cellEl.classList.add('shake');
    return;
  }

  // 畅通：先从状态移除（后续点击立刻生效），再播放飞出动画
  s.board.grid[y][x] = null;
  s.board.remaining--;
  s.score++;
  document.getElementById('arrowScore').textContent = s.score;

  const d = ARROW_DIR[arrow.dir];
  cellEl.style.pointerEvents = 'none';
  cellEl.style.transform = `translate(${d.dx * 400}px, ${d.dy * 400}px)`;
  cellEl.style.opacity = '0';
  setTimeout(() => cellEl.remove(), 350);

  if (s.board.remaining <= 0) {
    // 本关完成 → 稍等动画后进入下一关（同一付费局内免费续关）
    s.level++;
    setTimeout(() => {
      showToast(t('arrow.levelClear'), 'success');
      _arrowLoadLevel();
    }, 400);
  }
}

window.TOOL_REGISTRY['arrow-puzzle'] = {
  render: renderArrowPuzzle,
  bind: bindArrowEvents,
  beforeUnmount: () => { _arrowState = null; }
};
