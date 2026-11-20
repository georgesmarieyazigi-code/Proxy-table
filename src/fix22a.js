/* =================== fix22a: target-dependent gaps the bot games found (helper Y) ===================
   v22 bot games showed three cards that the deck checker counted as understood but that left a "do by hand" box in play:
   - Treebeard, Gracious Host ("whenever you gain life, put that many +1/+1 counters on target Halfling or Treefolk"):
     the "gain" event never carried the amount, so every "whenever you gain life … that many / that much" ability saw 0
     (Sanguine Bond and Vito made opponents lose 0 life, quietly). The gain event now carries the amount gained.
   - Biosynthic Burst ("… It gains reach, trample, and indestructible until end of turn. Untap it."): "untap it / that
     creature / them" after a targeted effect was only handled for triggers; it now untaps the target(s) of the earlier
     effect, on whichever board they are. The serial-comma keyword list ("…, and indestructible") is cleaned too.
   - Varragoth, Bloodsky Sire ("Target player searches their library for a card, then shuffles and puts that card on
     top"): an opponent target now gets the search on their own screen (they choose; it goes on top of their library).
   Why the checker missed them: the dry run had no targets at all, and every dry run (spells included) carried a fake
   trigger event (evId 1, evN 2). So "untap it" was taken by the trigger-pronoun handler, "that many" always had 2, and a
   handler that only fails for an opponent target never ran. checkCard now also runs every effect a second time the way
   play runs it: the event fields only a real trigger would have (and an amount only for events that carry one), a
   source permanent on the battlefield, and one legal target for each "target …" — an opponent's thing where the text
   allows it, in a sandbox opponent's zones. */
RQ_OPS.push('y22run', 'y22punish', 'y22tutorTop', 'y22gyTop', 'y22scry', 'y22basePT', 'y22xtKeep');
const Y22 = {gain:[], OPP:'dry-opp', keyCache:new Map(), busy:false};

/* ---------- 1. life gain events carry the amount ---------- */
{
  const gl = gainLife;
  gainLife = function(n, ...a){ if (!S) return gl(n, ...a); Y22.gain.push(S.life); try { return gl(n, ...a); } finally { Y22.gain.pop(); } };
  const em = emit;
  emit = function(ev){ try { if (S && !Y22.off && ev && ev.type === 'gain' && ev.amt == null && Y22.gain.length){ const amt = S.life - Y22.gain[Y22.gain.length - 1]; if (amt > 0) ev.amt = amt; } } catch {} return em(ev); };
}

/* ---------- 2. keyword lists with a serial comma ("reach, trample, and indestructible") ---------- */
{
  const ao = applyOp;
  applyOp = function(r, from){ try { if (r && r.op === 'pump' && r.f && Array.isArray(r.f.kw)) r.f = {...r.f, kw:r.f.kw.map(k => String(k).replace(/^\s*and\s+/, '').trim()).filter(Boolean)}; } catch {}
    if (r && r.op === 'y22tutorTop'){ if (!UI.dry) y22TutorTop(r.src || 'a card', from); return; }
    if (r && r.op === 'y22run'){ if (!UI.dry && Y22_RUN.test(String(r.d || ''))) runEffects(String(r.d), {k:null, name:r.src || '', full:String(r.d), it:{kind:'ability'}, tgts:null}).then(() => commit()); return; }
    // life another player gives me is life I gain: replacement effects apply and "whenever you gain life" triggers (with the amount)
    if (r && r.op === 'life' && r.n > 0 && !Y22.off){ const n = gainLife(r.n, r.src); if (n) log(`gained ${n} life (${r.src || nameOf(from) + "'s card"}) → ${S.life}`); else if (!canGain().ok) log(`would gain ${r.n} life — ${canGain().why}`); commit(); return; }
    if (r && r.op === 'y22punish'){ if (!UI.dry) y22PunishMe(Math.min(+r.n || 1, 50), +r.d || 0, r.src || ''); return; }
    if (r && r.op === 'y22gyTop'){ const i = S.gy.findIndex(g => g.k === r.d); if (i >= 0){ const [g] = S.gy.splice(i, 1); reset(g); S.lib.unshift(g); log(`${cname(g)} was put on top of my library from my graveyard (${r.src})`); } commit(); return; }
    if (r && r.op === 'y22scry'){ if (!UI.dry) runEffects(`Scry ${clamp(r.n || 1, 1, 20)}.`, {k:null, name:r.src || 'scry', full:`Scry ${r.n}.`, it:{kind:'ability'}, tgts:null}).then(() => commit()); return; }
    if (r && r.op === 'y22basePT'){ const c = S.bf.find(b => b.id === r.tid); const pt = String(r.d || '').split('/').map(Number);
      if (c && pt.length === 2 && pt.every(Number.isFinite)){ const st = stats(c) || [0, 0]; const d = [pt[0] - (st[0] - (c.pu ? c.pu[0] : 0) - (c.cp || 0) + (c.cm || 0)), pt[1] - (st[1] - (c.pu ? c.pu[1] : 0) - (c.cp || 0) + (c.cm || 0))]; c.pu = [(c.pu ? c.pu[0] : 0) + d[0], (c.pu ? c.pu[1] : 0) + d[1]]; log(`${cname(c)} has base power and toughness ${pt[0]}/${pt[1]} until end of turn (${r.src})`); }
      commit(); return; }
    if (r && r.op === 'y22xtKeep'){ S.y22keep = +r.n || 0; S.r18kResume = {n:(+r.n || 0) + 1, after:String(r.d || from)}; log(`will take two extra turns (${r.src || nameOf(from)})`); commit(); return; }
    return ao(r, from); };
}

