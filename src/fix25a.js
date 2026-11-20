/* ===== fix25a: every loop asks "how many times?" + known-combo memory ===== */
// 1) Loops you do by hand: the table keeps a quiet shadow log of your last actions. When the same sequence of
//    actions happens twice in a row (three times for a single action) and your board is back where it started,
//    it asks how many more times to run it and repeats it for you (same engine as Record a loop → Repeat).
// 2) Loops nobody chooses (mandatory triggers): after 20 triggers in a row it asks how many more times instead
//    of only offering Stop / Keep going.
// 3) Known combos (combos25.js, the most-played Commander combos): the table tells you when all pieces are
//    assembled, and Game ▾ → Combos in my deck lists the ones your list contains.
const F25 = {sh:[], asked:{}, bud:{}, seen:{}, deck:null, kAsk:{}, resN:0, resAt:new Map()};
{ const rt = resolveTop; resolveTop = async function(){ F25.resN++; return rt.apply(this, arguments); }; }
// a new game (or a new deck) starts the loop / combo memory over
function f25sync(){ if (F25.S !== S){ F25.S = S; F25.sh = []; F25.asked = {}; F25.seen = {}; F25.bud = {}; F25.deck = null; F25.lastChk = ''; } }
function f25quiet(){ f25sync(); return !S || UI.f25off || UI.replay || UI.dry || UI.rec || (typeof M19 !== 'undefined' && M19.probe) || (typeof BOT !== 'undefined' && BOT.on) || loopActive(); }
const f25ctr = o => { if (!o || typeof o !== 'object') return ''; const e = Object.entries(o).filter(([, v]) => v).sort(); return e.length ? JSON.stringify(e) : ''; };
// counters are compared separately from the board (f25ctrN): growing counters is a gain, losing them is a cost
function f25ctrN(){ try { return S.bf.filter(c => !c.tok && !c.token && !(info(c.k)?.tok)).reduce((x, c) => x + (c.cp || 0) + Object.values(c.nc || {}).reduce((a, v) => a + (+v || 0), 0), 0); } catch { return 0; } }
function f25sig(){
  try { return S.bf.filter(c => !c.tok && !c.token && !(info(c.k)?.tok)).map(c => `${c.k}${c.tap ? 'T' : ''}`).sort().join('|'); } catch { return String(Math.random()); }
}
// what a loop's answers mean, without card ids (picks of tokens get new ids every time): targets keep who/what they hit
const f25ans = e => { try { const f = v => Array.isArray(v) ? v.map(f) : (v && typeof v === 'object') ? (v.pid !== undefined || v.t ? `${v.t || ''}:${v.pid === MYPID ? 'me' : v.pid || ''}:${v.nm || (v.k && info(v.k)?.n) || ''}` : '{}') : typeof v === 'number' ? '#' : v; return JSON.stringify((e.ans || []).map(f)); } catch { return ''; } };
const f25same = (a, b) => a.t === b.t && a.k === b.k && (a.ai ?? -1) === (b.ai ?? -1) && (a.zone || '') === (b.zone || '') && (a.ch ?? 0) === (b.ch ?? 0);
{ const ra = recAct; recAct = function(a){
    try { if (!f25quiet() && a){ const a2 = (a.t === 'mana' && typeof R21REC !== 'undefined' && R21REC) ? {...a, ai:R21REC.ai, ch:R21REC.ch} : {...a}; F25.sh.push({a:a2, ans:[], loss:{}, sig:f25sig(), pool:Object.values(S.pool || {}).reduce((x, y) => x + (+y || 0), 0), tok:S.bf.filter(c => c.tok || c.token || info(c.k)?.tok).reduce((x, c) => x + (c.n || 1), 0), life:S.life, ctr:f25ctrN(), lib:S.lib.length, hand:S.hand.length, olib:[...OPP.values()].reduce((x, o) => x + (o.lc || 0), 0), T:turnStr()}); if (F25.sh.length > 40) F25.sh.shift(); f25check(); } } catch (e){ console.warn('f25 rec', e); }
    return ra.apply(this, arguments); };
  const rn = recAns; recAns = function(p){
    const e = (!f25quiet() || UI.f25run) ? F25.sh[F25.sh.length - 1] : null;
    return rn.call(this, p).then(v => { try { if (e && !UI.replay) e.ans.push(v && v.map ? v.map(x => (typeof x === 'object' && x) ? {...x} : x) : v); } catch {} return v; }); };
  const sr = sendRq; sendRq = function(to, op, n){
    try { if (op === 'life' && n < 0) F25.drainAt = Date.now(); if (op === 'life' && n < 0 && !UI.replay){ const e = F25.sh[F25.sh.length - 1]; if (e) e.loss[to] = (e.loss[to] || 0) - n; } } catch {}
    return sr.apply(this, arguments); };
}
// Look for a repeated block at the end of the shadow log.
function f25find(){
  const L = F25.sh, T = turnStr();
  for (let k = 1; k <= 10; k++){
    const reps = k === 1 ? 3 : 2; if (L.length < k * reps) continue;
    const blocks = []; for (let r = 0; r < reps; r++) blocks.push(L.slice(L.length - k * (r + 1), L.length - k * r));
    if (blocks.some(b => b[0].T !== T)) continue;
    if (!blocks.every((b, r) => b.every((e, i) => f25same(e.a, blocks[0][i].a) && (r > 1 || f25ans(e) === f25ans(blocks[0][i]))))) continue;   // same actions with the same answers (targets)
    if (!blocks.every(b => b[0].sig === blocks[0][0].sig)) continue;
    if (blocks.some((b, r) => r > 0 && blocks[r - 1][0].pool < b[0].pool)) continue;   // costs mana every time (a pump, firebreathing…): not a loop
    if (blocks.some((b, r) => r > 0 && blocks[r - 1][0].tok < b[0].tok)) continue;   // uses up tokens each time (sacrificing Squirrels one by one): not a loop
    if (f25sig() === blocks[0][0].sig && L.length && (S.bf.filter(c => c.tok || c.token || info(c.k)?.tok).reduce((x, c) => x + (c.n || 1), 0)) < blocks[0][0].tok) continue;
    const nw = blocks[0], ol = blocks[1];
    if (nw[0].ctr < ol[0].ctr) continue;
    if (nw[0].hand < ol[0].hand) continue;   // uses up cards from hand each time (three copies of the same spell): not a loop   // uses up counters each time (Walking Ballista pinging): not a loop
    if (nw[0].life < ol[0].life && !ol.some(e => Object.values(e.loss).some(n => n > 0))) continue;   // costs life each time (Necropotence): not a loop
    const gain = nw[0].pool > ol[0].pool || nw[0].ctr > ol[0].ctr || nw[0].tok > ol[0].tok || nw[0].life > ol[0].life || nw[0].lib < ol[0].lib || nw[0].hand > ol[0].hand || nw[0].olib <= ol[0].olib - 2 || ol.some(e => Object.values(e.loss).some(n => n > 0));
    const known = !gain && (() => { const c = f25comboFor([...nw.map(e => e.a.k), ...S.bf.map(x => x.k)]); return c && c.low.every(n => S.bf.some(x => f25nm(x.k) === n) || nw.some(e => f25nm(e.a.k) === n)) && nw.some(e => c.low.includes(f25nm(e.a.k))); })();
    if (!gain && !known) continue;   // repeats but gains nothing (a free ability used three times) and isn't a known combo: not worth asking
    return {k, last:blocks[0], prev:blocks[1]};
  }
  return f25findKnown();
}
// Known combo, all pieces out: one time round is enough. The board is back where it started, something was gained,
// and the steps used a piece of a known infinite combo whose other pieces are on the battlefield.
function f25findKnown(){
  if (window.__f25twice) return null;   // (tests of the two-times-round check)
  try { const L = F25.sh, T = turnStr(), sig = f25sig();
    const now = {pool:Object.values(S.pool || {}).reduce((x, y) => x + (+y || 0), 0), tok:S.bf.filter(c => c.tok || c.token || info(c.k)?.tok).reduce((x, c) => x + (c.n || 1), 0), life:S.life, ctr:f25ctrN(), lib:S.lib.length, hand:S.hand.length, olib:[...OPP.values()].reduce((x, o) => x + (o.lc || 0), 0)};
    const names = new Set(S.bf.filter(x => !x.fd).map(x => f25nm(x.k)));
    for (let k = 2; k <= 10 && k <= L.length; k++){
      const B = L.slice(L.length - k), s0 = B[0];
      if (B.some(e => e.T !== T) || s0.sig !== sig) continue;
      const loss = B.some(e => Object.values(e.loss).some(n => n > 0));
      if (now.life < s0.life && !loss) continue; if (now.tok < s0.tok || now.ctr < s0.ctr) continue; if (now.hand < s0.hand) continue;
      if (!(now.pool > s0.pool || now.tok > s0.tok || now.ctr > s0.ctr || now.life > s0.life || now.lib < s0.lib || now.hand > s0.hand || now.olib <= s0.olib - 2 || loss)) continue;
      const used = new Set(B.map(e => f25nm(e.a.k)));
      const e = [...used].flatMap(n => F25C.get(n) || []).find(c => c.res.some(r => /^infinite/i.test(r)) && c.low.every(n => names.has(n) || used.has(n)));
      if (!e) continue;
      // the steps must not be the same short step repeated (that is the normal two-time check's job)
      if (k >= 2 && B.every(x => f25same(x.a, B[0].a))) continue;
      return {k, last:B, prev:null, known:e};
    }
  } catch (e){ console.warn('f25 known hand', e); }
  return null;
}
function f25check(){
  if (UI.f25wait) return; UI.f25wait = 1;
  (async () => {
    try {
      if (!(await waitStack(15000))) return; await sleep(80);
      { const n0 = F25.sh.length; if (n0 && F25.sh[n0 - 1].a.t === 'mana'){ await sleep(4000); if (F25.sh.length !== n0) return; } }   // just tapped for mana: the player is probably mid-way, so wait to see if they go on
      if (f25quiet() || UI.modal) return;
      const hit = f25find(); if (!hit) return;
      if (hit.last[0].sig !== f25sig()) return;   // board didn't come back to the start
      const key = turnStr() + ':' + hit.last.map(e => e.a.t + e.a.k + (e.a.ai ?? '')).join(',');
      if (F25.asked[key]) return; F25.asked[key] = 1;
      await f25offer(hit.last);
    } catch (e){ console.warn('f25 check', e); } finally { UI.f25wait = 0; }
  })();
}
function f25label(a){ const nm = info(a.k)?.n || 'a card'; return a.t === 'cast' ? `cast ${nm}${a.zone && a.zone !== 'hand' ? ` (from ${({gy:'graveyard', ex:'exile', cz:'command zone', lib:'library'})[a.zone] || a.zone})` : ''}` : a.t === 'mana' ? `tap ${nm} for mana` : `activate ${nm}`; }
async function f25offer(block, opts = {}){ UI.f25off = 1; try { return await f25offer0(block, opts); } finally { UI.f25off = 0; } }
async function f25offer0(block, opts = {}){
  const loss = {}; block.forEach(e => Object.entries(e.loss).forEach(([p, n]) => loss[p] = (loss[p] || 0) + n));
  const per = Object.entries(loss).filter(([, n]) => n > 0);
  let need = 0; for (const [pid, n] of per){ const s = OPP.get(pid); if (s && (s.life ?? 1) > 0) need = Math.max(need, Math.ceil(Math.max(1, s.life) / n)); }
  const steps = block.map(e => f25label(e.a)); const combo = f25comboFor(block.map(e => e.a.k));
  const o = [];
  if (need) o.push({label:`Until every opponent is dead (${need} more time${need === 1 ? '' : 's'})`, value:'dead'});
  o.push({label:'Repeat it — how many times?', value:'n'});
  o.push({label:"It's not a loop — I'll keep playing by hand", value:'no'});
  const v = await askChoice({title: opts.title || `This looks like a loop${combo ? ` — ${combo.cards.join(' + ')}` : ''}`,
    text:`Each time: ${steps.join(' → ')}.${per.length ? ` Each loop drains ${per.map(([pid, n]) => `${nameOf(pid)} ${n}`).join(', ')}.` : ''}${combo && combo.res.length ? ` Known combo: ${combo.res.slice(0, 3).join('; ')}.` : ''}`, options:o});
  if (!v || v === 'no') return false;
  let n = need; if (v === 'n'){ n = await askNumber('Repeat the loop how many more times?', 'Any number — 999 counts as "as many as I want"', 10); if (!n) return false; }
  n = clamp(n, 1, 999);
  UI.recDone = {acts:block.map(e => ({...e.a})), ans:block.flatMap(e => e.ans), loss, life0:S.life, f25blk:block};
  const it = {sid:rid(6), o:nextO(), kind:'ability', k:null, nm:`Repeat loop ×${n}`, txt:`Repeat the loop (${steps.join(' → ')}) ${n} times${v === 'dead' ? ' (lethal)' : ''}.`, op:'loop', n};
  S.stk.push(it); S.pass = 's:' + it.sid; log(`wants to repeat a loop ${n} times (${steps.join(' → ')})${v === 'dead' ? ' — that is lethal for every opponent' : ''}`); commit();
  F25.sh = []; return true;
}

