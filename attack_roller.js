/************ Attack Roller ************/
const rollerItems = [];
function saveRollerState(){ try{ localStorage.setItem('rollerState', JSON.stringify(rollerItems)); }catch{} }
function loadRollerState(){
  try{
    const data = JSON.parse(localStorage.getItem('rollerState'));
    if(Array.isArray(data)) rollerItems.splice(0,rollerItems.length,...data.map(it=>{
      if(!it.kind) it = Object.assign({kind:'attack'},it);
      if(it.kind==='attack'){
        if(it.ac===undefined) it.ac=15;
        it.vex=!!it.vex; it.heavy=!!it.heavy; it.graze=!!it.graze;
        if(it.abilityMod===undefined) it.abilityMod=0;
      }
      return it;
    }));
  }catch{}
}
function rollerAttackCard(idx,item){ return `
  <div class="card" data-idx="${idx}" data-kind="attack" style="margin-bottom:10px;">
    <div class="grid">
      <div class="col2"><label>+Hit</label><input type="number" data-field="atk" value="${item.atk}"/></div>
      <div class="col2"><label>Target AC</label><input type="number" data-field="ac" value="${item.ac!==undefined?item.ac:15}"/></div>
      <div class="col3"><label>Roll Mode</label><select data-field="mode"><option value="normal" ${item.mode==='normal'?'selected':''}>Normal</option><option value="adv" ${item.mode==='adv'?'selected':''}>Advantage</option><option value="elven" ${item.mode==='elven'?'selected':''}>Elven Accuracy</option><option value="dis" ${item.mode==='dis'?'selected':''}>Disadvantage</option></select></div>
      <div class="col1"><label>Halfling</label><select data-field="halfling"><option value="false" ${!item.halfling?'selected':''}>Off</option><option value="true" ${item.halfling?'selected':''}>On</option></select></div>
      <div class="col1"><label>Crit ≥</label><select data-field="crit" class="crit-select"><option value="20" ${item.crit===20?'selected':''}>20</option><option value="19" ${item.crit===19?'selected':''}>19</option><option value="18" ${item.crit===18?'selected':''}>18</option></select></div>
      <div class="col1"><label>Vex</label><select data-field="vex"><option value="false" ${!item.vex?'selected':''}>Off</option><option value="true" ${item.vex?'selected':''}>On</option></select></div>
      <div class="col1"><label>GWM?</label><select data-field="heavy"><option value="false" ${!item.heavy?'selected':''}>Off</option><option value="true" ${item.heavy?'selected':''}>On</option></select></div>
      <div class="col1"><label>Graze</label><select data-field="graze"><option value="false" ${!item.graze?'selected':''}>Off</option><option value="true" ${item.graze?'selected':''}>On</option></select></div>
      <div class="col3"><label>Ability Mod (Graze)</label><input type="number" data-field="abilityMod" value="${item.abilityMod||0}"/></div>
      <div class="col9"><label>Damage</label><input type="text" class="mono" data-field="dmg" value="${item.dmg}"/></div>
      <div class="col4"><label>Crit Bonus Dice</label><input type="text" class="mono" data-field="critBonusDice" value="${item.critBonusDice||''}"/></div>
      <div class="col2"><label>Dice double?</label><select data-field="critBonusDiceDouble"><option value="false" ${!item.critBonusDiceDouble?'selected':''}>No</option><option value="true" ${item.critBonusDiceDouble?'selected':''}>Yes</option></select></div>
      <div class="col2"><label>Crit Bonus Flat</label><input type="number" data-field="critBonusFlat" value="${item.critBonusFlat||0}"/></div>
    </div>
    <div class="row" style="margin-top:8px;gap:8px;">
      <button class="btn" data-act="roll">Roll</button>
      <button class="btn danger" data-act="remove">Remove</button>
    </div>
    <div class="foot mono" data-show="result"></div>
  </div>`; }
