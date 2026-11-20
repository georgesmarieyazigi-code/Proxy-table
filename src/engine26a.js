/* ===================== Rules engine — round 26 helper A2: long tail, ranks 0–3300 ===================== */
// Bespoke automation for the remaining most-played cards with gaps (Scroll Rack, Conduit of Worlds, Ripples of Potential,
// Sword of Hearth and Home, Carpet of Flowers, Toph, Descendants' Path, The Key to the Vault, Nissa ×2, …).
const A26 = {};
function a26Tg(ctx){ return ctx.tgts ? nextTargets(ctx) : []; }
function a26Mine(){ try { return currentTurn()[1] === MYPID; } catch { return true; } }
function a26T(){ return turnStr(); }
function a26Ctrs(c){ if (!c) return 0; let n = (c.cp || 0) + (c.cm || 0) + (c.co || 0) + (c.lore || 0); for (const v of Object.values(c.nc || {})) n += +v || 0; return n; }
function a26TgCard(ctx, zone){ const all = (ctx.tgts || []).flat(); return all.map(t => t && S[zone] && S[zone].find(c => c.id === t.id)).find(Boolean) || null; }

// Full-text rewrites: a whole multi-sentence effect becomes one sentence handled below
const A26RW = [
  [/Exile any number of cards from your hand face down\. Put that many cards from the top of your library into your hand\. Then look at the exiled cards and put them on top of your library in any order\.?/i, 'A26 scroll rack.'],
  [/Proliferate, then choose any number of permanents you control that had a counter put on them this way\. Those permanents phase out\.?/i, 'A26 ripples.'],
  [/exile up to one target creature you own, then search your library for a basic land card\. Put both cards onto the battlefield under your control, then shuffle\.?/i, 'A26 hearth and home.'],
  [/You get an emblem with "Lands you control have indestructible\." Search your library for any number of Forest cards, put them onto the battlefield tapped, then shuffle\.?/i, 'A26 nissa emblem.'],
  [/Choose target nonland permanent card in your graveyard\. If you haven't cast a spell this turn, you may cast that card\. If you do, you can't cast additional spells this turn\.?/i, 'A26 conduit.'],
  [/look at that many cards from the top of your library\. You may exile a nonland card from among them\. Put the rest on the bottom of your library in a random order\. You may cast the exiled card without paying its mana cost\.?/i, 'A26 key to the vault.'],
  [/reveal the top card of your library\. If it's a creature card that shares a creature type with a creature you control, you may cast it without paying its mana cost\. If you don't cast it, put it on the bottom of your library\.?/i, 'A26 descendants path.'],
  [/add one mana of any color\. Then if this is the second time this ability has resolved this turn, reveal cards from the top of your library until you reveal an Elf or Elemental card\. Put that card into your hand and the rest on the bottom of your library in a random order\.?/i, 'A26 nissa animist.'],
  [/you may pay \{1\}\{G\} if (?:this permanent|~|Springheart Nantuko) is attached to a creature you control\. If you do, create a token that's a copy of that creature\. If you didn't create a token this way, create a 1\/1 green Insect creature token\.?/i, 'A26 springheart.'],
  [/You may unattach an Equipment from a creature you control\. If you do, tap that creature and it gains indestructible until end of turn\.?/i, 'A26 akiri.'],
  [/Choose two target players\. Each of them searches their library for a card, then shuffles and puts that card on top\.?/i, 'A26 scheming.'],
  [/Its controller reveals cards from the top of their library until they reveal a permanent card that shares a card type with that permanent\. They put that card onto the battlefield and the rest on the bottom of their library in a random order\.?/i, 'A26 surge.'],
  [/Choose target artifact a player controls and target artifact card in that player's graveyard\. If both targets are still legal as this ability resolves, that player simultaneously sacrifices the artifact and returns the artifact card to the battlefield\.?/i, 'A26 welder.'],
  [/Exile the top card of your library face down and look at it\. Create a 2\/2 colorless Spirit creature token\. When that token leaves the battlefield, put the exiled card into your hand\.?/i, 'A26 ugin.'],
  [/if that opponent has more life than another of your opponents, that attacking player draws a card and you put two \+1\/\+1 counters on a creature you control\.?/i, 'A26 breena.'],
  [/target land you control becomes a creature with haste and "(?:This creature|[^"]+?)'s power and toughness are each equal to the number of lands you control\." It's still a land\.?/i, 'A26 druid class.'],
  [/you may choose two\. Each mode must target a different player\.\n• Target player creates a 2\/1 white and black Inkling creature token with flying\.\n• Target player draws a card and loses 1 life\.\n• Target player puts a \+1\/\+1 counter on each creature they control\.?/i, 'A26 shadrix.'],
  [/until end of turn, you may look at the top card of your library any time and you may play cards from the top of your library\. If you cast a spell this way, pay life equal to its mana value rather than pay its mana cost\.?/i, 'A26 gwenom.'],
  [/put a blight counter on target land\. For as long as that land has a blight counter on it, it loses all land types and abilities and has "\{T\}: Add \{C\}\."/i, 'A26 ultima.'],
  [/put a quest counter on (?:this enchantment|~|Firebender Ascension)\. Then if it has four or more quest counters on it, you may copy that ability\. You may choose new targets for the copy\.?/i, 'A26 ascension.'],
];
{
  const re = runEffects;
  runEffects = async function(txt, ctx){ let t = String(txt || ''); for (const [r, w] of A26RW) t = t.replace(r, w); return re(t, ctx); };
}

async function a26Free(c, zone){
  // cast a card for free right now (during resolution); true if it was cast
  const n0 = (S.casts || []).length; UI.afterCast = () => {};
  await beginCast(c, zone, {free:true}); return (S.casts || []).length > n0;
}

