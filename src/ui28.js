/* ===== ui28: new look + interactive table + "Ask about your cards" (Scryfall) ===== */
// Artwork made for Proxy Table with Higgsfield (original designs: tavern hero, emerald playmat, card back, emblem).
// Loaded from Higgsfield's CDN; if it can't be reached the old gradients stay, so nothing breaks offline.
const UI28_ART = (() => { const b = 'https://d8j0ntlcm91z4.cloudfront.net/user_3MBpZ643qhHhGn8CmuuGhr7oLkU/hf_20261117_';
  return {hero:b + '131540_f91f25e6-537e-4690-aaf5-5357b643cc91.png', mat:b + '131540_9a546c6a-90ff-4665-be68-273154979ce2.png',
    back:b + '131540_8196b3e8-2f4f-41d0-b43f-1e2d1c6c12fa.png', emblem:b + '131539_4a434bd3-97c3-439b-9879-6d7558c4d813.png'}; })();
const U28 = {fx:true, life:new Map(), seen:new Set(), turnKey:'', phKey:'', overDone:false, opCount:new Map()};
try { U28.fx = localStorage.getItem('pt.fx') !== '0'; } catch {}
const u28quiet = () => (typeof BOTMODE !== 'undefined' && BOTMODE) || !U28.fx || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

