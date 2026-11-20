/* ===================== Auto-pay: when your pool is short, the engine taps your mana sources for you =====================
   Any cost that is checked with payPlan(cost, S.pool) is now also payable from untapped sources with a plain
   "{T}: Add …" ability. Checks only look; the sources are tapped at the moment the payment is actually taken
   (when the code reads plan.pool). Colored needs get the least flexible source first, so duals and
   any-color lands are kept for later. Turn it off with PT_AUTOTAP=false (Game menu → Auto-tap). */
const AUTOTAP = { on:true };
try { const v = localStorage.getItem('pt.autotap'); if (v === '0') AUTOTAP.on = false; } catch {}
function autoSources(){
  if (!S) return [];
  const out = [];
  for (const c of S.bf){
    if (c.fd || c.tap || (c.n || 1) > 1 && (c.tn || 0) >= (c.n || 1)) continue;
    if (isCreatureCard(c) && c.sk && !hasHaste(c)) continue;
    if (typeof r21AbBan === 'function' && r21AbBan(c, true)) continue;
    const opts = [];
    manaAbs(c).forEach(ab => { if (!ab.tapOnly || ab.rest) return; (ab.outs || []).forEach((o, ci) => { if (o && o.length) opts.push({ab, ci, outs:o}); }); });
    if (!opts.length) continue;
    // Damping Sphere-style: a land tapped for two or more mana makes {C}: only count what it really gives
    out.push({c, opts, flex:new Set(opts.flatMap(o => o.outs)).size});
  }
  return out;
}
function autoPlan(cost, pool){
  if (!AUTOTAP.on || !S || UI.dry || AUTOTAP.hold) return null;
  const p = {...emptyPool(), ...pool};
  const col = {...cost.col}; for (const k of MANA){ const u = Math.min(p[k], col[k]); p[k] -= u; col[k] -= u; }
  const srcs = autoSources(); if (!srcs.length) return null;
  const used = new Set(); const picks = []; const extra = {...emptyPool()};
  const take = (pred) => { const cand = srcs.filter(s => !used.has(s.c.id) && s.opts.some(o => pred(o.outs))).sort((a, b) => a.flex - b.flex || a.opts.length - b.opts.length); if (!cand.length) return null; const s = cand[0]; const o = s.opts.find(o => pred(o.outs)); used.add(s.c.id); picks.push({c:s.c, ab:o.ab, ci:o.ci, outs:o.outs}); return o.outs; };
  for (const k of ['W','U','B','R','G','C']){
    while (col[k] > 0){
      if (extra[k] > 0){ extra[k]--; col[k]--; continue; }
      const outs = take(o => o.includes(k)); if (!outs) return null;
      outs.forEach(x => extra[x]++); extra[k]--; col[k]--;
    }
  }
  // what is left must be covered by payPlan on the enlarged pool: hybrids, two-brids, Phyrexian, generic
  const pool2 = () => { const q = {...emptyPool(), ...pool}; picks.forEach(pk => pk.outs.forEach(x => q[x]++)); return q; };
  for (let guard = 0; guard < 40; guard++){
    const r = PAYPLAN0(cost, pool2());
    if (!r.err) return picks.length ? picks : null;
    const hm = r.err.match(/needs (\w+) or (\w+)/); const cm = r.err.match(/needs \d+ more (\w+)/);
    const name2c = n => Object.keys(MNAME).find(k => MNAME[k] === n);
    let outs = null;
    if (hm){ const a = name2c(hm[1]), b = name2c(hm[2]); outs = take(o => o.includes(a) || o.includes(b)); }
    else if (cm && name2c(cm[1])){ const k = name2c(cm[1]); outs = take(o => o.includes(k)); }
    else { const nm = r.err.match(/needs (\d+) more mana/); const need = nm ? +nm[1] : 1;
      const cand = srcs.filter(s => !used.has(s.c.id)).map(s => ({s, o:s.opts.slice().sort((a, b) => b.outs.length - a.outs.length)[0]}));
      cand.sort((a, b) => { const fa = a.o.outs.length <= need, fb = b.o.outs.length <= need; if (fa !== fb) return fa ? -1 : 1; if (fa) return b.o.outs.length - a.o.outs.length || a.s.flex - b.s.flex; return a.o.outs.length - b.o.outs.length || a.s.flex - b.s.flex; });
      if (cand.length){ const {s:sv, o} = cand[0]; used.add(sv.c.id); picks.push({c:sv.c, ab:o.ab, ci:o.ci, outs:o.outs}); outs = o.outs; } }
    if (!outs) return null;
  }
  return null;
}
function autoTapNow(picks){
  for (const pk of picks){
    const c = S.bf.find(b => b.id === pk.c.id); if (!c || c.tap) continue;
    if ((c.n || 1) > 1) c.tn = (c.tn || 0) + 1; else c.tap = true;
    addMana(pk.outs);
    try { emit({type:'manatap', k:c.k, id:c.id, cnt:1}); } catch {}
  }
  log(`auto-tapped ${picks.map(pk => cname(pk.c) + ' ' + pk.outs.map(x => '{' + x + '}').join('')).join(', ')}`);
}
const PAYPLAN0 = payPlan;
payPlan = function(cost, pool){
  const r = PAYPLAN0(cost, pool);
  if (!r.err || !S || pool !== S.pool || UI.dry) return r;
  let picks = null; try { picks = autoPlan(cost, pool); } catch (e){ console.warn('autopay', e); }
  if (!picks) return r;
  // the payment: tap the sources when the caller actually takes plan.pool
  const virt = {...emptyPool(), ...pool}; picks.forEach(pk => pk.outs.forEach(x => virt[x]++));
  const r2 = PAYPLAN0(cost, virt); if (r2.err) return r;
  let done = false; const plan = {life:r2.life, auto:picks.map(pk => cname(pk.c))};
  Object.defineProperty(plan, 'pool', {enumerable:true, get(){ if (!done){ done = true; autoTapNow(picks); const r3 = PAYPLAN0(cost, S.pool); return r3.err ? S.pool : r3.pool; } return S.pool; }});
  return plan;
};
ACT.autotapToggle = () => { AUTOTAP.on = !AUTOTAP.on; try { localStorage.setItem('pt.autotap', AUTOTAP.on ? '1' : '0'); } catch {} toast(`Auto-tap ${AUTOTAP.on ? 'on: the game taps your lands to pay' : 'off: tap mana yourself'}`); };
// never auto-tap other sources to pay for a mana ability itself (filter lands etc.): tapping for mana stays one click
AUTOTAP.hold = 0;
{
  const qt = quickTap; quickTap = function(...a){ AUTOTAP.hold++; try { return qt.apply(this, a); } finally { AUTOTAP.hold--; } };
  const to = tapOptions; tapOptions = function(...a){ AUTOTAP.hold++; try { return to.apply(this, a); } finally { AUTOTAP.hold--; } };
  const am = activateMana; activateMana = async function(...a){ AUTOTAP.hold++; try { return await am.apply(this, a); } finally { AUTOTAP.hold--; } };
}
