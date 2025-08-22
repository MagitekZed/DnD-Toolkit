// ----- Damage-per-Round core utilities -----
/** Convert a probability mass function to cumulative distribution. */
function pmfToCdf(p){ const c=Array(21).fill(0); let a=0; for(let r=1;r<=20;r++){ a+=p[r]; c[r]=a; } return c; }
/** Base d20 probability, with optional halfling luck rerolls. */
function baseD20PerDie(halfling=false){ const p=Array(21).fill(0); if(!halfling){for(let r=1;r<=20;r++)p[r]=1/20;return p;} p[1]=1/400; for(let r=2;r<=20;r++) p[r]=1/20+1/400; return p; }
/** Probability mass of the max of `n` rolls from distribution `per`. */
function pmfMaxOf(per,n){ const F=pmfToCdf(per), o=Array(21).fill(0); for(let k=1;k<=20;k++){ const a=F[k], b=k>1?F[k-1]:0; o[k]=Math.pow(a,n)-Math.pow(b,n);} return o; }
/** Probability mass of the min of `n` rolls from distribution `per`. */
function pmfMinOf(per,n){ const F=pmfToCdf(per), o=Array(21).fill(0); for(let k=1;k<=20;k++){ const t=Math.pow(1-(k>1?F[k-1]:0),n), t1=Math.pow(1-F[k],n); o[k]=t-t1; } return o; }
/** Build a d20 probability mass for a roll mode. */
function d20PMF(mode, halfling=false){ const per=baseD20PerDie(halfling); if(mode==='normal')return per; if(mode==='adv')return pmfMaxOf(per,2); if(mode==='elven')return pmfMaxOf(per,3); if(mode==='dis')return pmfMinOf(per,2); throw new Error("Unknown mode"); }
/**
 * Compute hit, crit and miss probabilities for an attack roll.
 */
function toHitProbs(attackBonus, AC, critStart, mode, halfling){
  const pmf=d20PMF(mode,halfling); let pCrit=0,pHitNoCrit=0,pMiss=0;
  for(let r=1;r<=20;r++){ const pr=pmf[r], isCrit=r>=critStart, autoMiss=r===1, autoHit=r===20;
    let hit=false; if(autoMiss)hit=false; else if(autoHit)hit=true; else hit=(r+attackBonus)>=AC;
    if(isCrit&&hit)pCrit+=pr; else if(hit)pHitNoCrit+=pr; else pMiss+=pr;
  }
  const sum=pCrit+pHitNoCrit+pMiss; if(Math.abs(sum-1)>1e-9){ pCrit/=sum; pHitNoCrit/=sum; pMiss/=sum; }
  return { pCrit, pHitNoCrit, pMiss };
}
/**
 * Expected damage for an attack roll with optional critical bonuses.
 */
