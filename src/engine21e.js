/* ===================== Rules engine — round 21E: exile-and-cast, other players' cards, stack manipulation ===================== */
// ---------- Lending: a card one player OWNS that another player may cast ----------
// Owner's client: the card stays in the owner's exile, an S.lent entry {ref, to, card, ex:1} remembers it, and S.r21L
// (published) tells the borrower {ref, to, k, tok, w}. The borrower's client builds a temporary copy in its own exile
// (c.own = {pid, ref}, c.r21) and may cast it. Casting it sends 'r21cast' (the owner hides the original); when the spell
// resolves/is countered it goes back to the OWNER's graveyard ('back'), and a permanent goes back when it leaves play.
// w (permission code): r = only during this resolution; otherwise c = cast / p = play, f = free, a = any mana,
// e = until end of turn, n = until the end of the borrower's next turn, l = as long as it remains exiled.
const R21_STR = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
function r21Lend(card, to, tok, w, src){
  const ref = rid(6);
  S.lent.push({ref, to, card, ex:1});
  (S.r21L ||= []).push({ref, to, k:card.k, tok:tok || '', w:w || 'r', src:R21_STR(src || '', 40)});
  if (S.r21L.length > 80) S.r21L.splice(0, S.r21L.length - 80);
  return ref;
}
function r21Unlist(ref){ if (S.r21L) S.r21L = S.r21L.filter(e => e.ref !== ref); }
function r21Perm(w, src){
  if (!w || /r/.test(w)) return null;
  return {t:turnStr(), next:/n/.test(w), cast:!/p/.test(w), src:src || '', u0:S.untapN, free:/f/.test(w), adv:/l/.test(w), any:/a/.test(w)};
}
// borrower: build temporary copies for new lends, drop copies whose lend has ended
function r21Sync(pid, s){
  if (!S) return; S.r21got ||= {}; UI.r21tok ||= {};
  for (const e of (s.r21L || [])){
    if (e.to !== MYPID || S.r21got[e.ref]) continue;
    S.r21got[e.ref] = 1;
    const c = {id:S.nid++, k:e.k, own:{pid, ref:e.ref}, r21:{tok:e.tok, w:e.w}};
    const mp = r21Perm(e.w, e.src); if (mp) c.mayPlay = mp;
    S.ex.push(c); (UI.r21tok[e.tok] ||= []).push(c.id);
    log(`${nameOf(pid)}'s ${cname(c)} is exiled for me${mp ? ` — I may ${mp.cast ? 'cast' : 'play'} it${mp.free ? ' without paying its mana cost' : ''}` : ''}`);
  }
  const live = new Set((s.r21L || []).filter(e => e.to === MYPID).map(e => e.ref));
  const gone = S.ex.filter(c => c.r21 && c.own && c.own.pid === pid && !live.has(c.own.ref));
  gone.forEach(c => S.ex.splice(S.ex.indexOf(c), 1));
  const keys = Object.keys(S.r21got); if (keys.length > 300) keys.slice(0, keys.length - 300).forEach(k => delete S.r21got[k]);
  if (gone.length) commit();
}
// borrower: give a temporary copy back (not cast). dest: '' stays exiled at the owner, 'bf' / 'gy' / 'libb'
function r21Drop(c, dest){
  if (!c) return; const i = S.ex.indexOf(c); if (i >= 0) S.ex.splice(i, 1);
  if (c.r21 && c.own) sendRq(c.own.pid, 'r21unlend', 0, cname(c), {ref:c.own.ref, d:dest || ''});
  else if (dest === 'bf' && i >= 0){ S.ex.push(c); moveCard(c.id, 'bf'); }
  else if (dest === 'gy' && i >= 0){ S.ex.push(c); moveCard(c.id, 'gy'); }
  commit();
}
// ask another player's client to do something and wait for its answer + the lent cards it reports
async function r21Ask(pid, op, n, src, extra){
  const tok = rid(6); UI.r21ack ||= {}; UI.r21tok ||= {};
  sendRq(pid, op, n, src, {...(extra || {}), ref:tok}); commit();
  if (UI.dry) return {tok, ids:[], n:0};
  toast(`Waiting for ${nameOf(pid)}…`);
  const a = await waitUntil(() => UI.r21ack[tok], 25000);
  if (!a){ log(`${src}: ${nameOf(pid)} didn't answer`); return {tok, ids:[], n:0, none:true}; }
  const want = a.n || 0;
  if (want) await waitUntil(() => (UI.r21tok[tok] || []).length >= want ? 1 : 0, 10000);
  return {tok, ids:(UI.r21tok[tok] || []).slice(), n:want, d:a.d || ''};
}
const r21Ack = (to, tok, n, src) => sendRq(to, 'r21ack', n, src || '', {ref:tok});
// owner: exile from the top until a card fits; lend the hit (and remember everything exiled for "the rest")
function r21Fits(c, desc){
  const d = String(desc || 'nonland').toLowerCase();
  if (d === 'nonland') return !isLand(c.k);
  if (d === 'any') return true;
  return descOk(c.k, d.replace(/ and\/or /g, ' or '));
}
function r21ExileUntil(desc, notName){
  const seen = []; let hit = null;
  while (S.lib.length){ const c = S.lib.shift(); seen.push(c); if (r21Fits(c, desc) && !(notName && cname(c) === notName)){ hit = c; break; } }
  S.ex.push(...seen); return {hit, seen};
}
function r21Remember(tok, cards){ if (!tok) return; UI.r21exd ||= {}; UI.r21exd[tok] = (UI.r21exd[tok] || []).concat(cards.map(c => c.id)); }
function r21Rest(tok, how){
  const ids = (UI.r21exd || {})[tok] || []; const cards = ids.map(id => S.ex.find(c => c.id === id)).filter(c => c && !(how === 'shuffle' && S.lent.some(l => l.card === c && l.ex)));
  cards.forEach(c => { const l = S.lent.find(x => x.card === c && x.ex); if (l){ S.lent.splice(S.lent.indexOf(l), 1); r21Unlist(l.ref); } });
  if (!cards.length) return;
  cards.forEach(c => S.ex.splice(S.ex.indexOf(c), 1));
  if (how === 'shuffle'){ S.lib.push(...cards); shuffle(S.lib); log(`shuffled ${cards.length} exiled card${cards.length === 1 ? '' : 's'} into their library`); }
  else { shuffle(cards); S.lib.push(...cards); log(`put ${cards.length} exiled card${cards.length === 1 ? '' : 's'} on the bottom of their library in a random order`); }
  commit();
}
function r21Show(r, from){
  const what = String(r.d || 'lib');
  let list = [];
  if (what === 'void') list = S.ex.filter(c => c.r21void && !S.lent.some(l => l.card === c));
  else list = r.n > 0 ? S.lib.slice(0, r.n) : S.lib.slice();
  S.r21show = {ref:r.ref, to:from, ks:list.map(c => c.k), ids:list.map(c => c.id), what};
  if (what === 'lib') log(`${nameOf(from)} ${r.n > 0 ? `looks at the top ${list.length} card${list.length === 1 ? '' : 's'} of` : 'searches'} my library (${r.src})`);
  commit();
}
// owner: carry out the borrower's choice from the shown cards
function r21Take(r, from){
  const sh = S.r21show; if (!sh || sh.ref !== r.ref){ r21Ack(from, r.ref, 0, r.src); return; }
  const [mode, rest, w] = String(r.d || '').split('|'); S.r21show = null;
  const picks = String(r.n >= 0 ? r.n : '').split(',').filter(x => x !== '').map(Number);
  const idxs = mode === 'agent' ? String(rest || '').split(',').filter(x => x !== '').map(Number) : picks;
  const cards = idxs.map(i => sh.ids[i]).map(id => S.lib.find(c => c.id === id) || S.ex.find(c => c.id === id)).filter(Boolean);
  const shown = sh.ids.map(id => S.lib.find(c => c.id === id)).filter(Boolean);
  let n = 0;
  for (const c of cards){
    if (mode === 'give'){ const i = S.lib.indexOf(c); if (i < 0) continue; S.lib.splice(i, 1); const ref = rid(6); S.lent.push({ref, to:from, card:c, perm:true}); sendRq(from, 'give', 0, r.src, {ref, c:{k:c.k}, f:{}}); log(`${nameOf(from)} put ${cname(c)} from my library onto the battlefield under their control (${r.src})`); }
    else { const i = S.lib.indexOf(c); if (i >= 0){ S.lib.splice(i, 1); S.ex.push(c); } r21Lend(c, from, r.ref, mode === 'agent' ? 'pal' : (w || 'r'), r.src); n++; log(`exiled ${mode === 'lend' && !/p|c/.test(w || '') ? 'a card face down' : cname(c)} from my library for ${nameOf(from)} (${r.src})`); }
  }
  const left = shown.filter(c => !cards.includes(c) && S.lib.includes(c));
  if (sh.what === 'lib'){
    if (rest === 'b'){ left.forEach(c => S.lib.splice(S.lib.indexOf(c), 1)); shuffle(left); S.lib.push(...left); if (left.length) log(`put the other ${left.length} on the bottom of my library in a random order`); }
    else if (rest === 'g'){ left.forEach(c => moveCard(c.id, 'gy', {quiet:true})); if (left.length) log(`put the other ${left.length} into my graveyard (${r.src})`); }
    else if (rest === 's' || mode === 'agent' || mode === 'give') shuffleLib();
  }
  r21Ack(from, r.ref, n, r.src); commit();
}

