
/* ===================== Rules engine — round 21B: alternative costs, casting from other zones, hand abilities; recurring costs, delayed effects and durations ===================== */

/* ---------- Helpers ---------- */
const r21bClean = t => String(t || '').replace(/\s*\([^()]*\)/g, '').trim();
function r21bText(k, fl){ const a = info(k); if (!a) return ''; const f = fl && a.back ? a.back : a; return r21bClean(tname(f.o || '', f.n)); }
function r21bLines(k, fl){ return r21bText(k, fl).split('\n').map(x => x.trim()).filter(Boolean); }
function r21bKw(k, re){ for (const l of r21bLines(k)){ const m = l.match(re); if (m) return m; } return null; }
const r21bManaRe = '((?:\\{[^}]+\\})+)';
// "{2}{U}" / "{1}, Pay 2 life" / "—Sacrifice a land." → {mana, extra}
function r21bCost(str){
  const s = String(str || '').replace(/^\s*—\s*/, '').replace(/\.$/, '').trim();
  const mana = (s.match(/^((?:\{[^}]+\})+)/) || [])[1] || '';
  const rest = s.slice(mana.length).replace(/^,?\s*(?:and\s+)?/, '').trim();
  return {mana, extra:rest ? rest.split(/,\s*|\s+and\s+/).map(p => extraPart(p)) : [], label:s};
}
const r21bKnown = cost => cost.extra.every(x => x.t !== '?');
function r21bWhy(cost, c, add){ const p = payPlan(parseCost((cost.mana || '') + (add || '') || '{0}'), S.pool); if (p.err) return p.err; return cost.extra.map(x => extraFeasible(x, c)).find(Boolean) || ''; }
async function r21bPay(cost, c){
  const plan = payPlan(parseCost(cost.mana || '{0}'), S.pool); if (plan.err){ toast(`Not enough mana: ${plan.err}`); return false; }
  if (cost.extra.length && !(await payExtras(cost.extra, c))) return false;
  S.pool = plan.pool; if (plan.life) S.life -= plan.life; return true;
}
function r21bStack(it){ const x = {sid:rid(6), o:nextO(), ...it}; S.stk.push(x); S.pass = 's:' + x.sid; return x; }
function r21bTrig(c, txt, extra = {}){ const it = r21bStack({kind:'trigger', k:c.k, nm:cname(c), txt, srcId:c.id, ...extra}); log(`trigger: ${cname(c)} — ${short(String(txt).replace(/~/g, cname(c)), 90)}`); return it; }
const r21bTypes = k => ((info(k)?.t || '').split('—')[1] || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
const r21bMine = () => S && phaseNow().mine;
// cast right now, ignoring sorcery timing (miracle, madness, suspend, plot)
{
  const to = timingOk;
  timingOk = function(c){ if (UI.r21bany){ const top = stackTop(); if (top && top.ss) return {ok:false, why:'Split second: nothing can be cast now'}; return {ok:true}; } return to(c); };
}
async function r21bCastNow(c, zone, o = {}){ UI.r21bany = true; try { await beginCast(c, zone, o); } finally { UI.r21bany = false; } }

// non-mana cost parts: numbers, counters, exile from graveyard, tapped creatures
{
  const ep = extraPart;
  extraPart = function(p){
    const l = String(p).toLowerCase().trim().replace(/\.$/, ''); let m;
    if ((m = l.match(/^sacrifice (three|four|five|six|seven|\d+) (.+?)s?$/))) return {t:'sac', desc:m[2], n:wn(m[1]) || +m[1] || 1, label:`sacrifice ${m[1]} ${m[2]}`};
    if ((m = l.match(/^discard (three|four|five|\d+) cards$/))) return {t:'discard', desc:'', n:wn(m[1]) || +m[1] || 1, label:`discard ${m[1]} cards`};
    if ((m = l.match(/^exile (an?|one|two|three|four|five|six|seven|eight|\d+) (?:other )?(.*?)cards? from your graveyard$/))) return {t:'gyEx', n:wn(m[1]) || +m[1] || 1, desc:m[2].trim(), label:`exile ${m[1]} ${m[2]}cards from your graveyard`};
    if ((m = l.match(/^pay (\w+) life$/)) && wn(m[1])) return {t:'life', n:wn(m[1]), label:`pay ${m[1]} life`};
    if ((m = l.match(/^exile an? (.+?) card from your hand$/))) return {t:'exile', desc:m[1], label:`exile a ${m[1]} card from your hand`};
    if ((m = l.match(/^return an? tapped creature you control to its owner's hand$/))) return {t:'r21b', label:'return a tapped creature you control to its owner\'s hand', feas:() => S.bf.some(b => isCreatureCard(b) && b.tap && !b.fd) ? '' : 'you control no tapped creature', run:async () => { const list = S.bf.filter(b => isCreatureCard(b) && b.tap && !b.fd); const ids = list.length === 1 ? [list[0].id] : await pickCards({title:'Return a tapped creature you control to your hand', cards:list, min:1, max:1}); if (!ids || !ids[0]) return false; moveCard(ids[0], 'hand'); return true; }};
    if ((m = l.match(/^pay (an amount of |)?(\w+) \{e\}$/)) || (m = l.match(/^pay (\w+) energy$/))) { const n = wn(m[m.length - 1]) || 0; return {t:'r21b', label:`pay ${n} energy`, feas:() => ((S.pc || {}).energy || 0) >= n ? '' : `you need ${n} energy`, run:async () => { addPC('energy', -n); return true; }}; }
    return ep(p);
  };
  const ef = extraFeasible;
  extraFeasible = function(x, c){
    if (x.t === 'r21b') return x.feas ? x.feas(c) : '';
    if (x.t === 'gyEx') return S.gy.filter(g => g.id !== c.id && (!x.desc || descOk(g.k, x.desc))).length >= x.n ? '' : `you need ${x.n} other ${x.desc || ''}cards in your graveyard`;
    return ef(x, c);
  };
  const pe = payExtras;
  payExtras = async function(list, c){
    for (const x of list){
      if (x.t === 'r21b'){ if (!(await x.run(c))) return false; continue; }
      if (x.t === 'gyEx' && x.desc){ const cards = S.gy.filter(g => g.id !== c.id && descOk(g.k, x.desc)); const ids = cards.length <= x.n ? cards.map(g => g.id) : await pickCards({title:`Exile ${x.n} ${x.desc} cards from your graveyard`, cards, min:x.n, max:x.n}); if (!ids || ids.length < x.n) return false; ids.forEach(id => moveCard(id, 'ex', {quiet:true})); continue; }
      if (!(await pe([x], c))) return false;
    }
    return true;
  };
}

/* ---------- Resolution of this round's stack items ---------- */
const R21BOP = {};
{
  const rt = resolveTop;
  resolveTop = async function(it, ...a){
    if (it && (it.r21b || (it.dop && R21BOP[it.dop]))){
      if (UI.resolving) return; const i = S.stk.indexOf(it); if (i < 0) return;
      UI.resolving = true; clearUndo();
      try { S.stk.splice(i, 1); commit(); await R21BOP[it.r21b || it.dop](it); }
      catch (e){ console.warn(e); log('⚠ something went wrong resolving that'); }
      finally { UI.resolving = false; commit(); queueRender(); }
      return;
    }
    const isSpell = it && it.kind === 'spell' && !it.copy; const c = isSpell ? it.card : null;
    const r = await rt(it, ...a);
    if (c && it.r21bpost) try { await r21bAfterResolve(c, it); } catch (e){ console.warn(e); }
    return r;
  };
}

/* ======================================================================
   DOMAIN 2 — alternative costs, other zones, hand abilities
   ====================================================================== */

/* ---------- Cycling, landcycling, typecycling; “when you cycle” ---------- */
function r21bCycles(c){
  const out = [];
  for (const l of r21bLines(c.k)) for (const part of l.split(/,\s*(?=[a-z ]*cycling\b)/i)){
    const m = part.trim().match(/^((?:basic )?land|[a-z]+)?cycling\s*(—.+|(?:\{[^}]+\})+)$/i); if (!m) continue;
    const ty = (m[1] || '').toLowerCase(); const cost = r21bCost(m[2]);
    const desc = !ty ? null : ty === 'basic land' ? 'basic land' : ty === 'land' ? 'land' : ty;
    out.push({ty, desc, cost, label:`${ty ? cap(ty) + 'cycling' : 'Cycling'} ${cost.label}`});
  }
  return out;
}
async function r21bCycle(c, cy){
  if (find(c.id)[0] !== 'hand') return;
  let cost = cy.cost, x = 0;
  if (/\{X\}/i.test(cost.mana)){ const v = await askNumber(`${cname(c)}: choose X for cycling`, 'Your pool: ' + (poolText(S.pool) || 'empty'), 0); if (v == null) return; x = v; cost = {...cost, mana:cost.mana.replace(/\{X\}/gi, x ? `{${x}}` : '')}; }
  if (!r21bKnown(cost)){ toast('This cycling cost is not supported'); return; }
  if (!(await r21bPay(cost, c))) return;
  const nm = cname(c);
  UI.discarding = UI.discarding || []; const own = UI.discarding.length === 0; moveCard(c.id, 'gy'); if (own) UI.discarding = null;
  const txt = cy.desc ? `Search your library for ${/^[aeiou]/.test(cy.desc) ? 'an' : 'a'} ${cy.desc} card, reveal it, put it into your hand, then shuffle.` : 'Draw a card.';
  r21bStack({kind:'ability', k:c.k, nm, txt, srcId:c.id, r21b:'cycle', desc:cy.desc, x});
  log(`cycled ${nm} (${cy.label})`);
  emit({type:'cycle', k:c.k, id:c.id, cnt:1});
  for (const l of r21bLines(c.k)){ const m = l.match(/^when you cycle ~(?: or discard ~| or discard it)?, ([\s\S]+)$/i); if (m) r21bTrig(c, m[1], {x, evX:x, r21bX:1}); }
  commit();
}
R21BOP.cycle = async it => {
  const ctx = {k:it.k, name:it.nm, it, srcId:it.srcId, full:it.txt};
  if (it.desc){ await searchLibrary(it.desc, 'put it into your hand', ctx); }
  else draw(1);
  log(`${it.nm}: cycling resolved`);
};
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    if (/^you cycle ~(?: or discard (?:~|it))?$/.test(c)) return {ev:'r21bcycself', subj:'self', ctl:'you', desc:''};
    if (/^you cycle (?:a|another) card$/.test(c)) return {ev:'cycle', subj:/another/.test(c) ? 'other' : 'any', ctl:'you', desc:''};
    if (/^a player cycles a card$/.test(c)) return {ev:'cycle', subj:'any', ctl:'any', desc:''};
    if (/^you cycle or discard (?:a|another) card$/.test(c)) return {ev:'discard', subj:'any', ctl:'you', desc:''};
    if (/^you cycle (?:one or more|a) (.+?) cards?$/.test(c)) { const d = c.match(/^you cycle (?:one or more|a) (.+?) cards?$/)[1]; return {ev:'cycle', subj:'any', ctl:'you', desc:sing(d)}; }
    return ct(w, c);
  };
  EV_TYPES.push('cycle');
}

