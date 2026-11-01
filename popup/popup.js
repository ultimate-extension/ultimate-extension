
chrome.runtime.sendMessage({type:'get-stats'}, data => {
  if (!data) return;
  document.getElementById('total').textContent = Object.keys(data.domains||{}).length;
  const today = new Date().toISOString().slice(0,10);
  document.getElementById('today').textContent = data.dailyRollup?.[today] || 0;
  document.getElementById('top').textContent = (data.topSites||[])[0] || '-';
});
document.getElementById('export').onclick = () => {
  chrome.runtime.sendMessage({type:'export-clean'}, r => {
    const blob = new Blob([JSON.stringify(r, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`forever-clean-${new Date().toISOString().slice(0,10)}.json`; a.click();
  });
};
document.getElementById('dashboard').onclick = () => chrome.tabs.create({url: chrome.runtime.getURL('dashboard/dashboard.html')});
document.getElementById('clear').onclick = () => { if (confirm('Clear?')) chrome.runtime.sendMessage({type:'clear-all'}, ()=>location.reload()); };
document.getElementById('ai').onclick = async () => {
  const [tab] = await chrome.tabs.query({active:true, currentWindow:true});
  chrome.scripting.executeScript({target:{tabId:tab.id}, func:()=>window.__FOREVER_AI_EXPORT__?.()});
};
chrome.storage.local.get(['imageFilter'], r => { document.getElementById('imgFilter').checked = r.imageFilter?.enabled||false; });
document.getElementById('imgFilter').onchange = e => {
  chrome.storage.local.get(['imageFilter'], r => {
    const cur = r.imageFilter||{};
    cur.enabled = e.target.checked;
    chrome.storage.local.set({imageFilter:cur});
  });
};
