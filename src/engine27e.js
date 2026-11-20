/* ===================== Rules engine — round 27 helper E: the last one-offs (mostly back faces) ===================== */
const E27 = {};
const e27Tgt = ctx => (ctx && ctx.tgts ? nextTargets(ctx) : []);
const e27Types = k => { const t = String(info(k)?.t || '').split('—')[0]; return ['Artifact', 'Battle', 'Creature', 'Enchantment', 'Instant', 'Kindred', 'Land', 'Planeswalker', 'Sorcery'].filter(x => new RegExp('\\b' + x + '\\b').test(t)); };
const e27Mv = k => (info(k)?.mv || 0);

/* ---------- combat damage dealt to me (Marchesa, Resolute Monarch) ---------- */
{ const hd = hitDefender; hitDefender = function(def, n, a, extra){ return hd(def, n, a, {...(extra || {}), cbt:1}); }; }
{ const dm = damageMe; damageMe = function(n, f = {}, from){ const l0 = S ? S.life : 0; const p0 = S ? S.psn : 0; const r = dm(n, f, from);
    try { if (S && f && (f.cbt || f.p24c) && n > 0 && (S.life < l0 || S.psn > p0)) S.e27hitK = tkey(currentTurn()); } catch {} return r; }; }
{ const cf = cleanFlags; cleanFlags = function(f){ const o = cf(f); try { if (f && typeof f === 'object') ['cbt', 'e27vamp', 'e27ll'].forEach(k => { if (f[k]) o[k] = 1; }); } catch {} return o; }; }
{ const smt = startMyTurn; startMyTurn = function(...a){ try { if (S){ S.e27prevMy = S.e27curMy || 0; S.e27curMy = tkey(currentTurn()); } } catch {} return smt.apply(this, a); }; }
const e27HitSinceLast = () => !!(S && S.e27hitK && S.e27hitK > (S.e27prevMy || 0));

