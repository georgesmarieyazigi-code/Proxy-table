/* ===================== Rules engine — round 10: the 7,000 most-played Commander cards ===================== */
// Built from a mass check of the top 7,000 cards by EDHREC rank (Scryfall, 2 Nov 2026). Fixes the most common gaps and
// the gaps on the most-played cards: “its controller creates”, tutors to the top, “unless that player pays”, devotion,
// attack taxes, opponents' creatures entering tapped, Seedborn Muse, cumulative upkeep, hideaway, riot, self-exiling
// spells, commander-choice modes (“choose both instead”), burden and other named counters, life lost this way, and more.

RQ_OPS.push('tokText', 'payAsk', 'payAns');

/* ---------- Text rewrites before sentences are split ---------- */
{
  const re = runEffects;
  runEffects = async function(txt, ctx){
    let t = String(txt || '');
    t = t.replace(/(search your library for [^.]*?card)s?, (?:reveal it, )?then shuffle and put (?:that|the) card on top\b/gi, '$1 to put on top of your library');
    t = t.replace(/^(Choose one) ?\. ?If you control a commander as you cast [^,]+, you may choose both instead\.?\s*\n/im, (w, a) => (ctx && ctx.it && cmdControlled() ? 'Choose one or both —\n' : 'Choose one —\n'));
    t = t.replace(/^Choose one\.\s*\n(?=•)/im, 'Choose one —\n');
    return re(t, ctx);
  };
  const pm = parseModes;
  parseModes = function(txt){ let t = String(txt || '').replace(/^(Choose one) ?\. ?If you control a commander as you cast [^,]+, you may choose both instead\.?\s*\n/im, () => (S && cmdControlled() ? 'Choose one or both —\n' : 'Choose one —\n')).replace(/^Choose one\.\s*\n(?=•)/im, 'Choose one —\n'); return pm(t); };
}
// the creature type chosen as the permanent entered is stored on the card (c.ctype); an ability's context doesn't carry it
function r10ChosenType(ctx, c){ return (ctx && ctx.ctype) || (c && c.ctype) || (UI.dry ? 'Elf' : ''); }
function cmdControlled(){ return !!(S && S.bf.some(c => c.cmd && !c.fd)); }

/* ---------- Counting: devotion, named counters, chosen type ---------- */
{
  const co = countOf;
  countOf = function(phrase, ctx){
    const p = String(phrase || '').toLowerCase().trim().replace(/\.$/, '').replace(/^the number of /, ''); let m;
    if ((m = p.match(/^your devotion to (white|blue|black|red|green)(?: and (white|blue|black|red|green))?$/))) return devotion([m[1], m[2]].filter(Boolean));
    if ((m = p.match(/^(\w+) counters on (?:~|it)$/)) && !/^(\+1\/\+1|-1\/-1|loyalty|lore)$/.test(m[1])){ const c = ctx && srcCardOf(ctx); return c ? ((c.nc || {})[m[1]] || 0) : 0; }
    if ((m = p.match(/^creatures you control with (?:a|one or more) \+1\/\+1 counters? on (?:it|them)$/))) return S.bf.filter(c => isCreatureCard(c) && (c.cp || 0) > 0).length;
    if (/^cards? in target opponent's hand$/.test(p) || /^cards? in that player's hand$/.test(p)){ const t = ctx && ((ctx.lastT || [])[0]); const pid = (t && t.pid) || (ctx && ctx.it && (ctx.it.evDp || ctx.it.evPid)); const s = pid && OPP.get(pid); return s ? (s.hc ?? (s.hand || []).length ?? 0) : 0; }
    if (/^the greatest power among creatures you control$/.test(p)) return Math.max(0, ...S.bf.filter(c => isCreatureCard(c) && !c.fd).map(c => stats(c)[0]));
    if (/^colors? among permanents you control$/.test(p)){ const cols = new Set(); S.bf.forEach(c => { if (!c.fd) (info(c.k)?.c || '').split('').forEach(x => /[WUBRG]/.test(x) && cols.add(x)); }); return cols.size; }
    if (/^life lost this way$/.test(p)) return ctx && ctx.lostSum || 0;
    return co(phrase, ctx);
  };
}
function devotion(cols){
  const sym = {white:'W', blue:'U', black:'B', red:'R', green:'G'}; const want = cols.map(c => sym[c]); let n = 0;
  for (const c of S.bf){ if (c.fd || !c.k) continue; const m = info(c.k)?.m || ''; for (const s of m.match(/\{[^}]+\}/g) || []) if (want.some(w => s.includes(w))) n++; }
  return n;
}

/* ---------- Opponents create tokens / pay mana when asked ---------- */
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'tokText'){ (async () => { await createFromText('Create ' + String(r.d || ''), {name:r.src, k:null, it:{}}); commit(); })(); return; }
    if (r.op === 'payAsk'){ (async () => { const cost = String(r.d || '{1}'); const plan = payPlan(parseCost(cost), S.pool);
        const v = await askChoice({title:`${r.src}: pay ${cost}?${plan.err ? ' (tap mana first — not enough in your pool)' : ''}`, options:[{label:`Pay ${cost}`, value:'pay', disabled:!!plan.err}, {label:'Don\'t pay', value:'no'}]});
        let paid = 0; if (v === 'pay'){ const p2 = payPlan(parseCost(cost), S.pool); if (!p2.err){ S.pool = p2.pool; paid = 1; log(`paid ${cost} (${r.src})`); } }
        if (!paid) log(`didn't pay ${cost} (${r.src})`); sendRq(from, 'payAns', paid, r.src, {ref:r.ref}); commit(); })(); return; }
    if (r.op === 'payAns'){ UI.payAns = UI.payAns || {}; UI.payAns[r.ref] = {paid:!!r.n}; return; }
    return ao(r, from);
  };
}
async function askOpponentPay(pid, cost, src){
  if (UI.dry) return false; if (!pid || pid === MYPID) return false;
  const ref = rid(6); UI.payAns = UI.payAns || {}; sendRq(pid, 'payAsk', 0, src, {ref, d:cost}); commit(); toast(`Waiting for ${nameOf(pid)} to decide whether to pay ${cost}…`);
  const a = await waitUntil(() => UI.payAns[ref], 60000); return !!(a && a.paid);
}
function ctrlCreate(t, tokText, ctx){ if (!t) return; if (t.pid === MYPID || !t.pid) return createFromText('Create ' + tokText, ctx); sendRq(t.pid, 'tokText', 0, ctx.name, {d:tokText}); log(`${nameOf(t.pid)} creates ${tokText} (${ctx.name})`); }

