/* ===================== Rules engine — round 26Z: linked exile across players (rule 607), playing cards you don't own ===================== */
// The linked-exile record lives on the client of the player who controls the exiling object (the "linker"):
//   a card in MY exile with c.zBy = <source id> was "exiled with" that source. Cards I own are real cards; cards another
//   player owns are engine21e lend copies (c.r21 + c.own = {pid, ref}: the original stays in its owner's exile and the
//   owner's S.lent / S.r21L remember who may use it). c.zFd = exiled face down, c.r21until = returns when the source
//   leaves, c.nc holds counters put on it (stash, page, hit …), c.mayPlay = what the linker may do with it.
// Everything that "returns", "puts onto the battlefield", "puts into its owner's graveyard" or casts such a card goes
// through zReturn / zTake / beginCast, which route to the owner (r21unlend / zGive / r21cast + back).
function zSrcOf(ctx){ return srcCardOf(ctx) || (ctx && ctx.srcId != null ? find(ctx.srcId)[2] : null); }
function zLinked(srcId, pred){ if (srcId == null || !S) return []; return S.ex.filter(c => (c.zBy === srcId || c.r21until === srcId) && (!pred || pred(c))); }
function zTag(c, srcId, o = {}){
  if (!c) return c;
  if (srcId != null) c.zBy = srcId;
  if (c.r21) c.r21keep = 1;
  if (o.until && srcId != null) c.r21until = srcId;
  if (o.fd) c.zFd = 1;
  if (o.ctr){ c.nc = {...(c.nc || {}), [o.ctr]:((c.nc || {})[o.ctr] || 0) + 1}; c.co = Object.values(c.nc).reduce((a, b) => a + b, 0); }
  if (o.mp) c.mayPlay = {t:turnStr(), u0:S.untapN, src:o.src || '', ...o.mp};
  return c;
}
const zOwner = c => (c && c.r21 && c.own) ? c.own.pid : MYPID;
const zEsc = s => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// exile a permanent (any controller) and link it; returns the cards now in MY exile (originals or lend copies)
async function zExilePerm(t, ctx, o = {}){
  if (!t || t.t !== 'card') return [];
  const sc = zSrcOf(ctx); const sid = o.srcId != null ? o.srcId : sc ? sc.id : ctx.srcId;
  if (t.pid === MYPID || !t.pid){
    const c = S.bf.find(b => b.id === t.id); if (!c) return [];
    const tok = !!c.tok; moveCard(c.id, 'ex', {quiet:true}); log(`${ctx.name}: exiled ${cname(c)}${o.until ? ` until ${ctx.name} leaves the battlefield` : ''}`);
    const e = S.ex.find(x => x.id === c.id); if (!e || tok) return [];
    zTag(e, sid, o); return [e];
  }
  const res = await r21Ask(t.pid, 'r21exCard', 0, ctx.name, {tid:t.id, d:o.w || 'r'});
  const out = res.ids.map(id => S.ex.find(c => c.id === id)).filter(Boolean);
  out.forEach(c => zTag(c, sid, o));
  log(`${ctx.name}: exiled ${nameOf(t.pid)}'s ${t.nm || 'permanent'}${o.until ? ` until ${ctx.name} leaves the battlefield` : ''}`);
  commit(); return out;
}
// exile a card from a graveyard (by key) and link it
async function zExileGyCard(pid, k, ctx, o = {}){
  const sc = zSrcOf(ctx); const sid = o.srcId != null ? o.srcId : sc ? sc.id : ctx.srcId;
  if (pid === MYPID){
    const c = (o.id != null ? S.gy.find(g => g.id === o.id) : null) || S.gy.find(g => g.k === k); if (!c) return [];
    moveCard(c.id, 'ex', {quiet:true}); const e = S.ex.find(x => x.id === c.id); if (!e) return [];
    zTag(e, sid, o); log(`${ctx.name}: exiled ${cname(e)} from my graveyard`); return [e];
  }
  const res = await r21Ask(pid, o.ctr ? 'zGyExC' : 'r21gyEx', 0, ctx.name, {d:o.ctr ? `${k}|${o.ctr}` : k});
  const out = res.ids.map(id => S.ex.find(c => c.id === id)).filter(Boolean);
  out.forEach(c => zTag(c, sid, o)); commit(); return out;
}
// a linked card leaves exile to: 'bf' (owner's control) 'bfT' (tapped) 'gy' 'hand' 'libb' (bottom)
function zReturn(c, dest){
  if (!c || !S.ex.includes(c)) return;
  const tap = dest === 'bfT';
  if (c.r21 && c.own){ c.zBy = null; c.r21until = null; r21Drop(c, dest); return; }
  delete c.zBy; delete c.r21until; delete c.zFd; delete c.mayPlay;
  if (dest === 'bf' || dest === 'bfT'){ moveCard(c.id, 'bf'); const b = S.bf.find(x => x.id === c.id); if (b && tap) b.tap = true; }
  else if (dest === 'libb'){ S.ex.splice(S.ex.indexOf(c), 1); S.lib.push(c); }
  else moveCard(c.id, dest === 'hand' ? 'hand' : 'gy');
  commit();
}
// put a linked card onto the battlefield under MY control (Ghost Vacuum, Nautiloid Ship, Sothera)
// x: {tap, cp, ctr:{name:n}, flyCtr, spirit}
function zTake(c, x = {}){
  if (!c || !S.ex.includes(c)) return;
  if (c.r21 && c.own){
    const ref = c.own.ref; UI.zGiveX ||= {}; UI.zGiveX[ref] = x;
    S.ex.splice(S.ex.indexOf(c), 1); c.r21sent = 1;
    sendRq(c.own.pid, 'zGive', 0, R21_STR(cname(c), 40), {ref, d:x.tap ? 't' : ''});
    log(`putting ${nameOf(c.own.pid)}'s ${cname(c)} onto the battlefield under my control`); commit(); return;
  }
  delete c.zBy; delete c.r21until; delete c.mayPlay;
  moveCard(c.id, 'bf'); const b = S.bf.find(y => y.id === c.id); if (b) zTakeExtras(b, x); commit();
}
function zTakeExtras(b, x){
  if (!b || !x) return;
  if (x.tap) b.tap = true;
  if (x.cp) modCounters(b, 'cp', x.cp);
  if (x.flyCtr){ addNamed(b, 'flying', 1); b.ekw = [...new Set([...(b.ekw || []), 'flying'])]; }
  if (x.spirit){ b.h23bpt = {p:1, t:1, until:''}; b.zSpirit = 1; }
}

