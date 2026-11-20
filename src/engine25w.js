/* ===================== Rules engine — round 25 helper W: long tail, ranks 5011–6999 ===================== */
const W25 = {};
function w25Src(ctx){ return srcCardOf(ctx); }
function w25Tg(ctx){ return (ctx.tgts ? nextTargets(ctx) : []); }
function w25Mv(k){ return +(info(k)?.mv) || 0; }
function w25Mine(){ try { return currentTurn()[1] === MYPID; } catch { return true; } }
function w25Ctr(t, kind, n, src){ if (!t || n <= 0) return; if (t.pid === MYPID || !t.pid){ const c = S.bf.find(b => b.id === t.id); if (!c) return; if (kind === 'cp') modCounters(c, 'cp', n); else addNamed(c, kind, n); log(`${cname(c)} gets ${n} ${kind === 'cp' ? '+1/+1' : kind} counter${n === 1 ? '' : 's'} (${src})`); }
  else applyTo(t, {op:'ctr', n, d:kind, src}); }
const W25KIND = k => k === '+1/+1' ? 'cp' : k === '-1/-1' ? 'cm' : k;

async function doRound25WPre(s, l, ctx){
  let m; const name = ctx.name || ''; const full = String(ctx.full || '').toLowerCase();
  const say = t => doSentence(cap(t), ctx);
  const src = () => w25Src(ctx);

  // ---- Arwen: counters on that creature and on ~
  if ((m = l.match(/^put an? ([+\-a-z0-9\/]+) counter and an? ([a-z]+) counter on that creature and an? \1 counter and an? \2 counter on ~$/))){
    const t = (ctx.lastT || [])[0]; const k1 = W25KIND(m[1]), k2 = W25KIND(m[2]);
    if (t && t.t !== 'player'){ w25Ctr(t, k1, 1, name); w25Ctr(t, k2, 1, name); }
    const c = src(); if (c && S.bf.includes(c)){ w25Ctr({pid:MYPID, id:c.id}, k1, 1, name); w25Ctr({pid:MYPID, id:c.id}, k2, 1, name); }
    commit(); return true; }

  // ---- Doors of Durin (the generic "if … revealed this way" splitter loses the card)
  if (/^if a creature card is revealed this way, put it onto the battlefield tapped and attacking$/.test(l)){
    const c = ctx.lastRev || S.lib[0]; if (c && isCreatureCard(c) && S.lib.includes(c) && !UI.dry){ moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id);
      if (b){ b.tap = true; b.atk = (defOpts()[0] || {}).key || ''; ctx.lastCardId = b.id; ctx.lastT = [{t:'card', pid:MYPID, id:b.id, k:b.k, nm:cname(b)}]; log(`put ${cname(b)} onto the battlefield tapped and attacking`); } }
    else if (c && !UI.dry) log(`${name}: revealed ${cname(c)} — not a creature`);
    commit(); return true; }

  // ---- pay N {E} (Lightning Runner)
  if ((m = l.match(/^(?:you may )?pay (one|two|three|four|five|six|seven|eight|nine|ten|\d+) \{e\}$/))){
    const n = wn(m[1]) || +m[1] || 0; const have = (S.pc || {}).energy || 0;
    if (have < n){ ctx.didPay = false; log(`${name}: can't pay ${n} energy (have ${have})`); return true; }
    if (/^you may/.test(l) && !UI.dry && !(await askYes(`${name}: pay ${n} energy? (you have ${have})`, 'Pay', 'No'))){ ctx.didPay = false; return true; }
    addPC('energy', -n); ctx.didPay = true; commit(); return true; }
  // Aether Refinery: pay one or more {E} → X/X Aetherborn
  if (/^(?:you may )?pay one or more \{e\}$/.test(l)){
    const have = (S.pc || {}).energy || 0; if (!have || UI.dry){ ctx.didPay = !!UI.dry; ctx.w25E = UI.dry ? 1 : 0; return true; }
    const n = await askNumber(`${name}: pay how much energy? (you have ${have}; 0 = none)`, String(have), 0); const k = clamp(+n || 0, 0, have);
    if (!k){ ctx.didPay = false; return true; } addPC('energy', -k); ctx.didPay = true; ctx.w25E = k; commit(); return true; }
  if ((m = l.match(/^if you do, create an x\/x (.+?) creature token, where x is the amount of \{e\} paid this way$/))){
    if (ctx.didPay === false || !ctx.w25E) return true; const x = ctx.w25E; await createFromText(`Create a ${x}/${x} ${s.match(/X\/X (.+?) creature token/i)[1]} creature token`, ctx); return true; }

  // ---- Agility Bobblehead: up to X target creatures each gain haste and can't be blocked except by haste creatures
  if ((m = l.match(/^up to x target creatures you control each gain haste until end of turn and can't be blocked this turn except by creatures with haste, where x is .+$/))){
    for (const t of w25Tg(ctx)) applyTo(t, {op:'pump', src:name, f:{p:0, t:0, kw:['haste', 'w25hasteOnly']}}); commit(); return true; }

  // ---- Valkyrie's Call
  if (/^return that card to the battlefield under its owner's control with a \+1\/\+1 counter on it$/.test(l)){
    const id = ctx.it && ctx.it.evId; const c = id != null ? S.gy.find(x => x.id === id) : null;
    if (c){ moveCard(c.id, 'bf'); const b = S.bf.find(x => x.id === c.id); if (b){ modCounters(b, 'cp', 1); ctx.w25Ret = b.id; } } commit(); return true; }
  if (/^it has flying and is an angel in addition to its other types$/.test(l)){
    const b = ctx.w25Ret != null ? S.bf.find(x => x.id === ctx.w25Ret) : null; if (b){ l24addMod(b, {s:name, u:'', addS:['Angel'], kw:['flying']}); log(`${cname(b)} has flying and is an Angel`); commit(); } return true; }

  // ---- Rakdos, the Muscle: exile from target player's library equal to its mana value; play until your next end step
  if (/^exile cards equal to its mana value from the top of target player's library$/.test(l)){
    const k = ctx.it && ctx.it.evk; const n = k ? w25Mv(k) : 0; const t = w25Tg(ctx).find(x => x.t === 'player'); const pid = t && t.pid;
    ctx.w25RkN = n; if (!n || !pid) return true; const w = 'pa' + (w25Mine() ? '' : 'n');
    if (pid === MYPID){ const top = S.lib.slice(0, n); top.forEach(c => moveCard(c.id, 'ex', {quiet:true})); ctx.lastEx = top.map(c => c.id); log(`${name}: exiled ${top.map(cname).join(', ')}`); }
    else await r21ExileFrom([pid], ctx, {n, w});
    commit(); return true; }
  if (/^until your next end step, you may play those cards, and mana of any type can be spent to cast those spells$/.test(l)){
    const mine = (ctx.lastEx || []).map(id => S.ex.find(c => c.id === id)).filter(c => c && !c.own);
    if (mine.length){ mine.forEach(c => { c.mayPlay = {t:turnStr(), next:!w25Mine(), cast:false, src:name, u0:S.untapN, any:true}; }); log(`${name}: may play ${mine.map(cname).join(', ')} until your next end step`); }
    commit(); return true; }

  // ---- play those cards until your next end step (Opera Love Song)
  if (/^(?:you may )?play those cards until your next end step$/.test(l)){ const ids = ctx.lastEx || []; if (ids.length) grantPlay(ids, {src:name, next:!w25Mine()}); return true; }

  // ---- Xenagos −6: any number of creature and/or land cards from among them onto the battlefield
  if ((m = l.match(/^(?:you may )?put any number of (creature and\/or land|creature|land|permanent|artifact and\/or creature) cards from among them onto the battlefield$/))){
    const d = m[1].replace(' and/or ', ' or '); const list = (ctx.lastEx || []).map(id => S.ex.find(c => c.id === id)).filter(c => c && descOk(c.k, d));
    if (!list.length || UI.dry) return true;
    const ids = await pickCards({title:`${name}: put any number onto the battlefield`, cards:list, max:list.length, min:0});
    (ids || []).forEach(id => moveCard(id, 'bf')); commit(); return true; }

  // ---- Oona: choose a color; target opponent exiles the top X; Faerie Rogue per card of that color
  if (/^choose a color$/.test(l) && /for each card of the chosen color exiled this way/.test(full)){
    ctx.w25Col = UI.dry ? 'U' : (await askChoice({title:`${name}: choose a color`, options:[['W', 'White'], ['U', 'Blue'], ['B', 'Black'], ['R', 'Red'], ['G', 'Green']].map(([v, label]) => ({label, value:v}))})) || 'U'; return true; }
  if (/^target opponent exiles the top x cards of their library$/.test(l)){
    const n = (ctx.it && ctx.it.x) || 0; const t = w25Tg(ctx).find(x => x.t === 'player'); ctx.w25OonaN = 0; if (!t || !n || t.pid === MYPID) return true;
    const res = await r21Ask(t.pid, 'r21exTop', n, name, {d:'r'}); const col = ctx.w25Col || 'U';
    const ks = (UI.r21tok && UI.r21tok[res.tok] || []).map(id => S.ex.find(c => c.id === id)).filter(Boolean);
    ctx.w25OonaN = ks.filter(c => (info(c.k)?.c || '').includes(col)).length;
    ks.forEach(c => r21Drop(c, '')); commit(); return true; }
  if (/^for each card of the chosen color exiled this way, create a 1\/1 blue and black faerie rogue creature token with flying$/.test(l)){
    const n = ctx.w25OonaN || 0; if (n || UI.dry) await createFromText(`Create ${Math.max(1, n)} 1/1 blue and black Faerie Rogue creature tokens with flying`, UI.dry ? ctx : ctx); return true; }

  // ---- Observed Stasis: draw a card for each tapped creature its controller controls
  if (/^(?:then )?draw a card for each tapped creature its controller controls$/.test(l)){
    const a = src(); const h = a && a.att; let n = 0;
    if (h){ const bf = h.pid === MYPID ? S.bf : (OPP.get(h.pid)?.bf || []); n = bf.filter(c => c.k && !c.fd && c.tap && isCreatureCard(c)).reduce((s, c) => s + (c.n || 1), 0); }
    if (n) draw(n); else log(`${name}: no tapped creatures`); commit(); return true; }

  // ---- Disorder in the Court: investigate X times
  if (/^(?:then )?investigate x times$/.test(l)){ const n = (ctx.it && ctx.it.x) || 0; for (let i = 0; i < Math.min(n, 20); i++) await say('Investigate'); return true; }

  // ---- Crypt Sliver: regenerate target Sliver (any one creature type)
  if ((m = l.match(/^regenerate target ([a-z]+)$/)) && !/^(creature|permanent|artifact)$/.test(m[1])){
    const t = w25Tg(ctx)[0]; if (!t) return true;
    if (t.pid === MYPID){ const c = S.bf.find(x => x.id === t.id); if (c){ c.regen = (c.regen || 0) + 1; log(`${cname(c)} will regenerate (${name})`); } }
    else sendRq(t.pid, 'w25regen', 1, name, {tid:t.id});
    commit(); return true; }


  // ---- Kellan, the Kid: a permanent spell with equal or lesser mana value from your hand, free; otherwise a land
  if (/^(?:you may )?cast a permanent spell with equal or lesser mana value from your hand without paying its mana cost$/.test(l)){
    const mv = ctx.it && ctx.it.evk ? w25Mv(ctx.it.evk) : 0; ctx.w25cast = false;
    const list = S.hand.filter(c => !isLand(c.k) && isPermType(info(c.k)?.t) && w25Mv(c.k) <= mv); if (!list.length || UI.dry) return true;
    const ids = await pickCards({title:`${name}: cast a permanent spell with mana value ${mv} or less for free?`, cards:list, min:0, max:1, noneLabel:"Don't"});
    const c = ids && ids[0] != null ? S.hand.find(x => x.id === ids[0]) : null; if (c){ ctx.w25cast = true; UI.afterCast = () => {}; await beginCast(c, 'hand', {free:true}); } return true; }
  if (/^if you don't, you may put a land card from your hand onto the battlefield$/.test(l) && ctx.w25cast !== undefined){
    if (ctx.w25cast) return true; const list = S.hand.filter(c => isLand(c.k)); if (!list.length || UI.dry) return true;
    const ids = await pickCards({title:`${name}: put a land card from your hand onto the battlefield?`, cards:list, min:0, max:1, noneLabel:"Don't"}); if (ids && ids[0] != null) moveCard(ids[0], 'bf'); commit(); return true; }

  // ---- Doomsday
  if (/^search your library and graveyard for five cards and exile the rest$/.test(l)){
    const pool = S.lib.concat(S.gy); ctx.w25dd = [];
    if (UI.dry){ ctx.w25dd = pool.slice(0, 5).map(c => c.id); return true; }
    const n = Math.min(5, pool.length); const ids = n ? await pickCards({title:`${name}: choose five cards (the first one you pick ends up on top)`, cards:pool, min:n, max:n}) : [];
    ctx.w25dd = (ids || []).slice(0, 5); const keep = new Set(ctx.w25dd);
    pool.filter(c => !keep.has(c.id)).forEach(c => moveCard(c.id, 'ex', {quiet:true})); log(`${name}: exiled ${pool.length - keep.size} cards from library and graveyard`); commit(); return true; }
  if (/^put the chosen cards on top of your library in any order$/.test(l) && ctx.w25dd){
    const ids = ctx.w25dd.slice().reverse(); for (const id of ids){ const z = find(id)[0]; if (!z) continue; if (z === 'lib'){ const i = S.lib.findIndex(c => c.id === id); const [c] = S.lib.splice(i, 1); S.lib.unshift(c); } else moveCard(id, 'lib', {quiet:true}); }
    if (ids.length) log(`${name}: put ${ids.length} chosen cards on top of the library`); commit(); return true; }
  if ((m = l.match(/^(you|each opponent|target player|each player) loses? half (?:your|their|his or her) life, rounded (up|down)$/))){
    const half = v => m[2] === 'up' ? Math.ceil(Math.max(0, v) / 2) : Math.floor(Math.max(0, v) / 2);
    const pids = m[1] === 'you' ? [MYPID] : m[1] === 'each opponent' ? opponents().map(p => p.pid) : m[1] === 'each player' ? players().map(p => p.pid) : [(w25Tg(ctx).find(x => x.t === 'player') || {}).pid].filter(Boolean);
    for (const pid of pids){ const life = pid === MYPID ? S.life : (OPP.get(pid)?.life ?? 0); const n = half(life); if (n) await loseLife(pid, n, name); }
    commit(); return true; }

  // ---- The Rollercrusher Ride: X damage to each of up to X target creatures
  if (/^(?:~|it) deals x damage to each of up to x target creatures$/.test(l)){
    const c = src(); const x = (ctx.it && ctx.it.x) || (c && c.xv) || 0; const f = srcFlags(ctx.k, MYPID, c);
    for (const t of w25Tg(ctx).slice(0, x)){ if (t.pid === MYPID) dealDamage(t, x, ctx.k, c); else applyTo(t, {op:'dmg', n:x, src:name, f}); } commit(); return true; }

  // ---- predefined tokens whose name the card's own short name swallowed (Mutagen Man → "create X ~ tokens")
  if ((m = l.match(/^create (x|a|an|one|two|three|four|\d+) ~ tokens?$/))){
    const o = String(info(ctx.k)?.o || ''); const w = (o.match(/create (?:X|an?|one|two|three|four|\d+) (Treasure|Food|Clue|Gold|Blood|Map|Powerstone|Incubator|Junk|Shard|Mutagen|Lander|Walker) tokens?/i) || [])[1];
    if (!w) return false; const c = src(); const n = m[1] === 'x' ? ((ctx.it && ctx.it.x) || (c && c.xv) || (UI.dry ? 2 : 0)) : (wn(m[1]) || +m[1] || 1);
    if (n > 0) await createFromText(`Create ${n} ${w} token${n === 1 ? '' : 's'}`, ctx); return true; }

  // ---- Sidisi: return target creature card with mana value X plus 1 (X = the sacrificed creature's mana value)
  if (/^return target creature card with mana value x plus 1 from your graveyard to the battlefield$/.test(l)){
    const t = w25Tg(ctx)[0]; const it = ctx.it || {}; const sk = it.sacd && it.sacd.k; const x = sk ? w25Mv(sk) : (it.x || 0);
    const c = t && S.gy.find(g => g.id === t.id); if (!c) return true;
    if (sk && w25Mv(c.k) !== x + 1){ log(`${name}: ${cname(c)} doesn't have mana value ${x + 1}`); return true; }
    moveCard(c.id, 'bf'); commit(); return true; }

  // ---- Hooded Blightfang: destroy that planeswalker (the one dealt damage)
  if (/^destroy that planeswalker$/.test(l)){
    const tg = ctx.it && ctx.it.evTgt; const t = tg || (ctx.lastT || []).find(x => x.t === 'card'); if (!t || UI.dry || t.t === 'player') return true;
    const pc = (t.pid === MYPID ? S.bf : (OPP.get(t.pid)?.bf || [])).find(b => b.id === t.id); if (!pc || !isPW(pc)) return true;
    applyTo(t, {op:'destroy', src:name}); commit(); return true; }

  // ---- Batwing Brume / color-spent riders: "… if {W} was spent to cast ~"
  if ((m = l.match(/^(.+) if \{([wubrg])\} was spent to cast ~$/))){
    const col = m[2].toUpperCase(); const sp = n24spFor(ctx); const ok = UI.dry || !sp || !sp.col || (sp.col[col] || 0) > 0;
    if (!ok){ log(`${name}: no {${col}} was spent — skipped`); return true; } await say(s.slice(0, m[1].length)); return true; }
  if (/^each player loses 1 life for each attacking creature they control$/.test(l)){
    const cnt = bf => (bf || []).filter(c => c.k && !c.fd && c.atk).reduce((a, c) => a + (c.n || 1), 0);
    const me = cnt(S.bf); if (me) await loseLife(MYPID, me, name); for (const p of opponents()){ const n = cnt(OPP.get(p.pid)?.bf); if (n) await loseLife(p.pid, n, name); } commit(); return true; }

  // ---- Wolverine: if ~ dealt damage to another creature this turn
  if ((m = l.match(/^if ~ dealt damage to another creature this turn, put an? \+1\/\+1 counter on (?:him|her|it|~)$/))){
    const c = src(); if (!c || !S.bf.includes(c)) return true; if (c.w25dc !== turnStr() && !UI.dry){ log(`${name}: didn't deal damage to another creature this turn`); return true; }
    modCounters(c, 'cp', 1); log(`${cname(c)} gets a +1/+1 counter`); commit(); return true; }

  // ---- Evercoat Ursine: two hideaway instances; play one of the hidden cards free
  if ((m = l.match(/^hideaway (\d+)$/)) && /^hideaway (\d+), hideaway \1$/im.test(String(info(ctx.k)?.o || ''))){
    const n = +m[1]; const top = S.lib.slice(0, n); if (!top.length) return true; const sc = src();
    const ids = top.length === 1 || UI.dry ? [top[0].id] : await pickCards({title:`${name}: hideaway — exile one face down`, cards:top, min:1, max:1}); const h = top.find(c => c.id === (ids || [])[0]) || top[0];
    top.forEach(c => S.lib.splice(S.lib.indexOf(c), 1)); h.fdEx = 1; S.ex.push(h); const rest = top.filter(c => c !== h); shuffle(rest); S.lib.push(...rest);
    if (sc){ sc.w25hid = (sc.w25hid || []).concat(h.id); sc.hid = h.id; } log(`${name}: hid a card face down; ${rest.length} on the bottom`); commit(); return true; }
  if (/^if there are cards exiled with it, you may play one of them without paying its mana cost$/.test(l)){
    const sc = src(); const list = sc ? (sc.w25hid || (sc.hid ? [sc.hid] : [])).map(id => S.ex.find(c => c.id === id)).filter(Boolean) : [];
    if (!list.length){ if (!UI.dry) log(`${name}: no cards exiled with it`); return true; } if (UI.dry) return true;
    const ids = await pickCards({title:`${name}: play one of the hidden cards without paying its mana cost?`, cards:list, min:0, max:1, noneLabel:"Don't"}); const h = ids && ids[0] != null ? S.ex.find(c => c.id === ids[0]) : null; if (!h) return true;
    sc.w25hid = (sc.w25hid || []).filter(id => id !== h.id); if (sc.hid === h.id) sc.hid = sc.w25hid[0] || null; delete h.fdEx;
    if (isLand(h.k)){ S.ex.splice(S.ex.indexOf(h), 1); S.hand.push(h); playLand(h, {free:true}); } else { UI.afterCast = () => {}; await beginCast(h, 'ex', {free:true}); } commit(); return true; }

  // ---- Bring to Light (converge search → exile → cast free)
  if ((m = l.match(/^search your library for an? (.+?) card with mana value less than or equal to the number of colors of mana spent to cast ~, exile that card(?:, then shuffle)?$/))){
    const d = m[1].replace(/,? or /g, ' or ').replace(/, /g, ' or '); const sp = n24spFor(ctx); const n = UI.dry ? 5 : (sp && sp.col ? ['W', 'U', 'B', 'R', 'G'].filter(x => (sp.col[x] || 0) > 0).length : 0);
    const list = S.lib.filter(c => descOk(c.k, d) && w25Mv(c.k) <= n); ctx.lastEx = [];
    if (list.length && UI.dry){ moveCard(list[0].id, 'ex', {quiet:true}); ctx.lastEx = [list[0].id]; }
    else if (list.length){ const ids = await pickCards({title:`${name}: search for a ${m[1]} card with mana value ${n} or less`, cards:list, min:0, max:1, noneLabel:'Find nothing'}); const c = ids && ids[0] != null ? S.lib.find(x => x.id === ids[0]) : null; if (c){ moveCard(c.id, 'ex'); ctx.lastEx = [c.id]; } }
    shuffleLib(); commit(); return true; }

  // ---- keyword lines in a spell's text that are casting options handled elsewhere (cleave / harmonize: see below)
  if (/^(cleave|harmonize) (\{[^}]+\})+$/.test(l) && ctx.it && ctx.it.kind === 'spell') return true;

  // ---- Fire Nation Turret: +N/+0 and firebending N
  if ((m = l.match(/^up to one target creature gets \+(\d+)\/\+(\d+) and gains (firebending \d+) until end of turn$/))){ const t = w25Tg(ctx)[0]; if (t) applyTo(t, {op:'pump', src:name, f:{p:+m[1], t:+m[2], kw:[m[3]]}}); commit(); return true; }
  // ---- The Master of Keys: mill twice X cards
  if (/^(?:and )?mill twice x cards$/.test(l)){ const c = src(); const x = (ctx.it && ctx.it.x) || (c && c.xv) || 0; if (x) mill(2 * x); commit(); return true; }
  // ---- Agent of the Shadow Thieves' granted trigger
  if ((m = l.match(/^if no opponent has more life than (?:that|target) player, put an? \+1\/\+1 counter on ~$/))){
    const pid = (ctx.it && ctx.it.evDp) || ((ctx.lastT || []).find(x => x.t === 'player') || {}).pid; const lifeOf = p => p === MYPID ? S.life : (OPP.get(p)?.life ?? 0);
    ctx.w25agent = !!pid && opponents().every(p => lifeOf(p.pid) <= lifeOf(pid)); if (UI.dry) ctx.w25agent = true;
    const c = src(); if (ctx.w25agent && c && S.bf.includes(c)) modCounters(c, 'cp', 1); else if (!ctx.w25agent) log(`${name}: an opponent has more life than that player`); commit(); return true; }
  if (/^it gains deathtouch and indestructible until end of turn$/.test(l) && ctx.w25agent !== undefined){ if (!ctx.w25agent) return true; const c = src(); if (c) applyTo({pid:MYPID, id:c.id}, {op:'pump', src:name, f:{p:0, t:0, kw:['deathtouch', 'indestructible']}}); commit(); return true; }
  // ---- Omnath, Locus of All
  if (/^look at the top card of your library$/.test(l) && /you may reveal that card if it has three or more colored mana symbols/.test(full)){ ctx.w25om = S.lib[0] || null; if (ctx.w25om && !UI.dry) log(`${name}: looked at the top card of the library`); return true; }
  if (/^you may reveal that card if it has three or more colored mana symbols in its mana cost$/.test(l)){
    const c = ctx.w25om; ctx.w25omRev = false; if (!c) return true; const n = (String(info(c.k)?.m || '').match(/\{[^}]*[WUBRG][^}]*\}/g) || []).length;
    if (n >= 3 && (UI.dry || await askYes(`${name}: reveal ${cname(c)} (${n} colored mana symbols)?`, 'Reveal', 'No'))){ ctx.w25omRev = true; log(`${name}: revealed ${cname(c)}`); } return true; }
  if (/^if you do, add three mana in any combination of its colors and put it into your hand$/.test(l)){
    const c = ctx.w25om; if (!c || !ctx.w25omRev) return true; const cols = [...new Set((info(c.k)?.c || '').split('').filter(x => 'WUBRG'.includes(x)))]; const out = [];
    for (let i = 0; i < 3 && cols.length; i++) out.push(cols.length === 1 || UI.dry ? cols[0] : ((await askChoice({title:`${name}: mana ${i + 1} of 3`, options:cols.map(x => ({label:`{${x}}`, value:x}))})) || cols[0]));
    if (out.length){ addMana(out); log(`${name}: added ${out.map(x => '{' + x + '}').join('')}`); } if (S.lib.includes(c)) moveCard(c.id, 'hand'); commit(); return true; }
  if (/^if you don't reveal it, put it into your hand$/.test(l) && ctx.w25om !== undefined){ const c = ctx.w25om; if (c && !ctx.w25omRev && S.lib.includes(c)) moveCard(c.id, 'hand'); commit(); return true; }
  // ---- Varchild: gain control of all Survivors
  if ((m = l.match(/^gain control of all ([a-z]+?)s$/)) && !/^(creature|permanent|artifact|land|enchantment)$/.test(m[1])){
    const d = m[1]; let n = 0; for (const [pid, st] of OPP) for (const c of (st.bf || [])){ if (c.k && !c.fd && descOk(c.k, d, {tok:c.tok})){ for (let i = 0; i < (c.n || 1); i++) applyTo({t:'card', pid, id:c.id}, {op:'steal', src:name, f:{}}); n += c.n || 1; } }
    log(`${name}: gains control of all ${d}s (${n})`); commit(); return true; }
  // ---- Chandra, Dressed to Kill
  if (/^if it's red, you may cast it this turn$/.test(l)){ const c = (ctx.lastEx || []).map(id => S.ex.find(x => x.id === id)).filter(Boolean)[0]; if (c && /R/.test(info(c.k)?.c || '') && !isLand(c.k)) grantPlay([c.id], {cast:true, src:name}); else if (c && !UI.dry) log(`${name}: ${cname(c)} isn't red`); return true; }
  if ((m = l.match(/^(?:you may )?cast (white|blue|black|red|green) spells from among them this turn$/))){ const col = L24_COLW[m[1]]; const ids = (ctx.lastEx || []).filter(id => { const c = S.ex.find(x => x.id === id); return c && !isLand(c.k) && (info(c.k)?.c || '').includes(col); }); if (ids.length) grantPlay(ids, {cast:true, src:name}); return true; }
  // ---- Jhoira of the Ghitu: the card exiled to pay the cost gets four time counters and suspend
  if ((m = l.match(/^put (one|two|three|four|five|\d+) time counters on the exiled card$/))){ const n = wn(m[1]) || +m[1] || 4; const r = S.w25costEx; const c = r && r.srcId === ctx.srcId ? r.ids.map(id => S.ex.find(x => x.id === id)).filter(Boolean)[0] : null;
    ctx.w25jh = c || null; if (c){ c.nc = {...(c.nc || {}), time:((c.nc || {}).time || 0) + n}; c.co = c.nc.time; log(`${cname(c)}: ${n} time counters`); } commit(); return true; }
  if (/^if it doesn't have suspend, it gains suspend$/.test(l)){ const c = ctx.w25jh; if (c){ c.r21bsus = 1; log(`${cname(c)} is suspended`); } commit(); return true; }
  // ---- Will, Scion of Peace: white and/or blue spells cost {N} less this turn
  if ((m = l.match(/^spells you cast this turn that are (white|blue|black|red|green) and\/or (white|blue|black|red|green) cost \{(\d+)\} less to cast$/))){ const n = +m[3]; if (n > 0){ S.w25red = (S.w25red || []).filter(x => x.t === turnStr()).concat({t:turnStr(), n, cols:[L24_COLW[m[1]], L24_COLW[m[2]]], src:name}); log(`${name}: ${m[1]} and/or ${m[2]} spells cost {${n}} less this turn`); } commit(); return true; }
  // ---- Earthshape
  if (/^(?:then )?each creature you control with power less than or equal to that land's power gains hexproof and indestructible until end of turn$/.test(l)){
    const lid = (ctx.lastT || []).find(x => x.t === 'card') ; const land = ctx.r9earth != null ? S.bf.find(b => b.id === ctx.r9earth) : (lid ? S.bf.find(b => b.id === lid.id && isLand(b.k)) : null) || S.bf.filter(b => isLand(b.k) && isCreatureCard(b)).slice(-1)[0];
    const p = land ? (stats(land) || [0, 0])[0] : 0; S.bf.filter(b => !b.fd && isCreatureCard(b) && (stats(b) || [0, 0])[0] <= p).forEach(b => applyTo({pid:MYPID, id:b.id}, {op:'pump', src:name, f:{p:0, t:0, kw:['hexproof', 'indestructible']}})); commit(); return true; }
  if (/^you gain hexproof until end of turn$/.test(l)){ S.w25hexp = turnStr(); log(`${name}: you have hexproof until end of turn`); commit(); return true; }
  // ---- Solstice Revelations
  if (/^(?:you may )?cast that card without paying its mana cost if the spell's mana value is less than the number of mountains you control$/.test(l)){
    const c = (ctx.lastEx || []).map(id => S.ex.find(x => x.id === id)).filter(Boolean).slice(-1)[0]; ctx.w25sr = false; if (!c || isLand(c.k)) return true;
    const mt = S.bf.filter(b => !b.fd && descOk(b.k, 'mountain')).length; if (w25Mv(c.k) >= mt){ if (!UI.dry) log(`${name}: ${cname(c)} has mana value ${w25Mv(c.k)}, not less than ${mt} Mountains`); return true; }
    if (UI.dry) return true; if (await askYes(`${name}: cast ${cname(c)} without paying its mana cost?`, 'Cast', 'No')){ UI.afterCast = () => {}; await beginCast(c, 'ex', {free:true}); ctx.w25sr = !S.ex.includes(c); } return true; }
  if (/^if you don't cast that card this way, put it into your hand$/.test(l)){ const c = (ctx.lastEx || []).map(id => S.ex.find(x => x.id === id)).filter(Boolean).slice(-1)[0]; if (c && !ctx.w25sr) moveCard(c.id, 'hand'); commit(); return true; }
  // ---- The Belligerent: play from the top of the library until end of turn
  if (/^until end of turn, you may look at the top card of your library any time, and you may play lands and cast spells from the top of your library$/.test(l)){ S.w25rules = (S.w25rules || []).filter(x => x.t === turnStr()).concat({t:turnStr(), r:{kind:'r23fTop', who:'you', lands:true, spells:'any', src:name}}); log(`${name}: may play lands and cast spells from the top of the library this turn`); commit(); return true; }
  // ---- Inferno of the Star Mounts
  if (/^when its power becomes 20 this way, it deals 20 damage to any target$/.test(l)){
    const c = src(); if (!c || !S.bf.includes(c) || UI.dry) return true; if ((stats(c)[0] || 0) !== 20) return true;
    const g = await chooseTargets('It deals 20 damage to any target.', {pid:MYPID, col:info(c.k)?.c, types:info(c.k)?.t, id:c.id}, name); const t = g && g[0] && g[0][0];
    if (t){ if (t.pid === MYPID || t.t === 'player') dealDamage(t, 20, ctx.k, c); else applyTo(t, {op:'dmg', n:20, src:name, f:srcFlags(ctx.k, MYPID, c)}); log(`${name}: power 20 — deals 20 damage`); } commit(); return true; }
  // ---- Pact Weapon: "The creature gets +X/+X … and you lose X life" (the equipped attacker)
  if ((m = l.match(/^the creature gets \+(x|\d+)\/\+(x|\d+) until end of turn(?: and you lose (x|\d+) life)?(?:, where x is that card's mana value)?$/))){
    const k = ctx.lastDrawK || (S.hand.slice(-1)[0] || {}).k; const x = /x/.test(m[1]) ? (k ? w25Mv(k) : 0) : +m[1]; const e = src(); const h = e && e.att;
    if (h && x) applyTo({t:'card', pid:h.pid, id:h.id}, {op:'pump', src:name, f:{p:x, t:x}}); if (m[3] && x) { S.life -= x; log(`lost ${x} life (${name})`); } commit(); return true; }
  // ---- Soul Immolation
  if (/^x can't be greater than the greatest toughness among creatures you control$/.test(l)) return true;
  if (/^~ deals x damage to each opponent and each creature they control$/.test(l)){
    const x = (ctx.it && ctx.it.x) || 0; const c = src() || (ctx.it && ctx.it.card); const f = srcFlags(ctx.k, MYPID, c);
    for (const p of opponents()){ dealDamage({t:'player', pid:p.pid}, x, ctx.k, c); sendRq(p.pid, 'dmgAll', x, name, {d:'creature', f}); } log(`${name} deals ${x} damage to each opponent and each creature they control`); commit(); return true; }
  // ---- Plasm Capture: X mana of any colors at your next first main phase
  if (/^at the beginning of your next first main phase, add x mana in any combination of colors, where x is that spell's mana value$/.test(l)){
    const t = (ctx.lastT || [])[0]; const n = (t && t.k ? w25Mv(t.k) : 0) || ctx.counteredMV || 0; if (!n) return true;
    S.w25dly = (S.w25dly || []).concat({n, src:name}); log(`${name}: ${n} mana of any colors at the beginning of your next first main phase`); commit(); return true; }
  // ---- Rocco, Street Chef
  if (/^each player exiles the top card of their library$/.test(l) && /until your next end step, each player may play the card they exiled this way/.test(full)){
    const c = S.lib[0]; ctx.w25rocco = c ? c.id : null; if (c) moveCard(c.id, 'ex'); const next = !w25Mine(); for (const p of opponents()) sendRq(p.pid, 'w25exPlay', 1, name, {d:next ? 'n' : ''}); commit(); return true; }
  if (/^until your next end step, each player may play the card they exiled this way$/.test(l)){ if (ctx.w25rocco != null && S.ex.some(c => c.id === ctx.w25rocco)) grantPlay([ctx.w25rocco], {src:name, next:!w25Mine()}); return true; }
  // ---- Rocco: "you put a +1/+1 counter on target creature"
  if (/^you put an? \+1\/\+1 counter on target creature$/.test(l)){ const t = w25Tg(ctx)[0]; if (t) w25Ctr(t, 'cp', 1, name); commit(); return true; }
  // ---- Koll: if it was enchanted or equipped, return it to its owner's hand
  if (/^if it was enchanted or equipped, return it to its owner's hand$/.test(l)){ const id = ctx.it && ctx.it.evId; const was = id != null && W25.attTo && W25.attTo[id]; const c = id != null ? S.gy.find(g => g.id === id) : null;
    if (c && was) moveCard(c.id, 'hand'); else if (c && !UI.dry) log(`${name}: it wasn't enchanted or equipped`); commit(); return true; }

  // ---- casting cards from graveyards (Halo Forager, Finale of Promise, Gale)
  if (/^(?:you may )?pay \{x\}$/.test(l) && /cast target instant or sorcery card with mana value x from a graveyard/.test(full)){
    if (UI.dry){ ctx.w25X = 1; ctx.didPay = true; return true; } const v = await askNumber(`${name}: pay {X} — X is the mana value of the card you'll cast`, 'X', 0); let x = Math.max(0, +v || 0);
    if (x){ const p = payPlan(parseCost(`{${x}}`), S.pool); if (p.err){ toast(`Not enough mana: ${p.err}`); x = 0; } else S.pool = p.pool; }
    ctx.w25X = x; ctx.didPay = x > 0 || v === 0; if (x) log(`${name}: paid {${x}}`); commit(); return true; }
  if ((m = l.match(/^(?:you may )?cast target (instant or sorcery|instant|sorcery) card with mana value x from a graveyard without paying its mana cost$/))){
    const t = w25Tg(ctx)[0]; const x = ctx.w25X ?? ((ctx.it && ctx.it.x) || 0); if (!t || UI.dry) return true;
    if (w25Mv(t.k) !== x){ log(`${name}: ${info(t.k)?.n} doesn't have mana value ${x}`); return true; }
    await w25CastFromGy(t, ctx, {free:true, ex:/exile it instead/.test(full)}); return true; }
  if (/^if that spell would be put into a graveyard, exile it instead$/.test(l) || /^if a spell cast (?:from your graveyard )?this way would be put into your graveyard, exile it instead$/.test(l)) return true;
  if ((m = l.match(/^(?:you may )?cast up to one target instant card and\/or up to one target sorcery card from your graveyard each with mana value x or less without paying their mana costs$/))){
    const x = (ctx.it && ctx.it.x) || 0; const ts = [...w25Tg(ctx), ...w25Tg(ctx)].filter(Boolean); ctx.w25cast = []; if (UI.dry) return true;
    for (const t of ts){ if (w25Mv(t.k) > x){ log(`${name}: ${info(t.k)?.n} has mana value over ${x}`); continue; } const it = await w25CastFromGy(t, ctx, {free:true, ex:true}); if (it) ctx.w25cast.push(it); }
    return true; }
  if (/^if x is 10 or more, copy each of those spells twice$/.test(l)){ const x = (ctx.it && ctx.it.x) || 0; if (x < 10 || UI.dry) return true; for (const it of ctx.w25cast || []){ if (S.stk.includes(it)) await m24Copy({...pubItem(it), pid:MYPID, it}, ctx, {n:2, newT:'may'}); } return true; }
  if (/^you may choose new targets for the copies$/.test(l) && /copy each of those spells twice/.test(full)) return true;
  if (/^(?:you may )?cast up to one target card of the other type from your graveyard$/.test(l)){
    const t = w25Tg(ctx)[0]; if (!t || UI.dry) return true; const ek = ctx.it && ctx.it.evk; const was = ek && /\bInstant\b/.test(info(ek)?.t || '') ? 'Instant' : 'Sorcery'; const want = was === 'Instant' ? 'Sorcery' : 'Instant';
    if (!new RegExp('\\b' + want + '\\b').test(info(t.k)?.t || '')){ log(`${name}: ${info(t.k)?.n} isn't ${want.toLowerCase() === 'instant' ? 'an instant' : 'a sorcery'}`); return true; }
    await w25CastFromGy(t, ctx, {free:false, ex:true}); return true; }

  // ---- Sword of Hours: d12 vs the damage dealt
  if (/^if the result is greater than the damage dealt or the result is 12, double the number of \+1\/\+1 counters on that creature$/.test(l)){
    const r = ctx.roll || 0; const dmg = (ctx.it && (ctx.it.evN ?? ctx.it.evAmt)) || 0; const e = src(); const h = e && e.att && e.att.pid === MYPID ? S.bf.find(b => b.id === e.att.id) : null;
    if (h && (r > dmg || r === 12)){ const n = h.cp || 0; if (n) modCounters(h, 'cp', n); log(`${name}: rolled ${r} — doubled the +1/+1 counters on ${cname(h)}`); } else if (!UI.dry) log(`${name}: rolled ${r} (damage ${dmg}) — nothing`); commit(); return true; }

  // ---- Xolatoyac: an Island while it has a flood counter
  if (/^that land is an island in addition to its other types for as long as it has a flood counter on it$/.test(l)){
    const t = (ctx.lastT || [])[0]; if (!t || t.t === 'player') return true;
    if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c){ l24addMod(c, {s:name, u:'', addS:['Island'], w25flood:1}); log(`${cname(c)} is an Island while it has a flood counter`); } }
    else sendRq(t.pid, 'w25flood', 0, name, {tid:t.id});
    commit(); return true; }
  return false;
}
RQ_OPS.push('w25regen', 'w25exPlay', 'w25flood');
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'w25exPlay'){ const top = S.lib.slice(0, r.n || 1); top.forEach(c => moveCard(c.id, 'ex', {quiet:true})); if (top.length){ grantPlay(top.map(c => c.id), {src:r.src, next:r.d === 'n' && currentTurn()[1] !== from ? false : r.d === 'n'}); log(`exiled ${top.map(cname).join(', ')} from the top of my library (${r.src}) — I may play it`); } commit(); return; }
    if (r.op === 'w25flood'){ const c = S.bf.find(b => b.id === r.tid); if (c){ l24addMod(c, {s:r.src, u:'', addS:['Island'], w25flood:1}); log(`${cname(c)} is an Island while it has a flood counter (${r.src})`); commit(); } return; }
    if (r.op === 'w25regen'){ const c = S.bf.find(b => b.id === r.tid); if (c){ c.regen = (c.regen || 0) + 1; log(`${cname(c)} will regenerate (${r.src})`); commit(); } return; }
    return ao(r, from);
  };
}
// "can't be blocked this turn except by creatures with haste"
{
  const cb = canBlock;
  canBlock = function(b, a, apid){ const r = cb(b, a, apid); if (r) return r; try { if (a && (a.ekw || []).includes('w25hasteOnly') && !kwOf(b, 'haste')) return 'only creatures with haste can block it'; } catch {} return ''; };
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound25WPre(s, l, ctx)) return; return ds(s0, ctx); }; }
// "~ enters with an indestructible counter on her/him" (Arwen): the core enter code only reads "on it"
STATIC_RULES.push([/^~ enters with (?:an?|one|two|three|four|five|\d+) [a-z+\/0-9\-]+ counters? on (?:him|her)$/, m => ({kind:'noop'})]);
{
  const oe = onEnter;
  onEnter = function(c, from, o = {}){
    const r = oe(c, from, o);
    try { const f = faceOf(c); const t = tname(f && f.o || '', cname(c)); const m = t.match(/(?:^|\n)~ enters with (an?|one|two|three|four|five|\d+) ([a-z+\/0-9\-]+) counters? on (?:him|her)\.?(?:\n|$)/i);
      if (m && S.bf.includes(c)){ const n = wn(m[1].toLowerCase()) || +m[1] || 1; const k = W25KIND(m[2].toLowerCase()); if (k === 'cp') modCounters(c, 'cp', n); else if (k === 'cm') f24cmAdd(c, n); else addNamed(c, k, n); } } catch (e){ console.warn(e); }
    return r;
  };
}

