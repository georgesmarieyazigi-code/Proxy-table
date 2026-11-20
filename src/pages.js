/* ---------- Pages: the lobby is split into separate pages, and the table has an "Effects in play" page ---------- */
const PAGES = ['decks', 'check', 'play', 'help'];
function lobbyPage(p){
  if (p === 'load') p = 'decks';
  if (!PAGES.includes(p)) p = 'decks';
  const lob = $('#lobby'); if (!lob) return;
  lob.dataset.page = p;
  document.querySelectorAll('#lobbyNav [data-page]').forEach(b => b.setAttribute('aria-current', b.dataset.page === p ? 'page' : 'false'));
  pagesRefresh();
  try { window.scrollTo({top:0}); } catch {}
}
function pagesRefresh(){
  const d = LOBBY.deck, ready = !!d && (d.main.length || d.cmd.length);
  const nd = $('#noDeckHint'); if (nd) nd.hidden = !!ready;
  const list = (typeof savedDecks === 'function') ? savedDecks() : [];
  const ns = $('#noSaved'); if (ns) ns.hidden = list.length > 0;
  // dot on "Deck check" when a commander still has to be picked
  const ck = document.querySelector('#lobbyNav [data-page="check"]');
  if (ck){ const need = ready && FMT[LOBBY.fmt].cz && !d.cmd.length; ck.innerHTML = 'Edit &amp; test' + (need ? '<span class="pdot" title="Pick your commander"></span>' : ''); }
  const pd = $('#playDeck');
  if (pd){
    if (!ready) pd.innerHTML = `<span class="hint">No deck loaded yet.</span><button class="btn small" type="button" data-goto="decks">Load a deck</button>`;
    else {
      const cmd = d.cmd.map(k => info(k)?.n).filter(Boolean).join(' + ');
      pd.innerHTML = `<span><b>${esc(LOBBY.deckName || cmd || 'Your deck')}</b><span class="hint"> · ${deckCount(d)} cards${cmd ? (cmd !== (LOBBY.deckName || '') ? ' · ' + esc(cmd) : '') : (FMT[LOBBY.fmt].cz ? ' · <b>no commander picked</b>' : '')}</span></span><span class="row"><button class="btn small" type="button" data-goto="check">Edit &amp; test</button><button class="btn small" type="button" data-goto="decks">Change deck</button></span>`;
    }
  }
}
(function wirePages(){
  document.addEventListener('click', e => {
    const b = e.target.closest('#lobbyNav [data-page], #lobby [data-goto]'); if (!b) return;
    e.preventDefault(); lobbyPage(b.dataset.page || b.dataset.goto);
  });
  const _rds = renderDeckSum; renderDeckSum = function(){ const r = _rds.apply(this, arguments); pagesRefresh(); return r; };
  const _rs = renderSaved; renderSaved = function(){ const r = _rs.apply(this, arguments); pagesRefresh(); return r; };
  const _ds = deckStatus; deckStatus = function(msg, cls){
    const r = _ds.apply(this, arguments);
    // a deck just finished loading: move on to the next page by itself
    if (/^(Deck ready|Loaded “)/.test(String(msg))){
      const d = LOBBY.deck; const needCmd = d && FMT[LOBBY.fmt].cz && !d.cmd.length;
      setTimeout(() => lobbyPage(needCmd ? 'check' : 'play'), 0);
    }
    return r;
  };
  const _ns = netStatus; netStatus = function(msg, cls){ const r = _ns.apply(this, arguments); if (/Pick your commander/.test(String(msg))) lobbyPage('check'); return r; };
  const _sl = showLobby; showLobby = function(){ const r = _sl.apply(this, arguments); lobbyPage(LOBBY.deck ? 'play' : 'decks'); return r; };
})();

/* ---- in-game: Effects in play ---- */
const EFF = { open:false };
function permLines(k, fl){
  const a = info(k); if (!a) return [];
  const f = fl && a.back ? a.back : a;
  return tname(f.o || '', f.n).split('\n').map(l => l.replace(/\([^)]*\)/g, '').trim()).filter(Boolean)
    // static abilities: not triggered, not activated, not keyword-only lines
    .filter(l => !/^(when|whenever|at the beginning|at end)/i.test(l) && !/^[^"]*:/.test(l) && /\b(can't|cost|costs|don't|doesn't|each|players?|opponents?|spells?|creatures?|lands?|skip|untap|enter|instead|only|no more|as long as|have|get)\b/i.test(l) && l.split(' ').length > 3);
}
function effectsHTML(){
  const rules = staticRules();
  const groups = [];
  const add = (pid, nm, list) => {
    const out = [];
    for (const b of list){ if (!b.k || b.fd) continue; const ls = permLines(b.k, b.fl); if (!ls.length) continue;
      const src = info(b.k)?.n || '?';
      const mine = rules.filter(r => r.src === (b.fl && info(b.k)?.back ? info(b.k).back.n : src) && (r.who === 'all' || (r.who === 'opp' && r.pid !== MYPID) || (r.who === 'you' && r.pid === MYPID)) && r.pid === pid);
      out.push(`<li class="${mine.length ? 'hit' : ''}"><b>${esc(src)}</b>${mine.length ? ' <small>(affects you)</small>' : ''}<br>${ls.map(esc).join('<br>')}</li>`); }
    if (out.length) groups.push(`<div class="eff"><h4>${esc(nm)}</h4><div class="who">${out.length} rule-changing permanent${out.length === 1 ? '' : 's'}</div><ul>${out.join('')}</ul></div>`);
  };
  add(MYPID, 'You', S.bf);
  for (const [pid, s] of OPP) add(pid, s.nm || 'Player', s.bf || []);
  const taxes = [];
  return `<div class="row" style="justify-content:space-between;margin-bottom:12px"><h2 style="margin:0">Effects in play</h2><button class="btn" type="button" data-act="effectsClose">Back to the table</button></div>
    <p class="hint">Every static ability on the battlefield that changes the rules. The engine applies all of these automatically on every player's screen; the ones in gold affect you.${taxes.length ? ' ' + taxes.join(' ') : ''}</p>
    ${groups.length ? `<div class="eff-grid">${groups.join('')}</div>` : '<p class="hint">Nothing on the battlefield is changing the rules right now.</p>'}`;
}
function renderEffects(){
  let el = $('#effectsPage');
  if (!EFF.open || !S){ if (el) el.hidden = true; return; }
  if (!el){ el = document.createElement('section'); el.id = 'effectsPage'; document.body.appendChild(el); }
  el.hidden = false; el.innerHTML = effectsHTML();
}
ACT.effectsOpen = () => { EFF.open = true; renderEffects(); };
ACT.effectsClose = () => { EFF.open = false; renderEffects(); };
document.addEventListener('click', e => { const b = e.target.closest('#effectsPage [data-act="effectsClose"]'); if (b){ EFF.open = false; renderEffects(); } });
(function(){
  const _rt = renderTop; renderTop = function(){ _rt.apply(this, arguments);
    const n = (() => { try { return staticRules().length; } catch { return 0; } })();
    const btn = `<button class="btn small" data-act="effectsOpen" type="button" title="Every rule-changing card in play">Effects${n ? ' · ' + n : ''}</button>`;
    const tb = $('#topbar'); const g = tb.querySelector('[data-act="openTokens"]'); if (g) g.insertAdjacentHTML('beforebegin', btn);
    if (EFF.open) renderEffects();
  };
})();
lobbyPage('decks');