function rollerSpellCard(idx,item){ return `
  <div class="card" data-idx="${idx}" data-kind="spell" style="margin-bottom:10px;">
    <div class="grid">
      <div class="col2"><label>DC</label><input type="number" data-field="dc" value="${item.dc}"/></div>
      <div class="col2"><label>Target Save Bonus</label><input type="number" data-field="saveBonus" value="${item.saveBonus}"/></div>
      <div class="col3"><label>Save Mode</label><select data-field="saveMode"><option value="normal" ${item.saveMode==='normal'?'selected':''}>Normal</option><option value="adv" ${item.saveMode==='adv'?'selected':''}>Advantage</option><option value="dis" ${item.saveMode==='dis'?'selected':''}>Disadvantage</option></select></div>
      <div class="col3"><label>Success Outcome</label><select data-field="successRule"><option value="half" ${item.successRule==='half'?'selected':''}>Half on success</option><option value="none" ${item.successRule==='none'?'selected':''}>None on success</option></select></div>
      <div class="col12"><label>Damage (no crits)</label><input type="text" class="mono" data-field="dmg" value="${item.dmg}"/></div>
    </div>
    <div class="row" style="margin-top:8px;gap:8px;">
      <button class="btn" data-act="roll">Roll</button>
      <button class="btn danger" data-act="remove">Remove</button>
    </div>
    <div class="foot mono" data-show="result"></div>
  </div>`; }