/* ---------- triggered abilities that work from the graveyard ("if ~ is in your graveyard", CR 113.6k) and while suspended ---------- */
const W25_GYRE = /^if ~ is in your graveyard, /i;
const W25_SUSRE = /^if ~ is suspended, /i;
function w25ZoneTrigs(c, re){ try { return trigsOf(c.k, false).filter(t => re.test(String(t.eff || '').trim())); } catch { return []; } }
function w25EvMatch(t, c, ev, pid){
  if (t.ev !== ev.type && !(t.evs && t.evs.includes(ev.type))) return false;
  if (t.ev === 'step') return false;
  if (ev.type === 'draw' || ev.type === 'gain' || ev.type === 'scry'){ if (t.ctl === 'you' && pid !== MYPID) return false; if (t.ctl === 'opp' && pid === MYPID) return false; return true; }
  if (ev.type === 'dmg' || ev.type === 'cdmg'){ if (!subjMatch(t, c, ev, pid)) return false; if (t.toYou && ev.dp !== MYPID) return false; if (t.toPlayer && !ev.dp) return false; if (t.oppOnly && (!ev.dp || ev.dp === pid)) return false; return true; }
  if (ev.type === 'cast'){ if (t.ctl === 'you' && pid !== MYPID) return false; if (t.ctl === 'opp' && pid === MYPID) return false; if (t.desc && !descOk(ev.k, t.desc)) return false; return true; }
  return !!subjMatch(t, c, ev, pid);
}
{
  const he = handleEvent;
  handleEvent = function(pid, ev){
    he(pid, ev);
    if (!S || !ev || UI.dry) return;
    try {
      for (const c of S.gy.slice()) for (const t of w25ZoneTrigs(c, W25_GYRE)){ if (t.subj === 'self' && ev.id === c.id) continue; if (w25EvMatch(t, c, ev, pid)) pushTrigger({k:c.k, id:c.id, fl:false}, t, ev, pid); }
      for (const c of S.ex.slice()){ if (!c.r21bsus || !((c.nc || {}).time > 0)) continue;
        for (const t of w25ZoneTrigs(c, W25_SUSRE)){ if (!w25EvMatch(t, c, ev, pid)) continue;
          if (/^if ~ is suspended, remove a time counter from it$/i.test(String(t.eff).trim().replace(/\.$/, ''))) r21bTrig(c, 'Remove a time counter from it. When the last is removed, cast it without paying its mana cost.', {r21b:'susTick'});
          else pushTrigger({k:c.k, id:c.id, fl:false}, t, ev, pid); } }
    } catch (e){ console.warn('w25 zone triggers', e); }
  };
  const fs = fireSteps;
  fireSteps = function(step, activePid){
    const r = fs(step, activePid);
    try { if (S && !UI.dry) for (const c of S.gy.slice()) for (const t of trigsOf(c.k, false)){
      if (t.ev !== 'step' || t.step !== step || t.whose === 'next' || !W25_GYRE.test(String(t.eff || '').trim())) continue;
      if (t.whose === 'your' && activePid !== MYPID) continue; if (t.whose === 'opp' && activePid === MYPID) continue;
      pushTrigger({k:c.k, id:c.id, fl:false}, t, null, activePid); } } catch (e){ console.warn('w25 gy steps', e); }
    return r;
  };
  // the same abilities do nothing while the card is on the battlefield: don't put them on the stack there
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    try { if (S && t && src && W25_GYRE.test(String(t.eff || '').trim()) && !S.gy.some(g => g.id === src.id)) return; if (S && t && src && W25_SUSRE.test(String(t.eff || '').trim()) && !S.ex.some(g => g.id === src.id && g.r21bsus)) return; } catch {}
    return pt(src, t, ev, evPid);
  };
}
async function w25ZoneCond(s, l, ctx){
  let m;
  if ((m = l.match(/^if ~ is in your graveyard, (.+)$/))){
    const id = ctx.srcId; const c = id != null ? S.gy.find(g => g.id === id) : null;
    if (!c && !UI.dry){ log(`${ctx.name}: it's no longer in your graveyard`); return true; }
    ctx.w25gy = c || null; const rest = s.slice(s.length - m[1].length);
    if (/^(?:you may )?return (?:it|~) to your hand$/.test(m[1])){ if (UI.dry || !/^you may/.test(m[1]) || await askYes(`${ctx.name}: return it from your graveyard to your hand?`, 'Return', 'No')){ if (c) moveCard(c.id, 'hand'); } commit(); return true; }
    if (/^(?:you may )?return (?:it|~) to the battlefield( tapped)?$/.test(m[1])){ if (UI.dry || !/^you may/.test(m[1]) || await askYes(`${ctx.name}: return it from your graveyard to the battlefield?`, 'Return', 'No')){ if (c){ moveCard(c.id, 'bf'); if (/tapped/.test(m[1])){ const b = S.bf.find(x => x.id === c.id); if (b) b.tap = true; } } } commit(); return true; }
    await doSentence(cap(rest), ctx); return true; }
  if (/^if ~ is suspended, remove a time counter from it$/.test(l)){
    const c = ctx.srcId != null ? S.ex.find(g => g.id === ctx.srcId && g.r21bsus && (g.nc || {}).time > 0) : null;
    if (c && !UI.dry) r21bTrig(c, 'Remove a time counter from it. When the last is removed, cast it without paying its mana cost.', {r21b:'susTick'}); return true; }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await w25ZoneCond(s, l, ctx)) return; return ds(s0, ctx); }; }