// 2) Mandatory trigger loops: ask how many more times (replaces fix24a's Stop / Keep going).
{ const pt = pushTrigger; const hist = new Map();
  pushTrigger = function(src, t, ev, evPid){
    try { if (src && src.k && !UI.dry && !UI.replay && !(typeof M19 !== 'undefined' && M19.probe)){
        f25sync(); const k = src.k, T = turnStr(), now = Date.now();
        let b = F25.bud[k]; if (b && (b.T !== T || now - b.last > 5000)){ delete F25.bud[k]; b = null; }
        if (b){ b.last = now; if (b.left-- > 0) return pt.apply(this, arguments); delete F25.bud[k]; UI.f24blk[k] = T; (UI.f25blkAt ||= {})[k] = now; log(`${info(k)?.n || 'A card'}: the loop ran the chosen number of times and stops`); return; }
        if (UI.f24blk && UI.f24blk[k] === T){   // a stopped loop: keep it stopped while it is still trying, then let the card work again
          UI.f25blkAt ||= {}; if (!UI.f25blkAt[k] || now - UI.f25blkAt[k] > 10000){ delete UI.f24blk[k]; delete UI.f25blkAt[k]; hist.delete(k); }
          else { UI.f25blkAt[k] = now; if (UI.f24ask) (F25.drop ||= {})[k] = [...arguments]; return pt.apply(this, arguments); } }
        if (now - (F25.lastTrigAt || 0) > 8000) hist.clear(); F25.lastTrigAt = now; const h = hist.get(k) || []; if (!(F25.resAt.get(k) >= F25.resN)){ h.push(now); F25.resAt.set(k, F25.resN); } hist.set(k, h);   // only counts when something resolved since this card last triggered — a board wipe that triggers Blood Artist 25 times at once is not a loop   // counts while the chain keeps going (each trigger within 8 s of the last), however long it takes
        const kn = !UI.f24ask && !(typeof BOT !== 'undefined' && BOT.on) ? f25knownTrig(k) : null;
        if ((h.length >= 10 || kn) && !UI.f24ask && !(typeof BOT !== 'undefined' && BOT.on)){
          UI.f24ask = 1; const nm = info(k)?.n || 'A card'; if (kn) F25.kAsk[kn.e.rank] = T;
          const hot = kn ? kn.keys : [...hist].filter(([kk, hh]) => hh.length >= 5).map(([kk]) => kk);
          hot.forEach(kk => { UI.f24blk[kk] = T; (UI.f25blkAt ||= {})[kk] = now; });
          const combo = f25comboFor(hot);
          (async () => { try {
              const opp = opponents().some(p => (p.s?.life ?? 1) > 0) && (kn || Date.now() - (F25.drainAt || 0) < 30000);
              const v = await askChoice({title:`${hot.map(kk => info(kk)?.n).filter(Boolean).join(' + ') || nm} — this loop would go on forever`, text:`${kn ? `${kn.e.cards.join(' + ')} is an infinite loop.` : `${nm} has triggered ${h.length} times in a row.`}${combo && combo.res.length ? ` Known combo: ${combo.res.slice(0, 3).join('; ')}.` : ''} How many more times should it go round?${hot.some(kk => /\bdraws?\b/i.test(info(kk)?.o || '')) ? ` Your library has ${S.lib.length} card${S.lib.length === 1 ? '' : 's'}: the loop stops before you'd draw from an empty library.` : ''}`,
                options: opp ? [{label:'Until every opponent is dead (or it can\'t go on)', value:'all'}, {label:'A number of times…', value:'n'}, {label:'Stop the loop here', value:'stop'}]
                             : [{label:'Stop the loop here', value:'stop'}, {label:'A number of times…', value:'n'}]});
              let n = 0;
              if (v === 'all') n = 1000; else if (v === 'n') n = await askNumber('Run the loop how many more times?', 'Each card in the loop triggers this many more times', 10) || 0;
              if (n > 0){ hot.forEach(kk => { delete UI.f24blk[kk]; F25.bud[kk] = {T, left:n, last:Date.now()}; hist.set(kk, []); }); log(`${nm}: letting the loop run ${v === 'all' ? 'until every opponent is dead' : n + ' more times'}`); f25restart(hot, T); }
              else { log(`${nm}: stopped an endless loop (CR 104.4b — the game would be a draw if nobody could stop it)`); S.stk = S.stk.filter(i => !hot.includes(i.k) || i.kind !== 'trigger'); commit(); }
            } finally { UI.f24ask = 0; } })();
          (F25.drop ||= {})[k] = [...arguments]; return; } } } catch (e){ console.warn('f25 loop', e); }
    return pt.apply(this, arguments); }; }
