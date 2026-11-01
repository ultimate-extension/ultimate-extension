
export async function cleanExport() {
  const {domains} = await chrome.storage.local.get(['domains']);
  const list = Object.keys(domains||{}).map(h=>h.toLowerCase().trim()).filter(h=>h && !h.includes('/') && !h.includes('?'));
  return {domains:[...new Set(list)].sort(), count:list.length, exportedAt:new Date().toISOString(), piiRemoved:true, onlyDomains:true};
}