/* ---------- 4. "target player searches their library for a card, then shuffles and puts that card on top" ---------- */
// sentences another player may ask my client to run as my own (their effect, my choices)
const Y22_RUN = /^Discard (?:two|three|\w+) cards unless you discard an? (?:basic land|land|artifact|creature) card\.$/;
async function y22PunishMe(n, life, src){
  for (let i = 0; i < n; i++){
    const perms = S.bf.filter(c => !c.fd && c.k && !isLand(c.k)); const opts = [{label:`Lose ${life} life`, value:'life'}];
    if (perms.length) opts.push({label:'Sacrifice a nonland permanent', value:'sac'}); if (S.hand.length) opts.push({label:'Discard a card', value:'disc'});
    const v = opts.length === 1 ? 'life' : await askChoice({title:`${src}${n > 1 ? ` (${i + 1} of ${n})` : ''}: lose ${life} life unless you sacrifice a nonland permanent or discard a card`, options:opts});
    if (v === 'sac'){ const ids = await pickCards({title:`${src}: sacrifice a nonland permanent`, cards:perms, min:1, max:1}); const c = S.bf.find(x => x.id === (ids || [])[0]) || perms[0]; if (c){ sacrificeOne(c); log(`sacrificed ${cname(c)} (${src})`); } }
    else if (v === 'disc'){ const ids = await pickCards({title:`${src}: discard a card`, cards:S.hand.slice(), min:1, max:1}); const c = S.hand.find(x => x.id === (ids || [])[0]) || S.hand[0]; if (c){ moveCard(c.id, 'gy'); log(`discarded ${cname(c)} (${src})`); } }
    else { S.life -= life; log(`lost ${life} life (${src}) → ${S.life}`); }
    commit();
  }
}
async function y22TutorTop(src, from){
  // the searching player is this client: they choose, the card goes on top of their own library (after the shuffle)
  if (!S.lib.length){ log(`${src}: library is empty — nothing to find`); commit(); return; }
  const ids = await pickCards({title:`${src}${from && from !== MYPID ? ' (' + nameOf(from) + ')' : ''}: search your library for a card`, hint:'Your library is shuffled, then the card you choose goes on top.', cards:S.lib.slice().sort((a, b) => cname(a).localeCompare(cname(b))), min:S.lib.length ? 1 : 0, max:1});
  const id = ids && ids[0]; const i = id != null ? S.lib.findIndex(c => c.id === id) : -1;
  const [c] = i >= 0 ? S.lib.splice(i, 1) : [S.lib.splice(Math.floor(Math.random() * S.lib.length), 1)[0]];
  shuffle(S.lib); if (c) S.lib.unshift(c);
  emit({type:'search', cnt:1});
  log(`searched their library, shuffled and put a card on top (${src})`); commit();
}

