/**
 * Client-side logic for the D&D 5e Toolkit web app.
 * Handles tab navigation, dice rolling utilities, damage-per-round math
 * initiative tracking, and quick reference subtabs.
 */

/************ Tabs ************/
const tabButtons = document.querySelectorAll('.tab');
const pages = {
  dpr: document.getElementById('page-dpr'),
  roller: document.getElementById('page-roller'),
  init: document.getElementById('page-init'),
  notes: document.getElementById('page-notes'),
  quickref: document.getElementById('page-quickref')
};
tabButtons.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    tabButtons.forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    Object.values(pages).forEach(p=>p.classList.remove('active'));
    pages[btn.dataset.tab].classList.add('active');
  });
});

/************ Quick Reference (subtabs) ************/
function renderConditions(filter='all'){
  const root = document.getElementById('conditionsList');
  if(!root || typeof CONDITIONS==='undefined'){ return; }
  const filterSet = new Set(filter==='all' ? [] : [filter]);
  const items = CONDITIONS.filter(c=> filter==='all' || (Array.isArray(c.tags) && c.tags.some(t=>filterSet.has(t))));
  root.innerHTML = items.map(c=>{
    const tags = (c.tags||[]).map(t=>`<span class="cond-tag">${t}</span>`).join('');
    const list = (c.effects||[]).map(e=>`<li>${e}</li>`).join('');
    const summary = (c.summary || 'Details');
    return `<div class="cond-card">
      <h3>${c.name}</h3>
      <div class="cond-tags">${tags}</div>
      <details>
        <summary>${summary}</summary>
        <ul>${list}</ul>
      </details>
    </div>`;
  }).join('');
}

function renderMasteries(){
  const root = document.getElementById('masteriesList');
  if(!root || typeof WEAPON_MASTERIES === 'undefined') return;
  root.innerHTML = WEAPON_MASTERIES.map(m=>{
    const tags = (m.tags||[]).map(t=>`<span class="cond-tag">${t}</span>`).join('');
    const list = (m.effects||[]).map(e=>`<li>${e}</li>`).join('');
    const summary = m.summary || 'Details';
    return `<div class="cond-card">
      <h3>${m.name}</h3>
      <div class="cond-tags">${tags}</div>
      <details><summary>${summary}</summary><ul>${list}</ul></details>
    </div>`;
  }).join('');
}
function renderActions2024(){
  const root = document.getElementById('actionsList');
  if(!root || typeof ACTION_TYPES_2024 === 'undefined') return;
  root.innerHTML = ACTION_TYPES_2024.map(a=>{
    const list = (a.effects||[]).map(e=>`<li>${e}</li>`).join('');
    const summary = a.summary || 'Details';
    return `<div class="cond-card">
      <h3>${a.name}</h3>
      <details><summary>${summary}</summary><ul>${list}</ul></details>
    </div>`;
  }).join('');
}

(function initQuickRef(){
  const subtabs = document.querySelectorAll('.subtab');
  const subpages = document.querySelectorAll('.subpage');
  subtabs.forEach(st=>{
    st.addEventListener('click', ()=>{
      subtabs.forEach(x=>x.classList.remove('active'));
      st.classList.add('active');
      const id = st.dataset.subtab;
      subpages.forEach(p=>p.classList.remove('active'));
      const page = document.getElementById('qr-'+id);
      if(page) page.classList.add('active');
    });
  });
  const condFilter = document.getElementById('condFilter');
  if(condFilter){
    condFilter.addEventListener('change', ()=> renderConditions(condFilter.value));
  }
  renderConditions('all');
  renderMasteries();
  renderActions2024();
})();

// ----- Dice Helpers -----
// These utilities parse and roll common dice expressions.
/**
 * Parse a dice expression like "2d6+3" into an array of term objects.
 * @param {string} expr - Dice expression to parse.
 * @returns {Array<Object>} parsed terms.
 */
