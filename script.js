/* script.js — Script App behavior
   Replace the AdSense placeholders:
     - In index.html: ca-pub-YOUR_PUBLISHER_ID
     - In the <ins> elements below: data-ad-slot="YOUR_AD_SLOT_1" and "YOUR_AD_SLOT_2"
   During development you can add data-adtest="on" to the <ins> elements or the script tag.
*/

/* --------- Utilities --------- */
const qs = (sel, root=document) => root.querySelector(sel);
const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const $ = (id) => document.getElementById(id);

function showToast(msg, ms=2400){
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  setTimeout(()=> t.hidden = true, ms);
}

/* Clipboard helper with graceful fallback */
async function tryCopy(text){
  if(!text) return false;
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // fallback using textarea + execCommand
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      const ok = document.execCommand && document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    }
  }catch(e){
    return false;
  }
}

/* Simple SVG placeholder generator (data URI) */
function svgPlaceholder(id, name){
  const bgHue = 200 + (id * 37 % 60);
  const text = (name || 'Script').slice(0,12);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='300'>
    <rect width='100%' height='100%' fill='hsl(${bgHue} 60% 16%)'/>
    <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='36' fill='rgba(255,255,255,0.9)'>${escapeHtml(text)}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

/* small html escape */
function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* --------- Data loading & persistence --------- */
const STORAGE_KEY = 'scriptApp.scripts.v1';

async function loadScriptsJson(){
  // Attempt to fetch scripts.json from the same folder
  try{
    const res = await fetch('scripts.json', {cache: 'no-store'});
    if(!res.ok) throw new Error('Network response not ok');
    const j = await res.json();
    // Accept either { scripts: [...] } or an array directly
    if(Array.isArray(j)) return j;
    if(j && Array.isArray(j.scripts)) return j.scripts;
    // otherwise if object with README + scripts or similar
    return Array.isArray(j) ? j : (j.scripts || []);
  }catch(err){
    console.warn('Could not fetch scripts.json — falling back to localStorage or embedded defaults.', err);
    const stored = localStorage.getItem(STORAGE_KEY);
    if(stored){
      try { return JSON.parse(stored); } catch(e){ console.warn('invalid stored JSON', e); }
    }
    // fallback embedded defaults (mirrors scripts.json contents)
    return [
      {"id":1,"name":"Hello World Logger","image":"","link":"#","code":"// Hello World\nconsole.log('Hello, world!');"},
      {"id":2,"name":"Random Greeter","image":"","link":"#","code":"// Greeter\nfunction greet(name){ return `Hi, ${name}!`; }"},
      {"id":3,"name":"Simple Counter","image":"","link":"#","code":"// Counter\nlet i=0; setInterval(()=>console.log(++i),1000);"},
      {"id":4,"name":"Utils: Round Number","image":"","link":"#","code":"// Round helper\nfunction r(n, p=2){ return Number(n.toFixed(p)); }"},
      {"id":5,"name":"DOM Highlighter","image":"","link":"#","code":"// Highlight elements\ndocument.querySelectorAll('*').forEach(el=>el.style.outline='1px solid rgba(255,0,120,0.3)');"},
      {"id":6,"name":"Time Logger","image":"","link":"#","code":"// Log time every 5s\nsetInterval(()=>console.log(new Date().toLocaleTimeString()),5000);"},
      {"id":7,"name":"UUID v4","image":"","link":"#","code":"// UUID v4 (small)\nfunction uuidv4(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{let r=Math.random()*16|0;let v=c=='x'?r:(r&0x3|0x8);return v.toString(16);});}"}
    ];
  }
}

function saveScriptsLocal(arr){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }catch(e){ console.warn('Could not save', e); }
}

/* --------- UI rendering --------- */
let scripts = [];
let filtered = [];

const grid = $('grid');
const searchInput = $('searchInput');
const countDisplay = $('countDisplay');

function renderScripts(list){
  grid.innerHTML = '';
  if(!list.length){
    $('noResults').hidden = false;
    countDisplay.textContent = `0 / ${scripts.length}`;
    return;
  } else {
    $('noResults').hidden = true;
  }

  list.forEach(item => {
    const card = document.createElement('article');
    card.className = 'card';
    card.tabIndex = 0;
    card.setAttribute('role','article');
    // media
    const media = document.createElement('div');
    media.className = 'media';
    let imgEl = document.createElement('img');
    if(item.image) imgEl.src = item.image;
    else imgEl.src = svgPlaceholder(item.id, item.name);
    imgEl.alt = item.name || `Script ${item.id}`;
    media.appendChild(imgEl);
    card.appendChild(media);

    // title
    const title = document.createElement('h3');
    title.innerHTML = escapeHtml(item.name || 'Untitled');
    card.appendChild(title);

    // meta row
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `<span class="small">ID: ${item.id}</span><a class="small" href="${escapeHtml(item.link||'#')}" tabindex="0" rel="noopener noreferrer">${escapeHtml(item.link || '#')}</a>`;
    card.appendChild(meta);

    // actions
    const actions = document.createElement('div');
    actions.className = 'actions';
    const left = document.createElement('div');
    left.innerHTML = `<span class="small">Preview</span>`;
    const right = document.createElement('div');

    const copyBtn = document.createElement('button');
    copyBtn.className = 'icon-btn';
    copyBtn.title = 'Copy script';
    copyBtn.ariaLabel = `Copy script ${item.name}`;
    copyBtn.innerHTML = 'Copy';
    copyBtn.addEventListener('click', async (e)=>{
      e.stopPropagation();
      const ok = await tryCopy(item.code || '');
      showToast(ok ? 'Copied to clipboard' : 'Copy failed — select text to copy');
    });

    const getBtn = document.createElement('button');
    getBtn.className = 'getBtn';
    getBtn.innerHTML = 'Get Script';
    getBtn.addEventListener('click', ()=> startAdSequenceFor(item));

    // keyboard Enter/Space on card runs Get Script
    card.addEventListener('keydown', (ev)=>{
      if(ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); startAdSequenceFor(item); }
    });

    right.appendChild(copyBtn);
    right.appendChild(getBtn);
    actions.appendChild(left);
    actions.appendChild(right);
    card.appendChild(actions);

    grid.appendChild(card);
  });

  countDisplay.textContent = `${list.length} / ${scripts.length}`;
}

