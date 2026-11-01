
(() => {
  if (window.__FOREVER_HUD__) return;
  window.__FOREVER_HUD__ = true;
  let pos = {x:75, y:10, collapsed:false};
  let isDragging = false, dragOffset = {x:0,y:0};
  let moveMode = false;

  chrome.storage.local.get(['hudPos'], r => { if (r.hudPos) pos = r.hudPos; createHUD(); });
  chrome.storage.onChanged.addListener((c) => { if (c.hudPos) pos = c.hudPos.newValue; updatePos(); });

  function createHUD() {
    if (document.getElementById('forever-hud-root')) return;
    const host = document.createElement('div');
    host.id = 'forever-hud-root';
    host.style.all = 'initial';
    host.style.position = 'fixed';
    host.style.zIndex = '2147483647';
    host.style.left = pos.x + '%';
    host.style.top = pos.y + '%';
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({mode:'open'});
    const style = document.createElement('style');
    style.textContent = `
      #hud { font-family: monospace; background: #0f0f0fE6; color: #0f0; border: 1px solid #0f0; border-radius: 8px; min-width: 260px; max-width: 380px; max-height: 70vh; overflow: hidden; display: flex; flex-direction: column; }
      #header { padding: 6px 8px; background: #1a1a1a; cursor: grab; display:flex; justify-content:space-between; align-items:center; user-select:none; }
      #header:active { cursor: grabbing; }
      #body { padding: 8px; overflow-y: auto; font-size: 11px; }
      .row { display:flex; justify-content:space-between; padding:2px 0; border-bottom:1px dashed #222; }
      button { background:#222; color:#0f0; border:1px solid #0f0; border-radius:4px; padding:2px 6px; cursor:pointer; margin-left:4px; }
      #list { max-height: 200px; overflow-y:auto; }
      .collapsed #body { display:none; }
      .move-mode { outline: 2px dashed #ff0 !important; }
    `;
    const hud = document.createElement('div');
    hud.id = 'hud';
    hud.innerHTML = `
      <div id="header"><span>⚡ FOREVER <small id="count">0 domains</small></span><span><button id="collapse">_</button><button id="close">X</button></span></div>
      <div id="body">
        <div class="row"><span>Total</span><span id="total">0</span></div>
        <div class="row"><span>Today</span><span id="today">0</span></div>
        <div id="list"></div>
        <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">
          <button id="export">Export Clean</button>
          <button id="dashboard">Dashboard</button>
          <button id="clear">Clear</button>
        </div>
        <div style="margin-top:4px;color:#888">Alt+Shift+F toggle | Alt+Shift+C collapse | Alt+Shift+M move | drag header</div>
      </div>
    `;
    shadow.appendChild(style);
    shadow.appendChild(hud);

    const header = shadow.getElementById('header');
    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      const rect = host.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
    });
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const xPct = ((e.clientX - dragOffset.x) / window.innerWidth) * 100;
      const yPct = ((e.clientY - dragOffset.y) / window.innerHeight) * 100;
      pos.x = Math.max(0, Math.min(95, xPct));
      pos.y = Math.max(0, Math.min(90, yPct));
      updatePos();
    });
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        chrome.storage.local.set({hudPos: pos});
      }
    });

    shadow.getElementById('collapse').onclick = () => {
      pos.collapsed = !pos.collapsed;
      hud.classList.toggle('collapsed', pos.collapsed);
      chrome.storage.local.set({hudPos: pos});
    };
    shadow.getElementById('close').onclick = () => host.remove();
    shadow.getElementById('export').onclick = () => {
      chrome.runtime.sendMessage({type:'export-clean'}, (r) => {
        const blob = new Blob([JSON.stringify(r, null, 2)], {type:'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `forever-clean-domains-${new Date().toISOString().slice(0,10)}.json`; a.click();
      });
    };
    shadow.getElementById('dashboard').onclick = () => {
      window.open(chrome.runtime.getURL('dashboard/dashboard.html'), '_blank');
    };
    shadow.getElementById('clear').onclick = () => {
      if (confirm('Clear all domains?')) chrome.runtime.sendMessage({type:'clear-all'});
    };

    if (pos.collapsed) hud.classList.add('collapsed');
    updatePos();
    refreshStats();

    chrome.runtime.onMessage.addListener((m) => {
      if (m.type === 'domains-updated') refreshStats();
    });

    function updatePos() {
      host.style.left = pos.x + '%';
      host.style.top = pos.y + '%';
    }
    async function refreshStats() {
      chrome.runtime.sendMessage({type:'get-stats'}, (data) => {
        if (!data) return;
        const domains = data.domains || {};
        const count = Object.keys(domains).length;
        shadow.getElementById('count').textContent = `${count} domains`;
        shadow.getElementById('total').textContent = count;
        const today = new Date().toISOString().slice(0,10);
        shadow.getElementById('today').textContent = data.dailyRollup?.[today] || 0;
        const list = shadow.getElementById('list');
        const sorted = Object.entries(domains).sort((a,b)=>b[1].lastSeen - a[1].lastSeen).slice(0,25);
        list.innerHTML = sorted.map(([h,v])=>`<div class="row"><span>${h}</span><span>${v.count}</span></div>`).join('');
      });
    }
    // keyboard move mode
    document.addEventListener('keydown', (e) => {
      if (!moveMode) return;
      const step = e.shiftKey ? 5 : 1;
      if (e.key === 'ArrowLeft') pos.x = Math.max(0, pos.x - step);
      if (e.key === 'ArrowRight') pos.x = Math.min(95, pos.x + step);
      if (e.key === 'ArrowUp') pos.y = Math.max(0, pos.y - step);
      if (e.key === 'ArrowDown') pos.y = Math.min(90, pos.y + step);
      updatePos();
      if (e.key === 'Enter') {
        moveMode = false; hud.classList.remove('move-mode'); chrome.storage.local.set({hudPos: pos});
      }
    });
    window.__FOREVER_MOVE__ = () => { moveMode = !moveMode; hud.classList.toggle('move-mode', moveMode); };
  }
  // commands from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'toggle-hud') {
      const el = document.getElementById('forever-hud-root');
      if (el) el.remove(); else { pos = {x:75,y:10,collapsed:false}; createHUD(); }
    }
    if (msg.type === 'toggle-collapse') {
      pos.collapsed = !pos.collapsed;
      document.getElementById('forever-hud-root')?.shadowRoot?.getElementById('hud')?.classList.toggle('collapsed', pos.collapsed);
    }
    if (msg.type === 'move-hud') {
      window.__FOREVER_MOVE__?.();
    }
  });
})();
