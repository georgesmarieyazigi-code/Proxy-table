/* ===================== Rules engine — round 25 helper T: companions, starting-deck rules, deck legality, outside the game ===================== */
// 1. decklists keep their Companion and Sideboard/Maybeboard sections (parseList / fetchMoxfield / buildDeck wrapped)
// 2. deck legality: size, singleton (with "a deck can have any number / up to N cards named …"), colour identity,
//    commander pairs (partner, partner with, Partner—X, friends forever, choose a Background, Doctor's companion),
//    companion conditions — shown in the lobby, on the Edit & test page and at the top of the rules-text check
// 3. companion at the table: revealed in the command zone at game start, {3} special action puts it into your hand
// 4. before the game: Gemstone Caverns (luck counter + exile a card), "You may reveal this card from your opening hand" (Chancellors)
// 5. outside the game: the sideboard is the "outside the game" pile for wishes, Karn, the Great Creator and learn
const T25 = {};

/* =================== 1. decklist sections =================== */
{
  const pl = parseList;
  parseList = function(text){
    const out = pl(text);
    try {
      const tags = []; let sec = 'other';
      for (const raw of String(text).split(/\r?\n/)){
        let line = raw.trim(); if (!line) continue;
        const h = line.replace(/^\/\/\s*/, '').replace(/:$/, '').replace(/\s*\(\d+\)$/, '').toLowerCase().trim();
        if (/^(commanders?|companions?|deck|main|mainboard|sideboard|side|maybeboard|maybe|considering|tokens?|attractions|stickers|planes|about)$/.test(h)){
          sec = /^compan/.test(h) ? 'comp' : /^(sideboard|side|maybeboard|maybe|considering)$/.test(h) ? 'side' : 'other'; continue;
        }
        const one = pl(line); if (!one.length) continue;
        tags.push(/^SB:\s*/i.test(line) ? 'side' : sec);
      }
      if (tags.length === out.length) out.forEach((e, i) => { if (e.section === 'skip' && tags[i] !== 'other') e.section = tags[i]; });
    } catch (e){ console.warn(e); }
    return out;
  };
}
// Moxfield links: also read the companion, sideboard and maybeboard
fetchMoxfield = async function(url){
  const id = url.match(/moxfield\.com\/decks\/([A-Za-z0-9_-]+)/i)?.[1];
  if (!id) throw new Error('bad link');
  let d = null;
  for (const u of [`https://api2.moxfield.com/v3/decks/all/${id}`, `https://api2.moxfield.com/v2/decks/all/${id}`]){
    try { const r = await fetch(u, {headers:{Accept:'application/json'}}); if (r.ok){ d = await r.json(); break; } } catch {}
  }
  if (!d) throw new Error('blocked');
  const out = [];
  const boards = d.boards || {mainboard:{cards:d.mainboard}, commanders:{cards:d.commanders}, companions:{cards:d.companions}, sideboard:{cards:d.sideboard}, maybeboard:{cards:d.maybeboard}};
  const add = (b, section) => {
    const cards = boards[b]?.cards || {};
    for (const v of Object.values(cards)){ const c = v.card || {}; if (c.name) out.push({q:v.quantity || 1, name:c.name, set:(c.set || '').toLowerCase() || null, cn:c.cn || null, section, block:0}); }
  };
  add('commanders', 'cmd'); add('mainboard', 'main');
  if (!out.length) throw new Error('empty');
  add('companions', 'comp'); add('sideboard', 'side'); add('maybeboard', 'side');
  return {entries:out, name:d.name || 'Moxfield deck'};
};
const t25IsComp = k => /^Companion\s*—/m.test(info(k)?.o || '');
{
  const bd = buildDeck;
  buildDeck = function(res){
    const comp = res.cards.filter(c => c.section === 'comp');
    const side = res.cards.filter(c => c.section === 'side');
    const d = bd({...res, cards:res.cards.filter(c => c.section !== 'comp').map(c => c.section === 'side' ? {...c, section:'skip'} : c)});
    const sideL = [];
    for (const c of side){ if (d.cmd.includes(c.k)) continue; const e = sideL.find(x => x.k === c.k); if (e) e.q += c.q; else sideL.push({k:c.k, q:c.q}); }
    d.comp = comp.length ? comp[0].k : null;
    // a companion kept in the sideboard (MTGO / Arena exports) is revealed as the companion
    if (!d.comp){ const sc = sideL.filter(e => t25IsComp(e.k)); if (sc.length === 1){ d.comp = sc[0].k; sc[0].q--; } }
    comp.slice(1).forEach(c => sideL.push({k:c.k, q:c.q}));
    d.side = sideL.filter(e => e.q > 0);
    return d;
  };
  // saved decks keep the companion and sideboard
  const sd = saveDeck;
  saveDeck = function(){
    const r = sd.apply(this, arguments);
    try {
      const d = LOBBY.deck; const list = savedDecks(); const rec = list.find(x => x.id === LOBBY.savedId);
      if (d && rec && (d.comp || (d.side || []).length)){
        rec.deck.comp = d.comp || null; rec.deck.side = (d.side || []).map(e => ({k:e.k, q:e.q}));
        const have = new Set(rec.dict.map(a => a.k));
        [d.comp, ...(d.side || []).map(e => e.k)].filter(k => k && !have.has(k)).forEach(k => { const a = DICT.get(k); if (a){ const {fx, ...rest} = a; rec.dict.push(rest); } });
        writeDecks(list);
      }
    } catch (e){ console.warn(e); }
    return r;
  };
  const ls = ACT.loadSaved;
  ACT.loadSaved = function(el){
    const r = ls.apply(this, arguments);
    try { const rec = savedDecks().find(x => x.id === el.dataset.id); if (rec && LOBBY.deck){ LOBBY.deck.comp = rec.deck.comp || null; LOBBY.deck.side = (rec.deck.side || []).map(e => ({k:e.k, q:e.q})); renderDeckSum(); } } catch (e){ console.warn(e); }
    return r;
  };
  const dt = deckText;
  deckText = function(d){
    let t = dt(d);
    const line = (q, k) => { const a = info(k); return `${q} ${a?.full || a?.n || '?'}${a?.set ? ` (${a.set.toUpperCase()}) ${a.cn}` : ''}`; };
    if (d && d.comp) t += '\n\nCompanion\n' + line(1, d.comp);
    if (d && (d.side || []).length) t += '\n\nSideboard\n' + d.side.map(e => line(e.q, e.k)).join('\n');
    return t;
  };
}

