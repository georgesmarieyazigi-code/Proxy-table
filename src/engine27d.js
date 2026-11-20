/* ===================== Rules engine — round 27 helper D: the last one-offs (mostly back faces of double-faced cards) ===================== */
// Birgi (boast twice), Valakut Awakening, Hydroelectric Specimen, Agadeem's Awakening, Legion Leadership, Wandering Archaic /
// Explore the Vastlands, Tergrid's Lantern, Murderous Rider, Prop Room, The Great Work, Zoological Study, Ojer Kaslem,
// Thousand Moons Smithy / Barracks, Overture, Halvar / Sword of the Realms, Porcelain Gallery, Aclazotz, Bloodsoaked Insight,
// Hydaelyn, The Great Synthesis, The Grand Evolution, Vincent Valentine, Expensive Taste, Heliod, Rona, Ral, Awakened Skyclave,
// Phoenix, Warden of Fire.
const D27 = {};
RQ_OPS.push('d27vast', 'd27att', 'd27gyHand', 'd27rona');
function d27Tg(ctx){ return ctx.tgts ? nextTargets(ctx) : []; }
function d27Full(ctx){ return String(ctx.full || '').toLowerCase(); }
function d27Src(ctx){ try { return srcCardOf(ctx) || (ctx.srcId != null ? S.bf.find(b => b.id === ctx.srcId) : null); } catch { return null; } }
function d27Mine(){ try { return currentTurn()[1] === MYPID; } catch { return true; } }
function d27AllText(k){ const a = info(k); if (!a) return ''; return [a.o, a.back && a.back.o, ...((a.faces || []).map(f => f.o))].filter(Boolean).join('\n'); }
function d27HasName(n){ return S.bf.some(c => !c.fd && c.k && cname(c) === n); }

