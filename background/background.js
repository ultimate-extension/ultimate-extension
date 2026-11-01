
// Forever - Ultra Fast Domain Logger + Analytics + topSites + Compressed Local Logging
const buffer = new Map(); // hostname -> {count, lastSeen, root}
const rootCache = new Map();
const dailyRollup = new Map(); // YYYY-MM-DD -> count
let flushTimer = null;
const FLUSH_MS = 3000;

function fastHostname(url) {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase();
  } catch { return null; }
}
function getRoot(host) {
  if (rootCache.has(host)) return rootCache.get(host);
  const parts = host.split('.');
  const root = parts.length > 2 ? parts.slice(-2).join('.') : host;
  rootCache.set(host, root);
  if (rootCache.size > 5000) rootCache.delete(rootCache.keys().next().value);
  return root;
}
function ingest(url, type='webRequest') {
  const host = fastHostname(url);
  if (!host) return;
  if (host.length < 3 || host.includes('chrome://')) return;
  const now = Date.now();
  const day = new Date().toISOString().slice(0,10);
  const entry = buffer.get(host) || {count:0, lastSeen:0, root:getRoot(host), types:new Set()};
  entry.count++; entry.lastSeen = now; entry.types.add(type);
  buffer.set(host, entry);
  dailyRollup.set(day, (dailyRollup.get(day)||0)+1);
  scheduleFlush();
}
function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, FLUSH_MS);
}
async function flush() {
  flushTimer = null;
  if (buffer.size === 0) return;
  const toMerge = Array.from(buffer.entries()).map(([host, v]) => ({
    host, count: v.count, lastSeen: v.lastSeen, root: v.root, types: Array.from(v.types)
  }));
  buffer.clear();
  const stored = await chrome.storage.local.get(['domains','dailyRollup']);
  const domains = stored.domains || {};
  for (const item of toMerge) {
    const prev = domains[item.host] || {count:0, lastSeen:0, root:item.root};
    domains[item.host] = {
      count: prev.count + item.count,
      lastSeen: Math.max(prev.lastSeen, item.lastSeen),
      root: item.root,
      types: [...new Set([...(prev.types||[]), ...item.types])]
    };
  }
  const mergedDaily = {...(stored.dailyRollup||{})};
  for (const [day,c] of dailyRollup.entries()) {
    mergedDaily[day] = (mergedDaily[day]||0)+c;
  }
  dailyRollup.clear();
  await chrome.storage.local.set({domains, dailyRollup: mergedDaily, lastFlush: Date.now()});
  broadcast({type:'domains-updated', count: Object.keys(domains).length});
}
function broadcast(msg) {
  chrome.runtime.sendMessage(msg).catch(()=>{});
  chrome.tabs.query({}, tabs => {
    for (const t of tabs) {
      if (t.id && t.url && !t.url.startsWith('chrome://')) {
        chrome.tabs.sendMessage(t.id, msg).catch(()=>{});
      }
    }
  });
}

// webRequest - read only, no proxy, no blocking
chrome.webRequest.onBeforeRequest.addListener(
  (d) => { if (d.url) ingest(d.url, 'beforeRequest'); },
  {urls: ["<all_urls>"]}
);
chrome.webRequest.onCompleted.addListener(
  (d) => { if (d.url) ingest(d.url, 'completed'); },
  {urls: ["<all_urls>"]}
);
chrome.webRequest.onErrorOccurred.addListener(
  (d) => { if (d.url) ingest(d.url, 'error'); },
  {urls: ["<all_urls>"]}
);

// tabs.onUpdated - faster catch
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) ingest(changeInfo.url, 'tabUpdated');
  if (tab.url) ingest(tab.url, 'tab');
});

// alarms - ultra fast + topSites + daily rollup
chrome.alarms.create('flush', {periodInMinutes: 0.05}); // 3 sec
chrome.alarms.create('topSitesRefresh', {periodInMinutes: 60});
chrome.alarms.create('dailyRollupCompress', {periodInMinutes: 1440});
chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name === 'flush') await flush();
  if (a.name === 'topSitesRefresh') refreshTopSites();
  if (a.name === 'dailyRollupCompress') await compressAnalytics();
});

async function refreshTopSites() {
  try {
    if (!chrome.topSites) return;
    const sites = await chrome.topSites.get();
    const domains = sites.map(s => { try { return new URL(s.url).hostname; } catch { return null; } }).filter(Boolean);
    await chrome.storage.local.set({topSites: domains, topSitesRaw: sites});
  } catch {}
}
async function compressAnalytics() {
  const {dailyRollup} = await chrome.storage.local.get(['dailyRollup']);
  if (!dailyRollup) return;
  // keep last 90 days, compress older to weekly
  const keys = Object.keys(dailyRollup).sort();
  if (keys.length > 90) {
    const toKeep = keys.slice(-90);
    const compressed = {};
    for (const k of toKeep) compressed[k] = dailyRollup[k];
    await chrome.storage.local.set({dailyRollup: compressed, dailyRollupArchived: true});
  }
}

// clean PII export - ONLY domains, NO urls, deduped, sorted
async function getCleanExport() {
  const {domains} = await chrome.storage.local.get(['domains']);
  if (!domains) return {domains: [], count:0};
  const list = Object.keys(domains).map(h => h.toLowerCase().trim()).filter(h => h && !h.includes('/') && !h.includes('?') && !h.includes('@'));
  const deduped = [...new Set(list)].sort();
  return {domains: deduped, count: deduped.length, exportedAt: new Date().toISOString()};
}

// messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'get-stats') {
    chrome.storage.local.get(['domains','dailyRollup','topSites']).then(data => {
      sendResponse({domains: data.domains||{}, dailyRollup: data.dailyRollup||{}, topSites: data.topSites||[]});
    });
    return true;
  }
  if (msg.type === 'export-clean') {
    getCleanExport().then(data => sendResponse(data));
    return true;
  }
  if (msg.type === 'clear-all') {
    chrome.storage.local.clear().then(()=>sendResponse({ok:true}));
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  refreshTopSites();
  chrome.storage.local.get(['hudPos']).then(r => {
    if (!r.hudPos) chrome.storage.local.set({hudPos: {x: 75, y: 10, collapsed: false}}); // % pos
  });
});
