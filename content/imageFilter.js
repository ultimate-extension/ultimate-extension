
// Image content filtering - local only, no upload
(() => {
  const settings = {enabled:false, blurNSFW:false, hideAds:true};
  chrome.storage.local.get(['imageFilter'], r => { Object.assign(settings, r.imageFilter||{}); apply(); });
  chrome.storage.onChanged.addListener(c => { if (c.imageFilter) { Object.assign(settings, c.imageFilter.newValue); apply(); } });

  function apply() {
    if (!settings.enabled) return;
    const imgs = document.querySelectorAll('img');
    imgs.forEach(img => {
      const src = (img.src + ' ' + (img.alt||'')).toLowerCase();
      if (settings.hideAds && /ad|banner|sponsor|doubleclick/.test(src)) {
        img.style.display = 'none';
      }
      if (settings.blurNSFW && /nsfw|porn|xxx/.test(src)) {
        img.style.filter = 'blur(20px)';
        img.title = 'Blurred by Forever filter';
      }
    });
  }
  // observe new images
  new MutationObserver(apply).observe(document.documentElement, {childList:true, subtree:true});
  chrome.runtime.onMessage.addListener(m => { if (m.type==='imageFilter-update') apply(); });
})();
