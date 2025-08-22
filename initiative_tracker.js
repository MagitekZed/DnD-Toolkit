/************ Initiative Tracker ************/
let initList = [];  // [{id, name, init, bonusExpr, dexMod, advMode, notes, conditions:[{name,duration}], initTooltip, showCond:false}]
let currentTurn = 0; let idSeq = 1; let roundCounter = 1; const roundCounterEl = document.getElementById('roundCounter');
const $ = sel => document.querySelector(sel);
function saveInitState(){
  try{ localStorage.setItem('initState', JSON.stringify({ initList, currentTurn, idSeq, roundCounter })); }catch{}
}
function loadInitState(){
  try{
    const data = JSON.parse(localStorage.getItem('initState'));
    if(!data) return;
    initList = data.initList || [];
    currentTurn = data.currentTurn || 0;
    idSeq = data.idSeq || 1;
    roundCounter = data.roundCounter || 1;
  }catch{}
}
// Escape HTML entities to avoid injection.
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

const STD_CONDS = ["blinded","charmed","deafened","frightened","grappled","incapacitated","invisible","paralyzed","petrified","poisoned","prone","restrained","stunned","unconscious","concentrating"];

// Sort initiative list by total, dex modifier, then name/id.
function sortInit(){
  initList = initList.slice().sort((a,b)=>{
    if (b.init!==a.init) return b.init - a.init;
    if ((b.dexMod||0)!==(a.dexMod||0)) return (b.dexMod||0)-(a.dexMod||0);
    const na=(a.name||'').toLowerCase(), nb=(b.name||'').toLowerCase(); if (na!==nb) return na.localeCompare(nb);
    return a.id - b.id;
  });
  if (initList.length){
    const id = initList[Math.min(currentTurn, initList.length-1)].id;
    const newIdx = initList.findIndex(x=>x.id===id);
    currentTurn = (newIdx>=0? newIdx : 0);
  } else currentTurn = 0;
}

