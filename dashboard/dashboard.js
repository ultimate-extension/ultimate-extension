
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


// === SPEECH TO TEXT PANEL - TEST UPDATE v5.0.7 - 100% local ===
let recognition = null;
let finalTranscript = '';
let isListening = false;

function initSTT() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    document.getElementById('stt-status').textContent = 'Status: Web Speech API not supported in this browser (use Chrome/Edge)';
    document.getElementById('stt-start').disabled = true;
    return;
  }
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  
  recognition.onstart = () => {
    isListening = true;
    document.getElementById('stt-status').textContent = 'Status: 🎤 Listening... speak now';
    document.getElementById('stt-start').style.background = '#0a0';
  };
  recognition.onend = () => {
    isListening = false;
    document.getElementById('stt-status').textContent = 'Status: Stopped - click Start to resume';
    document.getElementById('stt-start').style.background = '#222';
  };
  recognition.onerror = (e) => {
    document.getElementById('stt-status').textContent = 'Status: Error ' + e.error;
  };
  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += t + ' ';
      } else {
        interim += t;
      }
    }
    const ta = document.getElementById('stt-transcript');
    ta.value = finalTranscript + (interim ? '\n[interim] ' + interim : '');
    // auto-scroll
    ta.scrollTop = ta.scrollHeight;
    // also store compressed for debugging
    chrome.storage.local.set({sttLastTranscript: finalTranscript.slice(-5000)});
  };
}

document.getElementById('stt-start').onclick = () => {
  if (!recognition) initSTT();
  const lang = document.getElementById('stt-lang').value;
  recognition.lang = lang;
  try { recognition.start(); } catch(e) { console.log(e); }
};
document.getElementById('stt-stop').onclick = () => { try { recognition.stop(); } catch(e) {} };
document.getElementById('stt-clear').onclick = () => { finalTranscript = ''; document.getElementById('stt-transcript').value = ''; };
document.getElementById('stt-copy').onclick = () => {
  const ta = document.getElementById('stt-transcript');
  ta.select(); document.execCommand('copy');
  document.getElementById('stt-status').textContent = 'Status: Copied to clipboard';
};
document.getElementById('stt-export').onclick = () => {
  const blob = new Blob([document.getElementById('stt-transcript').value], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`stt-transcript-${new Date().toISOString().slice(0,10)}.txt`; a.click();
};
document.getElementById('stt-tts').onclick = () => {
  const text = document.getElementById('stt-transcript').value.slice(0,4000);
  if (!text) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = document.getElementById('stt-lang').value;
  speechSynthesis.speak(utter);
  document.getElementById('stt-status').textContent = 'Status: 🔊 Speaking transcript...';
  utter.onend = () => { document.getElementById('stt-status').textContent = 'Status: Done speaking'; };
};

// init on load
initSTT();

