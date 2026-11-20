/* ===================== Rules engine — round 22: the final-test decks (Grand Arbiter, Elminster, Edgar, Blue Farm) ===================== */
// cross-player helpers
RQ_OPS.push('r22lib', 'r22libAll', 'r22pick', 'r22pickAns', 'r22mayDraw');
const R22 = { ans:{} };
function r22putLib(c, pos, gainT){
  // pos: 'top' | 'bottom' | n (0-based index from the top)
  if (!c) return;
  const tough = gainT ? (stats(c) || [0, 0])[1] : 0;
  const nm = cname(c);
  if (c.tok){ moveCard(c.id, 'gy', {quiet:true}); log(`${nm} left the battlefield (token)`); }
  else {
    moveCard(c.id, 'lib', {quiet:true});
    const i = S.lib.findIndex(x => x.id === c.id);
    if (i >= 0){ const [x] = S.lib.splice(i, 1); if (pos === 'bottom') S.lib.push(x); else if (pos === 'top') S.lib.unshift(x); else S.lib.splice(Math.min(+pos || 0, S.lib.length), 0, x); }
    log(`${nm} was put into its owner's library ${pos === 'bottom' ? 'on the bottom' : pos === 'top' ? 'on top' : (+pos + 1) + ordSuffix(+pos + 1) + ' from the top'}`);
  }
  if (gainT && tough > 0 && gainLife(tough, nm)) log(`gained ${tough} life (${nm}'s toughness) → ${S.life}`);
}
function ordSuffix(n){ return n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'; }
function r22applyLib(t, pos, src, gainT){
  if (!t) return;
  if (t.pid === MYPID || !t.pid){ const c = S.bf.find(b => b.id === t.id); if (c) r22putLib(single(c), pos, gainT); return; }
  sendRq(t.pid, 'r22lib', typeof pos === 'number' ? pos : pos === 'bottom' ? -1 : -2, src, {tid:t.id, d:gainT ? 'gainT' : ''});
  log(`${src}: ${t.nm || 'a permanent'} goes into ${nameOf(t.pid)}'s library`);
}
// ask another player to choose cards from a pile I publish
async function r22oppPick(pid, cards, n, title, src){
  if (UI.dry) return cards.slice(0, n).map(c => c.id);
  const ref = rid(6);
  S.pile = {ref, ks:cards.map(c => c.k)}; sendRq(pid, 'r22pick', n, src, {ref, d:title.slice(0, 80)}); commit();
  toast(`Waiting for ${nameOf(pid)} to choose…`);
  const a = await waitUntil(() => R22.ans[ref], 90000);
  S.pile = null;
  const idx = a ? a.idx : [...Array(n).keys()];
  return idx.map(i => cards[i]).filter(Boolean).map(c => c.id);
}
async function r22pickMany(pids, cards, n, title, src){
  if (UI.dry || !pids.length) return pids.map(() => cards.slice(0, n).map(c => c.id));
  const refs = pids.map(() => rid(6));
  S.pile = {ref:refs[0], ks:cards.map(c => c.k)};
  pids.forEach((pid, i) => sendRq(pid, 'r22pick', n, src, {ref:refs[i], d:title.slice(0, 80)})); commit();
  toast(`Waiting for ${pids.map(nameOf).join(', ')}…`);
  const out = [];
  for (const ref of refs){ const a = await waitUntil(() => R22.ans[ref], 90000); out.push((a ? a.idx : [0]).map(i => cards[i]).filter(Boolean).map(c => c.id)); }
  S.pile = null; commit();
  return out;
}
// yes/no question on another player's screen
RQ_OPS.push('r22ask', 'r22libTop', 'r22handLib', 'r22exLib');
async function r22ask(pid, q, src){
  if (UI.dry) return false;
  const ref = rid(6); sendRq(pid, 'r22ask', 0, src, {ref, d:q.slice(0, 80)}); commit();
  const a = await waitUntil(() => R22.ans[ref], 60000); return !!(a && a.idx[0] === 1);
}
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'r22lib'){ const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c) r22putLib(single(c), r.n === -1 ? 'bottom' : r.n === -2 ? 'top' : r.n, r.d === 'gainT'); commit(); return; }
    if (r.op === 'r22libAll'){ const desc = String(r.d || 'creature'); S.bf.filter(c => !c.fd && descOk(c.k, desc, {tok:c.tok})).forEach(c => r22putLib(c, 'bottom')); log(`${r.src}: put all ${desc}s on the bottom of their library`); commit(); return; }
    if (r.op === 'r22pick'){ (async () => {
      const pile = OPP.get(from)?.pile; const ks = pile ? pile.ks : [];
      const cards = ks.map((k, i) => ({id:-1000 - i, k}));
      const n = Math.min(r.n || 1, cards.length);
      const ids = cards.length ? await pickCards({title:`${r.src}: ${r.d || 'choose'} (${nameOf(from)}'s cards)`, cards, min:n, max:n}) : [];
      const real = (ids || []).map(id => -(id + 1000));
      sendRq(from, 'r22pickAns', real.length, r.src, {ref:r.ref, d:real.join(',')}); commit();
    })(); return; }
    if (r.op === 'r22libTop'){ if (S.lib.length) S.lib.push(S.lib.shift()); log(`put the top card of their library on the bottom (${r.src})`); commit(); return; }
    if (r.op === 'r22exLib'){ const n = S.lib.length; S.ex.push(...S.lib.splice(0)); log(`exiled their whole library — ${n} cards (${r.src})`); commit(); return; }
    if (r.op === 'r22handLib'){ S.lib.push(...S.hand.splice(0)); shuffle(S.lib); log(`shuffled their hand into their library (${r.src})`); commit(); return; }
    if (r.op === 'r22ask'){ (async () => { const yes = await askYes(`${r.src}: ${r.d}`, 'Yes', 'No'); sendRq(from, 'r22pickAns', 1, r.src, {ref:r.ref, d:yes ? '1' : '0'}); commit(); })(); return; }
    if (r.op === 'r22pickAns'){ R22.ans[r.ref] = {idx:String(r.d || '').split(',').filter(x => x !== '').map(Number)}; return; }
    if (r.op === 'r22mayDraw'){ (async () => { if (await askYes(`${r.src}: you may draw a card. Draw?`, 'Draw', "Don't")){ draw(1); log(`drew a card (${r.src})`); } commit(); })(); return; }
    return ao(r, from);
  };
}
// the spells each player has cast this game, by name and zone (Approach of the Second Sun)
{
  const bc = beginCast;
  beginCast = async function(c, zone, ...a){ const r = await bc.call(this, c, zone, ...a); try { if (S && c && c.k && (S.stk || []).some(it => it.card && it.card.id === c.id)){ S.castHist = S.castHist || []; S.castHist.push({n:info(c.k)?.n, z:zone || 'hand', t:turnStr()}); if (S.castHist.length > 300) S.castHist.splice(0, 100); } } catch {} return r; };
}
// Teferi's Protection: life locked until my next turn; my permanents phase out
{
  const cm = commit;
  commit = function(...a){ try { if (S && S.tpLock){ if (S.life !== S.tpLock.v){ S.life = S.tpLock.v; } } } catch {} return cm.apply(this, a); };
  const tc = turnChanged;
  turnChanged = function(...a){
    const r = tc.apply(this, a);
    try { if (S && currentTurn()[1] === MYPID){
      if (S.tpLock && S.tpLock.t !== turnStr()){ S.tpLock = null; log("Teferi's Protection ended"); }
      if (S.poz && S.poz.length){ const back = S.poz.splice(0); back.forEach(c => { c.tap = c.tap || false; S.bf.push(c); }); log(`${back.length} permanent${back.length === 1 ? '' : 's'} phased in`); }
      // Necropotence: cards set aside face down come to hand at the beginning of the end step (handled in fireSteps below)
    } } catch (e){ console.warn(e); }
    return r;
  };
  const dm = damageMe;
  damageMe = function(n, f = {}, from){ if (S && S.tpLock){ log('damage to me prevented (protection from everything)'); return; } return dm(n, f, from); };
}
// Necropotence / delayed "put that card into your hand at the beginning of your next end step"
{
  const fs = fireSteps;
  fireSteps = function(...a){
    const r = fs.apply(this, a);
    try { const [step, ap] = a; if (S && step === 'end' && ap === MYPID && S.necro && S.necro.length && S.necroT !== turnStr()){ S.necroT = turnStr(); const ids = S.necro.splice(0); ids.forEach(id => { const i = S.ex.findIndex(c => c.id === id); if (i >= 0){ const [c] = S.ex.splice(i, 1); reset(c); S.hand.push(c); } }); log(`put ${ids.length} card${ids.length === 1 ? '' : 's'} into their hand (Necropotence)`); commit(); } } catch (e){ console.warn(e); }
    return r;
  };
}
async function doRound22Pre(s, l, ctx){
  let m;
  const tgt = () => (ctx.tgts ? nextTargets(ctx) : [])[0];
  const full = tname(String(ctx.full || ''), ctx.name || '').toLowerCase();
  // ---- look at the top X cards, where X is … (Memory Deluge, Consult the Star Charts)
  if ((m = l.match(/^(look at|reveal) the top x cards of your library, where x is (.+)$/))){
    let n;
    if (/amount of mana spent to cast /.test(m[2])) n = UI.spellX ? UI.spellX.spent : (ctx.it && ctx.it.mv) || 0;
    else n = countOf(m[2], ctx);
    if (/^your devotion to /.test(m[2]) && Number.isFinite(n)) ctx.devX = n;
    if (n == null || !Number.isFinite(n)) n = await askNumber(`${ctx.name}: X = ?`, m[2], 1);
    if (UI.dry && !n) n = 3;
    if (!n){ log(`${ctx.name}: X is 0 — nothing to look at`); ctx.skipDigRest = full; return true; }
    let rest = digRest(ctx, l);
    const kicked = !!(ctx.it && ctx.it.kicked);
    const kickTwo = /if this spell was kicked, put two of those cards into your hand instead/.test(rest);
    rest = rest.replace(/ if this spell was kicked, put two of those cards into your hand instead\./, '');
    ctx.skipDigRest = rest || ' ';
    const spec = parseDig(rest);
    if (spec){ if (kicked && kickTwo && spec.take) spec.take.max = 2; await digTop(n, ctx, m[1] === 'reveal', spec); return true; }
    ctx.skipDigRest = null; ctx.digRestTxt = rest;
    await doSentence(`${cap(m[1])} the top ${n} cards of your library`, ctx); ctx.digRestTxt = null; ctx.skipDigRest = rest || ' ';
    return true;
  }
  // Thassa's Oracle: win if X ≥ cards in library
  if ((m = l.match(/^if x is greater than or equal to the number of cards in your library, you win the game$/))){ const x = ctx.devX != null ? ctx.devX : (typeof devotion === 'function' ? devotion(['blue']) : 0); if (x >= S.lib.length){ log(`${ctx.name}: devotion ${x} ≥ ${S.lib.length} cards in library — WINS THE GAME`); toast(`${ctx.name}: you win the game!`); S.won = turnStr(); } else log(`${ctx.name}: ${x} < ${S.lib.length} cards in library — no win`); commit(); return true; }
  if (ctx.skipDigRest && ctx.skipDigRest.trim() && ctx.skipDigRest.includes(l.replace(/\.$/, ''))) return true;
  if (ctx.skipDigRest && /^(put (one|two|up to one|the rest)|if this spell was kicked)/.test(l)) return true;
  if ((m = l.match(/^(?:look at|reveal) the top 0 cards?\b/))) { log(`${ctx.name}: looked at 0 cards`); return true; }
  // ---- putting permanents into libraries
  if ((m = l.match(/^put target (.+?) (?:on the bottom of|into) its owner's library(?: (second|third|fourth|fifth|sixth|seventh|\d+(?:st|nd|rd|th)) from the top| just beneath the top x cards of that library)?$/))){
    const t = tgt(); if (!t) return true;
    let pos = /on the bottom/.test(l) ? 'bottom' : 'top';
    if (m[2]) pos = ({second:1, third:2, fourth:3, fifth:4, sixth:5, seventh:6}[m[2]] ?? (parseInt(m[2], 10) - 1));
    if (/just beneath the top x/.test(l)) pos = (ctx.it && ctx.it.x) || (UI.spellX && UI.spellX.x) || 0;
    const gainT = /its controller gains life equal to its toughness/.test(full);
    r22applyLib(t, pos, ctx.name, gainT); commit(); return true;
  }
  if (/^its controller gains life equal to its toughness$/.test(l)) return true;   // done with the move above
  if ((m = l.match(/^put all (creatures|nonland permanents|artifacts|enchantments) on the bottom of their owners' libraries$/))){
    const desc = m[1].replace(/s$/, '');
    S.bf.filter(c => !c.fd && descOk(c.k, desc, {tok:c.tok})).forEach(c => r22putLib(c, 'bottom'));
    opponents().forEach(p => sendRq(p.pid, 'r22libAll', 0, ctx.name, {d:desc}));
    log(`${ctx.name}: all ${m[1]} go to the bottom of their owners' libraries`); commit(); return true;
  }
  // Approach of the Second Sun
  if ((m = l.match(/^if (?:this spell|~) was cast from your hand and you've cast another spell named (.+?) this game, you win the game$/))){
    const nm = ctx.name; const hist = (S.castHist || []).filter(h => h.n === nm);
    const fromHand = hist.length && hist[hist.length - 1].z === 'hand';
    ctx.approachWin = fromHand && hist.length >= 2;
    if (ctx.approachWin){ log(`${nm}: second time cast — WINS THE GAME`); toast(`${nm}: you win the game!`); S.won = turnStr(); }
    commit(); return true;
  }
  if ((m = l.match(/^otherwise, put (?:~|approach of the second sun|this spell) into its owner's library seventh from the top and you gain 7 life$/))){
    if (ctx.approachWin) return true;
    ctx.approachLib = true; gainLife(7, ctx.name); log(`${ctx.name}: gained 7 life, goes into the library 7th from the top → ${S.life}`); commit(); return true;
  }
  // "Its controller investigates" (Fateful Absence)
  if ((m = l.match(/^its controller investigates$/))){ const t = (ctx.lastT || [])[0] || ctx.lastTgt; const pid = t && t.pid ? t.pid : (ctx.tgtsAll && ctx.tgtsAll[0] && ctx.tgtsAll[0].pid); if (!pid || pid === MYPID) await createFromText('Create a Clue token', ctx); else { sendRq(pid, 'tokText', 0, ctx.name, {d:'a Clue token'}); log(`${nameOf(pid)} investigates (${ctx.name})`); } commit(); return true; }
  // Sunset Revelry-style comparisons
  if ((m = l.match(/^if an opponent (has more life|controls more creatures|has more cards in hand) than you, (.+)$/))){
    const ops = opponents(); let ok = false;
    const myCreatures = S.bf.filter(c => isCreatureCard(c) && !c.fd).reduce((a, c) => a + (c.n || 1), 0);
    for (const p of ops){ const s = OPP.get(p.pid); if (!s) continue;
      if (/life/.test(m[1]) && s.life > S.life) ok = true;
      if (/creatures/.test(m[1]) && (s.bf || []).filter(b => b.k && /Creature/.test(info(b.k)?.t || '') && !b.fd).reduce((a, b) => a + (b.n || 1), 0) > myCreatures) ok = true;
      if (/cards in hand/.test(m[1]) && (s.hc || 0) > S.hand.length) ok = true; }
    if (ok) await doSentence(cap(s.slice(s.length - m[2].length)), ctx); else log(`${ctx.name}: no opponent ${m[1]} than them — skipped`);
    return true;
  }
  // Necropotence
  if ((m = l.match(/^exile the top card of your library face down$/)) && /put that card into your hand at the beginning of your next end step/.test(full)){
    const c = S.lib.shift(); if (!c){ log('library is empty'); return true; } c.fd = true; S.ex.push(c); S.necro = (S.necro || []).concat(c.id); log(`exiled the top card face down (${ctx.name})`); commit(); return true; }
  if (/^put that card into your hand at the beginning of your next end step$/.test(l)) return true;
  if ((m = l.match(/^exile that card from your graveyard$/))){ const id = ctx.it && ctx.it.evId; const i = id != null ? S.gy.findIndex(c => c.id === id) : -1; if (i >= 0){ moveCard(id, 'ex', {quiet:true}); log(`${ctx.name}: exiled the discarded card`); } commit(); return true; }
  // Necrodominance: pay any amount of life, draw that many
  if ((m = l.match(/^you may pay any amount of life$/)) || (m = l.match(/^pay any amount of life$/))){
    const n = UI.dry ? 1 : await askNumber(`${ctx.name}: pay how much life? (you have ${S.life})`, 'Draw that many cards', 0);
    ctx.paidLife = Math.max(0, Math.min(+n || 0, S.life)); if (ctx.paidLife){ S.life -= ctx.paidLife; log(`paid ${ctx.paidLife} life → ${S.life}`); } commit(); return true; }
  if ((m = l.match(/^if you do, draw that many cards$/)) && ctx.paidLife != null){ if (ctx.paidLife) draw(ctx.paidLife); commit(); return true; }
  // Teferi's Protection
  if ((m = l.match(/^until your next turn, your life total can't change and you gain protection from everything$/))){ S.tpLock = {v:S.life, t:turnStr()}; log(`${ctx.name}: life locked at ${S.life} and protection from everything until their next turn`); commit(); return true; }
  if ((m = l.match(/^all permanents you control phase out$/))){ S.poz = (S.poz || []).concat(S.bf.splice(0)); log(`${ctx.name}: ${S.poz.length} permanents phased out`); commit(); return true; }
  // Mana Echoes
  if ((m = l.match(/^(?:you may )?add an amount of \{c\} equal to the number of creatures you control that share a creature type with it$/))){
    const id = ctx.it && ctx.it.evId; const ek = (ctx.it && ctx.it.evK) || (id != null && S.bf.find(c => c.id === id)?.k);
    const types = (String(info(ek)?.t || '').split('—')[1] || '').trim().split(/\s+/).filter(Boolean);
    const n = types.length ? S.bf.filter(c => isCreatureCard(c) && !c.fd && types.some(t => new RegExp('\\b' + t + '\\b').test(typeOf(c)) || kwOf(c, 'changeling'))).reduce((a, c) => a + (c.n || 1), 0) : 0;
    if (n){ addMana(Array(n).fill('C')); log(`${ctx.name}: added ${'{C}'.repeat(n)}`); } commit(); return true;
  }
  // Demonic Consultation
  if ((m = l.match(/^choose a card name$/)) && /reveal cards from the top of your library until you reveal a card with the chosen name/.test(full)){
    if (!UI.dry){ const how = await askChoice({title:`${ctx.name}: name a card`, options:[{label:'A card in my deck, hand or graveyard', value:'deck'}, {label:"A card that isn't in my library (exile the whole library)", value:'none'}]}); if (how === 'none'){ ctx.chosenName = '\u0000none'; log(`${ctx.name}: named a card that isn't in the library`); return true; } }
    const seen = new Map(); [...S.lib, ...S.hand, ...S.gy].forEach(c => { const n = cname(c); if (!seen.has(n)) seen.set(n, c); });
    const ids = UI.dry ? [] : await pickCards({title:`${ctx.name}: choose a card name`, cards:[...seen.values()].sort((a, b) => cname(a).localeCompare(cname(b))), min:1, max:1});
    const c = ids && [...seen.values()].find(x => x.id === ids[0]); ctx.chosenName = c ? cname(c) : null; return true; }
  if ((m = l.match(/^exile the top six cards of your library, then reveal cards from the top of your library until you reveal a card with the chosen name$/))){
    const ex = S.lib.splice(0, 6); ex.forEach(c => S.ex.push(c)); const rev = []; let hit = null;
    while (S.lib.length){ const c = S.lib.shift(); if (ctx.chosenName && cname(c) === ctx.chosenName){ hit = c; break; } rev.push(c); }
    rev.forEach(c => S.ex.push(c)); if (hit) S.hand.push(hit);
    log(`${ctx.name}: exiled ${ex.length + rev.length} cards${hit ? `, found ${cname(hit)}` : ' — the named card was not found'}`); commit(); return true; }
  if (/^put that card into your hand and exile all other cards revealed this way$/.test(l) && ctx.chosenName !== undefined) return true;
  // Tainted Pact
  if ((m = l.match(/^exile the top card of your library$/)) && /repeat this process until you put a card into your hand or you exile two cards with the same name/.test(full)){
    const names = new Set();
    while (S.lib.length){ const c = S.lib.shift(); S.ex.push(c); const nm = cname(c);
      if (names.has(nm)){ log(`${ctx.name}: exiled a second ${nm} — stops`); break; } names.add(nm);
      const take = UI.dry ? true : await askYes(`${ctx.name}: exiled ${nm}. Put it into your hand?`, 'Take it', 'Keep going');
      if (take){ S.ex.splice(S.ex.indexOf(c), 1); S.hand.push(c); log(`${ctx.name}: put ${nm} into their hand after exiling ${names.size} card${names.size === 1 ? '' : 's'}`); break; } }
    ctx.pactDone = true; commit(); return true; }
  if (ctx.pactDone && /^(you may put that card into your hand|repeat this process)/.test(l)) return true;
  // Intuition / Gifts Ungiven: an opponent chooses
  if ((m = l.match(/^search your library for (three|up to four) cards(?: with different names)? and reveal them$/))){
    const max = m[1] === 'three' ? 3 : 4; const seen = new Set();
    const ids = UI.dry ? S.lib.slice(0, max).map(c => c.id) : await pickCards({title:`${ctx.name}: search for ${m[1]} cards${max === 4 ? ' with different names' : ''}`, cards:S.lib.slice().sort((a, b) => cname(a).localeCompare(cname(b))), min:m[1] === 'three' ? Math.min(3, S.lib.length) : 0, max});
    ctx.found = (ids || []).map(id => S.lib.find(c => c.id === id)).filter(c => c && (max === 3 || !seen.has(cname(c)) && seen.add(cname(c))));
    log(`${ctx.name}: revealed ${ctx.found.map(cname).join(', ') || 'nothing'}`); return true; }
  if ((m = l.match(/^target opponent chooses (one|two) of those cards$/)) || (m = l.match(/^target opponent chooses (one)$/))){
    const t = tgt(); const pid = t && t.pid !== MYPID ? t.pid : opponents()[0]?.pid; const n = m[1] === 'two' ? 2 : 1; const list = ctx.found || [];
    ctx.oppChose = !list.length ? [] : list.length <= n ? list.map(c => c.id) : pid ? await r22oppPick(pid, list, n, `choose ${m[1]} for ${nameOf(MYPID)}`, ctx.name) : list.slice(0, n).map(c => c.id);
    log(`${pid ? nameOf(pid) : 'the opponent'} chose ${ctx.oppChose.map(id => cname(list.find(c => c.id === id))).join(', ')}`); return true; }
  if ((m = l.match(/^put that card into your hand and the rest into your graveyard$/)) && ctx.found){ ctx.found.forEach(c => { const i = S.lib.indexOf(c); if (i < 0) return; S.lib.splice(i, 1); if ((ctx.oppChose || []).includes(c.id)) S.hand.push(c); else S.gy.push(c); }); commit(); return true; }
  if ((m = l.match(/^put the chosen cards into your graveyard and the rest into your hand$/)) && ctx.found){ ctx.found.forEach(c => { const i = S.lib.indexOf(c); if (i < 0) return; S.lib.splice(i, 1); if ((ctx.oppChose || []).includes(c.id)) S.gy.push(c); else S.hand.push(c); }); commit(); return true; }
  // Tataru Taru: target opponent may draw
  if ((m = l.match(/^you draw a card and target opponent may draw a card$/))){ draw(1); const t = tgt(); const pid = t && t.pid !== MYPID ? t.pid : null; if (pid) sendRq(pid, 'r22mayDraw', 0, ctx.name); commit(); return true; }
  if ((m = l.match(/^target opponent may draw a card$/))){ const t = tgt(); const pid = t && t.pid !== MYPID ? t.pid : null; if (pid) sendRq(pid, 'r22mayDraw', 0, ctx.name); commit(); return true; }
  // Exhibition Tidecaller: ten instead of three when five or more mana was spent
  if ((m = l.match(/^if five or more mana was spent to cast that spell, that player mills ten cards instead$/))) return true;
  if ((m = l.match(/^target player mills three cards$/)) && /if five or more mana was spent to cast that spell, that player mills ten cards instead/.test(full)){
    const spent = ctx.it && ctx.it.evMV != null ? ctx.it.evMV : (ctx.it && ctx.it.evSpent) || 0; const n = spent >= 5 ? 10 : 3;
    await doSentence(`Target player mills ${n === 10 ? 'ten' : 'three'} cards`, {...ctx, full:''}); return true; }
  // Jace, the Mind Sculptor −12 / Subtlety / Chain of Vapor
  if ((m = l.match(/^exile all cards from target player's library, then that player shuffles their hand into their library$/))){ const t = tgt(); const pid = t ? t.pid : MYPID;
    if (pid === MYPID){ S.ex.push(...S.lib.splice(0)); S.lib.push(...S.hand.splice(0)); shuffle(S.lib); log(`${ctx.name}: exiled their library and shuffled their hand into it`); }
    else { sendRq(pid, 'r22exLib', 0, ctx.name); log(`${ctx.name}: ${nameOf(pid)} exiles their library and shuffles their hand in`); }
    commit(); return true; }
  // Nullpriest of Oblivion etc.: "if it was kicked, …" on an ETB trigger
  if ((m = l.match(/^if it was kicked, (.+)$/))){ const c = srcCardOf(ctx); if ((c && c.kicked) || (ctx.it && ctx.it.kicked)) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); else log(`${ctx.name}: wasn't kicked`); return true; }

  // Demonic Consultation when split into two sentences
  if ((m = l.match(/^exile the top six cards of your library$/)) && /until you reveal a card with the chosen name/.test(full)){ S.lib.splice(0, 6).forEach(c => S.ex.push(c)); log(`${ctx.name}: exiled the top six cards`); commit(); return true; }
  if ((m = l.match(/^(?:then )?reveal cards from the top of your library until you reveal a card with the chosen name$/))){
    const rev = []; let hit = null; while (S.lib.length){ const c = S.lib.shift(); if (ctx.chosenName && cname(c) === ctx.chosenName){ hit = c; break; } rev.push(c); }
    rev.forEach(c => S.ex.push(c)); if (hit) S.hand.push(hit); log(`${ctx.name}: revealed ${rev.length + (hit ? 1 : 0)} cards${hit ? `, found ${cname(hit)}` : ' — the named card was not found'}`); ctx.chosenName = ctx.chosenName || ''; commit(); return true; }
  // Chrome Mox imprint as a trigger
  if ((m = l.match(/^(?:you may )?exile a nonartifact, nonland card from your hand$/))){
    const c = srcCardOf(ctx); if (UI.dry || (c && (c.imp || c.impAsked))) return true;
    if (c) c.impAsked = 1;
    const list = S.hand.filter(x => !isLand(x.k) && !/Artifact/.test(info(x.k)?.t || '')); const ids = list.length ? await pickCards({title:`${ctx.name}: imprint — exile a nonartifact, nonland card from your hand`, cards:list, min:0, max:1, noneLabel:"Don't"}) : [];
    if (ids && ids[0]){ const x = S.hand.find(y => y.id === ids[0]); moveCard(x.id, 'ex'); if (c) c.imp = x.k; log(`${ctx.name} imprinted ${cname(x)}`); } commit(); return true; }
  // Tataru Taru: "if it isn't that player's turn"
  if ((m = l.match(/^if it isn't (?:target|that) player's turn, (.+)$/))){ const pid = ctx.it && (ctx.it.evPid || ctx.it.evDp); if (pid && currentTurn()[1] !== pid){ if (S.oncePer && S.oncePer[ctx.name] === turnStr()) return true; S.oncePer = {...(S.oncePer || {}), [ctx.name]:turnStr()}; await doSentence(cap(s.slice(s.length - m[1].length)), ctx); } return true; }
  if (/^this ability triggers only once each turn$/.test(l)) return true;
  // Charismatic Conqueror
  if ((m = l.match(/^they may tap that permanent$/))){ const pid = ctx.it && ctx.it.evPid; const id = ctx.it && ctx.it.evId;
    if (!pid || pid === MYPID){ ctx.theyDid = true; return true; }
    const nm = info(ctx.it.evK)?.n || 'it';
    ctx.theyDid = await r22ask(pid, `tap ${nm}? If you don't, ${nameOf(MYPID)} creates a 1/1 Vampire`, ctx.name);
    if (ctx.theyDid && id != null) applyTo({pid, id}, {op:'tap', src:ctx.name});
    log(`${nameOf(pid)} ${ctx.theyDid ? 'tapped' : "didn't tap"} ${nm}`); commit(); return true; }
  if ((m = l.match(/^if they don't, (.+)$/)) && ctx.theyDid !== undefined){ if (!ctx.theyDid) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true; }
  // Jace, the Mind Sculptor +2: bottom of target player's library
  if ((m = l.match(/^you may put that card on the bottom of that player's library$/)) || (m = l.match(/^put that card on the bottom of target player's library$/))){
    const t = ctx.lastTgt || (ctx.tgtsAll || [])[0]; const pid = t && t.pid ? t.pid : MYPID;
    if (UI.dry) return true;
    if (pid === MYPID){ const c = S.lib[0]; if (c && await askYes(`${ctx.name}: put ${cname(c)} on the bottom?`, 'Bottom', 'Leave it')){ S.lib.push(S.lib.shift()); log(`${ctx.name}: put the top card on the bottom`); } }
    else { const top = (OPP.get(pid)?.lt0) || null; if (await askYes(`${ctx.name}: put the top card of ${nameOf(pid)}'s library on the bottom?`, 'Bottom', 'Leave it')){ sendRq(pid, 'r22libTop', 0, ctx.name); log(`${ctx.name}: ${nameOf(pid)}'s top card goes to the bottom`); } }
    commit(); return true; }
  // Triumph of Saint Katherine
  if ((m = l.match(/^exile it and the top six cards of your library in a face-down pile$/))){ const id = ctx.it && ctx.it.evId; const i = id != null ? S.gy.findIndex(c => c.id === id) : S.gy.findIndex(c => cname(c) === ctx.name); const pile = S.lib.splice(0, 6); if (i >= 0) pile.push(S.gy.splice(i, 1)[0]); ctx.tskPile = pile; log(`${ctx.name}: exiled itself and the top six cards face down`); return true; }
  if ((m = l.match(/^if you do, shuffle that pile and put it back on top of your library$/)) && ctx.tskPile){ const p = ctx.tskPile; shuffle(p); S.lib.unshift(...p); ctx.tskPile = null; log(`${ctx.name}: shuffled the pile and put it on top`); commit(); return true; }
  // Council's Judgment
  if ((m = l.match(/^starting with you, each player votes for a nonland permanent you don't control$/))){
    const cands = []; for (const [pid, st] of OPP) (st.bf || []).forEach(b => { if (b.k && !isLand(b.k) && !b.fd) cands.push({pid, id:b.id, k:b.k}); });
    if (!cands.length){ log(`${ctx.name}: nothing to vote for`); ctx.voteWin = []; return true; }
    const cards = cands.map((x, i) => ({id:-5000 - i, k:x.k}));
    const mine = UI.dry ? [cards[0].id] : await pickCards({title:`${ctx.name}: your vote`, cards, min:1, max:1});
    const others = await r22pickMany(opponents().map(p => p.pid), cards, 1, 'vote for a permanent', ctx.name);
    const tally = new Map(); [mine, ...others].forEach(v => (v || []).forEach(id => tally.set(id, (tally.get(id) || 0) + 1)));
    const top = Math.max(...tally.values()); const win = [...tally].filter(([, n]) => n === top).map(([id]) => cands[-5000 - id]);
    ctx.voteWin = win; log(`${ctx.name}: votes — ${[...tally].map(([id, n]) => info(cards[-5000 - id].k)?.n + ' ' + n).join(', ')}`); return true; }
  if ((m = l.match(/^exile each permanent with the most votes or tied for most votes$/)) && ctx.voteWin){ ctx.voteWin.forEach(x => applyTo({pid:x.pid, id:x.id}, {op:'exile', src:ctx.name})); commit(); return true; }

  if ((m = l.match(/^exile all cards from target player's library$/))){ const t = tgt(); const pid = t ? t.pid : MYPID; ctx.jPid = pid; if (pid === MYPID){ S.ex.push(...S.lib.splice(0)); } else sendRq(pid, 'r22exLib', 0, ctx.name); log(`${ctx.name}: exiled ${pid === MYPID ? 'their' : nameOf(pid) + "'s"} library`); commit(); return true; }
  if ((m = l.match(/^(?:then )?(?:target|that) player shuffles their hand into their library$/))){ const pid = ctx.jPid || ((ctx.tgtsAll || [])[0] || {}).pid || MYPID; if (pid === MYPID){ S.lib.push(...S.hand.splice(0)); shuffle(S.lib); log(`${ctx.name}: shuffled their hand into their library`); } else sendRq(pid, 'r22handLib', 0, ctx.name); commit(); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound22Pre(s, l, ctx)) return; return ds(s0, ctx); };
}
// Approach goes 7th from the top after it resolves (instead of the graveyard)
{
  const rt = resolveTop;
  resolveTop = async function(it, ...a){
    const r = await rt(it, ...a);
    try { if (it && it.kind === 'spell' && it.card && /otherwise, put .+? into its owner's library seventh from the top/i.test(info(it.card.k)?.o || '')){
      const i = S.gy.findIndex(c => c.id === it.card.id); const won = S.won === turnStr();
      if (i >= 0 && !won){ const [c] = S.gy.splice(i, 1); S.lib.splice(Math.min(6, S.lib.length), 0, c); log(`${cname(c)} went into the library 7th from the top`); commit(); } } } catch (e){ console.warn(e); }
    return r;
  };
}
// statics recognised here
STATIC_RULES.push(
  [/^your maximum hand size is (five|four|three|two|one|\d+)$/, m => ({kind:'maxHand', who:'you', n:wn(m[1]) || +m[1]})],
  [/^if a card or token would be put into your graveyard from anywhere, exile it instead$/, m => ({kind:'gyToExileSelf', who:'you'})],
);
{
  // maximum hand size from Necrodominance-style statics (five instead of seven)
  const ch = cleanupHand;
  cleanupHand = async function(){
    const r = rulesOn('maxHand').filter(x => x.pid === MYPID); if (!r.length) return ch();
    const max = Math.min(...r.map(x => x.n)); const over = S.hand.length - max;
    if (over <= 0 || noMaxHand()) return;
    let ids = null;
    while (!ids){ ids = await pickCards({title:`Cleanup: discard ${over} card${over > 1 ? 's' : ''} (maximum hand size ${max})`, cards:S.hand.slice(), min:over, max:over, noClose:true}); }
    ids.forEach(id => moveCard(id, 'gy', {manual:true})); log(`discarded down to ${max}`);
  };
}
// Necrodominance: my cards go to exile instead of my graveyard
{
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ try { if (S && to === 'gy' && rulesOn('gyToExileSelf').some(r => r.pid === MYPID)){ const [z, , c] = find(id); if (c && !c.own) { log(`${cname(c)} was exiled instead of going to the graveyard`); return mc(id, 'ex', o); } } } catch {} return mc(id, to, o); };
}
function curMaxHand(){ try { const r = rulesOn('maxHand').filter(x => x.pid === MYPID); return r.length ? Math.min(...r.map(x => x.n)) : 7; } catch { return 7; } }

// "When ~ is put into your graveyard from the battlefield" = dies
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){ return ct(w, String(c).replace(/ is put into your graveyard from the battlefield$/, ' is put into a graveyard from the battlefield')); };
}