const UI28_CSS = `
:root{--glow:rgba(212,168,79,.55)}
/* ---------- art ---------- */
.u28art #lobby{background:linear-gradient(180deg,rgba(10,18,15,.15),rgba(10,18,15,.55) 260px,rgba(10,18,15,.95) 470px,var(--felt) 640px),var(--u28hero) center top/100% auto no-repeat,var(--felt)}
.u28art #lobby .brand{padding-top:96px;padding-bottom:26px}
.u28art #lobby .lobby-grid > *,.u28art #lobby .resume{background:rgba(12,20,17,.86);backdrop-filter:blur(6px)}
.u28art #lobby .brand h1{text-shadow:0 4px 24px rgba(0,0,0,.8)}
.u28art #lobby .brand p{text-shadow:0 2px 10px rgba(0,0,0,.9)}
.u28art #bf{background:linear-gradient(rgba(8,16,13,.35),rgba(8,16,13,.35)),var(--u28mat) center/cover no-repeat;border-radius:12px}
.u28art .opp{background:linear-gradient(rgba(8,14,12,.78),rgba(8,14,12,.78)),var(--u28mat) center/cover no-repeat}
.u28art .card.back{background:var(--u28back) center/cover no-repeat,#123220;border:1px solid #8a6a2c}
.u28art .card.back::after{display:none}
.u28logo{width:26px;height:26px;border-radius:50%;vertical-align:-6px;margin-right:6px;box-shadow:0 0 0 1px rgba(212,168,79,.5),0 0 12px rgba(212,168,79,.35)}
#lobby .brand h1 .u28logo{width:64px;height:64px;vertical-align:-10px;margin-right:12px}
/* ---------- motion ---------- */
.u28fx .card{transition:transform .22s cubic-bezier(.2,.9,.3,1.2),box-shadow .2s,filter .2s}
.u28fx #hand .card:hover{transform:translateY(-16px) scale(1.07);box-shadow:0 14px 28px rgba(0,0,0,.55),0 0 0 2px var(--glow);z-index:5}
.u28fx #bf .card:not(.tapped):hover{box-shadow:0 8px 20px rgba(0,0,0,.5),0 0 14px var(--glow)}
.u28fx #bf .card.tapped:hover{box-shadow:0 8px 20px rgba(0,0,0,.5),0 0 14px var(--glow)}
.u28fx .card.u28in{animation:u28in .45s cubic-bezier(.2,.9,.3,1.3) both}
@keyframes u28in{0%{opacity:0;transform:translateY(-26px) scale(.6) rotate(-6deg);filter:brightness(2)}60%{opacity:1;filter:brightness(1.4)}100%{filter:none}}
.u28fx .card.tapped.u28in{animation:none}
.u28fx #modal:not([hidden]) .box{animation:u28pop .24s cubic-bezier(.2,.9,.3,1.25) both}
.u28fx #modal:not([hidden]){animation:u28fade .18s both;backdrop-filter:blur(3px)}
@keyframes u28pop{0%{opacity:0;transform:translateY(14px) scale(.94)}100%{opacity:1;transform:none}}
@keyframes u28fade{0%{opacity:0}100%{opacity:1}}
.u28fx .toast:not([hidden]){animation:u28toast .32s cubic-bezier(.2,.9,.3,1.3) both;box-shadow:0 10px 30px rgba(0,0,0,.6),0 0 18px rgba(212,168,79,.35)}
@keyframes u28toast{0%{opacity:0;transform:translate(-50%,20px) scale(.9)}100%{opacity:1;transform:translate(-50%,0)}}
.u28fx #phasebar .phc.on{animation:u28ph .5s cubic-bezier(.2,.9,.3,1.4)}
@keyframes u28ph{0%{transform:scale(.7)}60%{transform:scale(1.15)}100%{transform:none}}
.u28fx #stackpanel:not([hidden]){animation:u28slide .25s both}
@keyframes u28slide{0%{opacity:0;transform:translateX(30px)}100%{opacity:1;transform:none}}
.u28fx #log > div:last-child{animation:u28log .5s both}
@keyframes u28log{0%{background:rgba(212,168,79,.22)}100%{background:transparent}}
.u28fx .btn{transition:transform .08s,filter .15s,box-shadow .15s}
.u28fx .btn:active{transform:scale(.95)}
.u28fx .btn.primary:hover,.u28fx .btn.glow:hover{box-shadow:0 0 16px rgba(212,168,79,.45)}
.u28fx .opp.active{box-shadow:0 0 0 1px var(--seatc),0 0 22px color-mix(in srgb,var(--seatc) 35%,transparent);transition:box-shadow .4s}
.u28fx .lobby-grid > *{animation:u28up .4s both}
@keyframes u28up{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:none}}
/* life numbers */
.u28float{position:fixed;z-index:120;pointer-events:none;font:800 30px/1 var(--f-display);text-shadow:0 2px 8px rgba(0,0,0,.9);animation:u28float 1.4s ease-out forwards}
.u28float.up{color:var(--good)}.u28float.down{color:var(--bad)}
@keyframes u28float{0%{opacity:0;transform:translate(-50%,0) scale(.6)}15%{opacity:1;transform:translate(-50%,-10px) scale(1.25)}100%{opacity:0;transform:translate(-50%,-70px) scale(1)}}
.u28bump{animation:u28bump .45s}
@keyframes u28bump{40%{transform:scale(1.35)}}
.u28hurt{position:fixed;inset:0;pointer-events:none;z-index:119;box-shadow:inset 0 0 120px rgba(227,112,91,.55);animation:u28fadeout .8s forwards}
@keyframes u28fadeout{0%{opacity:1}100%{opacity:0}}
/* turn banner */
.u28banner{position:fixed;left:0;right:0;top:38%;z-index:118;pointer-events:none;display:flex;justify-content:center}
.u28banner div{font:800 46px/1 var(--f-display);letter-spacing:.06em;padding:16px 60px;color:var(--bc,var(--brass));background:linear-gradient(90deg,transparent,rgba(8,14,12,.92) 20%,rgba(8,14,12,.92) 80%,transparent);text-shadow:0 0 22px var(--bc,var(--brass));animation:u28banner 1.7s cubic-bezier(.2,.8,.2,1) forwards}
.u28banner small{display:block;font:600 15px/1.4 var(--f-body);letter-spacing:.2em;text-transform:uppercase;color:var(--dim);text-shadow:none;text-align:center;margin-top:4px}
@keyframes u28banner{0%{opacity:0;transform:translateX(-40%) skewX(-12deg)}18%{opacity:1;transform:none}78%{opacity:1;transform:none}100%{opacity:0;transform:translateX(40%) skewX(12deg)}}
/* game over */
.u28over{position:fixed;inset:0;z-index:125;display:flex;align-items:center;justify-content:center;pointer-events:none;background:radial-gradient(circle,rgba(0,0,0,.25),rgba(0,0,0,.7));animation:u28fade .4s both}
.u28over .msg{pointer-events:auto;text-align:center;padding:26px 46px;border-radius:18px;background:rgba(8,14,12,.94);border:1px solid var(--brass);box-shadow:0 0 50px rgba(212,168,79,.4);animation:u28pop .5s cubic-bezier(.2,.9,.3,1.4) both}
.u28over h2{margin:0 0 6px;font:800 54px/1 var(--f-display);color:var(--brass);text-shadow:0 0 30px rgba(212,168,79,.7)}
.u28over.lose h2{color:var(--bad);text-shadow:0 0 30px rgba(227,112,91,.6)}
.u28over i{position:absolute;top:-10px;width:9px;height:14px;border-radius:2px;animation:u28conf linear forwards}
@keyframes u28conf{to{transform:translateY(110vh) rotate(720deg);opacity:.2}}
/* loop / combo pop-ups */
.u28fx #modal .box.u28loop{border-color:var(--brass);box-shadow:0 0 0 1px var(--brass),0 0 40px rgba(212,168,79,.35),0 20px 60px rgba(0,0,0,.6)}
#modal .box.u28loop .mhead h3::before{content:"∞";display:inline-block;margin-right:10px;color:var(--brass);font-size:28px;vertical-align:-3px;animation:u28spin 3s linear infinite}
@keyframes u28spin{to{transform:rotate(360deg)}}
.u28combo{position:fixed;right:20px;bottom:150px;z-index:117;max-width:340px;background:rgba(8,14,12,.96);border:1px solid var(--brass);border-radius:12px;padding:12px 14px 12px 50px;box-shadow:0 0 30px rgba(212,168,79,.35);animation:u28slide .35s both;cursor:pointer}
.u28combo::before{content:"✦";position:absolute;left:16px;top:12px;font-size:24px;color:var(--brass);animation:u28spin 4s linear infinite}
.u28combo b{color:var(--brass)}
/* ---------- Ask about your cards ---------- */
#u28askBtn{position:fixed;right:18px;bottom:18px;z-index:90;border-radius:999px;padding:10px 16px 10px 12px;font-weight:700;background:var(--brass);color:var(--brass-ink);border:0;box-shadow:0 6px 20px rgba(0,0,0,.5),0 0 18px rgba(212,168,79,.35);display:flex;gap:8px;align-items:center}
#u28askBtn img{width:24px;height:24px;border-radius:50%}
.u28fx #u28askBtn{animation:u28up .5s .4s both}
.u28fx #u28askBtn:hover{transform:translateY(-2px) scale(1.04)}
body.u28game #u28askBtn{display:none}
#u28ask{position:fixed;top:0;right:0;bottom:0;width:min(460px,100vw);z-index:130;background:#0a130f;border-left:1px solid rgba(212,168,79,.45);box-shadow:-20px 0 50px rgba(0,0,0,.6);display:flex;flex-direction:column;transform:translateX(105%);transition:transform .3s cubic-bezier(.2,.9,.3,1)}
#u28ask.open{transform:none}
#u28ask header{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line)}
#u28ask header h3{margin:0;flex:1;font:700 21px/1.1 var(--f-display)}
#u28ask form{padding:12px 16px;display:grid;gap:8px;border-bottom:1px solid var(--line)}
#u28ask textarea{min-height:58px;resize:vertical}
#u28ask .chips{display:flex;flex-wrap:wrap;gap:6px}
#u28ask .chips button{font-size:12px;border-radius:999px;padding:3px 9px;background:var(--panel-2);border:1px solid var(--line)}
#u28ask .chips button:hover{border-color:var(--brass)}
#u28ask .out{flex:1;overflow:auto;padding:12px 16px;display:grid;gap:12px;align-content:start}
#u28ask .res{display:grid;grid-template-columns:96px 1fr;gap:10px;background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:10px;animation:u28up .3s both}
#u28ask .res img{width:96px;border-radius:5px}
#u28ask .res h4{margin:0 0 4px;font:700 17px/1.2 var(--f-display)}
#u28ask .res .ot{white-space:pre-wrap;font-size:13px;color:var(--ink)}
#u28ask .rul{grid-column:1/-1;font-size:13px;border-left:3px solid var(--line);padding:3px 0 3px 9px;margin:3px 0;color:var(--dim)}
#u28ask .rul.hit{border-left-color:var(--brass);color:var(--ink)}
#u28ask .rul small{color:var(--faint)}
#u28ask mark{background:rgba(212,168,79,.3);color:inherit;border-radius:2px}
#u28ask .note{font-size:13px;color:var(--dim)}
#u28ask .claude{border:1px solid rgba(192,133,82,.6);border-left:3px solid #c08552;border-radius:10px;padding:10px 12px;white-space:pre-wrap;background:rgba(192,133,82,.08);animation:u28up .3s both}
#u28ask .spin{display:inline-block;width:14px;height:14px;border:2px solid var(--brass);border-right-color:transparent;border-radius:50%;animation:u28spin .8s linear infinite;vertical-align:-2px;margin-right:6px}
#u28ask .list{display:flex;flex-wrap:wrap;gap:6px}
#u28ask .list button{font-size:13px;border-radius:7px;padding:4px 9px;background:var(--panel-2);border:1px solid var(--line)}
#u28ask .list button:hover{border-color:var(--brass)}
`;

