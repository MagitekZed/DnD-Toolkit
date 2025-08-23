/************ Initiative Tracker ************/
let initList = [];  // [{id, type, name, kindLabel, init, bonusExpr, dexMod, advMode, notes, conditions:[{name,duration,type}], initTooltip}]
let currentTurn = 0;
let idSeq = 1;
let roundCounter = 1;
const roundCounterEl = document.getElementById('roundCounter');
const $ = sel => document.querySelector(sel);

const STD_CONDS = ["blinded","charmed","deafened","frightened","grappled","incapacitated","invisible","paralyzed","petrified","poisoned","prone","restrained","stunned","unconscious","concentrating"];
function isStdCond(name){ return STD_CONDS.includes((name||'').toLowerCase()); }

function saveInitState(){
  try{ localStorage.setItem('initState', JSON.stringify({ initList, currentTurn, idSeq, roundCounter })); }catch{}
}
function loadInitState(){
  try{
    const data = JSON.parse(localStorage.getItem('initState'));
    if(!data) return;
    initList = (data.initList || []).map(it=>{
      if(!it.type) it.type = 'other';
      // Backfill kindLabel: if missing or blank, default from type
      if(!('kindLabel' in it) || !it.kindLabel || !it.kindLabel.trim()){
        it.kindLabel = it.type==='pc' ? 'PC' : it.type==='enemy' ? 'Enemy' : 'Other';
      }
      it.conditions = (it.conditions||[]).map(c=>{
        if(!c.type){ c.type = isStdCond(c.name)?'debuff':'buff'; }
        return c;
      });
      return it;
    });
    currentTurn = data.currentTurn || 0;
    idSeq = data.idSeq || 1;
    roundCounter = data.roundCounter || 1;
  }catch{}
}
// Escape HTML entities to avoid injection.
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

/************ Sorting ************/
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

