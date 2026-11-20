/* ===================== Rules engine — round 26 helper B2: long tail, ranks 3301–5080 ===================== */
RQ_OPS.push('r26b');
const B26 = { h:{} };
const b26T = ctx => (ctx && ctx.tgts ? nextTargets(ctx) : []);
const b26Src = ctx => srcCardOf(ctx) || (ctx && ctx.it && ctx.it.srcId != null ? find(ctx.it.srcId)[2] : null);
const b26P = c => { try { return (stats(c) || [0, 0])[0]; } catch { return 0; } };
const b26Leg = k => /\bLegendary\b/.test(info(k)?.t || '');
// ask another player's client to do something (sub-command `sub`), optionally waiting for a numeric reply
async function b26Ask(pid, sub, n, src, d, wait){
  if (UI.dry || !pid || pid === MYPID) return null;
  const ref = wait ? rid(6) : ''; sendRq(pid, 'r26b', n || 0, src, {ref, d:(sub + '|' + (d || '')).slice(0, 80)}); commit();
  if (!wait) return null;
  const a = await waitUntil(() => R22.ans[ref], 90000); return a ? a.idx : null;
}
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'r26b'){
      const s = String(r.d || ''); const i = s.indexOf('|'); const sub = i < 0 ? s : s.slice(0, i); const rest = i < 0 ? '' : s.slice(i + 1); const h = B26.h[sub];
      (async () => { let out = []; try { if (h) out = (await h(r, from, rest)) || []; } catch (e){ console.warn(e); }
        if (r.ref) sendRq(from, 'r22pickAns', out.length, r.src, {ref:r.ref, d:out.join(',')}); commit(); })();
      return;
    }
    return ao(r, from);
  };
}

/* ---------- "Ao" (two-letter short name) is the card's name in its rules text ---------- */
{
  const tn = tname;
  tname = function(txt, name){ let t = tn(txt, name); try { const s = String(name || '').split(' // ')[0].split(',')[0]; if (s && s.length >= 2 && s.length <= 3 && s !== 'The' && s !== String(name) && /^[A-Z][a-z]+$/.test(s) && legendName(String(name))) t = t.replace(new RegExp('\\b' + s + '(?=\\b(?!,))', 'g'), '~'); } catch {} return t; };
}

/* ---------- Platinum Angel-style "you can't lose the game" (static and granted by The Book of Exalted Deeds) ---------- */
function b26NoLose(){ if (!S) return false; return rulesOn('noLose').length > 0 || S.bf.some(c => c.b26noLose && !c.fd && c.k); }
{
  const sb = sba;
  sba = function(...a){
    if (!S || !b26NoLose()) return sb.apply(this, a);
    const life = S.life, psn = S.psn, cdt = {...S.cdt};
    if (S.life <= 0) S.life = 1; if (S.psn >= 10) S.psn = 9; for (const k in S.cdt) if (S.cdt[k] >= 21) S.cdt[k] = 20;
    let r; try { r = sb.apply(this, a); } finally { S.life = life; S.psn = psn; S.cdt = cdt; }
    if (S.lost){ S.lost = ''; S.g23lost = 0; }
    return r;
  };
}
B26.h.noLose = (r) => { const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c){ c.b26noLose = 1; log(`${cname(c)} gains "You can't lose the game and your opponents can't win the game" (${r.src})`); } };

/* ---------- each-opponent choices on their own client ---------- */
// Olórin's Searing Light: exile a creature with the greatest power; reply with its power
B26.h.exBig = async (r) => {
  const cr = S.bf.filter(c => c.k && !c.fd && isCreatureCard(c)); if (!cr.length){ log(`has no creature to exile (${r.src})`); return [0]; }
  const mx = Math.max(...cr.map(b26P)); const top = cr.filter(c => b26P(c) === mx);
  let id = top[0].id; if (top.length > 1){ const ids = await pickCards({title:`${r.src}: exile a creature with the greatest power (${mx})`, cards:top, min:1, max:1}); if (ids && ids[0] != null) id = ids[0]; }
  const c = S.bf.find(b => b.id === id); const p = c ? b26P(c) : 0; if (c){ moveCard(single(c).id, 'ex', {quiet:true}); log(`exiled ${cname(c)} (${r.src})`); } return [Math.max(0, p)];
};
// Nicol Bolas, Dragon-God +1: exile a card from hand or a permanent
B26.h.handOrPerm = async (r) => {
  const pool = S.hand.concat(S.bf.filter(c => c.k && !c.fd)); if (!pool.length){ log(`has nothing to exile (${r.src})`); return []; }
  const ids = await pickCards({title:`${r.src}: exile a card from your hand or a permanent you control`, cards:pool, min:1, max:1});
  const id = ids && ids[0] != null ? ids[0] : pool[0].id; const [z, , c] = find(id); if (c){ const x = z === 'bf' ? single(c) : c; moveCard(x.id, 'ex', {quiet:true}); log(`exiled ${cname(x)} from ${z === 'bf' ? 'the battlefield' : 'their hand'} (${r.src})`); } return [];
};
// Bringer of the Last Gift: sacrifice all other creatures, then return creature cards that weren't put there this way
function b26Bringer(srcId, src){
  const ids = new Set(); S.bf.filter(c => c.k && isCreatureCard(c) && c.id !== srcId).forEach(c => { ids.add(c.id); moveCard(c.id, 'gy', {quiet:true, sac:true}); });
  if (ids.size) log(`sacrificed ${ids.size} creature${ids.size === 1 ? '' : 's'} (${src})`);
  const back = S.gy.filter(c => isCreatureCard(c) && !ids.has(c.id)); back.forEach(c => moveCard(c.id, 'bf', {quiet:true}));
  if (back.length) log(`returned ${back.map(cname).join(', ')} to the battlefield (${src})`); commit();
}
B26.h.bringer = (r) => { b26Bringer(-1, r.src); };

