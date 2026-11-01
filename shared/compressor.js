
export function compressDaily(daily) {
  const keys = Object.keys(daily).sort();
  if (keys.length <= 90) return daily;
  const keep = keys.slice(-90);
  const out={}; keep.forEach(k=>out[k]=daily[k]); return out;
}
export function toCompressedBlob(obj){ return new Blob([JSON.stringify(obj)], {type:'application/json'}); }