// damage ledger: did this permanent deal damage to another creature this turn (Wolverine)
{
  const dd = dealDamage;
  dealDamage = function(t, n, srcK, srcCard, extra = {}){ try { if (srcCard && t && t.t !== 'player' && n > 0 && t.id !== srcCard.id){ const tc = boardOf(t.pid || MYPID).find(b => b.id === t.id); if (tc && isCreatureCard(tc)) srcCard.w25dc = turnStr(); } } catch {} return dd(t, n, srcK, srcCard, extra); };
}
// ability-word labels with punctuation ("Do You Like Squirrels? — ", "I LOVE Squirrels! — ") are labels too
{
  const tn = tname;
  tname = function(txt, name){ let t = String(txt || ''); if (/[?!] — /.test(t)) t = t.replace(/(^|\n)(?!(?:I|II|III|IV|V|VI|VII)(?:, (?:I|II|III|IV|V|VI|VII))* — )([A-Z][A-Za-z'’\-,! ?]{1,40}[?!]) — /g, '$1'); return tn(t, name); };
}
// "choose one. If you control a commander, you may choose both instead." inside a triggered ability
{
  const fix = t => String(t || '').replace(/^choose one\. If you control a commander, you may choose both instead\.?[ \t]*\n(?=\s*•)/im, () => (S && cmdControlled() ? 'Choose one or both —\n' : 'Choose one —\n'));
  const pm = parseModes; parseModes = function(txt){ return pm(fix(txt)); };
  const re = runEffects; runEffects = async function(txt, ctx){ let t = fix(txt);
    // cleave: bracketed text is removed when the spell was cast for its cleave cost
    if (/\[[^\]]+\]/.test(t) && ctx && ctx.it && ctx.it.kind === 'spell' && /^Cleave /m.test(info(ctx.it.k)?.o || '')) t = ctx.it.w25cleave ? t.replace(/ ?\[[^\]]*\]/g, '') : t.replace(/[\[\]]/g, '');
    return re(t, ctx); };
}
/* ---------- Cleave (CR 702.148): an alternative cost that removes the bracketed words ---------- */
{
  const ac = altCosts;
  altCosts = function(c, zone = 'hand'){
    const r = ac(c, zone);
    try { const a = info(c.k); const m = a && (a.o || '').match(/^Cleave ((?:\{[^}]+\})+)/m);
      if (m && zone !== 'gy'){ const p = payPlan(spellCost(c, zone, {alt:{mana:m[1]}}).cost, S.pool); r.push({label:`Cleave ${m[1]} (without the bracketed text)`, mana:m[1], extra:[], ok:!p.err, why:p.err || '', w25cleave:true}); } } catch (e){ console.warn(e); }
    return r;
  };
  const sc = spellCost;
  spellCost = function(c, zone, o = {}){ try { if (o && o.alt && o.alt.w25cleave && c) UI.w25cleave = c.id; } catch {} return sc(c, zone, o); };
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){
    UI.w25cleave = null; const r = await bc(c, zone, o);
    try { if (c && UI.w25cleave === c.id){ const it = S.stk.find(x => x.kind === 'spell' && x.card === c); if (it){ it.w25cleave = 1; log(`${cname(c)}: cast for its cleave cost`); commit(); } } } catch {}
    UI.w25cleave = null; return r;
  };
}
/* ---------- Harmonize (CR 702.180): cast from the graveyard; tap an untapped creature to pay {X} less, X = its power; then exile ---------- */
{
  const go = gyOptions;
  gyOptions = function(c){ const out = go(c); try { const a = info(c.k); const m = a && (a.o || '').match(/^Harmonize ((?:\{[^}]+\})+)/m); if (m) out.push({kind:'harmonize', label:`Harmonize ${m[1]}`, mana:m[1], extra:[], after:'ex', w25harm:true}); } catch {} return out; };
  const cg = castFromGy;
  castFromGy = async function(c, g){
    if (!g || !g.w25harm) return cg(c, g);
    const cre = S.bf.filter(b => !b.fd && !b.tap && isCreatureCard(b) && ((stats(b) || [0])[0] || 0) > 0);
    let tapC = null, mana = g.mana;
    if (cre.length){ const ids = await pickCards({title:`${cname(c)}: harmonize — tap an untapped creature to pay {X} less (X = its power)?`, cards:cre, min:0, max:1, noneLabel:"Don't tap"}); tapC = ids && ids[0] != null ? S.bf.find(b => b.id === ids[0]) : null; }
    if (tapC){ const pc = parseCost(g.mana); const gen = pc.gen || 0; const red = Math.min(gen, (stats(tapC) || [0, 0])[0] || 0); mana = mana.replace(/\{(\d+)\}/, (w, d) => (+d - red) > 0 ? `{${+d - red}}` : ''); }
    const r = await beginCast(c, 'gy', {gy:{...g, mana}});
    if (tapC && !S.gy.includes(c) && S.bf.includes(tapC)){ tapC.tap = true; log(`tapped ${cname(tapC)} for harmonize`); commit(); }
    return r;
  };
}