// "tap/untap/exile/destroy it" — what "it" is: the target of the text before it; with no target before it, the thing the
// trigger is about (the creature that died, attacked …) or else the source itself ("~ gains indestructible. Tap it.").
// This runs only when no other handler took the sentence (it would have become a "do by hand" note).
const Y22_PRON = /^(tap|untap|exile|destroy) (it|that creature|that permanent|them|those creatures|those permanents)$/;
function y22Pronoun(l, ctx){
  const m = l.match(Y22_PRON); if (!m) return false; const verb = m[1]; const name = ctx.name || '';
  if (ctx.stoleFlags && verb === 'untap') return true;   // gain control … untap that permanent: the control change untapped it
  const full = String(ctx.full || '').toLowerCase().replace(/\([^)]*\)/g, ''); const at = full.indexOf(l);
  const before = at > 0 ? full.slice(0, at) : '';
  const lastSentence = before.split(/[.\n]\s*/).filter(x => x.trim()).pop() || '';
  let ts = [];
  if (/\btarget\b/.test(before)){
    const used = (ctx.tgts || []).slice(0, ctx.ti || 0).flat().filter(Boolean);
    if (used.some(t => t.t === 'player') && !used.some(t => t.t === 'card')) return false;   // "them" = something the target player has
    ts = (ctx.lastT || []).filter(t => t && t.t === 'card' && targetStillThere(t));
    if (!ts.length) return used.length > 0 || !!UI.dry;   // the target is gone: nothing to do
  } else {
    const it = ctx.it || {}; const nm = String(name).toLowerCase();
    const selfSubj = nm && (lastSentence.trim().startsWith(nm) || lastSentence.trim().startsWith(nm.split(',')[0]) || /^(?:then )?(?:transform )?this (?:creature|land|artifact|permanent|enchantment|vehicle)\b/.test(lastSentence.trim()) || /transform (?:~|this \w+), then$/.test(before.trim()) || /^~ /.test(lastSentence.trim()));
    if (it.kind === 'spell' && it.evId == null && verb === 'exile' && ctx.srcId == null){
      // the resolving spell itself: "exile it, then put it onto the battlefield transformed" — the next part moves it (through exile);
      // otherwise it goes to exile instead of the graveyard as it finishes resolving
      if (!/^,?\s*then (?:return|put) it onto the battlefield/.test(full.slice(at + l.length))) it.exAfter = true;
      return true;
    }
    if (it.evId != null && !selfSubj && it.kind === 'trigger'){ ts = [{t:'card', pid:it.evPid || MYPID, id:it.evId, k:it.evk}]; }
    else if (ctx.srcId != null){ ts = [{t:'card', pid:MYPID, id:ctx.srcId, k:ctx.k}]; }
    else return false;
  }
  for (const t of ts){
    if (t.pid === MYPID){
      const [z,, c] = find(t.id); if (!c) continue;
      if (verb === 'exile'){ if (z === 'bf' || z === 'gy' || z === 'hand'){ moveCard(c.id, 'ex', {quiet:true}); log(`${name}: exiled ${cname(c)}`); } continue; }
      if (z !== 'bf') continue;
      if (verb === 'tap'){ c.tap = true; log(`${name}: tapped ${cname(c)}`); }
      else if (verb === 'untap'){ c.tap = false; c.tn = 0; log(`${name}: untapped ${cname(c)}`); }
      else destroyCard(c, name);
    } else applyTo(t, {op:verb, src:name});
  }
  commit(); return true;
}
{
  const hw = handWarn;
  handWarn = function(s, ctx){
    try { if (ctx && ctx.y22cap && !ctx.y22cap.hit && String(s).toLowerCase().replace(/\.$/, '').trim() === ctx.y22cap.l){ ctx.y22cap.hit = true; return; } } catch {}
    try { if (!Y22.off && ctx && ctx.y22fb != null){ const l = String(s).toLowerCase().replace(/\.$/, '').trim(); if (l === ctx.y22fb && y22Fallback(l, ctx)) return; } } catch (e){ console.warn('y22 fallback', e); }
    return hw(s, ctx);
  };
}

const y22AllText = k => { const a = info(k); if (!a) return ''; return [a.o, a.back && a.back.o, ...((a.faces || []).map(f => f && f.o))].filter(Boolean).join('\n'); };
// fallbacks: only when no other handler took the sentence
const Y22_FB = [Y22_PRON, /^that player loses (\d+) life$/];
function y22Fallback(l, ctx){
  let m; const name = ctx.name || '';
  if (Y22_PRON.test(l)) return y22Pronoun(l, ctx);
  if ((m = l.match(/^that player loses (\d+) life$/))){
    // "destroy target creature an opponent controls. That player loses 3 life": the controller of the target
    const t = (ctx.lastT || [])[0]; if (!t || !t.pid) return false;
    const n = +m[1]; if (t.pid === MYPID){ S.life -= n; log(`${name}: lost ${n} life → ${S.life}`); } else { sendRq(t.pid, 'life', -n, name); log(`${name}: ${nameOf(t.pid)} loses ${n} life`); }
    commit(); return true;
  }
  return false;
}
// a target that belongs to someone else (peek at the next target group without using it up)
const y22PeekT = ctx => (((ctx.tgts || [])[ctx.ti || 0]) || []).filter(targetStillThere)[0] || null;