/* ---------- install ---------- */
function u28install(){
  if (document.getElementById('u28css')) return;
  const st = document.createElement('style'); st.id = 'u28css'; st.textContent = UI28_CSS; document.head.appendChild(st);
  const root = document.documentElement;
  // load the art first; only switch the look on once it has arrived
  const pre = (u, v) => new Promise(r => { const i = new Image(); i.onload = () => { root.style.setProperty(v, `url("${u}")`); r(1); }; i.onerror = () => r(0); i.referrerPolicy = 'no-referrer'; i.src = u; });
  Promise.all([pre(UI28_ART.hero, '--u28hero'), pre(UI28_ART.mat, '--u28mat'), pre(UI28_ART.back, '--u28back')]).then(ok => { if (ok.some(Boolean)) root.classList.add('u28art'); });
  u28fxClass();
  const h1 = document.querySelector('#lobby .brand h1'); if (h1 && !h1.querySelector('.u28logo')) h1.insertAdjacentHTML('afterbegin', `<img class="u28logo" alt="" src="${UI28_ART.emblem}" referrerpolicy="no-referrer" onerror="this.remove()">`);
  try { const l = document.createElement('link'); l.rel = 'icon'; l.href = UI28_ART.emblem; document.head.appendChild(l); } catch {}
  // the Ask button (lobby) and panel
  document.body.insertAdjacentHTML('beforeend', `<button id="u28askBtn" type="button" data-act="u28ask" title="Look up your cards' official text and rulings on Scryfall"><img alt="" src="${UI28_ART.emblem}" referrerpolicy="no-referrer" onerror="this.remove()">Ask about your cards</button>
  <aside id="u28ask" aria-label="Ask about your cards" aria-hidden="true">
    <header><h3>Ask about your cards</h3><button class="btn small ghost" type="button" data-act="u28askClose" aria-label="Close">✕</button></header>
    <form id="u28askForm" autocomplete="off">
      <textarea id="u28q" maxlength="400" placeholder="e.g. How does Thassa's Oracle work with Demonic Consultation?  ·  Which of my cards have flying?  ·  t:creature o:haste"></textarea>
      <div style="display:flex;gap:8px;align-items:center"><button class="btn primary" type="submit">Ask Scryfall</button><button class="btn" type="button" data-act="u28askClaude" id="u28claudeBtn" title="Uses your Claude coach key (set in Trainer → Claude coach)">Ask Claude too</button><span class="spacer" style="flex:1"></span></div>
      <div class="chips" id="u28chips"></div>
    </form>
    <div class="out" id="u28out"><div class="note">Ask about any card in your deck, or any card at all. Scryfall gives each card's official text and its official rulings; the ones that match your question are highlighted. To search your deck, ask “which of my cards …” or type Scryfall search syntax (<code>o:flying</code>, <code>t:instant</code>). For a plain-English answer, press <b>Ask Claude too</b> (needs the Claude coach turned on with your key).</div></div>
  </aside>`);
  document.getElementById('u28askForm').addEventListener('submit', e => { e.preventDefault(); u28askRun(); });
  document.getElementById('u28q').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); u28askRun(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('u28ask').classList.contains('open')) u28askClose(); });
  u28chips();
}
function u28fxClass(){ document.documentElement.classList.toggle('u28fx', !u28quiet()); }