/* ---------- requests ---------- */
RQ_OPS.push('zGyRand', 'zExHandAll', 'zExBot', 'zOwnerMay', 'zGive', 'zGyExC', 'zChooseEx', 'zExHandGy', 'zTakeN', 'zHandShow', 'zPhase', 'zPhaseIn', 'zExTopTo', 'zHit');
{
  const ao = applyOp;
  applyOp = function(r, from){
    switch (r.op){
      // owner: hand the exiled card to the linker's battlefield (it stays mine: it comes back when it leaves)
      case 'zGive': { const i = S.lent.findIndex(x => x.ref === r.ref); r21Unlist(r.ref); if (i < 0){ commit(); return; } const l = S.lent[i]; const c = l.card;
        const zi = S.ex.indexOf(c); if (zi < 0){ S.lent.splice(i, 1); commit(); return; } S.ex.splice(zi, 1);
        l.perm = true; delete l.ex; sendRq(from, 'give', 0, r.src, {ref:r.ref, c:{k:c.k, tap:r.d === 't' ? 1 : 0}, f:{}});
        log(`${nameOf(from)} put my ${cname(c)} from exile onto the battlefield under their control (${r.src})`); commit(); return; }
      // owner: exile a card from my graveyard with a counter on it, lend it
      case 'zGyExC': { const [k, ctr] = String(r.d || '').split('|'); const c = S.gy.find(g => g.k === k && !S.lent.some(l => l.card === g)); let n = 0;
        if (c){ moveCard(c.id, 'ex', {quiet:true}); const e = S.ex.find(x => x.id === c.id); if (e){ if (ctr){ addNamed(e, ctr, 1); if (ctr === 'hit') e.p24hit = 1; } r21Lend(e, from, r.ref, 'r', r.src); n = 1; log(`${cname(e)} was exiled from my graveyard${ctr ? ' with a ' + ctr + ' counter on it' : ''} (${r.src})`); } }
        r21Ack(from, r.ref, n, r.src); commit(); return; }
      // owner: I choose a permanent I control and exile it for the requester (Sothera)
      case 'zChooseEx': zChooseExLocal(r, from); return;
      // Kefka: a card at random from my graveyard
      case 'zGyRand': { const g = S.gy.length ? S.gy[Math.floor(Math.random() * S.gy.length)] : null; if (g){ moveCard(g.id, 'ex', {quiet:true}); const e = S.ex.find(x => x.id === g.id); if (e) r21Lend(e, from, r.ref, 'r', r.src); log(`exiled ${cname(g)} at random from my graveyard (${r.src})`); } r21Ack(from, r.ref, g ? 1 : 0, r.src); commit(); return; }
      // Elder Brain: exile my hand, draw that many; the exiled cards are lent
      case 'zExHandAll': { const all = S.hand.splice(0); S.ex.push(...all); all.forEach(c => r21Lend(c, from, r.ref, String(r.d || 'r'), r.src)); log(`exiled my hand (${all.length} cards) (${r.src})`); if (all.length) draw(all.length); r21Ack(from, r.ref, all.length, r.src); commit(); return; }
      // Arvinox: the bottom card of my library face down
      case 'zExBot': { const c = S.lib.pop(); if (c){ S.ex.push(c); r21Lend(c, from, r.ref, String(r.d || 'r'), r.src); log(`exiled the bottom card of my library face down (${r.src})`); } r21Ack(from, r.ref, c ? 1 : 0, r.src); commit(); return; }
      // Soul Partition: my permanent is exiled; I (its owner) may play it for as long as it remains exiled, for {2} more
      case 'zOwnerMay': { const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c && !c.tok){ moveCard(c.id, 'ex', {quiet:true}); const e = S.ex.find(x => x.id === c.id); if (e){ e.mayPlay = {t:turnStr(), u0:S.untapN, adv:true, cast:false, src:r.src, zTax:+r.n || 0}; log(`${cname(e)} was exiled (${r.src}) — I may play it for as long as it remains exiled${r.n ? ` (it costs {${r.n}} more)` : ''}`); } } else if (c){ moveCard(c.id, 'ex', {quiet:true}); } commit(); return; }
      // owner: exile the top card of my library, a random card from my graveyard, a random card from my hand (Crabomination)
      case 'zExHandGy': { const out = []; if (S.lib[0]) out.push(S.lib[0]); const g = S.gy.length ? S.gy[Math.floor(Math.random() * S.gy.length)] : null; if (g) out.push(g); const h = S.hand.length ? S.hand[Math.floor(Math.random() * S.hand.length)] : null; if (h) out.push(h);
        out.forEach(c => { for (const z of ['lib', 'gy', 'hand']){ const i = S[z].indexOf(c); if (i >= 0) S[z].splice(i, 1); } S.ex.push(c); r21Lend(c, from, r.ref, 'r', r.src); });
        log(`exiled ${out.map(cname).join(', ') || 'nothing'} — the top of my library, a card at random from my graveyard and one from my hand (${r.src})`); r21Ack(from, r.ref, out.length, r.src); commit(); return; }
      // owner: exile several of the cards I showed (indices in d), face down, the rest bottom/graveyard/shuffle
      case 'zTakeN': zTakeNLocal(r, from); return;
      case 'zHandShow': { const list = S.hand.slice(); S.r21show = {ref:r.ref, to:from, ks:list.map(c => c.k), ids:list.map(c => c.id), what:'hand'}; log(`${nameOf(from)} looks at my hand (${r.src})`); commit(); return; }
      // Oubliette: phased out until the source leaves; phases in tapped
      case 'zPhase': { const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c) zPhaseOutLocal(single(c), r.d, r.src); commit(); return; }
      case 'zPhaseIn': zPhaseInLocal(r.d, r.n === 1); return;
      // Gonti, Night Minister: exile my top card face down for another player (d = pid|w)
      case 'zExTopTo': { const [to, w] = String(r.d || '').split('|'); const c = S.lib.shift(); if (c){ S.ex.push(c); r21Lend(c, to || from, r.ref, w || 'pal', r.src); log(`exiled the top card of my library face down — ${nameOf(to || from)} may play it (${r.src})`); } commit(); return; }
      // Mari's Assassins: remove a hit counter from one of my exiled cards
      case 'zHit': { const c = S.ex.find(x => (x.nc || {}).hit > 0); if (c){ addNamed(c, 'hit', -1); if (!(c.nc || {}).hit) delete c.p24hit; log(`a hit counter was removed from my exiled ${cname(c)} (${r.src})`); } r21Ack(from, r.ref, c ? 1 : 0, r.src); commit(); return; }
      case 'r21unlend': {
        // extra destinations: owner's hand, tapped onto the battlefield
        if (r.d === 'hand' || r.d === 'bfT'){ const i = S.lent.findIndex(x => x.ref === r.ref); r21Unlist(r.ref); if (i < 0){ commit(); return; } const [l] = S.lent.splice(i, 1); const c = l.card;
          if (S.ex.includes(c)){ if (r.d === 'hand'){ moveCard(c.id, 'hand', {quiet:true}); log(`${cname(c)} returned to my hand from exile (${r.src || ''})`); } else { moveCard(c.id, 'bf'); const b = S.bf.find(x => x.id === c.id); if (b) b.tap = true; log(`${cname(c)} returned to the battlefield tapped (${r.src || ''})`); } }
          commit(); return; }
        break;
      }
    }
    return ao(r, from);
  };
  // the linker gets the permanent: apply what the effect said (flying counter, Spirit 1/1, +1/+1 counters)
  const tk = takeCard;
  takeCard = function(r, from){
    const before = new Set(S.bf.map(b => b.id)); const out = tk(r, from);
    try { const x = (UI.zGiveX || {})[r.ref]; if (x){ delete UI.zGiveX[r.ref]; const nc = S.bf.find(b => !before.has(b.id)); if (nc){ zTakeExtras(nc, x); commit(); } } } catch (e){ console.warn(e); }
    return out;
  };
  // owner: a lent card that leaves my exile some other way is no longer lent
  const mc = moveCard;
  moveCard = function(id, to, o = {}){
    const [from,, c] = find(id);
    const r = mc(id, to, o);
    try { if (c && from === 'ex' && to !== 'ex' && S.lent && S.lent.length){ const i = S.lent.findIndex(l => l.card === c && l.ex); if (i >= 0){ const [l] = S.lent.splice(i, 1); r21Unlist(l.ref); } } } catch (e){ console.warn(e); }
    return r;
  };
}
// Hostage Taker / Banishing Light: a linked lend copy is never dropped just because nobody may cast it right now
{
  const rd = r21Drop;
  r21Drop = function(c, dest){
    if (c && !dest && (c.zBy != null || c.r21until != null) && S.ex.includes(c) && !c.zDropOk){ if (c.mayPlay && !exWindowOk(c)) delete c.mayPlay; return; }
    return rd(c, dest);
  };
}
async function zChooseExLocal(r, from){
  const desc = String(r.d || 'creature'); const pool = S.bf.filter(c => !c.fd && descOk(c.k, desc, {tok:c.tok}));
  let c = null;
  if (pool.length === 1) c = pool[0];
  else if (pool.length){ const ids = UI.dry ? [pool[0].id] : await pickCards({title:`${r.src}: choose a ${desc} you control to exile`, cards:pool, min:1, max:1}); c = S.bf.find(x => x.id === (ids || [])[0]) || pool[0]; }
  let n = 0;
  if (c){ const tok = !!c.tok; moveCard(c.id, 'ex', {quiet:true}); log(`exiled ${cname(c)} (${r.src})`); const e = !tok && S.ex.find(x => x.id === c.id); if (e){ r21Lend(e, from, r.ref, 'r', r.src); n = 1; } }
  else log(`has no ${desc} to exile (${r.src})`);
  r21Ack(from, r.ref, n, r.src); commit();
}
function zTakeNLocal(r, from){
  const sh = S.r21show; if (!sh || sh.ref !== r.ref){ r21Ack(from, r.ref, 0, r.src); return; }
  const [idx, rest, w] = String(r.d || '').split('|'); S.r21show = null;
  const cards = idx.split(',').filter(x => x !== '').map(Number).map(i => sh.ids[i]).map(id => find(id)[2]).filter(Boolean);
  let n = 0;
  for (const c of cards){ const [z] = find(c.id); if (!z || z === 'ex') continue; const i = S[z].indexOf(c); S[z].splice(i, 1); S.ex.push(c); r21Lend(c, from, r.ref, w || 'r', r.src); n++; }
  if (n) log(`exiled ${n} card${n === 1 ? '' : 's'} ${sh.what === 'hand' ? 'from my hand' : 'from my library face down'} for ${nameOf(from)} (${r.src})`);
  if (sh.what === 'lib'){
    const left = sh.ids.map(id => S.lib.find(c => c.id === id)).filter(Boolean);
    if (rest === 'b'){ left.forEach(c => S.lib.splice(S.lib.indexOf(c), 1)); shuffle(left); S.lib.push(...left); if (left.length) log(`put the other ${left.length} on the bottom of my library in a random order`); }
    else if (rest === 'g'){ left.forEach(c => moveCard(c.id, 'gy', {quiet:true})); }
    else if (rest === 's') shuffleLib();
  }
  r21Ack(from, r.ref, n, r.src); commit();
}
async function zTakeFrom(pid, tok, idx, rest, w, ctx){
  UI.r21ack ||= {}; UI.r21tok ||= {};
  sendRq(pid, 'zTakeN', idx.length, ctx.name, {ref:tok, d:`${idx.join(',')}|${rest || ''}|${w || 'r'}`}); commit();
  if (UI.dry) return [];
  const a = await waitUntil(() => UI.r21ack[tok], 25000); if (!a || !a.n) return [];
  await waitUntil(() => (UI.r21tok[tok] || []).length >= a.n ? 1 : 0, 10000);
  const ids = (UI.r21tok[tok] || []).slice(); ctx.r21ids = (ctx.r21ids || []).concat(ids); ctx.lastEx = ids.slice(); ctx.r21 = true; return ids;
}
function zPhaseOutLocal(c, ref, src){ const i = S.bf.indexOf(c); if (i < 0) return; S.bf.splice(i, 1); (S.zpoz ||= []).push({ref, c}); log(`${cname(c)} phased out until ${src} leaves the battlefield`); }
function zPhaseInLocal(ref, tap){ const i = (S.zpoz || []).findIndex(x => x.ref === ref); if (i < 0) return; const [{c}] = S.zpoz.splice(i, 1); if (tap) c.tap = true; S.bf.push(c); log(`${cname(c)} phased in${tap ? ' tapped' : ''}`); commit(); }