async function b26Pre(s, l, ctx){
  let m; const name = ctx.name || ''; const full = String(ctx.full || '').toLowerCase();

  // ---- Inspirit, Flagship Vessel
  if (/^put your choice of a \+1\/\+1 counter or two charge counters on up to one other target artifact$/.test(l)){
    const t = b26T(ctx)[0]; if (!t) return true;
    const ch = UI.dry ? 'cp' : await askChoice({title:`${name}: put what on ${t.nm || 'the artifact'}?`, options:[{label:'A +1/+1 counter', value:'cp'}, {label:'Two charge counters', value:'charge'}]});
    if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c){ if (ch === 'charge') addNamed(c, 'charge', 2); else modCounters(c, 'cp', 1); log(`${cname(c)} gets ${ch === 'charge' ? 'two charge counters' : 'a +1/+1 counter'} (${name})`); } }
    else applyTo(t, {op:'ctr', n:ch === 'charge' ? 2 : 1, d:ch === 'charge' ? 'charge' : 'cp', src:name});
    commit(); return true; }

  // ---- Bonny Pall: Beau
  if (/^create beau, a legendary blue ox creature token with "beau's power and toughness are each equal to the number of lands you control\.?"$/.test(l)){
    const k0 = customToken('Beau', '0/0', 'U'); const k = k0 + '|b26beau'; if (!DICT.has(k)) DICT.set(k, {...DICT.get(k0), k, n:'Beau', t:'Legendary Token Creature — Ox', o:"Beau's power and toughness are each equal to the number of lands you control."});
    createToken(k, tokenMult(k), null, {}); log(`${name}: created Beau (power and toughness = lands you control)`); commit(); return true; }

  // ---- The Book of Exalted Deeds
  if (/^it gains "you can't lose the game and your opponents can't win the game\.?"(?:\.? activate only as a sorcery)?$/.test(l)){
    const t = (ctx.lastT || [])[0]; if (!t || t.t === 'player') return true;
    if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c){ c.b26noLose = 1; log(`${cname(c)} gains "You can't lose the game and your opponents can't win the game"`); } }
    else sendRq(t.pid, 'r26b', 0, name, {tid:t.id, d:'noLose|'});
    commit(); return true; }

  // ---- Sin, Unending Cataclysm / "shuffle ~ into its owner's library"
  if (/^shuffle ~ into its owner's library$/.test(l)){
    const id = ctx.srcId != null ? ctx.srcId : ctx.it && ctx.it.srcId; const [z, , c] = id != null ? find(id) : [null];
    if (c && z && z !== 'lib' && z !== 'stk'){ moveCard(c.id, 'lib', {quiet:true}); shuffle(S.lib); log(`${name} was shuffled into its owner's library`); }
    commit(); return true; }

  // ---- Olórin's Searing Light
  if (/^each opponent exiles a creature with the greatest power among creatures (?:that|target) player controls$/.test(l)){
    ctx.b26exP = {};
    for (const p of opponents()){ const a = await b26Ask(p.pid, 'exBig', 0, name, '', true); ctx.b26exP[p.pid] = a ? +a[0] || 0 : 0; }
    log(`${name}: each opponent exiles their most powerful creature`); commit(); return true; }
  if (/^(?:spell mastery — )?(?:if there are two or more instant and\/or sorcery cards in your graveyard, )?~ deals damage to each opponent equal to the power of the creature they exiled$/.test(l)){
    if (/^spell mastery|^if there/.test(l) && S.gy.filter(c => /\b(Instant|Sorcery)\b/.test(info(c.k)?.t || '')).length < 2) return true;
    const P = ctx.b26exP || {}; const src = b26Src(ctx); for (const p of opponents()){ const n = P[p.pid] || 0; if (n > 0) dealDamage({t:'player', pid:p.pid}, n, ctx.k, src); } commit(); return true; }

  // ---- Nicol Bolas, Dragon-God
  if (/^each opponent exiles a card from their hand or a permanent they control$/.test(l)){
    for (const p of opponents()) await b26Ask(p.pid, 'handOrPerm', 0, name, '', true); log(`${name}: each opponent exiles a card from their hand or a permanent`); commit(); return true; }
  if (/^each opponent who doesn't control a legendary creature or planeswalker loses the game$/.test(l)){
    for (const p of opponents()){ const bf = OPP.get(p.pid)?.bf || []; const ok = bf.some(c => c.k && !c.fd && (/\bLegendary\b.*\bCreature\b|\bPlaneswalker\b/.test(info(c.k)?.t || '')));
      if (!ok){ sendRq(p.pid, 'g23lose', 0, name); log(`${name}: ${nameOf(p.pid)} loses the game`); } }
    commit(); return true; }

  // ---- Burning-Rune Demon
  if (/^you may search your library for exactly two cards not named ~ that have different names$/.test(l)){
    ctx.b26brd = null; const pool = S.lib.filter(c => cname(c) !== name);
    if (UI.dry){ ctx.b26brd = pool.slice(0, 2).map(c => c.id); return true; }
    if (!(await askYes(`${name}: search your library for two cards with different names?`, 'Search', "Don't"))) return true;
    for (let tries = 0; tries < 3; tries++){
      const ids = await pickCards({title:`${name}: choose exactly two cards with different names`, cards:pool, min:2, max:2});
      if (!ids || ids.length !== 2) break; const a = find(ids[0])[2], b = find(ids[1])[2];
      if (a && b && cname(a) !== cname(b)){ ctx.b26brd = ids; break; } toast('The two cards must have different names');
    }
    if (!ctx.b26brd) log(`${name}: didn't search`); return true; }
  if (/^if you do, reveal those cards$/.test(l) && ctx.b26brd !== undefined){ if (ctx.b26brd) log(`${name}: revealed ${ctx.b26brd.map(id => cname(find(id)[2])).join(' and ')}`); return true; }
  if (/^an opponent chooses one of them$/.test(l) && ctx.b26brd !== undefined){
    if (!ctx.b26brd) return true; const cards = ctx.b26brd.map(id => find(id)[2]).filter(Boolean);
    const pid = UI.dry ? null : await choosePlayer(`${name}: which opponent chooses?`, true);
    const got = pid ? await r22oppPick(pid, cards, 1, 'choose the card that goes to their hand', name) : [cards[0] && cards[0].id];
    ctx.b26brdPick = got && got[0] != null ? got[0] : cards[0] && cards[0].id; return true; }
  if (/^put the chosen card into your hand and the other into your graveyard$/.test(l) && ctx.b26brd !== undefined){
    if (!ctx.b26brd) return true; for (const id of ctx.b26brd){ if (find(id)[0] !== 'lib') continue; moveCard(id, id === ctx.b26brdPick ? 'hand' : 'gy', {quiet:true}); }
    const h = find(ctx.b26brdPick)[2]; log(`${name}: put ${h ? cname(h) : 'a card'} into their hand and the other card into their graveyard`); commit(); return true; }

  // ---- Bringer of the Last Gift
  if (/^each player sacrifices all other creatures they control$/.test(l) && /weren't put there this way/.test(full)){
    const src = b26Src(ctx); opponents().forEach(p => b26Ask(p.pid, 'bringer', 0, name, '', false));
    if (!UI.dry) b26Bringer(src ? src.id : -1, name); ctx.b26bringer = 1; commit(); return true; }
  if (/^(?:then )?each player returns all creature cards from their graveyard that weren't put there this way to the battlefield$/.test(l) && /each player sacrifices all other creatures they control/.test(full)){ return true; /* done together with the sacrifice above, on each player's own client */ }

  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await b26Pre(s, l, ctx)) return; return ds(s0, ctx); }; }

/* ===================== batch 2 ===================== */
// ---- Sphinx's Tutelage: the milled player's client repeats the process itself
B26.h.tutelage = (r) => {
  for (let i = 0; i < 60 && S.lib.length; i++){
    const out = S.lib.slice(0, 2); mill(2);
    const nl = out.filter(c => !isLand(c.k)); const cols = nl.map(c => String(info(c.k)?.c || '').replace(/[^WUBRG]/g, ''));
    if (!(out.length === 2 && nl.length === 2 && cols[0] && [...cols[0]].some(x => cols[1].includes(x)))) break;
    log(`two nonland cards that share a color were milled — repeat (${r.src})`);
  }
};
// ---- Portent: the target player shows their top three cards; the caster orders them
B26.h.top3 = (r) => { const n = Math.min(r.n || 3, S.lib.length); const ref = rid(6); S.pile = {ref, ks:S.lib.slice(0, n).map(c => c.k)}; S.b26pileT = S.lib.slice(0, n).map(c => c.id); commit(); return [n]; };
B26.h.order = (r, from, d) => { const [o0, sh] = String(d).split('|'); const ord = String(o0).split(',').filter(x => x !== '').map(Number); const ids = S.b26pileT || []; const cards = ids.map(id => S.lib.find(c => c.id === id)).filter(Boolean);
  if (cards.length === ids.length && ord.length === cards.length && ord.every(i => Number.isInteger(i) && cards[i]) && new Set(ord).size === ord.length){ cards.forEach(c => S.lib.splice(S.lib.indexOf(c), 1)); S.lib.unshift(...ord.map(i => cards[i])); log(`${nameOf(from)} put the top ${cards.length} cards of their library back in a new order (${r.src})`); }
  S.pile = null; S.b26pileT = null; if (sh === 'shuffle') shuffleLib(); commit(); };
