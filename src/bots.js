/* ===================== bots.js: bot players (stage 1: framework + Easy + Intermediate) =====================
   Architecture
   - Every bot is a full, separate player client: the same game file runs in a hidden iframe (URL ?ptbot=<id>) with its own
     state S, its own player id and its own copy of the rules engine. It joins the table like a person does, so it sees exactly
     what a person in its seat sees (its own hand/library + everyone's public board through OPP) and nothing else.
   - Transport. Tables whose code starts with "local-" never touch the internet: an in-page loopback relay (PTLOOP) stands in for
     the MQTT servers. The page that starts the game hosts the relay; bot frames reach it with postMessage. Normal tables keep
     MQTT, and a bot added to one connects to the same relays as everyone else (whoever added it runs it).
   - Driver. In a bot frame BOT.tick() looks at the screen state (modal, prompts, priority, combat, main phase) every 100 ms and
     asks the bot's level what to do; actions go through the same menus/buttons a person uses. Think delays make it watchable.
   - Levels. BOT_LEVELS is a registry: {id, label, ready, think, …decision hooks}. Hooks the level doesn't define fall back to
     BOT_BASE. botlevels.js defines Easy and Intermediate; stage 2/3 add Hard / Very hard / Master and the trainer the same way.
     Decision hooks receive a view (botView) built only from S (my own state) and OPP (public state).
   ============================================================================================================ */

// am I a bot's hidden frame? (marked by the frame's name, and by ?ptbot= in its URL when the page has a real URL)
const BOTMODE = (() => { try { return window.parent !== window && (/^ptbot-/.test(window.name || '') || !!new URLSearchParams(location.search).get('ptbot')); } catch { return false; } })();
// pages without a reloadable URL (about:srcdoc, blob:) start bot frames from a copy of this document
const PT_SRC = (() => { try { return !BOTMODE && !/^(https?|file):$/.test(location.protocol) ? '<!DOCTYPE html>\n' + document.documentElement.outerHTML : ''; } catch { return ''; } })();

/* ---------------------------------------------------------------- 1. loopback relay (offline tables) */
const PTLOOP = (() => {
  const enc = s => new TextEncoder().encode(String(s || ''));
  const match = (pat, t) => pat === t || (pat.endsWith('/#') && (t === pat.slice(0, -2) || t.startsWith(pat.slice(0, -1))));
  // the relay itself: lives in the page that started the bot game
  const hub = {clients:new Map(), ret:new Map(), n:0,
    attach(cid, deliver, will){ this.clients.set(cid, {deliver, subs:[], will:will || null}); },
    sub(cid, pat){ const c = this.clients.get(cid); if (!c) return; if (!c.subs.includes(pat)) c.subs.push(pat); for (const [t, p] of this.ret) if (match(pat, t)) c.deliver(t, p); },
    pub(cid, t, p, retain){ this.n++; p = String(p ?? ''); if (retain){ if (p === '') this.ret.delete(t); else this.ret.set(t, p); }
      for (const c of this.clients.values()) if (c.subs.some(s => match(s, t))) c.deliver(t, p); },
    detach(cid){ const c = this.clients.get(cid); if (!c) return; this.clients.delete(cid); if (c.will && c.will.topic) this.pub(cid, c.will.topic, c.will.payload || '', c.will.retain); },
  };
  function mkClient(cid){
    const ev = {};
    const cl = {cid, connected:false, __loop:true,
      on(e, f){ (ev[e] = ev[e] || []).push(f); return cl; }, emit(e, ...a){ (ev[e] || []).forEach(f => { try { f(...a); } catch (err){ console.warn(err); } }); },
      publish(t, p, o){ if (cl.__inert || !cl.connected) return; cl.tr.send({op:'pub', cid, t, p:String(p ?? ''), r:!!(o && o.retain)}); },
      subscribe(t){ if (!cl.__inert) cl.tr.send({op:'sub', cid, t}); },
      end(){ if (cl.__inert) return; const was = cl.connected; cl.connected = false; if (was) cl.tr.send({op:'end', cid}); cl.emit('close'); }};
    return cl;
  }
  const local = {send(m){ if (m.op === 'pub') hub.pub(m.cid, m.t, m.p, m.r); else if (m.op === 'sub') hub.sub(m.cid, m.t); else if (m.op === 'end') hub.detach(m.cid); }};
  // inside a bot frame: the relay is in the parent page
  const frame = {up:null, clients:new Map(), send(m){ try { frame.up.postMessage({__ptloop:1, ...m}, '*'); } catch (e){ console.warn('loop send', e); } }};
  const shim = {connect(url, opts = {}){
    const cid = String(opts.clientId || ('pt_x_0_' + Math.random())); const i = +(cid.split('_')[2] || 0);
    const cl = mkClient(cid);
    if (i > 0){ cl.__inert = true; return cl; }                     // one loopback "relay" is enough
    if (frame.up){ cl.tr = frame; frame.clients.set(cid, cl); frame.send({op:'conn', cid, will:opts.will || null}); }
    else { cl.tr = local; hub.attach(cid, (t, p) => setTimeout(() => { if (cl.connected) cl.emit('message', t, enc(p)); }, 0), opts.will); }
    setTimeout(() => { cl.connected = true; cl.emit('connect'); }, 0);
    return cl;
  }};
  // relay side of a frame's connection
  function fromFrame(win, d, owner){
    if (d.op === 'conn'){ hub.attach(d.cid, (t, p) => { try { win.postMessage({__ptloopD:1, cid:d.cid, t, p}, '*'); } catch {} }, d.will); owner.add(d.cid); }
    else if (d.op === 'pub') hub.pub(d.cid, d.t, d.p, d.r);
    else if (d.op === 'sub') hub.sub(d.cid, d.t);
    else if (d.op === 'end'){ hub.detach(d.cid); owner.delete(d.cid); }
  }
  return {hub, shim, frame, fromFrame, enc, isLocal:code => /^local-/.test(String(code || ''))};
})();
{
  // tables called "local-…" use the loopback relay; everything else is unchanged
  const ct = connectTable;
  connectTable = function(code){
    if (!PTLOOP.isLocal(code)) return ct.apply(this, arguments);
    const had = Object.prototype.hasOwnProperty.call(window, 'mqtt'), real = window.mqtt; let p;
    window.mqtt = PTLOOP.shim;
    try { p = ct.apply(this, arguments); } finally { if (had) window.mqtt = real; else { try { delete window.mqtt; } catch { window.mqtt = undefined; } } }
    return p.then(r => { NET.clients = NET.clients.filter(c => !c.__inert); updateNetStatus(); return r; });
  };
  const rt = renderTop;
  renderTop = function(){ const r = rt.apply(this, arguments); try { if (NET.peer && PTLOOP.isLocal(NET.code)){ const el = document.querySelector('#topbar .tcode'); if (el && !el.dataset.loc){ el.dataset.loc = 1; el.innerHTML = `<span class="dot live"></span>Offline table vs bots <small>· ${OPP.size + 1} seated</small>`; } } } catch {} return r; };
}