/************ Render ************/
function renderInit(){
  const root = document.getElementById('initList');
  if (!initList.length){
    root.innerHTML = `<div class="small muted">No entries yet. Add participants above.</div>`;
    roundCounterEl && (roundCounterEl.textContent = String(roundCounter));
    saveInitState();
    return;
  }
  const header = `
      <div class="init-header">
        <div>#</div>
        <div>Name / Label</div>
        <div>Init</div>
        <div>Addl. Bonus</div>
        <div>Adv/Type/Dex/Roll</div>
        <div>Notes</div>
        <div>Conditions & Actions</div>
      </div>`;
  root.innerHTML = header + initList.map((it,idx)=>{
    const chips = (it.conditions||[]).map((c,i)=>{
      const typ=(c.type||(isStdCond(c.name)?'debuff':'buff'));
      const dur=((c.duration||c.duration===0)?` (${c.duration})`:'' );
      return `<span class="chip ${typ}" data-cond-idx="${i}">${escapeHtml(c.name)}${dur}<span class="x" title="Remove">✕</span></span>`;
    }).join('');
    const initTitle = it.initTooltip ? ` title="${escapeHtml(it.initTooltip).replace(/\n/g,'&#10;')}"` : '';
    // Name + small label cell
    const nameCell = `<div>
        <div class="init-name" contenteditable="true" data-field="name" spellcheck="false">${escapeHtml(it.name)}</div>
        <div class="small" contenteditable="true" data-field="kindLabel" spellcheck="false" data-placeholder="PC / Enemy / Other">${escapeHtml(it.kindLabel||'')}</div>
      </div>`;
    // Actions right column
    const actions = `<div class="actions">
        <div class="btns nowrap">
          <button class="btn" data-act="conds">Conditions</button>
          <button class="btn" data-act="focus">Focus</button>
          <button class="btn danger" data-act="remove">Remove</button>
        </div>
        <div class="chips small">${chips||'<span class="muted">No conditions</span>'}</div>
      </div>`;
    return `
      <div class="init-row ${it.type||'other'} ${idx===currentTurn?'active':''}" data-id="${it.id}">
        <div class="turn-arrow">${idx===currentTurn? '➤' : ''}</div>
        ${nameCell}
        <div class="mono init-val" contenteditable="true" data-field="init" spellcheck="false"${initTitle}>${it.init ?? ''}</div>
        <div class="mono" contenteditable="true" data-field="bonusExpr" spellcheck="false" data-placeholder="click to add bonus">${escapeHtml(it.bonusExpr||'')}</div>
        <div class="row" style="gap:6px;justify-content:flex-start">
          <select data-field="advMode" title="Advantage mode">
            <option value="normal" ${it.advMode==='normal'?'selected':''}>Normal</option>
            <option value="adv" ${it.advMode==='adv'?'selected':''}>Adv</option>
            <option value="dis" ${it.advMode==='dis'?'selected':''}>Dis</option>
          </select>
          <select data-field="type" title="Entry type">
            <option value="pc" ${it.type==='pc'?'selected':''}>PC</option>
            <option value="enemy" ${it.type==='enemy'?'selected':''}>Enemy</option>
            <option value="other" ${it.type==='other'?'selected':''}>Other</option>
          </select>
          <input class="tiny" type="number" data-field="dexMod" value="${it.dexMod ?? ''}" placeholder="DEX" title="DEX mod (added & tiebreak)"/>
          <button class="btn" data-act="roll">Roll</button>
        </div>
        <div class="small note-field" contenteditable="true" data-field="notes" spellcheck="false" placeholder="Click to add notes…">${escapeHtml(it.notes||'')}</div>
        ${actions}
      </div>`;
  }).join('');

  // Wire events
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
        if (field==='kindLabel'){
          // If cleared, reset to default of current type
          if (!val){
            obj.kindLabel = obj.type==='pc' ? 'PC' : obj.type==='enemy' ? 'Enemy' : 'Other';
          } else {
            obj.kindLabel = val;
          }
        }
        if (document.getElementById('autoSort').value==='on' && (field==='init')) { sortInit(); }
        renderInit();
      });
      ed.addEventListener('keydown',(e)=>{ if (e.key==='Enter'){ e.preventDefault(); ed.blur(); }});
    });

    row.querySelectorAll('[data-field]').forEach(inp=>{
      const f = inp.getAttribute('data-field');
      if (f==='advMode' || f==='type' || f==='dexMod'){
        inp.addEventListener('input', ()=>{
          if (f==='advMode') obj.advMode = inp.value;
          if (f==='type'){
            const prevType = obj.type;
            obj.type = inp.value;
            // Auto-sync kindLabel only if it was still default/blank
            const wasDefault = !obj.kindLabel || obj.kindLabel === (prevType==='pc'?'PC':prevType==='enemy'?'Enemy':'Other');
            if (wasDefault){
              obj.kindLabel = obj.type==='pc'?'PC':obj.type==='enemy'?'Enemy':'Other';
            }
          }
          if (f==='dexMod')  obj.dexMod  = Number(inp.value||0);
          renderInit();
        });
      }
    });

    // Buttons
    row.querySelector('[data-act="remove"]').addEventListener('click', ()=>{
      const idx0 = initList.findIndex(x=>x.id===id); if (idx0===-1) return;
      initList.splice(idx0,1);
      if (currentTurn >= initList.length) currentTurn = Math.max(0, initList.length-1);
      renderInit();
    });
    row.querySelector('[data-act="focus"]').addEventListener('click', ()=>{
      const ix = Array.from(root.querySelectorAll('.init-row')).indexOf(row);
      if (ix>=0) currentTurn = ix; renderInit();
    });
    row.querySelector('[data-act="roll"]').addEventListener('click', ()=>{
      rollFor(obj); if (document.getElementById('autoSort').value==='on'){ sortInit(); } renderInit();
    });

    // Condition chips
    row.querySelectorAll('.chip').forEach(chip=>{
      const idxc = Number(chip.getAttribute('data-cond-idx'));
      chip.addEventListener('click', (e)=>{ if (e.target.classList.contains('x')) return; e.stopPropagation(); openCondPopover(chip, obj, idxc); });
      chip.querySelector('.x').addEventListener('click', (e)=>{ e.stopPropagation(); obj.conditions.splice(idxc,1); renderInit(); });
    });
    row.querySelector('[data-act="conds"]').addEventListener('click', (e)=>{ e.stopPropagation(); openCondPopover(e.currentTarget, obj); });
  });

  roundCounterEl && (roundCounterEl.textContent = String(roundCounter));
  saveInitState();
}