async function b26orderTop(cards, title){
  if (UI.dry || cards.length < 2) return cards.map((c, i) => i);
  const ids = await pickCards({title:`${title} — pick them in order: the first one you pick ends up on top`, cards, min:cards.length, max:cards.length});
  if (!ids || ids.length !== cards.length) return cards.map((c, i) => i);
  return ids.map(id => cards.findIndex(c => c.id === id));
}
// ---- Satoru, the Infiltrator: remember whether a permanent was cast and how much mana was spent
{
  const rt = resolveTop;
  resolveTop = async function(it, ...a){ if (it && it.kind === 'spell' && it.card && !it.copy) UI.b26res = {id:it.card.id, spent:it.qspent != null ? it.qspent : (it.free || it.r21free ? 0 : (it.mv || 0))}; try { return await rt(it, ...a); } finally { UI.b26res = null; } };
  const oe = onEnter;
  onEnter = function(c, from, o = {}){ try { if (c){ if (UI.b26res && UI.b26res.id === c.id){ c.b26cast = 1; c.b26spent = UI.b26res.spent; } else { delete c.b26cast; delete c.b26spent; } } } catch {} return oe(c, from, o); };
  const ct = classifyTrig;
  classifyTrig = function(w, c){ const r = ct(w, c); if (r) return r; let m;
    if ((m = String(c).match(/^~ and\/or one or more other (nontoken creatures|creatures) you control enter$/))) return {ev:'enter', subj:'selfOr', ctl:'you', desc:m[1].replace(/s$/, ''), batch:true, b26batch:1};
    return null; };
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){ pt(src, t, ev, evPid); try { if (t && t.b26batch){ const it = S.stk[S.stk.length - 1]; if (it) it.b26ids = (UI.curQ || []).filter(([p, e]) => p === MYPID && e.type === 'enter').map(([, e]) => e.id); } } catch {} };
}
// ---- Unable to Scream: a face-down creature it enchants can't be turned face up
STATIC_RULES.push([/^as long as enchanted creature is face down, it can't be turned face up$/, m => ({kind:'b26noUp', who:'all'})]);
function b26noUp(c){ if (!c || !S) return false; const pid = l24pidOf(c) || MYPID; return boardsAll().some(b => b.bf.some(a => a.k && !a.fd && a.att && a.att.id === c.id && a.att.pid === pid && /as long as enchanted creature is face down, it can't be turned face up/i.test(info(a.k)?.o || ''))); }
{ const tu = turnUpCost; turnUpCost = function(c){ if (c && c.fd && b26noUp(c)) return null; return tu(c); };
  const tf = turnFaceUp; turnFaceUp = function(c){ if (c && c.fd && b26noUp(c)){ toast("It's enchanted by Unable to Scream — it can't be turned face up"); return; } return tf(c); }; }
// ---- Flickering Ward: protection from the chosen color
STATIC_RULES.push([/^enchanted creature has protection from the chosen color$/, m => ({kind:'b26protCol', who:'all'})], [/^this effect doesn't remove (?:this aura|~)$/, m => ({kind:'b26protCol', who:'all'})]);
{
  const COLN = {W:'white', U:'blue', B:'black', R:'red', G:'green'};
  const pf = protFrom; protFrom = function(c){ const out = pf(c); try { if (c && S){ const pid = l24pidOf(c) || MYPID; for (const b of boardsAll()) for (const a of b.bf) if (a.k && !a.fd && a.att && a.att.id === c.id && a.att.pid === pid && a.col && COLN[a.col] && /enchanted creature has protection from the chosen color/i.test(info(a.k)?.o || '')) out.push(COLN[a.col]); } } catch {} return out; };
  const oe = onEnter;
  onEnter = function(c, from, o){ const r = oe(c, from, o); try { if (c && S && S.bf.includes(c) && !UI.dry && !c.col && /as this aura enters, choose a color/i.test(info(c.k)?.o || '')){ (async () => { const v = await askChoice({title:`${cname(c)}: choose a color`, options:['W', 'U', 'B', 'R', 'G'].map(x => ({label:COLN[x], value:x}))}); c.col = v || 'W'; log(`${cname(c)}: chose ${COLN[c.col]}`); commit(); })(); } } catch {} return r; };
}
// ---- New Blood: the stolen creature's creature type becomes Vampire
function b26vamp(c){ const p = (S.b26vamp || []).find(x => x.k === c.k); if (!p) return; S.b26vamp.splice(S.b26vamp.indexOf(p), 1);
  const sub = l24parse(info(c.k)?.t || '').sub.map(w => w === p.from ? 'Vampire' : w); l24addMod(c, {s:p.src, u:'', setSub:[...new Set(sub)]}); log(`${cname(c)}: ${p.from} → Vampire (${p.src})`); }
{ const tc = takeCard; takeCard = function(r, from){ const n0 = S.bf.length; const out = tc(r, from); try { if ((S.b26vamp || []).length && S.bf.length > n0) b26vamp(S.bf[S.bf.length - 1]); } catch {} return out; }; }
// ---- The Deck of Many Things: "when that creature dies, its owner loses the game"
{ const mc = moveCard;
  moveCard = function(id, to, o = {}){ let doom = null; try { const c = S && S.bf.find(b => b.id === id); if (c && c.b26doom && to !== 'bf') doom = {own:c.own ? c.own.pid : c.b26doom, die:to === 'gy' && isCreatureCard(c), nm:cname(c)}; } catch {}
    const r = mc(id, to, o);
    try { if (doom && doom.die){ if (doom.own === MYPID){ S.g23lost = 1; S.lost = `lost the game (The Deck of Many Things)`; log(`☠ ${doom.nm} died — its owner loses the game (The Deck of Many Things)`); } else { sendRq(doom.own, 'g23lose', 0, 'The Deck of Many Things'); log(`${doom.nm} died — ${nameOf(doom.own)} loses the game (The Deck of Many Things)`); } commit(); } } catch {}
    return r; };
  const tc = takeCard; takeCard = function(r, from){ const n0 = S.bf.length; const out = tc(r, from); try { if (S.b26doomK && S.bf.length > n0){ const c = S.bf[S.bf.length - 1]; if (c.k === S.b26doomK){ c.b26doom = from; S.b26doomK = null; } } } catch {} return out; };
}
// ---- Reins of Power: the opponent hands me their creatures (untapped, haste) until end of turn
B26.h.reins = (r, from) => { const list = S.bf.filter(c => c.k && !c.fd && isCreatureCard(c) && !c.own); list.forEach(c => { c.tap = false; giveAway(single(c), from, {eot:1, haste:1, untap:1}); }); commit(); };
// ---- Walking Bulwark on another player's creature
B26.h.bulwark = (r) => { const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c){ c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; c.g23def = turnStr(); c.tdt = turnStr(); log(`${cname(c)} gains haste, can attack despite defender and assigns combat damage by toughness this turn (${r.src})`); } };

async function b26Pre2(s, l, ctx){
  let m; const name = ctx.name || ''; const full = String(ctx.full || '').toLowerCase();

  // ---- Sphinx's Tutelage
  if (/^target opponent mills two cards$/.test(l) && /if two nonland cards that share a color were milled this way, repeat this process/.test(full)){
    const t = b26T(ctx).find(x => x.t === 'player') || (UI.dry ? null : null); ctx.b26tut = 1; if (!t || t.pid === MYPID) return true;
    b26Ask(t.pid, 'tutelage', 2, name, '', false); log(`${name}: ${nameOf(t.pid)} mills two cards (repeating while two nonland cards share a color)`); return true; }
  if (/^if two nonland cards that share a color were milled this way, repeat this process$/.test(l) && ctx.b26tut) return true;

  // ---- Portent
  if ((m = l.match(/^look at the top (three|two|four|\w+) cards of target player's library$/)) && /put them back in any order/.test(full)){
    const n = wn(m[1]) || 3; const t = b26T(ctx).find(x => x.t === 'player'); ctx.b26portent = {pid:t ? t.pid : MYPID, n}; return true; }
  if (/^put them back in any order$/.test(l) && ctx.b26portent){
    const {pid, n} = ctx.b26portent;
    if (pid === MYPID){ const cards = S.lib.slice(0, n); if (cards.length){ log(`${name}: looked at the top ${cards.length} cards of their library`); const ord = await b26orderTop(cards, name); S.lib.splice(0, cards.length, ...ord.map(i => cards[i])); } commit(); return true; }
    if (UI.dry) return true;
    const a = await b26Ask(pid, 'top3', n, name, '', true); const cnt = a ? a[0] || 0 : 0; if (!cnt) return true;
    const pile = await waitUntil(() => { const p = OPP.get(pid)?.pile; return p && p.ks && p.ks.length === cnt ? p : null; }, 15000); if (!pile) return true;
    const cards = pile.ks.map((k, i) => ({id:-2000 - i, k})); log(`${name}: looked at the top ${cnt} cards of ${nameOf(pid)}'s library`);
    ctx.b26portent.ord = await b26orderTop(cards, `${name}: ${nameOf(pid)}'s library`); ctx.b26portent.wait = 1; return true; }
  if (/^you may have (?:that|target) player shuffle$/.test(l) && ctx.b26portent){
    const {pid, ord} = ctx.b26portent; const sh = UI.dry ? false : await askYes(`${name}: have ${pid === MYPID ? 'yourself' : nameOf(pid)} shuffle?`, 'Shuffle', "Don't");
    if (pid === MYPID){ if (sh) shuffleLib(); }
    else if (ctx.b26portent.wait) b26Ask(pid, 'order', 0, name, (ord || []).join(',') + (sh ? '|shuffle' : ''), false);
    commit(); return true; }

  // ---- Satoru, the Infiltrator
  if (/^if none of them were cast or no mana was spent to cast them, draw a card$/.test(l)){
    const ids = (ctx.it && ctx.it.b26ids) || []; const cs = ids.map(id => S.bf.find(b => b.id === id)).filter(Boolean);
    const spent = cs.reduce((a, c) => a + (c.b26cast ? (c.b26spent || 0) : 0), 0);
    if (spent > 0 && !UI.dry){ log(`${name}: mana was spent to cast them — no card`); return true; } draw(1); return true; }

  // ---- Verity Circle
  if (/^if it isn't being declared as an attacker, you may draw a card$/.test(l)){
    const pid = ctx.it && ctx.it.evPid, id = ctx.it && ctx.it.evId; const c = pid && id != null ? boardOf(pid).find(b => b.id === id) : null;
    if (c && c.atk){ log(`${name}: it was declared as an attacker — no card`); return true; }
    if (UI.dry || await askYes(`${name}: draw a card?`, 'Draw', "Don't")) draw(1); return true; }

  // ---- Goldberry, River-Daughter
  if (/^move a counter of each kind not on ~ from another target permanent you control onto ~$/.test(l)){
    const t = b26T(ctx)[0]; const me = b26Src(ctx); const c = t && t.pid === MYPID ? S.bf.find(b => b.id === t.id) : null; if (!c || !me || c === me) return true;
    const moved = []; const has = (x, k) => k === 'cp' ? (x.cp || 0) > 0 : k === 'cm' ? (x.cm || 0) > 0 : ((x.nc || {})[k] || 0) > 0;
    for (const k of ['cp', 'cm', ...Object.keys(c.nc || {})]){ if (!has(c, k) || has(me, k)) continue;
      if (k === 'cp' || k === 'cm'){ c[k] = (c[k] || 0) - 1; me[k] = (me[k] || 0) + 1; } else { addNamed(c, k, -1); addNamed(me, k, 1); } moved.push(k === 'cp' ? '+1/+1' : k === 'cm' ? '−1/−1' : k); }
    if (moved.length) log(`${name}: moved a ${moved.join(', ')} counter from ${cname(c)} onto ${name}`); commit(); return true; }
  if (/^move one or more counters from ~ onto another target permanent you control$/.test(l)){
    const t = b26T(ctx)[0]; const me = b26Src(ctx); const c = t && t.pid === MYPID ? S.bf.find(b => b.id === t.id) : null; ctx.b26moved = 0; if (!c || !me || c === me) return true;
    const kinds = [['cp', me.cp || 0], ['cm', me.cm || 0], ...Object.entries(me.nc || {})].filter(([, n]) => n > 0); if (!kinds.length) return true;
    const lbl = k => k === 'cp' ? '+1/+1' : k === 'cm' ? '−1/−1' : k;
    if (UI.dry){ ctx.b26moved = 1; return true; }
    for (const [k, have] of kinds){ const n = clamp(+(await askNumber(`${name}: move how many ${lbl(k)} counters onto ${cname(c)}? (has ${have})`, String(have), have)) || 0, 0, have); if (!n) continue;
      if (k === 'cp' || k === 'cm'){ me[k] -= n; c[k] = (c[k] || 0) + n; } else { addNamed(me, k, -n); addNamed(c, k, n); } ctx.b26moved += n; log(`${name}: moved ${n} ${lbl(k)} counter${n === 1 ? '' : 's'} onto ${cname(c)}`); }
    commit(); return true; }
  if (/^if you do, draw a card$/.test(l) && ctx.b26moved !== undefined){ if (ctx.b26moved) draw(1); return true; }

  // ---- New Blood
  if (/^change the text of that creature by replacing all instances of one creature type with vampire$/.test(l)){
    const t = (ctx.lastT || [])[0]; if (!t || t.t === 'player') return true; const subs = l24parse(info(t.k)?.t || '').sub.filter(l24isCreSub).filter(w => w !== 'Vampire'); if (!subs.length) return true;
    const from = subs.length === 1 || UI.dry ? subs[0] : await askChoice({title:`${name}: replace which creature type with Vampire?`, options:subs.map(x => ({label:x, value:x}))});
    if (UI.dry) return true; S.b26vamp = (S.b26vamp || []).concat({k:t.k, from:from || subs[0], src:name});
    const c = S.bf.find(b => b.k === t.k && (b.own || t.pid === MYPID) && (b.id === t.id || b.own)); if (c) b26vamp(c); commit(); return true; }

  // ---- The Deck of Many Things
  if (/^roll a d20 and subtract the number of cards in your hand$/.test(l)){
    const r = 1 + Math.floor(Math.random() * 20); ctx.roll = r - S.hand.length; if (!UI.dry){ log(`🎲 ${name}: rolled ${r} − ${S.hand.length} = ${ctx.roll}`); emit({type:'roll', x:r, cnt:1}); }
    ctx.b26deck = 1; return true; }
  if (/^if the result is 0 or less, discard your hand$/.test(l) && ctx.b26deck){
    if (!UI.dry && ctx.roll <= 0){ S.hand.slice().forEach(c => moveCard(c.id, 'gy')); log(`${name}: discarded their hand`); }
    if (!/\n\d+(?:—\d+)? \|/.test(String(ctx.full || ''))){ const rows = tname(info(ctx.k)?.o || '', name).split('\n').map(x => x.trim()).filter(x => /^\d+(?:—\d+)? \| /.test(x)); for (const row of rows) await doSentence(row, ctx); }
    commit(); return true; }
  if (/^put a creature card from any graveyard onto the battlefield under your control$/.test(l) && /when that creature dies, its owner loses the game/.test(String(info(ctx.k)?.o || '').toLowerCase())){
    const pool = [...S.gy.filter(c => isCreatureCard(c)).map(c => ({id:c.id, k:c.k, pid:MYPID}))]; for (const p of opponents()) (OPP.get(p.pid)?.gy || []).forEach((c, i) => { if (c && c.k && /\bCreature\b/.test(info(c.k)?.t || '')) pool.push({id:-3000 - pool.length, k:c.k, pid:p.pid}); });
    ctx.b26deckPut = 1; if (!pool.length || UI.dry) return true;
    const ids = await pickCards({title:`${name}: put a creature card from any graveyard onto the battlefield`, cards:pool, min:1, max:1}); const pk = pool.find(x => ids && x.id === ids[0]) || pool[0];
    if (pk.pid === MYPID){ moveCard(pk.id, 'bf'); const c = S.bf.find(b => b.id === pk.id); if (c) c.b26doom = MYPID; }
    else { S.b26doomK = pk.k; sendRq(pk.pid, 'gytake', 0, name, {d:pk.k}); log(`${name}: takes ${info(pk.k)?.n} from ${nameOf(pk.pid)}'s graveyard`); }
    commit(); return true; }
  if (/^when that creature dies, its owner loses the game$/.test(l) && (ctx.b26deckPut || UI.dry && /deck of many things/i.test(name))) return true;

  if (/^return a card at random from your graveyard to your hand$/.test(l)){ if (!S.gy.length) return true; const c = S.gy[Math.floor(Math.random() * S.gy.length)]; moveCard(c.id, 'hand'); commit(); return true; }

  // ---- Reins of Power
  if (/^untap all creatures you control and all creatures target opponent controls$/.test(l) && /each gain control of all creatures the other controls until end of turn/.test(full)){
    const t = b26T(ctx).find(x => x.t === 'player'); ctx.b26reins = t ? t.pid : null; S.bf.filter(c => isCreatureCard(c)).forEach(c => { c.tap = false; }); log(`${name}: untapped all creatures`); commit(); return true; }
  if (/^you and that opponent each gain control of all creatures the other controls until end of turn$/.test(l) && ctx.b26reins !== undefined){
    const pid = ctx.b26reins; if (!pid || pid === MYPID || UI.dry) return true;
    b26Ask(pid, 'reins', 0, name, '', false);
    S.bf.filter(c => c.k && !c.fd && isCreatureCard(c) && !c.own).forEach(c => giveAway(single(c), pid, {eot:1, haste:1, untap:1})); commit(); return true; }
  if (/^those creatures gain haste until end of turn$/.test(l) && ctx.b26reins !== undefined) return true;   // given with the control change

  // ---- Walking Bulwark
  if (/^until end of turn, target creature with defender gains haste, can attack as though it didn't have defender, and assigns combat damage equal to its toughness rather than its power$/.test(l)){
    const t = b26T(ctx)[0]; if (!t) return true;
    if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c){ c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; c.g23def = turnStr(); c.tdt = turnStr(); log(`${cname(c)} gains haste, can attack despite defender and assigns combat damage by toughness this turn`); } }
    else sendRq(t.pid, 'r26b', 0, name, {tid:t.id, d:'bulwark|'});
    commit(); return true; }

  // ---- Sothera, the Supervoid: intervening "if a player controls no creatures"
  if (/^if a player controls no creatures, sacrifice ~$/.test(l)){
    const none = boardsAll().some(b => !b.bf.some(c => c.k && isCreatureCard(c))); ctx.b26soth = none || UI.dry;
    if (!none){ log(`${name}: every player controls a creature`); return true; } const c = b26Src(ctx); if (c && S.bf.includes(c)) moveCard(c.id, 'gy', {sac:true}); commit(); return true; }

  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await b26Pre2(s, l, ctx)) return; return ds(s0, ctx); }; }

/* ===================== batch 3 ===================== */
{ const cf = cleanFlags; cleanFlags = function(f){ const o = cf(f); try { if (f && typeof f === 'object'){ if (typeof f.b26atk === 'string') o.b26atk = f.b26atk.slice(0, 40); if (f.b26ret) o.b26ret = 1; } } catch {} return o; }; }
// ---- Spirit Water Revival: optional "waterbend {N}" additional cost on a spell
function b26wbN(c){ const m = c && String(info(c.k)?.o || '').match(/^As an additional cost to cast this spell, you may waterbend \{(\d+)\}\.?$/im); return m ? +m[1] : 0; }
{
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){
    const n = !UI.dry && !UI.casting && S && c ? b26wbN(c) : 0; if (!n || UI.replay) return bc(c, zone, o);
    const helpers = S.bf.filter(x => !x.tap && !x.fd && x.k && (isCreatureCard(x) || /Artifact/.test(typeOf(x))));
    const yes = await askChoice({title:`${cname(c)}: waterbend {${n}} as an additional cost?`, text:'Tap artifacts and creatures to pay {1} each; pay the rest with mana.', options:[{label:`Waterbend {${n}}`, value:true}, {label:"Don't", value:false}]});
    if (yes == null) return; let tapped = [];
    if (yes){ if (helpers.length){ const ids = await pickCards({title:`Waterbend {${n}}: tap artifacts and creatures to pay {1} each`, hint:'Pay the rest with mana.', cards:helpers, min:0, max:Math.min(n, helpers.length), noneLabel:'Pay with mana only'}); (ids || []).forEach(id => { const x = S.bf.find(y => y.id === id); if (x){ x.tap = true; tapped.push(x); } }); }
      UI.b26wb = {cid:c.id, left:n - tapped.length}; }
    const n0 = S.stk.length; let r;
    try { r = await bc(c, zone, o); } finally { UI.b26wb = null; }
    const it = S.stk.length > n0 ? S.stk.find(x => x.kind === 'spell' && x.card === c) : null;
    if (yes && it){ it.b26wb = 1; c.b26wb = 1; if (typeof bent === 'function') bent('water'); log(`${cname(c)}: waterbent {${n}}`); }
    else if (tapped.length) tapped.forEach(x => { x.tap = false; });
    commit(); return r;
  };
  const sc = spellCost;
  spellCost = function(c, zone, o = {}){ const r = sc(c, zone, o); try { const w = UI.b26wb; if (w && c && w.cid === c.id && r && r.cost && w.left > 0){ r.cost.gen += w.left; r.notes.push(`waterbend {${w.left}}`); } } catch {} return r; };
}
// ---- Oubliette: phased out until the enchantment leaves (held apart from normal phasing)
B26.h.oubOut = (r, from, d) => { const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c) b26oubOut(single(c), d, r.src); };
B26.h.oubIn = (r, from, d) => { b26oubIn(d); };
function b26oubOut(c, tag, src){ const i = S.bf.indexOf(c); if (i < 0) return; S.bf.splice(i, 1); c.b26oub = tag; (S.b26hold = S.b26hold || []).push(c); delete c.atk; log(`${cname(c)} phased out until ${src} leaves the battlefield`); commit(); }
function b26oubIn(tag){ const hold = S.b26hold || []; const back = hold.filter(c => c.b26oub === tag); if (!back.length) return; S.b26hold = hold.filter(c => c.b26oub !== tag);
  back.forEach(c => { delete c.b26oub; c.tap = true; S.bf.push(c); log(`${cname(c)} phased in tapped`); }); commit(); }
{
  const ol = onLeave;
  onLeave = function(c, to, w){ let tag = null; try { if (c && c.k && /phases out until ~ leaves the battlefield/i.test(tname(info(c.k)?.o || '', info(c.k)?.n))) tag = MYPID + ':' + c.id; } catch {}
    const r = ol(c, to, w);
    try { if (tag){ b26oubIn(tag); opponents().forEach(p => b26Ask(p.pid, 'oubIn', 0, cname(c), tag, false)); } } catch {}
    try { if (c && c.k){ UI.b26lki = UI.b26lki || {}; UI.b26lki[c.id] = {nc:{...(c.nc || {})}, co:c.co || 0, own:c.own ? c.own.pid : MYPID, k:c.k}; } } catch {}
    return r; };
}
// ---- The Irencrag → Everflame, Heroes' Legacy (a card face every client can look up)
const B26_EVER = 'b26:everflame';
{ const df = deriveFace; deriveFace = function(k){ if (k === B26_EVER){ const base = [...DICT.values()].find(a => a.n === 'The Irencrag') || {}; const e = {...base, k, n:"Everflame, Heroes' Legacy", t:'Legendary Artifact — Equipment', o:'Equipped creature gets +3/+3.\nEquip {3}', full:"Everflame, Heroes' Legacy", back:null, faces:null, kw:[]}; DICT.set(k, e); return e; } return df(k); }; }
// ---- Displaced Dinosaurs
STATIC_RULES.push([/^as a historic permanent you control enters, it becomes a 7\/7 dinosaur creature in addition to its other types$/, m => ({kind:'b26dino', who:'you'})]);
{ const oe = onEnter; onEnter = function(c, from, o){ const r = oe(c, from, o); try { if (c && S && S.bf.includes(c) && !c.fd && c.k){ const rs = rulesOn('b26dino'); const t = typeOf(c);
  if (rs.length && /\b(Artifact|Legendary|Saga)\b/.test(t)){ l24addMod(c, {s:rs[0].src, u:'', addC:['Creature'], addS:['Dinosaur'], pt:[7, 7]}); log(`${cname(c)} becomes a 7/7 Dinosaur creature (${rs[0].src})`); commit(); } } } catch (e){ console.warn(e); } return r; }; }
// ---- Khârn the Betrayer
{
  const ct = classifyTrig; classifyTrig = function(w, c){ if (/^a player attacks one of your opponents$/.test(String(c))) return {ev:'attack', subj:'any', ctl:'any', desc:'', b26pAtk:1};
    const r = ct(w, c); if (r) return r; if (/^you lose control of ~$/.test(String(c))) return {ev:'b26lostCtl', subj:'self', ctl:'you', desc:''};
    if (/^a spell or ability an opponent controls destroys a noncreature permanent you control$/.test(String(c))) return {ev:'b26kj', subj:'any', ctl:'you', desc:''};
    if (/^a player attacks one of your opponents$/.test(String(c))) return {ev:'attack', subj:'any', ctl:'any', desc:'', b26pAtk:1};
    if (/^one or more creatures an opponent controls deal combat damage to one or more of your opponents$/.test(String(c))) return {ev:'cdmg', subj:'any', ctl:'opp', desc:'creature', batch:true, b26nelly:1};
    return null; };
  const ga = giveAway;
  giveAway = function(c, to, f){ const tr = c && S.bf.includes(c) ? trigsOf(c.k, c.fl).find(t => t.ev === 'b26lostCtl') : null; const r = ga(c, to, f);
    try { if (tr && !S.bf.includes(c)) pushTrigger({k:c.k, id:c.id, fl:c.fl}, tr, null, MYPID); } catch (e){ console.warn(e); } return r; };
  const dc = damageCard;
  damageCard = function(c, n, f = {}){
    try { if (c && n > 0 && S.bf.includes(c) && /^(?:the betrayer — )?if damage would be dealt to ~, prevent that damage and an opponent of your choice gains control of it\.?$/im.test(tname(info(c.k)?.o || '', cname(c)))){
      log(`damage to ${cname(c)} prevented`); const ops = opponents(); if (!ops.length || UI.dry) return 0;
      (async () => { const pid = ops.length === 1 ? ops[0].pid : await choosePlayer(`${cname(c)}: which opponent gains control of it?`, true); if (pid && S.bf.includes(c)) giveAway(single(c), pid, {}); commit(); })(); return 0; } } catch {}
    return dc(c, n, f); };
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    if (t && t.b26pAtk){ if (!ev || !ev.dp || ev.dp === MYPID || ev.dp === undefined) return; const key = `${src.id}|${evPid}|${ev.dp}|${turnStr()}|${S.cb ? S.cb.n : 0}`; S.b26atkSeen = S.b26atkSeen || {}; if (S.b26atkSeen[key]) return; S.b26atkSeen[key] = 1; }
    if (t && t.b26nelly){ if (!ev || !evPid || evPid === MYPID || !ev.dp || ev.dp === MYPID || ev.dp === evPid) return; const key = `${src.id}|${evPid}|${turnStr()}|${S.cb ? S.cb.n : 0}`; S.b26atkSeen = S.b26atkSeen || {}; if (S.b26atkSeen[key]) return; S.b26atkSeen[key] = 1; }
    return pt(src, t, ev, evPid); };
}
STATIC_RULES.push([/^(?:the betrayer — )?if damage would be dealt to ~, prevent that damage and an opponent of your choice gains control of it$/, m => ({kind:'b26betray', who:'you'})]);
// ---- Karmic Justice: an opponent's spell or ability destroyed one of my noncreature permanents
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (!S || from === MYPID || !['destroy', 'wipe'].includes(r && r.op)) return ao(r, from);
    const before = S.bf.filter(c => c.k && !c.fd && !isCreatureCard(c)).map(c => ({id:c.id, k:c.k, n:c.n || 1}));
    const out = ao(r, from);
    try { const gone = before.filter(b => { const x = S.bf.find(c => c.id === b.id); return !x || (x.n || 1) < b.n; });
      if (gone.length) for (const s of S.bf.filter(b => b.k && !b.fd)) for (const t of trigsOf(s.k, s.fl).filter(t => t.ev === 'b26kj')) gone.forEach(g => pushTrigger({k:s.k, id:s.id, fl:s.fl}, t, {k:g.k, id:g.id}, from));
    } catch (e){ console.warn(e); }
    return out; };
}
// ---- Combat Calligrapher / Zara: tokens or cards that enter attacking a given player
B26.h.inkAtk = async (r, from, d) => { const before = new Set(S.bf.map(c => c.id)); await createFromText('Create a 2/1 white and black Inkling creature token with flying', {name:r.src, k:null, it:{}});
  S.bf.filter(c => !before.has(c.id)).forEach(c => { c.tap = true; c.atk = 'p:' + d; }); log(`created a tapped 2/1 Inkling attacking ${nameOf(d)} (${r.src})`); commit(); };
{ const tc = takeCard; takeCard = function(r, from){ const n0 = S.bf.length; const out = tc(r, from); try { if (r && r.f && S.bf.length > n0){ const c = S.bf[S.bf.length - 1]; if (r.f.b26atk){ c.tap = true; c.atk = r.f.b26atk; log(`${cname(c)} is tapped and attacking`); } if (r.f.b26ret) c.b26ret = 1; } } catch {} return out; }; }
B26.h.zaraShow = (r) => { const list = S.hand.filter(c => isCreatureCard(c)).slice(0, 12); S.pile = {ref:rid(6), ks:list.map(c => c.k)}; S.b26pileT = list.map(c => c.id); log(`revealed their hand to ${r.src}`); commit(); return [list.length]; };
B26.h.zaraGive = (r, from, d) => { const [i, def] = String(d).split('|'); const id = (S.b26pileT || [])[+i]; S.pile = null; S.b26pileT = null; const c = id != null ? S.hand.find(x => x.id === id) : null; if (!c) return;
  S.hand.splice(S.hand.indexOf(c), 1); const ref = rid(6); S.lent.push({ref, to:from, card:c}); sendRq(from, 'give', 0, cname(c), {ref, c:{k:c.k, tap:1}, f:{b26atk:def, b26ret:1}}); log(`${nameOf(from)} put ${cname(c)} from their hand onto the battlefield (${r.src})`); commit(); };
{ const fs = fireSteps; fireSteps = function(step, activePid){ try { if (step === 'end' && S){ S.bf.filter(c => c.b26ret).forEach(c => { log(`${cname(c)} returns to its owner's hand (Zara)`); delete c.b26ret; moveCard(c.id, 'hand', {quiet:true}); }); } } catch {} return fs(step, activePid); }; }
// ---- Nelly Borca: suspected creatures on other boards, goad all suspected creatures
B26.h.sus = (r) => { const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c){ c.jSus = 1; if (typeof jAddKw === 'function') jAddKw(c, ['menace']); log(`${cname(c)} is suspected (menace, can't block) (${r.src})`); } };
B26.h.goadSus = (r, from) => { S.bf.filter(c => c.jSus && c.k && !c.fd).forEach(c => { c.goad = {by:from, n:currentTurn()[0]}; log(`${cname(c)} is goaded by ${nameOf(from)}`); }); };

