// FUZZER — random legal play by bots on every client of a real multiplayer table, with invariant checks.
// Usage:  cd test && PTPORT=18970 SEED=17 node fuzz.js          (one game)
//         PTPORT=18970 SEEDS=1-20 node fuzz.js                    (a batch)
// Env: PLAYERS=2..5 (default: from seed, mostly 4) · TURNS=20 · GAME_S=420 (wall clock per game) · PTFILE=proxy-table.html
//      OUTDIR=/tmp/fz (one JSON per game) · HEADFUL=1
// A seed fixes the decks (real decks + random Commander decks from all.json) and each bot's RNG. Network timing still
// varies between runs, so a seed reproduces the same decks and the same bot preferences, not always the same game.
process.env.ALL = '1';
const H = require('./h'); const fs = require('fs'); const path = require('path');
const clean = t => t.split('\n').map(l => l.replace(/\s*\([A-Z0-9]{2,6}\)\s*[\w★-]*\s*(\*F\*)?\s*$/, '')).join('\n');
const REAL = ['gaa', 'elminster', 'edgar', 'bluefarm'];
const realDeck = n => clean(fs.readFileSync(path.join(__dirname, '../decks/' + n + '.txt'), 'utf8'));
const OUTDIR = process.env.OUTDIR || '/tmp/fz'; fs.mkdirSync(OUTDIR, {recursive:true});
const TURNS = +(process.env.TURNS || 20), GAME_S = +(process.env.GAME_S || 420);