// Evercoat Ursine: "Hideaway 3, hideaway 3" — two separate hideaway triggers
STATIC_RULES.push([/^hideaway (\d+), hideaway \1$/, m => ({kind:'noop'})]);
{
  const tg = trigsOf;
  trigsOf = function(k, fl){ const out = tg(k, fl); if (out.w25h) return out; out.w25h = true;
    try { const a = info(k); const f = a ? (fl && a.back ? a.back : a) : null; const m = f && String(f.o || '').match(/^hideaway (\d+), hideaway \1$/im);
      if (m && !out.some(t => t.raw === 'hideaway')) for (let i = 0; i < 2; i++) out.push({ev:'enter', subj:'self', ctl:'you', desc:'', eff:`Hideaway ${m[1]}.`, raw:'hideaway'}); } catch {}
    return out; };
}

// the cards exiled to pay an activation cost (Jhoira of the Ghitu)
{
  const pe = payExtras;
  payExtras = async function(list, c){ const before = new Set(S.ex.map(x => x.id)); const r = await pe(list, c); try { if (r && c){ const ids = S.ex.filter(x => !before.has(x.id)).map(x => x.id); if (ids.length) S.w25costEx = {srcId:c.id, ids}; } } catch {} return r; };
}
// remember what was attached to a permanent as it leaves (Koll)
{
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ try { if (S && to !== 'bf'){ const f = find(id); if (f[0] === 'bf' && f[2]){ const was = S.bf.some(b => b.att && b.att.id === id && b.att.pid === MYPID) || [...OPP.values()].some(st => (st.bf || []).some(b => b.att && b.att.id === id && b.att.pid === MYPID)); W25.attTo = W25.attTo || {}; W25.attTo[id] = was; } } } catch {} return mc(id, to, o); };
}
// temporary rules created by effects (The Belligerent)
{
  const sr = staticRules;
  staticRules = function(){ const out = sr(); try { if (S && S.w25rules){ S.w25rules = S.w25rules.filter(x => x.t === turnStr()); S.w25rules.forEach(x => out.push({...x.r, pid:MYPID})); } } catch {} return out; };
}
// Will, Scion of Peace: colored spells cost less this turn
{
  const sc = spellCost;
  spellCost = function(c, zone, o = {}){ const r = sc(c, zone, o);
    try { if (S && S.w25red && c && c.k && r && r.cost){ const col = info(c.k)?.c || ''; let red = 0; for (const x of S.w25red){ if (x.t !== turnStr()) continue; if (x.cols.some(k => col.includes(k))) red += x.n; }
      if (red > 0){ const g = r.cost.gen || 0; const d = Math.min(g, red); if (d){ r.cost.gen = g - d; (r.notes ||= []).push(`${d} less (Will)`); } } } } catch {}
    return r; };
}
// a player with hexproof can't be the target of opponents' spells and abilities (Earthshape)
{
  const fs = fireSteps;
  fireSteps = function(step, activePid){ const r = fs(step, activePid);
    try { if (S && S.w25dly && S.w25dly.length && activePid === MYPID && (step === 'main1' || step === 'precombat' || step === 'g23main1')){ const list = S.w25dly.splice(0); for (const d of list) w25AnyMana(d.n, d.src); } } catch (e){ console.warn(e); }
    return r; };
}
async function w25AnyMana(n, src){ const out = []; for (let i = 0; i < n; i++){ const v = await askChoice({title:`${src}: mana ${i + 1} of ${n}`, options:['W', 'U', 'B', 'R', 'G'].map(x => ({label:`{${x}}`, value:x}))}); out.push(v || 'C'); } addMana(out); log(`${src}: added ${out.map(x => '{' + x + '}').join('')}`); commit(); }
// "You gain hexproof until end of turn" (Earthshape): published, and opponents' targeting respects it
{
  const ps = publicState;
  publicState = function(){ const o = ps(); try { if (S && S.w25hexp === turnStr()) o.w25hexp = S.w25hexp; } catch {} return o; };
  const ss = sanitizeState;
  sanitizeState = function(st){ const o = ss(st); try { if (o && st && typeof st.w25hexp === 'string') o.w25hexp = st.w25hexp.slice(0, 20); } catch {} return o; };
  const tc = targetCands;
  targetCands = function(spec, src){ const out = tc(spec, src);
    try { for (const x of out){ if (x.t !== 'player' || x.pid === MYPID || !x.ok) continue; const o = OPP.get(x.pid); if (o && o.w25hexp && o.w25hexp === turnStr()){ x.ok = false; x.why = 'hexproof'; } } } catch {}
    return out; };
}