/* ---------- Transmute ---------- */
function r21bTransmute(c){ const m = r21bKw(c.k, new RegExp('^transmute ' + r21bManaRe + '$', 'i')); return m ? r21bCost(m[1]) : null; }
async function r21bDoTransmute(c, cost){
  if (!sorceryTime()){ toast('Transmute only as a sorcery'); return; }
  if (!(await r21bPay(cost, c))) return;
  const mv = info(c.k)?.mv || 0; const nm = cname(c);
  UI.discarding = []; moveCard(c.id, 'gy'); UI.discarding = null;
  r21bStack({kind:'ability', k:c.k, nm, txt:`Search your library for a card with mana value ${mv}, reveal it, put it into your hand, then shuffle.`, srcId:c.id, r21b:'transmute', mv});
  log(`transmuted ${nm} (looking for mana value ${mv})`); commit();
}
R21BOP.transmute = async it => {
  const ns = rulesOn('noSearch')[0]; if (ns){ log(`can't search — ${ns.src}`); return; }
  const legal = S.lib.filter(c => (info(c.k)?.mv || 0) === it.mv && !isLand(c.k) || (it.mv === 0 && isLand(c.k)));
  const ids = UI.dry ? [] : legal.length ? await pickCards({title:`${it.nm}: find a card with mana value ${it.mv}`, cards:legal, min:0, max:1, noneLabel:'Find nothing'}) : [];
  if (ids && ids[0]){ const c = S.lib.find(x => x.id === ids[0]); if (c){ S.lib.splice(S.lib.indexOf(c), 1); S.hand.push(c); log(`${it.nm}: revealed ${cname(c)} and put it into their hand`); } }
  shuffle(S.lib); log('shuffled their library'); commit();
};

/* ---------- Suspend: exile with time counters; remove one each upkeep; cast free when the last is removed ---------- */
function r21bSuspend(c){ const m = r21bKw(c.k, /^suspend (\d+|x)—(.+)$/i); return m ? {n:m[1].toLowerCase() === 'x' ? 'x' : +m[1], cost:r21bCost(m[2])} : null; }
function r21bSuspendWhy(c, sp){
  if (phaseNow().n === 0) return 'Start the game first';
  const a = info(c.k); const inst = /\bInstant\b/.test(a.t) || hasKwText(faceOf(c) || a, 'flash');
  if (!inst && !sorceryTime()) return 'only when you could cast a sorcery';
  return r21bWhy(sp.cost, c);
}
async function r21bDoSuspend(c, sp){
  const why = r21bSuspendWhy(c, sp); if (why){ toast(why); return; }
  let n = sp.n, cost = sp.cost;
  if (n === 'x'){ const v = await askNumber(`${cname(c)}: suspend with X time counters`, '', 1); if (v == null) return; n = Math.max(1, v); cost = {...cost, mana:cost.mana.replace(/\{X\}/gi, `{${n}}`)}; }
  if (!(await r21bPay(cost, c))) return;
  moveCard(c.id, 'ex', {quiet:true}); c.r21bsus = 1; c.nc = {...(c.nc || {}), time:n}; c.co = n;
  log(`suspended ${cname(c)} with ${n} time counter${n === 1 ? '' : 's'}`); commit();
}
function r21bSuspendUpkeep(){
  for (const c of S.ex.filter(x => x.r21bsus && (x.nc || {}).time > 0)) r21bTrig(c, 'Remove a time counter from it. When the last is removed, cast it without paying its mana cost.', {r21b:'susTick'});
}
R21BOP.susTick = async it => {
  const c = S.ex.find(x => x.id === it.srcId); if (!c || !c.r21bsus) return;
  c.nc.time = Math.max(0, (c.nc.time || 0) - 1); c.co = c.nc.time; log(`${cname(c)}: removed a time counter (${c.nc.time} left)`); commit();
  if (c.nc.time > 0) return;
  r21bTrig(c, 'Cast it without paying its mana cost (suspend).', {r21b:'susCast'});
};
R21BOP.susCast = async it => {
  const c = S.ex.find(x => x.id === it.srcId); if (!c) return;
  if (UI.dry) return;
  const yes = await askYes(`${cname(c)}: the last time counter is gone — cast it without paying its mana cost?`, 'Cast it', 'Leave it in exile');
  delete c.r21bsus; if (c.nc) delete c.nc.time; c.co = 0;
  if (!yes){ log(`${cname(c)} stays in exile`); return; }
  const creature = isCreatureCard(c);
  await r21bCastNow(c, 'ex', {free:true});
  const it2 = S.stk.find(x => x.card === c); if (it2 && creature){ it2.r21bpost = 1; it2.r21bhaste = 1; }
};
{
  const hh = hasHaste;
  hasHaste = function(c){ if (c && c.r21bh) return true; return hh(c); };
}