/* ---------- requests ---------- */
RQ_OPS.push('r21gyEx', 'r21spellGive', 'r21gyLend', 'r21exGyAll', 'r21exU', 'r21exTop', 'r21exCard', 'r21exGy', 'r21ack', 'r21cast', 'r21unlend', 'r21rest', 'r21show', 'r21take', 'r21retgt', 'r21ctr', 'r21trick', 'r21tibalt', 'r21agent');
{
  const ao = applyOp;
  applyOp = function(r, from){
    switch (r.op){
      case 'r21exU': { const [desc, w] = String(r.d || 'nonland|r').split('|'); const {hit, seen} = r21ExileUntil(desc);
        log(`exiled ${seen.map(cname).join(', ') || 'nothing'} from the top of my library (${r.src})`); r21Remember(r.ref, seen);
        if (hit) r21Lend(hit, from, r.ref, w, r.src); r21Ack(from, r.ref, hit ? 1 : 0, r.src); commit(); return; }
      case 'r21exTop': { const top = S.lib.slice(0, clamp(r.n || 1, 0, 30)); top.forEach(c => { S.lib.splice(S.lib.indexOf(c), 1); S.ex.push(c); });
        log(`exiled the top ${top.length} card${top.length === 1 ? '' : 's'} of my library (${r.src}): ${top.map(cname).join(', ')}`); r21Remember(r.ref, top);
        top.forEach(c => r21Lend(c, from, r.ref, String(r.d || 'r'), r.src)); r21Ack(from, r.ref, top.length, r.src); commit(); return; }
      case 'r21exCard': { const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; let n = 0;
        if (c && !c.tok){ moveCard(c.id, 'ex', {quiet:true}); const e = S.ex.find(x => x.id === c.id); if (e){ log(`${cname(e)} was exiled (${r.src})`); r21Lend(e, from, r.ref, String(r.d || 'r'), r.src); n = 1; } }
        else if (c){ moveCard(c.id, 'ex', {quiet:true}); log(`${cname(c)} token was exiled (${r.src})`); }
        r21Ack(from, r.ref, n, r.src); commit(); return; }
      case 'r21exGy': { const all = S.gy.slice(); all.forEach(c => { S.gy.splice(S.gy.indexOf(c), 1); S.ex.push(c); }); log(`exiled my graveyard (${r.src}): ${all.length} card${all.length === 1 ? '' : 's'}`);
        all.forEach(c => r21Lend(c, from, r.ref, String(r.d || 'r'), r.src)); r21Ack(from, r.ref, all.length, r.src); commit(); return; }
      case 'r21gyLend': { const c = S.gy.find(g => g.k === r.d && !S.lent.some(l => l.card === g)); if (c){ r21Lend(c, from, r.ref, 'r', r.src); log(`${nameOf(from)} may cast ${cname(c)} from my graveyard (${r.src})`); } r21Ack(from, r.ref, c ? 1 : 0, r.src); commit(); return; }
      case 'r21gyEx': { const c = S.gy.find(g => g.k === r.d && !S.lent.some(l => l.card === g)); if (c){ moveCard(c.id, 'ex', {quiet:true}); const e = S.ex.find(x => x.id === c.id); if (e){ r21Lend(e, from, r.ref, 'r', r.src); log(`${cname(e)} was exiled from my graveyard (${r.src})`); } } r21Ack(from, r.ref, c ? 1 : 0, r.src); commit(); return; }
      case 'r21spellGive': { const it = S.stk.find(x => x.sid === r.d && x.kind === 'spell' && x.card && !x.copy); let enc = '';
        if (it){ S.stk.splice(S.stk.indexOf(it), 1); enc = (it.tgts || []).flat().slice(0, 3).map(r21EncT).join(';'); r21Lend(it.card, from, r.ref, 'r', r.src); log(`${nameOf(from)} gained control of my ${it.nm} (${r.src})`); }
        sendRq(from, 'r21ack', it ? 1 : 0, r.src, {ref:r.ref, d:enc}); commit(); return; }
      case 'r21exGyAll': { const all = S.gy.slice(); all.forEach(c => moveCard(c.id, 'ex', {quiet:true})); if (all.length) log(`exiled my graveyard (${r.src}): ${all.length} card${all.length === 1 ? '' : 's'}`); const best = all.filter(c => isCreatureCard(c)).reduce((m, c) => Math.max(m, parseInt(info(c.k)?.p) || 0), 0); r21Ack(from, r.ref, r.d === 'pow' ? best : all.length, r.src); commit(); return; }
      case 'r21ack': UI.r21ack ||= {}; UI.r21ack[r.ref] = {n:r.n || 0, from, d:r.d || ''}; return;
      case 'r21cast': { const l = S.lent.find(x => x.ref === r.ref); if (l){ for (const z of ['ex', 'gy']){ const i = S[z].indexOf(l.card); if (i >= 0) S[z].splice(i, 1); } log(`${nameOf(from)} ${isLand(l.card.k) ? 'played' : 'cast'} my ${cname(l.card)} from exile`); } r21Unlist(r.ref); commit(); return; }
      case 'r21unlend': { const i = S.lent.findIndex(x => x.ref === r.ref); r21Unlist(r.ref); if (i < 0){ commit(); return; } const [l] = S.lent.splice(i, 1); const c = l.card;
        if (S.ex.includes(c) || S.gy.includes(c)){
          if (r.d === 'bf'){ moveCard(c.id, 'bf'); log(`${cname(c)} returned to the battlefield (${r.src || 'its exile ended'})`); }
          else if (r.d === 'gy'){ moveCard(c.id, 'gy', {quiet:true}); log(`${cname(c)} returned to my graveyard from exile`); }
          else if (r.d === 'libb'){ S.ex.splice(S.ex.indexOf(c), 1); S.lib.push(c); log(`put ${cname(c)} on the bottom of my library`); }
        }
        commit(); return; }
      case 'r21rest': r21Rest(r.ref, r.d); return;
      case 'r21show': r21Show(r, from); return;
      case 'r21take': r21Take(r, from); return;
      case 'r21retgt': r21ApplyRetarget(r, from); return;
      case 'r21ctr': { const [sid, dest] = String(r.d || '').split('|'); const it = S.stk.find(x => x.sid === sid); if (it) r21CounterTo(it, dest, from); return; }
      case 'r21trick': { const it = S.stk.find(x => x.sid === r.d) || (UI.r21gone || {})[r.d]; const c = it && it.srcId != null ? S.bf.find(b => b.id === it.srcId) : null;
        if (c && it.kind !== 'spell'){ c.r21noAct = turnStr(); log(`${cname(c)}: its activated abilities can't be activated this turn (${r.src})`); } commit(); return; }
      case 'r21tibalt': r21TibaltLocal(r.n || 1, r.d || '', r.src); return;
      case 'r21agent': r21AgentPick(r, from); return;
    }
    return ao(r, from);
  };
  // the owner's original comes back from a lend: make sure it isn't also still sitting in exile
  const tb = takeBack;
  takeBack = function(r){
    const l = S.lent.find(x => x.ref === r.ref);
    if (l && l.ex){ for (const z of ['ex', 'gy']){ const i = S[z].indexOf(l.card); if (i >= 0) S[z].splice(i, 1); } r21Unlist(r.ref);
      if (r.d === 'gy' && typeof gyReplace === 'function' && gyReplace(l.card, 'stack') === 'ex'){ r = {...r, d:'ex'}; } }
    return tb(r);
  };
  // publish lends and shown cards; read them from the others
  const ps = publicState;
  publicState = function(){ const o = ps(); o.r21L = (S.r21L || []).map(e => ({ref:e.ref, to:e.to, k:e.k, tok:e.tok, w:e.w, src:e.src}));
    o.r21show = S.r21show ? {ref:S.r21show.ref, to:S.r21show.to, ks:S.r21show.ks.slice(0, 160)} : null; return o; };
  const ss = sanitizeState;
  sanitizeState = function(s){ const o = ss(s); if (!o) return o;
    try {
      o.r21L = (Array.isArray(s.r21L) ? s.r21L.slice(-80) : []).filter(e => e && typeof e === 'object').map(e => ({ref:R21_STR(e.ref, 16), to:R21_STR(e.to, 40), k:R21_STR(e.k, 80), tok:R21_STR(e.tok, 16), w:R21_STR(e.w, 8), src:R21_STR(e.src, 40)})).filter(e => e.ref && e.k);
      o.r21show = s.r21show && typeof s.r21show === 'object' ? {ref:R21_STR(s.r21show.ref, 16), to:R21_STR(s.r21show.to, 40), ks:(Array.isArray(s.r21show.ks) ? s.r21show.ks.slice(0, 160) : []).map(k => R21_STR(k, 80))} : null;
    } catch { o.r21L = []; o.r21show = null; }
    return o; };
  const ors = onRemoteState;
  onRemoteState = function(pid, s){ try { r21Sync(pid, s); } catch (e){ console.warn(e); } return ors(pid, s); };
}
// borrower: casting / playing a lent card tells the owner; it resolves under my control and goes home afterwards
{
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){
    const pre = await r21PreTarget(c, zone); if (pre === false) return;
    const n0 = S.stk.length;
    const r = await bc(c, zone, o);
    try {
      if (c && c.r21 && c.own && zone === 'ex' && !S.ex.includes(c) && !c.r21sent){ c.r21sent = 1; sendRq(c.own.pid, 'r21cast', 0, cname(c), {ref:c.own.ref}); commit(); }
      if (pre && S.stk.length > n0){ const it = S.stk.find(x => x.card === c); if (it){ it.tgt = pre.sid; it.tgtNm = pre.nm; commit(); } }
      if (S.stk.length > n0 && (S.r21nc || []).length){ const it = S.stk.find(x => x.card === c && x.kind === 'spell'); S.r21nc = S.r21nc.filter(x => x.t === turnStr());
        if (it && /\b(Instant|Sorcery)\b/.test(info(c.k)?.t || '') && S.r21nc.length){ const list = S.r21nc.splice(0); for (const q of list){ log(`${q.src}: copying ${it.nm}${q.n > 1 ? ' ' + q.n + ' times' : ''}`); if (q.n > 0) await copyMany({name:q.src, k:null, it:{tgt:it.sid}}, q.n); } commit(); } }
      if (c && c.mayPlay && c.mayPlay.r21once && !S.ex.includes(c)){ S.r21once ||= {}; S.r21once[c.mayPlay.r21once] = turnStr(); }
    } catch (e){ console.warn(e); }
    return r;
  };
  const mc = moveCard;
  moveCard = function(id, to, o = {}){
    const [from,, c] = find(id);
    if (c && c.r21 && c.own && from === 'ex' && to !== 'ex' && !c.r21sent){ c.r21sent = 1; sendRq(c.own.pid, 'r21cast', 0, cname(c), {ref:c.own.ref}); }
    return mc(id, to, o);
  };
  const tg = toGrave;
  toGrave = function(c, it){
    if (c && c.r21 && c.own){ faceRestore(c); const d = (it && it.exAfter) || c.r21exAfter ? 'ex' : 'gy'; sendRq(c.own.pid, 'back', 0, cname(c), {ref:c.own.ref, d}); log(`${cname(c)} goes to ${nameOf(c.own.pid)}'s ${d === 'ex' ? 'exile' : 'graveyard'} (they own it)`); return; }
    return tg(c, it);
  };
  // "mana of any type can be spent to cast it"
  const sc = spellCost;
  spellCost = function(c, zone, o = {}){
    const r = sc(c, zone, o);
    try { if (zone === 'ex' && c && c.mayPlay && c.mayPlay.any && r && r.cost){ const k = r.cost; let n = 0; MANA.forEach(x => { if (x !== 'C'){ n += k.col[x]; k.col[x] = 0; } }); n += k.hyb.length + k.phy.length; k.hyb = []; k.phy = []; k.two.forEach(() => { n += 1; }); k.two = []; if (n){ k.gen += n; r.notes.push('mana of any type'); } } } catch (e){ console.warn(e); }
    return r;
  };
  // Maralen: once each turn, mana value limited by Elves and Faeries
  const ew = exWindowOk;
  exWindowOk = function(c){
    const ok = ew(c); if (!ok || !c || !c.mayPlay) return ok;
    const mp = c.mayPlay;
    if (mp.r21once && (S.r21once || {})[mp.r21once] === turnStr()) return false;
    if (mp.r21mvElf){ const n = S.bf.filter(b => !b.fd && /\b(Elf|Faerie)\b/.test(typeOf(b))).reduce((a, b) => a + (b.n || 1), 0); if ((info(c.k)?.mv || 0) > n) return false; }
    return ok;
  };
  // lent copies whose window ran out go home; Mnemonic Betrayal's end-step return
  const tc = turnChanged;
  turnChanged = function(...a){ const r = tc(...a); try { r21Expire(); } catch (e){ console.warn(e); } return r; };
  const fs = fireSteps;
  fireSteps = function(step, activePid){
    const r = fs(step, activePid);
    try { if (step === 'end' && (S.r21eot || []).length){ const list = S.r21eot.splice(0); list.forEach(id => { const c = S.ex.find(x => x.id === id); if (c){ log(`${cname(c)} returns to ${c.own ? nameOf(c.own.pid) + "'s" : 'its owner\'s'} graveyard (end step)`); r21Drop(c, 'gy'); } }); commit(); } } catch (e){ console.warn(e); }
    return r;
  };
  // Hostage Taker: when the source leaves, its exiled card comes back
  const ol = onLeave;
  onLeave = function(c, to, w){
    const r = ol(c, to, w);
    try {
      if (c && !UI.dry){
        S.ex.filter(x => x.r21until === c.id).forEach(x => { log(`${cname(x)} returns (${cname(c)} left the battlefield)`); r21Drop(x, 'bf'); });
        S.bf.filter(x => x.r21by === c.id && x.own).forEach(x => { log(`${cname(c)} left — ${cname(x)} goes back to ${nameOf(x.own.pid)}`); sendBack(x, 'bf'); });
      }
    } catch (e){ console.warn(e); }
    return r;
  };
  // remember countered items (Trickbind needs the source)
  const cm = counterMine;
  counterMine = function(it, byPid){ UI.r21gone ||= {}; if (it) UI.r21gone[it.sid] = it; return cm(it, byPid); };
  const ar = abilityReady;
  abilityReady = function(c, ab, mana){ if (c && c.r21noAct === turnStr() && !mana) return "Its activated abilities can't be activated this turn"; return ar(c, ab, mana); };
}
{
  const aa = activateAbility;
  activateAbility = async function(c, ab){
    let pre = null;
    try {
      if (!UI.casting && c && ab && ab.eff && !abilityReady(c, ab, false)){
        const cs = /^counter target/i.test(ab.eff) ? counterSpec(ab.eff) : null; const rt = !cs && ab.eff.match(R21_RT);
        if (cs || rt){
          const opts = cs ? stackAll().reverse().map(x => { const lg = counterLegal(x, cs); return {label:`${x.nm} — ${x.pid === MYPID ? 'your' : nameOf(x.pid) + "'s"} ${x.kind === 'spell' ? 'spell' : 'ability'}`, value:x.sid, disabled:!lg.ok, why:lg.why || ''}; }) : r21StackOpts(null, rt[1].toLowerCase());
          if (!opts.some(o => !o.disabled)){ toast(`Nothing on the stack ${cname(c)} can target`); return; }
          const v = await askChoice({title:`${cname(c)}: which spell or ability?`, options:opts}); if (v == null) return;
          pre = stackAll().find(i => i.sid === v) || null;
        }
      }
    } catch (e){ console.warn(e); }
    const n0 = S.stk.length; const r = await aa(c, ab);
    if (pre && S.stk.length > n0){ const it = S.stk[S.stk.length - 1]; if (it && it.kind === 'ability' && it.srcId === c.id){ it.tgt = pre.sid; it.tgtNm = pre.nm; commit(); } }
    return r;
  };
}
function r21Expire(){
  if (!S) return;
  const old = S.ex.filter(c => c.r21 && c.own && c.mayPlay && !c.mayPlay.adv && !exWindowOk(c) && c.mayPlay.t !== turnStr());
  old.forEach(c => r21Drop(c, ''));
  if (old.length) log(`the permission to cast ${old.length} exiled card${old.length === 1 ? '' : 's'} I don't own ended`);
}
// a resolution that offered "cast it now" is over: copies nobody cast go home
{
  const re = runEffects;
  runEffects = async function(txt, ctx){
    const r = await re(txt, ctx);
    try { if (ctx && ctx.r21ids && ctx.r21ids.length && !UI.dry){ ctx.r21ids.map(id => S.ex.find(c => c.id === id)).filter(c => c && c.r21 && !c.mayPlay && !c.r21keep).forEach(c => r21Drop(c, '')); } } catch (e){ console.warn(e); }
    return r;
  };
}