function renderRoller(){
  const root=document.getElementById('rollerList');
  root.innerHTML=rollerItems.map((it,idx)=> it.kind==='spell'?rollerSpellCard(idx,it):rollerAttackCard(idx,it)).join('');
  root.querySelectorAll('.card').forEach(card=>{
    const idx=Number(card.getAttribute('data-idx'));
    const obj=rollerItems[idx];
    const kind=obj.kind;
    card.querySelectorAll('[data-field]').forEach(inp=>{
      inp.addEventListener('input',()=>{
        const field=inp.getAttribute('data-field');
        let val=inp.value;
        if(kind==='attack' && ['atk','crit','critBonusFlat','ac','abilityMod'].includes(field)) val=Number(val||0);
        if(kind==='spell' && ['dc','saveBonus'].includes(field)) val=Number(val||0);
        if(kind==='attack' && ['halfling','critBonusDiceDouble','vex','graze','heavy'].includes(field)) val=(val==='true');
        obj[field]=val; saveRollerState();
      });
    });
    card.querySelector('[data-act="roll"]').addEventListener('click',()=>{ (kind==='spell'?rollSpell:rollAttack)(obj,card); });
    card.querySelector('[data-act="remove"]').addEventListener('click',()=>{ rollerItems.splice(idx,1); renderRoller(); saveRollerState(); });
  });
  saveRollerState();
}
function fmtRoll(r){ return r.parts.map(p=>p.type==='flat'?p.value:p.rolls.join('+')).join('+')+"="+r.total; }
function rollAttack(att,card){
  const d20=rollD20ModeDetailed(att.mode, att.halfling);
  const total=d20.result+att.atk;
  const crit=(d20.result>=att.crit);
  let hit;
  if(d20.result===1) hit=false;
  else if(d20.result===20) hit=true;
  else hit=(total>=att.ac);

  let dmgTotal=0, detail=[];
  if(hit){
    const base=rollDiceExprDetailed(att.dmg); dmgTotal+=base.total; detail.push(`base(${fmtRoll(base)})`);
    if(crit){
      const extra=rollDiceExprDetailed(att.dmg); dmgTotal+=extra.total; detail.push(`critExtra(${fmtRoll(extra)})`);
      if(att.critBonusDice){ const b1=rollDiceExprDetailed(att.critBonusDice); dmgTotal+=b1.total; detail.push(`critBonus(${fmtRoll(b1)})`); if(att.critBonusDiceDouble){ const b2=rollDiceExprDetailed(att.critBonusDice); dmgTotal+=b2.total; detail.push(`critBonus2(${fmtRoll(b2)})`); } }
      if(att.critBonusFlat){ dmgTotal+=Number(att.critBonusFlat); detail.push(`+${att.critBonusFlat}`); }
    }
  } else {
    if(att.graze){
      dmgTotal += Number(att.abilityMod||0);
      detail.push(`graze(${att.abilityMod||0})`);
    } else {
      detail.push('miss');
    }
  }
  const parts=`d20[${d20.rolls.join(',')}] + ${att.atk} = ${total} vs AC ${att.ac}`;
  const tags=[];
  if(hit && att.vex) tags.push('<span class="tag">Vex ready</span>');
  if(crit && att.heavy) tags.push('<span class="tag">GWM ready</span>');
  if(!hit && att.graze) tags.push('<span class="tag">Graze</span>');
  const tagHtml = tags.length? `<div class="row" style="gap:4px;">${tags.join(' ')}</div>` : '';
  const res=`<div class="row between"><div><span class="roll-main">To Hit: ${total}${crit?' (CRIT)':''}${hit?' (HIT)':' (MISS)'}</span> <span class="small">(${parts})</span></div>${tagHtml}</div><div><span class="roll-main">Damage: ${dmgTotal}</span> <span class="small">(${detail.join(' + ')})</span></div>`;
  card.querySelector('[data-show="result"]').innerHTML=res;
}
function rollSpell(sp,card){
  const d20=rollD20ModeDetailed(sp.saveMode,false);
  const total=d20.result+sp.saveBonus;
  const success=total>=sp.dc;
  const base=rollDiceExprDetailed(sp.dmg);
  let dmgTotal=base.total; let detail=[`base(${fmtRoll(base)})`];
  if(success){
    if(sp.successRule==='half'){ dmgTotal=Math.floor(dmgTotal/2); detail.push('half'); }
    else if(sp.successRule==='none'){ dmgTotal=0; detail.push('negated'); }
  }
  const parts=`d20[${d20.rolls.join(',')}] + ${sp.saveBonus} = ${total} vs DC ${sp.dc}`;
  const res=`<div><span class="roll-main">Save: ${total} ${success?'(success)':'(fail)'}</span> <span class="small">(${parts})</span></div><div><span class="roll-main">Damage: ${dmgTotal}</span> <span class="small">(${detail.join(' + ')})</span></div>`;
  card.querySelector('[data-show="result"]').innerHTML=res;
}
document.getElementById('rollerAdd').addEventListener('click',()=>{ rollerItems.push({kind:'attack',atk:5,ac:15,mode:'normal',halfling:false,crit:20,dmg:'1d8+3',critBonusDice:'',critBonusFlat:0,critBonusDiceDouble:false,vex:false,heavy:false,graze:false,abilityMod:3}); renderRoller(); });
document.getElementById('rollerAddSpell').addEventListener('click',()=>{ rollerItems.push({kind:'spell',dc:15,saveBonus:3,saveMode:'normal',successRule:'half',dmg:'3d8'}); renderRoller(); });
document.getElementById('rollerClear').addEventListener('click',()=>{ rollerItems.splice(0,rollerItems.length); renderRoller(); saveRollerState(); });
function sendAttackToRoller(atk){ rollerItems.push({ kind:'attack', atk:atk.atk, ac:atk.ac, mode:atk.mode, halfling:atk.halfling, crit:atk.crit, dmg:atk.dmg, critBonusDice:atk.critBonusDice||'', critBonusFlat:atk.critBonusFlat||0, critBonusDiceDouble:atk.critBonusDiceDouble||false, vex:atk.vex||false, heavy:atk.heavy||false, graze:atk.graze||false, abilityMod:atk.abilityMod||0 }); renderRoller(); }
function sendSpellToRoller(sp){ rollerItems.push({ kind:'spell', dc:sp.dc, saveBonus:sp.saveBonus, saveMode:sp.saveMode, successRule:sp.successRule, dmg:sp.dmg }); renderRoller(); }
(function initRoller(){ loadRollerState(); renderRoller(); })();