async function doRound26APre(s, l, ctx){
  let m; const name = ctx.name || ''; const full = String(ctx.full || '').toLowerCase();
  const say = t => doSentence(cap(t), ctx);
  const src = () => srcCardOf(ctx);
  const lt = name ? l.split(name.toLowerCase()).join('~') : l;

  // ---- Scroll Rack
  if (l === 'a26 scroll rack'){
    if (UI.dry){ return true; }
    const ids = S.hand.length ? await pickCards({title:`${name}: exile any number of cards from your hand face down`, hint:'You get that many cards from the top of your library, then put the exiled cards back on top in any order.', cards:S.hand.slice(), min:0, max:S.hand.length, noneLabel:'None'}) : [];
    const chosen = (ids || []).map(id => S.hand.find(c => c.id === id)).filter(Boolean); if (!chosen.length){ log(`${name}: exiled nothing`); return true; }
    chosen.forEach(c => S.hand.splice(S.hand.indexOf(c), 1));
    const n = Math.min(chosen.length, S.lib.length); const got = S.lib.splice(0, n); S.hand.push(...got);
    log(`${name}: exiled ${chosen.length} card${chosen.length === 1 ? '' : 's'} face down and put ${n} from the top of their library into their hand`);
    let order = chosen.map(c => c.id);
    if (chosen.length > 1){ const o = await pickCards({title:`${name}: put the exiled cards back on top`, hint:'Click them in order, top card first.', cards:chosen, min:chosen.length, max:chosen.length}); if (o && o.length === chosen.length) order = o; }
    S.lib.unshift(...order.map(id => chosen.find(c => c.id === id)));
    log(`${name}: put ${chosen.length} card${chosen.length === 1 ? '' : 's'} on top of their library`); commit(); return true; }

  // ---- Ripples of Potential
  if (l === 'a26 ripples'){
    const before = new Map(S.bf.map(c => [c.id, a26Ctrs(c)]));
    await proliferate(name);
    const got = S.bf.filter(c => !c.fd && before.has(c.id) && a26Ctrs(c) > before.get(c.id));
    if (!got.length || UI.dry){ if (!UI.dry) log(`${name}: nothing got a counter`); return true; }
    const ids = await pickCards({title:`${name}: choose any number of them to phase out`, cards:got, min:0, max:got.length, noneLabel:'None'});
    for (const id of (ids || [])) r23fPhaseOut({t:'card', pid:MYPID, id}, name); commit(); return true; }

  // ---- Sword of Hearth and Home
  if (l === 'a26 hearth and home'){
    const t = a26Tg(ctx)[0]; let c = t && (t.pid === MYPID || !t.pid) ? S.bf.find(b => b.id === t.id && !b.tok && !b.own) : null;
    if (c){ moveCard(c.id, 'ex', {quiet:true}); log(`${name}: exiled ${cname(c)}`); }
    const legal = S.lib.filter(x => descOk(x.k, 'basic land'));
    const ids = UI.dry || !legal.length ? [] : await pickCards({title:`${name}: search for a basic land card`, hint:'It goes onto the battlefield.', cards:legal, min:0, max:1, noneLabel:'Find nothing'});
    if (c && S.ex.includes(c)){ moveCard(c.id, 'bf'); }
    const land = ids && ids[0] != null ? S.lib.find(x => x.id === ids[0]) : null; if (land){ moveCard(land.id, 'bf', {quiet:true}); log(`${name}: put ${cname(land)} onto the battlefield`); }
    shuffleLib(); commit(); return true; }

  // ---- Nissa, Who Shakes the World −8
  if (l === 'a26 nissa emblem'){
    makeEmblem('Lands you control have indestructible.', name);
    if (!UI.dry) await searchLibrary('any number of Forest cards', 'put them onto the battlefield tapped', ctx); return true; }

  // ---- Conduit of Worlds
  if (l === 'a26 conduit'){
    const c = a26TgCard(ctx, 'gy'); if (!c){ log(`${name}: no card`); return true; }
    if ((S.casts || []).some(x => x.t === a26T())){ log(`${name}: you've already cast a spell this turn`); return true; }
    if (isLand(c.k) || UI.dry) return true;
    if (!(await askYes(`${name}: cast ${cname(c)} from your graveyard? (then you can't cast more spells this turn)`, 'Cast it', 'No'))) return true;
    const n0 = (S.casts || []).length; UI.afterCast = () => {}; await beginCast(c, 'gy', {});
    if ((S.casts || []).length > n0){ S.a26noCast = a26T(); log(`${name}: you can't cast additional spells this turn`); commit(); }
    return true; }

  // ---- The Key to the Vault
  if (l === 'a26 key to the vault'){
    const n = Math.min(+(ctx.it && (ctx.it.evN || ctx.it.amt)) || 0, S.lib.length); if (!n){ log(`${name}: no damage amount`); return true; }
    const top = S.lib.slice(0, n); log(`${name}: looked at the top ${n}`);
    const non = top.filter(c => !isLand(c.k)); let ex = null;
    if (non.length && !UI.dry){ const ids = await pickCards({title:`${name}: exile a nonland card?`, hint:'You may cast it for free; the rest go to the bottom in a random order.', cards:top, filter:c => !isLand(c.k), min:0, max:1, noneLabel:"Don't"}); const c = ids && non.find(x => x.id === ids[0]); if (c){ moveCard(c.id, 'ex', {quiet:true}); ex = c; log(`${name}: exiled ${cname(c)}`); } }
    const rest = top.filter(c => c !== ex && S.lib.includes(c)); rest.forEach(c => S.lib.splice(S.lib.indexOf(c), 1)); shuffle(rest); S.lib.push(...rest);
    if (rest.length) log(`${name}: put ${rest.length} on the bottom in a random order`);
    if (ex && await askYes(`${name}: cast ${cname(ex)} without paying its mana cost?`, 'Cast it', 'No')) await a26Free(ex, 'ex');
    commit(); return true; }

  // ---- Descendants' Path
  if (l === 'a26 descendants path'){
    const c = S.lib[0]; if (!c){ return true; } log(`${name}: revealed ${cname(c)}`);
    const types = cr => (typeOf(cr).split(/—/)[1] || '').trim().split(/\s+/).filter(Boolean);
    const mineTypes = new Set(); S.bf.filter(b => isCreatureCard(b) && !b.fd).forEach(b => { if (kwOf(b, 'changeling')) mineTypes.add('*'); types(b).forEach(x => mineTypes.add(x)); });
    const ct = /\bCreature\b/.test(info(c.k)?.t || '') ? ((info(c.k).t.split('—')[1] || '').trim().split(/\s+/).filter(Boolean)) : null;
    const chg = ct && /changeling/i.test(info(c.k)?.o || '');
    const ok = ct && (ct.some(x => mineTypes.has(x)) || ((mineTypes.size > 0) && (chg || mineTypes.has('*'))));
    let cast = false;
    if (ok && !UI.dry && await askYes(`${name}: cast ${cname(c)} without paying its mana cost?`, 'Cast it', 'No')){ cast = await a26Free(c, 'lib'); }
    if (!cast && S.lib.includes(c)){ S.lib.splice(S.lib.indexOf(c), 1); S.lib.push(c); log(`${name}: put ${cname(c)} on the bottom`); }
    commit(); return true; }

  // ---- Nissa, Resurgent Animist
  if (l === 'a26 nissa animist'){
    await say('Add one mana of any color');
    const key = 'a26na:' + (ctx.it && ctx.it.srcId); A26.res = A26.res || {}; const r = A26.res[key] && A26.res[key].t === a26T() ? A26.res[key] : (A26.res[key] = {t:a26T(), n:0}); r.n++;
    if (r.n !== 2 && !UI.dry) return true;
    const got = []; let hit = null;
    while (S.lib.length){ const c = S.lib.shift(); if (/\b(Elf|Elemental)\b/.test(info(c.k)?.t || '') || /changeling/i.test(info(c.k)?.o || '')){ hit = c; break; } got.push(c); }
    if (hit){ S.hand.push(hit); log(`${name}: revealed ${got.length + 1} cards, put ${cname(hit)} into their hand`); } else log(`${name}: no Elf or Elemental card`);
    shuffle(got); S.lib.push(...got); commit(); return true; }

  // ---- Carpet of Flowers
  if (/^if you haven't added mana with this ability this turn, you may add x mana of any one color, where x is the number of islands target opponent controls$/.test(l)){
    const key = 'a26cf:' + (ctx.it && ctx.it.srcId); A26.cf = A26.cf || {}; if (A26.cf[key] === a26T()) return true;
    const t = a26Tg(ctx).find(x => x.t === 'player'); const isl = pid => (OPP.get(pid)?.bf || []).filter(c => c.k && !c.fd && /\bIsland\b/.test(info(c.k)?.t || '')).length;
    let pid = t && t.pid; if (!pid){ const ops = opponents(); pid = ops.sort((a, b) => isl(b.pid) - isl(a.pid))[0]?.pid; }
    const n = pid ? isl(pid) : 0; if (!n || UI.dry){ if (!UI.dry) log(`${name}: ${pid ? nameOf(pid) : 'no opponent'} controls no Islands`); return true; }
    if (!(await askYes(`${name}: add ${n} mana of one color?`, 'Add', 'No'))) return true;
    const col = await askChoice({title:`${name}: which color?`, options:[['W', 'White'], ['U', 'Blue'], ['B', 'Black'], ['R', 'Red'], ['G', 'Green']].map(([value, label]) => ({label, value}))}) || 'G';
    S.pool[col] = (S.pool[col] || 0) + n; A26.cf[key] = a26T(); log(`${name}: added ${n} {${col}}`); commit(); return true; }

  // ---- "Whenever this creature attacks, it gets +X/+Y and gains <keyword> until end of turn" (Weathered Sentinels): "it" is the attacker
  if ((m = l.match(/^it gets \+(\d+)\/\+(\d+) and gains ([a-z ,]+?) until end of turn$/)) && !(ctx.lastT || []).length && /whenever (?:~|this creature) attacks, it gets/i.test(tname(info(ctx.k)?.o || '', info(ctx.k)?.n || ''))){
    const c = src(); if (!c || !S.bf.includes(c)) return true; const kws = m[3].split(/,\s*|\s+and\s+/).map(x => x.trim()).filter(Boolean);
    applyTo({t:'card', pid:MYPID, id:c.id, k:c.k}, {op:'pump', src:name, f:{p:+m[1], t:+m[2], kw:kws}}); commit(); return true; }

  // ---- Toph: Lesson → an additional +1/+1 counter on that land
  if (/^if that spell is a lesson, put an additional \+1\/\+1 counter on that land$/.test(l)){
    const k = ctx.it && ctx.it.evk; const land = ctx.a26eb != null ? S.bf.find(c => c.id === ctx.a26eb) : null;
    if (k && /\bLesson\b/.test(info(k)?.t || '') && land){ modCounters(land, 'cp', 1); log(`${name}: ${cname(land)} gets an additional +1/+1 counter (Lesson)`); commit(); }
    return true; }

  // ---- Springheart Nantuko (bestowed): copy the enchanted creature, else an Insect
  if (l === 'a26 springheart'){
    const me = src(); const h = me && me.att && me.att.pid === MYPID ? S.bf.find(x => x.id === me.att.id && isCreatureCard(x)) : null; let made = false;
    if (h && !UI.dry){ const plan = payPlan(parseCost('{1}{G}'), S.pool);
      if (!plan.err && await askYes(`${name}: pay {1}{G} to create a token copy of ${cname(h)}?`, 'Pay {1}{G}', 'No')){ S.pool = plan.pool; await createToken(h.k, 1); made = true; log(`${name}: paid {1}{G} — created a token copy of ${cname(h)}`); } }
    if (!made) await createFromText('Create a 1/1 green Insect creature token', ctx);
    commit(); return true; }

  // ---- Akiri, Fearless Voyager
  if (l === 'a26 akiri'){
    const eqs = S.bf.filter(e => !e.fd && e.att && e.att.pid === MYPID && /\bEquipment\b/.test(info(e.k)?.t || '') && S.bf.some(h => h.id === e.att.id && isCreatureCard(h)));
    if (!eqs.length || UI.dry){ if (!UI.dry) log(`${name}: no Equipment attached to your creatures`); return true; }
    const ids = await pickCards({title:`${name}: unattach an Equipment?`, hint:'The creature it was on becomes tapped and gains indestructible until end of turn.', cards:eqs, min:0, max:1, noneLabel:"Don't"});
    const e = ids && eqs.find(x => x.id === ids[0]); if (!e) return true; const h = S.bf.find(x => x.id === e.att.id); delete e.att;
    if (h){ h.tap = true; applyTo({t:'card', pid:MYPID, id:h.id, k:h.k}, {op:'pump', src:name, f:{p:0, t:0, kw:['indestructible']}}); log(`${name}: unattached ${cname(e)}; ${cname(h)} is tapped and gains indestructible until end of turn`); }
    commit(); return true; }

  // ---- Scheming Symmetry
  if (l === 'a26 scheming'){
    const ps = (ctx.tgts || []).flat().filter(t => t && t.t === 'player').map(t => t.pid);
    for (const pid of [...new Set(ps)]){ if (pid === MYPID){ if (!UI.dry) await searchLibrary('a card', 'put it on top of your library', ctx); } else { sendRq(pid, 'a26tutorTop', 0, name); log(`${nameOf(pid)} searches their library for a card to put on top (${name})`); } }
    commit(); return true; }

  // ---- Wild Magic Surge
  if (l === 'a26 surge'){
    const t = (ctx.lastT || [])[0]; const k = t && t.k; if (!t || !k || t.pid === MYPID) return true;
    const types = (info(k)?.t || '').split('—')[0].match(/\b(Artifact|Creature|Enchantment|Land|Planeswalker|Battle)\b/g) || [];
    if (types.length){ sendRq(t.pid, 'a26surge', 0, name, {d:types.join(',')}); log(`${nameOf(t.pid)} reveals until a permanent card sharing a type with ${info(k)?.n} (${name})`); }
    commit(); return true; }

  // ---- Goblin Welder
  if (l === 'a26 welder'){
    const all = (ctx.tgts || []).flat().filter(Boolean); const art = all.find(t => t.t !== 'player' && boardOf(t.pid || MYPID).some(b => b.id === t.id));
    if (!art){ log(`${name}: the artifact is gone`); return true; } const pid = art.pid || MYPID;
    let g = all.find(t => t !== art && (pid === MYPID ? S.gy : (OPP.get(pid)?.gy || [])).some(c => c.id === t.id && descOk(c.k, 'artifact')));
    if (!g && !UI.dry){ const gy = (pid === MYPID ? S.gy : (OPP.get(pid)?.gy || [])).filter(c => c.k && descOk(c.k, 'artifact'));
      if (gy.length){ const ids = await pickCards({title:`${name}: target artifact card in ${pid === MYPID ? 'your' : nameOf(pid) + "'s"} graveyard`, cards:gy, min:1, max:1}); const c = ids && gy.find(x => x.id === ids[0]); if (c) g = {t:'card', pid, id:c.id, k:c.k}; } }
    if (!g){ log(`${name}: no artifact card in that graveyard`); return true; }
    if (pid === MYPID) a26Weld(art.id, g.id, name); else { sendRq(pid, 'a26weld', 0, name, {tid:art.id, ref:String(g.id)}); log(`${nameOf(pid)} swaps an artifact with one from their graveyard (${name})`); }
    commit(); return true; }

  // ---- Chainer, Nightmare Adept
  if (/^cast a creature spell from your graveyard this turn$/.test(l)){ S.a26chain = {t:a26T(), n:(S.a26chain && S.a26chain.t === a26T() ? S.a26chain.n : 0) + 1}; log(`${name}: you may cast a creature spell from your graveyard this turn`); commit(); return true; }

  // ---- Chainer: haste for creatures not cast from your hand (until your next turn = no summoning sickness until then)
  if (/^if you didn't cast it from your hand, it gains haste until your next turn$/.test(l)){
    const id = ctx.it && ctx.it.evId; const c = id != null ? S.bf.find(b => b.id === id) : null; const f = (S.a26from || {})[id];
    if (c && !(f && f.z === 'hand' && f.t === turnStr())){ c.sk = false; log(`${cname(c)} has haste until your next turn (${name})`); commit(); }
    return true; }

  // ---- There and Back Again
  if (/^up to one target creature can't block for as long as you control ~$/.test(l.replace(name.toLowerCase(), '~')) || /^up to one target creature can't block for as long as you control (?:this saga|there and back again)$/.test(l)){
    const t = a26Tg(ctx)[0]; const me = src(); if (t && me) applyTo(t, {op:'a26noBlk', src:name, ref:String(me.id), d:MYPID}); commit(); return true; }

  // ---- Massacre Girl, Known Killer
  if (/^if its toughness was less than 1, draw a card$/.test(l)){
    const pid = ctx.it && ctx.it.evPid, id = ctx.it && ctx.it.evId; if (UI.dry){ draw(1); return true; }
    const evs = pid === MYPID ? S.ev : (OPP.get(pid)?.ev || []); const dn = Math.max(-1, ...evs.filter(e => e.type === 'die' && e.id === id).map(e => e.n)); const hit = dn >= 0 && evs.some(e => e.type === 'a26die0' && e.id === id && e.n > dn && e.n <= dn + 4);
    if (hit){ draw(1); log(`${name}: its toughness was less than 1 — drew a card`); } else log(`${name}: its toughness wasn't less than 1`);
    commit(); return true; }

  // ---- Wedding Ring triggers (conditions checked here)
  if (/^a26 wedding (draw|gain)$/.test(l)){
    const pid = ctx.it && ctx.it.evPid; const theirs = pid && pid !== MYPID && currentTurn()[1] === pid && (OPP.get(pid)?.bf || []).some(b => b.k && !b.fd && info(b.k)?.n === 'Wedding Ring' && /\bArtifact\b/.test(info(b.k)?.t || ''));
    if (!theirs){ log(`${name}: condition not met`); return true; }
    if (/draw/.test(l)){ draw(1); log(`${name}: drew a card`); } else { const n = (ctx.it && (ctx.it.evN || ctx.it.amt)) || 0; if (n) gainLife(n, name); }
    commit(); return true; }

  // ---- Ugin, the Ineffable +1
  if (l === 'a26 ugin'){
    const c = S.lib[0]; let cid = null;
    if (c){ moveCard(c.id, 'ex', {quiet:true}); c.fd = true; c.a26fd = 1; cid = c.id; log(`${name}: exiled the top card of their library face down (${cname(c)} — only they see it)`); }
    const tk = await a26TokLinked(() => createFromText('Create a 2/2 colorless Spirit creature token', ctx));
    if (tk && cid != null){ tk.a26link = {id:cid, src:name}; } commit(); return true; }
  if ((m = l.match(/^a26 link return (\d+) (.+)$/))){ const c = S.ex.find(x => x.id === +m[1]); if (c){ c.fd = false; delete c.a26fd; moveCard(c.id, 'hand', {quiet:true}); log(`${name}: put the exiled card into their hand`); commit(); } return true; }

  // ---- Breena, the Demagogue
  if (l === 'a26 breena'){
    const dp = ctx.it && ctx.it.a26def; const ap = ctx.it && ctx.it.a26atk; if (UI.dry){ return true; }
    if (!dp || dp === MYPID) return true; const life = pid => pid === MYPID ? S.life : (OPP.get(pid)?.life ?? 0);
    const others = opponents().filter(p => p.pid !== dp && !(p.s && p.s.lost)); if (!others.some(p => life(dp) > life(p.pid))){ log(`${name}: ${nameOf(dp)} doesn't have more life than another opponent`); return true; }
    if (ap === MYPID) draw(1); else if (ap){ sendRq(ap, 'draw', 1, name); log(`${nameOf(ap)} draws a card (${name})`); }
    const cr = S.bf.filter(b => isCreatureCard(b) && !b.fd); if (cr.length){ const ids = cr.length === 1 ? [cr[0].id] : await pickCards({title:`${name}: put two +1/+1 counters on a creature you control`, cards:cr, min:1, max:1}); const c = ids && S.bf.find(x => x.id === ids[0]); if (c){ modCounters(c, 'cp', 2); log(`${name}: ${cname(c)} gets two +1/+1 counters`); } }
    commit(); return true; }

  // ---- Druid Class level 3
  if (l === 'a26 druid class'){
    const t = a26Tg(ctx)[0]; const c = t && t.pid === MYPID ? S.bf.find(b => b.id === t.id && isLand(b.k)) : null; if (!c) return true;
    c.anim = 'a26dc'; c.ekw = [...new Set([...(c.ekw || []), 'haste'])]; c.a26kw = ['haste']; log(`${cname(c)} is now a creature with haste and power and toughness equal to the number of lands you control`); commit(); return true; }

  // ---- The Skullspore Nexus
  if (/^create a green fungus dinosaur creature token with base power and toughness each equal to the total power of those creatures$/.test(l)){
    const n = UI.dry ? 2 : Math.max(0, (ctx.it && ctx.it.a26pow) || 0);
    await createFromText(`Create a ${n}/${n} green Fungus Dinosaur creature token`, ctx); commit(); return true; }

  // ---- Fraying Sanity
  if (/^enchanted player mills x cards, where x is the number of cards put into their graveyard from anywhere this turn$/.test(l)){
    const me = src(); const pid = me && me.att && me.att.id == null ? me.att.pid : null; if (!pid) return true;
    if (pid === MYPID){ const n = a26GyIn(); if (n) mill(n); log(`${name}: milled ${n}`); } else { sendRq(pid, 'a26fray', 0, name); log(`${nameOf(pid)} mills a card for each card put into their graveyard this turn (${name})`); }
    commit(); return true; }

  // ---- Malcolm: a Treasure for each opponent dealt damage
  if (/^you create a treasure token for each opponent dealt damage$/.test(l)){ const n = UI.dry ? 1 : (ctx.it && ctx.it.a26n) || 0; if (n) await createFromText(`Create ${n === 1 ? 'a Treasure token' : n + ' Treasure tokens'}`, ctx); return true; }

  // ---- Grafted Exoskeleton
  if (/^sacrifice that permanent$/.test(l) && /becomes unattached from a permanent/i.test(info(ctx.k)?.o || '')){ const id = ctx.it && ctx.it.a26host; const c = id != null ? S.bf.find(b => b.id === id) : null; if (c){ sacrificeOne(c); commit(); } return true; }
  if ((m = l.match(/^a26 exo sac (\d+)$/))){ const c = S.bf.find(b => b.id === +m[1]); if (c){ sacrificeOne(c); log(`${name}: sacrificed ${cname(c)}`); commit(); } return true; }

  // ---- The Queen of Dale: recruit (draw, discard; a nonland discard makes a 1/1 white Human Soldier)
  if (/^you recruit$/.test(l) || /^recruit$/.test(l)){
    if (ctx.it && ctx.it.a26qd === false){ log(`${name}: not their first noncreature spell this turn`); return true; }
    draw(1); const got = UI.dry ? [{k:'x'}] : await discardTracked(1, ctx);
    if ((got || []).some(x => UI.dry || !isLand(x.k))) await createFromText('Create a 1/1 white Human Soldier creature token', ctx);
    log(`${name}: recruited`); commit(); return true; }

  // ---- Plumb the Forbidden: a copy for each creature sacrificed as it was cast (copies resolve right after it)
  if (/^(?:when you do, )?copy ~ for each creature sacrificed this way$/.test(l)){
    const it = ctx.it; if (!it || it.copy) return true; const n = +(it.n24sacN || 0); if (!n){ log(`${name}: no creatures were sacrificed`); return true; }
    await m24CopySelf(ctx, {n, newT:'no', noTwin:false}); return true; }

  // ---- Lethal Scheme: each creature that convoked it connives
  if (/^each creature that convoked ~ connives$/.test(l)){
    const id = ctx.it && ctx.it.card && ctx.it.card.id; const ids = (S.a26cv || {})[id] || [];
    for (const cid of ids){ const c = S.bf.find(b => b.id === cid); if (c) await connive(c, ctx); }
    if (!ids.length && !UI.dry) log(`${name}: no creature convoked it`); return true; }

  // ---- The Aetherspark +1 (the combat-damage loyalty trigger is in the damage hook below)
  if (/^attach ~ to up to one target creature you control$/.test(l)){
    const t = a26Tg(ctx)[0]; const me = src(); const c = t && t.pid === MYPID ? S.bf.find(b => b.id === t.id && isCreatureCard(b)) : null;
    if (me && c){ me.att = {pid:MYPID, id:c.id}; log(`${name} is attached to ${cname(c)}`); ctx.lastT = [{t:'card', pid:MYPID, id:c.id, k:c.k, nm:cname(c)}]; } else ctx.lastT = [];
    commit(); return true; }
  if (/^put a \+1\/\+1 counter on that creature$/.test(l) && /^\+1: attach ~ to up to one target creature you control/im.test(tname(info(ctx.k)?.o || '', info(ctx.k)?.n || ''))){
    const t = (ctx.lastT || [])[0]; const c = t && S.bf.find(b => b.id === t.id); if (c){ modCounters(c, 'cp', 1); log(`${cname(c)} gets a +1/+1 counter (${name})`); commit(); } return true; }
  if (/^whenever equipped creature deals combat damage during your turn, put that many loyalty counters on ~$/.test(lt)) return true; // granted while attached: done by the combat-damage hook (a26AetherHit)
  if (/^put that many loyalty counters on ~$/.test(lt) && /deals combat damage during your turn, put that many loyalty counters/i.test(info(ctx.k)?.o || '')){ const me = src(); const n = (ctx.it && ctx.it.evN) || 0; if (me && n){ modCounters(me, 'co', n); commit(); } return true; }
  if (/^untap it and put a \+1\/\+1 counter on it(?:\. this ability triggers only once each turn)?$/.test(l)){ const id = ctx.it && ctx.it.evId; const c = id != null ? S.bf.find(b => b.id === id) : src(); if (!c) return true;
    if (/only once each turn/.test(l) && !UI.dry){ S.a26dio = S.a26dio || {}; if (S.a26dio[c.id] === turnStr() + '|r'){ log(`${name}: already triggered this turn`); return true; } S.a26dio[c.id] = turnStr() + '|r'; }
    c.tap = false; c.tn = 0; modCounters(c, 'cp', 1); log(`${cname(c)} untapped and got a +1/+1 counter`); commit(); return true; }
  if ((m = l.match(/^a26 aetherspark (\d+) (\d+)$/))){ const c = S.bf.find(b => b.id === +m[1]); if (c){ modCounters(c, 'co', +m[2]); log(`${cname(c)} gets ${m[2]} loyalty counter${+m[2] === 1 ? '' : 's'}`); commit(); } return true; }

  // ---- Ichormoon Gauntlet: the granted loyalty abilities
  if (/^\[0\]: proliferate$/.test(l)){ await proliferate(name); return true; }
  if (/^\[[−-]12\]: take an extra turn after this one$/.test(l)){ await say('Take an extra turn after this one'); return true; }

  // ---- Dionus / Danny Pink: granted triggers (fired by the event hook below)
  if (/^whenever ~ becomes tapped during your turn, untap it and put a \+1\/\+1 counter on it(?:\. this ability triggers only once each turn)?$/.test(lt) || /^this ability triggers only once each turn$/.test(l) && /becomes tapped during your turn/.test(full)) return true;
  if (/^whenever one or more counters are put on ~ for the first time each turn, draw a card$/.test(lt)) return true;
  if ((m = l.match(/^a26 dionus (\d+)$/))){ const c = S.bf.find(b => b.id === +m[1]); if (c){ c.tap = false; c.tn = 0; modCounters(c, 'cp', 1); log(`${cname(c)} untapped and got a +1/+1 counter (${name})`); commit(); } return true; }

  // ---- Shadrix Silverquill
  if (l === 'a26 shadrix'){
    if (UI.dry) return true; if (!(await askYes(`${name}: choose two modes (each targets a different player)?`, 'Choose two', 'No'))) return true;
    const MODES = ['Target player creates a 2/1 white and black Inkling creature token with flying', 'Target player draws a card and loses 1 life', 'Target player puts a +1/+1 counter on each creature they control'];
    const ps = players().filter(p => !(p.s && p.s.lost)); if (ps.length < 2) return true; const used = new Set(); const picks = [];
    for (let i = 0; i < 2; i++){ const mi = await askChoice({title:`${name}: mode ${i + 1} of 2`, options:MODES.map((t, j) => ({label:t, value:j, disabled:picks.some(p => p.m === j)}))}); if (mi == null) return true;
      const pid = await askChoice({title:`${name}: ${MODES[mi]} — which player?`, options:ps.map(p => ({label:p.me ? `${p.nm} (you)` : p.nm, value:p.pid, disabled:used.has(p.pid)}))}); if (pid == null) return true; used.add(pid); picks.push({m:mi, pid}); }
    for (const {m:mi, pid} of picks){
      if (mi === 0){ if (pid === MYPID) await createFromText('Create a 2/1 white and black Inkling creature token with flying', ctx); else { sendRq(pid, 'tokText', 0, name, {d:'a 2/1 white and black Inkling creature token with flying'}); log(`${nameOf(pid)} creates a 2/1 Inkling (${name})`); } }
      if (mi === 1){ if (pid === MYPID){ draw(1); await loseLife(MYPID, 1, name); } else { sendRq(pid, 'draw', 1, name); await loseLife(pid, 1, name); log(`${nameOf(pid)} draws a card (${name})`); } }
      if (mi === 2){ for (const c of boardOf(pid).filter(b => b.k && !b.fd && isCreatureCard(b))){ if (pid === MYPID) modCounters(c, 'cp', 1); else applyTo({t:'card', pid, id:c.id, k:c.k}, {op:'ctr', n:1, d:'cp', src:name}); } log(`${pid === MYPID ? 'their' : nameOf(pid) + "'s"} creatures each get a +1/+1 counter (${name})`); }
    }
    commit(); return true; }

  // ---- Gwenom, Remorseless
  if (l === 'a26 gwenom'){ const T = turnStr(); S.w25rules = (S.w25rules || []).filter(x => x.t === T).concat({t:T, r:{kind:'r23fTop', who:'you', lands:true, spells:'any', src:name}}, {t:T, r:{kind:'r23fTopLife', who:'you', src:name}}); log(`${name}: until end of turn they may play cards from the top of their library (spells cost life equal to their mana value)`); commit(); return true; }

  // ---- Ultima, Origin of Oblivion
  if (l === 'a26 ultima'){ const t = a26Tg(ctx)[0]; if (!t || t.t === 'player') return true;
    if (t.pid === MYPID || !t.pid){ a26Blight(t.id, name); } else { sendRq(t.pid, 'a26ultima', 1, name, {tid:t.id}); log(`${name}: a blight counter on ${t.nm || 'a land'}`); } commit(); return true; }
  if (/^whenever you tap a land for \{c\}, add an additional \{c\}$/.test(l)) return true;
  if (/^its controller adds an additional one mana of that colou?r$/.test(l) && /whenever a basic land is tapped for mana of the chosen colou?r/i.test(info(ctx.k)?.o || '')) return true; // done by the mana hooks (engine21c/23f for your lands, a26 for Gauntlets other players control) // mana trigger: done by the tap hook (a26 Ultima in r23fTapExtras)

  // ---- The Warring Triad: target player adds one mana of any color
  if (/^target player adds one mana of any color$/.test(l)){ const t = a26Tg(ctx).find(x => x.t === 'player'); const pid = t ? t.pid : MYPID;
    if (pid === MYPID){ if (UI.dry) return true; const col = await askChoice({title:`${name}: add one mana of which color?`, options:[['W', 'White'], ['U', 'Blue'], ['B', 'Black'], ['R', 'Red'], ['G', 'Green']].map(([value, label]) => ({label, value}))}) || 'G'; S.pool[col] = (S.pool[col] || 0) + 1; log(`added {${col}} (${name})`); }
    else { sendRq(pid, 'a26mana', 1, name); log(`${nameOf(pid)} adds one mana of any color (${name})`); }
    commit(); return true; }

  // ---- Misleading Signpost
  if (/^reselect which player or permanent target attacking creature is attacking$/.test(l)){
    const t = a26Tg(ctx)[0]; if (!t || UI.dry) return true; const ap = t.pid || MYPID;
    { const pn = phaseNow(); const cb = typeof cbOf === 'function' ? cbOf(pn) : S.cb; if (!(pn.ph === 4 && cb && /^(atk|atkd)$/.test(cb.step || ''))){ log(`${name}: it didn't enter during the declare attackers step`); return true; } } const c = boardOf(ap).find(b => b.id === t.id); if (!c || !c.atk) return true;
    const opts = []; for (const p of players()){ if (p.pid === ap || (p.s && p.s.lost)) continue; opts.push({label:p.me ? `${p.nm} (you)` : p.nm, value:'p:' + p.pid}); boardOf(p.pid).forEach(b => { if (b.k && !b.fd && /\bPlaneswalker\b/.test(info(b.k)?.t || '')) opts.push({label:`${p.nm}'s ${info(b.k).n}`, value:`c:${p.pid}:${b.id}`}); }); }
    if (!opts.length) return true; const v = await askChoice({title:`${name}: ${cname(c)} attacks…`, options:opts}); if (!v || v === c.atk) return true;
    if (ap === MYPID){ c.atk = v; log(`${cname(c)} now attacks ${opts.find(o => o.value === v).label} (${name})`); } else { sendRq(ap, 'a26reatk', 0, name, {tid:c.id, d:v}); log(`${cname(c)} now attacks ${opts.find(o => o.value === v).label} (${name})`); }
    commit(); return true; }

  // ---- Autumn's Veil
  if (/^spells you control can't be countered by blue or black spells this turn, and creatures you control can't be the targets of blue or black spells this turn$/.test(l)){ S.a26veil = turnStr(); log(`${name}: their spells can't be countered by blue or black spells and their creatures can't be the targets of blue or black spells this turn`); commit(); return true; }

  // ---- Biomancer's Familiar
  if (/^the next time target creature adapts this turn, it adapts as though it had no \+1\/\+1 counters on it$/.test(l)){ const t = a26Tg(ctx)[0]; if (!t) return true;
    if (t.pid === MYPID || !t.pid){ const c = S.bf.find(b => b.id === t.id); if (c){ c.a26adapt = turnStr(); log(`${cname(c)}: its next adapt this turn ignores its +1/+1 counters (${name})`); } } else sendRq(t.pid, 'a26adapt', 0, name, {tid:t.id});
    commit(); return true; }
  if ((m = l.match(/^adapt (\d+)$/))){ const c = src(); if (c && c.a26adapt === turnStr()){ delete c.a26adapt; modCounters(c, 'cp', +m[1]); log(`${cname(c)} adapts ${m[1]} (as though it had no +1/+1 counters)`); commit(); return true; } return false; }

  // ---- Tishana's Tidebinder: the countered ability's permanent loses all abilities while the Tidebinder stays
  if (/^if an ability of an artifact, creature, or planeswalker is countered this way, that permanent loses all abilities for as long as ~ remains on the battlefield$/.test(lt) || /^if an ability of an artifact, creature, or planeswalker is countered this way, that permanent loses all abilities for as long as this creature remains on the battlefield$/.test(l)){
    if (UI.dry) return true; const x = ctx.m24ctrd; const me = src(); if (!x || x.kind === 'spell' || !me) return true;
    const pid = x.pid || MYPID; const sid = x.it ? x.it.srcId : x.srcId; const bf = boardOf(pid); const c = (sid != null && bf.find(b => b.id === sid)) || bf.find(b => b.k === x.k && !b.fd);
    if (!c || !/\b(Artifact|Creature|Planeswalker)\b/.test(typeOf(c))) return true;
    const mod = {noAb:true, s:name, u:'', a26src:{pid:MYPID, id:me.id}};
    if (pid === MYPID) l24addMod(single(c), mod); else sendRq(pid, 'a26noAb', 0, name, {tid:c.id, ref:String(me.id)});
    log(`${cname(c)} loses all abilities for as long as ${name} remains on the battlefield`); commit(); return true; }

  // ---- Dance of the Dead: like Animate Dead, but the creature enters tapped; its controller may pay {1}{B} each upkeep to untap it
  if (/^if it's on the battlefield, it loses "enchant creature card in a graveyard" and gains "enchant creature put onto the battlefield with ~\.?"(?:\.)? put enchanted creature card onto the battlefield tapped under your control and attach ~ to it$/.test(l)){
    await r23fAnimate(ctx); const me = src(); const h = me && me.att && me.att.pid === MYPID ? S.bf.find(b => b.id === me.att.id) : null; if (h){ h.tap = true; log(`${cname(h)} entered tapped (${name})`); commit(); } return true; }
  if (/^(?:that|target) player may pay \{1\}\{b\}$/.test(l) && /if the player does, untap that creature/i.test(info(ctx.k)?.o || '')){
    const me = src(); const h = me && me.att; ctx.didPay = false; if (!h || UI.dry){ ctx.didPay = !!UI.dry; return true; }
    if (h.pid === MYPID){ const plan = payPlan(parseCost('{1}{B}'), S.pool); const c = S.bf.find(b => b.id === h.id); if (!c || !c.tap) return true;
      if (!plan.err && await askYes(`${name}: pay {1}{B} to untap ${cname(c)}?`, 'Pay {1}{B}', 'No')){ S.pool = plan.pool; ctx.didPay = true; } }
    else { sendRq(h.pid, 'a26dance', 0, name, {tid:h.id}); log(`${nameOf(h.pid)} may pay {1}{B} to untap their creature (${name})`); ctx.a26danceSent = true; }
    commit(); return true; }
  if (/^if the player does, untap that creature$/.test(l)){ if (ctx.a26danceSent || UI.dry) return true; const me = src(); const c = ctx.didPay && me && me.att ? S.bf.find(b => b.id === me.att.id) : null; if (c){ c.tap = false; c.tn = 0; log(`untapped ${cname(c)} (${name})`); commit(); } return true; }

  // ---- Firebender Ascension (fired by the pushTrigger hook with the attacking creature's trigger)
  if (l === 'a26 ascension'){ return true; }
  if ((m = l.match(/^a26 ascension (\d+) (\S+)$/))){
    const a = S.bf.find(b => b.id === +m[1]); if (!a) return true; addNamed(a, 'quest', 1); const q = (a.nc || {}).quest || 0; log(`${cname(a)} gets a quest counter (${q})`);
    const x = S.stk.find(it => it.sid === m[2]);
    if (q >= 4 && x && await askYes(`${cname(a)}: copy ${x.nm}'s triggered ability?`, 'Copy it', 'No')) await m24Copy({...pubItem(x), pid:MYPID, it:x}, ctx, {newT:'may'});
    commit(); return true; }

  return false;
}
function a26Blight(id, src){ const c = S.bf.find(b => b.id === id); if (!c) return; addNamed(single(c), 'blight', 1); c.a26ult = 1; log(`${cname(c)} gets a blight counter — it's only a land that taps for {C} while it has one (${src})`); commit(); }
const a26Blighted = c => !!(c && c.a26ult && c.nc && c.nc.blight > 0 && c.k && isLand(c.k));
async function a26TokLinked(make){ const hold = S.bf.filter(c => c.a26link); hold.forEach(c => S.bf.splice(S.bf.indexOf(c), 1)); const before = new Set(S.bf.map(c => c.id)); let tk = null;
  try { await make(); const nw = S.bf.filter(c => c.tok && !before.has(c.id)); tk = nw[nw.length - 1] || null; if (!tk){ const grown = S.bf.filter(c => c.tok && (c.n || 1) > 1).pop(); if (grown) tk = single(grown); } } finally { S.bf.push(...hold.filter(c => !S.bf.includes(c))); }
  if (tk && (tk.n || 1) > 1) tk = single(tk); return tk; }
{ const ct = createToken; createToken = function(k, n, near, o){ const hold = S ? S.bf.filter(c => c.a26link) : []; hold.forEach(c => S.bf.splice(S.bf.indexOf(c), 1)); try { return ct(k, n, near, o); } finally { hold.forEach(c => { if (!S.bf.includes(c)) S.bf.push(c); }); } }; }
function a26GyIn(){ const t = turnStr(); const g = S.a26gy; return g && g.t === t ? g.ids.length : 0; }
function a26GyScan(){ if (!S || UI.dry) return; const t = turnStr(); if (!S.a26gy || S.a26gy.t !== t) S.a26gy = {t, ids:[], seen:S.a26gy && S.a26gy.seen || []};
  const now = S.gy.map(c => c.id); const seen = new Set(S.a26gy.seen); now.forEach(id => { if (!seen.has(id)) S.a26gy.ids.push(id); }); S.a26gy.seen = now; }