/* ---------- the other players' libraries ---------- */
function r21Pids(w, ctx){
  w = String(w || '').replace(/'s$/, '');
  if (/^each player/.test(w)) return players().map(p => p.pid);
  if (/^each opponent|^each other player/.test(w)) return opponents().map(p => p.pid);
  if (/^your?$/.test(w)) return [MYPID];
  if (/^target (player|opponent)/.test(w)){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0] || (ctx.lastT || []).find(x => x.t === 'player'); return t && t.pid ? [t.pid] : []; }
  if (/^(that player|their|they|defending player|its controller|that opponent)/.test(w)){ const it = ctx.it || {}; const p = it.evDp || ((ctx.lastT || [])[0] || {}).pid || (it.evPid !== MYPID ? it.evPid : null); return p ? [p] : []; }
  return [];
}
const r21Free = ctx => /without paying (?:its|their) mana costs?/i.test(String(ctx.full || ''));
// exile from several players at once; returns the hit/exiled card ids now in MY exile
async function r21ExileFrom(pids, ctx, how){
  const ids = []; const jobs = [];
  for (const pid of pids){
    if (pid === MYPID){
      if (how.until){ const {hit, rest} = await revealUntil(c => r21Fits(c, how.until), ctx.name); if (hit) ids.push(hit.id); ctx.r21mine = (ctx.r21mine || []).concat(rest.map(c => c.id), hit ? [hit.id] : []); }
      else { const top = S.lib.slice(0, how.n || 1); top.forEach(c => moveCard(c.id, 'ex', {quiet:true})); if (top.length) log(`${ctx.name}: exiled ${top.map(cname).join(', ')} from the top of my library`); ids.push(...top.map(c => c.id)); }
      continue;
    }
    jobs.push(how.until ? r21Ask(pid, 'r21exU', 0, ctx.name, {d:`${how.until}|${how.w || 'r'}`}) : r21Ask(pid, 'r21exTop', how.n || 1, ctx.name, {d:how.w || 'r'}));
  }
  const res = await Promise.all(jobs);
  res.forEach(x => ids.push(...x.ids));
  ctx.r21toks = (ctx.r21toks || []).concat(res.map(x => ({tok:x.tok, pid:null}))).concat();
  res.forEach((x, i) => { const pid = pids.filter(p => p !== MYPID)[i]; ctx.r21toks[ctx.r21toks.length - res.length + i].pid = pid; });
  ctx.r21ids = (ctx.r21ids || []).concat(ids); ctx.lastEx = ids.slice(); ctx.r21 = true;
  if (ids.length === 1){ const c = find(ids[0])[2]; if (c){ ctx.lastExC = c; ctx.lastMV = info(c.k)?.mv || 0; } }
  commit(); return ids;
}
// cast any number / up to N of the exiled cards right now
async function r21CastNow(ctx, o = {}){
  const cards = (ctx.r21ids || ctx.lastEx || []).map(id => S.ex.find(c => c.id === id)).filter(c => c && !isLand(c.k) && (!o.desc || descOk(c.k, o.desc)) && (o.mv == null || (info(c.k)?.mv || 0) <= o.mv));
  if (UI.dry || !cards.length) return;
  let left = o.max == null ? 99 : o.max;
  for (const c of cards){
    if (left <= 0) break;
    if (!S.ex.includes(c)) continue;
    const owner = c.own ? ` (${nameOf(c.own.pid)}'s card)` : '';
    if (!(await askYes(`${ctx.name}: cast ${cname(c)}${owner}${o.free ? ' without paying its mana cost' : ''}?`, 'Cast it', 'No'))) continue;
    if (!o.free){ c.mayPlay = {t:turnStr(), cast:true, src:ctx.name, u0:S.untapN, any:!!o.any}; const chk = castCheck(c, 'ex'); if (!chk.ok){ toast(chk.why); delete c.mayPlay; continue; } }
    UI.afterCast = () => {}; await beginCast(c, 'ex', o.free ? {free:true} : {});
    if (!S.ex.includes(c)) left--;
    else if (!o.free) delete c.mayPlay;
  }
  commit();
}
// look at / search another player's library through their client
async function r21ShowFrom(pid, n, what, ctx){
  const tok = rid(6); UI.r21ack ||= {};
  sendRq(pid, 'r21show', n, ctx.name, {ref:tok, d:what}); commit();
  if (UI.dry) return {tok, cards:[]};
  toast(`Waiting for ${nameOf(pid)}'s cards…`);
  const sh = await waitUntil(() => { const s = OPP.get(pid)?.r21show; return s && s.ref === tok && s.to === MYPID ? s : null; }, 25000);
  if (!sh){ log(`${ctx.name}: ${nameOf(pid)} didn't show the cards`); return {tok, cards:[]}; }
  return {tok, cards:sh.ks.map((k, i) => ({id:900000 + i, k, i}))};
}
async function r21TakeFrom(pid, tok, idx, mode, rest, w, ctx){
  UI.r21ack ||= {}; UI.r21tok ||= {};
  sendRq(pid, 'r21take', idx.length ? +idx[0] : -1, ctx.name, {ref:tok, d:`${mode}|${rest || ''}|${w || 'r'}`}); commit();
  if (UI.dry) return [];
  const a = await waitUntil(() => UI.r21ack[tok], 25000); if (!a || !a.n) return [];
  await waitUntil(() => (UI.r21tok[tok] || []).length >= a.n ? 1 : 0, 10000);
  const ids = (UI.r21tok[tok] || []).slice(); ctx.r21ids = (ctx.r21ids || []).concat(ids); ctx.lastEx = ids.slice(); ctx.r21 = true; return ids;
}
async function r21LookExile(pid, n, ctx, rest, desc){
  const {tok, cards} = await r21ShowFrom(pid, n, 'lib', ctx); ctx.r21 = true;
  if (UI.dry) return [];
  const legal = desc ? cards.filter(c => descOk(c.k, desc)) : cards;
  let pick = [];
  if (legal.length){ const ids = await pickCards({title:`${ctx.name}: ${nameOf(pid)}'s ${n > 0 ? 'top ' + cards.length + ' cards' : 'library'}`, hint:desc ? `Pick a ${desc} card.` : 'Pick the card to exile face down.', cards:legal, min:desc ? 0 : 1, max:1, noneLabel:'Find nothing'}); pick = (ids || []).map(id => legal.find(c => c.id === id)).filter(Boolean).map(c => c.i); }
  return r21TakeFrom(pid, tok, pick, 'lend', rest, 'r', ctx);
}

