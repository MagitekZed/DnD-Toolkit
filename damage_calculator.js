<!-- Place this as a new file: damage_calculator.js -->
<script>
/* Damage Calculator
   - UI + compute pipeline per spec
   - No external deps; will use existing dice rollers if present (window.rollDice / window.AttackRoller?.rollDiceExpr)
   - Persists state in localStorage under "damageCalcState"
*/

(function(){
  const TYPES = ['acid','bludgeoning','cold','fire','force','lightning','necrotic','piercing','poison','psychic','radiant','slashing','thunder'];
  const STATES = ['normal','resistant','immune','vulnerable'];
  const TAGS = ['nonmagical','magical','melee','ranged','spell'];
  const STORAGE_KEY = 'damageCalcState';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const defaultState = () => ({
    values: Object.fromEntries(TYPES.map(t=>[t,0])),
    states: Object.fromEntries(TYPES.map(t=>[t,'normal'])),
    tags: [],
    reductions: [],
    finals: [],
    options: { round:'down', clampZero:true }
  });

  function loadState(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      // harden / backfill
      const base = defaultState();
      parsed.values = Object.assign(base.values, parsed.values||{});
      parsed.states = Object.assign(base.states, parsed.states||{});
      parsed.tags = Array.isArray(parsed.tags) ? parsed.tags.filter(x=>TAGS.includes(x)) : [];
      parsed.reductions = Array.isArray(parsed.reductions) ? parsed.reductions : [];
      parsed.finals = Array.isArray(parsed.finals) ? parsed.finals : [];
      parsed.options = Object.assign(base.options, parsed.options||{});
      return parsed;
    } catch { return defaultState(); }
  }

  function saveState(state){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // --------- Math helpers ----------
  function roundRule(x, mode){
    if (mode === 'up') return Math.ceil(x);
    if (mode === 'bankers') {
      // Round half to even
      const floor = Math.floor(x);
      const frac = x - floor;
      if (Math.abs(frac - 0.5) < 1e-9) return (floor % 2 === 0) ? floor : floor+1;
      return Math.round(x);
    }
    // default 'down'
    return Math.floor(x);
  }
  function clamp(x, on){ return on ? Math.max(0, x) : x; }

  // --------- Dice evaluation ----------
  // Attempts to use any existing roller; otherwise a tiny fallback parser.
  // Guarantees: evaluated ONCE per "Calculate" click per occurrence.
  function makeAmountEvaluator(){
    const cache = new Map(); // key: stringified input -> number
    return function evalAmount(v){
      if (typeof v === 'number') return v;
      const key = (v ?? '').toString().trim();
      if (!key) return 0;
      if (cache.has(key)) return cache.get(key);

      let out = 0;

      // Prefer existing app rollers if available
      try {
        if (window.AttackRoller?.rollDiceExpr) {
          out = Number(window.AttackRoller.rollDiceExpr(key)) || 0;
        } else if (window.rollDice) {
          // expecting something like rollDice('1d6+3') -> { total: N }
          const r = window.rollDice(key);
          out = typeof r === 'number' ? r : Number(r?.total || 0);
        } else {
          // Minimal, safe fallback:
          // supports NdM, +/-, and constants; variables become 0
          // e.g. "1d10+DEX+level" -> rolls 1d10 + 0 + 0
          const tokens = key.replace(/\s+/g,'')
                            .replace(/[^0-9dD+\-]/g, m => { // zap unknown symbols to plus zero
                              return '';
                            });
          // Now parse a sum of (+/-) terms that are either NdM or integers
          // Example: 2d6+3-1d4
          let idx = 0;
          function readTerm(sign){
            // read optional dice
            const diceMatch = tokens.slice(idx).match(/^(\d*)d(\d+)/i);
            if (diceMatch){
              idx += diceMatch[0].length;
              const n = Number(diceMatch[1]||1);
              const die = Number(diceMatch[2]);
              let total = 0;
              for (let i=0;i<n;i++){
                total += 1 + Math.floor(Math.random()*die);
              }
              return sign*total;
            }
            // else constant
            const numMatch = tokens.slice(idx).match(/^\d+/);
            if (numMatch){
              idx += numMatch[0].length;
              return sign*Number(numMatch[0]);
            }
            return 0;
          }
          let sign = +1;
          out += readTerm(sign);
          while (idx < tokens.length){
            const ch = tokens[idx++];
            if (ch === '+') sign = +1;
            else if (ch === '-') sign = -1;
            out += readTerm(sign);
          }
        }
      } catch { out = 0; }

      cache.set(key, out);
      return out;
    };
  }

  function matchesScope(type, hitTags, scope){
    if (!scope) return true;
    if (scope.types && scope.types.length && !scope.types.includes(type)) return false;
    if (scope.tags && scope.tags.length){
      // must be subset of hit tags
      for (const t of scope.tags) if (!hitTags.includes(t)) return false;
    }
    return true;
  }

  function compute(state){
    const {values, states, tags, reductions, finals, options} = state;
    const perType = {};
    const evalAmount = makeAmountEvaluator();

    for (const t of TYPES){
      let cur = +values[t] || 0;

      // pre
      for (const r of reductions.filter(x=>x.enabled && x.stage==='pre' && matchesScope(t, tags, x))){
        const amt = evalAmount(r.amount);
        let reduceBy = Math.min(cur, amt);
        if (r.max != null) reduceBy = Math.min(reduceBy, +r.max || 0);
        cur = clamp(cur - reduceBy, options.clampZero);
      }

      // state
      const s = states[t] || 'normal';
      if (s === 'immune') cur = 0;
      else if (s === 'resistant') cur = roundRule(cur/2, options.round);
      else if (s === 'vulnerable') cur = cur*2;

      // post
      for (const r of reductions.filter(x=>x.enabled && x.stage==='post' && matchesScope(t, tags, x))){
        const amt = evalAmount(r.amount);
        let reduceBy = Math.min(cur, amt);
        if (r.max != null) reduceBy = Math.min(reduceBy, +r.max || 0);
        cur = clamp(cur - reduceBy, options.clampZero);
      }

      perType[t] = cur;
    }

    let total = Object.values(perType).reduce((a,b)=>a+b,0);

    for (const f of finals.filter(x=>x.enabled)){
      const apply = (x)=> {
        switch (f.op?.kind){
          case 'halve':   return roundRule(x/2, options.round);
          case 'quarter': return roundRule(x/4, options.round);
          case 'multiply':{
            const n = Number(f.op.value ?? 1);
            return x * (isFinite(n) ? n : 1);
          }
          case 'subtract':{
            const amt = evalAmount(f.op.value ?? 0);
            return clamp(x - amt, options.clampZero);
          }
          default: return x;
        }
      };

      const scoped = (f.types && f.types.length) || (f.tags && f.tags.length);
      if (!scoped){
        total = apply(total);
      } else {
        for (const t of TYPES) if (matchesScope(t, state.tags, f)) perType[t] = apply(perType[t]);
        total = Object.values(perType).reduce((a,b)=>a+b,0);
      }
    }

    return { perType, total };
  }

  // ---------- UI ----------
  const DamageCalculator = {
    state: loadState(),
    el: null,

    init(){
      const page = $('#page-damage');
      if (!page) return;
      this.el = page;
      this.renderBase();
      this.loadIntoUI();
      this.bindGlobal();
    },

    renderBase(){
      const page = this.el;
      page.innerHTML = `
        <div class="damage-wrap">
          <div class="flex-row" style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;">
            <h2 style="margin:0">Damage Calculator</h2>
            <div>
              <label for="dcRound">Round:</label>
              <select id="dcRound" title="Rounding rule">
                <option value="down">down</option>
                <option value="up">up</option>
                <option value="bankers">bankers</option>
              </select>
              <label style="margin-left:12px">
                <input type="checkbox" id="dcClampZero" checked />
                Clamp to 0
              </label>
            </div>
          </div>

          <div style="margin-bottom:12px">
            <strong>Tags for this hit:</strong>
            ${TAGS.map(tag => `
              <label style="margin-right:10px">
                <input type="checkbox" class="dc-tag" value="${tag}" /> ${tag}
              </label>
            `).join('')}
          </div>

          <h3 style="margin-top:8px">Incoming Damage</h3>
          <div id="dcDamageGrid" class="dc-grid"></div>

          <div class="two-cols" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <h3 style="margin:0">Custom Reductions</h3>
                <div>
                  <button id="dcTplHAM" type="button" title="Heavy Armor Master">HAM</button>
                  <button id="dcTplDeflect" type="button" title="Deflect Missiles">Deflect</button>
                  <button id="dcAddReduction" type="button">+ Add reduction</button>
                </div>
              </div>
              <div id="dcReductions" class="dc-list"></div>
            </div>

            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <h3 style="margin:0">Final Modifiers</h3>
                <div>
                  <button id="dcTplUncanny" type="button" title="Uncanny Dodge">Uncanny</button>
                  <button id="dcTplHalf" type="button" title="Successful Save (Half)">Half</button>
                  <button id="dcTplEvasion" type="button" title="Evasion (success)">Evasion</button>
                  <button id="dcAddFinal" type="button">+ Add final</button>
                </div>
              </div>
              <div id="dcFinalMods" class="dc-list"></div>
            </div>
          </div>

          <div style="margin-top:16px;display:flex;gap:8px">
            <button id="dcCalc" class="primary" type="button">Calculate</button>
            <button id="dcClear" type="button">Clear</button>
          </div>

          <div id="dcResults" style="margin-top:16px">
            <table class="dc-table">
              <thead>
                <tr><th>Type</th><th>Base</th><th>State</th><th>Final</th></tr>
              </thead>
              <tbody></tbody>
              <tfoot>
                <tr><th>Total</th><th></th><th></th><th id="dcTotal">0</th></tr>
              </tfoot>
            </table>
          </div>
        </div>
      `;

      // Build damage grid cells
      const grid = $('#dcDamageGrid', page);
      TYPES.forEach(t=>{
        const idBase = `dc_${t}`;
        const cell = document.createElement('div');
        cell.className = 'dc-cell';
        cell.innerHTML = `
          <label for="${idBase}_val" style="display:block;font-weight:600;text-transform:capitalize">${t}</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input id="${idBase}_val" type="number" min="0" step="1" style="width:110px" />
            <select id="${idBase}_state">
              ${STATES.map(s=>`<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
        `;
        grid.appendChild(cell);
      });
    },

    bindGlobal(){
      const page = this.el;

      // Options
      $('#dcRound', page).addEventListener('change', e=>{
        this.state.options.round = e.target.value;
        saveState(this.state);
      });
      $('#dcClampZero', page).addEventListener('change', e=>{
        this.state.options.clampZero = !!e.target.checked;
        saveState(this.state);
      });

      // Tags
      $$('.dc-tag', page).forEach(cb=>{
        cb.addEventListener('change', ()=>{
          this.state.tags = $$('.dc-tag:checked', page).map(x=>x.value);
          saveState(this.state);
        });
      });

      // Damage inputs
      TYPES.forEach(t=>{
        const vEl = $(`#dc_${t}_val`, page);
        const sEl = $(`#dc_${t}_state`, page);
        vEl.addEventListener('input', ()=>{
          this.state.values[t] = Number(vEl.value || 0);
          saveState(this.state);
        });
        sEl.addEventListener('change', ()=>{
          this.state.states[t] = sEl.value;
          saveState(this.state);
        });
      });

      // Reductions
      $('#dcAddReduction', page).addEventListener('click', ()=> this.addReductionRow());
      $('#dcTplHAM', page).addEventListener('click', ()=>{
        this.addReductionRow({
          name:'Heavy Armor Master',
          amount: 3, stage:'pre',
          types:['bludgeoning','piercing','slashing'],
          tags:['nonmagical']
        });
      });
      $('#dcTplDeflect', page).addEventListener('click', ()=>{
        this.addReductionRow({
          name:'Deflect Missiles',
          amount:'1d10+0+0', // "DEX+level" not known → 0+0; user can edit
          stage:'pre',
          types:['bludgeoning','piercing','slashing'],
          tags:['ranged']
        });
      });

      // Finals
      $('#dcAddFinal', page).addEventListener('click', ()=> this.addFinalRow());
      $('#dcTplUncanny', page).addEventListener('click', ()=>{
        this.addFinalRow({ name:'Uncanny Dodge', op:{kind:'halve'} });
      });
      $('#dcTplHalf', page).addEventListener('click', ()=>{
        this.addFinalRow({ name:'Successful Save (Half)', op:{kind:'halve'} });
      });
      $('#dcTplEvasion', page).addEventListener('click', ()=>{
        this.addFinalRow({
          name:'Evasion (success)',
          op:{kind:'quarter'},
          types:['acid','cold','fire','force','lightning','poison','psychic','radiant','thunder'] // common elements; user may edit
        });
      });

      // Actions
      $('#dcCalc', page).addEventListener('click', ()=> this.calculate());
      $('#dcClear', page).addEventListener('click', ()=> this.clearAll());
    },

    // ------- Reductions UI -------
    addReductionRow(prefill){
      const r = Object.assign({
        id: crypto.randomUUID ? crypto.randomUUID() : ('r_'+Math.random().toString(36).slice(2)),
        name:'', amount:0, stage:'pre', types:[], tags:[], max: undefined, enabled:true
      }, prefill||{});

      this.state.reductions.push(r);
      saveState(this.state);
      this.renderReductions();
    },

    renderReductions(){
      const wrap = $('#dcReductions', this.el);
      wrap.innerHTML = '';
      this.state.reductions.forEach(r=>{
        wrap.appendChild(this.renderReductionRow(r));
      });
    },

    renderReductionRow(r){
      const row = document.createElement('div');
      row.className = 'dc-row';
      row.dataset.id = r.id;

      const typeSel = TYPES.map(t=>`<option value="${t}" ${r.types?.includes(t)?'selected':''}>${t}</option>`).join('');
      const tagSel  = TAGS.map(t=>`<option value="${t}" ${r.tags?.includes(t)?'selected':''}>${t}</option>`).join('');

      row.innerHTML = `
        <input type="checkbox" class="r-enabled" ${r.enabled?'checked':''} title="Enabled" />
        <input type="text" class="r-name" placeholder="Name" value="${escapeHtml(r.name)}" />
        <input type="text" class="r-amount" placeholder="Amount or dice" value="${escapeHtml(r.amount)}" />
        <select class="r-stage">
          <option value="pre" ${r.stage==='pre'?'selected':''}>pre</option>
          <option value="post" ${r.stage==='post'?'selected':''}>post</option>
        </select>
        <select class="r-types" multiple size="3">${typeSel}</select>
        <select class="r-tags" multiple size="3">${tagSel}</select>
        <input type="number" class="r-max" placeholder="Max (optional)" ${r.max!=null?`value="${r.max}"`:''}/>
        <button type="button" class="r-remove">Remove</button>
      `;

      // Bind
      $('.r-enabled',row).addEventListener('change', e=>{ r.enabled = !!e.target.checked; saveState(this.state); });
      $('.r-name',row).addEventListener('input', e=>{ r.name = e.target.value; saveState(this.state); });
      $('.r-amount',row).addEventListener('input', e=>{
        const v = e.target.value.trim();
        r.amount = v === '' ? 0 : (isFinite(Number(v)) ? Number(v) : v);
        saveState(this.state);
      });
      $('.r-stage',row).addEventListener('change', e=>{ r.stage = e.target.value; saveState(this.state); });
      $('.r-types',row).addEventListener('change', e=>{
        r.types = Array.from(e.target.selectedOptions).map(o=>o.value);
        saveState(this.state);
      });
      $('.r-tags',row).addEventListener('change', e=>{
        r.tags = Array.from(e.target.selectedOptions).map(o=>o.value);
        saveState(this.state);
      });
      $('.r-max',row).addEventListener('input', e=>{
        const n = e.target.value;
        r.max = n === '' ? undefined : Number(n||0);
        saveState(this.state);
      });
      $('.r-remove',row).addEventListener('click', ()=>{
        this.state.reductions = this.state.reductions.filter(x=>x.id!==r.id);
        saveState(this.state);
        this.renderReductions();
      });

      return row;
    },

    // ------- Finals UI -------
    addFinalRow(prefill){
      const f = Object.assign({
        id: crypto.randomUUID ? crypto.randomUUID() : ('f_'+Math.random().toString(36).slice(2)),
        name:'', op:{kind:'halve'}, types:[], tags:[], enabled:true
      }, prefill||{});

      this.state.finals.push(f);
      saveState(this.state);
      this.renderFinals();
    },

    renderFinals(){
      const wrap = $('#dcFinalMods', this.el);
      wrap.innerHTML = '';
      this.state.finals.forEach(f=>{
        wrap.appendChild(this.renderFinalRow(f));
      });
    },

    renderFinalRow(f){
      const row = document.createElement('div');
      row.className = 'dc-row';
      row.dataset.id = f.id;

      const typeSel = TYPES.map(t=>`<option value="${t}" ${f.types?.includes(t)?'selected':''}>${t}</option>`).join('');
      const tagSel  = TAGS.map(t=>`<option value="${t}" ${f.tags?.includes(t)?'selected':''}>${t}</option>`).join('');

      row.innerHTML = `
        <input type="checkbox" class="f-enabled" ${f.enabled?'checked':''} title="Enabled" />
        <input type="text" class="f-name" placeholder="Name" value="${escapeHtml(f.name)}" />
        <select class="f-op">
          <option value="halve" ${f.op?.kind==='halve'?'selected':''}>halve</option>
          <option value="quarter" ${f.op?.kind==='quarter'?'selected':''}>quarter</option>
          <option value="multiply" ${f.op?.kind==='multiply'?'selected':''}>multiply (×N)</option>
          <option value="subtract" ${f.op?.kind==='subtract'?'selected':''}>subtract (flat/dice)</option>
        </select>
        <input type="text" class="f-value" placeholder="Value (for ×N or subtract)" ${f.op?.value!=null?`value="${escapeHtml(f.op.value)}"`:''} />
        <select class="f-types" multiple size="3">${typeSel}</select>
        <select class="f-tags" multiple size="3">${tagSel}</select>
        <button type="button" class="f-remove">Remove</button>
      `;

      // Bind
      $('.f-enabled',row).addEventListener('change', e=>{ f.enabled = !!e.target.checked; saveState(this.state); });
      $('.f-name',row).addEventListener('input', e=>{ f.name = e.target.value; saveState(this.state); });
      $('.f-op',row).addEventListener('change', e=>{
        f.op = { kind: e.target.value, value: (e.target.value==='multiply'||e.target.value==='subtract') ? (f.op?.value ?? '') : undefined };
        this.syncFinalValueVisibility(row, f);
        saveState(this.state);
      });
      $('.f-value',row).addEventListener('input', e=>{
        const raw = e.target.value.trim();
        f.op.value = raw;
        saveState(this.state);
      });
      $('.f-types',row).addEventListener('change', e=>{
        f.types = Array.from(e.target.selectedOptions).map(o=>o.value);
        saveState(this.state);
      });
      $('.f-tags',row).addEventListener('change', e=>{
        f.tags = Array.from(e.target.selectedOptions).map(o=>o.value);
        saveState(this.state);
      });
      $('.f-remove',row).addEventListener('click', ()=>{
        this.state.finals = this.state.finals.filter(x=>x.id!==f.id);
        saveState(this.state);
        this.renderFinals();
      });

      this.syncFinalValueVisibility(row, f);
      return row;
    },

    syncFinalValueVisibility(row, f){
      const val = $('.f-value', row);
      const need = (f.op?.kind==='multiply' || f.op?.kind==='subtract');
      val.style.display = need ? '' : 'none';
    },

    // ------- Actions -------
    calculate(){
      const result = compute(this.state);
      const tbody = $('#dcResults tbody', this.el);
      tbody.innerHTML = '';
      TYPES.forEach(t=>{
        const tr = document.createElement('tr');
        const base = Number(this.state.values[t]||0);
        const st = this.state.states[t]||'normal';
        tr.innerHTML = `
          <td style="text-transform:capitalize">${t}</td>
          <td>${base}</td>
          <td>${st}</td>
          <td>${result.perType[t]}</td>
        `;
        tbody.appendChild(tr);
      });
      $('#dcTotal', this.el).textContent = String(result.total);
    },

    clearAll(){
      this.state = defaultState();
      saveState(this.state);
      this.loadIntoUI();
      // clear results
      $('#dcResults tbody', this.el).innerHTML = '';
      $('#dcTotal', this.el).textContent = '0';
    },

    loadIntoUI(){
      const {options, tags, values, states} = this.state;
      $('#dcRound', this.el).value = options.round;
      $('#dcClampZero', this.el).checked = !!options.clampZero;

      $$('.dc-tag', this.el).forEach(cb=>{
        cb.checked = tags.includes(cb.value);
      });

      TYPES.forEach(t=>{
        $(`#dc_${t}_val`, this.el).value = values[t] ?? 0;
        $(`#dc_${t}_state`, this.el).value = states[t] ?? 'normal';
      });

      this.renderReductions();
      this.renderFinals();
    }
  };

  // util
  function escapeHtml(s){
    return (s??'').toString()
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  // Expose
  window.DamageCalculator = DamageCalculator;

  // Auto-init when DOM ready
  document.addEventListener('DOMContentLoaded', ()=> {
    if (document.getElementById('page-damage')) window.DamageCalculator.init();
  });
})();
</script>