/* ---------- table reactions (run after every render) ---------- */
function u28react(){
  try {
    document.body.classList.toggle('u28game', !!(S && !$('#game').hidden));
    if (!S || $('#game').hidden) return;
    const quiet = u28quiet();
    // cards that just arrived on my battlefield / in my hand
    const now = new Set();
    for (const el of document.querySelectorAll('#bf .card[data-id], #hand .card[data-id]')){
      const key = (el.closest('#hand') ? 'h' : 'b') + el.dataset.id; now.add(key);
      if (!quiet && U28.seen.size && !U28.seen.has(key)) el.classList.add('u28in');
    }
    // opponents' new permanents (they have no ids here: count by card)
    const oc = new Map();
    document.querySelectorAll('#opps .opp').forEach((o, oi) => o.querySelectorAll('.obf .card').forEach(el => { const k = oi + '|' + (el.dataset.k || 'fd'); const n = (oc.get(k) || 0) + 1; oc.set(k, n); if (!quiet && U28.seen.size && n > (U28.opCount.get(k) || 0)) el.classList.add('u28in'); }));
    U28.opCount = oc; U28.seen = now.size ? now : new Set(['_']);
    // life changes
    const lifeEls = [[MYPID, S.life, document.querySelector('#stats .life .num')]];
    document.querySelectorAll('#opps .opp').forEach((o, i) => { const p = players().filter(p => !p.me)[i]; if (p && p.s) lifeEls.push([p.pid, p.s.life, o.querySelector('.lifebadge')]); });
    for (const [pid, life, el] of lifeEls){
      const was = U28.life.get(pid); U28.life.set(pid, life);
      if (was === undefined || was === life || !el || quiet) continue;
      const r = el.getBoundingClientRect(); const d = life - was;
      const f = document.createElement('div'); f.className = 'u28float ' + (d > 0 ? 'up' : 'down'); f.textContent = (d > 0 ? '+' : '−') + Math.abs(d);
      f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.top - 4) + 'px'; document.body.appendChild(f); setTimeout(() => f.remove(), 1500);
      el.classList.remove('u28bump'); void el.offsetWidth; el.classList.add('u28bump');
      if (pid === MYPID && d <= -5){ const h = document.createElement('div'); h.className = 'u28hurt'; document.body.appendChild(h); setTimeout(() => h.remove(), 900); }
    }
    // turn banner
    const [n, pid] = currentTurn(); const tk = n + '|' + pid;
    if (n > 0 && tk !== U28.turnKey){ const first = !U28.turnKey; U28.turnKey = tk;
      if (!first && !quiet){ const mine = pid === MYPID; const b = document.createElement('div'); b.className = 'u28banner';
        b.innerHTML = `<div style="--bc:${mine ? 'var(--brass)' : seatColor(pid)}">${mine ? 'Your turn' : esc(nameOf(pid)) + "'s turn"}<small>Turn ${n}</small></div>`;
        document.body.appendChild(b); setTimeout(() => b.remove(), 1800); } }
    // game over
    const win = S.log && S.log.slice(-6).some(e => /\bwins? the game\b/i.test(e.s) && !/can't win/i.test(e.s));
    const lost = !!(S.lost || S.g23lost);
    if ((win || lost) && !U28.overDone){ U28.overDone = true; if (!quiet) u28over(win && !lost); }
    if (!win && !lost) U28.overDone = false;
    // the loop question gets its own look
    const mb = document.querySelector('#modal .box'); if (mb) mb.classList.toggle('u28loop', !!(UI.modal && /loop|forever/i.test(UI.modal.title || '')));
  } catch (e){ console.warn('u28 react', e); }
}
function u28over(win){
  const o = document.createElement('div'); o.className = 'u28over' + (win ? '' : ' lose');
  const conf = win ? Array.from({length:70}, () => `<i style="left:${Math.random() * 100}%;background:${['#d4a84f','#93cf82','#6fb3d9','#e0819e','#ece6d4'][Math.floor(Math.random() * 5)]};animation-duration:${2 + Math.random() * 2.5}s;animation-delay:${Math.random() * .8}s"></i>`).join('') : '';
  o.innerHTML = `${conf}<div class="msg"><h2>${win ? 'Victory!' : 'Defeat'}</h2><div style="color:var(--dim);margin-bottom:12px">${win ? 'The table is yours.' : 'Shuffle up — Game ▾ → New game.'}</div><button class="btn primary" type="button">Close</button></div>`;
  o.querySelector('button').onclick = () => o.remove(); document.body.appendChild(o); setTimeout(() => o.remove(), 9000);
}
// "Combo ready" gets a pop-up card too
{ const lg = log; log = function(s){ const r = lg.apply(this, arguments);
    try { if (!u28quiet() && /^Combo ready: /.test(String(s))){ document.querySelectorAll('.u28combo').forEach(x => x.remove()); const d = document.createElement('div'); d.className = 'u28combo';
      d.innerHTML = `<b>Combo ready</b><br>${esc(String(s).replace(/^Combo ready: /, '').replace(/ Start it and the table asks how many times\.$/, ''))}<br><small style="color:var(--dim)">Start it and the table asks how many times.</small>`;
      d.onclick = () => d.remove(); document.body.appendChild(d); setTimeout(() => d.remove(), 8000); } } catch {}
    return r; }; }
{ const rg = renderGame; renderGame = function(){ const r = rg.apply(this, arguments); try { u28react(); } catch {} return r; }; }
{ const rm = renderModal; renderModal = function(){ const r = rm.apply(this, arguments); try { const mb = document.querySelector('#modal .box'); if (mb) mb.classList.toggle('u28loop', !!(UI.modal && /loop|forever/i.test(UI.modal.title || ''))); } catch {} return r; }; }
{ const rt = renderTop; renderTop = function(){ const r = rt.apply(this, arguments);
    try { const tb = document.getElementById('topbar'); const logo = tb && tb.querySelector('.logo');
      if (logo && !logo.querySelector('.u28logo')) logo.insertAdjacentHTML('afterbegin', `<img class="u28logo" alt="" src="${UI28_ART.emblem}" referrerpolicy="no-referrer" onerror="this.remove()">`);
      const gm = tb && tb.querySelector('[data-act="gameMenu"]'); if (gm && !tb.querySelector('[data-act="u28ask"]')) gm.insertAdjacentHTML('beforebegin', `<button class="btn small" data-act="u28ask" type="button" title="Card text and official rulings from Scryfall">Ask ✦</button>`);
    } catch {} return r; }; }
{ const gx = gameMenuExtra; gameMenuExtra = function(){ return gx.apply(this, arguments) + mb('u28fx', `Animations: <b>${U28.fx ? 'on' : 'off'}</b>`); }; }