// The trigger that hit the limit was dropped while we asked; if nothing of the loop is left on the stack, re-fire it.
F25.lastTrig = {};
{ const pt = pushTrigger; pushTrigger = function(src, t, ev, evPid){ try { if (src && src.k) F25.lastTrig[src.k] = {src, t, ev, evPid}; } catch {} return pt.apply(this, arguments); }; }
function f25restart(hot, T){
  // re-fire every trigger of the loop that was held back while the question was open
  const D = F25.drop || {}; F25.drop = {}; const keys = Object.keys(D).filter(k => hot.includes(k) || hot.includes(+k));
  if (keys.length){ for (const k of keys){ try { pushTrigger(...D[k]); } catch (e){ console.warn('f25 restart', e); } } commit(); return; }
  if (S.stk.some(i => hot.includes(i.k))) return;
  const k = hot.find(kk => F25.lastTrig[kk]); const L = k && F25.lastTrig[k]; if (!L) return;
  try { pushTrigger(L.src, L.t, L.ev, L.evPid); commit(); } catch (e){ console.warn('f25 restart', e); }
}

// 3) Known combos.
const F25C = (() => { const m = new Map(); try { (typeof COMBOS25 !== 'undefined' ? COMBOS25 : []).forEach((r, i) => { const cards = r[0].split('|'); const e = {cards, low:cards.map(x => x.toLowerCase()), res:(r[1] || '').split(';').map(s => s.trim()).filter(Boolean), decks:r[2] || 0, rank:i + 1}; e.low.forEach(n => { if (!m.has(n)) m.set(n, []); m.get(n).push(e); }); }); } catch (e){ console.warn('combos25', e); } return m; })();
const f25nm = k => String(info(k)?.n || '').split(' // ')[0].toLowerCase();
function f25comboFor(keys){
  const names = new Set(keys.map(f25nm)); let best = null;
  names.forEach(n => (F25C.get(n) || []).forEach(e => { const hit = e.low.filter(x => names.has(x)).length; if (hit >= Math.min(2, e.low.length) && (!best || hit > best.hit || (hit === best.hit && e.rank < best.e.rank))) best = {e, hit}; }));
  return best ? best.e : null;
}
function f25deckCombos(){
  if (!S || !S.deck) return [];
  const names = new Set([...(S.deck.cmd || []), ...(S.deck.main || []).map(e => e.k || e)].map(f25nm));
  const seen = new Set(), out = [];
  names.forEach(n => (F25C.get(n) || []).forEach(e => { if (!seen.has(e) && e.low.every(x => names.has(x))){ seen.add(e); out.push(e); } }));
  return out.sort((a, b) => a.rank - b.rank);
}
function f25assembled(){
  if (f25quiet() || !S || !S.bf) return;
  const T = turnStr(); if (F25.lastChk === T + S.bf.length + ':' + S.hand.length) return; F25.lastChk = T + S.bf.length + ':' + S.hand.length;
  if (!F25.deck) F25.deck = f25deckCombos();
  const where = new Map(); const add = (z, list) => (list || []).forEach(c => { const n = f25nm(c.k); if (!where.has(n) || z === 'bf') where.set(n, z); });
  add('hand', S.hand); add('cz', S.cz); add('bf', S.bf);
  for (const e of F25.deck){
    if (F25.seen[e.rank]) continue;
    if (!e.low.every(n => where.has(n))) continue;
    const onBf = e.low.filter(n => where.get(n) === 'bf').length; if (!onBf) continue;
    F25.seen[e.rank] = 1;
    const msg = `Combo ready: ${e.cards.join(' + ')}${e.res.length ? ` (${e.res.slice(0, 2).join('; ')})` : ''}. Start it and the table asks how many times.`;
    log(msg); toast(msg.slice(0, 140));
  }
}
{ const cm = commit; commit = function(){ const r = cm.apply(this, arguments); try { if (!UI.f25c){ UI.f25c = setTimeout(() => { UI.f25c = 0; try { f25assembled(); } catch (e){ console.warn('f25 combo', e); } }, 400); } } catch {} return r; }; }
{ const gx = gameMenuExtra; gameMenuExtra = function(){ return gx.apply(this, arguments) + mb('f25combos', `Combos in my deck${F25C.size ? '' : ' (no list loaded)'}…`); }; }
Object.assign(ACT, {
  f25combos(){ closeMenu(); F25.deck = f25deckCombos(); const L = F25.deck;
    askChoice({title:`Known combos in this deck (${L.length})`, text: L.length ? 'From the most-played Commander combos. Do a loop once by hand and the table offers to repeat it.' : 'None of the most-played combos are complete in this list.',
      options: L.slice(0, 40).map(e => ({label:`${e.cards.join(' + ')}${e.res.length ? ' — ' + e.res.slice(0, 2).join('; ') : ''}`, value:e.rank})).concat([{label:'Close', value:'x'}])}); },
});