async function b26Pre3(s, l, ctx){
  let m; const name = ctx.name || ''; const full = String(ctx.full || '').toLowerCase(); const it = ctx.it || {};

  // ---- Spirit Water Revival
  if (/^draw two cards$/.test(l) && /if this spell's additional cost was paid, instead shuffle your graveyard into your library, draw seven cards/.test(full.replace(/~'s additional/, "this spell's additional"))){ if (it.b26wb) return true; draw(2); return true; }
  if (/^if (?:~'s|this spell's) additional cost was paid, instead shuffle your graveyard into your library, draw seven cards, and you have no maximum hand size for the rest of the game$/.test(l)){
    if (!it.b26wb && !UI.dry) return true; const n = S.gy.length; S.lib.push(...S.gy.splice(0)); shuffle(S.lib); log(`${name}: shuffled their graveyard (${n}) into their library`); draw(7); S.noMax = 1; log(`${name}: no maximum hand size for the rest of the game`); commit(); return true; }

  // ---- Oubliette
  if (/^target creature phases out until ~ leaves the battlefield$/.test(l)){
    const t = b26T(ctx)[0]; const me = b26Src(ctx); if (!t || !me) return true; const tag = MYPID + ':' + me.id; ctx.b26oub = 1;
    if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c) b26oubOut(single(c), tag, name); } else { sendRq(t.pid, 'r26b', 0, name, {tid:t.id, d:'oubOut|' + tag}); log(`${name}: ${t.nm || 'a creature'} phases out until ${name} leaves the battlefield`); }
    commit(); return true; }
  if (/^tap that creature as it phases in this way$/.test(l)) return true;   // b26oubIn taps it

  // ---- The Irencrag
  if (/^(?:you may )?have ~ become a legendary equipment artifact named everflame, heroes' legacy$/.test(l)){
    const c = b26Src(ctx); ctx.b26ever = 0; if (!c || !S.bf.includes(c)) return true;
    if (!UI.dry && /^you may/.test(l) && !(await askYes(`${name}: become Everflame, Heroes' Legacy (Equipment, +3/+3, equip {3})?`, 'Yes', 'No'))) return true;
    if (UI.dry){ ctx.b26ever = 1; return true; }
    info(B26_EVER); c.origK = c.origK || c.k; c.k = B26_EVER; ctx.b26ever = 1; log(`${name} became Everflame, Heroes' Legacy`); commit(); return true; }
  if (/^if you do, it gains equip \{3\} and "equipped creature gets \+3\/\+3" and loses all other abilities$/.test(l) || /^it gains equip \{3\} and "equipped creature gets \+3\/\+3" and loses all other abilities$/.test(l)) return true;   // Everflame's face has exactly these abilities

  // ---- Assault Suit
  if (/^(?:you may )?have (?:target|that) player gain control of equipped creature until end of turn$/.test(l)){
    const me = b26Src(ctx); const pid = it.evPid; ctx.b26suit = 0; if (!me || !me.att || me.att.pid !== MYPID || !pid || pid === MYPID) return true;
    const c = S.bf.find(b => b.id === me.att.id); if (!c) return true; if (UI.dry){ ctx.b26suit = 1; return true; }
    giveAway(single(c), pid, {eot:1, untap:1}); ctx.b26suit = 1; commit(); return true; }
  if (/^if you do, untap it$/.test(l) && ctx.b26suit !== undefined) return true;   // given untapped

  // ---- Yes Man, Personal Securitron
  if (/^target opponent gains control of ~$/.test(l) && /when they do, you draw two cards and put a quest counter on/.test(full)){
    const t = b26T(ctx).find(x => x.t === 'player'); const me = b26Src(ctx); ctx.b26yes = 0; if (!t || t.pid === MYPID || !me || !S.bf.includes(me)) return true;
    addNamed(me, 'quest', 1); giveAway(single(me), t.pid, {}); ctx.b26yes = 1; commit(); return true; }
  if (/^when they do, you draw two cards(?: and put a quest counter on ~)?$/.test(l)){ if (ctx.b26yes || UI.dry){ draw(2); ctx.b26yesDrew = 1; } return true; }
  if (/^(?:and )?put a quest counter on ~$/.test(l) && (ctx.b26yesDrew || ctx.b26yes)) return true;   // put on before the control change (it travels with the card)
  if ((m = l.match(/^its owner creates (?:a|an|\w+) tapped 1\/1 white soldier creature tokens? for each quest counter on it$/))){
    const id = it.srcId != null ? it.srcId : ctx.srcId; const L = (UI.b26lki || {})[id] || {}; const n = UI.dry ? 1 : ((L.nc || {}).quest != null ? L.nc.quest : L.co || 0); const own = L.own || MYPID;
    if (!n){ log(`${name}: no quest counters`); return true; } const txt = `${n} tapped 1/1 white Soldier creature token${n === 1 ? '' : 's'}`;
    if (own === MYPID) await createFromText('Create ' + txt, ctx); else { sendRq(own, 'tokText', 0, name, {d:txt}); log(`${nameOf(own)} creates ${txt} (${name})`); } commit(); return true; }

  // ---- Combat Calligrapher
  if (/^that attacking player creates a tapped 2\/1 white and black inkling creature token with flying that's attacking that opponent$/.test(l)){
    const ap = it.evPid, dp = it.evDp; if (UI.dry){ await createFromText('Create a 2/1 white and black Inkling creature token with flying', ctx); return true; } if (!ap || !dp) return true;
    if (ap === MYPID) await B26.h.inkAtk({src:name}, MYPID, dp); else { b26Ask(ap, 'inkAtk', 0, name, dp, false); log(`${nameOf(ap)} creates a 2/1 Inkling attacking ${nameOf(dp)} (${name})`); } commit(); return true; }

  // ---- Zara, Renegade Recruiter
  if (/^look at defending player's hand$/.test(l) && /put a creature card from it onto the battlefield under your control tapped and attacking/.test(full)){
    const dp = it.evDp || (() => { const c = b26Src(ctx); const d = c && parseDef(c.atk); return d && d.pid; })(); ctx.b26zara = {dp, n:0}; if (!dp || dp === MYPID || UI.dry) return true;
    const a = await b26Ask(dp, 'zaraShow', 0, name, '', true); ctx.b26zara.n = a ? a[0] || 0 : 0; log(`${name}: looked at ${nameOf(dp)}'s hand`); return true; }
  if (/^(?:you may )?put a creature card from it onto the battlefield under your control tapped and attacking (?:that|target) player or a planeswalker they control$/.test(l) && ctx.b26zara){
    const {dp, n} = ctx.b26zara; if (!dp || UI.dry) return true;
    let pile = null; if (n) pile = await waitUntil(() => { const p = OPP.get(dp)?.pile; return p && p.ks && p.ks.length === n ? p : null; }, 15000);
    let idx = -1; if (pile){ const cards = pile.ks.map((k, i) => ({id:-4000 - i, k})); const ids = await pickCards({title:`${name}: put a creature card from ${nameOf(dp)}'s hand onto the battlefield attacking?`, cards, min:0, max:1, noneLabel:"Don't"}); if (ids && ids[0] != null) idx = -(ids[0] + 4000); }
    else log(`${name}: no creature cards in ${nameOf(dp)}'s hand`);
    b26Ask(dp, 'zaraGive', 0, name, `${idx}|p:${dp}`, false); commit(); return true; }
  if (/^return that creature to its owner's hand at the beginning of the next end step$/.test(l) && ctx.b26zara) return true;   // flagged on the card (b26ret)

  if (/^you and the controller of those creatures each draw a card$/.test(l)){ draw(1); const pid = it.evPid; if (pid && pid !== MYPID){ sendRq(pid, 'draw', 1, name); log(`${nameOf(pid)} draws a card (${name})`); } commit(); return true; }

  // ---- suspect an opponent's creature; goad all suspected creatures
  if (/^suspect target creature$/.test(l)){ const t = (ctx.tgts ? (ctx.tgts[ctx.ti || 0] || []) : [])[0]; if (t && t.pid && t.pid !== MYPID){ nextTargets(ctx); sendRq(t.pid, 'r26b', 0, name, {tid:t.id, d:'sus|'}); log(`${name}: ${t.nm || 'a creature'} is suspected`); commit(); return true; } return false; }
  if (/^(?:then )?goad all suspected creatures$/.test(l)){
    S.bf.filter(c => c.jSus && c.k && !c.fd).forEach(c => { c.goad = {by:MYPID, n:currentTurn()[0]}; log(`${cname(c)} is goaded`); });
    opponents().forEach(p => b26Ask(p.pid, 'goadSus', 0, name, '', false)); commit(); return true; }

  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await b26Pre3(s, l, ctx)) return; return ds(s0, ctx); }; }