// ---------- whole-text rewrites (one effect spread over several sentences) ----------
const D27RW = [
  [/Put any number of cards from your hand on the bottom of your library, then draw that many cards plus one\.?/i, 'D27 valakut.'],
  [/Each player looks at the top five cards of their library and may reveal a land card and\/or an instant or sorcery card from among them\. Each player puts the cards they revealed this way into their hand and the rest on the bottom of their library in a random order\. Each player gains 3 life\.?/i, 'D27 vastlands.'],
  [/they may pay \{2\}\. If they don't, you may copy that spell\.(?: You may choose new targets for the copy\.?)?/i, 'D27 archaic.'],
  [/Mill five cards, then return a creature card milled this way to your hand\.?/i, 'D27 zoological.'],
  [/reveal that many cards from the top of your library\. You may put a creature card and\/or a land card from among them onto the battlefield\. Put the rest on the bottom in a random order\.?/i, 'D27 kaslem.'],
  [/Mill ten cards\. Put up to two creature cards from among the milled cards onto the battlefield\.?/i, 'D27 evolution1.'],
  [/Until end of turn, creatures you control gain "\{1\}: (?:This creature|[^"]+?) fights target creature you don't control\."/i, 'D27 evolution3.'],
  [/Target opponent exiles the top three cards of their library\. Until the end of your next turn, you may play those cards\. If you cast a spell this way, mana of any type can be spent to cast it\.?/i, 'D27 insight.'],
  [/Exile the top two cards of target opponent's library face down\. You may look at and play those cards for as long as they remain exiled\.?/i, 'D27 taste.'],
  [/that source's controller exiles a card from their hand at random\. If it's a land card, you may put it onto the battlefield under your control\. Otherwise, you may cast it without paying its mana cost\.?/i, 'D27 rona.'],
  [/Exile the top eight cards of your library\. You may cast instant and sorcery spells from among them this turn without paying their mana costs\.?/i, 'D27 ral8.'],
  [/each opponent discards a card\. For each opponent who can't, you draw a card\.?/i, 'D27 aclazotz.'],
  [/create a white Gnome Soldier artifact creature token with "(?:This token|This creature|[^"]+?)'s power and toughness are each equal to the number of artifacts and\/or creatures you control\."/gi, 'D27 gnome.'],
];
{
  const re = runEffects;
  runEffects = async function(txt, ctx){ let t = String(txt || ''); for (const [r, w] of D27RW) t = t.replace(r, w); return re(t, ctx); };
}

// ---------- cards that target things in graveyards / with constraints: pick at resolution, no bogus battlefield prompts at cast ----------
const D27_NOTGT = [
  /^Return from your graveyard to the battlefield any number of target creature cards that each have a different mana value X or less\.?$/i,
  /^Return any number of target creature cards with total mana value 6 or less from your graveyard to the battlefield\.(?: Exile [^.]+, then return it to the battlefield\.?)?$/i,
];
{
  const ts = targetSpecs;
  targetSpecs = function(t, ...a){
    const s = String(t || '').trim();
    if (D27_NOTGT.some(r => r.test(s))) return [];
    if (/^until end of turn, double target creature's power and it gains first strike\.?$/i.test(s)) return [{desc:'creature', zone:'bf', n:1, upTo:false, other:false}];
    if (/^return target enchantment card that isn't a God from your graveyard to your hand\.?$/i.test(s)) return [{desc:'non-god enchantment card', zone:'gy', whose:'you', n:1, upTo:false, other:false}];
    if (/^(?:you may )?attach target Aura or Equipment attached to a creature you control to target creature you control\.?$/i.test(s)) return [{desc:'aura or equipment', zone:'bf', n:1, upTo:false, other:false, d27att:1}, {desc:'creature you control', zone:'bf', n:1, upTo:false, other:false}];
    return ts.call(this, t, ...a);
  };
}

// pick cards one at a time from a pool, re-checking a group constraint after each pick
async function d27PickGroup(title, hint, pool, okWith){
  const chosen = [];
  while (true){
    const legal = pool.filter(c => !chosen.includes(c) && okWith(chosen.concat(c)));
    if (!legal.length) break;
    const ids = await pickCards({title:`${title}${chosen.length ? ` (${chosen.length} chosen)` : ''}`, hint, cards:legal, min:0, max:1, noneLabel:chosen.length ? 'Done' : 'None'});
    const c = legal.find(x => x.id === (ids || [])[0]); if (!c) break; chosen.push(c);
  }
  return chosen;
}

// Explore the Vastlands, for one player (run on that player's own client)
async function d27Vast(src){
  const top = S.lib.slice(0, 5); if (!top.length){ log(`${src}: no cards to look at`); return; }
  let keep = [];
  if (!UI.dry){
    const lands = top.filter(c => isLand(c.k)); const sp = top.filter(c => /\b(Instant|Sorcery)\b/.test(info(c.k)?.t || ''));
    if (lands.length){ const ids = await pickCards({title:`${src}: reveal a land card to put into your hand?`, hint:'The rest go on the bottom of your library in a random order.', cards:top, filter:c => isLand(c.k), min:0, max:1, noneLabel:'None'}); const c = lands.find(x => x.id === (ids || [])[0]); if (c) keep.push(c); }
    if (sp.length){ const ids = await pickCards({title:`${src}: reveal an instant or sorcery card to put into your hand?`, hint:'The rest go on the bottom of your library in a random order.', cards:top, filter:c => /\b(Instant|Sorcery)\b/.test(info(c.k)?.t || '') && !keep.includes(c), min:0, max:1, noneLabel:'None'}); const c = sp.find(x => x.id === (ids || [])[0] && !keep.includes(x)); if (c) keep.push(c); }
  }
  keep.forEach(c => moveCard(c.id, 'hand', {quiet:true}));
  if (keep.length) log(`${src}: revealed ${keep.map(cname).join(' and ')} and put ${keep.length === 1 ? 'it' : 'them'} into their hand`);
  const rest = top.filter(c => S.lib.includes(c)); rest.forEach(c => S.lib.splice(S.lib.indexOf(c), 1)); shuffle(rest); S.lib.push(...rest);
  if (rest.length) log(`${src}: put ${rest.length} card${rest.length === 1 ? '' : 's'} on the bottom in a random order`);
  commit();
}

async function d27GnomeToken(ctx){
  const k0 = customToken('Gnome Soldier', '0/0', 'W'); const k = k0 + '|d27gnome';
  if (!DICT.has(k)) DICT.set(k, {...DICT.get(k0), k, t:'Token Artifact Creature — Gnome Soldier', o:"Gnome Soldier's power and toughness are each equal to the number of artifacts and/or creatures you control."});
  if (UI.dry) return true;
  createToken(k, tokenMult(k), null, {}); log(`${ctx.name}: created a white Gnome Soldier artifact creature token (power and toughness = artifacts and/or creatures you control)`); commit(); return true;
}

async function doRound27DPre(s, l, ctx){
  let m; const name = ctx.name || ''; const full = d27Full(ctx);
  const lt = name ? l.split(name.toLowerCase()).join('~') : l;

  // ---- Valakut Awakening
  if (l === 'd27 valakut'){
    if (UI.dry){ return true; }
    const ids = S.hand.length ? await pickCards({title:`${name}: put any number of cards from your hand on the bottom of your library`, hint:'Then you draw that many cards plus one.', cards:S.hand.slice(), min:0, max:S.hand.length, noneLabel:'None'}) : [];
    const chosen = (ids || []).map(id => S.hand.find(c => c.id === id)).filter(Boolean);
    let order = chosen.map(c => c.id);
    if (chosen.length > 1){ const o = await pickCards({title:`${name}: order for the bottom`, hint:'Click them in order, top to bottom.', cards:chosen, min:chosen.length, max:chosen.length}); if (o && o.length === chosen.length) order = o; }
    order.forEach(id => { const c = S.hand.find(x => x.id === id); if (c){ S.hand.splice(S.hand.indexOf(c), 1); S.lib.push(c); } });
    if (chosen.length) log(`${name}: put ${chosen.length} card${chosen.length === 1 ? '' : 's'} from their hand on the bottom of their library`);
    draw(chosen.length + 1); log(`${name}: drew ${chosen.length + 1}`); commit(); return true; }

  // ---- Explore the Vastlands
  if (l === 'd27 vastlands'){
    if (UI.dry) return true;
    for (const p of opponents()) sendRq(p.pid, 'd27vast', 0, name);
    await d27Vast(name);
    if (gainLife(3, name)) log(`${name}: gained 3 life → ${S.life}`);
    for (const p of opponents()){ sendRq(p.pid, 'life', 3, name); }
    log(`${name}: each player gains 3 life`); commit(); return true; }

  // ---- Wandering Archaic
  if (l === 'd27 archaic'){
    if (UI.dry) return true;
    const pid = ctx.it && ctx.it.evPid; const x = m24Ref(ctx);
    if (!x){ log(`${name}: that spell has left the stack`); return true; }
    const paid = pid && pid !== MYPID ? await askOpponentPay(pid, '{2}', name) : false;
    if (paid){ log(`${name}: ${nameOf(pid)} paid {2}`); return true; }
    if (await askYes(`${name}: ${pid ? nameOf(pid) : 'they'} didn't pay {2}. Copy ${x.nm}?`, 'Copy it', "Don't")) await m24Copy(x, ctx, {newT:'may'});
    return true; }

  // ---- Zoological Study
  if (l === 'd27 zoological'){
    UI.millLog = []; mill(5); const milled = UI.millLog || []; UI.millLog = null;
    const cr = milled.filter(c => S.gy.includes(c) && isCreatureCard(c));
    if (cr.length && !UI.dry){ const ids = cr.length === 1 ? [cr[0].id] : await pickCards({title:`${name}: return a creature card milled this way to your hand`, cards:cr, min:1, max:1}); const c = cr.find(x => x.id === (ids || [])[0]) || cr[0]; moveCard(c.id, 'hand'); log(`${name}: returned ${cname(c)} to their hand`); }
    else if (!UI.dry) log(`${name}: no creature card was milled`);
    commit(); return true; }

  // ---- Ojer Kaslem
  if (l === 'd27 kaslem'){
    const n = Math.min(+(ctx.it && (ctx.it.evN || ctx.it.amt)) || 0, S.lib.length); if (!n){ if (!UI.dry) log(`${name}: no damage amount`); return true; }
    const top = S.lib.slice(0, n); log(`${name}: revealed ${top.map(cname).join(', ')}`);
    const put = [];
    if (!UI.dry){
      const cr = top.filter(c => isCreatureCard(c)); const ld = top.filter(c => isLand(c.k));
      if (cr.length){ const ids = await pickCards({title:`${name}: put a creature card onto the battlefield?`, cards:top, filter:c => isCreatureCard(c), min:0, max:1, noneLabel:'None'}); const c = cr.find(x => x.id === (ids || [])[0]); if (c) put.push(c); }
      if (ld.some(c => !put.includes(c))){ const ids = await pickCards({title:`${name}: put a land card onto the battlefield?`, cards:top, filter:c => isLand(c.k) && !put.includes(c), min:0, max:1, noneLabel:'None'}); const c = ld.find(x => x.id === (ids || [])[0] && !put.includes(x)); if (c) put.push(c); }
    }
    put.forEach(c => { moveCard(c.id, 'bf'); log(`${name}: put ${cname(c)} onto the battlefield`); });
    const rest = top.filter(c => S.lib.includes(c)); rest.forEach(c => S.lib.splice(S.lib.indexOf(c), 1)); shuffle(rest); S.lib.push(...rest);
    if (rest.length) log(`${name}: put ${rest.length} on the bottom in a random order`); commit(); return true; }

  // ---- The Grand Evolution I
  if (l === 'd27 evolution1'){
    UI.millLog = []; mill(10); const milled = UI.millLog || []; UI.millLog = null;
    const cr = milled.filter(c => S.gy.includes(c) && isCreatureCard(c));
    if (cr.length && !UI.dry){ const ids = await pickCards({title:`${name}: put up to two creature cards from among the milled cards onto the battlefield`, cards:cr, min:0, max:Math.min(2, cr.length), noneLabel:'None'}); for (const id of (ids || []).slice(0, 2)){ const c = S.gy.find(x => x.id === id); if (c){ moveCard(c.id, 'bf'); log(`${name}: put ${cname(c)} onto the battlefield`); } } }
    commit(); return true; }

  // ---- The Grand Evolution III: creatures gain a fight ability until end of turn
  if (l === 'd27 evolution3'){
    const cs = S.bf.filter(c => !c.fd && isCreatureCard(c)); D27.fight = D27.fight || {};
    cs.forEach(c => { c.d27fight = turnStr(); }); AB_CACHE.clear();
    log(`${name}: until end of turn, creatures they control gain "{1}: This creature fights target creature you don't control."`); commit(); return true; }

  // ---- Bloodsoaked Insight
  if (l === 'd27 insight'){
    const pid = r21Pids('target opponent', ctx)[0]; ctx.r21 = true; if (!pid || pid === MYPID || UI.dry) return true;
    const ids = await r21ExileFrom([pid], ctx, {n:3, w:'r'});
    ids.forEach(id => { const c = S.ex.find(x => x.id === id); if (c) c.mayPlay = {t:turnStr(), next:true, cast:false, src:name, u0:S.untapN, free:false, adv:false, any:true}; });
    if (ids.length) log(`${name}: may play those cards until the end of their next turn, with mana of any type`); commit(); return true; }

  // ---- Expensive Taste
  if (l === 'd27 taste'){
    const pid = r21Pids('target opponent', ctx)[0]; ctx.r21 = true; if (!pid || pid === MYPID || UI.dry) return true;
    const ids = await r21ExileFrom([pid], ctx, {n:2, w:'r'});
    ids.forEach(id => { const c = S.ex.find(x => x.id === id); if (c) c.mayPlay = {t:turnStr(), next:false, cast:false, src:name, u0:S.untapN, free:false, adv:true, any:false}; });
    if (ids.length) log(`${name}: exiled ${ids.length} face down — they may look at and play them for as long as they remain exiled`); commit(); return true; }

  // ---- Aclazotz: each opponent discards; draw for each who can't
  if (l === 'd27 aclazotz'){
    let cant = 0;
    for (const p of opponents()){ const o = OPP.get(p.pid) || {}; const hc = o.hc ?? (o.hand || []).length; if (!hc) cant++; else if (!UI.dry) sendRq(p.pid, 'discard', 1, name); }
    log(`${name}: each opponent discards a card${cant ? ` — ${cant} couldn't, so they draw ${cant}` : ''}`);
    if (cant && !UI.dry) draw(cant); commit(); return true; }

  // ---- Gnome Soldier token (Thousand Moons Smithy / Barracks)
  if (l === 'd27 gnome'){ await d27GnomeToken(ctx); return true; }

  // ---- Legion Leadership
  if (/^until end of turn, double target creature's power and it gains first strike$/.test(l)){
    const t = d27Tg(ctx)[0]; if (!t) return true; const st = statsAny(t); const p = st ? st[0] : 0;
    applyTo(t, {op:'pump', src:name, f:{p, t:0, kw:['first strike']}}); log(`${name}: ${t.nm} gets +${p}/+0 and first strike`); commit(); return true; }

  // ---- Hydroelectric Specimen
  if (/^(?:you may )?change the target of target instant or sorcery spell with a single target to ~$/.test(lt)){
    if (UI.dry) return true;
    const one = x => { const txt = x.pid === MYPID && x.it ? String(x.it.txt || x.txt || '') : String(x.txt || ''); const sp = targetSpecs(txt); return sp.length === 1 && sp[0].n === 1 && !!(x.tgtNm || x.tgt); };
    const cands = stackAll().filter(x => x.kind === 'spell' && x.sid !== (ctx.it && ctx.it.sid) && m24IsIS(x) && one(x));
    let x = ctx.it && ctx.it.tgt ? cands.find(i => i.sid === ctx.it.tgt) : null;
    if (!x && cands.length){ const v = await askChoice({title:`${name}: change the target of which spell to ${name}?`, options:[...cands.map(i => ({label:m24Label(i), value:i.sid})), {label:"Don't", value:''}]}); x = v ? cands.find(i => i.sid === v) : null; }
    else if (x && /^you may/.test(lt) && !(await askYes(`${name}: change the target of ${x.nm} to ${name}?`, 'Change it', "Don't"))) x = null;
    if (!x){ log(`${name}: no instant or sorcery spell with a single target changed`); return true; }
    await r21Retarget({...ctx, it:{...(ctx.it || {}), tgt:x.sid}}, {spec:'instant or sorcery spell', single:true, toSelf:true}); return true; }

  // ---- Murderous Rider: when it dies, put it on the bottom of its owner's library
  if (/^put it on the bottom of its owner's library$/.test(l) && /when (?:~|this creature|murderous rider) dies, put it on the bottom of its owner's library/.test(d27AllText(ctx.k).toLowerCase())){
    if (UI.dry) return true;
    const id = ctx.srcId != null ? ctx.srcId : ctx.it && ctx.it.evId; const [z] = id != null ? find(id) : [null];
    if (z === 'gy'){ moveCard(id, 'lib', {bottom:true, quiet:true}); log(`${name} was put on the bottom of its owner's library`); }
    else { const pid = [...OPP.keys()].find(p => (OPP.get(p).gy || []).includes(ctx.k)); if (pid) sendRq(pid, 'd27gyHand', 0, name, {d:'lib|' + ctx.k}); }
    commit(); return true; }

  // ---- Sword of the Realms: whenever equipped creature dies, return it to its owner's hand
  if (/^return it to its owner's hand$/.test(l) && /whenever equipped creature dies, return it to its owner's hand/.test(d27AllText(ctx.k).toLowerCase())){
    if (UI.dry) return true;
    const id = ctx.it && ctx.it.evId; const k = ctx.it && ctx.it.evk; const c = id != null ? S.gy.find(g => g.id === id) : null;
    if (c){ moveCard(c.id, 'hand'); log(`${name}: returned ${cname(c)} to its owner's hand`); }
    else if (k){ const pid = [...OPP.keys()].find(p => (OPP.get(p).gy || []).includes(k)); if (pid){ sendRq(pid, 'd27gyHand', 0, name, {d:'hand|' + k}); log(`${name}: ${info(k)?.n} returns to ${nameOf(pid)}'s hand`); } }
    commit(); return true; }

  // ---- Tergrid's Lantern
  if (/^target player loses 3 life unless they sacrifice a nonland permanent of their choice or discard a card$/.test(l)){
    const t = d27Tg(ctx)[0]; if (!t || UI.dry) return true; const pid = t.pid || MYPID;
    if (pid === MYPID) await r23fTormentMe(1, name); else { sendRq(pid, 'r23fTorment', 1, name); log(`${name}: ${nameOf(pid)} loses 3 life unless they sacrifice a nonland permanent or discard a card`); }
    commit(); return true; }

  // ---- Overture
  if (/^target opponent mills half their library, rounded down$/.test(l)){
    const t = d27Tg(ctx)[0]; const pid = t && t.pid; if (!pid) return true;
    if (pid === MYPID){ const n = Math.floor(S.lib.length / 2); mill(n); log(`${name}: milled ${n}`); } else { sendRq(pid, 'r23Imillh', 0, name); log(`${name}: ${nameOf(pid)} mills half their library, rounded down`); }
    commit(); return true; }

  // ---- Heliod, the Radiant Dawn
  if (/^return target enchantment card that isn't a god from your graveyard to your hand$/.test(l)){
    const t = d27Tg(ctx)[0]; const c = t && S.gy.find(g => g.id === t.id);
    if (c && descOk(c.k, 'non-god enchantment')){ moveCard(c.id, 'hand'); log(`${name}: returned ${cname(c)} to their hand`); } commit(); return true; }

  // ---- Halvar: move an Aura or Equipment
  if (/^(?:you may )?attach target aura or equipment attached to a creature you control to target creature you control$/.test(l)){
    const a = d27Tg(ctx)[0], b = d27Tg(ctx)[0]; if (!a || !b || UI.dry) return true;
    const e = boardOf(a.pid || MYPID).find(x => x.id === a.id); const host = e && e.att;
    if (!e || !/\b(Aura|Equipment)\b/.test(typeOf(e) || info(e.k)?.t || '')){ log(`${name}: that isn't an Aura or Equipment`); return true; }
    const hostC = host && boardOf(host.pid).find(x => x.id === host.id);
    if (!hostC || host.pid !== MYPID || !isCreatureCard(hostC)){ log(`${name}: ${a.nm} isn't attached to a creature you control`); return true; }
    if (b.pid !== MYPID || !S.bf.some(x => x.id === b.id && isCreatureCard(x))){ log(`${name}: illegal target`); return true; }
    if (host.id === b.id) return true;
    if ((a.pid || MYPID) === MYPID){ e.att = {pid:MYPID, id:b.id}; } else sendRq(a.pid, 'd27att', 0, name, {tid:a.id, d:`${MYPID}|${b.id}`});
    log(`${name}: attached ${a.nm} to ${b.nm}`); commit(); return true; }

  // ---- Hydaelyn: if that creature is legendary, draw a card
  if (/^if that creature is legendary, draw a card$/.test(l)){
    const t = (ctx.lastT || [])[0]; const c = t && boardOf(t.pid || MYPID).find(x => x.id === t.id);
    if (UI.dry || (c && /\bLegendary\b/.test(typeOf(c) || info(c.k)?.t || ''))){ if (!UI.dry){ draw(1); log(`${name}: ${cname(c)} is legendary — drew a card`); } } commit(); return true; }

  // ---- Ral, Monsoon Mage: if you lose the flip, ~ deals 1 damage to you
  if ((m = lt.match(/^if you lose the flip, ~ deals (\d+) damage to you$/))){
    const lost = ctx.coin ? ctx.coin === 'tails' : true;
    if (UI.dry) return true;
    if (lost){ log(`${name}: lost the flip`); dealDamage({t:'player', pid:MYPID}, +m[1], ctx.k, d27Src(ctx)); }
    commit(); return true; }


  // ---- Agadeem's Awakening
  if (/^return from your graveyard to the battlefield any number of target creature cards that each have a different mana value x or less$/.test(l)){
    const x = +((ctx.it && ctx.it.x) ?? 0) || 0; if (UI.dry) return true;
    const pool = S.gy.filter(c => isCreatureCard(c) && (info(c.k)?.mv || 0) <= x);
    const got = await d27PickGroup(`${name}: return creature cards with different mana values (X = ${x})`, 'Each card must have a different mana value, each X or less.', pool, cs => new Set(cs.map(c => info(c.k)?.mv || 0)).size === cs.length);
    got.forEach(c => { moveCard(c.id, 'bf'); log(`${name}: returned ${cname(c)} to the battlefield`); }); if (!got.length) log(`${name}: returned nothing`); commit(); return true; }

  // ---- Phoenix, Warden of Fire III
  if (/^return any number of target creature cards with total mana value 6 or less from your graveyard to the battlefield$/.test(l)){
    if (UI.dry) return true;
    const pool = S.gy.filter(c => isCreatureCard(c) && (info(c.k)?.mv || 0) <= 6);
    const got = await d27PickGroup(`${name}: return creature cards with total mana value 6 or less`, 'Their total mana value can be at most 6.', pool, cs => cs.reduce((a, c) => a + (info(c.k)?.mv || 0), 0) <= 6);
    got.forEach(c => { moveCard(c.id, 'bf'); log(`${name}: returned ${cname(c)} to the battlefield`); }); if (!got.length) log(`${name}: returned nothing`); commit(); return true; }

  // ---- The Great Work I
  if ((m = lt.match(/^~ deals (\d+) damage to target opponent and each creature they control$/))){
    const n = +m[1]; const t = d27Tg(ctx)[0]; const pid = t && t.pid; if (!pid || UI.dry) return true;
    const sc = d27Src(ctx); dealDamage({t:'player', pid}, n, ctx.k, sc);
    if (pid === MYPID) S.bf.filter(c => !c.fd && isCreatureCard(c)).forEach(c => dealDamage({t:'card', pid:MYPID, id:c.id, k:c.k}, n, ctx.k, sc));
    else { sendRq(pid, 'dmgAll', n, name, {d:'creature', f:srcFlags(ctx.k, MYPID, sc)}); log(`${name} deals ${n} damage to each creature ${nameOf(pid)} controls`); }
    commit(); return true; }

  // ---- The Great Work III
  if (/^until end of turn, you may cast instant and sorcery spells from any graveyard$/.test(l)){
    S.d27gw = turnStr(); log(`${name}: until end of turn, may cast instant and sorcery spells from any graveyard (exiled instead of going to a graveyard)`); commit(); return true; }
  if (/^if a spell cast this way would be put into a graveyard, exile it instead$/.test(l) && /cast instant and sorcery spells from any graveyard/.test(full)) return true;   // after:'ex' / r21exAfter on those casts

  // ---- Thousand Moons Smithy: tap five untapped artifacts and/or creatures you control
  if (/^(?:you may )?tap five untapped artifacts and\/or creatures you control$/.test(l)){
    const pool = S.bf.filter(c => !c.fd && !c.tap && (isCreatureCard(c) || /\bArtifact\b/.test(typeOf(c))));
    const cnt = pool.reduce((a, c) => a + Math.max(1, (c.n || 1) - (c.tn || 0)), 0);
    if (cnt < 5){ ctx.didPay = false; ctx.mayYes = false; if (!UI.dry) log(`${name}: fewer than five untapped artifacts and/or creatures`); return true; }
    if (UI.dry){ ctx.didPay = true; return true; }
    if (/^you may/.test(l) && !(await askYes(`${name}: tap five untapped artifacts and/or creatures you control?`, 'Tap five', "Don't"))){ ctx.didPay = false; ctx.mayYes = false; return true; }
    let left = 5; const picked = [];
    while (left > 0){
      const legal = pool.filter(c => (c.n || 1) > 1 ? (c.tn || 0) < (c.n || 1) : !c.tap);
      if (!legal.length) break;
      const ids = await pickCards({title:`${name}: tap ${left} more untapped artifact${left === 1 ? '' : 's'} and/or creature${left === 1 ? '' : 's'}`, cards:legal, min:1, max:Math.min(left, legal.length)});
      const ch = (ids && ids.length ? ids : [legal[0].id]).map(id => legal.find(c => c.id === id)).filter(Boolean);
      for (const c of ch){ if (left <= 0) break; if ((c.n || 1) > 1) c.tn = (c.tn || 0) + 1; else c.tap = true; picked.push(cname(c)); emit({type:'tapped', k:c.k, id:c.id}); left--; }
    }
    ctx.didPay = left === 0; ctx.mayYes = left === 0; log(`${name}: tapped ${picked.join(', ')}`); commit(); return true; }

  // ---- The Grand Evolution II: distribute seven counters
  if ((m = l.match(/^distribute (seven|eight|nine|ten) (\+1\/\+1 counters among .+)$/))){ return doSentence(`Distribute ${wn(m[1])} ${s.slice(s.length - m[2].length)}`, ctx).then(() => true); }

  // ---- Vincent Valentine
  if (/^put a number of \+1\/\+1 counters on ~ equal to that creature's power$/.test(lt)){
    const it = ctx.it || {}; let n = it.evPid && it.evPid !== MYPID ? ((D27.lastPw || {})[it.evPid] || {})[it.evId] : null;
    if (n == null) n = h23lkPow(it.evId, it.evk); n = Math.max(0, +n || 0);
    const c = d27Src(ctx); if (c && n && !UI.dry){ modCounters(c, 'cp', n); log(`${name}: put ${n} +1/+1 counter${n === 1 ? '' : 's'} on it`); } commit(); return true; }

  // ---- The Great Synthesis: no maximum hand size while you control it (noMaxHand reads the Saga's text on the battlefield)
  if (/^you have no maximum hand size for as long as you control ~$/.test(lt)){ if (!UI.dry) log(`${name}: no maximum hand size while they control it`); return true; }

  // ---- Rona, Tolarian Obliterator
  if (l === 'd27 rona'){
    const pid = (ctx.it && ctx.it.evDp) || null; if (UI.dry) return true;
    if (!pid){ log(`${name}: no damage source controller`); return true; }
    if (pid === MYPID){
      if (!S.hand.length){ log(`${name}: no cards in hand`); return true; }
      const c = S.hand[Math.floor(Math.random() * S.hand.length)]; moveCard(c.id, 'ex', {quiet:true}); log(`${name}: exiled ${cname(c)} from their hand at random`);
      await d27RonaUse(c, ctx); commit(); return true; }
    const res = await r21Ask(pid, 'd27rona', 0, name, {});
    const c = (res.ids || []).map(id => S.ex.find(x => x.id === id)).filter(Boolean)[0];
    if (!c){ log(`${name}: ${nameOf(pid)} had no card to exile`); return true; }
    await d27RonaUse(c, ctx); if (S.ex.includes(c) && c.r21) r21Drop(c, ''); commit(); return true; }

  // ---- Ral, Leyline Prodigy
  if (/^until your next turn(?:,|:)? instant and sorcery spells you cast cost \{1\} less to cast$/.test(l)){ S.d27ral = (S.d27ral || []).filter(x => d27UntilNext(x)).concat(turnStr()); log(`${name}: until their next turn, instant and sorcery spells they cast cost {1} less`); commit(); return true; }
  if (/^draw a card if you control a blue permanent other than ~$/.test(lt)){
    const sc = d27Src(ctx); const blue = S.bf.some(c => c !== sc && !c.fd && c.k && /U/.test(d27Col(c)));
    if (blue && !UI.dry){ draw(1); log(`${name}: controls another blue permanent — drew a card`); } else if (!UI.dry) log(`${name}: no other blue permanent`); commit(); return true; }
  if (l === 'd27 ral8'){
    const top = S.lib.slice(0, 8); top.forEach(c => moveCard(c.id, 'ex', {quiet:true})); if (top.length) log(`${name}: exiled ${top.map(cname).join(', ')}`);
    top.filter(c => S.ex.includes(c) && /\b(Instant|Sorcery)\b/.test(info(c.k)?.t || '')).forEach(c => { c.mayPlay = {t:turnStr(), cast:true, src:name, u0:S.untapN, free:true}; });
    ctx.lastEx = top.map(c => c.id); commit(); return true; }

  return false;
}
function d27Col(c){ try { const e = typeof l24eff === 'function' ? l24eff(c) : null; if (e && e.colChanged) return e.col || ''; } catch {} return info(c.k)?.c || ''; }
function d27UntilNext(t0){ try { const cur = currentTurn(); return !(cur[1] === MYPID && turnStr() !== t0); } catch { return true; } }
async function d27RonaUse(c, ctx){
  const name = ctx.name;
  if (isLand(c.k)){
    if (await askYes(`${name}: put ${cname(c)} onto the battlefield under your control?`, 'Put it onto the battlefield', "Don't")){ moveCard(c.id, 'bf'); log(`${name}: put ${cname(c)} onto the battlefield`); }
    return; }
  if (await askYes(`${name}: cast ${cname(c)} without paying its mana cost?`, 'Cast it', "Don't")){ UI.afterCast = () => {}; await beginCast(c, 'ex', {free:true}); }
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound27DPre(s, l, ctx)) return; return ds(s0, ctx); }; }

// ---------- requests ----------
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'd27vast'){ (async () => { await d27Vast(r.src); })(); return; }
    if (r.op === 'd27att'){ const c = S.bf.find(b => b.id === r.tid); const [pid, id] = String(r.d || '').split('|'); if (c && pid){ c.att = {pid, id:+id}; log(`${cname(c)} was attached to another creature (${r.src})`); commit(); } return; }
    if (r.op === 'd27gyHand'){ const [to, k] = String(r.d || '').split('|'); const c = S.gy.find(g => g.k === k); if (c){ if (to === 'lib') moveCard(c.id, 'lib', {bottom:true, quiet:true}); else moveCard(c.id, 'hand'); log(`${cname(c)} went from their graveyard to their ${to === 'lib' ? 'library (bottom)' : 'hand'} (${r.src})`); commit(); } return; }
    return ao(r, from);
  };
}

