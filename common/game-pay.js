// ============================================================
// game-pay.js — 游戏付费模块（双币：PAXI + PRC20，全双语）
// 规则（config.js 可由管理员修改）：
//   入场：entryFee(5 PAXI) + prc20.entryAmount(100,000 代币) → entryRounds(2) 局
//   复活：免费 freeRevives(2) 次（累计）；
//         reviveSingle(3 PAXI)+5万代币 复活1次；
//         reviveDouble(5 PAXI)+10万代币 复活 doubleReviveCount(2) 次
//   收款：payeeAddresses 随机选一（PAXI 与代币同笔交易同一地址）
//   prc20.enabled=false 时自动退化为纯 PAXI 计费
// 依赖：i18n.js（t）、paxi-sdk.js（payPaxi / connectWallet / state）
// ============================================================
window.GamePay = {
  _reviveFns: {},
  _paying: false,

  cfg() { return window.PAXI_CONFIG; },
  enabled() { return this.cfg().chargeEnabled !== false; },
  prcOn() { const p = this.cfg().prc20; return p && p.enabled && p.contract; },

  registerRevive(gameId, fn) { this._reviveFns[gameId] = fn; },

  // ---------- 费用字符串 ----------
  costStr(paxi, tokens) {
    const c = this.cfg();
    let s = paxi + ' ' + (c.displayDenom || 'PAXI');
    if (tokens > 0 && this.prcOn()) {
      s += ' + ' + Number(tokens).toLocaleString() + ' ' + c.prc20.symbol;
    }
    return s;
  },
  entryCostStr() {
    const c = this.cfg();
    return this.costStr(c.entryFee, this.prcOn() ? c.prc20.entryAmount : 0);
  },
  reviveSingleCostStr() {
    const c = this.cfg();
    return this.costStr(c.reviveSingle, this.prcOn() ? c.prc20.reviveSingleAmount : 0);
  },
  reviveDoubleCostStr() {
    const c = this.cfg();
    return this.costStr(c.reviveDouble, this.prcOn() ? c.prc20.reviveDoubleAmount : 0);
  },

  // ---------- 玩家状态（按钱包地址隔离） ----------
  _sk(suffix) {
    const addr = (typeof state !== 'undefined' && state.wallet) ? state.wallet.address : 'guest';
    return 'paxig_' + suffix + '_' + addr;
  },
  getFreeRevives() {
    const v = localStorage.getItem(this._sk('free'));
    return v === null ? Number(this.cfg().freeRevives || 0) : parseInt(v, 10);
  },
  setFreeRevives(n) { localStorage.setItem(this._sk('free'), String(n)); },
  getCredits() { return parseInt(localStorage.getItem(this._sk('cred')) || '0', 10); },
  addCredits(n) { this.setCredits(this.getCredits() + n); },
  setCredits(n) { localStorage.setItem(this._sk('cred'), String(n)); },

  // ---------- 入场局数（sessionStorage，关页面失效） ----------
  getRounds(gameId) { return parseInt(sessionStorage.getItem('paxig_rounds_' + gameId) || '0', 10); },
  setRounds(gameId, n) { sessionStorage.setItem('paxig_rounds_' + gameId, String(n)); },
  clearRounds(gameId) { sessionStorage.removeItem('paxig_rounds_' + gameId); },

  // ---------- UI ----------
  _rulesHTML() {
    // 每个游戏提示只在上面提一次（大厅），这里只显示玩家状态
    const c = this.cfg();
    return `<div style="font-size:12px;color:var(--text-muted);line-height:1.7;margin-bottom:10px;text-align:center;">
      💚 ${t('pay.freeLeft')}：<b style="color:var(--success)">${this.getFreeRevives()}</b>　🎟 ${t('pay.credits')}：<b style="color:var(--warning)">${this.getCredits()}</b>
    </div>`;
  },

  roundsBadge(gameId) {
    if (!this.enabled()) return '';
    return `<span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">💚<b id="gpFree" style="color:var(--success)">${this.getFreeRevives()}</b> / 🎟<b id="gpCred" style="color:var(--warning)">${this.getCredits()}</b></span>`;
  },

  overlayHTML(gameId, titleKey, descKey) {
    const c = this.cfg();
    if (!this.enabled()) {
      return `
        <div id="gpOverlayTitle" style="font-size:24px;font-weight:800;color:#fff;margin-bottom:12px;">${t(titleKey)}</div>
        <div id="gpOverlaySub" style="font-size:13px;color:var(--text-muted);margin-bottom:20px;text-align:center;">${t(descKey)}</div>
        <button id="gpStartBtn" class="btn" style="min-width:140px;">${t('pay.freeStart')}</button>`;
    }
    const rounds = this.getRounds(gameId);
    if (rounds > 0) {
      // 还有已付局数：直接开始
      return `
        <div id="gpOverlayTitle" style="font-size:24px;font-weight:800;color:#fff;margin-bottom:12px;">${t(titleKey)}</div>
        <div id="gpOverlaySub" style="font-size:13px;color:var(--text-muted);margin-bottom:16px;text-align:center;">${t('pay.roundsLeft', { n: rounds })}</div>
        <button id="gpStartBtn" class="btn" style="min-width:180px;">▶ ${t('pay.startBtn')}</button>`;
    }
    return `
      <div id="gpOverlayTitle" style="font-size:22px;font-weight:800;color:#fff;margin-bottom:8px;">${t(titleKey)}</div>
      <div id="gpOverlaySub" style="font-size:13px;color:var(--text-muted);margin-bottom:14px;text-align:center;">${t(descKey)}</div>
      ${this._rulesHTML()}
      <button id="gpStartBtn" class="btn" style="min-width:220px;">${t('pay.payStart', { a: this.entryCostStr(), r: c.entryRounds })}</button>`;
  },

  bindStart(gameId, startFn) {
    setTimeout(() => {
      const btn = document.getElementById('gpStartBtn');
      if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); this.onStart(gameId, startFn); });
      const overlay = document.getElementById('gpOverlay');
      if (overlay) overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.id === 'gpOverlayTitle' || e.target.id === 'gpOverlaySub') {
          this.onStart(gameId, startFn);
        }
      });
    }, 100);
  },

  async onStart(gameId, startFn) {
    if (!this.enabled()) { startFn(); return; }
    if (this.getRounds(gameId) > 0) { startFn(); return; }
    if (typeof state === 'undefined' || !state.connected) {
      const ok = await connectWallet();
      if (!ok) return;
    }
    await this._payAndStart(gameId, startFn);
  },

  async _payAndStart(gameId, startFn) {
    if (this._paying) return;
    this._paying = true;
    const c = this.cfg();
    const btn = document.getElementById('gpStartBtn');
    const title = document.getElementById('gpOverlayTitle');
    const sub = document.getElementById('gpOverlaySub');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> ' + t('pay.waitPay'); }

    try {
      const tok = this.prcOn() ? c.prc20.entryAmount : 0;
      const r = await payPaxi(c.entryFee, 'PAXI Game entry x' + c.entryRounds + ': ' + gameId, tok);
      this.setRounds(gameId, c.entryRounds);
      showToast(t('pay.payOk', { h: r.txhash.slice(0, 10) }), 'success');
      refreshBalance();
      startFn();
    } catch (e) {
      showToast(t('pay.payFail', { m: e.message || e }), 'error');
      if (btn) { btn.disabled = false; btn.textContent = t('pay.payStart', { a: this.entryCostStr(), r: c.entryRounds }); }
      if (title) title.textContent = t('pay.payIncomplete');
      if (sub) sub.textContent = t('pay.repay');
    } finally {
      this._paying = false;
    }
  },

  // 游戏开局时调用：扣减一个已付局数
  consumeRound(gameId) {
    const overlay = document.getElementById('gpOverlay');
    if (overlay) overlay.style.display = 'none';
    if (this.enabled()) {
      const left = Math.max(0, this.getRounds(gameId) - 1);
      this.setRounds(gameId, left);
    }
    return true;
  },

  // ---------- 死亡 / 结束 ----------
  showGameOver(gameId, scoreHTML, opts) {
    const win = opts && opts.win;
    const c = this.cfg();
    const overlay = document.getElementById('gpOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';

    const mkBtn = (cls, html) => {
      const b = document.createElement('button');
      b.className = 'btn ' + cls;
      b.style.cssText = 'min-width:230px;margin:6px 0;display:block;margin-left:auto;margin-right:auto;';
      b.innerHTML = html;
      return b;
    };

    overlay.innerHTML = '';

    const title = document.createElement('div');
    title.id = 'gpOverlayTitle';
    title.style.cssText = 'font-size:22px;font-weight:800;color:#fff;margin-bottom:10px;';
    title.textContent = win ? t('pay.win') : t('pay.gameOver');
    overlay.appendChild(title);

    const sub = document.createElement('div');
    sub.id = 'gpOverlaySub';
    sub.style.cssText = 'font-size:15px;color:var(--text);margin-bottom:12px;';
    sub.innerHTML = scoreHTML;
    overlay.appendChild(sub);

    const reviveFn = this._reviveFns[gameId];

    if (!this.enabled()) {
      if (!win && reviveFn) {
        const b = mkBtn('', t('pay.debugRevive'));
        b.onclick = () => { overlay.style.display = 'none'; reviveFn(); };
        overlay.appendChild(b);
      }
      const r = mkBtn('sec', t('pay.freeAgain'));
      r.onclick = () => { overlay.style.display = 'none'; this._restart(gameId); };
      overlay.appendChild(r);
      return;
    }

    const roundsLeft = this.getRounds(gameId);

    if (!win && reviveFn) {
      const st = document.createElement('div');
      st.style.cssText = 'font-size:12px;color:var(--text-muted);margin-bottom:10px;';
      st.innerHTML = `💚 ${t('pay.freeLeft')} <b style="color:var(--success)">${this.getFreeRevives()}</b>　🎟 ${t('pay.credits')} <b style="color:var(--warning)">${this.getCredits()}</b>`;
      overlay.appendChild(st);

      if (this.getCredits() > 0) {
        const b = mkBtn('', t('pay.useCredit', { n: this.getCredits() }));
        b.onclick = () => {
          this.setCredits(this.getCredits() - 1);
          this._afterReviveUI();
          overlay.style.display = 'none';
          reviveFn();
        };
        overlay.appendChild(b);
      }
      if (this.getFreeRevives() > 0) {
        const b = mkBtn('', t('pay.freeRevive', { n: this.getFreeRevives() }));
        b.onclick = () => {
          this.setFreeRevives(this.getFreeRevives() - 1);
          this._afterReviveUI();
          overlay.style.display = 'none';
          reviveFn();
        };
        overlay.appendChild(b);
      }
      // 双币复活 x1
      const b1 = mkBtn('', t('pay.revive1', { a: this.reviveSingleCostStr() }));
      b1.onclick = async () => {
        b1.disabled = true; b1.innerHTML = '<span class="spinner"></span> ' + t('pay.waitPay');
        try {
          const tok = this.prcOn() ? c.prc20.reviveSingleAmount : 0;
          const r = await payPaxi(c.reviveSingle, 'PAXI Game revive x1: ' + gameId, tok);
          showToast(t('pay.reviveOk', { h: r.txhash.slice(0, 10) }), 'success');
          refreshBalance();
          overlay.style.display = 'none';
          reviveFn();
        } catch (e) {
          showToast(t('pay.payFail', { m: e.message || e }), 'error');
          b1.disabled = false; b1.textContent = t('pay.revive1', { a: this.reviveSingleCostStr() });
        }
      };
      overlay.appendChild(b1);
      // 双币复活 x2（优惠）
      const b2 = mkBtn('', t('pay.revive2', { a: this.reviveDoubleCostStr(), n: c.doubleReviveCount }));
      b2.onclick = async () => {
        b2.disabled = true; b2.innerHTML = '<span class="spinner"></span> ' + t('pay.waitPay');
        try {
          const tok = this.prcOn() ? c.prc20.reviveDoubleAmount : 0;
          const r = await payPaxi(c.reviveDouble, 'PAXI Game revive x' + c.doubleReviveCount + ': ' + gameId, tok);
          this.addCredits(c.doubleReviveCount - 1);
          showToast(t('pay.reviveOk2', { n: c.doubleReviveCount - 1 }), 'success');
          this._afterReviveUI();
          refreshBalance();
          overlay.style.display = 'none';
          reviveFn();
        } catch (e) {
          showToast(t('pay.payFail', { m: e.message || e }), 'error');
          b2.disabled = false; b2.textContent = t('pay.revive2', { a: this.reviveDoubleCostStr(), n: c.doubleReviveCount });
        }
      };
      overlay.appendChild(b2);
    }

    // 再来一局 / 结束
    const q = mkBtn('sec', roundsLeft > 0 ? t('pay.againLeft', { n: roundsLeft }) : (win ? t('pay.again', { a: this.entryCostStr() }) : t('pay.quit')));
    q.onclick = () => {
      overlay.style.display = 'none';
      this._restart(gameId);
    };
    overlay.appendChild(q);
  },

  _afterReviveUI() {
    const f = document.getElementById('gpFree'); if (f) f.textContent = this.getFreeRevives();
    const cEl = document.getElementById('gpCred'); if (cEl) cEl.textContent = this.getCredits();
  },

  _restart(gameId) {
    const overlay = document.getElementById('gpOverlay');
    const reg = window.TOOL_REGISTRY && window.TOOL_REGISTRY[gameId];
    if (!overlay || !reg) return;
    if (reg.beforeUnmount) reg.beforeUnmount();
    const root = document.getElementById('gameRoot');
    root.innerHTML = reg.render();
    if (reg.bind) reg.bind();
  },
};
