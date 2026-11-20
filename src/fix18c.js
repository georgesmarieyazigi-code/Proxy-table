
/* =================== fix18c: fuzzer bugs 6–15 and the "do by hand" gaps (helper K) ===================
   Spell keyword lines that act on resolution (gift, ascend, cipher) and at cast (casualty, escalate); the deck checker runs
   spell keyword lines exactly the way resolution does; Jace +2 on an opponent; Flickerwisp on an opponent's permanent;
   Claim Jumper; Skittering Cicada; Level Up's granted draw; Dovin's prevention; Noggle the Mind; Map tokens of other players. */
RQ_OPS.push('r18kPeek', 'r18kDly', 'r18kNoDmg', 'r18kExplore');
const R18K = {peek:{}};

// the internal "R26self" placeholder (engine26y) must never reach a note the player reads
{
  const hw = handWarn;
  handWarn = function(s, ctx){ return hw(String(s).replace(/\bR26self\b/g, '~'), ctx); };
}

/* ---------- 6. the deck checker agrees with resolution about spell keyword lines ----------
   checkCard skips every line keywordsOnly() accepts; on an instant or sorcery, resolution skips only spellKwSkip() lines and runs
   the rest. Any keyword line the checker skipped but resolution would run is now dry-run like the body, so a line that would
   become a "do by hand" note in play is reported. */
{
  const cc = checkCard;
  checkCard = async function(k){
    const r = await cc(k);
    try { const a = info(k); if (!a || !r || !r.issues || String(k).startsWith('r26chk|')) return r;
      const faces = a.lay === 'split' && a.faces ? a.faces : a.lay === 'adventure' && a.faces ? [a, a.faces[1]] : a.back ? [a, a.back] : [a]; const n0 = r.issues.length;
      for (const f of faces){ if (!/\b(instant|sorcery)\b/i.test(f.t || '')) continue;
        const lines = []; for (const x0 of tname(f.o, f.n).split('\n')){ const x = x0.trim(); if (!x) continue; if (/^•/.test(x) && lines.length) lines[lines.length - 1] += '\n' + x; else lines.push(x); }
        // only when a line the checker skipped would run at resolution: then dry-run the whole body the way resolution runs it
        if (!lines.some(l => keywordsOnly(l) && !spellKwSkip(l) && lineKind(l) !== 'trigger')) continue;
        const body = lines.filter(l => !spellKwSkip(l) && lineKind(l) !== 'trigger').join('\n'); const cs = counterSpec(tname(f.o, f.n));
        const ms = (await dryAll(body.replace(/~/g, f.n), k, f.n, true)).filter(t => !(cs && /^counter target/i.test(t)));
        ms.forEach(t => { if (!r.issues.some(y => y.text === t)) r.issues.push({kind:'effect', text:t}); }); }
      if (r.issues.length > n0 && n0 === 0) r.ok = Math.max(0, (r.ok || 0) - 1);
    } catch (e){ console.warn('r18k check', e); }
    return r;
  };
}

/* ---------- gift (CR 702.174), casualty (702.153), escalate (702.120), cipher (702.99), ascend on spells (702.131) ---------- */
const R18K_GIFT = {card:null, food:'a Food token', treasure:'a Treasure token', clue:'a Clue token', 'tapped fish':'a tapped 1/1 blue Fish creature token', fish:'a 1/1 blue Fish creature token', octopus:'an 8/8 blue Octopus creature token'};
function r18kLands(pid){ const bf = pid === MYPID ? S.bf : ((OPP.get(pid) || {}).bf || []); return bf.filter(c => c.k && !c.fd && isLand(c.k)).reduce((a, c) => a + (c.n || 1), 0); }
function r18kOppMoreLands(){ const me = r18kLands(MYPID); return opponents().some(p => !(p.s && p.s.lost) && r18kLands(p.pid) > me); }
function r18kNDOn(c){ const x = c && c.r18kND; if (!x) return false; const [n, pid] = currentTurn(); if (pid === x.by && n > x.n){ delete c.r18kND; return false; } return true; }
function r18kSpellOnStack(id){ return stackAll().find(x => x.kind === 'spell' && ((x.card && x.card.id === id) || (x.it && x.it.card && x.it.card.id === id))); }
// another player's library: ask its owner for the top card, sealed for me (fix18), and wait for it
async function r18kPeekTop(pid, src){
  const ref = rid(6); sendRq(pid, 'r18kPeek', 1, src, {ref}); commit(); toast(`Looking at the top of ${nameOf(pid)}'s library…`);
  const got = await waitUntil(() => { const st = OPP.get(pid); const x = st && st.r18kPeek; return x && x.ref === ref ? x : null; }, 20000);
  if (!got){ log(`${src}: ${nameOf(pid)} didn't answer`); return {none:true}; }
  if (got.empty) return {k:null};
  let k = got.p || null; if (!k && got.e) k = await r18OpenAsync(pid, got.e);
  if (k && !info(k)) try { await ensureTokens([k]); } catch {}
  return {k};
}

