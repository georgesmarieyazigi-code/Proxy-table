
/* =============================================================
   Rules engine — round 1
   Phases, shared stack with priority windows, mana pool, costs,
   timing, counterspells, triggers and automatic effects.

   Sync model: every player only ever changes their own state. The
   shared stack is the union of everyone's own stack items (ordered by
   `o`). A player passes priority by publishing `pass` = the key of the
   thing they passed on ("s:<sid>" for a stack item, "w:<g>.<turn>.<phase>"
   for an empty-stack step window). The controller of the top item
   resolves it once every live player has passed on it; the active
   player moves the phase on once everyone passed the step window.
   Things done to another player (life loss, countering their spell)
   go out as records (`rq`, `ctr`) that the owner's client applies.
   ============================================================= */
const PH = ['Untap','Upkeep','Draw','Main 1','Combat','Main 2','End','Cleanup'];
const WIN = {1:'upkeep', 2:'draw', 4:'combat', 6:'end'};          // steps with a response window
const RESP_MS = window.PT_RESP_MS || 10000, CHOICE_MS = 60000, AFK_MS = 45000;
const MANA = ['W','U','B','R','G','C'];
const MNAME = {W:'white', U:'blue', B:'black', R:'red', G:'green', C:'colorless'};
const BASIC = {Plains:'W', Island:'U', Swamp:'B', Mountain:'R', Forest:'G', Wastes:'C'};
const COLW = {white:'W', blue:'U', black:'B', red:'R', green:'G'};
const DEF_STOPS = {mine:{upkeep:false, draw:false, combat:true, end:false}, opp:{upkeep:true, draw:true, combat:true, end:true}};
UI.stops = (() => { const s = store.get('pt.stops'); return s && s.mine && s.opp ? s : JSON.parse(JSON.stringify(DEF_STOPS)); })();
UI.box = null; UI.evq = []; UI.resolving = false; UI.casting = false;

const short = (s, n=70) => { s = String(s||'').replace(/\s+/g,' ').trim(); return s.length > n ? s.slice(0, n-1) + '…' : s; };
const cap = s => String(s||'').charAt(0).toUpperCase() + String(s||'').slice(1);
const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const emptyPool = () => ({W:0,U:0,B:0,R:0,G:0,C:0});
const poolTotal = p => MANA.reduce((a, c) => a + ((p && p[c]) || 0), 0);
function wn(w, x){ w = String(w||'').toLowerCase(); if (/^\d+$/.test(w)) return +w; if (w === 'x') return x; return NUMW[w] ?? (w === 'zero' ? 0 : null); }

function initEngineState(st){
  st.ph ||= [0,0,-1]; st.pool ||= emptyPool(); st.stk ||= []; st.pass ||= '';
  st.ctr ||= []; st.rq ||= []; st.done ||= {}; st.ev ||= []; st.evn ||= 0; st.evSeen ||= {}; st.seenP ||= {};
  st.landT ||= ['', 0]; st.seenPh ||= ''; st.prm ||= []; st.lent ||= []; st.dly ||= []; st.lp = 0; st.lastTurn ||= '';
}