function a26Weld(aid, gid, src){
  const a = S.bf.find(b => b.id === aid && descOk(b.k, 'artifact')); const g = S.gy.find(c => c.id === gid && descOk(c.k, 'artifact'));
  if (!a || !g){ log(`${src}: a target is no longer legal — nothing happens`); return; }
  moveCard(a.id, 'gy', {sac:true}); moveCard(g.id, 'bf'); log(`${src}: sacrificed ${cname(a)} and returned ${cname(g)} to the battlefield`); commit();
}
RQ_OPS.push('a26dance', 'a26tutorTop', 'a26surge', 'a26weld', 'a26noBlk', 'a26fray', 'a26ultima', 'a26mana', 'a26reatk', 'a26adapt', 'a26noAb');
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'a26tutorTop'){ if (!UI.dry) searchLibrary('a card', 'put it on top of your library', {name:r.src, it:{}}); return; }
    if (r.op === 'a26fray'){ a26GyScan(); const n = a26GyIn(); if (n) mill(n); log(`${r.src}: milled ${n} (cards put into their graveyard this turn)`); commit(); return; }
    if (r.op === 'a26ultima'){ a26Blight(r.tid, r.src); return; }
    if (r.op === 'a26mana'){ (async () => { const col = await askChoice({title:`${r.src}: add one mana of which color?`, options:[['W', 'White'], ['U', 'Blue'], ['B', 'Black'], ['R', 'Red'], ['G', 'Green']].map(([value, label]) => ({label, value}))}) || 'G'; S.pool[col] = (S.pool[col] || 0) + 1; log(`added {${col}} (${r.src})`); commit(); })(); return; }
    if (r.op === 'a26reatk'){ const c = S.bf.find(b => b.id === r.tid); if (c && c.atk && /^(p:|c:)/.test(String(r.d || ''))){ c.atk = String(r.d); log(`${cname(c)} is now attacking another player or permanent (${r.src})`); commit(); } return; }
    if (r.op === 'a26adapt'){ const c = S.bf.find(b => b.id === r.tid); if (c){ c.a26adapt = turnStr(); log(`${cname(c)}: its next adapt this turn ignores its +1/+1 counters (${r.src})`); commit(); } return; }
    if (r.op === 'a26noAb'){ const c = S.bf.find(b => b.id === r.tid); if (c){ l24addMod(single(c), {noAb:true, s:r.src, u:'', a26src:{pid:from, id:+r.ref}}); log(`${cname(c)} loses all abilities while ${nameOf(from)} controls ${r.src}`); commit(); } return; }
    if (r.op === 'a26dance'){ (async () => { const c = S.bf.find(b => b.id === r.tid); if (!c || !c.tap) return; const plan = payPlan(parseCost('{1}{B}'), S.pool); if (plan.err) return; if (await askYes(`${r.src}: pay {1}{B} to untap ${cname(c)}?`, 'Pay {1}{B}', 'No')){ S.pool = plan.pool; c.tap = false; c.tn = 0; log(`paid {1}{B} and untapped ${cname(c)} (${r.src})`); commit(); } })(); return; }
    if (r.op === 'a26weld'){ a26Weld(r.tid, +r.ref, r.src); return; }
    if (r.op === 'a26noBlk'){ const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c){ c.a26nb = {pid:r.d || from, id:+r.ref, src:r.src}; log(`${cname(c)} can't block while ${nameOf(r.d || from)} controls ${r.src}`); commit(); } return; }
    if (r.op === 'a26surge'){
      const types = String(r.d || '').split(',').filter(Boolean); const seen = []; let hit = null;
      while (S.lib.length){ const c = S.lib.shift(); const t = (info(c.k)?.t || '').split('—')[0]; if (isPermType(t) && types.some(x => new RegExp('\\b' + x + '\\b').test(t))){ hit = c; break; } seen.push(c); }
      if (hit){ S.hand.push(hit); moveCard(hit.id, 'bf', {quiet:true}); log(`revealed ${seen.length + 1} card${seen.length ? 's' : ''} and put ${cname(hit)} onto the battlefield (${r.src})`); } else log(`revealed their library — no matching permanent card (${r.src})`);
      shuffle(seen); S.lib.push(...seen); commit(); return; }
    return ao(r, from);
  };
}
// There and Back Again: can't block while the Saga's controller still controls it
{ const cbk = canBlock; canBlock = function(b, a, apid){ const r = cbk(b, a, apid); if (r) return r; try { const L = b && b.a26nb; if (L){ const on = L.pid === MYPID ? S.bf.some(x => x.id === L.id) : (OPP.get(L.pid)?.bf || []).some(x => x.id === L.id); if (on) return `can't block (${L.src})`; b.a26nb = null; } } catch {} return r; }; }
// Massacre Girl: remember creatures that died with toughness less than 1
EV_TYPES.push('a26die0');
{ const mc = moveCard; moveCard = function(id, to, o = {}){ let low = null; try { if (S && to === 'gy'){ const c = S.bf.find(b => b.id === id); if (c && isCreatureCard(c) && !c.fd && stats(c)[1] < 1) low = c; } } catch {} const r = mc(id, to, o); try { if (low && !S.bf.includes(low)){ emit({type:'a26die0', k:low.k, id:low.id, cnt:1}); (A26.die0 = A26.die0 || []).push(MYPID + ':' + low.id); if (A26.die0.length > 50) A26.die0.shift(); } } catch {} return r; }; }
// Chainer: cast one creature spell from the graveyard this turn
{
  const go = gyOptions; gyOptions = function(c){ const out = go(c) || []; try { if (S && S.a26chain && S.a26chain.t === turnStr() && S.a26chain.n > 0 && c && /\bCreature\b/.test(info(c.k)?.t || '') && !out.some(g => g.kind === 'gycast')) out.push({kind:'gycast', label:`Cast from graveyard ${info(c.k).m} (Chainer)`, mana:info(c.k).m, extra:[], after:'', a26chain:1}); } catch {} return out; };
  const cg = castFromGy; castFromGy = async function(c, g){ const r = await cg(c, g); try { if (g && g.a26chain && find(c.id)[0] !== 'gy' && S.a26chain){ S.a26chain.n--; commit(); } } catch {} return r; };
}
// Wedding Ring: opponent-who-controls-a-Wedding-Ring triggers
{
  const ct = classifyTrig; classifyTrig = function(w, c){
    if (w === 'whenever' && /^an opponent who controls an artifact named (?:wedding ring|~) (draws a card|gains life) during their turn$/.test(c)) return {ev:/draws/.test(c) ? 'draw' : 'gain', subj:'any', ctl:'opp', desc:''};
    return ct(w, c); };
  const tf = trigsOf; trigsOf = function(k, fl){ const out = tf(k, fl); try { for (const t of out){ const m = /^Whenever an opponent who controls an artifact named (?:Wedding Ring|~) (draws a card|gains life) during their turn/i.exec(t.raw || ''); if (m && !/^A26/.test(t.eff)) t.eff = /draws/.test(m[1]) ? 'A26 wedding draw.' : 'A26 wedding gain.'; } } catch {} return out; };
}
// Wild-Magic Sorcerer, Imoti: spells that gain cascade
STATIC_RULES.push(
  [/^the first spell you cast from exile each turn has cascade$/, m => ({kind:'a26exCasc', who:'you'})],
  [/^spells you cast with mana value (\d+) or greater have cascade$/, m => ({kind:'a26mvCasc', who:'you', n:+m[1]})],
  [/^enchantment spells you cast have affinity for auras$/, m => ({kind:'a26affAura', who:'you'})],
);
{
  const ctg = castTriggers; castTriggers = function(c, a, it){ const r = ctg(c, a, it);
    try { S.a26from = S.a26from || {}; S.a26from[c.id] = {t:turnStr(), z:it.from}; const ks = Object.keys(S.a26from); if (ks.length > 60) delete S.a26from[ks[0]]; } catch {}
    try { const mv = it.mv || a.mv || 0; const casc = src => pushTrig(src, 'Exile cards from the top until a nonland card with lower mana value; you may cast it free (cascade).', {k:c.k, cmv:mv});
      if (it.from === 'ex'){ const t = turnStr(); S.a26exN = S.a26exN && S.a26exN.t === t ? S.a26exN : {t, n:0}; S.a26exN.n++; if (S.a26exN.n === 1) rulesOn('a26exCasc').forEach(r => casc(r.src)); }
      rulesOn('a26mvCasc').forEach(r => { if (mv >= r.n) casc(r.src); });
    } catch (e){ console.warn('a26 cascade', e); }
    return r; };
  const ar = affinityRed; affinityRed = function(c){ let n = ar(c); try { if (c && /\bEnchantment\b/.test(info(c.k)?.t || '') && rulesOn('a26affAura').length) n += S.bf.filter(b => !b.fd && /\bAura\b/.test(typeOf(b))).length * rulesOn('a26affAura').length; } catch {} return n; };
}
// links (Ugin's Spirit), Grafted Exoskeleton, graveyard arrivals
{
  const ol = onLeave; onLeave = function(c, to, w){
    try { if (S && c && c.a26link && !UI.dry){ const L = c.a26link; delete c.a26link; pushTrig(L.src, `A26 link return ${L.id} x.`, {k:c.k}); } } catch {}
    try { if (S && c && c.a26h != null && !UI.dry){ const h = S.bf.find(b => b.id === c.a26h && b !== c); if (h) pushTrig(cname(c), `A26 exo sac ${h.id}.`, {k:c.k}); c.a26h = null; } } catch {}
    return ol(c, to, w); };
  const cm = commit; let busy = false;
  commit = function(...a){ if (!busy && S && !UI.dry){ busy = true; try { a26GyScan(); a26ExoScan(); } catch (e){ console.warn('a26 commit', e); } finally { busy = false; } } return cm.apply(this, a); };
}
const A26EXO = /^Whenever (?:~|this Equipment) becomes unattached from a permanent, sacrifice that permanent\.?$/mi;
function a26ExoScan(){
  for (const e of S.bf){ if (e.fd || !e.k || !A26EXO.test(tname(info(e.k)?.o || '', info(e.k)?.n || ''))) continue;
    const cur = e.att && e.att.pid === MYPID && e.att.id != null ? e.att.id : null;
    if (e.a26h != null && e.a26h !== cur){ const h = S.bf.find(b => b.id === e.a26h); if (h) pushTrig(cname(e), `A26 exo sac ${h.id}.`, {k:e.k}); }
    e.a26h = cur; }
}
// Druid Class land: P/T = number of lands you control
{ const st = stats; stats = function(c, pid){ const r = st(c, pid); try { if (c && c.anim === 'a26dc' && S && S.bf.includes(c)){ const n = S.bf.filter(b => isLand(b.k) && !b.fd).length; const pu = c.pu || [0, 0]; const x = (c.cp || 0) - (c.cm || 0); return [n + x + (pu[0] || 0), n + x + (pu[1] || 0)]; } } catch {} return r; }; }
// Multiversal Passage
STATIC_RULES.push([/^(?:as ~ enters, choose a basic land type|then you may pay 2 life|if you don't, it enters tapped|~ is the chosen type)$/, m => ({kind:'a26passage', who:'you'})]);
{
  const oe = onEnter; onEnter = function(c, from, o = {}){ const r = oe(c, from, o);
    try { if (S && c && from !== 'bf' && !c.fd && /^As ~ enters, choose a basic land type\. Then you may pay 2 life\. If you don't, it enters tapped\.$/m.test(tname(info(c.k)?.o || '', info(c.k)?.n || ''))){
      c.tap = true; if (!UI.dry) (async () => { const ty = await askChoice({title:`${cname(c)}: choose a basic land type`, options:['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'].map(x => ({label:x, value:x}))}) || 'Forest';
        c.a26mt = ty; c.r23kType = ty; log(`${cname(c)} is a ${ty}`);
        if (S.life >= 0 && await askYes(`${cname(c)}: pay 2 life so it enters untapped?`, 'Pay 2 life', 'Enter tapped')){ c.tap = false; S.life -= 2; log(`paid 2 life — ${cname(c)} enters untapped`); }
        commit(); })(); } } catch (e){ console.warn(e); }
    return r; };
  const ma = manaAbs; manaAbs = function(c){ const out = ma(c); try { const col = c && c.a26mt && {Plains:'W', Island:'U', Swamp:'B', Mountain:'R', Forest:'G'}[c.a26mt]; if (col && !out.some(o => o.a26mt)) return out.concat({cost:'{T}', eff:`Add {${col}}`, rest:'', outs:[[col]], tapOnly:true, line:`{T}: Add {${col}}. (${c.a26mt})`, a26mt:1}); } catch {} return out; };
}
// Winter Moon: one nonbasic land untaps
STATIC_RULES.push([/^players can't untap more than one nonbasic land during their untap steps$/, m => ({kind:'a26winter', who:'all'})]);
{
  const sp = setPhase; setPhase = function(i){
    if (i !== 0 || !S || UI.dry || !rulesOn('a26winter').length) return sp(i);
    const snap = S.bf.filter(c => c.tap && isLand(c.k) && !/\bBasic\b/.test(info(c.k)?.t || ''));
    const r = sp(i);
    try { const up = snap.filter(c => S.bf.includes(c) && !c.tap); if (up.length > 1){ up.forEach(c => { c.tap = true; }); log(`${rulesOn('a26winter')[0].src}: only one nonbasic land untaps`); (async () => { const ids = await pickCards({title:`${rulesOn('a26winter')[0].src}: untap one nonbasic land`, cards:up, min:1, max:1}); const c = ids && S.bf.find(x => x.id === ids[0]); if (c){ c.tap = false; log(`untapped ${cname(c)}`); } commit(); })(); commit(); } } catch (e){ console.warn(e); }
    return r; };
}
// Library of Leng: a discarded card may go on top of your library instead
STATIC_RULES.push([/^if an effect causes you to discard a card, discard it, but you may put it on top of your library instead of into your graveyard$/, m => ({kind:'a26leng', who:'you'})]);
{
  const mc = moveCard; moveCard = function(id, to, o = {}){ let c = null; try { if (S && to === 'gy' && !UI.dry && phaseNow().n > 0 && rulesOn('a26leng').length){ const f = find(id); if (f[0] === 'hand') c = f[2]; } } catch {} const r = mc(id, to, o);
    try { if (c && S.gy.includes(c)) (async () => { if (await askYes(`Library of Leng: put ${cname(c)} on top of your library instead of into your graveyard?`, 'Put it on top', 'Graveyard')){ const i = S.gy.indexOf(c); if (i >= 0){ S.gy.splice(i, 1); S.lib.unshift(c); log(`put the discarded ${cname(c)} on top of their library (Library of Leng)`); commit(); } } })(); } catch {}
    return r; };
}
// trigger kinds: Breena, Quilled Greatwurm, Malcolm, Grafted Exoskeleton, the Queen of Dale, Skullspore
EV_TYPES.push('a26cd');
{
  const ct = classifyTrig; classifyTrig = function(w, c){
    if (w === 'whenever'){
      if (/^a player attacks one of your opponents$/.test(c)) return {ev:'attack', subj:'any', ctl:'any', desc:'', batch:true, a26breena:true};
      if (/^a creature you control deals combat damage during your turn$/.test(c)) return {ev:'a26cd', subj:'any', ctl:'you', desc:'creature'};
      if (/^one or more pirates you control deal damage to your opponents$/.test(c)) return {ev:'dmg', subj:'any', ctl:'you', desc:'pirate', batch:true, toPlayer:true, oppOnly:true, a26mal:true};
      if (/^(?:~|this equipment) becomes unattached from a permanent$/.test(c)) return {ev:'a26unatt', subj:'self', ctl:'you', desc:''};
      // granted quoted triggers that this file fires itself (Dionus, Danny Pink, The Aetherspark): never fired by the generic event path
      if (/^~ becomes tapped during your turn$/.test(c) || /^one or more counters are put on ~ for the first time each turn$/.test(c) || /^equipped creature deals combat damage during your turn$/.test(c)) return {ev:'a26never', subj:'self', ctl:'you', desc:''};
      if (/^a creature you control attacking causes a triggered ability of that creature to trigger$/.test(c)) return {ev:'a26never', subj:'any', ctl:'you', desc:''};
      if (/^an opponent casts their first noncreature spell each turn$/.test(c)) return {ev:'cast', subj:'any', ctl:'opp', desc:'noncreature', nth:0, a26qd:true};
    }
    return ct(w, c); };
  const pt = pushTrigger; pushTrigger = function(src, t, ev, evPid){
    if (!t || !ev || !S) return pt(src, t, ev, evPid);
    try {
      if (t.a26breena){ const q = (UI.curQ || []).filter(([p, e]) => p === evPid && e.type === 'attack'); const bf = evPid === MYPID ? S.bf : (OPP.get(evPid)?.bf || []); const defs = new Set();
        (q.length ? q : [[evPid, ev]]).forEach(([, e]) => { const c = bf.find(b => b.id === e.id); const k = c && c.atk; const mm = typeof k === 'string' && k.match(/^p:(.+)$/); if (mm && mm[1] !== MYPID) defs.add(mm[1]); });
        for (const dp of defs){ const n0 = S.stk.length; pt(src, t, ev, evPid); const it = S.stk[S.stk.length - 1]; if (S.stk.length > n0 && it){ it.a26def = dp; it.a26atk = evPid; } } return; }
      if (t.a26mal){ const ds = new Set((UI.curQ || []).filter(([p, e]) => p === MYPID && e.type === 'dmg' && e.dp && e.dp !== MYPID && descOk(e.k, 'pirate')).map(([, e]) => e.dp)); if (!ds.size) return; const n0 = S.stk.length; pt(src, t, ev, evPid); if (S.stk.length > n0) S.stk[S.stk.length - 1].a26n = ds.size; return; }
      if (t.ev === 'a26cd'){ if (currentTurn()[1] !== MYPID) return; const n0 = S.stk.length; pt(src, t, ev, evPid); if (S.stk.length > n0){ const it = S.stk[S.stk.length - 1]; it.evN = ev.amt || 0; } return; }
      if (ev.type === 'attack' && evPid === MYPID && src && src.id === ev.id && !src.cz){ const asc = S.bf.filter(b => !b.fd && b.k && /^Whenever a creature you control attacking causes a triggered ability of that creature to trigger, put a quest counter on/m.test(info(b.k)?.o || ''));
        if (asc.length){ const c = S.bf.find(b => b.id === src.id); if (c && isCreatureCard(c)){ const n0 = S.stk.length; pt(src, t, ev, evPid); const x = S.stk.length > n0 ? S.stk[S.stk.length - 1] : null; if (x) asc.forEach(a => pushTrig(cname(a), `A26 ascension ${a.id} ${x.sid}.`, {k:a.k, srcId:a.id})); return; } } }
      if (t.a26qd){ const T = turnStr(); A26.qd = A26.qd || {}; const key = evPid + '|' + T + '|' + ev.n; let r = A26.qd[evPid]; if (!r || r.t !== T) r = A26.qd[evPid] = {t:T, first:ev.n}; if (r.first !== ev.n) return; }
      if (t.ev === 'die' && t.batch && /total power of those creatures/.test(t.raw || '')){ const lk = S.r19lk || {}; const pow = (UI.curQ || []).filter(([p, e]) => p === MYPID && e.type === 'die' && !e.tok).reduce((a, [, e]) => a + Math.max(0, ((lk[e.id] || (UI.g23lkiP || {})[e.id] || [0])[0]) || 0), 0); const n0 = S.stk.length; pt(src, t, ev, evPid); if (S.stk.length > n0) S.stk[S.stk.length - 1].a26pow = pow; return; }
    } catch (e){ console.warn('a26 pushTrigger', e); }
    return pt(src, t, ev, evPid); };
  // combat damage dealt by my creatures during my turn (to anything)
  const ad = attackerDamage; attackerDamage = async function(...a){ UI.a26cb = true; try { return await ad.apply(this, a); } finally { UI.a26cb = false; } };
  const de = r7DamageEvent; r7DamageEvent = function(t, n, srcK, srcCard){ const r = de(t, n, srcK, srcCard); try { if (UI.a26cb && n > 0 && srcCard && S.bf.includes(srcCard)) emit({type:'a26cd', k:srcCard.k, id:srcCard.id, cnt:1, amt:n, dp:t && t.t === 'player' ? t.pid : ''}); } catch {} return r; };
}
// Lethal Scheme: remember which creatures convoked each spell
{ const xp = extraPayments; extraPayments = async function(c, sc){ const before = new Set(S.bf.filter(b => isCreatureCard(b) && !b.tap && !b.fd).map(b => b.id)); const r = await xp(c, sc);
    if (r && r.apply){ const ap = r.apply; r.apply = function(){ const out = ap.apply(this, arguments); try { const ids = S.bf.filter(b => before.has(b.id) && b.tap).map(b => b.id); if (ids.length){ S.a26cv = S.a26cv || {}; S.a26cv[c.id] = ids; const ks = Object.keys(S.a26cv); if (ks.length > 20) delete S.a26cv[ks[0]]; } } catch {} return out; }; }
    return r; }; }
// Exploration Broodship: once each of your turns, cast a permanent spell from your graveyard by also sacrificing a land
STATIC_RULES.push([/^once during each of your turns, you may cast a permanent spell from your graveyard by sacrificing a land in addition to paying its other costs$/, m => ({kind:'a26brood', who:'you'})]);
{
  const go = gyOptions; gyOptions = function(c){ const out = go(c) || []; try { const r = rulesOn('a26brood')[0]; if (r && c && currentTurn()[1] === MYPID && (S.a26brood || '') !== turnStr() && !isLand(c.k) && isPermType(info(c.k)?.t || '') && S.bf.some(b => isLand(b.k) && !b.fd)) out.push({kind:'gycast', label:`Cast from graveyard ${info(c.k).m}, sacrifice a land (${r.src})`, mana:info(c.k).m, extra:[{t:'sac', desc:'land', n:1, label:'sacrifice a land'}], after:'', a26brood:1}); } catch {} return out; };
  const cg = castFromGy; castFromGy = async function(c, g){ const r = await cg(c, g); try { if (g && g.a26brood && find(c.id)[0] !== 'gy'){ S.a26brood = turnStr(); commit(); } } catch {} return r; };
}
// The Aetherspark: loyalty from equipped creature's combat damage on your turn; can't be attacked while attached
function a26AetherHit(src, n){ if (!src || n <= 0 || currentTurn()[1] !== MYPID) return; for (const e of S.bf){ if (e.fd || !e.att || e.att.pid !== MYPID || e.att.id !== src.id) continue; if (!/whenever equipped creature deals combat damage during your turn, put that many loyalty counters on ~/i.test(tname(info(e.k)?.o || '', info(e.k)?.n || ''))) continue; pushTrig(cname(e), `A26 aetherspark ${e.id} ${n}.`, {k:e.k, srcId:e.id}); } }
{ const de = r7DamageEvent; r7DamageEvent = function(t, n, srcK, srcCard){ const r = de(t, n, srcK, srcCard); try { if (UI.a26cb && n > 0 && srcCard && S.bf.includes(srcCard)) a26AetherHit(srcCard, n); } catch {} return r; }; }
{ const dO = defOpts; defOpts = function(){ return dO().filter(o => { const m = /^c:([^:]+):(\d+)$/.exec(o.key || ''); if (!m) return true; const c = boardOf(m[1]).find(x => x.id === +m[2]); return !(c && c.k && c.att && /as long as ~ is attached to a creature, ~ can't be attacked/i.test(tname(info(c.k)?.o || '', info(c.k)?.n || ''))); }); }; }
// Teferi, Master of Time: loyalty abilities at instant speed on any turn
STATIC_RULES.push([/^you may activate loyalty abilities of ~ on any player's turn any time you could cast an instant$/, m => ({kind:'a26teferi', who:'you'})]);
{ const lr = loyaltyReady; loyaltyReady = function(c, ab){ const r = lr(c, ab); try { if ((r === 'Only on your turn' || r === 'Only in your main phase with an empty stack') && /you may activate loyalty abilities of ~ on any player's turn any time you could cast an instant/i.test(tname(info(c.k)?.o || '', info(c.k)?.n || ''))){
      if (c.lu === turnStr()) return 'Already used a loyalty ability this turn'; const v = /X/.test(ab.cost) ? 0 : +ab.cost; if (v < 0 && (c.co || 0) < -v) return `Needs ${-v} loyalty`; const top = stackTop(); if (top && top.ss) return 'Split second'; return ''; } } catch {} return r; }; }
// Ichormoon Gauntlet: planeswalkers you control have [0]: Proliferate and [−12]: Take an extra turn after this one
STATIC_RULES.push([/^planeswalkers you control have "\[0\]: proliferate" and "\[[−-]12\]: take an extra turn after this one\.?"$/, m => ({kind:'a26ichor', who:'you'})]);
{ const la = loyaltyAbs; loyaltyAbs = function(c){ const out = la(c); try { if (c && S && S.bf.includes(c) && isPW(c) && rulesOn('a26ichor').length && !out.some(a => a.a26)) return out.concat({raw:'0', cost:'0', eff:'Proliferate.', a26:1}, {raw:'−12', cost:'-12', eff:'Take an extra turn after this one.', a26:1}); } catch {} return out; }; }
// Dionus (Elves untap once on your turn) and Danny Pink (first counters each turn draw)
{
  const he = handleEvent; handleEvent = function(pid, ev){ const r = he(pid, ev);
    try { if (S && pid === MYPID && !UI.dry){
      if (ev.type === 'tapped' && currentTurn()[1] === MYPID){ const c = S.bf.find(b => b.id === ev.id); const lg = c && typeof l24eff === 'function' ? l24eff(c, MYPID) : null; if (lg && (lg.ab || []).some(g => /becomes tapped during your turn/i.test(g.t || ''))) return r; /* the layer pass fires it itself */ const src = S.bf.find(b => !b.fd && b.k && /^elves you control have "whenever this creature becomes tapped during your turn, untap it and put a \+1\/\+1 counter on it\. this ability triggers only once each turn\.?"$/im.test(info(b.k)?.o || ''));
        if (c && src && /\bElf\b/.test(typeOf(c)) && isCreatureCard(c)){ S.a26dio = S.a26dio || {}; if (S.a26dio[c.id] !== turnStr()){ S.a26dio[c.id] = turnStr(); pushTrig(cname(c), `A26 dionus ${c.id}.`, {k:c.k, srcId:c.id}); } } }
      if (ev.type === 'r21ctr'){ const c = S.bf.find(b => b.id === ev.id); const src = S.bf.find(b => !b.fd && b.k && /^creatures you control have "whenever one or more counters are put on this creature for the first time each turn, draw a card\.?"$/im.test(info(b.k)?.o || ''));
        if (c && src && isCreatureCard(c)){ S.a26dp = S.a26dp || {}; if (S.a26dp[c.id] !== turnStr()){ S.a26dp[c.id] = turnStr(); pushTrig(cname(c), 'Draw a card.', {k:c.k, srcId:c.id}); } } }
    } } catch (e){ console.warn('a26 events', e); }
    return r; }; }
// Ultima: blighted lands lose land types and abilities and tap for {C}; tapping a land for {C} adds an additional {C}
{
  const ma = manaAbs; manaAbs = function(c){ const out = ma(c); try { if (a26Blighted(c)) return [{cost:'{T}', eff:'Add {C}', rest:'', outs:[['C']], tapOnly:true, line:'{T}: Add {C}. (blight counter)', a26bl:1}]; } catch {} return out; };
  const to = typeOf; typeOf = c => { const t = to(c); try { if (a26Blighted(c)) return t.split('—')[0].trim(); } catch {} return t; };
  const ab = abilityList; abilityList = function(c){ const r = ab(c); try { if (a26Blighted(c)) return []; } catch {} return r; };
  const te = r23fTapExtras; r23fTapExtras = function(c, abl, outs, auto){ const ex = te(c, abl, outs, auto); try { if (c && c.k && isLand(c.k) && outs && outs.includes('C') && /\{T\}/i.test((abl && abl.cost) || '{T}')){ for (const b of S.bf){ if (!b.fd && b.k && /^whenever you tap a land for \{c\}, add an additional \{c\}\.?$/im.test(tname(info(b.k)?.o || '', info(b.k)?.n || ''))) ex.push('C'); } }
      // Gauntlet of Power controlled by another player: its controller (me) still gets the extra mana
      if (c && c.k && isLand(c.k) && /\bBasic\b/.test(info(c.k)?.t || '') && /\{T\}/i.test((abl && abl.cost) || '{T}')) for (const [, st] of OPP) for (const b of (st.bf || [])){ if (!b.k || b.fd || !b.a26col) continue; if (/^whenever a basic land is tapped for mana of the chosen colou?r, its controller adds an additional one mana of that colou?r\.?$/im.test(info(b.k)?.o || '') && (outs || []).includes(b.a26col)) ex.push(b.a26col); }
    } catch {} return ex; };
  const cpe = cardPublicExtra; cardPublicExtra = function(c){ const o = cpe(c); if (c && typeof c.col === 'string' && /^[WUBRG]$/.test(c.col)) o.a26col = c.col; return o; };
  const ss = sanitizeState; sanitizeState = function(s){ const r = ss(s); try { if (r && s && Array.isArray(s.bf)) r.bf.forEach((c, i) => { const o = s.bf[i]; if (o && typeof o.a26col === 'string' && /^[WUBRG]$/.test(o.a26col)) c.a26col = o.a26col; }); } catch {} return r; };
  const ct = classifyTrig; classifyTrig = function(w, c){ if (w === 'whenever' && /^you tap a land for \{c\}$/.test(c)) return {ev:'manaHandled', subj:'any', ctl:'you', desc:''}; return ct(w, c); };
}
// The Warring Triad: not a creature with fewer than eight cards in its controller's graveyard
STATIC_RULES.push([/^as long as there are fewer than eight cards in your graveyard, ~ isn't a creature$/, m => ({kind:'a26triad', who:'you'})]);
{ const ic = isCreatureCard; isCreatureCard = c => { const r = ic(c); try { if (r && c && c.k && S && (info(c.k)?.o || '').includes('fewer than eight cards in your graveyard') && /as long as there are fewer than eight cards in your graveyard, ~ isn't a creature/i.test(tname(info(c.k)?.o || '', info(c.k)?.n || ''))){ const pid = S.bf.includes(c) ? MYPID : (typeof l24pidOf === 'function' ? l24pidOf(c) : null); if (!pid) return r; const gy = pid === MYPID ? S.gy.length : (OPP.get(pid)?.gy || []).length; if (gy < 8) return false; } } catch {} return r; }; }
// Autumn's Veil: blue or black spells can't counter my spells or target my creatures this turn
{
  const ep = enginePublic; enginePublic = function(){ const o = ep(); try { if (S.a26veil === turnStr()) o.a26veil = S.a26veil; } catch {} return o; };
  const se = sanitizeEngine; sanitizeEngine = function(s){ const o = se(s); try { if (s && s.a26veil) o.a26veil = String(s.a26veil).slice(0, 20); } catch {} return o; };
  const veil = pid => pid === MYPID ? S.a26veil === turnStr() : OPP.get(pid)?.a26veil === turnStr();
  const ubSpell = () => { const c = UI.casting && (typeof N24CASTC !== 'undefined' ? N24CASTC : null); const col = c ? (info(c.k)?.c || '') : ''; return /[UB]/.test(col) ? c : null; };
  const cl = counterLegal; counterLegal = function(it, cs){ const r = cl(it, cs); try { if (r && r.ok && it && it.kind === 'spell' && veil(it.pid || MYPID)){ const c = ubSpell(); if (c) return {ok:false, why:`it can't be countered by blue or black spells this turn (Autumn's Veil)`}; } } catch {} return r; };
  const tc = targetCands; targetCands = function(spec, srcx){ const out = tc(spec, srcx); try { const col = String((srcx && srcx.col) || ''); if (UI.casting && /[UB]/.test(col) && Array.isArray(out)) out.forEach(o => { if (!o || !o.ok || !o.pid || !veil(o.pid) || o.t === 'player') return; const c = boardOf(o.pid).find(b => b.id === o.id); if (c && isCreatureCard(c)){ o.ok = false; o.why = "can't be the target of blue or black spells this turn (Autumn's Veil)"; } }); } catch {} return out; };
}
// "for as long as <source> remains on the battlefield" layer records
{ const lv = l24live; l24live = function(m){ if (!lv(m)) return false; try { const a = m && m.a26src; if (a){ return a.pid === MYPID ? S.bf.some(b => b.id === a.id) : (OPP.get(a.pid)?.bf || []).some(b => b.id === a.id); } } catch {} return true; }; }
// Starfield of Nyx: with five or more enchantments, other non-Aura enchantments are creatures with base P/T = mana value
STATIC_RULES.push([/^as long as you control five or more enchantments, each other non-aura enchantment you control is a creature in addition to its other types and has base power and base toughness each equal to its mana value$/, m => ({kind:'a26nyx', who:'you'})]);
function a26Nyx(c){ if (!c || !S || c.fd || !c.k || !S.bf.includes(c)) return false; const t = info(c.k)?.t || ''; if (!/\bEnchantment\b/.test(t) || /\bAura\b/.test(t)) return false;
  const src = S.bf.filter(b => !b.fd && b.k && /as long as you control five or more enchantments, each other non-aura enchantment you control is a creature/i.test(info(b.k)?.o || '')); if (!src.length || src.every(b => b === c)) return false;
  return S.bf.filter(b => !b.fd && b.k && /\bEnchantment\b/.test(info(b.k)?.t || '')).length >= 5; }
{
  const ic = isCreatureCard; isCreatureCard = c => ic(c) || a26Nyx(c);
  const to = typeOf; typeOf = c => { const t = to(c); try { if (a26Nyx(c) && !/\bCreature\b/.test(t)) return t.replace(/\bEnchantment\b/, 'Enchantment Creature'); } catch {} return t; };
  const st = stats; stats = function(c, pid){ const r = st(c, pid); try { if (a26Nyx(c) && !/\bCreature\b/.test(info(c.k)?.t || '')){ const mv = +(info(c.k)?.mv) || 0; const x = (c.cp || 0) - (c.cm || 0); const pu = c.pu || [0, 0]; return [mv + x + (pu[0] || 0), mv + x + (pu[1] || 0)]; } } catch {} return r; };
}
// Timely Ward: flash if it targets a commander
STATIC_RULES.push([/^you may cast ~ as though it had flash if it targets a commander$/, m => ({kind:'a26cmdFlash', who:'you'})]);
{
  const isCmd = (pid, id) => !!boardOf(pid).find(b => b.id === id && b.cmd);
  const tm = timingOk; timingOk = function(c){ const r = tm(c); try { if (r && !r.ok && c && /^Sorcery speed/.test(r.why || '') && /you may cast (?:~|this spell) as though it had flash if it targets a commander/i.test(tname(info(c.k)?.o || '', info(c.k)?.n || '')) && boardsAll().some(b => b.bf.some(x => x.k && !x.fd && x.cmd && isCreatureCard(x)))){ UI.a26cmdFlash = c.id; return {ok:true}; } } catch {} return r; };
  const tc = targetCands; targetCands = function(spec, srcx){ const out = tc(spec, srcx); try { if (UI.casting && UI.a26cmdFlash != null && srcx && srcx.id === UI.a26cmdFlash && Array.isArray(out)) out.forEach(o => { if (o && o.ok && !isCmd(o.pid || MYPID, o.id)){ o.ok = false; o.why = 'cast at instant speed, it must target a commander'; } }); } catch {} return out; };
  const bc = beginCast; beginCast = async function(c, zone, o = {}){ try { return await bc(c, zone, o); } finally { if (c && UI.a26cmdFlash === c.id) UI.a26cmdFlash = null; } };
}
// Gandalf the White: legendary permanents and artifacts entering or leaving make your permanents' triggers trigger again
STATIC_RULES.push([/^if a legendary permanent or an artifact entering or leaving the battlefield causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time$/, m => ({kind:'a26gandalf', who:'you'})]);
{ const tm = trigMult; trigMult = function(ev, src){ let n = tm(ev, src); try { if (ev && S && /^(enter|leave|die)$/.test(ev.type) && ev.k && src && !src.cz && (S.bf.some(b => b.id === src.id) || src.gone)){ const t = info(ev.k)?.t || ''; if (/\b(Legendary|Artifact)\b/.test(t)) n += rulesOn('a26gandalf').length; } } catch {} return n; }; }
// Weathered Sentinels: may attack players who attacked you during their last turn, despite defender
STATIC_RULES.push([/^~ can attack players who attacked you during their last turn as though it didn't have defender$/, m => ({kind:'a26sent', who:'you'})]);
const A26SENT = /~ can attack players who attacked you during their last turn as though it didn't have defender/i;
function a26AttackedMe(pid){ const lt = (S.a26lt || {})[pid]; return !!lt && (S.a26am || {})[pid] === lt; }
{
  const cm = commit; commit = function(...a){ try { if (S && !UI.dry && phaseNow().n > 0){ const [, pid] = currentTurn(); if (pid){ S.a26lt = S.a26lt || {}; S.a26lt[pid] = turnStr(); } } } catch {} return cm.apply(this, a); };
  const he = handleEvent; handleEvent = function(pid, ev){ const r = he(pid, ev); try { if (S && ev && ev.type === 'attack' && pid !== MYPID && ev.dp === MYPID){ S.a26am = S.a26am || {}; S.a26am[pid] = turnStr(); } } catch {} return r; };
  const ca = canAttack; canAttack = function(c){ const r = ca(c); try { if (r === 'defender' && c && A26SENT.test(tname(textOf(c), cname(c))) && opponents().some(p => a26AttackedMe(p.pid))){ return ''; } } catch {} return r; };
  const da = declareAttackers; declareAttackers = function(...a){ try { for (const [id, def] of Object.entries(UI.atkSel || {})){ if (!def) continue; const c = S.bf.find(x => x.id === +id); if (!c || !kwOf(c, 'defender') || !A26SENT.test(tname(textOf(c), cname(c)))) continue; const d = parseDef(def); if (!d || d.t !== 'player' || !a26AttackedMe(d.pid)){ toast(`${cname(c)} can only attack a player who attacked you during their last turn`); return; } } } catch {} return da.apply(this, a); };
}
{ const eb = earthbend; earthbend = async function(n, ctx){ const before = new Map(S.bf.map(c => [c.id, c.cp || 0])); const r = await eb(n, ctx); const c = S.bf.find(x => isLand(x.k) && (x.cp || 0) > (before.get(x.id) || 0)); if (c && ctx) ctx.a26eb = c.id; return r; }; }

// Conduit of Worlds: no more spells this turn
{ const cc = castCheck; castCheck = function(c, zone){ const r = cc(c, zone); try { if (r && r.ok && S && S.a26noCast === turnStr() && c && !isLand(c.k)) return {ok:false, why:"You can't cast additional spells this turn (Conduit of Worlds)"}; } catch {} return r; }; }

{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound26APre(s, l, ctx)) return; return ds(s0, ctx); }; }