/* ===================== batch 4 ===================== */
// ---- layer statics: Luxior (equipped planeswalker is a creature, not a planeswalker), Swift Reconfiguration (a Vehicle artifact with crew 5)
{ const la = l24apply; l24apply = function(st, mod){ const r = la(st, mod); try { if (mod && mod.b26loseC) st.ty.card = st.ty.card.filter(x => !mod.b26loseC.includes(x)); } catch {} return r; }; }
{ const lp = l24parseStatic; l24parseStatic = function(line){ const l = String(line || '').toLowerCase().replace(/\.$/, '');
    if (/^equipped permanent isn't a planeswalker and is a creature in addition to its other types$/.test(l)) return {scope:'att', desc:'', mod:{addC:['Creature'], b26loseC:['Planeswalker']}};
    if (/^enchanted permanent is a vehicle artifact with crew 5 and it loses all other card types$/.test(l)) return {scope:'att', desc:'', mod:{setC:['Artifact'], setSub:['Vehicle']}};
    return lp(line); }; }
STATIC_RULES.push([/^equipped permanent isn't a planeswalker and is a creature in addition to its other types$/, m => ({kind:'b26lux', who:'all'})], [/^enchanted permanent is a vehicle artifact with crew 5 and it loses all other card types$/, m => ({kind:'b26swift', who:'all'})]);
function b26swiftOn(c){ if (!c || !S) return false; const pid = l24pidOf(c) || MYPID; return boardsAll().some(b => b.bf.some(a => a.k && !a.fd && a.att && a.att.id === c.id && a.att.pid === pid && /enchanted permanent is a vehicle artifact with crew 5/i.test(info(a.k)?.o || ''))); }
{ const al = abilityList; abilityList = function(c){ const out = al(c); try { if (c && b26swiftOn(c) && !out.some(a => a.crew)) out.push({cost:'Crew 5', eff:'~ becomes an artifact creature until end of turn.', sorc:false, line:'Crew 5 (Swift Reconfiguration)', crew:5}); } catch {} return out; };
  const ic = isCreatureCard; isCreatureCard = c => { if (c && c.anim === 'crew' && c.k && !c.fd && S && b26swiftOn(c)) return true; return ic(c); }; }
// ---- Flash Photography: flash only if it targets a permanent you control
{
  const re = /^you may cast (?:~|this spell) as though it had flash if it targets a permanent you control\.?$/im;
  const to = timingOk; timingOk = function(c){ const r = to(c); try { if (r && !r.ok && c && c.k && phaseNow().n > 0 && !/split second/i.test(r.why || '') && re.test(tname(info(c.k)?.o || '', info(c.k)?.n))){ UI.b26fp = c.id; return {ok:true}; } } catch {} return r; };
  const ct = chooseTargets; chooseTargets = async function(text, src, name){ const r = await ct(text, src, name);
    try { if (r && src && UI.b26fp != null && UI.b26fp === src.id && !sorceryTime()){ UI.b26fp = null; const bad = r.flat().some(t => t && t.t !== 'player' && t.pid !== MYPID); if (bad){ toast('Cast at instant speed, Flash Photography must target a permanent you control'); log('Flash Photography: at instant speed it must target a permanent you control'); return null; } } } catch {} return r; };
}

async function b26Pre4(s, l, ctx){
  let m; const name = ctx.name || ''; const it = ctx.it || {};
  if (/^(?:you may )?cast ~ as though it had flash if it targets a permanent you control$/.test(l)) return true;   // a casting permission (timingOk / chooseTargets above)
  // ---- Alania, Divergent Storm
  if (/^if it's the first instant spell, the first sorcery spell, or the first otter spell other than ~ you've cast this turn, you may have target opponent draw a card$/.test(l)){
    const k = it.evk; const T = turnStr(); const ks = (S.casts || []).filter(x => x.t === T).map(x => x.k); const tyOf = x => info(x)?.t || '';
    const firstOf = (re, excl) => { const f = ks.find(x => re.test(tyOf(x)) && !(excl && info(x)?.n === excl)); return f != null && f === k; };
    const ok = UI.dry || (k && ((/\bInstant\b/.test(tyOf(k)) && firstOf(/\bInstant\b/)) || (/\bSorcery\b/.test(tyOf(k)) && firstOf(/\bSorcery\b/)) || (/\bOtter\b/.test(tyOf(k)) && info(k)?.n !== name && firstOf(/\bOtter\b/, name))));
    if (!ok){ ctx.mayYes = false; log(`${name}: not the first spell of its kind this turn`); return true; }
    const t = b26T(ctx).find(x => x.t === 'player') || (opponents()[0] ? {pid:opponents()[0].pid} : null); if (!t || t.pid === MYPID){ ctx.mayYes = false; return true; }
    const yes = UI.dry || await askYes(`${name}: have ${nameOf(t.pid)} draw a card to copy that spell?`, 'Yes', 'No'); ctx.mayYes = !!yes;
    if (yes && !UI.dry){ sendRq(t.pid, 'draw', 1, name); log(`${nameOf(t.pid)} draws a card (${name})`); } commit(); return true; }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await b26Pre4(s, l, ctx)) return; return ds(s0, ctx); }; }

/* ---------- Sower of Discord: two chosen players share damage as life loss ---------- */
{
  const oe = onEnter;
  onEnter = function(c, from, o){ const r = oe(c, from, o); try { if (c && S && S.bf.includes(c) && !UI.dry && !c.b26pair && /^as ~ enters, choose two players\.?$/im.test(tname(info(c.k)?.o || '', info(c.k)?.n))){
    (async () => { const ps = players(); let pair = ps.map(p => p.pid).slice(0, 2);
      if (ps.length > 2){ const a = await askChoice({title:`${cname(c)}: choose the first player`, options:ps.map(p => ({label:p.me ? `${p.nm} (you)` : p.nm, value:p.pid}))}); const b = await askChoice({title:`${cname(c)}: choose the second player`, options:ps.filter(p => p.pid !== a).map(p => ({label:p.me ? `${p.nm} (you)` : p.nm, value:p.pid}))}); if (a && b) pair = [a, b]; }
      c.b26pair = pair; log(`${cname(c)}: chose ${pair.map(nameOf).join(' and ')}`); commit(); })(); } } catch {} return r; };
  const ct = classifyTrig; classifyTrig = function(w, c){ const r = ct(w, c); if (r) return r; if (/^damage is dealt to one of the chosen players$/.test(String(c))) return {ev:'dmg', subj:'any', ctl:'any', desc:'', toPlayer:true, b26sower:1}; return null; };
  const pt = pushTrigger; pushTrigger = function(src, t, ev, evPid){ if (t && t.b26sower){ const c = S.bf.find(b => b.id === src.id); const pair = c && c.b26pair; if (!pair || !ev || !ev.dp || !pair.includes(ev.dp) || !(ev.amt > 0)) return; } return pt(src, t, ev, evPid); };
}
async function b26Pre5(s, l, ctx){
  if (/^the other chosen player also loses that much life$/.test(l)){
    const c = b26Src(ctx); const pair = (c && c.b26pair) || []; const it = ctx.it || {}; const dp = it.evDp; const n = it.evN || 0; const other = pair.find(p => p !== dp);
    if (UI.dry || !other || !n) return true; if (other === MYPID){ S.life -= n; log(`lost ${n} life (${ctx.name})`); } else await loseLife(other, n, ctx.name); commit(); return true; }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await b26Pre5(s, l, ctx)) return; return ds(s0, ctx); }; }
