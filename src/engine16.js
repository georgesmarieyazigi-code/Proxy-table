/* ===================== Rules engine — round 16: general readers for bounce, copies, delayed returns, searches ===================== */
async function doRound16Pre(s, l, ctx){
  let m; const src = () => srcCardOf(ctx); const say = t => doSentence(cap(t), ctx); const tgts = () => { const o = []; let t; while (ctx.tgts && (t = nextTargets(ctx)[0])) o.push(t); return o; };
  if (/^then /.test(l)){ const r = await doRound16Pre(s.slice(5), l.slice(5), ctx); if (r) return true; }
  // bounce
  if ((m = l.match(/^return (?:another |two |up to (?:one|two) )?target (?:nonland permanent|creature|permanent|creatures|nonland permanents|artifact|enchantment)s? (?:you control )?to (?:its|their) owners?'s? hands?$/))){ tgts().forEach(t => { if (t.pid === MYPID){ if (find(t.id)[0] === 'bf') moveCard(t.id, 'hand'); } else applyTo(t, {op:'bounce', src:ctx.name}); }); commit(); return true; }
  if ((m = l.match(/^return (?:a|another) (creature|permanent|land|artifact) you control to its owner's hand$/))){ const d = m[1]; const list = S.bf.filter(c => descOk(c.k, d, {tok:c.tok}) && c.id !== (/another/.test(l) ? ctx.srcId : -1)); if (!list.length) return true; const ids = list.length === 1 ? [list[0].id] : await pickCards({title:`${ctx.name}: return a ${d} you control to your hand`, cards:list, min:1, max:1}); if (ids && ids[0]) moveCard(ids[0], 'hand'); commit(); return true; }
  if ((m = l.match(/^return (?:those creatures|them) to their owners' hands$/))){ (ctx.lastT || []).forEach(t => { if (t.pid === MYPID) moveCard(t.id, 'hand'); else applyTo(t, {op:'bounce', src:ctx.name}); }); commit(); return true; }
  if ((m = l.match(/^return each creature your opponents control with toughness (\d+) or less to its owner's hand$/))){ for (const [pid, st] of OPP) (st.bf || []).forEach(c => { if (c.k && isCreatureCard(c) && (parseInt(info(c.k)?.t) || 0) + (c.cp || 0) - (c.cm || 0) <= +m[1]) applyTo({t:'card', pid, id:c.id, k:c.k}, {op:'bounce', src:ctx.name}); }); return true; }
  // copies of my permanents
  if ((m = l.match(/^create (a|two|three|four|five|x|\d+) tokens? that (?:is a|are|'s a|are copies of|is a copy of) cop(?:y|ies) of (?:another )?target (nonlegendary )?(creature|nonland permanent|token|artifact or creature) you control(?:, except (?:it has|they have) haste)?$/)) || (m = l.match(/^create (a|two|three|four|five|x|\d+) tokens? that(?:'s| are) (?:a )?cop(?:y|ies) of (?:another )?target (nonlegendary )?(creature|nonland permanent|token|artifact or creature) you control(?:, except (?:it has|they have) haste)?$/))){
    const n = m[1] === 'x' ? (ctx.it && ctx.it.x) || 0 : (wn(m[1]) || 1); const t = tgts()[0]; const c = t && t.pid === MYPID && S.bf.find(x => x.id === t.id); if (!c) return true; const before = new Set(S.bf.map(x => x.id));
    await createToken(c.k, n); const made = S.bf.filter(x => !before.has(x.id) || (x.k === c.k && x.tok)); if (/haste/.test(l)) made.forEach(x => { x.ekw = [...new Set([...(x.ekw || []), 'haste'])]; }); ctx.lastTok = made.map(x => x.id); commit(); return true; }
  if ((m = l.match(/^create a token that's a copy of (enchanted|equipped) (artifact|creature)$/))){ const sc = src(); const h = sc && sc.att && S.bf.find(x => x.id === sc.att.id); if (h) await createToken(h.k, 1); commit(); return true; }
  // delayed returns
  if ((m = l.match(/^return (?:that card|it|that creature|~) to (?:the battlefield|its owner's hand|your hand|the command zone)(?: under its owner's control)? at the beginning of the next end step$/)) || (m = l.match(/^return ~ to the battlefield at the beginning of the next end step$/))){
    const where = /hand/.test(l) ? 'hand' : /command/.test(l) ? 'cz' : 'bf'; const id = /~/.test(l) ? ctx.srcId : ((ctx.lastT || [])[0] || {}).id ?? (ctx.it && ctx.it.evId);
    if (id != null){ S.dly.push({id:rid(6), eff:`(delayed) return to ${where}`, k:ctx.k, nm:ctx.name, srcId:id, op:'r16ret', where}); log(`${ctx.name}: returns at the next end step`); commit(); } return true; }
  if ((m = l.match(/^sacrifice (?:the creature|it|that creature|them) at the beginning of the next end step$/))){ const ids = (ctx.lastT || []).map(t => t.id).concat(ctx.lastTok || []).concat(ctx.lastPut || []); ids.forEach(id => S.dly.push({id:rid(6), eff:'Sacrifice it.', k:ctx.k, nm:ctx.name, srcId:id, op:'sac'})); commit(); return true; }
  if ((m = l.match(/^put a creature card from your hand onto the battlefield$/))){ const list = S.hand.filter(c => isCreatureCard(c)); if (!list.length) return true; const ids = await pickCards({title:`${ctx.name}: put a creature card onto the battlefield`, cards:list, min:0, max:1}); if (ids && ids[0]){ moveCard(ids[0], 'bf'); const c = S.bf.find(x => x.id === ids[0]); if (c){ c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; ctx.lastPut = [c.id]; } } commit(); return true; }
  if ((m = l.match(/^that creature gains haste(?: until end of turn)?$/)) && ctx.lastPut){ ctx.lastPut.forEach(id => { const c = S.bf.find(x => x.id === id); if (c) c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; }); commit(); return true; }
  // searches with odd shapes
  if ((m = l.match(/^search your library for (?:up to )?(a|an|two|three|four|\d+) (basic land|land|plains|island|swamp|mountain|forest) cards?(?: with different names)?(?: and reveal (?:it|them))?$/)) && !/put/.test(l)){ const rest = String(ctx.full || '').toLowerCase(); await searchLibrary(`${m[1] === 'a' || m[1] === 'an' ? '' : 'up to ' + m[1] + ' '}${m[2]}`.trim(), /onto the battlefield/.test(rest) ? (/tapped/.test(rest) ? 'put it onto the battlefield tapped' : 'put it onto the battlefield') : 'put it into your hand', ctx); ctx.looked = true; return true; }
  if ((m = l.match(/^search your library (?:and\/or graveyard )?for an? ((?:non-human )?creature) card with mana value x or less and put it onto the battlefield$/))){ const x = (ctx.it && ctx.it.x) || 0; await searchLibrary(`${m[1]} with mana value ${x} or less`, 'put it onto the battlefield', ctx); return true; }
  if ((m = l.match(/^search target opponent's library for an? (creature|artifact)? ?card and put that card onto the battlefield under your control$/))){ handWarn(s + ' (ask them to show you their library)', ctx); return true; }
  // draw variants
  if ((m = l.match(/^draw x cards, where x is (.+)$/))){ let n = countOf(m[1], ctx); if (n == null && /that creature's power/.test(m[1])){ const t = (ctx.lastT || [])[0]; const c = t && S.bf.find(x => x.id === t.id) || ctx.sacd; n = c ? Math.max(0, (S.bf.includes(c) ? stats(c)[0] : parseInt(info(c.k)?.p) || 0)) : 0; } if (n == null) return false; if (n) draw(n); commit(); return true; }
  if ((m = l.match(/^draw a card for each (.+)$/))){ const n = countOf(m[1], ctx); if (n == null) return false; if (n) draw(n); commit(); return true; }
  if ((m = l.match(/^draw an additional card$/))){ draw(1); commit(); return true; }
  if ((m = l.match(/^draw a card if your life total is greater than your starting life total$/))){ if (S.life > (FMT[S.fmt]?.life || 40)) draw(1); commit(); return true; }
  // destroy variants
  if ((m = l.match(/^destroy x target (.+)$/))){ tgts().forEach(t => applyTo(t, {op:'destroy', src:ctx.name})); return true; }
  if ((m = l.match(/^destroy the (?:rest|chosen creatures)$/))){ handWarn(s, ctx); return true; }
  // mass returns from graveyard
  if ((m = l.match(/^return all (.+?) cards (?:with (?:mana value|power) (x|\d+) or less )?from your graveyard to (the battlefield|your hand)$/))){ const d = sing(m[1]); const lim = m[2] ? (m[2] === 'x' ? (ctx.it && ctx.it.x) || 0 : +m[2]) : null; S.gy.filter(c => descOk(c.k, d) && (lim == null || (/power/.test(l) ? (parseInt(info(c.k)?.p) || 0) : (info(c.k)?.mv || 0)) <= lim)).forEach(c => moveCard(c.id, /hand/.test(m[3]) ? 'hand' : 'bf')); commit(); return true; }
  if ((m = l.match(/^return target creature card with (?:mana value|power) (x|\d+)(?: or less)? from your graveyard to the battlefield$/))){ const t = tgts()[0]; if (t && find(t.id)[0] === 'gy') moveCard(t.id, 'bf'); commit(); return true; }
  // tutor + cast
  if ((m = l.match(/^sacrifice that creature unless you pay an amount of \{c\} equal to its mana value$/))) return false;
  if ((m = l.match(/^return it to its owner's hand$/)) && ctx.srcId != null){ const [z] = find(ctx.srcId); if (z === 'gy' || z === 'ex') moveCard(ctx.srcId, 'hand'); else if (z === 'bf' && !(ctx.lastT || []).length) moveCard(ctx.srcId, 'hand'); else if ((ctx.lastT || [])[0]){ const t = ctx.lastT[0]; if (t.pid === MYPID) moveCard(t.id, 'hand'); else applyTo(t, {op:'bounce', src:ctx.name}); } commit(); return true; }
  if ((m = l.match(/^sacrifice it$/)) && ctx.srcId != null){ const [z] = find(ctx.srcId); if (z === 'bf') moveCard(ctx.srcId, 'gy', {sac:true}); commit(); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){
    const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase();
    if (l && await doRound16Pre(s, l, ctx)) return;
    return ds(s0, ctx);
  };
  const rt = resolveTop;
  resolveTop = async function(it, ...a){
    if (it && it.dop === 'r16ret'){ const [z] = find(it.srcId); if (z && z !== it.where){ if (it.where === 'cz'){ const c = find(it.srcId)[2]; const zone = S[z]; zone.splice(zone.indexOf(c), 1); S.cz.push(c); } else moveCard(it.srcId, it.where); log(`${it.nm}: returned`); } S.stk = S.stk.filter(x => x !== it); commit(); return; }
    return rt(it, ...a);
  };
}