function parseDice(expr) {
  if (!expr || !expr.trim()) throw new Error("Empty expression.");
  const cleaned = expr.replace(/\s+/g, "").toLowerCase();
  if (!/^[0-9d+\-]+$/.test(cleaned)) throw new Error("Invalid characters.");
  const terms = []; let i = 0, sign = 1;
  while (i < cleaned.length) {
    const ch = cleaned[i];
    if (ch === "+") { sign = 1; i++; continue; }
    if (ch === "-") { sign = -1; i++; continue; }
    let j = i; while (j < cleaned.length && /[0-9]/.test(cleaned[j])) j++;
    if (j === i) throw new Error("Expected a number at " + i);
    const num = parseInt(cleaned.slice(i,j),10); i = j;
    if (i < cleaned.length && cleaned[i] === "d") {
      i++; let k = i; while (k < cleaned.length && /[0-9]/.test(cleaned[k])) k++;
      if (k === i) throw new Error("Expected die faces after 'd' at " + i);
      const faces = parseInt(cleaned.slice(i,k),10); if (faces < 1) throw new Error("Die must have at least 1 face.");
      terms.push({type:"dice", n: sign*num, faces}); i = k;
    } else {
      terms.push({type:"flat", value: sign*num});
    }
    sign = 1;
  }
  return terms;
}
/**
 * Compute the average result of a list of parsed dice terms.
 * @param {Array<Object>} terms
 * @returns {{diceAvg:number, flat:number, total:number, detail:string}}
 */
function averageDiceTerms(terms) {
  let diceAvg = 0, flat = 0, detail = [];
  for (const t of terms) {
    if (t.type === "flat") { flat += t.value; detail.push(`${t.value>=0?"+":""}${t.value}`); }
    else { const n=t.n, f=t.faces; const avg=n*(f+1)/2; diceAvg+=avg; const sign=n>=0?"":"-"; detail.push(`${sign}${Math.abs(n)}d${f}`); }
  }
  return { diceAvg, flat, total: diceAvg+flat, detail: detail.join(" ") };
}
// Roll a single die with `f` faces.
function rollDie(f){ return 1 + Math.floor(Math.random()*f); }
/** Roll a full dice expression and return the total. */
function rollDiceExpr(expr){
  const terms = parseDice(expr);
  let total = 0;
  for (const t of terms){
    if (t.type==='flat'){ total += t.value; }
    else {
      const n = Math.abs(t.n), sign = t.n>=0?1:-1;
      for(let i=0;i<n;i++){ total += sign*rollDie(t.faces); }
    }
  }
  return total;
}
/** Roll a d20 considering advantage/disadvantage modes. */
function rollD20Mode(mode){
  const a = rollDie(20), b = rollDie(20), c = rollDie(20);
  if (mode==='adv') return Math.max(a,b);
  if (mode==='dis') return Math.min(a,b);
  if (mode==='elven') return Math.max(a,b,c);
  return a; // normal
}

// Detailed rollers (return individual dice results)
/** Roll an expression and keep each die result. */
function rollDiceExprDetailed(expr){
  const terms = parseDice(expr);
  let total = 0;
  const parts = [];
  for (const t of terms){
    if (t.type==='flat'){
      total += t.value;
      parts.push({ type:'flat', value:t.value });
    } else {
      const n = Math.abs(t.n), sign = t.n>=0?1:-1;
      const rolls=[];
      for(let i=0;i<n;i++){ const r=rollDie(t.faces); rolls.push(r); total += sign*r; }
      parts.push({ type:'dice', n:t.n, faces:t.faces, rolls });
    }
  }
  return { total, parts };
}
/** Detailed d20 roll with all individual dice kept. */
function rollD20ModeDetailed(mode, halfling=false){
  const rollOnce=()=>{ let r=rollDie(20); if(halfling && r===1) r=rollDie(20); return r; };
  const rolls=[];
  const a=rollOnce(); rolls.push(a);
  if (mode==='adv' || mode==='dis'){ const b=rollOnce(); rolls.push(b); }
  if (mode==='elven'){ const b=rollOnce(), c=rollOnce(); rolls.push(b,c); }
  let result;
  if (mode==='adv') result=Math.max(rolls[0],rolls[1]);
  else if (mode==='dis') result=Math.min(rolls[0],rolls[1]);
  else if (mode==='elven') result=Math.max(...rolls);
  else result=rolls[0];
  return { result, rolls, mode };
}