function expectedDamageAttack(damageExpr, critStart, mode, halfling, attackBonus, AC, critBonusDiceExpr="", critBonusFlat=0, critBonusDiceDouble=false){
  const terms = parseDice(damageExpr);
  const baseAvg = averageDiceTerms(terms);
  const { pCrit, pHitNoCrit } = toHitProbs(attackBonus, AC, critStart, mode, halfling);
  let critDiceAvg = 0, critFlat = Number(critBonusFlat)||0;
  if (critBonusDiceExpr && critBonusDiceExpr.trim()){
    try{ critDiceAvg = averageDiceTerms(parseDice(critBonusDiceExpr)).diceAvg; }catch{}
  }
  const critDiceFactor = critBonusDiceDouble ? 2 : 1;
  const avgOnHit  = baseAvg.diceAvg + baseAvg.flat;
  const avgOnCrit = (baseAvg.diceAvg*2) + baseAvg.flat + critFlat + critDiceAvg*critDiceFactor;
  const expected = pHitNoCrit * avgOnHit + pCrit * avgOnCrit;
  return {
    terms, avgDice: baseAvg.diceAvg, avgFlat: baseAvg.flat,
    avgOnHit, avgOnCrit, pCrit, pHit: pHitNoCrit+pCrit, pHitNoCrit, expected
  };
}
// Probability of passing a saving throw.
function saveSuccessProb(saveBonus, DC, modeSave){
  const per = baseD20PerDie(false);
  const pmf = modeSave==='normal'?per: modeSave==='adv'? pmfMaxOf(per,2) : pmfMinOf(per,2);
  let pSucc=0; for(let r=1;r<=20;r++){ const pr=pmf[r]; if (r+saveBonus>=DC) pSucc+=pr; } return pSucc;
}
// Expected damage for spells that allow a saving throw.
function expectedDamageSpellSave(dmgExpr, DC, saveBonus, successRule, modeSave){
  const terms = parseDice(dmgExpr);
  const avg = averageDiceTerms(terms).total;
  const pSucc = saveSuccessProb(saveBonus, DC, modeSave);
  const expected = successRule==='half' ? (1-pSucc)*avg + pSucc*(avg/2) : (1-pSucc)*avg;
  return { pSuccess:pSucc, pFail:1-pSucc, avg, expected };
}
// Maximum possible total of a list of parsed dice terms.
function maxFromTerms(terms, doubleDice=false){
  let diceMax=0, flat=0;
  for(const t of terms){
    if(t.type==='flat') flat+=t.value;
    else {
      const n=t.n, faces=t.faces;
      diceMax += (n>=0? n*faces : n*1);
    }
  }
  return diceMax*(doubleDice?2:1)+flat;
}
// Maximum damage for an attack assuming a natural 20 hit/crit.
function maxDamageAttack(damageExpr, critBonusDiceExpr="", critBonusFlat=0, critBonusDiceDouble=false){
  try{
    const base = maxFromTerms(parseDice(damageExpr), true);
    let bonus = 0;
    if(critBonusDiceExpr && critBonusDiceExpr.trim()){
      bonus = maxFromTerms(parseDice(critBonusDiceExpr), critBonusDiceDouble);
    }
    return base + Number(critBonusFlat||0) + bonus;
  }catch{ return 0; }
}
// Maximum damage for a spell save (assumes target fails).
function maxDamageSpellSave(dmgExpr){
  try{ return maxFromTerms(parseDice(dmgExpr), false); }catch{ return 0; }
}
// Probability mass of the sum of positive dice terms.
function pmfDiceSum(terms){
  const dice=[]; for (const t of terms){ if (t.type==='dice'){ if (t.n<0) throw new Error("Savage dice cannot be negative."); for(let i=0;i<t.n;i++) dice.push(t.faces); } }
  if (!dice.length) return new Map([[0,1]]);
  let pmf = new Map([[0,1]]);
  for (const faces of dice){
    const next = new Map();
    for (const [s,p] of pmf.entries()){
      for (let r=1;r<=faces;r++){ const k=s+r; next.set(k,(next.get(k)||0)+p*(1/faces)); }
    }
    pmf = next;
  }
  return pmf;
}
// Helper for Savage Attacker: PMF for doubled dice.
function pmfDoubleDice(terms){ const doubled=terms.map(t=>t.type==='dice'?{type:'dice', n:t.n*2, faces:t.faces}:null).filter(Boolean); return pmfDiceSum(doubled); }
// Compute expectation from a PMF map.
function expectedFromPmf(pmf){ let e=0; for (const [v,p] of pmf.entries()) e+=v*p; return e; }
// PMF of the max of two identical independent distributions.
function pmfMaxOfTwo(pmf){
  const vals=Array.from(pmf.keys()).sort((a,b)=>a-b), probs=vals.map(v=>pmf.get(v)); const F=[]; let a=0;
  for (let i=0;i<vals.length;i++){ a+=probs[i]; F[i]=a; }
  const out=new Map();
  for (let i=0;i<vals.length;i++){ out.set(vals[i], Math.pow(F[i],2)-Math.pow(i?F[i-1]:0,2)); }
  return out;
}
// Expected value delta from Savage Attacker for a dice expression.
function deltaSavageForExpr(expr, isCrit){
  const terms = parseDice(expr).filter(t=>t.type==='dice' && t.n>0);
  if (!terms.length) return 0;
  const pmfBase = isCrit ? pmfDoubleDice(terms) : pmfDiceSum(terms);
  return expectedFromPmf(pmfMaxOfTwo(pmfBase)) - expectedFromPmf(pmfBase);
}

/************ DPR UI + state ************/
const els = {
  atkBonus: document.getElementById("atkBonus"), targetAC: document.getElementById("targetAC"), advantage: document.getElementById("advantage"),
  halflingLuck: document.getElementById("halflingLuck"), critStart: document.getElementById("critStart"), damageExpr: document.getElementById("damageExpr"),
  calcOne: document.getElementById("calcOne"), addAttack: document.getElementById("addAttack"), oneResult: document.getElementById("oneResult"),
  pHit: document.getElementById("pHit"), pCrit: document.getElementById("pCrit"), avgOnHit: document.getElementById("avgOnHit"), avgOnCrit: document.getElementById("avgOnCrit"), expDmg: document.getElementById("expDmg"), parseInfo: document.getElementById("parseInfo"),
  addBlank: document.getElementById("addBlank"), addSpell: document.getElementById("addSpell"), clearRound: document.getElementById("clearRound"),
  roundList: document.getElementById("roundList"), roundTotal: document.getElementById("roundTotal"), roundCount: document.getElementById("roundCount"), roundSpellCount: document.getElementById("roundSpellCount"), roundSummary: document.getElementById("roundSummary"), breakdown: document.getElementById("breakdown"), toggleBreakdown: document.getElementById("toggleBreakdown"),
  oneBonusExpr: document.getElementById("oneBonusExpr"), oneBonusOn: document.getElementById("oneBonusOn"), oneBonusCrit: document.getElementById("oneBonusCrit"),
  savageOn: document.getElementById("savageOn"), savageStrat: document.getElementById("savageStrat"),
  avgExpr: document.getElementById("avgExpr"), calcAvg: document.getElementById("calcAvg"), avgResult: document.getElementById("avgResult"), avgValue: document.getElementById("avgValue"), avgDice: document.getElementById("avgDice"), avgFlat: document.getElementById("avgFlat"), avgBreak: document.getElementById("avgBreak")
};
// Format decimal as percentage string.
function fmtPct(x){ return (x*100).toFixed(1)+"%"; }
// Format number with two decimals.
function fmtNum(x){ return Number(x).toFixed(2); }

const round = []; // items: attacks/spells
let gwmProfileIndex = -1;
let cleaveProfileIndex = -1;

