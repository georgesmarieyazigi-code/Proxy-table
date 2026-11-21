/* ===== sound: game sound effects + background music =====
   Effects and music were made with Higgsfield for Proxy Table (original audio). They are served next to the game on
   its site (sounds/), with a tiny built-in synth as a fallback when a file can't load (offline, or opened as a file).
   Sounds follow the table log, so you hear your own actions and the other players' (attacks, damage, spells).
   Game ▾ → Sound / Music / Volume. Bots (they run in hidden frames) never make sound. */
const SND_BASE = 'https://georgesmarieyazigi-code.github.io/Proxy-table/sounds/';
// real table sounds: cards, coins, dice, knuckles on wood (no spell whooshes)
const SND_FILES = {draw:'draw.mp3', play:'play.mp3', cast:'cast.mp3', tap:'tap.mp3', shuffle:'shuffle.mp3', counter:'counter.mp3', dice:'dice.mp3', gain:'gain.mp3', attack:'attack.mp3', turn:'turn.mp3', hit:'hit.mp3', token:'token.mp3', win:'win.mp3', lose:'lose.mp3'};
const SND_MUSIC = ['music1.mp3', 'music2.mp3'];   // two calm tavern pieces, played one after the other
const SND = {on:true, music:false, vol:0.6, mvol:0.5, pools:{}, bad:{}, last:{}, lastT:Date.now(), unlocked:false, ctx:null, mus:null, frame:false};
try { SND.frame = window.self !== window.top; } catch { SND.frame = true; }
try { const s = JSON.parse(localStorage.getItem('pt.snd') || '{}'); if (typeof s.on === 'boolean') SND.on = s.on; if (typeof s.music === 'boolean') SND.music = s.music; if (s.vol != null) SND.vol = +s.vol; if (s.mvol != null) SND.mvol = +s.mvol; } catch {}
const sndSave = () => { try { localStorage.setItem('pt.snd', JSON.stringify({on:SND.on, music:SND.music, vol:SND.vol, mvol:SND.mvol})); } catch {} };
// per-sound loudness (the files differ) and the minimum gap between two plays of the same sound
const SND_MIX = {draw:[0.6, 90], play:[0.65, 90], cast:[0.7, 150], tap:[0.4, 70], shuffle:[0.6, 800], counter:[0.55, 120], dice:[0.7, 600], gain:[0.55, 300], attack:[0.65, 500], turn:[0.7, 1500], hit:[0.6, 200], token:[0.55, 120], win:[0.8, 3000], lose:[0.7, 3000]};
function sndPool(name){
  if (SND.pools[name]) return SND.pools[name];
  const p = []; for (let i = 0; i < 3; i++){ const a = new Audio(); a.preload = 'auto'; a.src = SND_BASE + SND_FILES[name]; a.addEventListener('error', () => { SND.bad[name] = 1; }); p.push(a); }
  return SND.pools[name] = p;
}
// fallback: a short synthesized blip per sound
const SND_SYN = {draw:[[900, .04, 'triangle']], play:[[180, .07, 'sine']], cast:[[160, .06, 'square']], tap:[[1400, .03, 'triangle']], shuffle:[[400, .03, 'triangle'], [500, .03, 'triangle'], [450, .03, 'triangle']],
  counter:[[2600, .05, 'sine']], dice:[[300, .04, 'square'], [350, .04, 'square'], [280, .05, 'square']], gain:[[2200, .05, 'sine'], [2600, .06, 'sine']], attack:[[600, .06, 'triangle'], [500, .06, 'triangle']],
  turn:[[140, .06, 'sine'], [140, .06, 'sine']], hit:[[1800, .05, 'sine'], [1500, .05, 'sine']], token:[[420, .05, 'sine']], win:[[523, .15, 'triangle'], [659, .15, 'triangle'], [784, .3, 'triangle']], lose:[[392, .2, 'sine'], [311, .3, 'sine']]};
