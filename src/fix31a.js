/* ===== fix31a: combat loops (Aggravated Assault + Sword of Feast and Famine, Combat Celebrant / Aurelia / Godo + Helm of the Host …) =====
   Attacks weren't part of the loop recorder, so combat loops never got the "how many times?" question.
   Now each turn the table remembers every attack you declare (who attacked whom) and what you did in the main phase
   between combats. When an extra combat starts and the pattern repeats (or a known infinite-combat combo is on your
   battlefield), it asks how many more combats to run, then runs them for you:
     - declares the same attack each combat (creatures that attacked last time and can attack again, plus new creatures
       with haste — Helm of the Host copies — at the same opponent),
     - repeats the main-phase steps between combats (tap lands, activate Aggravated Assault),
     - answers the same way as last time ("exert it?", Sword triggers),
     - opponents block as usual.
   It stops when the extra combats stop, the chosen number is reached, every opponent is dead, or something can't be repeated. */
const CL = {T:'', atk:[], acts:[], asked:{}, run:null};
function clSync(){ const T = turnStr(); if (CL.T !== T){ CL.T = T; CL.atk = []; CL.acts = []; CL.asked = {}; CL.run = null; } }
function clCombatN(){ return S.cb && S.cb.t === turnStr() ? S.cb.n : 0; }
function clOppLife(){ return opponents().reduce((x, p) => x + Math.max(0, p.s?.life ?? 0), 0); }
function clTok(){ return S.bf.filter(c => c.tok || c.token || info(c.k)?.tok).reduce((x, c) => x + (c.n || 1), 0); }
// remember actions (with their answers) and in which combat number / phase they were taken
{ const ra = recAct; recAct = function(a){
    try { if (a && S && !UI.replay && !CL.run && !UI.dry && !(typeof BOT !== 'undefined' && BOT.on) && phaseNow().mine){ clSync(); CL.acts.push({a:{...a}, ans:[], cn:clCombatN(), ph:phaseNow().ph}); if (CL.acts.length > 60) CL.acts.shift(); } } catch {}
    return ra.apply(this, arguments); };
  const rn = recAns; recAns = function(p){
    const e = (S && !UI.replay && !CL.run) ? CL.acts[CL.acts.length - 1] : null;
    return rn.call(this, p).then(v => { try { if (e) e.ans.push(v && v.map ? v.map(x => (typeof x === 'object' && x) ? {...x} : x) : v); } catch {} return v; }); }; }
// remember each declared attack
{ const da = declareAttackers; declareAttackers = function(){
    try { const pn = phaseNow(); if (pn.mine && S.cb && S.cb.step === 'atk' && !UI.dry){ clSync();
        const sel = Object.entries(UI.atkSel || {}).filter(([, v]) => v).map(([id, def]) => { const c = S.bf.find(x => x.id === +id); return c ? {id:+id, k:c.k, def} : null; }).filter(Boolean);
        CL.atk[clCombatN()] = {sel, ids:S.bf.map(c => c.id), life:clOppLife(), tok:clTok()}; } } catch (e){ console.warn('cl atk', e); }
    return da.apply(this, arguments); }; }
// steps between combat i and combat i+1: what you did after combat i ended (in the main phase) before the next attack
const clBetween = i => CL.acts.filter(e => e.cn === i && e.ph === 5);
const clSameActs = (x, y) => x.length === y.length && x.every((e, i) => f25same(e.a, y[i].a));
const clDefs = s => [...new Set((s || []).map(x => { const d = parseDef(x.def); return d ? d.pid : x.def; }))].sort().join(',');
function clKnownCombo(){
  try { const names = new Set(S.bf.filter(x => !x.fd).map(x => f25nm(x.k)));
    for (const n of names) for (const e of (F25C.get(n) || [])) if (e.res.some(r => /^infinite combat phases/i.test(r)) && e.low.every(x => names.has(x))) return e; } catch {}
  return null; }