async function doRound27EPre(s, l, ctx){
  let m; const name = ctx.name; const it = ctx.it || {}; const full = String(ctx.full || '').toLowerCase();
  const say = async t => doSentence(cap(t), ctx);
  // ---- Revenge: double your life total (CR 119.5 / 107.1: gain life equal to it)
  if (/^double your life total$/.test(l)){ if (S.life > 0) gainLife(S.life, name); log(`${name}: life total doubled → ${S.life}`); commit(); return true; }
  // ---- Shiva, Warden of Ice — Cold Snap
  if (/^tap all lands your opponents control$/.test(l)){
    let n = 0; for (const p of opponents()) for (const c of boardOf(p.pid)) if (c.k && !c.fd && isLand(c.k) && !c.tap){ applyTo({t:'card', pid:p.pid, id:c.id, k:c.k}, {op:'tap', src:name}); n++; }
    log(`${name}: tapped all lands ${opponents().length === 1 ? 'the opponent controls' : 'opponents control'} (${n})`); commit(); return true; }
  // ---- Exude Toxin: each non-Dragon creature gets -X/-X
  if ((m = l.match(/^each non-([a-z]+) creature gets -(x|\d+)\/-(x|\d+) until end of turn$/))){
    const x = m[2] === 'x' ? ((it.x ?? it.evX) || 0) : +m[2]; const sub = new RegExp('\\b' + m[1] + '\\b', 'i');
    const ok = k => /\bCreature\b/.test(info(k)?.t || '') && !sub.test(info(k)?.t || '');
    if (x){ S.bf.filter(c => !c.fd ? (isCreatureCard(c) && !sub.test(typeOf(c))) : isCreatureCard(c)).forEach(c => { c.pu = [(c.pu || [0, 0])[0] - x, (c.pu || [0, 0])[1] - x]; });
      for (const [pid, st] of OPP) (st.bf || []).filter(b => b.k && (b.fd || ok(b.k))).forEach(b => sendRq(pid, 'pump', 0, name, {tid:b.id, f:{p:-x, t:-x}})); }
    log(`${name}: each non-${cap(m[1])} creature gets -${x}/-${x} until end of turn`); commit(); return true; }
  // ---- Fetch Quest: mill seven, then put a creature, enchantment, or land card from among them onto the battlefield
  if ((m = l.match(/^mill (seven|six|eight|nine) cards$/))){ const n = wn(m[1]) || {seven:7, six:6, eight:8, nine:9}[m[1]]; const top = S.lib.slice(0, n); mill(n); ctx.e27milled = top.map(c => c.id); return true; }
  if ((m = l.match(/^(?:then )?put an? ((?:[a-z]+(?:,? or |, ))*[a-z]+) card from among the milled cards onto the battlefield$/))){
    const kinds = m[1].split(/,? or |, /).map(x => x.trim()).filter(Boolean);
    const ids = ctx.e27milled || []; const pool = S.gy.filter(c => ids.includes(c.id) && kinds.some(d => descOk(c.k, d)));
    if (!pool.length){ log(`${name}: no ${kinds.join(', ')} card among the milled cards`); return true; }
    const pick = pool.length === 1 || UI.dry ? [pool[0].id] : await pickCards({title:`${name}: put a ${kinds.join(', ')} card onto the battlefield`, cards:pool, min:1, max:1});
    const c = pick && S.gy.find(g => g.id === pick[0]); if (c){ moveCard(c.id, 'bf'); log(`${name}: put ${cname(c)} onto the battlefield`); } commit(); return true; }
  // ---- Likeness of the Seeker
  if (/^untap up to three lands you control$/.test(l)){ await say('untap up to three lands'); return true; }
  // ---- Rush of Inspiration: discard at random unless you pay {E}{E}
  if ((m = l.match(/^(?:then )?discard a card at random unless you pay ((?:\{e\})+)$/))){
    const need = (m[1].match(/\{e\}/g) || []).length; const have = (S.pc || {}).energy || 0;
    if (have >= need && !UI.dry && await askYes(`${name}: pay ${need} energy ({E}${need > 1 ? '×' + need : ''}) so you don't discard a card at random? (you have ${have})`, `Pay ${need} energy`, 'Discard at random')){ addPC('energy', -need); return true; }
    if (!S.hand.length) return true; const c = S.hand[Math.floor(Math.random() * S.hand.length)]; moveCard(c.id, 'gy'); emit({type:'discard', k:c.k, id:c.id, cnt:1}); log(`${name}: discarded ${cname(c)} at random`); commit(); return true; }
  // ---- Wedding Announcement
  if ((m = l.match(/^if you attacked with two or more creatures this turn, (.+)$/))){
    const a = S.r23atk && S.r23atk.t === turnStr() ? S.r23atk.ids.length : 0; const ok = a >= 2;
    ctx.r23IotherOk = !ok; if (ok || UI.dry) await say(s.slice(s.length - m[1].length)); else log(`${name}: attacked with ${a} creature${a === 1 ? '' : 's'} this turn`); return true; }
  // ---- Marchesa, Resolute Monarch
  if ((m = l.match(/^if you haven't been dealt combat damage since your last turn, (.+)$/))){
    if (!e27HitSinceLast() || UI.dry) await say(s.slice(s.length - m[1].length)); else log(`${name}: you were dealt combat damage since your last turn`); return true; }
  // ---- Polluted Cistern: card types among the cards put into my graveyard from my library
  if (/^each opponent loses 1 life for each card type among those cards$/.test(l)){
    const ids = it.qids || []; const ty = new Set(); ids.forEach(id => { const c = find(id)[2]; if (c) e27Types(c.k).forEach(t => ty.add(t)); });
    const n = UI.dry ? 1 : ty.size; if (n) for (const p of opponents()) await loseLife(p.pid, n, name);
    log(`${name}: ${ty.size} card type${ty.size === 1 ? '' : 's'} among those cards${ty.size ? ' (' + [...ty].join(', ') + ')' : ''}`); commit(); return true; }
  // ---- Turn Stones: for each opponent, create a token
  if ((m = s.match(/^For each opponent, you create (a|an) (.+? token)( with ".+")?$/i))){
    const n = Math.max(UI.dry ? 1 : 0, opponents().length); for (let i = 0; i < n; i++) await say(`create ${m[1]} ${m[2]}${(m[3] || '').replace(/"When [^,"]+ dies,/i, '"When this creature dies,')}`); return true; }
  // ---- Sorin, Ravenous Neonate −6: gain control; Vampire; lifelink counter if I control another white permanent
  if (/^gain control of target creature$/.test(l) && /put a lifelink counter on it if you control a white permanent other than that creature or /.test(full)){
    const t = e27Tgt(ctx).find(x => x.t === 'card'); ctx.e27sorin = 1; if (!t) return true; const sc = srcCardOf(ctx);
    const ll = S.bf.some(c => !c.fd && c.id !== t.id && (!sc || c.id !== sc.id) && descOk(c.k, 'white permanent', {tok:c.tok}));
    if (t.pid === MYPID || !t.pid){ const c = S.bf.find(b => b.id === t.id); if (c){ addXType(c, 'vampire'); if (ll){ addNamed(c, 'lifelink', 1); c.ekw = [...new Set([...(c.ekw || []), 'lifelink'])]; } } }
    else applyTo(t, {op:'steal', src:name, f:{e27vamp:1, e27ll:ll ? 1 : 0}});
    log(`${name}: gains control of ${t.nm || 'that creature'} — it becomes a Vampire${ll ? ' with a lifelink counter' : ''}`); commit(); return true; }
  if (ctx.e27sorin && (/^it becomes a vampire in addition to its other types$/.test(l) || /^put a lifelink counter on it if you control a white permanent other than that creature or /.test(l))) return true;
  // ---- Expansion: copy target instant or sorcery spell with mana value N or less
  if ((m = l.match(/^copy target (instant or sorcery|instant|sorcery) spell with mana value (\d+) or less$/))){
    const orig = it.tgt ? stackAll().find(x => x.sid === it.tgt) : null;
    if (orig && e27SpellMv(orig) > +m[2]){ log(`${name}: ${orig.nm} has mana value ${e27SpellMv(orig)} now — the copy fizzles`); return true; }
    if (!UI.dry) await copyTargetItem(ctx); return true; }
  // ---- The Tomb of Aclazotz: the creature cast this way enters with a finality counter and is a Vampire
  if (/^it enters with a finality counter on it and is a vampire in addition to its other types$/.test(l)){ S.e27tomb = {t:turnStr(), n:((S.e27tomb && S.e27tomb.t === turnStr()) ? S.e27tomb.n : 0) + 1}; commit(); return true; }
  // ---- Ghastly Mimicry: token copy of enchanted creature, except it's a Spirit
  if ((m = s.match(/^create a token that's a copy of enchanted creature, except (.+)$/i))){
    const sc = srcCardOf(ctx); const at = sc && sc.att; const h = at && at.id != null ? boardOf(at.pid || MYPID).find(b => b.id === at.id) : null;
    if (!h){ log(`${name}: it isn't enchanting a creature`); return true; }
    const {ex, post} = cpyExc(m[1], {tok:true, mine:true}); const key = cpyKey(cpyCV(h), ex); const tk = cpyTok(key, {post}); ctx.lastTok = tk ? [tk.id] : []; commit(); return true; }
  // ---- The Legend of Yangchen I: starting with me, each player chooses up to one permanent (MV >= N) among my opponents' permanents; exile them
  if ((m = l.match(/^starting with you, each player chooses up to one permanent with mana value (\d+) or greater from among permanents your opponents control$/))){
    const N = +m[1]; const cands = []; for (const p of opponents()) boardOf(p.pid).forEach(c => { if (c.k && !c.fd && e27Mv(c.k) >= N) cands.push({pid:p.pid, c}); });
    ctx.e27chosen = []; if (!cands.length || UI.dry){ log(`${name}: no permanent with mana value ${N} or greater among opponents' permanents`); return true; }
    const ps = players(); const me = ps.findIndex(p => p.me); const order = ps.slice(me).concat(ps.slice(0, me)); const list = cands.slice(0, 20);
    for (const p of order){
      let pick = null;
      if (p.me){ const v = await askChoice({title:`${name}: choose up to one permanent with mana value ${N} or greater (it will be exiled)`, options:[...list.map((x, i) => ({label:`${cname(x.c)} (${nameOf(x.pid)}, MV ${e27Mv(x.c.k)})`, value:String(i)})), {label:'Choose nothing', value:'none'}]}); pick = v != null && v !== 'none' ? list[+v] : null; }
      else { const i = await e27OppPick(p.pid, list.map(x => x.c.k), `${name}: choose up to one permanent (MV ${N}+) an opponent of ${nameOf(MYPID)} controls — it will be exiled`, name); pick = i != null ? list[i] : null; }
      if (pick){ ctx.e27chosen.push(pick); log(`${name}: ${nameOf(p.pid)} chose ${cname(pick.c)}`); }
    }
    return true; }
  if (/^exile those permanents$/.test(l) && ctx.e27chosen){ const seen = new Set(); for (const x of ctx.e27chosen){ const key = x.pid + ':' + x.c.id; if (seen.has(key)) continue; seen.add(key); applyTo({t:'card', pid:x.pid, id:x.c.id, k:x.c.k}, {op:'exile', src:name}); } log(`${name}: exiled ${seen.size} permanent${seen.size === 1 ? '' : 's'}`); commit(); return true; }
  if (/^exile those permanents$/.test(l) && UI.dry && /each player chooses up to one permanent/.test(full)) return true;
  // ---- Yangchen II: have target opponent draw N
  if ((m = l.match(/^(you may )?have target opponent draw (a|one|two|three|four) cards?$/))){ const n = wn(m[2]) || 1; if (m[1] && !UI.dry && !(await askYes(`${name}: have the target opponent draw ${n} card${n === 1 ? '' : 's'}? (If you do, you draw ${n} too.)`, 'Yes', 'No'))){ ctx.mayYes = false; return true; } ctx.mayYes = true; let t = e27Tgt(ctx).find(x => x.t === 'player'); let pid = t && t.pid; if (!pid && !UI.dry) pid = await choosePlayer(`${name}: target opponent`, true); if (pid && pid !== MYPID){ sendRq(pid, 'draw', n, name); log(`${name}: ${nameOf(pid)} draws ${n}`); } ctx.didIt = true; commit(); return true; }
  // ---- Ajani, Nacatl Avenger −4
  if (/^each opponent chooses an artifact, a creature, an enchantment, and a planeswalker from among the nonland permanents they control$/.test(l)){ ctx.jGear = true; if (!UI.dry) opponents().forEach(p => jCtl(p.pid, 'gearhulk', name)); return true; }
  if (/^(?:then )?sacrifices? the rest$/.test(l) && ctx.jGear) return true;
  // ---- Dusty Parlor
  if (/^put a number of \+1\/\+1 counters equal to that spell's mana value on up to one target creature$/.test(l)){
    const k = it.evk; let n = k ? e27Mv(k) : (UI.dry ? 1 : 0); if (k && /\{X\}/.test(info(k)?.m || '')){ const sp = stackAll().find(x => x.kind === 'spell' && x.k === k); if (sp && sp.x) n += sp.x * (String(info(k).m).match(/\{X\}/g) || []).length; }
    const t = e27Tgt(ctx).find(x => x.t === 'card'); if (t && n > 0) applyTo(t, {op:'ctr', n, d:'cp', src:name}); log(`${name}: ${t ? n + ' +1/+1 counter' + (n === 1 ? '' : 's') + ' on ' + (t.nm || 'the creature') : 'no target'}`); commit(); return true; }
  // ---- Grist: entered from / cast from my graveyard
  if ((m = l.match(/^if it entered from your graveyard or you cast it from your graveyard, (.+)$/))){
    const c = it.evId != null ? S.bf.find(b => b.id === it.evId) : null; const ok = !!(c && c.e27gyE);
    if (ok || UI.dry) await say(s.slice(s.length - m[1].length)); else { ctx.didPay = false; ctx.didIt = false; log(`${name}: it didn't come from your graveyard`); } return true; }
  if (/^create a 1\/1 black and green insect creature token(?:, then mill two cards)?$/.test(l) && /deathtouch counter on the token if a black card was milled this way/.test(full)){
    const before = new Map(S.bf.map(c => [c.id, c.n || 1])); await createFromText('Create a 1/1 black and green Insect creature token', ctx);
    let tk = S.bf.find(c => c.tok && (!before.has(c.id) || (c.n || 1) > before.get(c.id)) && /\bInsect\b/.test(typeOf(c))); if (tk && (tk.n || 1) > 1) tk = single(tk); ctx.e27tok = tk ? tk.id : null;
    if (/mill two cards$/.test(l)){ const top = S.lib.slice(0, 2); mill(2); ctx.e27milledK = top.map(c => c.k); } return true; }
  if (/^(?:then )?mill two cards$/.test(l) && ctx.e27tok !== undefined && /deathtouch counter on the token if a black card was milled this way/.test(full)){ const top = S.lib.slice(0, 2); mill(2); ctx.e27milledK = top.map(c => c.k); return true; }
  if (/^put a deathtouch counter on the token if a black card was milled this way$/.test(l)){
    const blk = (ctx.e27milledK || []).some(k => /B/.test(info(k)?.c || '')); const tk = ctx.e27tok != null ? S.bf.find(c => c.id === ctx.e27tok) : null;
    if (blk && tk){ addNamed(tk, 'deathtouch', 1); tk.ekw = [...new Set([...(tk.ekw || []), 'deathtouch'])]; log(`${name}: a black card was milled — the Insect gets a deathtouch counter`); } commit(); return true; }
  // ---- O-Kagachi Made Manifest: defending player chooses a nonland card in my graveyard; I return it; +X/+0
  if (/^(?:defending|target) player chooses a nonland card in your graveyard$/.test(l)){
    const pool = S.gy.filter(c => !isLand(c.k)); ctx.e27kaga = null; if (!pool.length){ log(`${name}: no nonland card in your graveyard`); return true; }
    let pid = it.evDp && it.evDp !== 'dry-opp' ? it.evDp : null; if (!pid){ const a = srcCardOf(ctx); const d = a && a.atk && typeof parseDef === 'function' ? parseDef(a.atk) : null; pid = d ? (d.t === 'player' ? d.pid : (typeof attackTargetProtector === 'function' ? attackTargetProtector(d) : d.pid)) : null; }
    let id = pool[0].id; if (pid && pid !== MYPID && !UI.dry && pool.length > 1){ const ids = await r22oppPick(pid, pool.slice(0, 40), 1, `${name}: choose a nonland card in ${nameOf(MYPID)}'s graveyard (it returns to their hand)`, name); if (ids && ids[0] != null) id = ids[0]; }
    ctx.e27kaga = id; const c = S.gy.find(g => g.id === id); if (c) log(`${name}: ${pid ? nameOf(pid) : 'defending player'} chose ${cname(c)}`); return true; }
  if (/^return that card to your hand$/.test(l) && (ctx.e27kaga !== undefined || UI.dry)){ const c = ctx.e27kaga != null ? S.gy.find(g => g.id === ctx.e27kaga) : null; ctx.e27kagaMv = c ? e27Mv(c.k) : 0; if (c){ moveCard(c.id, 'hand'); log(`${name}: returned ${cname(c)} to hand`); } commit(); return true; }
  if (/^(?:this creature|~) gets \+x\/\+0 until end of turn, where x is the mana value of that card$/.test(l) && ctx.e27kagaMv != null){ const a = srcCardOf(ctx); const x = ctx.e27kagaMv; if (a && x && find(a.id)[0] === 'bf') a.pu = [(a.pu || [0, 0])[0] + x, (a.pu || [0, 0])[1]]; log(`${name} gets +${x}/+0 until end of turn`); commit(); return true; }
  // ---- Retrieve Prey: exile target creature card from your graveyard; may cast it until the end of your next turn
  if (/^exile target creature card from your graveyard$/.test(l) && /until the end of your next turn, you may cast that card/.test(full)){
    const t = e27Tgt(ctx)[0]; const c = t ? (S.gy.find(g => g.id === t.id) || S.gy.find(g => g.k === t.k && isCreatureCard(g))) : null; ctx.e27rp = null;
    if (c){ moveCard(c.id, 'ex', {quiet:true}); const e = S.ex.find(x => x.id === c.id); if (e){ ctx.e27rp = e.id; log(`${name}: exiled ${cname(e)} from the graveyard`); } } commit(); return true; }
  if (/^until the end of your next turn, you may cast that card$/.test(l) && (ctx.e27rp !== undefined || UI.dry)){ const e = ctx.e27rp != null ? S.ex.find(x => x.id === ctx.e27rp) : null; if (e){ e.mayPlay = {t:turnStr(), next:true, cast:true, src:name, u0:S.untapN}; log(`${name}: may cast ${cname(e)} until the end of next turn`); } commit(); return true; }
  // ---- The Sensational She-Hulk: deal that much damage to any target, once each turn
  if ((m = l.match(/^(you may )?have (?:~|the sensational she-hulk|[^,]+?) deal that much damage to any target$/)) && /do this only once each turn/.test(full)){
    const sc = srcCardOf(ctx); const key = 'sh' + (sc ? sc.id : ctx.k); S.e27once ||= {}; ctx.e27shDone = 1;
    if (S.e27once[key] === turnStr()){ log(`${name}: already done this turn`); return true; }
    const n = it.evN || (UI.dry ? 2 : 0); const t = e27Tgt(ctx)[0]; if (!n || !t) return true;
    if (m[1] && !UI.dry && !(await askYes(`${name}: deal ${n} damage to ${t.nm || (t.t === 'player' ? nameOf(t.pid) : 'the target')}? (only once each turn)`, 'Deal damage', 'Not now'))) return true;
    S.e27once[key] = turnStr(); dealDamage(t.t === 'player' ? {t:'player', pid:t.pid} : t, n, ctx.k, sc); log(`${name} deals ${n} damage to ${t.nm || nameOf(t.pid)}`); commit(); return true; }
  if (/^do this only once each turn$/.test(l) && ctx.e27shDone) return true;
  // ---- Valki, God of Lies
  if (/^each opponent reveals their hand$/.test(l) && /exile a creature card they revealed this way until/.test(full)){
    ctx.e27rev = []; if (UI.dry) return true;
    for (const p of opponents()){ sendRq(p.pid, 'reveal', 0, name); } commit();
    for (const p of opponents()){ const hr = await waitUntil(() => Array.isArray(OPP.get(p.pid)?.hr) && OPP.get(p.pid).hr, 20000); if (hr){ ctx.e27rev.push({pid:p.pid, ks:hr.slice()}); log(`${name}: ${nameOf(p.pid)} revealed ${hr.map(k => info(k)?.n).join(', ') || 'an empty hand'}`); } else log(`${name}: ${nameOf(p.pid)} didn't reveal their hand in time`); }
    return true; }
  if (/^for each opponent, exile a creature card they revealed this way until (?:~|.+?) leaves the battlefield$/.test(l) && (ctx.e27rev || UI.dry)){
    const sc = srcCardOf(ctx); const sid = sc ? sc.id : ctx.srcId;
    for (const r of ctx.e27rev || []){
      const ks = [...new Set(r.ks.filter(k => /\bCreature\b/.test(info(k)?.t || '')))];
      if (ks.length){ const k = ks.length === 1 ? ks[0] : await askChoice({title:`${name}: exile which creature card from ${nameOf(r.pid)}'s hand?`, options:ks.map(k => ({label:info(k)?.n || 'a card', value:k}))});
        if (k){ const res = await r21Ask(r.pid, 'e27exHandK', 0, name, {d:k}); res.ids.map(id => S.ex.find(c => c.id === id)).filter(Boolean).forEach(c => { zTag(c, sid, {until:true}); c.e27toHand = 1; }); log(`${name}: exiled ${info(k)?.n} from ${nameOf(r.pid)}'s hand until ${name} leaves the battlefield`); } }
      else log(`${name}: no creature card in ${nameOf(r.pid)}'s hand`);
      sendRq(r.pid, 'unreveal', 0, name); }
    commit(); return true; }
  if (/^choose a creature card exiled with (?:~|.+?) with mana value x$/.test(l)){
    const sc = srcCardOf(ctx); const x = (it.x ?? it.evX) || 0; const list = sc ? zLinked(sc.id, c => /\bCreature\b/.test(info(c.k)?.t || '') && e27Mv(c.k) === x) : [];
    ctx.e27valki = null; if (!list.length){ log(`${name}: no creature card with mana value ${x} exiled with it`); return true; }
    ctx.e27valki = list.length === 1 || UI.dry ? list[0].k : await askChoice({title:`${name}: become a copy of which card?`, options:list.map(c => ({label:cname(c), value:c.k}))}); return true; }
  if (/^(?:~|.+?) becomes a copy of that card$/.test(l) && ctx.e27valki !== undefined){ const sc = srcCardOf(ctx); if (sc && ctx.e27valki && find(sc.id)[0] === 'bf'){ cpyBecome(sc, ctx.e27valki); log(`${name} becomes a copy of ${info(ctx.e27valki)?.n}`); } commit(); return true; }
  // ---- The Rise of Sozin II
  if (/^choose a card name$/.test(l) && /for up to four cards with that name and exile them/.test(full)){
    const opts = r21NameOptions(''); ctx.e27name = UI.dry ? 'x' : (opts.length ? await askChoice({title:`${name}: choose a card name`, options:opts.map(n => ({label:n, value:n}))}) : null); if (ctx.e27name && !UI.dry) log(`${name}: named ${ctx.e27name}`); return true; }
  if ((m = l.match(/^search target opponent's graveyard, hand, and library for up to (four|\w+) cards with that name and exile them$/))){
    const n = wn(m[1]) || 4; const t = e27Tgt(ctx).find(x => x.t === 'player'); let pid = t && t.pid; if (!pid && !UI.dry) pid = await choosePlayer(`${name}: target opponent`, true); ctx.e27sozin = 1;
    if (pid && pid !== MYPID && ctx.e27name && !UI.dry){ UI.r21ack ||= {}; const ref = rid(6); sendRq(pid, 'e27nameEx', n, name, {ref, d:String(ctx.e27name).slice(0, 78)}); commit(); const a = await waitUntil(() => UI.r21ack[ref], 25000); const res = {n:a ? a.n : 0, d:a ? a.d : ''}; log(`${name}: exiled ${res.n || 0} card${res.n === 1 ? '' : 's'} named ${ctx.e27name} from ${nameOf(pid)}'s graveyard, hand and library${res.d ? ' (' + res.d + ')' : ''}`); }
    commit(); return true; }
  if (/^then that player shuffles$/.test(l) && ctx.e27sozin) return true;   // done with the search on their client
  // ---- Fire Lord Sozin
  if (/^(?:you may )?pay \{x\}$/.test(l) && /when you do, put any number of target creature cards with total mana value x or less from that player's graveyard onto the battlefield under your control/.test(full)){
    const x = await u25payX(99, `${name}: pay {X} (creature cards with total mana value X or less come back)`); ctx.e27X = x; ctx.didPay = x > 0; ctx.mayYes = x > 0; if (it) it.x = x; return true; }
  if ((m = l.match(/^(?:when you do, )?put any number of target creature cards with total mana value x or less from (?:that|target) player's graveyard onto the battlefield under your control$/))){
    const x = ctx.e27X != null ? ctx.e27X : ((it.x ?? it.evX) || 0); const pid = it.evDp && it.evDp !== 'dry-opp' ? it.evDp : null; if (UI.dry || !pid || pid === MYPID || ctx.e27X === 0) return true;
    const gy = (OPP.get(pid)?.gy || []).map((k, i) => ({id:-1000 - i, k})).filter(c => /\bCreature\b/.test(info(c.k)?.t || '') && e27Mv(c.k) <= x);
    if (!gy.length){ log(`${name}: no creature card with mana value ${x} or less in ${nameOf(pid)}'s graveyard`); return true; }
    let ids = null; for (let tries = 0; tries < 4; tries++){ ids = await pickCards({title:`${name}: creature cards with total mana value ${x} or less from ${nameOf(pid)}'s graveyard`, cards:gy, min:0, max:gy.length, noneLabel:'None'}); const tot = (ids || []).reduce((a, id) => a + e27Mv(gy.find(c => c.id === id)?.k), 0); if (tot <= x) break; toast(`Total mana value ${tot} is more than ${x}`); ids = null; }
    for (const id of ids || []){ const c = gy.find(g => g.id === id); if (c) sendRq(pid, 'gytake', 0, name, {d:c.k}); } if ((ids || []).length) log(`${name}: puts ${(ids || []).map(id => info(gy.find(g => g.id === id).k)?.n).join(', ')} onto the battlefield under ${nameOf(MYPID)}'s control`); commit(); return true; }
  // ---- Welcome to . . . I: for each opponent, up to one noncreature artifact becomes a 0/4 Wall artifact creature with defender
  if ((m = l.match(/^for each opponent, up to one target noncreature artifact they control becomes a (\d+)\/(\d+) wall artifact creature with defender for as long as you control (?:~|this saga|.+)$/))){
    const sc = srcCardOf(ctx); const seen = new Set(); let n = 0;
    for (const t of e27Tgt(ctx)){ if (t.t !== 'card' || !t.pid || t.pid === MYPID || seen.has(t.pid)) continue; const b = boardOf(t.pid).find(x => x.id === t.id); if (!b || isCreatureCard(b) || !/\bArtifact\b/.test(typeOf(b))) continue; seen.add(t.pid);
      l24modTo(t, {u:`w|${MYPID}|${sc ? sc.id : ''}`, addC:['Artifact', 'Creature'], addS:['Wall'], pt:[+m[1], +m[2]], kw:['defender']}, name); n++; }
    log(`${name}: ${n} artifact${n === 1 ? '' : 's'} became ${m[1]}/${m[2]} Wall artifact creatures with defender`); commit(); return true; }
  // ---- The Omenkeel: that player exiles that many cards; I may play lands from among them while they remain exiled
  if ((m = l.match(/^(?:that|target) player exiles (that many|\d+|a|one|two|three|four|five) cards? from the top of their library$/)) && /you may play lands from among those cards for as long as they remain exiled/.test(full)){
    const n = m[1] === 'that many' ? (it.evN || 0) : (wn(m[1]) || +m[1] || 1); const pid = it.evDp && it.evDp !== 'dry-opp' ? it.evDp : (e27Tgt(ctx).find(x => x.t === 'player') || {}).pid; ctx.e27omen = [];
    if (!n || !pid || UI.dry) return true;
    if (pid === MYPID){ const top = S.lib.slice(0, n); top.forEach(c => { S.lib.splice(S.lib.indexOf(c), 1); S.ex.push(c); }); ctx.e27omen = top.map(c => c.id); log(`${name}: exiled the top ${top.length} cards of my library`); commit(); return true; }
    const res = await r21Ask(pid, 'r21exTop', n, name, {d:'r'}); ctx.e27omen = res.ids; log(`${name}: ${nameOf(pid)} exiled the top ${res.n || n} card${n === 1 ? '' : 's'} of their library`); commit(); return true; }
  if (/^(?:you may )?play lands from among those cards for as long as they remain exiled$/.test(l) && (ctx.e27omen || UI.dry)){
    let k = 0; for (const id of ctx.e27omen || []){ const c = S.ex.find(x => x.id === id); if (c && isLand(c.k)){ c.mayPlay = {t:turnStr(), cast:false, adv:true, src:name, u0:S.untapN, e27land:1}; k++; } } if (k) log(`${name}: may play ${k} land${k === 1 ? '' : 's'} from among them while they remain exiled`); commit(); return true; }
  // ---- Cosima: the voyage
  if (/^(?:you may )?exile ~$/.test(l) && /it gains "whenever a land you control enters, if ~ is exiled, you may put a voyage counter on it/i.test(tname(info(ctx.k)?.o || '', info(ctx.k)?.n || ''))){
    const sc = srcCardOf(ctx); if (!sc || find(sc.id)[0] !== 'bf'){ ctx.mayYes = false; return true; }
    if (/^you may/.test(l) && !UI.dry && !(await askYes(`${name}: exile it to go on a voyage?`, 'Exile', 'Stay'))){ ctx.mayYes = false; return true; }
    moveCard(sc.id, 'ex', {quiet:true}); const e = S.ex.find(x => x.id === sc.id); if (e){ e.e27voy = 1; log(`${name} sets out on a voyage (exiled)`); } ctx.mayYes = true; ctx.e27cosima = 1; commit(); return true; }
  if (/^if you do, it gains "whenever a land you control enters, if ~ is exiled, you may put a voyage counter on it/.test(l) && (ctx.e27cosima || UI.dry || ctx.mayYes === false)) return true;
  if (/^if ~ is exiled, you may put a voyage counter on it$/.test(l) || (/^if (?:~|it) is exiled, you may put a voyage counter on it$/.test(l))){ if (!UI.dry) await e27Voyage(); ctx.e27voyQ = 1; return true; }
  if (/^if you don't, return ~ to the battlefield with x \+1\/\+1 counters on it and draw x cards, where x is the number of voyage counters on it$/.test(l) && (ctx.e27voyQ || UI.dry)) return true;
  // ---- Craft: the activated ability returns the card transformed (702.167)
  if (/^return (?:~|this card|it) transformed under its owner's control$/.test(l) && it.srcId != null && S.e27mat && S.e27mat[it.srcId]){
    const c = S.ex.find(x => x.id === it.srcId); if (!c){ log(`${name}: the card isn't in exile any more`); return true; }
    const mats = S.e27mat[it.srcId]; c.fl = true; c.tap = false; moveCard(c.id, 'bf'); const b = S.bf.find(x => x.id === c.id); if (b) b.e27mat = mats.slice();
    log(`${name} returns transformed: ${b ? cname(b) : ''}`); commit(); return true; }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound27EPre(s, l, ctx)) return; return ds(s0, ctx); }; }

/* ---------- Expansion: the mana value limit on the spell it targets ---------- */
function e27SpellMv(x){ const a = info(x && x.k) || {}; const xs = (String(a.m || '').match(/\{X\}/g) || []).length; return (a.mv || 0) + xs * ((x && x.x) || 0); }
{ const bc = beginCast; beginCast = async function(c, zone, o = {}){ const prev = E27.copyMv; try { const mm = c && String(info(c.k)?.o || '').match(/copy target (?:instant or sorcery|instant|sorcery) spell with mana value (\d+) or less/i) || (c && (info(c.k)?.faces || []).map(f => String(f.o || '').match(/copy target (?:instant or sorcery|instant|sorcery) spell with mana value (\d+) or less/i)).find(Boolean)); E27.copyMv = mm ? +mm[1] : null; } catch {} try { return await bc(c, zone, o); } finally { E27.copyMv = prev; } }; }
{ const cl = copyLegal; copyLegal = function(it, cs){ const r = cl(it, cs); try { if (r && r.ok && E27.copyMv != null && cs && cs.kind === 'spell' && e27SpellMv(it) > E27.copyMv) return {ok:false, why:`mana value ${e27SpellMv(it)} (more than ${E27.copyMv})`}; } catch {} return r; }; }
/* ---------- Sorin −6 across players: the stolen creature arrives a Vampire (with a lifelink counter) ---------- */
{ const tc = takeCard; takeCard = function(r, from){ const n0 = S.bf.length; const out = tc(r, from); try { const c = S.bf.length > n0 ? S.bf[S.bf.length - 1] : null; if (c && r.f){ if (r.f.e27vamp) addXType(c, 'vampire'); if (r.f.e27ll){ addNamed(c, 'lifelink', 1); c.ekw = [...new Set([...(c.ekw || []), 'lifelink'])]; log(`${cname(c)} gets a lifelink counter`); } } } catch (e){ console.warn(e); } return out; }; }
/* ---------- The Tomb of Aclazotz ---------- */
{ const cg = castFromGy; castFromGy = async function(c, g){ const r = await cg(c, g); try { if (g && g.a26chain && c && find(c.id)[0] !== 'gy' && S.e27tomb && S.e27tomb.t === turnStr() && S.e27tomb.n > 0){ S.e27tomb.n--; c.zFinal = 1; c.e27vamp = 1; commit(); } } catch {} return r; }; }
{ const oe = onEnter; onEnter = function(c, from, o = {}){ try { if (c && c.e27vamp && from !== 'bf'){ delete c.e27vamp; addXType(c, 'vampire'); log(`${cname(c)} is a Vampire in addition to its other types`); } } catch (e){ console.warn(e); } return oe(c, from, o); }; }

/* ---------- an opponent chooses up to one of my listed permanents (keys) on their screen ---------- */
RQ_OPS.push('e27pick');
async function e27OppPick(pid, ks, title, src){
  if (UI.dry || !ks.length) return null; const ref = rid(6);
  S.pile = {ref, ks}; sendRq(pid, 'e27pick', 1, src, {ref, d:title.slice(0, 80)}); commit(); toast(`Waiting for ${nameOf(pid)} to choose…`);
  const a = await waitUntil(() => R22.ans[ref], 90000); S.pile = null; commit();
  const i = a && a.idx.length ? a.idx[0] : null; return i != null && i >= 0 && i < ks.length ? i : null;
}
{ const ao = applyOp; applyOp = function(r, from){
    if (r.op === 'e27pick'){ (async () => { const pile = OPP.get(from)?.pile; const ks = pile ? pile.ks : []; const cards = ks.map((k, i) => ({id:-1000 - i, k}));
      const ids = cards.length ? await pickCards({title:`${r.src}: ${r.d || 'choose up to one'}`, cards, min:0, max:1, noneLabel:'Choose nothing'}) : [];
      const real = (ids || []).map(id => -(id + 1000)); sendRq(from, 'r22pickAns', real.length, r.src, {ref:r.ref, d:real.join(',')}); commit(); })(); return; }
    return ao(r, from); }; }
/* ---------- Secret Arcade: nonland permanents and permanent spells I control are enchantments; Poppet Factory ---------- */
STATIC_RULES.push([/^nonland permanents you control and permanent spells you control are enchantments in addition to their other types$/, m => ({kind:'e27arcade', who:'you'})],
  [/^creature tokens you control lose all abilities and have base power and toughness (\d+)\/(\d+)$/, m => ({kind:'e27poppet', who:'you'})],
  [/^snow lands your opponents control enter tapped$/, m => ({kind:'e27snowTap', who:'opp'})]);
{ const lp = l24parseStatic; l24parseStatic = function(line){ const l = String(line || '').toLowerCase().replace(/\.$/, '').trim(); let m;
    if (/^nonland permanents you control and permanent spells you control are enchantments in addition to their other types$/.test(l)) return {scope:'you', desc:'nonland permanent', mod:{addC:['Enchantment']}};
    if ((m = l.match(/^creature tokens you control lose all abilities and have base power and toughness (\d+)\/(\d+)$/))) return {scope:'you', desc:'creature token', mod:{noAb:1, pt:[+m[1], +m[2]]}};
    return lp(line); }; }
const e27ArcadeOn = () => { try { return S && S.bf.some(b => b.k && !b.fd && /^Nonland permanents you control and permanent spells you control are enchantments in addition to their other types\.?$/m.test(info(b.k)?.o || '')); } catch { return false; } };
{ const he = handleEvent; handleEvent = function(pid, ev){ const prev = E27.encK; try { if (ev && ev.type === 'cast' && pid === MYPID && ev.k && isPermType(info(ev.k)?.t || '') && e27ArcadeOn()) E27.encK = ev.k; } catch {} try { return he(pid, ev); } finally { E27.encK = prev; } }; }
{ const dk = descOk; descOk = function(k, desc, o = {}){ const r = dk(k, desc, o); try { if (!r && k && E27.encK === k && /\benchantment\b/i.test(String(desc || '')) && !/\bnon-?enchantment\b/i.test(String(desc || ''))){ const rest = String(desc).replace(/\benchantment\b/i, '').replace(/\s+/g, ' ').trim(); return !rest || rest === 'spell' || dk(k, rest, o); } } catch {} return r; }; }
/* ---------- Reidane: snow lands opponents control enter tapped ---------- */
{ const oe = onEnter; onEnter = function(c, from, o = {}){ const r = oe(c, from, o); try { if (c && S.bf.includes(c) && c.k && isLand(c.k) && /\bSnow\b/.test(typeOf(c)) && rulesOn('e27snowTap').length && !c.tap){ c.tap = true; log(`${cname(c)} enters tapped (${rulesOn('e27snowTap')[0].src || 'Reidane'})`); } } catch (e){ console.warn(e); } return r; }; }
/* ---------- Grist: did it enter from my graveyard / was it cast from my graveyard? ---------- */
{ const oe = onEnter; onEnter = function(c, from, o = {}){ try { if (c && from !== 'bf'){ const cast = c.e27castGy && c.e27castGy === turnStr(); delete c.e27castGy; if ((from === 'gy' && !c.own) || cast) c.e27gyE = 1; else delete c.e27gyE; } } catch {} return oe(c, from, o); }; }
{ const ol = onLeave; onLeave = function(c, to, w){ try { if (c) delete c.e27gyE; } catch {} return ol(c, to, w); }; }

/* ---------- requests: Valki (exile a card from my hand, lend it), The Rise of Sozin (exile up to N cards with a name) ---------- */
RQ_OPS.push('e27exHandK', 'e27nameEx');
{ const ao = applyOp; applyOp = function(r, from){
    if (r.op === 'e27exHandK'){ const c = S.hand.find(h => h.k === r.d); let n = 0; if (c){ moveCard(c.id, 'ex', {quiet:true}); const e = S.ex.find(x => x.id === c.id); if (e){ r21Lend(e, from, r.ref, 'r', r.src); n = 1; log(`${cname(e)} was exiled from my hand (${r.src})`); } } r21Ack(from, r.ref, n, r.src); commit(); return; }
    if (r.op === 'e27nameEx'){ const nm = String(r.d || ''); let left = clamp(r.n || 4, 0, 10); const got = {hand:0, lib:0, gy:0};
      for (const z of ['hand', 'lib', 'gy']){ for (const c of S[z].filter(x => info(x.k)?.n === nm || String(info(x.k)?.n || '').split(' // ').includes(nm))){ if (left <= 0) break; const i = S[z].indexOf(c); if (i < 0) continue; S[z].splice(i, 1); S.ex.push(c); got[z]++; left--; } }
      shuffle(S.lib); const tot = got.hand + got.lib + got.gy; log(`exiled ${tot} card${tot === 1 ? '' : 's'} named ${nm} (${r.src}: ${got.hand} from hand, ${got.lib} from library, ${got.gy} from graveyard), then shuffled`);
      sendRq(from, 'r21ack', tot, r.src, {ref:r.ref, d:`${got.hand} hand, ${got.lib} library, ${got.gy} graveyard`}); commit(); return; }
    return ao(r, from); }; }
/* Valki: the card exiled from a hand goes back to its owner's hand when Valki leaves (610.3c) */
{ const ol = onLeave; onLeave = function(c, to, w){ try { if (c && S && !UI.dry) S.ex.filter(x => x.r21until === c.id && x.e27toHand).forEach(x => { delete x.r21until; delete x.zBy; delete x.e27toHand; log(`${cname(x)} returns to its owner's hand (${cname(c)} left the battlefield)`); if (x.r21 && x.own) r21Drop(x, 'hand'); else moveCard(x.id, 'hand'); }); } catch (e){ console.warn(e); } return ol(c, to, w); }; }
/* Welcome to . . .: the Wall effect lasts while its Saga stays under its controller's control */
{ const lv = l24live; l24live = function(m){ try { const u = m && m.u || ''; if (u.startsWith('w|')){ const [, pid, id] = u.split('|'); if (!S) return true; const b = pid === MYPID ? S.bf : (OPP.get(pid)?.bf || null); if (!b) return true; return b.some(x => String(x.id) === id); } } catch {} return lv(m); }; }
{ const ts = targetSpecs; targetSpecs = function(t){ const r = ts(t); try { const l = String(t || '').toLowerCase();
    if (/^for each opponent, up to one target noncreature artifact they control becomes/.test(l) && r && r[0]) return [{...r[0], desc:'noncreature artifact', whose:'opp', n:Math.max(1, opponents().length), upTo:true}].concat(r.slice(1));
    if (/put any number of target creature cards with total mana value x or less from (?:that|target) player's graveyard/.test(l)) return r.filter(x => !/total mana value/.test(x.desc || '')); } catch {} return r; }; }
/* Jurassic Park: each Dinosaur card in my graveyard has escape */
STATIC_RULES.push([/^each dinosaur card in your graveyard has escape$/, m => ({kind:'e27escDino', who:'you'})]);
{ const go = gyOptions; gyOptions = function(c){ const out = go(c) || []; try { const a = info(c.k); if (a && S && /\bDinosaur\b/.test(a.t || '') && rulesOn('e27escDino').length && !out.some(o => o.kind === 'escape')) out.push({kind:'escape', label:`Escape ${a.m} + exile three other cards`, mana:a.m, extra:[{t:'gyEx', n:3, label:'exile three other cards from your graveyard'}], after:''}); } catch {} return out; }; }
/* Cosima, God of the Voyage: while exiled, each land I play → voyage counter, or come back with X counters and draw X */
{ const he = handleEvent; handleEvent = function(pid, ev){ const r = he(pid, ev); try { if (ev && ev.type === 'enter' && pid === MYPID && ev.k && isLand(ev.k) && !UI.dry && S.ex.some(x => x.e27voy)) e27Voyage(); } catch (e){ console.warn(e); } return r; }; }
async function e27Voyage(){
  for (const c of S.ex.filter(x => x.e27voy)){
    if (E27.voyBusy) return; E27.voyBusy = 1;
    try { const n = (c.nc || {}).voyage || 0; const nm = cname(c);
      const yes = await askYes(`${nm}: a land entered — put a voyage counter on ${nm}? (${n} now). If you don't, it returns with ${n} +1/+1 counter${n === 1 ? '' : 's'} and you draw ${n}.`, 'Voyage counter', 'Return now');
      if (!S.ex.includes(c)) continue;
      if (yes){ addNamed(c, 'voyage', 1); log(`${nm}: voyage counter (${(c.nc || {}).voyage})`); }
      else { const x = (c.nc || {}).voyage || 0; delete c.e27voy; c.nc = {}; c.co = 0; moveCard(c.id, 'bf'); const b = S.bf.find(y => y.id === c.id); if (b && x) modCounters(b, 'cp', x); if (x) draw(x); log(`${nm} returns from its voyage with ${x} +1/+1 counter${x === 1 ? '' : 's'}${x ? ` and draws ${x}` : ''}`); }
      commit(); } finally { E27.voyBusy = 0; }
  }
}

/* ---------- Craft with … (Tithing Blade, The Enigma Jewel) and Locus of Enlightenment ---------- */
STATIC_RULES.push([/^craft with (.+?) ((?:\{[^}]+\})+)$/, m => ({kind:'e27craft', who:'you'})],
  [/^~ has each activated ability of the exiled cards used to craft it$/, m => ({kind:'e27locus', who:'you'})],
  [/^you may activate each of those abilities only once each turn$/, m => ({kind:'e27locus', who:'you'})]);
const E27_CRAFT = /^Craft with (.+?) ((?:\{[^}]+\})+)$/im;
function e27HasActivated(k){ const a = info(k); if (!a) return false; return tname(a.o || '', a.n).split('\n').some(x => { const t = x.trim(); return /^[^:"•]+:\s/.test(t) && /\{|^(sacrifice|pay|discard|remove|exile|tap|return)\b|^[+−\-]?\d+:|^[+−\-]X:/i.test(t.split(':')[0] + ':') && !/^(when|whenever|at) /i.test(t); }); }
function e27CraftSpec(desc){
  const d = String(desc).trim().toLowerCase(); let m; let n = 1, more = false, w = d;
  if ((m = d.match(/^(a|an|one|two|three|four|five|six)( or more)? (.+)$/))){ n = wn(m[1]) || 1; more = !!m[2]; w = m[3]; }
  const act = / with activated abilities$/.test(w); w = w.replace(/ with activated abilities$/, '').replace(/s$/, '');
  const ok = k => (w === 'nonland' ? !isLand(k) : descOk(k, w)) && (!act || e27HasActivated(k));
  return {n, more, ok, label:d};
}
{ const al = abilityList; abilityList = function(c){ const out0 = al(c); if (!c || !S || c.fd) return out0; let out = out0;
    try { const f = faceOf(c); const m = f && String(f.o || '').match(E27_CRAFT);
      if (m && S.bf.includes(c)) out = [...out, {cost:`${m[2]}, Craft`, eff:"Return ~ transformed under its owner's control.", sorc:true, line:m[0].trim(), e27craft:m[1]}];
      const mats = c.e27mat || (S.e27mat && c.fl && S.e27mat[c.id]);
      if (mats && c.fl && /has each activated ability of the exiled cards used to craft it/i.test(f && f.o || '')){
        const add = []; mats.forEach((k, mi) => { const a = info(k); if (!a) return; tname(a.o || '', a.n).split('\n').forEach((raw, li) => { const line = raw.trim(); const q = line.match(/^([^:"•]+):\s*([\s\S]+)$/); if (!q) return; const cost = q[1].trim();
          if (!/\{|^(sacrifice|pay|discard|remove|exile|tap|return)\b/i.test(cost) || /^[+−\-]?[\dX]+$/.test(cost) || /^add\b/i.test(q[2])) return;
          add.push({cost, eff:q[2].trim(), sorc:/activate only as a sorcery/i.test(q[2]), line:`${line} (from ${a.n})`, e27once:`${c.id}|${mi}|${li}`}); }); });
        out = [...out, ...add]; } } catch (e){ console.warn(e); }
    return out; }; }
{ const ma = manaAbs; manaAbs = function(c){ const out0 = ma(c); if (!c || !S || c.fd || !c.fl) return out0; let out = out0;
    try { const mats = c.e27mat || (S.e27mat && S.e27mat[c.id]); const f = faceOf(c);
      if (mats && /has each activated ability of the exiled cards used to craft it/i.test(f && f.o || '')){ const add = [];
        mats.forEach((k, mi) => { const a = info(k); if (!a) return; tname(a.o || '', a.n).split('\n').forEach((raw, li) => { const q = raw.trim().match(/^([^:"]+):\s*(add .+)$/i); if (!q) return; const [effMain, ...rest] = q[2].split(/\.\s+/); add.push({cost:q[1].trim(), eff:effMain, rest:rest.join('. '), outs:manaOuts(effMain), tapOnly:false, line:`${raw.trim()} (from ${a.n})`, e27once:`${c.id}|${mi}|${li}`}); }); });
        out = [...out, ...add]; } } catch (e){ console.warn(e); }
    return out; }; }
{ const ar = abilityReady; abilityReady = function(c, ab, mana){ try { if (ab && ab.e27once && S.e27used && S.e27used[ab.e27once] === turnStr()) return 'Only once each turn'; if (ab && ab.e27craft){ const sp = e27CraftSpec(ab.e27craft); const n = S.bf.filter(b => b !== c && !b.fd && b.k && sp.ok(b.k)).length + S.gy.filter(g => sp.ok(g.k)).length; if (n < sp.n) return `Craft needs ${sp.label}`; } } catch {} return ar(c, ab, mana); }; }
{ const aa = activateAbility; activateAbility = async function(c, ab){ const n0 = S.stk.length; E27.crafting = ab && ab.e27craft ? {c, ab} : null; try { return await aa(c, ab); } finally { E27.crafting = null; try { if (ab && ab.e27once && S.stk.length > n0){ (S.e27used ||= {})[ab.e27once] = turnStr(); commit(); } } catch {} } }; }
{ const am = activateMana; activateMana = async function(c, ab, ch){ const p0 = JSON.stringify(S.pool || {}); const r = await am(c, ab, ch); try { if (ab && ab.e27once && JSON.stringify(S.pool || {}) !== p0){ (S.e27used ||= {})[ab.e27once] = turnStr(); commit(); } } catch {} return r; }; }
{ const pp = payPart; payPart = async function(p, c){
    if (String(p).trim().toLowerCase() === 'craft' && E27.crafting && E27.crafting.c === c){
      const sp = e27CraftSpec(E27.crafting.ab.e27craft);
      const cands = [...S.bf.filter(b => b !== c && !b.fd && b.k && sp.ok(b.k)), ...S.gy.filter(g => sp.ok(g.k))];
      if (cands.length < sp.n){ toast(`Craft needs ${sp.label}`); return false; }
      const ids = !sp.more && cands.length === sp.n ? cands.map(x => x.id) : await pickCards({title:`${cname(c)}: craft with ${sp.label} — exile ${sp.more ? sp.n + ' or more' : sp.n} (permanents you control and/or cards in your graveyard)`, cards:cands, min:sp.n, max:sp.more ? cands.length : sp.n});
      if (!ids || ids.length < sp.n) return false;
      const mats = []; for (const id of ids){ const [z, , x] = find(id); if (!x) continue; mats.push(x.k); moveCard(id, 'ex', {quiet:true}); }
      S.e27mat ||= {}; S.e27mat[c.id] = mats; moveCard(c.id, 'ex', {quiet:true});
      log(`${cname(c)}: crafted — exiled it and ${mats.map(k => info(k)?.n).join(', ')}`); commit(); return true; }
    return pp(p, c); }; }
{ const bc = beginCast; beginCast = async function(c, zone, o = {}){ try { if (c && zone === 'gy') c.e27castGy = turnStr(); } catch {} const r = await bc(c, zone, o); try { if (c && zone === 'gy' && S.gy.includes(c)) delete c.e27castGy; } catch {} return r; }; }
