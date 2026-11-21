/* ===== sound: game sound effects + background music =====
   Effects and music were made with Higgsfield for Proxy Table (original audio). They are served next to the game on
   its site (sounds/), with a tiny built-in synth as a fallback when a file can't load (offline, or opened as a file).
   Sounds follow the table log, so you hear your own actions and the other players' (attacks, damage, spells).
   Game ▾ → Sound / Music / Volume. Bots (they run in hidden frames) never make sound. */
const SND_BASE = 'https://georgesmarieyazigi-code.github.io/Proxy-table/sounds/';
const SND_FILES = {draw:'draw.mp3', play:'play.mp3', cast:'cast.mp3', resolve:'resolve.mp3', tap:'tap.mp3', attack:'attack.mp3', hit:'hit.mp3', gain:'gain.mp3', turn:'turn.mp3', shuffle:'shuffle.mp3', win:'win.mp3', lose:'lose.mp3'};
const SND_MUSIC = 'music.mp3';
const SND = {on:true, music:false, vol:0.6, pools:{}, bad:{}, last:{}, lastT:Date.now(), unlocked:false, ctx:null, mus:null, frame:false};
try { SND.frame = window.self !== window.top; } catch { SND.frame = true; }
try { const s = JSON.parse(localStorage.getItem('pt.snd') || '{}'); if (typeof s.on === 'boolean') SND.on = s.on; if (typeof s.music === 'boolean') SND.music = s.music; if (s.vol != null) SND.vol = +s.vol; } catch {}
const sndSave = () => { try { localStorage.setItem('pt.snd', JSON.stringify({on:SND.on, music:SND.music, vol:SND.vol})); } catch {} };
// per-sound loudness (the files differ) and the minimum gap between two plays of the same sound
const SND_MIX = {draw:[0.55, 90], play:[0.7, 90], cast:[0.6, 200], resolve:[0.35, 250], tap:[0.35, 70], attack:[0.7, 600], hit:[0.75, 180], gain:[0.6, 300], turn:[0.6, 1500], shuffle:[0.6, 800], win:[0.9, 3000], lose:[0.9, 3000]};
function sndPool(name){
  if (SND.pools[name]) return SND.pools[name];
  const p = []; for (let i = 0; i < 3; i++){ const a = new Audio(); a.preload = 'auto'; a.src = SND_BASE + SND_FILES[name]; a.addEventListener('error', () => { SND.bad[name] = 1; }); p.push(a); }
  return SND.pools[name] = p;
}
// fallback: a short synthesized blip per sound
const SND_SYN = {draw:[[900, .05, 'triangle'], [1300, .04, 'triangle']], play:[[180, .09, 'sine']], cast:[[520, .08, 'sawtooth'], [780, .12, 'triangle']], resolve:[[1320, .12, 'sine']], tap:[[1800, .04, 'sine']],
  attack:[[220, .12, 'sawtooth'], [330, .18, 'sawtooth']], hit:[[90, .16, 'square']], gain:[[660, .1, 'sine'], [990, .16, 'sine']], turn:[[880, .35, 'sine']], shuffle:[[400, .03, 'triangle'], [500, .03, 'triangle'], [450, .03, 'triangle']],
  win:[[523, .15, 'triangle'], [659, .15, 'triangle'], [784, .3, 'triangle']], lose:[[392, .2, 'sine'], [311, .2, 'sine'], [233, .4, 'sine']]};
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
  if (!SND.mus){ SND.mus = new Audio(SND_BASE + SND_MUSIC); SND.mus.loop = true; SND.mus.preload = 'auto'; }
  SND.mus.volume = Math.max(0, Math.min(1, SND.vol * 0.35));
  if (SND.unlocked){ const pr = SND.mus.play(); if (pr && pr.catch) pr.catch(() => {}); }
}
// browsers only allow sound after the first click / key press
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (SND.unlocked) return; SND.unlocked = true; try { if (SND.ctx) SND.ctx.resume(); } catch {} if (SND.on) Object.keys(SND_FILES).forEach(sndPool); sndMusic(); }, {capture:true}));
// what each table log line sounds like
function sndFor(e){
  const s = String(e.s || ''); const me = e.pid === MYPID;
  if (e.c) return null;
  if (/^drew (?:a card|\d+ cards?)/.test(s)) return me ? 'draw' : null;
  if (/^played .+/.test(s) || /^created \d+ .*tokens?/.test(s)) return 'play';
  if (/^(?:cast|flashed back|unearthed) /.test(s)) return 'cast';
  if (/^(?:tapped .+ for \{|auto-tapped )/.test(s)) return me ? 'tap' : null;
  if (/^attacks /.test(s)) return 'attack';
  let m = s.match(/^life (-?\d+) → (-?\d+)/); if (m) return +m[2] < +m[1] ? (me ? 'hit' : null) : 'gain';
  if (/\btakes \d+ damage\b/.test(s) || /\bdeals \d+ (?:combat )?damage to\b/.test(s)) return 'hit';
  if (/\b(?:gains?|gained) \d+ life\b/.test(s)) return 'gain';
  if (/^untapped — turn/.test(s)) return me ? 'turn' : null;
  if (/\bshuffle/i.test(s)) return 'shuffle';
  if (/(?: resolved| resolves)$/.test(s)) return 'resolve';
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
{ const gx = gameMenuExtra; gameMenuExtra = function(){ return gx.apply(this, arguments) + mb('sndOn', `Sound effects: <b>${SND.on ? 'on' : 'off'}</b>`) + mb('sndMusic', `Music: <b>${SND.music ? 'on' : 'off'}</b>`) + mb('sndVol', `Volume: <b>${SND.vol >= 0.85 ? 'loud' : SND.vol >= 0.5 ? 'medium' : 'quiet'}</b>`); }; }
Object.assign(ACT, {
  sndOn(){ SND.on = !SND.on; sndSave(); closeMenu(); toast(`Sound effects ${SND.on ? 'on' : 'off'}`); if (SND.on){ SND.unlocked = true; sndPlay('resolve'); } },
  sndMusic(){ SND.music = !SND.music; sndSave(); closeMenu(); SND.unlocked = true; sndMusic(); toast(`Music ${SND.music ? 'on' : 'off'}`); },
  sndVol(){ SND.vol = SND.vol >= 0.85 ? 0.3 : SND.vol >= 0.5 ? 0.9 : 0.6; sndSave(); closeMenu(); sndMusic(); SND.last.resolve = 0; sndPlay('resolve'); toast(`Volume: ${SND.vol >= 0.85 ? 'loud' : SND.vol >= 0.5 ? 'medium' : 'quiet'}`); },
});
// a speaker button in the top bar: one click mutes / unmutes everything
{ const rt = renderTop; renderTop = function(){ const r = rt.apply(this, arguments); try { const bar = document.querySelector('#topbar'); if (bar && !bar.querySelector('#sndBtn')){ const b = document.createElement('button'); b.id = 'sndBtn'; b.type = 'button'; b.className = 'btn small ghost'; b.title = 'Sound on / off (Game ▾ for music and volume)'; b.onclick = () => { SND.on = !SND.on; if (!SND.on && SND.mus) SND.mus.pause(); else sndMusic(); sndSave(); b.textContent = SND.on ? '🔊' : '🔇'; if (SND.on){ SND.unlocked = true; SND.last.resolve = 0; sndPlay('resolve'); } }; b.textContent = SND.on ? '🔊' : '🔇'; const ask = bar.querySelector('[data-act="u28ask"], .u28askBtn'); (ask && ask.parentNode === bar) ? bar.insertBefore(b, ask) : bar.appendChild(b); } } catch {} return r; }; }