// Persist DPR settings to local storage
function saveDPRState(){
  const state = {
    atkBonus: els.atkBonus.value,
    targetAC: els.targetAC.value,
    advantage: els.advantage.value,
    halflingLuck: els.halflingLuck.value,
    critStart: els.critStart.value,
    damageExpr: els.damageExpr.value,
    oneBonusExpr: els.oneBonusExpr.value,
    oneBonusOn: els.oneBonusOn.value,
    oneBonusCrit: els.oneBonusCrit.value,
    savageOn: els.savageOn.value,
    savageStrat: els.savageStrat.value,
    round,
    gwmProfileIndex,
    cleaveProfileIndex
  };
  try{ localStorage.setItem('dprState', JSON.stringify(state)); }catch{}
}

function loadDPRState(){
  try{
    const data = JSON.parse(localStorage.getItem('dprState'));
    if(!data) return;
    els.atkBonus.value = data.atkBonus ?? els.atkBonus.value;
    els.targetAC.value = data.targetAC ?? els.targetAC.value;
    els.advantage.value = data.advantage ?? els.advantage.value;
    els.halflingLuck.value = data.halflingLuck ?? els.halflingLuck.value;
    els.critStart.value = data.critStart ?? els.critStart.value;
    els.damageExpr.value = data.damageExpr ?? els.damageExpr.value;
    els.oneBonusExpr.value = data.oneBonusExpr ?? '';
    els.oneBonusOn.value = data.oneBonusOn ?? 'off';
    els.oneBonusCrit.value = data.oneBonusCrit ?? 'on';
    els.savageOn.value = data.savageOn ?? 'off';
    els.savageStrat.value = data.savageStrat ?? 'preferCrits';
    round.splice(0, round.length, ...((data.round)||[]));
    gwmProfileIndex = data.gwmProfileIndex ?? -1;
    cleaveProfileIndex = data.cleaveProfileIndex ?? -1;
  }catch{}
}

// Extract only positive dice terms (e.g., "2d6" from full expression).
function extractDiceOnly(expr){
  try{ const terms = parseDice(expr).filter(t=>t.type==='dice' && t.n>0); if (!terms.length) return ""; return terms.map(t=>`${t.n}d${t.faces}`).join("+"); }catch{ return ""; }
}

// Add a default attack entry to the round composer.
function addAttackItem(item){
  const dmg = (item && item.dmg) || '1d8+3';
  let abilityMod = 0;
  try{ abilityMod = averageDiceTerms(parseDice(dmg)).flat; }catch{}
  round.push(Object.assign({
    kind:'attack', atk:5, ac:15, mode:'normal', halfling:false, crit:20, dmg,
    heavy:false, savageDice: extractDiceOnly(dmg),
    critBonusDice:"", critBonusFlat:0, critBonusDiceDouble:false,
    cleave:false, graze:false, vex:false,
    gwmOnly:false, cleaveOnly:false,
    abilityMod
  }, item||{})); renderRound();
}
// Add a spell entry to the round composer.
function addSpellItem(item){ round.push(Object.assign({ kind:'spell', dc:15, saveBonus:3, saveMode:'normal', successRule:'half', dmg:'3d8' }, item||{})); renderRound(); }