/* ---------- Plot: exile it now, cast it free on a later turn as a sorcery ---------- */
function r21bPlot(c){ const m = r21bKw(c.k, /^plot (.+)$/i); return m && /^\{/.test(m[1]) ? r21bCost(m[1]) : null; }
async function r21bDoPlot(c, cost){
  if (!sorceryTime()){ toast('Plot only as a sorcery'); return; }
  const disc = rulesOn('r21bplotDisc').reduce((a, r) => a + r.n, 0); const pc = parseCost(cost.mana); if (disc) pc.gen = Math.max(0, pc.gen - disc);
  const plan = payPlan(pc, S.pool); if (plan.err){ toast(`Not enough mana: ${plan.err}`); return; }
  S.pool = plan.pool; moveCard(c.id, 'ex', {quiet:true}); c.r21bplot = turnStr(); log(`plotted ${cname(c)} — cast it for free on a later turn`); commit();
}
STATIC_RULES.push([/^plotting cards from your hand costs \{(\d+)\} less$/, m => ({kind:'r21bplotDisc', who:'you', n:+m[1]})]);

/* ---------- Hand menu ---------- */
function r21bHandOpts(c){
  const out = []; if (!S || !info(c.k)) return out; const pn = phaseNow();
  r21bCycles(c).forEach(cy => { const why = pn.n === 0 ? 'Start the game first' : !r21bKnown(cy.cost) ? 'unsupported cost' : r21bWhy({...cy.cost, mana:cy.cost.mana.replace(/\{X\}/gi, '')}, c); out.push({label:`${cy.label}${cy.desc ? ` — find a ${cy.desc} card` : ' — draw a card'}`, why, run:() => r21bCycle(c, cy)}); });
  const tm = r21bTransmute(c); if (tm) out.push({label:`Transmute ${tm.label} — find a card with mana value ${info(c.k).mv || 0}`, why:!sorceryTime() ? 'only as a sorcery' : r21bWhy(tm, c), run:() => r21bDoTransmute(c, tm)});
  const sp = r21bSuspend(c); if (sp) out.push({label:`Suspend ${sp.n}—${sp.cost.label}`, why:r21bSuspendWhy(c, sp), run:() => r21bDoSuspend(c, sp)});
  const pl = r21bPlot(c); if (pl) out.push({label:`Plot ${pl.label} (cast free on a later turn)`, why:!sorceryTime() ? 'only as a sorcery' : r21bWhy(pl, c), run:() => r21bDoPlot(c, pl)});
  return out;
}
{
  const hi = r8HandItems;
  r8HandItems = function(c, zone){
    let s = hi(c, zone); if (zone !== 'hand' || !S) return s;
    r21bHandOpts(c).forEach((o, i) => { s += `<button type="button" data-act="r21bh" data-id="${c.id}" data-i="${i}" ${o.why ? 'disabled' : ''}><span>${manaHTML(esc(o.label))}${o.why ? `<small class="why">${esc(o.why)}</small>` : ''}</span></button>`; });
    return s;
  };
}
Object.assign(ACT, {
  r21bh(el){ const c = S.hand.find(x => x.id === +el.dataset.id); closeMenu(); if (!c) return; const o = r21bHandOpts(c)[+el.dataset.i]; if (o && !o.why) o.run(); else if (o) toast(o.why); },
  r21bg(el){ const [z,,c] = find(+el.dataset.id); closeModal(); if (!c || z !== 'gy') return; const o = r21bGyAbils(c)[+el.dataset.i]; if (o && !o.why) o.run(); else if (o) toast(o.why); },
  r21bx(el){ const [z,,c] = find(+el.dataset.id); closeModal(); if (!c || z !== 'ex') return; r21bCastPlotted(c); },
});

/* ---------- Miracle: the first card you draw in a turn ---------- */
{
  const dr = draw;
  draw = function(n = 1){
    if (!S || UI.dry || phaseNow().n === 0) return dr(n);
    const first = (S.drawnT === turnStr() ? (S.drawn || 0) : 0) === 0 ? S.lib[0] : null;
    const r = dr(n);
    if (first && S.hand.includes(first)){ const m = r21bKw(first.k, /^miracle (.+)$/i); if (m && /^\{/.test(m[1])){ log(`revealed ${cname(first)} (miracle)`); r21bTrig(first, `You may cast it for its miracle cost ${m[1]}.`, {r21b:'miracle', cost:m[1]}); commit(); } }
    return r;
  };
}
R21BOP.miracle = async it => {
  const c = S.hand.find(x => x.id === it.srcId); if (!c || UI.dry) return;
  const sc = spellCost(c, 'hand', {alt:{mana:it.cost}}); const p = payPlan(sc.cost, S.pool);
  const v = await askChoice({title:`${cname(c)}: miracle — cast it for ${costStr(sc.cost)}?`, text:p.err ? `Tap mana first (${p.err}), then choose Cast.` : (sc.notes.join(', ') || ''), options:[{label:`Cast for ${costStr(sc.cost)}`, value:'cast'}, {label:'Keep it in hand', value:'no'}]});
  if (v !== 'cast') return;
  await r21bCastNow(c, 'hand', {gy:{mana:it.cost, extra:[], label:'Miracle'}});
};

/* ---------- Madness: discarding it exiles it; you may cast it for the madness cost ---------- */
{
  const mc = moveCard;
  moveCard = function(id, to, o = {}){
    const [from, , c] = find(id);
    if (S && c && from === 'hand' && to === 'gy' && !o.r21bnomad && !UI.dry && phaseNow().n > 0){
      const m = r21bKw(c.k, /^madness(.+)$/i);
      if (m){ const cost = r21bCost(m[1].trim()); mc(id, 'ex', {...o, quiet:true}); if (UI.discarding){ emit({type:'discard', k:c.k, id:c.id, cnt:1}); UI.discarding.push(c); } c.disc = turnStr(); c.r21bmad = 1; log(`discarded ${cname(c)} — exiled with madness`); r21bTrig(c, `You may cast it for its madness cost ${cost.label}. If you don't, put it into your graveyard.`, {r21b:'madness', cost}); commit(); return; }
    }
    if (c && from === 'bf' && to !== 'bf'){ ['r21bh', 'r21bproto', 'r21bbestow', 'r21bblitz', 'kicked', 'r21becho', 'r21bimp', 'esc'].forEach(f => { delete c[f]; }); }
    return mc(id, to, o);
  };
}
R21BOP.madness = async it => {
  const c = S.ex.find(x => x.id === it.srcId); if (!c) return;
  const cost = it.cost; let cast = false;
  if (!UI.dry && r21bKnown(cost)){
    const sc = spellCost(c, 'ex', {alt:{mana:cost.mana}}); const p = payPlan(sc.cost, S.pool); const why = p.err || cost.extra.map(x => extraFeasible(x, c)).find(Boolean) || '';
    const v = await askChoice({title:`${cname(c)}: madness — cast it for ${costStr(sc.cost)}${cost.extra.length ? ' + ' + cost.extra.map(x => x.label).join(', ') : ''}?`, text:why ? `Tap mana first (${why}), then choose Cast.` : '', options:[{label:'Cast it', value:'cast'}, {label:'Put it into the graveyard', value:'no'}]});
    if (v === 'cast'){ await r21bCastNow(c, 'ex', {gy:{mana:cost.mana, extra:cost.extra, label:'Madness'}}); cast = find(c.id)[0] !== 'ex'; }
  }
  if (!cast && find(c.id)[0] === 'ex'){ delete c.r21bmad; moveCard(c.id, 'gy', {quiet:true, r21bnomad:true}); log(`${cname(c)} went to the graveyard`); }
};

/* ---------- Alternative costs offered as one-click hand options ---------- */
function r21bOppLost(){ const L = S.r21blife; if (!L || L.t !== turnStr()) return false; return opponents().some(p => L.min[p.pid] != null && L.min[p.pid] < L.start[p.pid]) || !!(S.r21blost && S.r21blost === turnStr()); }
function r21bCastOther(c){ return (S.casts || []).some(x => x.t === turnStr() && x.id !== c.id); }
function r21bCombatHitWith(test){ const d = S.r21bcd; if (!d || d.t !== turnStr()) return false; return d.ks.some(test); }
function r21bMakeToken(k, extra = {}){ const tk = {id:S.nid++, k, tok:true, n:1, sk:true, ...extra}; place(tk); S.bf.push(tk); log(`created a ${info(k)?.n || 'token'} token${extra.r21bproto ? ` (${extra.r21bproto.join('/')})` : ''}`); emit({type:'enter', k, id:tk.id, tok:1}); commit(); return tk; }
function r21bAlts(c, zone){
  const out = []; const a = info(c.k); if (!a || !S || isLand(c.k) || (zone !== 'hand' && zone !== 'cz')) return out; let m;
  const add = (kind, label, mana, extra, o = {}) => out.push({kind, label, mana, extra:extra || [], ...o});
  for (const l of r21bLines(c.k)){
    if ((m = l.match(/^dash ((?:\{[^}]+\})+)$/i))) add('dash', `Dash ${m[1]} — haste, back to hand at end step`, m[1]);
    else if ((m = l.match(/^blitz ((?:\{[^}]+\})+)$/i))) add('blitz', `Blitz ${m[1]} — haste, draw when it dies, sacrificed at end step`, m[1]);
    else if ((m = l.match(/^spectacle ((?:\{[^}]+\})+)$/i))) add('spectacle', `Spectacle ${m[1]}`, m[1], [], {cond:() => r21bOppLost() ? '' : 'no opponent lost life this turn'});
    else if ((m = l.match(/^surge ((?:\{[^}]+\})+)$/i))) add('surge', `Surge ${m[1]}`, m[1], [], {cond:() => r21bCastOther(c) ? '' : "you haven't cast another spell this turn"});
    else if ((m = l.match(/^prowl ((?:\{[^}]+\})+)$/i))){ const ty = r21bTypes(c.k); add('prowl', `Prowl ${m[1]}`, m[1], [], {cond:() => r21bCombatHitWith(k => r21bTypes(k).some(t => ty.includes(t)) || /changeling/i.test(info(k)?.o || '')) ? '' : `no ${ty.join('/')} dealt combat damage to a player this turn`}); }
    else if ((m = l.match(/^freerunning ((?:\{[^}]+\})+)$/i))) add('freerunning', `Freerunning ${m[1]}`, m[1], [], {cond:() => r21bCombatHitWith((k, cmd) => r21bTypes(k).includes('assassin')) || (S.r21bcd && S.r21bcd.t === turnStr() && S.r21bcd.cmd) ? '' : 'no Assassin or commander dealt combat damage to a player this turn'});
    else if ((m = l.match(/^web-slinging ((?:\{[^}]+\})+)$/i))) add('web', `Web-slinging ${m[1]} + return a tapped creature`, m[1], [extraPart("return a tapped creature you control to its owner's hand")]);
    else if ((m = l.match(/^emerge(?: from (\w+))? ((?:\{[^}]+\})+)$/i))) add('emerge', `Emerge ${m[2]} — sacrifice ${m[1] ? 'an ' + m[1] : 'a creature'}, minus its mana value`, m[2], [], {emDesc:(m[1] || 'creature').toLowerCase()});
    else if ((m = l.match(/^prototype ((?:\{[^}]+\})+) — (\d+)\/(\d+)$/i))) add('proto', `Prototype ${m[1]} — ${m[2]}/${m[3]}`, m[1], [], {pt:[+m[2], +m[3]]});
    else if ((m = l.match(/^warp ((?:\{[^}]+\})+)$/i)) && zone === 'hand') add('warp', `Warp ${m[1]} — exiled at end step, cast it again later`, m[1]);
    else if ((m = l.match(/^bestow ((?:\{[^}]+\})+)$/i))) add('bestow', `Bestow ${m[1]} — as an Aura`, m[1]);
    else if ((m = l.match(/^impending (\d+)—((?:\{[^}]+\})+)$/i))) add('impending', `Impending ${m[1]}—${m[2]} — not a creature until the time counters are gone`, m[2], [], {n:+m[1]});
    else if ((m = l.match(/^overload ((?:\{[^}]+\})+)$/i))) add('overload', `Overload ${m[1]} — “target” becomes “each”`, m[1]);
    else if ((m = l.match(/^evoke\s*—\s*(.+)$/i))){ const cost = r21bCost(m[1]); if (r21bKnown(cost)) add('evoke', `Evoke — ${cost.label}`, cost.mana, cost.extra, {evoke:true}); }
  }
  for (const o of out){
    const sc = spellCost(c, zone, {alt:{mana:o.mana}}); o.sc = sc;
    if (o.kind === 'emerge'){ const best = S.bf.filter(b => !b.fd && descOk(b.k, o.emDesc, {tok:b.tok})).reduce((mx, b) => Math.max(mx, b.tok ? 0 : (info(b.k)?.mv || 0)), -1); if (best < 0){ o.why = `you control no ${o.emDesc}`; continue; } const cc = {...sc.cost, gen:Math.max(0, sc.cost.gen - best)}; o.why = payPlan(cc, S.pool).err || ''; continue; }
    const tm = timingOk(c); o.why = !tm.ok ? tm.why : (o.cond && o.cond()) || payPlan(sc.cost, S.pool).err || o.extra.map(x => extraFeasible(x, c)).find(Boolean) || '';
    if (!o.why && o.kind === 'bestow' && !S.bf.some(b => isCreatureCard(b)) && ![...OPP.values()].some(s => (s.bf || []).some(b => b.k && isCreatureCard(b)))) o.why = 'no creature to enchant';
  }
  return out;
}
async function r21bCastAlt(c, zone, alt){
  if (UI.casting) return;
  UI.r21bforce = {...alt, cid:c.id};
  try {
    if (alt.kind === 'bestow'){ const t = await chooseTargets('Enchant target creature.', {pid:MYPID, col:info(c.k)?.c, types:'Aura', id:c.id}, `${cname(c)}: bestow on which creature?`); if (!t || !t.flat().length) return; UI.r21bforce.att = t.flat()[0]; }
    await beginCast(c, zone, {});
  } finally { UI.r21bforce = null; }
}
{
  const hi = r8HandItems;
  r8HandItems = function(c, zone){
    let s = hi(c, zone); if ((zone !== 'hand' && zone !== 'cz') || !S || phaseNow().n === 0) return s;
    r21bAlts(c, zone).forEach((o, i) => { s += `<button type="button" data-act="r21ba" data-id="${c.id}" data-z="${zone}" data-i="${i}" ${o.why ? 'disabled' : ''}><span>Cast — ${manaHTML(esc(o.label))}${o.sc && o.sc.notes.length ? `<small class="why">${esc(o.sc.notes.join(', '))}</small>` : ''}${o.why ? `<small class="why">${esc(o.why)}</small>` : ''}</span></button>`; });
    return s;
  };
  Object.assign(ACT, { r21ba(el){ const [z,,c] = find(+el.dataset.id); closeMenu(); if (!c || z !== el.dataset.z) return; const o = r21bAlts(c, z)[+el.dataset.i]; if (!o) return; if (o.why){ toast(o.why); return; } r21bCastAlt(c, z, o); } });
  const ac = altCosts;
  altCosts = function(c, zone){ if (UI.r21bforce && UI.casting) return []; return ac(c, zone); };
  const ts = targetSpecs;
  targetSpecs = function(t){ if (UI.r21bforce && UI.casting && (UI.r21bforce.kind === 'overload' || UI.r21bforce.kind === 'bestow')) return []; return ts(t); };
}