async function y22Pre(s, l, ctx){
  if (Y22.off) return false;
  let m; const name = ctx.name || '';
  if ((m = l.match(/^(target player|target opponent) searches their library for a card(?:,)? (?:then shuffles and puts that card on top|and puts it on top after shuffling)(?: of their library)?$/))){
    const t = (ctx.tgts ? nextTargets(ctx) : [])[0];
    const pid = t ? t.pid : null; if (!pid) return true;
    if (pid === MYPID){ if (!UI.dry) await y22TutorTop(name, MYPID); return true; }
    sendRq(pid, 'y22tutorTop', 0, name); log(`${name}: ${nameOf(pid)} searches their library for a card, shuffles and puts it on top`); commit(); return true;
  }
  // Compulsive Research on another player: "that player discards two cards unless they discard a land card" — their choice
  if ((m = l.match(/^(?:then )?that player discards (two|three|\w+) cards unless they discard an? (basic land|land|artifact|creature) card$/))){
    const t = (ctx.lastT || []).find(x => x && x.t === 'player'); if (!t) return false;
    const own = `Discard ${m[1]} cards unless you discard a ${m[2]} card.`;
    if (t.pid === MYPID){ await doSentence(own, {...ctx}); return true; }
    sendRq(t.pid, 'y22run', 0, name, {d:own}); log(`${name}: ${nameOf(t.pid)} discards ${m[1]} cards unless they discard a ${m[2]} card`); commit(); return true;
  }
  // Tibalt, Cosmic Impostor +2: "exile the top card of each player's library" — the emblem lets me play them (any mana): my own card gets the
  // permission here, another player's card is exiled by its owner and lent to me (the Gonti lend: play, any mana, as long as it's exiled)
  if (/^exile the top card of each player's library$/.test(l) && /you may play cards exiled with/i.test(y22AllText(ctx.k))){
    if (UI.dry) return true;
    const c = S.lib[0]; if (c){ moveCard(c.id, 'ex', {quiet:true}); const e = S.ex.find(x => x.id === c.id); if (e) e.mayPlay = r21Perm('pal', name); log(`${name}: exiled ${cname(c)} from the top of my library — I may play it`); }
    for (const p of s21Opps()){ sendRq(p.pid, 'zExTopTo', 0, name, {d:`${MYPID}|pal`, ref:rid(6)}); log(`${name}: exiles the top card of ${p.nm}'s library — I may play it`); }
    commit(); return true;
  }
  // "[for each blight counter on it,] each opponent loses N life unless that player sacrifices a nonland permanent of their choice
  // or discards a card": each opponent chooses on their own screen, once per counter
  if ((m = l.match(/^(?:then )?(?:for each ((?:[a-z+\/1-]+ )?counters? on (?:it|~|this [a-z]+)), )?each opponent loses (\d+) life unless (?:that player|they) sacrifices? a nonland permanent of their choice or discards? a card$/)) && !ctx.r23torm){
    const n = m[1] ? countOf(m[1], ctx) : 1; if (n == null) return false; const life = +m[2];
    if (!n){ log(`${name}: no counters — nothing happens`); return true; }
    for (const p of s21Opps()) sendRq(p.pid, 'y22punish', Math.min(n, 50), name, {d:String(life)});
    log(`${name}: each opponent chooses ${n} time${n === 1 ? '' : 's'}: lose ${life} life, sacrifice a nonland permanent or discard a card`); commit(); return true;
  }
  // "return target creature card from your graveyard to the battlefield. You gain life equal to that creature's toughness"
  if (/^you gain life equal to that creature's toughness$/.test(l) && (ctx.lastT || []).some(t => t && t.t !== 'player')){
    const t = ctx.lastT.find(x => x.t !== 'player'); const c = S.bf.find(b => b.id === t.id) || S.bf.find(b => b.k === t.k && b.et === turnStr()) || null;
    const n = c ? Math.max(0, (stats(c) || [0, 0])[1]) : 0; if (n && gainLife(n, name)) log(`${name}: gained ${n} life → ${S.life}`); commit(); return true;
  }
  // "whenever equipped creature attacks, double its power until end of turn" (Two-Handed Axe): it = the attacking creature
  if (/^double its power until end of turn$/.test(l) && ctx.it && ctx.it.evId != null){
    const t = {t:'card', pid:ctx.it.evPid || MYPID, id:ctx.it.evId, k:ctx.it.evk}; const st = statsAny(t);
    if (st && st[0] > 0) applyTo(t, {op:'pump', src:name, f:{p:st[0], t:0}}); commit(); return true;
  }
  // extra turns for another player (CR 500.7): they take the next turn(s), then play goes on from me
  if ((m = l.match(/^target player takes (an|two) extra turns? after this one$/))){
    const t = y22PeekT(ctx); if (!t || t.pid === MYPID) return false; nextTargets(ctx);
    S.r18kGiveXt = (S.r18kGiveXt || []).concat(t.pid); if (m[1] === 'two') S.y22two = (S.y22two || []).concat(t.pid);
    log(`${name}: ${nameOf(t.pid)} takes ${m[1] === 'two' ? 'two extra turns' : 'an extra turn'} after this one`); commit(); return true;
  }
  // a creature or other card from another player's graveyard onto my battlefield: they hand it over (gytake → give)
  if ((m = l.match(/^(?:put|return) target (.+?) card from (?:a|any|an opponent's) graveyard (?:onto|to) the battlefield under your control$/))){
    const t = y22PeekT(ctx); if (!t || t.pid === MYPID) return false; nextTargets(ctx);
    sendRq(t.pid, 'gytake', 0, name, {d:t.k}); log(`${name}: puts ${info(t.k)?.n || 'a card'} from ${nameOf(t.pid)}'s graveyard onto the battlefield`); ctx.lastOppGy = {pid:t.pid, k:t.k}; commit(); return true;
  }
  if (/^put it onto the battlefield under your control$/.test(l) && ctx.lastOppGy !== undefined && ctx.y22gyDone !== 1){
    const o = ctx.lastOppGy; if (o){ sendRq(o.pid, 'gytake', 0, name, {d:o.k}); log(`${name}: puts ${info(o.k)?.n || 'a card'} from ${nameOf(o.pid)}'s graveyard onto the battlefield`); } ctx.y22gyDone = 1; commit(); return true;
  }
  // a card in another player's graveyard on top of its owner's library
  if (/^put target card from a graveyard on top of its owner's library$/.test(l)){
    const t = y22PeekT(ctx); if (!t || t.pid === MYPID) return false; nextTargets(ctx);
    sendRq(t.pid, 'y22gyTop', 0, name, {d:t.k}); log(`${name}: puts ${info(t.k)?.n || 'a card'} from ${nameOf(t.pid)}'s graveyard on top of their library`); commit(); return true;
  }
  // another player scries (their screen)
  if ((m = l.match(/^target player scries (x|\d+)(, then draws a card)?$/))){
    const t = y22PeekT(ctx); if (!t || t.pid === MYPID) return false; nextTargets(ctx);
    const n = m[1] === 'x' ? ((ctx.it && ctx.it.x) || 0) : +m[1];
    if (n > 0) sendRq(t.pid, 'y22scry', n, name); if (m[2]) sendRq(t.pid, 'draw', 1, name);
    log(`${name}: ${nameOf(t.pid)} scries ${n}${m[2] ? ', then draws a card' : ''}`); commit(); return true;
  }
  // another player's creature has base power and toughness N/N until end of turn
  if ((m = l.match(/^(?:up to one )?(?:other )?target creature (?:you control )?has base power and toughness (\d+)\/(\d+) (?:until end of turn|this turn)$/))){
    const t = y22PeekT(ctx); if (!t || t.pid === MYPID || t.t !== 'card') return false; nextTargets(ctx);
    sendRq(t.pid, 'y22basePT', 0, name, {tid:t.id, d:m[1] + '/' + m[2]}); log(`${name}: ${t.nm || 'that creature'} has base power and toughness ${m[1]}/${m[2]} until end of turn`); commit(); return true;
  }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){
    const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase();
    if (l && await y22Pre(s, l, ctx)) return;
    // a sentence that ends a quoted ability ('…, except it has "… ." Sacrifice that token …') holds two sentences: when no
    // handler takes the whole, run them one after the other
    if (ctx && !Y22.off && /"[^"]*\."\s+[A-Z][^"]*$/.test(s)){
      const cut = s.search(/\."\s+[A-Z][^"]*$/); const a = s.slice(0, cut + 2), b = s.slice(cut + 2).trim();
      const prevC = ctx.y22cap; ctx.y22cap = {l, hit:false};
      try { await ds(s0, ctx); } finally { const hit = ctx.y22cap.hit; ctx.y22cap = prevC; if (hit){ await doSentence(a, ctx); await doSentence(b, ctx); } }
      return;
    }
    if (ctx && Y22_FB.some(re => re.test(l))){ const prev = ctx.y22fb; ctx.y22fb = l; try { return await ds(s0, ctx); } finally { ctx.y22fb = prev; } }
    return ds(s0, ctx);
  };
}