/************ Mutations ************/
function addCharacter({name, bonusExpr, dexMod, advMode, type}){
  const t = type || 'other';
  const id = idSeq++;
  const defaultName = name && name.trim()
    ? name.trim()
    : (t==='pc' ? `PC ${id}` : t==='enemy' ? `Enemy ${id}` : `Creature ${id}`);
  initList.push({
    id,
    type: t,
    name: defaultName,
    kindLabel: (t==='pc'?'PC':t==='enemy'?'Enemy':'Other'),
    init: 0,
    bonusExpr: bonusExpr||'',
    dexMod: Number(dexMod||0),
    advMode: advMode||'normal',
    notes: '',
    conditions: [],
    initTooltip: null
  });
  if (document.getElementById('autoSort').value==='on') sortInit();
  renderInit();
}

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
  ch.init = d20.result + (ch.dexMod||0) + bonus;
  const lines=[];
  const modeLabel = d20.mode==='normal'?'':` (${d20.mode})`;
  lines.push(`d20${modeLabel}: ${d20.result}` + (d20.rolls.length>1?` [${d20.rolls.join(', ')}]`:''));
  if ((ch.dexMod||0)!==0) lines.push(`+ DEX ${ch.dexMod>=0?'+':''}${ch.dexMod}`);
  bonusLines.forEach(l=>lines.push(l));
  lines.push(`Total: ${ch.init}`);
  ch.initTooltip = lines.join('\n'); // real newlines
  return ch.init;
}

function rollAll(){ initList.forEach(ch=>rollFor(ch)); if (document.getElementById('autoSort').value==='on') sortInit(); renderInit(); }

function tickConditionsOneRound(){
  initList.forEach(ch=>{
    ch.conditions = (ch.conditions||[]).map(c=>({ ...c, duration: (c.duration||c.duration===0)? Math.max(0, c.duration-1): c.duration }))
                                    .filter(c=> !(c.duration===0));
  });
}

function advanceTurn(){
  if (!initList.length) return;
  const was = currentTurn; currentTurn = (currentTurn + 1) % initList.length;
  if (currentTurn === 0 && was !== 0){ roundCounter++; tickConditionsOneRound(); }
  renderInit();
}

function resetInitiative(){
  initList.forEach(ch=>{ ch.init = 0; ch.initTooltip = null; });
  currentTurn = 0; roundCounter = 1;
  renderInit();
}
function clearInitiative(){ initList = []; currentTurn = 0; idSeq = 1; roundCounter = 1; renderInit(); localStorage.removeItem('initState'); }

/************ Conditions Popover ************/
let condPopoverEl = null;
function openCondPopover(anchorBtn, ch, idxEdit){
  closeCondPopover();
  const rect = anchorBtn.getBoundingClientRect();
  condPopoverEl = document.createElement('div');
  condPopoverEl.className = 'popover';
  const editing = typeof idxEdit === 'number';
  const existing = editing ? ch.conditions[idxEdit] : null;
  const selected = editing && isStdCond(existing.name) ? existing.name.toLowerCase() : null;
  const customName = editing && !isStdCond(existing.name) ? existing.name : '';
  const dur = editing ? (existing.duration ?? '') : '';
  const customDur = editing && !isStdCond(existing.name) ? (existing.duration ?? '') : '';
  condPopoverEl.innerHTML = `
    <div class="small" style="margin-bottom:6px;"><b>Standard Conditions</b> — select then set <i>Duration (rounds)</i>.</div>
    <div class="cond-toggle">${STD_CONDS.map(n=>`<button type="button" class="cond-btn ${selected===n?'active':''}" data-name="${n}">${n}</button>`).join('')}</div>
    <div class="row" style="margin-top:6px;gap:8px;">
      <label class="small" for="condDur">Duration for selected</label>
      <input class="tiny" type="number" id="condDur" placeholder="e.g., 3" value="${selected?dur:''}"/>
    </div>
    <hr class="sep"/>
    <div class="small" style="margin:8px 0 4px;"><b>Custom Condition</b> — boons like <i>Haste</i> or curses like <i>Bane</i>.</div>
    <div class="row" style="gap:8px;">
      <label class="small" for="customCondName" style="min-width:120px;">Name</label>
      <input type="text" class="mono" id="customCondName" placeholder="e.g., Haste" style="flex:1" value="${customName}"/>
    </div>
    <div class="row" style="margin-top:6px;gap:8px;">
      <label class="small" for="customCondDur" style="min-width:120px;">Custom duration</label>
      <input class="tiny" type="number" id="customCondDur" placeholder="rounds" value="${customDur}"/>
      <label class="small" for="customCondType">Type</label>
      <select id="customCondType">
        <option value="buff">Buff (positive)</option>
        <option value="debuff">Debuff (negative)</option>
      </select>
    </div>
    <div class="row" style="justify-content:flex-end;margin-top:8px;gap:8px;">
      <button class="btn" id="applyCond">${editing?'Update':'Add Selected'}</button>
      <button class="btn" id="closeCond">Close</button>
    </div>`;
  document.body.appendChild(condPopoverEl);
  const selType = condPopoverEl.querySelector('#customCondType'); if(selType){ selType.value = (existing && !isStdCond(existing.name) && existing.type) ? existing.type : 'buff'; }

  // Position (viewport aware)
  const margin = 8;
  const popRect = condPopoverEl.getBoundingClientRect();
  let top = window.scrollY + rect.bottom + margin;
  let left = window.scrollX + rect.left;
  if (left + popRect.width > window.scrollX + window.innerWidth - margin){
    left = Math.max(window.scrollX + margin, window.scrollX + rect.right - popRect.width);
  }
  condPopoverEl.style.top = top + 'px';
  condPopoverEl.style.left = left + 'px';

  // Behavior
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
    const cType = condPopoverEl.querySelector('#customCondType')?.value || 'buff';
    if (editing){
      if (actives.length){
        ch.conditions[idxEdit] = { name: actives[0], duration: durStd?Number(durStd):undefined, type:'debuff' };
      } else if (cName){
        ch.conditions[idxEdit] = { name: cName, duration: cDur?Number(cDur):undefined, type:cType };
      }
    } else {
      actives.forEach(n=>{ if (!ch.conditions.some(c=>c.name.toLowerCase()===n.toLowerCase())) ch.conditions.push({ name:n, duration: durStd?Number(durStd):undefined, type:'debuff' }); });
      if (cName && !ch.conditions.some(c=>c.name.toLowerCase()===cName.toLowerCase())){ ch.conditions.push({ name:cName, duration: cDur?Number(cDur):undefined, type:cType }); }
    }
    renderInit();
    closeCondPopover();
  });
  condPopoverEl.querySelector('#closeCond').addEventListener('click', closeCondPopover);
}
function closeCondPopover(){ if (condPopoverEl){ condPopoverEl.remove(); condPopoverEl=null; } }
window.addEventListener('click', (e)=>{
  if (condPopoverEl && !condPopoverEl.contains(e.target) && !(e.target.closest && e.target.closest('.popover'))){
    if (!e.target.matches('[data-act="conds"], .chip, .chip *')) closeCondPopover();
  }
});