// The Grand Evolution III: the granted fight ability (until end of turn)
{
  const al = abilityList;
  abilityList = function(c){ const out = al(c); try { if (c && c.d27fight && c.d27fight === turnStr() && isCreatureCard(c)){ const ab = D27.fightAb || (D27.fightAb = {cost:'{1}', eff:"~ fights target creature you don't control.", sorc:false, line:"{1}: This creature fights target creature you don't control.", d27:1}); return out.concat(ab); } } catch {} return out; };
}

/* ---------- statics ---------- */
STATIC_RULES.push(
  [/^creatures you control can boast twice during each of your turns rather than once$/, m => ({kind:'d27boast2', who:'you'})],
  [/^untap each creature you control during each other player's untap step$/, m => ({kind:'crSeedborn', who:'you'})],
  [/^(?:~|[a-z ,']+) enters with an additional loyalty counter on (?:him|her|it) for each instant and sorcery spell you've cast this turn$/, m => ({kind:'d27ralLoy', who:'you'})],
);
// layer 7b / layer 4: Porcelain Gallery, Awakened Skyclave
{ const lp = l24parseStatic; l24parseStatic = function(line){ const l = String(line || '').toLowerCase().replace(/\.$/, '').trim();
    if (/^creatures you control have base power and toughness each equal to the number of creatures you control$/.test(l)) return {scope:'you', desc:'creature', mod:{pt:[0, 0], d27cnt:1}};
    if (/^as long as (?:~|this creature|[a-z ,']+) is on the battlefield, it's a land in addition to its other types$/.test(l)) return {scope:'you', desc:'', cond:'u25self', mod:{addC:['Land']}};
    return lp(line); }; }
{ const sl = l24srcList; l24srcList = function(){ const out = sl();
    if (D27.inCnt) return out;
    try { for (const x of out){ if (!x.st || !x.st.mod || !x.st.mod.d27cnt) continue;
        D27.inCnt = 1; let n = 0; try { n = boardOf(x.pid).filter(c => c.k && !c.fd && isCreatureCard(c)).reduce((a, c) => a + (c.n || 1), 0); } finally { D27.inCnt = 0; }
        x.st = {...x.st, mod:{...x.st.mod, pt:[n, n]}}; } } catch (e){ console.warn('d27 gallery', e); }
    return out; }; }

// Ral, Leyline Prodigy: extra loyalty for each instant and sorcery spell cast this turn
{ const oe = onEnter; onEnter = function(c, from, o = {}){ const r = oe(c, from, o);
    try { if (c && from !== 'bf' && !c.fd && S.bf.includes(c)){ const f = faceOf(c); if (f && /enters with an additional loyalty counter on (?:him|her|it) for each instant and sorcery spell you've cast this turn/i.test(f.o || '')){
        const t = turnStr(); const n = (S.casts || []).filter(x => x.t === t && /\b(Instant|Sorcery)\b/.test(info(x.k)?.t || '')).length;
        if (n){ modCounters(c, 'co', n); log(`${f.n} enters with ${n} additional loyalty counter${n === 1 ? '' : 's'}`); } } } } catch (e){ console.warn('d27 ral', e); }
    return r; }; }
// Ral +1: instant and sorcery spells cost {1} less until your next turn
// (costMods reads "spells you cast cost {1} less" anywhere in a permanent's text — also inside Ral's +1 loyalty ability, which
//  must only apply after it resolves: drop entries whose only source text is a loyalty ability line)
function d27LoyOnly(n){ const fs = []; for (const b of boardsAll()) for (const c of b.bf){ if (!c.k || c.fd) continue; const f = faceOf(c); if (f && f.n === n) fs.push(f); }
  return fs.length > 0 && fs.every(f => { const ls = String(f.o || '').split('\n').filter(x => /spells?[^.]* costs? \{\d+\} (?:less|more)/i.test(x)); return ls.length && ls.every(x => /^[+−\-]?(?:\d+|X):/.test(x.trim())); }); }
{ const cm = costMods; costMods = function(c, pid, ...a){ let r = cm(c, pid, ...a);
    try { if (r && (r.less.length || r.more.length)){ const bad = new Set([...r.less, ...r.more].map(x => x.src).filter(n => n && d27LoyOnly(n))); if (bad.size) r = {...r, less:r.less.filter(x => !bad.has(x.src)), more:r.more.filter(x => !bad.has(x.src))}; } } catch {}
    try { if (S && (pid == null || pid === MYPID) && r && r.less && c && /\b(Instant|Sorcery)\b/.test(info(c.k)?.t || '')){ const live = (S.d27ral || []).filter(t => d27UntilNext(t)); if (live.length) return {...r, less:r.less.concat({src:'Ral, Leyline Prodigy (+1)', n:live.length})}; } } catch {}
    return r; }; }

// The Great Work III: instants and sorceries from any graveyard this turn (exiled afterwards)
{ const go = gyOptions; gyOptions = function(c){ const r = go(c) || [];
    try { if (S && S.d27gw === turnStr() && c && /\b(Instant|Sorcery)\b/.test(info(c.k)?.t || '')){ const a = info(c.k); r.push({kind:'gycast', label:`Cast from graveyard (The Great Work) ${a.m}`, mana:a.m, extra:[], after:'ex'}); } } catch {}
    return r; }; }
{ const rm = renderModal; renderModal = function(...a){ const r = rm.apply(this, a);
    try { const m = UI.modal; if (m && m.type === 'opp' && m.zone === 'gy' && S && S.d27gw === turnStr()){ const s = OPP.get(m.pid); const list = (s && s.gy || []).filter(Boolean);
        document.querySelectorAll('#modal .vitem').forEach((el, i) => { const k = list[i]; if (!k || !/\b(Instant|Sorcery)\b/.test(info(k)?.t || '')) return;
          const b = document.createElement('button'); b.type = 'button'; b.dataset.act = 'd27oppGy'; b.dataset.pid = m.pid; b.dataset.k = k; b.textContent = 'Cast (The Great Work)'; el.appendChild(b); }); } } catch (e){ console.warn('d27 gy', e); }
    return r; }; }
ACT.d27oppGy = async function(el){ const pid = el.dataset.pid, k = el.dataset.k; closeModal(); await d27CastOppGy(pid, k); };
async function d27CastOppGy(pid, k){
  if (!S || S.d27gw !== turnStr()){ toast('The Great Work: only until end of turn'); return false; }
  const res = await r21Ask(pid, 'r21gyLend', 0, 'The Great Work', {d:k});
  const ids = (res.ids || []).filter(id => S.ex.some(c => c.id === id)); if (!ids.length){ toast("Couldn't get that card"); return false; }
  ids.forEach(id => { const c = S.ex.find(x => x.id === id); if (c) c.r21exAfter = 1; });
  const n0 = (S.casts || []).length;
  await r21CastNow({name:'The Great Work', r21ids:ids}, {max:1});
  ids.map(id => S.ex.find(c => c.id === id)).filter(Boolean).forEach(c => r21Drop(c, ''));
  commit(); return (S.casts || []).length > n0;
}

// Rona, Tolarian Obliterator: "whenever a source deals damage to ~" is a dealt-damage trigger; the event carries the source's controller
{ const ct = classifyTrig; classifyTrig = function(w, c){ if (w === 'whenever' && /^a source deals damage to ~$/.test(String(c))) return {ev:'dealt', subj:'self', ctl:'you', desc:''}; return ct(w, c); }; }
{ const em = emit; emit = function(ev){ try { if (ev && ev.type === 'dealt' && UI.d27dmgFrom && !ev.dp) ev.dp = UI.d27dmgFrom;
    } catch {} return em(ev); }; }
// last known power of other players' creatures (their die events don't carry it): remembered from each board update
{ const ors = onRemoteState; onRemoteState = function(pid, s, ...a){ try { if (S && s && Array.isArray(s.bf)){ D27.lastPw = D27.lastPw || {}; const m = D27.lastPw[pid] = D27.lastPw[pid] || {};
      for (const c of s.bf){ if (!c || !c.k || c.fd || !isCreatureCard(c)) continue; const st = stats(c, pid); if (st) m[c.id] = Math.max(0, st[0] || 0); }
      const ks = Object.keys(m); if (ks.length > 120) ks.slice(0, ks.length - 120).forEach(k => delete m[k]); } } catch {} return ors(pid, s, ...a); }; }
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'dmg' || r.op === 'dmgAll'){ const prev = UI.d27dmgFrom; UI.d27dmgFrom = from || MYPID; try { return ao(r, from); } finally { UI.d27dmgFrom = prev; } }
    if (r.op === 'd27rona'){ let n = 0;
      if (S.hand.length){ const c = S.hand[Math.floor(Math.random() * S.hand.length)]; moveCard(c.id, 'ex', {quiet:true}); const e = S.ex.find(x => x.id === c.id); if (e){ log(`exiled ${cname(e)} from my hand at random (${r.src})`); r21Lend(e, from, r.ref, 'r', r.src); n = 1; } }
      r21Ack(from, r.ref, n, r.src); commit(); return; }
    return ao(r, from);
  };
}

// Boast: "Activate only if this creature attacked this turn and only once each turn" (twice with Birgi)
function d27BoastLines(c){ const f = faceOf(c); if (!f) return []; return String(f.o || '').split('\n').map(x => x.trim()).filter(x => /^Boast — /.test(x)).map(x => tname(x.replace(/^Boast — /, ''), f.n).trim()); }
{ const al = abilityList; abilityList = function(c){ const out = al(c); try { if (c && out.length){ const bl = d27BoastLines(c); if (bl.length) out.forEach(ab => { if (!ab.boast && bl.includes(String(ab.line || '').trim())) ab.boast = true; }); } } catch {} return out; }; }
function d27Attacked(c){ const t = turnStr(); if (S.r23atk && S.r23atk.t === t && S.r23atk.ids.includes(c.id)) return true; return (S.ev || []).some(e => e.type === 'attack' && e.id === c.id && S.d27atkT === t); }
function d27BoastMax(){ return rulesOn('d27boast2').length && d27Mine() ? 2 : 1; }
{ const ar = abilityReady; abilityReady = function(c, ab, mana){ const r = ar(c, ab, mana); if (r || !ab || !ab.boast) return r;
    try { if (!d27Attacked(c)) return 'Boast: it must have attacked this turn'; const b = S.d27boast && S.d27boast.t === turnStr() ? (S.d27boast.n[c.id] || 0) : 0; if (b >= d27BoastMax()) return d27BoastMax() > 1 ? 'Boast: already boasted twice this turn' : 'Boast: once each turn'; } catch {}
    return r; }; }
{ const aa = activateAbility; activateAbility = async function(c, ab, ...a){ const n0 = S && S.stk ? S.stk.length : 0; const r = await aa(c, ab, ...a);
    try { if (ab && ab.boast && S.stk.length > n0){ if (!S.d27boast || S.d27boast.t !== turnStr()) S.d27boast = {t:turnStr(), n:{}}; S.d27boast.n[c.id] = (S.d27boast.n[c.id] || 0) + 1; commit(); } } catch {}
    return r; }; }
{ const em = emit; emit = function(ev){ try { if (ev && ev.type === 'attack' && S) S.d27atkT = turnStr(); } catch {} return em(ev); }; }