function applyFilter(){
  const q = (searchInput.value || '').trim().toLowerCase();
  if(!q){ filtered = scripts.slice(); renderScripts(filtered); return; }
  filtered = scripts.filter(s => {
    return String(s.id).includes(q) ||
           (s.name && s.name.toLowerCase().includes(q)) ||
           (s.link && s.link.toLowerCase().includes(q)) ||
           (s.code && s.code.toLowerCase().includes(q));
  });
  renderScripts(filtered);
}

/* --------- Ad display & reveal logic --------- */
const overlay = $('overlay');
const adSlotContainer = $('adSlotContainer');
const modalFooter = $('modalFooter');
const revealedCode = $('revealedCode');
const manualCopyBtn = $('manualCopy');
const closeModalBtn = $('closeModal');

let currentScript = null;

function clearAds(){
  adSlotContainer.innerHTML = '';
  modalFooter.hidden = true;
  revealedCode.textContent = '';
}

/* Create an ad slot element using AdSense placeholders.
   Replace data-ad-slot values with YOUR_AD_SLOT_1 and YOUR_AD_SLOT_2.
   Note: don't encourage clicks. During development add data-adtest="on" on the ins elements if needed.
*/
function createAdSlot(slotId){
  const wrapper = document.createElement('div');
  wrapper.className = 'ad-wrapper';
  wrapper.style.width = '100%';
  // The ins element (AdSense placeholder)
  const ins = document.createElement('ins');
  ins.className = 'adsbygoogle';
  ins.style.display = 'block';
  ins.setAttribute('data-ad-client', 'ca-pub-YOUR_PUBLISHER_ID'); // replace in index.html too
  ins.setAttribute('data-ad-slot', slotId); // replace slotId with YOUR_AD_SLOT_1 / YOUR_AD_SLOT_2
  ins.setAttribute('data-ad-format', 'auto');
  ins.setAttribute('data-full-width-responsive', 'true');
  // Optionally during development: ins.setAttribute('data-adtest','on');
  wrapper.appendChild(ins);
  return { wrapper, ins };
}

/* Show sequential ads then reveal the code and copy it */
async function startAdSequenceFor(item){
  currentScript = item;
  overlay.hidden = false;
  overlay.setAttribute('aria-hidden','false');
  $('modalTitle').textContent = 'Showing ads before revealing script';
  clearAds();

  const adDelay = Number(document.getElementById('adDelaySelect').value) * 1000;

  // First ad
  const ad1 = createAdSlot('YOUR_AD_SLOT_1'); // replace this placeholder
  adSlotContainer.appendChild(ad1.wrapper);
  // request ad
  try{ (adsbygoogle = window.adsbygoogle || []).push({}); }catch(e){ /* ignore */ }

  // wait
  await new Promise(r=>setTimeout(r, adDelay));

  // Second ad
  const ad2 = createAdSlot('YOUR_AD_SLOT_2');
  adSlotContainer.appendChild(ad2.wrapper);
  try{ (adsbygoogle = window.adsbygoogle || []).push({}); }catch(e){ /* ignore */ }

  await new Promise(r=>setTimeout(r, adDelay));

  // Reveal code & copy
  modalFooter.hidden = false;
  revealedCode.textContent = item.code || '';
  // Focus code area for keyboard users
  revealedCode.focus();
  const ok = await tryCopy(item.code || '');
  showToast(ok ? 'Script copied to clipboard' : 'Could not copy automatically; use Copy button');

  // update modal title
  $('modalTitle').textContent = `Script: ${item.name || ('ID '+item.id)}`;
}

/* modal buttons */
manualCopyBtn.addEventListener('click', async ()=>{
  if(!currentScript) return;
  const ok = await tryCopy(currentScript.code || '');
  showToast(ok ? 'Copied to clipboard' : 'Copy failed — select text to copy');
});
closeModalBtn.addEventListener('click', ()=> {
  overlay.hidden = true;
  overlay.setAttribute('aria-hidden','true');
  clearAds();
});