// Draw the initiative tracker UI.
function renderInit(){
  const root = document.getElementById('initList');
  if (!initList.length){ root.innerHTML = `<div class="small muted">No entries yet. Add participants above.</div>`; roundCounterEl.textContent = String(roundCounter); saveInitState(); return; }
  const header = `
      <div class="init-header">
        <div>#</div>
        <div>Name</div>
        <div>Init</div>
        <div>Bonus</div>
        <div>Adv/Dex/Roll</div>
        <div>Notes</div>
        <div>Conditions / Actions</div>
      </div>`;
  root.innerHTML = header + initList.map((it,idx)=>{
    const chips = (it.conditions||[]).map((c,i)=>`<span class="chip" data-cond-idx="${i}">${escapeHtml(c.name)}${(c.duration||c.duration===0)?` (${c.duration})`:''}<span class="x" title="Remove">✕</span></span>`).join('');
    const initTitle = it.initTooltip ? ` title="${escapeHtml(it.initTooltip).replace(/\n/g,'&#10;')}"` : '';
    return `
      <div class="init-row ${idx===currentTurn?'active':''}" data-id="${it.id}">
        <div class="turn-arrow">${idx===currentTurn? '➤' : ''}</div>
        <div class="init-name" contenteditable="true" data-field="name" spellcheck="false">${escapeHtml(it.name)}</div>
        <div class="mono" contenteditable="true" data-field="init" spellcheck="false"${initTitle}>${it.init ?? ''}</div>
        <div class="mono" contenteditable="true" data-field="bonusExpr" spellcheck="false">${escapeHtml(it.bonusExpr||'')}</div>
        <div class="row" style="gap:6px;justify-content:flex-start">
          <select data-field="advMode">
            <option value="normal" ${it.advMode==='normal'?'selected':''}>Normal</option>
            <option value="adv" ${it.advMode==='adv'?'selected':''}>Adv</option>
            <option value="dis" ${it.advMode==='dis'?'selected':''}>Dis</option>
          </select>
          <input class="tiny" type="number" data-field="dexMod" value="${it.dexMod ?? ''}" placeholder="DEX" title="DEX modifier (tiebreak)"/>
          <button class="btn" data-act="roll">Roll</button>
        </div>
        <div class="small" contenteditable="true" data-field="notes" spellcheck="false">${escapeHtml(it.notes||'')}</div>
        <div>
          <div class="row" style="justify-content:flex-end;gap:6px;">
            <button class="btn" data-act="conds">Conditions</button>
            <button class="btn" data-act="focus">Focus</button>
            <button class="btn danger" data-act="remove">Remove</button>
          </div>
          <div class="small" style="margin-top:6px;">${chips||'<span class="muted">No conditions</span>'}</div>
        </div>
      </div>`;
  }).join('');

  // Wire events per row
  root.querySelectorAll('.init-row').forEach((row,idx)=>{
    const id = Number(row.getAttribute('data-id'));
    const obj = initList.find(x=>x.id===id);
    row.querySelectorAll('[contenteditable][data-field]').forEach(ed=>{
      ed.addEventListener('blur', ()=>{
        const field = ed.getAttribute('data-field'); const val = ed.innerText.trim();
        if (field==='name') obj.name = val || ('Creature '+obj.id);
        if (field==='init') { obj.init = Number(val||0); obj.initTooltip = null; }
        if (field==='bonusExpr') obj.bonusExpr = val;
        if (field==='notes') obj.notes = val;
        if (document.getElementById('autoSort').value==='on' && (field==='init')) { sortInit(); }
        renderInit();
      });
      ed.addEventListener('keydown',(e)=>{ if (e.key==='Enter'){ e.preventDefault(); ed.blur(); }});
    });
    row.querySelectorAll('[data-field="advMode"],[data-field="dexMod"]').forEach(inp=>{
      inp.addEventListener('input', ()=>{ const f=inp.getAttribute('data-field'); if (f==='advMode') obj.advMode = inp.value; if (f==='dexMod') obj.dexMod = Number(inp.value||0); renderInit(); });
    });
    // Buttons
    row.querySelector('[data-act="remove"]').addEventListener('click', ()=>{ const idx0 = initList.findIndex(x=>x.id===id); if (idx0===-1) return; initList.splice(idx0,1); if (currentTurn >= initList.length) currentTurn = Math.max(0, initList.length-1); renderInit(); });
    row.querySelector('[data-act="focus"]').addEventListener('click', ()=>{ const ix = Array.from(root.querySelectorAll('.init-row')).indexOf(row); if (ix>=0) currentTurn = ix; renderInit(); });
    row.querySelector('[data-act="roll"]').addEventListener('click', ()=>{ rollFor(obj); if (document.getElementById('autoSort').value==='on'){ sortInit(); } renderInit(); });
    row.querySelectorAll('.chip').forEach(chip=>{
      const idxc = Number(chip.getAttribute('data-cond-idx'));
      chip.addEventListener('click', (e)=>{ if (e.target.classList.contains('x')) return; e.stopPropagation(); openCondPopover(chip, obj, idxc); });
      chip.querySelector('.x').addEventListener('click', (e)=>{ e.stopPropagation(); obj.conditions.splice(idxc,1); renderInit(); });
    });
    row.querySelector('[data-act="conds"]').addEventListener('click', (e)=>{ e.stopPropagation(); openCondPopover(e.currentTarget, obj); });
  });
  roundCounterEl.textContent = String(roundCounter);
  saveInitState();
}

// Add a new character entry to the initiative list.
function addCharacter({name, bonusExpr, dexMod, advMode}){
  initList.push({ id:idSeq++, name:name||`Creature ${idSeq}`, init:0, bonusExpr:bonusExpr||'', dexMod:Number(dexMod||0), advMode:advMode||'normal', notes:'', conditions:[], initTooltip:null });
  if (document.getElementById('autoSort').value==='on') sortInit(); renderInit();
}