/* =================== 2. deck legality =================== */
const T25_PERM = /\b(Artifact|Creature|Enchantment|Land|Planeswalker|Battle)\b/;
const t25Name = k => { const a = info(k); return a ? (a.full || a.n || '') : ''; };
function t25DeckCards(d){ const out = []; (d.cmd || []).forEach(k => out.push({k, q:1})); (d.main || []).forEach(e => out.push({k:e.k, q:e.q})); return out.filter(e => info(e.k)); }
function t25MaxCopies(k, fmt){
  const a = info(k); if (!a) return 1;
  if (/\bBasic\b/.test(a.t || '')) return Infinity;
  const o = tname(a.o || '', a.n).toLowerCase();
  if (/a deck can have any number of cards named ~/.test(o)) return Infinity;
  const m = o.match(/a deck can have up to (\w+) cards named ~/); if (m) return wn(m[1]) || +m[1] || 1;
  return fmt === 'std' ? 4 : 1;
}
function t25ManaSyms(m){ return String(m || '').match(/\{[^}]+\}/g) || []; }
function t25HasActivated(k){
  const a = info(k); if (!a) return false;
  if (/\b(Plains|Island|Swamp|Mountain|Forest)\b/.test(a.t || '')) return true;
  const texts = [a.o || '']; if (a.back) texts.push(a.back.o || '');
  for (const t of texts) for (const l0 of t.split('\n')){
    const l = l0.trim().replace(/^\(|\)$/g, '');
    const i = l.indexOf(':'); if (i > 0){ const pre = l.slice(0, i); if (!/"|“/.test(pre) && pre.length < 140 && /(\{[^}]+\}|^[+−-]?(?:\d+|X)$|\b(?:tap|untap|sacrifice|discard|pay|exile|remove|return|put|reveal|collect|forage|mill)\b)/i.test(pre)) return true; }
    if (/^(equip|cycling|\w+cycling|reconfigure|crew|fortify|level up|outlast|scavenge|unearth|embalm|eternalize|transmute|ninjutsu|forecast|transfigure|reinforce|bloodrush|boast|craft|encore|station|saddle|channel)\b/i.test(l)) return true;
  }
  return false;
}
// companion conditions: [regex, (cards, ctx) => list of offending names or a string reason]
const T25_COMP = [
  [/each permanent card in your starting deck has mana value 2 or less/i, cs => cs.filter(e => T25_PERM.test(info(e.k).t) && (info(e.k).mv || 0) > 2)],
  [/each permanent card in your starting deck has an activated ability/i, cs => cs.filter(e => T25_PERM.test(info(e.k).t) && !t25HasActivated(e.k))],
  [/no card in your starting deck has more than one of the same mana symbol in its mana cost/i, cs => cs.filter(e => { const s = t25ManaSyms(info(e.k).m); return s.length !== new Set(s).size; })],
  [/your starting deck contains only cards with even mana values/i, cs => cs.filter(e => (info(e.k).mv || 0) % 2 !== 0)],
  [/each nonland card in your starting deck has an odd mana value/i, cs => cs.filter(e => !isLand(e.k) && (info(e.k).mv || 0) % 2 !== 1)],
  [/your starting deck contains only cards with mana value 3 or greater and land cards/i, cs => cs.filter(e => !isLand(e.k) && (info(e.k).mv || 0) < 3)],
  [/each nonland card in your starting deck has a different name/i, cs => cs.filter(e => !isLand(e.k) && (e.q > 1 || cs.some(x => x !== e && t25Name(x.k) === t25Name(e.k))))],
  [/each nonland card in your starting deck shares a card type/i, cs => { const nl = cs.filter(e => !isLand(e.k)); const T = ['Artifact', 'Creature', 'Enchantment', 'Instant', 'Sorcery', 'Planeswalker', 'Battle', 'Kindred', 'Tribal']; const shared = T.filter(t => nl.every(e => new RegExp('\\b' + t + '\\b').test(info(e.k).t || ''))); return shared.length ? [] : nl.filter(e => !T.some(t => new RegExp('\\b' + t + '\\b').test(info(e.k).t || '') && nl.filter(x => new RegExp('\\b' + t + '\\b').test(info(x.k).t || '')).length * 2 > nl.length)); }],
  [/each creature card in your starting deck is an? ((?:[A-Z][a-z]+(?:, | or |, or ))+[A-Z][a-z]+) card/i, (cs, x, m) => { const types = m[1].split(/,\s*(?:or\s+)?|\s+or\s+/).map(s => s.trim()).filter(Boolean); return cs.filter(e => { const a = info(e.k); const t = (a.t || '').split('//')[0]; if (!/\bCreature\b/.test(t)) return false; if (/\bChangeling\b/i.test(a.o || '')) return false; return !types.some(ty => new RegExp('\\b' + ty + '\\b').test(t)); }); }],
  [/your starting deck contains at least twenty cards more than the minimum deck size/i, (cs, x) => { const n = cs.reduce((s, e) => s + e.q, 0); const min = x.fmt === 'std' ? 60 : 100; if (x.fmt !== 'std') return `Commander decks are exactly ${min} cards, so this condition can't be met`; return n >= min + 20 ? [] : `${n} cards; needs at least ${min + 20}`; }],
];
function t25CompCheck(d, fmt){
  const k = d && d.comp; if (!k || !info(k)) return null;
  const a = info(k); const cond = ((a.o || '').match(/^Companion\s*—\s*(.+)$/m) || [])[1];
  if (!cond) return {ok:false, why:`${a.n} has no companion ability`};
  const cs = t25DeckCards(d);
  for (const [re, fn] of T25_COMP){
    const m = cond.match(re); if (!m) continue;
    const r = fn(cs, {fmt}, m);
    if (typeof r === 'string') return {ok:false, why:r, cond};
    if (r.length) return {ok:false, why:`not met by ${r.length} card${r.length === 1 ? '' : 's'}: ${r.slice(0, 8).map(e => t25Name(e.k)).join(', ')}${r.length > 8 ? '…' : ''}`, cond, bad:r.map(e => e.k)};
    if (FMT[fmt]?.cz){ const ci = new Set((d.cmd || []).flatMap(c => (info(c)?.ci || '').split(''))); const out = (a.ci || '').split('').filter(c => c && !ci.has(c)); if (out.length) return {ok:false, why:`outside your commander's colour identity (${out.join('')})`, cond}; }
    return {ok:true, cond};
  }
  return {ok:false, why:'this condition is not one the table can check', cond, unknown:true};
}
// commander pairs (rule 702.124)
function t25PairOk(k1, k2){
  const a = info(k1), b = info(k2); if (!a || !b) return {ok:false, why:'card data missing'};
  const lines = x => tname(x.o || '', x.n).split('\n').map(l => l.trim());
  const la = lines(a), lb = lines(b);
  const pw = (ls, other) => ls.some(l => { const m = l.match(/^Partner with (.+?)(?: \(|$)/i); return m && m[1].trim().toLowerCase() === (other.n || '').toLowerCase(); });
  if (pw(la, b) && pw(lb, a)) return {ok:true, why:'partner with each other'};
  const plain = ls => ls.some(l => /^Partner(?: \(|$)/i.test(l));
  if (plain(la) && plain(lb)) return {ok:true, why:'both have partner'};
  const variant = ls => { for (const l of ls){ const m = l.match(/^Partner\s*—\s*([^(]+?)(?: \(|$)/i); if (m) return m[1].trim().toLowerCase(); } return null; };
  if (variant(la) && variant(la) === variant(lb)) return {ok:true, why:`both have Partner—${variant(la)}`};
  const ff = ls => ls.some(l => /^Friends forever(?: \(|$)/i.test(l));
  if (ff(la) && ff(lb)) return {ok:true, why:'both have friends forever'};
  const bg = (x, ls, y) => ls.some(l => /^Choose a Background(?: \(|$)/i.test(l)) && /\bBackground\b/.test(y.t || '') && /\bLegendary\b/.test(y.t || '');
  if (bg(a, la, b) || bg(b, lb, a)) return {ok:true, why:'commander and Background'};
  const dc = (ls, y) => ls.some(l => /^Doctor's companion(?: \(|$)/i.test(l)) && /\bTime Lord Doctor\b/.test(y.t || '') && /\bLegendary\b/.test(y.t || '') && /\bCreature\b/.test(y.t || '');
  if (dc(la, b) || dc(lb, a)) return {ok:true, why:"the Doctor and the Doctor's companion"};
  return {ok:false, why:`${a.n} and ${b.n} can't be commanders together (no matching partner, background, friends forever or Doctor's companion)`};
}
function t25Legality(d, fmt){
  const items = []; if (!d) return items;
  const add = (ok, text, warn) => items.push({ok, text, warn:!!warn});
  const isCmd = !!FMT[fmt]?.cz;
  const total = (d.main || []).reduce((s, e) => s + e.q, 0) + (isCmd ? (d.cmd || []).length : 0);
  if (isCmd){
    const cmd = d.cmd || [];
    if (!cmd.length) add(false, 'No commander chosen');
    else if (cmd.length === 1){ const a = info(cmd[0]); const ok = a && ((/\bLegendary\b/.test(a.t) && /\bCreature\b/.test(a.t)) || /can be your commander/i.test((a.o || '') + (a.back ? a.back.o : ''))); add(!!ok, ok ? `Commander: ${a.n}` : `${a ? a.n : 'Your commander'} isn't a legendary creature and doesn't say it can be your commander`); }
    else if (cmd.length === 2){ const r = t25PairOk(cmd[0], cmd[1]); add(r.ok, r.ok ? `Two commanders: ${r.why}` : r.why); }
    else add(false, `${cmd.length} commanders: a deck has one, or two that partner`);
    add(total === 100, total === 100 ? '100 cards including the commander' : `${total} cards: a Commander deck has exactly 100 including the commander${cmd.length > 1 ? 's' : ''}`);
  } else add(total >= 60, total >= 60 ? `${total} cards (60 or more)` : `${total} cards: a constructed deck needs at least 60`);
  // copies
  const byName = new Map();
  t25DeckCards(isCmd ? d : {main:d.main, cmd:[]}).forEach(e => { const n = t25Name(e.k); const v = byName.get(n) || {k:e.k, q:0}; v.q += e.q; byName.set(n, v); });
  const over = [...byName.entries()].filter(([, v]) => v.q > t25MaxCopies(v.k, fmt));
  add(!over.length, over.length ? `Too many copies: ${over.map(([n, v]) => `${v.q} ${n}`).join(', ')} (${isCmd ? 'singleton: one of each card except basic lands' : 'four of each card'})` : isCmd ? 'Singleton (basic lands and “any number of cards named …” cards excepted)' : 'At most four of each card');
  // colour identity
  if (isCmd && (d.cmd || []).length){
    const ci = new Set(d.cmd.flatMap(k => (info(k)?.ci || '').split('')).filter(Boolean));
    const out = (d.main || []).filter(e => (info(e.k)?.ci || '').split('').some(c => c && !ci.has(c)));
    add(!out.length, out.length ? `Outside the colour identity (${[...ci].join('') || 'colourless'}): ${out.slice(0, 10).map(e => t25Name(e.k)).join(', ')}${out.length > 10 ? ` and ${out.length - 10} more` : ''}` : `Colour identity ${[...ci].join('') || 'colourless'}: every card fits`);
  }
  // companion
  if (d.comp){ const r = t25CompCheck(d, fmt); if (r) add(r.ok, `Companion ${info(d.comp)?.n}: ${r.ok ? 'condition met — it starts revealed in the command zone' : r.why + (r.unknown ? '' : ' — it stays in the sideboard')}`, r.unknown); }
  // companion cards in the main deck: a hint
  const mainComp = (d.main || []).filter(e => t25IsComp(e.k));
  if (mainComp.length && !d.comp){ const t = {...d, comp:mainComp[0].k}; const r = t25CompCheck(t, fmt); if (r && r.ok) add(true, `${info(mainComp[0].k).n} is in the deck; its companion condition is met, so it could be your companion instead`, true); }
  if ((d.side || []).length) add(true, `Sideboard (outside the game): ${d.side.reduce((s, e) => s + e.q, 0)} cards for wishes, learn and similar effects`, true);
  return items;
}
function t25LegalHTML(d, fmt){
  const it = t25Legality(d, fmt); if (!it.length) return '';
  const bad = it.filter(x => !x.ok).length;
  return `<div class="t25legal"><div class="label">Deck rules — ${esc(FMT[fmt]?.label || '')}: ${bad ? `<span class="warn">${bad} problem${bad === 1 ? '' : 's'}</span>` : 'legal'}</div>` +
    it.map(x => `<div class="hint t25row">${x.ok ? (x.warn ? 'ℹ' : '✓') : '<span class="warn">✗</span>'} ${esc(x.text)}</div>`).join('') + '</div>';
}
{
  const rds = renderDeckSum;
  renderDeckSum = function(){
    const r = rds.apply(this, arguments);
    try { const el = $('#deckSum'); const d = LOBBY.deck; if (el && d && !el.hidden){ el.querySelector('.t25legal')?.remove(); el.insertAdjacentHTML('beforeend', t25LegalHTML(d, LOBBY.fmt)); } } catch (e){ console.warn(e); }
    return r;
  };
  const rde = renderDeckEdit;
  renderDeckEdit = function(){
    const r = rde.apply(this, arguments);
    try {
      const el = $('#deckEdit'); const d = LOBBY.deck; if (!el || el.hidden || !d) return r;
      const side = (d.side || []);
      const cands = [...new Set([...(d.main || []).map(e => e.k), ...side.map(e => e.k)].filter(t25IsComp))];
      const html = `<div class="de-sec t25sec"><h3>Deck rules</h3>${t25LegalHTML(d, LOBBY.fmt)}
        <div class="de-grp"><div class="label">Companion</div>${d.comp ? `<div class="de-row"><span class="de-q"><b>1</b></span><span class="de-n" data-de="peek" data-k="${esc(d.comp)}">${esc(info(d.comp)?.n || '?')}</span><button type="button" class="btn small ghost" data-t25="uncomp">Not a companion</button></div>` : `<div class="hint">None${cands.length ? '' : ' (add a card with Companion — to the deck or sideboard to use one)'}</div>`}
          ${cands.filter(k => k !== d.comp).map(k => `<div class="de-row"><span class="de-n" data-de="peek" data-k="${esc(k)}">${esc(info(k)?.n || '?')}</span><button type="button" class="btn small ghost" data-t25="comp" data-k="${esc(k)}">Make it the companion</button></div>`).join('')}</div>
        <div class="de-grp"><div class="label">Sideboard — outside the game (${side.reduce((s, e) => s + e.q, 0)})</div>${side.map(e => `<div class="de-row"><span class="de-q"><b>${e.q}</b></span><span class="de-n" data-de="peek" data-k="${esc(e.k)}">${esc(info(e.k)?.n || '?')}</span><button type="button" class="btn small ghost" data-t25="sidemain" data-k="${esc(e.k)}" title="Move one into the deck">→ deck</button><button type="button" class="btn small ghost" data-t25="sidedel" data-k="${esc(e.k)}" aria-label="Remove one">−</button></div>`).join('') || '<div class="hint">Empty. Lists with a “Sideboard” or “Maybeboard” section fill it.</div>'}</div></div>`;
      el.insertAdjacentHTML('afterbegin', html);
    } catch (e){ console.warn(e); }
    return r;
  };
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-t25]'); if (!b || !b.closest('#deckEdit')) return;
    const d = LOBBY.deck; if (!d) return; const k = b.dataset.k; const a = b.dataset.t25; d.side = d.side || [];
    const take = (list, k) => { const x = list.find(y => y.k === k); if (!x) return false; x.q--; return true; };
    if (a === 'uncomp'){ if (d.comp){ const x = d.side.find(y => y.k === d.comp); if (x) x.q++; else d.side.push({k:d.comp, q:1}); d.comp = null; } }
    else if (a === 'comp'){ if (!take(d.side, k)) take(d.main, k); if (d.comp){ const x = d.side.find(y => y.k === d.comp); if (x) x.q++; else d.side.push({k:d.comp, q:1}); } d.comp = k; }
    else if (a === 'sidemain'){ if (take(d.side, k)){ const x = d.main.find(y => y.k === k); if (x) x.q++; else d.main.push({k, q:1}); } }
    else if (a === 'sidedel') take(d.side, k);
    else return;
    d.side = d.side.filter(x => x.q > 0); d.main = d.main.filter(x => x.q > 0);
    deChanged();
  });
  // the rules-text check starts with the deck's legality
  const rdc = runDeckCheck;
  runDeckCheck = async function(deck){
    const d = deck || LOBBY.deck; const r = await rdc.apply(this, arguments);
    try {
      const m = UI.modal; if (d && m && m.type === 'check' && m.finished && !m.t25){
        m.t25 = t25Legality(d, LOBBY.fmt);
        m.report = `Deck rules (${FMT[LOBBY.fmt]?.label || ''}):\n` + m.t25.map(x => `  ${x.ok ? (x.warn ? 'i' : 'ok') : 'PROBLEM'} — ${x.text}`).join('\n') + '\n\n' + m.report;
        renderModal();
      }
    } catch (e){ console.warn(e); }
    return r;
  };
  const rcm = renderCheckModal;
  renderCheckModal = function(m){
    const r = rcm(m);
    try { if (m.finished && m.t25 && r && r.body){ const bad = m.t25.filter(x => !x.ok).length; r.body = `<div class="chkcard t25legal"><b>Deck rules — ${esc(FMT[LOBBY.fmt]?.label || '')}: ${bad ? `${bad} problem${bad === 1 ? '' : 's'}` : 'legal'}</b>${m.t25.map(x => `<div class="chkline">${x.ok ? (x.warn ? 'ℹ' : '✓') : '<span class="warn">✗</span>'} ${esc(x.text)}</div>`).join('')}</div>` + r.body; } } catch (e){ console.warn(e); }
    return r;
  };
}

/* =================== 3. companion and sideboard at the table =================== */
{
  const ns = newState;
  newState = function(){
    const st = ns.apply(this, arguments);
    try {
      const d = LOBBY.deck || {}; st.side = [];
      const mk = k => ({id:st.nid++, k});
      (d.side || []).forEach(e => { if (info(e.k)) for (let i = 0; i < e.q; i++) st.side.push(mk(e.k)); });
      if (d.comp && info(d.comp)){
        const r = t25CompCheck(d, st.fmt); const c = mk(d.comp);
        if (r && r.ok){ c.comp = true; st.cz.push(c); st.t25compMsg = `revealed ${info(d.comp).n} as their companion`; }
        else { st.side.push(c); st.t25compMsg = `${info(d.comp).n} can't be the companion (${r ? r.why : 'no companion ability'}); it stays in the sideboard`; }
      }
    } catch (e){ console.warn(e); }
    return st;
  };
  const d7 = draw7;
  draw7 = function(){ const r = d7.apply(this, arguments); try { if (S && S.t25compMsg && !UI.dry){ const msg = S.t25compMsg; delete S.t25compMsg; setTimeout(() => { if (S){ log(msg); commit(); } }, 0); } } catch {} return r; };
  // side cards are not in a zone: keep their card data in the save
  const sn = saveNow;
  saveNow = function(){
    const r = sn.apply(this, arguments);
    try { if (S && (S.side || []).length){ const sv = store.get('pt.save'); if (sv && sv.dict){ const have = new Set(sv.dict.map(a => a.k)); let ch = false; S.side.forEach(c => { if (!have.has(c.k)){ const a = DICT.get(c.k); if (a){ sv.dict.push(a); have.add(c.k); ch = true; } } }); if (ch) store.set('pt.save', sv); } } } catch {}
    return r;
  };
}
function t25CompReady(c){
  if (!S || !c || !c.comp) return {ok:false, why:''};
  if (S.t25compUsed) return {ok:false, why:'Already done once this game'};
  const pn = phaseNow();
  if (!pn.mine) return {ok:false, why:'Only during a main phase of your turn'};
  if (pn.ph !== 3 && pn.ph !== 5) return {ok:false, why:'Only during a main phase of your turn'};
  if (stackAll().length) return {ok:false, why:'The stack must be empty'};
  const plan = payPlan(parseCost('{3}'), S.pool); if (plan.err) return {ok:false, why:`Costs {3}: ${plan.err}`};
  return {ok:true};
}
function t25CompToHand(c){
  const r = t25CompReady(c); if (!r.ok){ toast(r.why || 'Not now'); return false; }
  const plan = payPlan(parseCost('{3}'), S.pool); if (plan.err){ toast(plan.err); return false; }
  S.pool = plan.pool;
  const i = S.cz.indexOf(c); if (i < 0) return false;
  S.cz.splice(i, 1); delete c.comp; S.hand.push(c); S.t25compUsed = true;
  log(`paid {3} to put their companion ${cname(c)} into their hand`); commit(); return true;
}
{
  const cmi = castMenuItems;
  castMenuItems = function(c, zone){
    if (zone === 'cz' && c && c.comp){ const r = t25CompReady(c); return `<button type="button" data-act="t25comp" data-id="${c.id}" ${r.ok ? '' : 'disabled'}><span>Companion: pay ${manaHTML('{3}')} to put it into your hand${r.ok ? '' : `<small class="why">${esc(r.why)}</small>`}</span></button>`; }
    return cmi(c, zone);
  };
  const cc = castCheck;
  castCheck = function(c, zone){ if (zone === 'cz' && c && c.comp) return {ok:false, why:'Companion: pay {3} to put it into your hand first'}; return cc(c, zone); };
  const cfd = castFromDrag;
  castFromDrag = function(c, from, pos){ if (from === 'cz' && c && c.comp){ t25CompToHand(c); return; } return cfd(c, from, pos); };
  const bc = beginCast;
  beginCast = async function(c, zone){ if (zone === 'cz' && c && c.comp){ toast('Companion: pay {3} to put it into your hand first'); return; } return bc.apply(this, arguments); };
  ACT.t25comp = function(el){ const [z,, c] = find(+el.dataset.id); closeMenu(); if (z === 'cz' && c) t25CompToHand(c); };
}

/* =================== 4. before the game =================== */
// Gemstone Caverns: only if you're not the starting player; luck counter; exile a card from your hand
window.addEventListener('click', async e => {
  const b = e.target.closest && e.target.closest('[data-act="leyline"]'); if (!b || !S) return;
  const id = +b.dataset.id; const c = S.hand.find(x => x.id === id); if (!c) return;
  const o = info(c.k)?.o || '';
  if (!/you're not the starting player, you may begin the game with/i.test(o)) return;
  e.stopImmediatePropagation(); e.preventDefault(); closeMenu();
  const [n, pid] = currentTurn();
  if (n > 1 || (n === 1 && pid === MYPID)){ toast(n > 1 ? 'Only before the game begins' : "You're the starting player"); return; }
  moveCard(c.id, 'bf', {quiet:true}); const b2 = S.bf.find(x => x.id === c.id);
  const luck = /with a luck counter on it/i.test(o);
  if (b2 && luck){ b2.nc = b2.nc || {}; b2.nc.luck = (b2.nc.luck || 0) + 1; }
  log(`began the game with ${cname(c)} on the battlefield${luck ? ' with a luck counter on it' : ''}`);
  if (/If you do, exile a card from your hand/i.test(o) && S.hand.length){
    const ids = S.hand.length === 1 ? [S.hand[0].id] : await pickCards({title:`${cname(c)}: exile a card from your hand`, cards:S.hand, min:1, max:1});
    const x = ids && ids[0] != null ? S.hand.find(h => h.id === ids[0]) : S.hand[0];
    if (x){ moveCard(x.id, 'ex', {quiet:true}); log(`exiled ${cname(x)} from their hand (${cname(c)})`); }
  }
  commit();
}, true);
// "You may reveal this card from your opening hand. If you do, at the beginning of the first upkeep / your first main phase, …"
const T25_REVEAL = /^You may reveal this card from your opening hand\. If you do, (.+)$/im;
{
  const hi = r8HandItems;
  r8HandItems = function(c, zone){
    let s = hi(c, zone);
    try { if (zone === 'hand' && S && phaseNow().n <= 1 && !(S.t25rev || []).some(r => r.id === c.id) && T25_REVEAL.test(info(c.k)?.o || '') && !(phaseNow().n === 1 && S.t25up1)) s += `<button type="button" data-act="t25reveal" data-id="${c.id}"><span>Reveal it from your opening hand</span></button>`; } catch {}
    return s;
  };
  ACT.t25reveal = function(el){
    const c = S.hand.find(x => x.id === +el.dataset.id); closeMenu(); if (!c) return;
    const eff = (info(c.k).o.match(T25_REVEAL) || [])[1] || '';
    S.t25rev = S.t25rev || []; S.t25rev.push({id:c.id, k:c.k, nm:cname(c), eff});
    log(`revealed ${cname(c)} from their opening hand`); commit();
  };
  const fs = fireSteps;
  fireSteps = function(step, activePid){
    const r = fs(step, activePid);
    try {
      if (S && !UI.dry && (S.t25rev || []).length){
        const n = currentTurn()[0];
        // the first upkeep; if this client never saw that step (fast network), the first step it does see after the game began
        if (n >= 1 && !S.t25up1 && step !== 'untap'){ S.t25up1 = true; for (const x of S.t25rev){ const m = x.eff.match(/^at the beginning of the first upkeep, (.+)$/i); if (m) pushTrig(x.nm, m[1], {k:x.k}); } }
        if (step === 'main1' && activePid === MYPID && !S.t25main1){ S.t25main1 = true; for (const x of S.t25rev){ const m = x.eff.match(/^at the beginning of your first main phase, (.+)$/i); if (m) pushTrig(x.nm, m[1], {k:x.k}); } }
      }
    } catch (e){ console.warn(e); }
    return r;
  };
}

/* =================== 5. outside the game =================== */
function t25OutsideCards(desc){
  const d = String(desc || '').trim();
  return (S.side || []).filter(c => !d || d === 'a' || descOk(c.k, d));
}
function t25TakeSide(id){ const i = (S.side || []).findIndex(c => c.id === id); if (i < 0) return null; const [c] = S.side.splice(i, 1); S.hand.push(c); return c; }
async function doRound25TPre(s, l, ctx){
  let m;
  // Karn, the Great Creator: "Reveal an artifact card you own from outside the game or choose a face-up artifact card you own in exile."
  if ((m = l.match(/^reveal an? ([a-z ]+?) card you own from outside the game or choose a face-up \1 card you own in exile$/))){
    const out = t25OutsideCards(m[1]); const ex = S.ex.filter(c => !c.fd && descOk(c.k, m[1]) && (!c.own || c.own === MYPID));
    const all = [...out, ...ex]; ctx.t25out = {ids:[]};
    if (!all.length){ log(`${ctx.name}: no ${m[1]} card outside the game or face up in exile`); return true; }
    const ids = UI.dry ? [] : await pickCards({title:`${ctx.name}: choose ${m[1]} card from your sideboard or exile`, cards:all, min:0, max:1});
    ctx.t25out.ids = ids || []; return true;
  }
  // Karn −2: the player said No to "you may reveal …" — there is no card to put into the hand
  if (/^put (?:that card|it) into your hand$/.test(l) && !ctx.t25out && ctx.mayYes === false && /card you own from outside the game or choose a face-up/i.test(String(ctx.full || ''))) return true;
  if (/^put (?:that card|it) into your hand$/.test(l) && ctx.t25out){
    for (const id of ctx.t25out.ids){ const c = t25TakeSide(id); if (c){ log(`${ctx.name}: put ${cname(c)} into their hand from outside the game`); continue; } if (find(id)[0] === 'ex'){ const x = find(id)[2]; moveCard(id, 'hand', {quiet:true}); log(`${ctx.name}: put ${cname(x)} into their hand from exile`); } }
    ctx.t25out = null; commit(); return true;
  }
  // wishes: "You may reveal a sorcery card you own from outside the game and put it into your hand." / "Choose a card you own from outside the game, reveal it, and put it into your hand."
  if ((m = l.match(/^(you may )?(?:reveal|choose) (?:an? |up to one )?([a-z ,]*?) ?card you own from outside the game(?:, reveal it,)? and put (?:it|that card) into your hand$/))){
    const list = t25OutsideCards(m[2]);
    if (!list.length){ log(`${ctx.name}: no ${m[2] ? m[2] + ' ' : ''}card outside the game (sideboard)`); return true; }
    const ids = UI.dry ? [] : await pickCards({title:`${ctx.name}: choose a ${m[2] ? m[2] + ' ' : ''}card from your sideboard`, cards:list, min:m[1] ? 0 : 1, max:1});
    for (const id of ids || []){ const c = t25TakeSide(id); if (c) log(`${ctx.name}: revealed ${cname(c)} from outside the game and put it into their hand`); }
    commit(); return true;
  }
  // "Exile ~." on a resolving instant or sorcery (Burning Wish, Time Reversal): engine23f's permanent-only handler swallowed it
  if (l === 'exile ~' && ctx.it && ctx.it.kind === 'spell' && !(srcCardOf(ctx) && S.bf.includes(srcCardOf(ctx)))){ ctx.it.exAfter = true; return true; }
  // Karn, the Great Creator +1 (layers via engine24o's l24modTo)
  if ((m = l.match(/^(until your next turn|until end of turn),? (?:up to one )?target (noncreature artifact|artifact)(?: you control)? becomes an artifact creature with (?:base )?power and toughness each equal to its mana value$/)) && typeof l24modTo === 'function'){
    const ts = ctx.tgts ? nextTargets(ctx) : []; const u = l24until(m[1], MYPID);
    for (const t of ts){ const mv = info(t.k)?.mv || 0; l24modTo(t, {addC:['Creature'], pt:[mv, mv], u}, ctx.name); log(`${ctx.name}: ${info(t.k)?.n || 'it'} becomes a ${mv}/${mv} artifact creature ${m[1]}`); }
    ctx.lastT = ts; commit(); return true;
  }
  // Gyruda:"Put a creature card with an even mana value from among the milled cards onto the battlefield under your control."
  if ((m = l.match(/^put a creature card with an? (even|odd) mana value from among the milled cards onto the battlefield under your control$/))){
    const mm = String(ctx.full || '').toLowerCase().match(/each player mills (\w+) cards/); const n = mm ? wn(mm[1]) || 4 : 4;
    const par = x => (info(x)?.mv || 0) % 2 === (m[1] === 'even' ? 0 : 1);
    if (!UI.dry) await sleep(1500);   // opponents' mills arrive over the network
    const opts = S.gy.slice(-n).filter(c => isCreatureCard(c) && par(c.k)).map(c => ({label:`${cname(c)} (your graveyard)`, value:'m:' + c.id}));
    for (const [pid, st] of OPP){ const g = (st.gy || []).map(x => typeof x === 'string' ? x : x && x.k).filter(Boolean); g.slice(-n).forEach(k => { if (/\bCreature\b/.test(info(k)?.t || '') && par(k)) opts.push({label:`${info(k).n} (${nameOf(pid)}'s graveyard)`, value:'o:' + pid + ':' + k}); }); }
    if (!opts.length){ log(`${ctx.name}: no creature card with an ${m[1]} mana value was milled`); return true; }
    if (UI.dry) return true;
    const v = opts.length === 1 ? opts[0].value : await askChoice({title:`${ctx.name}: put a milled creature card onto the battlefield`, options:opts}); if (!v) return true;
    if (v.startsWith('m:')) moveCard(+v.slice(2), 'bf'); else { const [, pid, ...kk] = v.split(':'); sendRq(pid, 'gytake', 0, ctx.name, {d:kk.join(':')}); log(`${ctx.name}: takes ${info(kk.join(':'))?.n} from ${nameOf(pid)}'s graveyard`); }
    commit(); return true;
  }
  // learn (rule 701.48)
  if (/^(?:then )?learn$/.test(l) || /^you learn$/.test(l)){
    const lessons = t25OutsideCards('').filter(c => /\bLesson\b/.test(info(c.k)?.t || ''));
    const opts = [];
    if (lessons.length) opts.push({label:'Reveal a Lesson from outside the game and put it into your hand', value:'lesson'});
    if (S.hand.length) opts.push({label:'Discard a card, then draw a card', value:'rummage'});
    opts.push({label:'Do nothing', value:'none'});
    const v = UI.dry || opts.length === 1 ? opts[0].value : await askChoice({title:`${ctx.name}: learn`, options:opts});
    if (v === 'lesson'){ const ids = lessons.length === 1 ? [lessons[0].id] : await pickCards({title:'Choose a Lesson', cards:lessons, min:1, max:1}); const c = ids && ids[0] != null ? t25TakeSide(ids[0]) : null; if (c) log(`${ctx.name}: learned ${cname(c)} (from outside the game)`); }
    else if (v === 'rummage'){ const ids = S.hand.length === 1 ? [S.hand[0].id] : await pickCards({title:`${ctx.name}: discard a card`, cards:S.hand, min:1, max:1}); if (ids && ids[0] != null){ moveCard(ids[0], 'gy'); draw(1); } }
    commit(); return true;
  }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound25TPre(s, l, ctx)) return; return ds(s0, ctx); }; }

/* =================== statics: companion conditions and starting-deck rules are checked by the deck rules above =================== */
STATIC_RULES.push(
  [/^(?:companion — )?(?:each permanent card in your starting deck has (?:mana value 2 or less|an activated ability)|no card in your starting deck has more than one of the same mana symbol in its mana cost|your starting deck contains only cards with even mana values|your starting deck contains at least twenty cards more than the minimum deck size|each creature card in your starting deck is an? [a-z, ]+ card|each nonland card in your starting deck (?:has an odd mana value|has a different name|shares a card type)|your starting deck contains only cards with mana value 3 or greater and land cards)$/, m => ({kind:'t25comp'})],
  [/^(?:if ~ is in your opening hand and you're not the starting player, you may begin the game with ~ on the battlefield with a luck counter on it|if you do, exile a card from your hand)$/, m => ({kind:'leyline', who:'you'})],
  [/^(?:you may reveal this card from your opening hand|if you do, at the beginning of (?:the first upkeep|your first main phase), .+)$/, m => ({kind:'t25reveal'})],
  [/^activated abilities of artifacts your opponents control can't be activated$/, m => ({kind:'noAbil', who:'opp', type:'Artifact'})],
);
