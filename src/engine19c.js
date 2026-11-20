/* ===================== Rules engine — round 19c: remaining gaps among the top 1,000 cards ===================== */
// mana-ability triggers already handled when the land is tapped (engine12): recognise their wording so the checker knows
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    if (/^enchanted (?:land|forest) is tapped for mana$/.test(c) || /^you tap an? (?:swamp|island|forest|mountain|plains) for mana$/.test(c) || /^(?:you tap a land|a player taps a land) for mana$/.test(c)) return {ev:'manaHandled', subj:'any', ctl:'you', desc:''};
    return ct(w, c);
  };
}
// Mox Diamond: discard a land or it goes to the graveyard; Chrome Mox: imprint a card and tap for its colors
{
  const oe = onEnter;
  onEnter = function(c, from, o){
    const r = oe(c, from, o);
    try { if (c && S.bf.includes(c) && !UI.dry){ const t = info(c.k)?.o || '';
      if (/if (?:this|~|mox diamond) would enter, you may discard a land card instead/i.test(tname(t, info(c.k)?.n))){ (async () => { const lands = S.hand.filter(x => isLand(x.k)); const ids = lands.length ? await pickCards({title:`${cname(c)}: discard a land card, or it goes to the graveyard`, cards:lands, min:0, max:1, noneLabel:'Don\'t discard'}) : []; if (ids && ids[0]){ UI.discarding = []; moveCard(ids[0], 'gy'); UI.discarding = null; } else { moveCard(c.id, 'gy'); log(`${cname(c)} went to the graveyard`); } commit(); })(); }
      if (/^imprint — when ~ enters, you may exile a nonartifact, nonland card from your hand/im.test(tname(t, info(c.k)?.n)) || /when (?:this artifact|~) enters, you may exile a nonartifact, nonland card from your hand/i.test(tname(t, info(c.k)?.n))){ (async () => { const list = S.hand.filter(x => !isLand(x.k) && !/Artifact/.test(info(x.k)?.t || '')); const ids = list.length ? await pickCards({title:`${cname(c)}: imprint — exile a nonartifact, nonland card from your hand`, cards:list, min:0, max:1, noneLabel:'Don\'t'}) : []; if (ids && ids[0]){ const x = S.hand.find(y => y.id === ids[0]); moveCard(x.id, 'ex'); c.imp = x.k; log(`${cname(c)} imprinted ${cname(x)}`); } commit(); })(); }
    } } catch (e){ console.warn(e); }
    return r;
  };
  const ma = manaAbs;
  manaAbs = function(c){ const out = ma(c); if (!c || !/exiled card's colors/i.test(info(c.k)?.o || '')) return out; const cols = (info(c.imp)?.c || '').split('').filter(x => /[WUBRG]/.test(x)); if (!cols.length) return out.filter(o => !/exiled card/i.test(o.line)); return out.map(o => /exiled card/i.test(o.line) ? {...o, outs:cols.map(x => [x]), eff:`Add one of ${cols.map(x => '{' + x + '}').join('')}`} : o); };
}
STATIC_RULES.push(
  [/^if ~ would enter, you may discard a land card instead$/, m => ({kind:'noop'})],
  [/^if you do, put ~ onto the battlefield$/, m => ({kind:'noop'})],
  [/^if you don't, put it into its owner's graveyard$/, m => ({kind:'noop'})],
  [/^if you would create a clue, food, or treasure token, instead create one of each$/, m => ({kind:'manufactor', who:'you'})],
  [/^if a triggered ability of another creature you control of the chosen type triggers, it triggers an additional time$/, m => ({kind:'throneTwice', who:'you'})],
  [/^each nonland card in your graveyard has escape$/, m => ({kind:'gyEscape', who:'you'})],
  [/^the escape cost is equal to the card's mana cost plus exile three other cards from your graveyard$/, m => ({kind:'noop'})],
  [/^if ~ is in your opening hand and you're not the starting player, you may begin the game with ~ on the battlefield with a luck counter on it$/, m => ({kind:'leyline', who:'you'})],
);
// Academy Manufactor
{
  const cft = createFromText;
  createFromText = async function(s, ctx){
    const m = String(s).match(/^create (a|an|one|two|three|\d+) (tapped )?(clue|food|treasure) tokens?$/i);
    if (m && S && rulesOn('manufactor').length && !(ctx && ctx.manuf)){ const n = wn(m[1].toLowerCase()) || 1; const c2 = {...(ctx || {}), manuf:true}; for (let i = 0; i < n; i++) for (const t of ['Clue', 'Food', 'Treasure']) await cft(`Create a ${m[2] || ''}${t} token`, c2); return; }
    return cft(s, ctx);
  };
}
// Roaming Throne: triggers of creatures of the chosen type happen twice
{
  const tm = trigMult;
  trigMult = function(ev, src){ let n = tm(ev, src); try { if (S && src && src.id != null){ const c = S.bf.find(x => x.id === src.id); if (c && isCreatureCard(c)) for (const th of S.bf.filter(x => x.ctype && /triggers, it triggers an additional time/i.test(info(x.k)?.o || '') && /of the chosen type/i.test(info(x.k)?.o || ''))) if (th.id !== c.id && new RegExp('\\b' + th.ctype + '\\b', 'i').test(typeOf(c))) n++; } } catch {} return n; };
}
// Underworld Breach: escape for every nonland card in your graveyard
{
  const go = gyOptions;
  gyOptions = function(c){ const r = go(c) || []; const a = info(c.k); if (a && S && !isLand(c.k) && rulesOn('gyEscape').length && !r.some(o => o.kind === 'escape')) r.push({kind:'escape', label:`Escape ${a.m} + exile three other cards`, mana:a.m, extra:[{t:'gyEx', n:3, label:'exile three other cards from your graveyard'}], after:''}); return r; };
}
// Gemstone Caverns uses the leyline button too
{
  const hi = r8HandItems;
  r8HandItems = function(c, zone){ let s = hi(c, zone); if (zone === 'hand' && S && /is in your opening hand and you're not the starting player, you may begin the game with/i.test(info(c.k)?.o || '') && phaseNow().n <= 1 && !s.includes('leyline')) s += `<button type="button" data-act="leyline" data-id="${c.id}"><span>Begin the game with it on the battlefield (not the starting player)</span></button>`; return s; };
}
async function doRound19cPre(s, l, ctx){
  let m; const tgts = () => { const o = []; let t; while (ctx.tgts && (t = nextTargets(ctx)[0])) o.push(t); return o; };
  // Victimize
  if ((m = l.match(/^choose two target creature cards in your graveyard$/))){ ctx.chosen2 = tgts(); return true; }
  if ((m = l.match(/^sacrifice a creature$/)) && ctx.chosen2){ const list = S.bf.filter(c => isCreatureCard(c)); const ids = list.length ? await pickCards({title:`${ctx.name}: sacrifice a creature`, cards:list, min:1, max:1}) : []; ctx.didPay = !!(ids && ids[0]); if (ctx.didPay) moveCard(ids[0], 'gy', {sac:true}); commit(); return true; }
  if ((m = l.match(/^if you do, return the chosen cards to the battlefield tapped$/))){ if (ctx.didPay) (ctx.chosen2 || []).forEach(t => { if (find(t.id)[0] === 'gy'){ moveCard(t.id, 'bf'); const c = S.bf.find(x => x.id === t.id); if (c) c.tap = true; } }); commit(); return true; }
  // Sylvan Library
  if ((m = l.match(/^you may draw two additional cards$/)) || (m = l.match(/^draw two additional cards$/))){ if (/you may/.test(l) && !UI.dry && !(await askYes(`${ctx.name}: draw two additional cards?`))){ ctx.mayYes = false; return true; } ctx.mayYes = true; const before = new Set(S.hand.map(c => c.id)); draw(2); ctx.sylvanNew = S.hand.filter(c => !before.has(c.id)).map(c => c.id); commit(); return true; }
  if ((m = l.match(/^if you do, choose two cards in your hand drawn this turn$/)) || (m = l.match(/^choose two cards in your hand drawn this turn$/))){ if (ctx.mayYes === false) return true; const drawn = S.hand.filter(c => (S.drawnIds || []).includes(c.id) || (ctx.sylvanNew || []).includes(c.id)); const ids = drawn.length <= 2 ? drawn.map(c => c.id) : await pickCards({title:`${ctx.name}: choose two cards drawn this turn`, cards:drawn, min:2, max:2}); ctx.sylvanPick = ids || []; return true; }
  if ((m = l.match(/^for each of those cards, pay (\d+) life or put the card on top of your library$/))){ for (const id of ctx.sylvanPick || []){ const c = S.hand.find(x => x.id === id); if (!c) continue; const v = UI.dry ? 'top' : await askChoice({title:`${ctx.name}: ${cname(c)} — pay ${m[1]} life or put it back on top?`, options:[{label:`Pay ${m[1]} life`, value:'life'}, {label:'Put it on top of your library', value:'top'}]}); if (v === 'life') S.life -= +m[1]; else { S.hand.splice(S.hand.indexOf(c), 1); S.lib.unshift(c); } } commit(); return true; }
  // Guardian Project
  if ((m = l.match(/^if it doesn't have the same name as another creature you control or a creature card in your graveyard, draw a card$/))){ const id = ctx.it && ctx.it.evId; const c = id != null && S.bf.find(x => x.id === id); if (c){ const nm = info(c.k)?.n; const dup = S.bf.some(x => x.id !== c.id && isCreatureCard(x) && info(x.k)?.n === nm) || S.gy.some(x => isCreatureCard(x) && info(x.k)?.n === nm); if (!dup) draw(1); } commit(); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound19cPre(s, l, ctx)) return; return ds(s0, ctx); };
  // remember which cards were drawn this turn (Sylvan Library)
  const dr = draw;
  draw = function(n = 1){ const before = S ? new Set(S.hand.map(c => c.id)) : null; const r = dr(n); try { if (S){ if (S.drawnIdsT !== turnStr()){ S.drawnIds = []; S.drawnIdsT = turnStr(); } S.hand.forEach(c => { if (!before.has(c.id)) S.drawnIds.push(c.id); }); } } catch {} return r; };
}
