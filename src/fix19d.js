/* ===== fix19d: cross-player choices, other players' screens, deck rules — helper O, 6 Nov (GAPS19.md section O) =====
   1. Opponents' choices on their own screens: Kroxa (each opponent discards; the engine sees whether it was a nonland card),
      Acererak (each opponent decides whether to sacrifice a creature), Tasigur (the chosen opponent picks the card),
      "target player loses N life unless they discard a card" (the player decides).
   2. Dargo: the sacrifice prompt shows the spell's current cost and the cost after each sacrifice.
   3. Jace, Multiverse Architect: the active opponent is asked to pay {2}; if they don't, their creatures can't attack your Jaces.
   4. Altaïr Ibn-La'Ahad: the exiled card gets a memory counter; a tapped and attacking token copy of every creature card you
      own in exile with a memory counter; the tokens are exiled at end of combat.
   5. Tevesh Szat −10: gain control of every commander on the battlefield and put every commander from every command zone
      onto the battlefield under your control (owners stay exact; commanders stay commanders).
   7. Owner and controller stay exact: a permanent you control but don't own that you give away goes through its owner, so the
      new controller's loan is always from the real owner (Aminatou −6, Donate, Zedruu …). The Aminatou rotation mark survives
      the network, so a permanent is passed on only once per rotation.
   8. Mindslaver / Emrakul: the controller plays the controlled player's turn from their own screen (cast / play / attack / next),
      targets come to the controller too, the controlled player can't act on their own while controlled.
   9. Deck legality: Commander and Duel Commander banned lists from Scryfall's `legalities`.
  10. Different builds: a warning to everyone, and private payloads are refused (the sender is told) instead of going out plain.
  11. Life totals set by the engine (exchange life totals, "life total becomes") never count as a by-hand correction. */
const O19 = {refused:new Set(), warned:new Set(), giveCmd:false};

