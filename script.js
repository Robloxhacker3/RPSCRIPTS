/* script.js
   Updated to use your provided AdSense script tag.
   Set Ad Slot IDs in Dev panel (Ad Slot 1 & Ad Slot 2). Publisher/client defaults to ca-pub-7601925052503417.
   Behavior:
    - Click "Get Script" -> show Ad #1 for configured seconds -> show Ad #2 -> reveal script and copy to clipboard.
    - Dev JSON editor to replace/append scripts (persisted to localStorage).
    - Executors panel: add URLs or upload files to create downloadable entries.
*/

/* ---------- Utilities ---------- */
const $ = id => document.getElementById(id);
const q = (sel, root=document) => root.querySelector(sel);
const qa = (sel, root=document) => Array.from((root||document).querySelectorAll(sel));

function showToast(msg, ms=2200){
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  setTimeout(()=> t.hidden = true, ms);
}

async function tryCopy(text){
  if(!text) return false;
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    const ok = document.execCommand && document.execCommand('copy');
    document.body.removeChild(ta);
    return !!ok;
  }catch(e){ return false; }
}

/* SVG placeholder */
function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function svgPlaceholder(id, name){
  const hue = (id*47)%360;
  const t = (name||'Script').slice(0,12);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='300'><rect width='100%' height='100%' fill='hsl(${hue} 60% 14%)' /><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='34' fill='rgba(255,255,255,0.92)'>${escapeHtml(t)}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

/* ---------- Storage & defaults ---------- */
const STORAGE_KEY = 'robrp.scripts.v2';
const SETTINGS_KEY = 'robrp.settings.v2';
const EXEC_KEY = 'robrp.executors.v1';

async function fetchScripts(){
  try{
    const r = await fetch('scripts.json', {cache:'no-store'});
    if(!r.ok) throw new Error('fetch fail');
    const j = await r.json();
    if(Array.isArray(j)) return j;
    if(j && Array.isArray(j.scripts)) return j.scripts;
    return j.scripts || [];
  }catch(e){
    const stored = localStorage.getItem(STORAGE_KEY);
    if(stored) try{ return JSON.parse(stored); }catch(e){}
    return []; // fallback: empty (scripts.json should exist locally)
  }
}

function saveScripts(arr){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }catch(e){} }
function saveSettings(s){ try{ localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }catch(e){} }
function loadSettings(){ try{ return JSON.parse(localStorage.getItem(SETTINGS_KEY))||{} }catch(e){ return {}; } }

function loadExecutors(){ try{ return JSON.parse(localStorage.getItem(EXEC_KEY))||[] }catch(e){ return []; } }
function saveExecutors(arr){ try{ localStorage.setItem(EXEC_KEY, JSON.stringify(arr)); }catch(e){} }

/* ---------- UI elements ---------- */
const grid = $('grid');
const searchInput = $('searchInput');
const countDisplay = $('countDisplay');
const noResults = $('noResults');
const adDelaySelect = $('adDelaySelect');

const overlay = $('overlay');
const adSlotContainer = $('adSlotContainer');
const modalFooter = $('modalFooter');
const revealedCode = $('revealedCode');
const manualCopyBtn = $('manualCopy');
const closeModalBtn = $('closeModal');

const devPanel = $('devPanel');
const toggleDevBtn = $('toggleDevBtn');
const devJson = $('devJson');
const applyJson = $('applyJson');
const resetStorage = $('resetStorage');
const closeDev = $('closeDev');
const adSlot1Input = $('adSlot1');
const adSlot2Input = $('adSlot2');
const adClientInput = $('adClient');

const executorListEl = $('executorList');
const addExecutorBtn = $('addExecutorBtn');
const addExecutorArea = $('addExecutorArea');
const execName = $('execName');
const execUrl = $('execUrl');
const execFile = $('execFile');
const saveExec = $('saveExec');
const cancelExec = $('cancelExec');

/* ---------- Data & rendering ---------- */
let scripts = [];
let filtered = [];

function normalizeAndEnsureIds(arr, forceReplace=false){
  const out = arr.map((it,i)=>{ const o=Object.assign({},it); if(o.id==null) o.id = i+1; o.name = o.name||('Script '+o.id); o.image = o.image||''; o.link = o.link||'#'; o.code = o.code||''; return o; });
  const used = new Set();
  let max = Math.max(0, ...(scripts.map(s=>s.id||0)));
  out.forEach(o=>{
    if(used.has(o.id) || (scripts.find(s=>s.id===o.id) && !forceReplace)){ max += 1; o.id = max; }
    used.add(o.id);
  });
  return out;
}
function appendWithUniqueIds(items){
  const curMax = Math.max(0, ...(scripts.map(s=>s.id||0)));
  let nextId = curMax + 1;
  const toAppend = items.map(it=>{ const o = Object.assign({}, it); if(!o.id || scripts.find(s=>s.id===o.id)) o.id = nextId++; o.name = o.name||('Script '+o.id); o.image = o.image||''; o.link = o.link||'#'; o.code = o.code||''; return o; });
  return scripts.concat(toAppend);
}