/* ---------------------------------------------------------------- 2. levels registry and the shared decision interface */
// A level: {id, label, ready, think:[minMs, maxMs], …hooks}. Hooks (all optional, fall back to BOT_BASE):
//   keep(v)->bool · bottom(v, need)->ids · main(v)->action|null · respond(v)->action|null · attack(v)->{id:defKey} · block(v)->{blockerId:attackerId}
//   choice(v, m)->option index · pick(v, m)->ids · target(v, m)->cand indices · number(v, m)->n · pay(v, cost, src)->bool · pw(v, c)->ability index|-1
// action: {how:'land'|'cast'|'ab'|'pw', c:card, zone, ab, why}
const BOT_LEVELS = {};
const BOT_ORDER = ['easy', 'intermediate', 'hard', 'veryhard', 'master'];
function botLevel(id, def){ BOT_LEVELS[id] = Object.assign({id, label:id, ready:false, think:[600, 1500]}, BOT_LEVELS[id] || {}, def); return BOT_LEVELS[id]; }
botLevel('hard', {label:'Hard', ready:false, soon:'stage 2'});
botLevel('veryhard', {label:'Very hard', ready:false, soon:'stage 2'});
botLevel('master', {label:'Master', ready:false, soon:'stage 3'});

/* ---------------------------------------------------------------- 3. host side: starting bot games, the frames, the lobby panel */
const BOTHOST = {bots:[], watch:false, code:'', speed:1};
const BOT_NAMES = ['Ajani', 'Bolas', 'Chandra', 'Davriel', 'Elspeth', 'Freyalise', 'Garruk', 'Huatli', 'Jaya', 'Kaya', 'Liliana', 'Nissa', 'Oko', 'Ral', 'Sorin', 'Teferi', 'Vraska', 'Wrenn'];
function botURL(id){ try { if (!/^(https?|file):$/.test(location.protocol)) return null; const u = new URL(location.href); u.hash = ''; u.searchParams.set('ptbot', id); return u.href; } catch { return null; } }
function botSpawn(cfg){
  const id = 'b' + rid(6);
  const el = document.createElement('iframe');
  el.title = 'Bot player ' + cfg.name; el.setAttribute('aria-hidden', 'true'); el.tabIndex = -1; el.dataset.ptbot = id;
  el.style.cssText = 'position:fixed;left:-30000px;top:0;width:1280px;height:820px;border:0;opacity:0;pointer-events:none';
  const b = {id, el, cfg:{...cfg, botId:id}, st:{}, cids:new Set(), born:Date.now()};
  BOTHOST.bots.push(b);
  el.name = 'ptbot-' + id;
  const url = botURL(id); if (url) el.src = url; else el.srcdoc = PT_SRC;
  document.body.appendChild(el);
  return b;
}
function botRemove(b){
  try { b.cids.forEach(cid => PTLOOP.hub.detach(cid)); } catch {}
  try { b.el.remove(); } catch {}
  BOTHOST.bots = BOTHOST.bots.filter(x => x !== b); botPanelRender();
}
function botsStop(code){ BOTHOST.bots.filter(b => !code || b.cfg.code === code).forEach(botRemove); }
window.addEventListener('message', e => {
  const d = e.data; if (!d || typeof d !== 'object') return;
  const b = BOTHOST.bots.find(x => x.el.contentWindow === e.source); if (!b) return;
  if (d.__ptloop){ PTLOOP.fromFrame(e.source, d, b.cids); return; }
  if (d.__ptbot === 'ready'){ try { e.source.postMessage({__ptbot:'init', cfg:b.cfg}, '*'); } catch (err){ console.warn(err); } return; }
  if (d.__ptbot === 'stat'){ b.st = d.st || {}; botMaybeStart(); botPanelStatus(); return; }
});
// in a game with only bots (BOTHOST.watch) the first bot starts the game once every bot has kept its hand
function botMaybeStart(){
  if (!BOTHOST.watch || BOTHOST.started) return;
  const live = BOTHOST.bots.filter(b => b.cfg.code === BOTHOST.code);
  if (live.length < 2 || !live.every(b => b.st.kept && b.st.seen >= live.length - 1)) return;
  BOTHOST.started = true;
  const first = live[0]; try { first.el.contentWindow.postMessage({__ptbot:'cmd', cmd:'randomFirst', who:BOTHOST.firstSeat != null && live[BOTHOST.firstSeat] ? live[BOTHOST.firstSeat].cfg.name : null}, '*'); } catch {}
}
// decks a bot can play: saved decks, a random saved deck, or a random legal deck built from every card this browser knows
function botDeckOptions(){ return savedDecks().map(r => ({id:'saved:' + r.id, label:r.name})); }
function botDeckFor(choice, fmt, rnd = Math.random){
  const list = savedDecks();
  if (choice === 'mine' && LOBBY.deck) return {deck:{main:LOBBY.deck.main.map(e => ({...e})), cmd:LOBBY.deck.cmd.slice()}, dict:botDictFor(LOBBY.deck), name:LOBBY.deckName || 'Your deck'};
  if (choice && choice.startsWith('saved:')){ const r = list.find(x => x.id === choice.slice(6)); if (r) return {deck:r.deck, dict:r.dict, name:r.name}; }
  if (choice === 'randomSaved' && list.length){ const r = list[Math.floor(rnd() * list.length)]; return {deck:r.deck, dict:r.dict, name:r.name}; }
  return botRandomDeck(fmt, rnd);
}
function botDictFor(d){ const keys = new Set([...d.cmd, ...d.main.map(e => e.k)]); [...keys].forEach(k => (info(k)?.toks || []).forEach(t => keys.add(t.id))); return [...keys].map(k => DICT.get(k)).filter(Boolean).map(a => { const {fx, ...rest} = a; return rest; }); }
const BOT_BASICS = {W:'Plains', U:'Island', B:'Swamp', R:'Mountain', G:'Forest'};
function botBasic(col){
  const name = BOT_BASICS[col] || 'Wastes';
  const have = [...DICT.values()].find(a => a.n === name && /\bBasic\b/.test(a.t || ''));
  if (have) return have.k;
  const k = 'bot:basic:' + name.toLowerCase();
  if (!DICT.has(k)) DICT.set(k, {k, n:name, m:'', t:`Basic Land — ${name}`, o:`({T}: Add {${col || 'C'}}.)`, p:'', img:'', c:'', back:null, toks:[], tok:false, cc:false, lay:'normal', full:name, set:'bot', cn:'', pr:'', art:'', mv:0, ci:'', kw:[]});
  return k;
}
// a random legal deck from the card pool this browser knows (saved decks + loaded cards); singleton, colour identity respected
function botRandomDeck(fmt, rnd = Math.random){
  savedDecks().forEach(r => (r.dict || []).forEach(a => { if (a && a.k && !DICT.has(a.k)) addInfo(a); }));
  const pool = [...DICT.values()].filter(a => a && !a.tok && a.k && !String(a.k).startsWith('bot:') && !/\b(Token|Emblem|Scheme|Plane|Vanguard|Dungeon|Conspiracy|Basic)\b/.test(a.t || ''));
  const byName = new Map(); pool.forEach(a => { if (!byName.has(a.n)) byName.set(a.n, a); });
  const uniq = [...byName.values()];
  const sh = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const cz = FMT[fmt || LOBBY.fmt || 'cmd'].cz;
  const cmds = uniq.filter(a => /^Legendary (?:Snow )?(?:Artifact )?Creature/.test(a.t || '') && (a.ci || '').length);
  const cmd = cz && cmds.length ? cmds[Math.floor(rnd() * cmds.length)] : null;
  const ci = cmd ? cmd.ci : (sh(['W', 'U', 'B', 'R', 'G']).slice(0, 2).join(''));
  const ok = a => a !== cmd && [...(a.ci || '')].every(x => ci.includes(x));
  const size = cz ? 99 : 60;
  const lands = sh(uniq.filter(a => ok(a) && /\bLand\b/.test(a.t || '') && !/\bCreature\b/.test(a.t || ''))).slice(0, cz ? 8 : 4);
  const spells = sh(uniq.filter(a => ok(a) && !/\bLand\b/.test(a.t || ''))).slice(0, cz ? 61 : 36);
  const nb = size - lands.length - spells.length; const cols = [...ci].filter(x => BOT_BASICS[x]); const main = [...lands, ...spells].map(a => ({k:a.k, q:1}));
  if (!cols.length) cols.push('C');
  cols.forEach((x, i) => { const n = Math.floor(nb / cols.length) + (i < nb % cols.length ? 1 : 0); if (n > 0) main.push({k:botBasic(x === 'C' ? '' : x), q:cz ? n : n}); });
  const deck = {main, cmd:cmd ? [cmd.k] : [], missing:[]};
  return {deck, dict:botDictFor(deck), name:'Random ' + (cmd ? cmd.n : ci + ' deck')};
}
// start a game against bots: seats = [{level, deck, name}], human seated first unless opts.watch
async function botsStartGame(seats, opts = {}){
  const fmt = opts.fmt || LOBBY.fmt || 'cmd';
  const code = opts.code || ('local-' + rid(6));
  botsStop(); BOTHOST.code = code; BOTHOST.watch = !!opts.watch; BOTHOST.started = false; BOTHOST.firstSeat = opts.first;
  BOTHOST.speed = opts.speed ?? BOTHOST.speed;
  if (!opts.watch){
    if (!LOBBY.deck){ netStatus('Load your deck first.', 'err'); return false; }
    $('#codeIn').value = code; await sitDown('host');
    if (!S || NET.code !== code) return false;
    toast('The bots are sitting down. Mulligan if you like, then press “Random first player” or “I go first”.');
  }
  const rnd = opts.seed != null ? botRng(opts.seed * 7 + 3) : Math.random;
  seats.forEach((s, i) => {
    const d = s.deckData || botDeckFor(s.deck, fmt, rnd);
    botSpawn({level:s.level || 'easy', name:(s.name || BOT_NAMES[Math.floor(rnd() * BOT_NAMES.length)]).slice(0, 24), deck:d.deck, dict:d.dict, deckName:d.name, fmt, code, net:'loop',
      speed:s.speed ?? BOTHOST.speed, seed:opts.seed != null ? opts.seed * 101 + i * 17 + 1 : null, seat:i});
  });
  botPanelRender();
  return code;
}
// add one bot to the table I'm seated at (MQTT or offline)
function botAddToTable(s){
  if (!S || !NET.peer || !NET.code){ toast('Sit down at a table first'); return null; }
  const d = s.deckData || botDeckFor(s.deck, S.fmt);
  return botSpawn({level:s.level || 'easy', name:(s.name || BOT_NAMES[rnd(BOT_NAMES.length)]).slice(0, 24), deck:d.deck, dict:d.dict, deckName:d.name, fmt:S.fmt, code:NET.code,
    net:PTLOOP.isLocal(NET.code) ? 'loop' : 'mqtt', speed:s.speed ?? BOTHOST.speed, seat:BOTHOST.bots.length});
}
function botRng(seed){ let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
{
  // leaving a table (or moving to another one) takes the bots I was running there with me
  const cn = closeNet;
  closeNet = function(){ const code = NET.code; const r = cn.apply(this, arguments); try { if (code && !BOTMODE && !BOTHOST.watch) botsStop(code); } catch {} return r; };
}

/* ---- lobby: "Play against bots" panel on the Play page ---- */
const BOTUI = {n:4, seats:[], speed:1};
function botSeatsFor(n){
  while (BOTUI.seats.length < n - 1){ const i = BOTUI.seats.length; BOTUI.seats.push({level:i % 2 ? 'intermediate' : 'easy', deck:'randomSaved', name:BOT_NAMES[(i * 5 + 3) % BOT_NAMES.length]}); }
  return BOTUI.seats.slice(0, n - 1);
}
function botPanelHTML(){
  const seats = botSeatsFor(BOTUI.n); const decks = botDeckOptions();
  const lvlOpts = sel => BOT_ORDER.map(id => { const L = BOT_LEVELS[id]; if (!L) return ''; return `<option value="${id}" ${sel === id ? 'selected' : ''} ${L.ready ? '' : 'disabled'}>${esc(L.label)}${L.ready ? '' : ' (coming soon)'}</option>`; }).join('');
  const deckOpts = sel => `<option value="randomSaved" ${sel === 'randomSaved' ? 'selected' : ''}>Random saved deck</option><option value="randomPool" ${sel === 'randomPool' ? 'selected' : ''}>Random deck from known cards</option>${LOBBY.deck ? `<option value="mine" ${sel === 'mine' ? 'selected' : ''}>A copy of my deck</option>` : ''}${decks.map(d => `<option value="${esc(d.id)}" ${sel === d.id ? 'selected' : ''}>${esc(d.label)}</option>`).join('')}`;
  const atTable = S && NET.peer && NET.code && !PTLOOP.isLocal(NET.code);
  return `<h2>Play against bots</h2>
    <p class="hint">Bots are full players in hidden windows of this page: same rules, and they only see what a player in their seat could see. Works offline.</p>
    <div class="seg" id="botN">${[[2, '1 v 1'], [3, '3 players'], [4, '4-player pod'], [5, '5 players']].map(([n, l]) => `<button type="button" data-botn="${n}" aria-pressed="${BOTUI.n === n}">${l}</button>`).join('')}</div>
    <div class="botseats" style="display:grid;grid-template-columns:auto minmax(90px,1fr) minmax(120px,1.1fr) minmax(150px,1.7fr);gap:6px 8px;align-items:center">
      <span class="label"></span><span class="label">Name</span><span class="label">Difficulty</span><span class="label">Deck</span>
      ${seats.map((s, i) => `<span class="hint" data-seat="${i}">Bot ${i + 1}</span>
      <span data-seat="${i}"><input type="text" data-botf="name" value="${esc(s.name)}" maxlength="24" aria-label="Bot ${i + 1} name" style="width:100%"></span>
      <span data-seat="${i}"><select data-botf="level" aria-label="Bot ${i + 1} difficulty" style="width:100%">${lvlOpts(s.level)}</select></span>
      <span data-seat="${i}"><select data-botf="deck" aria-label="Bot ${i + 1} deck" style="width:100%">${deckOpts(s.deck)}</select></span>`).join('')}</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><label class="label" for="botSpeed">Bot speed</label><select id="botSpeed" style="width:auto"><option value="1" ${BOTUI.speed === 1 ? 'selected' : ''}>Normal (easy to follow)</option><option value="0.4" ${BOTUI.speed === 0.4 ? 'selected' : ''}>Fast</option><option value="0" ${BOTUI.speed === 0 ? 'selected' : ''}>Instant</option></select></div>
    <div class="row"><button class="btn primary" type="button" id="botStart" ${LOBBY.deck ? '' : 'disabled'}>Start game vs bots</button>${atTable ? `<button class="btn" type="button" id="botAdd">Add bot 1 to table ${esc(NET.code)}</button>` : ''}</div>
    <div class="status" id="botStatus" role="status"></div>`;
}
function botPanelRender(){
  if (BOTMODE) return;
  let el = document.getElementById('botPanel');
  if (!el){ const after = document.querySelector('#lobby [data-pg="play"]'); if (!after) return; el = document.createElement('div'); el.className = 'panel'; el.id = 'botPanel'; el.dataset.pg = 'play'; after.after(el); }
  if (el.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
  el.innerHTML = botPanelHTML(); botPanelStatus();
}
function botPanelStatus(){
  const el = document.getElementById('botStatus'); if (!el) return;
  const live = BOTHOST.bots; el.textContent = live.length ? 'Bots: ' + live.map(b => `${b.cfg.name} (${BOT_LEVELS[b.cfg.level]?.label || b.cfg.level}${b.st.lost ? ', lost' : b.st.pid ? '' : ', sitting down…'})`).join(' · ') : '';
}
if (!BOTMODE){
  document.addEventListener('click', async e => {
    const nb = e.target.closest('#botPanel [data-botn]'); if (nb){ BOTUI.n = +nb.dataset.botn; botPanelRender(); return; }
    if (e.target.closest('#botStart')){
      const b = e.target.closest('#botStart'); b.disabled = true;
      try { await botsStartGame(botSeatsFor(BOTUI.n).map(s => ({...s, speed:BOTUI.speed}))); } finally { b.disabled = false; }
      return; }
    if (e.target.closest('#botAdd')){ const s = botSeatsFor(BOTUI.n)[0]; botAddToTable({...s, speed:BOTUI.speed}); toast(`${s.name} is joining table ${NET.code}`); botPanelRender(); return; }
  });
  document.addEventListener('change', e => {
    const f = e.target.closest('#botPanel [data-botf]'); if (f){ const i = +f.closest('[data-seat]').dataset.seat; botSeatsFor(BOTUI.n)[i][f.dataset.botf] = f.value; return; }
    if (e.target.id === 'botSpeed') BOTUI.speed = +e.target.value;
  });
  document.addEventListener('input', e => { const f = e.target.closest('#botPanel [data-botf="name"]'); if (f){ const i = +f.closest('[data-seat]').dataset.seat; botSeatsFor(BOTUI.n)[i].name = f.value; } });
  // keep the panel fresh when decks or the page change
  { const rs = renderSaved; renderSaved = function(){ const r = rs.apply(this, arguments); try { botPanelRender(); } catch {} return r; }; }
  { const rd = renderDeckSum; renderDeckSum = function(){ const r = rd.apply(this, arguments); try { botPanelRender(); } catch {} return r; }; }
  { const sl = showLobby; showLobby = function(){ const r = sl.apply(this, arguments); try { botPanelRender(); } catch {} return r; }; }
  // Game menu: add a bot to the table I'm at
  { const gm = gameMenu; gameMenu = function(x, y){ const r = gm.apply(this, arguments); try { const m = $('#menu'); if (m && !m.hidden && S && NET.peer){ m.insertAdjacentHTML('beforeend', `<div class="sep"></div>` + mb('botAddMenu', 'Add a bot to this table…')); } } catch {} return r; }; }
  ACT.botAddMenu = async () => {
    closeMenu();
    const lv = await askChoice({title:'Add a bot to this table: how strong?', options:BOT_ORDER.map(id => BOT_LEVELS[id]).filter(Boolean).map(L => ({label:L.label + (L.ready ? '' : ' (coming soon)'), value:L.id, disabled:!L.ready}))});
    if (!lv) return;
    const nm = BOT_NAMES[rnd(BOT_NAMES.length)];
    botAddToTable({level:lv, deck:savedDecks().length ? 'randomSaved' : 'randomPool', name:nm, speed:BOTUI.speed});
    log(`invited a bot: ${nm} (${BOT_LEVELS[lv].label})`); commit();
  };
}

/* ---------------------------------------------------------------- 4. inside a bot frame */
const BOT = {on:false, cfg:null, L:null, R:Math.random, acts:[], errs:[], peeks:[], notes:0, sig:'', due:0, thought:false, busy:false, kept:false, mullN:0,
  ph:{}, tried:{}, tally:{land:0, cast:0, ab:0, pw:0, attack:0, attackers:0, block:0, blockers:0, prompt:0, modal:0}, modalT:0, modalKey:'', deciding:false, n:0, started:0};
if (BOTMODE){
  const UP = window.parent;                                    // captured once: the only window the bot ever talks to
  PTLOOP.frame.up = UP;
  // a bot must never touch the player's saved game, saved decks or settings
  const sg = store.get.bind(store);
  store.get = k => /^pt\.(save|decks|lastDeck|name)$/.test(k) ? null : sg(k);
  store.set = () => {}; store.del = () => {};
  // hidden frames get no animation frames in some browsers: draw on a timer instead
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 40);
  // nobody looks at a bot's screen: skip the expensive parts of drawing (and never fetch card images)
  ['renderBF', 'renderHand', 'renderOpps', 'renderLog', 'renderInspector', 'renderTokbar', 'renderStats'].forEach(f => { try { window[f] = function(){}; } catch {} });
  { const ch = cardHTML; cardHTML = function(){ return String(ch.apply(this, arguments)).replace(/<img\b[^>]*>/gi, ''); }; }
  try { AUTOTAP.on = true; } catch {}
  UI.auto = true; UI.cmdz = true; UI.strict = true;
  UI.stops = {mine:{upkeep:false, draw:false, combat:false, end:false}, opp:{upkeep:false, draw:false, combat:false, end:false}};
  document.title = 'Proxy Table bot';
  // runtime trap: while the bot is deciding, any look outside its own window (another seat's page, saved games) is recorded
  try { Object.defineProperty(window, 'parent', {configurable:true, get(){ if (BOT.deciding) botPeek('window.parent'); return UP; }}); } catch {}
  try { const gi = Storage.prototype.getItem; Storage.prototype.getItem = function(k){ if (BOT.deciding || (BOT.on && /^pt\.(save|decks)$/.test(String(k)))) botPeek('localStorage:' + k); return gi.apply(this, arguments); }; } catch {}
  window.addEventListener('message', e => {
    if (e.source !== UP) return; const d = e.data; if (!d || typeof d !== 'object') return;
    if (d.__ptloopD){ const cl = PTLOOP.frame.clients.get(d.cid); if (cl && cl.connected) cl.emit('message', d.t, PTLOOP.enc(d.p)); return; }
    if (d.__ptbot === 'init' && !BOT.cfg) botBoot(d.cfg).catch(err => { BOT.errs.push('boot ' + (err && err.message || err)); botPost(); });
    if (d.__ptbot === 'cmd' && d.cmd === 'randomFirst' && S){ const pn = phaseNow(); if (pn.n === 0){ if (d.who != null && players().some(p => p.nm === d.who)){ const p = players().find(p => p.nm === d.who); const [n,, g = 0] = currentTurn(); S.turn = [n + 1, p.pid, g]; log(`picked the first player: ${p.me ? S.nm : p.nm}`); commit(); } else ACT.randomFirst(); } }
  });
  setTimeout(() => { try { UP.postMessage({__ptbot:'ready'}, '*'); } catch {} }, 0);
}
function botPeek(what){ BOT.peeks.push({what, t:Date.now(), act:BOT.acts[BOT.acts.length - 1] || ''}); if (BOT.peeks.length > 50) BOT.peeks.shift(); }
function botPost(){ if (!BOTMODE) return; try { PTLOOP.frame.up.postMessage({__ptbot:'stat', st:botStat()}, '*'); } catch {} }
function botStat(){
  const pn = S ? phaseNow() : {n:0, ph:-1};
  return {pid:MYPID, nm:S && S.nm, level:BOT.cfg && BOT.cfg.level, kept:BOT.kept, seen:OPP.size, turn:pn.n, ph:pn.ph, active:S && pn.pid === MYPID, life:S && S.life, lost:!!(S && (S.lost || S.j18out)),
    hc:S && S.hand.length, bf:S && S.bf.length, acts:BOT.n, tally:BOT.tally, errs:BOT.errs.length, peeks:BOT.peeks.length, notes:BOT.notes};
}
async function botBoot(cfg){
  BOT.cfg = cfg; BOT.L = BOT_LEVELS[cfg.level] && BOT_LEVELS[cfg.level].ready ? BOT_LEVELS[cfg.level] : BOT_LEVELS.easy;
  BOT.R = cfg.seed != null ? botRng(cfg.seed) : Math.random;
  if (cfg.seed != null){ const r2 = botRng(cfg.seed * 13 + 7); try { Object.defineProperty(crypto, 'getRandomValues', {configurable:true, value(arr){ for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(r2() * 4294967296) >>> 0; return arr; }}); } catch {} }
  (cfg.dict || []).forEach(a => { if (a && a.k) DICT.set(a.k, a); });
  LOBBY.fmt = FMT[cfg.fmt] ? cfg.fmt : 'cmd';
  LOBBY.deck = {main:cfg.deck.main.map(e => ({k:e.k, q:e.q})), cmd:(cfg.deck.cmd || []).slice(), missing:[]};
  LOBBY.deckName = cfg.deckName || ''; LOBBY.savedId = null;
  $('#nameIn').value = cfg.name; $('#codeIn').value = cfg.code;
  if (cfg.level === 'intermediate') UI.stops.opp.end = true;       // a chance to use instants at the end of an opponent's turn
  await sitDown('join');
  if (!S){ BOT.errs.push('could not sit down: ' + ($('#netStatus') || {}).textContent); botPost(); return; }
  log(`is a bot (${BOT.L.label})${cfg.deckName ? ' playing ' + cfg.deckName : ''}`); commit();
  BOT.on = true; BOT.started = Date.now();
  const fast = !botSpeed();
  if (fast){ window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 12);
    { const qp = queuePublish; queuePublish = function(){ return qp(30); }; } }
  setInterval(botTick, fast ? 25 : 100); setInterval(botPost, 1000); botPost();
}