/* ---------- casting from the graveyard granted by permanents (The Master of Keys, Iroh, Danitha, Raul, Kagha, Banon, Case of the Uneaten Feast) ---------- */
STATIC_RULES.push(
  [/^each enchantment card in your graveyard has escape$/, m => ({kind:'w25escEnch', who:'you'})],
  [/^during your turn, each non-lesson instant and sorcery card in your graveyard has flashback$/, m => ({kind:'w25fbAll', who:'you'})],
  [/^during your turn, each lesson card in your graveyard has flashback \{(\d+)\}$/, m => ({kind:'w25fbLesson', who:'you', n:+m[1]})],
  [/^once during each of your turns, you may cast an? (aura or equipment|aura|equipment|artifact|creature|enchantment) spell from your graveyard$/, m => ({kind:'w25gyOnce', who:'you', desc:m[1], how:'any'})],
  [/^once during each of your turns, you may cast a spell from among cards in your graveyard that were milled this turn$/, m => ({kind:'w25gyOnce', who:'you', desc:'', how:'milled'})],
  [/^once during each of your turns, you may play a land or cast a permanent spell from among cards in your graveyard that were put there from your library this turn$/, m => ({kind:'w25gyOnce', who:'you', desc:'permanent', how:'milled', land:true})],
  [/^(?:pray — )?once during each of your turns, you may cast a creature spell from among cards in your graveyard that were put there from anywhere other than the battlefield this turn$/, m => ({kind:'w25gyOnce', who:'you', desc:'creature', how:'notbf'})],
  [/^as long as ~ is attached to a creature, you don't lose the game for having 0 or less life$/, m => ({kind:'r23kUnlife', who:'you', w25att:true})],
);
STATIC_KNOWN.push(/^the escape cost is equal to the card's mana cost plus exile three other cards from your graveyard$/, /^the flashback cost is equal to that card's mana cost$/);
{
  // attached-only rules
  const sr = staticRules;
  staticRules = function(){ const out = sr(); try { return out.filter(r => !r.w25att || (r.pid === MYPID ? S.bf.some(b => !b.fd && info(b.k)?.n === r.src && b.att) : ((OPP.get(r.pid)?.bf) || []).some(b => b.k && info(b.k)?.n === r.src && b.att))); } catch { return out; } };
  // where each graveyard card came from this turn
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ let from = null; try { if (S && to === 'gy') from = find(id)[0]; } catch {} const r = mc(id, to, o);
    try { if (from && from !== 'gy' && S.gy.some(c => c.id === id)){ S.w25gyFrom = S.w25gyFrom || {}; S.w25gyFrom[id] = {t:turnStr(), z:from}; const ks = Object.keys(S.w25gyFrom); if (ks.length > 200) delete S.w25gyFrom[ks[0]]; } } catch {}
    return r; };
  const go = gyOptions;
  gyOptions = function(c){ const out = go(c);
    try { const a = info(c.k); if (!a || !S) return out; const mine = currentTurn()[1] === MYPID; const t = a.t || '';
      if (/\bEnchantment\b/.test(t) && !out.some(g => g.kind === 'escape') && rulesOn('w25escEnch').length) out.push({kind:'escape', label:`Escape ${a.m}, exile three other cards`, mana:a.m, extra:[{t:'gyEx', n:3, label:'exile three other cards from your graveyard'}], after:isPermType(t) ? '' : 'ex'});
      if (mine && /\b(Instant|Sorcery)\b/.test(t) && !out.some(g => g.kind === 'flashback')){
        if (/\bLesson\b/.test(t)){ const r = rulesOn('w25fbLesson')[0]; if (r) out.push({kind:'flashback', label:`Flashback {${r.n}} (${r.src})`, mana:`{${r.n}}`, extra:[], after:'ex'}); }
        else if (rulesOn('w25fbAll').length && a.m) out.push({kind:'flashback', label:`Flashback ${a.m} (${rulesOn('w25fbAll')[0].src})`, mana:a.m, extra:[], after:'ex'}); }
      if (mine) for (const r of rulesOn('w25gyOnce')){ if ((S.w25once || {})[r.src] === turnStr()) continue;
        const fr = (S.w25gyFrom || {})[c.id]; if (r.how === 'milled' && !(fr && fr.t === turnStr() && fr.z === 'lib')) continue; if (r.how === 'notbf' && !(fr && fr.t === turnStr() && fr.z !== 'bf')) continue;
        if (isLand(c.k)){ if (r.land) out.push({kind:'gycast', label:`Play this land (${r.src})`, mana:'', extra:[], after:'', w25once:r.src, w25land:true}); continue; }
        if (r.desc && !descOk(c.k, r.desc.replace(' or ', ' or '))) continue; out.push({kind:'gycast', label:`Cast from graveyard ${a.m} (${r.src})`, mana:a.m, extra:[], after:'', w25once:r.src}); }
      if (S.w25gyCre === turnStr() && isCreatureCard(c) && !out.some(g => g.kind === 'gycast')) out.push({kind:'gycast', label:`Cast from graveyard ${a.m}`, mana:a.m, extra:[], after:''});
    } catch (e){ console.warn('w25 gyOptions', e); }
    return out; };
  const cg = castFromGy;
  castFromGy = async function(c, g){
    if (g && g.w25land){ const ok = canPlayLand(c); if (!ok.ok){ toast(ok.why); return; } S.gy.splice(S.gy.indexOf(c), 1); S.hand.push(c); playLand(c, {}); if (!S.hand.includes(c)){ (S.w25once ||= {})[g.w25once] = turnStr(); } else { S.hand.splice(S.hand.indexOf(c), 1); S.gy.push(c); } commit(); return; }
    const r = await cg(c, g);
    try { if (g && g.w25once && !S.gy.includes(c)){ (S.w25once ||= {})[g.w25once] = turnStr(); commit(); } } catch {}
    return r; };
}