/************ Controls ************/
document.getElementById('addInit')?.addEventListener('click', ()=>{
  const name = (document.getElementById('initName').value || '').trim() || `Creature ${idSeq}`;
  const bonusExpr = (document.getElementById('initBonusExpr').value || '').trim();
  const dexMod = Number((document.getElementById('dexMod').value || 0));
  const advMode = document.getElementById('initAdv').value;
  addCharacter({ name, bonusExpr, dexMod, advMode, type:'other' });
  document.getElementById('initName').value=''; document.getElementById('initBonusExpr').value=''; document.getElementById('dexMod').value='';
});
// Quick Add shortcuts
const baseQuick = ()=>({ bonusExpr:(document.getElementById('initBonusExpr').value||'').trim(), dexMod:Number(document.getElementById('dexMod').value||0), advMode:document.getElementById('initAdv').value });
document.getElementById('addPC')?.addEventListener('click',   ()=> addCharacter({ ...baseQuick(), type:'pc' }) );
document.getElementById('addEnemy')?.addEventListener('click',()=> addCharacter({ ...baseQuick(), type:'enemy' }) );
document.getElementById('addOther')?.addEventListener('click',()=> addCharacter({ ...baseQuick(), type:'other' }) );

document.getElementById('rollAll')?.addEventListener('click', rollAll);
document.getElementById('advanceInit')?.addEventListener('click', advanceTurn);
document.getElementById('resetInit')?.addEventListener('click', resetInitiative);
document.getElementById('clearInit')?.addEventListener('click', clearInitiative);
document.getElementById('autoSort')?.addEventListener('change', ()=>{ if (document.getElementById('autoSort').value==='on') { sortInit(); renderInit(); } });

// Compact view toggle + persistence
(function initCompact(){
  const toggle=document.getElementById('compactToggle'); const wrap=document.querySelector('.init-wrap');
  try{ if(localStorage.getItem('initCompact')==='1'){ toggle.checked=true; wrap.classList.add('init-compact'); } }catch{}
  toggle?.addEventListener('change', ()=>{
    if(toggle.checked){ wrap.classList.add('init-compact'); try{localStorage.setItem('initCompact','1');}catch{} }
    else { wrap.classList.remove('init-compact'); try{localStorage.setItem('initCompact','0');}catch{} }
  });
})();

// initial render
loadInitState();
renderInit();