/* ---- the view a level decides from: my own state + public state, nothing else ---- */
function botView(){
  const pn = phaseNow(); const me = {pid:MYPID, nm:S.nm, life:S.life, hand:S.hand, bf:S.bf, gy:S.gy, cz:S.cz, ex:S.ex, pool:S.pool, libN:S.lib.length, psn:S.psn, cdt:S.cdt, tax:S.tax};
  const opps = [];
  for (const [pid, s] of OPP){ if (s.b27lost || s.lost) continue; opps.push({pid, nm:s.nm, life:s.life, psn:s.psn, bf:s.bf || [], gy:s.gy || [], hc:s.hc, libN:s.lc, cz:s.cz || [], cdt:s.cdt || []}); }
  return {pn, me, opps, R:BOT.R, L:BOT.L, mem:BOT, stack:stackAll().map(i => ({sid:i.sid, pid:i.pid, kind:i.kind, k:i.k, nm:i.nm, txt:i.txt, mv:i.mv, ty:i.ty, tgt:i.tgt, mine:i.pid === MYPID})),
    landPlayed:(S.landT && S.landT[0] === turnStr() ? S.landT[1] : 0), turn:pn.n, mine:pn.mine, ph:pn.ph};
}
const botHook = (name, ...a) => { const L = BOT.L || {}; const f = typeof L[name] === 'function' ? L[name] : BOT_BASE[name]; BOT.deciding = true; try { return f.apply(L, a); } finally { BOT.deciding = false; } };