// Roll initiative for a single character.
function rollFor(ch){
  const d20 = rollD20ModeDetailed(ch.advMode||'normal');
  let bonus = 0;
  const bonusLines=[];
  if (ch.bonusExpr && ch.bonusExpr.trim()){
    try{
      const res = rollDiceExprDetailed(ch.bonusExpr);
      bonus = res.total;
      res.parts.forEach(p=>{
        if (p.type==='flat'){
          bonusLines.push(`${p.value>=0?'+':''}${p.value}`);
        } else {
          const sign = p.n>=0?'' : '-';
          const label = `${Math.abs(p.n)}d${p.faces}`;
          const rolls = p.rolls.join('+');
          bonusLines.push(`${sign}${label}: ${rolls}`);
        }
      });
    }catch{ bonus = 0; }
  }
  ch.init = d20.result + bonus;
  const lines=[];
  const modeLabel = d20.mode==='normal'?'':` (${d20.mode})`;
  lines.push(`d20${modeLabel}: ${d20.result}` + (d20.rolls.length>1?` [${d20.rolls.join(', ')}]`:''));
  bonusLines.forEach(l=>lines.push(l));
  lines.push(`Total: ${ch.init}`);
  ch.initTooltip = lines.join('\n');
  return ch.init;
}

// Roll initiative for all characters and re-render.
function rollAll(){ initList.forEach(ch=>rollFor(ch)); if (document.getElementById('autoSort').value==='on') sortInit(); renderInit(); }

// Decrease duration counters for conditions each round.
function tickConditionsOneRound(){
  initList.forEach(ch=>{
    ch.conditions = (ch.conditions||[]).map(c=>({ ...c, duration: (c.duration||c.duration===0)? Math.max(0, c.duration-1): c.duration }))
                                    .filter(c=> !(c.duration===0));
  });
}

// Advance initiative to the next character.
function advanceTurn(){
  if (!initList.length) return;
  const was = currentTurn; currentTurn = (currentTurn + 1) % initList.length;
  if (currentTurn === 0 && was !== 0){ roundCounter++; tickConditionsOneRound(); }
  renderInit();
}

// Reset initiative rolls but keep list of characters.
function resetInitiative(){
  initList.forEach(ch=>{ ch.init = 0; ch.initTooltip = null; });
  currentTurn = 0; roundCounter = 1;
  renderInit();
}
// Clear all initiative entries.
function clearInitiative(){ initList = []; currentTurn = 0; idSeq = 1; roundCounter = 1; renderInit(); localStorage.removeItem('initState'); }