/* ---------- Ask about your cards ---------- */
const U28A = {busy:false, last:null};
function u28deckKeys(){
  const out = new Set(); const add = k => { if (k && info(k)) out.add(k); };
  try { if (S && S.deck){ (S.deck.cmd || []).forEach(e => add(e.k || e)); (S.deck.main || []).forEach(e => add(e.k || e)); } } catch {}
  try { if (LOBBY.deck){ (LOBBY.deck.cmd || []).forEach(e => add(e.k || e)); (LOBBY.deck.main || []).forEach(e => add(e.k || e)); } } catch {}
  try { if (S) for (const z of ['bf', 'hand', 'gy', 'ex', 'cz']) (S[z] || []).forEach(c => add(c.k)); for (const [, s] of OPP) for (const c of (s.bf || [])) add(c.k); } catch {}
  return [...out];
}
function u28chips(){
  const el = document.getElementById('u28chips'); if (!el) return;
  const ks = u28deckKeys().filter(k => !isLand(k)); const pick = ks.slice().sort(() => Math.random() - .5);
  const a = pick[0] && info(pick[0]).n, b = pick[1] && info(pick[1]).n;
  const qs = [a ? `Rulings for ${a}` : 'Rulings for Sol Ring', a && b ? `How does ${a} work with ${b}?` : "How does Thassa's Oracle work with Demonic Consultation?", 'Which of my cards have flying?', 'Which of my cards draw cards?', 'o:"enters" t:creature'];
  el.innerHTML = qs.map(q => `<button type="button" data-u28q="${esc(q)}">${esc(q)}</button>`).join('');
  el.querySelectorAll('[data-u28q]').forEach(b => b.onclick = () => { document.getElementById('u28q').value = b.dataset.u28q; u28askRun(); });
}
function u28askOpen(){ const p = document.getElementById('u28ask'); u28chips(); p.classList.add('open'); p.setAttribute('aria-hidden', 'false'); setTimeout(() => document.getElementById('u28q').focus(), 50); u28claudeState(); }
function u28askClose(){ const p = document.getElementById('u28ask'); p.classList.remove('open'); p.setAttribute('aria-hidden', 'true'); }
function u28claudeState(){ const b = document.getElementById('u28claudeBtn'); if (!b) return; const g = typeof coGate === 'function' ? coGate('ask') : 'unavailable'; b.disabled = !!g && g !== ''; b.title = g ? `Claude coach: ${g} (Trainer → Claude coach)` : 'Send the question and the cards’ rulings to Claude (uses your coach key)'; }
const U28_STOP = new Set('a an and are as at be but by can card cards do does for from have has how i if in into is it its me my of on or our rule rules ruling rulings that the their them then there these they this to what when where which who why will with work works would you your deck in play'.split(' '));
const u28words = q => norm(q).replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !U28_STOP.has(w));
// names mentioned in the question: deck/table cards first (full name or the part before the comma), longest first
function u28namesIn(q){
  const nq = ' ' + norm(q).replace(/[^a-z0-9' ,-]/g, ' ') + ' ';
  const hits = []; const seen = new Set();
  const cands = u28deckKeys().map(k => [k, info(k).n]);
  for (const [k, n] of cands.sort((a, b) => b[1].length - a[1].length)){
    const full = norm(n.split(' // ')[0]); const short = full.split(',')[0];
    if (seen.has(full)) continue;
    if (nq.includes(' ' + full + ' ') || nq.includes(' ' + full + "'") || nq.includes(' ' + full + '?') || (short.length >= 4 && short !== full && new RegExp(`[ ,]${short.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[ ,'?]`).test(nq))){ seen.add(full); hits.push(n.split(' // ')[0]); }
  }
  // quoted names, or capitalised phrases that might be cards not in the deck
  for (const m of String(q).matchAll(/"([^"]{3,60})"|“([^”]{3,60})”/g)) hits.push(m[1] || m[2]);
  return [...new Set(hits)].slice(0, 4);
}
async function u28card(name){
  const c = await sf('/cards/named?fuzzy=' + encodeURIComponent(name));
  if (!c || c.object === 'error') return null;
  let rul = []; try { const r = await sf(`/cards/${c.id}/rulings`); rul = (r && r.data) || []; } catch {}
  const img = (c.image_uris && c.image_uris.normal) || (c.card_faces && c.card_faces[0].image_uris && c.card_faces[0].image_uris.normal) || '';
  const ot = c.oracle_text || (c.card_faces || []).map(f => `${f.name}${f.mana_cost ? ' ' + f.mana_cost : ''}\n${f.oracle_text || ''}`).join('\n\n');
  return {name:c.name, cost:c.mana_cost || '', type:c.type_line || '', ot, img:safeImg(img), uri:c.scryfall_uri || '', rul};
}
function u28mark(text, words){ let h = esc(text); for (const w of words.slice(0, 12)){ const re = new RegExp(`\\b(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*)`, 'gi'); h = h.replace(re, '<mark>$1</mark>'); } return h; }
function u28cardHTML(c, words){
  const scored = c.rul.map(r => ({r, s:words.filter(w => norm(r.comment).includes(w)).length})).sort((a, b) => b.s - a.s);
  const show = scored.slice(0, scored.some(x => x.s) ? 8 : 5);
  return `<div class="res">${c.img ? `<img alt="" src="${esc(c.img)}" loading="lazy">` : '<div></div>'}<div><h4>${esc(c.name)} <small style="color:var(--dim)">${esc(c.cost)}</small></h4><div class="note">${esc(c.type)}</div><div class="ot">${u28mark(c.ot, words)}</div>${c.uri ? `<a class="note" href="${esc(c.uri)}" target="_blank" rel="noopener noreferrer">Open on Scryfall ↗</a>` : ''}</div>
    ${c.rul.length ? `<div class="label" style="grid-column:1/-1">Official rulings (${c.rul.length})${scored.some(x => x.s) ? ' — most relevant first' : ''}</div>` + show.map(x => `<div class="rul${x.s ? ' hit' : ''}">${u28mark(x.r.comment, words)} <small>${esc(x.r.published_at || '')}</small></div>`).join('') + (c.rul.length > show.length ? `<div class="note" style="grid-column:1/-1">${c.rul.length - show.length} more on Scryfall.</div>` : '') : '<div class="note" style="grid-column:1/-1">No official rulings for this card.</div>'}</div>`;
}
const U28_KW = {flying:'flying', haste:'haste', trample:'trample', lifelink:'lifelink', deathtouch:'deathtouch', vigilance:'vigilance', reach:'reach', flash:'flash', hexproof:'hexproof', indestructible:'indestructible', menace:'menace', ward:'ward',
  draw:'draw', draws:'draw', ramp:/add \{|search your library for (?:a|up to \w+) (?:basic )?land/i, removal:/destroy target|exile target|deals? \d+ damage to (?:any )?target|-\d+\/-\d+/i, counter:'counter target', counterspell:'counter target', tutor:/search your library for a card/i, tokens:'token', token:'token', sacrifice:'sacrifice', wipe:/destroy all|exile all/i, wrath:/destroy all|exile all/i, graveyard:'graveyard', etb:'enters', enters:'enters', lifegain:'gain', infinite:null};
const U28_TYPES = ['creature', 'instant', 'sorcery', 'artifact', 'enchantment', 'planeswalker', 'land', 'legendary', 'equipment', 'aura', 'battle'];
function u28deckSearch(q){
  const ks = u28deckKeys(); const w = u28words(q).filter(x => !['which', 'have', 'has', 'with', 'deck', 'list', 'show', 'find', 'any', 'all', 'many'].includes(x));
  const tests = [];
  for (const x of w){ const t = U28_TYPES.find(t => x === t || x === t + 's'); if (t){ tests.push([`type ${t}`, k => new RegExp(`\\b${t}\\b`, 'i').test(info(k).t || '')]); continue; }
    const kw = U28_KW[x]; if (kw === null) continue; if (kw instanceof RegExp) tests.push([x, k => kw.test(info(k).o || '')]); else if (kw) tests.push([x, k => new RegExp(`\\b${kw}`, 'i').test(info(k).o || '')]);
    else tests.push([x, k => norm(info(k).o || '').includes(x) || norm(info(k).t || '').includes(x)]); }
  if (!tests.length) return null;
  const hit = ks.filter(k => tests.every(([, f]) => f(k))).sort((a, b) => info(a).n.localeCompare(info(b).n));
  return {tests:tests.map(t => t[0]), hit};
}
async function u28askRun(){
  const q = document.getElementById('u28q').value.trim(); const out = document.getElementById('u28out');
  if (!q || U28A.busy) return; U28A.busy = true; u28claudeState();
  out.innerHTML = `<div class="note"><span class="spin"></span>Asking Scryfall…</div>`;
  const words = u28words(q); const res = {q, cards:[], search:null};
  try {
    const syntax = /(^|\s)(o|t|c|id|cmc|mv|pow|tou|is|kw|keyword|r|f|oracle|type):/i.test(q);
    const names = syntax ? [] : u28namesIn(q);
    if (syntax){
      const r = await sf('/cards/search?order=name&q=' + encodeURIComponent(q)); const all = (r && r.data) || [];
      const deckNames = new Set(u28deckKeys().map(k => norm(info(k).n)));
      const mine = all.filter(c => deckNames.has(norm(c.name)));
      res.search = {kind:'sf', total:r && r.total_cards || 0, mine:mine.map(c => c.name), some:all.slice(0, 12).map(c => c.name)};
    } else if (names.length){
      for (const n of names){ const c = await u28card(n); if (c) res.cards.push(c); }
    } else if (/\b(which|what|how many|list|show|find|any)\b/i.test(q) && /\b(my|deck|i have|do i)\b/i.test(q)){
      res.search = {kind:'deck', ...(u28deckSearch(q) || {tests:[], hit:[]})};
    } else {
      // no card from the deck named: let Scryfall's fuzzy match try the whole question, then each long phrase
      const tryNames = [q.replace(/^(rulings?|how does|what does|explain|tell me about)\s+(for\s+)?/i, '').replace(/\b(work|do|mean)s?\b.*$/i, '').replace(/[?.!]+$/, '').trim()].filter(Boolean);
      for (const n of tryNames){ const c = await u28card(n); if (c){ res.cards.push(c); break; } }
    }
  } catch (e){ res.err = String(e && e.message || e); }
  U28A.busy = false; U28A.last = res; u28claudeState(); u28askShow(res, words);
}
function u28askShow(res, words){
  const out = document.getElementById('u28out'); let h = '';
  if (res.err) h += `<div class="note" style="color:var(--bad)">Couldn't reach Scryfall: ${esc(res.err)}</div>`;
  if (res.search && res.search.kind === 'deck'){
    const s = res.search;
    h += s.tests.length ? `<div class="label">In your deck — ${esc(s.tests.join(' + '))}: ${s.hit.length} card${s.hit.length === 1 ? '' : 's'}</div><div class="list">${s.hit.map(k => `<button type="button" data-u28n="${esc(info(k).n)}">${esc(info(k).n)}</button>`).join('') || '<span class="note">None.</span>'}</div>`
      : `<div class="note">I couldn't tell what to look for. Try “which of my cards have flying”, or Scryfall syntax like <code>o:"draw a card" t:creature</code>.</div>`;
  }
  if (res.search && res.search.kind === 'sf'){
    const s = res.search;
    h += `<div class="label">Scryfall: ${s.total} card${s.total === 1 ? '' : 's'} match — ${s.mine.length} in your deck</div><div class="list">${(s.mine.length ? s.mine : []).map(n => `<button type="button" data-u28n="${esc(n)}">${esc(n)}</button>`).join('')}</div>`;
    if (!s.mine.length && s.some.length) h += `<div class="note">None of them are in your deck. Some matches: ${s.some.map(esc).join(', ')}…</div>`;
  }
  for (const c of res.cards) h += u28cardHTML(c, words);
  if (!h) h = `<div class="note">Scryfall didn't find a card in that question. Name the card (as in your deck), put an exact name in quotes, or ask “which of my cards …”.</div>`;
  if (res.cards.length) h += `<div class="note">Scryfall gives the official text and rulings; it doesn't answer questions itself. Press <b>Ask Claude too</b> for an answer in plain words.</div>`;
  out.innerHTML = h;
  out.querySelectorAll('[data-u28n]').forEach(b => b.onclick = () => { document.getElementById('u28q').value = `Rulings for "${b.dataset.u28n}"`; u28askRun(); });
}
async function u28askClaude(){
  const q = document.getElementById('u28q').value.trim(); if (!q) return;
  const out = document.getElementById('u28out');
  if (!U28A.last || U28A.last.q !== q){ await u28askRun(); }
  const g = coGate('ask'); if (g){ out.insertAdjacentHTML('afterbegin', `<div class="claude">Claude coach: ${esc(g)} Turn it on in Trainer → Claude coach with your API key.</div>`); return; }
  const cards = (U28A.last && U28A.last.cards) || [];
  const ctx = cards.map(c => `CARD: ${c.name} ${c.cost}\n${c.type}\n${c.ot}\nRULINGS:\n${c.rul.map(r => '- ' + r.comment).join('\n') || '(none)'}`).join('\n\n').slice(0, 14000);
  const user = `A Magic: The Gathering player asks a rules question about their cards: "${q.slice(0, 400)}"\n\nOfficial Oracle text and rulings from Scryfall:\n${ctx || '(no card was found in the question)'}\n\nAnswer in at most 150 words, plainly, using the Oracle text, the rulings above and the Comprehensive Rules. Quote the ruling that settles it if there is one. If you aren't sure, say so.`;
  const box = document.createElement('div'); box.className = 'claude'; box.innerHTML = '<span class="spin"></span>Asking Claude…'; out.insertBefore(box, out.firstChild);
  const r = await coSend('rules', coScrub ? coScrub(user) : user);
  box.innerHTML = r.ok ? `<b>Claude</b>\n${esc(r.text)}` : `Claude coach: ${esc(r.why || 'no answer')}`;
}
try { CO_KIND.rules = {max:700, effort:'low', lean:true}; CO_TYPICAL.rules = {inTok:3000, outTok:250}; } catch {}

Object.assign(ACT, {
  u28ask(){ closeMenu && closeMenu(); u28askOpen(); },
  u28askClose(){ u28askClose(); },
  u28askClaude(){ u28askClaude(); },
  u28fx(){ closeMenu(); U28.fx = !U28.fx; try { localStorage.setItem('pt.fx', U28.fx ? '1' : '0'); } catch {} u28fxClass(); toast(`Animations ${U28.fx ? 'on' : 'off'}`); },
});
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', u28install); else u28install();
