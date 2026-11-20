/* ===================== Rules engine — round 13 ===================== */

/* ---------- Hand abilities: channel and other “Discard this card:” abilities ---------- */
function handAbilities(c){
  const f = info(c.k); if (!f) return []; const out = [];
  for (const raw of tname(f.o, f.n).split('\n')){ const m = raw.trim().match(/^((?:\{[^}]+\})*(?:, )?discard ~):\s*([\s\S]+)$/i); if (m && !/cycling/i.test(raw)) out.push({cost:m[1], eff:m[2]}); }
  return out;
}
async function useHandAbility(c, ab){
  const nm = cname(c); let eff = ab.eff; const mana = (ab.cost.match(/\{[^}]+\}/g) || []).join('');
  let cost = parseCost(mana || '{0}'); const red = eff.match(/this ability costs \{(\d+)\} less to activate for each (.+?) you control/i);
  if (red){ const n = (countOf(red[2] + ' you control', {k:c.k}) || 0) * +red[1]; cost.gen = Math.max(0, cost.gen - n); eff = eff.replace(/this ability costs \{\d+\} less to activate for each .+? you control\.?/i, '').trim(); }
  let tgts = null; if (targetSpecs(eff).length){ tgts = await chooseTargets(eff, {pid:MYPID, col:info(c.k)?.c, types:info(c.k)?.t, id:c.id}, nm); if (tgts == null) return; }
  const plan = payPlan(cost, S.pool); if (plan.err){ toast(`Not enough mana (${plan.err})`); return; }
  S.pool = plan.pool; UI.discarding = []; moveCard(c.id, 'gy'); UI.discarding = null;
  const it = {sid:rid(6), o:nextO(), kind:'ability', k:c.k, nm, txt:eff, srcId:c.id, tgts, tgtNm:tgtLabel(tgts)};
  S.stk.push(it); S.pass = 's:' + it.sid; log(`activated ${nm} from hand: ${short(eff, 80)}`); commit();
}
{
  const hi = r8HandItems;
  r8HandItems = function(c, zone){ let s = hi(c, zone); if (zone === 'hand' && S) handAbilities(c).forEach((ab, i) => { s += `<button type="button" data-act="handAb" data-id="${c.id}" data-i="${i}"><span>${manaHTML(ab.cost.replace(/,? ?discard ~/i, ''))} discard: ${esc(short(ab.eff, 50))}</span></button>`; }); return s; };
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-act="handAb"]'); if (!b || !S) return; const c = S.hand.find(x => x.id === +b.dataset.id); if (!c) return; const ab = handAbilities(c)[+b.dataset.i]; closeMenu(); if (ab) useHandAbility(c, ab); }, true);
}