/* ---------- Effects ---------- */
async function doRound10Pre(s, l, ctx){
  let m; const src = () => srcCardOf(ctx); const say = t => doSentence(cap(t), ctx);
  if (/^then /.test(l)){ const r = await doRound10Pre(s.slice(5), l.slice(5), ctx); if (r) return true; }
  // the controller of what you just hit gets something
  if ((m = l.match(/^(?:its|that creature's|that permanent's|that spell's) controller creates (.+)$/))){ const t = (ctx.lastT || [])[0] || (ctx.lastTgt); if (t) await ctrlCreate(t, s.slice(s.length - m[1].length), ctx); return true; }
  if ((m = l.match(/^(?:its|that creature's|that spell's) controller (draws|loses|gains|mills) ((?:a|an|one|two|three|four|five|\d+) (?:cards?|life))$/))){ const t = (ctx.lastT || [])[0]; const pid = t && t.pid; if (!pid) return true; const v = {draws:'draws', loses:'loses', gains:'gains', mills:'mills'}[m[1]];
    if (pid === MYPID) await say(`you ${v.replace(/s$/, '')} ${m[2]}`); else { const n = wn((m[2].match(/^(a|an|one|two|three|four|five|\d+)/) || [])[1] || '1') || 1; const op = {draws:'draw', mills:'mill', loses:'life', gains:'life'}[m[1]]; sendRq(pid, op, op === 'life' ? (m[1] === 'loses' ? -n : n) : n, ctx.name); log(`${nameOf(pid)} ${m[1]} ${m[2]}`); } return true; }
  // tutors to the top (Vampiric, Mystical, Enlightened, Worldly)
  if ((m = l.match(/^search your library for (?:an? )?(.*?)\s*card to put on top of your library$/))){ const d = m[1].trim(); const legal = S.lib.filter(c => !d || descOk(c.k, d)); const ids = await pickCards({title:`${ctx.name}: search for ${d ? 'a ' + d : 'any'} card to put on top`, cards:legal, min:0, max:1, noneLabel:'Find nothing'}); emit({type:'search', cnt:1}); const c = ids && ids[0] && S.lib.find(x => x.id === ids[0]); if (c) S.lib.splice(S.lib.indexOf(c), 1); shuffleLib(); if (c){ S.lib.unshift(c); log(`put a card on top of their library (${ctx.name})`); } commit(); return true; }
  // “unless that player pays” (Rhystic Study, Mystic Remora, Esper Sentinel, Smothering Tithe)
  if ((m = l.match(/^(?:you may )?(draw a card|create a treasure token|you draw a card) unless (target player|that player|they|its controller) pays? (\{[^}]+\}|x)(?:, where x is (.+))?$/))){
    const pid = (/^target/.test(m[2]) ? ((ctx.tgts ? nextTargets(ctx) : [])[0] || {}).pid : null) || (ctx.it && (ctx.it.evPid || ctx.it.evDp));
    let cost = m[3]; if (cost === 'x'){ const n = countOf(m[4] || '', ctx) ?? 1; cost = `{${n}}`; } cost = cost.toUpperCase();
    if (/^you may /.test(l) && !UI.dry && !(await askYes(`${ctx.name}: ${m[1]} unless ${nameOf(pid)} pays ${cost}?`))) return true;
    const paid = await askOpponentPay(pid, cost, ctx.name); if (!paid) await say(m[1].replace(/^you /, '')); else log(`${nameOf(pid)} paid ${cost} — ${ctx.name} does nothing`); return true; }
  if ((m = l.match(/^(target player|that player) may pay (\{[^}]+\})$/))){ const pid = (/^target/.test(m[1]) ? ((ctx.tgts ? nextTargets(ctx) : [])[0] || {}).pid : null) || (ctx.it && (ctx.it.evPid || ctx.it.evDp)); ctx.oppPaid = await askOpponentPay(pid, m[2].toUpperCase(), ctx.name); return true; }
  if ((m = l.match(/^if (?:the|that) player doesn't, (.+)$/)) || (m = l.match(/^if they don't, (.+)$/)) && ctx.oppPaid !== undefined){ if (!ctx.oppPaid) await say(s.slice(s.length - m[1].length)); return true; }
  // life: “lose life equal to its mana value”, “life lost this way”, devotion drain
  if ((m = l.match(/^(you|target player|that player) loses? life equal to (?:that card's|that permanent's|its|the exiled card's|that spell's) mana value$/))){ const t = (ctx.lastT || [])[0]; const k = (t && t.k) || (ctx.lastExC && ctx.lastExC.k) || (ctx.lastRev && ctx.lastRev.k); const n = ctx.lastMV ?? (k ? info(k)?.mv || 0 : 0); if (m[1] === 'you'){ S.life -= n; log(`lost ${n} life (${ctx.name})`); } else if (t && t.pid) loseLife(t.pid, n, ctx.name); commit(); return true; }
  if ((m = l.match(/^each opponent loses (\d+|x) life(?:, where x is (.+))?$/)) && /life lost this way/.test(String(ctx.full || '').toLowerCase())){ const n = m[1] === 'x' ? (countOf(m[2] || '', ctx) || 0) : +m[1]; const opps = opponents(); opps.forEach(p => loseLife(p.pid, n, ctx.name)); ctx.lostSum = n * opps.length; return true; }
  if ((m = l.match(/^you gain life equal to the life lost this way$/))){ if (ctx.lostSum) gainLife(ctx.lostSum, ctx.name); commit(); return true; }
  if ((m = l.match(/^(?:target player|you) draws? (two|three|a|one) cards? and loses? (\d+) life$/))){ const t = /^target/.test(l) ? ((ctx.tgts ? nextTargets(ctx) : [])[0]) : null; const n = wn(m[1]) || 1; if (!t || t.pid === MYPID){ draw(n); S.life -= +m[2]; } else { sendRq(t.pid, 'draw', n, ctx.name); sendRq(t.pid, 'life', -m[2], ctx.name); } commit(); return true; }
  // mass -N/-N and pumps with a filter
  if ((m = l.match(/^all creatures get ([+-]\d+|-x)\/([+-]\d+|-x) until end of turn$/))){ let p = m[1], t = m[2]; const x = ctx.it && ctx.it.x || 0; p = p === '-x' ? -x : +p; t = t === '-x' ? -x : +t;
    S.bf.filter(c => isCreatureCard(c) && !c.fd).forEach(c => { c.pu = [(c.pu ? c.pu[0] : 0) + p, (c.pu ? c.pu[1] : 0) + t]; }); for (const [pid, st] of OPP) (st.bf || []).forEach(c => { if (c.k && isCreatureCard(c)) applyTo({t:'card', pid, id:c.id, k:c.k}, {op:'pump', src:ctx.name, f:{p, t}}); });
    log(`${ctx.name}: all creatures get ${p >= 0 ? '+' : ''}${p}/${t >= 0 ? '+' : ''}${t}`); commit(); return true; }
  if ((m = l.match(/^(non-?\w+ creatures|(?!creatures)\w+ creatures|creatures) you control get \+(\d+)\/\+(\d+)(?: and gain ([a-z ,]+))? until end of turn$/))){ const d = m[1].replace(/ creatures$/, '').replace(/^creatures$/, ''); const kws = m[4] ? m[4].split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim()) : [];
    S.bf.filter(c => isCreatureCard(c) && !c.fd && (!d || descOk(c.k, d + ' creature', {tok:c.tok}))).forEach(c => { c.pu = [(c.pu ? c.pu[0] : 0) + +m[2], (c.pu ? c.pu[1] : 0) + +m[3]]; if (kws.length) c.ekw = [...new Set([...(c.ekw || []), ...kws])]; }); log(`${ctx.name}: ${m[1]} get +${m[2]}/+${m[3]}${kws.length ? ' and ' + kws.join(', ') : ''}`); commit(); return true; }
  if ((m = l.match(/^creatures you control gain (.+?) until end of turn$/))){ const kws = m[1].replace(/protection from each color/, 'protection').split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim()); S.bf.filter(c => isCreatureCard(c) && !c.fd).forEach(c => { c.ekw = [...new Set([...(c.ekw || []), ...kws])]; }); log(`${ctx.name}: creatures gain ${kws.join(', ')}`); commit(); return true; }
  if ((m = l.match(/^those creatures gain (.+?) until end of turn$/))){ const kws = m[1].split(/,\s*(?:and\s+)?|\s+and\s+/); (ctx.those || []).forEach(c => { c.ekw = [...new Set([...(c.ekw || []), ...kws])]; }); commit(); return true; }
  // conditions on what you control
  if ((m = l.match(/^(?:then )?if you control (an?|four or more|three or more|two or more|five or more|seven or more|\w+ or more) (.+?), (.+)$/))){
    const need = /^an?$/.test(m[1]) ? 1 : wn(m[1].split(' ')[0]) || 1; let d = m[2]; let n;
    const pw = d.match(/^creature with power (\d+) or greater$/); if (pw) n = S.bf.filter(c => isCreatureCard(c) && stats(c)[0] >= +pw[1]).length;
    else if (/^commander$/.test(d)) n = S.bf.filter(c => c.cmd).length;
    else n = countOf(d + ' you control', ctx);
    if (n == null) return false; ctx.condResult = n >= need; if (n >= need) await say(s.slice(s.length - m[3].length)); else log(`${ctx.name}: you don't control ${m[1]} ${d}`); return true; }
  if ((m = l.match(/^untap that land$/)) && ctx.lastT && ctx.lastT.length){ ctx.lastT.forEach(t => { const c = S.bf.find(x => x.id === t.id); if (c) c.tap = false; }); commit(); return true; }
  if ((m = l.match(/^untap up to (one|two|three|four|five) (lands|target lands|target permanents|permanents|creatures)$/))){ const n = wn(m[1]); const d = /land/.test(m[2]) ? c => isLand(c.k) : /creature/.test(m[2]) ? c => isCreatureCard(c) : () => true; const list = S.bf.filter(c => (c.tap || c.tn) && d(c)); if (!list.length) return true; const ids = list.length <= n ? list.map(c => c.id) : await pickCards({title:`${ctx.name}: untap up to ${n}`, cards:list, min:0, max:n}); (ids || []).forEach(id => { const c = S.bf.find(x => x.id === id); if (c){ c.tap = false; c.tn = 0; } }); log(`${ctx.name}: untapped ${(ids || []).length}`); commit(); return true; }
  // graveyard returns
  if ((m = l.match(/^(?:you may )?return (target|up to (?:one|two|three)) cards? from your graveyard to your hand$/))){ const ts = []; let t; while (ctx.tgts && (t = nextTargets(ctx)[0])) ts.push(t);
    if (!ts.length && !UI.dry && S.gy.length){ const n = /two/.test(m[1]) ? 2 : /three/.test(m[1]) ? 3 : 1; const ids = await pickCards({title:`${ctx.name}: return ${n === 1 ? 'a card' : 'up to ' + n + ' cards'} to your hand`, cards:S.gy.slice(), min:0, max:n}); (ids || []).forEach(id => ts.push({id, pid:MYPID})); }
    ts.forEach(t => { if (t.pid === MYPID && find(t.id)[0] === 'gy') moveCard(t.id, 'hand'); }); commit(); return true; }
  if ((m = l.match(/^put target (.+?) card from your graveyard on top of your library$/))){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t && find(t.id)[0] === 'gy'){ const c = find(t.id)[2]; S.gy.splice(S.gy.indexOf(c), 1); S.lib.unshift(c); log(`put ${cname(c)} on top of their library`); commit(); } return true; }
  if ((m = l.match(/^exile (target player's|each opponent's|all|target opponent's) graveyards?$/))){ if (m[1] === 'all'){ S.gy.slice().forEach(c => moveCard(c.id, 'ex')); for (const p of opponents()) sendRq(p.pid, 'exGy', 0, ctx.name); }
    else { const t = /target/.test(m[1]) ? (ctx.tgts ? nextTargets(ctx) : [])[0] : null; const pids = t ? [t.pid] : opponents().map(p => p.pid); pids.forEach(pid => { if (pid === MYPID) S.gy.slice().forEach(c => moveCard(c.id, 'ex')); else sendRq(pid, 'exGy', 0, ctx.name); }); }
    log(`${ctx.name}: exiled ${m[1]} graveyard${m[1] === 'all' ? 's' : ''}`); commit(); return true; }
  if ((m = l.match(/^exile target card from a graveyard$/))){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (!t) return true; if (t.pid === MYPID) moveCard(t.id, 'ex'); else sendRq(t.pid, 'gytake', 0, ctx.name, {d:t.k, ex:1}); ctx.lastT = [t]; ctx.lastExGy = t; commit(); return true; }
  // command zone
  if ((m = l.match(/^put your commander into your hand from the command zone$/))){ const c = S.cz.find(x => x.cmd) || S.cz[0]; if (c){ S.cz.splice(S.cz.indexOf(c), 1); S.hand.push(c); log(`put ${cname(c)} into their hand from the command zone`); commit(); } return true; }
  // named counters on ~ (The One Ring's burden, etc.)
  if ((m = l.match(/^put (an?|one|two|three|\d+) (\w+) counters? on ~$/)) && !/^(\+1\/\+1|-1\/-1|loyalty|lore)$/.test(m[2])){ const c = src(); if (c) addNamed(c, m[2], wn(m[1]) || 1); commit(); return true; }
  if ((m = l.match(/^(you lose|draw) (?:1 life|a card) for each (\w+) counter on ~$/))){ const c = src(); const n = c ? ((c.nc || {})[m[2]] || 0) : 0; if (m[1] === 'draw'){ if (n) draw(n); } else { S.life -= n; log(`lost ${n} life (${ctx.name})`); } commit(); return true; }
  if ((m = l.match(/^put a loyalty counter on ~$/))){ const c = src(); if (c){ c.co = (c.co || 0) + 1; commit(); } return true; }
  // windfalls
  if ((m = l.match(/^each player discards their hand, then draws (seven|that many|\w+) cards$/)) || (m = l.match(/^each player discards their hand$/))){ const n0 = S.hand.length; UI.discarding = []; S.hand.slice().forEach(c => moveCard(c.id, 'gy')); UI.discarding = null; opponents().forEach(p => sendRq(p.pid, 'discard', 99, ctx.name)); ctx.discMax = Math.max(n0, ...opponents().map(p => (p.s && (p.s.hc ?? (p.s.hand || []).length)) || 0)); ctx.discMine = n0;
    if (m[1]){ const n = m[1] === 'that many' ? n0 : wn(m[1]) || 7; draw(n); opponents().forEach(p => sendRq(p.pid, 'draw', m[1] === 'that many' ? ((p.s && (p.s.hc ?? (p.s.hand || []).length)) || 0) : n, ctx.name)); } log(`${ctx.name}: each player discarded their hand`); commit(); return true; }
  if ((m = l.match(/^draws cards equal to the greatest number of cards a player discarded this way$/)) || (m = l.match(/^each player draws cards equal to the greatest number of cards a player discarded this way$/))){ const n = ctx.discMax || 0; draw(n); opponents().forEach(p => sendRq(p.pid, 'draw', n, ctx.name)); commit(); return true; }
  if ((m = l.match(/^each player shuffles their hand and graveyard into their library$/))){ S.hand.concat(S.gy).forEach(c => { const [z] = find(c.id); if (z) moveCard(c.id, 'lib', {quiet:true}); }); shuffleLib(); opponents().forEach(p => sendRq(p.pid, 'shufHG', 0, ctx.name)); return true; }
  if ((m = l.match(/^(?:then )?each player draws (seven|\w+) cards$/))){ const n = wn(m[1]) || 7; draw(n); opponents().forEach(p => sendRq(p.pid, 'draw', n, ctx.name)); commit(); return true; }
  // mana from counts
  if ((m = l.match(/^add an amount of mana of that color equal to (your devotion to that color|the number of creatures you control of the chosen type)$/)) || (m = l.match(/^add (\{[wubrgc]\}) for each (.+)$/))){
    let col = ctx.color; if (m[1] && m[1].startsWith('{')){ col = m[1][1].toUpperCase(); const n = countOf(m[2], ctx) || 0; if (n) addMana(Array(n).fill(col)); log(`added ${n} {${col}}`); commit(); return true; }
    if (!col) col = await askChoice({title:`${ctx.name}: choose a color`, options:['W', 'U', 'B', 'R', 'G'].map(c => ({label:`{${c}}`, value:c}))}) || 'G';
    const n = /devotion/.test(m[1]) ? devotion([{W:'white', U:'blue', B:'black', R:'red', G:'green'}[col]]) : (r10ChosenType(ctx, src()) ? S.bf.filter(c => isCreatureCard(c) && !c.fd && new RegExp('\\b' + r10ChosenType(ctx, src()) + '\\b', 'i').test(typeOf(c))).reduce((a, c) => a + (c.n || 1), 0) : await askNumber(`${ctx.name}: how many creatures of the chosen type?`, '', 1));
    if (n) addMana(Array(n).fill(col)); log(`added ${n} {${col}}`); commit(); return true; }
  if ((m = l.match(/^choose a color$/))){ ctx.color = UI.dry ? 'G' : await askChoice({title:`${ctx.name}: choose a color`, options:['W', 'U', 'B', 'R', 'G'].map(c => ({label:`{${c}}`, value:c}))}); return true; }
  if ((m = l.match(/^choose a creature type$/))){ ctx.ctype = UI.dry ? 'Elf' : (await askText(`${ctx.name}: choose a creature type`, 'Elf')); const c = src(); if (c) c.ctype = ctx.ctype; return true; }
  if ((m = l.match(/^for each color among permanents you control, add one mana of that color$/))){ const cols = new Set(); S.bf.forEach(c => { if (!c.fd) (info(c.k)?.c || '').split('').forEach(x => /[WUBRG]/.test(x) && cols.add(x)); }); if (cols.size) addMana([...cols]); commit(); return true; }
  if ((m = l.match(/^at the beginning of your next main phase, add an amount of \{c\} equal to that spell's mana value$/))){ const t = (ctx.lastT || [])[0]; const n = t && t.k ? info(t.k)?.mv || 0 : (ctx.counteredMV || 0); S.dlyMana = (S.dlyMana || []).concat({n, col:'C', src:ctx.name}); log(`${ctx.name}: {C}×${n} at your next main phase`); commit(); return true; }
  // self-exiling spells; spells that go back into the library
  if ((m = l.match(/^exile ~$/)) && ctx.it && ctx.it.kind === 'spell'){ ctx.it.exAfter = true; return true; }
  if ((m = l.match(/^shuffle ~ into its owner's library$/)) && ctx.it && ctx.it.kind === 'spell'){ ctx.it.libAfter = true; return true; }
  if ((m = l.match(/^put ~ on top of its owner's library$/))){ const c = src(); if (c && find(c.id)[0] === 'bf'){ moveCard(c.id, 'lib'); const i = S.lib.findIndex(x => x.id === c.id); if (i > 0){ const [x] = S.lib.splice(i, 1); S.lib.unshift(x); } } commit(); return true; }
  if ((m = l.match(/^return ~ to its owner's hand$/))){ const c = src(); if (c && find(c.id)[0] === 'bf') moveCard(c.id, 'hand'); commit(); return true; }
  if ((m = l.match(/^return ~ from your graveyard to the battlefield( tapped)?$/))){ const c = S.gy.find(x => x.id === ctx.srcId) || S.gy.find(x => x.k === ctx.k); if (c){ moveCard(c.id, 'bf'); const b = S.bf.find(x => x.id === c.id); if (b && m[1]) b.tap = true; } commit(); return true; }
  if ((m = l.match(/^return it to its owner's hand$/)) && ctx.srcId != null && find(ctx.srcId)[0] === 'gy'){ moveCard(ctx.srcId, 'hand'); commit(); return true; }
  if ((m = l.match(/^return a land you control to its owner's hand$/))){ const lands = S.bf.filter(c => isLand(c.k)); if (!lands.length) return true; const ids = await pickCards({title:`${ctx.name}: return a land you control to your hand`, cards:lands, min:1, max:1}); if (ids && ids[0]) moveCard(ids[0], 'hand'); commit(); return true; }
  if ((m = l.match(/^sacrifice it$/)) && ctx.srcId != null && find(ctx.srcId)[0] === 'bf'){ moveCard(ctx.srcId, 'gy', {sac:true}); commit(); return true; }
  if ((m = l.match(/^(?:if ~ is tapped, )?it deals (\d+) damage to you$/))){ const c = src(); if (/^if ~ is tapped/.test(l) && !(c && c.tap)) return true; S.life -= +m[1]; log(`${ctx.name} deals ${m[1]} damage to them`); commit(); return true; }
  if ((m = l.match(/^if ~ is tapped, (.+)$/))){ const c = src(); if (c && (c.tap || c.tn)) await say(s.slice(s.length - m[1].length)); return true; }
  // extra turns of upkeep etc.
  if ((m = l.match(/^you have no maximum hand size for the rest of the game$/))){ S.noMax = 1; log(`${ctx.name}: no maximum hand size`); commit(); return true; }
  if ((m = l.match(/^(?:target creature|one or two target creatures|up to two target creatures) can't block this turn$/))){ let t; while (ctx.tgts && (t = nextTargets(ctx)[0])) applyTo(t, {op:'pump', src:ctx.name, f:{p:0, t:0, kw:['cantblock']}}); return true; }
  if ((m = l.match(/^return all attacking creatures to their owner's hands?$/))){ S.bf.filter(c => c.atk && isCreatureCard(c)).forEach(c => moveCard(c.id, 'hand')); for (const [pid, st] of OPP) (st.bf || []).filter(c => c.atk).forEach(c => applyTo({t:'card', pid, id:c.id, k:c.k}, {op:'bounce', src:ctx.name})); commit(); return true; }
  if ((m = l.match(/^permanents your opponents control lose hexproof and indestructible until end of turn$/))){ S.loseHI = turnStr(); log(`${ctx.name}: opponents' permanents lose hexproof and indestructible this turn`); commit(); return true; }
  if ((m = l.match(/^draw a card for each creature you control with a \+1\/\+1 counter on it$/))){ ctx.those = S.bf.filter(c => isCreatureCard(c) && (c.cp || 0) > 0); if (ctx.those.length) draw(ctx.those.length); commit(); return true; }
  if ((m = l.match(/^(?:you may )?cast a spell with mana value (\d+|x) or less from your hand without paying its mana cost$/))){ const n = m[1] === 'x' ? (ctx.it && ctx.it.x) || 0 : +m[1]; const list = S.hand.filter(c => !isLand(c.k) && (info(c.k)?.mv || 0) <= n); if (!list.length || UI.dry) return true; const ids = await pickCards({title:`${ctx.name}: cast a spell with mana value ${n} or less for free`, cards:list, min:0, max:1, noneLabel:'None'}); const c = ids && ids[0] && S.hand.find(x => x.id === ids[0]); if (c){ UI.afterCast = () => {}; await beginCast(c, 'hand', {free:true}); } return true; }
  if ((m = l.match(/^draw a card for each creature you control with power (\d+) or greater$/))){ const n = S.bf.filter(c => isCreatureCard(c) && stats(c)[0] >= +m[1]).length; if (n) draw(n); commit(); return true; }
  if ((m = l.match(/^(?:you )?roll a d(\d+)$/))){ const r = 1 + Math.floor(Math.random() * +m[1]); ctx.roll = r; log(`🎲 ${ctx.name}: rolled a ${r} (d${m[1]})`); emit({type:'roll', x:Math.min(99, r), cnt:1}); commit(); return true; }
  if ((m = l.match(/^flip a coin$/))){ ctx.coin = Math.random() < 0.5 ? 'heads' : 'tails'; log(`🪙 ${ctx.name}: ${ctx.coin}`); return true; }
  if ((m = l.match(/^take an extra turn after this one$/))){ await say('Take an extra turn after this one.'.replace('Take', 'You take')); return true; }
  if ((m = l.match(/^populate$/))){ const toks = S.bf.filter(c => c.tok && isCreatureCard(c)); if (!toks.length) return true; const ids = toks.length === 1 ? [toks[0].id] : await pickCards({title:`${ctx.name}: populate — copy a creature token`, cards:toks, min:1, max:1}); const c = ids && S.bf.find(x => x.id === ids[0]); if (c) await createToken(c.k, 1); commit(); return true; }
  if ((m = l.match(/^adapt (\d+)$/))){ const c = src(); if (c && !(c.cp > 0)) modCounters(c, 'cp', +m[1]); commit(); return true; }
  if ((m = l.match(/^put an? (indestructible|shield|stun|flying|first strike|deathtouch|lifelink|menace|trample|reach|vigilance|hexproof) counter on (~|target creature|it)$/))){ const c = m[2] === '~' ? src() : ((ctx.lastT || [])[0] && S.bf.find(x => x.id === ctx.lastT[0].id)) || (ctx.tgts && (() => { const t = nextTargets(ctx)[0]; return t && S.bf.find(x => x.id === t.id); })()); if (c){ addNamed(c, m[1], 1); if (!/shield|stun/.test(m[1])) c.ekwp = [...new Set([...(c.ekwp || []), m[1]])]; } commit(); return true; }
  if ((m = l.match(/^(?:that token|it|they) gains? haste(?: until end of turn)?$/))){ (ctx.lastTok || []).forEach(id => { const c = S.bf.find(x => x.id === id); if (c) c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; }); commit(); return true; }
  if ((m = l.match(/^(?:you may )?look at the top card of your library$/))){ const c = S.lib[0]; ctx.lastRev = c; if (c && !UI.dry) await pickCards({title:`${ctx.name}: top card of your library`, cards:[c], min:0, max:0, noneLabel:'OK'}); return true; }
  if ((m = l.match(/^if it's an? (.+?) card(?: of the chosen type)?, you may reveal it and put it into your hand$/))){ const c = ctx.lastRev; if (!c || S.lib[0] !== c) return true; let ok = descOk(c.k, sing(m[1])); if (ok && /chosen type/.test(l) && ctx.ctype) ok = new RegExp('\\b' + ctx.ctype + '\\b', 'i').test(info(c.k)?.t || ''); if (ok && (UI.dry || await askYes(`${ctx.name}: reveal ${cname(c)} and put it into your hand?`))){ S.lib.shift(); S.hand.push(c); log(`revealed ${cname(c)} and put it into their hand`); commit(); } return true; }
  if ((m = l.match(/^sacrifice the rest$/)) || (m = l.match(/^sacrifices the rest$/))) return false;
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){
    const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase();
    if (l && await doRound10Pre(s, l, ctx)) return;
    return ds(s0, ctx);
  };
}
// a spell that says “Exile ~” or “Shuffle ~ into its owner's library” goes there instead of the graveyard
{
  const tg = toGrave;
  toGrave = function(c, it){ if (it && it.libAfter){ faceRestore(c); S.lib.push(c); shuffleLib(); log(`${cname(c)} was shuffled into its owner's library`); return; } return tg(c, it); };
}
// the opponent side of “exile target player's graveyard” and shuffle-hand-and-graveyard
{
  RQ_OPS.push('exGy', 'shufHG');
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'exGy'){ S.gy.slice().forEach(c => moveCard(c.id, 'ex')); log(`exiled their graveyard (${r.src})`); commit(); return; }
    if (r.op === 'shufHG'){ S.hand.concat(S.gy).forEach(c => moveCard(c.id, 'lib', {quiet:true})); shuffleLib(); log(`shuffled their hand and graveyard into their library (${r.src})`); commit(); return; }
    return ao(r, from);
  };
}
async function askText(title, def){ if (UI.dry) return def; const v = await askChoice({title, options:['Elf', 'Goblin', 'Zombie', 'Human', 'Vampire', 'Dragon', 'Angel', 'Sliver', 'Merfolk', 'Wizard', 'Dinosaur', 'Cat', 'Dog', 'Spirit', 'Warrior', 'Knight', 'Soldier', 'Cleric', 'Rogue', 'Squirrel', 'Ninja', 'Faerie', 'Elemental', 'Beast', 'Rat', 'Treefolk', 'Pirate', 'Demon', 'Horror', 'Eldrazi'].map(x => ({label:x, value:x}))}); return v || def; }

/* ---------- Triggers ---------- */
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    let m;
    if ((m = c.match(/^equipped creature (dies|attacks|deals combat damage to a player|deals damage)/))) return {ev:{dies:'die', attacks:'attack'}[m[1]] || (/combat/.test(m[1]) ? 'cdmg' : 'dmg'), subj:'any', ctl:'you', desc:'', equipped:true};
    if ((m = c.match(/^enchanted creature (dies|attacks|deals combat damage to a player)/))) return {ev:{dies:'die', attacks:'attack'}[m[1]] || 'cdmg', subj:'any', ctl:'any', desc:'', enchantedBy:true};
    if ((m = c.match(/^you create or sacrifice a token$/))) return {ev:'enter', evs:['enter', 'sac'], subj:'any', ctl:'you', desc:'', tokOnly:true};
    if ((m = c.match(/^you create one or more tokens$/))) return {ev:'enter', subj:'any', ctl:'you', desc:'', tokOnly:true, batch:true};
    return ct(w, c);
  };
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    if (ev && t){
      if (t.equipped){ const s = S.bf.find(x => x.id === src.id); const host = s && s.att && s.att.id; if (!host || ev.id !== host || evPid !== MYPID) return; }
      if (t.enchantedBy){ const s = S.bf.find(x => x.id === src.id); if (!s || !s.att || s.att.id !== ev.id || s.att.pid !== evPid) return; }
      if (t.tokOnly && !ev.tok) return;
    }
    pt(src, t, ev, evPid);
  };
  const sm = subjMatch;
  subjMatch = function(t, src, ev, pid){ if (t.equipped || t.enchantedBy) return true; return sm(t, src, ev, pid); };
}

/* ---------- Statics ---------- */
STATIC_RULES.push(
  [/^each land is an? (swamp|forest|island|mountain|plains) in addition to its other land types$/, m => ({kind:'landType', who:'all', type:cap(m[1])})],
  [/^lands you control have "\{t\}: add one mana of any color"$/, m => ({kind:'lantern', who:'you'})],
  [/^creatures can't attack you(?: or planeswalkers you control)? unless their controller pays \{(\d+)\} for each creature they control that's attacking you$/, m => ({kind:'atkTax', who:'opp', n:+m[1]})],
  [/^creatures your opponents control enter tapped$/, m => ({kind:'oppTapped', who:'opp'})],
  [/^untap all permanents you control during each other player's untap step$/, m => ({kind:'seedborn', who:'you'})],
  [/^nontoken creatures you control have riot$/, m => ({kind:'riot', who:'you'})],
  [/^during your turn, your opponents can't cast spells or activate abilities of artifacts, creatures, or enchantments$/, m => ({kind:'notOnTurn', who:'opp', abil:true})],
  [/^~ costs \{x\} less to cast, where x is (.+)$/, m => ({kind:'selfXLess', who:'you', what:m[1]})],
  [/^cumulative upkeep (.+)$/, m => ({kind:'cumUp', who:'you', cost:m[1]})],
  [/^hideaway (\d+)$/, m => ({kind:'noop'})],
  [/^if ~ is in your opening hand, you may begin the game with it on the battlefield$/, m => ({kind:'leyline', who:'you'})],
  [/^if you would gain life, you gain twice that much life instead$/, m => ({kind:'gainX2', who:'you'})],
  [/^if you would gain life, you gain that much life plus (\d+) instead$/, m => ({kind:'gainPlus', who:'you', n:+m[1]})],
  [/^you may cast spells as though they had flash$/, m => ({kind:'allFlash', who:'you'})],
  [/^you may cast creature spells as though they had flash$/, m => ({kind:'allFlash', who:'you', desc:'creature'})],
  [/^skip your draw step$/, m => ({kind:'skipDraw', who:'you'})],
);
STATIC_KNOWN.push(/^riot$/, /^hideaway \d+$/, /^(skulk|umbra armor|living weapon|undaunted|outlast .+|basic landcycling .+|\w+cycling .+|encore .+|warp .+|dash .+|mutate .+|suspend .+|rebound|job select|start your engines!|tiered|spree|paradigm)$/);
// Urborg / Yavimaya, Chromatic Lantern
{
  const ma = manaAbs;
  manaAbs = function(c){ let out = ma(c); if (!S || !c || !isLand(c.k)) return out;
    for (const r of rulesOn('landType')){ const col = {Swamp:'B', Forest:'G', Island:'U', Mountain:'R', Plains:'W'}[r.type]; if (col && !out.some(o => o.tapOnly && o.outs.some(x => x.join('') === col))) out = out.concat({cost:'{T}', eff:`Add {${col}}`, rest:'', outs:[[col]], tapOnly:true, line:`{T}: Add {${col}}. (${r.src})`}); }
    if (S.bf.includes(c) && rulesOn('lantern').length && !out.some(o => o.lantern)) out = out.concat({cost:'{T}', eff:'Add one mana of any color', rest:'', outs:manaOuts('Add one mana of any color'), tapOnly:true, line:'{T}: Add one mana of any color. (Chromatic Lantern)', lantern:true});
    return out; };
}
// Propaganda / Ghostly Prison: pay when you declare attackers; Eriette: enchanted creatures can't attack her
{
  const da = declareAttackers;
  declareAttackers = function(){
    const pn = phaseNow(); if (!pn.mine || !S.cb || S.cb.step !== 'atk') return da();
    const sel = Object.entries(UI.atkSel || {}).filter(([, v]) => v); const per = {};
    for (const [id, def] of sel){ const c = S.bf.find(x => x.id === +id); if (!c) continue; const d = parseDef(def); if (!d || !d.pid) continue;
      const st = OPP.get(d.pid); if (st && (st.bf || []).some(e => e.k && /each creature that's enchanted by an aura you control can't attack you/i.test(info(e.k)?.o || '')) && (st.bf || []).some(a => a.att && a.att.pid === MYPID && a.att.id === c.id && /Aura/.test(info(a.k)?.t || ''))){ toast(`${cname(c)} is enchanted by ${nameOf(d.pid)}'s Aura — it can't attack them`); return; }
      per[d.pid] = (per[d.pid] || 0) + (c.n || 1); }
    let tax = 0; const why = [];
    for (const [pid, n] of Object.entries(per)){ const st = OPP.get(pid); if (!st) continue; const each = (st.bf || []).reduce((a, e) => { const mm = e.k && tname(info(e.k)?.o || '', info(e.k)?.n).toLowerCase().match(/creatures can't attack you(?: or planeswalkers you control)? unless their controller pays \{(\d+)\} for each creature/); return a + (mm ? +mm[1] : 0); }, 0); if (each){ tax += each * n; why.push(`${nameOf(pid)}: {${each}} × ${n}`); } }
    if (tax){ const plan = payPlan(parseCost(`{${tax}}`), S.pool); if (plan.err){ toast(`Attacking costs {${tax}} (${why.join(', ')}) — tap mana first`); return; } S.pool = plan.pool; log(`paid {${tax}} to attack (${why.join(', ')})`); }
    return da();
  };
}
// opponents' creatures enter tapped (Authority of the Consuls, Blind Obedience…), riot, Seedborn Muse, leylines, life doubling
{
  const oe = onEnter;
  onEnter = function(c, from, o = {}){
    const r = oe(c, from, o);
    try { if (c && isCreatureCard(c) && S.bf.includes(c)){
      if (rulesOn('oppTapped').length) c.tap = true;
      if (!c.tok && rulesOn('riot').length || /^riot$/im.test(info(c.k)?.o || '')){ if (!UI.dry) (async () => { const v = await askChoice({title:`${cname(c)}: riot`, options:[{label:'+1/+1 counter', value:'ctr'}, {label:'Haste', value:'haste'}]}); if (v === 'ctr') modCounters(c, 'cp', 1); else c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; commit(); })(); }
    } } catch (e){ console.warn(e); }
    return r;
  };
  const tc = turnChanged;
  turnChanged = function(...a){ const r = tc.apply(this, a); try { if (S && rulesOn('seedborn').length && currentTurn()[1] !== MYPID){ S.bf.forEach(c => { if (!doesntUntap(c)){ c.tap = false; c.tn = 0; } }); log('untapped their permanents (Seedborn Muse)'); commit(); } } catch {} return r; };
  const gl = gainLife;
  gainLife = function(n, src){ if (S && n > 0){ const x2 = rulesOn('gainX2').length; const plus = rulesOn('gainPlus').reduce((a, r) => a + r.n, 0); if (plus) n += plus; for (let i = 0; i < x2; i++) n *= 2; } return gl(n, src); };
}
// leylines: put it onto the battlefield before the first turn
{
  const hi = r8HandItems;
  r8HandItems = function(c, zone){ let s = hi(c, zone); if (zone === 'hand' && S && /if (?:this card|.+?) is in your opening hand, you may begin the game with it on the battlefield/i.test(info(c.k)?.o || '') && phaseNow().n <= 1 && !(S.leyDone)) s += `<button type="button" data-act="leyline" data-id="${c.id}"><span>Begin the game with it on the battlefield</span></button>`; return s; };
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-act="leyline"]'); if (!b || !S) return; const id = +b.dataset.id; const c = S.hand.find(x => x.id === id); if (c){ moveCard(c.id, 'bf'); log(`began the game with ${cname(c)} on the battlefield`); closeMenu(); commit(); } }, true);
}
// cumulative upkeep: an upkeep trigger for every permanent with it
{
  const tg = trigsOf;
  trigsOf = function(k, fl){
    const out = tg(k, fl); if (out.r10) return out;
    const a = info(k); const f = a ? (fl && a.back ? a.back : a) : null;
    if (f){ const o = tname(f.o, f.n); let m;
      if ((m = o.match(/^cumulative upkeep (.+)$/im))) out.push({ev:'step', step:'upkeep', whose:'your', eff:`Put an age counter on ~. Then sacrifice ~ unless you pay ${m[1].replace(/\.$/, '')} for each age counter on it.`, raw:'cumulative upkeep'});
      if ((m = o.match(/^hideaway (\d+)$/im)) && /\bLand\b/.test(f.t)) out.push({ev:'enter', subj:'self', ctl:'you', desc:'', eff:`Hideaway ${m[1]}.`, raw:'hideaway'});
      else if ((m = o.match(/^hideaway (\d+)$/im))) out.push({ev:'enter', subj:'self', ctl:'you', desc:'', eff:`Hideaway ${m[1]}.`, raw:'hideaway'});
    }
    out.r10 = true; return out;
  };
  const r10 = doRound10Pre;
  doRound10Pre = async function(s, l, ctx){
    let m;
    if ((m = l.match(/^put an age counter on ~$/))){ const c = srcCardOf(ctx); if (c) addNamed(c, 'age', 1); commit(); return true; }
    if ((m = l.match(/^then sacrifice ~ unless you pay (.+) for each age counter on it$/)) || (m = l.match(/^sacrifice ~ unless you pay (.+) for each age counter on it$/))){
      const c = srcCardOf(ctx); if (!c) return true; const n = (c.nc || {}).age || 1; const unit = m[1];
      if (/^\{/.test(unit)){ const cost = unit.repeat(n).toUpperCase(); const plan = payPlan(parseCost(cost), S.pool); if (!plan.err && (UI.dry || await askYes(`${cname(c)}: pay ${cost} to keep it?`))){ S.pool = plan.pool; log(`paid ${cost} (cumulative upkeep)`); } else { if (plan.err && !UI.dry) toast(`Tap mana for ${cost} first to keep ${cname(c)}`); moveCard(c.id, 'gy', {sac:true}); log(`sacrificed ${cname(c)} (cumulative upkeep)`); } }
      else if (!UI.dry && !(await askYes(`${cname(c)}: pay “${unit}” ×${n} to keep it? (do the payment by hand)`))){ moveCard(c.id, 'gy', {sac:true}); }
      commit(); return true; }
    if ((m = l.match(/^hideaway (\d+)$/))){ const n = +m[1]; const top = S.lib.slice(0, n); if (!top.length) return true; const ids = top.length === 1 ? [top[0].id] : await pickCards({title:`${ctx.name}: hideaway — exile one face down`, cards:top, min:1, max:1}); const h = top.find(c => c.id === (ids || [])[0]) || top[0];
      top.forEach(c => S.lib.splice(S.lib.indexOf(c), 1)); h.fdEx = 1; S.ex.push(h); const rest = top.filter(c => c !== h); shuffle(rest); S.lib.push(...rest); const sc = srcCardOf(ctx); if (sc) sc.hid = h.id; log(`${ctx.name}: hid a card face down; ${rest.length} on the bottom`); commit(); return true; }
    if ((m = l.match(/^(?:you may )?play the exiled card without paying its mana cost(?: if (.+))?$/))){ const sc = srcCardOf(ctx); const h = sc && sc.hid && S.ex.find(c => c.id === sc.hid); if (!h){ log(`${ctx.name}: no hidden card`); return true; }
      if (m[1] && !UI.dry && !(await askYes(`${ctx.name}: is this true — ${m[1]}?`))) return true; if (UI.dry) return true;
      if (isLand(h.k)){ S.ex.splice(S.ex.indexOf(h), 1); S.hand.push(h); playLand(h, {free:true}); } else { UI.afterCast = () => {}; await beginCast(h, 'ex', {free:true}); } sc.hid = null; commit(); return true; }
    return r10(s, l, ctx);
  };
}
// The Great Henge: costs {X} less, where X is the greatest power among creatures you control
{
  const cmo = costMods;
  costMods = function(c, caster){ const out = cmo(c, caster); if (!S || caster !== MYPID || !c) return out;
    const mm = tname(info(c.k)?.o || '', info(c.k)?.n).toLowerCase().match(/^~ costs \{x\} less to cast, where x is (.+?)\.?$/m);
    if (mm){ const n = countOf(mm[1], {k:c.k}) || 0; if (n) out.less.push({src:info(c.k).n, n}); }
    return out; };
}
// Mana Drain and other “at the beginning of your next main phase, add …”
{
  const fs = fireSteps;
  fireSteps = function(step, activePid){ fs(step, activePid); if (step === 'main1' && activePid === MYPID && (S.dlyMana || []).length){ const list = S.dlyMana.splice(0); list.forEach(d => { if (d.n) addMana(Array(d.n).fill(d.col)); log(`${d.src}: added ${d.n} {${d.col}}`); }); commit(); } };
}
// flash for everything (Leyline of Anticipation, Vedalken Orrery)
{
  const to = timingOk;
  timingOk = function(c){ const r = to(c); if (r && !r.ok && phaseNow().n > 0 && !/split second/i.test(r.why || '') && rulesOn('allFlash').some(x => !x.desc || descOk(c.k, x.desc))) return {ok:true}; return r; };
  const us = useSkip;
  useSkip = function(kind){ if (kind === 'draw' && S && rulesOn('skipDraw').length) return true; return us(kind); };
}