function renderExecutors(){
  const arr = loadExecutors();
  executorListEl.innerHTML = '';
  if(!arr.length) { executorListEl.innerHTML = '<div class="muted">No executors added yet.</div>'; return; }
  arr.forEach((e, idx) => {
    const item = document.createElement('div'); item.className = 'exec-item';
    const left = document.createElement('div'); left.innerHTML = `<strong>${e.name}</strong><div class="muted small">${e.url||'(local file)'}</div>`;
    const right = document.createElement('div');
    const a = document.createElement('a'); a.href = e.url || e.blobUrl || '#'; a.download = e.name || 'executor.bin'; a.textContent = 'Download'; a.className = 'btn';
    const del = document.createElement('button'); del.className = 'btn ghost'; del.textContent = 'Delete';
    del.addEventListener('click', ()=>{ const arr2 = loadExecutors(); arr2.splice(idx,1); saveExecutors(arr2); renderExecutors(); showToast('Deleted executor'); });
    right.appendChild(a); right.appendChild(del);
    item.appendChild(left); item.appendChild(right);
    executorListEl.appendChild(item);
  });
}

function renderScripts(list){
  grid.innerHTML = '';
  if(!list.length){
    noResults.hidden = false;
    countDisplay.textContent = `0 / ${scripts.length}`;
    return;
  } else noResults.hidden = true;

  list.forEach(item=>{
    const card = document.createElement('article'); card.className = 'card'; card.tabIndex = 0;
    const media = document.createElement('div'); media.className = 'media';
    const img = document.createElement('img'); img.alt = item.name || ('Script '+item.id); img.src = item.image || svgPlaceholder(item.id, item.name);
    media.appendChild(img);
    const title = document.createElement('h3'); title.textContent = item.name || ('Script '+item.id);
    const meta = document.createElement('div'); meta.className = 'meta';
    const linkText = item.link || '#';
    meta.innerHTML = `<span>ID: ${item.id}</span><a href="${linkText}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    const actions = document.createElement('div'); actions.className = 'actions';
    const copyBtn = document.createElement('button'); copyBtn.className = 'icon-btn'; copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', async (e)=>{ e.stopPropagation(); const ok = await tryCopy(item.code||''); showToast(ok?'Copied to clipboard':'Copy failed'); });
    const getBtn = document.createElement('button'); getBtn.className = 'getBtn'; getBtn.textContent = 'Get Script';
    getBtn.addEventListener('click', ()=> startAdSequenceFor(item));
    actions.appendChild(copyBtn); actions.appendChild(getBtn);
    card.appendChild(media); card.appendChild(title); card.appendChild(meta); card.appendChild(actions);
    card.addEventListener('keydown', (ev)=>{ if(ev.key==='Enter' || ev.key===' '){ ev.preventDefault(); startAdSequenceFor(item); } });
    grid.appendChild(card);
  });

  countDisplay.textContent = `${list.length} / ${scripts.length}`;
}

function applyFilter(){
  const qstr = (searchInput.value||'').trim().toLowerCase();
  if(!qstr){ filtered = scripts.slice(); renderScripts(filtered); return; }
  filtered = scripts.filter(s => {
    return String(s.id).includes(qstr) ||
           (s.name && s.name.toLowerCase().includes(qstr)) ||
           (s.link && s.link.toLowerCase().includes(qstr)) ||
           (s.code && s.code.toLowerCase().includes(qstr));
  });
  renderScripts(filtered);
}

/* ---------- Ad sequence & reveal ---------- */
let currentScript = null;
function clearAds(){ adSlotContainer.innerHTML = ''; modalFooter.hidden = true; revealedCode.textContent = ''; }

function createAdSlot(slotId, client){
  const wrapper = document.createElement('div'); wrapper.className = 'ad-wrapper'; wrapper.style.width = '100%';
  const ins = document.createElement('ins'); ins.className = 'adsbygoogle'; ins.style.display = 'block';
  if(client) ins.setAttribute('data-ad-client', client);
  if(slotId) ins.setAttribute('data-ad-slot', slotId);
  ins.setAttribute('data-ad-format', 'auto');
  ins.setAttribute('data-full-width-responsive', 'true');
  // during development: ins.setAttribute('data-adtest','on');
  wrapper.appendChild(ins);
  return { wrapper, ins };
}

// ...existing code above...

async function startAdSequenceFor(item){
  currentScript = item;
  overlay.hidden = false; overlay.setAttribute('aria-hidden','false');
  $('modalTitle').textContent = 'Displaying ads before revealing script';
  clearAds();

  const settings = loadSettings();
  const slot1 = settings.adSlot1 || '2117641886';
  const slot2 = settings.adSlot2 || '4339398974';
  const client = settings.adClient || 'ca-pub-7601925052503417';
  const adDelay = Number(adDelaySelect.value||4)*1000;

  // first ad
  const a1 = createAdSlot(slot1, client);
  adSlotContainer.appendChild(a1.wrapper);
  try{ (adsbygoogle = window.adsbygoogle || []).push({}); }catch(e){}
  await new Promise(r=>setTimeout(r, adDelay));

  // second ad
  const a2 = createAdSlot(slot2, client);
  adSlotContainer.appendChild(a2.wrapper);
  try{ (adsbygoogle = window.adsbygoogle || []).push({}); }catch(e){}
  await new Promise(r=>setTimeout(r, adDelay));

  // reveal and copy (FIX: always update modalTitle and reveal code after both delays)
  modalFooter.hidden = false;
  revealedCode.textContent = item.code || '';
  revealedCode.focus();
  const ok = await tryCopy(item.code || '');
  showToast(ok ? 'Script copied to clipboard' : 'Automatic copy failed; use Copy button');
  // This guarantees that the modalTitle changes after ad sequence even if ads fail
  $('modalTitle').textContent = `Script: ${item.name || ('ID '+item.id)}`;
}

// ...existing code below...

  // reveal and copy
  modalFooter.hidden = false;
  revealedCode.textContent = item.code || '';
  revealedCode.focus();
  const ok = await tryCopy(item.code || '');
  showToast(ok ? 'Script copied to clipboard' : 'Automatic copy failed; use Copy button');
  $('modalTitle').textContent = `Script: ${item.name || ('ID '+item.id)}`;
}

/* modal actions */
manualCopyBtn.addEventListener('click', async ()=>{ if(!currentScript) return; const ok = await tryCopy(currentScript.code||''); showToast(ok?'Copied to clipboard':'Copy failed'); });
closeModalBtn.addEventListener('click', ()=>{ overlay.hidden = true; overlay.setAttribute('aria-hidden','true'); clearAds(); });
window.addEventListener('keydown', (e)=>{ if(e.key === 'Escape' && !overlay.hidden){ overlay.hidden = true; overlay.setAttribute('aria-hidden','true'); clearAds(); } });

/* ---------- Developer JSON editor & settings ---------- */
toggleDevBtn.addEventListener('click', ()=>{ const open = devPanel.hidden; devPanel.hidden = !open; toggleDevBtn.setAttribute('aria-expanded', String(open)); });
closeDev.addEventListener('click', ()=>{ devPanel.hidden = true; toggleDevBtn.setAttribute('aria-expanded','false'); });

applyJson.addEventListener('click', ()=> {
  const raw = devJson.value.trim(); if(!raw){ showToast('No JSON provided'); return; }
  let parsed;
  try{ parsed = JSON.parse(raw); }catch(e){ showToast('JSON parse error: '+e.message); return; }
  if(Array.isArray(parsed)){ scripts = normalizeAndEnsureIds(parsed, true); saveScripts(scripts); applyFilter(); showToast('Replaced scripts'); return; }
  if(parsed && Array.isArray(parsed.scripts)){ scripts = normalizeAndEnsureIds(parsed.scripts, true); saveScripts(scripts); applyFilter(); showToast('Replaced scripts from object'); return; }
  if(parsed && typeof parsed === 'object'){ const items = Array.isArray(parsed) ? parsed : [parsed]; scripts = appendWithUniqueIds(items); saveScripts(scripts); applyFilter(); showToast('Appended scripts'); return; }
  showToast('Unrecognized JSON structure');
});

resetStorage.addEventListener('click', ()=>{ localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(SETTINGS_KEY); localStorage.removeItem(EXEC_KEY); showToast('Local edits cleared'); location.reload(); });

function readAndSaveSettings(){
  const s = { adSlot1: (adSlot1Input.value||'').trim(), adSlot2: (adSlot2Input.value||'').trim(), adClient: (adClientInput.value||'').trim() };
  saveSettings(s); showToast('Settings saved');
}
adSlot1Input.addEventListener('change', readAndSaveSettings);
adSlot2Input.addEventListener('change', readAndSaveSettings);
adClientInput.addEventListener('change', readAndSaveSettings);

/* ---------- Executors UI ---------- */
addExecutorBtn.addEventListener('click', ()=>{ addExecutorArea.hidden = false; execName.value=''; execUrl.value=''; execFile.value=''; execName.focus(); });
cancelExec.addEventListener('click', ()=>{ addExecutorArea.hidden = true; });

saveExec.addEventListener('click', ()=>{
  const name = (execName.value||'').trim(); const url = (execUrl.value||'').trim();
  if(!name){ showToast('Name required'); return; }
  const arr = loadExecutors();
  if(url){
    arr.push({ name, url });
    saveExecutors(arr); renderExecutors(); addExecutorArea.hidden = true; showToast('Added executor (URL)'); return;
  }
  const f = execFile.files[0];
  if(f){
    const reader = new FileReader();
    reader.onload = (ev)=>{
      const blob = new Blob([ev.target.result], { type: f.type || 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(blob);
      arr.push({ name, blobUrl });
      saveExecutors(arr); renderExecutors(); addExecutorArea.hidden = true; showToast('Added executor (uploaded)');
    };
    reader.readAsArrayBuffer(f);
    return;
  }
  showToast('Provide URL or upload a file');
});

/* ---------- Initialization ---------- */
async function init(){
  const fetched = await fetchScripts();
  // prefer local storage if previously edited
  const stored = localStorage.getItem(STORAGE_KEY);
  scripts = stored ? (JSON.parse(stored) || fetched) : (fetched.length ? fetched : [
    {"id":1,"name":"Hello World Logger","image":"","link":"#","code":"// Hello World\\nconsole.log('Hello, world!');"},
    {"id":2,"name":"Random Greeter","image":"","link":"#","code":"// Greeter\\nfunction greet(name){ return `Hi, ${name}!`; }"},
    {"id":3,"name":"Simple Counter","image":"","link":"#","code":"// Counter\\nlet i=0; setInterval(()=>console.log(++i),1000);"},
    {"id":4,"name":"Utils: Round Number","image":"","link":"#","code":"// Round helper\\nfunction r(n, p=2){ return Number(n.toFixed(p)); }"},
    {"id":5,"name":"DOM Highlighter","image":"","link":"#","code":"// Highlight elements\\ndocument.querySelectorAll('*').forEach(el=>el.style.outline='1px solid rgba(255,0,120,0.3)');"},
    {"id":6,"name":"Time Logger","image":"","link":"#","code":"// Log time every 5s\\nsetInterval(()=>console.log(new Date().toLocaleTimeString()),5000);"},
    {"id":7,"name":"UUID v4","image":"","link":"#","code":"// UUID v4 (small)\\nfunction uuidv4(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{let r=Math.random()*16|0;let v=c=='x'?r:(r&0x3|0x8);return v.toString(16);});}"}
  ]);
  scripts = normalizeAndEnsureIds(scripts, true);
  filtered = scripts.slice();
  renderScripts(filtered);

  // load settings into dev panel
  const s = loadSettings();
  adSlot1Input.value = s.adSlot1 || '';
  adSlot2Input.value = s.adSlot2 || '';
  adClientInput.value = s.adClient || 'ca-pub-7601925052503417';

  // wire search
  searchInput.addEventListener('input', applyFilter);

  // tabs
  qa('.tabs-left .tab').forEach(t=>{
    t.addEventListener('click', (ev)=>{
      qa('.tabs-left .tab').forEach(x=>x.classList.remove('active'));
      ev.currentTarget.classList.add('active');
      const tab = ev.currentTarget.dataset.tab;
      document.getElementById(tab+'Panel').classList.remove('hidden');
      const other = tab==='scripts' ? 'executors' : 'scripts';
      document.getElementById(other+'Panel').classList.add('hidden');
    });
  });

  // dev toggle shortcut Ctrl+Shift+J
  window.addEventListener('keydown', (e)=>{ if(e.ctrlKey && e.shiftKey && e.key.toLowerCase()==='j') toggleDevBtn.click(); });

  renderExecutors();
}
init();

/* keep storage sync */
window.addEventListener('storage', (e) => {
  if(e.key === STORAGE_KEY){
    try{ scripts = JSON.parse(e.newValue); applyFilter(); }catch(e){}
  }
});