/* ---------- Card text helpers ---------- */
const faceOf = c => { const a = c && info(c.k); return a ? (c.fl && a.back ? a.back : a) : null; };
// is this permanent a land right now? (the land side of a double-faced card played as a land counts; info(k).t is the front face)
const isLandC = c => { const f = faceOf(c); const t = (f && f.t) || info(c && c.k)?.t || ''; return /\bLand\b/.test(t) && !/\bCreature\b/.test(t); };
let typeOf = c => faceOf(c)?.t || '';
const textOf = c => faceOf(c)?.o || '';
let isCreatureCard = c => !!(c && c.fd && c.fdc) || /\bCreature\b/.test(typeOf(c));
const isPermType = t => /\b(Creature|Artifact|Enchantment|Planeswalker|Land|Battle)\b/.test(t || '');
// replace the card's own name (and "this creature", "this spell", …) with ~, drop reminder text
let LEG_SET = null, LEG_N = -1;
function legendName(n){ if (typeof DICT === 'undefined') return false; if (LEG_N !== DICT.size){ LEG_SET = new Set(); for (const a of DICT.values()){ if (/Legendary/.test(a.t || '')){ LEG_SET.add(a.n); if (a.back) LEG_SET.add(a.back.n); if (a.faces) a.faces.forEach(f => LEG_SET.add(f.n)); } } LEG_N = DICT.size; } return LEG_SET.has(n); }
function tname(txt, name){
  let t = String(txt || '').replace(/\([^)]*\)/g, '');
  // ability words ("Landfall — ", "Magecraft — ") are only labels: drop them, but keep saga chapters ("I, II — ")
  t = t.replace(/(^|\n)(?!(?:I|II|III|IV|V|VI|VII)(?:, (?:I|II|III|IV|V|VI|VII))* — )([A-Z][A-Za-z'’\- ]{1,32}) — /g, '$1');
  const names = new Set();
  String(name || '').split(' // ').forEach(n => { if (!n) return; names.add(n); const s = n.split(',')[0]; if (s !== n && s.length > 3) names.add(s);
    const s2 = s.split(/ (?:of|the) /)[0]; if (legendName(n) && s2 !== s && s2.length > 3) names.add(s2);
    const w1 = s.split(' ')[0]; if (legendName(n) && w1 !== s && w1.length > 3 && !/^(the|queen|king|captain|fire|high|lord|lady|avatar|ms\.|mr\.|sir|general|grand|prince|princess|elder|lady|vial|nick|norman|basim|tom|go-shintai|tifa|raph|goro-goro)$/i.test(w1) && !/ and | & /.test(s)) names.add(w1);
    if (/^Avatar /.test(n)) names.add(n.split(' ')[1]); });
  [...names].sort((a, b) => b.length - a.length).forEach(n => { t = t.split(n).join('~'); });
  return t.replace(/\bthis (creature|spell|artifact|enchantment|land|permanent|card|planeswalker|token|equipment|vehicle|aura)\b/gi, '~');
}
function termOk(w, a, tl, o){
  if (!w || /^(cards?|spells?|permanents?|objects?|with)$/.test(w)) return true;
  if (w === 'token' || w === 'tokens') return !!o.tok;
  if (w === 'nontoken') return !o.tok;
  if (/^non-?./.test(w) && w !== 'none') return !termOk(w.replace(/^non-?/, ''), a, tl, o);
  if (COLW[w]) return (a.c || '').includes(COLW[w]);
  if (w === 'colorless') return !(a.c || '');
  if (w === 'multicolored') return (a.c || '').length > 1;
  if (w === 'monocolored') return (a.c || '').length === 1;
  const sing = w.replace(/ves$/, 'f').replace(/ies$/, 'y').replace(/([^s])s$/, '$1');
  if (new RegExp('\\b(' + escRe(w) + '|' + escRe(sing) + ')\\b', 'i').test(tl)) return true;
  if (/changeling/i.test(a.o || '') && /\bcreature\b/i.test(tl) && !/^(creature|artifact|enchantment|land|instant|sorcery|planeswalker|legendary|basic|battle)$/.test(sing)) return true;
  return false;
}
// does card k fit a rules-text description such as "noncreature", "Forest or Plains card", "Angel, Demon, or Dragon creature card"?
function descOk(k, desc, o={}){
  const a = info(k); if (!a) return false;
  const tl = ((o.face || a).t || '').toLowerCase();
  let d = ' ' + String(desc || '').toLowerCase() + ' ';
  const mvm = d.match(/with (?:mana value|converted mana cost) (\d+) or (less|greater|more)/);
  if (mvm){ if (mvm[2] === 'less' ? a.mv > +mvm[1] : a.mv < +mvm[1]) return false; d = d.replace(mvm[0], ' '); }
  d = d.replace(/\bwith .*$/, ' ')
    .replace(/\b(you control|an opponent controls|your opponents control|you don't control|you own|from your hand|in your graveyard|on the battlefield|under your control)\b/g, ' ')
    .replace(/\b(an?|one|the|that|target|other|another|each|all|up to|two|three|four|any number of)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (!d) return true;
  const alts = d.split(/\s*,\s*(?:or |and )?|\s+(?:and\/or|or|and)\s+/).map(s => s.trim()).filter(Boolean);
  if (!alts.length) return true;
  const tail = alts[alts.length - 1].split(' ').slice(1).join(' ');
  return alts.some((alt, i) => {
    const ws = (i < alts.length - 1 && alt.split(' ').length === 1 && tail ? alt + ' ' + tail : alt).split(' ');
    return ws.every(w => termOk(w, a, tl, o));
  });
}
const hasKwText = (f, kw) => !!f && tname(f.o, f.n).split('\n').some(l => new RegExp('^(?:[a-z ]+, )*' + kw + '(?:, [a-z ]+)*$', 'i').test(l.trim()));
// keyword granted by one of my permanents ("Goblin creatures you control have haste", "Other non-Human creatures you control … have undying")
function grantedKw(c, kw, bf = S.bf){
  let maybe = false;
  for (const b of bf){
    if (b.fd) continue; const f = faceOf(b); if (!f) continue;
    const t = tname(f.o, f.n).toLowerCase();
    for (const sen of t.split(/\.\s*|\n/)){
      if (!sen.includes(kw)) continue;
      const m = sen.match(/^(other )?(.*?) you control (?:get [^ ]+ and )?(?:have|gain) (.+)$/);
      if (m){ if (!new RegExp('\\b' + kw + '\\b').test(m[3])) continue; if (m[1] && b.id === c.id) continue; if (descOk(c.k, m[2], {tok:c.tok})) return true; continue; }
      if (/^(equipped|enchanted) creature (?:gets [^ ]+ and )?(?:has|gains)/.test(sen)) maybe = true;
      if (b.id === c.id && /^~ (?:has|gains)/.test(sen)) maybe = true;
    }
  }
  return maybe ? 'maybe' : false;
}
function hasHaste(c){ const f = faceOf(c); if (!f) return false; if (hasKwText(f, 'haste') || (c.ekw || []).includes('haste')) return true; return grantedKw(c, 'haste'); }
function hasKw(c, kw){ return kwOf(c, kw); }
function cancelCounters(c){ if (c && c.cp > 0 && c.cm > 0){ const m = Math.min(c.cp, c.cm); c.cp -= m; c.cm -= m; } }

/* ---------- Turn, phase and priority ---------- */
const turnStr = (t = currentTurn()) => `${t[2] || 0}.${t[0]}`;
function phaseNow(){
  const [n, pid, g=0] = currentTurn();
  const st = pid === MYPID ? S : OPP.get(pid);
  let ph = -1; if (st && Array.isArray(st.ph) && st.ph[0] === g && st.ph[1] === n) ph = st.ph[2];
  return {n, pid, g, ph, mine: pid === MYPID && n > 0};
}
const pubItem = it => ({sid:it.sid, o:it.o, kind:it.kind, k:it.k, nm:it.nm, txt:short(it.txt, 600), mv:it.mv||0, ty:it.ty||'', tgt:it.tgt||null, tgtNm:it.tgtNm||'', ss:!!it.ss, uc:!!it.uc, x:it.x||0});
function stackAll(){
  const all = S.stk.map(it => ({...pubItem(it), pid:MYPID, it}));
  for (const [pid, s] of OPP) (s.stk || []).forEach(it => all.push({...it, pid}));
  return all.sort((a, b) => (a.o - b.o) || (a.sid < b.sid ? -1 : 1));
}
function stackTop(){ const a = stackAll(); return a[a.length - 1] || null; }
function nextO(){ let m = 0; stackAll().forEach(i => { m = Math.max(m, i.o); }); return m + 1; }
function prioKey(){
  const top = stackTop(); if (top) return 's:' + top.sid;
  const pn = phaseNow();
  if (pn.n > 0 && pn.ph === 4){ const cb = cbOf(pn); const step = cb ? cb.step : 'begin'; return CB_WIN.includes(step) ? `w:${pn.g}.${pn.n}.4.${cb ? cb.n : 0}.${step}` : null; }
  if (pn.n > 0 && WIN[pn.ph]) return `w:${pn.g}.${pn.n}.${pn.ph}`;
  return null;
}
function isLive(pid){ if (pid === MYPID) return true; const v = NET.seen.get(pid); return !!v && Date.now() - v.at < AFK_MS; }
// the controller of the top item always passes on it (they can still respond to their own things with instants)
function passedBy(pid, key){ const top = stackTop(); if (top && key === 's:' + top.sid && (top.pid === pid || (top.pid === MYPID && S.lp))) return true; if (pid === MYPID) return S.pass === key; if (!isLive(pid)) return true; const o = OPP.get(pid); if (!o || (o.v || 0) < 3) return true; return o.pass === key; }
const waitingOn = key => players().filter(p => !passedBy(p.pid, key));
function myBox(){
  const key = prioKey(); if (!key || S.pass === key) return null;
  const top = stackTop();
  if (top && top.pid === MYPID) return null;          // my own spell or ability: I pass automatically
  if (!top && phaseNow().mine) return null;           // my own step window: the Next button passes
  return key;
}
function doPass(){ const key = prioKey(); if (!key) return; S.pass = key; UI.box = null; commit(); }
function priorityCheck(){
  if (!S || UI.resolving || $('#game').hidden) return;
  const pn = phaseNow(); const key = prioKey(); if (!key) return;
  if (loopActive() && myBox() && key.startsWith('s:')){ doPass(); return; }
  const top = stackTop();
  if (!top && pn.mine && pn.ph === 4 && S.pass !== key && /\.(atkd|blkd)$/.test(key)){ S.pass = key; commit(); return; }   // the attacker passes these combat windows by itself
  if (!top && S.pass !== key){                      // step windows I've switched off pass by themselves
    const st = UI.stops[pn.mine ? 'mine' : 'opp'];
    if (st && st[WIN[pn.ph]] === false){ S.pass = key; commit(); return; }
  }
  if (waitingOn(key).length) return;
  if (top){ if (top.pid === MYPID && !top.it.hold) resolveTop(top.it); return; }
  if (pn.mine){ if (pn.ph === 4) advanceCombat(); else advancePhase(); }
}
function startMyTurn(){ const [n] = currentTurn(); S.untapN = n; if (useSkip('turn')){ log('skips this turn'); commit(); passTurn(); return; } setPhase(0); }
function setPhase(i){
  const t = currentTurn(); S.ph = [t[2] || 0, t[0], i];
  if (i === 0){
    const noU = rulesOn('noUntapAll'); const skipU = useSkip('untap');
    if (skipU) log('skips their untap step');
    S.bf.forEach(c => { c.sk = false; if (skipU) return; if (doesntUntap(c) || noU.some(r => !r.scope || descOk(c.k, r.scope))) return; c.tap = false; c.tn = 0; });
    S.untapN = t[0]; log(`untapped — turn ${t[0]}`); setPhase(1); return;
  }
  if (i === 2 && useSkip('draw')){ log('skips their draw step'); commit(); return; }
  if (i === 2){ if (skipsFirstDraw(t[0])) log(`no draw on the first turn in ${FMT[S.fmt].label}`); else draw(1); }
  if (i === 4 && useSkip('combat')){ log('skips their combat phase'); setPhase(5); return; }
  if (i === 4) startCombat();
  if (i === 3) S.bf.filter(c => !c.fd && sagaChapters(c)).forEach(c => modCounters(c, 'lore', 1));
  if (i !== 4) S.bf.forEach(c => { c.atk = ''; });
  if (i === 7){ S.bf.forEach(c => { c.dmg = 0; }); if (S.hand.length > (typeof curMaxHand === 'function' ? curMaxHand() : 7) && !noMaxHand()){ commit(); cleanupHand().then(() => passTurn()); return; } commit(); passTurn(); return; }
  commit();
}
function advancePhase(){ const pn = phaseNow(); if (!pn.mine || pn.ph < 0) return; if (pn.ph === 5 && S.xc > 0){ S.xc--; log('additional combat phase'); setPhase(4); return; } setPhase(Math.min(7, pn.ph + 1)); }
function endTurnFlow(){
  const pn = phaseNow();
  if (pn.n === 0){ toast('Start the game first'); return; }
  if (!pn.mine){ toast("It isn't your turn"); return; }
  if (stackAll().length){ toast('Let the stack finish first'); return; }
  if (S.untapN < pn.n){ startMyTurn(); return; }
  if (pn.ph === 4 && S.cb && !['begin','end'].includes(S.cb.step)){ toast('Finish combat first'); return; }
  if (pn.ph < 6) setPhase(6); else nextAction();
}
function waitText(key){ const w = waitingOn(key).filter(p => !p.me); return w.length ? `Waiting for ${w.map(p => p.nm).join(', ')}` : 'Waiting…'; }
function nextAction(){
  if (!S) return false;
  const pn = phaseNow(); const key = prioKey(); const top = stackTop();
  if (top){ if (S.pass !== key && top.pid !== MYPID) doPass(); else toast(waitText(key)); return true; }
  if (!pn.mine){ if (key && S.pass !== key){ doPass(); return true; } return false; }
  if (S.untapN < pn.n){ startMyTurn(); return true; }
  if (pn.ph === 4 && S.cb && S.cb.step === 'atk'){ declareAttackers(); return true; }
  if (pn.ph === 4 && !key){ toast('Combat is in progress'); return true; }
  if (WIN[pn.ph]){ if (S.pass !== key){ S.pass = key; commit(); } else toast(waitText(key)); return true; }
  advancePhase(); return true;
}
const nextKey = () => nextAction();
function skipAway(){
  const pn = phaseNow(); if (pn.mine || isLive(pn.pid)) return;
  const ps = players(); const i = ps.findIndex(p => p.pid === pn.pid); const next = ps[(i + 1) % ps.length];
  S.turn = [pn.n + 1, next.pid, pn.g]; log(`moved the game on — ${nameOf(pn.pid)} seems to be away`); commit();
}

/* ---------- Engine tick: runs before every render, and on a clock ---------- */
function engineTick(){
  const pn = phaseNow();
  const ts = turnStr(); if (S.lastTurn !== ts){ if (S.lastTurn) turnChanged(); S.lastTurn = ts; commit(); }
  sba();
  if (UI.auto && pn.n > 0 && pn.pid === MYPID && S.untapN < pn.n && pn.g === (S.turn[2] || 0)){ startMyTurn(); return true; }
  const key = `${pn.g}.${pn.n}.${pn.ph}`;
  if (pn.n > 0 && pn.ph >= 1 && S.seenPh !== key){
    S.seenPh = key;
    if (poolTotal(S.pool)) S.pool = emptyPool();      // mana empties between steps
    const step = WIN[pn.ph]; if (step){ fireSteps(step, pn.pid); r7Steps(step, pn); } else if (pn.ph === 3 || pn.ph === 5) fireSteps(pn.ph === 3 ? (S.m1 === turnStr() ? 'main1x' : 'main1') : 'main2', pn.pid), pn.ph === 3 && (S.m1 = turnStr());
    commit();
  }
  r8Tick();
  priorityCheck(); combatTick();
  return false;
}
function engineClock(){
  if (!S || $('#game').hidden) return;
  const now = Date.now(); const key = myBox();
  if (!stackTop()) UI.passStack = false;
  if (key && UI.passStack && key.startsWith('s:')){ doPass(); return; }
  if (key !== (UI.box && UI.box.key)){ UI.box = key ? {key, left:RESP_MS, last:now, hold:false} : null; renderStackPanel(); }
  if (UI.box){
    const paused = UI.box.hold || UI.modal || UI.casting;
    if (!paused) UI.box.left -= now - UI.box.last;
    UI.box.last = now;
    if (UI.box.left <= 0){ doPass(); return; }
  }
  for (const p of S.prm){
    if (UI.modal || UI.casting) continue;
    p.left = (p.left ?? CHOICE_MS) - 250;
    if (p.left <= 0){ if (p.type === 'unless') resolvePrompt(p, false); else randomChoice(p); return; }
  }
  updateCountdown();
  priorityCheck(); combatTick();
  const bc = $('#blkcount'); if (bc && UI.blkT) bc.textContent = Math.max(0, Math.ceil((UI.blkT.until - now) / 1000)) + 's';
  if (now - (UI.lastAfk || 0) > 2000){ UI.lastAfk = now; renderPhaseBar(); }
}
function updateCountdown(){
  const f = $('#pbarfill'), t = $('#pcount');
  if (f && UI.box){ f.style.width = (100 * Math.max(0, UI.box.left) / RESP_MS) + '%'; if (t) t.textContent = UI.box.hold ? 'held' : Math.ceil(Math.max(0, UI.box.left) / 1000) + 's'; }
  S.prm.forEach(p => { const el = document.querySelector(`[data-pcount="${p.id}"]`); if (el) el.textContent = Math.ceil(Math.max(0, p.left ?? CHOICE_MS) / 1000) + 's'; });
}

/* ---------- Mana ---------- */
function parseCost(m){
  const r = {gen:0, col:emptyPool(), hyb:[], two:[], phy:[], x:0, odd:[]};
  String(m || '').split('//')[0].replace(/\{([^}]+)\}/g, (_, t) => {
    t = t.toUpperCase();
    if (/^\d+$/.test(t)) r.gen += +t;
    else if (t === 'X') r.x++;
    else if (MANA.includes(t)) r.col[t]++;
    else if (/^[WUBRG]\/P$/.test(t)) r.phy.push(t[0]);
    else if (/^2\/[WUBRG]$/.test(t)) r.two.push(t[2]);
    else if (/^[WUBRGC]\/[WUBRG]$/.test(t)) r.hyb.push([t[0], t[2]]);
    else if (t === 'S') r.gen++;
    else r.odd.push(t);
    return '';
  });
  return r;
}
function costStr(c){
  let s = '{X}'.repeat(c.x || 0); if (c.gen) s += `{${c.gen}}`;
  c.hyb.forEach(([a, b]) => { s += `{${a}/${b}}`; }); c.two.forEach(x => { s += `{2/${x}}`; }); c.phy.forEach(x => { s += `{${x}/P}`; });
  MANA.forEach(x => { s += `{${x}}`.repeat(c.col[x]); });
  return s || '{0}';
}
function payPlan(cost, pool){
  const p = {...emptyPool(), ...pool}; let life = 0; let gen = cost.gen;
  for (const c of MANA){ if (p[c] < cost.col[c]) return {err:`needs ${cost.col[c] - p[c]} more ${MNAME[c]}`}; p[c] -= cost.col[c]; }
  for (const c of cost.phy){ if (p[c] > 0) p[c]--; else life += 2; }
  for (const [a, b] of cost.hyb){ const u = p[a] >= p[b] ? a : b; if (p[u] > 0) p[u]--; else return {err:`needs ${MNAME[a]} or ${MNAME[b]}`}; }
  for (const c of cost.two){ if (p[c] > 0) p[c]--; else gen += 2; }
  let need = gen;
  for (const c of ['C', ...['W','U','B','R','G'].sort((a, b) => p[b] - p[a])]){ const use = Math.min(p[c], need); p[c] -= use; need -= use; }
  if (need > 0) return {err:`needs ${need} more mana`};
  if (life && S.life < life) return {err:`needs ${life} life for Phyrexian mana`};
  return {pool:p, life};
}
function poolText(p){ if (!p) return ''; return MANA.filter(c => p[c]).map(c => p[c] <= 5 ? `{${c}}`.repeat(p[c]) : `{${c}}×${p[c]}`).join(''); }
function manaPoolHTML(){
  if (!S) return '';
  const t = poolTotal(S.pool);
  return `<button class="pool" type="button" data-act="manaAdj" title="Your mana pool. It empties between steps. Click to adjust by hand.">${t ? manaHTML(poolText(S.pool)) : '<span class="dim">no mana</span>'}</button>`;
}
function addMana(outs){ outs.forEach(c => { S.pool[c] = (S.pool[c] || 0) + 1; }); }
function manaOuts(eff){
  const e = eff.replace(/\.$/, '').trim();
  if (/one mana of any color/i.test(e)){
    let cols = ['W','U','B','R','G'];
    if (/commander's color identity/i.test(e)){ const ci = S.deck.cmd.map(k => info(k)?.ci || '').join(''); cols = cols.filter(x => ci.includes(x)); if (!cols.length) return [['C']]; }
    return cols.map(x => [x]);
  }
  if (/one mana of any type/i.test(e)) return MANA.map(x => [x]);
  if (/any one color|any combination|equal to|for each|\bx\b|an amount|that player/i.test(e)) return [];
  const body = e.replace(/^add /i, '');
  if (/[^{}WUBRGC\s,or]/i.test(body.replace(/\{[WUBRGC]\}/g, ''))) return [];
  const res = body.split(/,? or |, /).map(a => (a.match(/\{([WUBRGC])\}/g) || []).map(s => s[1]));
  return res.some(r => !r.length) ? [] : res;
}
const MANA_CACHE = new Map();
function manaAbs(c){
  const f = faceOf(c); if (!f || c.fd) return [];
  const key = c.k + (c.fl ? '|b' : ''); if (MANA_CACHE.has(key)) return MANA_CACHE.get(key);
  const out = [];
  for (const line of tname(f.o, f.n).split('\n')){
    const m = line.trim().match(/^([^:"]+):\s*(add .+)$/i); if (!m) continue;
    const [effMain, ...rest] = m[2].split(/\.\s+/);
    out.push({cost:m[1].trim(), eff:effMain, rest:rest.join('. '), outs:manaOuts(effMain), tapOnly:/^\{t\}$/i.test(m[1].trim()), line:line.trim()});
  }
  for (const [bt, col] of Object.entries(BASIC)) if (new RegExp('\\b' + bt + '\\b').test(f.t) && !out.some(o => o.tapOnly && o.outs.some(x => x.join('') === col)))
    out.push({cost:'{T}', eff:`Add {${col}}`, rest:'', outs:[[col]], tapOnly:true, line:`{T}: Add {${col}}.`});
  MANA_CACHE.set(key, out); return out;
}
function tapOptions(c){ const opts = []; manaAbs(c).forEach((ab, ai) => { if (ab.tapOnly) ab.outs.forEach((o, ci) => opts.push({ab, ai, ci, outs:o})); }); return opts; }
function quickTap(id){
  const [z,,c] = find(id); if (z !== 'bf') return;
  const n = c.n || 1; const all = n > 1 ? (c.tn || 0) >= n : c.tap;
  if (isPW(c) && !c.fd){ openModal({type:'pw', id:c.id, key:rid(4)}); return; }
  if (all || c.fd){ tapToggle(id); return; }
  const opts = tapOptions(c);
  if (opts.length === 1){ activateMana(c, opts[0].ab, opts[0].ci); return; }
  if (opts.length > 1){
    const el = document.querySelector(`.card[data-id="${id}"]`); const r = el ? el.getBoundingClientRect() : {right:200, top:200};
    openMenuAt(`<div class="mh">${esc(cname(c))}: add mana</div>` + opts.map(o => mb('manaGo', `Add ${manaHTML(o.outs.map(x => '{' + x + '}').join(''))}`, `data-id="${id}" data-ab="${o.ai}" data-ch="${o.ci}"`)).join('') + `<div class="sep"></div>` + mb('tap', 'Tap without mana', `data-id="${id}"`), r.right + 6, r.top);
    return;
  }
  tapToggle(id);
}
async function activateMana(c, ab, ch){
  const outs = ab.outs[ch] || ab.outs[0];
  if (!outs){ toast('Add this mana by hand from the pool (Game menu)'); return false; }
  const nm = cname(c);
  recAct({t:'mana', id:c.id, k:c.k, ai:(() => { const L = manaAbs(c); const i = L.indexOf(ab); return i >= 0 ? i : L.findIndex(x => (x.line && x.line === ab.line) || (x.txt && x.txt === ab.txt)); })(), ch});
  if (!(await payAbilityCost(c, ab.cost, {mana:true}))) { commit(); return false; }
  addMana(outs);
  let extra = '';
  if (!isLandC(c)) S.bf.forEach(b => {
    if (!b.fd && /whenever you tap a nonland permanent for mana, add one additional mana of any type that permanent produced/i.test(textOf(b))){ S.pool[outs[0]]++; extra += ` (+{${outs[0]}} from ${cname(b)})`; }
  });
  log(`tapped ${nm} for ${outs.map(x => '{' + x + '}').join('')}${extra}`);
  if (ab.rest) await runEffects(ab.rest, {k:c.k, name:nm, srcId:c.id});
  commit(); return true;
}

/* ---------- Costs: modifiers, alternative costs, timing ---------- */
function costMods(c, caster){
  const out = {more:[], less:[], warn:[]}; const active = phaseNow().pid;
  const srcs = [];
  S.bf.forEach(b => { if (!b.fd) srcs.push({k:b.k, fl:b.fl, pid:MYPID, card:b}); });
  S.cz.forEach(b => { if (/in the command zone/i.test(info(b.k)?.o || '')) srcs.push({k:b.k, fl:false, pid:MYPID, card:b, cz:true}); });
  for (const [pid, s] of OPP) (s.bf || []).forEach(b => { if (b.k && !b.fd) srcs.push({k:b.k, fl:b.fl, pid}); });
  const re = /(each spell|(?:([a-z][a-z ,\-]*?) )?spells)( you cast| your opponents cast)?(?: during (your|each opponent's) turn)? costs? \{(\d+)\} (more|less) to cast( except during its controller's turn)?/g;
  for (const s of srcs){
    const f = info(s.k); if (!f) continue; const face = s.fl && f.back ? f.back : f;
    let txt = tname(face.o, face.n).toLowerCase(); let m; re.lastIndex = 0;
    if (s.cz) txt = txt.split(/\.\s*|\n/).filter(x => /command zone/.test(x)).join('. ');
    txt = txt.replace(/as long as ~ is in the command zone or on the battlefield, /g, '');
    while ((m = re.exec(txt))){
      const desc = (m[2] || '').replace(/^(and|or) /, '').trim();
      if (/(^|\s)(~|this|that|the|it|those)(\s|$)/.test(desc)) continue;
      const who = (m[3] || '').trim();
      if (who === 'you cast' && caster !== s.pid) continue;
      if (who === 'your opponents cast' && caster === s.pid) continue;
      if (m[4] === 'your' && active !== s.pid) continue;
      if (m[4] === "each opponent's" && active === s.pid) continue;
      if (m[7] && active === caster) continue;
      if (desc && !descOk(c.k, desc)) continue;
      let mult = 1; const fe = txt.slice(m.index + m[0].length).match(/^ for each ([^.\n]+)/); if (fe){ const n = s.pid === MYPID ? countOf(fe[1], {card:s.card, srcId:s.card && s.card.id}) : null; if (n == null) continue; mult = n; }
      if (mult) (m[6] === 'more' ? out.more : out.less).push({n:+m[5] * mult, src:face.n});
    }
  }
  const own = tname(info(c.k)?.o, info(c.k)?.n);
  if (/~ costs \{[^}]+\} (less|more) to cast/i.test(own)) out.warn.push('this card changes its own cost: adjust the pool by hand if needed');
  return out;
}
function spellCost(c, zone, o={}){
  const a = info(c.k); const base = o.alt ? parseCost(o.alt.mana || '') : parseCost(a.m); const notes = [];
  if (o.x != null && base.x){ base.gen += base.x * o.x; base.x = 0; }
  if (zone === 'cz'){ const t = 2 * (S.tax[c.k] || 0); if (t){ base.gen += t; notes.push(`commander tax +${t}`); } }
  const mods = costMods(c, MYPID);
  mods.more.forEach(m => { base.gen += m.n; notes.push(`${m.src} +${m.n}`); });
  const less = mods.less.reduce((s, m) => s + m.n, 0);
  if (less){ const r = Math.min(less, base.gen); base.gen -= r; if (r) notes.push(`${mods.less.map(m => m.src).join(', ')} −${r}`); }
  const af = affinityRed(c); if (af){ const r = Math.min(af, base.gen); base.gen -= r; if (r) notes.push(`affinity −${r}`); }
  const nr = typeof nextRedFor === 'function' ? nextRedFor(c) : []; const nrN = nr.reduce((s, r) => s + r.n, 0);
  if (nrN){ const r = Math.min(nrN, base.gen); base.gen -= r; if (r) notes.push(`${[...new Set(nr.map(x => x.src))].join(', ')} −${r}`); }
  return {cost:base, notes, warn:mods.warn};
}
function condCheck(cond){
  if (!cond) return {ok:true};
  const c = cond.toLowerCase().trim(); let m;
  if (/you control a commander/.test(c)) return S.bf.some(b => b.cmd) ? {ok:true} : {ok:false, why:"you don't control your commander"};
  if (/it's not your turn/.test(c)) return !phaseNow().mine ? {ok:true} : {ok:false, why:"it's your turn"};
  if (/it's your turn/.test(c)) return phaseNow().mine ? {ok:true} : {ok:false, why:"it isn't your turn"};
  if ((m = c.match(/^you control an? (.+)$/))) return S.bf.some(b => !b.fd && descOk(b.k, m[1], {tok:b.tok})) ? {ok:true} : {ok:false, why:`you don't control a ${m[1]}`};
  if ((m = c.match(/^an opponent controls an? (.+)$/))){ for (const s of OPP.values()) if ((s.bf || []).some(b => b.k && descOk(b.k, m[1], {tok:b.tok}))) return {ok:true}; return {ok:false, why:`no opponent controls a ${m[1]}`}; }
  return {ok:true, warn:`check it yourself: “${cond}”`};
}
function extraPart(p){
  const l = p.toLowerCase().trim(); let m;
  if ((m = l.match(/^pay (\d+) life$/))) return {t:'life', n:+m[1], label:`pay ${m[1]} life`};
  if ((m = l.match(/^exile an? (.+?) card from your hand$/))) return {t:'exile', desc:m[1], label:`exile a ${m[1]} card from your hand`};
  if ((m = l.match(/^return an? (.+?) you control to its owner's hand$/))) return {t:'bounce', desc:m[1], label:`return a ${m[1]} you control to your hand`};
  if ((m = l.match(/^sacrifice (an?|two) (.+)$/))) return {t:'sac', desc:m[2], n:wn(m[1]) || 1, label:`sacrifice ${m[1]} ${m[2]}`};
  if ((m = l.match(/^discard (an?|two) (.+?)s?$/))) return {t:'discard', desc:m[2].replace(/ cards?$/, ''), n:wn(m[1]) || 1, label:`discard ${m[1]} ${m[2]}`};
  if ((m = l.match(/^tap an? untapped (.+?) you control$/))) return {t:'tapc', desc:m[1], label:`tap an untapped ${m[1]}`};
  return {t:'?', label:p};
}
function extraFeasible(x, c){
  const others = S.hand.filter(h => h.id !== c.id);
  if (x.t === 'life') return S.life >= x.n ? '' : `you need ${x.n} life`;
  if (x.t === 'exile') return others.some(h => descOk(h.k, x.desc)) ? '' : `no other ${x.desc} card in your hand`;
  if (x.t === 'discard') return others.filter(h => descOk(h.k, x.desc)).length >= x.n ? '' : `not enough cards to discard`;
  if (x.t === 'bounce' || x.t === 'sac') return S.bf.filter(b => !b.fd && descOk(b.k, x.desc, {tok:b.tok})).length >= (x.n || 1) ? '' : `you don't control a ${x.desc}`;
  if (x.t === 'tapc') return S.bf.some(b => !b.fd && !b.tap && descOk(b.k, x.desc, {tok:b.tok})) ? '' : `no untapped ${x.desc}`;
  return '';
}
function altCosts(c, zone='hand'){
  const a = info(c.k); if (!a) return []; const t = tname(a.o, a.n); const out = []; let m;
  const taxWhy = mana => { const sc = spellCost(c, zone, {alt:{mana}}); const p = payPlan(sc.cost, S.pool); return p.err ? `also costs ${costStr(sc.cost)} (${sc.notes.join(', ')}): ${p.err}` : ''; };
  const re1 = /(?:^|\n|\.\s)(?:if ([^,]+), )?you may ([^.]+?) rather than pay (?:~'s|this spell's|its) mana cost/i;
  if ((m = t.match(re1))){
    const parts = m[2].split(/,? and /).map(extraPart); const cond = condCheck(m[1]);
    const why = !cond.ok ? cond.why : parts.map(x => extraFeasible(x, c)).find(Boolean) || taxWhy('');
    out.push({label:cap(m[2]), mana:null, extra:parts, ok:!why, why, warn:cond.warn});
  }
  if ((m = t.match(/(?:^|\n|\.\s)(?:if ([^,]+), )?you may cast ~ without paying its mana cost/i))){
    const cond = condCheck(m[1]); const why = cond.ok ? taxWhy('') : cond.why;
    out.push({label:`Cast for free${m[1] ? ' (' + m[1] + ')' : ''}`, mana:null, extra:[], ok:!why, why:why || '', warn:cond.warn});
  }
  if ((m = a.o.match(/^Evoke ((?:\{[^}]+\})+)/m))){
    const p = payPlan(spellCost(c, zone, {alt:{mana:m[1]}}).cost, S.pool);
    out.push({label:`Evoke ${m[1]} (sacrificed when it enters)`, mana:m[1], extra:[], evoke:true, ok:!p.err, why:p.err || ''});
  }
  return out;
}
const sorceryTime = () => { const pn = phaseNow(); return pn.mine && (pn.ph === 3 || pn.ph === 5) && !stackAll().length; };
function canPlayLand(c){
  const pn = phaseNow();
  if (pn.n === 0) return {ok:false, why:'Start the game first (top bar)'};
  if (!pn.mine) return {ok:false, why:'Lands only on your turn'};
  if (pn.ph !== 3 && pn.ph !== 5) return {ok:false, why:'Lands only in your main phase'};
  if (stackAll().length) return {ok:false, why:'Lands only when the stack is empty'};
  { const max = 1 + rulesOn('extraLand').reduce((a, r) => a + r.n, 0); if (S.landT[0] === turnStr() && S.landT[1] >= max) return {ok:false, why:max > 1 ? `You already played ${max} lands this turn` : 'You already played a land this turn', extra:true}; }
  return {ok:true};
}
function timingOk(c){
  const pn = phaseNow(); const a = info(c.k); const f = faceOf(c);
  if (pn.n === 0) return {ok:false, why:'Start the game first (top bar)'};
  const top = stackTop(); if (top && top.ss) return {ok:false, why:'Split second: nothing can be cast now'};
  if (/\bInstant\b/.test(a.t) || hasKwText(f, 'flash')) return {ok:true};
  if (!pn.mine) return {ok:false, why:'Sorcery speed: only on your turn'};
  if (pn.ph !== 3 && pn.ph !== 5) return {ok:false, why:'Sorcery speed: only in your main phase'};
  if (stackAll().length) return {ok:false, why:'Sorcery speed: the stack must be empty'};
  return {ok:true};
}
function castCheck(c, zone){
  const a = info(c.k); if (!a || !S) return {ok:true};
  if (isLand(c.k)) return canPlayLand(c);
  if (info(c.k)?.lay === 'split') return {ok:false, why:'Choose which half to cast (below)'};
  const tm = timingOk(c); if (!tm.ok) return tm;
  const cl = castLimit(c, zone); if (!cl.ok) return cl;
  const cs = counterSpec(tname(a.o, a.n));
  if (cs && !stackAll().some(it => counterLegal(it, cs).ok)) return {ok:false, why:'Nothing on the stack it can counter'};
  if (!isPermType(a.t)){ const tw = targetsAvailable(tname(a.o, a.n), {pid:MYPID, col:a.c, types:a.t, id:c.id}); if (tw) return {ok:false, why:cap(tw)}; }
  const sc = spellCost(c, zone);
  if (!payPlan(sc.cost, S.pool).err) return {ok:true};
  if (extraCanPay(c, sc)) return {ok:true};
  if (altCosts(c, zone).some(o => o.ok)) return {ok:true};
  return {ok:false, why:`Costs ${costStr(sc.cost)}${sc.notes.length ? ' (' + sc.notes.join(', ') + ')' : ''}. Tap lands for mana first.`};
}
function castMenuItems(c, zone){ return castMenuItems0(c, zone) + r7HandItems(c, zone) + r8HandItems(c, zone); }
function castMenuItems0(c, zone){
  const a = info(c.k); if (!a) return '';
  const id = c.id; const chk = castCheck(c, zone);
  const why = chk.ok ? '' : `<small class="why">${esc(chk.why)}</small>`;
  if (isLand(c.k)){
    return `<button type="button" data-act="playLand" data-id="${id}" ${chk.ok ? '' : 'disabled'}><span>Play land${why}</span></button>` +
      (chk.extra && looseOk() ? mb('playLand', 'Play another land (an effect lets me)', `data-id="${id}" data-force="1"`) : '') +
      (looseOk() ? mb('putBf', 'Put onto the battlefield (no land drop)', `data-id="${id}"`) + (zone === 'hand' ? mb('playFd', 'Play face down', `data-id="${id}"`) : '') : '');
  }
  const sc = spellCost(c, zone);
  return `<button type="button" data-act="cast" data-id="${id}" ${chk.ok ? '' : 'disabled'}><span>Cast ${manaHTML(costStr(sc.cost))}${sc.notes.length ? `<small class="why">${esc(sc.notes.join(', '))}</small>` : ''}${why}</span></button>` +
    (looseOk() ? mb('castFree', 'Cast without paying (an effect lets me)', `data-id="${id}"`) +
    (isPermType(a.t) ? mb('putBf', 'Put onto the battlefield (no casting)', `data-id="${id}"`) : '') +
    (zone === 'hand' ? mb('playFd', 'Play face down', `data-id="${id}"`) : '') : '');
}

/* ---------- Counterspells ---------- */
function counterSpec(t){
  const m = String(t || '').match(/counter target ([^.]+?)(?: unless its controller pays \{(\d+|x)\})?(?:\.|$)/i); if (!m) return null;
  return {what:m[1].toLowerCase(), un: m[2] ? (m[2].toLowerCase() === 'x' ? 'x' : +m[2]) : 0};
}
function counterLegal(it, cs){
  if (!cs || !it) return {ok:false};
  const w = cs.what; const isSpell = it.kind === 'spell';
  if (!isSpell){
    if (!/ability/.test(w)) return {ok:false, why:'it only counters spells'};
    if (/activated/.test(w) && !/triggered/.test(w) && it.kind !== 'ability') return {ok:false, why:'only activated abilities'};
    if (/triggered/.test(w) && !/activated/.test(w) && it.kind !== 'trigger') return {ok:false, why:'only triggered abilities'};
    return {ok:true};
  }
  if (!/spell/.test(w)) return {ok:false, why:'it only counters abilities'};
  if (it.uc) return {ok:false, why:"that spell can't be countered"};
  const i = w.indexOf('spell'); const pre = w.slice(0, i).replace(/,\s*$/, '').trim(); const post = w.slice(i);
  const a = info(it.k);
  const mv = post.match(/with mana value (\d+) or (less|greater)/);
  if (mv && a){ const v = it.mv ?? a.mv; if (mv[2] === 'less' ? v > +mv[1] : v < +mv[1]) return {ok:false, why:`mana value must be ${mv[1]} or ${mv[2]}`}; }
  if (pre && !descOk(it.k, pre)) return {ok:false, why:`it only counters ${pre} spells`};
  return {ok:true};
}

/* ---------- Casting ---------- */
async function beginCast(c, zone, o={}){
  if (UI.casting) return;
  const a = info(c.k); if (!a) return;
  if (isLand(c.k)){ playLand(c, o); return; }
  UI.casting = true;
  recAct({t:'cast', id:c.id, k:c.k, zone, free:!!o.free});
  try {
    if (!o.free){ const tm = timingOk(c); if (!tm.ok){ toast(tm.why); return; } }
    else { const top = stackTop(); if (top && top.ss){ toast('Split second: nothing can be cast now'); return; } }
    const txt0 = tname(a.o, a.n); let modes = null; let txt = txt0;
    const md = parseModes(txt0); if (md){ modes = await askModes(md, a.n); if (modes == null) return; txt = modeText(md, modes); }
    const cs = counterSpec(txt); let tgt = null;
    if (cs){
      const all = stackAll().reverse(); const legal = all.filter(it => counterLegal(it, cs).ok);
      if (!legal.length){ toast(all.length ? `Nothing on the stack ${a.n} can counter: ${counterLegal(all[0], cs).why}` : 'The stack is empty: nothing to counter'); return; }
      const v = await askChoice({title:`${a.n}: what are you countering?`, options: all.map(it => { const l = counterLegal(it, cs); return {label:`${it.nm} — ${it.pid === MYPID ? 'your' : nameOf(it.pid) + "'s"} ${it.kind === 'spell' ? 'spell' : 'ability'}${it.tgtNm ? ' → ' + it.tgtNm : ''}`, value:it.sid, disabled:!l.ok, why:l.ok ? short(String(it.txt || '').replace(/~/g, it.nm), 160) : l.why}; })});
      if (v == null) return; tgt = all.find(it => it.sid === v); if (!tgt) return;
    }
    const cps = !cs && copySpec(txt);
    if (cps){
      const all = stackAll().reverse(); const legal = all.filter(it => copyLegal(it, cps).ok);
      if (!legal.length){ toast(`Nothing on the stack ${a.n} can copy`); return; }
      const v = await askChoice({title:`${a.n}: what are you copying?`, options: all.map(it => { const l = copyLegal(it, cps); return {label:`${it.nm} — ${it.pid === MYPID ? 'your' : nameOf(it.pid) + "'s"} ${it.kind === 'spell' ? 'spell' : 'ability'}`, value:it.sid, disabled:!l.ok, why:l.ok ? short(String(it.txt || '').replace(/~/g, it.nm), 160) : l.why}; })});
      if (v == null) return; tgt = all.find(it => it.sid === v); if (!tgt) return;
    }
    let tgts = null;
    if (!isPermType(a.t) && targetSpecs(txt).length){ tgts = await chooseTargets(txt, {pid:MYPID, col:a.c, types:a.t, id:c.id}, a.n); if (tgts == null) return; }
    const dv = !isPermType(a.t) && txt.match(/deals (?:\d+|x) damage divided as you choose among ([^.\n]+)/i);
    if (dv && !tgts){ const p = await pickTargets(divSpec(dv[1].toLowerCase()), {pid:MYPID, col:a.c, types:a.t, id:c.id}, `${a.n}: choose targets`); if (p == null) return; tgts = [p.map(x => ({t:x.t, pid:x.pid, id:x.id, k:x.k || null, nm:x.nm}))]; }
    const ench = /\bAura\b/.test(a.t) && enchantDesc(txt);
    if (ench && !/player|opponent/.test(ench)){ tgts = await chooseTargets(`Enchant target ${ench}.`, {pid:MYPID, col:a.c, types:a.t, id:c.id}, `${a.n}: enchant what?`); if (tgts == null) return; if (!tgts.flat().length){ toast(`Nothing ${a.n} can enchant`); return; } }
    let alt = o.gy ? {mana:o.gy.mana, extra:o.gy.extra || [], label:o.gy.label} : null, x = 0;
    const sc0 = spellCost(c, zone);
    if (!o.free && !o.gy){
      const alts = altCosts(c, zone);
      if (alts.length){
        const p0 = payPlan(sc0.cost, S.pool);
        const v = await askChoice({title:`Cast ${a.n}`, text:'How do you want to pay?', options:[
          {label:`Pay ${costStr(sc0.cost)}`, html:`Pay ${manaHTML(costStr(sc0.cost))}`, value:'normal', disabled:!!p0.err && !sc0.cost.x, why:p0.err && !sc0.cost.x ? p0.err : sc0.notes.join(', ')},
          ...alts.map((al, i) => ({label:al.label, value:i, disabled:!al.ok, why:al.why || al.warn || ''}))]});
        if (v == null) return;
        if (v !== 'normal') alt = alts[v];
      }
      if (!alt && sc0.cost.x){
        const v = await askNumber(`Choose X for ${a.n}`, 'Your pool: ' + (poolText(S.pool) || 'empty'), 0);
        if (v == null) return; x = v;
      }
    }
    if (!o.free && alt && /\{X\}/i.test(alt.mana || '') && !x){
      const v = await askNumber(`Choose X for ${a.n}`, 'Your pool: ' + (poolText(S.pool) || 'empty'), 0);
      if (v == null) return; x = v;
    }
    let plan = {pool:{...S.pool}, life:0}; let sc = null; let xp = null;
    if (!o.free){
      sc = spellCost(c, zone, {alt, x});
      xp = !alt ? await extraPayments(c, sc) : null; if (xp === false) return;
      plan = payPlan(sc.cost, S.pool);
      if (plan.err){ toast(`Not enough mana for ${a.n}: ${plan.err}. It costs ${costStr(sc.cost)}${sc.notes.length ? ' (' + sc.notes.join(', ') + ')' : ''}.`); return; }
    }
    if (alt && alt.extra.length){ if (!(await payExtras(alt.extra, c))) return; }
    const wardOk = tgts ? await payWard(tgts, a.n) : true;
    const [z2, i2] = find(c.id); if (z2 !== zone) return;
    S.pool = plan.pool; if (plan.life){ S.life -= plan.life; } if (xp) xp.apply();
    S[z2].splice(i2, 1);
    if (zone === 'cz') S.tax[c.k] = (S.tax[c.k] || 0) + 1;
    const it = {sid:rid(6), o:nextO(), kind:'spell', card:c, k:c.k, nm:a.n, txt:a.o, mv:(a.mv || 0) + x * (parseCost(a.m).x || 0), ty:a.t,
      tgt:tgt ? tgt.sid : null, tgtNm:tgt ? tgt.nm : tgtLabel(tgts), tgts, x, modes, txt:modes ? txt : a.o, ss:hasKwText(a, 'split second'), uc:/~ can't be countered/i.test(txt), evoke:!!(alt && alt.evoke), pos:o.pos || null, from:zone,
      exAfter:!!(o.gy && o.gy.after === 'ex'), flip:!!(o.gy && o.gy.flip)};
    if (!wardOk){ log(`cast ${a.n} — countered by ward`); toGrave(c, it); commit(); return; }
    S.stk.push(it); S.pass = 's:' + it.sid; clearUndo();
    const how = o.free ? ' without paying its mana cost' : alt ? ` (${alt.label.toLowerCase()})` : sc ? ` for ${costStr(sc.cost)}` : '';
    log(`cast ${a.n}${zone === 'cz' ? ' from the command zone' : zone === 'gy' ? ' from the graveyard' : ''}${how}${it.tgtNm ? ' targeting ' + it.tgtNm : ''}${plan.life ? ` (paid ${plan.life} life)` : ''}`);
    (sc?.warn || []).forEach(w => log('⚠ ' + w)); if (alt?.warn) log('⚠ ' + alt.warn);
    noteCast(c); emit({type:'cast', k:c.k, id:c.id, nth:(S.casts || []).filter(x => x.t === turnStr()).length});
    castTriggers(c, a, it);
    commit();
  } finally { UI.casting = false; }
}
function castFromDrag(c, from, pos){ if (isLand(c.k)) playLand(c, {pos}); else beginCast(c, from, {pos}); }
async function payExtras(list, c){
  for (const x of list){
    const pickFrom = (cards, n, title) => cards.length <= n ? Promise.resolve(cards.map(h => h.id)) : pickCards({title, cards, min:n, max:n});
    if (x.t === 'life'){ S.life -= x.n; continue; }
    if (x.t === 'gyEx'){ const ids = await pickFrom(S.gy.filter(g => g.id !== c.id), x.n, `Exile ${x.n} other cards from your graveyard`); if (!ids || ids.length < x.n) return false; ids.forEach(id => moveCard(id, 'ex', {quiet:true})); log(`exiled ${ids.length} cards from their graveyard`); continue; }
    if (x.t === 'exile'){ const ids = await pickFrom(S.hand.filter(h => h.id !== c.id && descOk(h.k, x.desc)), 1, `Exile a ${x.desc} card from your hand`); if (!ids) return false; ids.forEach(id => moveCard(id, 'ex', {quiet:true})); log(`exiled ${ids.map(id => cname(find(id)[2])).join(', ')} from hand to pay`); continue; }
    if (x.t === 'discard'){ const ids = await pickFrom(S.hand.filter(h => h.id !== c.id && descOk(h.k, x.desc)), x.n, `Discard ${x.n}`); if (!ids) return false; ids.forEach(id => moveCard(id, 'gy')); continue; }
    if (x.t === 'bounce'){ const ids = await pickFrom(S.bf.filter(b => !b.fd && descOk(b.k, x.desc, {tok:b.tok})), 1, `Return a ${x.desc} to your hand`); if (!ids) return false; ids.forEach(id => moveCard(id, 'hand')); continue; }
    if (x.t === 'sac'){ const ids = await pickFrom(S.bf.filter(b => !b.fd && descOk(b.k, x.desc, {tok:b.tok})), x.n || 1, `Sacrifice a ${x.desc}`); if (!ids) return false; ids.forEach(id => sacrificeOne(find(id)[2])); continue; }
    if (x.t === 'tapc'){ const ids = await pickFrom(S.bf.filter(b => !b.fd && !b.tap && descOk(b.k, x.desc, {tok:b.tok})), 1, `Tap an untapped ${x.desc}`); if (!ids) return false; ids.forEach(id => { const b = find(id)[2]; if (b) b.tap = true; }); continue; }
    if (!(await askYes(`Pay this part of the cost by hand: “${x.label}”?`))) return false;
  }
  return true;
}
function playLand(c, o={}){
  const chk = canPlayLand(c);
  if (!chk.ok && !o.force){
    if (chk.extra){ askYes('You already played a land this turn. Does an effect let you play another?', 'Yes, play it', 'No').then(y => { if (y) playLand(c, {...o, force:true}); }); return; }
    toast(chk.why); return;
  }
  const ts = turnStr(); if (S.landT[0] !== ts) S.landT = [ts, 0]; S.landT[1]++;
  log(`played ${cname(c)}${!chk.ok ? ' (extra land drop)' : ''}`);
  moveCard(c.id, 'bf', o.pos ? {x:o.pos.x, y:o.pos.y, quiet:true} : {quiet:true});
}
function sacrificeOne(c){
  if (!c) return;
  if ((c.n || 1) > 1){ c.n--; if ((c.tn || 0) > c.n) c.tn = c.n; log(`sacrificed a ${cname(c)}`); emit({type:'sac', k:c.k, id:c.id, tok:1}); emit({type:'leave', k:c.k, id:c.id, tok:1}); if (isCreatureCard(c)) emit({type:'die', k:c.k, id:c.id, tok:1}); return; }
  moveCard(c.id, 'gy', {sac:true});
}

/* ---------- Activated abilities ---------- */
const AB_CACHE = new Map();
function abilityList(c){
  const f = faceOf(c); if (!f || c.fd) return [];
  const key = c.k + (c.fl ? '|b' : ''); if (AB_CACHE.has(key)) return AB_CACHE.get(key);
  const out = []; const lines0 = []; for (const l of tname(f.o, f.n).split('\n')){ if (/^\s*•/.test(l) && lines0.length) lines0[lines0.length - 1] += '\n' + l.trim(); else lines0.push(l); }
  for (const raw of lines0){
    const line = raw.trim(); const m = line.match(/^([^:"•]+):\s*([\s\S]+)$/); if (!m) continue;
    const cost = m[1].trim();
    if (!/\{|^(sacrifice|pay|discard|remove|exile|tap|return)\b/i.test(cost) || /^[+−\-]?\d+$/.test(cost)) continue;
    if (/^add\b/i.test(m[2])) continue;   // mana abilities are listed separately
    out.push({cost, eff:m[2].trim(), sorc:/activate only as a sorcery/i.test(m[2]), line});
  }
  for (const raw of tname(f.o, f.n).split('\n')){ const q = raw.trim().match(/^equip(?: ([a-z ]+?))? ((?:\{[^}]+\})+)$/i); if (q) out.push({cost:q[2], eff:`Attach ~ to target ${q[1] ? q[1].toLowerCase() + ' ' : ''}creature you control.`, sorc:true, line:raw.trim(), equip:true}); }
  AB_CACHE.set(key, out); return out;
}
function costMana(cost){ const ms = String(cost).replace(/\{[TQ]\}/gi, '').match(/\{[^}]+\}/g); return ms ? parseCost(ms.join('')) : null; }
function abilityReady(c, ab, mana){
  { const r = rulesOn('notOnTurn').find(r => r.abil && phaseNow().pid === r.pid && /\b(Artifact|Creature|Enchantment)\b/.test(typeOf(c))); if (r) return `${r.src}: no abilities of artifacts, creatures or enchantments during ${nameOf(r.pid)}'s turn`; }
  const lp = ab.cost.toLowerCase(); const n = c.n || 1; const tapped = n > 1 ? (c.tn || 0) >= n : c.tap;
  if (/\{t\}/.test(lp) && tapped) return 'Already tapped';
  if (/\{t\}/.test(lp) && isCreatureCard(c) && c.sk && hasHaste(c) === false) return 'Summoning sick';
  if (/\{q\}/.test(lp) && !c.tap) return "It isn't tapped";
  const cm = costMana(ab.cost); if (cm){ const p = payPlan(cm, S.pool); if (p.err) return 'Mana ' + p.err; }
  const lm = lp.match(/pay (\d+) life/); if (lm && S.life < +lm[1]) return `You need ${lm[1]} life`;
  if (!mana){ const top = stackTop(); if (top && top.ss) return 'Split second'; if (ab.sorc && !sorceryTime()) return 'Only as a sorcery'; if (phaseNow().n === 0) return 'Start the game first'; }
  return '';
}
function abilityMenuItems(c){ return abilityMenuItems0(c) + r7BfItems(c); }
function abilityMenuItems0(c){
  if (c.fd || !S) return '';
  let h = round4MenuItems(c);
  manaAbs(c).forEach((ab, i) => {
    const why = abilityReady(c, ab, true);
    const label = ab.outs.length ? ab.outs.map(o => manaHTML(o.map(x => '{' + x + '}').join(''))).join(' or ') : esc(short(ab.eff, 40));
    h += `<button type="button" data-act="manaAb" data-id="${c.id}" data-i="${i}" ${why ? 'disabled' : ''}><span>${ab.tapOnly ? 'Tap for' : manaHTML(ab.cost) + ':'} ${label}${why ? `<small class="why">${esc(why)}</small>` : ''}</span></button>`;
  });
  abilityList(c).forEach((ab, i) => {
    const why = abilityReady(c, ab, false);
    h += `<button type="button" data-act="actAb" data-id="${c.id}" data-i="${i}" ${why ? 'disabled' : ''}><span>${manaHTML(ab.cost)}: ${esc(short(ab.eff, 60))}${why ? `<small class="why">${esc(why)}</small>` : ''}</span></button>`;
  });
  return h ? h + '<div class="sep"></div>' : '';
}
async function payAbilityCost(c, cost, o={}){
  const parts = String(cost).split(/,\s*/).map(s => s.trim()).filter(Boolean);
  const nm = cname(c);
  let tap = false, untap = false, mana = null, life = 0, sacSelf = false; const later = [];
  for (const p of parts){
    const lp = p.toLowerCase(); let m;
    if (lp === '{t}') tap = true;
    else if (lp === '{q}') untap = true;
    else if (/^(\{[^}]+\})+$/.test(p)) mana = parseCost(p);
    else if ((m = lp.match(/^pay (\d+) life$/))) life += +m[1];
    else if (/^sacrifice ~$/.test(lp)) sacSelf = true;
    else later.push(p);
  }
  const n = c.n || 1; const tappedAll = n > 1 ? (c.tn || 0) >= n : c.tap;
  if (tap && tappedAll){ toast(`${nm} is already tapped`); return false; }
  if (tap && isCreatureCard(c) && c.sk){
    const h = hasHaste(c);
    if (!h){ toast(`${nm} is summoning sick (it came under your control this turn)`); return false; }
    if (h === 'maybe' && !(await askYes(`${nm} entered this turn. Does something give it haste?`, 'Yes, use it', 'No'))) return false;
  }
  if (untap && !c.tap){ toast(`${nm} isn't tapped`); return false; }
  let plan = null; if (mana){ plan = payPlan(mana, S.pool); if (plan.err){ toast(`Not enough mana: ${plan.err}`); return false; } }
  if (life && S.life < life){ toast(`You need ${life} life`); return false; }
  for (const p of later){ if (!(await payPart(p, c))) return false; }
  if (plan){ S.pool = plan.pool; S.life -= plan.life; }
  if (life){ S.life -= life; log(`paid ${life} life`); }
  if (tap && !(sacSelf && n > 1)){ if (n > 1) c.tn = (c.tn || 0) + 1; else c.tap = true; }
  if (untap) c.tap = false;
  if (sacSelf) sacrificeOne(c);
  return true;
}
async function payPart(p, c){
  const l = p.toLowerCase(); let m;
  const pickFrom = (cards, n, title) => cards.length === n ? Promise.resolve(cards.map(h => h.id)) : cards.length < n ? Promise.resolve(null) : pickCards({title, cards, min:n, max:n});
  if ((m = l.match(/^sacrifice (an?|another|two|three) (.+)$/))){
    const n = wn(m[1]) || 1; const list = S.bf.filter(b => !b.fd && (m[1] !== 'another' || b.id !== c.id) && descOk(b.k, m[2], {tok:b.tok}));
    const ids = await pickFrom(list, n, `Sacrifice ${m[1]} ${m[2]}`); if (!ids){ toast(`You need to sacrifice ${m[1]} ${m[2]}`); return false; }
    ids.forEach(id => sacrificeOne(find(id)[2])); return true;
  }
  if ((m = l.match(/^discard (an?|two) ?(.*?)\s*cards?$/)) || l === 'discard your hand'){
    if (l === 'discard your hand'){ S.hand.slice().forEach(h => moveCard(h.id, 'gy')); return true; }
    const n = wn(m[1]) || 1; const list = S.hand.filter(h => !m[2] || descOk(h.k, m[2]));
    const ids = await pickFrom(list, n, `Discard ${m[1]} ${m[2] || ''} card`); if (!ids){ toast('Not enough cards to discard'); return false; }
    ids.forEach(id => moveCard(id, 'gy')); return true;
  }
  if ((m = l.match(/^remove (an?|one|two|three|\d+|x) (.+?) counters? from ~$/))){
    const n = wn(m[1]) || 1; const kind = /\+1\/\+1/.test(m[2]) ? 'cp' : /-1\/-1/.test(m[2]) ? 'cm' : 'co';
    if ((c[kind] || 0) < n){ toast(`${cname(c)} doesn't have ${n} ${m[2]} counter${n > 1 ? 's' : ''}`); return false; }
    c[kind] -= n; return true;
  }
  if ((m = l.match(/^tap an? untapped (.+?) you control$/))){
    const ids = await pickFrom(S.bf.filter(b => !b.fd && !b.tap && b.id !== c.id && descOk(b.k, m[1], {tok:b.tok})), 1, `Tap an untapped ${m[1]}`); if (!ids) return false;
    ids.forEach(id => { const b = find(id)[2]; if (b) b.tap = true; }); return true;
  }
  if ((m = l.match(/^exile (an?|two) (.+?) from your graveyard$/))){
    const n = wn(m[1]) || 1; const ids = await pickFrom(S.gy.filter(g => descOk(g.k, m[2])), n, `Exile ${m[1]} ${m[2]} from your graveyard`); if (!ids) return false;
    ids.forEach(id => moveCard(id, 'ex')); return true;
  }
  return askYes(`Pay this part of the cost by hand: “${p}”?`, 'Done', 'Cancel');
}
async function activateAbility(c, ab){
  if (UI.casting) return;
  const why = abilityReady(c, ab, false); if (why && why !== 'Summoning sick'){ toast(why); return; }
  UI.casting = true;
  try {
    const nm = cname(c); const k = c.k; const id = c.id;
    recAct({t:'ab', id, k, ai:(() => { const L = abilityList(c); const i = L.indexOf(ab); return i >= 0 ? i : L.findIndex(x => x.line && x.line === ab.line); })()});
    let tgts = null; let eff = ab.eff, modes = null;
    const md = parseModes(eff); if (md){ modes = await askModes(md, nm); if (modes == null) return; eff = modeText(md, modes); }
    if (targetSpecs(eff).length){ tgts = await chooseTargets(eff, {pid:MYPID, col:info(k)?.c, types:typeOf(c), id}, nm); if (tgts == null) return; }
    UI.lastX = null;
    if (!(await payAbilityCost(c, ab.cost))) { commit(); return; }
    if (tgts && !(await payWard(tgts, nm))){ log(`activated ${nm} — countered by ward`); commit(); return; }
    const it = {sid:rid(6), o:nextO(), kind:'ability', k, nm, txt:eff, srcId:id, tgts, tgtNm:tgtLabel(tgts), modes, x:UI.lastX || 0, xSet:UI.lastX != null};
    S.stk.push(it); S.pass = 's:' + it.sid; log(`activated ${nm}: ${short(eff, 90)}${it.tgtNm ? ' targeting ' + it.tgtNm : ''}`); commit();
  } finally { UI.casting = false; }
}
function attackWith(id){
  const [z,,c] = find(id); if (z !== 'bf') return;
  const vig = hasKw(c, 'vigilance');
  if (!vig) c.tap = true;
  log(`attacks with ${cname(c)}${vig ? ' (vigilance)' : ''}`);
  emit({type:'attack', k:c.k, id:c.id}); commit();
}

/* ---------- Entering and leaving the battlefield ---------- */
function onEnter(c, from, o={}){
  if (from === 'bf' || c.fd) return;
  c.sk = true; c.dmg = 0;
  const f = faceOf(c); if (!f) return;
  const t = tname(f.o, f.n); let m;
  if ((m = t.match(/~ enters(?: the battlefield)? tapped(?: unless ([^.]+))?\./i))){
    if (!m[1]) c.tap = true;
    else {
      const u = m[1].toLowerCase().trim(); let q;
      if ((q = u.match(/^you control (\w+) or (fewer|more) (other )?(.+)$/))){ const cnt = S.bf.filter(b => b !== c && !b.fd && descOk(b.k, q[4], {tok:b.tok})).length; const n = wn(q[1]) ?? 0; if (q[2] === 'fewer' ? cnt > n : cnt < n) c.tap = true; }
      else if ((q = u.match(/^you control an? (.+)$/))){ if (!S.bf.some(b => b !== c && !b.fd && descOk(b.k, q[1], {tok:b.tok}))) c.tap = true; }
      else if (/^you have two or more opponents$/.test(u)){ if (opponents().length < 2) c.tap = true; }
      else if ((q = u.match(/^you pay (\d+) life$/))){ c.tap = true; const n = +q[1]; askYes(`${f.n}: pay ${n} life so it enters untapped?`, `Pay ${n} life`, 'Enter tapped').then(y => { if (y){ c.tap = false; S.life -= n; log(`paid ${n} life — ${f.n} enters untapped`); commit(); } }); }
      else { c.tap = true; log(`⚠ ${f.n} entered tapped — check “unless ${m[1]}” yourself`); }
    }
  }
  if ((m = t.match(/as ~ enters(?: the battlefield)?, you may pay (\d+) life\. if you don't, it enters(?: the battlefield)? tapped/i))){
    const n = +m[1]; c.tap = true;
    askYes(`${f.n}: pay ${n} life so it enters untapped?`, `Pay ${n} life`, 'Enter tapped').then(y => { if (y){ c.tap = false; S.life -= n; log(`paid ${n} life — ${f.n} enters untapped`); commit(); } });
  }
  if ((m = t.match(/~ enters(?: the battlefield)? with (an?|one|two|three|four|five|six|x|\d+) (?:additional )?\+1\/\+1 counters? on it/i))){ const n = wn(m[1], o.x || 0) || 0; modCounters(c, 'cp', n); }
  if ((m = t.match(/~ enters(?: the battlefield)? with (an?|one|two|three|four|five|six|x|\d+) -1\/-1 counters? on it/i))){ const n = wn(m[1], o.x || 0) || 0; if (typeof f24cmAdd === 'function' && S.bf.includes(c)) f24cmAdd(c, n); else c.cm = (c.cm || 0) + n; }
  cancelCounters(c);
  if (/Planeswalker/.test(f.t) && /^L\d+/.test(f.p || '')){ c.pw = 1; if (!c.co) modCounters(c, 'co', parseInt(f.p.slice(1), 10) || 0); }
  if (/\bBattle\b/.test(f.t) && !c.bt) battleEnter(c);
  if (sagaChapters(c) && !c.lore){ c.lore = 0; modCounters(c, 'lore', 1); }
  if (o.evoke){ const it = {sid:rid(6), o:nextO(), kind:'trigger', k:c.k, nm:f.n, txt:'Sacrifice it (it was evoked).', srcId:c.id, op:'evokeSac'}; S.stk.push(it); S.pass = 's:' + it.sid; }
  emit({type:'enter', k:c.k, id:c.id, tok:c.tok ? 1 : 0});
}
function onLeave(c, to, w){
  if (c.fd) return;
  const n = c.n || 1;
  if (to === 'gy' && isCreatureCard(c)) emit({type:'die', k:c.k, id:c.id, tok:c.tok ? 1 : 0, cnt:n, cp:w.cp, cm:w.cm});
  emit({type:'leave', k:c.k, id:c.id, tok:c.tok ? 1 : 0, cnt:n});
  if (c.origK){ c.k = c.origK; delete c.origK; }
  delete c.att;
}

/* ---------- Events and triggers ---------- */
function emit(ev){
  if (!S) return;
  if (NET.peer && (NET.evP || 0) >= 40){ try { publish(); } catch (e){ console.warn(e); } }   // the last 40 events are published: flush before an unseen one would drop out
  ev.n = ++S.evn; S.ev.push(ev); NET.evP = (NET.evP || 0) + 1; if (S.ev.length > 40) S.ev.splice(0, S.ev.length - 40);
  UI.evq.push([MYPID, ev]); queueMicrotask(processEvents);
}
function processEvents(){ if (!S) return; const q = UI.evq.splice(0); UI.curQ = q; q.forEach(([pid, ev]) => handleEvent(pid, ev)); UI.batch = new Set(); UI.curQ = null; }
function ctlDesc(d){
  let ctl = 'any';
  if (/\byou control\b/.test(d)) ctl = 'you'; else if (/\b(an opponent controls|your opponents control|you don't control)\b/.test(d)) ctl = 'opp';
  return {ctl, desc:d.replace(/\b(you control|an opponent controls|your opponents control|you don't control)\b/g, '').replace(/\s+/g, ' ').trim()};
}
function subjOf(s){
  s = s.trim(); let m;
  if (s === '~') return {subj:'self', ctl:'you', desc:''};
  if ((m = s.match(/^~ or another (.+)$/))) return {subj:'selfOr', ...ctlDesc(m[1])};
  if ((m = s.match(/^(?:another|one or more other) (.+)$/))) return {subj:'other', ...ctlDesc(m[1])};
  if ((m = s.match(/^(?:an?|one or more) (.+)$/))) return {subj:'any', ...ctlDesc(m[1])};
  return null;
}
function classifyTrig(w, c){
  let m;
  if (w === 'at'){
    if (/^the beginning of combat on your turn/.test(c)) return {ev:'step', step:'combat', whose:'your'};
    if (/^the beginning of each combat/.test(c)) return {ev:'step', step:'combat', whose:'each'};
    if ((m = c.match(/^the beginning of (your|each|each player's|each opponent's|the next|the) (upkeep|draw step|end step)/)))
      return {ev:'step', step:m[2].split(' ')[0], whose: m[1] === 'your' ? 'your' : m[1] === "each opponent's" ? 'opp' : m[1] === 'the next' ? 'next' : 'each'};
    return null;
  }
  if ((m = c.match(/^(.+?) deals? combat damage to (a player|an opponent|one or more players|a player or planeswalker|an opponent or planeswalker|a player or battle)/))){ const sj = subjOf(m[1].replace(/^one or more /, 'one or more ')); if (!sj) return null; if (/^one or more/.test(m[1])) sj.batch = true; return {ev:'cdmg', ...sj, oppOnly:/opponent/.test(m[2])}; }
  if ((m = c.match(/^(.+?) deals damage(?: to (you|a player|an opponent|one or more players|a creature|an opponent or planeswalker|a player or planeswalker))?\b/))){ const sj = /^(?:a|another) source you control$/.test(m[1]) ? {subj:/^another/.test(m[1]) ? 'other' : 'any', ctl:'you', desc:''} : subjOf(m[1]); if (!sj) return null; return {ev:'dmg', ...sj, toYou:m[2] === 'you', toPlayer:!!m[2] && /player|opponent/.test(m[2]), oppOnly:/opponent/.test(m[2] || '')}; }
  if (/^~ is turned face up/.test(c)) return {ev:'turnup', subj:'self', ctl:'you', desc:''};
  if (/^a spell or ability you control counters a spell/.test(c)) return {ev:'countered', subj:'any', ctl:'you', desc:''};
  if ((m = c.match(/^you sacrifice (.+?)$/))){ const d = m[1].replace(/^(one or more|an?|another) /, ''); return {ev:'sac', subj:/^another/.test(m[1]) ? 'other' : 'any', ctl:'you', desc:/^permanents?$/.test(d) ? '' : sing(d), batch:/^one or more/.test(m[1])}; }
  if ((m = c.match(/^(.+?) becomes? tapped$/))){ const sj = subjOf(m[1]); return sj ? {ev:'tapped', ...sj} : null; }
  if ((m = c.match(/^one or more (.*?)cards? leave your graveyard/))) return {ev:'leavegy', subj:'any', ctl:'you', desc:sing(m[1].trim()), batch:true};
  if ((m = c.match(/^(?:a|an|another) (.*?)card leaves your graveyard/))) return {ev:'leavegy', subj:'any', ctl:'you', desc:sing(m[1].trim())};
  if ((m = c.match(/^(.+?) attacks or blocks\b/))){ const sj = subjOf(m[1]); return sj ? {ev:'attack', evs:['attack','block'], ...sj} : null; }
  if ((m = c.match(/^(.+?) blocks or becomes blocked\b/))){ const sj = subjOf(m[1]); return sj ? {ev:'block', evs:['block','blocked'], ...sj} : null; }
  if ((m = c.match(/^(.+?) becomes blocked\b/))){ const sj = subjOf(m[1]); return sj ? {ev:'blocked', ...sj} : null; }
  if ((m = c.match(/^(.+?) blocks\b/))){ const sj = subjOf(m[1]); return sj ? {ev:'block', ...sj} : null; }
  if ((m = c.match(/^you (draw|gain life|scry|surveil)\b/))) return {ev:{draw:'draw', 'gain life':'gain', scry:'scry', surveil:'scry'}[m[1]], subj:'any', ctl:'you', desc:'', nth:/second card/.test(c) ? 2 : 0};
  if ((m = c.match(/^an opponent (draws|gains life)\b/))) return {ev:m[1] === 'draws' ? 'draw' : 'gain', subj:'any', ctl:'opp', desc:''};
  if ((m = c.match(/^(.+?) (enters|enter|dies|die|attacks|attack|leaves the battlefield|leave the battlefield|is put into a graveyard from the battlefield|are put into a graveyard from the battlefield)\b/))){
    const ev = {enters:'enter', enter:'enter', dies:'die', die:'die', attacks:'attack', attack:'attack', 'leaves the battlefield':'leave', 'leave the battlefield':'leave', 'is put into a graveyard from the battlefield':'die', 'are put into a graveyard from the battlefield':'die'}[m[2]];
    const sj = subjOf(m[1]); if (!sj) return null;
    if (/under your control/.test(c)) sj.ctl = 'you'; else if (/under an opponent's control/.test(c)) sj.ctl = 'opp';
    if (/^one or more/.test(m[1])) sj.batch = true;
    return {ev, ...sj};
  }
  if ((m = c.match(/^(you|an opponent|a player|each opponent) casts? (.+)$/))){
    const d = m[2].replace(/^(an?|your first|your second|their first) /, '').replace(/\bspells?\b.*$/, '').trim();
    if (/^~/.test(d)) return null;
    const nth = /\b(?:their|your) second spell each turn\b/.test(m[2]) ? 2 : /\b(?:their|your) third spell each turn\b/.test(m[2]) ? 3 : /\b(?:their|your) first spell each turn\b/.test(m[2]) ? 1 : 0;
    return {ev:'cast', subj:'any', ctl: m[1] === 'you' ? 'you' : m[1] === 'a player' ? 'any' : 'opp', desc:nth ? '' : d, nth};
  }
  return null;
}
const TRIG_CACHE = new Map();
function trigsOf(k, fl){
  const key = k + (fl ? '|b' : ''); if (TRIG_CACHE.has(key)) return TRIG_CACHE.get(key);
  const a = info(k); const f = a ? (fl && a.back ? a.back : a) : null; const out = [];
  const lines = []; if (f) for (const l of tname(f.o, f.n).split('\n')){ if (/^\s*•/.test(l) && lines.length) lines[lines.length - 1] += '\n' + l.trim(); else lines.push(l); }
  for (const line of lines){
    const m = line.trim().match(/^(when|whenever|at) (.+?), ([\s\S]+)$/i); if (!m) continue;
    const cl = classifyTrig(m[1].toLowerCase(), m[2].toLowerCase().trim()); if (!cl) continue;
    cl.eff = m[3].trim(); cl.raw = line.trim(); out.push(cl);
  }
  if (a) TRIG_CACHE.set(key, out);
  return out;
}
function subjMatch(t, src, ev, pid){
  const self = pid === MYPID && ev.id === src.id;
  if (t.subj === 'self') return self;
  if (t.subj === 'selfOr' && self) return true;
  if (t.subj === 'other' && self) return false;
  if (t.ctl === 'you' && pid !== MYPID) return false;
  if (t.ctl === 'opp' && pid === MYPID) return false;
  return !t.desc || descOk(ev.k, t.desc, {tok:ev.tok});
}
function handleEvent(pid, ev){
  if (!S) return;
  const srcs = S.bf.filter(b => !b.fd).map(b => ({k:b.k, fl:b.fl, id:b.id})).concat(S.cz.filter(b => /command zone/i.test(info(b.k)?.o || '')).map(b => ({k:b.k, fl:false, id:b.id, cz:true})));
  if (pid === MYPID && (ev.type === 'die' || ev.type === 'leave') && !srcs.some(s => s.id === ev.id)) srcs.push({k:ev.k, fl:false, id:ev.id, gone:true});
  for (const s of srcs){
    for (const t of trigsOf(s.k, s.fl)){
      if (t.ev !== ev.type && !(t.evs && t.evs.includes(ev.type))) continue;
      if (s.gone && t.subj !== 'self' && t.subj !== 'selfOr') continue;
      if (s.cz && !/command zone/i.test(t.raw)) continue;
      if ((ev.type === 'dmg' || ev.type === 'cdmg') && (t.subj === 'self' || t.subj === 'other') && !subjMatch(t, s, ev, pid)) continue;   // "~ deals damage" is only its own damage (v23)
      let evT = ev; if (t.batch){ const nq = (UI.curQ || []).filter(([p2, e2]) => e2.type === ev.type && p2 === pid && (!t.desc || descOk(e2.k, t.desc, {tok:e2.tok}))).reduce((a, x) => a + (x[1].cnt || 1), 0); evT = {...ev, amt:nq || 1, cnt:1}; }
      if (t.batch){ const bk = s.id + '|' + t.raw; UI.batch = UI.batch || new Set(); if (UI.batch.has(bk)) continue; UI.batch.add(bk); }
      if (ev.type === 'draw' || ev.type === 'gain' || ev.type === 'scry'){ if (t.ctl === 'you' && pid !== MYPID) continue; if (t.ctl === 'opp' && pid === MYPID) continue; if (t.nth && (ev.nth || 0) !== t.nth) continue; }
      else if (ev.type === 'dmg' || ev.type === 'cdmg'){ if (t.toYou && ev.dp !== MYPID) continue; if (t.toPlayer && !ev.dp) continue; if (t.oppOnly && (!ev.dp || ev.dp === pid)) continue; }
      else if (ev.type === 'cast'){ if (t.nth && (ev.nth || 0) !== t.nth) continue; if (t.ctl === 'you' && pid !== MYPID) continue; if (t.ctl === 'opp' && pid === MYPID) continue; if (t.desc && !descOk(ev.k, t.desc)) continue; }
      else if (!subjMatch(t, s, ev, pid)) continue;
      const times = Math.min((evT.cnt || 1) * trigMult(ev, s), 30);
      for (let i = 0; i < times; i++) pushTrigger(s, t, evT, pid);
    }
  }
  if (pid === MYPID && ev.type === 'die' && !ev.tok) checkUndying(ev);
}
function pushTrigger(src, t, ev, evPid){
  const a = info(src.k); const f = a ? (src.fl && a.back ? a.back : a) : null; if (!f) return;
  const it = {sid:rid(6), o:nextO(), kind:'trigger', k:src.k, nm:f.n, txt:t.eff, srcId:src.id, evk:ev ? ev.k : null, evPid:evPid || null, evId:ev ? ev.id : null, evX:ev && ev.x != null ? ev.x : null, evDp:ev && ev.dp ? ev.dp : null};
  S.stk.push(it); S.pass = 's:' + it.sid;
  log(`trigger: ${f.n} — ${short(String(t.eff).replace(/~/g, f.n), 90)}`); commit();
}
function fireSteps(step, activePid){
  const mineTurn = activePid === MYPID;
  if (step === 'end' && S.dly.length){ const list = S.dly.splice(0); list.forEach(d => { const it = {sid:rid(6), o:nextO(), kind:'trigger', k:d.k, nm:d.nm, txt:d.eff, srcId:d.srcId, op:d.op === 'exile' ? 'dly' : undefined, dop:d.op, rpid:d.rpid}; S.stk.push(it); S.pass = 's:' + it.sid; log(`delayed trigger: ${d.nm} — ${short(d.eff, 80)}`); }); }
  S.bf.concat(S.cz.filter(b => /command zone/i.test(info(b.k)?.o || '')).map(b => ({...b, czSrc:true}))).forEach(b => {
    if (b.fd) return;
    trigsOf(b.k, b.fl).forEach(t => {
      if (t.ev !== 'step' || t.step !== step || t.whose === 'next') return;
      if (b.czSrc && !/command zone/i.test(t.raw)) return;
      if (t.whose === 'your' && !mineTurn) return;
      if (t.whose === 'opp' && mineTurn) return;
      pushTrigger({k:b.k, id:b.id, fl:b.fl}, t, null, activePid);
    });
  });
}
function checkUndying(ev){
  const c = S.gy.find(g => g.id === ev.id); if (!c) return;
  const f = faceOf(c) || info(c.k); if (!f || !/\bCreature\b/.test(f.t)) return;
  const und = hasKwText(f, 'undying') || grantedKw(c, 'undying') === true;
  const per = hasKwText(f, 'persist') || grantedKw(c, 'persist') === true;
  let op = null;
  if (und && !(ev.cp > 0)) op = 'cp'; else if (per && !(ev.cm > 0)) op = 'cm';
  if (!op) return;
  const it = {sid:rid(6), o:nextO(), kind:'trigger', k:c.k, nm:f.n, txt:`Return it to the battlefield with a ${op === 'cp' ? '+1/+1' : '−1/−1'} counter (${op === 'cp' ? 'undying' : 'persist'}).`, srcId:c.id, op:'return', ctr:op};
  S.stk.push(it); S.pass = 's:' + it.sid; log(`trigger: ${f.n} — ${op === 'cp' ? 'undying' : 'persist'}`); commit();
}

/* ---------- Resolving ---------- */
function toGrave(c, it){
  faceRestore(c);
  if (!c.cmd && gyReplace(c, 'stack') === 'ex'){ c.fl = false; S.ex.push(c); log(`${cname(c)} was exiled instead of going to the graveyard`); return; }
  if (it && it.exAfter){ c.fl = false; S.ex.push(c); log(`${cname(c)} was exiled`); return; }
  if (c.cmd){ if (UI.cmdz){ S.cz.push(c); log(`${cname(c)} went to the command zone`); } else { S.gy.push(c); cmdRedirect(c, 'stack', 'gy'); } }
  else S.gy.push(c);
}
async function resolveTop(it){
  if (UI.resolving) return;
  const i = S.stk.indexOf(it); if (i < 0) return;
  UI.resolving = true; clearUndo();
  try {
    S.stk.splice(i, 1);
    if (it.kind === 'spell' && it.copy){
      if (it.tgts && it.tgts.flat().length && !it.tgts.flat().some(targetStillThere)){ log(`${it.nm} fizzled — its targets are gone`); commit(); return; }
      log(`${it.nm} resolved`); commit();
      await runEffects(info(it.k)?.o || it.txt, {k:it.k, name:info(it.k)?.n || it.nm, it, tgts:it.tgts, full:info(it.k)?.o || it.txt}); commit(); return;
    }
    if (it.kind === 'spell'){
      const c = it.card; const a = info(c.k);
      if (it.tgt && !stackAll().some(x => x.sid === it.tgt)){ log(`${a.n} fizzled — its target is gone`); toGrave(c, it); commit(); return; }
      if (it.tgts && it.tgts.flat().length && !it.tgts.flat().some(targetStillThere)){ log(`${a.n} fizzled — its targets are gone`); toGrave(c, it); commit(); return; }
      if (isPermType(a.t)){
        c.tap = false; if (it.flip) c.fl = true;
        faceEnter(c);
        await cloneChoice(c, a);
        if (/\bAura\b/.test(a.t) && it.tgts && it.tgts.flat().length){ const t = it.tgts.flat().find(targetStillThere); if (t) c.att = {pid:t.pid, id:t.id}; }
        if (it.pos){ c.x = it.pos.x; c.y = it.pos.y; } else place(c);
        S.bf.push(c); log(`${a.n} resolved`);
        onEnter(c, 'stack', {x:it.x, evoke:it.evoke});
        commit();
      } else {
        log(`${a.n} resolved`); commit();
        await runEffects(a.o, {k:c.k, name:a.n, it, card:c, tgts:it.tgts, full:a.o});
        if (!advExile(c, it)) toGrave(c, it); commit();
      }
    } else if (it.op === 'return'){
      const c = S.gy.find(g => g.id === it.srcId);
      if (!c){ log(`${it.nm} is no longer in the graveyard`); commit(); return; }
      S.gy.splice(S.gy.indexOf(c), 1); reset(c); place(c); S.bf.push(c); if (it.ctr === 'cm') f24cmAdd(c, 1); else c[it.ctr] = 1;
      log(`${it.nm} returned with a ${it.ctr === 'cp' ? '+1/+1' : '−1/−1'} counter`); onEnter(c, 'gy', {}); commit();
    } else if (it.op === 'evokeSac'){
      const [z,,c] = find(it.srcId); if (z === 'bf'){ log(`sacrificed ${c ? cname(c) : it.nm} (evoke)`); moveCard(it.srcId, 'gy', {sac:true, quiet:true}); }
      commit();
    } else if (it.op === 'unearth'){
      const c = S.gy.find(g => g.id === it.srcId);
      if (c){ moveCard(c.id, 'bf', {quiet:true}); c.ekw = ['haste']; c.unearth = 1; S.dly.push({id:rid(6), eff:'Exile it (unearth).', k:c.k, nm:cname(c), srcId:c.id, op:'exile'}); log(`${cname(c)} returned with haste (unearth)`); }
      commit();
    } else if (it.op === 'loop'){
      log(`${it.nm} resolves`); commit(); UI.resolving = false; await runLoop(it.n);
    } else if (it.op === 'dly' && it.dop === 'exile'){
      const [z] = find(it.srcId); if (z === 'bf') moveCard(it.srcId, 'ex'); commit();
    } else {
      if (it.kind !== 'spell' && it.tgts && it.tgts.flat().length && !it.tgts.flat().some(targetStillThere)){ log(`${it.nm}: fizzled — its targets are gone`); commit(); return; }
      if (it.kind === 'trigger' && !it.tgts && targetSpecs(it.txt).length){ it.tgts = await chooseTargets(it.txt, {pid:MYPID, col:info(it.k)?.c, types:info(it.k)?.t, id:it.srcId}, it.nm); if (it.tgts == null){ log(`${it.nm}: no target chosen`); commit(); return; } }
      log(`${it.nm}: ${it.kind === 'trigger' ? 'trigger' : 'ability'} resolved${it.tgts && tgtLabel(it.tgts) ? ' → ' + tgtLabel(it.tgts) : ''}`); commit();
      await runEffects(it.txt, {k:it.k, name:it.copy ? (info(it.k)?.n || it.nm) : it.nm, it, srcId:it.srcId, tgts:it.tgts, full:it.txt});
      if (it.op === 'saga' && it.final) sagaDone(it);
      commit();
    }
  } catch (e){ console.warn(e); log('⚠ something went wrong resolving that — finish it by hand'); commit(); }
  finally { UI.resolving = false; queueRender(); }
}
function counterMine(it, byPid){
  const i = S.stk.indexOf(it); if (i < 0) return;
  S.stk.splice(i, 1);
  log(`${it.nm} was countered${byPid && byPid !== MYPID ? ' by ' + nameOf(byPid) : ''}`);
  if (it.kind === 'spell' && it.card) toGrave(it.card, it);
  commit();
}
function addUnlessPrompt(it, n, from){
  it.hold = true;
  S.prm.push({id:rid(6), type:'unless', sid:it.sid, n, from, left:CHOICE_MS});
  commit();
}
function resolvePrompt(p, pay){
  const i = S.prm.indexOf(p); if (i < 0) return;
  const it = S.stk.find(x => x.sid === p.sid);
  if (pay){
    const plan = payPlan(parseCost(`{${p.n}}`), S.pool); if (plan.err){ toast(`You need ${p.n} mana in your pool: ${plan.err}`); return; }
    S.pool = plan.pool; S.prm.splice(i, 1); if (it){ it.hold = false; log(`paid {${p.n}} — ${it.nm} isn't countered`); }
    commit(); return;
  }
  S.prm.splice(i, 1);
  if (it){ it.hold = false; log(`didn't pay {${p.n}}`); counterMine(it, p.from); } else commit();
}
function applyCounterRecords(pid, list){
  const done = S.done[pid] ||= [];
  for (const r of list || []){
    if (done.includes(r.id)) continue;
    const it = S.stk.find(x => x.sid === r.sid); if (!it) continue;
    done.push(r.id);
    if (r.un) addUnlessPrompt(it, r.un, pid); else counterMine(it, pid);
  }
  if (done.length > 80) done.splice(0, done.length - 80);
}
function applyRequests(pid, list){
  const done = S.done[pid] ||= []; let ch = false;
  for (const r of list || []){
    if (r.to !== MYPID || done.includes(r.id)) continue;
    done.push(r.id); ch = true;
    applyOp({...r}, pid);
  }
  if (done.length > 80) done.splice(0, done.length - 80);
  if (ch){ clearUndo(); commit(); }
}
function onRemoteState(pid, s){
  if (!S) return;
  const maxN = (s.ev || []).reduce((m, e) => Math.max(m, e.n), 0);
  const seen = S.evSeen[pid];
  if (seen == null || maxN < seen) S.evSeen[pid] = maxN;
  else { (s.ev || []).filter(e => e.n > seen).sort((a, b) => a.n - b.n).forEach(e => UI.evq.push([pid, e])); S.evSeen[pid] = maxN; }
  if (!S.seenP[pid]){ // first time I see this player: whatever they sent before I sat down is history
    S.seenP[pid] = 1; const done = S.done[pid] ||= [];
    (s.rq || []).forEach(r => done.push(r.id)); (s.ctr || []).forEach(r => { if (!S.stk.some(x => x.sid === r.sid)) done.push(r.id); });
  }
  applyCounterRecords(pid, s.ctr);
  { const pn = phaseNow(); if (pn.ph === 4 && !pn.mine) defenderTick(pn); }   // combat damage is simultaneous: deal mine before taking theirs
  applyRequests(pid, s.rq);
  queueMicrotask(processEvents);
}
// S.rq is published as its last 30 entries, and publishing is debounced to the end of a resolution: before a 31st unpublished
// request would push the oldest unseen one out of that window, publish now (receivers skip ids they already applied)
function sendRq(to, op, n, src, extra={}){ if (NET.peer && (NET.rqP || 0) >= 30){ try { publish(); } catch (e){ console.warn(e); } } S.rq.push({id:rid(8), to, op, n, src, ...extra}); NET.rqP = (NET.rqP || 0) + 1; if (UI.rec && op === 'life' && n < 0) UI.rec.loss[to] = (UI.rec.loss[to] || 0) - n; if (S.rq.length > 30) S.rq.splice(0, S.rq.length - 30); }
const opponents = () => players().filter(p => !p.me);

/* ---------- Effects read from rules text ---------- */
// keyword lines of instants and sorceries that do nothing when the spell resolves: their work happens while casting, from
// another zone, or is a cost (typecycling, foretell, miracle, plot, retrace, jump-start, dredge, casualty, improvise …).
// Lines that DO something on resolution (gift, cipher, ascend, rebound, amass, demonstrate) are not skipped.
// The deck checker asks this same function (fix18c.js), so it agrees with what happens in play.
const SPELL_KW_SKIP = [
  /^(?:basic )?(?:land|[a-z]+)?cycling\s*(?:(?:\{[^}]+\})+|—.+)$/i,
  /^(?:foretell|miracle|plot|spectacle|transmute|freerunning|web-slinging|prowl|surge|harmonize|sneak|dash|blitz|buyback|replicate|escalate|madness|mayhem|warp|splice onto arcane|emerge(?: from \w+)?|disturb|escape|flashback|kicker|multikicker|entwine|overload|evoke|cleave)\s*(?:(?:\{[^}]+\})+(?: and\/or (?:\{[^}]+\})+)?|—.+)$/i,
  /^suspend (?:\d+|x)\s*—\s*(?:\{[^}]+\})+$/i,
  /^(?:retrace|jump-start|improvise|aftermath|fuse|bargain|split second|convoke|delve|storm|cascade(?:, cascade)*|dredge \d+|casualty \d+|affinity for [a-z ]+)$/i,
];
function spellKwSkip(l){ const t = String(l || '').trim().replace(/\.$/, ''); return SPELL_KW_SKIP.some(r => r.test(t)); }
const KW_LINE = /^(kicker|multikicker|flashback|buyback|entwine|cycling|evoke|overload|madness|escape|convoke|delve|affinity|storm|cascade|ward|equip|enchant|protection|split second|flash|flying|haste|trample|vigilance|lifelink|deathtouch|reach|menace|first strike|double strike|hexproof|indestructible|defender|undying|persist|prowess|changeling|shroud|devoid)\b/i;
async function runEffects(txt, ctx){
  txt = await modalText(txt, ctx);
  const t = tname(txt, ctx.name || info(ctx.k)?.n || '');
  const spell = ctx.it && ctx.it.kind === 'spell';
  const sentences = [];
  for (const raw of t.split('\n')){
    const l = raw.trim(); if (!l) continue;
    if (spell && (/^(when|whenever|at the beginning)\b/i.test(l) || /^[^.]*?:\s/.test(l))) continue;
    if (/^[a-z ]+(?:, [a-z ]+)*$/i.test(l) && l.split(/,\s*/).every(w => KW_LINE.test(w.trim()))) continue;
    if (/^(kicker|multikicker|flashback|buyback|entwine|cycling|evoke|overload|madness|escape|ward|equip|enchant|protection from|affinity for|cascade|storm|convoke|delve)\b/i.test(l) && !/\.\s+\w/.test(l)) continue;
    if (spell && spellKwSkip(l)) continue;
    l.split(/(?<=\.)\s+(?=[A-Z~])/).forEach(s => s.split(/,? then (?=[a-z~])/i).forEach((p, i) => sentences.push((i ? cap(p) : p).trim())));
  }
  for (const s of sentences){
    // "~ gets +N/+N until end of turn" in an effect is a real pump; only static self-lines are skipped
    if (/~ can't be countered|rather than pay|cast ~ without paying|^~ (costs|has)|^as an additional cost/i.test(s) || (/^~ gets/i.test(s) && !/until end of turn|this turn|until your next turn/i.test(s))) continue;
    if (ctx.looked && /\b(them|those cards|the rest|of them|that card|cards revealed|revealed this way|the other|any order)\b/i.test(s) && !/^draw\b/i.test(s)) continue;
    try { await doSentence(s, ctx); } catch (e){ console.warn(e); handWarn(s, ctx); }
  }
}
function handWarn(s, ctx){
  const t = ctx && ctx.name ? String(s).replace(/~/g, ctx.name) : s;
  log(`⚠ do by hand: ${short(t, 130)}`);
  if (UI.replay) return;
  UI.notes = (UI.notes || []).concat({id:rid(5), name:ctx && ctx.name, text:t}).slice(-5);
  toast('The game could not do part of this card by itself — see the box on the right'); renderStackPanel();
}
// X is known when it was chosen: any value > 0, or 0 on a spell with {X} in its cost (chosen, or 0 because it was cast without paying
// its mana cost, CR 107.3b) or on an ability whose cost had {X}
function xKnown(ctx){ const it = ctx && ctx.it; if (!it || it.x == null) return false; if (it.x > 0 || it.xSet) return true;
  return it.kind === 'spell' && /\{X\}/i.test(info(it.k)?.m || ''); }
async function numOf(w, ctx, what){
  let n = wn(w, ctx.it ? ctx.it.x : undefined);
  if (n == null || (String(w).toLowerCase() === 'x' && !xKnown(ctx))){ n = await askNumber(`${ctx.name}: how many? (${what})`, '', 1); }
  return n || 0;
}
async function choosePlayer(title, oppOnly){
  const list = oppOnly ? opponents() : players();
  if (!list.length) return null;
  if (list.length === 1) return list[0].pid;
  return askChoice({title, options:list.map(p => ({label:p.me ? `${p.nm} (you)` : p.nm, value:p.pid}))});
}
async function loseLife(pid, n, src){
  if (!pid) return;
  if (pid === MYPID){ S.life -= n; log(`lost ${n} life (${src})`); }
  else { sendRq(pid, 'life', -n, src); log(`${nameOf(pid)} loses ${n} life (${src})`); }
}
async function doSentence(s0, ctx){
  let s = s0.replace(/\.$/, '').trim(); const l = s.toLowerCase(); let m;
  if (!l) return;
  if (await doRound8Pre(s, l, ctx)) return;
  if (await doRound7Pre(s, l, ctx)) return;
  if (await doRound6Pre(s, l, ctx)) return;
  if ((m = l.match(/^(?:then )?you may (.+)$/))){
    if (!(await askYes(`${ctx.name}: ${cap(s)}?`, 'Yes', 'No'))){ ctx.mayYes = false; log(`chose not to: ${short(s, 80)}`); return; }
    ctx.mayYes = true; ctx.didPay = null;
    return doSentence(cap(s.replace(/^(then )?you may /i, '')), ctx);
  }
  if (/\b and (you|each|draw|create|target|put|scry|mill)\b/.test(l) && !/^search|^create .* tokens? with|^counter/.test(l)){
    const parts = s.split(/ and (?=(?:you|each|draw|create|target|put|scry|mill) )/i);
    if (parts.length > 1){ for (const p of parts) await doSentence(p, ctx); return; }
  }
  if (/^counter target/.test(l)) return resolveCounter(ctx);
  if ((m = l.match(/^if it's the first combat phase of the turn, (.+)$/))){ if (S.cb && S.cb.n > 1){ log(`${ctx.name}: not the first combat — nothing happens`); return; } return doSentence(cap(s.replace(/^if it's the first combat phase of the turn, /i, '')), ctx); }
  if (await doRound5Text(s, l, ctx)) return;
  if (await doTargeted(s, l, ctx)) return;
  if (await doCombatText(s, l, ctx)) return;
  if ((m = l.match(/^(?:~|it) deals (\d+|x) damage to each opponent$/)) || (m = l.match(/^each opponent loses (\d+|x) life$/))){
    const n = await numOf(m[1], ctx, 'life'); for (const p of opponents()) await loseLife(p.pid, n, ctx.name); if (!opponents().length) log(`each opponent loses ${n} life (nobody else is here)`); return;
  }
  if ((m = l.match(/^(?:~|it) deals (\d+|x) damage to each player$/)) || (m = l.match(/^each player loses (\d+|x) life$/))){
    const n = await numOf(m[1], ctx, 'life'); for (const p of players()) await loseLife(p.pid, n, ctx.name); return;
  }
  if ((m = l.match(/^(?:~|it) deals (\d+|x) damage to you$/))){ const n = await numOf(m[1], ctx, 'damage'); S.life -= n; log(`took ${n} damage from ${ctx.name}`); return; }
  if ((m = l.match(/^target (player|opponent) loses (\d+|x) life$/))){ const n = await numOf(m[2], ctx, 'life'); const ts = ctx.tgts ? nextTargets(ctx).filter(t => t.t === 'player') : []; const pids = ts.length ? ts.map(t => t.pid) : [await choosePlayer(`${ctx.name}: which opponent loses ${n} life?`, true)]; for (const pid of pids) await loseLife(pid, n, ctx.name); return; }
  if ((m = l.match(/^(?:you )?gain (\d+|x|one|two|three|four|five) life$/))){ const n = await numOf(m[1], ctx, 'life'); if (gainLife(n, ctx.name)) log(`gained ${n} life → ${S.life}`); return; }
  if ((m = l.match(/^you lose (\d+|x|one|two|three) life$/))){ const n = await numOf(m[1], ctx, 'life'); S.life -= n; log(`lost ${n} life → ${S.life}`); return; }
  if ((m = l.match(/^(?:you )?draws? (a|an|one|two|three|four|five|six|seven|x|\d+) cards?$/))){ draw(await numOf(m[1], ctx, 'cards')); return; }
  if ((m = l.match(/^each player draws (a|an|one|two|three|four|five|six|seven|x|\d+) cards?$/))){ const n = await numOf(m[1], ctx, 'cards'); draw(n); opponents().forEach(p => sendRq(p.pid, 'draw', n, ctx.name)); return; }
  if ((m = l.match(/^target player draws (a|an|one|two|three|x|\d+) cards?$/))){ const n = await numOf(m[1], ctx, 'cards'); const ts = ctx.tgts ? nextTargets(ctx) : []; const pid = ts.length ? ts[0].pid : await choosePlayer(`${ctx.name}: who draws?`); if (pid === MYPID) draw(n); else if (pid){ sendRq(pid, 'draw', n, ctx.name); log(`${nameOf(pid)} draws ${n}`); } return; }
  if (/^create\b/.test(l)) return createFromText(s, ctx);
  if ((m = l.match(/^scry (\d+|x|one|two|three)$/))){ const n = await numOf(m[1], ctx, 'scry'); log(`scry ${n}`); emit({type:'scry', cnt:1, x:n}); await lookTopAwait(n, 'Scry', ['lib','libb'], 'Keep on top (in the order you click Top) or send to the bottom.'); return; }
  if ((m = l.match(/^surveil (\d+|x|one|two|three)$/))){ const n = await numOf(m[1], ctx, 'surveil'); log(`surveil ${n}`); await lookTopAwait(n, 'Surveil', ['lib','gy'], 'Keep on top or put into your graveyard.'); return; }
  if ((m = l.match(/^(?:you )?mills? (a|one|two|three|four|five|x|\d+) cards?$/))){ mill(await numOf(m[1], ctx, 'cards')); return; }
  if ((m = l.match(/^each player mills (a|one|two|three|four|five|x|\d+) cards?$/))){ const n = await numOf(m[1], ctx, 'cards'); mill(n); opponents().forEach(p => sendRq(p.pid, 'mill', n, ctx.name)); return; }
  if ((m = s.match(/^search your library for (.+?), (.+)$/i))) return searchLibrary(m[1], m[2], ctx);
  if ((m = l.match(/^add (.+)$/))){
    const outs = manaOuts('Add ' + s.replace(/^add /i, '')); if (!outs.length){ handWarn(s0, ctx); return; }
    let o = outs[0]; if (outs.length > 1){ const v = await askChoice({title:`${ctx.name}: add which mana?`, options:outs.map((x, i) => ({label:x.join(''), html:manaHTML(x.map(c => '{' + c + '}').join('')), value:i}))}); if (v == null) return; o = outs[v]; }
    addMana(o); log(`added ${o.map(x => '{' + x + '}').join('')} to their pool`); return;
  }
  if ((m = l.match(/^put (a|an|one|two|three|four|five|x|\d+) (\+1\/\+1|-1\/-1) counters? on (.+)$/))){
    const n = await numOf(m[1], ctx, 'counters'); const kind = m[2] === '+1/+1' ? 'cp' : 'cm'; const where = m[3];
    let targets = [];
    if (where === '~' || where === 'it'){ const [z,,c] = find(ctx.srcId ?? -1); if (z === 'bf') targets = [c]; }
    else if (/^each (other )?creature you control$/.test(where)) targets = S.bf.filter(b => !b.fd && isCreatureCard(b) && !(/other/.test(where) && b.id === ctx.srcId));
    else if (/^target creature you control$/.test(where) || (/^target creature$/.test(where) && !OPP.size)){ const ids = await pickCards({title:`${ctx.name}: put ${n} ${m[2]} counter${n > 1 ? 's' : ''} on…`, cards:S.bf.filter(b => !b.fd && isCreatureCard(b)), min:0, max:1}); targets = (ids || []).map(id => find(id)[2]).filter(Boolean); }
    else { handWarn(s0, ctx); return; }
    targets.forEach(c => { modCounters(c, kind, n); });
    if (targets.length) log(`put ${n} ${m[2]} counter${n > 1 ? 's' : ''} on ${targets.length === 1 ? cname(targets[0]) : targets.length + ' creatures'}`);
    return;
  }
  if (/^untap ~$/.test(l)){ const [z,,c] = find(ctx.srcId ?? -1); if (z === 'bf'){ c.tap = false; log(`untapped ${cname(c)}`); } return; }
  if (/^sacrifice ~$/.test(l)){ const [z,,c] = find(ctx.srcId ?? -1); if (z === 'bf') sacrificeOne(c); return; }
  if ((m = l.match(/^put (?:an?|one) (.+?) card from your hand onto the battlefield( tapped)?( and attacking)?/))){
    const list = S.hand.filter(h => descOk(h.k, m[1]));
    if (!list.length){ log(`has no ${m[1]} card in hand to put onto the battlefield`); return; }
    const ids = await pickCards({title:`${ctx.name}: put a ${m[1]} card onto the battlefield${m[2] ? ' tapped' : ''}${m[3] ? ' and attacking' : ''}`, cards:list, min:0, max:1});
    const src = ctx.srcId != null ? find(ctx.srcId)[2] : null;
    for (const id of ids || []){ const [,,c] = find(id); if (!c) continue; moveCard(id, 'bf', {quiet:true}); if (m[2]) c.tap = true; if (m[3]) c.atk = (src && src.atk) || (defOpts()[0] || {}).key || ''; ctx.lastCardId = c.id; log(`put ${cname(c)} onto the battlefield${m[2] ? ' tapped' : ''}${m[3] ? ' and attacking ' + defLabel(c.atk) : ''}`); }
    return;
  }
  if (/^(then )?shuffle( your library)?$/.test(l)){ shuffleLib(); return; }
  if (/^proliferate$/.test(l)){ await proliferate(ctx.name); return; }
  handWarn(s0, ctx);
}
async function resolveCounter(ctx){
  const it = ctx.it; if (!it || !it.tgt) { handWarn('Counter target …', ctx); return; }
  const tgt = stackAll().find(x => x.sid === it.tgt);
  if (!tgt){ log(`${it.nm} fizzled — its target is gone`); return; }
  const cs = counterSpec(tname(info(it.k)?.o, it.nm)); const leg = counterLegal(tgt, cs);
  if (!leg.ok){ log(`${it.nm} fizzled — ${leg.why}`); return; }
  let un = cs.un; if (un === 'x') un = it.x || 0;
  log(un ? `${tgt.nm} is countered unless ${tgt.pid === MYPID ? 'they pay' : nameOf(tgt.pid) + ' pays'} {${un}}` : `countered ${tgt.nm}`);
  if (!un && tgt.kind === 'spell') emit({type:'countered', k:it.k, id:0});
  if (tgt.pid === MYPID){ if (un) addUnlessPrompt(tgt.it, un, MYPID); else counterMine(tgt.it, MYPID); }
  else { S.ctr.push({id:rid(8), sid:tgt.sid, un}); if (S.ctr.length > 20) S.ctr.splice(0, S.ctr.length - 20); }
}
// Tokens the game can build by itself when Scryfall has no match (or can't be reached): the predefined tokens (CR 111.10)
// with their real abilities, and Role tokens. Creature tokens are built from "N/N color Type creature token with …".
const PREDEF_TOK = {
  treasure:['Artifact — Treasure', '{T}, Sacrifice this token: Add one mana of any color.'],
  food:['Artifact — Food', '{2}, {T}, Sacrifice this token: You gain 3 life.'],
  clue:['Artifact — Clue', '{2}, Sacrifice this token: Draw a card.'],
  map:['Artifact — Map', '{1}, {T}, Sacrifice this token: Target creature you control explores. Activate only as a sorcery.'],
  blood:['Artifact — Blood', '{1}, {T}, Discard a card, Sacrifice this token: Draw a card.'],
  gold:['Artifact — Gold', 'Sacrifice this token: Add one mana of any color.'],
  powerstone:['Artifact — Powerstone', "{T}: Add {C}. This mana can't be spent to cast a nonartifact spell."],
  junk:['Artifact — Junk', '{T}, Sacrifice this token: Exile the top card of your library. You may play that card this turn. Activate only as a sorcery.'],
  lander:['Artifact — Lander', '{2}, {T}, Sacrifice this token: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.'],
  mutagen:['Artifact — Mutagen', '{1}, {T}, Sacrifice this token: Put a +1/+1 counter on target creature. Activate only as a sorcery.'],
  shard:['Enchantment — Shard', '{2}, Sacrifice this token: Scry 1, then draw a card.'],
  walker:['Creature — Zombie', '', '2/2', 'B'],
};
function predefToken(desc, name){
  const d = String(desc || '').trim(); let mm;
  if ((mm = d.match(/^(cursed|monster|royal|sorcerer|virtuous|wicked|young hero) role$/i)) && typeof r26RoleKey === 'function') return r26RoleKey(mm[1].toLowerCase());
  if (/^incubator$/i.test(d) && typeof g23incubate === 'function'){ const k0 = customToken('Incubator', '', ''); const k = k0 + '|g23inc'; if (!DICT.has(k)) DICT.set(k, {...DICT.get(k0), k, n:'Incubator', t:'Token Artifact — Incubator', p:'', o:'{2}: Transform this artifact.'}); return k; }
  const w = d.toLowerCase(); const p = PREDEF_TOK[w]; if (!p) return null;
  const nm = cap(w); const k = 'pre:' + w;
  if (!DICT.has(k)) DICT.set(k, {k, n:nm, m:'', t:'Token ' + p[0], o:p[1], p:p[2] || '', img:'', c:p[3] || '', back:null, toks:[], tok:true, cc:false, lay:'token', full:nm, set:'', cn:'', pr:'', art:'', mv:0, ci:p[3] || '', kw:[]});
  return k;
}
async function createFromText(s, ctx){
  const xpt = v => /^x$/i.test(v) ? String((ctx && ctx.it && ctx.it.x) || 0) : v;
  const m = s.replace(/^create a number of /i, 'create ').match(/^create (?:(a|an|one|two|three|four|five|six|seven|eight|nine|ten|x|\d+)\s+)?(tapped )?(.+?) tokens?\b(.*)$/i);
  if (!m){ handWarn(s, ctx); return; }
  const rest = (m[4] || '').toLowerCase(); let n;
  if (/^create a number of /i.test(s)){ n = /that card's mana value/.test(rest) && ctx.lastMV != null ? ctx.lastMV : await askNumber(`${ctx.name}: how many tokens? (${short(rest.trim(), 70)})`, '', 1); if (n == null) return; }
  else if (String(m[1] || '').toLowerCase() === 'x'){
    const w = rest.match(/where x is the number of ([a-z]+?)s? you control/);
    if (w){ const re = new RegExp('\\b' + w[1] + 's?\\b', 'i'); n = 0; S.bf.forEach(b => { if (!b.fd && re.test(typeOf(b))) n += (b.n || 1); }); }
    else { const wx = rest.match(/,? where x is (.+?)\.?$/); const cx = wx && !xKnown(ctx) ? countOf(wx[1], ctx) : null; n = cx != null ? cx : await numOf('x', ctx, 'tokens'); }
  } else { const w0 = wn(m[1] || 'a'); n = w0 == null ? 1 : w0; }   // "Create 0 … tokens" (X computed as 0) makes none
  if (/for each/.test(rest.replace(/["“][^"”]*["”]/g, ''))) n = await askNumber(`${ctx.name}: how many tokens? (${short(rest.trim(), 60)})`, '', n);
  if (!n){ log(`created no tokens`); return; }
  const desc = m[3];
  const src = info(ctx.k); const ids = (src?.toks || []).map(t => t.id);
  if (ids.length) await ensureTokens(ids);
  const cand = ids.filter(id => DICT.has(id)); let k = null;
  const nd = norm(desc);
  if (cand.length === 1) k = cand[0];
  else if (cand.length > 1) k = cand.find(id => { const a = info(id); return nd.includes(norm(a.n)) && (!a.p || nd.includes(a.p)); }) || cand.find(id => nd.includes(norm(info(id).n)));
  if (!k){
    const pm = desc.match(/(\d+|X)\/(\d+|X) ((?:(?:white|blue|black|red|green|colorless)(?:,? and |, | )?)*)([A-Z][\w' -]*?) (?:artifact |enchantment )*creature/);
    const am = desc.match(/^([A-Z][a-z]+)$/) || desc.match(/\b([A-Z][a-z]+)(?: artifact)?$/);
    const nmd = (String(desc) + ' ' + String(m[4] || '')).match(/\bnamed ([A-Z][\w'’ -]*?)(?= with\b| that\b|,|\.|$)/);   // "… token named Sword"
    const name = nmd ? nmd[1].trim() : pm ? pm[4] : am ? am[1] : null;
    if (!name){ handWarn(s, ctx); return; }
    const pt = pm ? `${pm[1]}/${pm[2]}` : '';
    const cols = pm ? (pm[3] || '').toLowerCase().split(/[ ,]+/).map(w => COLW[w]).filter(Boolean).join('') : '';
    try { k = await searchToken(`t:token !"${name}"` + (pm ? ` pow=${pm[1]} tou=${pm[2]}` : '') + (cols ? ` c=${cols.toLowerCase()}` : '')); } catch {}
    if (!k){ k = predefToken(desc, name); if (k){ const mult = tokenMult(k); if (mult > 1) log(`token doublers: ${n} → ${n * mult}`); createToken(k, n * mult, null, {tapped:!!m[2]}); return; } }
    if (!k && !pm && !/\b(creature|artifact|enchantment|land)\b/i.test(String(desc).replace(/["“][^"”]*["”]/g, ''))){   // v23: "a Mutavault token" — a token named after a real card is a copy of that card
      const real = [...DICT.values()].find(f => f && f.n === name && !/^Token\b/.test(f.t || ''));
      if (real) k = real.k; else { try { k = await searchToken(`!"${name}" -is:token`); } catch {} } }
    if (!k) k = customToken(name, pm ? xpt(pm[1]) + '/' + xpt(pm[2]) : pt, cols);
    if (k.startsWith('c:')){
      const q = String(m[4] || '').match(/with ["“](.+?)["”]/); const kws = (String(m[4] || '').replace(/["“][^"”]*["”]/g, '').match(/with ([a-z ,]+?)(?:$|\.| and with)/i) || [])[1];
      const dq = String(desc).replace(/["“][^"”]*["”]/g, '');   // quoted granted text ("Equipped creature gets…") isn't the token's own type
      const isCr = !!pm || /\bcreature\b/i.test(dq) || !/\b(artifact|enchantment|land)\b/i.test(dq);
      const sub = isCr ? name : ((dq.match(/\b(Equipment|Vehicle|Aura|Saga|Food|Clue|Treasure|Map|Blood|Gold|Shard|Powerstone|Junk|Fortification)\b/i) || [])[1] || '');
      const tl = 'Token ' + (/\bartifact\b/i.test(dq) ? 'Artifact ' : '') + (/\benchantment\b/i.test(dq) ? 'Enchantment ' : '') + (/\bland\b/i.test(dq) && !isCr ? 'Land ' : '') + (isCr ? 'Creature ' : '') + (sub ? '— ' + cap(sub) : '').trim();
      const o = [kws ? cap(kws.replace(/\s+and\s+/g, ', ')) : '', q ? q[1] : ''].filter(Boolean).join('\n');
      const k2 = k + '|' + norm(tl + o).slice(0, 60); if (!DICT.has(k2)) DICT.set(k2, {...DICT.get(k), k:k2, t:tl, o}); k = k2;
    }
  }
  const mult = tokenMult(k); if (mult > 1) log(`token doublers: ${n} → ${n * mult}`);
  createToken(k, n * mult, null, {tapped:!!m[2]});
}
async function searchLibrary(descRaw, rest, ctx){
  let d = descRaw.toLowerCase(); let max = 1; let mm;
  if ((mm = d.match(/^up to (\w+) /))){ max = wn(mm[1], ctx.it?.x) || 1; d = d.slice(mm[0].length); }
  else if ((mm = d.match(/^(two|three|four|x|\d+) /))){ max = wn(mm[1], ctx.it?.x) || 1; d = d.slice(mm[0].length); }
  if (/any number of/.test(d)){ max = 99; d = d.replace('any number of', ''); }
  const r = rest.toLowerCase();
  const split = /put one onto the battlefield( tapped)? and the other into your hand/.test(r);
  const dest = split ? 'split' : /onto the battlefield/.test(r) ? 'bf' : /into your hand/.test(r) ? 'hand' : /on top of your library|top of your library/.test(r) ? 'top' : /into your graveyard/.test(r) ? 'gy' : 'hand';
  const tapped = /onto the battlefield tapped/.test(r) || (split && /onto the battlefield tapped/.test(r));
  const ns = rulesOn('noSearch')[0]; if (ns){ log(`can't search — ${ns.src}: players can't search libraries`); toast(`${ns.src}: you can't search libraries`); return; }
  const legal = S.lib.filter(c => descOk(c.k, d));
  log(`searched their library for ${short(descRaw, 60)}`);
  const where = {bf:'onto the battlefield' + (tapped ? ' tapped' : ''), hand:'into your hand', top:'on top of your library (after shuffling)', gy:'into your graveyard', split:'one onto the battlefield, the other into your hand'}[dest];
  const ids = await pickCards({title:`${ctx.name}: search for ${descRaw}`, hint:`Only cards that fit are shown. Pick up to ${max}; they go ${where}.`, cards:legal, min:0, max, noneLabel:'Find nothing'});
  const chosen = (ids || []).map(id => find(id)[2]).filter(Boolean);
  if (dest === 'split' && chosen.length === 2){
    const v = await askChoice({title:'Which one goes onto the battlefield?', options:chosen.map((c, i) => ({label:cname(c), value:i}))});
    const a = chosen[v ?? 0], b = chosen[1 - (v ?? 0)];
    moveCard(a.id, 'bf', {quiet:true}); if (tapped) a.tap = true; moveCard(b.id, 'hand', {quiet:true});
    log(`put ${cname(a)} onto the battlefield${tapped ? ' tapped' : ''} and a card into their hand`);
  } else {
    for (const c of chosen){
      if (dest === 'bf' || dest === 'split'){ moveCard(c.id, 'bf', {quiet:true}); if (tapped) c.tap = true; log(`put ${cname(c)} onto the battlefield${tapped ? ' tapped' : ''}`); }
      else if (dest === 'hand'){ moveCard(c.id, 'hand', {quiet:true}); log(`put ${/reveal/.test(r) ? cname(c) : 'a card'} into their hand`); }
      else if (dest === 'gy') moveCard(c.id, 'gy');
    }
  }
  if (!chosen.length) log('found nothing');
  shuffleLib();
  if (dest === 'top') chosen.forEach(c => { const i = S.lib.indexOf(c); if (i >= 0){ S.lib.splice(i, 1); S.lib.unshift(c); } });
  commit();
}
function lookTopAwait(n, title, dests, hint){
  if (UI.replay){ log(`${title.toLowerCase()} ${n} skipped while repeating a loop`); return Promise.resolve(); }
  return new Promise(res => openModal({type:'zone', zone:'lib', ids:S.lib.slice(0, n).map(c => c.id), title:`${title} ${n}`, dests:dests || undefined, eng:!dests, hint, onClose:() => { commit(); res(); }}));
}

/* ---------- Choice dialogs ---------- */
function askChoice(m){ const r = replayAns(); if (r !== undefined) return Promise.resolve(r); return recAns(new Promise(res => openModal({type:'choice', key:rid(4), ...m, resolve:res, onClose:() => res(null)}))); }
async function askYes(text, yes='Yes', no='No'){ const v = await askChoice({title:text, options:[{label:yes, value:true}, {label:no, value:false}]}); return v === true; }
function askNumber(title, hint, def){ const r = replayAns(); if (r !== undefined) return Promise.resolve(r); return recAns(new Promise(res => openModal({type:'ask', title, hint, def:def ?? 1, go:'OK', zeroOk:true, run:n => res(n), onClose:() => res(null)}))); }
function pickCards(m){
  const r = replayAns();
  if (r !== undefined){ if (!Array.isArray(r)) return Promise.resolve(r); const used = new Set(); return Promise.resolve(r.map(id => { let c = (m.cards || []).find(x => x.id === id && !used.has(x.id)); if (!c){ const k = UI.replay && UI.replay.k && UI.replay.k[id]; c = (m.cards || []).find(x => x.k === k && !used.has(x.id)) || (m.cards || []).find(x => !used.has(x.id)); } if (c) used.add(c.id); return c && c.id; }).filter(x => x != null)); }
  return recAns(new Promise(res => openModal({type:'pick', key:rid(4), sel:[], min:0, max:1, ...m, resolve:res, onClose:() => res(null)})));
}
function renderEngineModal(m){
  if (m.type === 'check') return renderCheckModal(m);
  if (m.type === 'target') return renderTargetModal(m);
  if (m.type === 'split') return renderSplitModal(m);
  if (m.type === 'pw') return renderPwModal(m);
  if (m.type === 'prolif') return renderProlifModal(m);
  if (m.type === 'choice'){
    return {title:m.title, body:(m.text ? `<p class="hint">${esc(m.text)}</p>` : '') + `<div class="choices">${m.options.map((o, i) =>
      `<button class="btn${i === 0 && !o.disabled ? ' primary' : ''}" type="button" data-act="choose" data-i="${i}" ${o.disabled ? 'disabled' : ''}><span>${o.html || esc(o.label)}</span>${o.why ? `<small>${esc(o.why)}</small>` : ''}</button>`).join('')}</div>`};
  }
  if (m.type === 'pick'){
    m.sel = m.sel.filter(id => m.cards.some(c => c.id === id));
    const okN = m.sel.length >= m.min && m.sel.length <= m.max;
    const head = (m.min === 0 && m.noneLabel ? `<button class="btn small" type="button" data-act="pickNone">${esc(m.noneLabel)}</button>` : '') +
      `<button class="btn small primary" type="button" data-act="pickDone" ${okN ? '' : 'disabled'}>Done (${m.sel.length}${m.max < 99 ? ' of ' + m.max : ''})</button>`;
    const body = (m.hint ? `<p class="hint">${esc(m.hint)}</p>` : '') + (m.cards.length ? `<div class="vgrid">${m.cards.map(c => { const on = m.sel.includes(c.id);
      return `<button type="button" class="vbtn vitem${on ? ' chosen' : ''}" data-act="pickT" data-id="${c.id}">${cardHTML(c.k, {fl:c.fl})}<span>${on ? 'Chosen' : esc(cname(c))}</span></button>`; }).join('')}${(m.extra || []).map(c => `<div class="vbtn vitem off" aria-disabled="true">${cardHTML(c.k, {fl:c.fl})}<span>Can't take</span></div>`).join('')}</div>` : (m.extra || []).length ? `<div class="vgrid">${m.extra.map(c => `<div class="vbtn vitem off" aria-disabled="true">${cardHTML(c.k, {fl:c.fl})}<span>Can't take</span></div>`).join('')}</div>` : '<p class="hint">No cards fit.</p>');
    return {title:m.title, head, body};
  }
  if (m.type === 'stops'){
    const row = (st, l) => `<tr><td>${l}</td>${['mine','opp'].map(w => `<td><label><input type="checkbox" data-stopt="1" data-w="${w}" data-st="${st}" ${UI.stops[w][st] ? 'checked' : ''}></label></td>`).join('')}</tr>`;
    return {title:'Stops', body:`<p class="hint">Ticked steps stop and give you a chance to respond. Unticked steps pass by themselves when the stack is empty. Spells and abilities on the stack always ask you.</p>
      <table class="stops"><tr><th></th><th>My turn</th><th>Opponents' turns</th></tr>${row('upkeep','Upkeep')}${row('draw','Draw step')}${row('combat','Beginning of combat')}${row('end','End step')}</table>
      <div><button class="btn small" type="button" data-act="stopsReset">Back to the defaults</button></div>`};
  }
  if (m.type === 'pool'){
    return {title:'Adjust my mana pool', body:`<p class="hint">For mana the game couldn't work out by itself. Every change is written in the table log.</p><div class="poolrows">${MANA.map(c =>
      `<div class="mini-ctr"><span class="lbl">${manaHTML('{' + c + '}')} ${MNAME[c]}</span><button type="button" data-act="poolD" data-c="${c}" data-d="-1">−</button><span class="v">${S.pool[c] || 0}</span><button type="button" data-act="poolD" data-c="${c}" data-d="1">+</button></div>`).join('')}</div>
      <div><button class="btn small" type="button" data-act="poolClear">Empty the pool</button></div>`};
  }
  return null;
}

/* ---------- Phase bar and stack panel ---------- */
function turnButtons(){ return ''; }
function nextLabel(pn){
  const top = stackTop(); if (top) return top.pid === MYPID ? 'Waiting…' : 'Pass priority';
  if (pn.ph === 4 && S.cb){ const st = S.cb.step; if (st === 'atk') return 'Attack!'; if (st !== 'begin' && S.pass === prioKey()) return 'Waiting…'; if (!prioKey()) return 'Waiting…'; if (st === 'begin') return 'Next: Declare attackers'; }
  if (WIN[pn.ph] && S.pass === prioKey()) return 'Waiting…';
  if (pn.ph === 6) return 'End turn';
  if (pn.ph === 3 && false) return '';
  return 'Next: ' + PH[Math.min(7, pn.ph + 1)];
}
function renderPhaseBar(){
  const el = $('#phasebar'); if (!S || !el) return;
  const pn = phaseNow();
  if (pn.n === 0 || currentTurn()[2] > (S.turn[2] || 0)){ el.hidden = true; return; }
  el.hidden = false;
  const col = seatColor(pn.pid);
  const chips = PH.map((p, i) => `<span class="phc${i === pn.ph ? ' on' : ''}${i < pn.ph ? ' past' : ''}${WIN[i] ? ' win' : ''}">${p}</span>`).join('');
  const key = prioKey(); const wait = key ? waitingOn(key).filter(p => !p.me) : [];
  let right = '';
  if (pn.mine){
    if (S.untapN < pn.n) right = `<button class="btn small glow" type="button" data-act="startTurn">Start my turn</button>`;
    else {
      const lbl = nextLabel(pn); const waiting = lbl === 'Waiting…' || (stackTop() && S.pass === key);
      right = `<button class="btn small primary" type="button" data-act="next" title="Next step (N)" ${waiting ? 'disabled' : ''}>${waiting ? 'Waiting…' : esc(lbl)}</button>` +
        (pn.ph < 6 ? `<button class="btn small" type="button" data-act="passTurn" title="Skip to the end step">End turn</button>` : '');
    }
  } else if (pn.pid && !isLive(pn.pid)) right = `<button class="btn small" type="button" data-act="skipAway">Move on — ${esc(nameOf(pn.pid))} seems away</button>`;
  el.innerHTML = `<span class="phwho" style="--seatc:${col}">${pn.mine ? 'Your turn' : esc(nameOf(pn.pid)) + "'s turn"}</span><span class="phchips" style="--seatc:${col}">${chips}</span>` +
    (wait.length && (S.pass === key || pn.mine) ? `<span class="waittxt">waiting for ${wait.map(p => esc(p.nm)).join(', ')}</span>` : '') + `<span class="spacer"></span>${right}`;
}
function renderStackPanel(){
  const el = $('#stackpanel'); if (!el) return;
  if (!S || $('#game').hidden){ el.hidden = true; return; }
  const items = stackAll().reverse(); const key = prioKey(); const box = myBox(); const pn = phaseNow();
  const notes = UI.notes || [];
  if (!items.length && !box && !S.prm.length && !notes.length){ el.hidden = true; return; }
  el.hidden = false;
  const list = items.map((it, i) => { const a = info(it.k); const img = a?.art || '';
    return `<div class="sitem${i === 0 ? ' top' : ''}" data-k="${esc(it.k || '')}" style="--seatc:${seatColor(it.pid)}"><span class="sthumb">${img ? `<img src="${esc(img)}" alt="">` : ''}</span><span class="stx"><b>${esc(it.nm)}</b><small>${esc(it.pid === MYPID ? 'You' : nameOf(it.pid))} · ${it.kind === 'spell' ? 'spell' : it.kind === 'trigger' ? 'trigger' : 'ability'}${it.tgtNm ? ' → ' + esc(it.tgtNm) : ''}</small><small class="sdesc">${esc(short(String(it.txt || '').replace(/~/g, it.nm), 220))}</small></span></div>`; }).join('');
  let boxH = '';
  if (box){
    const top = stackTop();
    const what = top ? `Respond to ${top.pid === MYPID ? 'your' : esc(nameOf(top.pid)) + "'s"} ${esc(top.nm)}?` : `${esc(nameOf(pn.pid))}'s ${esc(PH[pn.ph].toLowerCase())} step — anything to do?`;
    const det = top ? `<div class="pdet">${manaHTML(short(String(top.txt || '').replace(/~/g, top.nm), 400))}${top.tgtNm ? `<div class="ptgt">Targeting: <b>${esc(top.tgtNm)}</b></div>` : ''}</div>` : '';
    boxH = `<div class="pbox"><div class="ptitle">${what}</div>${det}<div class="pbar"><i id="pbarfill"></i></div><div class="row"><button class="btn small primary" type="button" data-act="passPrio">Pass</button><button class="btn small" type="button" data-act="respond">Respond</button><button class="btn small" type="button" data-act="holdPrio">${UI.box && UI.box.hold ? 'Resume' : 'Hold'}</button><span class="pcount" id="pcount"></span></div>${top && stackAll().length > 1 || top && top.kind === 'trigger' ? `<button class="btn small ghost" type="button" data-act="passStack" title="Pass on everything until the stack is empty">Pass until the stack is empty</button>` : ''}</div>`;
  } else if (key){
    const w = waitingOn(key).filter(p => !p.me);
    if (w.length) boxH = `<div class="pwait">Waiting for ${w.map(p => esc(p.nm)).join(', ')}…</div>`;
  }
  const prm = S.prm.map(p => { if (p.type !== 'unless') return `<div class="pbox warnbox"><div class="ptitle">${esc(p.src || nameOf(p.from))}: ${p.type === 'sac' ? 'sacrifice' : 'discard'} ${p.n} ${esc(p.d || (p.type === 'sac' ? 'permanent' : 'card'))}${p.n > 1 ? 's' : ''}</div><div class="row"><button class="btn small primary" type="button" data-act="choosePrm" data-p="${p.id}">Choose…</button><span class="pcount" data-pcount="${p.id}"></span></div><small class="why">If time runs out the game picks at random.</small></div>`;
    const it = S.stk.find(x => x.sid === p.sid); const can = !payPlan(parseCost(`{${p.n}}`), S.pool).err;
    return `<div class="pbox warnbox"><div class="ptitle">${esc(nameOf(p.from))}'s counterspell: pay {${p.n}} or ${esc(it ? it.nm : 'your spell')} is countered</div><div class="row"><button class="btn small primary" type="button" data-act="unlessPay" data-p="${p.id}" ${can ? '' : 'disabled'}>Pay ${manaHTML('{' + p.n + '}')}</button><button class="btn small" type="button" data-act="unlessNo" data-p="${p.id}">Don't pay</button><span class="pcount" data-pcount="${p.id}"></span></div>${can ? '' : '<small class="why">Tap lands for mana, then pay.</small>'}</div>`; }).join('');
  const nh = notes.map(n => `<div class="pbox notebox"><div class="ptitle">Do this by hand — ${esc(n.name || '')}</div><div class="pdet">${manaHTML(n.text)}</div><div class="row"><button class="btn small" type="button" data-act="noteDone" data-n="${n.id}">Done</button></div></div>`).join('');
  el.innerHTML = (items.length ? `<div class="label">Stack · top resolves first</div>${list}` : '') + boxH + prm + nh;
  updateCountdown();
}

/* ---------- Publishing ---------- */
function enginePublic(){
  return {mon:S.mon || 0, ini:S.ini || 0, cn:(S.casts || []).filter(x => x.t === turnStr()).length, ct:turnStr(), pile:S.pile || null, cb:S.cb || null, bd:S.bd || '', lp:S.lp ? 1 : 0, ph:S.ph, pool:S.pool, pass:S.pass, stk:S.stk.map(pubItem), ctr:S.ctr.slice(-20), rq:S.rq.slice(-30), ev:S.ev.slice(-40).map(e => ({n:e.n, type:e.type, k:e.k, id:e.id, tok:e.tok ? 1 : 0, cnt:e.cnt || 1, nth:e.nth || 0, x:e.x || 0, dp:e.dp || '', amt:e.amt || 0, ...(e.cp ? {cp:e.cp} : {}), ...(e.cm ? {cm:e.cm} : {})}))};
}
function sanitizeEngine(s){
  const num = (v, a, b, d=0) => Number.isFinite(v) ? clamp(v, a, b) : d;
  const sid = v => typeof v === 'string' ? v.slice(0, 16) : '';
  const key = k => typeof k === 'string' ? k.slice(0, 80) : null;
  const pool = emptyPool(); MANA.forEach(c => { pool[c] = num(s.pool && s.pool[c], 0, 999); });
  return {
    ph: Array.isArray(s.ph) ? [num(s.ph[0], 0, 1e6), num(s.ph[1], 0, 1e6), num(s.ph[2], -1, 7, -1)] : [0, 0, -1],
    pool, pass: str(s.pass, 40), lp: !!s.lp, bd: str(s.bd, 40),
    cb: s.cb && typeof s.cb === 'object' ? {t:str(s.cb.t, 30), n:num(s.cb.n, 0, 99), step:['begin','atk','atkd','blk','blkd','fs','dmg','end'].includes(s.cb.step) ? s.cb.step : 'begin'} : null,
    stk: (Array.isArray(s.stk) ? s.stk.slice(0, 40) : []).map(it => ({sid:sid(it.sid), o:num(it.o, 0, 1e9), kind:['spell','ability','trigger'].includes(it.kind) ? it.kind : 'ability', k:key(it.k), nm:str(it.nm, 120), txt:str(it.txt, 600), mv:num(it.mv, 0, 99), ty:str(it.ty, 160), tgt:it.tgt ? sid(it.tgt) : null, tgtNm:str(it.tgtNm, 120), ss:!!it.ss, uc:!!it.uc, x:num(it.x, 0, 999)})).filter(it => it.sid),
    ctr: (Array.isArray(s.ctr) ? s.ctr.slice(-20) : []).map(r => ({id:sid(r.id), sid:sid(r.sid), un:num(r.un, 0, 99)})).filter(r => r.id && r.sid),
    rq: (Array.isArray(s.rq) ? s.rq.slice(-40) : []).map(r => ({id:sid(r.id), to:str(r.to, 40), op:RQ_OPS.includes(r.op) ? r.op : '', n:num(r.n, -99999, 99999), src:str(r.src, 80),
      tid:Number.isFinite(r.tid) ? r.tid : undefined, d:str(r.d, 80), ref:str(r.ref, 16), f:cleanFlags(r.f), c:cleanGive(r.c)})).filter(r => r.id && r.op),
    mon:num(s.mon, 0, 1e6), ini:num(s.ini, 0, 1e6), cn:num(s.cn, 0, 999), ct:str(s.ct, 20), pile:s.pile && typeof s.pile === 'object' ? {ref:str(s.pile.ref, 16), ks:(Array.isArray(s.pile.ks) ? s.pile.ks.slice(0, 12) : []).map(key).filter(Boolean)} : null,
    ev: (Array.isArray(s.ev) ? s.ev.slice(-40) : []).map(e => ({n:num(e.n, 0, 1e9), type:EV_TYPES.includes(e.type) ? e.type : '', k:key(e.k), id:num(e.id, 0, 1e9), tok:e.tok ? 1 : 0, cnt:num(e.cnt, 1, 99, 1), nth:num(e.nth, 0, 99), x:num(e.x, 0, 99), dp:e.dp ? str(e.dp, 40) : '', amt:num(e.amt, 0, 999), ...(e.cp ? {cp:num(e.cp, 0, 999)} : {}), ...(e.cm ? {cm:num(e.cm, 0, 999)} : {})})).filter(e => e.type),
  };
}

const EV_TYPES = ['enter','die','leave','cast','attack','draw','gain','scry','cdmg','block','blocked','dmg','turnup','sac','tapped','leavegy','countered'];
const RQ_OPS = ['psn','life','draw','mill','destroy','exile','bounce','tap','untap','dmg','pdmg','pump','ctr','steal','give','back','regen','wipe','wipeEx','bounceAll','dmgAll','sac','discard','gytake'];
function cleanFlags(f){ if (!f || typeof f !== 'object') return {}; const o = {};
  ['dt','wi','inf','ll','eot','untap','haste','fromGy','tap','other','fs'].forEach(k => { if (f[k]) o[k] = true; });
  if (typeof f.col === 'string') o.col = f.col.slice(0, 6); if (typeof f.types === 'string') o.types = f.types.slice(0, 80); if (typeof f.cmd === 'string') o.cmd = f.cmd.slice(0, 80);
  ['p','t'].forEach(k => { if (Number.isFinite(f[k])) o[k] = clamp(f[k], -99, 99); });
  if (Array.isArray(f.kw)) o.kw = f.kw.slice(0, 6).map(x => str(x, 24));
  return o; }
function cleanGive(c){ if (!c || typeof c !== 'object' || typeof c.k !== 'string') return undefined;
  return {k:c.k.slice(0, 80), cp:clamp(+c.cp || 0, 0, 999), cm:clamp(+c.cm || 0, 0, 999), co:clamp(+c.co || 0, 0, 999), tok:c.tok ? 1 : 0, fl:c.fl ? 1 : 0, tap:c.tap ? 1 : 0, cmd:c.cmd ? 1 : 0}; }

/* ---------- Buttons ---------- */
Object.assign(ACT, {
  next(){ nextAction(); },
  passPrio(){ doPass(); },
  passStack(){ UI.passStack = true; doPass(); },
  holdPrio(){ if (UI.box){ UI.box.hold = !UI.box.hold; renderStackPanel(); } },
  respond(){ if (UI.box) UI.box.hold = true; toast('Cast an instant or activate an ability. Cards you can use are lit; the rest are dimmed.'); renderStackPanel(); },
  skipAway(){ skipAway(); },
  cast(el){ const [z,,c] = find(+el.dataset.id); closeMenu(); if (c) beginCast(c, z, {}); },
  castFree(el){ const [z,,c] = find(+el.dataset.id); closeMenu(); if (c) beginCast(c, z, {free:true}); },
  putBf(el){ moveCard(+el.dataset.id, 'bf'); },
  playLand(el){ const [,,c] = find(+el.dataset.id); closeMenu(); if (c) playLand(c, {force:!!el.dataset.force}); },
  actAb(el){ const [,,c] = find(+el.dataset.id); closeMenu(); const ab = c && abilityList(c)[+el.dataset.i]; if (ab) activateAbility(c, ab); },
  manaAb(el){
    const [,,c] = find(+el.dataset.id); const i = +el.dataset.i; const ab = c && manaAbs(c)[i]; if (!ab) return;
    if (ab.outs.length > 1){ const m = $('#menu'); openMenuAt(`<div class="mh">${esc(cname(c))}: add mana</div>` + ab.outs.map((o, ci) => mb('manaGo', `Add ${manaHTML(o.map(x => '{' + x + '}').join(''))}`, `data-id="${c.id}" data-ab="${i}" data-ch="${ci}"`)).join(''), parseFloat(m.style.left), parseFloat(m.style.top)); return; }
    closeMenu(); activateMana(c, ab, 0);
  },
  manaGo(el){ const [,,c] = find(+el.dataset.id); closeMenu(); const ab = c && manaAbs(c)[+el.dataset.ab]; if (ab) activateMana(c, ab, +el.dataset.ch); },
  attack(el){ closeMenu(); attackWith(+el.dataset.id); },
  choose(el){ const m = UI.modal; if (!m || m.type !== 'choice') return; const o = m.options[+el.dataset.i]; if (!o || o.disabled) return; m.onClose = null; closeModal(); m.resolve(o.value); },
  pickT(el){ const m = UI.modal; const id = +el.dataset.id; const i = m.sel.indexOf(id); if (i >= 0) m.sel.splice(i, 1); else { if (m.max === 1) m.sel = []; if (m.sel.length < m.max) m.sel.push(id); } renderModal(); },
  pickDone(){ const m = UI.modal; if (!m || m.type !== 'pick') return; m.onClose = null; closeModal(); m.resolve(m.sel.slice()); },
  pickNone(){ const m = UI.modal; if (!m || m.type !== 'pick') return; m.onClose = null; closeModal(); m.resolve([]); },
  openStops(){ closeMenu(); openModal({type:'stops'}); },
  stopT(el){ UI.stops[el.dataset.w][el.dataset.st] = el.checked; store.set('pt.stops', UI.stops); },
  stopsReset(){ UI.stops = JSON.parse(JSON.stringify(DEF_STOPS)); store.set('pt.stops', UI.stops); renderModal(); },
  manaAdj(){ closeMenu(); openModal({type:'pool'}); },
  poolD(el){ const c = el.dataset.c; const d = +el.dataset.d; const v = Math.max(0, (S.pool[c] || 0) + d); if (v === (S.pool[c] || 0)) return; S.pool[c] = v; log(`adjusted their mana pool by hand: ${d > 0 ? '+' : '−'}{${c}}`); commit(); renderModal(); },
  poolClear(){ S.pool = emptyPool(); log('emptied their mana pool'); commit(); renderModal(); },
  unlessPay(el){ const p = S.prm.find(x => x.id === el.dataset.p); if (p) resolvePrompt(p, true); },
  noteDone(el){ UI.notes = (UI.notes || []).filter(n => n.id !== el.dataset.n); renderStackPanel(); },
  pumpD(el){ const id = +el.dataset.id; applyOp({op:'pump', tid:id, f:{p:+el.dataset.p, t:+el.dataset.t}}, MYPID); setTimeout(() => cardMenuRefresh(id)); },
  async pumpSet(el){ const [,,c] = find(+el.dataset.id); closeMenu(); if (!c) return; const st = stats(c) || [0, 0];
    const p = await askNumber(`${cname(c)}: power until end of turn`, `Now ${st[0]}/${st[1]}`, st[0]); if (p == null) return;
    const t = await askNumber(`${cname(c)}: toughness until end of turn`, `Power will be ${p}`, st[1]); if (t == null) return;
    applyOp({op:'pump', tid:c.id, f:{p:p - st[0], t:t - st[1]}}, MYPID); },
  unlessNo(el){ const p = S.prm.find(x => x.id === el.dataset.p); if (p) resolvePrompt(p, false); },
});
// checkboxes fire click before change; read the new state on change instead
document.addEventListener('change', e => { const t = e.target; if (t.matches && t.matches('input[data-stopt]')) ACT.stopT(t); });