/* ---- the driver ---- */
function botAct(s){ BOT.n++; BOT.acts.push(`[${turnStr()} ${phaseNow().ph}] ${s}`); if (BOT.acts.length > 60) BOT.acts.shift(); }
const botQ = s => document.querySelector(s), botQA = s => [...document.querySelectorAll(s)];
function botClick(el){ if (!el || el.disabled) return false; el.click(); return true; }
function botSpeed(){ const s = BOT.cfg ? BOT.cfg.speed : 1; return s == null ? 1 : +s; }
function botDelay(kind){ const sp = botSpeed(); if (!sp) return 0; const [a, b] = kind === 'think' ? (BOT.L && BOT.L.think || [600, 1500]) : [180, 420]; return Math.round((a + BOT.R() * (b - a)) * sp); }
function botSig(){
  const pn = phaseNow(); const m = UI.modal;
  return [turnStr(), pn.ph, prioKey() || '', m ? (m.key || m.type + ':' + (m.title || '')) : '', S.prm.length, S.hand.length, S.bf.length, stackAll().length, S.pass, (S.cb && S.cb.step) || '', (cbOf(pn) || {}).step || '', S.bd || ''].join('|');
}
function botTick(){
  if (!BOT.on || BOT.busy || !S || $('#game').hidden) return;
  BOT.busy = true;
  try { botStep(); } catch (e){ BOT.errs.push(String(e && e.stack || e).slice(0, 300)); console.warn('bot', e); }
  finally { BOT.busy = false; }
}
function botStep(){
  const now = Date.now();
  // "do this by hand" boxes: a bot can't, so it notes that and moves on
  if ((UI.notes || []).length){ UI.notes.forEach(n => { BOT.notes++; log(`(bot) skipped a do-by-hand step: ${short(n.text || '', 90)}`); }); UI.notes = []; renderStackPanel(); }
  const sig = botSig();
  if (sig !== BOT.sig){ BOT.sig = sig; BOT.thought = false; BOT.due = now + botDelay('quick'); }
  // never leave a dialog open: anything the bot hasn't answered after 12 s gets the safe answer
  const m = UI.modal; const mk = m ? (m.key || m.type + (m.title || '')) : '';
  if (mk !== BOT.modalKey){ BOT.modalKey = mk; BOT.modalT = now; }
  if (m && now - BOT.modalT > 12000){ botAct('timeout: closing ' + m.type); botSafeModal(m); BOT.modalT = now; return; }
  if (now < BOT.due) return;
  const plan = botDecide(); if (!plan) return;
  if (plan.kind === 'think' && !BOT.thought){ BOT.thought = true; BOT.due = now + botDelay('think'); return; }
  BOT.thought = false;
  plan.run();
  BOT.due = Date.now() + botDelay('quick');
}
function botSafeModal(m){
  try {
    if (m.type === 'choice'){ const i = (m.options || []).findIndex(o => !o.disabled); if (i >= 0){ ACT.choose({dataset:{i:String(i)}}); return; } }
    if (m.type === 'pick'){ const n = Math.min(m.min || 0, (m.cards || []).length); m.sel = (m.cards || []).slice(0, n).map(c => c.id); m.onClose = null; closeModal(); m.resolve && m.resolve(m.sel.slice()); return; }
    if (m.type === 'target'){ const ok = (m.cands || []).map((c, i) => c.ok ? i : -1).filter(i => i >= 0); m.sel = (m.spec && m.spec.upTo) ? [] : ok.slice(0, (m.spec && m.spec.n) || 1); m.onClose = null; closeModal(); m.resolve && m.resolve(m.sel.map(i => m.cands[i])); return; }
    if (m.type === 'bottom'){ m.sel = S.hand.slice(0, m.need).map(c => c.id); ACT.doBottom(); return; }
  } catch (e){ BOT.errs.push('safe ' + e.message); }
  closeModal();
}
const botPlan = (kind, what, run) => ({kind, run:() => { botAct(what); run(); }});
function botDecide(){
  const pn = phaseNow();
  // pregame: keep or mulligan
  if (pn.n === 0){
    if (UI.modal && UI.modal.type === 'bottom') return botPlan('think', 'bottom', () => botAnswerModal(UI.modal));
    if (UI.modal) return botPlan('quick', 'close ' + UI.modal.type, () => closeModal());
    if (BOT.kept) return null;
    const keep = botHook('keep', botView());
    if (keep || BOT.mullN >= 3){ return botPlan('think', 'keep', () => { BOT.kept = true; log(`keeps ${S.hand.length} cards`); commit(); botPost(); }); }
    return botPlan('think', 'mulligan', () => { BOT.mullN++; mulligan(); });
  }
  BOT.kept = true;
  if (UI.modal) return botPlan(['zone', 'opp', 'check'].includes(UI.modal.type) ? 'quick' : 'think', 'modal ' + UI.modal.type + ' ' + short(UI.modal.title || '', 50), () => botAnswerModal(UI.modal));
  if (UI.casting || UI.resolving) return null;
  // things other players asked me to decide (sacrifice / discard / pay or be countered)
  for (const p of S.prm){
    if (p.type === 'unless'){ const v = botView(); const cost = parseCost(`{${p.n}}`); const can = !payPlan(cost, S.pool).err;
      const pay = can && botHook('pay', v, `{${p.n}}`, 'counter');
      return botPlan('think', `${pay ? 'pay' : "don't pay"} {${p.n}} for a counterspell`, () => { const ps = S.prm.find(x => x.id === p.id); if (ps) resolvePrompt(ps, pay); }); }
    return botPlan('think', `choose for ${p.src || 'a prompt'}`, () => { const ps = S.prm.find(x => x.id === p.id); if (ps) choosePrompt(ps); });
  }
  // controlling another player's turn (Mindslaver): move their turn along
  const slv = document.getElementById('o19slv');
  if (slv){ const b = slv.querySelector('[data-o19slv="end"]') || slv.querySelector('[data-o19slv="next"]'); if (b) return botPlan('quick', 'mindslaver: move their turn on', () => botClick(b)); }
  if (S.lost || S.j18out){ if (myBox()) return botPlan('quick', 'pass (lost)', () => doPass()); if (pn.mine && !stackAll().length) return botPlan('quick', 'end turn (lost)', () => { if (pn.ph < 6) endTurnFlow(); else nextAction(); }); return null; }
  if (typeof q24Slaved === 'function' && q24Slaved()) return null;     // someone else is playing my turn
  const cb = pn.ph === 4 ? cbOf(pn) : null;
  if (pn.mine && cb && cb.step === 'atk') return botPlan('think', 'attack', () => botAttack());
  BOT.atkTries = 0;
  if (!pn.mine && cb && cb.step === 'blk' && attackersOnMe(pn).length && (S.bd || '') !== cbKey(pn, cb)) return botPlan('think', 'block', () => botBlock(pn));
  const box = myBox();
  if (box){
    const a = botHook('respond', botView());
    if (a) return botPlan('think', 'respond: ' + botActLabel(a), () => botDo(a));
    return botPlan('quick', 'pass priority', () => { if (!botClick(botQ('#stackpanel [data-act="passPrio"]'))) doPass(); });
  }
  if (!pn.mine) return null;
  if (S.untapN < pn.n) return botPlan('quick', 'start turn', () => { if (!botClick(botQ('#phasebar [data-act="startTurn"]'))) startMyTurn(); });
  if (stackAll().length) return null;
  if (pn.ph === 3 || pn.ph === 5){
    const pk = turnStr() + '.' + pn.ph + '.' + ((S.cb && S.cb.n) || 0);
    BOT.ph[pk] = BOT.ph[pk] || 0;
    if (BOT.ph[pk] < 14){
      const a = botHook('main', botView());
      if (a){ BOT.ph[pk]++; return botPlan(a.how === 'land' ? 'quick' : 'think', botActLabel(a), () => botDo(a)); }
    }
  }
  return botPlan('quick', 'next step', () => { const nb = botQ('#phasebar [data-act="next"]'); if (!botClick(nb)) nextAction(); });
}
function botActLabel(a){ return `${a.how} ${a.c ? cname(a.c) : ''}${a.why ? ' (' + a.why + ')' : ''}`; }
// do an action through the card's own menu, like a player clicking it
function botDo(a){
  const tk = turnStr() + ':' + (a.c && a.c.id) + ':' + a.how + ':' + (a.ab ?? '');
  BOT.tried[tk] = (BOT.tried[tk] || 0) + 1;
  try {
    if (a.how === 'pw'){ cardMenu(a.c.id, 300, 200); const b = botQA('#menu button[data-act]:not([disabled])').find(x => /loyalty/i.test(x.innerText) || x.dataset.act === 'pwOpen' || x.dataset.act === 'pw'); if (b){ BOT.pwWant = a; BOT.tally.pw++; botClick(b); return; } closeMenu(); return; }
    cardMenu(a.c.id, 300, 200);
    const sel = a.how === 'land' ? '[data-act="playLand"]:not([data-force])' : a.how === 'cast' ? '[data-act="cast"]' : a.how === 'ab' ? `[data-act="actAb"][data-i="${a.ab}"]` : `[data-act="${a.act}"]`;
    const b = botQ(`#menu button${sel}:not([disabled])`);
    if (!b){ closeMenu(); botAct('could not ' + a.how + ' ' + cname(a.c)); return; }
    BOT.lastCast = {k:a.c.k, id:a.c.id, a, t:Date.now()};
    BOT.tally[a.how === 'land' ? 'land' : a.how === 'cast' ? 'cast' : 'ab']++;
    botClick(b);
  } catch (e){ BOT.errs.push('do ' + e.message); try { closeMenu(); } catch {} }
}
function botTriedTooOften(c, how, ab){ return (BOT.tried[turnStr() + ':' + (c && c.id) + ':' + how + ':' + (ab ?? '')] || 0) >= 2; }

