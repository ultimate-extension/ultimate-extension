# Forever - Ultimate Domain Logger (100% local)
Deployer compatible:
- manifest.json at ROOT
- version X.Y.Z
- no key, no update_url (deployer injects)
- excludes *.pem *.crx update.xml .git
- <10MB
- install: Load unpacked -> src folder

Features:
- Domain/subdomain deduped, fastHostname + rootCache + Map buffer delta merge + alarms
- Movable HUD: Shadow DOM, % pos, draggable header, collapsible, Alt+Shift+F/C/M
- Stats live, filterable UI dashboard
- topSites API hourly refresh
- Compressed analytics dailyRollup -> 90 days keep
- Clean export: ONLY domains, NO urls, PII removed, sorted
- Image filter: local blur/hide
- Universal AI chat exporter: ChatGPT, Gemini, Claude, Meta AI, Grok
- Speech: Web Speech API TTS/STT hooks (local)
- No proxy, no fetch, webRequest read-only