/* ---------- permissions that come from the linking object or a static (evaluated on the fly) ---------- */
// mayPlay.zCond: 'your' = only during my turn; 'lost' = an opponent lost life this turn; 'sac' = I sacrificed a nontoken permanent this turn;
// 'src' = the linking source is still on the battlefield; 'rule:<kind>' = a static of that kind is still in effect
function zCondOk(c, mp){
  for (const cond of String(mp.zCond || '').split(',').filter(Boolean)){
    if (cond === 'your' && currentTurn()[1] !== MYPID) return false;
    if (cond === 'lost' && !r21bOppLost()) return false;
    if (cond === 'sac' && S.zSacNT !== turnStr()) return false;
    if (cond === 'src' && !S.bf.some(b => b.id === c.zBy && !b.fd)) return false;
    if (cond.startsWith('rule:') && !rulesOn(cond.slice(5)).length) return false;
    if (cond === 'perm' && !isPermType(info(c.k)?.t || '')) return false;
    if (cond === 'mine' && c.own) return false;
    if (cond.startsWith('desc:') && !descOk(c.k, cond.slice(5))) return false;
  }
  return true;
}
// what the source of a linked card lets me do with it (statics printed on the source)
const Z_LINK_STATIC = [
  // Valgavoth, Terror Eater
  [/(?:^|\n)during your turn, you may play cards exiled with ~\. if you cast a spell this way, pay life equal to its mana value rather than pay its mana cost/i, {zCond:'your,src', zLife:true}],
  // Theater of Horrors
  [/(?:^|\n)during your turn, if an opponent lost life this turn, you may play lands and cast spells from among cards exiled with ~/i, {zCond:'your,lost,src'}],
  // Evendo Brushrazer
  [/(?:^|\n)during your turn, as long as you've sacrificed a nontoken permanent this turn, you may play cards exiled with ~/i, {zCond:'your,sac,src'}],
  // Intrepid Paleontologist
  [/(?:^|\n)you may cast dinosaur creature spells from among cards you own exiled with ~/i, {zCond:'src,mine,desc:dinosaur creature', cast:true, zFin:true}],
  // Rogue Class (level 3)
  [/(?:^|\n)you may play cards exiled with ~, and you may spend mana as though it were mana of any color to cast those spells/i, {zCond:'src', any:true, zLvl:3}],
];
function zLazyPerm(c){
  if (!c || !S) return;
  if (c.mayPlay && !c.mayPlay.zLazy) return;
  let mp = null;
  if (c.zBy != null){ const src = S.bf.find(b => b.id === c.zBy && !b.fd);
    if (src){ const t = tname(info(src.k)?.o || '', info(src.k)?.n); for (const [re, o] of Z_LINK_STATIC){ if (re.test(t) && (!o.zLvl || zClassLvl(src) >= o.zLvl)){ mp = {...o, src:info(src.k)?.n}; break; } } } }
  if (!mp && c.r21 && c.own && (c.nc || {}).stash > 0 && rulesOn('zStash').length) mp = {zCond:'your,rule:zStash', any:true, src:rulesOn('zStash')[0].src};
  if (!mp && !c.own && (c.nc || {}).croak > 0 && rulesOn('zCroak').length) mp = {zCond:'rule:zCroak', src:rulesOn('zCroak')[0].src};
  if (mp){ delete mp.zLvl; c.mayPlay = {t:turnStr(), u0:S.untapN, adv:true, cast:false, zLazy:1, ...mp, free:!!mp.zLife}; }
  else if (c.mayPlay && c.mayPlay.zLazy) delete c.mayPlay;
}
function zClassLvl(c){ return (c && c.lvl) || 1; }
STATIC_RULES.push([/^you may cast dinosaur creature spells from among cards you own exiled with ~$/, m => ({kind:'zLinkPlay', who:'you'})]);
STATIC_RULES.push([/^if you cast a spell this way, that creature enters with a finality counter on it$/, m => ({kind:'zLinkPlay', who:'you'})]);
STATIC_RULES.push([/^you may play cards exiled with ~, and you may spend mana as though it were mana of any color to cast those spells$/, m => ({kind:'zLinkPlay', who:'you'})]);
STATIC_RULES.push([/^during your turn, you may play cards you don't own with stash counters on them from exile, and mana of any type can be spent to cast those spells$/, m => ({kind:'zStash', who:'you'})]);
STATIC_RULES.push([/^you may play lands and cast spells from among cards you own in exile with croak counters on them$/, m => ({kind:'zCroak', who:'you'})]);
STATIC_RULES.push([/^during your turn, you may play cards exiled with ~\. if you cast a spell this way, pay life equal to its mana value rather than pay its mana cost$/, m => ({kind:'zLinkPlay', who:'you'})]);
STATIC_RULES.push([/^during your turn, if an opponent lost life this turn, you may play lands and cast spells from among cards exiled with ~$/, m => ({kind:'zLinkPlay', who:'you'})]);
STATIC_RULES.push([/^during your turn, as long as you've sacrificed a nontoken permanent this turn, you may play cards exiled with ~$/, m => ({kind:'zLinkPlay', who:'you'})]);
{
  const ew = exWindowOk;
  exWindowOk = function(c){
    try { zLazyPerm(c); } catch (e){ console.warn(e); }
    const ok = ew(c); if (!ok || !c || !c.mayPlay) return ok;
    if (c.mayPlay.zCond && !zCondOk(c, c.mayPlay)) return false;
    if (c.mayPlay.zGroup && (S.zGroupUsed || {})[c.mayPlay.zGroup]) return false;
    return ok;
  };
  // "pay life equal to its mana value rather than pay its mana cost"; "you may play one of those cards"
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){
    const mp = c && zone === 'ex' ? c.mayPlay : null;
    const life = mp && mp.zLife; const grp = mp && mp.zGroup;
    const n0 = S.stk.length; const r = await bc(c, zone, life ? {...o, free:true} : o);
    try { if (c && c.own && c.r21 && zone === 'ex' && !S.ex.includes(c) && S.stk.length > n0) emit({type:'zcastno', k:c.k, id:c.id, nth:0}); } catch (e){ console.warn(e); }
    try { if (mp && !S.ex.includes(c)){
      if (life){ const mv = info(c.k)?.mv || 0; if (mv){ S.life -= mv; log(`paid ${mv} life instead of ${cname(c)}'s mana cost (${mp.src || ''}) → ${S.life}`); } }
      if (grp){ (S.zGroupUsed ||= {})[grp] = 1; S.ex.filter(x => x.mayPlay && x.mayPlay.zGroup === grp).forEach(x => { delete x.mayPlay; if (x.r21 && x.own && x.zBy == null) r21Drop(x, ''); }); }
      commit(); } } catch (e){ console.warn(e); }
    return r;
  };
  const pl = playLand;
  playLand = function(c, o = {}){
    const mp = c && c.mayPlay; const grp = mp && mp.zGroup; const inEx = c && S.ex.includes(c);
    const r = pl(c, o);
    try { if (inEx && grp && !S.ex.includes(c)){ (S.zGroupUsed ||= {})[grp] = 1; S.ex.filter(x => x.mayPlay && x.mayPlay.zGroup === grp).forEach(x => { delete x.mayPlay; if (x.r21 && x.own && x.zBy == null) r21Drop(x, ''); }); commit(); } } catch (e){ console.warn(e); }
    return r;
  };
  const so = sacrificeOne;
  sacrificeOne = function(c, ...a){ try { if (c && !c.tok && S.bf.includes(c)) S.zSacNT = turnStr(); } catch {} return so(c, ...a); };
}
EV_TYPES.push('zcastno');
// "Whenever you cast a spell you don't own" (Tasha), "Whenever a player casts a spell they don't own" (Gonti, Night Minister)
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    let m;
    if (w !== 'at' && (m = c.match(/^(you|a player|an opponent) casts? a spell (?:you|they) don't own$/))) return {ev:'zcastno', subj:'any', ctl:m[1] === 'you' ? 'you' : m[1] === 'an opponent' ? 'opp' : 'any', desc:''};
    return ct(w, c);
  };
}
// Valgavoth: its exile replacement (engine24p 'gyEx') makes the owner exile the card; the owner also lends it to
// Valgavoth's controller, whose client links it to Valgavoth (they may play it on their turn, paying life)
function zSrcText(nm){ return ([...DICT.values()].find(a => a.n === nm) || {}).o || ''; }
function zValgaRule(c, from){
  const v = rulesOn('gyEx').find(x => x.pid && x.pid !== MYPID && /you may play cards exiled with/i.test(zSrcText(x.src))); if (v) return v;
  if (from === 'bf' && c && isCreatureCard(c)) return rulesOn('p24dieEx').concat(rulesOn('dieEx')).find(x => x.pid && x.pid !== MYPID && /cards? exiled with/i.test(zSrcText(x.src)));
  return null;
}
STATIC_KNOWN.push(/^during your turn, you may play cards exiled with ~$/);
{
  const vLend = (c0, v) => { if (!v || !c0 || c0.tok) return; setTimeout(() => { const c = S.ex.find(x => x.id === c0.id); if (c && !S.lent.some(l => l.card === c)){ r21Lend(c, v.pid, 'vg' + rid(4), 'rV', v.src || 'Valgavoth'); log(`${cname(c)} is exiled with ${v.src || 'Valgavoth'} — ${nameOf(v.pid)} may play it`); commit(); } }, 0); };
  const gr = gyReplace;
  gyReplace = function(c, from){ const r = gr(c, from); try { if (r === 'ex' && S && !UI.dry && c && !c.tok){ const v = zValgaRule(c, from); if (v) vLend(c, v); } } catch (e){ console.warn(e); } return r; };
  const ml = mill;
  mill = function(n = 1){
    const top = S && !UI.dry ? S.lib.slice(0, n) : [];
    const r = ml(n);
    try { const v = top.length && zValgaRule(); if (v) top.filter(c => S.ex.includes(c)).forEach(c => vLend(c, v)); } catch (e){ console.warn(e); }
    return r;
  };
  // borrower: Valgavoth lends are linked to my Valgavoth
  const sy = r21Sync;
  r21Sync = function(pid, s){
    const r = sy(pid, s);
    try { for (const e of (s.r21L || [])){ if (e.to !== MYPID || !/V/.test(e.w || '')) continue; const c = S.ex.find(x => x.r21 && x.own && x.own.pid === pid && x.own.ref === e.ref); if (c && c.zBy == null){ const v = S.bf.find(b => !b.fd && info(b.k)?.n === e.src) || S.bf.find(b => !b.fd && /if a card you didn't control would be put into an opponent's graveyard from anywhere, exile it instead/i.test(info(b.k)?.o || '')); if (v) zTag(c, v.id, {}); } } } catch (e){ console.warn(e); }
    return r;
  };
}
// a source that leaves the battlefield: phased-out creatures come back; a source that re-enters is a new object
{
  const ol = onLeave;
  onLeave = function(c, to, w){
    const r = ol(c, to, w);
    try { if (c && !UI.dry && (c.zPh || []).length){ const list = c.zPh.splice(0); list.forEach(p => { if (p.pid === MYPID) zPhaseInLocal(p.ref, p.tap); else sendRq(p.pid, 'zPhaseIn', p.tap ? 1 : 0, cname(c), {d:p.ref}); }); log(`${cname(c)} left the battlefield — ${list.length} creature${list.length === 1 ? '' : 's'} phase${list.length === 1 ? 's' : ''} in`); commit(); } } catch (e){ console.warn(e); }
    return r;
  };
  const oe = onEnter;
  onEnter = function(c, from, o = {}){
    try { if (c && S && from !== 'bf') S.ex.forEach(x => { if (x.zBy === c.id && x.r21until !== c.id){ delete x.zBy; if (x.mayPlay && x.mayPlay.zLazy) delete x.mayPlay; } }); } catch (e){ console.warn(e); }
    return oe(c, from, o);
  };
}

/* ---------- effects ---------- */
function zText(ctx){ const a = info(ctx.k); return a ? tname(a.o || '', a.n).toLowerCase() : String(ctx.full || '').toLowerCase(); }
function zDescOk(k, desc){ if (!desc) return true; if (desc === 'nonland permanent') return !isLand(k) && isPermType(info(k)?.t || ''); return descOk(k, desc); }
function zGyCands(pid, desc){
  if (pid === MYPID) return S.gy.filter(c => zDescOk(c.k, desc)).map(c => ({id:c.id, k:c.k, pid}));
  return (OPP.get(pid)?.gy || []).map((k, i) => ({id:-5000 - i, k, pid})).filter(c => c.k && zDescOk(c.k, desc));
}
// choose a creature card exiled with the source (up to n)
async function zPickLinked(srcId, title, pred, min, max){
  const pool = zLinked(srcId, pred); if (!pool.length || UI.dry) return pool.slice(0, UI.dry ? 0 : max);
  if (pool.length <= min) return pool;
  const ids = await pickCards({title, cards:pool, min, max:Math.min(max, pool.length), noneLabel:'None'});
  return (ids || []).map(id => pool.find(c => c.id === id)).filter(Boolean);
}
async function doRound26ZPre(s, l, ctx){
  let m; const name = ctx.name || ''; const it = ctx.it || {};
  const T = () => (ctx.tgts ? nextTargets(ctx) : []);
  // --- Banishing Light family: exile … until ~ leaves the battlefield (any owner) ---
  if ((m = l.match(/^exile (up to one |up to one other |another |other )?target (.+?) until ~ leaves the battlefield$/)) && !/^for each/.test(l)){
    const ts = T().filter(t => t.t === 'card'); ctx.r21 = true; if (UI.dry || !ts.length) return true;
    const sc = zSrcOf(ctx); if (!sc || !S.bf.includes(sc)){ log(`${name} already left the battlefield — nothing is exiled`); return true; }
    const ids = [];
    for (const t of ts){ const out = await zExilePerm(t, ctx, {until:true, srcId:sc.id}); ids.push(...out.map(c => c.id)); }
    ctx.r21ids = (ctx.r21ids || []).concat(ids); ctx.lastEx = ids.slice(); commit(); return true;
  }
  // --- Oubliette / Out of Time: phased out until ~ leaves ---
  if ((m = l.match(/^target creature phases out until ~ leaves the battlefield$/))){
    const t = T()[0]; ctx.zPh = true; if (UI.dry || !t) return true;
    const sc = zSrcOf(ctx); if (!sc || !S.bf.includes(sc)){ log(`${name} already left the battlefield`); return true; }
    const ref = rid(6); const tap = /tap that creature as it phases in this way/.test(zText(ctx));
    (sc.zPh ||= []).push({pid:t.pid || MYPID, ref, tap});
    if (t.pid === MYPID || !t.pid){ const c = S.bf.find(b => b.id === t.id); if (c) zPhaseOutLocal(single(c), ref, name); }
    else { sendRq(t.pid, 'zPhase', 0, name, {tid:t.id, d:ref}); log(`${name}: ${nameOf(t.pid)}'s ${t.nm || 'creature'} phases out until ${name} leaves the battlefield`); }
    commit(); return true;
  }
  if (/^tap that creature as it phases in this way$/.test(l)) return true;   // recorded with the phase-out above (zPh.tap)
  if (/^untap all creatures, then those creatures phase out until ~ leaves the battlefield$/.test(l) || (/^those creatures phase out until ~ leaves the battlefield$/.test(l) && /untap all creatures, then those creatures phase out/.test(zText(ctx)))){
    ctx.zPhN = 0; if (UI.dry) return true; const sc = zSrcOf(ctx); if (!sc || !S.bf.includes(sc)) return true;
    const mine = S.bf.filter(c => !c.fd && isCreatureCard(c)); const ref = rid(6);
    mine.forEach(c => { c.tap = false; c.tn = 0; zPhaseOutLocal(c, ref, name); }); if (mine.length) (sc.zPh ||= []).push({pid:MYPID, ref, tap:false});
    let n = mine.reduce((a, c) => a + (c.n || 1), 0);
    for (const [pid, st] of OPP){ const cr = (st.bf || []).filter(c => c.k && !c.fd && descOk(c.k, 'creature', {tok:c.tok})); if (!cr.length) continue; const r2 = rid(6); (sc.zPh ||= []).push({pid, ref:r2, tap:false}); cr.forEach(c => sendRq(pid, 'zPhase', 1, name, {tid:c.id, d:r2})); n += cr.reduce((a, c) => a + (c.n || 1), 0); }
    ctx.zPhN = n; log(`${name}: ${n} creature${n === 1 ? '' : 's'} phased out until it leaves the battlefield`); commit(); return true;
  }
  if (/^put a time counter on ~ for each creature that phased out this way$/.test(l) && ctx.zPhN != null){ const sc = zSrcOf(ctx); if (sc && ctx.zPhN){ addNamed(sc, 'time', ctx.zPhN); log(`${name}: ${ctx.zPhN} time counters`); } commit(); return true; }
  // --- Ghost Vacuum: exile target card from a graveyard (linked) ---
  if (/^exile target card from a graveyard$/.test(l) && /exiled with ~/.test(zText(ctx))){
    const t = T().find(x => x.t === 'gy'); if (UI.dry || !t) return true;
    await zExileGyCard(t.pid || MYPID, t.k, ctx, {id:t.pid === MYPID ? t.id : null}); commit(); return true;
  }
  if ((m = l.match(/^put each creature card exiled with ~ onto the battlefield under your control with a flying counter on it$/))){
    const sid = ctx.srcId; ctx.zSpirit = /each of them is a 1\/1 spirit in addition to its other types/.test(zText(ctx)); if (UI.dry) return true;
    const list = zLinked(sid, c => isCreatureCard(c));
    list.forEach(c => zTake(c, {flyCtr:true, spirit:ctx.zSpirit}));
    log(`${name}: ${list.length} creature card${list.length === 1 ? '' : 's'} put onto the battlefield with a flying counter${ctx.zSpirit ? ' — each is a 1/1 Spirit' : ''}`); commit(); return true;
  }
  if (/^each of them is a 1\/1 spirit in addition to its other types$/.test(l) && ctx.zSpirit !== undefined) return true;   // applied as they entered (zTakeExtras)
  // --- Nautiloid Ship: exile target player's graveyard (linked) ---
  if (/^exile target player's graveyard$/.test(l) && /exiled with ~/.test(zText(ctx))){
    const t = T().find(x => x.t === 'player'); if (UI.dry || !t) return true; const sc = zSrcOf(ctx); const sid = sc ? sc.id : ctx.srcId;
    if (t.pid === MYPID){ const all = S.gy.slice(); all.forEach(c => { moveCard(c.id, 'ex', {quiet:true}); const e = S.ex.find(x => x.id === c.id); if (e) zTag(e, sid); }); log(`${name}: exiled my graveyard (${all.length})`); }
    else { const res = await r21Ask(t.pid, 'r21exGy', 0, name, {d:'r'}); res.ids.forEach(id => zTag(S.ex.find(c => c.id === id), sid)); log(`${name}: exiled ${nameOf(t.pid)}'s graveyard (${res.ids.length} cards)`); }
    commit(); return true;
  }
  if ((m = l.match(/^(?:you may )?put a creature card exiled with ~ onto the battlefield under your control$/))){
    if (UI.dry) return true; const [c] = await zPickLinked(ctx.srcId, `${name}: put a creature card exiled with it onto the battlefield`, x => isCreatureCard(x), 0, 1);
    if (c) zTake(c, {}); else log(`${name}: no creature card exiled with it`); commit(); return true;
  }
  // --- Sothera ---
  if (/^each opponent chooses a creature they control and exiles it$/.test(l)){
    if (UI.dry) return true; const sc = zSrcOf(ctx); const sid = sc ? sc.id : ctx.srcId;
    const res = await Promise.all(opponents().map(p => r21Ask(p.pid, 'zChooseEx', 0, name, {d:'creature'})));
    res.forEach(x => x.ids.forEach(id => zTag(S.ex.find(c => c.id === id), sid))); commit(); return true;
  }
  if ((m = l.match(/^if a player controls no creatures, sacrifice ~(?:, then put a creature card exiled with (?:it|~) onto the battlefield under your control with two additional \+1\/\+1 counters on it)?$/))){
    const none = !S.bf.some(c => !c.fd && isCreatureCard(c)) || [...OPP.values()].some(st => !(st.bf || []).some(c => c.k && !c.fd && descOk(c.k, 'creature', {tok:c.tok})));
    if (UI.dry) return true; if (!none){ ctx.zStop = true; log(`${name}: every player controls a creature`); return true; }
    const sc = zSrcOf(ctx); if (sc && S.bf.includes(sc)){ sacrificeOne(sc); ctx.zSacd = true; } else { ctx.zStop = true; return true; }
    if (/then put/.test(l)){ const [c] = await zPickLinked(ctx.srcId, `${name}: put a creature card exiled with it onto the battlefield`, x => isCreatureCard(x), 1, 1); if (c) zTake(c, {cp:2}); }
    commit(); return true;
  }
  if (/^(?:then )?put a creature card exiled with (?:it|~) onto the battlefield under your control with two additional \+1\/\+1 counters on it$/.test(l)){
    if (UI.dry || ctx.zStop || ctx.b26soth === false || S.bf.some(b => b.id === ctx.srcId)) return true;   // only once ~ was really sacrificed
    const [c] = await zPickLinked(ctx.srcId, `${name}: put a creature card exiled with it onto the battlefield`, x => isCreatureCard(x), 1, 1); if (c) zTake(c, {cp:2}); commit(); return true;
  }
  // --- Bronzebeak Foragers ---
  if (/^put target card with mana value x exiled with ~ into its owner's graveyard$/.test(l)){
    const x = it.x || 0; if (UI.dry) return true;
    const [c] = await zPickLinked(ctx.srcId, `${name}: put a card with mana value ${x} exiled with it into its owner's graveyard`, y => (info(y.k)?.mv || 0) === x, 1, 1);
    if (c){ log(`${name}: ${cname(c)} goes to ${zOwner(c) === MYPID ? 'my' : nameOf(zOwner(c)) + "'s"} graveyard`); zReturn(c, 'gy'); } else log(`${name}: no card with mana value ${x} exiled with it`);
    commit(); return true;
  }
  // --- Colfenor's Urn ---
  if (/^(?:you may )?exile it$/.test(l) && /cards have been exiled with ~/.test(zText(ctx)) && it.evId != null){
    const c = S.gy.find(g => g.id === it.evId); if (!c || UI.dry) return true;
    if (!(await askYes(`${name}: exile ${cname(c)}?`, 'Exile it', 'No'))) return true;
    moveCard(c.id, 'ex', {quiet:true}); const e = S.ex.find(x => x.id === c.id); if (e) zTag(e, ctx.srcId); log(`${name}: exiled ${cname(c)}`); commit(); return true;
  }
  if ((m = l.match(/^if (three|two|four|\d+) or more cards have been exiled with ~, sacrifice it$/))){
    const n = wn(m[1]) || +m[1]; const list = zLinked(ctx.srcId); if (UI.dry) return true;
    if (list.length < n){ ctx.zStop = true; return true; }
    const sc = zSrcOf(ctx); if (sc && S.bf.includes(sc)){ sacrificeOne(sc); ctx.zSacd = true; ctx.zBack = list; } else ctx.zStop = true;
    commit(); return true;
  }
  if (/^if you do, return those cards to the battlefield under their owner's control$/.test(l) && (ctx.zSacd || ctx.zStop || UI.dry)){
    if (UI.dry || !ctx.zSacd) return true; (ctx.zBack || []).forEach(c => zReturn(c, 'bf')); log(`${name}: ${(ctx.zBack || []).length} cards returned to the battlefield`); commit(); return true;
  }
  // --- "exile the top card of your library" linked to a source that lets you play cards exiled with it (Theater of Horrors, Evendo Brushrazer) ---
  if (/^exile the top card of your library$/.test(l) && /(?:play|cast)[^.]*cards exiled with ~|cast spells from among cards exiled with ~/.test(zText(ctx)) && !/you may (?:play|cast) (?:that card|it)/.test(String(ctx.full || '').toLowerCase())){
    if (UI.dry) return true; const c = S.lib[0]; if (!c){ log(`${name}: library is empty`); return true; }
    moveCard(c.id, 'ex', {quiet:true}); const e = S.ex.find(x => x.id === c.id); if (e) zTag(e, ctx.srcId); log(`${name}: exiled ${cname(c)} from the top of my library`); commit(); return true;
  }
  // --- Tinybones, Bauble Burglar / Mari, the Killing Quill: exile it from their graveyard with a counter ---
  if ((m = l.match(/^exile it (?:from their graveyard )?with an? (stash|hit|page|void) counter on it$/)) && (it.evk || UI.dry)){
    if (UI.dry) return true; const pid = it.evPid || MYPID;
    if (pid === MYPID){ const c = S.gy.find(g => g.id === it.evId) || S.gy.find(g => g.k === it.evk); if (c){ moveCard(c.id, 'ex', {quiet:true}); const e = S.ex.find(x => x.id === c.id); if (e){ zTag(e, ctx.srcId, {ctr:m[1]}); if (m[1] === 'hit') e.p24hit = 1; } } }
    else await zExileGyCard(pid, it.evk, ctx, {ctr:m[1]});
    commit(); return true;
  }
  // --- Tasha, the Witch Queen ---
  if ((m = l.match(/^for each opponent, exile up to one target (instant or sorcery|creature|artifact|noncreature) card from that player's graveyard and put an? (page|stash|hit) counter on it$/))){
    if (UI.dry) return true; let ts = [];
    for (let g = 0; g < 6; g++){ const x = T().filter(t => t.t === 'gy'); if (!x.length) break; ts.push(...x); }
    if (!ts.length){
      for (const p of opponents()){ const cands = zGyCands(p.pid, m[1]); if (!cands.length) continue;
        const v = await askChoice({title:`${name}: exile up to one ${m[1]} card from ${p.nm}'s graveyard`, options:[...cands.map(c => ({label:info(c.k)?.n || '?', value:c.k})), {label:'None', value:''}]}); if (v) ts.push({t:'gy', pid:p.pid, k:v}); }
    }
    const seen = new Set();
    for (const t of ts){ if (!t.pid || t.pid === MYPID || seen.has(t.pid)) continue; seen.add(t.pid); await zExileGyCard(t.pid, t.k, ctx, {ctr:m[2]}); }
    commit(); return true;
  }
  if ((m = l.match(/^(?:you may )?cast a spell from among cards in exile with (page|stash) counters on them without paying its mana cost$/))){
    if (UI.dry) return true; const ids = S.ex.filter(c => (c.nc || {})[m[1]] > 0 && !isLand(c.k)).map(c => c.id);
    if (!ids.length){ log(`${name}: no cards in exile with ${m[1]} counters`); return true; }
    await r21CastNow({...ctx, r21ids:ids}, {free:true, max:1}); commit(); return true;
  }
  // --- Gonti, Night Minister ---
  if (/^its controller looks at the top card of that opponent's library and exiles it face down$/.test(l)){
    ctx.zGonti = true; if (UI.dry) return true; const ctl = it.evPid || MYPID; const opp = it.evDp; if (!opp) return true;
    if (opp === MYPID){ log(`${name}: the damaged player is me — nothing to do`); return true; }
    if (ctl === MYPID){ const ids = await r21ExileFrom([opp], ctx, {n:1, w:'pal'}); ids.forEach(id => zTag(S.ex.find(c => c.id === id), ctx.srcId, {fd:true})); }
    else { sendRq(opp, 'zExTopTo', 0, name, {d:`${ctl}|pal`}); log(`${name}: ${nameOf(ctl)} exiles the top card of ${nameOf(opp)}'s library face down and may play it`); }
    ctx.zGonti = true; commit(); return true;
  }
  if (ctx.zGonti && /^(they may play that card for as long as it remains exiled|mana of any type can be spent to cast a spell this way)$/.test(l)) return true;   // part of the lend (w = p+a+l)
  // --- Black Cat, Cunning Thief ---
  if ((m = l.match(/^look at the top (two|three|four|five|six|seven|eight|nine|ten|\d+) cards of target opponent's library, exile (two|three) of them face down$/))){
    const n = wn(m[1]) || +m[1]; const k = wn(m[2]); ctx.zCat = true; ctx.r21 = true; const t = T().find(x => x.t === 'player'); if (UI.dry || !t || t.pid === MYPID) return true;
    const {tok, cards} = await r21ShowFrom(t.pid, n, 'lib', ctx);
    const ids = cards.length ? await pickCards({title:`${name}: exile ${m[2]} of ${nameOf(t.pid)}'s top ${cards.length} face down`, cards, min:Math.min(k, cards.length), max:Math.min(k, cards.length)}) : [];
    const idx = (ids || []).map(id => cards.find(c => c.id === id)).filter(Boolean).map(c => c.i);
    const full = String(ctx.full || zText(ctx)).toLowerCase(); const w = /play the exiled cards for as long as they remain exiled/.test(full) ? (/mana of any type/.test(full) ? 'pal' : 'pl') : 'r';
    const got = await zTakeFrom(t.pid, tok, idx, /bottom of their library in a random order/.test(full) ? 'b' : 'b', w, ctx);
    got.forEach(id => zTag(S.ex.find(c => c.id === id), ctx.srcId, {fd:true})); commit(); return true;
  }
  if (ctx.zCat && /^((?:then )?put the rest on the bottom of (?:their|that) library in a random order|(?:you may )?play the exiled cards for as long as they remain exiled|mana of any type can be spent to cast spells this way)$/.test(l)) return true;
  // --- Crabomination ---
  if (/^target opponent exiles the top card of their library, a card at random from their graveyard, and a card at random from their hand$/.test(l)){
    const t = T().find(x => x.t === 'player'); ctx.r21 = true; if (UI.dry || !t || t.pid === MYPID) return true;
    const res = await r21Ask(t.pid, 'zExHandGy', 0, name, {}); ctx.r21ids = res.ids; ctx.lastEx = res.ids.slice(); commit(); return true;
  }
  if (/^(?:you may )?cast a spell from among cards exiled this way without paying its mana cost$/.test(l) && ctx.r21){ await r21CastNow(ctx, {free:true, max:1}); return true; }
  // --- Gix, Yawgmoth Praetor; Elder Brain-style "play lands and cast spells from among" during resolution ---
  if (/^(?:you may )?play lands and cast spells from among cards exiled this way without paying their mana costs$/.test(l) && ctx.r21){
    if (UI.dry) return true;
    await r21CastNow(ctx, {free:true});
    const lands = (ctx.r21ids || []).map(id => S.ex.find(c => c.id === id)).filter(c => c && isLand(c.k));
    for (const c of lands){ if (!(await askYes(`${name}: play ${cname(c)}${c.own ? ` (${nameOf(c.own.pid)}'s card)` : ''}?`, 'Play it', 'No'))) continue; c.mayPlay = {t:turnStr(), cast:false, src:name, u0:S.untapN, free:true}; playLand(c, {}); if (S.ex.includes(c)) delete c.mayPlay; }
    commit(); return true;
  }
  // --- Nashi, Moon Sage's Scion ---
  if (/^until end of turn, you may play one of those cards$/.test(l) && ctx.r21){
    const life = /pay life equal to its mana value rather than paying its mana cost/.test(String(ctx.full || zText(ctx)).toLowerCase()); const g = rid(6);
    const ids = (ctx.r21ids || []).filter(id => S.ex.some(c => c.id === id));
    ids.forEach(id => { const c = S.ex.find(x => x.id === id); c.mayPlay = {t:turnStr(), cast:false, src:name, u0:S.untapN, zGroup:g, zLife:life, free:life}; });
    if (ids.length) log(`${name}: may play one of ${ids.length} exiled cards this turn${life ? ', paying life equal to its mana value' : ''}`); ctx.zNashi = true; commit(); return true;
  }
  if (ctx.zNashi && /^if you cast a spell this way, pay life equal to its mana value rather than paying its mana cost$/.test(l)) return true;
  // --- Rev, Tithe Extractor: look at the top card of that player's library and exile it face down ---
  if ((m = l.match(/^(?:then )?look at the top card of (that player's|target player's|target opponent's|defending player's) library and exile it face down$/)) && /\b(cast|play)\b/.test(String(ctx.full || zText(ctx)).toLowerCase())){
    const ids = await r21ExileFrom(r21Pids(m[1], ctx), ctx, {n:1, w:'r'}); ids.forEach(id => zTag(S.ex.find(c => c.id === id), ctx.srcId, {fd:true})); ctx.r21fd = true; return true;
  }
  // --- Silent-Blade Oni: look at that player's hand; cast a spell from among those cards ---
  if ((m = l.match(/^look at (that player's|target player's|target opponent's|defending player's) hand$/)) && /cast a spell from among those cards/.test(String(ctx.full || zText(ctx)).toLowerCase())){
    const pid = r21Pids(m[1], ctx)[0]; ctx.zOni = {pid}; if (UI.dry || !pid || pid === MYPID) return true;
    const tok = rid(6); sendRq(pid, 'zHandShow', 0, name, {ref:tok}); commit();
    const sh = await waitUntil(() => { const x = OPP.get(pid)?.r21show; return x && x.ref === tok && x.to === MYPID ? x : null; }, 25000);
    ctx.zOni = {pid, tok, cards:sh ? sh.ks.map((k, i) => ({id:900000 + i, k, i})) : []};
    if (sh) log(`${name}: ${nameOf(pid)}'s hand — ${sh.ks.map(k => info(k)?.n).join(', ') || 'empty'}`); return true;
  }
  if (ctx.zOni && /^(?:you may )?cast a spell from among those cards without paying its mana cost$/.test(l)){
    const o = ctx.zOni; if (UI.dry || !o.tok) return true;
    const legal = (o.cards || []).filter(c => !isLand(c.k));
    const ids = legal.length ? await pickCards({title:`${name}: cast a spell from ${nameOf(o.pid)}'s hand without paying its mana cost`, cards:legal, min:0, max:1, noneLabel:"Don't cast"}) : [];
    const idx = (ids || []).map(id => legal.find(c => c.id === id)).filter(Boolean).map(c => c.i);
    const got = await zTakeFrom(o.pid, o.tok, idx, '', 'r', ctx);
    if (got.length){ await r21CastNow({...ctx, r21ids:got}, {free:true, max:1}); got.map(id => S.ex.find(c => c.id === id)).filter(Boolean).forEach(c => r21Drop(c, 'hand')); }
    commit(); return true;
  }
  // --- Tinybones, the Pickpocket / Diluvian Primordial: cast a card from another player's graveyard ---
  if ((m = l.match(/^(for each opponent, )?(?:you may )?cast (?:up to one )?target (nonland permanent|instant or sorcery|creature|instant|sorcery|artifact) card from (?:that|target|defending) player's graveyard( without paying its mana cost)?(?:, and mana of any type can be spent to cast that spell)?$/))){
    ctx.r21 = true; if (UI.dry) return true; let ts = [];
    for (let g = 0; g < 6; g++){ const x = T().filter(t => t.t === 'gy'); if (!x.length) break; ts.push(...x); if (!m[1]) break; }
    if (!ts.length){ const pids = m[1] ? opponents().map(p => p.pid) : [it.evDp || it.evPid].filter(p => p && p !== MYPID);
      for (const pid of pids){ const cands = zGyCands(pid, m[2]); if (!cands.length) continue; const v = await askChoice({title:`${name}: cast up to one ${m[2]} card from ${nameOf(pid)}'s graveyard`, options:[...cands.map(c => ({label:info(c.k)?.n || '?', value:c.k})), {label:'None', value:''}]}); if (v) ts.push({t:'gy', pid, k:v}); } }
    const exAfter = /if a spell cast this way would be put into a graveyard, exile it instead/.test(String(ctx.full || zText(ctx)).toLowerCase());
    for (const t of ts){ if (!t.pid || t.pid === MYPID) continue;
      const res = await r21Ask(t.pid, 'r21gyLend', 0, name, {d:t.k});
      res.ids.forEach(id => { const c = S.ex.find(x => x.id === id); if (c && exAfter) c.r21exAfter = 1; });
      await r21CastNow({...ctx, r21ids:res.ids}, {free:!!m[3], max:1, any:/mana of any type/.test(l)});
      res.ids.map(id => S.ex.find(c => c.id === id)).filter(Boolean).forEach(c => r21Drop(c, ''));
    }
    commit(); return true;
  }
  if (/^if a spell cast this way would be put into a graveyard, exile it instead$/.test(l) && ctx.r21) return true;   // r21exAfter on the copies
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound26ZPre(s, l, ctx)) return; return ds(s0, ctx); };
}

/* ---------- batch 3 ---------- */
{
  // Soul Partition: {2} more for an opponent's spell cast this way
  const sc = spellCost;
  spellCost = function(c, zone, o = {}){
    const r = sc(c, zone, o);
    try { if (zone === 'ex' && c && c.mayPlay && c.mayPlay.zTax && r && r.cost){ r.cost.gen += c.mayPlay.zTax; r.notes.push(`{${c.mayPlay.zTax}} more (${c.mayPlay.src})`); } } catch (e){ console.warn(e); }
    return r;
  };
  // Intrepid Paleontologist: the creature enters with a finality counter
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){ const fin = c && zone === 'ex' && c.mayPlay && c.mayPlay.zFin; const r = await bc(c, zone, o); try { if (fin && !S.ex.includes(c)) c.zFinal = 1; } catch {} return r; };
  const oe = onEnter;
  onEnter = function(c, from, o = {}){ try { if (c && c.zFinal && from !== 'bf'){ delete c.zFinal; addNamed(c, 'finality', 1); log(`${cname(c)} enters with a finality counter`); } } catch (e){ console.warn(e); } return oe(c, from, o); };
  // Mechtitan Core: the cards exiled to pay its cost are exiled with it; the token's leaving brings them back
  const aa = activateAbility;
  activateAbility = async function(c, ab){
    const link = c && ab && /exiled with ~/i.test(tname(String(ab.eff || ''), info(c.k)?.n)) && /\bexile\b/i.test(String(ab.cost || ''));
    const before = link ? new Set(S.ex.map(x => x.id)) : null;
    const r = await aa(c, ab);
    try { if (link){ S.ex.filter(x => !before.has(x.id)).forEach(x => { if (!x.tok) zTag(x, c.id); }); commit(); } } catch (e){ console.warn(e); }
    return r;
  };
  const ol = onLeave;
  onLeave = function(c, to, w){
    const r = ol(c, to, w);
    try { if (c && c.zRetOnLeave != null && !UI.dry){ const sid = c.zRetOnLeave; const list = zLinked(sid, x => x.id !== sid); list.forEach(x => zReturn(x, c.zRetHow || 'bfT')); if (list.length) log(`${cname(c)} left the battlefield — ${list.length} card${list.length === 1 ? '' : 's'} return${list.length === 1 ? 's' : ''} to the battlefield`); commit(); }
      if (c && c.zHandOnLeave && !UI.dry){ const list = zLinked(c.id); list.forEach(x => zReturn(x, 'hand')); if (list.length) log(`${cname(c)} left the battlefield — ${list.length} exiled card${list.length === 1 ? '' : 's'} return${list.length === 1 ? 's' : ''} to ${list.length === 1 ? 'its owner\'s hand' : 'their owners\' hands'}`); commit(); } } catch (e){ console.warn(e); }
    return r;
  };
}
async function doRound26ZPre2(s, l, ctx){
  let m; const name = ctx.name || ''; const it = ctx.it || {};
  const T = () => (ctx.tgts ? nextTargets(ctx) : []);
  // Mechtitan Core
  if (/^when that token leaves the battlefield, return all cards exiled with ~ except ~ to the battlefield tapped under their owners' control$/.test(l)){
    if (UI.dry) return true; const tk = S.bf.filter(c => c.tok).slice(-1)[0];
    if (tk){ tk.zRetOnLeave = ctx.srcId; tk.zRetHow = 'bfT'; log(`${name}: when ${cname(tk)} leaves, the cards exiled with ${name} return`); } commit(); return true;
  }
  // Angel of Serenity
  if (/^(?:you may )?exile up to three other target creatures from the battlefield and\/or creature cards from graveyards$/.test(l)){
    if (UI.dry) return true; const sc = zSrcOf(ctx); const sid = sc ? sc.id : ctx.srcId; let ts = [];
    for (let g = 0; g < 4; g++){ const x = T(); if (!x.length) break; ts.push(...x); }
    for (const t of ts.slice(0, 3)){ if (t.t === 'card') await zExilePerm(t, ctx, {srcId:sid}); else if (t.t === 'gy') await zExileGyCard(t.pid || MYPID, t.k, ctx, {srcId:sid, id:t.pid === MYPID ? t.id : null}); }
    if (sc && /when ~ leaves the battlefield, return the exiled cards to their owners' hands/.test(zText(ctx))) sc.zHandOnLeave = 1;
    commit(); return true;
  }
  if (/^return the exiled cards to their owners' hands$/.test(l) && /when ~ leaves the battlefield, return the exiled cards to their owners' hands/.test(zText(ctx))){
    if (UI.dry) return true; const sc = zSrcOf(ctx); if (sc && sc.zHandOnLeave) return true;   // done by the leave hook
    zLinked(ctx.srcId).forEach(x => zReturn(x, 'hand')); commit(); return true;
  }
  // Shelob, Dread Weaver: exile the dead creature (linked); put one onto the battlefield tapped
  if (/^exile it$/.test(l) && /cards? exiled with ~/.test(zText(ctx)) && it.evk && it.evPid && it.evPid !== MYPID){
    if (UI.dry) return true; await zExileGyCard(it.evPid, it.evk, ctx, {}); commit(); return true;
  }
  if ((m = l.match(/^put target creature card with mana value x exiled with ~ onto the battlefield (tapped )?under your control$/))){
    const x = it.x || 0; if (UI.dry) return true;
    const [c] = await zPickLinked(ctx.srcId, `${name}: a creature card with mana value ${x} exiled with it`, y => isCreatureCard(y) && (info(y.k)?.mv || 0) === x, 1, 1);
    if (c) zTake(c, {tap:!!m[1]}); else log(`${name}: no creature card with mana value ${x} exiled with it`); commit(); return true;
  }
  // Gisa, Glorious Resurrector
  if (/^put all creature cards exiled with ~ onto the battlefield under your control$/.test(l)){
    ctx.zGisa = true; if (UI.dry) return true; const list = zLinked(ctx.srcId, c => isCreatureCard(c));
    list.forEach(c => zTake(c, {decayed:/they gain decayed/.test(zText(ctx))})); log(`${name}: ${list.length} creature card${list.length === 1 ? '' : 's'} put onto the battlefield`); commit(); return true;
  }
  if (/^they gain decayed$/.test(l) && ctx.zGisa) return true;   // applied as they enter (zTakeExtras)
  // Kefka, Dancing Mad
  if (/^exile a card at random from each opponent's graveyard$/.test(l)){
    ctx.r21 = true; ctx.zKefka = true; if (UI.dry) return true; const res = await Promise.all(opponents().map(p => r21Ask(p.pid, 'zGyRand', 0, name, {})));
    ctx.r21ids = res.flatMap(x => x.ids); ctx.lastEx = ctx.r21ids.slice(); commit(); return true;
  }
  if (ctx.zKefka && /^(?:you may )?cast any number of spells from among cards exiled this way without paying their mana costs$/.test(l)){
    const cards = (ctx.r21ids || []).map(id => S.ex.find(c => c.id === id)).filter(Boolean);
    await r21CastNow(ctx, {free:true}); ctx.zCast = cards.filter(c => !S.ex.includes(c)).map(c => ({pid:zOwner(c), mv:info(c.k)?.mv || 0})); return true;
  }
  if (ctx.zKefka && /^(?:then )?each player who owns a spell you cast this way loses life equal to its mana value$/.test(l)){
    for (const x of (ctx.zCast || [])){ if (!x.mv) continue; if (x.pid === MYPID){ S.life -= x.mv; } else sendRq(x.pid, 'life', -x.mv, name); log(`${name}: ${nameOf(x.pid)} loses ${x.mv} life`); }
    commit(); return true;
  }
  // Elder Brain
  if (ctx.zBrain && /^(?:then )?they draw that many cards$/.test(l)) return true;   // the owner draws as part of zExHandAll
  if ((m = l.match(/^exile all cards from (that player's|target player's|defending player's) hand(, then they draw that many cards)?$/)) && (m[2] || /then they draw that many cards/.test(String(ctx.full || zText(ctx)).toLowerCase()))){
    const pid = r21Pids(m[1], ctx)[0] || it.evDp; ctx.r21 = true; ctx.zBrain = true; if (UI.dry || !pid || pid === MYPID) return true;
    const full = String(ctx.full || zText(ctx)).toLowerCase(); const w = /play lands and cast spells from among the exiled cards for as long as they remain exiled/.test(full) ? 'pl' : 'r';
    const res = await r21Ask(pid, 'zExHandAll', 0, name, {d:w}); ctx.r21ids = res.ids; ctx.lastEx = res.ids.slice(); res.ids.forEach(id => zTag(S.ex.find(c => c.id === id), ctx.srcId)); ctx.zBrain = true; commit(); return true;
  }
  if (ctx.zBrain && /^(?:you may )?play lands and cast spells from among the exiled cards for as long as they remain exiled$/.test(l)){ (ctx.r21ids || []).forEach(id => { const c = S.ex.find(x => x.id === id); if (c && !c.mayPlay) c.mayPlay = {t:turnStr(), u0:S.untapN, adv:true, cast:false, src:name}; }); return true; }
  // Arvinox
  if (/^exile the bottom card of each opponent's library face down$/.test(l)){
    ctx.r21 = true; ctx.zArv = true; if (UI.dry) return true; const res = await Promise.all(opponents().map(p => r21Ask(p.pid, 'zExBot', 0, name, {d:'r'})));
    ctx.r21ids = res.flatMap(x => x.ids); ctx.r21ids.forEach(id => zTag(S.ex.find(c => c.id === id), ctx.srcId, {fd:true})); commit(); return true;
  }
  if (ctx.zArv && /^for as long as those cards remain exiled, you may look at them, you may cast permanent spells from among them, and you may spend mana as though it were mana of any color to cast those spells$/.test(l)){
    (ctx.r21ids || []).forEach(id => { const c = S.ex.find(x => x.id === id); if (c) c.mayPlay = {t:turnStr(), u0:S.untapN, adv:true, cast:true, any:true, src:name, zCond:'perm'}; }); commit(); return true;
  }
  // Rogue Class
  if ((m = l.match(/^exile the top card of (that player's|target player's|defending player's) library face down$/)) && /cards exiled with ~/.test(zText(ctx))){
    ctx.r21 = true; ctx.zRogue = true; if (UI.dry) return true; const pids = r21Pids(m[1], ctx); const p2 = pids.length ? pids : [it.evDp].filter(Boolean);
    const ids = await r21ExileFrom(p2, ctx, {n:1, w:'r'}); ids.forEach(id => zTag(S.ex.find(c => c.id === id), ctx.srcId, {fd:true})); commit(); return true;
  }
  if (ctx.zRogue && /^(?:you may )?look at it for as long as it remains exiled$/.test(l)) return true;   // the face-down copy sits in my exile, visible to me
  // Soul Partition
  if (/^exile target nonland permanent$/.test(l) && /for as long as that card remains exiled, its owner may play it/.test(String(ctx.full || zText(ctx)).toLowerCase())){
    const t = T()[0]; ctx.zSoul = true; if (UI.dry || !t) return true; const tax = /costs \{2\} more to cast/.test(String(ctx.full || zText(ctx)).toLowerCase()) ? 2 : 0;
    if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c){ const tok = c.tok; moveCard(c.id, 'ex', {quiet:true}); const e = !tok && S.ex.find(x => x.id === c.id); if (e) e.mayPlay = {t:turnStr(), u0:S.untapN, adv:true, cast:false, src:name}; } }
    else sendRq(t.pid, 'zOwnerMay', tax, name, {tid:t.id});
    log(`${name}: exiled ${t.nm || 'a permanent'} — its owner may play it for as long as it remains exiled`); commit(); return true;
  }
  if (ctx.zSoul && /^(for as long as that card remains exiled, its owner may play it|a spell cast by an opponent this way costs \{2\} more to cast)$/.test(l)) return true;
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound26ZPre2(s, l, ctx)) return; return ds(s0, ctx); };
  const te = zTakeExtras;
  zTakeExtras = function(b, x){ te(b, x); try { if (b && x && x.decayed) b.ekw = [...new Set([...(b.ekw || []), 'decayed'])]; } catch {} };
}
// Arvinox: isn't a creature unless its controller controls three or more permanents they don't own (battlefield only)
STATIC_RULES.push([/^~ isn't a creature unless you control three or more permanents you don't own$/, m => ({kind:'zArvinox', who:'you'})]);
{
  const ic = isCreatureCard;
  isCreatureCard = c => {
    const r = ic(c); if (!r || !c || !c.k || !S) return r;
    if (!/isn't a creature unless you control three or more permanents you don't own/i.test(info(c.k)?.o || '')) return r;
    let bf = S.bf.includes(c) ? S.bf : null; if (!bf) for (const [, st] of OPP) if ((st.bf || []).includes(c)) bf = st.bf;
    if (!bf) return r;
    return bf.filter(b => b.own && !b.fd).length >= 3;
  };
}
// Angel of Serenity-style mixed targets: "creatures from the battlefield and/or creature cards from graveyards"
{
  const tc = targetCands;
  targetCands = function(spec, src){
    const m = spec && String(spec.desc || '').match(/^(?:other )?(creatures?) from the battlefield and\/or (creature) cards? from graveyards$/);
    if (!m) return tc(spec, src);
    const bf = tc({...spec, desc:'creature'}, src).filter(c => c.t === 'card');
    const gy = tc({...spec, desc:'creature', zone:'gy', whose:'any'}, src);
    return bf.concat(gy);
  };
}
