/* ===================== Rules engine — round 23G: EDHREC ranks 2265–3530 ===================== */
// Public per-player state for this round: S.g23 = {tax:{n, t}, ...} travels to the other players.
RQ_OPS.push('g23exGy', 'g23prev', 'g23tf', 'g23teferi', 'g23exTwo', 'g23noNC', 'g23giveEx', 'g23discRand', 'g23silent', 'g23gyEx', 'g23untapGoad', 'g23exMV', 'g23kwctr', 'g23wipePow', 'g23ramp', 'g23spout', 'g23lose', 'g23winds', 'g23strong', 'g23exTop', 'g23exGive', 'g23each', 'g23eachAns', 'g23shuf');
const G23 = { ans:{} };
const g23st = () => (S.g23 ||= {});
{
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); try { const g = S.g23 || {}; o.g23 = {ncTax:g.ncTax || 0, tax:g.tax ? {n:g.tax.n} : null, nocast:g.nocast || null, noAtk:g.noAtk ? {pids:(g.noAtk.pids || []).slice(0, 8)} : null, nogain:g.nogain || ''}; } catch {} return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { const g = s.g23 && typeof s.g23 === 'object' ? s.g23 : {};
    const num = v => Number.isFinite(v) ? Math.max(0, Math.min(99, v)) : 0;
    o.g23 = {ncTax:num(g.ncTax), tax:g.tax && typeof g.tax === 'object' ? {n:num(g.tax.n)} : null,
      nocast:g.nocast && typeof g.nocast === 'object' ? {p:String(g.nocast.p || '').slice(0, 40), u:num(g.nocast.u), t:String(g.nocast.t || '').slice(0, 20)} : null,
      noAtk:g.noAtk && typeof g.noAtk === 'object' && Array.isArray(g.noAtk.pids) ? {pids:g.noAtk.pids.slice(0, 8).map(x => String(x).slice(0, 40))} : null, nogain:String(g.nogain || '').slice(0, 20)}; } catch { o.g23 = {}; } return o; };
}
const g23src = ctx => srcCardOf(ctx);
const g23tgt = ctx => (ctx.tgts ? nextTargets(ctx) : [])[0];
const g23full = ctx => tname(String(ctx.full || info(ctx.k)?.o || ''), ctx.name || '').toLowerCase();
const g23cr = (bf) => (bf || []).filter(b => b.k && !b.fd && /Creature/.test(info(b.k)?.t || ''));
const g23pow = (b, pid) => { try { return (stats(b, pid) || [0])[0]; } catch { return 0; } };
function g23oppCr(pid){ return g23cr(OPP.get(pid)?.bf || []); }
// "until your next turn" bookkeeping: S.untapN counts my turns
const g23untilNext = () => turnStr();   // made on this turn; ends when my next turn starts
function g23live(u){ return !!u && !(currentTurn()[1] === MYPID && u !== turnStr()); }

/* ---------- cross-player ops ---------- */
{
  const ao = applyOp;
  applyOp = function(r, from){
    try {
      if (r.op === 'g23eachAns'){ G23.ans[r.ref] = {n:r.n, d:String(r.d || '')}; return; }
      if (r.op === 'g23strong'){ (async () => { await g23strongMine(r.n || 4, r.src); commit(); })(); return; }
      if (r.op === 'g23exTop'){ const top = S.lib.splice(0, clamp(r.n, 0, 60)); S.ex.push(...top); log(`exiled the top ${top.length} cards of their library (${r.src})`); commit(); return; }
      if (r.op === 'g23exGive'){ // exile the top n cards, give every card matching d to the requester (it stays theirs for good)
        const top = S.lib.splice(0, clamp(r.n, 0, 60)); S.ex.push(...top); log(`exiled the top ${top.length} cards of their library (${r.src})`);
        const want = String(r.d || 'land');
        top.filter(c => descOk(c.k, want)).forEach(c => { S.ex.splice(S.ex.indexOf(c), 1); const ref = rid(6); S.lent.push({ref, to:from, card:c, perm:true}); sendRq(from, 'give', 0, '', {ref, c:{k:c.k}, f:{fromGy:1}}); log(`${nameOf(from)} puts ${cname(c)} onto the battlefield under their control (${r.src})`); });
        commit(); return; }
      if (r.op === 'g23each'){ (async () => { const v = await g23eachMine(r.d, r.n, r.src, from); sendRq(from, 'g23eachAns', v.n || 0, r.src, {ref:r.ref, d:v.d || ''}); commit(); })(); return; }
      if (r.op === 'g23lose'){ S.g23lost = 1; S.lost = `lost the game (${r.src})`; log(`☠ loses the game (${r.src})`); toast(`${r.src}: you lose the game`); commit(); return; }
      if (r.op === 'g23kwctr'){ const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c){ addNamed(single(c), String(r.d || 'double strike').slice(0, 30), r.n || 1); log(`${cname(c)} gets a ${r.d} counter (${r.src})`); } commit(); return; }
      if (r.op === 'g23wipePow'){ S.bf.filter(c => !c.fd && isCreatureCard(c) && g23pow(c) >= r.n).forEach(c => destroyCard(c, r.src)); commit(); return; }
      if (r.op === 'g23ramp'){ (async () => { if (await askYes(`${r.src}: search your library for up to ${r.n} ${r.d} cards and put them onto the battlefield tapped?`, 'Search', 'No')) await searchLibrary(`up to ${r.n} ${r.d} cards`, 'put those cards onto the battlefield tapped, then shuffle', {name:r.src, k:null}); commit(); })(); return; }
      if (r.op === 'g23spout'){ (async () => { await g23spoutMine(r.src); commit(); })(); return; }
      if (r.op === 'g23exMV'){ let tot = 0; const out = []; while (S.lib.length && tot < r.n){ const c = S.lib.shift(); out.push(c); tot += info(c.k)?.mv || 0; } S.ex.push(...out); log(`exiled ${out.length} cards from the top of their library (total mana value ${tot}) (${r.src})`); commit(); return; }
      if (r.op === 'g23untapGoad'){ S.bf.filter(c => c.atk && isCreatureCard(c)).forEach(c => { c.tap = false; c.tn = 0; c.goad = {by:from, n:currentTurn()[0]}; log(`${cname(c)} untaps and is goaded by ${nameOf(from)} (${r.src})`); }); commit(); return; }
      if (r.op === 'g23silent'){ g23st().silent = turnStr(); log(`can't cast spells this turn (${r.src})`); commit(); return; }
      if (r.op === 'g23gyEx'){ const i = S.gy.findIndex(g => g.k === r.d); if (i >= 0){ const [g] = S.gy.splice(i, 1); S.ex.push(g); log(`${cname(g)} was exiled from their graveyard (${r.src})`); } commit(); return; }
      if (r.op === 'g23tf'){ const c = S.bf.find(b => b.id === r.tid); if (c){ c.g23tf = turnStr(); log(`${cname(c)} returns to hand if it dies this turn (${r.src})`); } commit(); return; }
      if (r.op === 'g23noNC'){ g23st().noNC = {by:from, t:turnStr()}; log(`can't cast noncreature spells until ${nameOf(from)}'s next turn (${r.src})`); commit(); return; }
      if (r.op === 'g23discRand'){ g23discRand(r.n || 1, r.src); commit(); return; }
      if (r.op === 'g23teferi'){ (async () => { const pool = S.bf.filter(c => !c.fd); if (pool.length){ const ids = await pickCards({title:`${r.src}: choose a permanent you control to return to its owner's hand`, cards:pool, min:1, max:1}); const c = S.bf.find(b => b.id === (ids || [pool[0].id])[0]); if (c){ log(`returned ${cname(c)} to hand (${r.src})`); moveCard(c.id, c.tok ? 'gy' : 'hand', {quiet:true}); } }
        const rest = S.bf.filter(c => !c.fd && !isLand(c.k)); rest.forEach(c => { if (c.tok) moveCard(c.id, 'gy', {quiet:true}); else if (c.own) sendBack(c, 'lib'); else moveCard(c.id, 'lib', {quiet:true}); }); shuffle(S.lib); log(`shuffled ${rest.length} nonland permanents into their library (${r.src})`); commit(); })(); return; }
      if (r.op === 'g23exTwo'){ (async () => { const pool = S.bf.filter(c => !c.fd); const n = Math.min(r.n || 2, pool.length); const ids = n >= pool.length ? pool.map(c => c.id) : await pickCards({title:`${r.src}: exile ${n} permanents you control`, cards:pool, min:n, max:n}); (ids || []).forEach(id => { const c = S.bf.find(b => b.id === id); if (c){ log(`exiled ${cname(c)} (${r.src})`); moveCard(c.id, 'ex', {quiet:true}); } }); commit(); })(); return; }
      if (r.op === 'g23giveEx'){ const c = S.ex.find(x => cname(x) === r.d && (UI.g23ex7 || []).includes(x.id)); if (c){ S.ex.splice(S.ex.indexOf(c), 1); const ref = rid(6); S.lent.push({ref, to:from, card:c, perm:true}); sendRq(from, 'give', 0, '', {ref, c:{k:c.k}, f:{fromGy:1}}); log(`${nameOf(from)} puts ${cname(c)} onto the battlefield under their control (${r.src})`); } S.pile = null; commit(); return; }
      if (r.op === 'g23exGy'){ const i = S.ex.findIndex(c => c.k === r.d); if (i >= 0){ const [c] = S.ex.splice(i, 1); S.gy.push(c); log(`${cname(c)} went from exile to the graveyard (${r.src})`); } commit(); return; }
      if (r.op === 'g23prev'){ const c = S.bf.find(b => b.id === r.tid); if (c) c.g23prev = {n:r.n, t:turnStr()}; commit(); return; }
      if (r.op === 'g23winds'){ const n = S.hand.length; S.lib.push(...S.hand.splice(0)); shuffle(S.lib); draw(n); log(`shuffled their hand into their library and drew ${n} (${r.src})`); commit(); return; }
      if (r.op === 'g23shuf'){ // shuffle a permanent of mine into my library
        const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c){ const s = single(c); if (s.tok){ moveCard(s.id, 'gy', {quiet:true}); } else { moveCard(s.id, 'lib', {quiet:true}); shuffle(S.lib); } log(`${cname(s)} was shuffled into its owner's library (${r.src})`); } commit(); return; }
    } catch (e){ console.warn('g23 op', e); }
    return ao(r, from);
  };
}
// ask every opponent to do / decide something on their own screen; resolves with [{pid, n, d}]
async function g23askEach(pids, kind, n, src){
  if (!pids.length) return [];
  if (UI.dry) return pids.map(pid => ({pid, n:0, d:''}));
  const refs = pids.map(pid => { const ref = rid(6); sendRq(pid, 'g23each', n || 0, src, {ref, d:kind}); return ref; }); commit();
  toast(`Waiting for ${pids.map(nameOf).join(', ')}…`);
  const out = [];
  for (let i = 0; i < pids.length; i++){ const a = await waitUntil(() => G23.ans[refs[i]], 90000); out.push({pid:pids[i], n:a ? a.n : 0, d:a ? a.d : ''}); }
  return out;
}
// what a player does when asked by g23each
async function g23eachMine(kind, n, src, from){
  const k = String(kind || '');
  if (k === 'treasure?'){ const y = await askYes(`${src}: create a Treasure token? (${nameOf(from)} creates one too if you do)`, 'Create one', 'No'); if (y) await createFromText('Create a Treasure token', {name:src, k:null}); return {n:y ? 1 : 0}; }
  if (k.startsWith('elem?')){ const y = await askYes(`${src}: create ${n} 1/1 red Elemental creature token${n === 1 ? '' : 's'} with haste? (${nameOf(from)} creates ${n} too if you do)`, 'Create them', 'No'); if (y && n) await createFromText(`Create ${n} 1/1 red Elemental creature tokens with haste`, {name:src, k:null}); return {n:y ? 1 : 0}; }
  if (k === 'discard|3life'){ if (!S.hand.length){ S.life -= 3; log(`lost 3 life (${src}) → ${S.life}`); return {n:0}; }
    const ids = await pickCards({title:`${src}: discard a card, or lose 3 life`, cards:S.hand.slice(), min:0, max:1, noneLabel:'Lose 3 life'}); if (ids && ids[0]){ moveCard(ids[0], 'gy'); emit({type:'discard', cnt:1}); return {n:1}; } S.life -= 3; log(`lost 3 life (${src}) → ${S.life}`); return {n:0}; }
  if (k.startsWith('sac2|')){ const desc = k.slice(5); const pool = S.bf.filter(c => !c.fd && !c.tok && !isLand(c.k)); if (pool.length < 2){ return {n:0}; }
    const ids = await pickCards({title:`${src}: sacrifice two nonland, nontoken permanents? (If you don't, ${nameOf(from)} ${desc})`, cards:pool, min:0, max:2, noneLabel:"Don't"}); if (ids && ids.length === 2){ ids.forEach(id => { const c = S.bf.find(b => b.id === id); if (c) sacrificeOne(c); }); return {n:1}; } return {n:0}; }
  if (k.startsWith('sacCr|')){ const pool = S.bf.filter(c => !c.fd && isCreatureCard(c) && (k === 'sacCr|nontoken' ? !c.tok : true)); if (!pool.length) return {n:0};
    const ids = await pickCards({title:`${src}: sacrifice a ${k === 'sacCr|nontoken' ? 'nontoken ' : ''}creature? (If you don't, you lose life)`, cards:pool, min:0, max:1, noneLabel:"Don't"}); if (ids && ids[0]){ const c = S.bf.find(b => b.id === ids[0]); if (c) sacrificeOne(c); return {n:1}; } return {n:0}; }
  if (k === 'ctr2!|'){ const pool = S.bf.filter(c => !c.fd && isCreatureCard(c)); if (!pool.length) return {n:0}; const ids = pool.length === 1 ? [pool[0].id] : await pickCards({title:`${src}: put two +1/+1 counters on a creature you control`, cards:pool, min:1, max:1}); const c = S.bf.find(b => b.id === (ids || [pool[0].id])[0]); if (c){ modCounters(c, 'cp', 2); log(`put two +1/+1 counters on ${cname(c)} (${src})`); } return {n:1}; }
  if (k.startsWith('ctr2|')){ const pool = S.bf.filter(c => !c.fd && isCreatureCard(c)); if (!pool.length) return {n:0};
    const ids = await pickCards({title:`${src}: put two +1/+1 counters on a creature you control?${k.slice(5) ? ' ' + k.slice(5) : ''}`, cards:pool, min:0, max:1, noneLabel:"Don't"}); if (ids && ids[0]){ const c = S.bf.find(b => b.id === ids[0]); if (c){ modCounters(c, 'cp', 2); log(`put two +1/+1 counters on ${cname(c)} (${src})`); return {n:1, d:String(c.id)}; } } return {n:0}; }
  if (k === 'mcer'){ const v = await askChoice({title:`${src}: choose money, friends, or secrets`, options:[{label:'Money (a Treasure each)', value:'money'}, {label:'Friends (a 1/1 Citizen each)', value:'friends'}, {label:'Secrets (draw a card each)', value:'secrets'}]}); return {n:0, d:v || 'money'}; }
  if (k === 'color'){ const v = await askChoice({title:`${src}: choose a color`, options:['white', 'blue', 'black', 'red', 'green'].map(c => ({label:cap(c), value:c}))}); return {n:0, d:v || 'white'}; }
  if (k === 'pay3life'){ if (S.life < 3) return {n:0}; const y = await askYes(`${src}: pay 3 life? (If you don't, ${nameOf(from)} gets the card)`, 'Pay 3 life', "Don't"); if (y){ S.life -= 3; log(`paid 3 life (${src}) → ${S.life}`); } return {n:y ? 1 : 0}; }
  if (k === 'lose3unlessDiscard'){ if (!S.hand.length){ S.life -= 3; log(`lost 3 life (${src}) → ${S.life}`); return {n:0}; } const ids = await pickCards({title:`${src}: discard a card, or lose 3 life`, cards:S.hand.slice(), min:0, max:1, noneLabel:'Lose 3 life'}); if (ids && ids[0]){ moveCard(ids[0], 'gy'); emit({type:'discard', cnt:1}); return {n:1}; } S.life -= 3; log(`lost 3 life (${src}) → ${S.life}`); return {n:0}; }
  if (k === 'sacMax'){ const cr = S.bf.filter(c => !c.fd && isCreatureCard(c)); if (!cr.length) return {n:0}; const mx = Math.max(...cr.map(c => g23pow(c, MYPID))); const top = cr.filter(c => g23pow(c, MYPID) === mx);
    const ids = top.length === 1 || UI.dry ? [top[0].id] : await pickCards({title:`${src}: sacrifice a creature with the greatest power`, cards:top, min:1, max:1}); const c = S.bf.find(b => b.id === (ids || [top[0].id])[0]) || top[0]; sacrificeOne(c); log(`sacrificed ${cname(c)} (${src})`); return {n:1}; }
  if (k.startsWith('discardOr|')){ const L = +k.split('|')[1] || 0; const need = n || 1;
    if (S.hand.length >= need){ const ids = await pickCards({title:`${src}: discard ${need === 1 ? 'a card' : need + ' cards'}, or lose ${L} life`, cards:S.hand.slice(), min:0, max:need, noneLabel:`Lose ${L} life`}); if (ids && ids.length === need){ ids.forEach(id => moveCard(id, 'gy')); emit({type:'discard', cnt:need}); log(`discarded ${need} (${src})`); return {n:1}; } }
    S.life -= L; log(`lost ${L} life (${src}) → ${S.life}`); return {n:0}; }
  if (k === 'ex7pile'){ const top = S.lib.splice(0, n || 7); S.ex.push(...top); UI.g23ex7 = top.map(c => c.id); S.pile = {ref:rid(6), ks:top.map(c => c.k).slice(0, 12)}; log(`exiled the top ${top.length} cards of their library (${src})`); commit(); return {n:top.length}; }
  if (k === 'colorOb'){ const v = await g23eachMine('color', 0, src, from); g23selOb(v.d); return v; }
  if (k === 'duel'){ const c = S.lib[0]; if (!c) return {n:0}; S.lib.shift(); S.hand.push(c); log(`revealed ${cname(c)} and put it into their hand (${src})`); return {n:info(c.k)?.mv || 0, d:c.k}; }
  if (k === 'pile?'){ const pile = OPP.get(from)?.pile; const cards = (pile ? pile.ks : []).map((kk, i) => ({id:-1000 - i, k:kk})); if (!cards.length) return {n:0, d:''};
    const ids = await pickCards({title:`${src}: you may choose one (${nameOf(from)} shows these)`, cards, min:0, max:1, noneLabel:'None'}); return {n:ids && ids.length ? 1 : 0, d:ids && ids.length ? String(-(ids[0] + 1000)) : ''}; }
  return {n:0};
}
function g23discRand(n, src){ for (let i = 0; i < n && S.hand.length; i++){ const c = S.hand[Math.floor(Math.random() * S.hand.length)]; moveCard(c.id, 'gy'); emit({type:'discard', cnt:1, k:c.k}); log(`discarded ${cname(c)} at random (${src})`); } }
// Selective Obliteration on my board
function g23selOb(color){ const L = {white:'W', blue:'U', black:'B', red:'R', green:'G'}[color] || 'W'; const out = S.bf.filter(c => { if (c.fd) return false; const cs = String(info(c.k)?.c || '').replace(/[^WUBRG]/g, ''); return cs && cs !== L; }); out.forEach(c => moveCard(c.id, 'ex', {quiet:true})); log(`exiled ${out.length} permanent${out.length === 1 ? '' : 's'} that weren't only ${color} or colorless`); }
// Aetherspouts on one player's board
async function g23spoutMine(src){
  const cs = S.bf.filter(c => c.atk && isCreatureCard(c) && !c.fd);
  for (const c of cs){ const v = UI.dry ? 'top' : await askChoice({title:`${src}: put ${cname(c)} on the top or bottom of its owner's library?`, options:[{label:'Top', value:'top'}, {label:'Bottom', value:'bottom'}]}); if (c.own){ sendBack(c, 'lib'); continue; } r22putLib(c, v === 'bottom' ? 'bottom' : 'top'); }
}
// Slaughter the Strong on one player's board: keep creatures with total power N or less, sacrifice the rest
async function g23strongMine(maxP, src){
  const cr = S.bf.filter(c => !c.fd && isCreatureCard(c));
  if (!cr.length) return;
  let keep = [];
  for (let tries = 0; tries < 5; tries++){
    const ids = UI.dry ? [] : await pickCards({title:`${src}: choose creatures to KEEP — total power ${maxP} or less`, hint:'Every other creature you control is sacrificed.', cards:cr, min:0, max:cr.length, noneLabel:'Keep none'});
    const tot = (ids || []).reduce((a, id) => a + Math.max(0, g23pow(cr.find(c => c.id === id), MYPID)), 0);
    if (tot <= maxP){ keep = ids || []; break; }
    toast(`Total power ${tot} is more than ${maxP} — choose again`);
  }
  const sac = cr.filter(c => !keep.includes(c.id)); sac.forEach(c => sacrificeOne(c));
  log(`${src}: kept ${keep.length} creature${keep.length === 1 ? '' : 's'}, sacrificed ${sac.length}`);
}