/* ---------- Additional costs: kicker, multikicker, buyback, offspring, squad, replicate ---------- */
function r21bAdds(c){
  const out = []; let m;
  for (const l of r21bLines(c.k)){
    if ((m = l.match(/^kicker (.+)$/i))){ for (const part of m[1].split(/\s+and\/or\s+/)){ const cost = r21bCost(part); if (r21bKnown(cost)) out.push({kind:'kick', label:`Kicker ${cost.label}`, cost, max:1}); } }
    else if ((m = l.match(/^multikicker ((?:\{[^}]+\})+)$/i))) out.push({kind:'kick', label:`Multikicker ${m[1]}`, cost:r21bCost(m[1]), max:20});
    else if ((m = l.match(/^buyback (.+)$/i))){ const cost = r21bCost(m[1]); if (r21bKnown(cost)) out.push({kind:'buy', label:`Buyback ${cost.label} (return it to your hand)`, cost, max:1}); }
    else if ((m = l.match(/^offspring ((?:\{[^}]+\})+)$/i))) out.push({kind:'off', label:`Offspring ${m[1]} (a 1/1 token copy)`, cost:r21bCost(m[1]), max:1});
    else if ((m = l.match(/^squad ((?:\{[^}]+\})+)$/i))) out.push({kind:'squad', label:`Squad ${m[1]} (a token copy each time)`, cost:r21bCost(m[1]), max:20});
    else if ((m = l.match(/^replicate ((?:\{[^}]+\})+)$/i))) out.push({kind:'rep', label:`Replicate ${m[1]} (a copy each time)`, cost:r21bCost(m[1]), max:20});
  }
  return out;
}
const r21bManaTimes = (mana, n) => Array(n).fill(mana).join('');
{
  const sc0 = spellCost;
  spellCost = function(c, zone, o = {}){
    const f = UI.r21bforce; if (f && UI.casting && c && f.cid === c.id && !o.alt) o = {...o, alt:{mana:f.mana}};
    const r = sc0(c, zone, o);
    const ad = UI.r21badd; if (ad && ad.mana && UI.casting && c && ad.cid === c.id && r && r.cost){ const a = parseCost(ad.mana); r.cost.gen += a.gen; MANA.forEach(x => { r.cost.col[x] = (r.cost.col[x] || 0) + (a.col[x] || 0); }); r.cost.hyb.push(...a.hyb); r.cost.two.push(...a.two); r.cost.phy.push(...a.phy); r.notes.push(`${ad.label} ${ad.mana}`); }
    return r;
  };
  const xp0 = extraPayments;
  extraPayments = async function(c, sc){
    const f = UI.r21bforce && UI.r21bforce.cid === c.id ? UI.r21bforce : null; let applyMine = [];
    if (f && f.kind === 'emerge'){
      const list = S.bf.filter(b => !b.fd && descOk(b.k, f.emDesc, {tok:b.tok})); if (!list.length) return false;
      const ids = list.length === 1 ? [list[0].id] : await pickCards({title:`Emerge: sacrifice ${f.emDesc === 'creature' ? 'a creature' : 'an ' + f.emDesc} (its mana value is subtracted)`, cards:list, min:1, max:1}); if (!ids || !ids[0]) return false;
      const b = S.bf.find(x => x.id === ids[0]); const mv = b && !b.tok ? (info(b.k)?.mv || 0) : 0; const r = Math.min(mv, sc.cost.gen); sc.cost.gen -= r; if (r) sc.notes.push(`emerge −${r}`);
      applyMine.push(() => { const bb = S.bf.find(x => x.id === ids[0]); if (bb) sacrificeOne(bb); });
    }
    if (f && f.extra && f.extra.length){ if (!(await payExtras(f.extra, c))) return false; }
    const ad = UI.r21badd && UI.r21badd.cid === c.id ? UI.r21badd : null;
    if (ad && ad.extra && ad.extra.length){ if (!(await payExtras(ad.extra, c))) return false; }
    // improvise: tap artifacts for generic mana
    let artIds = [];
    if (/(?:^|\n)improvise(?:\n|$)/i.test(r21bText(c.k)) && sc.cost.gen > 0){
      const cards = S.bf.filter(b => /\bArtifact\b/.test(info(b.k)?.t || '') && !b.tap && !b.fd);
      if (cards.length && !UI.dry){ const r = await pickCards({title:'Improvise: tap artifacts to help pay', hint:`Each artifact tapped pays {1}. Generic cost: {${sc.cost.gen}}.`, cards, min:0, max:Math.min(sc.cost.gen, cards.length), noneLabel:'Tap none'}); if (r == null) return false; artIds = r; sc.cost.gen -= artIds.length; if (artIds.length) sc.notes.push(`improvise −${artIds.length}`); }
    }
    const base = await xp0(c, sc); if (base === false) return false;
    if (!applyMine.length && !artIds.length) return base;
    return {apply(){ if (base) base.apply(); applyMine.forEach(fn => fn()); artIds.forEach(id => { const b = S.bf.find(x => x.id === id); if (b) b.tap = true; }); if (artIds.length) log(`improvised with ${artIds.length} artifact${artIds.length === 1 ? '' : 's'}`); }};
  };
  const ecp = extraCanPay;
  extraCanPay = function(c, sc){ if (ecp(c, sc)) return true; if (!/(?:^|\n)improvise(?:\n|$)/i.test(r21bText(c.k))) return false; const pot = S.bf.filter(b => /\bArtifact\b/.test(info(b.k)?.t || '') && !b.tap && !b.fd).length; return !payPlan({...sc.cost, gen:Math.max(0, sc.cost.gen - pot)}, S.pool).err; };

  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){
    if (UI.casting || !S || !c || UI.dry || isLand(c.k)) return bc(c, zone, o);
    const adds = r21bAdds(c); let add = null; const chosen = {};
    if (adds.length && !UI.replay){
      let mana = '', extra = [], labels = [];
      for (const ad of adds){
        const base = spellCost(c, zone, UI.r21bforce && UI.r21bforce.cid === c.id ? {alt:{mana:UI.r21bforce.mana}} : o.gy ? {alt:{mana:o.gy.mana}} : {});
        const pc = parseCost(mana); const bc2 = {...base.cost, gen:base.cost.gen + pc.gen, col:{...base.cost.col}}; MANA.forEach(x => { bc2.col[x] = (bc2.col[x] || 0) + (pc.col[x] || 0); });
        const can = n => { const a = parseCost(r21bManaTimes(ad.cost.mana, n)); const t = {...bc2, gen:bc2.gen + a.gen, col:{...bc2.col}, hyb:[...bc2.hyb, ...a.hyb], two:[...bc2.two, ...a.two], phy:[...bc2.phy, ...a.phy]}; MANA.forEach(x => { t.col[x] = (t.col[x] || 0) + (a.col[x] || 0); }); return !payPlan(t, S.pool).err && ad.cost.extra.every(x => !extraFeasible(x, c)); };
        let n = 0;
        if (ad.max === 1){ const ok = can(1); const v = await askChoice({title:`${cname(c)}: ${ad.label}?`, text:ok ? '' : 'Tap more mana first if you want to pay it.', options:[{label:`Pay it (+${ad.cost.label})`, value:1, disabled:!ok, why:ok ? '' : 'not enough mana'}, {label:"Don't pay it", value:0}]}); if (v == null) return; n = v; }
        else { let mx = 0; while (mx < ad.max && can(mx + 1)) mx++; if (mx > 0){ const v = await askChoice({title:`${cname(c)}: ${ad.label} — how many times?`, options:Array.from({length:mx + 1}, (_, i) => ({label:i === 0 ? "Don't pay it" : `${i} time${i === 1 ? '' : 's'} (+${r21bManaTimes(ad.cost.mana, i)})`, value:i}))}); if (v == null) return; n = v; } }
        if (n){ mana += r21bManaTimes(ad.cost.mana, n); for (let i = 0; i < n; i++) extra.push(...ad.cost.extra); labels.push(ad.label.split(' (')[0] + (n > 1 ? ' ×' + n : '')); chosen[ad.kind] = (chosen[ad.kind] || 0) + n; }
      }
      if (mana || extra.length) add = {cid:c.id, mana, extra, label:labels.join(', ')};
    }
    UI.r21badd = add; const n0 = S.stk.length; const f = UI.r21bforce && UI.r21bforce.cid === c.id ? UI.r21bforce : null;
    c.kicked = chosen.kick || 0; if (f && f.kind === 'proto') c.r21bproto = f.pt; else delete c.r21bproto;
    try { await bc(c, zone, o); }
    finally { UI.r21badd = null; }
    const it = S.stk.length > n0 ? S.stk.find(x => x.card === c && x.kind === 'spell') : null;
    if (!it){ if (find(c.id)[0] === zone){ c.kicked = 0; delete c.r21bproto; } return; }
    if (o.gy && o.gy.kind === 'escape') c.esc = 1;
    if (chosen.kick) it.kicked = chosen.kick;
    if (chosen.buy) it.r21bbuy = 1; if (chosen.off) it.r21boff = 1; if (chosen.squad) it.r21bsquad = chosen.squad;
    if (f){ it.r21balt = f.kind; if (f.kind === 'prowl') it.prowled = 1; if (f.att) it.r21batt = f.att; if (f.n) it.r21bn = f.n; if (f.kind === 'evoke') it.evoke = true; }
    if (it.r21balt || chosen.buy || chosen.off || chosen.squad) it.r21bpost = 1;
    if (chosen.rep){ for (let i = 0; i < chosen.rep; i++){ let tgts = it.tgts; if (targetSpecs(it.txt).length){ const t = await chooseTargets(it.txt, {pid:MYPID, col:info(c.k)?.c, types:info(c.k)?.t, id:c.id}, `${cname(c)} copy ${i + 1}: targets`); if (t) tgts = t; } r21bStack({kind:'spell', k:c.k, nm:`${it.nm} (copy)`, txt:it.txt, x:it.x || 0, copy:true, tgts, tgtNm:tgtLabel(tgts), modes:it.modes}); } log(`replicated ${it.nm} ${chosen.rep} time${chosen.rep === 1 ? '' : 's'}`); commit(); }
    commit();
  };
}
// overload: “target” becomes “each”
function r21bOverload(t){ return String(t).split('\n').filter(l => !/^overload\b/i.test(l.trim())).join('\n').replace(/\bup to one target\b/gi, 'each').replace(/\btarget\b/gi, 'each').replace(/\beach (\w+) or (\w+) an opponent controls\b/gi, 'each $1 or $2 an opponent controls'); }
{
  const re = runEffects;
  runEffects = async function(txt, ctx){ if (ctx && ctx.it && ctx.it.kind === 'spell' && ctx.it.r21balt === 'overload'){ txt = r21bOverload(txt); ctx.full = txt; ctx.tgts = null; } return re(txt, ctx); };
}
async function r21bAfterResolve(c, it){
  const [z] = find(c.id);
  if (z === 'bf'){
    if (it.r21balt === 'dash'){ c.r21bh = 1; S.dly.push({id:rid(6), eff:'Return it to its owner\'s hand (dash).', k:c.k, nm:cname(c), srcId:c.id, op:'r21bret'}); log(`${cname(c)} was dashed: haste, returns to hand at the next end step`); }
    if (it.r21balt === 'blitz'){ c.r21bh = 1; c.r21bblitz = 1; S.dly.push({id:rid(6), eff:'Sacrifice it (blitz).', k:c.k, nm:cname(c), srcId:c.id, op:'sac'}); log(`${cname(c)} was blitzed: haste, draw a card when it dies, sacrificed at the next end step`); }
    if (it.r21balt === 'warp'){ S.dly.push({id:rid(6), eff:'Exile it (warp). You may cast it from exile on a later turn.', k:c.k, nm:cname(c), srcId:c.id, op:'r21bwarp'}); log(`${cname(c)} was warped: exiled at the next end step`); }
    if (it.r21balt === 'impending'){ c.nc = {...(c.nc || {}), time:it.r21bn || 0}; c.co = Object.values(c.nc).reduce((a, b) => a + b, 0); c.r21bimp = 1; log(`${cname(c)} entered with ${it.r21bn} time counters — not a creature until they're gone`); }
    if (it.r21balt === 'bestow' && it.r21batt){ c.att = {pid:it.r21batt.pid, id:it.r21batt.id}; c.r21bbestow = 1; log(`${cname(c)} is bestowed on ${it.r21batt.nm || 'a creature'}`); }
    if (it.r21bhaste) c.r21bh = 1;
    if (it.r21boff) r21bMakeToken(c.k, {r21bproto:[1, 1]});
    for (let i = 0; i < (it.r21bsquad || 0); i++) r21bMakeToken(c.k);
  } else if (it.r21bbuy && z === 'gy'){ moveCard(c.id, 'hand', {quiet:true}); log(`${cname(c)} returned to hand (buyback)`); }
  commit();
}
R21BOP.r21bret = async it => { const [z] = find(it.srcId); if (z === 'bf'){ moveCard(it.srcId, 'hand'); log(`${it.nm} returned to hand`); } };
R21BOP.r21bwarp = async it => { const [z, , c] = find(it.srcId); if (z === 'bf' && c){ moveCard(c.id, 'ex', {quiet:true}); const c2 = S.ex.find(x => x.id === c.id); if (c2){ c2.mayPlay = {adv:true, r21bwarp:turnStr(), t:turnStr()}; } log(`${it.nm} was exiled (warp) — you may cast it on a later turn`); } };
{
  const ew = exWindowOk;
  exWindowOk = function(c){ if (c && c.mayPlay && c.mayPlay.r21bwarp && c.mayPlay.r21bwarp === turnStr()) return false; return ew(c); };
  const st = stats;
  stats = function(c, pid){ const r = st(c, pid); if (c && c.r21bproto){ const p = String(info(c.k)?.p || '0/0').split('/').map(x => parseInt(x) || 0); if (r) return [r[0] - p[0] + c.r21bproto[0], r[1] - p[1] + c.r21bproto[1]]; const n = (c.cp || 0) - (c.cm || 0); const pu = c.pu || [0, 0]; return [c.r21bproto[0] + n + (pu[0] || 0), c.r21bproto[1] + n + (pu[1] || 0)]; } return r; };
  const ic = isCreatureCard;
  isCreatureCard = c => { const r = ic(c); if (!r || !c || !S) return r; if (c.r21bimp && (c.nc || {}).time > 0) return false; if (c.r21bbestow && c.att){ const host = c.att.pid === MYPID ? S.bf.find(x => x.id === c.att.id) : (OPP.get(c.att.pid)?.bf || []).find(x => x.id === c.att.id); if (host) return false; } return r; };
}
// blitz: draw a card when it dies
{
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ const [from, , c] = find(id); const bl = c && from === 'bf' && to === 'gy' && c.r21bblitz; const r = mc(id, to, o); if (bl){ log(`${cname(c)} died — blitz: draw a card`); draw(1); } return r; };
}