/* ---------- stack: change targets ---------- */
const R21_RT = /(?:change the target of|change a target of|choose new targets for) target (spell or ability|spell|instant or sorcery spell|activated or triggered ability)( with a single target)?/i;
function r21StackOpts(selfSid, spec){
  return stackAll().reverse().filter(x => x.sid !== selfSid).map(x => {
    let why = '';
    if (/^spell/.test(spec) && spec !== 'spell or ability' && x.kind !== 'spell') why = 'not a spell';
    if (/instant or sorcery/.test(spec) && !/\b(Instant|Sorcery)\b/.test(info(x.k)?.t || x.ty || '')) why = 'not an instant or sorcery';
    if (/activated or triggered/.test(spec) && x.kind === 'spell') why = 'not an ability';
    if (!why && !x.tgtNm && !x.tgt) why = 'it has no targets';
    return {label:`${x.nm} — ${x.pid === MYPID ? 'your' : nameOf(x.pid) + "'s"} ${x.kind === 'spell' ? 'spell' : 'ability'}${x.tgtNm ? ' → ' + x.tgtNm : ''}`, value:x.sid, disabled:!!why, why};
  });
}
async function r21PreTarget(c, zone){
  if (!c || UI.casting) return null; const a = info(c.k); if (!a || isPermType(a.t)) return null;
  const m = tname(a.o, a.n).match(R21_RT); if (!m) return null;
  const opts = r21StackOpts(null, m[1].toLowerCase());
  if (!opts.some(o => !o.disabled)){ toast(`Nothing on the stack ${a.n} can retarget`); return false; }
  const v = await askChoice({title:`${a.n}: which spell or ability?`, options:opts}); if (v == null) return false;
  const x = stackAll().find(i => i.sid === v); return x ? {sid:x.sid, nm:x.nm} : false;
}
const r21EncT = t => t.t === 'player' ? `p.${t.pid}` : t.t === 'stack' ? `s.${t.sid}` : `c.${t.pid}.${t.id}`;
function r21DecT(s){
  const [t, pid, id] = String(s).split('.');
  if (t === 's') return {t:'stack', sid:pid};
  if (t === 'p') return {t:'player', pid, id:null, k:null, nm:pid === MYPID ? S.nm + ' (you)' : nameOf(pid)};
  const c = boardOf(pid).find(b => b.id === +id); return {t:'card', pid, id:+id, k:c ? c.k : null, nm:c && c.k ? (info(c.k)?.n || 'a card') : 'a card'};
}
function r21SetTargets(it, list){
  const st = list.find(t => t.t === 'stack');
  if (st){ const x = stackAll().find(i => i.sid === st.sid); it.tgt = st.sid; it.tgtNm = x ? x.nm : it.tgtNm; return; }
  if (!it.tgts || !it.tgts.length) it.tgts = [list]; else { let i = 0; it.tgts = it.tgts.map(g => g.map(() => list[i++] || null).filter(Boolean)); while (i < list.length) it.tgts[it.tgts.length - 1].push(list[i++]); }
  it.tgtNm = tgtLabel(it.tgts);
}
function r21ApplyRetarget(r, from){
  const [sid, ...enc] = String(r.d || '').split('|'); const it = S.stk.find(x => x.sid === sid); if (!it) return;
  const list = enc.join('|').split(';').filter(Boolean).map(r21DecT);
  r21SetTargets(it, list); log(`${it.nm}: ${nameOf(from)} changed its target${list.length > 1 ? 's' : ''} → ${it.tgtNm} (${r.src})`); commit();
}
async function r21Retarget(ctx, o){
  let x = ctx.it && ctx.it.tgt ? stackAll().find(i => i.sid === ctx.it.tgt) : null;
  if (!x && !UI.dry && !(ctx.it && ctx.it.tgt)){ const opts = r21StackOpts(ctx.it && ctx.it.sid, o.spec); if (opts.some(q => !q.disabled)){ const v = await askChoice({title:`${ctx.name}: which spell or ability?`, options:opts}); x = v ? stackAll().find(i => i.sid === v) : null; } }
  if (!x){ if (!UI.dry) log(`${ctx.name}: no spell or ability to retarget`); return; }
  let list = null;
  const isStackT = !!x.tgt;
  if (o.toSelf){ const sc = srcCardOf(ctx) || (ctx.srcId != null ? S.bf.find(b => b.id === ctx.srcId) : null); if (!sc){ log(`${ctx.name}: it isn't on the battlefield`); return; } list = [{t:'card', pid:MYPID, id:sc.id, k:sc.k, nm:cname(sc)}]; }
  else if (isStackT){
    const opts = stackAll().reverse().filter(i => i.sid !== x.sid && i.sid !== (ctx.it && ctx.it.sid)).map(i => ({label:`${i.nm} — ${i.pid === MYPID ? 'your' : nameOf(i.pid) + "'s"}`, value:i.sid}));
    if (o.may) opts.push({label:'Keep the current target', value:''});
    const v = opts.length ? await askChoice({title:`${ctx.name}: new target for ${x.nm}`, options:opts}) : null; if (!v) return; list = [{t:'stack', sid:v}];
  } else {
    const txt = x.pid === MYPID && x.it ? (x.it.modes && parseModes(x.it.txt || '') ? modeText(parseModes(x.it.txt), x.it.modes) : x.it.txt) : x.txt;
    if (!targetSpecs(txt).length){ log(`${ctx.name}: can't read ${x.nm}'s targets`); return; }
    if (o.may && !(await askYes(`${ctx.name}: choose new targets for ${x.nm}?`, 'Choose new targets', 'Keep them'))) return;
    const t = await chooseTargets(txt, {pid:x.pid, col:info(x.k)?.c, types:info(x.k)?.t, id:x.it ? x.it.srcId : null}, `${ctx.name}: new target${o.single ? '' : 's'} for ${x.nm}`);
    if (!t) return; list = t.flat(); if (o.single) list = list.slice(0, 1); if (!list.length) return;
  }
  if (x.pid === MYPID && x.it){ r21SetTargets(x.it, list); log(`${ctx.name}: ${x.nm} now targets ${x.it.tgtNm}`); }
  else { sendRq(x.pid, 'r21retgt', 0, ctx.name, {d:`${x.sid}|${list.slice(0, 3).map(r21EncT).join(';')}`}); log(`${ctx.name}: ${x.nm} now targets ${list.map(t => t.t === 'stack' ? (stackAll().find(i => i.sid === t.sid)?.nm || 'a spell') : t.pid === MYPID && t.t === 'card' ? t.nm : t.t === 'player' ? t.nm : `${nameOf(t.pid)}'s ${t.nm}`).join(', ')}`); }
  commit();
}

/* ---------- counters with a different destination (Remand, Memory Lapse) ---------- */
function r21CounterTo(it, dest, byPid){
  const i = S.stk.indexOf(it); if (i < 0) return;
  S.stk.splice(i, 1); UI.r21gone ||= {}; UI.r21gone[it.sid] = it;
  const c = it.card;
  log(`${it.nm} was countered${byPid && byPid !== MYPID ? ' by ' + nameOf(byPid) : ''}${c ? ` — it goes ${dest === 'hand' ? "to its owner's hand" : "on top of its owner's library"}` : ''}`);
  if (it.kind === 'spell' && c){
    faceRestore(c);
    if (c.r21 && c.own) sendRq(c.own.pid, 'back', 0, cname(c), {ref:c.own.ref, d:dest === 'hand' ? 'hand' : 'lib'});
    else if (c.cmd && UI.cmdz){ S.cz.push(c); log(`${cname(c)} went to the command zone`); }
    else if (dest === 'hand') S.hand.push(c); else S.lib.unshift(c);
  }
  commit();
}

/* ---------- Tibalt's Trickery: the countered spell's controller does it all on their client ---------- */
async function r21TibaltLocal(n, spellName, src){
  mill(n);
  const {hit, seen} = r21ExileUntil('nonland', spellName);
  log(`${src}: exiled ${seen.map(cname).join(', ') || 'nothing'}`);
  if (hit && !UI.dry && await askYes(`${src}: cast ${cname(hit)} without paying its mana cost?`, 'Cast it', 'No')){ UI.afterCast = () => {}; await beginCast(hit, 'ex', {free:true}); }
  const rest = seen.filter(c => S.ex.includes(c)); rest.forEach(c => S.ex.splice(S.ex.indexOf(c), 1)); shuffle(rest); S.lib.push(...rest);
  if (rest.length) log(`put ${rest.length} exiled card${rest.length === 1 ? '' : 's'} on the bottom of their library in a random order`);
  commit();
}

/* ---------- Opposition Agent: the agent's controller picks; found cards are exiled for them ---------- */
async function r21AgentPick(r, from){
  const sh = OPP.get(from)?.r21show; if (!sh || sh.ref !== r.ref) return;
  const desc = String(r.d || ''); const cards = sh.ks.map((k, i) => ({id:900000 + i, k, i})).filter(c => !desc || descOk(c.k, desc));
  const ids = await pickCards({title:`Opposition Agent: you control ${nameOf(from)}'s search (${r.src})`, hint:`Pick up to ${r.n || 1} card${(r.n || 1) === 1 ? '' : 's'}. They're exiled and you may play them.`, cards, min:0, max:r.n || 1, noneLabel:'Find nothing'});
  const idx = (ids || []).map(id => cards.find(c => c.id === id)).filter(Boolean).map(c => c.i);
  sendRq(from, 'r21agentAns', idx.length, r.src, {ref:r.ref, d:idx.join(',')}); commit();
}
RQ_OPS.push('r21agentAns');
{
  const ao = applyOp;
  applyOp = function(r, from){ if (r.op === 'r21agentAns'){ UI.r21agent ||= {}; UI.r21agent[r.ref] = {idx:String(r.d || '').split(',').filter(x => x !== '').map(Number), from}; return; } return ao(r, from); };
  const sl = searchLibrary;
  searchLibrary = async function(descRaw, rest, ctx){
    const ag = rulesOn('r21agent')[0];
    if (!ag || !ag.pid || ag.pid === MYPID || UI.dry || rulesOn('noSearch').length) return sl(descRaw, rest, ctx);
    let d = String(descRaw).toLowerCase(); let max = 1; let mm;
    if ((mm = d.match(/^up to (\w+) /))){ max = wn(mm[1], ctx.it?.x) || 1; d = d.slice(mm[0].length); }
    else if ((mm = d.match(/^(two|three|four|x|\d+) /))){ max = wn(mm[1], ctx.it?.x) || 1; d = d.slice(mm[0].length); }
    d = d.replace(/^(an?|any number of) /, '').replace(/\bcards?\b/g, '').trim();
    const tok = rid(6); const list = S.lib.slice();
    S.r21show = {ref:tok, to:ag.pid, ks:list.map(c => c.k), ids:list.map(c => c.id), what:'agent'};
    sendRq(ag.pid, 'r21agent', max, ctx.name, {ref:tok, d}); log(`searches their library — ${nameOf(ag.pid)} controls the search (Opposition Agent)`); commit();
    toast(`${nameOf(ag.pid)} controls your search (Opposition Agent)…`);
    const a = await waitUntil(() => (UI.r21agent || {})[tok], 60000);
    S.r21show = null;
    const cards = (a ? a.idx : []).map(i => list[i]).filter(c => c && S.lib.includes(c));
    cards.forEach(c => { S.lib.splice(S.lib.indexOf(c), 1); S.ex.push(c); r21Lend(c, ag.pid, tok, 'pal', 'Opposition Agent'); });
    log(cards.length ? `exiled ${cards.map(cname).join(', ')} — ${nameOf(ag.pid)} may play ${cards.length === 1 ? 'it' : 'them'} (Opposition Agent)` : 'found nothing');
    shuffleLib(); commit();
  };
}
STATIC_RULES.push([/^you control your opponents while they're searching their libraries$/, m => ({kind:'r21agent', who:'opp'})]);
STATIC_RULES.push([/^while an opponent is searching their library, they exile each card they find\. you may play those cards for as long as they remain exiled, and you may spend mana as though it were mana of any color to cast them$/, m => ({kind:'r21agent', who:'opp'})]);
STATIC_RULES.push([/^while an opponent is searching their library, they exile each card they find$/, m => ({kind:'r21agent', who:'opp'})]);
STATIC_RULES.push([/^you may play those cards for as long as they remain exiled, and you may spend mana as though it were mana of any color to cast them$/, m => ({kind:'r21agent', who:'opp'})]);

/* ---------- Dauthi Voidwalker ---------- */
STATIC_RULES.push([/^if a card would be put into an opponent's graveyard from anywhere, instead exile it with a void counter on it$/, m => ({kind:'r21void', who:'opp'})]);
{
  const gr = gyReplace;
  gyReplace = function(c, from){ const r = gr(c, from); if (r) return r; if (S && !UI.dry && c && !c.tok && rulesOn('r21void').length){ c.r21void = 1; return 'ex'; } return r; };
  const ml = mill;
  mill = function(n = 1){
    if (S && !UI.dry && rulesOn('r21void').length){ const out = S.lib.splice(0, n); out.forEach(c => { c.r21void = 1; }); S.ex.push(...out); if (out.length) log(`milled ${out.map(cname).join(', ')} — exiled with void counters instead (${rulesOn('r21void')[0].src})`); if (UI.millLog) UI.millLog.push(...out); commit(); return; }
    return ml(n);
  };
}

/* ---------- gain control: Auras ("You control enchanted creature"), all artifacts ---------- */
STATIC_RULES.push([/^you control enchanted (creature|enchantment|artifact|permanent|land|planeswalker)$/, m => ({kind:'r21ctlAura', who:'you'})]);
{
  const rt = resolveTop;
  resolveTop = async function(it){
    const r = await rt(it);
    try {
      if (it && it.kind === 'spell' && it.card && /\bAura\b/.test(info(it.card.k)?.t || '') && /(?:^|\n)you control enchanted (creature|enchantment|artifact|permanent|land|planeswalker)\./i.test(info(it.card.k)?.o || '')){
        const a = S.bf.find(b => b.id === it.card.id);
        if (a && a.att && a.att.pid !== MYPID){ const t = boardOf(a.att.pid).find(b => b.id === a.att.id); if (t){ (S.r21auraP ||= []).push({aura:a.id, pid:a.att.pid, k:t.k}); applyTo({t:'card', pid:a.att.pid, id:a.att.id, k:t.k}, {op:'steal', src:cname(a), f:{}}); log(`${cname(a)}: gaining control of ${nameOf(a.att.pid)}'s ${info(t.k)?.n}`); commit(); } }
      }
    } catch (e){ console.warn(e); }
    return r;
  };
  const tk = takeCard;
  takeCard = function(r, from){
    const before = new Set(S.bf.map(b => b.id)); const out = tk(r, from);
    try { if (r.f && Array.isArray(r.f.kw) && r.f.kw.length){ const nc = S.bf.find(b => !before.has(b.id)); if (nc){ nc.ekw = [...new Set([...(nc.ekw || []), ...r.f.kw])]; commit(); } } } catch (e){ console.warn(e); }
    try { const p = (S.r21auraP || []).find(x => x.pid === from && r.c && x.k === r.c.k); if (p){ S.r21auraP.splice(S.r21auraP.indexOf(p), 1); const nc = S.bf.find(b => !before.has(b.id) && b.k === p.k); const a = S.bf.find(b => b.id === p.aura); if (nc && a){ a.att = {pid:MYPID, id:nc.id}; nc.r21by = a.id; commit(); } } } catch (e){ console.warn(e); }
    return out;
  };
}

/* ---------- effects ---------- */
async function doRound21EPre(s, l, ctx){
  let m; const name = ctx.name || '';
  const full = String(ctx.full || '').toLowerCase();
  // --- each player / an opponent exiles until …; then cast from among them ---
  if ((m = l.match(/^(each player|each opponent|target player|target opponent|that player|its controller) exiles cards from the top of their library until they exile an? (nonland|instant or sorcery|creature|artifact|noncreature, nonland|permanent) card(?:, then shuffles the rest into their library)?$/))){
    const pids = r21Pids(m[1], ctx); ctx.r21 = true;
    await r21ExileFrom(pids, ctx, {until:m[2], w:'r'});
    if (/then shuffles the rest/.test(l)) (ctx.r21toks || []).forEach(t => t.pid && sendRq(t.pid, 'r21rest', 0, name, {ref:t.tok, d:'shuffle'}));
    return true;
  }
  if (ctx.r21 && /^(?:then )?shuffles the rest into their library$/.test(l)){ (ctx.r21toks || []).forEach(t => t.pid && sendRq(t.pid, 'r21rest', 0, name, {ref:t.tok, d:'shuffle'})); const mine = (ctx.r21mine || []).map(id => S.ex.find(c => c.id === id)).filter(c => c && !(ctx.r21ids || []).includes(c.id)); if (mine.length){ mine.forEach(c => S.ex.splice(S.ex.indexOf(c), 1)); S.lib.push(...mine); shuffleLib(); } commit(); return true; }
  if ((m = l.match(/^(?:you may )?cast any number of spells from among (?:the nonland cards exiled this way|those cards|them|cards exiled this way|the exiled cards)(?: without paying their mana costs)?$/)) && ctx.r21){ await r21CastNow(ctx, {free:/without paying/.test(l)}); return true; }
  if ((m = l.match(/^(?:you may )?cast any number of spells with mana value x or less from among them without paying their mana costs$/)) && ctx.r21){ await r21CastNow(ctx, {free:true, mv:ctx.r21x || 0}); return true; }
  if ((m = l.match(/^(?:you may )?cast up to (one|two|three|x) (?:instant and\/or sorcery )?spells? from among (?:the other )?cards exiled this way without paying their mana costs$/)) && ctx.r21){ const max = m[1] === 'x' ? (ctx.r21x || (ctx.it && ctx.it.x) || 1) : wn(m[1]); await r21CastNow(ctx, {free:true, max, desc:/instant/.test(l) ? 'instant or sorcery' : null}); return true; }
  if ((m = l.match(/^(?:you may |they may )?cast that card without paying its mana cost$/)) && ctx.r21 && !ctx.r21tib){ await r21CastNow(ctx, {free:true, max:1}); return true; }
  if ((m = l.match(/^(?:then )?(?:target player |that player |they )?(?:puts?|put) the exiled cards that weren't cast this way on the bottom of (?:their|that) library in a random order$/)) && ctx.r21){
    for (const t of (ctx.r21toks || [])) if (t.pid) sendRq(t.pid, 'r21rest', 0, name, {ref:t.tok, d:'bottom'});
    const mine = (ctx.r21mine || []).map(id => S.ex.find(c => c.id === id)).filter(Boolean); if (mine.length) bottomRandom(mine);
    commit(); return true;
  }
  if (/^an opponent chooses a nonland card exiled this way$/.test(l) && ctx.r21){
    const cards = (ctx.r21ids || []).map(id => S.ex.find(c => c.id === id)).filter(c => c && !isLand(c.k)); if (UI.dry || cards.length < 2) return true;
    const opp = opponents()[0]; if (!opp) return true;
    // the opponent's choice: ask them through a published pile, like Fact or Fiction
    const ref = rid(6); S.pile = {ref, ks:cards.map(c => c.k)}; UI.pileAns ||= {}; sendRq(opp.pid, 'piles', 0, name, {ref}); commit(); toast(`Waiting for ${opp.nm} to choose…`);
    const a = await waitUntil(() => UI.pileAns[ref], 60000); S.pile = null;
    const i = a ? cards.findIndex((c, j) => a.mask & (1 << j)) : 0; const ch = cards[i < 0 ? 0 : i];
    if (ch){ log(`${opp.nm} chose ${cname(ch)} — it can't be cast`); ctx.r21ids = ctx.r21ids.filter(id => id !== ch.id); if (ch.r21) r21Drop(ch, ''); }
    commit(); return true;
  }
  // --- top cards of other players' libraries ---
  if ((m = s.match(/^(create (?:a|an|one|two) [^.]+? tokens?) and (exile the top card of (?:that|target|defending) player's library)$/i)) && /\b(cast|play)\b/.test(full)){
    await createFromText(m[1], ctx); return doRound21EPre(m[2], m[2].toLowerCase(), ctx);
  }
  if ((m = l.match(/^exile the top card of (each player's|each opponent's|that player's|target player's|target opponent's|defending player's|their) library$/)) && /\b(cast|play)\b/.test(full)){
    await r21ExileFrom(r21Pids(m[1], ctx), ctx, {n:1, w:'r'}); return true;
  }
  if ((m = l.match(/^exile the top (two|three|four|five|x|\d+) cards of (target opponent's|their|that player's|each opponent's) library(?:, where x is the amount of damage dealt)?$/)) && (/\b(cast|play)\b/.test(full) || /cards exiled with/i.test(info(ctx.k)?.o || ''))){
    const n = m[1] === 'x' ? ((ctx.it && (ctx.it.evN || ctx.it.amt)) || 0) : (wn(m[1]) || 1); ctx.r21x = n;
    if (!n){ ctx.r21 = true; log(`${name}: X is 0`); return true; }
    const ids = await r21ExileFrom(r21Pids(m[2], ctx), ctx, {n, w:'r'});
    if (/cards exiled with/i.test(info(ctx.k)?.o || '') && /once each turn, you may cast a spell with mana value less than or equal to the number of elves and faeries/i.test(info(ctx.k)?.o || '')){
      ids.map(id => S.ex.find(c => c.id === id)).filter(Boolean).forEach(c => { c.mayPlay = {t:turnStr(), cast:true, src:name, u0:S.untapN, free:true, r21once:'mar' + (ctx.srcId || ''), r21mvElf:true}; });
    }
    return true;
  }
  if ((m = l.match(/^target opponent exiles the top (x|two|three|\d+) cards of their library face down$/))){ const n = m[1] === 'x' ? ((ctx.it && ctx.it.x) || 0) : (wn(m[1]) || 1); ctx.r21 = true; if (n) await r21ExileFrom(r21Pids('target opponent', ctx), ctx, {n, w:'r'}); return true; }
  // --- permissions for what was just exiled ---
  if (ctx.r21 && (m = l.replace(/^for as long as (?:it|that card|they|those cards) remains? exiled, you may (cast|play) (it|them)(,| and)/, 'you may $1 $2 for as long as it remains exiled$3').match(/^(?:until (?:the )?end of (turn|your next turn), )?you may (?:look at and )?(cast|play)(?: lands and cast spells from among)? (that card|it|them|those cards|the exiled card|the exiled cards|spells from among (?:those|those exiled|the exiled) cards|lands and cast spells from among the exiled cards)( this turn| until the end of your next turn| for as long as (?:it|they) remains? exiled)?(?: without paying (?:its|their) mana costs?)?(?:,? and (?:you may spend mana as though it were mana of any (?:color|type)|mana of any type can be spent) to cast (?:it|them|that spell|those spells))?$/))){
    const ids = (ctx.r21ids || []).filter(id => S.ex.some(c => c.id === id));
    const long = /as long as/.test(l) || (!m[1] && !m[4]); const next = m[1] === 'your next turn' || /next turn/.test(m[4] || '');
    const any = /mana of any|as though/.test(l); const free = /without paying/.test(l);
    ids.forEach(id => { const c = S.ex.find(x => x.id === id); if (c) c.mayPlay = {t:turnStr(), next, cast:m[2] === 'cast', src:name, u0:S.untapN, free, adv:long && !/this turn/.test(l) && m[1] !== 'turn', any}; });
    if (ids.length) log(`${name}: may ${m[2]} ${ids.length === 1 ? 'that card' : 'those cards'}${free ? ' without paying' : ''}${long && m[1] !== 'turn' && !/this turn/.test(l) ? ' for as long as it remains exiled' : next ? ' until the end of their next turn' : ' this turn'}${any ? ', with mana of any type' : ''}`);
    if (/^you may cast spells from among those cards this turn, and mana of any type can be spent to cast them$/.test(l) && /next end step/.test(full)){ (S.r21eot ||= []).push(...ids); }
    commit(); return true;
  }
  if (ctx.r21 && /^(?:if you cast a spell this way, you may spend mana as though it were mana of any (?:color|type) to cast (?:it|that spell)|(?:you may )?spend mana as though it were mana of any (?:color|type) to cast that spell|mana of any type can be spent to cast (?:that spell|it|them))$/.test(l)){
    (ctx.r21ids || []).forEach(id => { const c = S.ex.find(x => x.id === id); if (c && c.mayPlay) c.mayPlay.any = true; }); commit(); return true;
  }
  if (ctx.r21 && (m = l.match(/^until (end of turn|the end of your next turn), you may cast that card and you may spend mana as though it were mana of any color to cast that spell$/))){
    (ctx.r21ids || []).forEach(id => { const c = S.ex.find(x => x.id === id); if (c) c.mayPlay = {t:turnStr(), next:/next/.test(m[1]), cast:true, src:name, u0:S.untapN, any:true}; }); commit(); return true;
  }
  // --- look at / search an opponent's library ---
  if ((m = l.match(/^look at the top (two|three|four|five|\d+) cards of (target opponent's|that player's|target player's) library(?:, exile one of them face down)?$/)) && (/exile one of them face down/.test(full))){
    const n = wn(m[1]) || 1; const pid = r21Pids(m[2], ctx)[0]; ctx.r21 = true; ctx.r21look = true;
    const rest = /put the rest into their graveyard/.test(full) ? 'g' : 'b';
    if (pid && pid !== MYPID) await r21LookExile(pid, n, ctx, rest);
    else if (pid === MYPID && !UI.dry){ const top = S.lib.slice(0, n); const ids = await pickCards({title:`${name}: exile one face down`, cards:top, min:1, max:1}); if (ids && ids[0]){ moveCard(ids[0], 'ex', {quiet:true}); ctx.r21ids = [ids[0]]; ctx.lastEx = [ids[0]]; const left = top.filter(c => c.id !== ids[0]); if (rest === 'g') left.forEach(c => moveCard(c.id, 'gy')); else { left.forEach(c => S.lib.splice(S.lib.indexOf(c), 1)); shuffle(left); S.lib.push(...left); } } }
    return true;
  }
  if (ctx.r21look && /^(put the rest on the bottom of that library in a random order|put the rest into their graveyard|exile one of them face down and put the other on the bottom of that library|exile one of them face down)$/.test(l)) return true;
  if ((m = l.match(/^search target opponent's library for (an? (?:creature )?card|a card) and (exile it face down|put that card onto the battlefield under your control)$/))){
    const pid = r21Pids('target opponent', ctx)[0]; ctx.r21 = true; ctx.r21search = true; if (!pid || pid === MYPID || UI.dry) return true;
    const desc = /creature/.test(m[1]) ? 'creature' : null;
    const {tok, cards} = await r21ShowFrom(pid, 0, 'lib', ctx);
    const legal = desc ? cards.filter(c => descOk(c.k, desc)) : cards;
    const ids = legal.length ? await pickCards({title:`${name}: search ${nameOf(pid)}'s library`, hint:desc ? `Pick a ${desc} card.` : 'Pick a card.', cards:legal, min:0, max:1, noneLabel:'Find nothing'}) : [];
    const pick = (ids || []).map(id => legal.find(c => c.id === id)).filter(Boolean).map(c => c.i);
    if (/battlefield/.test(m[2])){ sendRq(pid, 'r21take', pick.length ? pick[0] : -1, name, {ref:tok, d:'give|s|'}); commit(); }
    else await r21TakeFrom(pid, tok, pick, 'lend', 's', 'r', ctx);
    return true;
  }
  if (ctx.r21search && /^then that player shuffles$/.test(l)) return true;
  // --- Hostage Taker ---
  if ((m = l.match(/^exile another target (creature or artifact|artifact or creature|creature|artifact|nonland permanent) until ~ leaves the battlefield$/))){
    const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; ctx.r21 = true; if (!t || UI.dry) return true;
    const sc = srcCardOf(ctx); if (!sc || !S.bf.includes(sc)){ log(`${name} already left the battlefield — nothing is exiled`); return true; }
    if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c){ moveCard(c.id, 'ex'); const e = S.ex.find(x => x.id === c.id); if (e){ e.r21until = sc.id; ctx.r21ids = [e.id]; ctx.lastEx = [e.id]; } } }
    else { const res = await r21Ask(t.pid, 'r21exCard', 0, name, {tid:t.id, d:'r'}); res.ids.forEach(id => { const c = S.ex.find(x => x.id === id); if (c) c.r21until = sc.id; }); ctx.r21ids = res.ids; ctx.lastEx = res.ids.slice(); }
    commit(); return true;
  }
  // --- Mnemonic Betrayal ---
  if (/^exile all opponents' graveyards$/.test(l) && /cast spells from among those cards/.test(full)){
    ctx.r21 = true; const res = await Promise.all(opponents().map(p => r21Ask(p.pid, 'r21exGy', 0, name, {d:'r'})));
    ctx.r21ids = res.flatMap(x => x.ids); ctx.lastEx = ctx.r21ids.slice(); commit(); return true;
  }
  if (ctx.r21 && /^at the beginning of the next end step, if any of those cards remain exiled, return them to their owners' graveyards$/.test(l)){ (ctx.r21ids || []).forEach(id => { if (!(S.r21eot ||= []).includes(id)) S.r21eot.push(id); }); commit(); return true; }
  // --- Dauthi Voidwalker ---
  if (/^choose an exiled card an opponent owns with a void counter on it$/.test(l)){
    ctx.r21 = true; if (UI.dry) return true;
    const shows = await Promise.all(opponents().map(p => r21ShowFrom(p.pid, 0, 'void', ctx).then(x => ({...x, pid:p.pid}))));
    const all = []; shows.forEach(sh => sh.cards.forEach(c => all.push({id:all.length + 1, k:c.k, i:c.i, pid:sh.pid, tok:sh.tok})));
    const ids = all.length ? await pickCards({title:`${name}: choose an exiled card with a void counter`, cards:all, min:0, max:1, noneLabel:'None'}) : [];
    const ch = (ids || []).map(id => all.find(c => c.id === id))[0];
    for (const sh of shows){ if (ch && sh.pid === ch.pid) await r21TakeFrom(sh.pid, sh.tok, [ch.i], 'lend', '', 'r', ctx); else sendRq(sh.pid, 'r21take', -1, name, {ref:sh.tok, d:'none||'}); }
    commit(); return true;
  }
  if (ctx.r21 && /^you may play it this turn without paying its mana cost$/.test(l)){
    (ctx.r21ids || []).forEach(id => { const c = S.ex.find(x => x.id === id); if (c) c.mayPlay = {t:turnStr(), cast:false, src:name, u0:S.untapN, free:true}; }); commit(); return true;
  }
  // --- Tibalt's Trickery ---
  if (/^choose 1, 2, or 3 at random$/.test(l)){ ctx.r21rand = 1 + Math.floor(Math.random() * 3); log(`${name}: rolled ${ctx.r21rand}`); return true; }
  if (/^its controller mills that many cards$/.test(l) && ctx.r21rand){
    const x = ctx.it && ctx.it.tgt ? ((UI.r21gone || {})[ctx.it.tgt] ? {pid:MYPID, nm:(UI.r21gone || {})[ctx.it.tgt].nm} : (ctx.r21ctl || stackAll().find(i => i.sid === ctx.it.tgt))) : null;
    ctx.r21tib = true; if (!x || UI.dry) return true;
    if (x.pid === MYPID) await r21TibaltLocal(ctx.r21rand, x.nm, name); else { sendRq(x.pid, 'r21tibalt', ctx.r21rand, name, {d:R21_STR(x.nm, 80)}); log(`${name}: ${nameOf(x.pid)} mills ${ctx.r21rand}, then exiles until a nonland card and may cast it`); }
    commit(); return true;
  }
  if (ctx.r21tib && /^(exiles cards from the top of their library until they exile a nonland card with a different name than that spell|they may cast that card without paying its mana cost|then they put the exiled cards on the bottom of their library in a random order|they put the exiled cards on the bottom of their library in a random order)$/.test(l)) return true;
  // --- counters that send the spell elsewhere; Trickbind ---
  if (/^counter target spell$/.test(l) && /tibalt's trickery|its controller mills that many/.test(full) && ctx.it && ctx.it.tgt){ const x = stackAll().find(i => i.sid === ctx.it.tgt); if (x) ctx.r21ctl = {pid:x.pid, nm:x.nm}; return false; }
  if (/^counter target spell$/.test(l) && (m = full.match(/if that spell is countered this way, put it (into its owner's hand|on top of its owner's library) instead of into that player's graveyard/))){
    const dest = /hand/.test(m[1]) ? 'hand' : 'top'; ctx.r21ctr = true;
    const it = ctx.it; if (!it || !it.tgt) return true;
    const x = stackAll().find(i => i.sid === it.tgt); if (!x){ log(`${name} fizzled — its target is gone`); return true; }
    const leg = counterLegal(x, counterSpec(tname(info(it.k)?.o, it.nm))); if (!leg.ok){ log(`${name} fizzled — ${leg.why}`); return true; }
    if (x.kind === 'spell') emit({type:'countered', k:it.k, id:0});
    if (x.pid === MYPID) r21CounterTo(x.it, dest, MYPID); else { sendRq(x.pid, 'r21ctr', 0, name, {d:`${x.sid}|${dest}`}); log(`countered ${x.nm} — it goes ${dest === 'hand' ? "to its owner's hand" : "on top of its owner's library"}`); }
    commit(); return true;
  }
  if (ctx.r21ctr && /^if that spell is countered this way, put it (into its owner's hand|on top of its owner's library) instead of into that player's graveyard$/.test(l)) return true;
  if (/^if a permanent's ability is countered this way, activated abilities of that permanent can't be activated this turn$/.test(l)){
    const sid = ctx.it && ctx.it.tgt; if (!sid || UI.dry) return true;
    const mine = (UI.r21gone || {})[sid];
    if (mine){ const c = mine.srcId != null ? S.bf.find(b => b.id === mine.srcId) : null; if (c && mine.kind === 'ability'){ c.r21noAct = turnStr(); log(`${cname(c)}: activated abilities can't be activated this turn`); } }
    else { const x = stackAll().find(i => i.sid === sid) || (UI.r21seen || {})[sid]; if (x && x.pid !== MYPID && x.kind === 'ability') sendRq(x.pid, 'r21trick', 0, name, {d:sid}); }
    commit(); return true;
  }

  // --- look at the top card, then exile it face down (Blightwing Bandit, Dream-Thief's Bandana, Edward Kenway) ---
  if ((m = l.match(/^look at the top card of (that player's|their|each opponent's|that opponent's|target opponent's) library$/)) && /^exile (it|those cards|them) face down$/m.test(String(ctx.full || '').toLowerCase().split(/(?<=\.)\s+|,? then /).map(x => x.replace(/\.$/, '').trim()).join('\n')) && /\b(play|cast)\b/.test(full)){
    await r21ExileFrom(r21Pids(m[1], ctx), ctx, {n:1, w:'r'}); ctx.r21fd = true; return true;
  }
  if (ctx.r21fd && /^exile (it|those cards|them) face down$/.test(l)) return true;
  // --- exile a permanent you may then cast (Hurl Through Hell) ---
  if ((m = l.match(/^exile (another )?target (creature|nonland permanent|artifact|creature or artifact|permanent)$/)) && /\byou may (?:cast|play) that card\b/.test(full)){
    const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; ctx.r21 = true; if (!t || UI.dry) return true;
    if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c && !c.tok){ moveCard(c.id, 'ex'); ctx.r21ids = [c.id]; ctx.lastEx = [c.id]; } else if (c) moveCard(c.id, 'ex'); }
    else { const res = await r21Ask(t.pid, 'r21exCard', 0, name, {tid:t.id, d:'r'}); ctx.r21ids = res.ids; ctx.lastEx = res.ids.slice(); }
    commit(); return true;
  }
  // --- cast a card from an opponent's graveyard (Memory Plunder, Arcane Heist) ---
  if ((m = l.match(/^(?:you may )?cast target (instant or sorcery|instant|sorcery|creature) card from an opponent's graveyard without paying its mana cost$/))){
    const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; ctx.r21 = true; if (!t || UI.dry || !t.pid || t.pid === MYPID) return true;
    const res = await r21Ask(t.pid, 'r21gyLend', 0, name, {d:t.k}); ctx.r21ids = res.ids;
    if (/if that spell would be put into their graveyard, exile it instead/.test(full)) res.ids.forEach(id => { const c = S.ex.find(x => x.id === id); if (c) c.r21exAfter = 1; });
    await r21CastNow(ctx, {free:true, max:1}); return true;
  }
  if (ctx.r21 && /^if that spell would be put into their graveyard, exile it instead$/.test(l)) return true;
  // --- Grasp of Fate: exile until this leaves ---
  if ((m = l.match(/^for each opponent, exile up to one target (nonland permanent|creature|artifact or enchantment|nonland, nontoken permanent) (?:that player|target player) controls until ~ leaves the battlefield$/))){
    ctx.r21 = true; if (UI.dry) return true; const sc = srcCardOf(ctx); if (!sc || !S.bf.includes(sc)) return true;
    for (const p of opponents()){
      const list = (OPP.get(p.pid)?.bf || []).filter(c => c.k && !c.fd && descOk(c.k, m[1].replace(/, nontoken/, ''), {tok:c.tok}));
      if (!list.length) continue;
      const v = await askChoice({title:`${name}: exile up to one of ${p.nm}'s permanents`, options:[...list.map(c => ({label:info(c.k)?.n || '?', value:String(c.id)})), {label:'None', value:''}]}); if (!v) continue;
      const res = await r21Ask(p.pid, 'r21exCard', 0, name, {tid:+v, d:'r'});
      res.ids.forEach(id => { const c = S.ex.find(x => x.id === id); if (c){ c.r21until = sc.id; c.r21keep = 1; } });
    }
    commit(); return true;
  }
  // --- for each opponent, gain control of a creature (Molten Primordial, Hideous Taskmaster, Blatant Thievery) ---
  if ((m = l.match(/^for each opponent, gain control of (up to one )?target (.+?) (?:that player|target player) controls( until end of turn)?$/))){
    ctx.r21 = true; ctx.stoleFlags = true; if (UI.dry) return true;
    const kw = (full.match(/they gain ([a-z ,]+?) until end of turn/) || [])[1]; const kws = kw ? kw.split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim()).filter(x => x && x !== 'haste') : [];
    const f = {eot:!!m[3], untap:/untap (those|that|them|it)/.test(full), haste:/gains? haste|haste,|, haste/.test(full) || /they gain [a-z ,]*haste/.test(full), kw:kws};
    for (const p of opponents()){
      const list = (OPP.get(p.pid)?.bf || []).filter(c => c.k && !c.fd && descOk(c.k, sing(m[2]) === 'permanent' ? '' : m[2], {tok:c.tok}));
      if (!list.length) continue;
      const v = await askChoice({title:`${name}: gain control of ${m[1] ? 'up to one' : 'a'} ${m[2]} ${p.nm} controls`, options:[...list.map(c => ({label:info(c.k)?.n || '?', value:String(c.id)})), ...(m[1] ? [{label:'None', value:''}] : [])]}); if (!v) continue;
      const c = list.find(x => String(x.id) === v); applyTo({t:'card', pid:p.pid, id:c.id, k:c.k}, {op:'steal', src:name, f});
    }
    commit(); return true;
  }
  if (ctx.stoleFlags && /^(untap those creatures|untap them|they gain [a-z ,]+ until end of turn|those creatures gain haste until end of turn)$/.test(l)) return true;
  // --- Insurrection, Mob Rule, Dihada ---
  if ((m = l.match(/^(untap all creatures and )?gain control of (all creatures|all nonland permanents|all artifacts|them)( with power (\d+) or (greater|less))? until end of turn$/)) && (m[2] !== 'them' || m[1])){
    ctx.stoleFlags = true; const what = m[1] ? 'creature' : sing(m[2].replace(/^all /, ''));
    const f = {eot:true, untap:!!m[1] || /untap (those creatures|them)/.test(full), haste:/(they|those creatures) gain haste/.test(full)};
    if (f.untap) S.bf.filter(c => descOk(c.k, what, {tok:c.tok})).forEach(c => { c.tap = false; c.tn = 0; });
    let n = 0;
    for (const [pid, st] of OPP) (st.bf || []).forEach(c => { if (!c.k || c.fd || !descOk(c.k, what, {tok:c.tok})) return; if (m[3]){ const pw = (stats(c, pid) || [0])[0]; if (m[5] === 'greater' ? pw < +m[4] : pw > +m[4]) return; } applyTo({t:'card', pid, id:c.id, k:c.k}, {op:'steal', src:name, f}); n++; });
    if (f.haste) S.bf.filter(c => descOk(c.k, what, {tok:c.tok}) && isCreatureCard(c)).forEach(c => { c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; });
    log(`${name}: gaining control of ${n} ${what}${n === 1 ? '' : 's'} until end of turn`); commit(); return true;
  }
  // --- exile all opponents' graveyards (no casting) ---
  if (/^exile all opponents' graveyards$/.test(l)){
    const res = await Promise.all(opponents().map(p => r21Ask(p.pid, 'r21exGyAll', 0, name, {d:/greatest power among creature cards exiled this way/.test(full) ? 'pow' : ''})));
    ctx.r21pow = res.reduce((mx, x) => Math.max(mx, x.n || 0), 0); return true;
  }
  if (ctx.r21pow !== undefined && /^create x 0\/1 black thrull creature tokens, where x is the greatest power among creature cards exiled this way$/.test(l)){ for (let i = 0; i < Math.min(ctx.r21pow, 40); i++) await createFromText('Create a 0/1 black Thrull creature token', ctx); return true; }
  // --- Villainous Wealth ---
  if ((m = l.match(/^target opponent exiles the top x cards of their library$/)) && /cast any number of spells with mana value x or less/.test(full)){ const n = (ctx.it && ctx.it.x) || 0; ctx.r21 = true; ctx.r21x = n; if (n) await r21ExileFrom(r21Pids('target opponent', ctx), ctx, {n, w:'r'}); return true; }
  // --- abilities that counter (Siren Stormtamer, Mystic Snake, Spellstutter Sprite): the target is a spell or ability ---
  if ((m = l.match(/^counter target (spell|noncreature spell|creature spell|activated ability|activated or triggered ability|spell or ability|spell, activated ability, or triggered ability|instant or sorcery spell)(?: with mana value (x) or less, where x is (.+?)| that targets you or a creature you control| with mana value x)?(?: unless its controller pays \{\d+\})?$/)) && ctx.it && ctx.it.kind !== 'spell'){
    if (UI.dry) return true;
    if (!ctx.it.tgt){
      const cs = counterSpec(s); let mx = null; if (m[3]) mx = countOf(m[3], ctx);
      const opts = stackAll().reverse().filter(x => x.sid !== ctx.it.sid).map(x => { const lg = counterLegal(x, cs); const mvBad = mx != null && x.kind === 'spell' && (x.mv || 0) > mx; return {label:`${x.nm} — ${x.pid === MYPID ? 'your' : nameOf(x.pid) + "'s"} ${x.kind === 'spell' ? 'spell' : 'ability'}`, value:x.sid, disabled:!lg.ok || mvBad, why:mvBad ? `mana value must be ${mx} or less` : lg.why || ''}; });
      if (!opts.some(o => !o.disabled)){ log(`${name}: nothing on the stack to counter`); return true; }
      const v = await askChoice({title:`${name}: what are you countering?`, options:opts}); if (!v) return true;
      ctx.it.tgt = v;
    }
    await resolveCounter(ctx); commit(); return true;
  }

  // --- copy the next instant or sorcery (Sword of Wealth and Power, Thunderclap Drake); Thousand-Year Storm ---
  if ((m = l.match(/^when you next cast an instant or sorcery spell this turn, copy (?:that spell|it)( for each time you've cast your commander from the command zone this game)?$/))){
    const n = m[1] ? Object.values(S.tax || {}).reduce((a, b) => a + (b || 0), 0) : 1; ctx.r21nc = true;
    if (!UI.dry){ (S.r21nc ||= []).push({t:turnStr(), n, src:name}); log(`${name}: the next instant or sorcery you cast this turn will be copied${n !== 1 ? ' ' + n + ' times' : ''}`); }
    commit(); return true;
  }
  if (ctx.r21nc && /^you may choose new targets for the (copy|copies)$/.test(l)) return true;
  if (/^copy it for each other instant and sorcery spell you've cast before it this turn$/.test(l) && ctx.it){
    if (UI.dry) return true;
    const sp = stackAll().filter(i => i.kind === 'spell' && i.pid === MYPID && (!ctx.it.evId || (i.it && i.it.card && i.it.card.id === ctx.it.evId) || i.k === ctx.it.evk)).pop(); if (!sp){ log(`${name}: the spell is gone`); return true; }
    const n = Math.max(0, (S.casts || []).filter(x => x.t === turnStr() && /\b(Instant|Sorcery)\b/.test(info(x.k)?.t || '')).length - 1);
    if (n) await copyMany({...ctx, it:{...ctx.it, tgt:sp.sid}}, n); else log(`${name}: no other instants or sorceries cast before it this turn`);
    ctx.r21nc = true; return true;
  }
  // --- Dire Fleet Daredevil ---
  if ((m = l.match(/^exile target (instant or sorcery|instant|sorcery|creature) card from an opponent's graveyard$/)) && /\b(cast|play) it\b/.test(full)){
    const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; ctx.r21 = true; if (!t || UI.dry || !t.pid || t.pid === MYPID) return true;
    const res = await r21Ask(t.pid, 'r21gyEx', 0, name, {d:t.k}); ctx.r21ids = res.ids; ctx.lastEx = res.ids.slice(); return true;
  }
  if (ctx.r21 && /^if that spell would be put into a graveyard, exile it instead$/.test(l)){ (ctx.r21ids || []).forEach(id => { const c = S.ex.find(x => x.id === id); if (c) c.r21exAfter = 1; }); return true; }
  // --- Mind's Dilation ---
  if ((m = l.match(/^(target player|that player|target opponent|each opponent) exiles the top card of their library$/)) && /you may cast it without paying its mana cost/.test(full)){ await r21ExileFrom(r21Pids(m[1], ctx), ctx, {n:1, w:'r'}); return true; }
  if (ctx.r21 && /^if it's a nonland card, you may cast it without paying its mana cost$/.test(l)){ await r21CastNow(ctx, {free:true, max:1}); return true; }
  // --- Commandeer: gain control of target spell ---
  if ((m = l.match(/^gain control of target (noncreature spell|spell|instant or sorcery spell|creature spell)$/))){
    ctx.r21cmd = true; if (UI.dry) return true;
    const spec = m[1]; const opts = stackAll().reverse().filter(x => x.sid !== (ctx.it && ctx.it.sid)).map(x => { let why = ''; if (x.kind !== 'spell') why = 'not a spell'; else if (x.pid === MYPID) why = 'you already control it'; else if (spec !== 'spell' && !descOk(x.k, spec.replace(/ spell$/, ''))) why = `not a ${spec}`; return {label:`${x.nm} — ${nameOf(x.pid)}'s spell`, value:x.sid, disabled:!!why, why}; });
    let x = ctx.it && ctx.it.tgt ? stackAll().find(i => i.sid === ctx.it.tgt) : null;
    if (!x){ if (!opts.some(o => !o.disabled)){ log(`${name}: no spell to take`); return true; } const v = await askChoice({title:`${name}: gain control of which spell?`, options:opts}); x = v ? stackAll().find(i => i.sid === v) : null; }
    if (!x || x.pid === MYPID) return true;
    const res = await r21Ask(x.pid, 'r21spellGive', 0, name, {d:x.sid}); const c = res.ids.map(id => S.ex.find(e => e.id === id)).find(Boolean); if (!c){ log(`${name}: ${x.nm} is no longer on the stack`); return true; }
    S.ex.splice(S.ex.indexOf(c), 1); c.r21sent = 1; sendRq(c.own.pid, 'r21cast', 0, cname(c), {ref:c.own.ref});
    const a = info(c.k); let tgts = null; const old = String(res.d || '').split(';').filter(Boolean).map(r21DecT).filter(t => t.t !== 'stack');
    if (old.length) tgts = [old];
    if (/you may choose new targets for it/.test(full) && targetSpecs(a.o).length && await askYes(`${name}: choose new targets for ${a.n}?`, 'Choose new targets', 'Keep them')){ const t = await chooseTargets(a.o, {pid:MYPID, col:a.c, types:a.t, id:c.id}, `${a.n}: new targets`); if (t) tgts = t; }
    const it = {sid:rid(6), o:x.o, kind:'spell', card:c, k:c.k, nm:a.n, txt:a.o, mv:x.mv || a.mv || 0, ty:a.t, tgts, tgtNm:tgts ? tgtLabel(tgts) : '', x:x.x || 0, from:'stack'};
    S.stk.push(it); log(`${name}: gained control of ${a.n}${it.tgtNm ? ' → ' + it.tgtNm : ''}`); commit(); return true;
  }
  if (ctx.r21cmd && /^you may choose new targets for it$/.test(l)) return true;
  // --- change targets ---
  if ((m = l.match(/^(?:you may )?(change the target of|choose new targets for) target (spell or ability|spell|instant or sorcery spell|activated or triggered ability)( with a single target)?$/))){
    if (!UI.dry) await r21Retarget(ctx, {spec:m[2], single:!!m[3] || /change the target/.test(m[1]), may:/^you may/.test(l)}); return true;
  }
  if (/^change a target of target spell or ability to ~$/.test(s.toLowerCase().replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').toLowerCase(), 'g'), '~')) || /^change a target of target spell or ability to (~|this creature|this artifact)$/.test(l)){
    if (!UI.dry) await r21Retarget(ctx, {spec:'spell or ability', single:true, toSelf:true}); return true;
  }
  // --- gain control of all … that player controls ---
  if ((m = l.match(/^gain control of all (artifacts|creatures|enchantments|lands|permanents|nonland permanents) (that player|target player|target opponent|defending player) controls( until end of turn)?$/))){
    const pid = r21Pids(m[2], ctx)[0]; if (!pid || pid === MYPID) return true;
    const d = sing(m[1]); const list = (OPP.get(pid)?.bf || []).filter(c => c.k && !c.fd && descOk(c.k, d === 'permanent' ? '' : d, {tok:c.tok}));
    list.forEach(c => applyTo({t:'card', pid, id:c.id, k:c.k}, {op:'steal', src:name, f:{eot:!!m[3]}}));
    log(`${name}: gaining control of ${list.length} ${list.length === 1 ? d : m[1]} ${nameOf(pid)} controls${m[3] ? ' until end of turn' : ''}`); commit(); return true;
  }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound21EPre(s, l, ctx)) return; return ds(s0, ctx); };
}
// Maralen, Fae Ascendant: enforced on the cards her trigger exiles (mayPlay.r21once + r21mvElf, see exWindowOk above)
STATIC_RULES.push([/^once each turn, you may cast a spell with mana value less than or equal to the number of elves and faeries you control from among cards exiled with .+ this turn without paying its mana cost$/, m => ({kind:'r21maralen', who:'you'})]);