/* ---------- attack tax published by a player (Summon: Yojimbo) ---------- */
{
  const da = declareAttackers;
  declareAttackers = function(){
    try {
      const pn = phaseNow(); if (pn.mine && S.cb && S.cb.step === 'atk'){
        const sel = Object.entries(UI.atkSel || {}).filter(([, v]) => v); const per = {};
        for (const [id, def] of sel){ const c = S.bf.find(x => x.id === +id); if (!c) continue; const d = parseDef(def); if (!d || !d.pid) continue; per[d.pid] = (per[d.pid] || 0) + (c.n || 1); }
        for (const [id, def] of sel){ const c = S.bf.find(x => x.id === +id); if (!c) continue; const d = parseDef(def); if (!d || !d.pid || d.pid === MYPID) continue; const st = OPP.get(d.pid) || {};
          if (kwOf(c, 'flying') && (st.bf || []).some(e => e.k && !e.fd && /^creatures with flying can't attack you(?: or planeswalkers you control)?\.?$/im.test(info(e.k)?.o || ''))){ toast(`${cname(c)} has flying — it can't attack ${nameOf(d.pid)}`); return; }
          if (st.g23 && st.g23.noAtk && (st.g23.noAtk.pids || []).includes(MYPID)){ toast(`Your creatures can't attack ${nameOf(d.pid)} until their next turn`); return; } }
        let tax = 0; const why = [];
        for (const [pid, n] of Object.entries(per)){ const g = OPP.get(pid)?.g23; const tx = g && g.tax; const st = OPP.get(pid) || {}; const each = (tx && tx.n ? tx.n : 0) + (st.bf || []).reduce((a, e) => { const mm = e.k && !e.fd && tname(info(e.k)?.o || '', info(e.k)?.n).match(/^creatures can't attack you(?: or planeswalkers you control)? unless their controller pays \{(\d+)\} for each of those creatures\.?$/im); return a + (mm ? +mm[1] : 0); }, 0); if (!each) continue; tax += each * n; why.push(`${nameOf(pid)}: {${each}} × ${n}`); }
        if (tax){ const plan = payPlan(parseCost(`{${tax}}`), S.pool); if (plan.err){ toast(`Attacking costs {${tax}} more (${why.join(', ')}) — tap mana first`); return; } S.pool = plan.pool; log(`paid {${tax}} to attack (${why.join(', ')})`); }
      }
    } catch (e){ console.warn(e); }
    return da();
  };
  const tc = turnChanged;
  turnChanged = function(...a){ const r = tc.apply(this, a); try { const g = S && S.g23; if (g && currentTurn()[1] === MYPID){ if (g.tax && !g23live(g.tax.u)){ g.tax = null; log('the attack tax ended'); } if (g.nocast && !g23live(g.nocast.u)) g.nocast = null; if (g.noAtk && !g23live(g.noAtk.u)) g.noAtk = null; if (g.ncTax && !g23live(g.ncTaxU)) g.ncTax = 0; commit(); } } catch {} return r; };
}

/* ---------- statics ---------- */
STATIC_RULES.push(
  [/^creatures you don't control get -1\/-1 for each slime counter on them$/, m => ({kind:'g23slime', who:'opp'})],
  [/^if ~ would be put into a graveyard from anywhere, reveal ~ and shuffle it into its owner's library instead$/, m => ({kind:'noop'})],
  [/^creatures can't attack you(?: or planeswalkers you control)? unless their controller pays \{(\d+)\} for each of those creatures$/, m => ({kind:'g23tax', who:'opp', n:+m[1]})],
  [/^creatures with flying can't attack you(?: or planeswalkers you control)?$/, m => ({kind:'g23noFly', who:'opp'})],
  [/^enchanted creature is an? [a-z]+ with base power and toughness (\d+)\/(\d+) and loses all abilities$/, m => ({kind:'noop'})],
);
// Take the Bait: combat damage to me prevented this turn
{
  const dm = damageMe;
  damageMe = function(n, f = {}, from){ try { if (S && S.g23 && S.g23.bait === turnStr() && phaseNow().ph === 4 && from && from !== MYPID){ log(`combat damage to me prevented`); return; } } catch {} return dm(n, f, from); };
}
// Toxrill: -1/-1 per slime counter on creatures its controller doesn't control
{
  const st0 = stats;
  stats = function(c, pid = MYPID){ const r = st0(c, pid); try { if (r && c && c.nc && c.nc.slime && S){
    const owner = pid; let n = 0;
    for (const b of boardsAll()){ if (b.pid === owner) continue; n += b.bf.filter(x => x.k && !x.fd && /creatures you don't control get -1\/-1 for each slime counter on them/i.test(info(x.k)?.o || '')).length; }
    if (n) return [r[0] - c.nc.slime * n, r[1] - c.nc.slime * n]; } } catch {} return r; };
}
// Lignify-style: base P/T and no abilities
function g23lignified(c, pid = MYPID){ for (const b of boardsAll()) for (const a of b.bf){ if (!a.att || a.att.id !== c.id || a.att.pid !== pid || !a.k) continue; const mm = tname(info(a.k)?.o || '', info(a.k)?.n).match(/enchanted creature is an? \w+ with base power and toughness (\d+)\/(\d+) and loses all abilities/i); if (mm) return [+mm[1], +mm[2]]; } return null; }
{
  const st0 = stats;
  stats = function(c, pid = MYPID){ const r = st0(c, pid); try { if (r && c && S){ const b = g23lignified(c, pid); if (b){ const pu = c.pu || [0, 0]; const n = (c.cp || 0) - (c.cm || 0); return [b[0] + n + pu[0], b[1] + n + pu[1]]; } } } catch {} return r; };
  const kw = kwOf;
  kwOf = function(c, k, pid = MYPID){ try { if (c && S && c.id != null && g23lignified(c, pid)) return false; } catch {} return kw(c, k, pid); };
  const ar = abilityReady;
  abilityReady = function(c, ab, mana){ try { if (c && g23lignified(c, MYPID)) return `${cname(c)} has lost all its abilities`; } catch {} return ar(c, ab, mana); };
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){ try { if (src && src.id != null){ const c = S.bf.find(b => b.id === src.id); if (c && g23lignified(c, MYPID)){ log(`${cname(c)} has no abilities — its trigger doesn't happen`); return; } } } catch {} return pt(src, t, ev, evPid); };
}
// Darksteel Colossus / Nexus of Fate: shuffled into the library instead of the graveyard
const g23shufInstead = c => c && /if .+? would be put into a graveyard from anywhere, reveal .+? and shuffle it into its owner's library instead/i.test(info(c.k)?.o || '');
{
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ try { if (S && to === 'gy'){ const [z, , c] = find(id); if (c && !c.tok && g23shufInstead(c)){ const r = mc(id, 'lib', {...o, quiet:true}); shuffle(S.lib); log(`${cname(c)} was revealed and shuffled into its owner's library instead`); return r; } } } catch (e){ console.warn(e); } return mc(id, to, o); };
  const tg = toGrave;
  toGrave = function(c, it){ try { if (S && c && !c.tok && g23shufInstead(c) && !(it && it.exAfter)){ faceRestore(c); reset(c); S.lib.push(c); shuffle(S.lib); log(`${cname(c)} was revealed and shuffled into its owner's library instead`); return; } } catch (e){ console.warn(e); } return tg(c, it); };
}

{
  const ca = canAttack;
  canAttack = function(c){ const r = ca(c); if (r === 'defender' && c && c.g23def === turnStr()) return ''; return r; };
  const so = sacrificeOne;
  sacrificeOne = function(c){ try { if (c && S && S.bf.includes(c)){ UI.g23lki = UI.g23lki || {}; UI.g23lastSac = c.k; UI.g23lastSacId = c.id; UI.g23lki[c.id] = {cp:c.cp || 0, eq:S.bf.filter(e => e.att && e.att.pid === MYPID && e.att.id === c.id && /Equipment/.test(info(e.k)?.t || '')).map(e => e.id)}; } } catch {} return so(c); };
}

{ const sb = sba; sba = function(...a){ const r = sb.apply(this, a); try { if (S && S.g23lost && !S.lost) S.lost = 'lost the game'; } catch {} return r; }; }
function g23fight(a, b, name){ // a, b: {pid, id, k}
  const sa = statsAny(a), sb = statsAny(b); if (!sa || !sb){ log(`${name}: fight didn't happen (a creature is gone)`); return; }
  const ca = boardOf(a.pid).find(x => x.id === a.id), cb = boardOf(b.pid).find(x => x.id === b.id);
  if (a.pid === MYPID) dealDamage(b, Math.max(0, sa[0]), a.k, ca); else applyTo(b, {op:'dmg', n:Math.max(0, sa[0]), src:name, f:srcFlags(a.k, a.pid, ca)});
  if (b.pid === MYPID) dealDamage(a, Math.max(0, sb[0]), b.k, cb); else applyTo(a, {op:'dmg', n:Math.max(0, sb[0]), src:name, f:srcFlags(b.k, b.pid, cb)});
  log(`${info(a.k)?.n} fights ${info(b.k)?.n}`);
}

{
  const rt = resolveTop;
  resolveTop = async function(it, ...a){
    if (it && it.dop === 'g23ret'){ const i = S.stk.indexOf(it); if (i >= 0) S.stk.splice(i, 1);
      const c = S.ex.find(x => x.id === it.srcId);
      if (c){ moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); if (b){ if (isCreatureCard(b)) modCounters(b, 'cp', 1); else if (isPW(b)) b.co = (b.co || 0) + 1; } log(`${cname(c)} returned to the battlefield${b && isCreatureCard(b) ? ' with an additional +1/+1 counter' : b && isPW(b) ? ' with an additional loyalty counter' : ''}`); }
      commit(); return; }
    return rt(it, ...a);
  };
}

// damage dealt to any creature of mine (Pain for All, Wrathful Raptors)
EV_TYPES.push('g23dealt');
{
  const dc = damageCard;
  damageCard = function(c, n, f){ const r = dc(c, n, f); try { if (r > 0 && c && S && (S.bf.includes(c) || S.gy.includes(c))) emit({type:'g23dealt', k:c.k, id:c.id, cnt:1, amt:r}); } catch {} return r; };
  const sm = subjMatch;
  subjMatch = function(t, src, ev, pid){ if (ev && ev.type === 'g23dealt'){ if (t.ctl === 'you' && pid !== MYPID) return false; if (t.ctl === 'opp' && pid === MYPID) return false; return !t.desc || descOk(ev.k, t.desc, {tok:ev.tok}); } return sm(t, src, ev, pid); };
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    if (t && t.g23ench && ev){ const a = src && S.bf.find(b => b.id === src.id); if (!a || !a.att || a.att.id !== ev.id || a.att.pid !== evPid) return; }
    if (t && t.g23noncombat){ if (S.cb && ['fs', 'dmg'].includes(S.cb.step) && phaseNow().ph === 4) return; }
    if (t && t.g23first && src){ S.g23first = S.g23first || {}; const key = src.id + '|' + t.raw; if (S.g23first[key] === turnStr()) return; S.g23first[key] = turnStr(); }
    if (t && t.g23mv && ev && ev.k){ const mv = info(ev.k)?.mv || 0; if (mv < t.g23mv[0] || mv > t.g23mv[1]) return; }
    const n0 = S.stk.length; const r = pt(src, t, ev, evPid);
    try { if (ev && t && t.g23noncombat && S.stk.length > n0){ const it = S.stk[S.stk.length - 1]; it.evN = ev.amt; it.evDp = ev.dp; } if (ev && ev.type === 'g23dealt' && S.stk.length > n0){ const it = S.stk[S.stk.length - 1]; it.evN = ev.amt; } } catch {}
    return r;
  };
}
// loyalty abilities: The Immortal Sun, Oath of Teferi, The Chain Veil
{
  const lr = loyaltyReady;
  loyaltyReady = function(c, ab){
    for (const b of boardsAll()) if (b.bf.some(x => x.k && !x.fd && /^players can't activate planeswalkers' loyalty abilities\.?$/im.test(info(x.k)?.o || ''))) return "Players can't activate loyalty abilities (The Immortal Sun)";
    const r = lr(c, ab);
    if (r === 'Already used a loyalty ability this turn'){ const u = c.g23lun && c.g23lun.t === turnStr() ? c.g23lun.n : 1;
      const oath = S.bf.some(x => !x.fd && /you may activate the loyalty abilities of planeswalkers you control twice each turn/i.test(info(x.k)?.o || ''));
      const veil = c.g23veil === turnStr() && !c.g23veilUsed;
      if ((oath && u < 2) || veil) return ''; }
    return r;
  };
  const al = activateLoyalty;
  activateLoyalty = async function(c, i){
    const before = c.lu === turnStr() ? (c.g23lun && c.g23lun.t === turnStr() ? c.g23lun.n : 1) : 0;
    const r = await al(c, i);
    try { if (c.lu === turnStr()){ const now = before + 1; const oath = S.bf.some(x => !x.fd && /twice each turn rather than only once/i.test(info(x.k)?.o || '')); if (before >= (oath ? 2 : 1) && c.g23veil === turnStr()) c.g23veilUsed = 1; c.g23lun = {t:turnStr(), n:now}; S.g23loyT = turnStr(); } } catch {}
    return r;
  };
}
// Rakdos, Lord of Riots: can't be cast unless an opponent lost life this turn
{
  const cc = castCheck;
  castCheck = function(c, zone){ try { const a = info(c.k); if (a && /you can't cast (?:~|this spell) unless an opponent lost life this turn/i.test(tname(a.o || '', a.n)) && !opponents().some(p => lostThisTurn(p.pid) > 0)) return {ok:false, why:'No opponent has lost life this turn'}; } catch {} return cc(c, zone); };
}
// keyword counters give their keyword (Spectacular Showdown, Metamorphosis Fanatic)
{
  const kw = kwOf;
  kwOf = function(c, k, pid = MYPID){ try { if (c && !c.fd && c.nc && c.nc[k] > 0 && /^(flying|first strike|double strike|deathtouch|lifelink|hexproof|indestructible|menace|reach|trample|vigilance|haste)$/.test(k)) return true; } catch {} return kw(c, k, pid); };
}
// Archetype of Aggression / Endurance: opponents' creatures lose a keyword
{
  const kw = kwOf;
  kwOf = function(c, k, pid = MYPID){
    try { if (c && S && (k === 'trample' || k === 'hexproof')){ const re = new RegExp(`^creatures your opponents control lose ${k} and can't have or gain ${k}\\.?$`, 'im');
      for (const b of boardsAll()){ if (b.pid === pid) continue; if (b.bf.some(x => x.k && !x.fd && re.test(info(x.k)?.o || ''))) return false; } } } catch {}
    return kw(c, k, pid);
  };
}
// Wrenn and Realmbreaker +1: animated "until your next turn"
{
  const tc = turnChanged;
  turnChanged = function(...a){ const r = tc.apply(this, a); try { if (S) S.bf.forEach(c => { const g = c.g23anim; if (!g) return; if (currentTurn()[1] === MYPID && g.t !== turnStr()){ c.g23anim = null; if (c.anim === 'g23') c.anim = ''; c.animPT = null; return; } c.anim = 'g23'; c.animPT = g.pt.slice(); c.ekw = [...new Set([...(c.ekw || []), ...g.kws])]; }); } catch (e){ console.warn(e); } return r; };
}
STATIC_RULES.push(
  [/^spells and abilities your opponents control can't cause their controller to search their library$/, m => ({kind:'noSearch', who:'opp'})],
  [/^players can't activate planeswalkers' loyalty abilities$/, m => ({kind:'g23noLoy', who:'all'})],
  [/^you may activate the loyalty abilities of planeswalkers you control twice each turn rather than only once$/, m => ({kind:'g23oath', who:'you'})],
  [/^you can't cast ~ unless an opponent lost life this turn$/, m => ({kind:'g23riots', who:'you'})],
  [/^creatures your opponents control lose (trample|hexproof) and can't have or gain \1$/, m => ({kind:'g23loseKw', who:'opp', kw:m[1]})],
);

// last known power/toughness of creatures leaving the battlefield (Lifeblood Hydra)
{
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ try { if (S && to !== 'bf'){ const c = S.bf.find(b => b.id === id); if (c && isCreatureCard(c)){ UI.g23lkiP = UI.g23lkiP || {}; UI.g23lkiP[id] = stats(c); } } } catch {} return mc(id, to, o); };
}
// casting only at certain times (Savage Beating, Take the Bait, Berserk)
function g23timing(a){
  const o = tname(a.o || '', a.n).toLowerCase(); const pn = phaseNow(); const combat = pn.ph === 4;
  if (/cast (?:~|this spell) only during combat on your turn/.test(o) && !(pn.mine && combat)) return 'Only during combat on your turn';
  if (/cast (?:~|this spell) only during combat on an opponent's turn/.test(o) && !(!pn.mine && combat)) return "Only during combat on an opponent's turn";
  if (/cast (?:~|this spell) only before the combat damage step/.test(o) && combat && S.cb && ['fs', 'dmg', 'end'].includes(S.cb.step)) return 'Only before the combat damage step';
  if (/cast (?:~|this spell) only before the combat damage step/.test(o) && !combat && false) return '';
  return '';
}
{
  const cc = castCheck;
  castCheck = function(c, zone){ try { const a = info(c.k); const w = a && g23timing(a); if (w) return {ok:false, why:w}; } catch {} return cc(c, zone); };
}
// Stormtide Leviathan: creatures without flying or islandwalk can't attack
{
  const ca = canAttack;
  canAttack = function(c){ const r = ca(c); try { if (!r && c && boardsAll().some(b => b.bf.some(x => x.k && !x.fd && /^creatures without flying or islandwalk can't attack\.?$/im.test(info(x.k)?.o || ''))) && !kwOf(c, 'flying') && !kwOf(c, 'islandwalk') && !/islandwalk/i.test(textOf(c))) return "can't attack (only creatures with flying or islandwalk can)"; } catch {} return r; };
}
// Inspiring Leader: my commander creatures give my creature tokens +2/+2
{
  const st0 = stats;
  stats = function(c, pid = MYPID){ const r = st0(c, pid); try { if (r && c && c.tok && S){ const bf = boardOf(pid); const bg = bf.filter(x => x.k && !x.fd && /^commander creatures you own have "creature tokens you control get \+2\/\+2\."?"?$/im.test(info(x.k)?.o || '')).length;
    if (bg && isCreatureCard(c)){ const cmdr = bf.filter(x => x.cmd && !x.fd && /Creature/.test(info(x.k)?.t || '')).length; if (cmdr) return [r[0] + 2 * bg * cmdr, r[1] + 2 * bg * cmdr]; } } } catch {} return r; };
}
// Paradigm: exile after resolving; a free copy at the beginning of each of my first main phases
{
  const tg = toGrave;
  toGrave = function(c, it){ try { if (c && c.g23copy){ log(`${cname(c)} (copy) ceases to exist`); return; } } catch {} return tg(c, it); };
  const sp = setPhase;
  setPhase = function(i){ const r = sp(i);
    try { if (S && i === 3 && currentTurn()[1] === MYPID && S.g23para && !UI.dry){ const key = turnStr(); if (UI.g23paraKey !== key){ UI.g23paraKey = key; (async () => { for (const k of Object.keys(S.g23para)){ if (!info(k)) continue; if (!await askYes(`Paradigm: cast a copy of ${info(k).n} without paying its mana cost?`, 'Cast it', 'Not now')) continue; const c = {id:S.nid++, k, g23copy:true}; S.ex.push(c); UI.afterCast = () => {}; await beginCast(c, 'ex', {free:true}); const j = S.ex.indexOf(c); if (j >= 0) S.ex.splice(j, 1); } commit(); })(); } } } catch (e){ console.warn(e); }
    return r; };
}
// Lost Monarch of Ifnir: a Zombie dealt combat damage to a player this turn
{
  const em = emit;
  emit = function(ev){ try { if (S && ev && ev.type === 'cdmg' && ev.k && /\bZombie\b/.test(info(ev.k)?.t || '')) S.g23zdmg = turnStr(); } catch {} return em(ev); };
}
// Angel of Destiny: remember which players each creature attacked this turn
{
  const da = declareAttackers;
  declareAttackers = function(){ try { const sel = Object.entries(UI.atkSel || {}).filter(([, v]) => v); S.g23atkd = S.g23atkd && S.g23atkd.t === turnStr() ? S.g23atkd : {t:turnStr(), m:{}}; for (const [id, def] of sel){ const d = parseDef(def); if (d && d.pid) (S.g23atkd.m[id] ||= []).push(d.pid); } } catch {} return da(); };
}
// Agent of the Iron Throne: commander creatures I own have the death trigger
{
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){ if (t && t.g23cmdr){ const n = S.bf.filter(x => x.cmd && !x.fd && isCreatureCard(x)).length; if (!n) return; for (let i = 1; i < n; i++) pt(src, t, ev, evPid); }
    if (t && t.g23toCr){ const h = (UI.g23hit || {})[src.id]; if (!h || src.id !== ev.id) return; UI.g23victim = h; }
    if (t && t.g23combat){ if (!(S.cb && ['fs', 'dmg'].includes(S.cb.step))) return; const key = src.id + '|' + turnStr() + '|' + S.cb.step + '|' + (S.cb.n || 0); UI.g23cd = UI.g23cd || {}; if (UI.g23cd[key]) return; UI.g23cd[key] = 1; }
    return pt(src, t, ev, evPid); };
}
// Zur the Enchanter: the short name
{
  const tn = tname;
  tname = function(txt, name){ let t = tn(txt, name); try { const n = String(name || '').split(' // ')[0]; const mm = n.match(/^([A-Z][a-z]{2}) the [A-Z]/); if (mm && /Creature/.test([...DICT.values()].find(a => a.n === n)?.t || '')) t = t.replace(new RegExp('\\b' + mm[1] + '\\b(?! the)', 'g'), '~'); } catch {} return t; };
}
STATIC_RULES.push(
  [/^all lands are (islands|swamps|forests|mountains|plains) in addition to their other types$/, m => ({kind:'landType', who:'all', type:{islands:'Island', swamps:'Swamp', forests:'Forest', mountains:'Mountain', plains:'Plains'}[m[1]]})],
  [/^creatures without flying or islandwalk can't attack$/, m => ({kind:'g23storm', who:'all'})],
  [/^commander creatures you own have "creature tokens you control get \+2\/\+2\.?"?$/, m => ({kind:'g23bgTok', who:'you'})],
  [/^commander creatures you own have "whenever an artifact or creature you control is put into a graveyard from the battlefield, each opponent loses 1 life\.?"?$/, m => ({kind:'g23bgAgent', who:'you'})],
  [/^a deck can have up to (?:nine|seven|any number of) cards named ~$/, m => ({kind:'noop'})],
);

// Abdel Adrian: permanents exiled until it leaves come back
{
  const ol = onLeave;
  onLeave = function(c, to, w){ const r = ol(c, to, w); try { if (c && c.g23held && c.g23held.length){ const ids = c.g23held.splice(0); ids.forEach(id => { const x = S.ex.find(e => e.id === id); if (x){ moveCard(x.id, 'bf', {quiet:true}); log(`${cname(x)} returned to the battlefield (${cname(c)} left)`); } }); commit(); } } catch (e){ console.warn(e); } return r; };
}
// Render Silent: can't cast spells this turn; Elspeth Conquers Death II: opponents' noncreature spells cost {2} more
{
  const cc = castCheck;
  castCheck = function(c, zone){ try { if (S && S.g23 && S.g23.silent === turnStr()) return {ok:false, why:"You can't cast spells this turn"}; } catch {} return cc(c, zone); };
  const sc = spellCost;
  spellCost = function(c, zone, o = {}){ const r = sc(c, zone, o); try { if (r && r.cost && c && !/Creature/.test(info(c.k)?.t || '')){ for (const [pid, st] of OPP){ const g = st.g23; if (g && g.ncTax){ r.cost.gen += g.ncTax; r.notes.push(`${nameOf(pid)}: noncreature spells cost {${g.ncTax}} more`); } } } } catch {} return r; };
}
// affinity for artifacts given to spells (Tezzeret, Master of the Bridge; Mycosynth Golem)
{
  const ar = affinityRed;
  affinityRed = function(c){ let n = ar(c); try { const rs = rulesOn('g23aff'); if (rs.length && c){ const a = info(c.k); for (const r of rs){ if (r.desc === 'cp' ? /Creature|Planeswalker/.test(a.t || '') : (/Artifact/.test(a.t || '') && /Creature/.test(a.t || ''))) n += countOf('artifacts you control', {}) || 0; } } } catch {} return n; };
}
// Overmaster: the next instant or sorcery spell can't be countered
{
  const bc = beginCast;
  beginCast = async function(c, zone, ...a){ const before = new Set(S.stk.map(x => x.sid)); const r = await bc.call(this, c, zone, ...a); try { if (S && S.g23 && S.g23.unctr === turnStr() && /Instant|Sorcery/.test(info(c.k)?.t || '')){ const it = S.stk.find(x => !before.has(x.sid) && x.kind === 'spell'); if (it){ it.uc = true; S.g23.unctr = ''; log(`${it.nm} can't be countered (Overmaster)`); commit(); } } } catch {} return r; };
}
// Bothersome Quasit: goaded creatures of its controller's opponents can't block
{
  const cb = canBlock;
  canBlock = function(b, a, apid){ try { if (b && b.goad && S.bf.includes(b)){ for (const [pid, st] of OPP){ if ((st.bf || []).some(x => x.k && !x.fd && /^goaded creatures your opponents control can't block\.?$/im.test(info(x.k)?.o || ''))) return "goaded creatures can't block"; } } } catch {} return cb(b, a, apid); };
}
// Stinkweed Imp: remember what each source last damaged
{
  const de = r7DamageEvent;
  r7DamageEvent = function(t, n, srcK, srcCard){ try { if (t && t.t !== 'player' && srcCard && n > 0){ UI.g23hit = UI.g23hit || {}; UI.g23hit[srcCard.id] = {pid:t.pid, id:t.id, k:t.k}; } } catch {} return de(t, n, srcK, srcCard); };
}
// Endrek Sahr: state trigger
{
  const sb = sba;
  sba = function(...a){ const r = sb.apply(this, a); try { if (S && !UI.dry){ const e = S.bf.find(c => !c.fd && /^when you control seven or more thrulls, sacrifice /im.test(info(c.k)?.o || '')); if (e){ const n = S.bf.filter(c => !c.fd && /\bThrull\b/.test(typeOf(c))).reduce((x, c) => x + (c.n || 1), 0); if (n >= 7){ log(`${cname(e)}: seven or more Thrulls — sacrificed`); sacrificeOne(e); commit(); } } } } catch {} return r; };
}
STATIC_RULES.push(
  [/^goaded creatures your opponents control can't block$/, m => ({kind:'g23quasit', who:'opp'})],
  [/^creature and planeswalker spells you cast have affinity for artifacts$/, m => ({kind:'g23aff', who:'you', desc:'cp'})],
  [/^artifact creature spells you cast have affinity for artifacts$/, m => ({kind:'g23aff', who:'you', desc:'ac'})],
);

// Together Forever: a marked creature returns to its owner's hand when it dies this turn
{
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ let back = null; try { if (S && to === 'gy'){ const c = S.bf.find(b => b.id === id); if (c && c.g23tf === turnStr() && !c.tok) back = c; } } catch {} const r = mc(id, to, o); try { if (back && S.gy.includes(back)){ back.g23tf = ''; mc(back.id, 'hand', {quiet:true}); log(`${cname(back)} returned to its owner's hand (Together Forever)`); commit(); } } catch {} return r; };
}
// Hope of Ghirapur: can't cast noncreature spells until that player's next turn
{
  const cc = castCheck;
  castCheck = function(c, zone){ try { const g = S && S.g23; if (g && g.noNC && !/Creature/.test(info(c.k)?.t || '')){ if (currentTurn()[1] === g.noNC.by && turnStr() !== g.noNC.t) g.noNC = null; else return {ok:false, why:`You can't cast noncreature spells until ${nameOf(g.noNC.by)}'s next turn`}; } } catch {} return cc(c, zone); };
  const em = emit;
  emit = function(ev){ try { if (S && ev && ev.type === 'cdmg' && ev.dp && ev.id != null){ S.g23cd = S.g23cd && S.g23cd.t === turnStr() ? S.g23cd : {t:turnStr(), m:{}}; (S.g23cd.m[ev.id] ||= []).push(ev.dp); } } catch {} return em(ev); };
}
// All-Out Assault: the next attack this turn untaps my creatures
{
  const da = declareAttackers;
  declareAttackers = function(){ const r = da(); try { if (S && S.g23 && S.g23.untapAtk === turnStr()){ S.g23.untapAtk = ''; S.bf.filter(c => isCreatureCard(c)).forEach(c => { c.tap = false; c.tn = 0; }); log('untapped each creature they control (All-Out Assault)'); commit(); } } catch {} return r; };
}
// Edric: combat damage to one of my opponents by anyone's creature
{
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){ if (t && t.g23edric){ if (!ev || !ev.dp || ev.dp === MYPID) return; } return pt(src, t, ev, evPid); };
}
// Incubator tokens
function g23incubate(n, ctx){
  const k0 = customToken('Incubator', '', ''); const k = k0 + '|g23inc'; if (!DICT.has(k)) DICT.set(k, {...DICT.get(k0), k, n:'Incubator', t:'Token Artifact — Incubator', p:'', o:'{2}: Transform this artifact.'});
  const before = new Set(S.bf.map(c => c.id)); createToken(k, 1, null, {}); const tk = S.bf.find(c => !before.has(c.id) && c.k === k) || S.bf.filter(c => c.k === k).pop();
  if (tk && n) modCounters(tk, 'cp', n); log(`${ctx.name}: incubate ${n}`); commit(); return tk;
}
STATIC_RULES.push(
  [/^this land is every nonbasic land type$/, m => ({kind:'g23every', who:'you'})],
);

// "Once during each of your turns, you may cast … from your graveyard" (Lurrus, Kess, Serra Paragon)
function g23gyOnceWays(c){
  const out = []; if (!S || !c) return out; const pn = phaseNow(); if (!pn.mine) return out; const a = info(c.k); if (!a) return out; const mv = a.mv || 0; S.g23gyOnce = S.g23gyOnce || {};
  for (const b of S.bf){ if (b.fd) continue; const o = tname(info(b.k)?.o || '', info(b.k)?.n).toLowerCase(); const nm = info(b.k)?.n; if (S.g23gyOnce[nm] === turnStr()) continue;
    if (/once during each of your turns, you may cast a permanent spell with mana value 2 or less from your graveyard/.test(o) && !isLand(c.k) && isPermType(a.t) && mv <= 2) out.push({kind:'gycast', label:`Cast from graveyard (${nm}) ${a.m}`, mana:a.m, extra:[], after:'', g23once:nm});
    if (/once during each of your turns, you may cast an instant or sorcery spell from your graveyard/.test(o) && /Instant|Sorcery/.test(a.t || '')) out.push({kind:'gycast', label:`Cast from graveyard (${nm}) ${a.m}`, mana:a.m, extra:[], after:/exile it instead/.test(o) ? 'ex' : '', g23once:nm});
    if (/once during each of your turns, you may play a land from your graveyard or cast a permanent spell with mana value 3 or less from your graveyard/.test(o)){ if (isLand(c.k)) out.push({kind:'gyland', label:`Play land from graveyard (${nm})`, land:true, g23once:nm, g23par:1}); else if (isPermType(a.t) && mv <= 3) out.push({kind:'gycast', label:`Cast from graveyard (${nm}) ${a.m}`, mana:a.m, extra:[], after:'', g23once:nm, g23par:1}); } }
  return out;
}
{
  const go = gyOptions;
  gyOptions = function(c){ const r = go(c) || []; try { g23gyOnceWays(c).forEach(x => r.push(x)); } catch (e){ console.warn(e); } return r; };
  const cg = castFromGy;
  castFromGy = async function(c, g){ const r = await cg(c, g); try { if (g && g.g23once && find(c.id)[0] !== 'gy'){ S.g23gyOnce = {...(S.g23gyOnce || {}), [g.g23once]:turnStr()}; if (g.g23par) c.g23par = 1; commit(); } } catch {} return r; };
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ try { if (S && to === 'gy'){ const c = S.bf.find(b => b.id === id); if (c && c.g23par){ c.g23par = 0; const r = mc(id, 'ex', o); if (gainLife(2, 'Serra Paragon')) log(`${cname(c)} was exiled and they gained 2 life (Serra Paragon) → ${S.life}`); return r; } } } catch {} return mc(id, to, o); };
}
// Ugin's Labyrinth: {C}{C} while a card is exiled with it
{
  const ma = manaAbs;
  manaAbs = function(c){ const out = ma(c); try { if (c && c.g23imp && /if a card is exiled with this land, add \{c\}\{c\} instead/i.test(info(c.k)?.o || '')) return out.map(ab => ab.tapOnly && ab.outs.some(o => o.join('') === 'C') ? {...ab, outs:[['C', 'C']]} : ab); } catch {} return out; };
}
// Puppeteer Clique / Thieving Skydiver: what to do when a card I asked for arrives
{
  const tk = takeCard;
  takeCard = function(r, from){ const before = new Set(S.bf.map(c => c.id)); const res = tk(r, from); try { const c = S.bf.find(x => !before.has(x.id)); const p = (UI.g23pend || []).find(x => c && x.k === c.k && x.pid === from);
    if (c && p){ UI.g23pend.splice(UI.g23pend.indexOf(p), 1); if (p.haste) c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; if (p.exileEnd) S.g23exEnd = (S.g23exEnd || []).concat({id:c.id, t:turnStr()}); if (p.attachTo != null && /Equipment/.test(info(c.k)?.t || '')){ c.att = {pid:MYPID, id:p.attachTo}; log(`attached ${cname(c)} to ${cname(S.bf.find(b => b.id === p.attachTo))}`); } commit(); } } catch (e){ console.warn(e); } return res; };
  const fs = fireSteps;
  fireSteps = function(step, ap){ const r = fs(step, ap); try { if (S && step === 'end' && ap === MYPID && (S.g23exEnd || []).length){ const due = S.g23exEnd.filter(x => x.t !== turnStr() || x.now); S.g23exEnd = S.g23exEnd.filter(x => !due.includes(x)); due.forEach(x => { const c = S.bf.find(b => b.id === x.id); if (c){ if (c.own) sendBack(c, 'ex'); else moveCard(c.id, 'ex', {quiet:true}); log(`${cname(c)} was exiled (end step)`); } }); commit(); } } catch (e){ console.warn(e); } return r; };
}
// Eiganjo Castle: prevent the next N damage to a creature this turn
{
  const dc = damageCard;
  damageCard = function(c, n, f){ try { if (c && c.g23prev && c.g23prev.t === turnStr() && n > 0){ const p = Math.min(n, c.g23prev.n); c.g23prev.n -= p; n -= p; log(`${p} damage to ${cname(c)} prevented`); if (c.g23prev.n <= 0) c.g23prev = null; if (n <= 0) return 0; } } catch {} return dc(c, n, f); };
}
STATIC_RULES.push(
  [/^once during each of your turns, you may cast (?:a permanent spell with mana value 2 or less|an instant or sorcery spell) from your graveyard$/, m => ({kind:'g23gyOnce', who:'you'})],
  [/^once during each of your turns, you may play a land from your graveyard or cast a permanent spell with mana value 3 or less from your graveyard$/, m => ({kind:'g23gyOnce', who:'you'})],
  [/^if you do, it gains "when (?:this permanent|~) is put into a graveyard from the battlefield, exile it and you gain 2 life\.?"$/, m => ({kind:'g23gyOnce', who:'you'})],
  [/^if a spell cast this way would be put into your graveyard, exile it instead$/, m => ({kind:'g23gyOnce', who:'you'})],
  [/^(?:companion — )?each permanent card in your starting deck has mana value 2 or less$/, m => ({kind:'noop'})],
);

// "target creature an opponent controls": the core treated "opponent" as a player target
{
  const tc = targetCands;
  targetCands = function(spec, src){ try { if (spec && spec.zone === 'bf' && typeof spec.desc === 'string' && !spec.any && /^(.+?) an opponent controls$/.test(spec.desc) && !/\b(player|opponent)s?\b/.test(spec.desc.replace(/ an opponent controls$/, ''))) return tc({...spec, desc:spec.desc.replace(/ an opponent controls$/, " you don't control")}, src); } catch {} return tc(spec, src); };
}

// extra mana when tapping: Regal Behemoth (monarch), Overgrowth's second {G}
{
  const am = activateMana;
  activateMana = async function(c, ab, ch){
    const was = c && c.tap; const r = await am(c, ab, ch);
    try { if (c && S && !UI.dry && isLand(c.k) && c.tap && !was){
      if (holderOf('mon') === MYPID) for (const b of S.bf){ if (b.fd || !/^whenever you tap a land for mana while you're the monarch, add an additional one mana of any color\.?$/im.test(info(b.k)?.o || '')) continue; const v = await askChoice({title:`${cname(b)}: add one additional mana of any color`, options:['W', 'U', 'B', 'R', 'G'].map(x => ({label:MNAME[x], html:manaHTML('{' + x + '}'), value:x}))}); if (v){ addMana([v]); log(`${cname(b)}: +{${v}}`); } }
      for (const b of S.bf){ if (!b.att || b.att.id !== c.id || b.att.pid !== MYPID) continue; if (/^whenever enchanted (?:land|forest) is tapped for mana, its controller adds an additional \{g\}\{g\}/im.test(info(b.k)?.o || '')){ addMana(['G']); log(`${cname(b)}: +{G}`); } }
      commit(); } } catch (e){ console.warn(e); }
    return r;
  };
}

// Mayhem on a land (Oscorp Industries): play it from the graveyard the turn it was discarded
{
  const go = gyOptions;
  gyOptions = function(c){ const r = go(c) || []; try { if (c && isLand(c.k) && c.disc === turnStr() && /^mayhem$/im.test(info(c.k)?.o || '') && !r.some(o => o.land)) r.push({kind:'gyland', label:'Play land from graveyard (mayhem)', land:true}); } catch {} return r; };
}
// Spider-Punk: other Spiders I control have riot
{
  const oe = onEnter;
  onEnter = function(c, from, o = {}){ const r = oe(c, from, o);
    try { if (c && S.bf.includes(c) && isCreatureCard(c) && /\bSpider\b/.test(typeOf(c)) && !/^riot$/im.test(info(c.k)?.o || '') && !rulesOn('riot').length && S.bf.some(b => b !== c && !b.fd && /^other spiders you control have riot\.?$/im.test(info(b.k)?.o || '')) && !UI.dry){
      (async () => { const v = await askChoice({title:`${cname(c)}: riot`, options:[{label:'+1/+1 counter', value:'ctr'}, {label:'Haste', value:'haste'}]}); if (v === 'ctr') modCounters(c, 'cp', 1); else c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; commit(); })(); } } catch (e){ console.warn(e); }
    return r; };
}
STATIC_RULES.push(
  [/^mayhem$/, m => ({kind:'g23mayhemLand', who:'you'})],
  [/^other spiders you control have riot$/, m => ({kind:'g23spiderRiot', who:'you'})],
);

// Fated Firepower: my sources deal extra damage to opponents and their permanents
{
  const dd = dealDamage;
  dealDamage = function(t, n, srcK, srcCard, extra = {}){ try { if (S && n > 0 && t && t.pid && t.pid !== MYPID){ const add = S.bf.filter(b => !b.fd && /if a source you control would deal damage to an opponent or a permanent an opponent controls, it deals that much damage plus an amount of damage equal to the number of fire counters on/i.test(info(b.k)?.o || '')).reduce((a, b) => a + ((b.nc || {}).fire || 0), 0); if (add){ log(`fire counters: ${n} → ${n + add} damage`); n += add; } } } catch {} return dd(t, n, srcK, srcCard, extra); };
}
STATIC_RULES.push(
  [/^if a source you control would deal damage to an opponent or a permanent an opponent controls, it deals that much damage plus an amount of damage equal to the number of fire counters on ~ instead$/, m => ({kind:'g23fire', who:'you'})],
);

/* ---------- triggers ---------- */
{
  const tg = trigsOf;
  trigsOf = function(k, fl){
    const out = tg(k, fl); if (out.g23) return out; out.g23 = true;
    try {
      const a = info(k); const f = a ? (fl && a.back ? a.back : a) : null; if (!f) return out;
      const o = tname(f.o, f.n); let m;
      // "Whenever ~ attacks, blocks, or becomes the target of a spell, <eff>"
      if ((m = o.match(/^whenever ~ attacks, blocks, or becomes the target of a spell, (.+)$/im))){
        for (let i = out.length - 1; i >= 0; i--) if (/attacks, blocks, or becomes the target/.test(out[i].raw)) out.splice(i, 1);
        out.push({ev:'attack', evs:['attack', 'block', 'tgt'], subj:'self', ctl:'you', desc:'', eff:m[1], raw:m[0]});
      }
      // mana value windows on cast triggers (Kozilek's Unsealing)
      if ((m = o.match(/^whenever you cast a (creature|noncreature|artifact) spell with mana value (\d+), (\d+), or (\d+), (.+)$/im))){
        for (let i = out.length - 1; i >= 0; i--) if (out[i].raw === m[0]) out.splice(i, 1);
        out.push({ev:'cast', subj:'any', ctl:'you', desc:m[1], nth:0, eff:m[5], raw:m[0], g23mv:[+m[2], +m[4]]}); }
      for (const t of out){ if (t.ev !== 'cast' || t.g23mv) continue; const mm = String(t.raw || '').match(/^whenever you cast an? [a-z ]*?spells? with mana value (\d+) or (greater|less)\b/i); if (mm) t.g23mv = mm[2] === 'greater' ? [+mm[1], 99] : [0, +mm[1]]; }
      // ability word with digits ("10,000 Needles — Whenever …")
      for (const line of o.split('\n')){ const mm = line.trim().match(/^[\d,]+ [A-Z][\w' ]* — ((?:when|whenever|at) .+)$/i); if (mm){ const cl = g23classify(mm[1]); if (cl) out.push(cl); } }
      // Agent of the Iron Throne
      if (/^commander creatures you own have "whenever an artifact or creature you control is put into a graveyard from the battlefield, each opponent loses 1 life\."?"?$/im.test(o)) out.push({ev:'die', subj:'any', ctl:'you', desc:'', g23cmdr:true, eff:'Each opponent loses 1 life.', raw:'agent of the iron throne'});
      // Umezawa's Jitte: "equipped creature deals combat damage"
      if (/^whenever equipped creature deals combat damage, (.+)$/im.test(o)){ const mm = o.match(/^whenever equipped creature deals combat damage, (.+)$/im); out.push({ev:'dmg', subj:'any', ctl:'you', desc:'', equipped:true, g23combat:true, eff:mm[1], raw:mm[0]}); }
      // Derevi: "When ~ enters and whenever a creature you control deals combat damage to a player, …"
      { const mm = o.match(/^when ~ enters and whenever (a creature you control deals combat damage to a player), (.+)$/im); if (mm){ out.push({ev:'enter', subj:'self', ctl:'you', desc:'', eff:mm[2], raw:mm[0] + ' (enters)'}); const cl = classifyTrig('whenever', mm[1]); if (cl) out.push({...cl, eff:mm[2], raw:mm[0]}); } }
      // "As ~ enters, choose A or B. • A — <trigger> • B — <trigger>" (Sieges, Mirrodin Besieged …)
      for (const md of g23modesOf(o)){ const cl = g23classify(md.line); if (cl) out.push({...cl, g23mode:md.mode}); }
    } catch (e){ console.warn(e); }
    return out;
  };
}
function g23modesOf(o){
  const m = String(o || '').match(/^as ~ enters(?: the battlefield)?, choose ([A-Z][\w']*) or ([A-Z][\w']*)\.\s*\n• \1 — (.+)\n• \2 — (.+)$/im);
  return m ? [{mode:m[1], line:m[3].trim()}, {mode:m[2], line:m[4].trim()}] : [];
}
function g23classify(line){
  const m = line.match(/^(when|whenever|at) (.+?), ([\s\S]+)$/i); if (!m) return null;
  const cl = classifyTrig(m[1].toLowerCase(), m[2].toLowerCase().trim()); if (!cl) return null;
  return {...cl, eff:m[3].trim(), raw:line};
}
{
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){ if (t && t.g23mode){ const c = src && S.bf.find(b => b.id === src.id); if (!c || c.g23mode !== t.g23mode) return; } return pt(src, t, ev, evPid); };
  const oe = onEnter;
  onEnter = function(c, from, o = {}){
    const r = oe(c, from, o);
    try { if (c && S.bf.includes(c) && !c.g23mode){ const a = info(c.k); const ms = a ? g23modesOf(tname(a.o || '', a.n)) : []; if (ms.length){
      if (UI.dry){ c.g23mode = ms[0].mode; }
      else (async () => { const v = await askChoice({title:`${cname(c)}: choose ${ms[0].mode} or ${ms[1].mode}`, options:ms.map(x => ({label:`${x.mode} — ${short(x.line.replace(/~/g, cname(c)), 90)}`, value:x.mode}))}); c.g23mode = v || ms[0].mode; log(`${cname(c)}: chose ${c.g23mode}`); commit(); })(); } } } catch (e){ console.warn(e); }
    return r;
  };
  // the checker: check each mode's trigger instead of calling the whole line passive text
  const cc = checkCard;
  checkCard = async function(k){
    const r = await cc(k); try {
      const a = info(k); const ms = a ? g23modesOf(tname(a.o || '', a.n)) : [];
      if (ms.length && r && r.issues){ const i = r.issues.findIndex(x => x.kind === 'static' && /^as .+? enters(?: the battlefield)?, choose /i.test(x.text)); if (i >= 0){ r.issues.splice(i, 1);
        for (const md of ms){ const cl = g23classify(md.line); if (!cl){ r.issues.push({kind:'trigger', text:md.line.replace(/~/g, a.n)}); continue; }
          const miss = await dryAll(cl.eff.replace(/~/g, a.n), k, a.n); miss.forEach(x => r.issues.push({kind:'effect', text:x, where:md.line})); }
        if (!r.issues.length) r.ok = (r.ok || 0) + 1; } }
      if (r && r.issues) for (let i = r.issues.length - 1; i >= 0; i--){ const x = r.issues[i]; const mm = x.kind === 'static' && String(x.text).match(/^[\d,]+ [A-Z][\w' ]* — ((?:when|whenever|at) .+)$/i); if (!mm) continue;
        const line = tname(mm[1], a.n); const cl = g23classify(line); if (!cl) continue; r.issues.splice(i, 1); const miss = await dryAll(cl.eff.replace(/~/g, a.n), k, a.n); miss.forEach(t => r.issues.push({kind:'effect', text:t, where:mm[1]})); }
    } catch (e){ console.warn(e); }
    return r;
  };
}
// "At the beginning of each of your main phases" / "of your precombat main phase"
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    if (w === 'at'){ let m;
      if (/^the beginning of each of your main phases$/.test(c)) return {ev:'step', step:'g23main', whose:'your'};
      if (/^the beginning of (?:your precombat main phase|your first main phase)$/.test(c)) return {ev:'step', step:'g23main1', whose:'your'};
      if (/^the beginning of each of your postcombat main phases$/.test(c)) return {ev:'step', step:'g23main2', whose:'your'};
    }
    if (/^enchanted creature is dealt damage$/.test(c)) return {ev:'g23dealt', subj:'any', ctl:'you', desc:'', g23ench:true};
    { const mm = c.match(/^an? (\w+) you control is dealt damage$/); if (mm) return {ev:'g23dealt', subj:'any', ctl:'you', desc:mm[1]}; }
    if (/^equipped creature deals combat damage$/.test(c)) return {ev:'dmg', subj:'any', ctl:'you', desc:'', equipped:true, g23combat:true};
    if (/^~ enters and whenever a creature you control deals combat damage to a player$/.test(c)) return {ev:'enter', subj:'self', ctl:'you', desc:''};
    if (/^a creature is dealt damage$/.test(c)) return {ev:'g23dealt', subj:'any', ctl:'any', desc:'creature'};
    if (/^one or more opponents lose life$/.test(c)) return {ev:'loselife', subj:'any', ctl:'opp', desc:'', batch:true};
    if (/^you control seven or more thrulls$/.test(c)) return {ev:'g23state', subj:'self', ctl:'you', desc:''};
    if (/^~ deals combat damage to a creature$/.test(c)) return {ev:'dmg', subj:'self', ctl:'you', desc:'', g23combat:true, g23toCr:true};
    if (/^a creature deals combat damage to one of your opponents$/.test(c)) return {ev:'cdmg', subj:'any', ctl:'any', desc:'creature', g23edric:true};
    if (/^a player draws a card$/.test(c)) return {ev:'draw', subj:'any', ctl:'any', desc:''};
    if (/^you tap an? (?:creature|artifact|nonland permanent|permanent) for mana$/.test(c) || /^you tap a land for mana while you're the monarch$/.test(c)) return {ev:'manaHandled', subj:'any', ctl:'you', desc:''};
    if (/^one or more land cards are put into your graveyard from anywhere for the first time each turn$/.test(c)) return {ev:'togy', subj:'any', ctl:'you', desc:'land', batch:true, g23first:true};
    if (/^a source you control deals noncombat damage to an opponent$/.test(c)) return {ev:'dmg', subj:'any', ctl:'you', desc:'', toPlayer:true, oppOnly:true, g23noncombat:true};
    if (/^you create one or more creature tokens$/.test(c)) return {ev:'enter', subj:'any', ctl:'you', desc:'creature', tokOnly:true, batch:true};
    return ct(w, c);
  };
  const sp = setPhase;
  setPhase = function(i){
    const r = sp(i);
    try { if (S && (i === 3 || i === 5) && currentTurn()[1] === MYPID){ const key = turnStr() + ':' + i + ':' + (S.cb ? S.cb.n || 0 : 0); if (UI.g23mainKey !== key){ UI.g23mainKey = key; fireSteps('g23main', MYPID); fireSteps(i === 3 ? 'g23main1' : 'g23main2', MYPID); } } } catch (e){ console.warn(e); }
    return r;
  };
}

/* ---------- effects ---------- */
async function doRound23GPre(s, l, ctx){
  let m;
  const full = g23full(ctx);
  // leftovers of a trigger condition split at its first comma (the trigger itself is rebuilt in trigsOf)
  if ((m = l.match(/^blocks, or becomes the target of a spell, (.+)$/))){ await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true; }
  if ((m = l.match(/^(?:it|~) deals damage equal to its power to each opponent$/))){ const c = g23src(ctx); const n = c ? Math.max(0, g23pow(c)) : 0; for (const p of opponents()) dealDamage({t:'player', pid:p.pid}, n, ctx.k, c); log(`${ctx.name} deals ${n} damage to each opponent`); commit(); return true; }
  // Summon: Yojimbo
  if ((m = l.match(/^until your next turn, creatures can't attack you unless their controller pays \{(\d+)\} for each of those creatures$/))){ g23st().tax = {n:+m[1], u:g23untilNext()}; log(`${ctx.name}: until their next turn, creatures can't attack them unless their controller pays {${m[1]}} each`); commit(); return true; }
  // Hermit Druid
  if ((m = l.match(/^put that card into your hand and all other cards revealed this way into your graveyard$/)) && (ctx.untilHit !== undefined || ctx.untilRest)){
    const h = ctx.untilHit; if (h && S.ex.includes(h)){ S.ex.splice(S.ex.indexOf(h), 1); S.hand.push(h); log(`${ctx.name}: put ${cname(h)} into their hand`); }
    const rest = (ctx.untilRest || []).filter(c => S.ex.includes(c)); rest.forEach(c => { S.ex.splice(S.ex.indexOf(c), 1); S.gy.push(c); }); if (rest.length) log(`${ctx.name}: put ${rest.length} revealed card${rest.length === 1 ? '' : 's'} into their graveyard`);
    ctx.untilHit = null; ctx.untilRest = null; commit(); return true; }
  // Archfiend of Despair
  if ((m = l.match(/^each opponent loses life equal to the life (?:that player|they) lost this turn$/))){ for (const p of opponents()){ const n = lostThisTurn(p.pid); if (n) await loseLife(p.pid, n, ctx.name); else log(`${nameOf(p.pid)} lost no life this turn`); } commit(); return true; }
  // End the Festivities
  if ((m = l.match(/^~ deals (\d+) damage to each opponent and each creature and planeswalker they control$/))){ const n = +m[1]; const c = g23src(ctx);
    for (const p of opponents()){ dealDamage({t:'player', pid:p.pid}, n, ctx.k, c); for (const b of (OPP.get(p.pid)?.bf || [])) if (b.k && !b.fd && /Creature|Planeswalker/.test(info(b.k)?.t || '')) dealDamage({pid:p.pid, id:b.id, k:b.k}, n, ctx.k, c); }
    log(`${ctx.name}: ${n} damage to each opponent and each creature and planeswalker they control`); commit(); return true; }
  // Court of Garenbrig
  if ((m = l.match(/^(?:then )?if you're the monarch, double the number of \+1\/\+1 counters on each creature you control$/))){
    if (holderOf('mon') !== MYPID){ log(`${ctx.name}: not the monarch — no doubling`); return true; }
    S.bf.filter(c => !c.fd && isCreatureCard(c) && (c.cp || 0) > 0).forEach(c => modCounters(c, 'cp', c.cp)); log(`${ctx.name}: doubled the +1/+1 counters on each creature they control`); commit(); return true; }
  // Brago
  if ((m = l.match(/^exile any number of target nonland permanents you control, then return those cards to the battlefield under their owner's control$/))){
    let ts = ctx.tgts ? nextTargets(ctx).filter(t => t.pid === MYPID) : null;
    let cards = ts && ts.length ? ts.map(t => S.bf.find(b => b.id === t.id)).filter(Boolean) : null;
    if (!cards){ const pool = S.bf.filter(c => !c.fd && !isLand(c.k)); const ids = UI.dry ? [] : await pickCards({title:`${ctx.name}: exile and return any number of nonland permanents you control`, cards:pool, min:0, max:pool.length, noneLabel:'None'}); cards = (ids || []).map(id => S.bf.find(b => b.id === id)).filter(Boolean); }
    await g23flicker(cards, ctx); return true; }
  if (/^if ~ would be put into a graveyard from anywhere, reveal ~ and shuffle it into its owner's library instead$/.test(l)) return true;   // done in toGrave / moveCard
  // Brago (split at ", then")
  if ((m = l.match(/^exile any number of target nonland permanents you control$/)) && /then return those cards to the battlefield under their owner's control/.test(full)){
    let ts = ctx.tgts ? nextTargets(ctx).filter(t => t.pid === MYPID) : null;
    let cards = ts && ts.length ? ts.map(t => S.bf.find(b => b.id === t.id)).filter(Boolean) : null;
    if (!cards){ const pool = S.bf.filter(c => !c.fd && !isLand(c.k)); const ids = UI.dry ? [] : await pickCards({title:`${ctx.name}: exile and return any number of nonland permanents you control`, cards:pool, min:0, max:pool.length, noneLabel:'None'}); cards = (ids || []).map(id => S.bf.find(b => b.id === id)).filter(Boolean); }
    await g23flicker(cards, ctx); ctx.g23flk = true; return true; }
  if (/^return those cards to the battlefield under their owner's control$/.test(l) && ctx.g23flk) return true;
  // Conduit of Ruin
  if ((m = l.match(/^search your library for (.+?), reveal it$/)) && /then shuffle and put that card on top/.test(full)){ await searchLibrary(m[1], 'put it on top of your library', ctx); ctx.g23skipTop = true; return true; }
  if (/^(?:then )?shuffle and put that card on top$/.test(l) || (/^put that card on top$/.test(l) && ctx.g23skipTop)) return true;
  // Slaughter the Strong
  if ((m = l.match(/^each player chooses any number of creatures they control with total power (\d+) or less, then sacrifices all other creatures they control$/))){ const n = +m[1]; opponents().forEach(p => sendRq(p.pid, 'g23strong', n, ctx.name)); await g23strongMine(n, ctx.name); commit(); return true; }
  if ((m = l.match(/^each player chooses any number of creatures they control with total power (\d+) or less$/)) && /then sacrifices all other creatures they control/.test(full)){ const n = +m[1]; opponents().forEach(p => sendRq(p.pid, 'g23strong', n, ctx.name)); await g23strongMine(n, ctx.name); ctx.g23strong = true; commit(); return true; }
  if (/^sacrifices all other creatures they control$/.test(l) && ctx.g23strong) return true;
  if ((m = l.match(/^target opponent exiles the top (\w+) cards of their library$/)) && /you may put any number of land cards that player owns from exile onto the battlefield under your control/.test(full)){
    const t = g23tgt(ctx); const pid = t && t.pid !== MYPID ? t.pid : (UI.dry ? null : await choosePlayer(`${ctx.name}: target opponent`, true)); const n = wn(m[1]) || 4;
    if (pid){ sendRq(pid, 'g23exGive', n, ctx.name, {d:'land'}); log(`${ctx.name}: ${nameOf(pid)} exiles the top ${n} cards; their lands come to ${nameOf(MYPID)}`); } ctx.g23sower = true; commit(); return true; }
  if (/^(?:you may )?put any number of land cards (?:that|target) player owns from exile onto the battlefield under your control$/.test(l) && (ctx.g23sower || UI.dry)) return true;
  // Silkguard
  if ((m = l.match(/^auras, equipment, and modified creatures you control gain hexproof until end of turn$/))){
    const list = S.bf.filter(c => !c.fd && (/Aura|Equipment/.test(info(c.k)?.t || '') || (isCreatureCard(c) && ((c.cp || 0) + (c.cm || 0) + (c.co || 0) > 0 || (c.nc && Object.values(c.nc).some(Boolean)) || S.bf.some(a => a.att && a.att.id === c.id && a.att.pid === MYPID && /Aura|Equipment/.test(info(a.k)?.t || ''))))));
    list.forEach(c => { c.ekw = [...new Set([...(c.ekw || []), 'hexproof'])]; }); log(`${ctx.name}: ${list.length} permanent${list.length === 1 ? '' : 's'} gain hexproof until end of turn`); commit(); return true; }
  // Oblivion Sower
  if ((m = l.match(/^target opponent exiles the top (\w+) cards of their library, then you may put any number of land cards that player owns from exile onto the battlefield under your control$/))){
    const t = g23tgt(ctx); const pid = t && t.pid !== MYPID ? t.pid : (UI.dry ? null : await choosePlayer(`${ctx.name}: target opponent`, true)); const n = wn(m[1]) || 4;
    if (pid){ sendRq(pid, 'g23exGive', n, ctx.name, {d:'land'}); log(`${ctx.name}: ${nameOf(pid)} exiles the top ${n} cards; their lands come to ${nameOf(MYPID)}`); } commit(); return true; }
  // PuPu UFO
  if ((m = l.match(/^until end of turn, ~'s base power becomes equal to the number of (\w+?)s you control$/))){
    const c = g23src(ctx); if (!c || find(c.id)[0] !== 'bf'){ return true; }
    const re = new RegExp('\\b' + m[1] + 's?\\b', 'i'); const n = S.bf.filter(b => !b.fd && re.test(typeOf(b))).reduce((a, b) => a + (b.n || 1), 0);
    const st = stats(c) || [0, 0]; const base = st[0] - (c.pu ? c.pu[0] : 0) - (c.cp || 0) + (c.cm || 0); c.pu = [(c.pu ? c.pu[0] : 0) + (n - base), c.pu ? c.pu[1] : 0];
    log(`${cname(c)} has base power ${n} until end of turn`); commit(); return true; }
  // Hull Breach
  if ((m = l.match(/^destroy target artifact and target enchantment$/))){ for (let i = 0; i < 2; i++){ const t = g23tgt(ctx); if (t) applyTo(t, {op:'destroy', src:ctx.name}); } commit(); return true; }
  // Y'shtola Rhul: one additional end step
  if ((m = l.match(/^(?:then )?if it's the first end step of the turn, there is an additional end step after this step$/))){
    const g = g23st(); if (g.extraEnd === turnStr() || UI.dry){ return true; } g.extraEnd = turnStr();
    log(`${ctx.name}: there is an additional end step`); setTimeout(() => { try { if (S && currentTurn()[1] === MYPID){ fireSteps('end', MYPID); commit(); } } catch (e){ console.warn(e); } }, 50); return true; }
  if ((m = l.match(/^exile target creature you control, then return it to the battlefield under its owner's control$/)) || (m = l.match(/^exile target creature you control$/)) && /then return it to the battlefield under its owner's control/.test(full)){
    const t = g23tgt(ctx); const c = t && S.bf.find(b => b.id === t.id); if (c) await g23flicker([c], ctx); ctx.g23flk = true; return true; }
  if (/^return it to the battlefield under its owner's control$/.test(l) && ctx.g23flk) return true;
  // Winds of Change
  if ((m = l.match(/^each player shuffles the cards from their hand into their library$/)) && /then draws that many cards/.test(full)){ const n = S.hand.length; S.lib.push(...S.hand.splice(0)); shuffle(S.lib); draw(n); log(`${ctx.name}: shuffled ${n} cards into their library and drew ${n}`); opponents().forEach(p => sendRq(p.pid, 'g23winds', 0, ctx.name)); ctx.g23winds = true; commit(); return true; }
  if (/^draws that many cards$/.test(l) && ctx.g23winds) return true;
  // Crimson Wisps
  if ((m = l.match(/^target creature becomes (white|blue|black|red|green) and gains (haste|flying|trample) until end of turn$/))){ const t = g23tgt(ctx); if (t) applyTo(t, {op:'pump', src:ctx.name, f:{p:0, t:0, kw:[m[2]]}}); commit(); return true; }
  // Agitator Ant / Orzhov Advokist
  if ((m = l.match(/^each player may put two \+1\/\+1 counters on a creature they control$/))){
    const adv = /creatures target player controls can't attack you/.test(full);
    const mine = await g23eachMine('ctr2|', 2, ctx.name, MYPID);
    const res = await g23askEach(opponents().map(p => p.pid), adv ? `ctr2|(If you do, your creatures can't attack ${nameOf(MYPID)} until their next turn.)` : 'ctr2|(It will be goaded.)', 2, ctx.name);
    ctx.g23ctr2 = [{pid:MYPID, n:mine.n, d:mine.d}, ...res].filter(x => x.n && x.d);
    log(`${ctx.name}: ${ctx.g23ctr2.length ? ctx.g23ctr2.map(x => nameOf(x.pid)).join(', ') + ' put counters on a creature' : 'nobody put counters on a creature'}`); commit(); return true; }
  if ((m = l.match(/^goad each creature that had counters put on it this way$/))){ for (const x of ctx.g23ctr2 || []){ const id = +x.d; if (x.pid === MYPID){ const c = S.bf.find(b => b.id === id); if (c){ c.goad = {by:MYPID, n:currentTurn()[0]}; log(`${cname(c)} is goaded`); } } else sendRq(x.pid, 'goad', 0, ctx.name, {tid:id}); } commit(); return true; }
  if ((m = l.match(/^if a player does, creatures target player controls can't attack you or planeswalkers you control until your next turn$/))){ const pids = (ctx.g23ctr2 || []).map(x => x.pid).filter(p => p !== MYPID); const g = g23st(); g.noAtk = {pids, u:g23untilNext()}; if (pids.length) log(`${ctx.name}: creatures ${pids.map(nameOf).join(', ')} control${pids.length === 1 ? 's' : ''} can't attack them until their next turn`); commit(); return true; }
  // Lord of Pain
  if ((m = l.match(/^choose another target player$/)) && /deals damage equal to that spell's mana value to the chosen player/.test(full)){
    const caster = ctx.it && ctx.it.evPid; const t = g23tgt(ctx); let pid = t && t.t === 'player' && t.pid !== caster ? t.pid : null;
    if (!pid){ const list = players().filter(p => p.pid !== caster); pid = list.length === 1 || UI.dry ? (list[0] || {}).pid : await askChoice({title:`${ctx.name}: choose another player`, options:list.map(p => ({label:p.nm, value:p.pid}))}); }
    ctx.g23chosen = pid || null; return true; }
  if ((m = l.match(/^~ deals damage equal to that spell's mana value to the chosen player$/))){ const pid = ctx.g23chosen; const n = info(ctx.it && ctx.it.evk)?.mv || 0; if (pid && n) dealDamage({t:'player', pid}, n, ctx.k, g23src(ctx)); log(`${ctx.name}: ${n} damage to ${pid ? nameOf(pid) : 'nobody'}`); commit(); return true; }
  // Will of the Abzan
  if ((m = l.match(/^any number of target opponents each sacrifice a creature with the greatest power among creatures (?:that|target) player controls and lose (\d+) life$/))){
    let pids = (ctx.tgts ? nextTargets(ctx) : []).filter(t => t.t === 'player' && t.pid !== MYPID).map(t => t.pid); if (!pids.length && !UI.dry) pids = opponents().map(p => p.pid);
    for (const pid of pids){ sendRq(pid, 'g23each', 0, ctx.name, {ref:rid(6), d:'sacMax'}); await loseLife(pid, +m[1], ctx.name); } commit(); return true; }
  // Wrenn and Seven
  if ((m = l.match(/^put any number of land cards from your hand onto the battlefield tapped$/))){ const lands = S.hand.filter(c => isLand(c.k)); const ids = lands.length && !UI.dry ? await pickCards({title:`${ctx.name}: put any number of lands onto the battlefield tapped`, cards:lands, min:0, max:lands.length, noneLabel:'None'}) : []; (ids || []).forEach(id => { moveCard(id, 'bf', {quiet:true}); const c = S.bf.find(b => b.id === id); if (c) c.tap = true; }); if ((ids || []).length) log(`${ctx.name}: put ${ids.length} land${ids.length === 1 ? '' : 's'} onto the battlefield tapped`); commit(); return true; }
  // Assault Formation
  if ((m = l.match(/^target creature with defender can attack this turn as though it didn't have defender$/))){ const t = g23tgt(ctx); const c = t && S.bf.find(b => b.id === t.id); if (c){ c.g23def = turnStr(); log(`${cname(c)} can attack this turn as though it didn't have defender`); } commit(); return true; }
  // Lair of the Hydra
  if ((m = l.match(/^until end of turn, ~ becomes an x\/x (.+)$/))){ const x = (ctx.it && ctx.it.x) || (UI.dry ? 2 : 0); await doSentence(`Until end of turn, ~ becomes a ${x}/${x} ${s.slice(s.length - m[1].length)}`, ctx); return true; }
  if (/^x can't be 0$/.test(l)) return true;   // enforced when paying (X is chosen with the cost)
  // Kogla and Yidaro
  if ((m = l.match(/^it fights (target creature you don't control|target creature an opponent controls)$/))){ await doSentence(`~ fights ${m[1]}`, ctx); return true; }
  if ((m = l.match(/^shuffle ~ into your library from your graveyard$/))){ const c = S.gy.find(g => cname(g) === ctx.name || g.k === ctx.k); if (c){ moveCard(c.id, 'lib', {quiet:true}); shuffle(S.lib); log(`${ctx.name} was shuffled into their library`); } commit(); return true; }
  // Fangs of Kalonia
  if ((m = l.match(/^put a \+1\/\+1 counter on (target creature you control|each creature you control)$/)) && /then double the number of \+1\/\+1 counters on each creature that had a \+1\/\+1 counter put on it this way/.test(full)){
    const cs = /each/.test(m[1]) ? S.bf.filter(c => !c.fd && isCreatureCard(c)) : (() => { const t = g23tgt(ctx); const c = t && S.bf.find(b => b.id === t.id); return c ? [c] : []; })();
    cs.forEach(c => modCounters(c, 'cp', 1)); ctx.g23fangs = cs.map(c => c.id); log(`${ctx.name}: +1/+1 counter on ${cs.length} creature${cs.length === 1 ? '' : 's'}`); return true; }
  if ((m = l.match(/^double the number of \+1\/\+1 counters on each creature that had a \+1\/\+1 counter put on it this way$/))){ (ctx.g23fangs || []).forEach(id => { const c = S.bf.find(b => b.id === id); if (c && (c.cp || 0) > 0) modCounters(c, 'cp', c.cp); }); log(`${ctx.name}: doubled their +1/+1 counters`); commit(); return true; }
  // Zack Fair
  if ((m = l.match(/^put ~'s counters on that creature and attach an equipment that was attached to ~ to that creature$/))){
    const t = (ctx.lastT || [])[0]; const to = t && S.bf.find(b => b.id === t.id); const me = (UI.g23lki || {})[ctx.srcId] || {cp:0, eq:[]};
    if (to){ const cp = me.cp || 0; if (cp) modCounters(to, 'cp', cp);
      const eq = me.eq.map(id => S.bf.find(b => b.id === id)).filter(Boolean);
      if (eq.length){ let pick = eq[0]; if (eq.length > 1 && !UI.dry){ const pk = await pickCards({title:`${ctx.name}: attach which Equipment?`, cards:eq, min:1, max:1}); pick = S.bf.find(b => b.id === (pk || [])[0]) || eq[0]; } if (pick){ pick.att = {pid:MYPID, id:to.id}; log(`attached ${cname(pick)} to ${cname(to)}`); } }
      log(`${ctx.name}: moved ${cp} counter${cp === 1 ? '' : 's'} to ${cname(to)}`); }
    commit(); return true; }
  // Tempt with Vengeance
  if ((m = l.match(/^each opponent may create x 1\/1 red elemental creature tokens with haste$/))){ const x = (ctx.it && ctx.it.x) || 0; const res = await g23askEach(opponents().map(p => p.pid), 'elem?', x, ctx.name); ctx.g23tempt = res.filter(r => r.n).length; log(`${ctx.name}: ${ctx.g23tempt} opponent${ctx.g23tempt === 1 ? '' : 's'} accepted`); return true; }
  if ((m = l.match(/^for each opponent who does, create x 1\/1 red elemental creature tokens with haste$/))){ const x = (ctx.it && ctx.it.x) || 0; const n = (ctx.g23tempt || 0) * x; if (n) await createFromText(`Create ${n} 1/1 red Elemental creature tokens with haste`, ctx); commit(); return true; }
  // Tempting Contract
  if ((m = l.match(/^each opponent may create a treasure token$/))){ const res = await g23askEach(opponents().map(p => p.pid), 'treasure?', 1, ctx.name); ctx.g23tempt = res.filter(r => r.n).length; return true; }
  if ((m = l.match(/^for each opponent who does, you create a treasure token$/))){ const n = ctx.g23tempt || 0; if (n) await createFromText(`Create ${n} Treasure tokens`, ctx); commit(); return true; }
  // Wrenn and Seven −3
  if ((m = l.match(/^create a green treefolk creature token with reach and "(?:this token's|~'s) power and toughness are each equal to the number of lands you control\.?"$/))){
    const k0 = customToken('Treefolk', '0/0', 'G'); const k = k0 + '|g23wrenn'; if (!DICT.has(k)) DICT.set(k, {...DICT.get(k0), k, t:'Token Creature — Treefolk', o:"Reach\nTreefolk's power and toughness are each equal to the number of lands you control."});
    createToken(k, tokenMult(k), null, {}); log(`${ctx.name}: created a Treefolk token (power and toughness = lands you control)`); commit(); return true; }
  // Increasing Vengeance / Increasing Devotion (flashback doubles)
  if (/^copy that spell twice instead$/.test(l) && ctx.g23fromGy){ await copyTargetItem(ctx); return true; }
  if ((m = l.match(/^create (\w+) of those tokens instead$/)) && ctx.g23fromGy){ const mm = tname(String(info(ctx.k)?.o || ''), ctx.name || '').match(/^create (\w+) (.+? tokens?)\b/im); const n0 = mm ? wn(mm[1]) || 0 : 0; const n = (wn(m[1]) || 0) - n0; if (mm && n > 0) await createFromText(`Create ${n} ${mm[2].replace(/token$/, 'tokens')}`, ctx); return true; }
  // Mirrodin Besieged
  if ((m = l.match(/^(?:then )?if there are ([a-z]+(?:-[a-z]+)?|\d+) or more artifact cards in your graveyard, target opponent loses the game$/))){ const n = wn(m[1]) ?? +m[1]; const have = S.gy.filter(c => /Artifact/.test(info(c.k)?.t || '')).length; const t = g23tgt(ctx);
    if (!Number.isFinite(n) || !(have >= n)){ log(`${ctx.name}: ${have} artifact cards in the graveyard (needs ${n})`); return true; }
    const pid = t && t.pid !== MYPID ? t.pid : (UI.dry ? null : await choosePlayer(`${ctx.name}: which opponent loses the game?`, true)); if (pid){ sendRq(pid, 'g23lose', 0, ctx.name); log(`${ctx.name}: ${nameOf(pid)} loses the game`); } commit(); return true; }
  // Struggle for Project Purity
  if ((m = l.match(/^each opponent draws a card$/)) && /you draw a card for each card drawn this way/.test(full)){ const ops = opponents(); ops.forEach(p => sendRq(p.pid, 'draw', 1, ctx.name)); ctx.g23drawn = ops.length; log(`${ctx.name}: each opponent draws a card`); commit(); return true; }
  if (/^you draw a card for each card drawn this way$/.test(l)){ const n = ctx.g23drawn != null ? ctx.g23drawn : opponents().length; if (n) draw(n); commit(); return true; }
  if ((m = l.match(/^(?:that|target) player gets twice (\d+|that many) rad counters$/))){ const n = 2 * (m[1] === 'that many' ? (ctx.it && ctx.it.evN) || 0 : +m[1]); const pid = ctx.it && (ctx.it.evPid || ctx.it.evDp); if (pid && n){ if (pid === MYPID) addPC('rad', n); else sendRq(pid, 'rad', n, ctx.name, {d:'rad'}); log(`${ctx.name}: ${nameOf(pid)} gets ${n} rad counters`); } commit(); return true; }
  // Frontier Siege — Dragons
  if ((m = l.match(/^have it fight target creature you don't control$/))){ const id = ctx.it && ctx.it.evId; const c = id != null && S.bf.find(b => b.id === id); const t = g23tgt(ctx); if (c && t) g23fight({pid:MYPID, id:c.id, k:c.k}, t, ctx.name); commit(); return true; }
  // Final Parting
  if ((m = l.match(/^search your library for two cards$/)) && /put one into your hand and the other into your graveyard/.test(full)){
    const ids = UI.dry ? S.lib.slice(0, 2).map(c => c.id) : await pickCards({title:`${ctx.name}: search for two cards`, cards:S.lib.slice().sort((a, b) => cname(a).localeCompare(cname(b))), min:Math.min(2, S.lib.length), max:2});
    const cs = (ids || []).map(id => S.lib.find(c => c.id === id)).filter(Boolean); ctx.g23found = cs; log(`${ctx.name}: searched for two cards`); return true; }
  if ((m = l.match(/^put one into your hand and the other into your graveyard$/)) && ctx.g23found){ const cs = ctx.g23found; let h = cs[0];
    if (cs.length === 2 && !UI.dry){ const v = await askChoice({title:`${ctx.name}: which one goes into your hand?`, options:cs.map((c, i) => ({label:cname(c), value:i}))}); h = cs[v ?? 0]; }
    cs.forEach(c => { const i = S.lib.indexOf(c); if (i < 0) return; S.lib.splice(i, 1); (c === h ? S.hand : S.gy).push(c); }); if (h) log(`${ctx.name}: put a card into their hand${cs.length > 1 ? ' and ' + cname(cs.find(c => c !== h)) + ' into their graveyard' : ''}`); ctx.g23found = null; commit(); return true; }
  // Worldsoul's Rage
  if ((m = l.match(/^put up to (x|\w+) land cards from your hand and\/or graveyard onto the battlefield tapped$/))){ const n = m[1] === 'x' ? (ctx.it && ctx.it.x) || 0 : wn(m[1]) || 0; const pool = S.hand.concat(S.gy).filter(c => isLand(c.k));
    const ids = n && pool.length && !UI.dry ? await pickCards({title:`${ctx.name}: up to ${n} land cards onto the battlefield tapped`, cards:pool, min:0, max:Math.min(n, pool.length), noneLabel:'None'}) : [];
    (ids || []).forEach(id => { moveCard(id, 'bf', {quiet:true}); const c = S.bf.find(b => b.id === id); if (c) c.tap = true; }); if ((ids || []).length) log(`${ctx.name}: put ${ids.length} land${ids.length === 1 ? '' : 's'} onto the battlefield tapped`); commit(); return true; }
  // Torrential Gearhulk & co.
  if ((m = l.match(/^(?:you may )?cast target (instant|sorcery|instant or sorcery) card from your graveyard without paying its mana cost$/))){
    const t = g23tgt(ctx); const c = t && S.gy.find(g => g.id === t.id) || (!t && !UI.dry ? null : null);
    let card = c; if (!card && !UI.dry){ const pool = S.gy.filter(g => descOk(g.k, m[1])); const ids = pool.length ? await pickCards({title:`${ctx.name}: cast an ${m[1]} card from your graveyard for free`, cards:pool, min:0, max:1, noneLabel:"Don't"}) : []; card = ids && S.gy.find(g => g.id === ids[0]); }
    if (card && !UI.dry){ UI.afterCast = () => {}; await beginCast(card, 'gy', {free:true}); const it = S.stk.find(x => x.card && x.card.id === card.id); if (it && /if that spell would be put into your graveyard, exile it instead/.test(full)) it.exAfter = true; }
    return true; }
  if (/^if that spell would be put into your graveyard, exile it instead$/.test(l)) return true;   // set on the cast spell above
  // Wrenn and Realmbreaker −2
  if ((m = l.match(/^(?:you may )?put a (permanent|creature|land) card from among the milled cards into your hand$/))){ const mm = full.match(/mill (\w+) cards/); const n = mm ? wn(mm[1]) || 3 : 3; const pool = S.gy.slice(-n).filter(c => descOk(c.k, m[1]));
    const ids = pool.length && !UI.dry ? await pickCards({title:`${ctx.name}: put a ${m[1]} card into your hand`, cards:pool, min:0, max:1, noneLabel:'None'}) : []; if (ids && ids[0]){ moveCard(ids[0], 'hand', {quiet:true}); log(`${ctx.name}: put ${cname(S.hand.find(c => c.id === ids[0]))} into their hand`); } commit(); return true; }
  // Genesis Hydra
  if ((m = l.match(/^reveal the top x cards of your library$/)) && /put a nonland permanent card with mana value x or less from among them onto the battlefield\. then shuffle the rest into your library/.test(full)){
    const x = (ctx.it && (ctx.it.evX ?? ctx.it.x)) || 0; const top = S.lib.slice(0, x); log(`${ctx.name}: revealed ${top.map(cname).join(', ') || 'nothing'}`);
    const ok = top.filter(c => !isLand(c.k) && isPermType(info(c.k)?.t) && (info(c.k)?.mv || 0) <= x); const ids = ok.length && !UI.dry ? await pickCards({title:`${ctx.name}: put a nonland permanent with mana value ${x} or less onto the battlefield`, cards:ok, min:0, max:1, noneLabel:'None'}) : [];
    if (ids && ids[0]) moveCard(ids[0], 'bf'); shuffle(S.lib); log(`${ctx.name}: shuffled the rest into their library`); ctx.g23gen = true; commit(); return true; }
  if (ctx.g23gen && /^(?:you may )?put a nonland permanent card with mana value x or less from among them onto the battlefield$|^then shuffle the rest into your library$|^shuffle the rest into your library$/.test(l)) return true;
  // Spectacular Showdown
  if ((m = l.match(/^put a double strike counter on (target creature|each creature)$/)) && /goad each creature that had a double strike counter put on it this way/.test(full)){
    const ts = /each/.test(m[1]) ? boardsAll().flatMap(b => g23cr(b.bf).map(c => ({pid:b.pid, id:c.id, k:c.k}))) : [g23tgt(ctx)].filter(Boolean);
    for (const t of ts){ if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c){ addNamed(c, 'double strike', 1); c.goad = {by:MYPID, n:currentTurn()[0]}; } } else { sendRq(t.pid, 'g23kwctr', 1, ctx.name, {tid:t.id, d:'double strike'}); sendRq(t.pid, 'goad', 0, ctx.name, {tid:t.id}); } }
    log(`${ctx.name}: double strike counter and goad on ${ts.length} creature${ts.length === 1 ? '' : 's'}`); ctx.g23sd = true; commit(); return true; }
  if (/^goad each creature that had a double strike counter put on it this way$/.test(l) && ctx.g23sd) return true;
  // Emiel the Blessed
  if ((m = l.match(/^if you do, put a \+1\/\+1 counter on it$/)) && /if it's a unicorn, put two \+1\/\+1 counters on it instead/.test(full)){ const id = ctx.it && ctx.it.evId; const c = id != null && S.bf.find(b => b.id === id); if (c){ const n = /\bUnicorn\b/.test(typeOf(c)) ? 2 : 1; modCounters(c, 'cp', n); log(`${ctx.name}: ${n} +1/+1 counter${n > 1 ? 's' : ''} on ${cname(c)}`); } commit(); return true; }
  if (/^if it's a unicorn, put two \+1\/\+1 counters on it instead$/.test(l)) return true;
  // Pain for All
  if ((m = l.match(/^enchanted creature deals damage equal to its power to any other target$/))){ const a = g23src(ctx); const h = a && a.att && boardOf(a.att.pid).find(b => b.id === a.att.id); const t = g23tgt(ctx); if (h && t && a.att.pid === MYPID) dealDamage(t, Math.max(0, (stats(h) || [0, 0])[0]), h.k, h); commit(); return true; }
  // Reckless Handling
  if ((m = l.match(/^(?:then )?discard a card at random$/))){ if (!S.hand.length){ ctx.g23disc = null; return true; } const c = S.hand[Math.floor(Math.random() * S.hand.length)]; ctx.g23disc = c; moveCard(c.id, 'gy'); emit({type:'discard', cnt:1}); log(`${ctx.name}: discarded ${cname(c)} at random`); commit(); return true; }
  if ((m = l.match(/^if an? (artifact|creature|land|nonland) card was discarded this way, (.+)$/))){ const c = ctx.g23disc; if (c && descOk(c.k, m[1])) await doSentence(cap(s.slice(s.length - m[2].length)), ctx); return true; }
  // Lich-Knights' Conquest
  if ((m = l.match(/^sacrifice any number of artifacts, enchantments, and\/or tokens$/))){ const pool = S.bf.filter(c => !c.fd && (c.tok || /Artifact|Enchantment/.test(info(c.k)?.t || ''))); const ids = pool.length && !UI.dry ? await pickCards({title:`${ctx.name}: sacrifice any number of artifacts, enchantments and/or tokens`, cards:pool, min:0, max:pool.length, noneLabel:'None'}) : [];
    ctx.g23sacN = (ids || []).length; (ids || []).forEach(id => { const c = S.bf.find(b => b.id === id); if (c) sacrificeOne(c); }); log(`${ctx.name}: sacrificed ${ctx.g23sacN}`); commit(); return true; }
  if ((m = l.match(/^return that many creature cards from your graveyard to the battlefield$/))){ const n = ctx.g23sacN || 0; const pool = S.gy.filter(c => isCreatureCard(c)); const ids = n && pool.length && !UI.dry ? await pickCards({title:`${ctx.name}: return ${n} creature card${n === 1 ? '' : 's'}`, cards:pool, min:Math.min(n, pool.length), max:Math.min(n, pool.length)}) : [];
    (ids || []).forEach(id => moveCard(id, 'bf')); commit(); return true; }
  // Cloudstone Curio
  if ((m = l.match(/^(?:you may )?return another permanent you control that shares a permanent type with it to its owner's hand$/))){ const id = ctx.it && ctx.it.evId; const e = id != null && S.bf.find(b => b.id === id); if (!e) return true;
    const types = ['Artifact', 'Creature', 'Enchantment', 'Land', 'Planeswalker', 'Battle'].filter(t => new RegExp('\\b' + t + '\\b').test(typeOf(e)));
    const pool = S.bf.filter(c => c !== e && !c.fd && types.some(t => new RegExp('\\b' + t + '\\b').test(typeOf(c)))); const ids = pool.length && !UI.dry ? await pickCards({title:`${ctx.name}: return another permanent that shares a type with ${cname(e)}`, cards:pool, min:0, max:1, noneLabel:"Don't"}) : [];
    if (ids && ids[0]){ const c = S.bf.find(b => b.id === ids[0]); if (c){ log(`${ctx.name}: returned ${cname(c)} to hand`); moveCard(c.id, c.tok ? 'gy' : 'hand', {quiet:true}); } } commit(); return true; }
  // Rakdos, Patron of Chaos
  if ((m = l.match(/^target opponent may sacrifice two nonland, nontoken permanents of their choice$/))){ const t = g23tgt(ctx); const pid = t && t.pid !== MYPID ? t.pid : (opponents()[0] || {}).pid; if (!pid){ ctx.theyDid = false; return true; }
    const [r] = await g23askEach([pid], 'sac2|draws two cards', 2, ctx.name); ctx.theyDid = !!(r && r.n); log(`${nameOf(pid)} ${ctx.theyDid ? 'sacrificed two permanents' : "didn't sacrifice"}`); commit(); return true; }
  if ((m = l.match(/^if they don't, you draw two cards$/)) && ctx.theyDid !== undefined){ if (!ctx.theyDid) draw(2); commit(); return true; }
  // Witch-king: "Tap him."
  if (/^tap (?:him|her)$/.test(l)){ const c = g23src(ctx); if (c && S.bf.includes(c)){ c.tap = true; log(`tapped ${cname(c)}`); } commit(); return true; }
  // Expel the Interlopers
  if ((m = l.match(/^choose a number between 0 and 10$/))){ ctx.g23num = UI.dry ? 5 : await askChoice({title:`${ctx.name}: choose a number`, options:[...Array(11).keys()].map(n => ({label:String(n), value:n}))}); ctx.g23num = ctx.g23num ?? 10; log(`${ctx.name}: chose ${ctx.g23num}`); return true; }
  if ((m = l.match(/^destroy all creatures with power greater than or equal to the chosen number$/))){ const n = ctx.g23num ?? 0; S.bf.filter(c => !c.fd && isCreatureCard(c) && g23pow(c) >= n).forEach(c => destroyCard(c, ctx.name)); opponents().forEach(p => sendRq(p.pid, 'g23wipePow', n, ctx.name)); log(`${ctx.name}: destroy all creatures with power ${n} or greater`); commit(); return true; }
  // Lifestream's Blessing
  if ((m = l.match(/^draw x cards, where x is the greatest power among creatures you controlled as you cast (?:this spell|~)$/))){ const n = Math.max(0, ...S.bf.filter(c => !c.fd && isCreatureCard(c)).map(c => g23pow(c))); ctx.g23x = n; if (n) draw(n); commit(); return true; }
  if ((m = l.match(/^if (?:this spell|~) was cast from exile, you gain twice x life$/))){ if (ctx.it && ctx.it.from === 'ex'){ const n = 2 * (ctx.g23x || 0); if (n && gainLife(n, ctx.name)) log(`gained ${n} life → ${S.life}`); } commit(); return true; }
  // Settle the Wreckage
  if ((m = l.match(/^(?:that|target) player may search their library for (?:that many|(\w+)) basic land cards, put those cards onto the battlefield tapped$/))){ const pid = ctx.g23settle ? ctx.g23settle.pid : (ctx.lastT || [])[0] && ctx.lastT[0].pid; const n = ctx.g23settle ? ctx.g23settle.n : (wn(m[1] || '') || 0);
    if (pid && n){ if (pid === MYPID){ if (await askYes(`${ctx.name}: search for ${n} basic land cards?`)) await searchLibrary(`up to ${n} basic land cards`, 'put those cards onto the battlefield tapped, then shuffle', ctx); } else sendRq(pid, 'g23ramp', n, ctx.name, {d:'basic land'}); } commit(); return true; }
  if ((m = l.match(/^exile all attacking creatures target player controls$/)) && /may search their library for that many basic land cards/.test(full)){ const t = g23tgt(ctx); const pid = t && t.pid; if (!pid) return true;
    if (pid === MYPID){ const cs = S.bf.filter(c => c.atk && isCreatureCard(c)); const n = cs.reduce((a, c) => a + (c.n || 1), 0); cs.forEach(c => moveCard(c.id, 'ex', {quiet:true})); ctx.g23settle = {pid, n}; }
    else { const cs = (OPP.get(pid)?.bf || []).filter(b => b.atk && b.k && /Creature/.test(info(b.k)?.t || '')); ctx.g23settle = {pid, n:cs.reduce((a, c) => a + (c.n || 1), 0)}; cs.forEach(b => sendRq(pid, 'exile', 0, ctx.name, {tid:b.id})); }
    log(`${ctx.name}: exiled ${ctx.g23settle.n} attacking creature${ctx.g23settle.n === 1 ? '' : 's'}`); commit(); return true; }
  if (/^then shuffle$/.test(l) && ctx.g23settle) return true;
  // Aetherspouts
  if ((m = l.match(/^for each attacking creature, its owner puts it on their choice of the top or bottom of their library$/))){ await g23spoutMine(ctx.name); opponents().forEach(p => sendRq(p.pid, 'g23spout', 0, ctx.name)); commit(); return true; }
  // Kozilek's Unsealing (split trigger condition)
  if ((m = l.match(/^5, or 6, (.+)$/))){ await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true; }
  // Cemetery Tampering
  if ((m = l.match(/^(?:then )?if there are (twenty) or more cards in your graveyard, (you may play the exiled card without paying its mana cost)$/))){ const n = wn(m[1]) || 0; if (S.gy.length >= n || UI.dry) await doSentence(cap(s.slice(s.length - m[2].length)), ctx); else log(`${ctx.name}: only ${S.gy.length} cards in the graveyard`); return true; }
  // Teferi's Time Twist / Semester's End: delayed return with an extra counter
  if ((m = l.match(/^exile target permanent you control$/)) && /return that card to the battlefield under its owner's control at the beginning of the next end step\. if it enters as a creature, it enters with an additional \+1\/\+1 counter on it/.test(full.replace(/\n/g, ' '))){
    const t = g23tgt(ctx); const c = t && S.bf.find(b => b.id === t.id); if (c){ const nm = cname(c); if (c.tok){ moveCard(c.id, 'ex', {quiet:true}); log(`${nm} (token) was exiled`); } else { moveCard(c.id, 'ex', {quiet:true}); S.dly.push({id:rid(6), eff:`(delayed) return ${nm} with a +1/+1 counter`, k:ctx.k, nm:ctx.name, srcId:c.id, op:'g23ret', cp:1}); log(`${ctx.name}: exiled ${nm} — it returns at the next end step`); } }
    ctx.g23ttt = true; commit(); return true; }
  if (ctx.g23ttt && /^return that card to the battlefield under its owner's control at the beginning of the next end step$|^if it enters as a creature, it enters with an additional \+1\/\+1 counter on it$/.test(l)) return true;
  if ((m = l.match(/^exile any number of target creatures and\/or planeswalkers you control$/)) && /at the beginning of the next end step, return each of them to the battlefield/.test(full)){
    let ts = ctx.tgts ? nextTargets(ctx).filter(t => t.pid === MYPID) : []; let cs = ts.map(t => S.bf.find(b => b.id === t.id)).filter(Boolean);
    if (!ctx.tgts && !UI.dry){ const pool = S.bf.filter(c => !c.fd && /Creature|Planeswalker/.test(typeOf(c))); const ids = await pickCards({title:`${ctx.name}: exile any number of creatures and/or planeswalkers you control`, cards:pool, min:0, max:pool.length, noneLabel:'None'}); cs = (ids || []).map(id => S.bf.find(b => b.id === id)).filter(Boolean); }
    for (const c of cs){ const nm = cname(c); moveCard(c.id, 'ex', {quiet:true}); if (!c.tok) S.dly.push({id:rid(6), eff:`(delayed) return ${nm} with an extra counter`, k:ctx.k, nm:ctx.name, srcId:c.id, op:'g23ret', cp:1, lo:1}); }
    log(`${ctx.name}: exiled ${cs.length} — they return at the next end step`); ctx.g23ttt = true; commit(); return true; }
  if (ctx.g23ttt && /^at the beginning of the next end step, return each of them to the battlefield under its owner's control$|^each of them enters with an additional \+1\/\+1 counter on it if it's a creature and an additional loyalty counter on it if it's a planeswalker$/.test(l)) return true;
  // Pain for All / Wrathful Raptors: the damaged creature deals that much damage
  if ((m = l.match(/^it deals that much damage to (each opponent|any target that isn't a dinosaur)$/))){ const id = ctx.it && ctx.it.evId; const c = id != null && S.bf.find(b => b.id === id) || null; const n = (ctx.it && ctx.it.evN) || 0; if (!n) return true;
    if (/each opponent/.test(m[1])){ for (const p of opponents()) dealDamage({t:'player', pid:p.pid}, n, c ? c.k : ctx.k, c); }
    else { const t = g23tgt(ctx); if (t) dealDamage(t, n, c ? c.k : ctx.k, c); }
    commit(); return true; }
  // Wrenn and Realmbreaker +1
  if ((m = l.match(/^up to one target land you control becomes a (\d+)\/(\d+) (\w+) creature with ([a-z ,]+) until your next turn$/))){ const t = g23tgt(ctx); const c = t && S.bf.find(b => b.id === t.id); if (!c) return true;
    const kws = m[4].split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim()).filter(Boolean); c.g23anim = {pt:[+m[1], +m[2]], kws, t:turnStr()}; c.anim = 'g23'; c.animPT = [+m[1], +m[2]]; c.ekw = [...new Set([...(c.ekw || []), ...kws])];
    log(`${cname(c)} becomes a ${m[1]}/${m[2]} ${m[3]} creature until ${nameOf(MYPID)}'s next turn`); commit(); return true; }
  // The Chain Veil
  if ((m = l.match(/^if you didn't activate a loyalty ability of a planeswalker this turn, you lose (\d+) life$/))){ if (S.g23loyT === turnStr() || S.bf.some(c => c.lu === turnStr())){ log(`${ctx.name}: a loyalty ability was activated this turn`); return true; } S.life -= +m[1]; log(`${ctx.name}: lost ${m[1]} life → ${S.life}`); commit(); return true; }
  if ((m = l.match(/^for each planeswalker you control, you may activate one of its loyalty abilities once this turn as though none of its loyalty abilities have been activated this turn$/))){ S.bf.filter(c => isPW(c)).forEach(c => { c.g23veil = turnStr(); c.g23veilUsed = 0; }); log(`${ctx.name}: each planeswalker may activate one more loyalty ability this turn`); commit(); return true; }
  // Thousand-Faced Shadow
  if ((m = l.match(/^if it's attacking, create a token that's a copy of another target attacking creature$/))){ const c = g23src(ctx); if (!UI.dry && !(c && c.atk)){ log(`${ctx.name}: not attacking`); return true; } const t = g23tgt(ctx);
    if (t && t.k){ const tk = g23tokCopy(t.k, {tapped:true, atk:(c && c.atk) || (defOpts()[0] || {}).key || ''}); ctx.lastCardId = tk.id; } return true; }
  if (/^the token enters tapped and attacking$/.test(l)) return true;
  // The Jolly Balloon Man
  if ((m = l.match(/^create a token that's a copy of another target creature you control, except it's a 1\/1 red balloon creature in addition to its other colors and types and it has flying and haste$/))){ const t = g23tgt(ctx); if (!t || !t.k) return true;
    const k = g23derive(t.k, {pt:'1/1', addType:'Balloon', kws:['Flying', 'Haste'], col:'R'}); const tk = g23tokCopy(k, {}); ctx.lastCardId = tk.id; ctx.lastTok = [tk.id]; return true; }
  // Ratadrabik of Urborg
  if ((m = l.match(/^create a token that's a copy of that creature, except it's not legendary and it's a (\d+)\/(\d+) (black) (\w+) in addition to its other colors and types$/))){ const k0 = ctx.it && ctx.it.evk; if (!k0) return true;
    const k = g23derive(k0, {pt:`${m[1]}/${m[2]}`, addType:cap(m[4]), col:'B', noLegend:true}); g23tokCopy(k, {}); return true; }
  // Dance of the Manse
  if ((m = l.match(/^return up to x target artifact and\/or non-aura enchantment cards each with mana value x or less from your graveyard to the battlefield$/))){ const x = (ctx.it && ctx.it.x) || 0;
    let cs = ctx.tgts ? nextTargets(ctx).map(t => S.gy.find(g => g.id === t.id)).filter(Boolean) : [];
    if (!cs.length && !ctx.tgts && !UI.dry){ const pool = S.gy.filter(g => (info(g.k)?.mv || 0) <= x && (/Artifact/.test(info(g.k)?.t || '') || (/Enchantment/.test(info(g.k)?.t || '') && !/Aura/.test(info(g.k)?.t || '')))); const ids = await pickCards({title:`${ctx.name}: return up to ${x}`, cards:pool, min:0, max:Math.min(x, pool.length), noneLabel:'None'}); cs = (ids || []).map(id => S.gy.find(g => g.id === id)).filter(Boolean); }
    cs = cs.filter(g => (info(g.k)?.mv || 0) <= x).slice(0, x); cs.forEach(g => { moveCard(g.id, 'bf'); const b = S.bf.find(y => y.id === g.id); if (b && x >= 6 && !isCreatureCard(b)){ b.anim = 'perm'; b.r19pt = [4, 4]; } });
    log(`${ctx.name}: returned ${cs.length}${x >= 6 && cs.length ? ' (they are 4/4 creatures too)' : ''}`); ctx.g23manse = true; commit(); return true; }
  if (/^if x is 6 or more, those permanents are 4\/4 creatures in addition to their other types$/.test(l)) return true;   // done above
  // Metamorphosis Fanatic
  if ((m = l.match(/^return up to one target creature card from your graveyard to the battlefield with an? (lifelink|flying|deathtouch|indestructible|hexproof|first strike|haste|vigilance|trample|menace|reach) counter on it$/))){ const t = g23tgt(ctx); const c = t && S.gy.find(g => g.id === t.id); if (!c) return true; moveCard(c.id, 'bf'); const b = S.bf.find(y => y.id === c.id); if (b){ addNamed(b, m[1], 1); b.ekw = [...new Set([...(b.ekw || []), m[1]])]; b.g23kwc = m[1]; } commit(); return true; }
  // Sovereign Okinec Ahau
  if ((m = l.match(/^for each creature you control with power greater than that creature's base power, put a number of \+1\/\+1 counters on that creature equal to the difference$/))){
    S.bf.filter(c => !c.fd && isCreatureCard(c)).forEach(c => { const base = c.anim === 'perm' && c.r19pt ? c.r19pt[0] : c.animPT ? c.animPT[0] : (parseInt(info(c.k)?.p) || 0); const d = g23pow(c) - base; if (d > 0){ modCounters(c, 'cp', d); log(`${cname(c)}: ${d} +1/+1 counter${d === 1 ? '' : 's'}`); } }); commit(); return true; }
  // Emet-Selch: cast (paying) target instant or sorcery card from your graveyard
  if ((m = l.match(/^(?:you may )?cast target (instant or sorcery|instant|sorcery) card from your graveyard$/))){ const t = g23tgt(ctx); const c = t && S.gy.find(g => g.id === t.id); if (c && !UI.dry){ if (S.g23once && S.g23once[ctx.srcId] === turnStr() && /do this only once each turn/.test(full)) return true; S.g23once = {...(S.g23once || {}), [ctx.srcId]:turnStr()}; await beginCast(c, 'gy', {}); const it = S.stk.find(x => x.card && x.card.id === c.id); if (it && /if that spell would be put into your graveyard, exile it instead/.test(full)) it.exAfter = true; } return true; }
  if (/^do this only once each turn$/.test(l)) return true;
  // Angel of Destiny
  if ((m = l.match(/^you and that player each gain that much life$/))){ const n = (ctx.it && (ctx.it.evN || ctx.it.evX)) || 0; const pid = ctx.it && ctx.it.evDp; if (n){ if (gainLife(n, ctx.name)) log(`gained ${n} life → ${S.life}`); if (pid && pid !== MYPID) sendRq(pid, 'life', n, ctx.name); } commit(); return true; }
  if ((m = l.match(/^if you have at least 15 life more than your starting life total, each player ~ attacked this turn loses the game$/))){ const start = (FMT[S.fmt]?.life || 40); if (S.life < start + 15){ log(`${ctx.name}: ${S.life} life — not 15 more than ${start}`); return true; }
    const a = S.g23atkd && S.g23atkd.t === turnStr() ? (S.g23atkd.m[ctx.srcId] || []) : []; [...new Set(a)].forEach(pid => { sendRq(pid, 'g23lose', 0, ctx.name); log(`${ctx.name}: ${nameOf(pid)} loses the game`); }); commit(); return true; }
  // Savage Beating & co.: casting-time restriction lines (enforced in castCheck)
  if (/^cast (?:~|this spell) only (?:during combat on your turn|during combat on an opponent's turn|before the combat damage step)$/.test(l)) return true;
  // Howlsquad Heavy
  if ((m = l.match(/^that token attacks this combat if able$/))){ const id = (S.bf.slice().reverse().find(c => c.tok && c.sk && /Goblin/.test(typeOf(c))) || {}).id; const c = id != null && S.bf.find(b => b.id === id); if (c){ c.goad = {by:MYPID, n:currentTurn()[0]}; log(`${cname(c)} attacks this combat if able`); } commit(); return true; }
  // Umezawa's Jitte modes
  if ((m = l.match(/^equipped creature gets ([+-]\d+)\/([+-]\d+) until end of turn$/))){ const a = g23src(ctx); const h = a && a.att && boardOf(a.att.pid).find(b => b.id === a.att.id); if (h) applyTo({pid:a.att.pid, id:h.id}, {op:'pump', src:ctx.name, f:{p:+m[1], t:+m[2]}}); commit(); return true; }
  // Derevi
  if ((m = l.match(/^put ~ onto the battlefield from the command zone$/))){ const c = S.cz.find(x => x.k === ctx.k) || g23src(ctx); if (c && S.cz.includes(c)){ moveCard(c.id, 'bf'); log(`${ctx.name} was put onto the battlefield from the command zone`); } commit(); return true; }
  // Rampaging Yao Guai
  if ((m = l.match(/^destroy any number of target artifacts and\/or enchantments with total mana value x or less$/))){ const x = (ctx.it && (ctx.it.x ?? ctx.it.evX)) ?? (srcCardOf(ctx) || {}).cp ?? 0; let tot = 0;
    for (const t of (ctx.tgts ? nextTargets(ctx) : [])){ const mv = info(t.k)?.mv || 0; if (tot + mv > x) continue; tot += mv; applyTo(t, {op:'destroy', src:ctx.name}); } commit(); return true; }
  // Tasha's Hideous Laughter
  if ((m = l.match(/^each opponent exiles cards from the top of their library until (?:that|target) player has exiled cards with total mana value (\d+) or greater$/))){ opponents().forEach(p => sendRq(p.pid, 'g23exMV', +m[1], ctx.name)); log(`${ctx.name}: each opponent exiles until total mana value ${m[1]}`); commit(); return true; }
  // Doppelgang
  if ((m = l.match(/^for each of x target permanents, create x tokens that are copies of that permanent$/))){ const x = (ctx.it && ctx.it.x) || 0; for (const t of (ctx.tgts ? nextTargets(ctx) : [])){ if (!t.k) continue; for (let i = 0; i < x; i++) g23tokCopy(t.k, {}); } commit(); return true; }
  // Repercussion
  if ((m = l.match(/^~ deals that much damage to that creature's controller$/))){ const pid = ctx.it && ctx.it.evPid; const n = (ctx.it && ctx.it.evN) || 0; if (pid && n) dealDamage({t:'player', pid}, n, ctx.k, g23src(ctx)); commit(); return true; }
  // Jolrael
  if ((m = l.match(/^until end of turn, creatures you control have base power and toughness x\/x, where x is the number of cards in your hand$/))){ const n = S.hand.length; await doSentence(`Creatures you control have base power and toughness ${n}/${n} until end of turn`, ctx); return true; }
  // Lifeblood Hydra
  if ((m = l.match(/^you gain life and draw cards equal to its power$/))){ const id = ctx.it && ctx.it.evId; const p = Math.max(0, ((UI.g23lkiP || {})[id] || [0])[0] || 0); if (p){ if (gainLife(p, ctx.name)) log(`gained ${p} life → ${S.life}`); draw(p); } commit(); return true; }
  // Paradigm
  if (/^paradigm$/.test(l)){ if (ctx.it && ctx.it.kind === 'spell'){ if (!(ctx.it.card && ctx.it.card.g23copy)){ ctx.it.exAfter = true; S.g23para = {...(S.g23para || {}), [ctx.k]:1}; log(`${ctx.name}: paradigm — exiled; a free copy at the beginning of each of your first main phases`); } } commit(); return true; }
  // Gathering Stone
  if ((m = l.match(/^if it's a card of the chosen type, you may reveal it and put it into your hand$/))){ const c = S.lib[0]; const src = g23src(ctx); const ty = src && src.ctype; ctx.g23took = false;
    if (c && ty && new RegExp('\\b' + ty + '\\b', 'i').test(typeOf(c)) && !UI.dry && await askYes(`${ctx.name}: reveal ${cname(c)} and put it into your hand?`)){ S.lib.shift(); S.hand.push(c); log(`${ctx.name}: revealed ${cname(c)} and put it into their hand`); ctx.g23took = true; } commit(); return true; }
  if ((m = l.match(/^if you don't put the card into your hand, you may put it into your graveyard$/))){ if (ctx.g23took) return true; const c = S.lib[0]; if (c && !UI.dry && await askYes(`${ctx.name}: put ${cname(c)} into your graveyard?`)){ moveCard(c.id, 'gy'); } commit(); return true; }
  // Athreos
  if ((m = l.match(/^return it to your hand unless target opponent pays (\d+) life$/))){ const id = ctx.it && ctx.it.evId; const t = g23tgt(ctx); const pid = t && t.pid !== MYPID ? t.pid : (opponents()[0] || {}).pid;
    const [r] = pid ? await g23askEach([pid], 'pay3life', 3, ctx.name) : [{n:0}]; if (r && r.n){ log(`${nameOf(pid)} paid ${m[1]} life`); return true; }
    const c = id != null && S.gy.find(g => g.id === id); if (c){ moveCard(c.id, 'hand'); log(`${ctx.name}: returned ${cname(c)} to hand`); } commit(); return true; }
  // Lost Monarch of Ifnir
  if ((m = l.match(/^if a player was dealt combat damage by a zombie this turn, mill three cards$/))){ if (S.g23zdmg === turnStr() || UI.dry){ mill(3); ctx.g23lm = true; } else ctx.g23lm = false; return true; }
  if ((m = l.match(/^(?:then )?(?:you may )?return a creature card from your graveyard to your hand$/)) && ctx.g23lm !== undefined){ if (!ctx.g23lm) return true; const pool = S.gy.filter(isCreatureCard); const ids = pool.length && !UI.dry ? await pickCards({title:`${ctx.name}: return a creature card to your hand`, cards:pool, min:0, max:1, noneLabel:'None'}) : []; if (ids && ids[0]) moveCard(ids[0], 'hand'); commit(); return true; }
  // Improvisation Capstone
  if ((m = l.match(/^exile cards from the top of your library until you exile cards with total mana value (\d+) or greater$/))){ let tot = 0; const out = []; while (S.lib.length && tot < +m[1]){ const c = S.lib.shift(); out.push(c); tot += info(c.k)?.mv || 0; } S.ex.push(...out); ctx.g23exd = out; log(`${ctx.name}: exiled ${out.map(cname).join(', ') || 'nothing'} (total mana value ${tot})`); commit(); return true; }
  if ((m = l.match(/^(?:you may )?cast any number of spells from among them without paying their mana costs$/)) && ctx.g23exd){ if (UI.dry) return true;
    for (;;){ const pool = ctx.g23exd.filter(c => S.ex.includes(c) && !isLand(c.k)); if (!pool.length) break; const ids = await pickCards({title:`${ctx.name}: cast a spell without paying its mana cost`, cards:pool, min:0, max:1, noneLabel:'Done'}); const c = ids && pool.find(x => x.id === ids[0]); if (!c) break; UI.afterCast = () => {}; await beginCast(c, 'ex', {free:true}); }
    return true; }
  // Take the Bait
  if ((m = l.match(/^prevent all combat damage that would be dealt to you and planeswalkers you control this turn$/))){ g23st().bait = turnStr(); log(`${ctx.name}: combat damage to them is prevented this turn`); commit(); return true; }
  if ((m = l.match(/^untap all attacking creatures and goad them$/))){ const ap = currentTurn()[1]; if (ap && ap !== MYPID) sendRq(ap, 'g23untapGoad', 0, ctx.name); else { S.bf.filter(c => c.atk).forEach(c => { c.tap = false; c.tn = 0; }); } log(`${ctx.name}: attacking creatures untap and are goaded`); commit(); return true; }
  // Berserk
  if ((m = l.match(/^target creature gains trample and gets \+x\/\+0 until end of turn, where x is its power$/))){ const t = g23tgt(ctx); if (!t) return true; const st = statsAny(t); const n = st ? Math.max(0, st[0]) : 0; applyTo(t, {op:'pump', src:ctx.name, f:{p:n, t:0, kw:['trample']}}); ctx.lastT = [t]; commit(); return true; }
  // Abdel Adrian
  if ((m = l.match(/^exile any number of other nonland permanents you control until ~ leaves the battlefield$/))){ const me = g23src(ctx); const pool = S.bf.filter(c => !c.fd && c !== me && !isLand(c.k));
    const ids = pool.length && !UI.dry ? await pickCards({title:`${ctx.name}: exile any number of other nonland permanents until it leaves`, cards:pool, min:0, max:pool.length, noneLabel:'None'}) : [];
    const held = []; (ids || []).forEach(id => { const c = S.bf.find(b => b.id === id); if (!c) return; const tok = c.tok; moveCard(c.id, 'ex', {quiet:true}); if (!tok) held.push(c.id); }); ctx.g23exN = (ids || []).length;
    if (me && S.bf.includes(me)) me.g23held = (me.g23held || []).concat(held); else held.forEach(id => moveCard(id, 'bf', {quiet:true}));
    log(`${ctx.name}: exiled ${ctx.g23exN} permanent${ctx.g23exN === 1 ? '' : 's'} until it leaves`); commit(); return true; }
  if ((m = l.match(/^create a 1\/1 white soldier creature token for each permanent exiled this way$/)) && ctx.g23exN !== undefined){ if (ctx.g23exN) await createFromText(`Create ${ctx.g23exN} 1/1 white Soldier creature tokens`, ctx); return true; }
  // Robe of Stars
  if ((m = l.match(/^equipped creature phases out$/))){ const a = g23src(ctx); const h = a && a.att && a.att.pid === MYPID && S.bf.find(b => b.id === a.att.id); if (h){ S.bf.splice(S.bf.indexOf(h), 1); S.poz = (S.poz || []).concat(h); log(`${cname(h)} phased out`); } commit(); return true; }
  // Gluntch
  if ((m = l.match(/^choose a player$/)) && /they put two \+1\/\+1 counters on a creature they control/.test(full)){ const ps = players(); const pick = async (title, not) => { const list = ps.filter(p => !not.includes(p.pid)); if (!list.length) return null; if (list.length === 1 || UI.dry) return list[0].pid; return askChoice({title, options:list.map(p => ({label:p.me ? `${p.nm} (you)` : p.nm, value:p.pid}))}); };
    const a = await pick(`${ctx.name}: choose a player to put two +1/+1 counters on a creature`, []); const b = await pick(`${ctx.name}: choose a second player to draw a card`, [a]); const c = await pick(`${ctx.name}: choose a third player to create two Treasures`, [a, b]);
    if (a === MYPID){ const pool = S.bf.filter(x => !x.fd && isCreatureCard(x)); const ids = pool.length && !UI.dry ? await pickCards({title:`${ctx.name}: two +1/+1 counters on a creature you control`, cards:pool, min:1, max:1}) : []; const x = ids && S.bf.find(y => y.id === ids[0]); if (x) modCounters(x, 'cp', 2); } else if (a) sendRq(a, 'g23each', 2, ctx.name, {ref:rid(6), d:'ctr2!|'});
    if (b === MYPID) draw(1); else if (b) sendRq(b, 'draw', 1, ctx.name);
    if (c === MYPID) await createFromText('Create two Treasure tokens', ctx); else if (c) sendRq(c, 'tokText', 0, ctx.name, {d:'two Treasure tokens'});
    log(`${ctx.name}: counters → ${a ? nameOf(a) : 'nobody'}, draw → ${b ? nameOf(b) : 'nobody'}, Treasures → ${c ? nameOf(c) : 'nobody'}`); ctx.g23glu = true; commit(); return true; }
  if (ctx.g23glu && /^(they put two \+1\/\+1 counters on a creature they control|choose a second player to draw a card|(?:then )?choose a third player to create two treasure tokens)$/.test(l)) return true;
  // Master of Ceremonies
  if ((m = l.match(/^each opponent chooses money, friends, or secrets$/))){ const res = await g23askEach(opponents().map(p => p.pid), 'mcer', 0, ctx.name); ctx.g23mc = res;
    for (const r of res){ const v = r.d || 'money'; log(`${nameOf(r.pid)} chose ${v}`);
      if (v === 'money'){ await createFromText('Create a Treasure token', ctx); sendRq(r.pid, 'tokText', 0, ctx.name, {d:'a Treasure token'}); }
      else if (v === 'friends'){ await createFromText('Create a 1/1 green and white Citizen creature token', ctx); sendRq(r.pid, 'tokText', 0, ctx.name, {d:'a 1/1 green and white Citizen creature token'}); }
      else { draw(1); sendRq(r.pid, 'draw', 1, ctx.name); } }
    commit(); return true; }
  if (ctx.g23mc && /^for each player who chose (money|friends|secrets), you and that player each /.test(l)) return true;
  // Burnt Offering
  if ((m = l.match(/^add x mana in any combination of \{(\w)\} and\/or \{(\w)\}, where x is the sacrificed creature's mana value$/))){ const k0 = UI.g23lastSac || (ctx.sacd && ctx.sacd.k); const x = UI.dry ? 2 : (info(k0)?.mv || 0); const A = m[1].toUpperCase(), B = m[2].toUpperCase();
    let na = x; if (x && !UI.dry) na = await askChoice({title:`${ctx.name}: how much of the ${x} mana is {${A}}? (the rest is {${B}})`, options:[...Array(x + 1).keys()].map(i => ({label:`${'{' + A + '}'}×${i} + {${B}}×${x - i}`, value:i}))}) ?? x;
    addMana([...Array(na).fill(A), ...Array(x - na).fill(B)]); log(`${ctx.name}: added ${na} {${A}} and ${x - na} {${B}}`); commit(); return true; }
  // Oviya
  if ((m = l.match(/^if you put an artifact onto the battlefield this way, put two \+1\/\+1 counters on it$/))){ const c = ctx.lastCardId != null && S.bf.find(b => b.id === ctx.lastCardId); if (c && /Artifact/.test(typeOf(c))){ modCounters(c, 'cp', 2); log(`${cname(c)}: two +1/+1 counters`); } commit(); return true; }
  // Render Silent
  if ((m = l.match(/^its controller can't cast spells this turn$/))){ const it = ctx.it && ctx.it.tgt ? stackAll().find(x => x.sid === ctx.it.tgt) : null; const pid = (it && it.pid) || ctx.g23tgtPid; if (pid && pid !== MYPID){ sendRq(pid, 'g23silent', 0, ctx.name); log(`${ctx.name}: ${nameOf(pid)} can't cast spells this turn`); } else if (pid === MYPID){ g23st().silent = turnStr(); } commit(); return true; }
  // Elspeth Conquers Death II
  if ((m = l.match(/^noncreature spells your opponents cast cost \{(\d+)\} more to cast until your next turn$/))){ const g = g23st(); g.ncTax = +m[1]; g.ncTaxU = g23untilNext(); log(`${ctx.name}: opponents' noncreature spells cost {${m[1]}} more until their next turn`); commit(); return true; }
  // Bothersome Quasit
  if ((m = l.match(/^goad target creature an opponent controls$/))){ const t = g23tgt(ctx); if (t && t.pid !== MYPID){ sendRq(t.pid, 'goad', 0, ctx.name, {tid:t.id}); log(`${ctx.name}: goaded ${t.nm || 'a creature'}`); } commit(); return true; }
  // Nuclear Fallout
  if ((m = l.match(/^each creature gets twice -x\/-x until end of turn$/))){ const x = 2 * ((ctx.it && ctx.it.x) || 0); if (!x) return true;
    S.bf.filter(c => !c.fd && isCreatureCard(c)).forEach(c => { c.pu = [(c.pu || [0, 0])[0] - x, (c.pu || [0, 0])[1] - x]; });
    for (const [pid, st] of OPP) (st.bf || []).filter(b => b.k && !b.fd && /Creature/.test(info(b.k)?.t || '')).forEach(b => sendRq(pid, 'pump', 0, ctx.name, {tid:b.id, f:{p:-x, t:-x}}));
    log(`${ctx.name}: each creature gets -${x}/-${x} until end of turn`); commit(); return true; }
  // Fandaniel
  if ((m = l.match(/^each opponent may sacrifice a nontoken creature of their choice$/))){ const res = await g23askEach(opponents().map(p => p.pid), 'sacCr|nontoken', 0, ctx.name); ctx.g23fand = res.filter(r => !r.n).map(r => r.pid); return true; }
  if ((m = l.match(/^each opponent who doesn't loses (\d+) life for each instant and sorcery card in your graveyard$/)) || (m = l.match(/^each opponent who doesn't loses (\d+) life$/))){ const per = /for each/.test(l) ? +m[1] : 2; const n = per * S.gy.filter(c => /Instant|Sorcery/.test(info(c.k)?.t || '')).length;
    for (const pid of ctx.g23fand || []) if (n) await loseLife(pid, n, ctx.name); commit(); return true; }
  // Redoubled Stormsinger
  if ((m = l.match(/^for each creature token you control that entered this turn, create a tapped and attacking token that's a copy of that token$/))){ const me = g23src(ctx); const atk = (me && me.atk) || (defOpts()[0] || {}).key || '';
    const toks = S.bf.filter(c => c.tok && !c.fd && isCreatureCard(c) && c.et === turnStr()); ctx.lastTok = [];
    for (const c of toks){ const tk = g23tokCopy(c.k, {tapped:true, atk}); ctx.lastTok.push(tk.id); } return true; }
  if ((m = l.match(/^at the beginning of the next end step, sacrifice those tokens$/)) && ctx.lastTok){ ctx.lastTok.forEach(id => S.dly.push({id:rid(6), eff:'Sacrifice it.', k:ctx.k, nm:ctx.name, srcId:id, op:'sac'})); commit(); return true; }
  // Stinkweed Imp
  if ((m = l.match(/^destroy that creature$/)) && UI.g23victim){ const t = UI.g23victim; UI.g23victim = null; applyTo(t, {op:'destroy', src:ctx.name}); commit(); return true; }
  // Overmaster
  if ((m = l.match(/^the next instant or sorcery spell you cast this turn can't be countered$/))){ g23st().unctr = turnStr(); commit(); return true; }
  // Lurking Predators
  if ((m = l.match(/^reveal the top card of your library$/)) && /if it's a creature card, put it onto the battlefield\. otherwise, you may put that card on the bottom of your library/.test(full)){ const c = S.lib[0]; if (!c) return true; log(`${ctx.name}: revealed ${cname(c)}`);
    if (isCreatureCard(c)) moveCard(c.id, 'bf'); else if (!UI.dry && await askYes(`${ctx.name}: put ${cname(c)} on the bottom of your library?`, 'Bottom', 'Leave it')){ S.lib.push(S.lib.shift()); log(`${ctx.name}: put it on the bottom`); } ctx.g23lurk = true; commit(); return true; }
  if (ctx.g23lurk && /^(if it's a creature card, put it onto the battlefield|otherwise, (?:you may )?put that card on the bottom of your library|put that card on the bottom of your library)$/.test(l)) return true;
  // Hazel of the Rootbloom
  if ((m = l.match(/^create a token that's a copy of target token you control$/)) && /if that token is a squirrel, instead create two tokens that are copies of it/.test(full)){ const t = g23tgt(ctx); if (!t || !t.k) return true; const n = /\bSquirrel\b/.test(info(t.k)?.t || '') ? 2 : 1; for (let i = 0; i < n; i++) g23tokCopy(t.k, {}); return true; }
  if (/^if that token is a squirrel, instead create two tokens that are copies of it$/.test(l)) return true;
  // Tezzeret −8 / Lord of the Void-style
  if ((m = l.match(/^exile the top (ten|seven|\w+) cards of your library$/)) && /put all artifact cards from among them onto the battlefield/.test(full)){ const n = wn(m[1]) || 10; const top = S.lib.splice(0, n); S.ex.push(...top); ctx.g23exd = top; log(`${ctx.name}: exiled ${top.length} cards`); return true; }
  if ((m = l.match(/^put all artifact cards from among them onto the battlefield$/)) && ctx.g23exd){ ctx.g23exd.filter(c => S.ex.includes(c) && /Artifact/.test(info(c.k)?.t || '')).forEach(c => moveCard(c.id, 'bf')); commit(); return true; }
  // Lunar Convocation
  if ((m = l.match(/^if you gained and lost life this turn, (.+)$/))){ const lt = lifeT(); if ((lt.g > 0 && lt.l > 0) || UI.dry) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); else log(`${ctx.name}: didn't both gain and lose life this turn`); return true; }
  // Mask of Griselbrand
  if ((m = l.match(/^pay x life, where x is its power$/))){ const id = ctx.it && ctx.it.evId; const x = UI.dry ? 2 : Math.max(0, ((UI.g23lkiP || {})[id] || [0])[0] || 0); if (S.life < x){ ctx.didPay = false; log(`${ctx.name}: not enough life`); return true; } S.life -= x; ctx.g23x = x; ctx.didPay = true; log(`paid ${x} life → ${S.life}`); commit(); return true; }
  if ((m = l.match(/^if you do, draw x cards$/)) && ctx.g23x != null){ if (ctx.didPay && ctx.g23x) draw(ctx.g23x); commit(); return true; }
  // Ardyn
  if ((m = l.match(/^exile up to one target creature card from a graveyard$/)) && /if you exiled a card this way, create a token that's a copy of that card/.test(full)){ const t = g23tgt(ctx); ctx.g23exK = null; if (!t) return true;
    if (t.pid === MYPID){ const c = S.gy.find(g => g.id === t.id); if (c){ moveCard(c.id, 'ex'); ctx.g23exK = c.k; } } else { sendRq(t.pid, 'g23gyEx', 0, ctx.name, {d:t.k}); ctx.g23exK = t.k; }
    if (UI.dry) ctx.g23exK = ctx.k; return true; }
  if ((m = l.match(/^if you exiled a card this way, create a token that's a copy of that card, except it's a (\d+)\/(\d+) (black|white|blue|red|green) (\w+)$/))){ if (!ctx.g23exK) return true; const k = g23derive(ctx.g23exK, {pt:`${m[1]}/${m[2]}`, addType:cap(m[4]), col:{black:'B', white:'W', blue:'U', red:'R', green:'G'}[m[3]]}); g23tokCopy(k, {}); return true; }
  // Duress
  if ((m = l.match(/^you choose a noncreature, nonland card from it$/)) && (ctx.revealed || UI.dry)){ if (!ctx.revealed) ctx.revealed = {pid:'dry-opp', ks:S.lib.slice(0, 4).map(c => c.k)}; const ks = ctx.revealed.ks.filter(k => !/Creature|Land/.test(info(k)?.t || ''));
    if (!ks.length){ log(`${ctx.name}: no noncreature, nonland card`); ctx.chosenK = null; return true; }
    ctx.chosenK = UI.dry || ks.length === 1 ? ks[0] : await askChoice({title:`${ctx.name}: choose a noncreature, nonland card`, options:ks.map(k => ({label:info(k)?.n || 'a card', value:k}))}); return true; }
  if (/^target player discards that card$/.test(l) && ctx.revealed){ await doSentence('That player discards that card', ctx); return true; }
  // One Ring to Rule Them All
  if ((m = l.match(/^each player mills cards equal to your ring-bearer's power$/))){ const rb = S.bf.find(c => c.ring && !c.fd); const n = rb ? Math.max(0, g23pow(rb)) : 0; if (n){ mill(n); opponents().forEach(p => sendRq(p.pid, 'mill', n, ctx.name)); } log(`${ctx.name}: each player mills ${n}`); commit(); return true; }
  if ((m = l.match(/^each opponent loses 1 life for each creature card in (?:that|target) player's graveyard$/))){ for (const p of opponents()){ const n = (OPP.get(p.pid)?.gy || []).filter(k => /Creature/.test(info(typeof k === 'string' ? k : k && k.k)?.t || '')).length; if (n) await loseLife(p.pid, n, ctx.name); } commit(); return true; }
  // Planetarium of Wan Shi Tong
  if ((m = l.match(/^(?:you may )?cast that card without paying its mana cost$/)) && /whenever you scry or surveil, look at the top card of your library/.test(tname(String(info(ctx.k)?.o || ''), ctx.name || '').toLowerCase())){ const c = S.lib[0]; if (!c || isLand(c.k) || UI.dry) return true; const key = (ctx.srcId || ctx.name) + '|plan'; S.g23once = S.g23once || {}; if (S.g23once[key] === turnStr()) return true;
    if (await askYes(`${ctx.name}: cast ${cname(c)} without paying its mana cost?`)){ S.g23once[key] = turnStr(); UI.afterCast = () => {}; await beginCast(c, 'lib', {free:true}); } return true; }
  // Shielded by Faith
  if ((m = l.match(/^attach ~ to that creature$/))){ const a = g23src(ctx); const id = ctx.it && ctx.it.evId; const pid = (ctx.it && ctx.it.evPid) || MYPID; if (a && id != null){ a.att = {pid, id}; log(`${ctx.name} is now attached to ${info(ctx.it.evk)?.n || 'that creature'}`); } commit(); return true; }
  // Extract from Darkness
  if ((m = l.match(/^(?:then )?you put a creature card from a graveyard onto the battlefield under your control$/))){ const opts = S.gy.filter(isCreatureCard).map(c => ({label:`${cname(c)} (your graveyard)`, value:'m:' + c.id}));
    for (const [pid, st] of OPP) (st.gy || []).forEach(k0 => { const k = typeof k0 === 'string' ? k0 : k0 && k0.k; if (k && /Creature/.test(info(k)?.t || '')) opts.push({label:`${info(k).n} (${nameOf(pid)}'s graveyard)`, value:'o:' + pid + ':' + k}); });
    if (!opts.length || UI.dry) return true; const v = opts.length === 1 ? opts[0].value : await askChoice({title:`${ctx.name}: put a creature card from a graveyard onto the battlefield`, options:opts}); if (!v) return true;
    if (v.startsWith('m:')) moveCard(+v.slice(2), 'bf'); else { const [, pid, ...kk] = v.split(':'); sendRq(pid, 'gytake', 0, ctx.name, {d:kk.join(':')}); } commit(); return true; }
  // Wakening Sun's Avatar
  if ((m = l.match(/^if you cast it from your hand, (.+)$/))){ const c = g23src(ctx); const rec = c && (S.casts || []).slice().reverse().find(x => x.id === c.id); if ((rec && rec.from === 'hand') || UI.dry) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); else log(`${ctx.name}: wasn't cast from hand`); return true; }
  if ((m = l.match(/^destroy all non-(\w+) creatures$/))){ const ty = cap(m[1]); S.bf.filter(c => !c.fd && isCreatureCard(c) && !new RegExp('\\b' + ty + '\\b').test(typeOf(c))).forEach(c => destroyCard(c, ctx.name)); opponents().forEach(p => sendRq(p.pid, 'wipe', 0, ctx.name, {d:`non-${m[1]} creature`})); commit(); return true; }
  // Hallowed Haunting
  if ((m = l.match(/^create a white spirit cleric creature token with "(?:this token's|~'s) power and toughness are each equal to the number of spirits you control\.?"$/))){
    const k0 = customToken('Spirit Cleric', '0/0', 'W'); const k = k0 + '|g23hh'; if (!DICT.has(k)) DICT.set(k, {...DICT.get(k0), k, t:'Token Creature — Spirit Cleric', o:"Spirit Cleric's power and toughness are each equal to the number of Spirits you control."});
    createToken(k, tokenMult(k), null, {}); commit(); return true; }
  // Tree of Redemption
  if ((m = l.match(/^exchange your life total with ~'s toughness$/))){ const c = g23src(ctx); if (!c || !S.bf.includes(c)) return true; const t = (stats(c) || [0, 0])[1]; const life = S.life; c.pu = [(c.pu || [0, 0])[0], (c.pu || [0, 0])[1] + (life - t)]; c.g23perm = 1; S.life = t; log(`${ctx.name}: life ${life} ↔ toughness ${t}`); commit(); return true; }
  // God-Eternal Bontu
  if ((m = l.match(/^sacrifice any number of other permanents$/)) && /then draw that many cards/.test(full)){ const me = g23src(ctx); const pool = S.bf.filter(c => !c.fd && c !== me); const ids = pool.length && !UI.dry ? await pickCards({title:`${ctx.name}: sacrifice any number of other permanents`, cards:pool, min:0, max:pool.length, noneLabel:'None'}) : [];
    ctx.g23sacN = (ids || []).length; (ids || []).forEach(id => { const c = S.bf.find(b => b.id === id); if (c) sacrificeOne(c); }); return true; }
  if ((m = l.match(/^(?:then )?draw that many cards$/)) && ctx.g23sacN !== undefined){ if (ctx.g23sacN) draw(ctx.g23sacN); commit(); return true; }
  if ((m = l.match(/^(?:you may )?put (?:her|him|it) into (?:her|his|its) owner's library third from the top$/))){ const id = ctx.it && ctx.it.evId; const c = S.gy.find(g => g.id === id) || S.ex.find(g => g.id === id) || S.gy.find(g => g.k === ctx.k); if (c){ const z = S.gy.includes(c) ? S.gy : S.ex; z.splice(z.indexOf(c), 1); reset(c); S.lib.splice(Math.min(2, S.lib.length), 0, c); log(`${cname(c)} was put into its owner's library third from the top`); } commit(); return true; }
  // Support N
  if ((m = l.match(/^support (\d+|one|two|three)$/))){ const n = wn(m[1]) || +m[1]; const me = g23src(ctx); const cards = [];
    S.bf.filter(c => !c.fd && isCreatureCard(c) && c !== me).forEach(c => cards.push({id:c.id, k:c.k, pid:MYPID})); for (const [pid, st] of OPP) (st.bf || []).filter(b => b.k && !b.fd && /Creature/.test(info(b.k)?.t || '')).forEach(b => cards.push({id:-7000 - cards.length, k:b.k, pid, rid:b.id}));
    const ids = cards.length && !UI.dry ? await pickCards({title:`${ctx.name}: support ${n} — a +1/+1 counter on each of up to ${n} other creatures`, cards:cards.map(c => ({id:c.id, k:c.k})), min:0, max:Math.min(n, cards.length), noneLabel:'None'}) : [];
    (ids || []).forEach(id => { const x = cards.find(c => c.id === id); if (!x) return; if (x.pid === MYPID){ const c = S.bf.find(b => b.id === id); if (c) modCounters(c, 'cp', 1); } else sendRq(x.pid, 'ctr', 1, ctx.name, {tid:x.rid, d:'cp'}); }); commit(); return true; }
  // Together Forever
  if ((m = l.match(/^choose target creature with a counter on it$/)) && /when that creature dies this turn, return that card to its owner's hand/.test(full)){ ctx.g23tfd = true; const t = g23tgt(ctx); if (!t) return true; if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c) c.g23tf = turnStr(); } else sendRq(t.pid, 'g23tf', 0, ctx.name, {tid:t.id}); log(`${ctx.name}: ${t.nm || 'that creature'} returns to its owner's hand if it dies this turn`); ctx.g23tfd = true; commit(); return true; }
  if (ctx.g23tfd && /^when that creature dies this turn, return that card to its owner's hand$/.test(l)) return true;
  // Luminarch Ascension
  if ((m = l.match(/^if you didn't lose life this turn, (.+)$/))){ if (lifeT().l === 0 || UI.dry) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); else log(`${ctx.name}: lost life this turn`); return true; }
  // Teferi, Temporal Pilgrim −12
  if ((m = l.match(/^target opponent chooses a permanent they control and returns it to its owner's hand$/))){ const t = g23tgt(ctx); const pid = t && t.pid !== MYPID ? t.pid : (UI.dry ? null : await choosePlayer(`${ctx.name}: target opponent`, true)); if (pid) sendRq(pid, 'g23teferi', 0, ctx.name); ctx.g23tef = true; commit(); return true; }
  if (ctx.g23tef && /^(?:then )?they shuffle each nonland permanent they control into its owner's library$/.test(l)) return true;
  // Bane of Bala Ged
  if ((m = l.match(/^defending player exiles two permanents they control$/))){ const c = g23src(ctx); const d = c && c.atk ? parseDef(c.atk) : null; const pid = (d && d.pid) || (ctx.it && ctx.it.evDp); if (pid && pid !== MYPID) sendRq(pid, 'g23exTwo', 2, ctx.name); commit(); return true; }
  // Hope of Ghirapur
  if ((m = l.match(/^until your next turn, target player who was dealt combat damage by ~ this turn can't cast noncreature spells$/))){ const t = g23tgt(ctx); const hit = S.g23cd && S.g23cd.t === turnStr() ? (S.g23cd.m[ctx.srcId] || []) : []; const pid = t && t.pid; if (pid && pid !== MYPID && (hit.includes(pid) || UI.dry)){ sendRq(pid, 'g23noNC', 0, ctx.name); log(`${ctx.name}: ${nameOf(pid)} can't cast noncreature spells until ${nameOf(MYPID)}'s next turn`); } else if (pid) log(`${ctx.name}: ${nameOf(pid)} wasn't dealt combat damage by it this turn`); commit(); return true; }
  // Goblin Recruiter
  if ((m = l.match(/^search your library for any number of (\w+) cards, reveal them$/)) && /then shuffle and put those cards on top in any order/.test(full)){ const d = m[1]; const pool = S.lib.filter(c => descOk(c.k, d)); const ids = pool.length && !UI.dry ? await pickCards({title:`${ctx.name}: search for any number of ${d} cards (click in the order you want them on top)`, cards:pool, min:0, max:pool.length, noneLabel:'None'}) : [];
    const cs = (ids || []).map(id => S.lib.find(c => c.id === id)).filter(Boolean); cs.forEach(c => S.lib.splice(S.lib.indexOf(c), 1)); shuffle(S.lib); S.lib.unshift(...cs); log(`${ctx.name}: revealed ${cs.map(cname).join(', ') || 'nothing'} and put them on top`); ctx.g23rec = true; commit(); return true; }
  if (ctx.g23rec && /^(?:then )?shuffle and put those cards on top in any order$|^put those cards on top in any order$/.test(l)) return true;
  // Rhys the Redeemed
  if ((m = l.match(/^for each creature token you control, create a token that's a copy of that creature$/))){ const toks = S.bf.filter(c => c.tok && !c.fd && isCreatureCard(c)); for (const c of toks){ const n = c.n || 1; for (let i = 0; i < n; i++) g23tokCopy(c.k, {}); } commit(); return true; }
  // Sunfall
  if ((m = l.match(/^exile all creatures$/)) && /incubate x, where x is the number of creatures exiled this way/.test(full)){ let n = 0; S.bf.filter(c => !c.fd && isCreatureCard(c)).forEach(c => { n += c.n || 1; moveCard(c.id, 'ex', {quiet:true}); });
    for (const [pid, st] of OPP){ n += (st.bf || []).filter(b => b.k && !b.fd && /Creature/.test(info(b.k)?.t || '')).reduce((a, b) => a + (b.n || 1), 0); sendRq(pid, 'wipeEx', 0, ctx.name, {d:'creature'}); }
    ctx.g23exN = n; log(`${ctx.name}: exiled ${n} creature${n === 1 ? '' : 's'}`); commit(); return true; }
  if ((m = l.match(/^incubate (x|\d+)(?:, where x is the number of creatures exiled this way)?$/))){ const n = m[1] === 'x' ? (ctx.g23exN ?? (ctx.it && ctx.it.x) ?? 0) : +m[1]; g23incubate(n, ctx); return true; }
  if ((m = l.match(/^transform ~$/)) && /Incubator/.test(info(ctx.k)?.t || '')){ const c = g23src(ctx); if (c){ c.anim = 'perm'; c.r19pt = [0, 0]; const k = c.k + '|ph'; if (!DICT.has(k)) DICT.set(k, {...info(c.k), k, n:'Phyrexian Token', t:'Token Artifact Creature — Phyrexian', p:'0/0', o:''}); c.k = k; log('the Incubator transformed into a 0/0 Phyrexian artifact creature'); } commit(); return true; }
  // Lord of the Void
  if ((m = l.match(/^exile the top seven cards of (?:that|target) player's library$/)) && /put a creature card from among them onto the battlefield under your control/.test(full)){ const pid = (ctx.it && ctx.it.evDp) || (g23tgt(ctx) || {}).pid; if (!pid || pid === MYPID){ return true; }
    const [r] = await g23askEach([pid], 'ex7pile', 7, ctx.name); const ks = (OPP.get(pid)?.pile || {}).ks || []; const cr = ks.map((k, i) => ({id:-9000 - i, k})).filter(c => /Creature/.test(info(c.k)?.t || ''));
    const ids = cr.length && !UI.dry ? await pickCards({title:`${ctx.name}: put a creature card onto the battlefield under your control`, cards:cr, min:0, max:1, noneLabel:'None'}) : [];
    if (ids && ids[0] != null){ sendRq(pid, 'g23giveEx', 0, ctx.name, {d:info(cr.find(c => c.id === ids[0]).k)?.n || '', ref:rid(6)}); } ctx.g23lv = true; commit(); return true; }
  if (ctx.g23lv && /^(?:then )?put a creature card from among them onto the battlefield under your control$/.test(l)) return true;
  // Inventory Management
  if ((m = l.match(/^for each aura and equipment you control, you may attach it to a creature you control$/))){ const crs = S.bf.filter(c => !c.fd && isCreatureCard(c)); if (!crs.length || UI.dry) return true;
    for (const a of S.bf.filter(c => !c.fd && /Aura|Equipment/.test(info(c.k)?.t || ''))){ const ids = await pickCards({title:`${ctx.name}: attach ${cname(a)} to…`, cards:crs, min:0, max:1, noneLabel:'Leave it'}); if (ids && ids[0] != null){ a.att = {pid:MYPID, id:ids[0]}; log(`attached ${cname(a)} to ${cname(crs.find(c => c.id === ids[0]))}`); } } commit(); return true; }
  // Doubling Cube
  if ((m = l.match(/^double the amount of each type of unspent mana you have$/))){ MANA.forEach(c => { if (S.pool[c]) S.pool[c] *= 2; }); log(`${ctx.name}: doubled their mana — ${poolText(S.pool)}`); commit(); return true; }
  // Reckless Endeavor
  if ((m = l.match(/^roll two d12 and choose one result$/))){ const a = 1 + Math.floor(Math.random() * 12), b = 1 + Math.floor(Math.random() * 12); log(`🎲 ${ctx.name}: rolled ${a} and ${b}`); const v = UI.dry ? 0 : await askChoice({title:`${ctx.name}: rolled ${a} and ${b} — which deals damage to each creature? (the other makes Treasures)`, options:[{label:`${a} damage, ${b} Treasures`, value:0}, {label:`${b} damage, ${a} Treasures`, value:1}]}); ctx.g23res = v === 1 ? [b, a] : [a, b]; return true; }
  if ((m = l.match(/^~ deals damage equal to that result to each creature$/)) && ctx.g23res){ const n = ctx.g23res[0]; S.bf.filter(c => !c.fd && isCreatureCard(c)).forEach(c => dealDamage({pid:MYPID, id:c.id, k:c.k}, n, ctx.k, null)); for (const [pid, st] of OPP) (st.bf || []).filter(b => b.k && !b.fd && /Creature/.test(info(b.k)?.t || '')).forEach(b => dealDamage({pid, id:b.id, k:b.k}, n, ctx.k, null)); commit(); return true; }
  if ((m = l.match(/^(?:then )?create a number of treasure tokens equal to the other result$/)) && ctx.g23res){ const n = ctx.g23res[1]; if (n) await createFromText(`Create ${n} Treasure tokens`, ctx); return true; }
  // Deadbridge Chant
  if ((m = l.match(/^mill (ten|eleven|twelve|thirteen|fifteen|twenty) cards$/))){ mill(wn(m[1]) || {ten:10, eleven:11, twelve:12, thirteen:13, fifteen:15, twenty:20}[m[1]]); return true; }
  if ((m = l.match(/^choose a card at random in your graveyard$/))){ ctx.g23rand = S.gy.length ? S.gy[Math.floor(Math.random() * S.gy.length)] : null; if (ctx.g23rand) log(`${ctx.name}: chose ${cname(ctx.g23rand)} at random`); return true; }
  if ((m = l.match(/^if it's a creature card, put it onto the battlefield$/)) && ctx.g23rand !== undefined){ const c = ctx.g23rand; if (c && S.gy.includes(c) && isCreatureCard(c)){ moveCard(c.id, 'bf'); ctx.g23rand = null; } return true; }
  if ((m = l.match(/^otherwise, put it into your hand$/)) && ctx.g23rand !== undefined){ const c = ctx.g23rand; if (c && S.gy.includes(c)) moveCard(c.id, 'hand'); commit(); return true; }
  // Selective Obliteration
  if ((m = l.match(/^each player chooses a color$/)) && /exile each permanent unless it's colorless or it's only the color its controller chose/.test(full)){ const mine = await g23eachMine('color', 0, ctx.name, MYPID); g23selOb(mine.d); const res = await g23askEach(opponents().map(p => p.pid), 'colorOb', 0, ctx.name); log(`${ctx.name}: colors chosen — ${[nameOf(MYPID) + ': ' + mine.d, ...res.map(r => nameOf(r.pid) + ': ' + (r.d || '?'))].join(', ')}`); ctx.g23sel = true; commit(); return true; }
  if (ctx.g23sel && /^(?:then )?exile each permanent unless it's colorless or it's only the color its controller chose$/.test(l)) return true;
  // Champions from Beyond
  if ((m = l.match(/^those creatures get \+(\d+)\/\+(\d+) until end of turn$/))){ S.bf.filter(c => c.atk && isCreatureCard(c)).forEach(c => { c.pu = [(c.pu || [0, 0])[0] + +m[1], (c.pu || [0, 0])[1] + +m[2]]; }); log(`${ctx.name}: attackers get +${m[1]}/+${m[2]}`); commit(); return true; }
  // Edric
  if ((m = l.match(/^its controller may draw a card$/))){ const pid = ctx.it && ctx.it.evPid; if (!pid) return true; if (pid === MYPID){ if (!UI.dry && await askYes(`${ctx.name}: draw a card?`, 'Draw', "Don't")) draw(1); } else sendRq(pid, 'r22mayDraw', 0, ctx.name); commit(); return true; }
  // Necromantic Selection
  if ((m = l.match(/^destroy all creatures$/)) && /return a creature card put into a graveyard this way to the battlefield under your control/.test(full)){ ctx.g23before = {me:S.bf.filter(c => isCreatureCard(c) && !c.tok).map(c => c.id), opp:[...OPP].map(([pid, st]) => ({pid, ks:(st.bf || []).filter(b => b.k && !b.tok && /Creature/.test(info(b.k)?.t || '')).map(b => b.k)}))}; return false; }
  if ((m = l.match(/^return a creature card put into a graveyard this way to the battlefield under your control$/)) && ctx.g23before){ const opts = S.gy.filter(c => ctx.g23before.me.includes(c.id)).map(c => ({label:`${cname(c)} (yours)`, value:'m:' + c.id}));
    ctx.g23before.opp.forEach(o => o.ks.forEach(k => opts.push({label:`${info(k)?.n} (${nameOf(o.pid)}'s)`, value:'o:' + o.pid + ':' + k})));
    if (!opts.length || UI.dry) return true; const v = opts.length === 1 ? opts[0].value : await askChoice({title:`${ctx.name}: return a creature card put into a graveyard this way`, options:opts}); if (!v) return true;
    if (v.startsWith('m:')){ const id = +v.slice(2); moveCard(id, 'bf'); const c = S.bf.find(b => b.id === id); if (c){ c.origK = c.k; c.k = g23derive(c.k, {addType:'Zombie', col:'B'}); } } else { const [, pid, ...kk] = v.split(':'); sendRq(pid, 'gytake', 0, ctx.name, {d:kk.join(':')}); }
    commit(); return true; }
  if (/^it's a black zombie in addition to its other colors and types$/.test(l) && ctx.g23before) return true;
  // Nissa's Pilgrimage
  if ((m = l.match(/^search your library for up to two basic forest cards, reveal those cards, and put one onto the battlefield tapped and the rest into your hand$/))){ const sm = S.gy.filter(c => /Instant|Sorcery/.test(info(c.k)?.t || '')).length >= 2; const n = sm ? 3 : 2;
    const pool = S.lib.filter(c => descOk(c.k, 'basic forest')); const ids = pool.length && !UI.dry ? await pickCards({title:`${ctx.name}: up to ${n} basic Forest cards`, cards:pool, min:0, max:Math.min(n, pool.length), noneLabel:'None'}) : [];
    (ids || []).forEach((id, i) => { if (i === 0){ moveCard(id, 'bf', {quiet:true}); const c = S.bf.find(b => b.id === id); if (c) c.tap = true; } else moveCard(id, 'hand', {quiet:true}); }); log(`${ctx.name}: found ${(ids || []).length} Forest${(ids || []).length === 1 ? '' : 's'}${sm ? ' (spell mastery)' : ''}`); ctx.g23np = true; commit(); return true; }
  if (ctx.g23np && /^if there are two or more instant and\/or sorcery cards in your graveyard, search your library for up to three basic forest cards instead of two$/.test(l)) return true;
  // Andúril
  if ((m = l.match(/^create two tapped 1\/1 white spirit creature tokens with flying$/)) && /if that creature is legendary, instead create two of those tokens that are tapped and attacking/.test(full)){ const a = g23src(ctx); const h = a && a.att && S.bf.find(b => b.id === a.att.id); const leg = h && /Legendary/.test(info(h.k)?.t || '');
    const before = new Set(S.bf.map(c => c.id)); await createFromText('Create two tapped 1/1 white Spirit creature tokens with flying', ctx); if (leg){ const atk = (h && h.atk) || (defOpts()[0] || {}).key || ''; S.bf.filter(c => !before.has(c.id) && c.tok).forEach(c => { c.atk = atk; }); log(`${ctx.name}: the Spirits are tapped and attacking`); } commit(); return true; }
  if (/^if that creature is legendary, instead create two of those tokens that are tapped and attacking$/.test(l)) return true;
  // All-Out Assault
  if ((m = l.match(/^when you next attack this turn, untap each creature you control$/))){ g23st().untapAtk = turnStr(); commit(); return true; }
  // Burning Inquiry
  if ((m = l.match(/^each player draws (three|two) cards$/)) && /each player draws (?:three|two) cards, then discards (?:three|two) cards at random/.test(full)){ const mm = full.match(/each player draws (\w+) cards, then discards (\w+) cards at random/); const a = wn(mm[1]) || 3, b = wn(mm[2]) || 3; draw(a); g23discRand(b, ctx.name); opponents().forEach(p => { sendRq(p.pid, 'draw', a, ctx.name); sendRq(p.pid, 'g23discRand', b, ctx.name); }); ctx.g23bi = true; commit(); return true; }
  if ((m = l.match(/^each player draws (three|two|\w+) cards, then discards (three|two|\w+) cards at random$/))){ const a = wn(m[1]) || 3, b = wn(m[2]) || 3; draw(a); g23discRand(b, ctx.name); opponents().forEach(p => { sendRq(p.pid, 'draw', a, ctx.name); sendRq(p.pid, 'g23discRand', b, ctx.name); }); ctx.g23bi = true; commit(); return true; }
  if (ctx.g23bi && /^discards (three|two|\w+) cards at random$/.test(l)) return true;
  // Kindred Summons
  if ((m = l.match(/^reveal cards from the top of your library until you reveal x creature cards of the chosen type, where x is the number of creatures you control of that type$/))){ const ty = ctx.ctype || (g23src(ctx) || {}).ctype || 'Elf'; const re = new RegExp('\\b' + ty + '\\b', 'i');
    const x = S.bf.filter(c => !c.fd && isCreatureCard(c) && (re.test(typeOf(c)) || kwOf(c, 'changeling'))).reduce((a, c) => a + (c.n || 1), 0); const hits = [], rest = [];
    while (S.lib.length && hits.length < x){ const c = S.lib.shift(); if (isCreatureCard(c) && (re.test(info(c.k)?.t || '') || /changeling/i.test(info(c.k)?.o || ''))) hits.push(c); else rest.push(c); }
    S.ex.push(...hits, ...rest); ctx.g23hits = hits; ctx.g23rest = rest; log(`${ctx.name}: revealed ${hits.length + rest.length} cards — ${hits.length} ${ty}${hits.length === 1 ? '' : 's'}`); return true; }
  if ((m = l.match(/^put those cards onto the battlefield$/)) && ctx.g23hits){ ctx.g23hits.forEach(c => { if (!S.ex.includes(c)) return; S.ex.splice(S.ex.indexOf(c), 1); S.lib.unshift(c); moveCard(c.id, 'bf'); }); commit(); return true; }
  if ((m = l.match(/^(?:then )?shuffle the rest of the revealed cards into your library$/)) && ctx.g23rest){ ctx.g23rest.forEach(c => { if (S.ex.includes(c)){ S.ex.splice(S.ex.indexOf(c), 1); S.lib.push(c); } }); shuffle(S.lib); commit(); return true; }
  // Currency Converter
  if ((m = l.match(/^(?:you may )?exile that card from your graveyard$/)) && /exiled with ~/.test(tname(String(info(ctx.k)?.o || ''), ctx.name || '').toLowerCase())){ const id = ctx.it && ctx.it.evId; const i = id != null ? S.gy.findIndex(c => c.id === id) : -1; if (i >= 0){ const c = S.gy[i]; moveCard(c.id, 'ex', {quiet:true}); c.g23by = ctx.srcId; log(`${ctx.name}: exiled ${cname(c)}`); } commit(); return true; }
  if ((m = l.match(/^put a card exiled with ~ into its owner's graveyard$/))){ const pool = S.ex.filter(c => c.g23by === ctx.srcId); ctx.g23cc = null; if (!pool.length) return true; const ids = pool.length === 1 || UI.dry ? [pool[0].id] : await pickCards({title:`${ctx.name}: put a card into its owner's graveyard`, cards:pool, min:1, max:1}); const c = S.ex.find(x => x.id === (ids || [])[0]); if (c){ c.g23by = null; moveCard(c.id, 'gy', {quiet:true}); ctx.g23cc = c; log(`${ctx.name}: put ${cname(c)} into the graveyard`); } commit(); return true; }
  if ((m = l.match(/^if it's a (land|nonland) card, (create .+)$/)) && ctx.g23cc !== undefined){ const c = ctx.g23cc; if (c && (m[1] === 'land') === isLand(c.k)) await createFromText(cap(s.slice(s.length - m[2].length)), ctx); return true; }
  // Bloodline Bidding
  if ((m = l.match(/^return all creature cards of the chosen type from your graveyard to the battlefield$/))){ const ty = ctx.ctype || (g23src(ctx) || {}).ctype; if (!ty) return true; const re = new RegExp('\\b' + ty + '\\b', 'i'); const cs = S.gy.filter(c => isCreatureCard(c) && (re.test(info(c.k)?.t || '') || /changeling/i.test(info(c.k)?.o || ''))); cs.forEach(c => moveCard(c.id, 'bf')); log(`${ctx.name}: returned ${cs.length} ${ty}${cs.length === 1 ? '' : 's'}`); commit(); return true; }
  // Alibou
  if ((m = l.match(/^~ deals x damage to any target and you scry x, where x is the number of tapped artifacts you control$/))){ const x = S.bf.filter(c => !c.fd && c.tap && /Artifact/.test(typeOf(c))).reduce((a, c) => a + (c.n || 1), 0); const t = g23tgt(ctx); if (t && x) dealDamage(t, x, ctx.k, g23src(ctx)); if (x) await doSentence(`Scry ${x}`, ctx); commit(); return true; }
  // Professor Onyx −8
  if ((m = l.match(/^each opponent may discard a card$/)) && /if they don't, they lose 3 life\. repeat this process six more times/.test(full.replace(/\n/g, ' '))){ for (let i = 0; i < 7; i++){ const res = await g23askEach(opponents().map(p => p.pid), 'discardOr|3', 1, `${ctx.name} (${i + 1}/7)`); if (UI.dry) break; } ctx.g23onyx = true; commit(); return true; }
  if (ctx.g23onyx && /^(if they don't, they lose 3 life|repeat this process six more times)$/.test(l)) return true;
  // Thieving Skydiver
  if ((m = l.match(/^if that artifact is an equipment, attach it to ~$/))){ const t = (ctx.lastT || [])[0]; if (t && t.pid !== MYPID && /Equipment/.test(info(t.k)?.t || '')){ (UI.g23pend ||= []).push({k:t.k, pid:t.pid, attachTo:ctx.srcId}); } else if (t && t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c && /Equipment/.test(info(c.k)?.t || '')) c.att = {pid:MYPID, id:ctx.srcId}; } commit(); return true; }
  // Emrakul, the World Anew
  if ((m = l.match(/^sacrifice all creatures you control$/))){ S.bf.filter(c => !c.fd && isCreatureCard(c)).forEach(c => { if (c.own) sendBack(c, 'gy'); else sacrificeOne(c); }); log(`${ctx.name}: sacrificed all creatures they control`); commit(); return true; }
  // Spiteful Visions
  if ((m = l.match(/^~ deals (\d+) damage to that player$/))){ const pid = ctx.it && ctx.it.evPid; if (pid) dealDamage({t:'player', pid}, +m[1], ctx.k, g23src(ctx)); commit(); return true; }
  // Mimic Vat
  if ((m = l.match(/^(?:you may )?exile that card$/)) && /return each other card exiled with ~ to its owner's graveyard/.test(full)){ const id = ctx.it && ctx.it.evId; const pid = (ctx.it && ctx.it.evPid) || MYPID; const k = ctx.it && ctx.it.evk; ctx.g23vat = null;
    if (pid === MYPID){ const c = S.gy.find(g => g.id === id); if (c){ moveCard(c.id, 'ex', {quiet:true}); ctx.g23vat = {pid, k:c.k, id:c.id}; } } else if (k){ sendRq(pid, 'g23gyEx', 0, ctx.name, {d:k}); ctx.g23vat = {pid, k}; }
    if (ctx.g23vat) log(`${ctx.name}: imprinted ${info(ctx.g23vat.k)?.n}`); return true; }
  if ((m = l.match(/^if you do, return each other card exiled with ~ to its owner's graveyard$/))){ const v = g23src(ctx); if (!v || !ctx.g23vat) return true; for (const o of v.g23imps || []){ if (o.pid === MYPID){ const c = S.ex.find(x => x.id === o.id); if (c) moveCard(c.id, 'gy', {quiet:true}); } else sendRq(o.pid, 'g23exGy', 0, ctx.name, {d:o.k}); } v.g23imps = [ctx.g23vat]; commit(); return true; }
  if ((m = l.match(/^create a token that's a copy of a card exiled with ~$/))){ const v = g23src(ctx); const im = v && (v.g23imps || [])[0]; if (!im){ log(`${ctx.name}: nothing exiled with it`); return true; } const tk = g23tokCopy(im.k, {}); ctx.lastCardId = tk.id; ctx.lastTok = [tk.id]; return true; }
  if ((m = l.match(/^it gains haste$/)) && ctx.lastCardId != null){ const c = S.bf.find(b => b.id === ctx.lastCardId); if (c){ c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; } commit(); return true; }
  // Druid of Purification
  if ((m = l.match(/^starting with you, each player may choose an artifact or enchantment you don't control$/))){ const cands = []; for (const [pid, st] of OPP) (st.bf || []).forEach(b => { if (b.k && !b.fd && /Artifact|Enchantment/.test(info(b.k)?.t || '')) cands.push({pid, id:b.id, k:b.k}); });
    ctx.g23chosen = []; if (!cands.length || UI.dry){ return true; } const list = cands.slice(0, 12); const cards = list.map((x, i) => ({id:-6000 - i, k:x.k}));
    const mine = await pickCards({title:`${ctx.name}: you may choose an artifact or enchantment you don't control`, cards, min:0, max:1, noneLabel:'None'}); if (mine && mine[0] != null) ctx.g23chosen.push(list[-6000 - mine[0]]);
    S.pile = {ref:rid(6), ks:list.map(x => x.k)}; const res = await g23askEach(opponents().map(p => p.pid), 'pile?', 0, ctx.name); S.pile = null; res.forEach(r => { if (r.n && r.d !== '') { const x = list[+r.d]; if (x) ctx.g23chosen.push(x); } });
    log(`${ctx.name}: chosen — ${ctx.g23chosen.map(x => info(x.k)?.n).join(', ') || 'nothing'}`); return true; }
  if ((m = l.match(/^destroy each permanent chosen this way$/)) && ctx.g23chosen){ const seen = new Set(); ctx.g23chosen.forEach(x => { const key = x.pid + ':' + x.id; if (seen.has(key)) return; seen.add(key); applyTo({pid:x.pid, id:x.id}, {op:'destroy', src:ctx.name}); }); commit(); return true; }
  // Animist's Awakening
  if ((m = l.match(/^reveal the top x cards of your library$/)) && /if there are two or more instant and\/or sorcery cards in your graveyard, untap those lands/.test(tname(String(info(ctx.k)?.o || ''), ctx.name || '').toLowerCase())){ const x = (ctx.it && ctx.it.x) || 0; const top = S.lib.splice(0, x); const lands = top.filter(c => isLand(c.k)); const rest = top.filter(c => !isLand(c.k));
    S.lib.unshift(...lands); lands.forEach(c => { moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(y => y.id === c.id); if (b) b.tap = true; }); shuffle(rest); S.lib.push(...rest);
    const sm = S.gy.filter(c => /Instant|Sorcery/.test(info(c.k)?.t || '')).length >= 2; if (sm) lands.forEach(c => { const b = S.bf.find(y => y.id === c.id); if (b) b.tap = false; });
    log(`${ctx.name}: put ${lands.length} land${lands.length === 1 ? '' : 's'} onto the battlefield${sm ? ' untapped (spell mastery)' : ' tapped'}`); ctx.g23aa = true; commit(); return true; }
  if (ctx.g23aa && /^(put all land cards from among them onto the battlefield tapped and the rest on the bottom of your library in a random order|if there are two or more instant and\/or sorcery cards in your graveyard, untap those lands)$/.test(l)) return true;
  // Aminatou's Augury
  if ((m = l.match(/^exile the top eight cards of your library$/)) && /for each nonland card type, you may cast a spell of that type from among the exiled cards without paying its mana cost/.test(full)){ const top = S.lib.splice(0, 8); S.ex.push(...top); ctx.g23exd = top; log(`${ctx.name}: exiled ${top.map(cname).join(', ')}`); return true; }
  if ((m = l.match(/^(?:you may )?put a land card from among them onto the battlefield$/)) && ctx.g23exd){ const lands = ctx.g23exd.filter(c => S.ex.includes(c) && isLand(c.k)); const ids = lands.length && !UI.dry ? await pickCards({title:`${ctx.name}: put a land onto the battlefield`, cards:lands, min:0, max:1, noneLabel:'None'}) : []; if (ids && ids[0] != null) moveCard(ids[0], 'bf'); commit(); return true; }
  if ((m = l.match(/^until end of turn, for each nonland card type, you may cast a spell of that type from among the exiled cards without paying its mana cost$/)) && ctx.g23exd){ if (UI.dry) return true; const used = new Set(); const TY = ['Artifact', 'Creature', 'Enchantment', 'Instant', 'Planeswalker', 'Sorcery', 'Battle', 'Kindred'];
    for (;;){ const pool = ctx.g23exd.filter(c => S.ex.includes(c) && !isLand(c.k) && TY.some(t => !used.has(t) && new RegExp('\\b' + t + '\\b').test(info(c.k)?.t || ''))); if (!pool.length) break; const ids = await pickCards({title:`${ctx.name}: cast a spell for free (one per card type: ${TY.filter(t => !used.has(t)).join(', ')})`, cards:pool, min:0, max:1, noneLabel:'Done'}); const c = ids && pool.find(x => x.id === ids[0]); if (!c) break;
      let ty = TY.filter(t => !used.has(t) && new RegExp('\\b' + t + '\\b').test(info(c.k)?.t || '')); let pick = ty[0]; if (ty.length > 1) pick = await askChoice({title:`${cname(c)}: use which card type?`, options:ty.map(t => ({label:t, value:t}))}) || ty[0]; used.add(pick); UI.afterCast = () => {}; await beginCast(c, 'ex', {free:true}); }
    return true; }
  // Armored Skyhunter
  if ((m = l.match(/^look at the top six cards of your library$/)) && /you may put an aura or equipment card from among them onto the battlefield/.test(full)){ const top = S.lib.slice(0, 6); const ok = top.filter(c => /Aura|Equipment/.test(info(c.k)?.t || ''));
    const ids = ok.length && !UI.dry ? await pickCards({title:`${ctx.name}: put an Aura or Equipment onto the battlefield`, cards:ok, min:0, max:1, noneLabel:'None'}) : []; const c = ids && ok.find(x => x.id === ids[0]);
    if (c){ moveCard(c.id, 'bf'); const b = S.bf.find(y => y.id === c.id); if (b && /Equipment/.test(info(b.k)?.t || '')){ const crs = S.bf.filter(x => !x.fd && isCreatureCard(x)); const t = crs.length ? await pickCards({title:`${ctx.name}: attach ${cname(b)} to a creature you control?`, cards:crs, min:0, max:1, noneLabel:"Don't"}) : []; if (t && t[0] != null){ b.att = {pid:MYPID, id:t[0]}; log(`attached ${cname(b)}`); } } }
    const rest = top.filter(x => x !== c && S.lib.includes(x)); rest.forEach(x => S.lib.splice(S.lib.indexOf(x), 1)); shuffle(rest); S.lib.push(...rest); ctx.looked = true; ctx.g23sky = true; commit(); return true; }
  if (ctx.g23sky && /^(you may put an aura or equipment card from among them onto the battlefield|if an equipment is put onto the battlefield this way, you may attach it to a creature you control|put the rest of those cards on the bottom of your library in a random order)/.test(l)) return true;
  // Puppeteer Clique
  if ((m = l.match(/^put target creature card from an opponent's graveyard onto the battlefield under your control$/))){ const t = g23tgt(ctx); if (t && t.pid !== MYPID && t.k){ (UI.g23pend ||= []).push({k:t.k, pid:t.pid, haste:/it gains haste/.test(full), exileEnd:/at the beginning of your next end step, exile it/.test(full)}); sendRq(t.pid, 'gytake', 0, ctx.name, {d:t.k}); log(`${ctx.name}: takes ${info(t.k)?.n} from ${nameOf(t.pid)}'s graveyard`); } ctx.g23pup = true; commit(); return true; }
  if (ctx.g23pup && /^(it gains haste|at the beginning of your next end step, exile it)$/.test(l)) return true;
  // Ugin's Labyrinth
  if ((m = l.match(/^(?:you may )?exile a colorless card with mana value 7 or greater from your hand$/))){ const me = g23src(ctx); const pool = S.hand.filter(c => !String(info(c.k)?.c || '').replace(/[^WUBRG]/g, '') && (info(c.k)?.mv || 0) >= 7 && !isLand(c.k)); const ids = pool.length && !UI.dry ? await pickCards({title:`${ctx.name}: exile a colorless card with mana value 7+`, cards:pool, min:0, max:1, noneLabel:"Don't"}) : [];
    if (ids && ids[0] != null){ moveCard(ids[0], 'ex', {quiet:true}); if (me) me.g23imp = ids[0]; log(`${ctx.name}: exiled ${cname(S.ex.find(c => c.id === ids[0]))}`); } commit(); return true; }
  if ((m = l.match(/^return the exiled card to its owner's hand$/))){ const me = g23src(ctx); const c = me && S.ex.find(x => x.id === me.g23imp); if (c){ moveCard(c.id, 'hand'); me.g23imp = null; } commit(); return true; }
  // Gilded Drake
  if ((m = l.match(/^exchange control of ~ and up to one target creature an opponent controls$/))){ const me = g23src(ctx); const t = g23tgt(ctx); ctx.g23ex = false; if (me && t && t.pid !== MYPID && S.bf.includes(me)){ sendRq(t.pid, 'steal', 0, ctx.name, {tid:t.id}); giveAway(me, t.pid, {}); ctx.g23ex = true; } return true; }
  if ((m = l.match(/^if you don't or can't make an exchange, sacrifice ~$/))){ if (!ctx.g23ex){ const me = g23src(ctx); if (me && S.bf.includes(me)) sacrificeOne(me); } commit(); return true; }
  if (/^this ability still resolves if its target becomes illegal$/.test(l)) return true;
  // Rionya
  if ((m = l.match(/^create x tokens that are copies of another target creature you control, where x is one plus the number of instant and sorcery spells you've cast this turn$/))){ const t = g23tgt(ctx); const x = 1 + (S.casts || []).filter(c => c.t === turnStr() && /Instant|Sorcery/.test(info(c.k)?.t || '')).length; ctx.lastTok = [];
    if (t && t.k) for (let i = 0; i < x; i++){ const tk = g23tokCopy(t.k, {}); ctx.lastTok.push(tk.id); } return true; }
  if ((m = l.match(/^they gain haste$/)) && ctx.lastTok){ ctx.lastTok.forEach(id => { const c = S.bf.find(b => b.id === id); if (c) c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; }); commit(); return true; }
  if ((m = l.match(/^exile them at the beginning of the next end step$/)) && ctx.lastTok){ ctx.lastTok.forEach(id => S.dly.push({id:rid(6), eff:'Exile it.', k:ctx.k, nm:ctx.name, srcId:id, op:'exile'})); commit(); return true; }
  // Counterbalance
  if ((m = l.match(/^if you do, counter that spell if it has the same mana value as the revealed card$/))){ const c = S.lib[0]; const k = ctx.it && ctx.it.evk; const pid = ctx.it && ctx.it.evPid; if (!c || !k) return true; const mv = info(k)?.mv || 0;
    if ((info(c.k)?.mv || 0) !== mv){ log(`${ctx.name}: revealed ${cname(c)} (${info(c.k)?.mv || 0}) — no match`); return true; }
    const it = stackAll().filter(x => x.k === k && x.pid === pid && x.kind === 'spell').pop(); if (it){ S.ctr.push({id:rid(8), sid:it.sid, un:0}); log(`${ctx.name}: revealed ${cname(c)} — countered ${it.nm}`); } commit(); return true; }
  // Eiganjo Castle
  if ((m = l.match(/^prevent the next (\d+) damage that would be dealt to target (?:legendary )?creature this turn$/))){ const t = g23tgt(ctx); if (!t) return true; if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c) c.g23prev = {n:+m[1], t:turnStr()}; } else sendRq(t.pid, 'g23prev', +m[1], ctx.name, {tid:t.id}); commit(); return true; }
  // Keen Duelist
  if ((m = l.match(/^you and target opponent each reveal the top card of your library$/))){ const t = g23tgt(ctx); const pid = t && t.pid !== MYPID ? t.pid : (opponents()[0] || {}).pid; const mine = S.lib[0];
    const [r] = pid ? await g23askEach([pid], 'duel', 0, ctx.name) : [{n:0}]; const myMv = mine ? info(mine.k)?.mv || 0 : 0; if (mine) log(`${ctx.name}: revealed ${cname(mine)}`);
    if (r && r.n) { S.life -= r.n; log(`lost ${r.n} life (${ctx.name}) → ${S.life}`); } if (pid && myMv) sendRq(pid, 'life', -myMv, ctx.name); if (mine){ S.lib.shift(); S.hand.push(mine); } ctx.g23duel = true; commit(); return true; }
  if (ctx.g23duel && /^(you each lose life equal to the mana value of the card revealed by the other player|you each put the card you revealed into your hand)$/.test(l)) return true;
  // Weapons Manufacturing / Roxanne: named artifact tokens with quoted abilities
  if ((m = l.match(/^create (a|a tapped) colorless artifact token named (\w+) with "when (?:this token|~) (leaves the battlefield|enters), it deals (\d+) damage to any target\.?"(?: and "\{t\}: add one mana of any color\.?")?$/))){ const nm = cap(m[2]); const o = `When this token ${m[3]}, it deals ${m[4]} damage to any target.` + (/add one mana of any color/.test(l) ? '\n{T}: Add one mana of any color.' : '');
    const k0 = customToken(nm, '', ''); const k = k0 + '|g23' + norm(o).slice(0, 20); if (!DICT.has(k)) DICT.set(k, {...DICT.get(k0), k, n:nm, t:`Token Artifact — ${nm}`, p:'', o});
    createToken(k, tokenMult(k), null, {tapped:/tapped/.test(m[1])}); log(`${ctx.name}: created a ${nm} token`); commit(); return true; }
  // mana triggers done when the permanent is tapped (engine12 / engine21c / above): the effect line itself
  if ((m = l.match(/^add an additional (\{[wubrgc]\})$/)) && /^whenever you tap an? (?:swamp|island|forest|mountain|plains|creature|artifact|nonland permanent|land|permanent) for mana, add an additional \{[wubrgc]\}\.?$/im.test(tname(String(info(ctx.k)?.o || ''), ctx.name || ''))) return true;
  if (/^add an additional one mana of any color$/.test(l) && /^whenever you tap a land for mana while you're the monarch/im.test(String(info(ctx.k)?.o || ''))) return true;
  if (/^its controller adds an additional \{g\}\{g\}$/.test(l) && /^whenever enchanted (?:land|forest) is tapped for mana/im.test(String(info(ctx.k)?.o || ''))) return true;
  if (/^(?:that|target) player adds one mana of any type that land produced$/.test(l) && /whenever a player taps a land for mana, that player adds one mana of any type that land produced/i.test(String(info(ctx.k)?.o || ''))) return true;
  // Ignite the Future (flashback)
  if (/^(?:you may )?play cards this way without paying their mana costs$/.test(l)){ S.ex.filter(c => c.mayPlay && c.mayPlay.src === ctx.name && c.mayPlay.t === turnStr()).forEach(c => { c.mayPlay.free = true; }); log(`${ctx.name}: those cards may be played without paying their mana costs`); commit(); return true; }
  // Chandra's Incinerator
  if ((m = l.match(/^~ deals that much damage to target creature or planeswalker that player controls$/))){ const t = g23tgt(ctx); const n = (ctx.it && ctx.it.evN) || 0; const pid = ctx.it && ctx.it.evDp; if (t && n && (!pid || t.pid === pid || UI.dry)) dealDamage(t, n, ctx.k, g23src(ctx)); commit(); return true; }
  // Leyline Tyrant
  if ((m = l.match(/^(?:you may )?pay any amount of \{r\}$/))){ const lands = S.bf.filter(c => !c.fd && !c.tap && manaAbs(c).some(ab => ab.tapOnly && ab.outs.some(o => o.length === 1 && o[0] === 'R'))).length; const max = (S.pool.R || 0) + lands;
    const n = UI.dry ? 1 : await askChoice({title:`Leyline Tyrant: pay how much {R}? (up to ${max})`, options:[...Array(max + 1).keys()].map(i => ({label:String(i), value:i}))}); ctx.g23paid = 0; if (!n) return true;
    const plan = payPlan(parseCost('{R}'.repeat(n)), S.pool); if (plan.err){ toast(`Can't pay ${n} {R}`); return true; } S.pool = plan.pool; ctx.g23paid = n; log(`${ctx.name}: paid ${'{R}'.repeat(n)}`); commit(); return true; }
  if ((m = l.match(/^when you do, (?:it|~) deals that much damage to any target$/))){ const n = ctx.g23paid || 0; if (!n) return true; const tg = UI.dry ? null : await chooseTargets('deals damage to any target', {pid:MYPID, col:'R', types:'Creature', id:null}, ctx.name); const t = tg && tg[0] && tg[0][0]; if (t) dealDamage(t, n, ctx.k, null); commit(); return true; }
  // "draw cards equal to …" with numbers the engine knows
  if ((m = l.match(/^(?:you )?draw cards equal to (the sacrificed creature's power|its power|the greatest mana value among artifacts you control|the greatest power among creatures you control|the power of target creature you control|your devotion to (?:white|blue|black|red|green))(?:, then you gain life equal to its toughness)?$/))){
    const p = m[1]; let n = 0, tough = 0;
    if (/sacrificed/.test(p)){ const lk = (UI.g23lkiP || {})[UI.g23lastSacId] || null; n = lk ? lk[0] : (UI.dry ? 2 : parseInt(info(UI.g23lastSac)?.p) || 0); tough = lk ? lk[1] : (parseInt(String(info(UI.g23lastSac)?.p || '').split('/')[1]) || 0); }
    else if (p === 'its power'){ const id = ctx.it && ctx.it.evId != null ? ctx.it.evId : ctx.srcId; const c = S.bf.find(b => b.id === id); n = c ? g23pow(c) : ((UI.g23lkiP || {})[id] || [0])[0]; }
    else if (/artifacts/.test(p)) n = Math.max(0, ...S.bf.filter(c => !c.fd && /Artifact/.test(typeOf(c))).map(c => info(c.k)?.mv || 0));
    else if (/greatest power/.test(p)) n = Math.max(0, ...S.bf.filter(c => !c.fd && isCreatureCard(c)).map(c => g23pow(c)));
    else if (/target creature/.test(p)){ const t = g23tgt(ctx); const c = t && S.bf.find(b => b.id === t.id); n = c ? g23pow(c) : 0; }
    else { const col = p.match(/devotion to (\w+)/)[1]; n = typeof devotion === 'function' ? devotion([col]) : (countOf(p, ctx) || 0); }
    n = Math.max(0, n || 0); if (n) draw(n); log(`${ctx.name}: drew ${n}`);
    if (/gain life equal to its toughness/.test(l) && tough > 0 && gainLife(tough, ctx.name)) log(`gained ${tough} life → ${S.life}`);
    commit(); return true; }
  // Hell to Pay: Treasures for the excess damage
  if ((m = l.match(/^~ deals x damage to target creature$/)) && /create a number of tapped treasure tokens equal to the amount of excess damage dealt to that creature this way/.test(full)){ const x = (ctx.it && ctx.it.x) || 0; const t = g23tgt(ctx); ctx.g23excess = 0; if (!t) return true;
    const c = boardOf(t.pid).find(b => b.id === t.id); const st = statsAny(t); if (st && c){ const left = Math.max(0, st[1] - (c.dmg || 0)); ctx.g23excess = Math.max(0, x - left); } dealDamage(t, x, ctx.k, null); commit(); return true; }
  if ((m = l.match(/^create a number of tapped treasure tokens equal to the amount of excess damage dealt to that creature this way$/)) && ctx.g23excess !== undefined){ const n = ctx.g23excess; if (n) await createFromText(`Create ${n} tapped Treasure tokens`, ctx); return true; }
  if (/^~ fights up to one other target creature$/.test(l)){ await doSentence('~ fights up to one another target creature', ctx); return true; }
  // Transpose & co.
  if ((m = l.match(/^if (?:this spell|~) was cast from your hand, (.+)$/))){ const from = ctx.it && ctx.it.from; if (from === 'hand' || (UI.dry && !from)) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); else log(`${ctx.name}: not cast from hand`); return true; }
  if ((m = l.match(/^if (?:this spell|~) was cast from a graveyard, (.+)$/))){ const from = ctx.it && ctx.it.from; if (from === 'gy' || UI.dry) await doSentence(cap(s.slice(s.length - m[1].length)), {...ctx, g23fromGy:true}); else log(`${ctx.name}: not cast from a graveyard`); return true; }
  // Court of Ambition
  if ((m = l.match(/^each opponent loses (\d+) life unless they discard (a|two) cards?$/)) && /if you're the monarch, instead each opponent loses (\d+) life unless they discard two cards/.test(full)){
    const mon = holderOf('mon') === MYPID; const mm = full.match(/if you're the monarch, instead each opponent loses (\d+) life unless they discard two cards/);
    const L = mon ? +mm[1] : +m[1]; const n = mon ? 2 : (wn(m[2]) || 1);
    for (const p of opponents()) sendRq(p.pid, 'g23each', n, ctx.name, {ref:rid(6), d:`discardOr|${L}`});
    log(`${ctx.name}: each opponent loses ${L} life unless they discard ${n === 1 ? 'a card' : 'two cards'}`); ctx.g23court = true; commit(); return true; }
  if (/^if you're the monarch, instead each opponent loses \d+ life unless they discard two cards$/.test(l) && ctx.g23court) return true;
  // Powerbalance
  if ((m = l.match(/^if you do, you may cast that card without paying its mana cost if the two spells have the same mana value$/))){
    const c = S.lib[0]; const mv = info(ctx.it && ctx.it.evk)?.mv; if (!c || mv == null) return true;
    if (!isLand(c.k) && (info(c.k)?.mv || 0) === mv && !UI.dry && await askYes(`${ctx.name}: cast ${cname(c)} without paying its mana cost?`)){ await beginCast(c, 'lib', {free:true}); }
    else log(`${ctx.name}: ${cname(c)} — mana value ${info(c.k)?.mv || 0} vs ${mv}`); return true; }
  return false;
}
// a token copy of card key k
function g23tokCopy(k, o = {}){
  const tk = {id:S.nid++, k, tok:true, copy:true, n:1, sk:true}; if (o.haste) tk.ekw = ['haste']; if (o.tapped) tk.tap = true; if (o.atk) tk.atk = o.atk;
  place(tk); S.bf.push(tk); log(`created a token copy of ${info(k)?.n}${o.tapped ? ' tapped' : ''}${o.atk ? ' and attacking' : ''}`); emit({type:'enter', k, id:tk.id, tok:1}); commit(); return tk;
}
// a derived card face: "except it's a 1/1 … in addition to its other types and has …"
function g23derive(k, o){
  const a = info(k); if (!a) return k; const key = k + '|g23|' + norm(JSON.stringify(o)).slice(0, 40); if (DICT.has(key)) return key;
  let t = String(a.t || ''); if (o.addType){ t = /—/.test(t) ? t + ' ' + o.addType : t + ' — ' + o.addType; } if (o.noLegend) t = t.replace(/\bLegendary\s+/, '');
  const oo = [o.kws && o.kws.length ? o.kws.join(', ') : '', a.o || '', o.extra || ''].filter(Boolean).join('\n');
  DICT.set(key, {...a, k:key, p:o.pt || a.p, t, o:oo, c:o.col ? [...new Set(String(a.c || '').split('').concat(o.col.split('')))].join('') : a.c, back:null, n:a.n}); return key;
}
// exile permanents I control and return them (flicker)
async function g23flicker(cards, ctx, o = {}){
  const back = [];
  for (const c0 of cards){ const c = single(c0); const nm = cname(c); if (c.tok){ moveCard(c.id, 'ex', {quiet:true}); log(`${nm} (token) was exiled and is gone`); continue; } if (c.own){ sendBack(c, 'bf'); continue; } moveCard(c.id, 'ex', {quiet:true}); back.push(c); }
  for (const c of back){ const i = S.ex.indexOf(c); if (i < 0) continue; moveCard(c.id, 'bf', {quiet:true}); if (o.cp && isCreatureCard(c)) modCounters(c, 'cp', o.cp); }
  if (back.length) log(`${ctx.name}: exiled and returned ${back.map(cname).join(', ')}`); commit();
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound23GPre(s, l, ctx)) return; return ds(s0, ctx); };
}