/* ---------- Graveyard: aftermath, embalm, eternalize, encore; exile: plotted and suspended cards ---------- */
function r21bGyAbils(c){
  const out = []; let m;
  for (const l of r21bLines(c.k)){
    if ((m = l.match(/^(embalm|eternalize|encore) (.+)$/i))){ const kind = m[1].toLowerCase(); const cost = r21bCost(m[2]); if (!r21bKnown(cost)) continue;
      out.push({label:`${cap(kind)} ${cost.label}`, why:!sorceryTime() ? 'only as a sorcery' : r21bWhy(cost, c), run:async () => { if (!sorceryTime()){ toast('Only as a sorcery'); return; } if (!(await r21bPay(cost, c))) return; moveCard(c.id, 'ex', {quiet:true}); r21bStack({kind:'ability', k:c.k, nm:cname(c), txt:{embalm:'Create a token that\'s a copy of it, except it\'s a white Zombie with no mana cost.', eternalize:'Create a token that\'s a copy of it, except it\'s a 4/4 black Zombie with no mana cost.', encore:'For each opponent, create a token copy that attacks that opponent this turn if able. They gain haste. Sacrifice them at the beginning of the next end step.'}[kind], srcId:c.id, r21b:'gyTok', how:kind}); log(`${kind === 'encore' ? 'used encore on' : kind + 'ed'} ${cname(c)}`); commit(); }});
    }
  }
  return out;
}
R21BOP.gyTok = async it => {
  if (it.how === 'embalm'){ const t = r21bMakeToken(it.k); addXType(t, 'zombie'); }
  else if (it.how === 'eternalize'){ const t = r21bMakeToken(it.k, {r21bproto:[4, 4]}); addXType(t, 'zombie'); }
  else { for (const p of opponents()){ const t = r21bMakeToken(it.k, {ekw:['haste'], r21bh:1, goad:{by:MYPID, n:currentTurn()[0]}}); t.r21bmust = p.pid; S.dly.push({id:rid(6), eff:'Sacrifice it (encore).', k:it.k, nm:it.nm, srcId:t.id, op:'sac'}); } }
  commit();
};
{
  const gb = gyButtons;
  gyButtons = function(c){ let s = gb(c); r21bGyAbils(c).forEach((o, i) => { s += `<button type="button" data-act="r21bg" data-id="${c.id}" data-i="${i}" ${o.why ? `disabled title="${esc(o.why)}"` : ''}>${manaHTML(esc(o.label))}${o.why ? ' — ' + esc(short(o.why, 40)) : ''}</button>`; }); return s; };
  const go = gyOptions;
  gyOptions = function(c){ const r = go(c) || []; const a = info(c.k); if (a && a.lay === 'split' && a.faces && a.faces[1] && /(?:^|\n)aftermath/i.test(a.faces[1].o || '') && !r.some(g => g.kind === 'aftermath')) r.push({kind:'aftermath', label:`Cast ${a.faces[1].n} ${a.faces[1].m} (aftermath)`, mana:a.faces[1].m, extra:[], after:'ex', face:'1'}); return r; };
  const cg = castFromGy;
  castFromGy = async function(c, g){ if (g && g.face) return castFace(c, 'gy', g.face, {gy:g}); return cg(c, g); };
  const ma = mustAttack;
  // encore tokens must attack their opponent
}
{
  const rx = r7ExButtons;
  r7ExButtons = function(c){
    if (c.r21bplot && phaseNow().n > 0){ const ok = c.r21bplot !== turnStr() && sorceryTime(); return `<button type="button" data-act="r21bx" data-id="${c.id}" ${ok ? '' : 'disabled'}>Cast free (plotted)${ok ? '' : ' — ' + (c.r21bplot === turnStr() ? 'on a later turn' : 'only as a sorcery')}</button>`; }
    if (c.r21bsus && (c.nc || {}).time > 0) return `<button type="button" disabled>Suspended — ${c.nc.time} time counter${c.nc.time === 1 ? '' : 's'}</button>`;
    return rx(c);
  };
}
async function r21bCastPlotted(c){
  if (!c.r21bplot || c.r21bplot === turnStr()){ toast('You can cast a plotted card on a later turn'); return; }
  if (!sorceryTime()){ toast('Plotted cards are cast as a sorcery'); return; }
  await beginCast(c, 'ex', {free:true}); if (find(c.id)[0] !== 'ex') delete c.r21bplot; commit();
}

/* ---------- Split cards: aftermath halves and fuse ---------- */
{
  const fo = faceOpts;
  faceOpts = function(c, zone){
    let r = fo(c, zone); const a = info(c.k); if (!a || a.lay !== 'split' || !a.faces || !a.faces[1]) return r;
    if (/(?:^|\n)aftermath/i.test(a.faces[1].o || '')) r = r.filter(o => o.w !== '1' || zone === 'gy');
    if (zone === 'hand' && /(?:^|\n)fuse\b/i.test(a.faces[0].o + '\n' + a.faces[1].o)) r.push({w:'fuse', label:`Cast both halves (fuse) ${a.faces[0].m}${a.faces[1].m}`, f:null});
    return r;
  };
  const df = deriveFace;
  deriveFace = function(k){
    if (typeof k === 'string' && /#fuse$/.test(k)){ const base = DICT.get(k.slice(0, -5)); if (!base || !base.faces) return null; const [f0, f1] = base.faces; const strip = o => String(o || '').split('\n').filter(l => !/^fuse\b/i.test(l.trim())).join('\n');
      const e = {...base, k, n:base.n, m:(f0.m || '') + (f1.m || ''), t:f0.t, o:strip(f0.o) + '\n' + strip(f1.o), p:'', mv:costMV((f0.m || '') + (f1.m || '')), back:null, faces:null, lay:'face', base:base.k, kw:[]}; DICT.set(k, e); return e; }
    return df(k);
  };
}

/* ---------- Manifest, manifest dread; turning manifested creatures face up ---------- */
function r21bManifest(c, why){ if (!c) return null; const [z] = find(c.id); if (!z) return null; moveCard(c.id, 'bf', {fd:true, quiet:true}); const b = S.bf.find(x => x.id === c.id); if (b){ b.fd = true; b.fdc = 'manifest'; b.sk = true; } log(`manifested a card${why ? ' (' + why + ')' : ''}`); commit(); return b; }
{
  const tu = turnUpCost;
  turnUpCost = function(c){ const r = tu(c); if (r) return r; if (c && c.fdc === 'manifest' && /\bCreature\b/.test(info(c.k)?.t || '') && info(c.k)?.m) return {kind:'manifest', cost:info(c.k).m}; return null; };
}

/* ---------- Tracking: opponents losing life, combat damage to players (spectacle, prowl, freerunning) ---------- */
{
  const et = engineTick;
  engineTick = function(...a){
    try { if (S && phaseNow().n > 0){ const ts = turnStr(); if (!S.r21blife || S.r21blife.t !== ts){ S.r21blife = {t:ts, start:{}, min:{}}; } const L = S.r21blife; for (const p of opponents()){ const v = p.s?.life; if (v == null) continue; if (L.start[p.pid] == null) L.start[p.pid] = v; L.min[p.pid] = Math.min(L.min[p.pid] ?? v, v); } r21bWatch(); } } catch (e){ console.warn(e); }
    return et.apply(this, a);
  };
  const em = emit;
  emit = function(ev){ try { if (S && ev && ev.type === 'cdmg' && ev.dp && ev.dp !== MYPID){ const ts = turnStr(); if (!S.r21bcd || S.r21bcd.t !== ts) S.r21bcd = {t:ts, ks:[], cmd:false}; if (ev.k) S.r21bcd.ks.push(ev.k); const c = S.bf.find(x => x.id === ev.id); if (c && c.cmd) S.r21bcd.cmd = true; } if (S && ev && (ev.type === 'loselife') && ev.dp && ev.dp !== MYPID) S.r21blost = turnStr(); } catch {} return em(ev); };
}
r21bOppLost = function(){ const L = S.r21blife; const a = L && L.t === turnStr() && opponents().some(p => L.min[p.pid] != null && L.min[p.pid] < L.start[p.pid]); return !!a || S.r21blost === turnStr(); };