/* close overlay on ESC */
window.addEventListener('keydown', (e)=> {
  if(e.key === 'Escape' && !overlay.hidden){
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden','true');
    clearAds();
  }
});

/* --------- Developer JSON editor logic --------- */
const devPanel = $('devPanel');
const toggleDevBtn = $('toggleDevBtn');
const devJson = $('devJson');
const applyJson = $('applyJson');
const resetStorage = $('resetStorage');
const fileInput = $('fileInput');

toggleDevBtn.addEventListener('click', ()=>{
  const open = devPanel.hidden;
  devPanel.hidden = !open;
  toggleDevBtn.setAttribute('aria-expanded', String(open));
});

applyJson.addEventListener('click', ()=>{
  const raw = devJson.value.trim();
  if(!raw){ showToast('No JSON provided'); return; }
  let parsed;
  try{
    parsed = JSON.parse(raw);
  }catch(e){
    showToast('JSON parse error: ' + e.message);
    return;
  }
  // If array -> replace
  if(Array.isArray(parsed)){
    scripts = normalizeAndEnsureIds(parsed, true);
    saveScriptsLocal(scripts);
    applyFilter();
    showToast('Replaced scripts with provided array');
    return;
  }
  // If object with scripts key -> replace
  if(parsed && Array.isArray(parsed.scripts)){
    scripts = normalizeAndEnsureIds(parsed.scripts, true);
    saveScriptsLocal(scripts);
    applyFilter();
    showToast('Replaced scripts from object.scripts');
    return;
  }
  // If single object or array of objects -> append
  if(parsed && typeof parsed === 'object'){
    const items = Array.isArray(parsed) ? parsed : [parsed];
    scripts = appendWithUniqueIds(items);
    saveScriptsLocal(scripts);
    applyFilter();
    showToast('Appended script(s) and saved');
    return;
  }
  showToast('Unrecognized JSON structure');
});

resetStorage.addEventListener('click', ()=>{
  localStorage.removeItem(STORAGE_KEY);
  showToast('Local edits cleared. Reload to re-fetch original scripts.json');
});

/* file input to load a scripts.json file from disk (for local usage) */
fileInput.addEventListener('change', (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    try{
      const parsed = JSON.parse(ev.target.result);
      if(Array.isArray(parsed)) scripts = normalizeAndEnsureIds(parsed, true);
      else if(parsed.scripts) scripts = normalizeAndEnsureIds(parsed.scripts, true);
      else showToast('File parsed but no scripts found');
      saveScriptsLocal(scripts);
      applyFilter();
      showToast('Loaded scripts from file');
    }catch(err){ showToast('File JSON parse error'); }
  };
  reader.readAsText(f);
});

/* Helpers for merging/appending */
function normalizeAndEnsureIds(arr, forceReplace=false){
  // Ensure each item has id and required fields
  const out = arr.map((it, i)=>{
    const obj = Object.assign({}, it);
    if(obj.id == null) obj.id = (i+1);
    obj.name = obj.name || `Script ${obj.id}`;
    obj.image = obj.image || '';
    obj.link = obj.link || '#';
    obj.code = obj.code || '';
    return obj;
  });
  // ensure unique ids: if duplicates, reassign to incremental values
  const used = new Set();
  let max = Math.max(0, ...(scripts.map(s=>s.id||0)));
  out.forEach(o=>{
    if(used.has(o.id) || (scripts.find(s=>s.id===o.id) && !forceReplace)){
      max += 1; o.id = max;
    }
    used.add(o.id);
  });
  return out;
}

function appendWithUniqueIds(items){
  const curMax = Math.max(0, ...(scripts.map(s=>s.id||0)));
  let nextId = curMax + 1;
  const toAppend = items.map(it=>{
    const obj = Object.assign({}, it);
    if(!obj.id || scripts.find(s=>s.id===obj.id)) { obj.id = nextId++; }
    obj.name = obj.name || `Script ${obj.id}`;
    obj.image = obj.image || '';
    obj.link = obj.link || '#';
    obj.code = obj.code || '';
    return obj;
  });
  return scripts.concat(toAppend);
}

/* --------- Initialization --------- */
async function init(){
  scripts = await loadScriptsJson();
  // if localStorage contains edits merge/replace
  const stored = localStorage.getItem(STORAGE_KEY);
  if(stored){
    try{
      scripts = JSON.parse(stored);
    }catch(e){ /* ignore */ }
  }
  // normalize fields
  scripts = normalizeAndEnsureIds(scripts, true);
  filtered = scripts.slice();
  renderScripts(filtered);

  // wire search
  searchInput.addEventListener('input', applyFilter);

  // developer panel toggle keyboard shortcut (Ctrl+Shift+J)
  window.addEventListener('keydown', (e)=>{
    if(e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'j'){
      toggleDevBtn.click();
    }
  });
}
init();

/* show count updates if scripts change externally */
window.addEventListener('storage', (e)=>{
  if(e.key === STORAGE_KEY){
    try{ scripts = JSON.parse(e.newValue); applyFilter(); }catch(e){}
  }
});

/* End of script.js */