// 4) Loops that act while something is still on the stack (Rings of Brighthearth + Basalt Monolith: tap Basalt in
//    response to its own untap ability). Each recorded action remembers how many items were on the stack when it was
//    taken; a repeat waits only until the stack is back down to that depth before the next action.
{ const ra = recAct; recAct = function(a){ try { if (a && a.sd === undefined){ a.sd = stackAll().length; a.rs = F25.resN; } } catch {} return ra.apply(this, arguments); }; }
// the hold ends as soon as the repeat takes its next action
{ const am = activateMana; activateMana = function(){ if (UI.replay) delete UI.replay.stopAt; return am.apply(this, arguments); };
  const aa = activateAbility; activateAbility = function(){ if (UI.replay) delete UI.replay.stopAt; return aa.apply(this, arguments); };
  const bc = beginCast; beginCast = function(){ if (UI.replay) delete UI.replay.stopAt; return bc.apply(this, arguments); }; }
// while a repeat waits to act mid-stack, hold further resolutions so the stack doesn't run past that point
{ const rt = resolveTop; resolveTop = async function(){
    const t0 = Date.now(); while (UI.replay && UI.replay.stopAt !== undefined && F25.resN >= UI.replay.stopAt && Date.now() - t0 < 3000) await sleep(40);
    return rt.apply(this, arguments); }; }
{ const ws = waitStack; waitStack = async function(ms = 8000){
    const R = UI.replay, rec = UI.recDone;
    if (!R || !rec || !rec.acts || !rec.acts.some(a => a.sd > 0)) return ws.apply(this, arguments);
    delete R.stopAt; const i = R.i || 0; R.i = i + 1; const cur = rec.acts[i], next = rec.acts[i + 1];
    const start = R.mark ?? F25.resN;
    if (!next || !(next.sd > 0) || cur.rs === undefined || next.rs === undefined){ const r = await ws.apply(this, arguments); R.mark = F25.resN; return r; }
    R.stopAt = start + Math.max(0, next.rs - cur.rs);
    const t0 = Date.now();
    while (Date.now() - t0 < ms){ if (F25.resN >= R.stopAt && !UI.resolving && stackAll().length <= next.sd){ R.mark = F25.resN; return true; } await sleep(60); }
    delete R.stopAt; return false; }; }