/* ---------- static abilities ---------- */
STATIC_RULES.push(
  [/^the "legend rule" doesn't apply to (?:tokens|[a-z~ ]+s) you control$/, m => ({kind:'noLegend', who:'you'})],
  [/^you may cast ~ from exile$/, m => ({kind:'w25exSelf', who:'you'})],
  [/^enchanted creature can attack as though it had haste$/, m => ({kind:'w25atkHaste', who:'you'})],
  [/^~ can't be sacrificed$/, m => ({kind:'w25noSac', who:'you'})],
  [/^players can't pay life or sacrifice (creatures|nonland permanents) to cast spells or activate abilities$/, m => ({kind:'w25noPay', who:'all', sac:m[1] === 'creatures' ? 'creature' : 'nonland permanent'})],
  [/^spells and abilities your opponents control can't cause you to sacrifice permanents$/, m => ({kind:'w25sigarda', who:'you'})],
  [/^as long as ~ is attached to a creature, you may cast creature spells from the top of your library$/, m => ({kind:'r23fTop', who:'you', spells:'creature', attached:true})],
  [/^as long as an opponent controls more lands than you, you may play lands from the top of your library$/, m => ({kind:'r23fTop', who:'you', lands:true, w25verge:true})],
  [/^~ is all colors$/, m => ({kind:'w25allCol', who:'you'})],
);
STATIC_KNOWN.push(/^this ability doesn't affect its color identity$/);
// Eternal Scourge: castable from exile any time it's there
{
  const ew = exWindowOk;
  exWindowOk = function(c){ try { if (c && !c.own && S && S.ex.includes(c) && /(^|\n)You may cast (?:~|this card) from exile\.?(\n|$)/i.test(tname(info(c.k)?.o || '', info(c.k)?.n))){ if (!c.mayPlay) c.mayPlay = {t:turnStr(), cast:true, adv:true, src:info(c.k)?.n}; return true; } } catch {} return ew(c); };
}
// Instill Energy
{
  const ca = canAttack;
  canAttack = function(c){ const r = ca(c); try { if (r === 'summoning sick' && S.bf.some(a => !a.fd && a.att && a.att.id === c.id && a.att.pid === MYPID && /enchanted creature can attack as though it had haste/i.test(info(a.k)?.o || ''))) return ''; } catch {} return r; };
}
// Hithlain Rope: can't be sacrificed
{
  const so = sacrificeOne;
  sacrificeOne = function(c){ try { if (c && S && S.bf.includes(c) && /(^|\n)~ can't be sacrificed\.?(\n|$)/i.test(tname(info(c.k)?.o || '', cname(c)))){ log(`${cname(c)} can't be sacrificed`); toast(`${cname(c)} can't be sacrificed`); return; } } catch {} return so(c); };
}
// Angel of Jubilation / Yasharn: nobody pays life or sacrifices creatures / nonland permanents for costs
function w25NoPay(){ try { return rulesOn('w25noPay'); } catch { return []; } }
function w25PartWhy(x){ const rs = w25NoPay(); if (!rs.length || !x) return '';
  if (x.t === 'life' || x.t === 'lifeX') return `players can't pay life (${rs[0].src})`;
  if (/^sac/.test(x.t || '')){ for (const r of rs){ const d = String(x.desc || ''); if (r.sac === 'creature' ? /creature|permanent|artifact or creature/.test(d) || d === '' : !/\bland\b/.test(d) || /nonland/.test(d)) return `players can't sacrifice ${r.sac}s (${r.src})`; } }
  return ''; }
{
  const ef = extraFeasible;
  extraFeasible = function(x, c){ const w = w25PartWhy(x); return w || ef(x, c); };
  const pe = payExtras;
  payExtras = async function(list, c){ for (const x of list || []){ const w = w25PartWhy(x); if (w){ toast(w); log(w); return false; } } return pe(list, c); };
  const aw = n24addWhy;
  n24addWhy = function(parts, c){ for (const x of parts || []){ const w = w25PartWhy(x); if (w) return w; } return aw(parts, c); };
}
// Sigarda, Host of Herons: opponents' spells and abilities can't make me sacrifice
{
  const ao = applyOp;
  applyOp = function(r, from){
    try { if (r && from && from !== MYPID && ['sac', 'h23sacBig', 'jHalfSac', 'qsacIds', 'r23Isac1', 'r23fMaySac', 'r23kSacThis'].includes(r.op) && rulesOn('w25sigarda').length){ log(`${rulesOn('w25sigarda')[0].src}: ${r.src || nameOf(from)} can't make me sacrifice permanents`); if (r.ref && typeof r21Ack === 'function') r21Ack(from, r.ref, 0, r.src); commit(); return; } } catch {}
    return ao(r, from);
  };
}
// Verge Rangers: only while an opponent controls more lands
{
  const tw = r23fTopWays;
  r23fTopWays = function(c){ const out = tw(c); try { const mine = S.bf.filter(b => !b.fd && isLand(b.k)).length; const more = [...OPP.values()].some(o => (o.bf || []).filter(b => b.k && !b.fd && isLand(b.k)).length > mine); return out.filter(w => !w.r || !w.r.w25verge || more); } catch { return out; } };
}
// Fallaji Wayfarer: "~ is all colors" (color only, not color identity) — a layer-5 record on itself while it's on the battlefield
{
  const oe = onEnter;
  onEnter = function(c, from, o = {}){ const r = oe(c, from, o); try { if (c && S.bf.includes(c) && /(^|\n)~ is all colors\./i.test(tname(info(c.k)?.o || '', info(c.k)?.n))) l24addMod(c, {s:cname(c), u:'', col:'WUBRG'}); } catch (e){ console.warn(e); } return r; };
}
// Soul Immolation: X can't be greater than the greatest toughness among creatures you control
{
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){
    let cap = null; try { if (c && /X can't be greater than the greatest toughness among creatures you control/i.test(info(c.k)?.o || '')) cap = Math.max(0, ...S.bf.filter(b => !b.fd && isCreatureCard(b)).map(b => (stats(b) || [0, 0])[1] || 0)); } catch {}
    if (cap == null) return bc(c, zone, o);
    UI.w25xcap = cap; try { return await bc(c, zone, o); } finally { UI.w25xcap = null; }
  };
  const an = askNumber;
  askNumber = async function(title, hint, def){ const v = await an(title, hint, def); try { if (UI.w25xcap != null && v != null && +v > UI.w25xcap){ toast(`X can't be greater than ${UI.w25xcap}`); log(`X capped at ${UI.w25xcap} (greatest toughness among your creatures)`); return UI.w25xcap; } } catch {} return v; };
}

/* ---------- firebending X (Zuko): X counted when the trigger resolves ---------- */
STATIC_RULES.push([/^firebending x, where x is the number of (experience|energy) counters you have$/, m => ({kind:'noop'})]);
{
  const tg = trigsOf;
  trigsOf = function(k, fl){ const out = tg(k, fl); if (out.w25fb) return out; out.w25fb = true;
    try { const a = info(k); const f = a ? (fl && a.back ? a.back : a) : null; const m = f && String(f.o || '').match(/^firebending x, where x is the number of (experience|energy) counters you have\.?$/im);
      if (m){ const t = out.find(x => /^firebending x/i.test(x.raw || '')); const eff = `Add {R} for each ${m[1].toLowerCase()} counter you have. (firebending)`; if (t) t.eff = eff; else out.push({ev:'attack', subj:'self', ctl:'you', desc:'', eff, raw:'firebending x'}); } } catch {}
    return out; };
}
async function w25Fire(s, l, ctx){
  let m;
  if ((m = l.match(/^if any of that damage was dealt by an? (\w+), (.+)$/))){ await doSentence(cap(s.slice(s.length - m[2].length)), ctx); return true; }
  if ((m = l.match(/^add \{r\} for each (experience|energy) counter you have$/))){ const n = ((S.pc || {})[m[1]] || 0); if (n) addMana(Array(n).fill('R')); log(`${ctx.name}: firebending ${n} — added ${'{R}'.repeat(n) || 'nothing'}`); commit(); return true; }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await w25Fire(s, l, ctx)) return; return ds(s0, ctx); }; }

/* ---------- Rhet-Tomb Mystic: creature cards in hand have cycling ---------- */
STATIC_RULES.push([/^each creature card in your hand has cycling ((?:\{[^}]+\})+)$/, m => ({kind:'w25creCycle', who:'you', cost:m[1].toUpperCase()})]);
{
  const cy = r21bCycles;
  r21bCycles = function(c){ const out = cy(c); try { if (c && c.k && S && S.hand.includes(c) && isCreatureCard(c)) rulesOn('w25creCycle').forEach(x => { const cost = r21bCost(x.cost); if (!out.some(o => !o.ty && o.cost.label === cost.label)) out.push({ty:'', desc:null, cost, label:`Cycling ${cost.label} (${x.src})`}); }); } catch {} return out; };
}

/* ---------- counters put on creatures you control (any kind): Mikey & Leo ---------- */
EV_TYPES.push('w25ctr', 'w25evolve');
{
  const mc = modCounters;
  modCounters = function(c, kind, n, putter, owner){ const r = mc(c, kind, n, putter, owner); try { if (r > 0 && S && !UI.dry && S.bf.includes(c) && isCreatureCard(c) && (putter == null || putter === MYPID) && !['co', 'lore'].includes(kind)) emit({type:'w25ctr', k:c.k, id:c.id, cnt:1, amt:r}); } catch {} return r; };
  const an = addNamed;
  addNamed = function(c, kind, n){ const r = an(c, kind, n); try { if (n > 0 && S && !UI.dry && S.bf.includes(c) && isCreatureCard(c) && !['charge', 'time', 'lore', 'loyalty'].includes(kind)) emit({type:'w25ctr', k:c.k, id:c.id, cnt:1, amt:n}); } catch {} return r; };
}
/* ---------- evolve (CR 702.100) ---------- */
{
  const he = handleEvent;
  handleEvent = function(pid, ev){
    he(pid, ev);
    try { if (!S || UI.dry || !ev || ev.type !== 'enter' || pid !== MYPID || !ev.k || !isCreatureCard({k:ev.k})) return;
      const nc = S.bf.find(b => b.id === ev.id); if (!nc) return; const [np, nt] = stats(nc) || [0, 0];
      for (const c of S.bf){ if (c.fd || c.id === nc.id || !isCreatureCard(c)) continue; const f = faceOf(c); if (!f || !/(^|\n)Evolve(\n|$| \()/.test(f.o || '')) continue;
        const [p, t] = stats(c) || [0, 0]; if (np > p || nt > t){ modCounters(c, 'cp', 1); log(`${cname(c)} evolves`); emit({type:'w25evolve', k:c.k, id:c.id, cnt:1}); } }
    } catch (e){ console.warn('w25 evolve', e); }
  };
}
/* ---------- station-gated triggered abilities ("1+ | Whenever …") ---------- */
{
  const tg = trigsOf;
  trigsOf = function(k, fl){ const out = tg(k, fl); if (out.w25st) return out; out.w25st = true;
    try { const a = info(k); const f = a ? (fl && a.back ? a.back : a) : null; if (f && /Spacecraft|Planet/.test(f.t || '')) for (const line of tname(f.o, f.n).split('\n')){ const m = line.trim().match(/^(\d+)\+ \| (when|whenever|at) (.+?), ([\s\S]+)$/i); if (!m) continue;
        const cl = classifyTrig(m[2].toLowerCase(), m[3].toLowerCase().trim()); if (!cl) continue; out.push({...cl, eff:m[4].trim(), raw:line.trim(), w25st:+m[1]}); } } catch {}
    return out; };
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){ try { if (t && t.w25st){ const c = src && S.bf.find(b => b.id === src.id); if (!c || ((c.nc || {}).charge || 0) < t.w25st) return; } } catch {} return pt(src, t, ev, evPid); };
}
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    const me = pid => pid === MYPID;
    if (/^you cast a spell from anywhere other than your hand$/.test(c)) return {ev:'qcast', subj:'any', ctl:'any', desc:'', qf:(s, ev, pid) => me(pid) && ev.x !== 1};
    if (/^you put a counter on a creature you control$/.test(c)) return {ev:'w25ctr', subj:'any', ctl:'you', desc:'creature'};
    if (/^~ evolves$/.test(c)) return {ev:'w25evolve', subj:'self', ctl:'you', desc:''};
    if ((m0 = c.match(/^your opponents are dealt combat damage, if any of that damage was dealt by an? (\w+)$/))){ const d = m0[1]; return {ev:'cdmg', subj:'any', ctl:'any', desc:'', batch:true, qf:(s, ev, pid) => me(pid) && !!ev.dp && ev.dp !== MYPID && descOk(ev.k, d)}; }
    if ((m0 = c.match(/^your opponents are dealt combat damage$/))) return {ev:'cdmg', subj:'any', ctl:'any', desc:'', batch:true, qf:(s, ev, pid) => { if (!me(pid) || !ev.dp || ev.dp === MYPID) return false;
      const mm = String(info(s.k)?.o || '').match(/your opponents are dealt combat damage, if any of that damage was dealt by an? (\w+)/i); if (!mm) return true;
      return (UI.curQ || [[pid, ev]]).some(([p, e]) => p === MYPID && e.type === 'cdmg' && e.dp && e.dp !== MYPID && descOk(e.k, mm[1].toLowerCase())); }};
    return ct(w, c);
  };
  var m0;
}
STATIC_RULES.push([/^(\d+)\+ \| (?:when|whenever) an opponent discards a card, they lose (\d+) life$/, m => ({kind:'noop'})]);

// cast a targeted graveyard card (mine or an opponent's); returns my stack item
async function w25CastFromGy(t, ctx, o = {}){
  if (t.pid === MYPID || !t.pid){ const c = S.gy.find(g => g.id === t.id) || S.gy.find(g => g.k === t.k); if (!c) return null;
    if (!(await askYes(`${ctx.name}: cast ${cname(c)} from your graveyard${o.free ? ' without paying its mana cost' : ''}?`, 'Cast', 'No'))) return null;
    UI.afterCast = () => {}; await beginCast(c, 'gy', {free:!!o.free, gy:{mana:o.free ? '' : (info(c.k)?.m || ''), extra:[], after:o.ex ? 'ex' : '', label:o.free ? 'free' : 'from the graveyard'}});
    return S.stk.find(x => x.kind === 'spell' && x.card === c) || null; }
  const res = await r21Ask(t.pid, 'r21gyLend', 0, ctx.name, {d:t.k}); ctx.r21ids = res.ids;
  if (o.ex) res.ids.forEach(id => { const c = S.ex.find(x => x.id === id); if (c) c.r21exAfter = 1; });
  await r21CastNow(ctx, {free:!!o.free, max:1}); const c = res.ids.map(id => find(id)[2]).filter(Boolean)[0];
  return c ? S.stk.find(x => x.kind === 'spell' && x.card === c) || null : null;
}
// Xolatoyac's Island effect ends when the land has no flood counter
{
  const cm = commit;
  commit = function(...a){ try { if (S && !UI.dry) for (const c of S.bf){ if (c.lx && c.lx.some(m => m.w25flood) && !((c.nc || {}).flood > 0)){ c.lx = c.lx.filter(m => !m.w25flood); l24bust(); } } } catch {} return cm.apply(this, a); };
}