/* ---- combat ---- */
function botAttack(){
  const opts = defOpts();
  if (!opts.length){ if (!botClick(botQ('#cbpanel [data-act="atkGo"]'))) declareAttackers(); return; }
  try { ACT.atkNone(); } catch { UI.atkSel = {}; }
  BOT.atkTries = (BOT.atkTries || 0) + 1;
  let sel = {};
  if (BOT.atkTries <= 3){ try { sel = botHook('attack', botView()) || {}; } catch (e){ BOT.errs.push('attack ' + e.message); sel = {}; } }
  for (const [id, d] of Object.entries(sel)) if (d && opts.some(o => o.key === d)) UI.atkSel[id] = d;
  S.bf.forEach(c => { if (!canAttack(c) && mustAttack(c) && !UI.atkSel[c.id]) UI.atkSel[c.id] = opts[0].key; });
  const n = Object.values(UI.atkSel).filter(Boolean).length; botAct(`attacks with ${n} creature${n === 1 ? '' : 's'}`);
  if (n && BOT.atkTries === 1){ BOT.tally.attack++; BOT.tally.attackers += n; }
  try { renderCombatPanel(); } catch {}
  if (!botClick(botQ('#cbpanel [data-act="atkGo"]'))) declareAttackers();
}
function botBlock(pn){
  let sel = {}; try { sel = botHook('block', botView()) || {}; } catch (e){ BOT.errs.push('block ' + e.message); }
  const atts = attackersOnMe(pn);
  UI.blkSel = {};
  for (const [bid, aid] of Object.entries(sel)){ const b = S.bf.find(x => x.id === +bid), a = atts.find(x => x.id === +aid); if (b && a && !canBlock(b, a, pn.pid)) UI.blkSel[b.id] = a.id; }
  try { renderCombatPanel(); } catch {}
  BOT.tally.block++; BOT.tally.blockers += Object.keys(UI.blkSel).length;
  const key = cbKey(pn, cbOf(pn));
  if (!botClick(botQ('#cbpanel [data-act="blkGo"]'))) confirmBlocks(false);
  if ((S.bd || '') !== key){ UI.blkSel = {}; confirmBlocks(false); botAct('blocks: none (the first plan was not allowed)'); }
}