// A new combat reached "declare attackers": is this a loop worth offering?
function clOnAtkStep(){
  if (CL.run || UI.replay || UI.dry || (typeof BOT !== 'undefined' && BOT.on) || !phaseNow().mine) return;
  clSync(); const n = clCombatN(); if (n < 2) return; const prev = CL.atk[n - 1]; if (!prev || !prev.sel.length) return;
  const key = `${CL.T}:${n}`; if (CL.asked.done || CL.asked[key]) return;
  const known = clKnownCombo();
  let ok = false;
  if (known && n >= 2) ok = true;
  else if (n >= 3){ const p2 = CL.atk[n - 2]; ok = !!p2 && clDefs(p2.sel) === clDefs(prev.sel) && clSameActs(clBetween(n - 2), clBetween(n - 1)) && (prev.life < p2.life || prev.tok > p2.tok); }
  if (!ok) return;
  CL.asked[key] = 1;
  setTimeout(() => clOffer(n, known).catch(e => console.warn('cl offer', e)), 250);
}
{ const ss = setStep; setStep = function(step){ const r = ss.apply(this, arguments); try { if (step === 'atk') clOnAtkStep(); } catch (e){ console.warn('cl step', e); } return r; }; }
async function clOffer(n, known){
  if (UI.modal) await new Promise(r => { const t0 = Date.now(); const iv = setInterval(() => { if (!UI.modal || Date.now() - t0 > 20000){ clearInterval(iv); r(); } }, 150); });
  const prev = CL.atk[n - 1]; const acts = clBetween(n - 1);
  const who = [...new Set(prev.sel.map(x => { const d = parseDef(x.def); return d ? nameOf(attackTargetProtector(d)) : ''; }).filter(Boolean))].join(', ');
  const steps = acts.map(e => f25label(e.a));
  const v = await askChoice({title:`Combat loop${known ? ' — ' + known.cards.join(' + ') : ''}`,
    text:`This is combat ${n} this turn. Each combat: attack ${who || 'the same opponent'} with the same creatures${steps.length ? `, then ${steps.join(' → ')}` : ''}. How many more combats should the table run for you? Opponents still block each combat.`,
    options:[{label:'Until every opponent is dead (or it can\'t go on)', value:'all'}, {label:'A number of combats…', value:'n'}, {label:'No — I\'ll attack by hand', value:'no'}]});
  if (!v || v === 'no'){ CL.asked.done = 1; return; }
  let k = 999; if (v === 'n'){ k = await askNumber('How many more combats?', 'Counting this one', 5) || 0; if (!k) { CL.asked.done = 1; return; } }
  CL.asked.done = 1;
  clRun(k, prev, acts, v === 'all');
}
// pick this combat's attackers from the last attack: the same creatures (if they can attack), plus new ones with haste
function clPlan(prev){
  const sel = {}; const defs = prev.sel.map(x => x.def); const main = defs[0];
  const ok = d => defOpts().some(o => o.key === d);
  for (const x of prev.sel){ const c = S.bf.find(b => b.id === x.id) || null; if (c && !canAttack(c)) sel[c.id] = ok(x.def) ? x.def : (defOpts()[0] || {}).key; }
  const before = new Set(prev.ids || []);
  for (const c of S.bf) if (!before.has(c.id) && !sel[c.id] && isCreatureCard(c) && !canAttack(c)) sel[c.id] = ok(main) ? main : (defOpts()[0] || {}).key;
  // tokens whose stack grew (c.n > before): still one entry, it attacks with the whole stack
  for (const id of Object.keys(sel)) if (!sel[id]) delete sel[id];
  return sel;
}
async function clRun(budget, prev, acts, lethal){
  const T = turnStr(); CL.run = {left:budget, prev, acts, done:0, why:'', at:Date.now(), replayed:-1};
  S.lp = 1; commit(); log(`combat loop: running ${lethal ? 'until every opponent is dead' : budget + ' more combat' + (budget === 1 ? '' : 's')}`);
  const R = CL.run; let idle = 0; const t0 = Date.now();
  try {
    while (true){
      await sleep(120);
      if (turnStr() !== T){ R.why = 'the turn ended'; break; }
      if (opponents().length && opponents().every(p => (p.s?.life ?? 1) <= 0)){ R.why = 'every opponent is dead'; break; }
      if (Date.now() - t0 > 20 * 60000){ R.why = 'it ran for 20 minutes'; break; }
      if (UI.modal || UI.resolving || UI.casting || UI.cbBusy) { idle = 0; continue; }
      const pn = phaseNow(); if (!pn.mine){ R.why = 'it is no longer your turn'; break; }
      if (stackAll().length){ if (myBox()) doPass(); continue; }
      if (pn.ph === 4 && S.cb && S.cb.step === 'atk'){
        if (R.left <= 0){ R.why = `ran ${R.done} combat${R.done === 1 ? '' : 's'}`; break; }
        const sel = clPlan(R.prev); if (!Object.keys(sel).length){ R.why = 'no creature can attack'; break; }
        UI.atkSel = sel; const ids = S.bf.map(c => c.id); const life = clOppLife(), tok = clTok();
        declareAttackers(); R.prev = {sel:Object.entries(sel).map(([id, def]) => ({id:+id, k:S.bf.find(c => c.id === +id)?.k, def})), ids, life, tok};
        R.left--; R.done++; R.cn = clCombatN(); continue; }
      if (pn.ph === 5 && R.cn && R.replayed !== R.cn && R.acts.length){
        R.replayed = R.cn;
        UI.replay = {ans:R.acts.flatMap(e => e.ans).map(x => x && x.map ? x.map(y => (typeof y === 'object' && y) ? {...y} : y) : x)};
        try { for (const e of R.acts){ const w = await f27cStep(e.a); if (w){ R.why = w; break; } if (UI.replay.fail){ R.why = UI.replay.fail; break; } if (!(await waitStack())){ R.why = 'the stack did not finish'; break; } } }
        finally { UI.replay = null; }
        if (R.why) break; continue; }
      if (pn.ph === 5 && !(S.xc > 0)){ if (R.left > 0 && R.cn) R.why = 'no more extra combats'; else R.why = R.why || `ran ${R.done} combat${R.done === 1 ? '' : 's'}`; break; }
      if (pn.ph >= 6){ R.why = 'combat is over'; break; }
      const key = prioKey(); if (pn.ph === 4 && key && S.pass !== key){ doPass(); continue; }
      if (pn.ph === 4 && !key){ if (++idle > 3000){ R.why = 'combat got stuck'; break; } continue; }   // waiting for blocks / damage
      if ((pn.ph === 3 || pn.ph === 5) && Date.now() - (R.nx || 0) > 1200){ R.nx = Date.now(); nextAction(); continue; }
      if (++idle > 400){ R.why = 'it got stuck'; break; }
    }
  } catch (e){ console.warn('cl run', e); R.why = 'an error stopped it'; }
  finally { S.lp = 0; const done = R.done; CL.run = null; log(`combat loop: ran ${done} combat${done === 1 ? '' : 's'}${R.why ? ' — stopped: ' + R.why : ''}`); commit(); }
}
// while the combat loop runs, questions it asks again get last time's answer (fix27z's loop autopilot)
{ const la = f25lActive; f25lActive = function(){ return !!CL.run || la.apply(this, arguments); }; }