// A known infinite combo made only of triggered abilities (Niv-Mizzet + Curiosity, Sanguine Bond + Exquisite Blood):
// when every piece is on your battlefield, its first trigger asks "how many times?" before the loop goes round.
function f25trigOnly(nm){ try { const c = S.bf.find(x => f25nm(x.k) === nm); const o = String((c && info(c.k)?.o) || ''); return /\bwhenever\b/i.test(o) && !/^[^\n"]*\{[^}]+\}[^\n"]*:/m.test(o.replace(/^.*\bwhenever\b.*$/gim, '')); } catch { return false; } }
function f25knownTrig(k){
  if (window.__f25noKnown) return null;   // (tests that pick every target themselves)
  try { const nm = f25nm(k), T = turnStr(); const L = F25C.get(nm); if (!L) return null;
    const mine = new Set(S.bf.filter(x => !x.fd).map(x => f25nm(x.k)));
    for (const e of L){ if (F25.kAsk[e.rank] === T || !e.res.some(r => /^infinite/i.test(r))) continue;
      if (!e.low.every(n => mine.has(n)) || !e.low.every(f25trigOnly)) continue;
      return {e, keys:[...new Set(S.bf.filter(x => e.low.includes(f25nm(x.k))).map(x => x.k))]}; } } catch (e){ console.warn('f25 known', e); }
  return null; }