async function r18kPre(s, l, ctx){
  let m; const name = ctx.name || ''; const it = ctx.it || {}; const full = String(ctx.full || info(ctx.k)?.o || '').toLowerCase();
  // ---- gift: the chosen opponent gets the gift first when the spell resolves (702.174j)
  if ((m = l.match(/^gift (?:a |an )?(card|food|treasure|clue|tapped fish|fish|octopus|extra turn)$/)) && it.kind === 'spell'){
    if (!ctx.gift && !it.gift) return true;
    if (UI.dry) return true;
    const os = opponents().filter(p => !(p.s && p.s.lost)); if (!os.length) return true;
    const pid = os.length === 1 ? os[0].pid : await choosePlayer(`${name}: who gets the gift?`, true); if (!pid) return true;
    if (m[1] === 'extra turn'){ S.r18kGiveXt = (S.r18kGiveXt || []).concat(pid); log(`${name}: gift — ${nameOf(pid)} takes an extra turn after this one`); }
    else if (m[1] === 'card'){ sendRq(pid, 'draw', 1, name); log(`${name}: gift — ${nameOf(pid)} draws a card`); }
    else { sendRq(pid, 'tokText', 0, name, {d:R18K_GIFT[m[1]]}); log(`${name}: gift — ${nameOf(pid)} creates ${R18K_GIFT[m[1]]}`); }
    commit(); return true;
  }
  // ---- ascend on an instant or sorcery: you get the city's blessing as it resolves if you control ten or more permanents
  if (/^ascend$/.test(l) && it.kind === 'spell'){ if (!UI.dry){ const n = S.bf.reduce((a, c) => a + (c.n || 1), 0); if (n >= 10 && !S.cityB){ S.cityB = true; log(`${name}: got the city’s blessing`); commit(); } } return true; }
  // ---- cipher: you may exile the card encoded on a creature you control
  if (/^cipher$/.test(l) && it.kind === 'spell'){
    if (UI.dry || it.copy || !it.card) return true;
    const list = S.bf.filter(c => !c.fd && isCreatureCard(c)); if (!list.length){ log(`${name}: no creature to encode it on`); return true; }
    const ids = await pickCards({title:`${name}: cipher — encode it on a creature you control?`, hint:'Whenever that creature deals combat damage to a player, you may cast a copy of it for free.', cards:list, min:0, max:1, noneLabel:"Don't encode"});
    const c = ids && ids[0] != null && S.bf.find(x => x.id === ids[0]); if (!c) return true;
    it.exAfter = true; S.r18kCiph = (S.r18kCiph || []).filter(x => x.card !== it.card.id).concat({cr:c.id, card:it.card.id, k:it.k});
    log(`${name}: encoded on ${cname(c)}`); commit(); return true;
  }
  if (it.r18kCiph && /^cipher: you may cast a copy of .+ without paying its mana cost$/.test(l)){
    if (UI.dry) return true; const k = it.r18kCiph; if (!S.ex.some(c => c.k === k)){ log(`${name}: the encoded card is no longer exiled`); return true; }
    if (await askYes(`Cipher: cast a copy of ${info(k)?.n} without paying its mana cost?`, 'Cast the copy', 'No')) await m24CastCopy(k, {...ctx, name:info(k)?.n || name});
    commit(); return true;
  }
  // ---- Summons of Saruman: "You may cast an instant or sorcery spell with mana value X or less from among them without paying its mana cost"
  if (/^you may cast an instant or sorcery spell with mana value x or less from among them without paying its mana cost$/.test(l) && /\bmill x cards\b/.test(full)){
    if (UI.dry) return true; const x = it.x || 0; const pool = (ctx.milled2 || []).filter(c => S.gy.includes(c) && /\b(Instant|Sorcery)\b/.test(info(c.k)?.t || '') && (info(c.k)?.mv || 0) <= x);
    if (!pool.length){ log(`${name}: no instant or sorcery with mana value ${x} or less was milled`); return true; }
    const ids = await pickCards({title:`${name}: cast an instant or sorcery with mana value ${x} or less without paying its mana cost?`, cards:pool, min:0, max:1, noneLabel:"Don't cast"});
    const c = ids && ids[0] != null && S.gy.find(y => y.id === ids[0]); if (c){ UI.afterCast = () => {}; await r21bCastNow(c, 'gy', {free:true}); } return true;
  }
  // ---- casualty: the copy trigger (the sacrifice was paid while casting)
  if (it.r18kCas && /^casualty: copy (?:this spell|~)$/.test(l)){ if (UI.dry) return true; await copyMany({...ctx, it:{...it, tgt:it.tgt}}, 1); return true; }
  // ---- 12. Jace, the Mind Sculptor +2 and other looks at another player's top card
  if (/^look at the top card of target player's library$/.test(l)){
    const g = ((ctx.tgts || [])[ctx.ti || 0] || []).filter(targetStillThere); const t = g.find(x => x.t === 'player');
    if (!t || t.pid === MYPID) return false;   // my own library: engine13
    nextTargets(ctx); if (UI.dry){ ctx.r18kPeek = {pid:t.pid, k:null}; return true; }
    const r = await r18kPeekTop(t.pid, name); ctx.r18kPeek = {pid:t.pid, k:r.k || null};
    if (!r.k){ if (!r.none) log(`${name}: ${nameOf(t.pid)}'s library is empty`); return true; }
    log(`${name}: looked at the top card of ${nameOf(t.pid)}'s library`);
    if (!/you may put that card on the bottom of that player's library/.test(full)) await pickCards({title:`${name}: the top card of ${nameOf(t.pid)}'s library`, cards:[{id:-1, k:r.k}], min:0, max:0, noneLabel:'OK'});
    return true;
  }
  if (ctx.r18kPeek && /^you may put that card on the bottom of that player's library$/.test(l)){
    const {pid, k} = ctx.r18kPeek; if (!k || UI.dry) return true;
    const ids = await pickCards({title:`${name}: ${nameOf(pid)}'s top card — put it on the bottom of their library?`, hint:'Click the card to put it on the bottom, or leave it on top.', cards:[{id:-1, k}], min:0, max:1, noneLabel:'Leave it on top'});
    if (ids && ids.length){ sendRq(pid, 'r22libTop', 0, name); log(`${name}: put the top card of ${nameOf(pid)}'s library on the bottom`); } else log(`${name}: left it on top`);
    commit(); return true;
  }
  // "X. If the gift was promised / you have the city's blessing, instead Y." (rewritten below): only one of them happens,
  // and the one that doesn't still uses up its targets so the other reads the right ones (CR 702.174m)
  if ((m = l.match(/^if (the gift was promised|the gift wasn't promised|you have the city's blessing|you don't have the city's blessing), (.+)$/))){
    const gift = !!(ctx.gift || it.gift); const city = /city/.test(m[1]) ? (UI.dry ? false : !!r19City()) : false;
    const on = m[1] === 'the gift was promised' ? gift : m[1] === "the gift wasn't promised" ? !gift : m[1] === "you have the city's blessing" ? city : !city;
    const inner = s.slice(s.length - m[2].length);
    if (on) await doSentence(cap(inner), ctx); else if (sentenceHasTarget(m[2]) && ctx.tgts) nextTargets(ctx);
    return true;
  }
  if ((m = l.match(/^permanents you control (?:also )?gain ([a-z ,]+?) until end of turn$/))){
    if (UI.dry) return true; const kw = m[1].split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim()).filter(Boolean);
    S.bf.filter(c => !c.fd).forEach(c => { applyOp({op:'pump', tid:c.id, f:{p:0, t:0, kw}}, MYPID); }); log(`${name}: permanents I control gain ${m[1]} until end of turn`); commit(); return true;
  }
  // Perch Protection's promised gift: Teferi's Protection's two effects (engine22)
  if (/^all permanents you control phase out, and until your next turn, your life total can't change and you gain protection from everything$/.test(l)){
    await doSentence("Until your next turn, your life total can't change and you gain protection from everything", ctx); await doSentence('All permanents you control phase out', ctx); return true;
  }
  // Vona's Hunger with the city's blessing
  if (/^each opponent sacrifices half the creatures they control of their choice, rounded up$/.test(l)){
    if (UI.dry) return true;
    for (const p of opponents()){ if (p.s && p.s.lost) continue; const n = Math.ceil(((OPP.get(p.pid) || {}).bf || []).filter(c => c.k && !c.fd && isCreatureCard(c)).reduce((a, c) => a + (c.n || 1), 0) / 2);
      if (n){ sendRq(p.pid, 'sac', n, name, {d:'creature'}); log(`${name}: ${nameOf(p.pid)} sacrifices ${n} creature${n === 1 ? '' : 's'} (half, rounded up)`); } }
    commit(); return true;
  }
  // Claim Jumper: "search your library for a Plains card and put it onto the battlefield tapped" (no comma for searchLibrary)
  if ((m = s.match(/^search your library for (an? [a-z ]+? card) and put (?:it|that card) (onto the battlefield(?: tapped)?|into your hand)$/i)) && /repeat this process once/.test(full)){
    await searchLibrary(m[1], 'put it ' + m[2], ctx); commit(); return true;
  }
  // Flickerwisp's exile (engine19a left the opponent's return to a note)
  if (/^exile another target permanent$/.test(l) && /return (?:that card|it) to the battlefield under its owner's control at the beginning of the next end step/.test(full)){
    const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t){ ctx.lastT = [t]; if (!UI.dry) applyTo(t, {op:'exile', src:name}); } commit(); return true;
  }
  // ---- 14. Flickerwisp & co. on another player's permanent: its owner returns it at the beginning of the next end step
  if (/^return (?:that card|it) to the battlefield under its owner's control at the beginning of the next end step$/.test(l)){
    const t = (ctx.lastT || []).find(x => x.t === 'card'); if (!t || !t.pid || t.pid === MYPID) return false;
    if (UI.dry) return true; sendRq(t.pid, 'r18kDly', 0, name, {tid:t.id, d:String(ctx.k || '').slice(0, 80)});
    log(`${name}: ${t.nm || 'that card'} returns to the battlefield under ${nameOf(t.pid)}'s control at the beginning of the next end step`); commit(); return true;
  }
  // ---- 15. Claim Jumper: "Then if an opponent controls more lands than you, repeat this process once"
  if (/^(?:then )?if an opponent controls more lands than you, repeat this process once$/.test(l)){
    const prev = ctx.r18kPrev; if (!prev || UI.dry) return true;
    if (r18kOppMoreLands()){ log(`${name}: an opponent still controls more lands — repeating`); await doSentence(prev, ctx); } return true;
  }
  if (/^if you search(?:ed)? your library this way, shuffle$/.test(l) && /repeat this process once/.test(full)){ if (ctx.r18kSearched && !UI.dry) shuffleLib(); return true; }
  // Skittering Cicada: "until end of turn, ~ gains trample and gets +X/+X, where X is that spell's mana value"
  if ((m = l.match(/^until end of turn, ~ gains ([a-z ,]+?) and gets \+x\/\+x, where x is that spell's mana value$/))){
    if (UI.dry) return true; const c = srcCardOf(ctx); if (!c || !S.bf.includes(c)) return true;
    const sp = it.evId != null ? r18kSpellOnStack(it.evId) : null; const n = sp ? (sp.mv ?? sp.it?.mv ?? info(sp.k)?.mv ?? 0) : (info(it.evk)?.mv || 0);
    applyOp({op:'pump', tid:c.id, f:{p:n, t:n, kw:m[1].split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim()).filter(Boolean)}}, MYPID);
    log(`${cname(c)} gets +${n}/+${n} and gains ${m[1]} until end of turn`); commit(); return true;
  }
  // Level Up's granted attack trigger: "Then if it has power 10 or greater, draw a card"
  if ((m = l.match(/^(?:then )?if (?:it|~) has power (\d+) or greater, (draw (?:a|one|two|three) cards?)$/))){
    if (UI.dry) return true; const c = (it.evId != null && S.bf.find(x => x.id === it.evId)) || srcCardOf(ctx); const st = c && S.bf.includes(c) ? stats(c) : null;
    if (st && st[0] >= +m[1]) await doSentence(cap(m[2]), ctx); else log(`${name}: ${c ? cname(c) : 'it'} has power ${st ? st[0] : 0} — no card`); return true;
  }
  // ---- Dovin, Hand of Control −1
  if (/^until your next turn, prevent all damage that would be dealt to and dealt by target permanent an opponent controls$/.test(l)){
    const t = (ctx.tgts ? nextTargets(ctx) : []).find(x => x.t === 'card'); if (!t || UI.dry) return true; const [n] = currentTurn();
    if (t.pid === MYPID){ const c = S.bf.find(x => x.id === t.id); if (c) c.r18kND = {by:MYPID, n}; } else sendRq(t.pid, 'r18kNoDmg', n, name, {tid:t.id, d:MYPID});
    log(`${name}: until ${nameOf(MYPID)}'s next turn, all damage dealt to and by ${t.nm || 'that permanent'} is prevented`); commit(); return true;
  }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase();
    if (l && ctx && await r18kPre(s, l, ctx)) return;
    const r = await ds(s0, ctx);
    try { if (ctx && l && !/repeat this process/.test(l)) ctx.r18kPrev = s0; } catch {}
    return r; };
  const sl = searchLibrary;
  searchLibrary = async function(d, rest, ctx){ if (ctx) ctx.r18kSearched = true; return sl(d, rest, ctx); };
}

