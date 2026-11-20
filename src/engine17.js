/* ===================== Rules engine — round 17: single-line gaps on the most-played cards ===================== */
async function doRound17Pre(s, l, ctx){
  let m; const src = () => srcCardOf(ctx); const say = t => doSentence(cap(t), ctx); const tgt = () => (ctx.tgts ? nextTargets(ctx) : [])[0];
  if (/^then /.test(l)){ const r = await doRound17Pre(s.slice(5), l.slice(5), ctx); if (r) return true; }
  if ((m = l.match(/^at the beginning of that turn's end step, you lose the game$/))){ handWarn('You lose the game at the end of the extra turn (Final Fortune)', ctx); return true; }
  if ((m = l.match(/^attach target (aura or equipment|equipment) you control to target creature you control$/))){ const a = tgt(), b = tgt(); const e = a && S.bf.find(x => x.id === a.id); if (e && b){ e.att = {pid:b.pid, id:b.id}; commit(); } return true; }
  if ((m = l.match(/^you gain life equal to the damage dealt this way$/))){ const n = ctx.dmgDealt || 0; if (n) gainLife(n, ctx.name); commit(); return true; }
  if ((m = l.match(/^tap (enchanted|equipped) creature$/))){ const sc = src(); if (sc && sc.att){ if (sc.att.pid === MYPID){ const h = S.bf.find(x => x.id === sc.att.id); if (h) h.tap = true; } else applyTo({t:'card', pid:sc.att.pid, id:sc.att.id}, {op:'tap', src:ctx.name}); } commit(); return true; }
  if ((m = l.match(/^untap (enchanted|equipped) creature$/))){ const sc = src(); if (sc && sc.att){ if (sc.att.pid === MYPID){ const h = S.bf.find(x => x.id === sc.att.id); if (h){ h.tap = false; h.tn = 0; } } else applyTo({t:'card', pid:sc.att.pid, id:sc.att.id}, {op:'untap', src:ctx.name}); } commit(); return true; }
  if ((m = l.match(/^target opponent loses life equal to ~'s (power|toughness)$/))){ const c = src(); const t = tgt(); const n = c ? Math.max(0, stats(c)[m[1] === 'power' ? 0 : 1]) : 0; if (t && n) loseLife(t.pid, n, ctx.name); return true; }
  if ((m = l.match(/^each opponent loses life equal to the sacrificed creature's power$/))){ const c = ctx.sacd; const n = c ? Math.max(0, (parseInt(info(c.k)?.p) || 0) + (c.cp || 0) - (c.cm || 0)) : 0; opponents().forEach(p => loseLife(p.pid, n, ctx.name)); return true; }
  if ((m = l.match(/^if it was a creature card, put a \+1\/\+1 counter on ~ and you gain (\d+) life$/))){ const t = (ctx.lastT || [])[0]; if (t && t.k && /Creature/.test(info(t.k)?.t || '')){ const c = src(); if (c) modCounters(c, 'cp', 1); gainLife(+m[1], ctx.name); } commit(); return true; }
  if ((m = l.match(/^if it was a permanent card, put a \+1\/\+1 counter on ~$/))){ const t = (ctx.lastT || [])[0]; if (t && t.k && isPermType(info(t.k)?.t)){ const c = src(); if (c) modCounters(c, 'cp', 1); } commit(); return true; }
  if ((m = l.match(/^tap all creatures your opponents control$/))){ for (const [pid, st] of OPP) (st.bf || []).forEach(c => { if (c.k && isCreatureCard(c)) applyTo({t:'card', pid, id:c.id, k:c.k}, {op:'tap', src:ctx.name}); }); return true; }
  if ((m = l.match(/^if you have (\d+) or more life, you win the game$/))){ if (S.life >= +m[1]){ log(`🏆 ${ctx.name}: wins the game!`); toast('You win the game!'); } return true; }
  if ((m = l.match(/^up to (x|one|two|three) target creatures? phases? out$/))){ handWarn(s, ctx); return true; }
  if ((m = l.match(/^(\w+s) you control get \+(\d+)\/\+(\d+) and gain (.+?) until end of turn$/))){ const d = sing(m[1]); const kws = m[4].split(/,\s*(?:and\s+)?|\s+and\s+/); S.bf.filter(c => isCreatureCard(c) && descOk(c.k, d, {tok:c.tok})).forEach(c => { c.pu = [(c.pu ? c.pu[0] : 0) + +m[2], (c.pu ? c.pu[1] : 0) + +m[3]]; c.ekw = [...new Set([...(c.ekw || []), ...kws])]; }); commit(); return true; }
  if ((m = l.match(/^regenerate (each creature you control|target creature|~)$/))){ const list = /each/.test(m[1]) ? S.bf.filter(c => isCreatureCard(c)) : m[1] === '~' ? [src()] : [tgt()].filter(Boolean).map(t => S.bf.find(x => x.id === t.id)); list.filter(Boolean).forEach(c => { c.regen = (c.regen || 0) + 1; }); commit(); return true; }
  if ((m = l.match(/^draw a card and repeat this process$/))){ draw(1); commit(); return true; }
  if ((m = l.match(/^target creature you control gains (firebending \d+|[a-z ]+?) until end of turn$/))){ const t = tgt(); if (t) applyTo(t, {op:'pump', src:ctx.name, f:{p:0, t:0, kw:[m[1]]}}); return true; }
  if ((m = l.match(/^if you attacked this turn, (.+)$/))){ if ((S.ev || []).some(e => e.type === 'attack')) await say(s.slice(s.length - m[1].length)); return true; }
  if ((m = l.match(/^if you have (\w+) or more creature cards in your graveyard, (.+)$/))){ if (S.gy.filter(c => isCreatureCard(c)).length >= (wn(m[1]) || 4)) await say(s.slice(s.length - m[2].length)); return true; }
  if ((m = l.match(/^for each nontoken creature destroyed this way, you create a tapped treasure token$/))){ const n = ctx.destroyedN || 0; for (let i = 0; i < n; i++) await createFromText('Create a tapped Treasure token', ctx); return true; }
  if ((m = l.match(/^put a \+1\/\+1 counter on ~ and untap it$/))){ const c = src(); if (c){ modCounters(c, 'cp', 1); c.tap = false; commit(); } return true; }
  if ((m = l.match(/^if ~ has fewer than (\w+) \+1\/\+1 counters on it, put a \+1\/\+1 counter on ~$/))){ const c = src(); if (c && (c.cp || 0) < (wn(m[1]) || 3)) modCounters(c, 'cp', 1); commit(); return true; }
  if ((m = l.match(/^~ can't be blocked this turn except by creatures with haste$/))){ const c = src(); if (c){ c.ekw = [...new Set([...(c.ekw || []), 'evasive'])]; commit(); } return true; }
  if ((m = l.match(/^double the number of each kind of counter on any number of target permanents$/))){ let t; while (ctx.tgts && (t = nextTargets(ctx)[0])){ const c = t.pid === MYPID && S.bf.find(x => x.id === t.id); if (c){ if (c.cp) modCounters(c, 'cp', c.cp); if (c.cm) modCounters(c, 'cm', c.cm); if (c.co) c.co *= 2; if (c.lore) c.lore *= 2; Object.keys(c.nc || {}).forEach(k => addNamed(c, k, c.nc[k])); } } commit(); return true; }
  if ((m = l.match(/^tap or untap target (creature|permanent|land)$/))){ const t = tgt(); if (!t) return true; const c = t.pid === MYPID && S.bf.find(x => x.id === t.id); const v = UI.dry ? 'tap' : await askChoice({title:`${ctx.name}: tap or untap?`, options:[{label:'Tap', value:'tap'}, {label:'Untap', value:'untap'}]}); if (c){ c.tap = v === 'tap'; if (!c.tap) c.tn = 0; } else applyTo(t, {op:v, src:ctx.name}); commit(); return true; }
  if ((m = l.match(/^put a permanent card with mana value less than or equal to the number of lands you control from your hand onto the battlefield( tapped)?$/))){ const n = S.bf.filter(c => isLand(c.k)).length; const list = S.hand.filter(c => isPermType(info(c.k)?.t) && (info(c.k)?.mv || 0) <= n); if (!list.length) return true; const ids = await pickCards({title:`${ctx.name}: permanent with mana value ${n} or less`, cards:list, min:0, max:1}); if (ids && ids[0]){ moveCard(ids[0], 'bf'); const c = S.bf.find(x => x.id === ids[0]); if (c && m[1]) c.tap = true; } commit(); return true; }
  if ((m = l.match(/^target (artifact or creature|permanent|creature) gains hexproof and indestructible until end of turn$/))){ const t = tgt(); if (t) applyTo(t, {op:'pump', src:ctx.name, f:{p:0, t:0, kw:['hexproof', 'indestructible']}}); return true; }
  if ((m = l.match(/^until end of turn, target creature gains trample and gets \+1\/\+0 for each card you've drawn this turn$/))){ const t = tgt(); const n = S.drawnT === turnStr() ? S.drawn || 0 : 0; if (t) applyTo(t, {op:'pump', src:ctx.name, f:{p:n, t:0, kw:['trample']}}); return true; }
  if ((m = l.match(/^until end of turn, ~ gets \+(\d+)\/\+(\d+) and gains (.+)$/))){ const c = src(); if (c){ c.pu = [(c.pu ? c.pu[0] : 0) + +m[1], (c.pu ? c.pu[1] : 0) + +m[2]]; c.ekw = [...new Set([...(c.ekw || []), ...m[3].split(/,\s*(?:and\s+)?|\s+and\s+/)])]; commit(); } return true; }
  if ((m = l.match(/^~ becomes an? (\d+)\/(\d+) creature with all creature types until end of turn$/))){ const c = src(); if (c){ c.anim = 'crew'; c.animPT = [+m[1], +m[2]]; c.allTypes = turnStr(); commit(); } return true; }
  if ((m = l.match(/^proliferate (twice|three times)$/))){ const n = m[1] === 'twice' ? 2 : 3; for (let i = 0; i < n; i++) await say('Proliferate'); return true; }
  if ((m = l.match(/^if you created a token this turn, draw a card$/))){ if ((S.ev || []).some(e => e.type === 'enter' && e.tok)) draw(1); commit(); return true; }
  if ((m = l.match(/^draw a card for each aura you control that's attached to a creature$/))){ const n = S.bf.filter(a => /Aura/.test(typeOf(a)) && a.att).length; if (n) draw(n); commit(); return true; }
  if ((m = l.match(/^exile target creature card with mana value x from your graveyard$/))){ const t = tgt(); if (t && find(t.id)[0] === 'gy'){ moveCard(t.id, 'ex'); ctx.lastT = [t]; } commit(); return true; }
  if ((m = l.match(/^put a commander you own from the command zone onto the battlefield$/))){ const c = S.cz.find(x => x.cmd) || S.cz[0]; if (c){ S.cz.splice(S.cz.indexOf(c), 1); S.hand.push(c); moveCard(c.id, 'bf'); ctx.lastT = [{t:'card', pid:MYPID, id:c.id, k:c.k}]; } commit(); return true; }
  if ((m = l.match(/^return it to the command zone at the beginning of the next end step$/))){ const t = (ctx.lastT || [])[0]; if (t) S.dly.push({id:rid(6), eff:'(delayed) return to the command zone', k:ctx.k, nm:ctx.name, srcId:t.id, op:'r16ret', where:'cz'}); commit(); return true; }
  if ((m = l.match(/^creatures don't untap during their controllers' untap steps$/))) return false;
  if ((m = l.match(/^(?:that token|it) gains haste until end of turn and attacks this combat if able$/))){ (ctx.lastTok || []).forEach(id => { const c = S.bf.find(x => x.id === id); if (c) c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; }); commit(); return true; }
  if ((m = l.match(/^(?:target opponent|target player) gains control of ~$/))){ handWarn(`${s} (give it with the card's menu)`, ctx); return true; }
  if ((m = l.match(/^~ deals (\d+) damage to each of your opponents$/))){ opponents().forEach(p => dealDamage({t:'player', pid:p.pid}, +m[1], ctx.k, src())); return true; }
  if ((m = l.match(/^artifacts you control become artifact creatures with base power and toughness (\d+)\/(\d+) until end of turn$/))){ S.bf.filter(c => /Artifact/.test(typeOf(c))).forEach(c => { c.anim = 'crew'; c.animPT = [+m[1], +m[2]]; }); commit(); return true; }
  if ((m = l.match(/^each noncreature artifact you control becomes an? (\d+)\/(\d+) artifact creature until end of turn$/))){ S.bf.filter(c => /Artifact/.test(typeOf(c)) && !isCreatureCard(c)).forEach(c => { c.anim = 'crew'; c.animPT = [+m[1], +m[2]]; }); commit(); return true; }
  if ((m = l.match(/^(?:you )?draw x cards and lose x life, where x is (.+)$/))){ const n = countOf(m[1], ctx) ?? await numOf('x', ctx, m[1]); if (n){ draw(n); S.life -= n; } commit(); return true; }
  if ((m = l.match(/^return x target nonlegendary cards from your graveyard to your hand$/))){ let t; while (ctx.tgts && (t = nextTargets(ctx)[0])) if (find(t.id)[0] === 'gy') moveCard(t.id, 'hand'); commit(); return true; }
  if ((m = l.match(/^it doesn't untap during its controller's next untap step$/))){ const t = (ctx.lastT || [])[0]; if (t && t.pid === MYPID){ const c = S.bf.find(x => x.id === t.id); if (c) c.skipUntap = 1; } return true; }
  if ((m = l.match(/^exile another target permanent you control, then return that card to the battlefield under its owner's control$/)) || (m = l.match(/^exile another target permanent you control$/))){ const t = tgt(); if (t && t.pid === MYPID){ moveCard(t.id, 'ex'); moveCard(t.id, 'bf'); } commit(); return true; }
  if ((m = l.match(/^return any number of permanent cards with different names from your graveyard to the battlefield$/))){ const list = S.gy.filter(c => isPermType(info(c.k)?.t)); const ids = await pickCards({title:`${ctx.name}: permanent cards with different names`, cards:list, min:0, max:list.length}); const seen = new Set(); (ids || []).forEach(id => { const c = S.gy.find(x => x.id === id); if (c && !seen.has(info(c.k)?.n)){ seen.add(info(c.k)?.n); moveCard(id, 'bf'); } }); commit(); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){
    const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase();
    if (l && await doRound17Pre(s, l, ctx)) return;
    return ds(s0, ctx);
  };
  // “it doesn't untap during its controller's next untap step”, Intruder Alarm
  const sp = setPhase;
  setPhase = function(i){ const skip = i === 0 && S ? S.bf.filter(c => c.skipUntap).map(c => [c, c.tap]) : []; const alarm = i === 0 && S && boardsAll().some(b => b.bf.some(x => x.k && /^creatures don't untap during their controllers' untap steps/im.test(info(x.k)?.o || ''))); const before = alarm ? S.bf.filter(c => isCreatureCard(c)).map(c => [c, c.tap]) : [];
    const r = sp(i); skip.forEach(([c, t]) => { c.tap = t; c.skipUntap = 0; }); before.forEach(([c, t]) => { c.tap = t; }); return r; };
}
STATIC_RULES.push(
  [/^creatures don't untap during their controllers' untap steps$/, m => ({kind:'noop'})],
  [/^untap all creatures you control during each other player's untap step$/, m => ({kind:'crSeedborn', who:'you'})],
  [/^each nonland permanent you control is all colors$/, m => ({kind:'noop'})],
  [/^if a creature you control would deal damage to a permanent or player, it deals double that damage instead$/, m => ({kind:'crDmgX2', who:'you'})],
  [/^if a source you control would deal noncombat damage to an opponent or a permanent an opponent controls, it deals that much damage plus (\d+) instead$/, m => ({kind:'noop'})],
);
{
  const tc = turnChanged;
  turnChanged = function(...a){ const r = tc.apply(this, a); try { if (S && currentTurn()[1] !== MYPID && rulesOn('crSeedborn').length) S.bf.forEach(c => { if (isCreatureCard(c)){ c.tap = false; c.tn = 0; } }); } catch {} return r; };
  const dd = dealDamage;
  dealDamage = function(t, n, srcK, srcCard, extra){ if (S && n > 0 && srcCard && S.bf.includes(srcCard) && isCreatureCard(srcCard) && rulesOn('crDmgX2').length) n *= 2; if (UI.curCtx) UI.curCtx.dmgDealt = (UI.curCtx.dmgDealt || 0) + n; return dd(t, n, srcK, srcCard, extra); };
}