// Condition popover with auto-left shift if overflow
let condPopoverEl = null;
// Popover UI to manage conditions on a character.
function openCondPopover(anchorBtn, ch, idxEdit){
  closeCondPopover();
  const rect = anchorBtn.getBoundingClientRect();
  condPopoverEl = document.createElement('div');
  condPopoverEl.className = 'popover';
  const editing = typeof idxEdit === 'number';
  const existing = editing ? ch.conditions[idxEdit] : null;
  const selected = editing && STD_CONDS.includes(existing.name) ? existing.name : null;
  const customName = editing && !STD_CONDS.includes(existing.name) ? existing.name : '';
  const dur = editing ? (existing.duration ?? '') : '';
  const customDur = editing && !STD_CONDS.includes(existing.name) ? (existing.duration ?? '') : '';
  condPopoverEl.innerHTML = `
    <div class="small" style="margin-bottom:6px;">Select conditions and set duration (rounds).</div>
    <div class="cond-toggle">${STD_CONDS.map(n=>`<button type="button" class="cond-btn ${selected===n?'active':''}" data-name="${n}">${n}</button>`).join('')}</div>
    <div class="row" style="margin-top:6px;gap:8px;">
      <label class="small">Duration</label>
      <input class="tiny" type="number" id="condDur" placeholder="e.g., 3" value="${selected?dur:''}"/>
    </div>
    <div class="row" style="margin-top:8px;gap:8px;">
      <input type="text" class="mono" id="customCondName" placeholder="Custom condition" style="flex:1" value="${customName}"/>
      <input class="tiny" type="number" id="customCondDur" placeholder="dur" value="${customDur}"/>
    </div>
    <div class="row" style="justify-content:flex-end;margin-top:8px;gap:8px;">
      <button class="btn" id="applyCond">${editing?'Update':'Add Selected'}</button>
      <button class="btn" id="closeCond">Close</button>
    </div>`;
  document.body.appendChild(condPopoverEl);

  const margin = 8;
  const popRect = condPopoverEl.getBoundingClientRect();
  let top = window.scrollY + rect.bottom + margin;
  let left = window.scrollX + rect.left;
  if (left + popRect.width > window.scrollX + window.innerWidth - margin){
    left = Math.max(window.scrollX + margin, window.scrollX + rect.right - popRect.width);
  }
  condPopoverEl.style.top = top + 'px';
  condPopoverEl.style.left = left + 'px';

  condPopoverEl.querySelectorAll('.cond-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if (editing){
        condPopoverEl.querySelectorAll('.cond-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        condPopoverEl.querySelector('#customCondName').value='';
        condPopoverEl.querySelector('#customCondDur').value='';
      } else {
        btn.classList.toggle('active');
      }
    });
  });
  condPopoverEl.querySelector('#customCondName').addEventListener('input', ()=>{
    if (editing){ condPopoverEl.querySelectorAll('.cond-btn').forEach(b=>b.classList.remove('active')); }
  });
  condPopoverEl.querySelector('#applyCond').addEventListener('click', ()=>{
    const actives = Array.from(condPopoverEl.querySelectorAll('.cond-btn.active')).map(b=>b.getAttribute('data-name'));
    const durStd = condPopoverEl.querySelector('#condDur').value.trim();
    const cName = condPopoverEl.querySelector('#customCondName').value.trim();
    const cDur = condPopoverEl.querySelector('#customCondDur').value.trim();
    if (editing){
      if (actives.length){
        ch.conditions[idxEdit] = { name: actives[0], duration: durStd?Number(durStd):undefined };
      } else if (cName){
        ch.conditions[idxEdit] = { name: cName, duration: cDur?Number(cDur):undefined };
      }
    } else {
      actives.forEach(n=>{ if (!ch.conditions.some(c=>c.name===n)) ch.conditions.push({ name:n, duration: durStd?Number(durStd):undefined }); });
      if (cName && !ch.conditions.some(c=>c.name===cName)){ ch.conditions.push({ name:cName, duration: cDur?Number(cDur):undefined }); }
    }
    renderInit();
    closeCondPopover();
  });
  condPopoverEl.querySelector('#closeCond').addEventListener('click', closeCondPopover);
}
// Close the condition popover if open.
function closeCondPopover(){ if (condPopoverEl){ condPopoverEl.remove(); condPopoverEl=null; } }
window.addEventListener('click', (e)=>{ if (condPopoverEl && !condPopoverEl.contains(e.target) && !(e.target.closest && e.target.closest('.popover'))){ if (!e.target.matches('[data-act="conds"], .chip, .chip *')) closeCondPopover(); } });

// Controls
document.getElementById('addInit').addEventListener('click', ()=>{
  const name = (document.getElementById('initName').value || '').trim() || `Creature ${idSeq}`;
  const bonusExpr = (document.getElementById('initBonusExpr').value || '').trim();
  const dexMod = Number((document.getElementById('dexMod').value || 0));
  const advMode = document.getElementById('initAdv').value;
  addCharacter({ name, bonusExpr, dexMod, advMode });
  document.getElementById('initName').value=''; document.getElementById('initBonusExpr').value=''; document.getElementById('dexMod').value='';
});
document.getElementById('rollAll').addEventListener('click', rollAll);
document.getElementById('advanceInit').addEventListener('click', advanceTurn);
document.getElementById('resetInit').addEventListener('click', resetInitiative);
document.getElementById('clearInit').addEventListener('click', clearInitiative);
document.getElementById('autoSort').addEventListener('change', ()=>{ if (document.getElementById('autoSort').value==='on') { sortInit(); renderInit(); } });

// initial render for tracker
loadInitState();
renderInit();