// "X. If the gift was promised, instead Y." → "If the gift wasn't promised, X. If the gift was promised, Y." (same for the city's blessing)
{
  const NOT = {'the gift was promised':"the gift wasn't promised", "you have the city's blessing":"you don't have the city's blessing"};
  const re = runEffects;
  runEffects = async function(txt, ctx){
    let t = String(txt || '');
    try { t = t.replace(/(^|\n|\.\s+)([A-Z~][^.\n]*?)\.\s+If (the gift was promised|you have the city's blessing), instead ([^.\n]+)\./g, (w, a, x, c, y) => `${a}If ${NOT[c]}, ${x.charAt(0).toLowerCase() + x.slice(1)}. If ${c}, ${y}.`); } catch {}
    return re(t, ctx);
  };
  // "Escalate {G}" above "Choose one or more —": the modes are still chosen as the spell is cast
  const pm = parseModes;
  parseModes = function(txt){ const r = pm(txt); const t = String(txt || '');
    // escalate spells say "Choose one or more" (MODE_RE reads it as "one"): every mode may be chosen
    if (r && /^Escalate\b[^\n]*\n\s*Choose one or more\b/i.test(t)) return {...r, min:1, max:r.opts.length};
    return r; };
}

/* ---------- turns: an extra turn given to another player (Gift an extra turn, CR 702.174g / 500.7) ----------
   The player I gave it to takes the next turn; when that extra turn ends, play goes on from me as if it hadn't happened. */
{
  const pt = passTurn;
  passTurn = function(){
    try { const [n, pid, g = 0] = currentTurn();
      if (n > 0 && pid === MYPID && (S.r18kGiveXt || []).length){ const to = S.r18kGiveXt.shift(); if (players().some(p => p.pid === to)){ sendRq(to, 'r18kXt', n + 1, 'extra turn', {d:MYPID}); S.turn = [n + 1, to, g]; log(`passed the turn to ${nameOf(to)} (an extra turn)`); commit(); return; } }
      const rs = S.r18kResume; if (n > 0 && pid === MYPID && rs && rs.n === n){ S.r18kResume = null; const np = typeof j18NextLive === 'function' ? j18NextLive(rs.after) : null;
        const ps = players(); const i = ps.findIndex(p => p.pid === rs.after); const next = np || (ps[(i < 0 ? 0 : i + 1) % ps.length] || {}).pid;
        if (next){ S.turn = [n + 1, next, g]; log(`extra turn over — passed the turn to ${next === MYPID ? 'themself' : nameOf(next)}`); commit(); return; } }
    } catch (e){ console.warn('r18k turn', e); }
    return pt();
  };
}
RQ_OPS.push('r18kXt');

/* ---------- casting: casualty's sacrifice and escalate's extra cost ---------- */
function r18kKw(a, re){ const t = a ? tname(a.o || '', a.n) : ''; return t.split('\n').map(x => x.trim().replace(/\.$/, '')).map(x => x.match(re)).find(Boolean) || null; }
{
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){
    if (UI.casting || UI.dry || !c || !S) return bc(c, zone, o);
    const a = info(c.k); const cm = r18kKw(a, /^casualty (\d+)$/i); let cas = null;
    if (cm && /\b(instant|sorcery)\b/i.test(a.t || '')){
      const n = +cm[1]; const list = S.bf.filter(b => !b.fd && isCreatureCard(b) && ((stats(b) || [0])[0] >= n));
      if (list.length){ const ids = await pickCards({title:`${a.n}: casualty ${n} — sacrifice a creature with power ${n} or greater to copy it?`, cards:list, min:0, max:1, noneLabel:"Don't"}); if (ids && ids[0] != null) cas = {card:c.id, sac:ids[0]}; }
    }
    const prev = UI.r18kCast; UI.r18kCast = {card:c, cas, modes:0};
    try { return await bc(c, zone, o); } finally { UI.r18kCast = prev; }
  };
  const am = askModes;
  askModes = async function(md, name){
    const r = await am(md, name);
    try { const x = UI.r18kCast; if (r && x && info(x.card.k)?.n === name){ x.modes = r.length;
        const tm = r18kKw(info(x.card.k), /^escalate\s*—\s*tap an untapped creature you control$/i);
        if (tm && r.length > 1){ const n = S.bf.filter(b => !b.fd && !b.tap && isCreatureCard(b)).length; if (n < r.length - 1){ toast(`Escalate: tapping ${r.length - 1} untapped creatures is needed for ${r.length} modes (you have ${n})`); return null; } } } } catch (e){ console.warn(e); }
    return r;
  };
  const sc = spellCost;
  spellCost = function(c, zone, o = {}){
    const r = sc(c, zone, o);
    try { const x = UI.r18kCast; if (x && c && x.card.id === c.id && x.modes > 1){ const em = r18kKw(info(c.k), /^escalate ((?:\{[^}]+\})+)$/i);
        if (em){ const e = parseCost(em[1]); const t = x.modes - 1; r.cost.gen += e.gen * t; for (const col of Object.keys(e.col || {})) r.cost.col[col] = (r.cost.col[col] || 0) + (e.col[col] || 0) * t; r.notes.push(`escalate ${em[1]} × ${t}`); } } } catch (e){ console.warn(e); }
    return r;
  };
  const ct = castTriggers;
  castTriggers = function(c, a, it){
    const r = ct(c, a, it);
    try { const x = UI.r18kCast; if (x && c && x.card.id === c.id){
        if (x.cas){ const b = S.bf.find(y => y.id === x.cas.sac); x.cas = null;
          if (b){ log(`casualty: sacrificed ${cname(b)}`); sacrificeOne(b); it.r18kCasPaid = 1; pushTrig(a.n, 'Casualty: copy this spell.', {k:c.k, tgt:it.sid, r18kCas:1}); } }
        const tm = x.modes > 1 && r18kKw(a, /^escalate\s*—\s*tap an untapped creature you control$/i);
        if (tm){ const need = x.modes - 1; const list = S.bf.filter(b => !b.fd && !b.tap && isCreatureCard(b));
          (async () => { const ids = list.length <= need ? list.map(b => b.id) : await pickCards({title:`${a.n}: escalate — tap ${need} untapped creature${need > 1 ? 's' : ''}`, cards:list, min:need, max:need});
            (ids || []).forEach(id => { const b = S.bf.find(y => y.id === id); if (b){ b.tap = true; emit({type:'tapped', k:b.k, id:b.id}); } }); log(`escalate: tapped ${(ids || []).length} creature${(ids || []).length === 1 ? '' : 's'}`); commit(); })(); }
      } } catch (e){ console.warn('r18k cast', e); }
    return r;
  };
}

/* ---------- combat: cipher triggers; Dovin's prevention ---------- */
{
  const hd = hitDefender;
  hitDefender = function(def, n, a, extra){
    if (a && r18kNDOn(a)){ log(`damage from ${cname(a)} prevented (Dovin, Hand of Control)`); return; }
    const r = hd(def, n, a, extra);
    try { if (S && def && def.t === 'player' && def.pid !== MYPID && n > 0 && a && S.r18kCiph && S.r18kCiph.length){
        S.r18kCiph = S.r18kCiph.filter(x => S.ex.some(c => c.id === x.card) && S.bf.some(c => c.id === x.cr));
        for (const x of S.r18kCiph.filter(x => x.cr === a.id)) pushTrig(cname(a), `Cipher: you may cast a copy of ${info(x.k)?.n} without paying its mana cost.`, {k:a.k, srcId:a.id, r18kCiph:x.k}); } } catch (e){ console.warn('r18k cipher', e); }
    return r;
  };
  const dd = dealDamage;
  dealDamage = function(t, n, srcK, srcCard, extra){ if (srcCard && S && S.bf.includes(srcCard) && r18kNDOn(srcCard)){ log(`damage from ${cname(srcCard)} prevented`); return; } return dd(t, n, srcK, srcCard, extra); };
  const dc = damageCard;
  damageCard = function(c, n, f){ if (c && n > 0 && r18kNDOn(c)){ log(`damage to ${cname(c)} prevented`); return 0; } return dc(c, n, f); };
}

/* ---------- Noggle the Mind ("is a colorless Noggle with base power and toughness 1/1": no word "creature") ---------- */
{
  const lp = l24parseStatic;
  l24parseStatic = function(line){ const l = String(line || '').toLowerCase().replace(/\.$/, '').trim(); let m;
    if ((m = l.match(/^enchanted creature loses all abilities and is an? colorless ([a-z]+) with base power and toughness (\d+)\/(\d+)$/)))
      return {scope:'att', desc:'', mod:{noAb:1, pt:[+m[2], +m[3]], crSub:[l24capW(m[1])], col:'', addC:['Creature']}};
    return lp(line); };
}

/* ---------- requests from other players ---------- */
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'r18kPeek'){ (async () => { const c = S.lib[0]; const ref = String(r.ref || '').slice(0, 16);
        if (!c){ S.r18kPeek = {ref, to:from, empty:1}; commit(); return; }
        const s = await r18SealAsync(from, c.k); S.r18kPeek = s && s.e ? {ref, to:from, e:s.e} : {ref, to:from, p:c.k};
        log(`${nameOf(from)} looks at the top card of my library (${r.src})`); commit(); })(); return; }
    if (r.op === 'r18kXt'){ S.r18kResume = {n:+r.n || 0, after:String(r.d || from)}; log(`will take an extra turn (${nameOf(from)}'s gift)`); commit(); return; }
    if (r.op === 'r18kDly'){ S.dly.push({id:rid(6), eff:'(delayed) return to bf', k:r.d || null, nm:r.src, srcId:r.tid, op:'r16ret', where:'bf'}); log(`${r.src}: that card returns at the beginning of the next end step`); commit(); return; }
    if (r.op === 'r18kNoDmg'){ const c = S.bf.find(b => b.id === r.tid); if (c){ c.r18kND = {by:String(r.d || from), n:+r.n || currentTurn()[0]}; log(`${r.src}: all damage dealt to and by ${cname(c)} is prevented until ${nameOf(from)}'s next turn`); commit(); } return; }
    if (r.op === 'r18kExplore'){ (async () => { const c = S.bf.find(b => b.id === r.tid); if (c){ await explore(c, {name:r.src, k:null, it:{}}); commit(); } })(); return; }
    return ao(r, from);
  };
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); try { if (S && S.r18kPeek) o.r18kPeek = S.r18kPeek; } catch {} return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { const x = s && s.r18kPeek; if (x && typeof x === 'object'){ const y = {ref:String(x.ref || '').slice(0, 16), to:String(x.to || '').slice(0, 40)};
      if (typeof x.e === 'string') y.e = x.e.slice(0, 400); else if (typeof x.p === 'string') y.p = x.p.slice(0, 80); else if (x.empty) y.empty = 1; o.r18kPeek = y; } } catch {} return o; };
}