/* ---------- Sentences ---------- */
async function doRound21BPre(s, l, ctx){
  let m; const src = () => srcCardOf(ctx); const it = ctx.it || {};
  if ((m = l.match(/^if (?:~|it|this spell) was kicked, (.+?)(?: instead)?$/))){ const c = src() || ctx.card; const k = it.kicked || (c && c.kicked) || 0; if (k) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); else log(`${ctx.name}: it wasn't kicked`); return true; }
  if ((m = l.match(/^if (?:~|it|this spell) was kicked twice, (.+)$/))){ const c = src() || ctx.card; const k = it.kicked || (c && c.kicked) || 0; if (k >= 2) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true; }
  if ((m = l.match(/^~ enters with (?:a|an|one) ([a-z+\/0-9\-]+) counters? on it for each time it was kicked$/))){ const c = src(); const n = c ? c.kicked || 0 : 0; if (c && n){ if (m[1] === '+1/+1') modCounters(c, 'cp', n); else addNamed(c, m[1], n); } commit(); return true; }
  if ((m = l.match(/^if (?:~'s|its) prowl cost was paid, (.+)$/))){ if (it.prowled) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true; }
  if ((m = l.match(/^if (?:~|it) was blitzed, (.+)$/))){ if (it.r21balt === 'blitz') await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true; }
  if (it.r21bX && (m = l.match(/^create (an?|one|two|three) x\/x (.+? tokens?.*)$/))){ const before = new Set(S.bf.map(c => c.id)); await createFromText(s, ctx); const x = it.x || 0; S.bf.filter(c => !before.has(c.id) && c.tok).forEach(c => { c.r21bproto = [x, x]; }); log(`${ctx.name}: the token${/two|three/.test(m[1]) ? 's are' : ' is'} ${x}/${x}`); commit(); return true; }
  // suspend from effects
  if ((m = l.match(/^exile ~ with (a|one|two|three|four|five|\d+) time counters? on it$/))){ const n = wn(m[1]) || +m[1] || 1; const c = ctx.card || (it.kind === 'spell' ? it.card : null); if (it.kind === 'spell' && c){ it.exAfter = true; c.r21bsus = 1; c.nc = {...(c.nc || {}), time:n}; c.co = n; log(`${ctx.name}: exiled with ${n} time counters (suspended)`); } else { const b = src(); if (b && find(b.id)[0]){ moveCard(b.id, 'ex', {quiet:true}); b.r21bsus = 1; b.nc = {time:n}; b.co = n; } } commit(); return true; }
  if ((m = l.match(/^(?:if it doesn't have suspend, )?it gains suspend$/))) return true;
  if ((m = l.match(/^suspend (\d+|x)—/))) return true;
  // manifest
  if ((m = l.match(/^manifest the top (card|two cards) of your library$/))){ const n = m[1] === 'card' ? 1 : 2; for (let i = 0; i < n && S.lib.length; i++) r21bManifest(S.lib[0]); return true; }
  if ((m = l.match(/^manifest dread$/))){ const top = S.lib.slice(0, 2); if (!top.length) return true; if (UI.dry){ return true; } const ids = top.length === 1 ? [top[0].id] : await pickCards({title:`${ctx.name}: manifest dread — choose the card to manifest (the other goes to your graveyard)`, cards:top, min:1, max:1}); const pick = top.find(c => c.id === (ids || [])[0]) || top[0]; r21bManifest(pick, 'manifest dread'); top.filter(c => c !== pick).forEach(c => moveCard(c.id, 'gy')); return true; }
  if ((m = l.match(/^(?:it|that creature) can be turned face up any time for its mana cost if it's a creature card$/))) return true;
  // recurring costs
  if ((m = l.match(/^(?:then )?sacrifice ~ unless you (pay \w+ life|add \{[^}]+\}|sacrifice an? .+?|discard an? .+?|put an? .+? counter on .+?|pay \{e\}) for each age counter on it$/))){ await r21bCumUnit(m[1], ctx); return true; }
  if ((m = l.match(/^sacrifice ~ unless you (pay (?:\{[^}]+\})+|pay \w+ life|sacrifice an? .+|discard an? .+|return an? .+ you control to its owner's hand|tap an untapped .+ you control)$/))){ await r21bUnless(m[1], ctx); return true; }
  if ((m = l.match(/^remove a (time|fade) counter from ~$/))){ const c = src(); if (c && S.bf.includes(c)){ const have = (c.nc || {})[m[1]] || 0; if (m[1] === 'fade' && !have){ log(`${cname(c)}: no fade counter to remove — sacrificed (fading)`); moveCard(c.id, 'gy', {sac:true}); commit(); return true; } addNamed(c, m[1], -1); log(`${cname(c)}: removed a ${m[1]} counter (${(c.nc || {})[m[1]] || 0} left)`); if (m[1] === 'time' && !((c.nc || {}).time) && ctx.it && ctx.it.r21bvan){ log(`${cname(c)}: the last time counter is gone — sacrificed (vanishing)`); moveCard(c.id, 'gy', {sac:true}); } } commit(); return true; }
  // delayed triggers
  if ((m = l.match(/^at the beginning of (your|the) next (upkeep|end step), (.+)$/)) && !(m[1] === 'the' && m[2] === 'end step')){ r21bDelay(m[2] === 'upkeep' ? 'upkeep' : 'end', m[1] === 'your', s.slice(s.length - m[3].length), ctx); return true; }
  if ((m = l.match(/^at (?:the )?end of combat, (.+)$/)) || (m = l.match(/^at the beginning of the end of combat step, (.+)$/))){ r21bDelay('eoc', false, s.slice(s.length - m[1].length), ctx); return true; }
  if ((m = l.match(/^(sacrifice|exile) (it|that creature|those tokens|that token|them) at (?:the )?end of combat$/))){ r21bDelay('eoc', false, cap(m[1]) + ' it.', ctx); return true; }
  if ((m = l.match(/^(sacrifice|exile) (?:that token|it|those tokens|them) at the beginning of the next upkeep$/))){ r21bDelay('upkeep', false, cap(m[1]) + ' it.', ctx); return true; }
  if ((m = l.match(/^at the beginning of your next end step, (sacrifice|exile) (it|those tokens|them|that token|~)$/))){ r21bDelay('end', true, cap(m[1]) + ' it.', ctx); return true; }
  if (ctx.it && ctx.it.r21bdly && (m = l.match(/^(sacrifice|exile) it$/))){ const ids = ctx.it.r21bids || []; ids.forEach(id => { const [z] = find(id); if (z === 'bf'){ if (m[1] === 'sacrifice') moveCard(id, 'gy', {sac:true}); else moveCard(id, 'ex'); } }); commit(); return true; }
  // overloaded and other “each … you don't control” sentences
  if ((m = l.match(/^(return|tap|untap) each (nonland permanent|creature|artifact|enchantment|permanent|artifact or creature|creature and planeswalker) you don't control(?: to (?:its|their) owners?'s? hands?)?$/))){ const op = {return:'bounce', tap:'tap', untap:'untap'}[m[1]]; if (m[1] === 'return' && !/hand/.test(l)) return false; const d = m[2]; for (const [pid, st] of OPP) (st.bf || []).forEach(c => { if (c.k && descOk(c.k, d, {tok:c.tok})) applyTo({t:'card', pid, id:c.id, k:c.k}, {op, src:ctx.name}); }); log(`${ctx.name}: ${m[1]} each ${d} you don't control`); commit(); return true; }
  if ((m = l.match(/^counter each spell you don't control$/))){ let n = 0; for (const it2 of stackAll()) if (it2.pid !== MYPID && it2.kind === 'spell' && !it2.uc){ S.ctr.push({id:rid(8), sid:it2.sid, un:0}); n++; } if (S.ctr.length > 20) S.ctr.splice(0, S.ctr.length - 20); log(`${ctx.name}: countered ${n} spell${n === 1 ? '' : 's'}`); commit(); return true; }
  if ((m = l.match(/^up to one target (?:[a-z]+ )?creature (?:you control )?gains ([a-z ,]+?) until end of turn$/))){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; const kw = m[1].split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim()).filter(Boolean); if (t) applyTo(t, {op:'pump', src:ctx.name, f:{p:0, t:0, kw}}); commit(); return true; }
  if ((m = l.match(/^((?:non-?[a-z]+ |[a-z]+ )*?)creatures you control gain ([a-z ,]+?) until end of turn$/)) && m[1]){ const d = (m[1] + 'creature').trim(); const kw = m[2].split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim()).filter(Boolean); S.bf.filter(c => isCreatureCard(c) && !c.fd && descOk(c.k, d, {tok:c.tok})).forEach(c => { c.ekw = [...new Set([...(c.ekw || []), ...kw])]; }); log(`${ctx.name}: ${d}s you control gain ${kw.join(', ')}`); commit(); return true; }
  if ((m = l.match(/^turn (?:a|target|up to one target) face-down creature you control face up$/))){ const list = S.bf.filter(c => c.fd); if (!list.length || UI.dry) return true; const ids = list.length === 1 ? [list[0].id] : await pickCards({title:`${ctx.name}: turn a face-down creature face up`, cards:list, min:1, max:1}); const c = S.bf.find(x => x.id === (ids || [])[0]); if (c){ c.fd = false; delete c.fdc; log(`turned ${cname(c)} face up`); emit({type:'turnup', k:c.k, id:c.id}); } commit(); return true; }
  if ((m = l.match(/^return (?:that card|it) to the battlefield under its owner's control with a \+1\/\+1 counter on it at the beginning of the next end step$/))){ const t = (ctx.lastT || [])[0]; const id = t ? t.id : ctx.lastCardId; if (id != null){ S.dly.push({id:rid(6), eff:'Return it to the battlefield with a +1/+1 counter on it.', k:ctx.k, nm:ctx.name, srcId:id, op:'r21bretc', rpid:t && t.pid}); log(`${ctx.name}: returns at the beginning of the next end step`); } commit(); return true; }
  if ((m = l.match(/^at the beginning of that combat, (.+)$/))){ r21bDelay('combat', true, s.slice(s.length - m[1].length), ctx); return true; }
  // extra turns, phases, combats
  if ((m = l.match(/^take (two|three) extra turns after this one$/))){ const n = wn(m[1]) || 2; S.xt = (S.xt || 0) + n; log(`${ctx.name}: takes ${n} extra turns after this one`); commit(); return true; }
  if ((m = l.match(/^(?:then )?if it's your (main phase|combat phase|first combat phase|the first combat phase of your turn), there(?: is|'s) an additional combat phase after this phase(,? followed by an additional main phase)?$/)) || (m = l.match(/^if it's the (first combat phase) of your turn, there is an additional combat phase after this phase( followed by an additional main phase)?$/))){
    const pn = phaseNow(); let ok = pn.mine;
    if (/main/.test(m[1])) ok = ok && (pn.ph === 3 || pn.ph === 5); else if (/first/.test(m[1])) ok = ok && pn.ph === 4 && (!S.cb || S.cb.n === 1); else ok = ok && pn.ph === 4;
    if (ok){ S.xc = (S.xc || 0) + 1; if (pn.ph === 4) S.r21bxcNow = turnStr(); log(`${ctx.name}: an additional combat phase follows`); } else log(`${ctx.name}: it isn't the right phase — no additional combat`); commit(); return true; }
  if ((m = l.match(/^after this main phase, there are two additional combat phases$/))){ S.xc = (S.xc || 0) + 2; log(`${ctx.name}: two additional combat phases`); commit(); return true; }
  if ((m = l.match(/^after the second main phase this turn, there's an additional combat phase followed by an additional main phase$/))){ S.xc = (S.xc || 0) + 1; log(`${ctx.name}: an additional combat phase after the second main phase`); commit(); return true; }
  if ((m = l.match(/^there is an additional combat phase after this phase$/))){ S.xc = (S.xc || 0) + 1; commit(); return true; }
  // durations: until your next turn
  if ((m = l.match(/^until your next turn, (.+)$/)) || (m = l.match(/^(.+) until your next turn$/))){ const inner = m[1]; if (await r21bUntilNext(s, inner, ctx)) return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound21BPre(s, l, ctx)) return; return ds(s0, ctx); };
}
// keyword lines the engine now really does
{
  const ko = keywordsOnly;
  keywordsOnly = function(l){ return ko(l) || r21bClean(String(l)).split(/,\s*/).every(w => { const t = w.trim(); return ko(t) || /^((?:basic )?land|[a-z]+)?cycling\s*(?:\{[^}]+\})+$/i.test(t) || /^(miracle|transmute|spectacle|surge|prowl|freerunning|web-slinging|dash|blitz|overload|warp|buyback|replicate|multikicker|offspring|squad|plot|embalm|eternalize|encore|emerge(?: from \w+)?) (?:\{[^}]+\})+$/i.test(t) || /^suspend (?:\d+|x)—(?:\{[^}]+\})+$/i.test(t) || /^(?:fuse|aftermath|improvise)$/i.test(t) || /^(?:fading|vanishing) \d+$/i.test(t) || /^cumulative upkeep\s*—\s*(pay \w+ life|add \{[^}]+\}|sacrifice an? [a-z ]+|discard an? [a-z ]+)\.?$/i.test(t) || /^prototype (?:\{[^}]+\})+ — \d+\/\d+$/i.test(t) || /^impending \d+—(?:\{[^}]+\})+$/i.test(t) || /^madness (?:\{[^}]+\})+$/i.test(t) || /^kicker (?:\{[^}]+\})+(?: and\/or (?:\{[^}]+\})+)?$/i.test(t); }); };
}

/* ======================================================================
   DOMAIN 1 — recurring costs, delayed effects, durations, extra turns
   ====================================================================== */

/* ---------- Cumulative upkeep with any cost; “sacrifice ~ unless you …” ---------- */
async function r21bCumUnit(unit, ctx){
  const c = srcCardOf(ctx); if (!c || !S.bf.includes(c)) return; const n = (c.nc || {}).age || 1; const u = unit.toLowerCase().trim(); let m;
  const keep = async (q) => UI.dry ? true : askYes(`${cname(c)}: ${q} to keep it?`, 'Pay', 'Sacrifice it');
  const sac = () => { moveCard(c.id, 'gy', {sac:true}); log(`sacrificed ${cname(c)} (cumulative upkeep)`); };
  if ((m = u.match(/^pay (\w+) life$/))){ const tot = (wn(m[1]) || +m[1] || 1) * n; if (await keep(`pay ${tot} life`)){ loseLife(MYPID, tot, cname(c)); log(`paid ${tot} life (cumulative upkeep)`); } else sac(); }
  else if ((m = u.match(/^add (\{[^}]+\})$/))){ const col = m[1].slice(1, -1).toUpperCase(); if (await keep(`add ${m[1].repeat(n)}`)){ addMana(Array(n).fill(col)); log(`added ${m[1].repeat(n)} (cumulative upkeep)`); } else sac(); }
  else if ((m = u.match(/^(sacrifice|discard) an? (.+)$/))){ const d = m[2].replace(/ card$/, ''); const pool = m[1] === 'sacrifice' ? S.bf.filter(b => b !== c && !b.fd && descOk(b.k, d, {tok:b.tok})) : S.hand.filter(h => descOk(h.k, d)); if (pool.length >= n && await keep(`${m[1]} ${n} ${d}${n > 1 ? 's' : ''}`)){ const ids = pool.length === n ? pool.map(x => x.id) : await pickCards({title:`${cname(c)}: ${m[1]} ${n} ${d}${n > 1 ? 's' : ''}`, cards:pool, min:n, max:n}); if (!ids || ids.length < n){ sac(); return; } if (m[1] === 'sacrifice') ids.forEach(id => sacrificeOne(find(id)[2])); else { UI.discarding = []; ids.forEach(id => moveCard(id, 'gy')); UI.discarding = null; } } else sac(); }
  else if ((m = u.match(/^put an? (.+?) counter on (?:~|a creature you control)$/))){ if (await keep(`put ${n} ${m[1]} counter${n > 1 ? 's' : ''} on it`)){ if (m[1] === '-1/-1') f24cmAdd(c, n); else addNamed(c, m[1], n); } else sac(); }
  else if ((m = u.match(/^pay \{e\}$/))){ if (((S.pc || {}).energy || 0) >= n && await keep(`pay ${n} energy`)) addPC('energy', -n); else sac(); }
  else { if (!UI.dry) toast(`${cname(c)}: this cumulative upkeep cost isn't supported`); log(`⚠ ${cname(c)}: unsupported cumulative upkeep “${unit}”`); }
  commit();
}
async function r21bUnless(what, ctx){
  const c = srcCardOf(ctx); if (!c || !S.bf.includes(c)) return; const w = what.toLowerCase(); let m;
  const sac = () => { moveCard(c.id, 'gy', {sac:true}); log(`sacrificed ${cname(c)} (didn't pay)`); };
  if ((m = w.match(/^pay ((?:\{[^}]+\})+)$/))){ const cost = m[1].toUpperCase(); const plan = payPlan(parseCost(cost), S.pool); if (UI.dry){ if (plan.err) sac(); else S.pool = plan.pool; commit(); return; }
    const v = await askChoice({title:`${cname(c)}: pay ${cost} to keep it?`, text:plan.err ? `Tap mana first (${plan.err}) — or sacrifice it.` : '', options:[{label:`Pay ${cost}`, value:'pay', disabled:!!plan.err, why:plan.err || ''}, {label:'Sacrifice it', value:'sac'}]});
    if (v === 'pay'){ const p2 = payPlan(parseCost(cost), S.pool); if (!p2.err){ S.pool = p2.pool; log(`paid ${cost} to keep ${cname(c)}`); commit(); return; } } sac(); commit(); return; }
  const part = extraPart(w.replace(/^pay /, 'pay ')); const why = extraFeasible(part, c);
  if (part.t === '?' || why || (!UI.dry && !(await askYes(`${cname(c)}: ${part.label} to keep it?`, 'Pay', 'Sacrifice it')))){ sac(); commit(); return; }
  if (!UI.dry && !(await payExtras([part], c))) sac(); commit();
}
// “Cumulative upkeep—Pay 2 life.” (em dash form)
{
  const tg = trigsOf;
  trigsOf = function(k, fl){
    const out = tg(k, fl); if (out.r21b) return out; out.r21b = true;
    const a = info(k); if (!a) return out; let m;
    for (const l of r21bLines(k, fl)){
      if ((m = l.match(/^cumulative upkeep\s*—\s*(.+?)\.?$/i)) && !out.some(t => t.raw === 'cumulative upkeep')) out.push({ev:'step', step:'upkeep', whose:'your', eff:`Put an age counter on ~. Then sacrifice ~ unless you ${/^(pay|add|sacrifice|discard|put) /i.test(m[1]) ? m[1].toLowerCase() : 'pay ' + m[1]} for each age counter on it.`, raw:'cumulative upkeep'});
      if ((m = l.match(/^vanishing(?: (\d+))?$/i))) out.push({ev:'step', step:'upkeep', whose:'your', eff:'Remove a time counter from ~.', raw:'vanishing', r21bvan:true});
      if ((m = l.match(/^fading (\d+)$/i))) out.push({ev:'step', step:'upkeep', whose:'your', eff:'Remove a fade counter from ~.', raw:'fading'});
    }
    return out;
  };
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){ const n0 = S.stk.length; const r = pt(src, t, ev, evPid); if (t && t.r21bvan && S.stk.length > n0) S.stk[S.stk.length - 1].r21bvan = 1; return r; };
  const oe = onEnter;
  onEnter = function(c, from, o = {}){
    const r = oe(c, from, o);
    try { if (c && S.bf.includes(c) && !c.fd && from !== 'bf'){ let m;
      for (const l of r21bLines(c.k, c.fl)){
        if ((m = l.match(/^echo (.+)$/i)) && !/—/.test(l.slice(0, 6))) c.r21becho = 1;
        if ((m = l.match(/^vanishing (\d+)$/i))) addNamed(c, 'time', +m[1]);
        if ((m = l.match(/^fading (\d+)$/i))) addNamed(c, 'fade', +m[1]);
        if (c.esc && (m = l.match(/^~ escapes with (a|an|one|two|three|four|five|\d+) \+1\/\+1 counters? on it\.?$/i))){ const n = wn(m[1].toLowerCase()) || +m[1] || 1; modCounters(c, 'cp', n); log(`${cname(c)} escaped with ${n} +1/+1 counter${n === 1 ? '' : 's'}`); }
        if (c.kicked && ((m = l.match(/^~ enters with (a|an|one|two|three) ([^ ]+) counters? on it for each time it was kicked\.?$/i)) || (m = l.match(/^if ~ was kicked, it enters with (a|an|one|two|three|four|five|six|\d+) (?:additional )?([^ ]+) counters? on it\.?$/i)))){ const per = wn(m[1].toLowerCase()) || +m[1] || 1; const n = /each time/i.test(l) ? per * c.kicked : per; if (m[2] === '+1/+1') modCounters(c, 'cp', n); else addNamed(c, m[2].toLowerCase(), n); log(`${cname(c)} entered with ${n} ${m[2]} counter${n === 1 ? '' : 's'} (kicked)`); }
      } } } catch (e){ console.warn(e); }
    return r;
  };
}
function r21bEcho(c){ const m = r21bKw(c.k, /^echo (.+)$/i); return m ? r21bCost(m[1]) : null; }
R21BOP.echo = async it => {
  const c = S.bf.find(x => x.id === it.srcId); if (!c || !c.r21becho) return; c.r21becho = 0; const cost = r21bEcho(c); if (!cost) return;
  const sac = () => { moveCard(c.id, 'gy', {sac:true}); log(`sacrificed ${cname(c)} (didn't pay echo)`); };
  if (UI.dry) return;
  const why = r21bWhy(cost, c);
  const v = await askChoice({title:`${cname(c)}: pay echo ${cost.label} to keep it?`, text:why ? `Tap mana first (${why}) — or sacrifice it.` : '', options:[{label:`Pay ${cost.label}`, value:'pay', disabled:!!why || !r21bKnown(cost), why}, {label:'Sacrifice it', value:'sac'}]});
  if (v === 'pay' && await r21bPay(cost, c)){ log(`paid echo ${cost.label} for ${cname(c)}`); return; }
  sac();
};
// impending: remove a time counter at the beginning of your end step
R21BOP.impTick = async it => { const c = S.bf.find(x => x.id === it.srcId); if (!c || !c.r21bimp) return; addNamed(c, 'time', -1); log(`${cname(c)}: removed a time counter (${(c.nc || {}).time || 0} left)`); if (!((c.nc || {}).time)){ delete c.r21bimp; log(`${cname(c)} is now a creature`); } };

/* ---------- Step hooks: suspend, echo, impending, delayed triggers ---------- */
function r21bDelay(when, mineOnly, eff, ctx){
  const ids = [...new Set([...(ctx.lastT || []).filter(t => t && (t.pid === MYPID || !t.pid)).map(t => t.id), ...(ctx.lastTok || []), ...(ctx.lastPut || []), ...(ctx.r19toks || [])].filter(x => x != null))];
  if (!ids.length && ctx.lastCardId != null) ids.push(ctx.lastCardId);
  if (!ids.length && /\b(it|~)\b/i.test(eff) && ctx.srcId != null) ids.push(ctx.srcId);
  S.r21bd = (S.r21bd || []).concat({id:rid(6), when, mine:mineOnly, eff, k:ctx.k, nm:ctx.name, srcId:ctx.srcId ?? null, ids, at:turnStr() + '.' + (phaseNow().ph)});
  log(`${ctx.name}: “${short(eff, 70)}” at ${when === 'eoc' ? 'end of combat' : (mineOnly ? 'your next ' : 'the next ') + (when === 'end' ? 'end step' : 'upkeep')}`); commit();
}
function r21bFire(when, activePid){
  const list = S.r21bd || []; if (!list.length) return; const keep = [];
  for (const d of list){
    if (d.when !== when || (d.mine && activePid !== MYPID)){ keep.push(d); continue; }
    r21bStack({kind:'trigger', k:d.k, nm:d.nm, txt:d.eff, srcId:d.ids.length === 1 ? d.ids[0] : d.srcId, r21bdly:1, r21bids:d.ids});
    log(`delayed trigger: ${d.nm} — ${short(d.eff, 80)}`);
  }
  S.r21bd = keep; commit();
}
{
  const fs = fireSteps;
  fireSteps = function(step, activePid){
    const dl = step === 'end' && S ? S.dly.slice() : []; const n0 = S ? S.stk.length : 0;
    fs(step, activePid);
    // delayed triggers keep their extra fields (where, cost…) when they go on the stack
    try { if (dl.length) for (const it of S.stk.slice(n0)) { const d = dl.find(x => x.op === it.dop && x.srcId === it.srcId && x.eff === it.txt); if (d){ for (const [k, v] of Object.entries(d)) if (it[k] === undefined && !['id', 'op', 'eff'].includes(k)) it[k] = v; dl.splice(dl.indexOf(d), 1); } } } catch (e){ console.warn(e); }
    try {
      if (step === 'upkeep'){ if (activePid === MYPID){ r21bSuspendUpkeep(); S.bf.filter(c => c.r21becho && !c.fd).forEach(c => r21bTrig(c, `Echo: sacrifice it unless you pay its echo cost.`, {r21b:'echo'})); } r21bFire('upkeep', activePid); }
      if (step === 'combat') r21bFire('combat', activePid);
      if (step === 'end'){ if (activePid === MYPID) S.bf.filter(c => c.r21bimp && (c.nc || {}).time > 0).forEach(c => r21bTrig(c, 'Remove a time counter from it (impending).', {r21b:'impTick'})); r21bFire('end', activePid); }
    } catch (e){ console.warn(e); }
  };
}
// end of combat (any player's combat): fire when the active player's phase moves past combat
function r21bWatch(){
  const pn = phaseNow(); const key = turnStr();
  const was = S.r21bph; S.r21bph = {t:key, ph:pn.ph, cb:pn.mine && S.cb ? S.cb.n : null};
  if (was && was.t === key && was.ph === 4 && pn.ph !== 4 && pn.ph >= 5) r21bFire('eoc', pn.pid);
  else if (was && was.t === key && was.ph === 4 && pn.ph === 4 && pn.mine && S.cb && was.cb != null && S.cb.n !== was.cb) r21bFire('eoc', pn.pid);
}

/* ---------- Durations: “until your next turn” really lasts until your next turn ---------- */
const r21bUntilOn = d => { const [n, pid] = currentTurn(); return !(pid === d.by && n > d.n0); };
async function r21bUntilNext(s, inner, ctx){
  if (!/^(?:(?:up to (?:one|two) )?(?:other )?target .+?|those creatures|that creature|it|~|each creature|[a-z\- ]*creatures you control|other [a-z ]+ you control|[a-z\- ]+ you control|creatures your opponents control) (?:gets?|gains?|get|gain)\b/i.test(inner) || /\byou may\b|\bwhenever\b|"/i.test(inner)) return false;
  const snap = new Map(S.bf.map(c => [c.id, {pu:[...(c.pu || [0, 0])], ekw:[...(c.ekw || [])]}]));
  const rq0 = S.rq.length;
  const txt = /\buntil end of turn\b/i.test(inner) ? inner : (/^(.+?)(\.)?$/.exec(inner)[1] + ' until end of turn');
  const before = (UI.dry || []).length;
  await doSentence(cap(txt), ctx);
  if (UI.dry && UI.dry.length > before) return true;     // the inner effect itself is reported as missing
  const d0 = {by:MYPID, n0:currentTurn()[0]};
  for (const c of S.bf){ const b = snap.get(c.id) || {pu:[0, 0], ekw:[]}; const pu = c.pu || [0, 0]; const dp = [(pu[0] || 0) - b.pu[0], (pu[1] || 0) - b.pu[1]]; const kw = (c.ekw || []).filter(k => !b.ekw.includes(k));
    if (dp[0] || dp[1] || kw.length) S.r21bun = (S.r21bun || []).concat({...d0, id:c.id, pu:dp, kw}); }
  for (const r of S.rq.slice(rq0)) if (r.op === 'pump') r.r21bun = {...d0};
  log(`${ctx.name}: lasts until ${nameOf(MYPID)}'s next turn`); commit(); return true;
}
{
  const tc = turnChanged;
  turnChanged = function(...a){
    const r = tc.apply(this, a);
    try { if (S && (S.r21bun || []).length){ S.r21bun = S.r21bun.filter(r21bUntilOn); for (const d of S.r21bun){ const c = S.bf.find(x => x.id === d.id); if (!c) continue; c.pu = [(c.pu || [0, 0])[0] + d.pu[0], (c.pu || [0, 0])[1] + d.pu[1]]; if (d.kw.length) c.ekw = [...new Set([...(c.ekw || []), ...d.kw])]; } S.r21bun = S.r21bun.filter(d => S.bf.some(x => x.id === d.id)); commit(); } } catch (e){ console.warn(e); }
    return r;
  };
  const ao = applyOp;
  applyOp = function(r, from){
    const res = ao(r, from);
    try { const id = r && (r.tid ?? r.id); if (r && r.op === 'pump' && r.r21bun && id != null && S){ const c = S.bf.find(x => x.id === id); const f = r.f || {}; if (c){ S.r21bun = (S.r21bun || []).concat({...r.r21bun, id:c.id, pu:[+f.p || 0, +f.t || 0], kw:[].concat(f.kw || [])}); commit(); } } } catch {}
    return res;
  };
}

/* ---------- Extra turns: Stranglehold / Trouble in Pairs ---------- */
STATIC_RULES.push([/^if an opponent would begin an extra turn, that player skips that turn instead$/, m => ({kind:'r21bnoExtra', who:'opp'})]);
{
  const pt = r7PassTurnNext;
  r7PassTurnNext = function(){ if ((S.xt || 0) > 0 && rulesOn('r21bnoExtra').length){ S.xt--; log('would take an extra turn, but skips it (an opponent forbids extra turns)'); return false; } return pt(); };
}

// “until your next turn” on another player's creature: the request carries who/when
{
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { if (o && Array.isArray(o.rq) && Array.isArray(s.rq)) o.rq.forEach(r => { const src = s.rq.find(x => x && x.id === r.id); if (src && src.r21bun && typeof src.r21bun === 'object') r.r21bun = {by:String(src.r21bun.by || '').slice(0, 40), n0:Number.isFinite(src.r21bun.n0) ? src.r21bun.n0 : 0}; }); } catch {} return o; };
}

R21BOP.r21bretc = async it => { const [z, , c] = find(it.srcId); if (c && (z === 'ex' || z === 'gy')){ moveCard(c.id, 'bf'); const b = S.bf.find(x => x.id === c.id); if (b) modCounters(b, 'cp', 1); log(`${it.nm}: returned with a +1/+1 counter`); } else if (it.rpid && it.rpid !== MYPID) sendRq(it.rpid, 'returnBf', 0, it.nm, {tid:it.srcId}); };
// Glacial Chasm: creatures you control can't attack
STATIC_RULES.push([/^creatures you control can't attack$/, m => ({kind:'r21bnoAtk', who:'you'})]);
{
  const ca = canAttack;
  canAttack = function(c){ const w = ca(c); if (w) return w; try { const r = rulesOn('r21bnoAtk').find(x => !x.pid || x.pid === MYPID); if (r && isCreatureCard(c)) return `can't attack (${r.src})`; } catch {} return ''; };
}
STATIC_KNOWN.push(/^~ escapes with (?:a|an|one|two|three|four|five|\d+) \+1\/\+1 counters? on it$/);