/* ---------- Gods: not a creature unless devotion is high enough ---------- */
{
  const ic = isCreatureCard;
  isCreatureCard = c => { const r = ic(c); if (!r || !c || !c.k || !S) return r; const o = info(c.k)?.o || ''; const m = o.match(/as long as your devotion to (white|blue|black|red|green)(?: and (white|blue|black|red|green))? is less than (\w+), [^,.]+ isn't a creature/i); if (m && S.bf.includes(c)){ const need = wn(m[3].toLowerCase()) || ({five:5, seven:7}[m[3].toLowerCase()]); if (devotion([m[1], m[2]].filter(Boolean).map(x => x.toLowerCase())) < need) return false; } return r; };
}
STATIC_KNOWN.push(/^as long as your devotion to [a-z ]+ is less than \w+, ~ isn't a creature$/, /^~ enters tapped\. as it enters, choose a color(?: other than \w+)?$/, /^as ~ enters, choose a color$/);
// lands that choose a color as they enter
{
  const oe = onEnter;
  onEnter = function(c, from, o){ const r = oe(c, from, o); try { if (c && S.bf.includes(c) && /as (?:it|~|this land) enters, choose a color/i.test(tname(info(c.k)?.o || '', info(c.k)?.n)) && !UI.dry && !c.col){ (async () => { const v = await askChoice({title:`${cname(c)}: choose a color`, options:['W', 'U', 'B', 'R', 'G'].map(x => ({label:`{${x}}`, value:x}))}); c.col = v || 'G'; log(`${cname(c)}: chose {${c.col}}`); commit(); })(); } } catch {} return r; };
  const ma = manaAbs;
  manaAbs = function(c){ const out = ma(c); if (!c || !c.col) return out; return out.map(o => /chosen color/i.test(o.line) ? {...o, outs:[[c.col]], eff:`Add {${c.col}}`} : o); };
}

/* ---------- Upkeep draws and other “at the beginning of the next turn's upkeep” ---------- */
{
  const fs = fireSteps;
  fireSteps = function(step, activePid){ fs(step, activePid); if (step === 'upkeep' && (S.upDraw || []).length){ const list = S.upDraw.splice(0); list.forEach(d => { if (d.pid === MYPID) draw(d.n); else sendRq(d.pid, 'draw', d.n, d.src); log(`${d.src}: ${d.pid === MYPID ? 'drew' : nameOf(d.pid) + ' draws'} ${d.n}`); }); commit(); } };
}

/* ---------- Effects ---------- */
async function doRound13Pre(s, l, ctx){
  let m; const src = () => srcCardOf(ctx); const say = t => doSentence(cap(t), ctx); const tgt = () => (ctx.tgts ? nextTargets(ctx) : [])[0];
  if (/^then /.test(l)){ const r = await doRound13Pre(s.slice(5), l.slice(5), ctx); if (r) return true; }
  if ((m = l.match(/^(you|its controller) (?:may )?draws? (a card|up to two cards|two cards) at the beginning of the next turn's upkeep$/))){ const pid = m[1] === 'you' ? MYPID : ((ctx.lastT || [])[0] || {}).pid; const n = /two/.test(m[2]) ? 2 : 1; if (pid){ S.upDraw = (S.upDraw || []).concat({pid, n, src:ctx.name}); log(`${ctx.name}: ${pid === MYPID ? 'you draw' : nameOf(pid) + ' draws'} ${n} at the next upkeep`); commit(); } return true; }
  if ((m = l.match(/^draw a card at the beginning of the next turn's upkeep$/))){ S.upDraw = (S.upDraw || []).concat({pid:MYPID, n:1, src:ctx.name}); commit(); return true; }
  if ((m = l.match(/^look at the top card of target player's library$/))){ const t = tgt(); if (!t || t.pid === MYPID){ const c = S.lib[0]; if (c && !UI.dry) await pickCards({title:`${ctx.name}: top of your library`, cards:[c], min:0, max:0, noneLabel:'OK'}); } else handWarn(`Look at the top card of ${nameOf(t.pid)}'s library (ask them)`, ctx); return true; }
  // flashback for a turn
  if ((m = l.match(/^(target instant or sorcery card in your graveyard|each instant and sorcery card in your graveyard) gains flashback until end of turn$/))){ const ids = /^target/.test(m[1]) ? [tgt()].filter(Boolean).map(t => t.id) : S.gy.filter(c => /\b(Instant|Sorcery)\b/.test(info(c.k)?.t || '')).map(c => c.id); S.gyOk = (S.gyOk || []).concat(ids.map(id => ({id, t:turnStr(), ex:true}))); log(`${ctx.name}: ${ids.length} card${ids.length === 1 ? '' : 's'} gain flashback this turn`); commit(); return true; }
  if (/^the flashback cost is equal to (?:its|that card's) mana cost$/.test(l)) return true;
  // reanimation with counters
  if ((m = l.match(/^return target (nonlegendary )?creature card from your graveyard to the battlefield with an? (-1\/-1|\+1\/\+1) counter on it$/))){ const t = tgt(); if (t && find(t.id)[0] === 'gy'){ moveCard(t.id, 'bf'); const c = S.bf.find(x => x.id === t.id); if (c) modCounters(c, m[2] === '+1/+1' ? 'cp' : 'cm', 1); } commit(); return true; }
  if ((m = l.match(/^return it to the battlefield under its owner's control with an? (flying|\+1\/\+1|-1\/-1) counter on it$/))){ const id = ctx.it && ctx.it.evId; if (id != null && find(id)[0] === 'gy'){ moveCard(id, 'bf'); const c = S.bf.find(x => x.id === id); if (c){ if (m[1] === 'flying') addNamed(c, 'flying', 1), c.ekwp = [...new Set([...(c.ekwp || []), 'flying'])]; else modCounters(c, m[1] === '+1/+1' ? 'cp' : 'cm', 1); } } commit(); return true; }
  if ((m = l.match(/^if it was a creature, return it to the battlefield under its owner's control$/))){ const id = ctx.it && ctx.it.evId; const k = ctx.it && ctx.it.evk; if (id != null && find(id)[0] === 'gy' && k && /Creature/.test(info(k)?.t || '')){ moveCard(id, 'bf'); const c = S.bf.find(x => x.id === id); if (c) c.enduring = 1; } commit(); return true; }
  // token math
  if ((m = l.match(/^for each (land|artifact|creature) you control, create an? (.+?) token$/))){ const n = countOf(m[1] + 's you control', ctx) || 0; for (let i = 0; i < n; i++) await createFromText(`Create a ${m[2]} token`, ctx); return true; }
  if ((m = l.match(/^you create an? (.+?) token for each (.+)$/))){ const n = countOf(m[2], ctx); if (n == null) return false; for (let i = 0; i < n; i++) await createFromText(`Create a ${m[1]} token`, ctx); return true; }
  if ((m = l.match(/^(?:target player|each opponent) mills? (a|one|two|three|four|\w+) cards?$/))){ const n = wn(m[1]) || 1; const pids = /^target/.test(l) ? [tgt()].filter(Boolean).map(t => t.pid) : opponents().map(p => p.pid); pids.forEach(pid => { if (pid === MYPID) mill(n); else sendRq(pid, 'mill', n, ctx.name); }); commit(); return true; }
  if ((m = l.match(/^each player loses (\d+) life and draws (a|one|two) cards?$/))){ S.life -= +m[1]; draw(wn(m[2]) || 1); opponents().forEach(p => { sendRq(p.pid, 'life', -m[1], ctx.name); sendRq(p.pid, 'draw', wn(m[2]) || 1, ctx.name); }); commit(); return true; }
  if ((m = l.match(/^you lose (\d+) life and amass (\w+) (\d+)$/))){ S.life -= +m[1]; await say(`Amass ${m[2]} ${m[3]}`); return true; }
  if ((m = l.match(/^you draw a card and gain (\d+) life$/))){ draw(1); gainLife(+m[1], ctx.name); commit(); return true; }
  if ((m = l.match(/^draw a card if you've gained (\d+) or more life this turn$/))){ if (lifeT().g >= +m[1]) draw(1); commit(); return true; }
  if ((m = l.match(/^you add \{([wubrgc])\}\{([wubrgc])\} and draw a card$/))){ addMana([m[1].toUpperCase(), m[2].toUpperCase()]); draw(1); commit(); return true; }
  if ((m = l.match(/^(?:any number of target players|target player) (?:each )?lose (\d+) life and sacrifice a creature of their choice$/))){ let t; while (ctx.tgts && (t = nextTargets(ctx)[0])){ if (t.pid === MYPID) S.life -= +m[1]; else { sendRq(t.pid, 'life', -m[1], ctx.name); sendRq(t.pid, 'sac', 1, ctx.name, {d:'creature'}); } } commit(); return true; }
  if ((m = l.match(/^target player loses (\d+) life unless they discard a card$/))){ const t = tgt(); if (t && t.pid !== MYPID){ const v = UI.dry ? 'life' : await askChoice({title:`${ctx.name}: did ${nameOf(t.pid)} discard a card or lose ${m[1]} life? (ask them)`, options:[{label:'They discard a card', value:'disc'}, {label:`They lose ${m[1]} life`, value:'life'}]}); if (v === 'disc') sendRq(t.pid, 'discard', 1, ctx.name); else loseLife(t.pid, +m[1], ctx.name); } return true; }
  if ((m = l.match(/^have target player lose (\d+) life$/))){ const t = tgt(); if (t) loseLife(t.pid, +m[1], ctx.name); return true; }
  if ((m = l.match(/^(?:it|that creature) gets \+(\d+)\/\+(\d+) until end of turn for each other attacking creature that shares a creature type with it$/))){ handWarn(s, ctx); return true; }
  if ((m = l.match(/^(dragons|elves|goblins|zombies|vampires|angels|soldiers|knights|warriors|\w+s) you control get \+(\d+)\/\+(\d+) until end of turn$/))){ const d = sing(m[1]); S.bf.filter(c => isCreatureCard(c) && descOk(c.k, d, {tok:c.tok})).forEach(c => { c.pu = [(c.pu ? c.pu[0] : 0) + +m[2], (c.pu ? c.pu[1] : 0) + +m[3]]; }); commit(); return true; }
  if ((m = l.match(/^until end of turn, creatures you control get \+(\d+)\/\+(\d+) and gain (.+)$/))){ await say(`Creatures you control get +${m[1]}/+${m[2]} and gain ${m[3]} until end of turn`); return true; }
  if ((m = l.match(/^another target creature (?:you control )?gains (.+?) until end of turn$/))){ const t = tgt(); if (t) applyTo(t, {op:'pump', src:ctx.name, f:{p:0, t:0, kw:m[1].split(/,\s*(?:and\s+)?|\s+and\s+/)}}); return true; }
  if ((m = l.match(/^tap another target creature$/)) || (m = l.match(/^tap target (creature|permanent|artifact)$/))){ const t = tgt(); if (t){ if (t.pid === MYPID){ const c = S.bf.find(x => x.id === t.id); if (c) c.tap = true; } else applyTo(t, {op:'tap', src:ctx.name}); } commit(); return true; }
  if ((m = l.match(/^untap another target (artifact|creature|permanent|creature or land) you control$/)) || (m = l.match(/^untap another target (artifact|creature or land)$/))){ const t = tgt(); const c = t && S.bf.find(x => x.id === t.id); if (c){ c.tap = false; c.tn = 0; commit(); } return true; }
  if ((m = l.match(/^put a \+1\/\+1 counter on (equipped|enchanted) creature$/))){ const sc = src(); const h = sc && sc.att && S.bf.find(x => x.id === sc.att.id); if (h) modCounters(h, 'cp', 1); commit(); return true; }
  if ((m = l.match(/^put a \+1\/\+1 counter on that creature$/))){ const id = ctx.it && ctx.it.evId; const c = id != null && S.bf.find(x => x.id === id); if (c) modCounters(c, 'cp', 1); commit(); return true; }
  if ((m = l.match(/^put a \+1\/\+1 counter on ~ and add (\{[wubrgc]\})$/))){ const c = src(); if (c) modCounters(c, 'cp', 1); addMana([m[1][1].toUpperCase()]); commit(); return true; }
  if ((m = l.match(/^if it's an artifact creature, put a \+1\/\+1 counter on it$/))) return true;
  if ((m = l.match(/^each player searches their library for a basic land card, puts it onto the battlefield(?: tapped)?, then shuffles$/)) || (m = l.match(/^each player searches their library for a basic land card, puts it onto the battlefield$/))){ await searchLibrary('basic land', 'put it onto the battlefield', ctx); opponents().forEach(p => sendRq(p.pid, 'rampSearch', 1, ctx.name)); return true; }
  if ((m = l.match(/^(?:that land's controller|target player) may search their library for an? (.+?) card, put it onto the battlefield(?: tapped)?(?:, then shuffle)?$/))){ const t = (ctx.lastT || [])[0] || tgt(); const pid = t && t.pid; if (!pid || pid === MYPID){ await searchLibrary(m[1], 'put it onto the battlefield', ctx); } else sendRq(pid, 'rampSearch', 1, ctx.name); return true; }
  if ((m = l.match(/^sacrifice any number of lands$/))){ const lands = S.bf.filter(c => isLand(c.k)); const ids = await pickCards({title:`${ctx.name}: sacrifice any number of lands`, cards:lands, min:0, max:lands.length, noneLabel:'None'}); (ids || []).forEach(id => moveCard(id, 'gy', {sac:true})); ctx.sacN = (ids || []).length; ctx.it && (ctx.it.evN = ctx.sacN); commit(); return true; }
  if ((m = l.match(/^search your library for up to that many land cards, put them onto the battlefield tapped, then shuffle$/))){ await searchLibrary(`up to ${ctx.sacN || 0} land`, 'put them onto the battlefield tapped', ctx); return true; }
  if ((m = l.match(/^shuffle ~ and your graveyard into their owner's library$/))){ const c = src(); if (c) moveCard(c.id, 'lib'); S.gy.slice().forEach(x => moveCard(x.id, 'lib', {quiet:true})); shuffleLib(); commit(); return true; }
  if ((m = l.match(/^its owner shuffles their graveyard into their library$/))){ S.gy.slice().forEach(x => moveCard(x.id, 'lib', {quiet:true})); shuffleLib(); commit(); return true; }
  if ((m = l.match(/^put any number of creature cards from your hand onto the battlefield$/))){ const list = S.hand.filter(c => isCreatureCard(c)); const ids = await pickCards({title:`${ctx.name}: creature cards onto the battlefield`, cards:list, min:0, max:list.length, noneLabel:'None'}); (ids || []).forEach(id => moveCard(id, 'bf')); commit(); return true; }
  if ((m = l.match(/^draw a card for each creature destroyed this way$/))){ const n = ctx.destroyedN || 0; if (n) draw(n); commit(); return true; }
  if ((m = l.match(/^you gain 1 life for each creature destroyed this way$/))){ const n = ctx.destroyedN || 0; if (n) gainLife(n, ctx.name); commit(); return true; }
  if ((m = l.match(/^(?:~|it) deals (\d+) damage to them$/))){ const pid = ctx.it && (ctx.it.evPid || ctx.it.evDp); if (pid) dealDamage({t:'player', pid}, +m[1], ctx.k, src()); return true; }
  if ((m = l.match(/^draws? (?:2|two) cards$/)) && ctx.it && ctx.it.evPid && ctx.it.evPid !== MYPID) return false;
  if ((m = l.match(/^(?:if target player controls more creatures than you, )?create a 1\/1 white soldier creature token$/)) && /more creatures than you/.test(l)) return false;
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){
    const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase();
    if (l && await doRound13Pre(s, l, ctx)) return;
    return ds(s0, ctx);
  };
}
// “destroyed this way” counts
{
  const dc = destroyCard;
  destroyCard = function(c, why){ const r = dc(c, why); try { if (UI.curCtx) UI.curCtx.destroyedN = (UI.curCtx.destroyedN || 0) + 1; } catch {} return r; };
  const re = runEffects;
  runEffects = async function(txt, ctx){ const prev = UI.curCtx; UI.curCtx = ctx; try { return await re(txt, ctx); } finally { UI.curCtx = prev; } };
}
