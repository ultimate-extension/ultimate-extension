
let all = [];
function render(filter='') {
  const tbody = document.getElementById('tbody');
  const f = filter.toLowerCase();
  const filtered = all.filter(([h])=>!f || h.includes(f)).slice(0,1000);
  tbody.innerHTML = filtered.map(([host,v])=>`<tr><td>${host}</td><td>${v.root}</td><td>${v.count}</td><td>${new Date(v.lastSeen).toLocaleString()}</td><td>${(v.types||[]).join(',')}</td></tr>`).join('');
}
chrome.runtime.sendMessage({type:'get-stats'}, data => {
  const domains = data.domains||{};
  all = Object.entries(domains).sort((a,b)=>b[1].count - a[1].count);
  document.getElementById('total').textContent = all.length;
  const today = new Date().toISOString().slice(0,10);
  document.getElementById('today').textContent = data.dailyRollup?.[today]||0;
  document.getElementById('topsites').textContent = (data.topSites||[]).length;
  document.getElementById('days').textContent = Object.keys(data.dailyRollup||{}).length;
  render('');
});
document.getElementById('search').oninput = e => render(e.target.value);
document.getElementById('export').onclick = () => {
  chrome.runtime.sendMessage({type:'export-clean'}, r => {
    const blob = new Blob([JSON.stringify(r, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`forever-clean-${new Date().toISOString().slice(0,10)}.json`; a.click();
  });
};
document.getElementById('exportCsv').onclick = () => {
  const csv = 'domain,root,count,lastSeen\n' + all.map(([h,v])=>`${h},${v.root},${v.count},${new Date(v.lastSeen).toISOString()}`).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`forever-clean-${new Date().toISOString().slice(0,10)}.csv`; a.click();
};
document.getElementById('exportZip').onclick = async () => {
  // create zip with compressed analytics for AI debugging (local only)
  const {domains, dailyRollup} = await chrome.storage.local.get(['domains','dailyRollup']);
  const payload = {domains: Object.keys(domains||{}).sort(), dailyRollup, exportedAt: new Date().toISOString(), piiRemoved:true};
  const blob = new Blob([JSON.stringify(payload)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`forever-debug-compressed-${new Date().toISOString().slice(0,10)}.json`; a.click();
};