// Render HTML for an attack card.
function attackCard(idx,item){
  const isGwmProfile = (gwmProfileIndex===idx);
  const isCleaveProfile = (cleaveProfileIndex===idx);
  return `
  <div class="card" data-idx="${idx}" data-kind="attack" style="margin-bottom:10px;">
    <div class="row between"><div><b>Attack</b></div><div class="small">(#${idx+1})</div></div>
    <div class="grid">
      <div class="col1"><label>+Hit</label><input type="number" data-field="atk" value="${item.atk}"/></div>
      <div class="col1"><label>AC</label><input type="number" data-field="ac" value="${item.ac}"/></div>
      <div class="col3"><label>Roll Mode</label><select data-field="mode"><option value="normal" ${item.mode==='normal'?'selected':''}>Normal</option><option value="adv" ${item.mode==='adv'?'selected':''}>Advantage</option><option value="elven" ${item.mode==='elven'?'selected':''}>Elven Accuracy</option><option value="dis" ${item.mode==='dis'?'selected':''}>Disadvantage</option></select></div>
      <div class="col2"><label>Halfling Luck</label><select data-field="halfling"><option value="false" ${!item.halfling?'selected':''}>Off</option><option value="true" ${item.halfling?'selected':''}>On</option></select></div>
      <div class="col1"><label>Crit ≥</label><select data-field="crit"><option value="20" ${item.crit===20?'selected':''}>20</option><option value="19" ${item.crit===19?'selected':''}>19</option><option value="18" ${item.crit===18?'selected':''}>18</option></select></div>
      <div class="col1"><label class="inline">Heavy? <span class="tip"><span class="tipdot">i</span><span class="tipbox small">Only <b>Heavy</b> melee attacks can trigger GWM bonus attack on a crit.</span></span></label><select data-field="heavy"><option value="false" ${!item.heavy?'selected':''}>No</option><option value="true" ${item.heavy?'selected':''}>Yes</option></select></div>
      <div class="col1"><label>Cleave</label><select data-field="cleave"><option value="false" ${!item.cleave?'selected':''}>Off</option><option value="true" ${item.cleave?'selected':''}>On</option></select></div>
      <div class="col1"><label>Graze</label><select data-field="graze"><option value="false" ${!item.graze?'selected':''}>Off</option><option value="true" ${item.graze?'selected':''}>On</option></select></div>
      <div class="col1"><label>Vex</label><select data-field="vex"><option value="false" ${!item.vex?'selected':''}>Off</option><option value="true" ${item.vex?'selected':''}>On</option></select></div>
      <div class="col6"><label class="inline">GWM bonus uses this attack ${isGwmProfile?'<span class="small">(selected)</span>':''}<span class="tip"><span class="tipdot">i</span><span class="tipbox small">If none selected, it uses the triggering Heavy attack.</span></span></label><div class="row"><button class="btn" data-action="setProfile">${isGwmProfile?'Unset':'Set as GWM profile'}</button></div></div>
      <div class="col6"><label class="inline">Cleave uses this attack ${isCleaveProfile?'<span class="small">(selected)</span>':''}</label><div class="row"><button class="btn" data-action="setCleaveProfile">${isCleaveProfile?'Unset':'Set as Cleave profile'}</button></div></div>
      <div class="col6"><label>Damage</label><input type="text" class="mono" data-field="dmg" value="${item.dmg}"/></div>
      <div class="col3"><label class="inline">Weapon Dice (Savage) — dice only<span class="tip"><span class="tipdot">i</span><span class="tipbox small">Include only the weapon’s dice (e.g., 1d8). We auto-fill from Damage; override as needed.</span></span></label><input type="text" class="mono" data-field="savageDice" placeholder="e.g., 1d8 or 2d6+1d4" value="${item.savageDice||''}"/></div>
      <div class="col3"><label>Ability Mod (Graze)</label><input type="number" data-field="abilityMod" value="${item.abilityMod||0}"/></div>
      <div class="col3"><label>On Crit: Extra Dice</label><input type="text" class="mono" data-field="critBonusDice" placeholder="e.g., 1d8" value="${item.critBonusDice||''}"/></div>
      <div class="col2"><label>Dice double on crit?</label><select data-field="critBonusDiceDouble"><option value="false" ${!item.critBonusDiceDouble?'selected':''}>No</option><option value="true" ${item.critBonusDiceDouble?'selected':''}>Yes</option></select></div>
      <div class="col2"><label>On Crit: Extra Flat</label><input type="number" data-field="critBonusFlat" value="${item.critBonusFlat||0}"/></div>
      <div class="col2"><label>Only for GWM?</label><select data-field="gwmOnly"><option value="false" ${!item.gwmOnly?'selected':''}>No</option><option value="true" ${item.gwmOnly?'selected':''}>Yes</option></select></div>
      <div class="col2"><label>Only for Cleave?</label><select data-field="cleaveOnly"><option value="false" ${!item.cleaveOnly?'selected':''}>No</option><option value="true" ${item.cleaveOnly?'selected':''}>Yes</option></select></div>
    </div>
    <div class="row" style="margin-top:8px;">
      <span class="tag"><span class="small">P(hit)</span> <b class="mono" data-show="phit"></b></span>
      <span class="tag"><span class="small">P(crit)</span> <b class="mono" data-show="pcrit"></b></span>
      <span class="tag"><span class="small">Exp dmg</span> <b class="mono" data-show="expected"></b></span>
      <span class="tag" title="Savage Attacker delta on a normal hit"><span class="small">Savage Δ (hit)</span> <b class="mono" data-show="savHit"></b></span>
      <span class="tag" title="Savage Attacker delta on a critical hit"><span class="small">Savage Δ (crit)</span> <b class="mono" data-show="savCrit"></b></span>
    </div>
    <div class="row" style="margin-top:4px;gap:8px;">
      <button class="btn" data-action="recalc">Recalc</button>
      <button class="btn" data-action="duplicate">Duplicate</button>
      <button class="btn" data-action="toRoller">To Roller</button>
      <button class="btn danger" data-action="remove">Remove</button>
    </div>
    <div class="foot small mono" data-show="detail"></div>
  </div>`;
}
// Render HTML for a spell card.
function spellCard(idx,item){
  return `
  <div class="card" data-idx="${idx}" data-kind="spell" style="margin-bottom:10px;">
    <div class="row between"><div><b>Spell (Save)</b></div><div class="small">(#${idx+1})</div></div>
    <div class="grid">
      <div class="col2"><label>DC</label><input type="number" data-field="dc" value="${item.dc}"/></div>
      <div class="col2"><label>Target Save Bonus</label><input type="number" data-field="saveBonus" value="${item.saveBonus}"/></div>
      <div class="col3"><label>Save Mode</label><select data-field="saveMode"><option value="normal" ${item.saveMode==='normal'?'selected':''}>Normal</option><option value="adv" ${item.saveMode==='adv'?'selected':''}>Advantage (Magic Resistance)</option><option value="dis" ${item.saveMode==='dis'?'selected':''}>Disadvantage</option></select></div>
      <div class="col3"><label>Success Outcome</label><select data-field="successRule"><option value="half" ${item.successRule==='half'?'selected':''}>Half on success</option><option value="none" ${item.successRule==='none'?'selected':''}>None on success</option></select></div>
      <div class="col12"><label>Damage (no crits)</label><input type="text" class="mono" data-field="dmg" value="${item.dmg}"/></div>
    </div>
    <div class="row" style="margin-top:8px;">
      <span class="tag"><span class="small">P(success)</span> <b class="mono" data-show="psucc"></b></span>
      <span class="tag"><span class="small">P(fail)</span> <b class="mono" data-show="pfail"></b></span>
      <span class="tag"><span class="small">Exp dmg</span> <b class="mono" data-show="expected"></b></span>
      <button class="btn" data-action="recalc">Recalc</button>
      <button class="btn" data-action="toRoller">To Roller</button>
      <button class="btn danger" data-action="remove">Remove</button>
    </div>
    <div class="foot small mono" data-show="detail"></div>
  </div>`;
}
// Re-render the round composer list and summary.
function renderRound(){
  els.roundList.innerHTML = round.map((it,idx)=> it.kind==='attack'?attackCard(idx,it):spellCard(idx,it)).join("");
  els.roundList.querySelectorAll(".card").forEach(card=>{
    const idx = Number(card.getAttribute("data-idx"));
    const kind= card.getAttribute("data-kind");

    card.addEventListener("input",(e)=>{
      const field = e.target.getAttribute("data-field"); if(!field) return;
      const val = e.target.value; const obj = round[idx];
      if (kind==='attack'){
        if (field==='atk') obj.atk = Number(val);
        if (field==='ac') obj.ac = Number(val);
        if (field==='mode') obj.mode = val;
        if (field==='halfling') obj.halfling = (val==="true");
        if (field==='crit') obj.crit = Number(val);
        if (field==='dmg') { obj.dmg = val; if (!obj.savageDice) obj.savageDice = extractDiceOnly(val); }
        if (field==='savageDice') obj.savageDice = val;
        if (field==='abilityMod') obj.abilityMod = Number(val||0);
        if (field==='heavy') obj.heavy = (val==="true");
        if (field==='cleave') obj.cleave = (val==="true");
        if (field==='graze') obj.graze = (val==="true");
        if (field==='vex') obj.vex = (val==="true");
        if (field==='gwmOnly') obj.gwmOnly = (val==="true");
        if (field==='cleaveOnly') obj.cleaveOnly = (val==="true");
        if (field==='critBonusDice') obj.critBonusDice = val;
        if (field==='critBonusFlat') obj.critBonusFlat = Number(val||0);
        if (field==='critBonusDiceDouble') obj.critBonusDiceDouble = (val==="true");
      } else {
        if (field==='dc') obj.dc = Number(val);
        if (field==='saveBonus') obj.saveBonus = Number(val);
        if (field==='saveMode') obj.saveMode = val;
        if (field==='successRule') obj.successRule = val;
        if (field==='dmg') obj.dmg = val;
      }
      recomputeRound();
    });

    const setBtn = card.querySelector('[data-action="setProfile"]');
    if (setBtn){ setBtn.addEventListener("click",()=>{ const current=(gwmProfileIndex===idx); gwmProfileIndex=current?-1:idx; renderRound(); recomputeRound(); }); }
    const setCleaveBtn = card.querySelector('[data-action="setCleaveProfile"]');
    if (setCleaveBtn){ setCleaveBtn.addEventListener("click",()=>{ const current=(cleaveProfileIndex===idx); cleaveProfileIndex=current?-1:idx; renderRound(); recomputeRound(); }); }
    card.querySelector('[data-action="remove"]').addEventListener("click",()=>{ round.splice(idx,1); if (gwmProfileIndex===idx) gwmProfileIndex=-1; if (gwmProfileIndex>idx) gwmProfileIndex--; if (cleaveProfileIndex===idx) cleaveProfileIndex=-1; if (cleaveProfileIndex>idx) cleaveProfileIndex--; renderRound(); recomputeRound(); });
    const dupBtn = card.querySelector('[data-action="duplicate"]');
    if (dupBtn){ dupBtn.addEventListener("click",()=>{ const copy = JSON.parse(JSON.stringify(round[idx])); round.splice(idx+1,0,copy); if (gwmProfileIndex>idx) gwmProfileIndex++; if (cleaveProfileIndex>idx) cleaveProfileIndex++; renderRound(); recomputeRound(); }); }
    const toRollBtn = card.querySelector('[data-action="toRoller"]');
    if (toRollBtn){
      toRollBtn.addEventListener("click",()=>{
        const item = round[idx];
        if(item.kind==='spell') sendSpellToRoller(item);
        else sendAttackToRoller(item);
      });
    }
    const recalcBtn = card.querySelector('[data-action="recalc"]');
    if (recalcBtn){ recalcBtn.addEventListener("click",()=>{ recalcCard(card, round[idx]); recomputeRound(); }); }
    recalcCard(card, round[idx]);
  });
  recomputeRound();
}
// Recalculate expected damage for an individual card.
function recalcCard(card, item){
  try{
    if (item.kind==='attack'){
      const out = expectedDamageAttack(item.dmg, item.crit, item.mode, item.halfling, item.atk, item.ac, item.critBonusDice, item.critBonusFlat, item.critBonusDiceDouble);
      card.querySelector('[data-show="phit"]').textContent = fmtPct(out.pHit);
      card.querySelector('[data-show="pcrit"]').textContent = fmtPct(out.pCrit);
      card.querySelector('[data-show="expected"]').textContent = fmtNum(out.expected);
      let dH=0, dC=0; const src = (item.savageDice && item.savageDice.trim()) ? item.savageDice : extractDiceOnly(item.dmg);
      if (src){ try{ dH = deltaSavageForExpr(src,false); dC = deltaSavageForExpr(src,true); }catch{} }
      card.querySelector('[data-show="savHit"]').textContent = fmtNum(dH);
      card.querySelector('[data-show="savCrit"]').textContent = fmtNum(dC);
      card.querySelector('[data-show="detail"]').textContent = `Avg on hit ${fmtNum(out.avgOnHit)}, on crit ${fmtNum(out.avgOnCrit)} | mode ${item.mode}${item.halfling?" + Halfling Luck":""}, crit ≥ ${item.crit}`;
    } else {
      const out = expectedDamageSpellSave(item.dmg, item.dc, item.saveBonus, item.successRule, item.saveMode);
      card.querySelector('[data-show="psucc"]').textContent = fmtPct(out.pSuccess);
      card.querySelector('[data-show="pfail"]').textContent = fmtPct(out.pFail);
      card.querySelector('[data-show="expected"]').textContent = fmtNum(out.expected);
      card.querySelector('[data-show="detail"]').textContent = `Avg dmg ${fmtNum(out.avg)} | ${item.successRule==="half"?"half on success":"none on success"} | save=${item.saveMode}`;
    }
    card.style.borderColor = "#2a3142";
  }catch(e){ card.querySelectorAll('[data-show]').forEach(s=>s.textContent="—"); const exp = card.querySelector('[data-show="expected"]'); if (exp) exp.textContent = "Error"; card.querySelector('[data-show="detail"]').textContent = "Error: " + e.message; card.style.borderColor = "#5a2a33"; }
}
// Recompute totals for the entire round.
function applyVexMode(mode, adv){
  if(!adv) return mode;
  if(mode==='dis') return 'normal';
  if(mode==='normal') return 'adv';
  return mode;
}