/* ---------- triggers split at the wrong comma: a condition can't run past the end of its sentence ----------
   ("Whenever you discard a creature card, you may pay {2}{U}. If you do, create a tapped token that's a copy of that card, except …"
   was read as the condition "…that card" + the effect "except it's a 4/4 black Zombie") */
{
  const tg = trigsOf;
  trigsOf = function(k, fl){ const out = tg(k, fl); try { if (out.y22) return out; out.y22 = true;
    for (let i = 0; i < out.length; i++){ const t = out[i]; if (!t || !t.raw || !t.eff) continue;
      const cond = t.raw.slice(0, Math.max(0, t.raw.length - String(t.eff).length)); if (!/[.:]\s|\{/.test(cond)) continue;
      const m = t.raw.match(/^(when|whenever|at) ([^.{]+?), ([\s\S]+)$/i); if (!m) continue;
      const cl = classifyTrig(m[1].toLowerCase(), m[2].toLowerCase().trim()); if (!cl) continue;
      out[i] = Object.assign(cl, {eff:m[3].trim(), raw:t.raw}); }
  } catch (e){ console.warn('y22 trigsOf', e); } return out; };
}

/* ---------- "target player's library": only players are targets, never cards ---------- */
{
  const tc = targetCands;
  targetCands = function(spec, src){ const r = tc(spec, src); try { if (spec && /\b(?:player|opponent)'s\b/.test(spec.desc || '') && !/\b(?:creature|artifact|enchantment|land|permanent|planeswalker|card)s?\b/.test(String(spec.desc).replace(/\b(?:player|opponent)'s (?:library|hand|graveyard)\b.*$/, ''))) return r.filter(c => c.t === 'player'); } catch {} return r; };
}