/* ---- dialogs ---- */
function botAnswerModal(m){
  if (!m || UI.modal !== m) return;
  const v = botView(); const t = m.type;
  try {
    if (t === 'choice'){
      const opts = (m.options || []).map((o, i) => ({...o, i})).filter(o => !o.disabled);
      if (!opts.length){ closeModal(); return; }
      let i = botHook('choice', v, m); if (!opts.some(o => o.i === i)) i = opts[0].i;
      ACT.choose({dataset:{i:String(i)}}); return;
    }
    if (t === 'pick'){
      const cards = m.cards || []; const max = Math.min(m.max ?? 1, cards.length), min = Math.min(m.min ?? 0, cards.length);
      let ids = botHook('pick', v, m) || []; ids = ids.filter(id => cards.some(c => c.id === id)).slice(0, max);
      if (ids.length < min) ids = ids.concat(cards.map(c => c.id).filter(id => !ids.includes(id)).slice(0, min - ids.length));
      m.sel = ids; ACT.pickDone(); return;
    }
    if (t === 'target'){
      const sp = m.spec || {n:1}; const ok = (m.cands || []).map((c, i) => c.ok ? i : -1).filter(i => i >= 0);
      let sel = botHook('target', v, m) || []; sel = sel.filter(i => ok.includes(i));
      const need = sp.upTo ? 0 : Math.min(sp.n || 1, ok.length);
      if (sel.length < need) sel = sel.concat(ok.filter(i => !sel.includes(i)).slice(0, need - sel.length));
      sel = sel.slice(0, Math.min(sp.n || 1, 99));
      m.sel = sel; renderModal(); const d = botQ('#modal [data-act="tgtDone"]');
      if (!botClick(d)){ m.onClose = null; closeModal(); m.resolve && m.resolve(sel.map(i => m.cands[i])); }
      return;
    }
    if (t === 'ask'){ const n = botHook('number', v, m); const i = botQ('#askIn'); const f = botQ('#modal form[data-form="ask"]');
      if (i && f){ i.value = String(Math.max(0, n | 0)); f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', {cancelable:true, bubbles:true})); } else closeModal(); return; }
    if (t === 'split'){ if (!botClick(botQ('#modal [data-act="splitGo"]'))) closeModal(); return; }
    if (t === 'pw'){ const bs = botQA('#modal [data-act="pwGo"]:not([disabled])'); const i = botHook('pw', v, m, bs.map(b => +b.dataset.i)); const b = bs.find(x => +x.dataset.i === i);
      if (b){ botClick(b); setTimeout(() => { if (UI.modal === m) closeModal(); }, 300); } else closeModal(); return; }
    if (t === 'prolif'){ if (!botClick(botQ('#modal [data-act="prolifGo"]'))) closeModal(); return; }
    if (t === 'bottom'){ const need = Math.min(m.need, S.hand.length); const ids = (botHook('bottom', v, need) || []).filter(id => S.hand.some(c => c.id === id)).slice(0, need);
      for (const c of S.hand) if (ids.length < need && !ids.includes(c.id)) ids.push(c.id);
      m.sel = ids; renderModal(); if (!botClick(botQ('#modal [data-act="doBottom"]'))) ACT.doBottom(); return; }
  } catch (e){ BOT.errs.push('modal ' + t + ' ' + e.message); botSafeModal(m); return; }
  closeModal();      // zone views (scry / look at the top), card views, stops: leave things as they are
}

/* ---------------------------------------------------------------- 5. shared decision helpers (used by every level) */
// available mana: what's floating + one per untapped source the auto-payer could tap
function botManaAvail(){
  let n = poolTotal(S.pool);
  try { (autoSources() || []).forEach(s => { n += Math.max(1, ...s.opts.map(o => o.outs.length)); }); } catch {}
  return n;
}
function botCastable(){
  const out = [];
  for (const c of S.hand){ if (isLand(c.k)) continue; try { if (castCheck(c, 'hand').ok) out.push({c, zone:'hand'}); } catch {} }
  for (const c of S.cz){ try { if (castCheck(c, 'cz').ok) out.push({c, zone:'cz'}); } catch {} }
  return out.filter(x => !botTriedTooOften(x.c, 'cast'));
}
function botLandsInHand(){ return S.hand.filter(c => isLand(c.k)).filter(c => { try { return castCheck(c, 'hand').ok; } catch { return false; } }); }
function botCreatures(bf, pid){ return (bf || []).filter(c => c.k && !c.fd && (() => { try { return isCreatureCard(c); } catch { return false; } })()); }
function botPT(c, pid){ try { const s = stats(c, pid); if (s) return s; } catch {} const r = cardRoles(c.k); return r ? [r.pow, r.tou] : [0, 0]; }
function botKw(c, w, pid){ try { return !!kwOf(c, w, pid); } catch { return false; } }
// how dangerous a player is to me: their board (public), cards in hand, life
function botThreat(o){
  let t = 0; botCreatures(o.bf, o.pid).forEach(c => { const [p] = botPT(c, o.pid); t += Math.max(0, p) * (botKw(c, 'flying', o.pid) ? 1.4 : 1) + 0.5; });
  (o.bf || []).forEach(c => { if (!c.k || c.fd) return; const r = cardRoles(c.k); if (r && !r.creature && !r.land) t += r.value * 2 + (r.pw ? 3 : 0); });
  return t + (o.hc || 0) * 0.3 + Math.max(0, o.life) * 0.05;
}
// what a dialog is about, from the source card's text
function botSrcText(title){
  const nm = String(title || '').split(/:|\(/)[0].trim();
  const a = [...DICT.values()].find(x => x.n === nm || (x.n || '').split(' // ')[0] === nm || (x.back && x.back.n === nm));
  return a ? String(roleText(a)) + (a.back ? '\n' + String(a.back.o || '').toLowerCase() : '') : '';
}
// the defaults every level inherits
const BOT_BASE = {
  keep(v){ const l = v.me.hand.filter(c => isLand(c.k)).length; return l >= 1 && l <= 6; },
  bottom(v, need){ return v.me.hand.slice().sort((x, y) => (cardRoles(x.k)?.value || 0) - (cardRoles(y.k)?.value || 0)).slice(0, need).map(c => c.id); },
  main(v){ return null; }, respond(v){ return null; }, attack(v){ return {}; }, block(v){ return {}; },
  choice(v, m){ return (m.options || []).findIndex(o => !o.disabled); },
  pick(v, m){ return (m.cards || []).slice(0, m.min || 0).map(c => c.id); },
  target(v, m){ return []; },
  number(v, m){ return +m.def || 0; },
  pay(v, cost){ return true; },
  pw(v, m, avail){ return avail[0] ?? -1; },
};