function sndSynth(name, vol){
  try { const C = SND.ctx || (SND.ctx = new (window.AudioContext || window.webkitAudioContext)()); let t = C.currentTime;
    for (const [f, d, type] of SND_SYN[name] || []){ const o = C.createOscillator(), g = C.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25 * vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(C.destination); o.start(t); o.stop(t + d + 0.02); t += d * 0.8; } } catch {}
}
function sndPlay(name){
  if (SND.frame || !SND.on || !SND_FILES[name]) return;
  const [mix, gap] = SND_MIX[name] || [0.6, 100]; const now = Date.now(); if (now - (SND.last[name] || 0) < gap) return; SND.last[name] = now;
  // while a loop runs, keep it quiet: one tick every half second at most
  try { if ((S && (S.lp || (typeof CL !== 'undefined' && CL.run) || (typeof CK !== 'undefined' && CK.run))) && !['win', 'lose'].includes(name)){ if (now - (SND.loopT || 0) < 500) return; SND.loopT = now; } } catch {}
  const vol = Math.max(0, Math.min(1, SND.vol * mix));
  if (SND.bad[name]) return sndSynth(name, vol);
  const p = sndPool(name); const a = p.find(x => x.paused || x.ended) || p[0];
  try { a.volume = vol; a.currentTime = 0; const pr = a.play(); if (pr && pr.catch) pr.catch(() => { if (SND.unlocked) sndSynth(name, vol); }); } catch { sndSynth(name, vol); }
}
function sndMusic(){
  if (SND.frame) return;
  if (!SND.music){ if (SND.mus){ SND.mus.pause(); } return; }
  if (!SND.mus){ SND.mi = Math.floor(Math.random() * SND_MUSIC.length); SND.mus = new Audio(SND_BASE + SND_MUSIC[SND.mi]); SND.mus.preload = 'auto';
    SND.mus.addEventListener('ended', () => { SND.mi = (SND.mi + 1) % SND_MUSIC.length; SND.mus.src = SND_BASE + SND_MUSIC[SND.mi]; if (SND.music) SND.mus.play().catch(() => {}); }); }
  SND.mus.volume = Math.max(0, Math.min(1, SND.mvol * 0.6));
  if (SND.unlocked){ const pr = SND.mus.play(); if (pr && pr.catch) pr.catch(() => {}); }
}
// browsers only allow sound after the first click / key press
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (SND.unlocked) return; SND.unlocked = true; try { if (SND.ctx) SND.ctx.resume(); } catch {} if (SND.on) Object.keys(SND_FILES).forEach(sndPool); sndMusic(); }, {capture:true}));
// what each table log line sounds like
function sndFor(e){
  const s = String(e.s || ''); const me = e.pid === MYPID;
  if (e.c) return null;
  if (/^drew (?:a card|\d+ cards?)/.test(s)) return me ? 'draw' : null;
  if (/^created \d+ .*tokens?/.test(s)) return 'token';
  if (/^played .+/.test(s)) return 'play';
  if (/^(?:cast|flashed back|unearthed) /.test(s)) return 'cast';
  if (/🎲|🪙|\b(?:rolled|rolls) |\bflipped a coin|\bflips a coin|\b(?:won|lost) the flip/i.test(s)) return 'dice';
  if (/\bcounters? (?:on|to)\b|^put (?:a|an|\w+) .*counters?\b|\bgets? (?:a|an|\w+) [+\-−]?\d*\/?[+\-−]?\d* ?counters?/i.test(s)) return 'counter';
  if (/^(?:tapped .+ for \{|auto-tapped )/.test(s)) return me ? 'tap' : null;
  if (/^attacks /.test(s)) return 'attack';
  let m = s.match(/^life (-?\d+) → (-?\d+)/); if (m) return +m[2] < +m[1] ? (me ? 'hit' : null) : 'gain';
  if (/\btakes \d+ damage\b/.test(s) || /\bdeals \d+ (?:combat )?damage to\b/.test(s)) return 'hit';
  if (/\b(?:gains?|gained) \d+ life\b/.test(s)) return 'gain';
  if (/^untapped — turn/.test(s)) return me ? 'turn' : null;
  if (/\bshuffle/i.test(s)) return 'shuffle';
  return null;
}
setInterval(() => { try {
  if (SND.frame || !SND.on || typeof LOGS === 'undefined' || typeof S === 'undefined' || !S) return;
  let max = SND.lastT; const fresh = [];
  for (const e of LOGS.values()) if (e.t > SND.lastT){ fresh.push(e); if (e.t > max) max = e.t; }
  SND.lastT = max; if (!fresh.length || fresh.length > 40) return;   // a whole log arriving at once (joining a table) stays quiet
  fresh.sort((a, b) => a.t - b.t); const played = new Set();
  for (const e of fresh){ const n = sndFor(e); if (n && !played.has(n)){ played.add(n); sndPlay(n); } }
} catch (e){ console.warn('snd', e); } }, 200);
// win / lose
if (typeof u28over === 'function'){ const uo = u28over; u28over = function(win){ sndPlay(win ? 'win' : 'lose'); return uo.apply(this, arguments); }; }
// Game ▾ menu
{ const gx = gameMenuExtra; gameMenuExtra = function(){ return gx.apply(this, arguments) + mb('sndOn', `Sound effects: <b>${SND.on ? 'on' : 'off'}</b>`) + mb('sndMusic', `Music: <b>${SND.music ? 'on' : 'off'}</b>`) + mb('sndPanel', 'Sound & music volume…'); }; }
Object.assign(ACT, {
  sndOn(){ SND.on = !SND.on; sndSave(); closeMenu(); toast(`Sound effects ${SND.on ? 'on' : 'off'}`); if (SND.on){ SND.unlocked = true; SND.last.play = 0; sndPlay('play'); } },
  sndMusic(){ SND.music = !SND.music; sndSave(); closeMenu(); SND.unlocked = true; sndMusic(); toast(`Music ${SND.music ? 'on' : 'off'}`); },
  sndPanel(){ closeMenu(); sndPanelOpen(); },
  sndVol(){ SND.vol = SND.vol >= 0.85 ? 0.3 : SND.vol >= 0.5 ? 0.9 : 0.6; sndSave(); closeMenu(); sndMusic(); SND.last.play = 0; sndPlay('play'); toast(`Volume: ${SND.vol >= 0.85 ? 'loud' : SND.vol >= 0.5 ? 'medium' : 'quiet'}`); },
});
// a speaker button in the top bar opens a small panel: effects on/off + volume, music on/off + volume
const SND_CSS = `#sndPanel{position:fixed;z-index:160;width:270px;padding:14px 16px;border-radius:14px;background:var(--panel);border:1px solid rgba(212,168,79,.45);box-shadow:0 18px 40px rgba(0,0,0,.6);display:grid;gap:12px;animation:u28fade .15s both}
#sndPanel .r{display:grid;grid-template-columns:1fr auto;gap:6px 10px;align-items:center}
#sndPanel .r b{font:700 14px/1.2 var(--f-body)}
#sndPanel input[type=range]{grid-column:1/-1;width:100%;accent-color:var(--brass)}
#sndPanel .sw{border:1px solid var(--line);border-radius:999px;padding:3px 12px;background:var(--panel-2);color:var(--ink);cursor:pointer;font-size:13px}
#sndPanel .sw[aria-pressed="true"]{background:var(--brass);color:var(--brass-ink);border-color:var(--brass)}
#sndPanel .hint{margin:0;font-size:12px}`;
function sndPanelOpen(anchor){
  if (!document.getElementById('sndcss')){ const st = document.createElement('style'); st.id = 'sndcss'; st.textContent = SND_CSS; document.head.appendChild(st); }
  const old = document.getElementById('sndPanel'); if (old){ old.remove(); return; }
  SND.unlocked = true;
  const p = document.createElement('div'); p.id = 'sndPanel';
  p.innerHTML = `<div class="r"><b>Sound effects</b><button type="button" class="sw" data-snd="on" aria-pressed="${SND.on}">${SND.on ? 'On' : 'Off'}</button><input type="range" min="0" max="100" value="${Math.round(SND.vol * 100)}" data-snd="vol" aria-label="Effects volume"></div>
    <div class="r"><b>Music</b><button type="button" class="sw" data-snd="music" aria-pressed="${SND.music}">${SND.music ? 'On' : 'Off'}</button><input type="range" min="0" max="100" value="${Math.round(SND.mvol * 100)}" data-snd="mvol" aria-label="Music volume"></div>
    <p class="hint">Calm tavern music, two pieces in turn. Only you hear your sound settings.</p>`;
  document.body.appendChild(p);
  const b = (anchor || document.getElementById('sndBtn')); const r = b ? b.getBoundingClientRect() : {right:window.innerWidth - 20, bottom:60};
  p.style.top = (r.bottom + 8) + 'px'; p.style.left = Math.max(10, Math.min(window.innerWidth - 290, r.right - 270)) + 'px';
  p.addEventListener('input', e => { const t = e.target; if (t.dataset.snd === 'vol'){ SND.vol = t.value / 100; sndSave(); } if (t.dataset.snd === 'mvol'){ SND.mvol = t.value / 100; sndSave(); sndMusic(); } });
  p.addEventListener('change', e => { if (e.target.dataset.snd === 'vol'){ SND.last.play = 0; sndPlay('play'); } });
  p.addEventListener('click', e => { const t = e.target.closest('[data-snd]'); if (!t || t.tagName !== 'BUTTON') return;
    if (t.dataset.snd === 'on'){ SND.on = !SND.on; if (SND.on){ SND.last.play = 0; sndPlay('play'); } }
    if (t.dataset.snd === 'music'){ SND.music = !SND.music; sndMusic(); }
    sndSave(); t.setAttribute('aria-pressed', String(SND[t.dataset.snd])); t.textContent = SND[t.dataset.snd] ? 'On' : 'Off'; sndIcon(); });
  setTimeout(() => document.addEventListener('pointerdown', function off(e){ if (!p.contains(e.target) && e.target.id !== 'sndBtn'){ p.remove(); document.removeEventListener('pointerdown', off, true); } }, true), 0);
}
const sndIcon = () => { const b = document.getElementById('sndBtn'); if (b) b.textContent = SND.on || SND.music ? '🔊' : '🔇'; };
{ const rt = renderTop; renderTop = function(){ const r = rt.apply(this, arguments); try { const bar = document.querySelector('#topbar'); if (bar && !bar.querySelector('#sndBtn')){ const b = document.createElement('button'); b.id = 'sndBtn'; b.type = 'button'; b.className = 'btn small ghost'; b.title = 'Sound effects and music'; b.onclick = () => sndPanelOpen(b); const ask = bar.querySelector('[data-act="u28ask"], .u28askBtn'); (ask && ask.parentNode === bar) ? bar.insertBefore(b, ask) : bar.appendChild(b); } sndIcon(); } catch {} return r; }; }