function rng(seed){ let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
function shuffle(r, a){ a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------- random Commander decks from the 7,000 most-played cards ----------
const POOL = H.cards.filter(c => c.set === 'top' && !/Token|Basic|Scheme|Plane\b|Vanguard|Dungeon|Emblem|Conspiracy|Attraction|Sticker|Contraption/.test(c.type_line || ''));
const BASICS = {W:'Plains', U:'Island', B:'Swamp', R:'Mountain', G:'Forest'};
const CMDRS = POOL.filter(c => /^Legendary (Snow )?Creature/.test(c.type_line) && !/\/\//.test(c.type_line) && (c.color_identity || []).length);
function randomDeck(r){
  const cmd = pick(r, CMDRS); const ci = cmd.color_identity;
  const ok = c => c.name !== cmd.name && (c.color_identity || []).every(x => ci.includes(x));
  const lands = shuffle(r, POOL.filter(c => ok(c) && /\bLand\b/.test(c.type_line) && !/Creature/.test(c.type_line))).slice(0, 6);
  const spells = shuffle(r, POOL.filter(c => ok(c) && !/\bLand\b/.test(c.type_line))).slice(0, 99 - 37 - lands.length + 0);
  const nb = 99 - lands.length - spells.length; const per = {}; ci.forEach((x, i) => { per[x] = Math.floor(nb / ci.length) + (i < nb % ci.length ? 1 : 0); });
  const txt = 'Commander\n1 ' + cmd.name + '\n\nDeck\n' + [...lands, ...spells].map(c => '1 ' + c.name).join('\n') + '\n' + Object.entries(per).filter(([, n]) => n).map(([x, n]) => n + ' ' + BASICS[x]).join('\n') + '\n';
  return {name:'random:' + cmd.name, txt};
}

// ---------- the bot and the invariant checker, injected into every page ----------
function BOT(arg){
  if (window.__FZ) return;
  let a = arg.seed >>> 0; const R = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pk = arr => arr[Math.floor(R() * arr.length)];
  const FZ = window.__FZ = {acts:[], viol:[], vkeys:{}, modals:[], asks:[], byhand:[], botErr:[], phAct:{}, held:{}, landsT:{}, turnStart:{}, prevHand:new Set(), logRate:[], on:true, lastAct:''};
  const now = () => Date.now();
  // the rules the checker must know (v20c): CR 800.4a (a loser leaves) is multiplayer only — with two players a loss ends the game and
  // the table stays as it is; "can't lose the game" (Platinum Angel & co., engine26x r26CantLose) keeps a player at 0 life in the game.
  const multi = () => { try { return typeof j18Multi === 'function' ? j18Multi() : 1 + OPP.size >= 3; } catch { return true; } };
  const cantLose = () => { try { return typeof r26CantLose === 'function' ? r26CantLose() : ''; } catch { return ''; } };
  const tstr = () => { try { return turnStr(); } catch { return '?'; } };
  const logTail = (n = 15) => { try { return [...LOGS.values()].sort((x, y) => x.t - y.t).slice(-n).map(e => `${e.pid === MYPID ? S.nm : nameOf(e.pid)}: ${e.s}`); } catch { return []; } };
  const viol = (kind, key, msg, extra) => { const k = kind + '|' + key; FZ.vkeys[k] = (FZ.vkeys[k] || 0) + 1; if (FZ.vkeys[k] > 3) return; FZ.viol.push({kind, key, msg, t:now(), turn:tstr(), ph:phaseNow().ph, act:FZ.lastAct, acts:FZ.acts.slice(-8), log:logTail(), ...(extra || {})}); };
  FZ.viol0 = viol;
  // context for every warning / error / uncaught exception: what the table was doing at that moment
  FZ.cerr = {}; const rec = (kind, args) => { try { const e = args.find(x => x && x.stack); const msg = args.map(x => x && x.message ? x.message : String(x)).join(' ').slice(0, 200); const top = e ? (String(e.stack).split('\n')[1] || '').trim().replace(/:\d+:\d+\)?$/, '') : '';
      const key = kind + '|' + msg.replace(/\d+/g, '#').slice(0, 100) + '|' + top.slice(-60); const o = FZ.cerr[key]; if (o){ o.n++; return; }
      FZ.cerr[key] = {kind, msg, stack:e ? String(e.stack).split('\n').slice(0, 8).join('\n') : '', n:1, turn:tstr(), act:FZ.lastAct, acts:FZ.acts.slice(-6), log:logTail(12)}; } catch {} };
  { const ow = console.warn, oe = console.error; console.warn = function(...a){ rec('warn', a); return ow.apply(this, a); }; console.error = function(...a){ rec('error', a); return oe.apply(this, a); };
    window.addEventListener('error', e => rec('uncaught', [e.error || e.message])); window.addEventListener('unhandledrejection', e => rec('rejection', [e.reason])); }
  FZ.toasts = []; { const t0 = toast; toast = function(m, ...a){ try { FZ.toasts.push(`[${tstr()}] ${String(m).slice(0, 140)}`); if (FZ.toasts.length > 12) FZ.toasts.shift(); } catch {} return t0.call(this, m, ...a); }; }
  const act = s => { FZ.nActs = (FZ.nActs || 0) + 1; FZ.lastAct = s; FZ.acts.push(`[${tstr()} ph${phaseNow().ph}] ${s}`); if (FZ.acts.length > 40) FZ.acts.shift(); };
  const click = el => { if (!el || el.disabled) return false; el.click(); return true; };
  const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
  // the hand-made notes and "how many?" questions the owner doesn't want
  const nl = () => { (UI.notes || []).forEach(n => { if (!n.__fz){ n.__fz = 1; FZ.byhand.push({name:n.name || '', text:String(n.text || '').slice(0, 200), turn:tstr(), act:FZ.lastAct, acts:FZ.acts.slice(-5)}); } }); };

  /* ---------- answering modals ---------- */
  const MANUAL = new Set(['mv', 'reveal', 'tap', 'stack', 'flip', 'fd', 'pumpD', 'pumpSet', 'ctr', 'mkTok', 'tokQty', 'copy', 'castFree', 'putBf', 'playFd', 'loreD', 'presetTok', 'tok1', 'openTokens']);
  function answerModal(){
    const m = UI.modal; if (!m) return false;
    if (!m.__fz){ m.__fz = now(); FZ.modals.push({type:m.type, title:String(m.title || '').slice(0, 120), turn:tstr()}); if (FZ.modals.length > 400) FZ.modals.shift();
      if (m.type === 'ask') FZ.asks.push({title:String(m.title || '').slice(0, 120), hint:String(m.hint || '').slice(0, 80), turn:tstr(), act:FZ.lastAct, log:logTail(6)}); }
    if (now() - m.__fz > 20000 && !m.__fzStuck){ m.__fzStuck = 1; viol('stuck', 'modal:' + m.type + ':' + String(m.title || '').replace(/\d+/g, '#').slice(0, 60), `modal open >20 s that the bot could not answer: ${m.type} "${m.title || ''}"`, {modal:{type:m.type, title:m.title, min:m.min, max:m.max, n:(m.cards || m.cands || []).length}}); }
    if (now() - m.__fz < 150) return true;                         // let it render
    const t = m.type;
    if (t === 'choice'){ const bs = qa('#modal [data-act="choose"]:not([disabled])'); if (!bs.length){ act('choice with no enabled option: ' + m.title); closeModal(); return true; }
      const b = pk(bs); act(`choose "${String(m.title || '').slice(0, 60)}"${/looks like a loop/.test(m.title || '') ? ' [' + String(m.text || '').slice(0, 300) + ']' : ''} → ${b.innerText.split('\n')[0].slice(0, 50)}`); click(b); return true; }
    if (t === 'pick'){
      const cards = m.cards || []; const max = Math.min(m.max ?? 1, cards.length), min = Math.min(m.min ?? 0, cards.length);
      const n = R() < 0.7 ? max : min + Math.floor(R() * (max - min + 1)); const ids = shuffleA(cards.map(c => c.id)).slice(0, n);
      m.sel = ids; renderModal(); const d = q('#modal [data-act="pickDone"]');
      act(`pick "${String(m.title || '').slice(0, 60)}" ${n}/${cards.length} (min ${m.min} max ${m.max})`);
      if (d && !d.disabled){ click(d); return true; }
      const none = q('#modal [data-act="pickNone"]'); if (none){ click(none); return true; }
      if (now() - m.__fz > 3000){ viol('stuck', 'pick-unanswerable:' + String(m.title || '').replace(/\d+/g, '#').slice(0, 60), `pick modal can't be completed: min ${m.min}, max ${m.max}, ${cards.length} cards`, {}); closeModal(); }
      return true;
    }
    if (t === 'target'){
      const ok = (m.cands || []).map((c, i) => [c, i]).filter(([c]) => c.ok).map(([, i]) => i); const sp = m.spec || {n:1};
      const need = sp.upTo ? Math.floor(R() * (Math.min(sp.n, ok.length) + 1)) : Math.min(sp.n, ok.length);
      m.sel = shuffleA(ok).slice(0, need); renderModal(); act(`target "${String(m.title || '').slice(0, 50)}" → ${m.sel.map(i => m.cands[i].nm).join(', ') || 'none'}`);
      const d = q('#modal [data-act="tgtDone"]'); if (d && !d.disabled){ click(d); return true; }
      if (now() - m.__fz > 3000){ viol('stuck', 'target-unanswerable:' + String(m.title || '').slice(0, 50), `target modal Done stays disabled (${ok.length} legal of ${(m.cands || []).length}, need ${sp.n}${sp.upTo ? ' up to' : ''})`); closeModal(); }
      return true;
    }
    if (t === 'ask'){ const i = q('#askIn'); const f = q('#modal form[data-form="ask"]'); if (!i || !f) return true; const def = +m.def || 0; const v = R() < 0.6 ? def : Math.floor(R() * (Math.max(def, 3) + 1)); i.value = String(v); act(`number "${String(m.title).slice(0, 60)}" → ${v}`); f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', {cancelable:true, bubbles:true})); return true; }
    if (t === 'split'){ const g = q('#modal [data-act="splitGo"]'); act('split damage: default'); if (!click(g)) { viol('stuck', 'split', 'split-damage Done disabled with default plan'); } return true; }
    if (t === 'pw'){ const bs = qa('#modal [data-act="pwGo"]:not([disabled])'); if (bs.length && R() < 0.85){ const b = pk(bs); act('loyalty: ' + b.innerText.split('\n')[0].slice(0, 60)); click(b); setTimeout(() => { if (UI.modal === m) closeModal(); }, 300); } else { act('close loyalty'); closeModal(); } return true; }
    if (t === 'prolif'){ act('proliferate'); click(q('#modal [data-act="prolifGo"]')); return true; }
    if (t === 'bottom'){ const need = Math.min(m.need, S.hand.length); m.sel = S.hand.slice(0, need).map(c => c.id); renderModal(); click(q('#modal [data-act="doBottom"]')); return true; }
    // zone views opened by the engine, deck/opp views, stops etc.: just close
    act(`close modal ${t} "${String(m.title || '').slice(0, 50)}"`); closeModal(); return true;
  }
  const shuffleA = arr => { arr = arr.slice(); for (let i = arr.length - 1; i > 0; i--){ const j = Math.floor(R() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

  /* ---------- doing things ---------- */
  function menuButtons(c){
    try { cardMenu(c.id, 300, 200); } catch (e){ FZ.botErr.push('cardMenu ' + e.message); return []; }
    const bs = qa('#menu button[data-act]:not([disabled])').filter(b => !MANUAL.has(b.dataset.act) && !(b.dataset.act === 'playLand' && b.dataset.force) && b.dataset.act !== 'manaAb' && b.dataset.act !== 'manaGo');
    return bs;
  }
  function candidates(sorc){
    const out = [];
    for (const c of S.hand){ try { const r = castCheck(c, 'hand'); if (r.ok) out.push([c, isLand(c.k) ? 3 : 1]); } catch (e){ FZ.botErr.push('castCheck ' + e.message); } }
    for (const c of S.cz){ try { if (castCheck(c, 'cz').ok) out.push([c, 2]); } catch {} }
    for (const c of S.bf){ if (c.fd) continue; try {
      if (typeof isPW === 'function' && isPW(c) && sorc) out.push([c, 1.5]);
      else if (abilityList(c).some(ab => !abilityReady(c, ab, false))) out.push([c, 0.5]);
    } catch (e){ FZ.botErr.push('ability ' + e.message); } }
    for (const c of S.gy){ try { if (typeof gyOptions === 'function' && (gyOptions(c) || []).length) out.push([c, 0.7, 'gy']); } catch {} }
    return out;
  }
  function wpick(list){ const tot = list.reduce((s, x) => s + x[1], 0); let r = R() * tot; for (const x of list){ r -= x[1]; if (r <= 0) return x; } return list[list.length - 1]; }
  function doSomething(sorc){
    const cands = candidates(sorc); if (!cands.length) return false;
    const [c, , where] = wpick(cands);
    if (where === 'gy'){
      openModal({type:'zone', zone:'gy'}); const bs = qa('#modal [data-act="gyCast"]').filter(b => +b.dataset.id === c.id && !b.disabled);
      if (!bs.length){ closeModal(); return false; } const b = pk(bs); act(`from graveyard: ${cname(c)} — ${b.innerText.slice(0, 50)}`); click(b); return true;
    }
    const bs = menuButtons(c); if (!bs.length){ closeMenu(); return false; }
    const b = pk(bs); act(`${cname(c)} [${find(c.id)[0]}] → ${b.dataset.act}: ${b.innerText.replace(/\s+/g, ' ').slice(0, 70)}`);
    snapshotForCheck(); click(b); return true;
  }

  /* ---------- combat ---------- */
  function attack(){
    const opts = defOpts();
    // only a player who has really lost (their published flag) is wrong here: life 0 or less under "can't lose the game" is still in the game
    if (multi()) opts.forEach(o => { const st = OPP.get(o.pid); if (st && (st.b27lost || st.c27lost)) viol('rules', 'attack-lost-player', `${st.nm} (life ${st.life}, has lost) is offered as an attack target`); });
    if (!opts.length){ click(q('#cbpanel [data-act="atkGo"]')) || declareAttackers(); return; }
    const can = S.bf.filter(c => isCreatureCard(c) && !c.fd && !canAttack(c));
    click(q('#cbpanel [data-act="atkNone"]')) || (UI.atkSel = {});      // start from a clean selection (a refused declaration keeps the old one)
    FZ.atkTries = (FZ.atkTries || 0) + 1; const tries = FZ.atkTries;
    const chosen = [];
    for (const c of can){ if ((tries < 4 && R() < 0.65) || mustAttack(c)){ const d = pk(opts); const chip = q(`#cbpanel [data-act="atkSet"][data-id="${c.id}"][data-d="${CSS.escape(d.key)}"]`); if (chip) click(chip); else UI.atkSel[c.id] = d.key; chosen.push(c); } }
    // independent sanity of what is about to attack
    const pn = phaseNow(); const ts = FZ.turnStart[tstr()] || new Set();
    for (const c of chosen){
      if (c.tap) viol('rules', 'attack-tapped:' + cname(c), `${cname(c)} offered as attacker while tapped`);
      const hasteTxt = /haste/i.test(textOf(c)) || (c.ekw || []).includes('haste') || S.bf.some(b => /haste/i.test(textOf(b))) || [...OPP.values()].some(o => (o.bf || []).some(b => b.k && /haste/i.test(info(b.k)?.o || '')));
      if (!ts.has(c.id) && !(c.tok && ts.has('k:' + c.k) && !c.sk) && !c.r21bh && !hasteTxt && !c.own && !/haste/i.test(JSON.stringify(c))) viol('rules', 'attack-sick:' + cname(c), `${cname(c)} (entered this turn, no haste source anywhere) allowed to attack`, {card:{id:c.id, sk:c.sk}});
    }
    act(`attack with ${chosen.map(c => cname(c) + '→' + defLabel(UI.atkSel[c.id])).join(', ') || 'nothing'}`);
    if (!click(q('#cbpanel [data-act="atkGo"]'))) declareAttackers();
  }
  function block(pn){
    const atts = attackersOnMe(pn); const mine = S.bf.filter(c => isCreatureCard(c) && !c.fd && !c.tap);
    UI.blkSel = {}; const done = [];
    for (const b of mine){ if (R() < 0.45){ const ok = atts.filter(a => !canBlock(b, a, pn.pid)); if (!ok.length) continue; const a = pk(ok); UI.blkSel[b.id] = a.id; done.push(`${cname(b)}→${info(a.k)?.n}`); } }
    renderCombatPanel(); act('block: ' + (done.join(', ') || 'none'));
    const key = cbKey(pn, cbOf(pn)); click(q('#cbpanel [data-act="blkGo"]')) || confirmBlocks(false);
    if ((S.bd || '') !== key){ UI.blkSel = {}; confirmBlocks(false); act('block: retry with none (menace?)'); }
  }

  /* ---------- the main loop ---------- */
  let busy = false;
  async function tick(){
    if (busy || !FZ.on || !S) return; busy = true;
    try { await step(); } catch (e){ FZ.botErr.push(String(e && e.stack || e).slice(0, 300)); }
    finally { busy = false; }
    try { checkLocal(); } catch (e){ FZ.botErr.push('check ' + String(e && e.stack || e).slice(0, 300)); }
  }
  async function step(){
    nl();
    const pn = phaseNow(); if (pn.n === 0) return;
    if (UI.modal){ answerModal(); return; }
    { const slv = document.getElementById('o19slv'); const b = slv && (slv.querySelector('[data-o19slv="next"]') || slv.querySelector('[data-o19slv="end"]')); if (b && Math.random() < 0.5){ act('mindslaver: move their turn on'); b.click(); return; } }   // controlling another player's turn
    if (UI.casting || UI.resolving) return;
    // things other players asked me (sacrifice / discard / pay-or-countered)
    const pb = qa('#stackpanel .warnbox button:not([disabled])'); if (pb.length && S.prm.length){ const b = pk(pb); act('prompt: ' + b.innerText.slice(0, 50)); click(b); return; }
    if (S.lost){ if (pn.mine && !FZ['lt' + tstr()]){ FZ['lt' + tstr()] = 1; if (FZ.lostAt && FZ.lostAt !== tstr() && multi()) viol('rules', 'lost-player-gets-turn', `player who lost (${S.lost}) is given a turn`); }
      if (!FZ.lostAt) FZ.lostAt = tstr();
      heldFor('lostbf', multi() && (S.bf.some(c => !c.tok) || S.stk.length), 15000, () => viol('rules', 'lost-player-objects-stay', `player who lost (${S.lost}) still has ${S.bf.length} permanents (CR 800.4a: they should leave the game)`));
      if (myBox()) doPass(); if (pn.mine && !stackAll().length){ if (pn.ph < 6) endTurnFlow(); else nextAction(); } return; }
    const ts = tstr();
    if (pn.mine && !FZ.turnStart[ts] && S.untapN >= pn.n){ FZ.turnStart[ts] = new Set([...S.bf.map(c => c.id), ...S.bf.filter(c => c.tok && (c.n || 1) > 1).map(c => 'k:' + c.k)]); FZ.landsT[ts] = 0; }   // tokens split off a stack that was here get a new id
    const cb = pn.ph === 4 ? cbOf(pn) : null;
    if (pn.mine && cb && cb.step === 'atk'){ attack(); return; } FZ.atkTries = 0;
    if (!pn.mine && cb && cb.step === 'blk' && attackersOnMe(pn).length && (S.bd || '') !== cbKey(pn, cb)){ block(pn); return; }
    const box = myBox();
    if (box){
      if (R() < 0.2 && doSomething(false)) return;
      act('pass priority'); if (!click(q('#stackpanel [data-act="passPrio"]'))) doPass(); return;
    }
    if (!pn.mine) return;
    if (S.untapN < pn.n){ act('start turn'); click(q('#phasebar [data-act="startTurn"]')) || startMyTurn(); return; }
    if (stackAll().length) return;
    const pk2 = ts + '.' + pn.ph + '.' + (S.cb && S.cb.n || 0);
    if ((pn.ph === 3 || pn.ph === 5) && (FZ.phAct[pk2] || 0) < (pn.ph === 3 ? 10 : 5) && R() < 0.9){
      FZ.phAct[pk2] = (FZ.phAct[pk2] || 0) + 1;
      if (doSomething(true)) return;
      FZ.phAct[pk2] = 99;
    }
    const nb = q('#phasebar [data-act="next"]');
    if (nb && !nb.disabled){ act('next: ' + nb.innerText.trim()); click(nb); return; }
  }
  FZ.timer = setInterval(tick, 140);

  /* ---------- local invariants ---------- */
  const isCardObj = o => o && typeof o === 'object' && Number.isFinite(o.id) && typeof o.k === 'string';
  let snap = null; function snapshotForCheck(){ snap = {hand:new Set(S.hand.map(c => c.id))}; }
  FZ.held = {};
  function heldFor(key, cond, ms, fn){ if (!cond){ delete FZ.held[key]; return; } FZ.held[key] = FZ.held[key] || now(); if (now() - FZ.held[key] > ms && FZ.held[key] !== -1){ FZ.held[key] = -1; fn(); } }
  function where(){
    const loc = new Map(); const dup = [];
    const add = (c, z) => { if (!isCardObj(c)) return; const p = loc.get(c.id); if (p && p.obj !== c) dup.push([c.id, cname(c), p.z, z, 'diff-object']); else if (p && p.z !== z) dup.push([c.id, cname(c), p.z, z, 'same-object']); if (!p) loc.set(c.id, {z, obj:c}); };
    ZONES.forEach(z => S[z].forEach(c => add(c, z)));
    (S.zpoz || []).forEach(x => x && add(x.c, 'poz'));   // phased out until a source leaves (engine26z)
    (S.poz || []).forEach(c => add(c, 'poz'));   // phased out (CR 702.26): treated as though they don't exist, but still the player's cards
    (S.stk || []).forEach(it => { if (it.card && !S.stk.some(o => o !== it && o.card === it.card)) { if (!ZONES.some(z => S[z].includes(it.card))) add(it.card, 'stack'); } });
    return {loc, dup};
  }
  function deepScan(){ // every card-shaped object reachable from S outside the normal zones (hidden zones / set-aside cards)
    const seen = new Set(), found = new Map(); const skip = new Set(['log', 'deck', 'ev', 'rq', 'ctr', 'evSeen', 'seenP', 'done', 'recent', 'poz', 'zpoz', ...ZONES]);
    const walk = (o, path, d) => { if (!o || typeof o !== 'object' || seen.has(o) || d > 5) return; seen.add(o); if (isCardObj(o) && d > 0 && typeof o.t !== 'string' && !o.type){ if (!found.has(o.id)) found.set(o.id, {path, obj:o}); }
      if (Array.isArray(o)) o.forEach((x, i) => walk(x, path + '[' + i + ']', d + 1)); else for (const k of Object.keys(o)) { if (d === 0 && skip.has(k)) continue; walk(o[k], path + '.' + k, d + 1); } };
    walk(S, 'S', 0); return found;
  }
  FZ.conserve = () => {
    const exp = new Map(); S.deck.main.forEach(e => exp.set(e.k, (exp.get(e.k) || 0) + e.q)); S.deck.cmd.forEach(k => exp.set(k, (exp.get(k) || 0) + 1));
    const {loc, dup} = where(); const got = new Map(); const foreign = []; const tokOut = [];
    const COPY = o => !!(o.copy || o.g23copy || o.prepOf != null);
    for (const [id, {z, obj}] of loc){ if (COPY(obj)) continue; if (obj.tok){ if (z !== 'bf' && z !== 'stack' && z !== 'poz') tokOut.push([cname(obj), z]); continue; } if (obj.own){ foreign.push(obj.k); continue; } if (Array.isArray(obj.qMutObjs) && obj.qMutObjs.length){ obj.qMutObjs.forEach(m => { if (m && !m.tok){ const b = m.origK || m.k; got.set(b, (got.get(b) || 0) + 1); } }); continue; } const bk = obj.a27real || obj.origK || obj.c27ppOrig || obj.k; got.set(bk, (got.get(bk) || 0) + 1); }
    const lent = (S.lent || []).filter(l => l.card && !loc.has(l.card.id) || (l.card && loc.get(l.card.id)?.obj !== l.card));
    lent.forEach(l => { if (!l.card.tok){ const bk = l.card.origK || l.card.k; got.set(bk, (got.get(bk) || 0) + 1); } });
    const missing = [], extra = [];
    for (const [k, n] of exp){ const g = got.get(k) || 0; if (g < n) missing.push([k, n - g]); }
    const foreignK = []; for (const [k, n] of got){ const e = exp.get(k) || 0; if (!e){ for (let i = 0; i < n; i++) foreignK.push(k); continue; } if (n > e) extra.push([k, n - e]); }
    let hidden = []; if (missing.length){ const ds = deepScan(); for (const [k] of missing){ for (const [id, f] of ds){ if (f.obj.k === k && !loc.has(id)) hidden.push([info(k)?.n || k, f.path.replace(/\[\d+\]/g, '[]')]); } } }
    const det = k => { const o = []; for (const [id, {z, obj}] of loc) if ((obj.a27real || obj.origK || obj.k) === k) o.push({id, z, keys:Object.keys(obj).filter(x => obj[x] && !['k','id','x','y'].includes(x)).join(' ')}); (S.lent || []).forEach(l => { if (l.card && l.card.k === k) o.push({id:l.card.id, z:'lent→' + nameOf(l.to)}); }); return o; };
    return {det, missing:missing.map(([k, n]) => [info(k)?.n || k, n, k]), extra:extra.map(([k, n]) => [info(k)?.n || k, n, k]), dup, tokOut, hidden, lentOut:(S.lent || []).map(l => ({to:l.to, k:l.card && (l.card.origK || l.card.k)})), foreign, foreignK};
  };
  let lastLogs = 0, lastLogsT = now();
  function checkLocal(){
    if (!S || phaseNow().n === 0) return;
    const cons = FZ.conserve();
    cons.dup.forEach(d => viol('conservation', 'dup:' + d[1], `card #${d[0]} ${d[1]} is in two places: ${d[2]} and ${d[3]} (${d[4]})`));
    cons.tokOut.forEach(t => viol('conservation', 'token-out:' + t[0], `token ${t[0]} exists in ${t[1]}`));
    const mk = cons.missing.map(m => m[0]).join(',');
    if (S.j18out && !window.__lostNoted){ window.__lostNoted = 1; viol('info', 'lost', 'this player lost: ' + S.j18out); }
    heldFor('missing:' + mk, !(S.j18out && players().length + 1 >= 3) && cons.missing.length && !UI.casting && !UI.resolving && !stackAll().length, 4000, () => cons.missing.forEach(m => { const h = cons.hidden.filter(x => x[0] === m[0]); viol('conservation', (h.length ? 'hidden:' + h[0][1] + ':' : 'missing:') + m[0], h.length ? `${m[0]} is only in ${h[0][1]} (not in any zone)` : `${m[0]} ×${m[1]} vanished (not in any zone, the stack or lent out)`, {hidden:h, where:cons.det(m[2]), snap:{modal:UI.modal && (UI.modal.type + ':' + (UI.modal.title || '')), prm:S.prm.length, casting:UI.casting, resolving:UI.resolving, zones:ZONES.map(z => z + S[z].length).join(' '), lent:(S.lent || []).length, pile:!!S.pile}}); }));
    const xk = cons.extra.map(m => m[0]).join(',');
    heldFor('extra:' + xk, cons.extra.length, 4000, () => cons.extra.forEach(m => viol('conservation', 'extra:' + m[0], `${m[0]} ×${m[1]} more copies than the deck has (not a token, not borrowed)`, {where:cons.det(m[2])})));
    // numbers
    const bad = [];
    if (!Number.isInteger(S.life)) bad.push('life=' + S.life); if (!Number.isInteger(S.psn) || S.psn < 0) bad.push('poison=' + S.psn);
    MANA.forEach(m => { const v = S.pool[m]; if (!Number.isFinite(v) || v < 0) bad.push(`pool ${m}=${v}`); });
    Object.entries(S.cdt || {}).forEach(([k, v]) => { if (!Number.isFinite(v) || v < 0) bad.push('cdt=' + v); });
    for (const c of S.bf){ ['cp', 'cm', 'co', 'dmg', 'n', 'tn'].forEach(f => { const v = c[f]; if (v != null && (!Number.isFinite(v) || v < 0 || !Number.isInteger(v))) bad.push(`${cname(c)}.${f}=${v}`); });
      if (isCreatureCard(c) && !c.fd){ const st = stats(c); if (st && (!Number.isFinite(st[0]) || !Number.isFinite(st[1]))) bad.push(`${cname(c)} P/T ${st}`);
        if (!st) heldFor('nopt:' + c.id, true, 1500, () => viol('numbers', 'creature-without-PT:' + cname(c), `${cname(c)} counts as a creature (isCreatureCard) but stats() is null — printed type "${typeOf(c)}", P/T "${faceOf(c)?.p || ''}", flags ${Object.keys(c).filter(k => c[k] && !['k','id','x','y'].includes(k)).join(' ')}`)); } }
    bad.forEach(b => viol('numbers', b.replace(/=.*$|-?\d+/g, '#'), 'bad number: ' + b));
    // legend rule (a choice prompt may be open for a moment)
    const legs = new Map(); S.bf.forEach(c => { if (c.fd || !c.k || c.nonLeg || c.cpyCl === 2 || c.cpyPend) return; const f = faceOf(c); if (!f || !/Legendary/.test(f.t)) return; legs.set(f.n, (legs.get(f.n) || 0) + (c.n || 1)); });
    const nolr = (typeof r26NoLegend === 'function' && r26NoLegend().length > 0) || S.bf.some(c => /legend rule doesn't apply/i.test(textOf(c))) || [...OPP.values()].some(o => (o.bf || []).some(b => b.k && /legend rule doesn't apply/i.test(info(b.k)?.o || '')));
    for (const [n, k] of legs) heldFor('legend:' + n, k > 1 && !nolr && !UI.modal, 4000, () => viol('rules', 'legend:' + n, `legend rule: ${k} × ${n} on my battlefield for >4 s`));
    // 0 toughness
    for (const c of S.bf){ if (c.fd || !isCreatureCard(c) || c.cpyCl === 2) continue; const st = stats(c); heldFor('t0:' + c.id, st && st[1] <= 0, 3000, () => viol('rules', 'toughness0:' + cname(c), `${cname(c)} stays on the battlefield with toughness ${st[1]}`)); }
    // losing
    const lose = S.life <= 0 ? 'life ' + S.life : S.psn >= 10 ? 'poison ' + S.psn : Object.values(S.cdt || {}).some(v => v >= 21) ? '21 commander damage' : '';
    const shield = lose ? cantLose() : '';
    heldFor('lose', lose && !S.lost && !shield, 3000, () => viol('rules', 'no-loss:' + lose.replace(/-?\d+/, '#'), `player at ${lose} has not lost`));
    if (S.lost && !lose && !FZ.wasLost){ FZ.wasLost = 1; } if (FZ.wasLost && !S.lost && !FZ.unlost){ FZ.unlost = 1; viol('rules', 'un-lose', `player who had lost is back in the game (life ${S.life})`); }
    if (S.lost) FZ.wasLost = 1;
    // land drops (hand → battlefield lands on my turn, counted by the bot's own observation)
    const pn = phaseNow(); const ts = tstr();
    if (pn.mine && FZ.landsT[ts] != null){ const bfIds = new Set(S.bf.map(c => c.id)); for (const id of FZ.prevHand){ if (bfIds.has(id)){ const c = S.bf.find(x => x.id === id); if (c && isLand(c.k) && /playLand/.test(FZ.lastAct)) FZ.landsT[ts]++;   /* only real land plays count; effects like Arboreal Grazer put lands too (v21) */ } }
      const extraOk = rulesOn('extraLand').length || /land/i.test(FZ.lastAct.replace(/playLand/, '')) ;
      if (FZ.landsT[ts] > 1 + ((S.xland && S.xland.t === turnStr()) ? S.xland.n : 0) && !rulesOn('extraLand').length && !FZ['lw' + ts]){ FZ['lw' + ts] = 1; viol('rules', 'lands', `${FZ.landsT[ts]} lands went from hand to battlefield this turn with no extra-land effect (last action: ${FZ.lastAct})`); } }
    FZ.prevHand = new Set(S.hand.map(c => c.id));
    // log spam (infinite trigger loops)
    const L = LOGS.size; if (now() - lastLogsT > 3000){ const rate = (L - lastLogs) / ((now() - lastLogsT) / 1000); if (rate > 25) viol('stuck', 'logspam', `log grows ${rate.toFixed(0)} lines/s (loop?)`); lastLogs = L; lastLogsT = now(); }
    // stack top unchanged for a long time
    const top = stackTop(); const tk = top ? top.sid : ''; if (tk !== FZ.topK){ FZ.topK = tk; FZ.topT = now(); }
    else if (tk && now() - FZ.topT > 40000 && !FZ['st' + tk]){ FZ['st' + tk] = 1; viol('stuck', 'stack:' + top.nm, `stack top ${top.nm} (${top.pid === MYPID ? 'mine' : nameOf(top.pid)}) unresolved for 40 s; waiting on ${waitingOn(prioKey()).map(p => p.nm).join(', ')}`, {modal:UI.modal && UI.modal.type, resolving:UI.resolving, casting:UI.casting}); }
  }
  // self-summary for the cross-client sync check
  FZ.pub = () => ({cons:(() => { const c = FZ.conserve(); return {foreignK:c.foreignK, lentOut:c.lentOut}; })(), pid:MYPID, nm:S.nm, life:S.life, psn:S.psn, hc:S.hand.length, lc:S.lib.length, bf:S.bf.map(c => c.id).sort((x, y) => x - y).join(','), gy:S.gy.map(c => c.k).join(','), turn:currentTurn()[0], lost:S.lost || ''});
  FZ.view = () => [...OPP.entries()].map(([pid, o]) => ({pid, nm:o.nm, life:o.life, psn:o.psn, hc:o.hc, lc:o.lc, bf:(o.bf || []).map(c => c.id).sort((x, y) => x - y).join(','), gy:(o.gy || []).join(',')}));
}

// ---------- Scryfall token search mock (h.js only knows Goblin): build a Scryfall-shaped token from the query ----------
const PRE = {Treasure:['Artifact — Treasure', '{T}, Sacrifice this artifact: Add one mana of any color.'], Food:['Artifact — Food', '{2}, {T}, Sacrifice this artifact: You gain 3 life.'],
  Clue:['Artifact — Clue', '{2}, Sacrifice this artifact: Draw a card.'], Blood:['Artifact — Blood', '{1}, {T}, Discard a card, Sacrifice this artifact: Draw a card.'],
  Map:['Artifact — Map', '{1}, {T}, Sacrifice this artifact: Target creature you control explores. Activate only as a sorcery.'], Gold:['Artifact — Gold', 'Sacrifice this artifact: Add one mana of any color.'],
  Powerstone:['Artifact — Powerstone', "{T}: Add {C}. This mana can't be spent to cast a nonartifact spell."], Junk:['Artifact — Junk', '{T}, Sacrifice this artifact: Exile the top card of your library. You may play that card this turn. Activate only as a sorcery.'],
  Shard:['Enchantment — Shard', '{2}, Sacrifice this enchantment: Scry 1, then draw a card.'], Incubator:['Artifact — Incubator', '{2}: Transform this artifact.']};
async function tokenSearch(route){
  const u = decodeURIComponent(route.request().url()); const q = (u.match(/[?&]q=([^&]*)/) || [])[1] || '';
  const nm = (q.match(/!"([^"]+)"/) || [])[1]; if (!nm) return route.fulfill({status:404, contentType:'application/json', body:'{"object":"error"}'});
  const pw = (q.match(/pow=(\d+)/) || [])[1], tu = (q.match(/tou=(\d+)/) || [])[1]; const col = ((q.match(/c=([wubrg]+)/) || [])[1] || '').toUpperCase().split('').filter(Boolean);
  const kw = (q.match(/o:(\w+)/) || [])[1];
  const pre = PRE[nm]; const id = 'fztok-' + nm.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + (pw || '') + '-' + (tu || '') + '-' + col.join('');
  const card = {object:'card', id, name:nm, mana_cost:'', cmc:0, type_line:pre ? 'Token ' + pre[0] : 'Token Creature — ' + nm, oracle_text:pre ? pre[1] : (kw ? kw[0].toUpperCase() + kw.slice(1) : ''), colors:col, color_identity:col, keywords:[], layout:'token', set:'tfz', collector_number:'1', set_name:'Tokens', released_at:'2024-01-01', prices:{}, image_uris:{normal:''}, power:pre ? undefined : (pw || '1'), toughness:pre ? undefined : (tu || '1')};
  if (!pre && !pw) return route.fulfill({status:200, contentType:'application/json', body:JSON.stringify({object:'list', data:[]})});
  return route.fulfill({status:200, contentType:'application/json', body:JSON.stringify({object:'list', data:[card]})});
}

// ---------- one game ----------
async function game(seed, browser){
  const r = rng(seed * 7919 + 1);
  const np = +(process.env.PLAYERS || (r() < 0.15 ? 2 : r() < 0.2 ? 5 : 4));
  const realOrder = shuffle(r, REAL); const seats = [];
  for (let i = 0; i < np; i++){ if (i < realOrder.length && r() < 0.55) seats.push({name:realOrder[i], txt:realDeck(realOrder[i])}); else seats.push(randomDeck(r)); }
  const names = ['Ana', 'Ben', 'Cy', 'Dee', 'Eli'].slice(0, np);
  const code = 'fz' + seed + '-' + Date.now() % 100000;
  const res = {seed, np, decks:seats.map(s => s.name), errors:[], viol:[], asks:[], byhand:[], botErr:[], modalsN:0, turns:0, status:'', t0:Date.now(), stuck:[], desync:[], deckProblems:[]};
  console.log(`\n=== seed ${seed}: ${np} players — ${res.decks.join(' | ')}`);
  const pages = []; const ctxs = [];
  const errKey = new Map();
  const addErr = (who, kind, msg, stack) => { const top = (stack || '').split('\n').find(l => /at /.test(l)) || ''; const key = kind + '|' + String(msg).replace(/\d+/g, '#').slice(0, 120) + '|' + top.replace(/:\d+:\d+/g, '').trim().slice(0, 80);
    const e = errKey.get(key); if (e){ e.n++; return; } const o = {key, who, kind, msg:String(msg).slice(0, 300), stack:String(stack || '').split('\n').slice(0, 6).join('\n'), n:1, t:Date.now()}; errKey.set(key, o); res.errors.push(o); };
  try {
    for (let i = 0; i < np; i++){
      const ctx = await browser.newContext({viewport:{width:1500, height:950}}); ctxs.push(ctx);
      await ctx.addInitScript((port) => { window.PT_BROKERS = ['ws://localhost:' + port]; window.PT_RESP_MS = 1200; try { localStorage.clear(); } catch {} }, H.PORT);
      const p = await ctx.newPage(); const nm = names[i];
      p.on('pageerror', e => addErr(nm, 'pageerror', e.message, e.stack));
      p.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning'){ const tx = m.text(); if (/Failed to load resource|net::ERR|favicon|WebSocket connection/i.test(tx)) return; const loc = m.location(); addErr(nm, 'console.' + t, tx, (m.args().length ? '' : '') + (loc ? `at ${loc.url.split('/').pop()}:${loc.lineNumber}` : '')); } });
      await H.route(p); if (!process.env.NOTOKMOCK) await p.route('**/api.scryfall.com/cards/search**', tokenSearch); await p.goto(H.FILE);
      await p.fill('#deckIn', seats[i].txt); await p.click('#loadBtn');
      await p.waitForFunction(() => { const t = document.querySelector('#deckStatus').textContent; return /Deck ready/.test(t) || (t && !/Looking up|Loading|…/.test(t)); }, null, {timeout:60000});
      const ds = await p.evaluate(() => document.querySelector('#deckStatus').textContent);
      if (!/Deck ready/.test(ds) || /not found/.test(ds)) res.deckProblems.push(seats[i].name + ': ' + ds.slice(0, 200));
      await p.fill('#nameIn', nm); await p.fill('#codeIn', code);
      await p.click(i === 0 ? '#hostBtn' : '#joinBtn'); await p.waitForSelector('#game:not([hidden])', {timeout:20000});
      pages.push(p);
    }
    const all = () => pages;
    const seen = await Promise.all(pages.map(p => H.waitFor(p, n => OPP.size === n, np - 1, 20000)));
    if (!seen.every(Boolean)){ res.status = 'players never saw each other'; return res; }
    // BOOST (default 3): each player starts with that many basic lands from their library already on the battlefield, so games get to the interesting part sooner
    const boost = +(process.env.BOOST ?? 3); res.boost = boost;
    if (boost) for (const p of pages) await p.evaluate(n => { let k = 0; for (const c of S.lib.slice()){ if (k >= n) break; if (/Basic Land/.test(info(c.k)?.t || '')){ moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); if (b){ b.tap = false; b.sk = false; } k++; } } commit(); }, boost);
    await H.sleep(500);
    await pages[0].click('[data-act="goFirst"]');
    for (let i = 0; i < np; i++) await pages[i].evaluate(BOT, {seed:seed * 31 + i});
    const T0 = Date.now(); let lastTurn = 0, lastTurnT = Date.now(); const mis = new Map();
    while (true){
      await H.sleep(2000);
      const pubs = await Promise.all(pages.map(p => p.evaluate(() => __FZ.pub()).catch(e => ({err:e.message}))));
      const views = await Promise.all(pages.map(p => p.evaluate(() => __FZ.view()).catch(() => [])));
      const turn = Math.max(...pubs.map(x => x.turn || 0)); res.turns = turn;
      if (turn !== lastTurn){ lastTurn = turn; lastTurnT = Date.now(); process.stdout.write(` t${turn}`); }
      // sync: each client's view of every other player vs that player's own state, must match within ~6 s
      const byPid = new Map(pubs.filter(x => x.pid).map(x => [x.pid, x]));
      views.forEach((vs, i) => vs.forEach(v => { const o = byPid.get(v.pid); if (!o) return; for (const f of ['life', 'psn', 'hc', 'lc', 'bf', 'gy']){ const k = `${i}|${v.pid}|${f}`; if (String(v[f]) !== String(o[f])){ const sig = String(v[f]); const m0 = mis.get(k); const m = m0 && m0.sig === sig ? m0 : {n:0, first:Date.now(), sig}; m.n++; mis.set(k, m);   // the same stale view for ~8 s (a view that keeps changing is catching up; a stuck one is not)

        if (m.n === 4) res.desync.push({viewer:pubs[i].nm, of:o.nm, field:f, seen:String(v[f]).slice(0, 200), actual:String(o[f]).slice(0, 200), turn, log:null}); } else mis.delete(k); } }));
      if (process.env.SELFTEST && turn === 3 && !res.selftest){ res.selftest = 1; await pages[0].evaluate(() => { const c = S.lib[0]; S.gy.push(c); S.lib.splice(5, 1); S.ex.push({id:S.nid++, k:S.hand[0].k, tok:true}); S.life = 0.5; commit(); }); }
      // cross-client conservation: a card on my side that isn't from my deck must be lent to me by its owner (S.lent on their client)
      pubs.forEach((x, i) => { if (!x.cons) return; const left = [...x.cons.foreignK]; for (const y of pubs) if (y !== x && y.cons) for (const l of y.cons.lentOut) { const j = left.indexOf(l.k); if (l.to === x.pid && j >= 0) left.splice(j, 1); }
        const key = 'foreign|' + i + '|' + left.sort().join(','); if (!left.length) return; const m = mis.get(key) || {n:0}; m.n++; mis.set(key, m);
        if (m.n === 3) res.viol.push({who:x.nm, deck:seats[i].name, kind:'conservation', key:'foreign-unexplained:' + left.join(','), msg:`${x.nm} has ${left.join(', ')} which is not from their deck and no other player lists it as lent to them`, turn:String(turn), log:[], acts:[]}); });
      const lost = pubs.filter(x => x.lost).length;
      if (turn > TURNS){ res.status = 'done'; break; }
      if (np - lost <= 1){ res.status = 'game over (one player left)'; break; }
      if (Date.now() - T0 > GAME_S * 1000){ res.status = 'wall-clock limit'; break; }
      if (Date.now() - lastTurnT > 100000){
        const diag = await Promise.all(pages.map(p => p.evaluate(() => ({nm:S.nm, ph:phaseNow(), key:prioKey(), pass:S.pass, box:myBox(), stack:stackAll().map(i => i.nm + '/' + nameOf(i.pid)), waiting:prioKey() ? waitingOn(prioKey()).map(p => p.nm) : [], modal:UI.modal && (UI.modal.type + ':' + (UI.modal.title || '')), casting:UI.casting, resolving:UI.resolving, cb:S.cb, bd:S.bd, prm:S.prm.length, lost:S.lost, acts:__FZ.acts.slice(-6), toasts:__FZ.toasts.slice(-6), bf:S.bf.map(c => cname(c) + (c.tap ? '*' : '') + (c.sk ? '(sk)' : '')), atkSel:JSON.stringify(UI.atkSel), log:[...LOGS.values()].sort((a, b) => a.t - b.t).slice(-15).map(e => (e.pid === MYPID ? S.nm : nameOf(e.pid)) + ': ' + e.s)})).catch(e => ({err:e.message}))));
        res.stuck.push({turn, diag}); res.status = 'stuck (turn did not advance for 100 s)'; break;
      }
    }
    // final collection
    for (let i = 0; i < np; i++){
      const d = await pages[i].evaluate(() => ({cerr:Object.values(__FZ.cerr), viol:__FZ.viol, asks:__FZ.asks, byhand:__FZ.byhand, botErr:__FZ.botErr.slice(0, 20), modals:__FZ.modals.length, nActs:__FZ.nActs || 0, acts:__FZ.acts.slice(-40), bfN:S.bf.length, gyN:S.gy.length, life:S.life, cons:__FZ.conserve(), lent:(S.lent || []).length})).catch(e => ({err:e.message}));
      if (d.err){ res.botErr.push(names[i] + ': ' + d.err); continue; }
      (res.cerr = res.cerr || []).push(...d.cerr.map(e => ({who:names[i], deck:seats[i].name, ...e}))); d.viol.forEach(v => res.viol.push({who:names[i], deck:seats[i].name, ...v}));
      res.asks.push(...d.asks.map(a => ({who:names[i], ...a}))); res.byhand.push(...d.byhand.map(a => ({who:names[i], ...a}))); res.botErr.push(...d.botErr.map(e => names[i] + ': ' + e)); res.modalsN += d.modals; (res.players = res.players || []).push({nm:names[i], deck:seats[i].name, nActs:d.nActs, bf:d.bfN, gy:d.gyN, life:d.life, cons:{missing:d.cons.missing, extra:d.cons.extra, dup:d.cons.dup.length, hidden:d.cons.hidden}, acts:process.env.ACTS ? d.acts : undefined});
    }
    // cross-client: extra cards on one client explained by another client's lent list?
    res.viol.forEach(v => { if (v.kind === 'conservation' && /^extra:/.test(v.key)) v.note = 'check against lent lists'; });
  } catch (e){ res.status = 'harness error: ' + e.message.split('\n')[0]; console.log('  harness error', e.message.split('\n').slice(0, 3).join(' ')); }
  finally { for (const c of ctxs) await c.close().catch(() => {}); }
  res.secs = Math.round((Date.now() - res.t0) / 1000);
  console.log(`\n  → ${res.status} after turn ${res.turns} in ${res.secs}s: ${res.errors.length} error kinds, ${res.viol.length} violations, ${res.desync.length} desyncs, ${res.asks.length} number asks, ${res.byhand.length} by-hand notes`);
  fs.writeFileSync(path.join(OUTDIR, `g${seed}.json`), JSON.stringify(res, null, 1));
  return res;
}

(async () => {
  const server = H.http.createServer(); H.ws.createServer({server}, H.aedes.handle); await new Promise(r => server.listen(H.PORT, r));
  const browser = await H.chromium.launch({headless:!process.env.HEADFUL});
  let seeds = [];
  if (process.env.SEED) seeds = [+process.env.SEED];
  else { const [a, b] = String(process.env.SEEDS || '1-3').split('-').map(Number); for (let s = a; s <= (b || a); s++) seeds.push(s); }
  for (const s of seeds) await game(s, browser);
  await browser.close(); server.close(); process.exit(0);
})();