// ---------------------------------------------------------------- 1. opponents decide on their own screens
{
  const em = g23eachMine;
  g23eachMine = async function(kind, n, src, from){
    const k = String(kind || '');
    if (k.startsWith('o19disc|')){ // discard n cards of your choice; answer how many were nonland cards
      const need = Math.max(1, n || 1); if (!S.hand.length){ log(`has no card to discard (${src})`); return {n:0}; }
      let ids = S.hand.length <= need ? S.hand.map(c => c.id) : await pickCards({title:`${src}: discard ${need === 1 ? 'a card' : need + ' cards'}${k.slice(8) ? ' — ' + k.slice(8) : ''}`, cards:S.hand.slice(), min:need, max:need});
      if (!ids || !ids.length) ids = S.hand.slice(0, need).map(c => c.id);
      let nl = 0; const ks = [];
      for (const id of ids){ const c = S.hand.find(x => x.id === id); if (!c) continue; if (!isLand(c.k)) nl++; ks.push(c.k); moveCard(id, 'gy'); emit({type:'discard', cnt:1, k:c.k}); }
      log(`discarded ${ks.map(k2 => info(k2)?.n).join(', ')} (${src})`); commit(); return {n:nl, d:ks.join(',').slice(0, 80)};
    }
    if (k.startsWith('o19sacCr|')){ // may sacrifice a creature of your choice
      const pool = S.bf.filter(c => !c.fd && isCreatureCard(c)); if (!pool.length) return {n:0};
      const ids = await pickCards({title:`${src}: sacrifice a creature? (If you don't, ${nameOf(from)} ${k.slice(9) || 'gets something'})`, cards:pool, min:0, max:1, noneLabel:"Don't sacrifice"});
      const c = ids && ids[0] != null ? S.bf.find(b => b.id === ids[0]) : null;
      if (c){ sacrificeOne(c); log(`sacrificed ${cname(c)} (${src})`); commit(); return {n:1}; }
      return {n:0};
    }
    return em(kind, n, src, from);
  };
}
async function o19Pre1(s, l, ctx){
  let m; const name = ctx.name; const full = String(ctx.full || '').toLowerCase();
  // Kroxa: each opponent discards a card, then each opponent who didn't discard a nonland card this way loses N life
  if ((m = l.match(/^each opponent discards a card, then each opponent who didn't discard a nonland card this way loses (\d+) life$/)) ||
      (l === 'each opponent discards a card' && (m = full.match(/each opponent who didn't discard a nonland card this way loses (\d+) life/)))){
    const L = +m[1]; ctx.o19kroxa = true;
    const res = await g23askEach(opponents().map(p => p.pid), `o19disc|if it isn't a nonland card you lose ${L} life`, 1, name);
    for (const r of res){ if (UI.dry) break; if (!r.n){ log(`${name}: ${nameOf(r.pid)} didn't discard a nonland card — loses ${L} life`); await loseLife(r.pid, L, name); } else log(`${name}: ${nameOf(r.pid)} discarded a nonland card`); }
    commit(); return true;
  }
  if (/^(?:then )?each opponent who didn't discard a nonland card this way loses \d+ life$/.test(l) && ctx.o19kroxa) return true;
  // Acererak: for each opponent, you create a 2/2 black Zombie unless that player sacrifices a creature of their choice
  if ((m = l.match(/^for each opponent, you create (an? .+? token) unless that player sacrifices a creature of their choice$/))){
    const i0 = l.indexOf(m[1]); const tok = s.substr(i0, m[1].length);
    const res = await g23askEach(opponents().map(p => p.pid), `o19sacCr|creates ${m[1]}`, 1, name);
    for (const r of res){ if (UI.dry) break; if (r.n) log(`${name}: ${nameOf(r.pid)} sacrificed a creature`); else { log(`${name}: ${nameOf(r.pid)} didn't sacrifice — I create ${m[1]}`); await createFromText('Create ' + tok, ctx); } }
    commit(); return true;
  }
  // Tasigur: return a nonland card of an opponent's choice from your graveyard to your hand
  if (/^return a nonland card of an opponent's choice from your graveyard to your hand$/.test(l)){
    const list = S.gy.filter(c => !isLand(c.k)); if (!list.length){ log(`${name}: no nonland card in my graveyard`); return true; }
    const os = opponents(); if (!os.length || UI.dry){ return true; }
    let pid = os[0].pid;
    if (os.length > 1) pid = await askChoice({title:`${name}: choose the opponent who picks the card`, q24local:true, options:os.map(p => ({label:p.nm || nameOf(p.pid), value:p.pid}))}) || pid;
    const ids = list.length === 1 ? [list[0].id] : await r22oppPick(pid, list, 1, `return a nonland card from ${nameOf(MYPID)}'s graveyard to their hand`, name);
    const c = S.gy.find(x => x.id === (ids || [])[0]) || list[0];
    if (c){ moveCard(c.id, 'hand'); log(`${name}: ${nameOf(pid)} chose ${cname(c)} — returned to my hand`); }
    commit(); return true;
  }
  // target player loses N life unless they discard a card: they decide
  if ((m = l.match(/^target player loses (\d+) life unless they discard a card$/))){
    const t = (ctx.tgts ? nextTargets(ctx) : []).find(x => x.t === 'player'); if (!t) return true;
    if (t.pid === MYPID){ const ids = S.hand.length ? await pickCards({title:`${name}: discard a card, or lose ${m[1]} life`, cards:S.hand.slice(), min:0, max:1, noneLabel:`Lose ${m[1]} life`}) : [];
      if (ids && ids[0] != null){ moveCard(ids[0], 'gy'); emit({type:'discard', cnt:1}); } else await loseLife(MYPID, +m[1], name); commit(); return true; }
    await g23askEach([t.pid], `discardOr|${m[1]}`, 1, name); commit(); return true;
  }
  return false;
}

// ---------------------------------------------------------------- 2. Dargo: the cost first, then the sacrifice discount
function o19DargoText(c){ return /costs \{2\} less to cast for each permanent sacrificed this way and \{2\} less to cast for each other artifact or creature you've sacrificed this turn/i.test(info(c.k)?.o || ''); }
{
  const pc = pickCards;
  pickCards = function(m){
    try { const c = O19.dargo; if (c && m && /: sacrifice artifacts and\/or creatures\? \(each makes it cost \{2\} less\)$/.test(String(m.title || ''))){
      O19.dargo = null; const zone = O19.dargoZone || 'hand';
      const base = spellCost(c, zone, {}).cost; const before = (S.sacT && S.sacT.t === turnStr()) ? S.sacT.n : 0;
      const after = k => { const x = JSON.parse(JSON.stringify(base)); x.gen = Math.max(0, x.gen - 2 * k); return x; };
      const afford = k => !payPlan(after(k), S.pool).err;
      const n = (m.cards || []).length; const steps = []; for (let k = 1; k <= n && k <= 6; k++){ steps.push(`${k} → ${costStr(after(k))}`); if (!after(k).gen) break; }
      let need = -1; for (let k = 0; k <= n; k++) if (afford(k)){ need = k; break; }
      const title = `${cname(c)} costs ${costStr(base)}${before ? ` (already {${2 * before}} less: ${before} sacrificed this turn)` : ''}. Sacrifice artifacts and/or creatures as you cast it — each makes it cost {2} less: ${steps.join(', ')}`;
      const hint = need < 0 ? "You can't pay for it even with every sacrifice." : need === 0 ? `You can pay ${costStr(base)} without sacrificing anything.` : `You need to sacrifice at least ${need} to pay for it.`;
      return pc({...m, title, hint, noneLabel:`Sacrifice nothing — pay ${costStr(base)}`});
    } } catch (e){ console.warn('o19 dargo', e); }
    return pc(m);
  };
  const bc = beginCast;
  beginCast = async function(c, zone, ...a){
    try { O19.dargo = c && c.k && o19DargoText(c) ? c : null; O19.dargoZone = zone; } catch {}
    try { return await bc(c, zone, ...a); } finally { O19.dargo = null; }
  };
}

// ---------------------------------------------------------------- 3. Jace, Multiverse Architect
// S.o19nj = [{pid, t}]: that player's creatures can't attack Jaces I control this turn (published; checked by the attacker)
async function o19Pre3(s, l, ctx){
  let m; const name = ctx.name;
  if (/^they may pay \{2\}$/.test(l) && /if they don't, creatures they control can't attack/i.test(String(ctx.full || ''))){
    const pid = phaseNow().pid; ctx.o19jPid = pid;
    ctx.o19jPaid = pid && pid !== MYPID ? await askOpponentPay(pid, '{2}', name) : true;
    if (pid && pid !== MYPID) log(`${name}: ${nameOf(pid)} ${ctx.o19jPaid ? 'paid {2}' : "didn't pay {2}"}`);
    return true;
  }
  if ((m = l.match(/^if they don't, creatures they control can't attack (?:~|jace, multiverse architect|jace)s you control this turn$/))){
    const pid = ctx.o19jPid || phaseNow().pid; if (UI.dry || !pid || pid === MYPID || ctx.o19jPaid) return true;
    S.o19nj = (S.o19nj || []).filter(x => x.t === turnStr() && x.pid !== pid).concat({pid, t:turnStr()});
    log(`${name}: ${nameOf(pid)}'s creatures can't attack Jaces I control this turn`); commit(); return true;
  }
  return false;
}
{
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); try { const t = turnStr(); const l = (S.o19nj || []).filter(x => x.t === t); if (l.length) o.o19nj = l.map(x => x.pid + '@' + x.t).join(','); else delete o.o19nj; if (O19.bid) o.o19bid = O19.bid; } catch {} return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { o.o19nj = s && typeof s.o19nj === 'string' ? s.o19nj.slice(0, 300) : ''; o.o19bid = s && typeof s.o19bid === 'string' ? s.o19bid.replace(/[^a-z0-9.]/gi, '').slice(0, 24) : ''; } catch {} return o; };
  const ab = h23atkBanned;
  h23atkBanned = function(c, def){
    const r = ab(c, def); if (r) return r;
    try { const d = parseDef(def); if (d && d.t === 'card' && d.pid && d.pid !== MYPID){ const st = OPP.get(d.pid); const pw = (st && st.bf || []).find(b => b.id === d.id);
        if (pw && pw.k && /\bJace\b/.test(String(info(pw.k)?.t || '').split('—')[1] || '') && String(st.o19nj || '').split(',').includes(MYPID + '@' + turnStr())) return `can't attack Jaces ${nameOf(d.pid)} controls this turn (they didn't pay {2})`; } } catch {}
    return '';
  };
}

// ---------------------------------------------------------------- 4. Altaïr Ibn-La'Ahad: memory counters
{
  const ts = targetSpecs;
  targetSpecs = function(t){ let s = String(t || ''); try { s = s.replace(/( card from your graveyard) with an? (\w+) counter on it/gi, '$1'); } catch {} return ts(s); };
}
async function o19Pre4(s, l, ctx){
  let m; const name = ctx.name;
  if ((m = l.match(/^exile up to one target (.+?) card from your graveyard with a (\w+) counter on it$/))){
    const kind = m[2]; const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; ctx.o19mem = true;
    if (!t || find(t.id)[0] !== 'gy'){ log(`${name}: no card exiled`); return true; }
    moveCard(t.id, 'ex'); const c = S.ex.find(x => x.id === t.id);
    if (c){ addNamed(c, kind, 1); log(`${name}: exiled ${cname(c)} with a ${kind} counter on it`); }
    commit(); return true;
  }
  if ((m = l.match(/^(?:then )?for each creature card you own in exile with a (\w+) counter on it, create a tapped and attacking token that's a copy of it$/))){
    const kind = m[1]; const list = S.ex.filter(c => !c.fd && isCreatureCard(c) && ((c.nc || {})[kind] || 0) > 0);
    ctx.lastTok = []; ctx.o19mem = true;
    const def = phaseNow().ph === 4 ? attackDefFor(ctx) : '';
    for (const c of list){ const before = new Set(S.bf.map(b => b.id)); await createToken(c.k, 1); const tk = S.bf.find(b => !before.has(b.id) && b.tok);
      if (tk){ tk.tap = true; tk.sk = false; if (def) tk.atk = def; ctx.lastTok.push(tk.id); } }
    if (ctx.lastTok.length && def) S.l24myr = (S.l24myr || []).concat(ctx.lastTok);   // exiled at end of combat
    log(`${name}: ${ctx.lastTok.length} tapped and attacking token cop${ctx.lastTok.length === 1 ? 'y' : 'ies'}${list.length ? ' (' + list.map(cname).join(', ') + ')' : ''}`);
    commit(); return true;
  }
  if (/^exile those tokens at end of combat$/.test(l) && ctx.o19mem){ if ((ctx.lastTok || []).length && !(S.l24myr || []).includes(ctx.lastTok[0])) S.l24myr = (S.l24myr || []).concat(ctx.lastTok); return true; }
  return false;
}

// ---------------------------------------------------------------- 5. Tevesh Szat −10 / commanders keep being commanders
RQ_OPS.push('o19czGive', 'o19redir');
{
  const ga = giveAway;
  giveAway = function(c, to, f = {}){ const k = O19.giveCmd; O19.giveCmd = !!(c && c.cmd); try { return o19GiveAway(ga, c, to, f || {}); } finally { O19.giveCmd = k; } };
  const sr = sendRq;
  sendRq = function(to, op, n, src, extra = {}){ try { if (op === 'give' && O19.giveCmd && extra && extra.c && typeof extra.c === 'object') extra = {...extra, c:{...extra.c, cmd:1}}; } catch {} return sr(to, op, n, src, extra); };
  const tk = takeCard;
  takeCard = function(r, from){ const before = new Set(S.bf.map(b => b.id)); const out = tk(r, from);
    try { const nc = S.bf.find(b => !before.has(b.id)); if (nc && r && r.c){ if (r.c.cmd) nc.cmd = true; if (r.f && r.f.b27am) nc.b27amT = String(r.f.b27am).slice(0, 12); } } catch {} return out; };
  const cf = cleanFlags;
  cleanFlags = function(f){ const o = cf(f); try { if (f && typeof f === 'object' && typeof f.b27am === 'string') o.b27am = f.b27am.replace(/[^a-z0-9]/gi, '').slice(0, 12); } catch {} return o; };
}
async function o19Pre5(s, l, ctx){
  const name = ctx.name;
  if (l === 'gain control of all commanders'){
    let n = 0;
    for (const p of opponents()){ for (const c of (OPP.get(p.pid)?.bf || [])) if (c.cmd && c.k){ sendRq(p.pid, 'steal', 0, name, {tid:c.id}); n++; } }
    log(`${name}: gain control of all commanders${n ? ` (${n} from other players)` : ''}`); commit(); return true;
  }
  if (l === 'put all commanders from the command zone onto the battlefield under your control'){
    const mine = S.cz.filter(c => c.cmd || (S.deck && (S.deck.cmd || []).includes(c.k)));
    for (const c of mine){ moveCard(c.id, 'bf'); }
    for (const p of opponents()) if ((OPP.get(p.pid)?.cz || []).length) sendRq(p.pid, 'o19czGive', 0, name);
    log(`${name}: all commanders in command zones come onto the battlefield under ${nameOf(MYPID)}'s control`); commit(); return true;
  }
  return false;
}
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r && r.op === 'o19czGive'){
      const list = S.cz.filter(c => c.cmd || (S.deck && (S.deck.cmd || []).includes(c.k)));
      for (const c of list){ S.cz.splice(S.cz.indexOf(c), 1); c.cmd = true; const ref = rid(6); S.lent.push({ref, to:from, card:c, perm:true});
        sendRq(from, 'give', 0, r.src || cname(c), {ref, c:{k:c.k, cmd:1}, f:{}}); log(`${cname(c)} goes from my command zone onto ${nameOf(from)}'s battlefield (${r.src})`); }
      commit(); return;
    }
    if (r && r.op === 'o19redir'){ o19Redirect(r, from); return; }
    return ao(r, from);
  };
}

// ---------------------------------------------------------------- 7. exact owners: a borrowed permanent is passed on through its owner
function o19GiveAway(ga, c, to, f){
  if (!c || !c.own || !c.own.pid || c.own.pid === MYPID || !OPP.has(c.own.pid) || UI.dry || !S.bf.includes(c)) return ga(c, to, f);
  const owner = c.own.pid; S.bf.splice(S.bf.indexOf(c), 1);
  const st = {k:c.k, cp:c.cp || 0, cm:c.cm || 0, co:c.co || 0, tok:c.tok ? 1 : 0, fl:c.fl ? 1 : 0, tap:c.tap ? 1 : 0, cmd:c.cmd ? 1 : 0};
  if (c.pu && (c.pu[0] || c.pu[1]) && !(f.l19p || f.l19t)) f = {...f, l19p:c.pu[0], l19t:c.pu[1]};
  sendRq(owner, 'o19redir', 0, cname(c), {ref:c.own.ref, d:String(to), c:st, f});
  log(`${to === owner ? `${cname(c)} goes back to its owner ${nameOf(owner)}` : `${nameOf(to)} gained control of ${cname(c)} (owned by ${nameOf(owner)})`}${f.eot ? ' until end of turn' : ''}`);
  return undefined;
}
function o19Redirect(r, from){
  const to = String(r.d || ''); const st = r.c || {}; const f = r.f || {};
  let i = (S.lent || []).findIndex(l => l.ref === r.ref);
  if (i < 0 && st.k){ const card = {id:S.nid++, k:st.k, cmd:!!st.cmd}; S.lent.push({ref:r.ref || rid(6), to:from, card}); i = S.lent.length - 1; }
  if (i < 0) return;
  const l = S.lent[i];
  if (to === MYPID){ // it comes home
    S.lent.splice(i, 1); const c = l.card; reset(c); place(c); c.sk = true; c.tap = !!st.tap; c.cp = st.cp || 0; c.cm = st.cm || 0; if (st.cmd) c.cmd = true; if (f.b27am) c.b27amT = String(f.b27am);
    delete c.own; S.bf.push(c); log(`got ${cname(c)} back (${r.src || 'control change'})`); commit(); return;
  }
  l.to = to; if (l.card){ l.card.cp = st.cp || 0; l.card.cm = st.cm || 0; }
  sendRq(to, 'give', 0, r.src || cname(l.card), {ref:l.ref, c:{...st, k:st.k || l.card.k}, f});
  log(`${nameOf(to)} now controls my ${cname(l.card)} (passed on by ${nameOf(from)})`); commit();
}

// ---------------------------------------------------------------- 8. Mindslaver / Emrakul: the controller plays the turn
// The controlled client keeps doing the work (its own state, its own mana): the controller sends commands (o19slv) from a panel,
// every choice (askChoice / pickCards — engine24q — and now targets) is asked on the controller's screen, and the controlled
// player's own clicks that would make a decision (cast, play, activate, attack, move to the next step) are refused (CR 723.5).
RQ_OPS.push('o19slv', 'o19slvH');
const o19SlvLive = q => q && (typeof isLive !== 'function' || isLive(q.by));
function o19Blocked(what){
  const q = !UI.dry && typeof q24Slaved === 'function' && q24Slaved(); if (!q || O19.remote || UI.resolving || !o19SlvLive(q)) return false;
  toast(`${nameOf(q.by)} controls your turn (${q.src}) — they choose what you ${what}`); return true;
}
{
  const bc = beginCast;
  beginCast = async function(c, zone, ...a){ if (!UI.casting && o19Blocked('cast')) return; return bc(c, zone, ...a); };
  const pl = playLand;
  playLand = function(c, ...a){ if (o19Blocked('play')) return; return pl(c, ...a); };
  const aa = activateAbility;
  activateAbility = async function(c, ...a){ if (o19Blocked('activate')) return; return aa(c, ...a); };
  const da = declareAttackers;
  declareAttackers = function(...a){ if (o19Blocked('attack with')) return; return da.apply(this, a); };
  const na = nextAction;
  nextAction = function(...a){ try { if (S && !stackTop() && phaseNow().mine && o19Blocked('do next')) return true; } catch {} return na.apply(this, a); };
  const et = endTurnFlow;
  endTurnFlow = function(...a){ if (o19Blocked('do next')) return; return et.apply(this, a); };
  // targets are chosen by the controller too
  const pt = pickTargets;
  pickTargets = function(spec, src, title){
    const q = !UI.dry && typeof q24Slaved === 'function' && q24Slaved(); if (!q || !o19SlvLive(q)) return pt(spec, src, title);
    const cands = targetCands(spec, src); const legal = cands.filter(c => c.ok);
    if (!spec.upTo && !legal.length) return Promise.resolve([]);
    return (async () => {
      const want = spec.n && spec.n < 99 ? spec.n : (spec.n >= 99 ? legal.length : 1); const out = [];
      const lab = c => c.t === 'player' ? `Player: ${c.pid === MYPID ? nameOf(MYPID) : nameOf(c.pid)}` : `${info(c.k)?.n || 'card'} (${c.pid === MYPID ? nameOf(MYPID) : nameOf(c.pid)})`;
      while (out.length < want){
        let left = legal.filter(c => !out.includes(c)); if (!left.length) break; let page = 0; let pick = null;
        const canStop = spec.upTo || out.length > 0 && spec.n >= 99;
        for (;;){
          const slice = left.slice(page * 6, page * 6 + 6); const more = left.length > page * 6 + 6;
          const opts = slice.map(lab).concat(more ? ['More…'] : []).concat(canStop ? ['No more targets'] : []);
          const a = await q24Ask(q.by, {kind:'choice', title:`(controlling ${nameOf(MYPID)}) ${title || 'choose a target'}${want > 1 ? ` — ${out.length + 1} of ${want}` : ''}`, opts}, q.src || 'Mindslaver');
          if (a == null || a === ''){ pick = canStop ? 'stop' : slice[0]; break; }
          const i = +a; if (i < slice.length){ pick = slice[i]; break; }
          if (more && i === slice.length){ page = left.length > (page + 1) * 6 ? page + 1 : 0; continue; }
          pick = 'stop'; break;
        }
        if (pick === 'stop' || !pick) break; out.push(pick);
      }
      if (out.length) log(`${nameOf(q.by)} chose the target${out.length === 1 ? '' : 's'} for ${nameOf(MYPID)}: ${out.map(lab).join(', ')}`);
      return out;
    })();
  };
  // the controller's view of the hand follows the hand (ids travel with the keys so commands can name a card)
  const cm = commit;
  commit = function(...a){
    try { const q = S && !UI.dry && typeof q24Slaved === 'function' && q24Slaved(); if (q && q.on){ const sig = S.hand.map(c => c.id + ':' + c.k).join(',');
        if (sig !== O19.slvSig){ O19.slvSig = sig; q24Pub('slavehand', S.hand.map(c => c.id).join(','), S.hand.map(c => c.k), q.by); r18PubReady('slavehand').then(() => { sendRq(q.by, 'o19slvH', 0, q.src, {ref:'slavehand'}); cm(); }); } } } catch (e){ console.warn('o19 slv', e); }
    return cm.apply(this, a);
  };
  const ao = applyOp;
  applyOp = function(r, from){
    if (r && (r.op === 'qslaveAsk' || r.op === 'o19slvH')){ (async () => { const p = await q24PubGet(from, 'slavehand'); if (p) UI.o19slv = {pid:from, t:turnStr(), ks:p.ks || [], ids:String(p.d || '').split(',').filter(Boolean).map(Number), src:r.src}; queueRender(); })(); }
    if (r && r.op === 'o19slvH') return;
    if (r && r.op === 'o19slv'){ o19SlvDo(r, from); return; }
    return ao(r, from);
  };
}
async function o19SlvDo(r, from){
  const q = typeof q24Slaved === 'function' && q24Slaved(); if (!q || q.by !== from){ log(`ignored a command from ${nameOf(from)} — they don't control this turn`); return; }
  const [cmd, arg] = String(r.d || '').split(':'); O19.remote = true;
  try {
    if (cmd === 'cast'){ const c = S.hand.find(x => x.id === +arg); if (!c){ log('that card is no longer in hand'); return; }
      log(`${nameOf(from)} has ${nameOf(MYPID)} ${isLand(c.k) ? 'play' : 'cast'} ${cname(c)}`);
      if (isLand(c.k)) playLand(c); else { const p = beginCast(c, 'hand'); O19.remote = false; await p; } }
    else if (cmd === 'atk1'){ const [id, def] = String(arg || '').split('='); O19.atk = O19.atk || {}; const d0 = String(r.d || '').slice(String(r.d).indexOf('=') + 1); if (id) O19.atk[+id] = d0 || ''; }
    else if (cmd === 'atkGo'){ const pn = phaseNow(); if (!pn.mine || !S.cb || S.cb.step !== 'atk'){ toast('Not in the declare attackers step'); O19.atk = {}; return; }
      UI.atkSel = {...(O19.atk || {})}; O19.atk = {}; log(`${nameOf(from)} declares ${nameOf(MYPID)}'s attackers`); declareAttackers(); }
    else if (cmd === 'next'){ nextAction(); }
    else if (cmd === 'end'){ endTurnFlow(); }
    commit();
  } catch (e){ console.warn('o19 slv do', e); } finally { O19.remote = false; }
}
// the controller's panel
function o19SlvPanel(){
  let el = document.getElementById('o19slv'); const v = UI.o19slv; const pn = S && phaseNow();
  const on = v && S && pn && pn.pid === v.pid && currentTurn()[1] === v.pid && OPP.has(v.pid);
  if (!on){ if (el) el.remove(); if (v && S && currentTurn()[1] !== v.pid && v.t !== turnStr()) UI.o19slv = null; return; }
  const st = OPP.get(v.pid); const cb = cbOf(pn);
  const hand = v.ids.map((id, i) => ({id, k:v.ks[i]})).filter(x => x.k && info(x.k));
  const crs = (st.bf || []).filter(c => c.k && !c.fd && !c.tp && isCreatureCard(c));
  const foes = players().filter(p => p.pid !== v.pid);
  const atkStep = pn.ph === 4 && cb && cb.step === 'atk';
  const html = `<b>🕹 You control ${esc(nameOf(v.pid))}'s turn (${esc(v.src || 'Mindslaver')})</b>
    <div style="margin:4px 0">Their hand: ${hand.length ? hand.map(x => `<button type="button" class="btn small" data-o19slv="cast:${x.id}">${isLand(x.k) ? 'Play' : 'Cast'} ${esc(info(x.k).n)}</button>`).join(' ') : '<span class="dim">empty</span>'}</div>
    ${atkStep ? `<div style="margin:4px 0">Attackers: ${crs.map(c => `<label style="margin-right:6px"><input type="checkbox" data-o19atk="${c.id}"> ${esc(info(c.k).n)}</label>`).join('') || '<span class="dim">none</span>'}
      <select data-o19def>${foes.map(p => `<option value="p:${esc(p.pid)}">${esc(p.me ? 'you' : p.nm)}</option>`).join('')}</select>
      <button type="button" class="btn small" data-o19slv="atkGo">Declare attackers</button></div>` : ''}
    <div><button type="button" class="btn small" data-o19slv="next">Next step / pass</button> <button type="button" class="btn small ghost" data-o19slv="end">To end of turn</button>
    <span class="dim">${esc(PH[pn.ph] || 'phase ' + pn.ph)}${cb ? ' · ' + esc(cb.step) : ''}</span></div>`;
  if (!el){ el = document.createElement('div'); el.id = 'o19slv'; el.style.cssText = 'position:fixed;right:10px;bottom:90px;z-index:8500;background:#1d2733;color:#eee;border:1px solid #6fb3d9;border-radius:8px;padding:8px 10px;font:13px system-ui,sans-serif;max-width:46vw;box-shadow:0 2px 12px #0009'; document.body.appendChild(el); }
  const key = html.replace(/\s+/g, ' '); if (el.dataset.k !== key){ const keep = [...el.querySelectorAll('[data-o19atk]')].filter(x => x.checked).map(x => x.dataset.o19atk); el.innerHTML = html; el.dataset.k = key; keep.forEach(id => { const x = el.querySelector(`[data-o19atk="${id}"]`); if (x) x.checked = true; }); }
}
function o19SlvSend(cmd){
  const v = UI.o19slv; if (!v) return;
  if (cmd === 'atkGo'){ const el = document.getElementById('o19slv'); const def = el && el.querySelector('[data-o19def]') ? el.querySelector('[data-o19def]').value : '';
    const ids = el ? [...el.querySelectorAll('[data-o19atk]')].filter(x => x.checked).map(x => x.dataset.o19atk) : [];
    ids.forEach(id => sendRq(v.pid, 'o19slv', 0, v.src || 'Mindslaver', {d:`atk1:${id}=${def}`})); }
  sendRq(v.pid, 'o19slv', 0, v.src || 'Mindslaver', {d:cmd}); commit();
}
if (typeof document !== 'undefined') document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-o19slv]'); if (!b) return; o19SlvSend(b.dataset.o19slv); });

// ---------------------------------------------------------------- 9. deck legality: banned lists
{
  const inf = infoFrom;
  infoFrom = function(c){ const a = inf(c); try { const lg = c && c.legalities; if (lg && typeof lg === 'object') a.lg = {cmd:String(lg.commander || ''), duel:String(lg.duel || '')}; } catch {} return a; };
  const tl = t25Legality;
  t25Legality = function(d, fmt){
    const items = tl(d, fmt);
    try { if (d && FMT[fmt] && FMT[fmt].cz){
      const ks = [...new Set([...(d.cmd || []), ...(d.main || []).map(e => e.k), ...(d.comp ? [d.comp] : [])])].filter(k => info(k));
      const nm = k => t25Name(k); const noData = ks.filter(k => !info(k).lg && !/\bBasic\b/.test(info(k).t || ''));
      const chk = (key, label, main) => {
        const banned = ks.filter(k => info(k).lg && info(k).lg[key] === 'banned');
        const notLegal = ks.filter(k => info(k).lg && info(k).lg[key] === 'not_legal');
        if (main){
          items.push({ok:!banned.length, text:banned.length ? `Banned in ${label}: ${banned.map(nm).join(', ')}` : `No cards banned in ${label}`, warn:false});
          if (notLegal.length) items.push({ok:false, text:`Not legal in ${label}: ${notLegal.slice(0, 10).map(nm).join(', ')}${notLegal.length > 10 ? ` and ${notLegal.length - 10} more` : ''}`, warn:false});
        } else if (banned.length) items.push({ok:true, warn:true, text:`Banned in ${label} (fine here): ${banned.map(nm).join(', ')}`});
      };
      chk(fmt === 'duel' ? 'duel' : 'cmd', fmt === 'duel' ? 'Duel Commander' : 'Commander', true);
      chk(fmt === 'duel' ? 'cmd' : 'duel', fmt === 'duel' ? 'multiplayer Commander' : 'Duel Commander', false);
      if (noData.length) items.push({ok:true, warn:true, text:`Banned list not checked for ${noData.length} card${noData.length === 1 ? '' : 's'} without banned-list data (loaded by an older version, or missing from the card data — load the deck list again to check): ${noData.slice(0, 6).map(nm).join(', ')}${noData.length > 6 ? '…' : ''}`});
    } } catch (e){ console.warn('o19 legal', e); }
    return items;
  };
}

// ---------------------------------------------------------------- 10. players on different builds
O19.bid = (() => { try { const sc = [...document.scripts].map(x => x.textContent || '').sort((a, b) => b.length - a.length)[0] || ''; let h = 0x811c9dc5; for (let i = 0; i < sc.length; i += 1){ h ^= sc.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return PT_BUILD + '.' + h.toString(36); } catch { return String(PT_BUILD); } })();
// a peer is on an older file when it publishes no build id (this file always does) — or a different id
function o19PeerBuild(pid){ const s = OPP.get(pid); if (!s) return null; return {b:s.b || 0, id:s.o19bid || '', old:!s.o19bid || (s.b || 0) < PT_BUILD, diff:(s.o19bid || '') !== O19.bid}; }
function o19Mismatch(){ const out = []; for (const [pid, s] of OPP){ if (typeof j18Out === 'function' && j18Out(pid)) continue; const b = o19PeerBuild(pid); if (b && b.diff) out.push({pid, nm:s.nm || nameOf(pid), ...b}); } return out; }
// private payloads: never plain. A peer without a key that runs this file (it publishes a build id) is still generating it: wait.
function o19NoSeal(to){ if (!r18Ok() || R18.failed) return 'this browser cannot encrypt'; const s = OPP.get(to); if (!s || r18PeerPk(to)) return ''; return s.o19bid ? '' : 'they opened an older Proxy Table file'; }
function o19Refuse(to, why){
  const key = to + '|' + why; if (O19.refused.has(key)) return; O19.refused.add(key);
  const msg = `Private information for ${nameOf(to)} was not sent — ${why}. Everyone needs the same file (v${PT_BUILD}).`;
  toast(msg); log(`⚠ couldn't send private information to ${nameOf(to)} (different file)`); try { commit(); } catch {}
}
{
  r18Legacy = function(){ return false; };   // the plain-text fallback is gone
  const sa = r18SealAsync;
  r18SealAsync = async function(to, text){ const why = o19NoSeal(to); if (why){ o19Refuse(to, why); return null; } return sa(to, text); };
  const se = r18Seal;
  r18Seal = function(to, text){ const why = o19NoSeal(to); if (why){ o19Refuse(to, why); return null; } return se(to, text); };
  // a question whose payload can't be sealed for that player would wait for nothing
  const qa = q24Ask;
  q24Ask = async function(pid, q, src){ const why = !UI.dry && o19NoSeal(pid); if (why){ o19Refuse(pid, why); return null; } return qa(pid, q, src); };
}
{
  const ors = onRemoteState;
  onRemoteState = function(pid, s){ const r = ors(pid, s);
    try { if (S && !UI.dry && s){ const b = o19PeerBuild(pid); const key = pid + '|' + (s.o19bid || 'old');
        if (b && b.diff && !O19.warned.has(key)){ O19.warned.add(key); log(`⚠ ${s.nm || nameOf(pid)} is on a different Proxy Table file (${b.old ? `older${b.b ? ' v' + b.b : ''}` : 'build ' + (s.o19bid || '?')}; mine is build ${O19.bid}) — everyone should open the same file`); commit(); } } } catch (e){ console.warn('o19 build', e); }
    return r; };
  const rd = renderGame;
  renderGame = function(...a){ const r = rd.apply(this, a); try { o19Banner(); } catch {} try { o19SlvPanel(); } catch (e){ console.warn('o19 panel', e); } return r; };
}
function o19Banner(){
  if (typeof document === 'undefined') return; let el = document.getElementById('o19build');
  const mm = S && NET && NET.code ? o19Mismatch() : [];
  if (!mm.length){ if (el) el.remove(); return; }
  if (!el){ el = document.createElement('div'); el.id = 'o19build'; el.setAttribute('role', 'alert');
    el.style.cssText = 'position:fixed;left:50%;top:6px;transform:translateX(-50%);z-index:9000;background:#5a1d1d;color:#fff;border:1px solid #e06666;border-radius:8px;padding:6px 12px;font:13px system-ui,sans-serif;max-width:80vw;box-shadow:0 2px 10px #0008'; document.body.appendChild(el); }
  const txt = `⚠ Different Proxy Table files at this table: ${mm.map(x => `${x.nm} (${x.old ? 'older file' + (x.b ? ' v' + x.b : '') : 'other build'})`).join(', ')}. Private information isn't sent to older files and some effects may not work — everyone should open the same file (v${PT_BUILD}, build ${O19.bid}).`;
  if (el.textContent !== txt) el.textContent = txt;
}

// ---------------------------------------------------------------- 11. engine life changes aren't by-hand corrections
// fix18b takes a 2-player loss back when the life total rises by something other than gainLife / a 'life' request. Only the
// life buttons (setLife) are by hand: every other rise moves the baseline before fix18b looks at it.
{
  const sl = setLife;
  setLife = function(d){ O19.hand = (O19.hand || 0) + (+d || 0); return sl(d); };
  const sb = sba;
  sba = function(...a){
    try { if (S && S.j18out && !S.j18left && S.j18life != null && !UI.dry){ const hand = Math.max(0, O19.hand || 0); if (S.life > S.j18life + hand) S.j18life = S.life - hand; } } catch {}
    O19.hand = 0;
    return sb.apply(this, a);
  };
}

// ---------------------------------------------------------------- sentence hook
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){
    const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase();
    try { if (l && (await o19Pre1(s, l, ctx) || await o19Pre3(s, l, ctx) || await o19Pre4(s, l, ctx) || await o19Pre5(s, l, ctx))) return; } catch (e){ console.warn('o19', e); }
    return ds(s0, ctx);
  };
}
