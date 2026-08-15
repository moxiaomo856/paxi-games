// ============================================================
// admin.js — 管理面板（大厅 ⚙ 按钮打开，双语）
// 仅当连接的钱包地址 === config.adminAddress 时开放规则编辑。
// 修改规则 → 生成 config.js → 替换仓库根目录同名文件 → 提交生效。
// 依赖：i18n.js（t）、paxi-sdk.js
// ============================================================
window.PaxiAdmin = {
  open() {
    document.getElementById('paxiAdminOverlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'paxiAdminOverlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(8,10,24,.85);z-index:99995;display:flex;align-items:center;justify-content:center;';
    const m = document.createElement('div');
    m.style.cssText = `background:var(--card,#181c36);color:var(--text,#e8ebfa);border:1px solid #3d4680;border-radius:16px;
      padding:24px;width:min(520px,94vw);max-height:88vh;overflow:auto;font-family:system-ui,"Microsoft YaHei",sans-serif`;
    const c = window.PAXI_CONFIG;
    const short = a => a ? a.slice(0, 12) + '…' + a.slice(-6) : '';

    m.innerHTML = `
      <h2 style="margin:0 0 6px;font-size:20px">${t('admin.title')}</h2>
      <div id="admStatus" style="font-size:12px;color:var(--text-muted,#8b93bd);margin-bottom:12px">
        ${t('admin.status', { a: '<b>' + short(c.adminAddress) + '</b>' })}
      </div>
      <button id="admVerify" class="btn" style="width:100%;margin-bottom:14px">${t('admin.verify')}</button>
      <div id="admForm" style="display:none"></div>
      <button id="admClose" class="btn sec" style="width:100%;margin-top:12px">${t('admin.close')}</button>
    `;
    ov.appendChild(m);
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    m.querySelector('#admClose').onclick = () => ov.remove();

    m.querySelector('#admVerify').onclick = async () => {
      const btn = m.querySelector('#admVerify');
      btn.disabled = true; btn.textContent = t('admin.verifying');
      try {
        // 优先复用已连接的钱包状态（大厅/游戏页 connectWallet 后 state 已写好）
        // 避免再次调用 paxihub.getAddress() 导致用户二次弹窗授权
        let walletAddr = null;
        if (state && state.connected && state.wallet && state.wallet.address) {
          walletAddr = state.wallet.address;
        } else {
          // 未连接：走标准 connectWallet 流程（会提示安装钱包、处理移动端跳转、统一错误提示）
          const ok = typeof connectWallet === 'function' ? await connectWallet() : false;
          if (!ok) throw new Error(t('pay.needWallet'));
          if (state && state.wallet && state.wallet.address) {
            walletAddr = state.wallet.address;
          } else if (typeof window.paxihub !== 'undefined') {
            // 兜底：直接从钱包拿一次地址
            const sender = await window.paxihub.paxi.getAddress();
            walletAddr = sender && sender.address;
          }
        }
        if (!walletAddr) throw new Error(t('pay.needWallet'));
        if (walletAddr !== c.adminAddress) {
          // 地址不匹配时，把当前地址显示给管理员，方便排查（调试用）
          const msg = t('admin.notAdmin') + '（当前：' + short(walletAddr) + '）';
          throw new Error(msg);
        }
        showToast(t('admin.verified', { a: short(walletAddr) }), 'success');
        btn.remove();
        m.querySelector('#admStatus').innerHTML = t('admin.verified', { a: '<b>' + short(walletAddr) + '</b>' });
        this._buildForm(m.querySelector('#admForm'));
      } catch (e) {
        showToast(e.message || String(e), 'error');
        btn.disabled = false; btn.textContent = t('admin.verify');
      }
    };
  },

  _field(label, id, type = 'text') {
    return `<div style="text-align:left;margin:8px 0">
      <label style="display:block;font-size:12px;color:var(--text-muted,#8b93bd);margin-bottom:4px">${label}</label>
      <input id="${id}" type="${type}" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;
        border:1px solid #4a5490;background:#12152c;color:#eef1ff;font-size:14px">
    </div>`;
  },

  _buildForm(container) {
    const c = window.PAXI_CONFIG;
    container.style.display = 'block';
    container.innerHTML = `
      <div style="height:1px;background:#3d4680;margin:4px 0 12px"></div>
      <div style="text-align:left;font-size:14px;font-weight:700;margin-bottom:6px">${t('admin.rules')}</div>
      <div style="text-align:left;margin:10px 0">
        <label style="font-size:14px;cursor:pointer">
          <input id="a-charge" type="checkbox" style="transform:scale(1.2)"> ${t('admin.charge')}
        </label>
      </div>
      ${this._field(t('admin.entry'), 'a-entry', 'number')}
      ${this._field(t('admin.entryRounds'), 'a-entryRounds', 'number')}
      ${this._field(t('admin.free'), 'a-free', 'number')}
      ${this._field(t('admin.single'), 'a-single', 'number')}
      ${this._field(t('admin.double'), 'a-double', 'number')}
      ${this._field(t('admin.dblN'), 'a-dblN', 'number')}
      <div style="height:1px;background:#3d4680;margin:12px 0"></div>
      <div style="text-align:left;font-size:14px;font-weight:700;margin-bottom:6px">🪙 PRC20 ${t('admin.prc20Title')}</div>
      <div style="text-align:left;margin:10px 0">
        <label style="font-size:14px;cursor:pointer">
          <input id="a-prcOn" type="checkbox" style="transform:scale(1.2)"> ${t('admin.prcOn')}
        </label>
      </div>
      ${this._field(t('admin.prcContract'), 'a-prcContract')}
      ${this._field(t('admin.prcSymbol'), 'a-prcSymbol')}
      ${this._field(t('admin.prcDecimals'), 'a-prcDecimals', 'number')}
      ${this._field(t('admin.prcEntry'), 'a-prcEntry', 'number')}
      ${this._field(t('admin.prcR1'), 'a-prcR1', 'number')}
      ${this._field(t('admin.prcR2'), 'a-prcR2', 'number')}
      ${this._field(t('admin.adminAddr'), 'a-admin')}
      <div style="text-align:left;margin:10px 0">
        <label style="display:block;font-size:12px;color:var(--text-muted,#8b93bd);margin-bottom:4px">${t('admin.payees')}</label>
        <textarea id="a-payees" rows="7" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;
          border:1px solid #4a5490;background:#12152c;color:#eef1ff;font-size:12px;font-family:monospace"></textarea>
      </div>
      <button class="btn" id="a-faucet" style="width:100%;margin-bottom:10px;background:linear-gradient(90deg,#ffd76a,#ffb347)">🎁 ${t('faucet.console')}</button>
      <button class="btn" id="a-gen" style="width:100%">${t('admin.gen')}</button>
      <div id="a-out" style="display:none">
        <div style="text-align:left;margin:12px 0;font-size:12px;color:var(--text-muted,#8b93bd);line-height:1.8">
          ${t('admin.step')}
        </div>
        <button class="btn" id="a-dl" style="width:100%">${t('admin.dl')}</button>
      </div>
    `;
    const val = (id, v) => container.querySelector('#' + id).value = v;
    val('a-entry', c.entryFee); val('a-entryRounds', c.entryRounds || 1); val('a-free', c.freeRevives);
    const p20 = c.prc20 || {};
    container.querySelector('#a-prcOn').checked = !!(p20.enabled && p20.contract);
    val('a-prcContract', p20.contract || ''); val('a-prcSymbol', p20.symbol || 'TOKEN');
    val('a-prcDecimals', (p20.decimals !== undefined && p20.decimals !== null) ? p20.decimals : 6); val('a-prcEntry', p20.entryAmount || 0);
    val('a-prcR1', p20.reviveSingleAmount || 0); val('a-prcR2', p20.reviveDoubleAmount || 0);
    val('a-single', c.reviveSingle); val('a-double', c.reviveDouble);
    val('a-dblN', c.doubleReviveCount); val('a-admin', c.adminAddress);
    container.querySelector('#a-charge').checked = c.chargeEnabled !== false;
    container.querySelector('#a-payees').value = c.payeeAddresses.join('\n');

    let generated = null;
    container.querySelector('#a-gen').onclick = () => {
      const num = id => Number(container.querySelector('#' + id).value) || 0;
      const payees = container.querySelector('#a-payees').value.split('\n').map(s => s.trim()).filter(Boolean);
      if (!payees.length) { showToast(t('admin.payeesEmpty'), 'error'); return; }
      const nc = {
        chainId: c.chainId, chainName: c.chainName || 'Paxi Chain',
        rpcEndpoint: c.rpcEndpoint, restEndpoint: c.restEndpoint,
        denom: c.denom, displayDenom: c.displayDenom, decimals: c.decimals,
        sdkUrl: c.sdkUrl,
        adminAddress: container.querySelector('#a-admin').value.trim(),
        chargeEnabled: container.querySelector('#a-charge').checked,
        entryFee: num('a-entry'), entryRounds: num('a-entryRounds') || 1, freeRevives: num('a-free'),
        reviveSingle: num('a-single'), reviveDouble: num('a-double'),
        doubleReviveCount: num('a-dblN'),
        payeeAddresses: payees,
        prc20: {
          enabled: container.querySelector('#a-prcOn').checked,
          contract: container.querySelector('#a-prcContract').value.trim(),
          symbol: container.querySelector('#a-prcSymbol').value.trim() || 'TOKEN',
          decimals: num('a-prcDecimals'),
          entryAmount: num('a-prcEntry'),
          reviveSingleAmount: num('a-prcR1'),
          reviveDoubleAmount: num('a-prcR2')
        }
      };
      generated = '// PAXI Games config (generated by admin panel)\n' +
        'window.PAXI_CONFIG = ' + JSON.stringify(nc, null, 2) + ';\n';
      container.querySelector('#a-out').style.display = '';
      showToast(t('admin.generated'), 'success');
    };
    container.querySelector('#a-faucet').onclick = () => {
      if (typeof PaxiFaucet !== 'undefined') PaxiFaucet.openConsole();
    };
    container.querySelector('#a-dl').onclick = () => {
      if (!generated) return;
      const blob = new Blob([generated], { type: 'text/javascript;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'config.js';
      a.click();
      URL.revokeObjectURL(a.href);
    };
  }
};