/* ---------- extra turns: "two extra turns" for another player, and the second one on their side ---------- */
{
  const pt = passTurn;
  passTurn = function(){
    try { const [n, pid, g = 0] = currentTurn();
      if (n > 0 && pid === MYPID && S.y22keep && S.y22keep === n){ S.y22keep = 0; S.turn = [n + 1, MYPID, g]; log('takes another extra turn'); commit(); return; }
      const to = (S.r18kGiveXt || [])[0]; const two = to && (S.y22two || []).includes(to) && n > 0 && pid === MYPID;
      const r = pt();
      if (two && S.turn[1] === to){ S.y22two.splice(S.y22two.indexOf(to), 1); sendRq(to, 'y22xtKeep', n + 1, 'two extra turns', {d:MYPID}); commit(); }
      return r;
    } catch (e){ console.warn('y22 turn', e); return pt(); }
  };
}

/* ---------- 5. the deck checker runs each effect the way play runs it ---------- */
// events whose triggers carry no amount: a "that many" there must be computed by the effect itself
const Y22_NOAMT = new Set(['enter', 'attack', 'block', 'blocked', 'die', 'leave', 'leavegy', 'sac', 'turnup', 'step', 'xform', 'tapped', 'untapped', 'countered', 'level']);
function y22KeyFor(desc, zone){
  const key = zone + '|' + desc; if (Y22.keyCache.has(key)) return Y22.keyCache.get(key);
  let best = null, bl = 1e9;
  const wantCr = /\bcreature\b/.test(desc);
  for (const a of DICT.values()){
    if (!a || !a.k || !a.n || !a.t || /^face-down/i.test(a.n) || /\bToken\b/.test(a.t || '') || a.back || a.faces) continue;
    if (zone === 'bf' && /\b(Instant|Sorcery)\b/.test(a.t || '')) continue;
    if (wantCr && !/\bCreature\b/.test(a.t || '')) continue;
    let ok = false; try { ok = descOk(a.k, desc || 'permanent'); } catch {}
    if (!ok) continue;
    const len = String(a.o || '').length; if (len < bl){ best = a.k; bl = len; if (len === 0) break; }
  }
  Y22.keyCache.set(key, best); return best;
}
function y22Board(text, k, srcId){
  // one legal thing for each "target …" in the text; an opponent's where the text allows it
  const opp = {bf:[], gy:[]}; let nid = 950000;
  const specs = (() => { try { return targetSpecs(text) || []; } catch { return []; } })();
  for (const sp of specs){
    const d = sp.desc || '';
    if (sp.any) continue;
    if (/\b(?:player|opponent)'s\b/.test(d)) continue;
    const players = /\b(players?|opponents?)\b/.test(d);
    const cardDesc = d.replace(/\b(players?|opponents?)\b/g, '').replace(/^\s*(or|and)\s+|\s+(or|and)\s*$/g, '').trim();
    if (players && !cardDesc) continue;
    if (sp.zone === 'gy'){
      const kk = y22KeyFor(String(sp.desc || '').replace(/\bcards?\b/g, '').trim() || 'card', 'gy'); if (!kk) continue;
      if (sp.whose === 'you') S.gy.push({id:nid++, k:kk}); else opp.gy.push(kk);
      continue;
    }
    const cd = ctlDesc(cardDesc); const kk = y22KeyFor(cd.desc || 'permanent', 'bf'); if (!kk) continue;
    const c = {id:nid++, k:kk, x:100, y:100};
    if (cd.ctl === 'you' || /\byou own\b/.test(cardDesc)) S.bf.push(c); else opp.bf.push(c);
  }
  return opp;
}
async function y22Dry(text, k, name, kind, cl){ const ev = cl && cl.ev;
  const saved = S; const misses = []; const hadOpp = OPP.get(Y22.OPP); const om = openModal;
  UI.dry = misses; Y22.busy = true;
  try {
    S = saved ? JSON.parse(JSON.stringify(saved)) : newState();
    if (!S.lib.length) S.lib = Array.from({length:10}, (_, i) => ({id:900000 + i, k}));
    S.turn = [1, MYPID, 0]; S.ph = [1, 3, 0];
    const srcId = 940000; const spell = kind === 'spell';
    if (!spell) S.bf.push({id:srcId, k, x:50, y:50});
    const ob = y22Board(text, k, srcId);
    // the thing a non-self trigger is about (the equipped creature that attacked, the creature that died …)
    let evId = 1, evk; const self0 = cl && /^self/.test(cl.subj || '');
    if (kind === 'trigger' && cl && !self0 && /^(enter|die|leave|attack|block|blocked|dealt|cdmg|dmg|tapped|untapped|sac)$/.test(cl.ev || '')){ const ek = y22KeyFor(String(cl.desc || 'creature').replace(/\b(?:you control|an opponent controls)\b/g, '').trim() || 'creature', 'bf'); if (ek){ evId = 945000; evk = ek; (cl.ctl !== 'you' ? ob.bf : S.bf).push({id:evId, k:ek, x:60, y:60});
      if (/^whenever (?:equipped|enchanted) creature\b/i.test(String(cl.raw || '')) && cl.ctl === 'you'){ const me = S.bf.find(b => b.id === srcId); if (me) me.att = {pid:MYPID, id:evId}; } } }
    OPP.set(Y22.OPP, sanitizeState({nm:'Opponent', j:9e14, life:40, hc:5, lc:40, turn:[0, '', 0], bf:ob.bf, gy:ob.gy}));
    // targets: the real chooser, answering with an opponent's thing first, then mine
    openModal = m => {
      if (m && m.type === 'target' && m.resolve){ const ok = (m.cands || []).filter(c => c.ok && c.id !== srcId); const pl = /\b(?:players?|opponents?)\b/.test((m.spec && m.spec.desc) || ''); const pick = (pl && ok.find(c => c.pid === Y22.OPP && c.t === 'player')) || ok.find(c => c.pid === Y22.OPP && c.t !== 'player') || ok.find(c => c.pid === Y22.OPP) || ok[0]; return m.resolve(pick ? [pick] : []); }
      return om(m);
    };
    const self = cl && /^self/.test(cl.subj || ''); const it = spell ? {kind:'spell', x:2, sid:'dry'} : kind === 'trigger' ? {kind:'trigger', evX:2, x:2, sid:'dry', evDp:Y22.OPP, evId:self ? srcId : evId, evk:self ? k : evk, evPid:cl && cl.ctl !== 'you' && !self ? Y22.OPP : MYPID, ...((Y22_NOAMT.has(ev) && !(cl && cl.batch)) || (Y22.off && ev === 'gain') ? {} : {evN:2})} : {kind:'ability', x:2, sid:'dry'};
    const src = {pid:MYPID, id:spell ? null : srcId, k};
    let tgts = null; try { tgts = await Promise.race([chooseTargets(text, src, name), new Promise(r => setTimeout(() => r(null), 1500))]); } catch {}
    openModal = om;
    const run = runEffects(text, {k, name, full:text, it, tgts:tgts || [], srcId:spell ? undefined : srcId, card:spell ? {id:srcId, k} : undefined, y22:1});
    await Promise.race([run, new Promise(r => setTimeout(r, 4000))]);
  } catch (e){ misses.push(String(text)); }
  finally { openModal = om; S = saved; UI.dry = null; Y22.busy = false; if (hadOpp) OPP.set(Y22.OPP, hadOpp); else OPP.delete(Y22.OPP); }
  return misses;
}
async function y22DryAll(text, k, name, kind, cl){
  const md = parseModes(text); if (!md) return y22Dry(text, k, name, kind, cl);
  const out = []; for (let i = 0; i < md.opts.length; i++) (await y22Dry(modeText(md, [i]), k, name, kind, cl)).forEach(x => out.includes(x) || out.push(x));
  return out;
}
async function y22Check(k){
  const a = info(k); const out = [];
  const faces = a.lay === 'split' && a.faces ? a.faces : a.lay === 'adventure' && a.faces ? [a, a.faces[1]] : a.back ? [a, a.back] : [a];
  for (const f of faces){
    const isSpell = /\b(instant|sorcery)\b/i.test(f.t || '');
    const lines = []; for (const x0 of tname(f.o, f.n).split('\n')){ const x = x0.trim(); if (!x) continue; if (/^•/.test(x) && lines.length) lines[lines.length - 1] += '\n' + x; else lines.push(x); }
    if (isSpell){
      const body = lines.filter(l => !keywordsOnly(l) && lineKind(l) !== 'trigger' && !(typeof spellKwSkip === 'function' && spellKwSkip(l))).join('\n');
      if (body){ const cs = counterSpec(tname(f.o, f.n)); (await y22DryAll(body.replace(/~/g, f.n), k, f.n, 'spell')).filter(t => !(cs && /^counter target/i.test(t))).forEach(t => out.push({kind:'effect', text:t})); }
      continue;
    }
    for (const l of lines){
      const kind = lineKind(l); const t = l.replace(/~/g, f.n);
      if (keywordsOnly(l)) continue;
      if (kind === 'modal'){ (await y22DryAll(t, k, f.n, 'ability')).forEach(x => out.push({kind:'effect', text:x, where:t})); continue; }
      if (kind === 'trigger') continue;   // triggers: below, the way the engine parsed them
      if (kind === 'chapter' || kind === 'loyalty' || kind === 'ability'){
        const eff = kind === 'chapter' ? l.replace(/^[IVX, ]+ — /, '') : l.slice(l.indexOf(':') + 1).trim();
        if (/^add\b/i.test(eff)) continue;
        (await y22DryAll(eff.replace(/~/g, f.n), k, f.n, kind === 'chapter' ? 'trigger' : 'ability', kind === 'chapter' ? {ev:'lore', subj:'self', ctl:'you'} : null)).forEach(x => out.push({kind:'effect', text:x, where:t}));
      }
    }
  }
  // triggers exactly as the engine reads them (trigsOf: event, subject, batch, effect)
  const flips = a.back ? [false, true] : [false];
  for (const fl of flips){ let ts = []; try { ts = trigsOf(k, fl) || []; } catch {}
    const nm = fl && a.back ? a.back.n : a.n;
    for (const t of ts){ if (!t || !t.eff) continue; if (t.raw && staticKnown(t.raw.replace(new RegExp(nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '~'))) continue;
      (await y22DryAll(String(t.eff).replace(/~/g, nm), k, nm, 'trigger', t)).forEach(x => out.push({kind:'effect', text:x, where:String(t.raw || t.eff).replace(/~/g, nm)})); } }
  return out;
}
{
  const cc = checkCard;
  checkCard = async function(k){
    const r = await cc(k);
    try {
      if (!r || !r.issues || String(k).startsWith('r26chk|') || !info(k) || Y22.busy) return r;
      const n0 = r.issues.length;
      for (const x of await y22Check(k)) if (!r.issues.some(y => y.text === x.text)) r.issues.push(x);
      if (r.issues.length > n0 && n0 === 0) r.ok = Math.max(0, (r.ok || 0) - 1);
    } catch (e){ console.warn('y22 check', e); }
    return r;
  };
}

/* ---------- the checker: a quoted trigger a spell grants ("Whenever this creature is dealt damage, put that many …") gets the amount its
   own event carries, not whatever the granting spell's context has (a spell has no event amount) ---------- */
{
  const q0 = l24checkQuoted;
  l24checkQuoted = async function(q, ctx){
    try { const m = String(q).trim().match(/^(when|whenever|at) (.+?), /i);
      if (m && ctx && ctx.it && ctx.it.evN == null){ const cl = l24classify(m[1], m[2]); if (cl && !Y22_NOAMT.has(cl.ev)) ctx = {...ctx, it:{...ctx.it, evN:2}}; } } catch {}
    return q0(q, ctx);
  };
}