function recomputeRound(){
  let baseTotal = 0, atkCount=0, spellCount=0;
  const attackStats = [];
  let probAdv = 0;
  let grazeAdd = 0;
  const cleaveProfile = (cleaveProfileIndex>=0 && round[cleaveProfileIndex].kind==='attack')? round[cleaveProfileIndex]:null;
  round.forEach((it, idx)=>{
    if(it.kind==='attack'){
      if(it.gwmOnly || it.cleaveOnly) return;
      const modeAdv = applyVexMode(it.mode,true);
      const outNorm = expectedDamageAttack(it.dmg, it.crit, it.mode, it.halfling, it.atk, it.ac, it.critBonusDice, it.critBonusFlat, it.critBonusDiceDouble);
      const outAdv = expectedDamageAttack(it.dmg, it.crit, modeAdv, it.halfling, it.atk, it.ac, it.critBonusDice, it.critBonusFlat, it.critBonusDiceDouble);
      const wAdv = probAdv; const wNorm = 1-probAdv;
      const exp = wAdv*outAdv.expected + wNorm*outNorm.expected;
      const pHit = wAdv*outAdv.pHit + wNorm*outNorm.pHit;
      const pCrit = wAdv*outAdv.pCrit + wNorm*outNorm.pCrit;
      const pHitNoCrit = pHit - pCrit;
      baseTotal += exp; atkCount++;
      let deltaHit=0, deltaCrit=0; const src=(it.savageDice && it.savageDice.trim())?it.savageDice:extractDiceOnly(it.dmg);
      if(src){ try{ deltaHit=deltaSavageForExpr(src,false); deltaCrit=deltaSavageForExpr(src,true); }catch{} }
      const abilityMod = Number(it.abilityMod||0);
      let cleaveExp=0;
      if(it.cleave){
        if(cleaveProfile){
          const outExtra = expectedDamageAttack(cleaveProfile.dmg, cleaveProfile.crit, cleaveProfile.mode, cleaveProfile.halfling, cleaveProfile.atk, cleaveProfile.ac, cleaveProfile.critBonusDice, cleaveProfile.critBonusFlat, cleaveProfile.critBonusDiceDouble);
          cleaveExp = outExtra.expected;
        } else if(src){
          const outExtra = expectedDamageAttack(src, it.crit, it.mode, it.halfling, it.atk, it.ac, "",0,false);
          cleaveExp = outExtra.expected;
          if(abilityMod<0) cleaveExp += abilityMod*outExtra.pHit;
        }
      }
      attackStats.push({ ...it, pHit, pCrit, pHitNoCrit, expBase:exp, deltaHit, deltaCrit, cleaveExp });
      if(it.graze) grazeAdd += abilityMod * (1 - pHit);

      const card = els.roundList.querySelector(`.card[data-idx="${idx}"]`);
      if(card){
        card.querySelector('[data-show="phit"]').textContent = fmtPct(pHit);
        card.querySelector('[data-show="pcrit"]').textContent = fmtPct(pCrit);
        card.querySelector('[data-show="expected"]').textContent = fmtNum(exp);
      }

      if(it.vex) probAdv = wAdv*outAdv.pHit + wNorm*outNorm.pHit; else probAdv = 0;
    } else {
      const s = expectedDamageSpellSave(it.dmg, it.dc, it.saveBonus, it.successRule, it.saveMode);
      baseTotal += s.expected; spellCount++;
    }
  });
  let cleaveAdd=0; let prodNoHit=1;
  for(const st of attackStats){
    if(st.cleave && st.cleaveExp){
      cleaveAdd += prodNoHit * st.pHit * st.cleaveExp;
      prodNoHit *= (1 - st.pHit);
    }
  }
  let bonusOnce=0;
  if(document.getElementById("oneBonusOn").value==="on" && document.getElementById("oneBonusExpr").value.trim()){
    try{
      const bonusTerms=parseDice(document.getElementById("oneBonusExpr").value);
      const avg=averageDiceTerms(bonusTerms);
      const avgOnHit=avg.diceAvg+avg.flat;
      const avgOnCrit=(document.getElementById("oneBonusCrit").value==="on"?(avg.diceAvg*2):avg.diceAvg)+avg.flat;
      let prodNoHit=1;
      for(const st of attackStats){
        bonusOnce += prodNoHit * (st.pHitNoCrit*avgOnHit + st.pCrit*avgOnCrit);
        prodNoHit *= (1 - (st.pHitNoCrit + st.pCrit));
      }
    }catch{}
  }
  let savageAdd=0;
  const savageOn=document.getElementById("savageOn").value==="on";
  if(savageOn && attackStats.length){
    if(document.getElementById("savageStrat").value==="firstHit"){
      let prodNoHit=1;
      for(const st of attackStats){
        savageAdd += prodNoHit * (st.pCrit*st.deltaCrit + st.pHitNoCrit*st.deltaHit);
        prodNoHit *= (1 - (st.pHitNoCrit + st.pCrit));
      }
    } else {
      let prodNoCrit=1, eCrit=0;
      for(const st of attackStats){ eCrit += prodNoCrit * st.pCrit * st.deltaCrit; prodNoCrit *= (1 - st.pCrit); }
      let prodNoHitNoCrit=1, eHit=0;
      for(const st of attackStats){ eHit += prodNoHitNoCrit * st.pHitNoCrit * st.deltaHit; prodNoHitNoCrit *= (1 - st.pHitNoCrit); }
      savageAdd = eCrit + (prodNoCrit * eHit);
    }
  }
  let gwmAdd=0;
  const heavyList=attackStats.filter(a=>a.heavy);
  if(heavyList.length){
    let prodNoCrit=1;
    const profile=(gwmProfileIndex>=0 && gwmProfileIndex<round.length && round[gwmProfileIndex].kind==='attack')?round[gwmProfileIndex]:null;
    for(const st of heavyList){
      const pFirst=prodNoCrit * st.pCrit;
      if(profile){
        const out=expectedDamageAttack(profile.dmg, profile.crit, profile.mode, profile.halfling, profile.atk, profile.ac, profile.critBonusDice, profile.critBonusFlat, profile.critBonusDiceDouble);
        gwmAdd += pFirst * out.expected;
      } else {
        gwmAdd += pFirst * st.expBase;
      }
      prodNoCrit *= (1 - st.pCrit);
    }
  }
  // Maximum damage if all dice roll their maximum values
  let maxTotal = 0; let gwmUsed=false;
  const gwmProfile = (gwmProfileIndex>=0 && round[gwmProfileIndex].kind==='attack')? round[gwmProfileIndex]:null;
  const cleaveProfileMax = (cleaveProfileIndex>=0 && round[cleaveProfileIndex].kind==='attack')? round[cleaveProfileIndex]:null;
  round.forEach(it=>{
    if(it.kind==='attack'){
      if(it.gwmOnly || it.cleaveOnly) return;
      maxTotal += maxDamageAttack(it.dmg, it.critBonusDice, it.critBonusFlat, it.critBonusDiceDouble);
      if(it.cleave){
        let extra=0;
        if(cleaveProfileMax){
          extra = maxDamageAttack(cleaveProfileMax.dmg, cleaveProfileMax.critBonusDice, cleaveProfileMax.critBonusFlat, cleaveProfileMax.critBonusDiceDouble);
        } else {
          const src=(it.savageDice && it.savageDice.trim())?it.savageDice:extractDiceOnly(it.dmg);
          if(src) extra = maxFromTerms(parseDice(src), true);
        }
        maxTotal += extra;
      }
      if(it.heavy && !gwmUsed){
        let extra=0;
        if(gwmProfile){
          extra = maxDamageAttack(gwmProfile.dmg, gwmProfile.critBonusDice, gwmProfile.critBonusFlat, gwmProfile.critBonusDiceDouble);
        } else {
          extra = maxDamageAttack(it.dmg, it.critBonusDice, it.critBonusFlat, it.critBonusDiceDouble);
        }
        maxTotal += extra; gwmUsed=true;
      }
    } else if(it.kind==='spell'){
      maxTotal += maxDamageSpellSave(it.dmg);
    }
  });
  if(document.getElementById("oneBonusOn").value==="on" && document.getElementById("oneBonusExpr").value.trim()){
    try{ const t=parseDice(document.getElementById("oneBonusExpr").value); maxTotal += maxFromTerms(t, document.getElementById("oneBonusCrit").value==="on"); }catch{}
  }
  const total = baseTotal + bonusOnce + savageAdd + gwmAdd + cleaveAdd + grazeAdd;
  document.getElementById("roundSummary").style.display = (atkCount+spellCount) ? "" : "none";
  document.getElementById("roundTotal").textContent = total.toFixed(2);
  document.getElementById("roundCount").textContent = String(atkCount);
  document.getElementById("roundSpellCount").textContent = String(spellCount);
  document.getElementById("breakdown").innerHTML =
    `Base (attacks+spells): <b>${baseTotal.toFixed(2)}</b><br>`+
    `+ Once-per-round bonus: <b>${bonusOnce.toFixed(2)}</b><br>`+
    `+ Savage Attacker: <b>${savageAdd.toFixed(2)}</b><br>`+
    `+ GWM bonus attack: <b>${gwmAdd.toFixed(2)}</b><br>`+
    `+ Cleave extra attack: <b>${cleaveAdd.toFixed(2)}</b><br>`+
    `+ Graze damage on miss: <b>${grazeAdd.toFixed(2)}</b><br>`+
    `<span class="muted">= Total</span> <b>${total.toFixed(2)}</b><br>`+
    `Max (all dice max): <b>${maxTotal.toFixed(2)}</b>`;
  saveDPRState();
}
// Display single-attack results on the page.
function showOne(){
  try{
    const out = expectedDamageAttack(
      document.getElementById("damageExpr").value,
      Number(document.getElementById("critStart").value),
      document.getElementById("advantage").value,
      document.getElementById("halflingLuck").value==="on",
      Number(document.getElementById("atkBonus").value||0),
      Number(document.getElementById("targetAC").value||0)
    );
    document.getElementById("oneResult").style.display="";
    document.getElementById("pHit").textContent = (out.pHit*100).toFixed(1)+"%";
    document.getElementById("pCrit").textContent = (out.pCrit*100).toFixed(1)+"%";
    document.getElementById("avgOnHit").textContent = out.avgOnHit.toFixed(2);
    document.getElementById("avgOnCrit").textContent = out.avgOnCrit.toFixed(2);
    document.getElementById("expDmg").textContent = out.expected.toFixed(2);
    const avgParts = averageDiceTerms(parseDice(document.getElementById("damageExpr").value));
    document.getElementById("parseInfo").textContent =
      `Parsed: ${avgParts.detail}  |  Dice avg=${avgParts.diceAvg.toFixed(2)}, Flat=${avgParts.flat.toFixed(2)}  |  Mode: ${document.getElementById("advantage").value}${document.getElementById("halflingLuck").value==="on"?" + Halfling Luck":""}, Crit ≥ ${Number(document.getElementById("critStart").value)}`;
  }catch(e){
    document.getElementById("oneResult").style.display="none";
    document.getElementById("parseInfo").textContent="Error: "+e.message;
  }
}
document.getElementById("calcOne").addEventListener("click", showOne);
document.getElementById("addAttack").addEventListener("click", ()=> addAttackItem({
  atk:Number(document.getElementById("atkBonus").value||0),
  ac:Number(document.getElementById("targetAC").value||0),
  mode:document.getElementById("advantage").value,
  halfling:(document.getElementById("halflingLuck").value==="on"),
  crit:Number(document.getElementById("critStart").value),
  dmg:document.getElementById("damageExpr").value,
  abilityMod:(()=>{try{ return averageDiceTerms(parseDice(document.getElementById("damageExpr").value)).flat; }catch{return 0;}})()
}));
document.getElementById("addBlank").addEventListener("click", ()=> addAttackItem());
document.getElementById("addSpell").addEventListener("click", ()=> addSpellItem());
document.getElementById("clearRound").addEventListener("click", ()=>{ round.splice(0,round.length); gwmProfileIndex=-1; cleaveProfileIndex=-1; renderRound(); recomputeRound(); localStorage.removeItem('dprState'); });
["oneBonusExpr","oneBonusOn","oneBonusCrit","savageOn","savageStrat"].forEach(id=>document.getElementById(id).addEventListener("input",recomputeRound));
["oneBonusOn","oneBonusCrit","savageOn","savageStrat"].forEach(id=>document.getElementById(id).addEventListener("change",recomputeRound));
document.getElementById("toggleBreakdown").addEventListener("click", ()=>{
  const el = document.getElementById("breakdown");
  el.style.display = (el.style.display==="none"||!el.style.display) ? "block" : "none";
  document.getElementById("toggleBreakdown").textContent = el.style.display==="none" ? "Show breakdown" : "Hide breakdown";
});
document.getElementById("calcAvg").addEventListener("click", ()=>{
  const expr = document.getElementById("avgExpr").value;
  try{
    const terms = parseDice(expr);
    const avg = averageDiceTerms(terms);
    document.getElementById("avgResult").style.display = "";
    document.getElementById("avgValue").textContent = avg.total.toFixed(4);
    document.getElementById("avgDice").textContent = avg.diceAvg.toFixed(4);
    document.getElementById("avgFlat").textContent = avg.flat.toFixed(4);
    document.getElementById("avgBreak").textContent = `Parsed: ${avg.detail}`;
  }catch(e){
    document.getElementById("avgResult").style.display="none";
    document.getElementById("avgBreak").textContent="Error: "+e.message;
  }
});
['atkBonus','targetAC','advantage','halflingLuck','critStart','damageExpr'].forEach(id=>{
  const el=document.getElementById(id);
  el.addEventListener('input', saveDPRState);
  el.addEventListener('change', saveDPRState);
});
(function initDPR(){ loadDPRState(); showOne(); renderRound(); const el=document.getElementById("breakdown"); el.style.display="none"; document.getElementById("toggleBreakdown").textContent="Show breakdown"; })();

