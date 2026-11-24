'use strict';
/* =============================================================
   Proxy Table — tabletop Magic with Scryfall art, peer-to-peer
   ============================================================= */
const SAMPLE_DECK = "Commander\n1 Krenko, Mob Boss\n\nDeck\n1 Goblin Chieftain\n1 Goblin King\n1 Goblin Warchief\n1 Goblin Matron\n1 Goblin Recruiter\n1 Skirk Prospector\n1 Goblin Lackey\n1 Goblin Ringleader\n1 Goblin Piledriver\n1 Goblin Sharpshooter\n1 Siege-Gang Commander\n1 Beetleback Chief\n1 Mogg War Marshal\n1 Goblin Instigator\n1 Legion Warboss\n1 Goblin Rabblemaster\n1 Krenko, Tin Street Kingpin\n1 Purphoros, God of the Forge\n1 Impact Tremors\n1 Goblin Bombardment\n1 Skullclamp\n1 Sol Ring\n1 Arcane Signet\n1 Mind Stone\n1 Fellwar Stone\n1 Ruby Medallion\n1 Lightning Bolt\n1 Chaos Warp\n1 Blasphemous Act\n1 Vandalblast\n1 Goblin Trashmaster\n1 Conspicuous Snoop\n1 Muxus, Goblin Grandee\n1 Goblin Warrens\n1 Shared Animosity\n1 Coat of Arms\n1 Door of Destinies\n1 Vanquisher's Banner\n1 Herald's Horn\n1 Lightning Greaves\n1 Swiftfoot Boots\n1 Thousand-Year Elixir\n1 Goblin Bushwhacker\n1 Reckless Bushwhacker\n1 Quest for the Goblin Lord\n1 Brightstone Ritual\n1 Battle Hymn\n1 Goblin Engineer\n1 Goblin Welder\n1 Goblin Goon\n1 Goblin Dark-Dwellers\n1 Ib Halfheart, Goblin Tactician\n1 Pashalik Mons\n1 Krenko's Command\n1 Hordeling Outburst\n1 Dragon Fodder\n1 Empty the Warrens\n1 Faithless Looting\n1 Wheel of Fortune\n1 Jeska's Will\n1 Mogg Fanatic\n1 Goblin Cratermaker\n1 Kiki-Jiki, Mirror Breaker\n36 Mountain\n";
const SF = 'https://api.scryfall.com';
const FMT = {
  cmd:  {label:'Commander', life:40, cz:true, firstDraw:true, freeMull:true},
  duel: {label:'Duel Commander', life:20, cz:true, firstDraw:false, freeMull:false},
  std:  {label:'60-card', life:20, cz:false, firstDraw:false, freeMull:false},
};
const SEATS = ['#d4a84f','#6fb3d9','#e0819e','#93cf82','#b59ae6','#e39a4f'];
const ZONES = ['lib','hand','bf','gy','ex','cz'];
const ZNAME = {lib:'library', hand:'hand', bf:'battlefield', gy:'graveyard', ex:'exile', cz:'command zone'};
const TYPE_FILTERS = [['creature','Creatures'],['land','Lands'],['instant','Instants'],['sorcery','Sorceries'],['artifact','Artifacts'],['enchantment','Enchantments'],['planeswalker','Planeswalkers'],['battle','Battles']];
const ART_STYLES = [
  ['newest','Newest printing','prefer:newest'],
  ['oldest','Original printing','prefer:oldest'],
  ['retro','Retro frame (old border)','(frame:1993 or frame:1997) prefer:newest'],
  ['borderless','Borderless & full art','(border:borderless or is:full) prefer:newest'],
  ['extended','Extended art','frame:extendedart prefer:newest'],
  ['showcase','Showcase','frame:showcase prefer:newest'],
  ['cheapest','Cheapest printing','prefer:usd-low'],
];
// number words: a/an/one … ninety-nine (also "twenty one"), hundred, thousand, million and "<n> hundred"/"a thousand"-style compounds
const NUMW = (() => {
  const o = {a:1, an:1}; const u = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const t = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  for (let i = 1; i < 20; i++) o[u[i]] = i;
  for (let i = 2; i < 10; i++){ o[t[i]] = i * 10; for (let j = 1; j < 10; j++){ o[t[i] + '-' + u[j]] = o[t[i] + ' ' + u[j]] = i * 10 + j; } }
  for (const [w, v] of [['hundred', 100], ['thousand', 1000], ['million', 1e6]]){ o[w] = o['a ' + w] = o['one ' + w] = v; for (let i = 2; i < 10; i++) o[u[i] + ' ' + w] = i * v; }
  return o;
})();
function typesOf(k){ const t = (info(k)?.t || '').toLowerCase(); return TYPE_FILTERS.map(f => f[0]).filter(x => new RegExp('\\b' + x + '\\b').test(t)); }
const TOKEN_PRESETS = [
  ['Treasure','t:token !"Treasure"'], ['Food','t:token !"Food"'], ['Clue','t:token !"Clue"'], ['Blood','t:token !"Blood"'],
  ['Map','t:token !"Map"'], ['Soldier 1/1','t:token !"Soldier" pow=1 tou=1 c=w'], ['Goblin 1/1','t:token !"Goblin" pow=1 tou=1 c=r'],
  ['Zombie 2/2','t:token !"Zombie" pow=2 tou=2 c=b'], ['Spirit 1/1 flying','t:token !"Spirit" pow=1 tou=1 c=w o:flying'],
  ['Beast 3/3','t:token !"Beast" pow=3 tou=3 c=g'], ['Saproling 1/1','t:token !"Saproling"'], ['Human 1/1','t:token !"Human" pow=1 tou=1 c=w'],
  ['Elf Warrior 1/1','t:token !"Elf Warrior" pow=1 tou=1'], ['Thopter 1/1','t:token !"Thopter" pow=1 tou=1'], ['Servo 1/1','t:token !"Servo"'],
  ['Eldrazi Spawn 0/1','t:token !"Eldrazi Spawn"'], ['Squirrel 1/1','t:token !"Squirrel" pow=1 tou=1'], ['Bird 1/1 flying','t:token !"Bird" pow=1 tou=1 c=w'],
  ['Angel 4/4 flying','t:token !"Angel" pow=4 tou=4'], ['Dragon 5/5 flying','t:token !"Dragon" pow=5 tou=5'], ['Wolf 2/2','t:token !"Wolf" pow=2 tou=2'],
  ['Elemental 1/1','t:token !"Elemental" pow=1 tou=1 c=r'], ['Insect 1/1','t:token !"Insect" pow=1 tou=1'], ['Faerie Rogue 1/1','t:token !"Faerie Rogue"'],
];

const $ = (s, r=document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/æ/gi,'ae').toLowerCase().replace(/[’‘`´]/g,"'").replace(/\s+/g,' ').trim();
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const store = {
  get(k){ try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k){ try { localStorage.removeItem(k); } catch {} },
};
function rid(n=10){ const a = new Uint32Array(n); crypto.getRandomValues(a); return [...a].map(x => 'abcdefghijkmnpqrstuvwxyz23456789'[x%32]).join(''); }
function shuffle(arr){ const r = new Uint32Array(arr.length); crypto.getRandomValues(r); for (let i=arr.length-1;i>0;i--){ const j = r[i] % (i+1); [arr[i],arr[j]] = [arr[j],arr[i]]; } return arr; }
function rnd(n){ const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }

/* ---------- Card dictionary (shared by every player at the table) ---------- */
const DICT = new Map();   // key -> info
const safeImg = u => (typeof u === 'string' && /^https:\/\/(cards|backs|svgs)\.scryfall\.io\//.test(u)) ? u : '';
const str = (v, n=2000) => typeof v === 'string' ? v.slice(0, n) : '';
function cleanInfo(x){
  if (!x || typeof x !== 'object' || typeof x.k !== 'string') return null;
  const face = f => f && typeof f === 'object' ? {n:str(f.n,120), m:str(f.m,80), t:str(f.t,160), o:str(f.o), p:str(f.p,12), img:safeImg(f.img)} : null;
  const a = face(x); a.k = str(x.k, 80); a.c = str(x.c, 6); a.back = face(x.back);
  a.toks = Array.isArray(x.toks) ? x.toks.slice(0,12).filter(t => t && typeof t.id === 'string').map(t => ({id:str(t.id,80), n:str(t.n,80)})) : [];
  a.tok = !!x.tok; a.cc = !!x.cc; a.lay = str(x.lay, 30);
  a.full = str(x.full, 160); a.set = str(x.set, 10); a.cn = str(x.cn, 12); a.pr = str(x.pr, 12); a.art = safeImg(x.art);
  a.sn = str(x.sn, 80); a.yr = str(x.yr, 4); a.faces = Array.isArray(x.faces) ? x.faces.slice(0, 2).map(face) : null;
  a.mv = Number.isFinite(x.mv) ? clamp(x.mv, 0, 99) : 0; a.ci = str(x.ci, 6); a.kw = Array.isArray(x.kw) ? x.kw.slice(0, 20).map(v => str(v, 30)) : [];
  return a;
}
function addInfo(x){ const a = cleanInfo(x); if (a && !DICT.has(a.k)) DICT.set(a.k, a); return a; }
function faceInfo(f){
  return { n:f.name||'', m:f.mana_cost||'', t:f.type_line||'', o:f.oracle_text||'',
    p: f.power != null ? `${f.power}/${f.toughness}` : f.loyalty != null ? 'L'+f.loyalty : f.defense != null ? 'D'+f.defense : '' };
}
function infoFrom(c){
  const faces = Array.isArray(c.card_faces) ? c.card_faces : null;
  let a;
  if (faces && faces[0] && faces[0].image_uris){
    a = faceInfo(faces[0]); a.img = faces[0].image_uris.normal || '';
    if (faces[1]){ a.back = faceInfo(faces[1]); a.back.img = faces[1].image_uris?.normal || ''; }
  } else if (faces){
    a = faceInfo(faces[0]); a.n = c.name; a.t = c.type_line || a.t;
    a.m = c.mana_cost || faces.map(f => f.mana_cost).filter(Boolean).join(' // ');
    a.o = faces.map(f => `${f.name}${f.mana_cost ? ' '+f.mana_cost : ''} — ${f.type_line||''}\n${f.oracle_text||''}`).join('\n\n');
    a.img = c.image_uris?.normal || '';
    a.faces = faces.slice(0, 2).map(faceInfo);
    if (c.layout === 'adventure'){ const f0 = a.faces[0]; a.m = f0.m; a.t = f0.t; a.o = f0.o; a.p = f0.p; }
  } else { a = faceInfo(c); a.img = c.image_uris?.normal || ''; }
  a.k = c.id; a.lay = c.layout || '';
  a.c = (c.colors || faces?.[0]?.colors || []).join('');
  a.mv = Number.isFinite(c.cmc) ? c.cmc : 0; a.ci = (c.color_identity || []).join(''); a.kw = Array.isArray(c.keywords) ? c.keywords.slice(0, 20) : [];
  a.toks = (c.all_parts || []).filter(p => p.component === 'token' && p.id !== c.id).map(p => ({id:p.id, n:p.name}));
  const tl = c.type_line || '';
  a.tok = /token|emblem/.test(c.layout||'') || /\bToken\b/.test(tl);
  a.cc = (/Legendary/.test(tl) && /(Creature|Planeswalker)/.test(tl)) || /Background/.test(tl) || /can be your commander/i.test(a.o + (a.back ? a.back.o : ''));
  a.full = c.name || a.n; a.set = c.set || ''; a.cn = String(c.collector_number || ''); a.sn = c.set_name || ''; a.yr = (c.released_at || '').slice(0, 4);
  a.pr = c.prices ? (c.prices.usd || c.prices.usd_foil || c.prices.usd_etched || '') : '';
  a.art = (faces && faces[0]?.image_uris?.art_crop) || c.image_uris?.art_crop || '';
  const FX = {extendedart:'Extended art', showcase:'Showcase', etched:'Etched', inverted:'Inverted'};
  a.fx = [c.border_color === 'borderless' ? 'Borderless' : '', c.full_art ? 'Full art' : '', ...(c.frame_effects || []).map(x => FX[x] || ''),
    (c.frame === '1993' || c.frame === '1997') ? 'Retro frame' : ''].filter(Boolean).join(' · ');
  return a;
}
function customToken(name, pt, colors){
  const k = 'c:' + norm(name).slice(0,40) + '|' + (pt||'') + '|' + (colors||'');
  if (!DICT.has(k)) DICT.set(k, {k, n:name, m:'', t:'Token Creature', o:'', p:pt||'', img:'', c:colors||'', back:null, toks:[], tok:true, cc:false, lay:'token', full:name, set:'', cn:'', pr:'', art:'', mv:0, ci:'', kw:[]});
  return k;
}
const info = k => (k != null && (DICT.get(k) || (typeof deriveFace === 'function' && deriveFace(k)))) || null;
const cname = c => c ? (info(c.k)?.n || 'a card') : 'a card';

/* ---------- Scryfall ---------- */
let lastSF = 0;
async function sf(path, opts={}){
  const wait = Math.max(0, lastSF + 110 - Date.now()); if (wait) await sleep(wait);
  lastSF = Date.now();
  const r = await fetch(SF + path, {...opts, headers:{'Accept':'application/json', ...(opts.body ? {'Content-Type':'application/json'} : {})}});
  if (r.status === 404) return {object:'error', status:404, data:[]};
  if (!r.ok) throw new Error('Scryfall answered ' + r.status);
  return r.json();
}
// POST /cards/collection takes 75 cards per request. If the browser blocks the POST,
// fall back to one GET per card (slower, but always allowed).
let SF_POST = true;
async function collection(ids){
  if (SF_POST){
    try { return await sf('/cards/collection', {method:'POST', body:JSON.stringify({identifiers:ids})}); }
    catch (e){ if (!(e instanceof TypeError)) throw e; SF_POST = false; }
  }
  const data = [];
  for (const id of ids){
    const path = id.id ? `/cards/${encodeURIComponent(id.id)}`
      : id.collector_number ? `/cards/${encodeURIComponent(id.set)}/${encodeURIComponent(id.collector_number)}`
      : `/cards/named?exact=${encodeURIComponent(id.name)}${id.set ? '&set=' + encodeURIComponent(id.set) : ''}`;
    const r = await sf(path);
    if (r && r.object === 'card') data.push(r);
  }
  return {data};
}
async function fetchCollection(ids){ // ids: scryfall identifier objects
  const out = [];
  for (let i=0; i<ids.length; i+=75){ const r = await collection(ids.slice(i, i+75)); out.push(...(r.data||[])); }
  return {cards: out};
}
async function ensureTokens(keys){
  const need = [...new Set(keys)].filter(id => !DICT.has(id));
  if (!need.length) return;
  try { const {cards} = await fetchCollection(need.map(id => ({id}))); cards.forEach(c => { const a = infoFrom(c); DICT.set(a.k, a); }); } catch(e){ console.warn(e); }
}
async function searchToken(q){
  const r = await sf('/cards/search?order=released&dir=desc&unique=cards&include_extras=true&q=' + encodeURIComponent(q));
  const c = (r.data||[]).find(c => c.image_uris || c.card_faces?.[0]?.image_uris);
  if (!c) return null;
  const a = infoFrom(c); a.tok = true; DICT.set(a.k, a); return a.k;
}

/* ---------- Deck parsing ---------- */
function parseList(text){
  const entries = []; let section = 'main'; let block = 0;
  for (const raw of String(text).split(/\r?\n/)){
    let line = raw.trim();
    // a blank line after the commander block ends it: Moxfield's "// COMMANDER" export has no header before the main deck
    if (!line){ block++; if (section === 'cmd' && entries.some(e => e.section === 'cmd')) section = 'main'; continue; }
    const h = line.replace(/^\/\/\s*/,'').replace(/:$/,'').replace(/\s*\(\d+\)$/,'').toLowerCase().trim();
    if (/^(commanders?|companions?|deck|main|mainboard|sideboard|side|maybeboard|maybe|considering|tokens?|attractions|stickers|planes|about)$/.test(h)){
      section = h.startsWith('commander') ? 'cmd' : (h === 'deck' || h.startsWith('main')) ? 'main' : 'skip';
      block++; continue;
    }
    if (/^name\s/i.test(line)) continue;
    let sec = section;
    if (/^SB:\s*/i.test(line)){ sec = 'skip'; line = line.replace(/^SB:\s*/i,''); }
    let q = 1, rest = line;
    const m = line.match(/^(\d+)\s*[xX]?\s+(.+)$/);
    if (m){ q = Math.min(+m[1], 250); rest = m[2]; }
    rest = rest.replace(/\s+#.*$/,'').replace(/\s+\*[A-Z]+\*/gi,'').replace(/\s+\^[^^]*\^/g,'').trim();
    let set = null, cn = null;
    const sm = rest.match(/^(.*?)\s+\(([A-Za-z0-9]{2,6})\)(?:\s+(\S+))?$/);
    if (sm){ rest = sm[1]; set = sm[2].toLowerCase(); cn = sm[3] || null; }
    else { const bm = rest.match(/^(.*?)\s+\[([A-Za-z0-9]{2,6})\]$/); if (bm){ rest = bm[1]; set = bm[2].toLowerCase(); } }
    const name = rest.trim();
    if (!name || /^https?:/i.test(name)) continue;
    entries.push({q, name, set, cn, section:sec, block});
  }
  return entries;
}
async function fetchMoxfield(url){
  const id = url.match(/moxfield\.com\/decks\/([A-Za-z0-9_-]+)/i)?.[1];
  if (!id) throw new Error('bad link');
  let d = null;
  for (const u of [`https://api2.moxfield.com/v3/decks/all/${id}`, `https://api2.moxfield.com/v2/decks/all/${id}`]){
    try { const r = await fetch(u, {headers:{Accept:'application/json'}}); if (r.ok){ d = await r.json(); break; } } catch {}
  }
  if (!d) throw new Error('blocked');
  const out = [];
  const boards = d.boards || {mainboard:{cards:d.mainboard}, commanders:{cards:d.commanders}, companions:{cards:d.companions}};
  const add = (b, section) => {
    const cards = boards[b]?.cards || {};
    for (const v of Object.values(cards)){ const c = v.card || {}; if (c.name) out.push({q:v.quantity||1, name:c.name, set:(c.set||'').toLowerCase()||null, cn:c.cn||null, section, block:0}); }
  };
  add('commanders','cmd'); add('mainboard','main');
  if (!out.length) throw new Error('empty');
  return {entries: out, name: d.name || 'Moxfield deck'};
}
function matchCard(e, c){
  if (e.set && e.cn && c.set === e.set && String(c.collector_number) === String(e.cn)) return true;
  const n = norm(e.name), cn = norm(c.name);
  return cn === n || cn.split(' // ')[0] === n.split(' // ')[0] || (c.card_faces||[]).some(f => norm(f.name) === n);
}
async function resolveDeck(entries, onProgress){
  const uniq = new Map();
  for (const e of entries){ e.uk = (e.set && e.cn) ? `${e.set}|${e.cn}` : 'n|' + norm(e.name); if (!uniq.has(e.uk)) uniq.set(e.uk, e); }
  const list = [...uniq.values()]; const found = new Map();
  const pass = async (items, byName) => {
    for (let i=0; i<items.length; i+=75){
      const chunk = items.slice(i, i+75);
      const ids = chunk.map(e => (!byName && e.set && e.cn) ? {set:e.set, collector_number:e.cn} : (!byName && e.set) ? {name:e.name, set:e.set} : {name:e.name});
      const r = await collection(ids);
      for (const c of (r.data||[])){ const e = chunk.find(e => !found.has(e.uk) && matchCard(e, c)); if (e) found.set(e.uk, c); }
      onProgress?.(found.size, list.length);
    }
  };
  await pass(list, false);
  const retry = list.filter(e => !found.has(e.uk));
  if (retry.length) await pass(retry, true);
  // double-faced cards written "Front // Back": Scryfall's collection lookup can miss them by the full name, so look
  // each one up by its front face
  const retry2 = list.filter(e => !found.has(e.uk) && /\//.test(e.name));   // "Fire // Ice", "Fire/Ice"
  if (retry2.length){
    for (const e of retry2){
      const front = String(e.name).split('/')[0].trim();
      try { const c = await sf(`/cards/named?exact=${encodeURIComponent(front)}`); if (c && c.object === 'card') found.set(e.uk, c); } catch {}
    }
    onProgress?.(found.size, list.length);
  }
  const cards = []; const missing = [];
  for (const e of entries){
    const c = found.get(e.uk);
    if (!c){ missing.push(e.name); continue; }
    const a = infoFrom(c); if (!DICT.has(a.k)) DICT.set(a.k, a);
    cards.push({k:a.k, q:e.q, section:e.section, block:e.block});
  }
  return {cards, missing:[...new Set(missing)]};
}

/* ---------- App state ---------- */
const LOBBY = { fmt:'cmd', deck:null, deckName:'', savedId:null };   // deck: {main:[{k,q}], cmd:[k]}
let S = null;                // my game state
const OPP = new Map();       // pid -> public state
const LOGS = new Map();      // combined log: id -> {t, pid, s, c}
const UI = { sel:null, insp:null, inspFlip:false, tokQty:1, menuFor:null, modal:null, confirm:null, delConfirm:null, deckScroll:0, auto: store.get('pt.auto') !== false };
// One id per browser tab, so two windows of the same browser can sit at the same table.
// a fresh id every page load: a duplicated tab copies sessionStorage, and two tabs with one id can't see each other
let MYPID = rid(12);

function newState(){
  const deck = LOBBY.deck; const f = FMT[LOBBY.fmt];
  const st = { v:3, nm: ($('#nameIn').value.trim() || 'Player').slice(0,24), fmt: LOBBY.fmt, deckName: LOBBY.deckName,
    deck, lib:[], hand:[], bf:[], gy:[], ex:[], cz:[], life:f.life, psn:0, cdt:{}, tax:{}, turn:[0,'',0], untapN:-1,
    log:[], rh:false, nid:1, j: Date.now(), recent:[], mull:0 };
  initEngineState(st);
  const mk = k => ({id: st.nid++, k});
  for (const e of deck.main) for (let i=0;i<e.q;i++) st.lib.push(mk(e.k));
  for (const k of deck.cmd){ const c = mk(k); c.cmd = true; (f.cz ? st.cz : st.lib).push(c); }
  shuffle(st.lib);
  return st;
}

/* ---------- Logging ---------- */
let lastLogT = 0;
function log(s, chat=false){
  let t = Date.now(); if (t <= lastLogT) t = lastLogT + 1; lastLogT = t;
  const e = {t, s: String(s).slice(0,160)}; if (chat) e.c = 1;
  S.log.push(e); if (S.log.length > 40) S.log.splice(0, S.log.length - 40);
  LOGS.set(MYPID + '|' + e.t, {t:e.t, pid:MYPID, s:e.s, c:e.c});
}

/* ---------- Zones & actions ---------- */
function find(id){ for (const z of ZONES){ const i = S[z].findIndex(c => c.id === id); if (i >= 0) return [z, i, S[z][i]]; } return [null, -1, null]; }
const isLand = k => /\bLand\b/.test(info(k)?.t || '') && !/\bCreature\b/.test(info(k)?.t || '');
function place(c){
  const inf = info(c.k) || {}; const t = inf.t || '';
  let y = isLand(c.k) ? 1000 : (c.tok || /Creature/.test(t)) ? 500 : 0;
  for (let tries=0; tries<6; tries++){
    const taken = S.bf.filter(o => o !== c && Math.abs(o.y - y) < 90).map(o => o.x);
    for (let x=0; x<=1000; x+=70){ if (!taken.some(tx => Math.abs(tx - x) < 55)){ c.x = x; c.y = y; return; } }
    y = clamp(y + (y >= 1000 ? -70 : 70), 0, 1000);
  }
  c.x = rnd(1000); c.y = y;
}
function reset(c){ c.tap = false; c.cp = c.cm = c.co = 0; c.fl = false; c.fd = false; c.tn = 0; c.sk = false; c.dmg = 0; c.pu = [0, 0]; c.ekw = []; c.regen = 0; c.dtd = 0; c.unearth = 0; c.pw = 0; c.bt = 0; c.lu = ''; }
function moveCard(id, to, o={}){
  const [from, i, c] = find(id); if (!from) return;
  if (to === 'gy' && from !== 'gy' && typeof gyReplace === 'function' && gyReplace(c, from) === 'ex'){ to = 'ex'; if (!o.quiet) log(`${cname(c)} is exiled instead of going to the graveyard`); }
  if (from === to && to !== 'bf' && to !== 'lib') return;
  if (from === 'bf' && to !== 'bf' && c.unearth && to !== 'ex'){ to = 'ex'; log(`${cname(c)} is exiled instead (unearth)`); }
  if (from === 'bf' && to !== 'bf' && c.own){ onLeave(c, to, {cp:c.cp || 0, cm:c.cm || 0}); sendBack(c, to); commit(); return; }
  if (c.cmd && !o.manual && ['gy','ex','hand','lib'].includes(to) && from !== to && typeof cmdRedirect === 'function' && cmdRedirect(c, from, to)) return;
  const wasCounters = {cp:c.cp||0, cm:c.cm||0};
  S[from].splice(i, 1);
  if (from !== to && from !== 'bf' && c.fd && !o.fd) delete c.fd;   // a card exiled face down (Necropotence, foretell…) is face up again in any other zone
  const pub = !(from === 'hand' && (to === 'lib')) && !(from === 'lib' && to === 'hand') && !(from === 'lib' && to === 'lib');
  const name = cname(c);
  if (from === 'bf' && to !== 'bf'){ if (o.sac) emit({type:'sac', k:c.k, id:c.id, tok:c.tok ? 1 : 0}); onLeave(c, to, wasCounters); reset(c); }
  if (from === 'gy' && to !== 'gy' && typeof emit === 'function') emit({type:'leavegy', k:c.k, id:c.id});
  if (c.tok && to !== 'bf'){
    const n = c.n || 1;
    log(`${n>1 ? n+' × ' : ''}${name} token${n>1?'s':''} ${to==='gy'?'died':'left play'}`); commit(); return;
  }
  if (c.cmd && from === 'cz' && o.cast){ S.tax[c.k] = (S.tax[c.k]||0) + 1; }
  if (to === 'bf'){
    if (o.x != null){ c.x = o.x; c.y = o.y; } else if (from !== 'bf') place(c);
    if (o.fd) c.fd = true;
    S.bf.push(c);
  } else if (to === 'lib'){ if (o.bottom) S.lib.push(c); else S.lib.unshift(c); }
  else S[to].push(c);
  if (from === 'bf' && to === 'bf'){ commit(); return; }
  if (to === 'bf' && !o.fd) onEnter(c, from, o);
  if (o.quiet){ commit(); return; }
  if (to === 'bf' && o.fd) log(`played a card face down`);
  else if (to === 'bf') log(o.resolved ? `${name} resolved` : from === 'hand' ? `put ${name} onto the battlefield` : from === 'cz' ? `put ${name} onto the battlefield from the command zone` : `put ${name} onto the battlefield from ${ZNAME[from]}`);
  else if (to === 'lib') log(`put ${pub ? name : 'a card'} on the ${o.bottom ? 'bottom' : 'top'} of their library`);
  else if (to === 'hand') log(pub ? `returned ${name} to hand from ${ZNAME[from]}` : `put a card into their hand`);
  else if (to === 'gy') log(from === 'hand' ? `discarded ${name}` : from === 'lib' ? `milled ${name}` : from === 'bf' && o.sac ? `sacrificed ${name}` : `put ${name} into the graveyard`);
  else if (to === 'ex') log(`exiled ${name}${from !== 'bf' ? ' from ' + ZNAME[from] : ''}`);
  else if (to === 'cz') log(`moved ${name} to the command zone`);
  commit();
}
function draw(n=1){
  let got = 0;
  let blocked = false;
  for (let i=0;i<n && S.lib.length;i++){ const dl = drawAllowed(); if (!dl.ok){ log(`couldn't draw — ${dl.why}`); toast(dl.why); blocked = true; break; } S.hand.push(S.lib.shift()); got++; S.drawn = (S.drawnT === turnStr() ? (S.drawn || 0) : 0) + 1; S.drawnT = turnStr(); emit({type:'draw', cnt:1, nth:S.drawn}); }
  if (got) log(`drew ${got === 1 ? 'a card' : got + ' cards'}`); else if (!blocked) toast('Your library is empty');
  commit();
}
function mill(n=1){ const out = S.lib.splice(0, n); S.gy.push(...out); if (out.length) log(`milled ${out.map(cname).join(', ')}`); commit(); }
function shuffleLib(){ shuffle(S.lib); log('shuffled their library'); commit(); }
function untapAll(silent){ S.bf.forEach(c => { if (doesntUntap(c) && c.tap){ if (!silent) log(`${cname(c)} doesn't untap`); return; } c.tap = false; c.tn = 0; }); if (!silent) log('untapped everything'); commit(); }
function mulligan(){
  S.lib.push(...S.hand); S.hand = []; shuffle(S.lib); S.mull++;
  for (let i=0;i<7 && S.lib.length;i++) S.hand.push(S.lib.shift());
  const owe = Math.max(0, S.mull - (FMT[S.fmt].freeMull ? 1 : 0));
  log(`took a mulligan (${S.mull})${owe ? ` — puts ${owe} on the bottom` : ' — the first one is free'}`); commit();
  if (owe) openModal({type:'bottom', need:owe, sel:[]});
  else toast('Free mulligan: keep all 7');
}
function tapToggle(id){
  const [z,,c] = find(id); if (z !== 'bf') return;
  if ((c.n||1) > 1){ const all = c.tn === c.n; c.tn = all ? 0 : c.n; log(`${all?'untapped':'tapped'} ${c.n} × ${cname(c)}`); }
  else { c.tap = !c.tap; log(`${c.tap ? 'tapped' : 'untapped'} ${c.fd ? 'a face-down card' : cname(c)}`); }
  commit();
}
function counter(id, kind, d){
  const [z,,c] = find(id); if (z !== 'bf') return;
  c[kind] = Math.max(0, (c[kind]||0) + d); cancelCounters(c); commit(true);
}
function tokTargeted(id){ try { return stackAll().some(i => { const t = (i.it && i.it.tgts) || i.tgts; return t && new RegExp('"id":' + id + '[,}]').test(JSON.stringify(t)); }); } catch { return false; } }
function createToken(k, n=1, near, o={}){
  n = clamp(Math.round(n)||1, 1, 99);
  const inf = info(k); if (!inf) return;
  // a stack shares one summoning-sickness flag, so new (sick) tokens only join a stack that is itself still sick (CR 302.6)
  let st = o.tapped ? null : S.bf.find(c => c.tok && c.k === k && !c.fd && !c.cp && !c.cm && !c.co && !c.tap && !c.tn && c.sk && !tokTargeted(c.id) && !c.exert && !c.r21exert && !c.atk && c.blk == null && !(c.ekw && c.ekw.length) && !(c.pu && c.pu.length) && !(c.nc && Object.keys(c.nc).length));   // …and only with tokens that haven't done anything yet: an exerted / attacking / pumped token is its own token (Helm of the Host copies of Combat Celebrant)   // a targeted token must stay one token (else the effect hits the whole pile)
  if (st){ st.n = (st.n||1) + n; }
  else {
    st = {id:S.nid++, k, tok:true, n, sk:true};
    if (o.tapped){ if (n > 1) st.tn = n; else st.tap = true; }
    place(st);
    S.bf.push(st);
  }
  S.recent = [k, ...S.recent.filter(x => x !== k)].slice(0, 8);
  log(`created ${n} ${inf.n} token${n>1?'s':''}${o.tapped ? ' (tapped)' : ''}`);
  for (let i=0; i<Math.min(n, 20); i++) emit({type:'enter', k, id:st.id, tok:1});
  commit();
}
function stackOp(id, op){
  const [z,,c] = find(id); if (z !== 'bf') return;
  const n = c.n || 1; c.tn = c.tn || 0;
  if (op === 'tap1'){ if (c.tn < n) c.tn++; }
  else if (op === 'untap1'){ if (c.tn > 0) c.tn--; }
  else if (op === 'add1'){ c.n = n + 1; log(`created 1 ${cname(c)} token`); }
  else if (op === 'del1'){ if (n <= 1){ moveCard(id, 'gy'); return; } c.n = n - 1; if (c.tn > c.n) c.tn = c.n; log(`1 ${cname(c)} token died`); emit({type:'die', k:c.k, id:c.id, tok:1}); }
  else if (op === 'split'){
    if (n <= 1) return; const tapped = c.tn > 0;
    c.n = n - 1; if (tapped) c.tn--;
    const s = {id:S.nid++, k:c.k, tok:true, n:1, tap:tapped, sk:c.sk, x:clamp(c.x + 80, 0, 1000), y:clamp(c.y + 30, 0, 1000)};
    S.bf.push(s); UI.sel = s.id;
  }
  if (c.n === 1 && c.tn){ c.tap = true; c.tn = 0; }
  commit();
}
function copyCard(id){
  const [z,,c] = find(id); if (!c) return;
  const s = {id:S.nid++, k:c.k, tok:true, copy:true, n:1, sk:true, x:clamp((c.x||0) + 70, 0, 1000), y:clamp((c.y||500) + 40, 0, 1000)};
  S.bf.push(s); log(`created a token copy of ${cname(c)}`); commit();
}
function setLife(d){ const before = S.life; S.life += d; logCoalesce('life', `life ${before} → ${S.life}`); commit(); }
let coalesce = {key:null, t:0, idx:-1, from:null};
function logCoalesce(key, s){
  // merge rapid life clicks into one line
  const now = Date.now();
  if (coalesce.key === key && now - coalesce.t < 2500 && S.log.length && S.log[S.log.length-1] === coalesce.ref){
    const e = coalesce.ref;
    e.s = `life ${coalesce.from} → ${S.life}`; LOGS.set(MYPID + '|' + e.t, {t:e.t, pid:MYPID, s:e.s});
    coalesce.t = now; return;
  }
  log(s); coalesce = {key, t:now, ref:S.log[S.log.length-1], from: Number(s.match(/life (-?\d+)/)?.[1])};
}

/* ---------- Turn ---------- */
function players(){
  const list = [{pid:MYPID, nm:S.nm, j:S.j, me:true, s:null}];
  for (const [pid, s] of OPP) list.push({pid, nm:s.nm, j:s.j, me:false, s});
  return list.sort((a,b) => (a.j - b.j) || (a.pid < b.pid ? -1 : 1));
}
const tkey = t => (t[2] || 0) * 1e7 + (t[0] || 0);
function currentTurn(){
  let best = S.turn;
  for (const s of OPP.values()) if (Array.isArray(s.turn) && Number.isFinite(s.turn[0]) && tkey(s.turn) > tkey(best)) best = s.turn;
  return best;
}
function seatColor(pid){ const i = players().findIndex(p => p.pid === pid); return SEATS[(i < 0 ? 0 : i) % SEATS.length]; }
function nameOf(pid){ if (pid === MYPID) return S.nm; return OPP.get(pid)?.nm || 'someone'; }
function passTurn(){
  const [n, pid, g=0] = currentTurn(); const ps = players();
  const i = ps.findIndex(p => p.pid === pid);
  let next = ps[(i < 0 ? 0 : i + 1) % ps.length];
  if (n > 0 && pid === MYPID && r7PassTurnNext()){ next = ps.find(p => p.me) || next; log('takes an extra turn'); }
  S.turn = [n + 1, next.pid, g];
  log(n === 0 ? `${next.pid === MYPID ? 'goes first' : 'chose ' + next.nm + ' to go first'}` : `passed the turn to ${next.me ? 'themself' : next.nm}`);
  commit();
}
function goFirst(){ const [n,,g=0] = currentTurn(); S.turn = [n + 1, MYPID, g]; log('goes first'); commit(); }
const skipsFirstDraw = n => n === 1 && !FMT[S.fmt].firstDraw;
function newGame(g){
  const keep = {nm:S.nm, j:S.j}; LOBBY.deck = S.deck; LOBBY.fmt = S.fmt; LOBBY.deckName = S.deckName;
  S = newState(); S.nm = keep.nm; S.j = keep.j; S.turn = [0, '', g]; draw7(); log('started a new game'); commit();
}
const NUMRE = /\bcreates? ([a-z]+(?:-[a-z]+)?)\b/i;
function suggestTokQty(c){
  const inf = info(c.k); if (!inf) return 1;
  const o = (c.fl && inf.back ? inf.back.o : inf.o) || '';
  const m = o.match(NUMRE); if (!m) return 1;
  const w = m[1].toLowerCase(); if (w !== 'x') return NUMW[w] || 1;
  const t = o.match(/where X is the number of ([A-Za-z]+?)s? you control/i); if (!t) return 1;
  const re = new RegExp('\\b' + t[1].toLowerCase() + 's?\\b'); let n = 0;
  S.bf.forEach(b => { if (!b.fd && re.test((info(b.k)?.t || '').toLowerCase())) n += (b.n || 1); });
  return clamp(n, 1, 99);
}

/* ---------- Commit, save, sync ---------- */
let renderQueued = false;
function commit(keepMenu){
  if (!keepMenu) closeMenu();
  queueRender(); queuePublish(); queueSave();
}
function queueRender(){ if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; renderGame(); }); }
let saveT = null;
function queueSave(){ clearTimeout(saveT); saveT = setTimeout(saveNow, 400); }
function saveNow(){
  if (!S) return;
  const keys = new Set(); ZONES.forEach(z => S[z].forEach(c => keys.add(c.k))); S.recent.forEach(k => keys.add(k));
  (S.stk || []).forEach(it => it.card && keys.add(it.card.k));
  S.deck.main.forEach(e => keys.add(e.k)); S.deck.cmd.forEach(k => keys.add(k));
  const dict = []; keys.forEach(k => { const a = DICT.get(k); if (a) dict.push(a); });
  store.set('pt.save', {S, dict, net:{code:NET.code, host:NET.isHost}, savedAt:Date.now()});
}
function publicState(){
  return { v:3, b:PT_BUILD, nm:S.nm, fmt:S.fmt, j:S.j, life:S.life, psn:S.psn, hc:S.hand.length, lc:S.lib.length,
    bf: S.bf.map(c => ({id:c.id, k:c.fd ? null : c.k, x:Math.round(c.x), y:Math.round(c.y), tp:c.tap?1:0, fd:c.fd?1:0, fl:c.fl?1:0, cp:c.cp||0, cm:c.cm||0, co:c.co||0, cmd:c.cmd?1:0, tok:c.tok?1:0, n:c.n||1, tn:c.tn||0, sk:c.sk?1:0,
      dmg:c.dmg||0, pu:c.pu && (c.pu[0] || c.pu[1]) ? c.pu : undefined, ekw:c.ekw && c.ekw.length ? c.ekw : undefined, own:c.own ? 1 : 0, ...(typeof cardPublicExtra === 'function' ? cardPublicExtra(c) : {})})),
    gy: S.gy.map(c => c.k), ex: S.ex.map(c => c.fd ? 'facedown' : c.k),   // face-down exiled cards stay hidden from other players
    cz: S.cz.map(c => ({k:c.k, tax:S.tax[c.k]||0})),
    cmd: S.deck.cmd.slice(0, 4),
    cdt: Object.entries(S.cdt).filter(([,v]) => v > 0).map(([key, v]) => { const i = key.indexOf('|'); return [key.slice(0,i), key.slice(i+1), v]; }),
    hr: S.rh ? S.hand.map(c => c.k) : null,
    turn: S.turn, log: S.log.slice(-30).map(e => [e.t, e.s, e.c||0]),
    ...enginePublic() };
}

/* ---------- Networking (MQTT relay over secure WebSockets) ----------
   Every player connects to the same public relay servers, on the normal
   HTTPS port, so it works behind home routers, mobile data and strict
   networks. Each player's board is a "retained" message: anyone who joins
   later gets it straight away, and nobody has to keep a host page open.
   We connect to several relays at once and drop duplicate messages, so the
   table keeps working if one relay is down. */
const PT_BUILD = 34;   // shown to other players so mismatched files are flagged
const BROKERS = (Array.isArray(window.PT_BROKERS) && window.PT_BROKERS.length) ? window.PT_BROKERS :
  ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
const STALE_MS = 4 * 60 * 1000;   // ignore boards nobody has refreshed for 4 minutes
const NET = { peer:null, isHost:false, code:'', clients:[], status:'off', sv:0, chunks:[], published:new Set(), seen:new Map(), hb:null };
const base = () => `proxytable/v2/${NET.code}`;
let pubT = null;
function queuePublish(ms = 120){ if (!NET.peer) return; const now = Date.now(); NET.pubFirst = NET.pubFirst || now; clearTimeout(pubT);   // debounced, but never held back more than 400 ms (a long run of changes used to starve it)
  const go = () => { NET.pubFirst = 0; publish(); }; if (now - NET.pubFirst >= 400) go(); else pubT = setTimeout(go, Math.min(ms, 400 - (now - NET.pubFirst))); }
function liveClients(){ return NET.clients.filter(c => c.connected); }
function mqPublish(topic, obj, retain=true){
  const payload = obj == null ? '' : JSON.stringify(obj);
  for (const c of liveClients()){ try { c.publish(topic, payload, {qos:0, retain}); } catch (e){ console.warn(e); } }
}
function publishCards(force){
  // my cards go out in retained chunks of 40; new ones (like a token I just made) get a new chunk
  const mine = new Set();
  if (S){ S.deck.main.forEach(e => mine.add(e.k)); S.deck.cmd.forEach(k => mine.add(k)); ZONES.forEach(z => S[z].forEach(c => mine.add(c.k))); S.recent.forEach(k => mine.add(k));
    (S.stk || []).forEach(it => it.card && mine.add(it.card.k));
    S.deck.main.concat(S.deck.cmd.map(k => ({k}))).forEach(e => (info(e.k)?.toks || []).forEach(t => mine.add(t.id))); }
  const fresh = [...mine].filter(k => k && DICT.has(k) && !NET.published.has(k));
  for (let i=0; i<fresh.length; i+=40){
    const part = fresh.slice(i, i+40); part.forEach(k => NET.published.add(k));
    NET.chunks.push(part.map(k => DICT.get(k)));
    mqPublish(`${base()}/c/${MYPID}/${NET.chunks.length - 1}`, {pid:MYPID, cards:NET.chunks[NET.chunks.length - 1]});
  }
  if (force) NET.chunks.forEach((cards, i) => mqPublish(`${base()}/c/${MYPID}/${i}`, {pid:MYPID, cards}));
}
function publish(){
  if (!S || !NET.peer) return;
  publishCards(false);
  NET.sv++; NET.rqP = 0; NET.evP = 0;
  mqPublish(`${base()}/s/${MYPID}`, {pid:MYPID, sv:NET.sv, ts:Date.now(), s:publicState()});
}
function onMqMessage(topic, payload){
  const parts = topic.split('/'); // proxytable, v2, code, kind, pid, [i]
  if (parts.length < 5 || parts[2] !== NET.code) return;
  const kind = parts[3], pid = parts[4];
  if (pid === MYPID) return;
  const text = payload && payload.length ? new TextDecoder().decode(payload) : '';
  if (kind === 's'){
    if (!text){ if (OPP.has(pid)){ dropPlayer(pid); queueRender(); } return; }
    let d; try { d = JSON.parse(text); } catch { return; }
    if (!d || d.pid !== pid || !Number.isFinite(d.sv)) return;
    // sender clocks can be minutes off (phones vs PCs), so only reject boards that are clearly ancient;
    // live staleness is judged by when WE last heard from them (pruneStale)
    if (Number.isFinite(d.ts) && Date.now() - d.ts > 12 * 3600 * 1000) return;
    const prev = NET.seen.get(pid);
    if (prev && prev.sv >= d.sv && prev.ts >= (d.ts||0) && Date.now() - prev.at < 60000) return;   // duplicate from another relay
    NET.seen.set(pid, {sv:d.sv, ts:d.ts||0, at:Date.now()});
    const s = sanitizeState(d.s); if (!s) return;
    if (!OPP.has(pid)) addSysLog(`${s.nm} joined the table`);
    OPP.set(pid, s);
    (s.log||[]).forEach(([t, txt, c]) => LOGS.set(pid + '|' + t, {t, pid, s:txt, c}));
    onRemoteState(pid, s);
    queueRender();
  } else if (kind === 'c'){
    if (!text) return;
    let d; try { d = JSON.parse(text); } catch { return; }
    if (Array.isArray(d?.cards)){ d.cards.slice(0, 60).forEach(addInfo); queueRender(); }
  }
}
function dropPlayer(pid){ const s = OPP.get(pid); if (s){ addSysLog(`${s.nm} left the table`); OPP.delete(pid); NET.seen.delete(pid); } }
function addSysLog(s){ const t = Date.now(); LOGS.set('sys|' + t + s, {t, pid:'', s}); }
function sanitizeState(s){
  const num = (v, a=-999, b=9999, def=0) => Number.isFinite(v) ? clamp(v, a, b) : def;
  const key = k => typeof k === 'string' ? k.slice(0, 80) : null;
  try {
    return { v: num(s.v, 0, 99), b: num(s.b, 0, 999), nm: str(s.nm, 24) || 'Player', fmt: FMT[s.fmt] ? s.fmt : 'cmd', j: num(s.j, 0, 1e15), life: num(s.life), psn: num(s.psn, 0, 99),
      hc: num(s.hc, 0, 999), lc: num(s.lc, 0, 999),
      bf: (Array.isArray(s.bf) ? s.bf.slice(0, 300) : []).map(c => ({id:num(c.id,0,1e9), k:key(c.k), x:num(c.x,0,1000), y:num(c.y,0,1000), tp:!!c.tp, fd:!!c.fd, fl:!!c.fl, cp:num(c.cp,0,999), cm:num(c.cm,0,999), co:num(c.co,0,999), cmd:!!c.cmd, tok:!!c.tok, n:num(c.n,1,999,1), tn:num(c.tn,0,999), sk:!!c.sk,
        dmg:num(c.dmg,0,999), pu:Array.isArray(c.pu) ? [num(c.pu[0],-99,99), num(c.pu[1],-99,99)] : [0,0], ekw:Array.isArray(c.ekw) ? c.ekw.slice(0,6).map(x => str(x,24)) : [], own:!!c.own, prot:str(c.prot,40), atk:str(c.atk,40), blk:Number.isFinite(c.blk) ? c.blk : null, lore:num(c.lore,0,20), att:c.att && typeof c.att === 'object' ? {pid:str(c.att.pid,40), id:num(c.att.id,0,1e9)} : null, fdc:c.fdc ? 1 : 0, sw:c.sw ? 1 : 0, emb:c.emb ? 1 : 0})),
      gy: (Array.isArray(s.gy) ? s.gy.slice(0, 400) : []).map(key), ex: (Array.isArray(s.ex) ? s.ex.slice(0, 400) : []).map(key),
      cz: (Array.isArray(s.cz) ? s.cz.slice(0, 6) : []).map(c => ({k:key(c?.k), tax:num(c?.tax,0,99)})),
      cmd: (Array.isArray(s.cmd) ? s.cmd.slice(0, 4) : []).map(key).filter(Boolean),
      cdt: (Array.isArray(s.cdt) ? s.cdt.slice(0, 20) : []).filter(Array.isArray).map(r => [str(r[0],40), key(r[1]), num(r[2],0,999)]),
      hr: Array.isArray(s.hr) ? s.hr.slice(0, 60).map(key) : null,
      turn: Array.isArray(s.turn) ? [num(s.turn[0],0,1e6), str(s.turn[1],40), num(s.turn[2],0,1e6)] : [0,'',0],
      log: (Array.isArray(s.log) ? s.log.slice(-30) : []).filter(Array.isArray).map(r => [num(r[0],0,1e15), str(r[1],160), r[2]?1:0]),
      ...sanitizeEngine(s) };
  } catch (e){ console.warn(e); return null; }
}
function netStatus(msg, cls=''){ const el = $('#netStatus'); el.textContent = msg; el.className = 'status ' + cls; }
function cleanCode(v){
  // phones type codes in many ways: Arabic-Indic/Persian digits, smart dashes, full-width letters, accents
  let t = String(v||'').normalize('NFKC').toLowerCase().trim();
  t = t.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0));
  t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
  t = t.replace(/[‐-―−⁃﹘﹣－_.·]/g, '-').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'');
  return t.slice(0, 40);
}
function newCode(){ const w = ['goblin','mox','lotus','dragon','sliver','elf','zombie','angel','sphinx','kraken','phoenix','hydra','wurm','djinn','golem','imp']; return w[rnd(w.length)] + '-' + (1000 + rnd(9000)) + rid(2); }
function updateNetStatus(){
  if (!NET.peer) return;
  const n = liveClients().length;
  const s = n ? 'live' : 'reconnecting';
  if (s !== NET.status){ NET.status = s; renderNet(); }
}
function closeNet(){
  clearInterval(NET.hb);
  if (NET.peer){
    // clear my retained board so I disappear from the table
    mqPublish(`${base()}/s/${MYPID}`, null);
    NET.chunks.forEach((_, i) => mqPublish(`${base()}/c/${MYPID}/${i}`, null));
  }
  const cs = NET.clients; setTimeout(() => cs.forEach(c => { try { c.end(true); } catch {} }), 300);
  NET.peer = null; NET.clients = []; NET.status = 'off'; NET.code = ''; NET.chunks = []; NET.published.clear(); NET.seen.clear(); NET.sv = 0;
  OPP.clear();
}
function connectTable(code){
  return new Promise((resolve, reject) => {
    if (typeof mqtt === 'undefined') return reject(new Error('The multiplayer library did not load. Check your internet connection and reload the page.'));
    closeNet();
    NET.code = code; NET.status = 'connecting'; NET.peer = true;
    let done = false;
    const will = {topic:`${base()}/s/${MYPID}`, payload:'', retain:true, qos:0};
    NET.clients = BROKERS.map((url, i) => {
      const c = mqtt.connect(url, {clientId:`pt_${MYPID}_${i}_${rid(4)}`, clean:true, keepalive:30, reconnectPeriod:4000, connectTimeout:10000, will, protocolVersion:4});
      c.on('connect', () => {
        c.subscribe(`${base()}/#`, {qos:0});
        if (!done){ done = true; NET.status = 'live'; resolve(); }
        // a relay came (back) online: give it my full board
        setTimeout(() => { if (S && NET.peer){ publishCards(true); publish(); } }, 50);
        updateNetStatus();
      });
      c.on('message', onMqMessage);
      c.on('close', updateNetStatus); c.on('offline', updateNetStatus);
      c.on('error', e => console.warn('relay', url, e?.message || e));
      return c;
    });
    // heartbeat every 20 s: players silent for ~45 s are treated as having passed priority
    NET.hb = setInterval(() => { if (S && NET.peer) publish(); pruneStale(); }, 20000);
    setTimeout(() => { if (!done){ done = true; closeNet(); reject(new Error('Could not reach any of the relay servers. Check your internet connection, or try another network.')); } }, 15000);
  });
}
function pruneStale(){
  const now = Date.now(); let changed = false;
  for (const [pid, v] of NET.seen){ if (now - v.at > STALE_MS + 60000){ dropPlayer(pid); changed = true; } }
  if (changed) queueRender();
}
const hostTable = code => connectTable(code);
const joinTable = code => connectTable(code);

/* ---------- Rendering helpers ---------- */
function manaHTML(s){
  return esc(s).replace(/\{([^}]{1,6})\}/g, (m, t) => {
    const c = t.replace('/P','').split('/')[0];
    const cls = /^[WUBRGC]$/.test(c) ? c : '';
    const label = t === 'T' ? '⟳' : t === 'Q' ? '⟲' : t.replace('/P','ᵠ');
    const style = t.includes('/') && /^[WUBRG]\/[WUBRG]$/.test(t) ? ` style="background:linear-gradient(135deg,var(--h1) 50%,var(--h2) 50%)"` : '';
    return `<span class="ms ${cls}"${style}>${label}</span>`;
  });
}
const FRAME = {W:['#cfc6a4','#8d8566'], U:['#4f84bd','#1f4372'], B:['#4a4249','#221e22'], R:['#c04f3b','#6f2419'], G:['#4e8a52','#1f4a25'], M:['#cfa94e','#7c5f1e'], C:['#8a9095','#4c5156'], L:['#93765a','#4b3a2a']};
function frameVars(inf){
  if (!inf) return '';
  const c = inf.c || ''; let f = c.length > 1 ? FRAME.M : c.length === 1 ? FRAME[c] : (/Land/.test(inf.t) ? FRAME.L : FRAME.C);
  return `--fr1:${f[0]};--fr2:${f[1]};`;
}
function cardHTML(k, o={}){
  const inf = info(k);
  const attrs = [];
  if (o.id != null) attrs.push(`data-id="${o.id}"`);
  if (o.zone) attrs.push(`data-zone="${o.zone}"`);
  if (!o.fd && k) attrs.push(`data-k="${esc(k)}"`), o.fl && attrs.push('data-fl="1"');
  if (o.title) attrs.push(`title="${esc(o.title)}"`);
  const cls = ['card', o.cls||'', o.tap ? 'tapped' : '', o.fd ? 'back' : '', o.sel ? 'sel' : '', o.tok ? 'isTok' : ''].join(' ');
  const style = (o.style||'') + (o.fd ? '' : frameVars(inf));
  let inner = '';
  if (!o.fd){
    const f = (o.fl && inf?.back) ? inf.back : inf;
    if (f){
      inner += `<div class="ct"><span class="n">${esc(f.n)}</span><span>${manaHTML(f.m)}</span><span class="ty">${esc(f.t)}</span>${f.p ? `<span class="p">${esc(f.p.replace(/^L/,'◆').replace(/^D/,'⛨'))}</span>` : ''}</div>`;
      const img = f.img || inf.img;
      if (img) inner += `<img src="${esc(img)}" alt="${esc(f.n)}" loading="lazy" draggable="false">`;
    } else inner += `<div class="ct"><span class="n">Unknown card</span></div>`;
  }
  const b = o.badges || {};
  if (b.n > 1) inner += `<span class="badge stack">×${b.n}</span>`;
  if (b.tn) inner += `<span class="badge tn">${b.tn} tapped</span>`;
  if (b.cp) inner += `<span class="badge cp">+${b.cp}/+${b.cp}</span>`;
  if (b.cm) inner += `<span class="badge cm">−${b.cm}/−${b.cm}</span>`;
  if (b.co) inner += `<span class="badge co">${b.co}</span>`;
  if (b.cmd) inner += `<span class="badge cmdb">CMDR</span>`;
  if (b.tax) inner += `<span class="badge tax">+${b.tax}</span>`;
  if (b.lore) inner += `<span class="badge co">lore ${b.lore}</span>`;
  if (b.att) inner += `<span class="badge att">${esc(b.att)}</span>`;
  if (b.sk) inner += `<span class="badge sick" title="Summoning sick">zz</span>`;
  if (b.pt) inner += `<span class="badge ptb">${esc(b.pt)}</span>`;
  if (b.atk) inner += `<span class="badge atkb">⚔</span>`;
  return `<div class="${cls}" ${attrs.join(' ')} style="${style}">${inner}</div>`;
}
function bfPos(x, y){ return `left:calc((100% - var(--cw)) * ${x/1000});top:calc((100% - var(--ch)) * ${y/1000});`; }
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => t.hidden = true, 3200); }

/* ---------- Render: game ---------- */
function renderGame(){
  if (!S) return;
  const [n, pid, g=0] = currentTurn();
  // someone started a new game and I haven't done anything yet: just follow along
  if (g > (S.turn[2]||0) && !S.bf.length && !S.gy.length && !S.ex.length && S.untapN < 0) S.turn[2] = g;
  if (engineTick()) return;
  renderTop(); renderPhaseBar(); renderOpps(); renderStats(); renderTrig(); renderBF(); renderTokbar(); renderHand(); renderLog(); renderStackPanel(); renderCombatPanel();
  if (UI.modal && (UI.modal.type === 'zone' || UI.modal.type === 'opp') && document.activeElement?.id !== 'zq') renderModal();
  if (UI.insp) renderInspector();
}
function renderTrig(){ $('#trig').hidden = true; }
function renderNet(){ if (S) renderTop(); }
function renderTop(){
  const [n, pid, g=0] = currentTurn();
  const mine = pid === MYPID && n > 0;
  const st = !NET.peer ? '<span class="dot"></span>Solo' : NET.status === 'live' ? `<span class="dot live"></span>Table <b>${esc(NET.code)}</b> <small title="Relay servers connected. Players only see each other through a relay they share.">· ${liveClients().length}/${NET.clients.length} relays · ${OPP.size + 1} seated</small>` : `<span class="dot warn"></span>${NET.status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'} <b>${esc(NET.code)}</b>`;
  const tcode = `<span class="tcode">${st}${NET.peer && NET.code ? `<button class="btn small ghost" data-act="copyCode" type="button">Copy code</button>` : ''}</span>`;
  let turn;
  if (g > (S.turn[2]||0)) turn = `<span class="turninfo">A new game has started</span><button class="btn small glow" data-act="joinNew" type="button">Start a new game too</button>`;
  else if (n === 0) turn = `<span class="turninfo">Pregame</span><button class="btn small" data-act="mull" type="button">Mulligan</button><button class="btn small" data-act="randomFirst" type="button">Random first player</button><button class="btn small primary" data-act="goFirst" type="button">I go first</button>`;
  else turn = `<span class="turninfo" style="--seatc:${seatColor(pid)}">Turn ${n} · <i>${esc(pid === MYPID ? 'You' : nameOf(pid))}</i></span>` + turnButtons(mine);
  $('#topbar').innerHTML = `<span class="logo">Proxy <span>Table</span></span>${tcode}${turn}<span class="spacer"></span>
    ${r7Chips()}${r8Chips()}${exChip()}${undoButtonHTML()}${manaPoolHTML()}
    <button class="btn small" data-act="openTokens" type="button">Tokens</button>
    <button class="btn small" data-act="diceMenu" type="button">Dice</button>
    <button class="btn small" data-act="gameMenu" type="button">Game ▾</button>`;
}
function renderOpps(){
  const el = $('#opps'); const opps = players().filter(p => !p.me);
  const [, turnPid] = currentTurn();
  if (!opps.length){
    el.innerHTML = NET.peer && NET.status === 'live'
      ? `<div class="waiting"><div><div class="big">Waiting for players</div>Friends open this file, enter <b>${esc(NET.code)}</b> under “Join a friend's table”, and sit down. It can take a few seconds for them to appear. If someone still doesn't show up after 20 seconds, check that both screens show exactly the same code at the top, and that both have the latest version of the file.<div style="margin-top:10px"><button class="btn small" data-act="copyCode" type="button">Copy table code</button></div></div></div>`
      : `<div class="waiting"><div><div class="big">Solo table</div>You're goldfishing. To play with friends, go back to the lobby and host a table.</div></div>`;
    return;
  }
  const size = opps.length === 1 ? 'style="--cw:64px;--ch:89px"' : opps.length === 2 ? 'style="--cw:54px;--ch:75px"' : 'style="--cw:46px;--ch:64px"';
  el.innerHTML = opps.map(p => {
    const s = p.s; const col = seatColor(p.pid);
    const cards = s.bf.map((c, i) => cardHTML(c.k, {fd:c.fd, fl:c.fl, tap:c.tp || (c.n > 1 && c.tn === c.n), tok:c.tok, cls:'bfc', style:bfPos(c.x, c.y) + `z-index:${i+1};`,
      badges:{n:c.n, tn:(c.n > 1 && c.tn && c.tn < c.n) ? c.tn : 0, cp:c.cp, cm:c.cm, co:c.co, cmd:c.cmd, pt:livePTFor(c, p.pid), atk:c.atk ? 1 : 0, lore:c.lore, att:attachBadge(c, p.pid)}})).join('');
    const cz = s.cz.map(c => cardHTML(c.k, {badges:{tax: c.tax ? c.tax*2 : 0}})).join('');
    const took = s.cdt.filter(r => r[2] > 0).map(r => `${r[2]} from ${esc(info(r[1])?.n || 'a commander')}`);
    const pool = poolText(s.pool);
    return `<div class="opp${turnPid === p.pid ? ' active' : ''}" style="--seatc:${col}">
      <header><span class="nm">${esc(s.nm)}</span><span class="lifebadge">${s.life}</span>
        <span class="meta">${(s.v || 0) < 3 ? `<span style="color:var(--bad)" title="They opened an older copy of Proxy Table, so the rules engine can't wait for them. Send them the new file.">old file — no rules engine</span>` : ''}${(s.v || 0) >= 3 && (s.b || 0) < PT_BUILD ? `<span style="color:var(--bad)" title="They opened an older copy of Proxy Table (v${s.b || 'older'}). Some card effects between you won't work until everyone has the same file.">old version v${s.b || '≤11'} — send them v${PT_BUILD}</span>` : ''}${s.fmt !== S.fmt ? `<span style="color:var(--bad)">playing ${esc(FMT[s.fmt].label)}</span>` : ''}${s.psn ? `<span style="color:var(--poison)"><b>${s.psn}</b> poison</span>` : ''}<span>hand <b>${s.hc}</b></span><span>library <b>${s.lc}</b></span>${pool ? `<span>mana ${manaHTML(pool)}</span>` : ''}${took.length ? `<span title="Commander damage they've taken">cmdr dmg: <b>${took.join(', ')}</b></span>` : ''}</span></header>
      <div class="obf" ${size}>${cards}</div>
      <footer><span class="czmini">${cz}</span>
        <button class="zonebtn" type="button" data-act="viewOpp" data-pid="${esc(p.pid)}" data-z="gy">Graveyard <b>${s.gy.length}</b></button>
        <button class="zonebtn" type="button" data-act="viewOpp" data-pid="${esc(p.pid)}" data-z="ex">Exile <b>${s.ex.length}</b></button>
        ${s.hr ? `<button class="zonebtn" type="button" data-act="viewOpp" data-pid="${esc(p.pid)}" data-z="hr" style="border-color:var(--seatc)">Revealed hand <b>${s.hr.length}</b></button>` : ''}
      </footer></div>`;
  }).join('');
}
function renderStats(){
  const col = seatColor(MYPID);
  const oppCmds = [];
  for (const [pid, s] of OPP) for (const k of s.cmd) oppCmds.push({pid, k, nm:s.nm});
  const cdt = oppCmds.map(o => { const key = o.pid + '|' + o.k; const v = S.cdt[key] || 0;
    return `<div class="mini-ctr" title="Commander damage you've taken from ${esc(o.nm)}'s ${esc(info(o.k)?.n||'commander')}. Adding also lowers your life."><span class="lbl">${esc(info(o.k)?.n || 'Commander')}</span><button type="button" data-act="cdt" data-key="${esc(key)}" data-d="-1" aria-label="Less commander damage">−</button><span class="v" style="${v>=21?'color:var(--bad)':''}">${v}</span><button type="button" data-act="cdt" data-key="${esc(key)}" data-d="1" aria-label="More commander damage">+</button></div>`; }).join('');
  const top = (z) => S[z].length ? cardHTML(S[z][S[z].length-1].k, {}) : '<div class="empty-slot"></div>';
  const fmt = FMT[S.fmt];
  $('#stats').innerHTML = `
    <div class="lifebox" style="--seatc:${col}">
      <div class="who">${esc(S.nm)}</div>
      <div class="life"><button type="button" data-act="life" data-d="-1" aria-label="Lose 1 life">−</button><span class="num">${S.life}</span><button type="button" data-act="life" data-d="1" aria-label="Gain 1 life">+</button></div>
      <div class="life5"><button type="button" data-act="life" data-d="-5">−5</button><button type="button" data-act="life" data-d="-3">−3</button><button type="button" data-act="life" data-d="3">+3</button><button type="button" data-act="life" data-d="5">+5</button></div>
      <div class="mini-ctr"><span class="lbl">Poison</span><button type="button" data-act="psn" data-d="-1" aria-label="Remove poison">−</button><span class="v" style="color:var(--poison)">${S.psn}</span><button type="button" data-act="psn" data-d="1" aria-label="Add poison">+</button></div>
      ${cdt ? `<div class="label" style="margin-top:2px">Cmdr damage taken</div>${cdt}` : ''}
    </div>
    <div class="piles">
      ${fmt.cz || S.cz.length ? `<div class="pile cz" data-drop="cz"><span class="lbl">Command</span><div class="czrow">${S.cz.length ? S.cz.map(c => cardHTML(c.k, {id:c.id, zone:'cz', sel:UI.sel === c.id, badges:{tax: S.tax[c.k] ? S.tax[c.k]*2 : 0}})).join('') : '<div class="empty-slot"></div>'}</div></div>` : ''}
      <div class="pile" data-drop="lib" data-act="draw" title="Click to draw (D). Drop a card here to put it on top.">
        <button class="more" type="button" data-act="libMenu" aria-label="Library options">⋯</button>
        <span class="lbl">Library</span>${S.lib.length ? cardHTML(null, {fd:true}) : '<div class="empty-slot"></div>'}<span class="cnt">${S.lib.length}</span></div>
      <div class="pile" data-drop="gy" data-act="viewZone" data-z="gy"><span class="lbl">Graveyard</span>${top('gy')}<span class="cnt">${S.gy.length}</span></div>
      <div class="pile" data-drop="ex" data-act="viewZone" data-z="ex"><span class="lbl">Exile</span>${top('ex')}<span class="cnt">${S.ex.length}</span></div>
    </div>`;
}
function renderBF(){
  const el = $('#bf');
  el.innerHTML = S.bf.length ? S.bf.map((c, i) => cardHTML(c.k, {id:c.id, zone:'bf', fd:c.fd, fl:c.fl, tok:c.tok, sel:UI.sel === c.id,
    tap: c.tap || ((c.n||1) > 1 && c.tn === c.n), cls:'bfc', style:bfPos(c.x, c.y) + `z-index:${i+1};`,
    badges:{n:c.n, tn:((c.n||1) > 1 && c.tn && c.tn < c.n) ? c.tn : 0, cp:c.cp, cm:c.cm, co:c.co, cmd:c.cmd, sk: c.sk && isCreatureCard(c) && !hasHaste(c), pt: livePT(c), lore:c.lore, atk:c.atk ? 1 : 0, att:attachBadge(c, MYPID)}})).join('')
    : `<div class="bf-hint">Your battlefield. Drag lands here from your hand,<br>or tap a card in hand and choose Cast.</div>`;
}
function renderTokbar(){
  const rec = S.recent.filter(k => DICT.has(k));
  $('#tokbar').innerHTML = `<span class="label">Tokens</span>` +
    rec.map(k => { const a = info(k); return `<button class="tokchip" type="button" data-act="tok1" data-k="${esc(k)}" title="Create one more ${esc(a.n)}">${a.img ? `<img src="${esc(a.img)}" alt="">` : ''}+ ${esc(a.n)}${a.p ? ' ' + esc(a.p) : ''}</button>`; }).join('') +
    `<button class="tokchip" type="button" data-act="openTokens" style="padding-left:9px">Make a token…</button>`;
}
function renderHand(){
  $('#hand').innerHTML = `<span class="hand-lbl">Hand ${S.hand.length}${S.rh ? ' · revealed' : ''}</span>` + S.hand.map(c => {
    const chk = castCheck(c, 'hand');
    return cardHTML(c.k, {id:c.id, zone:'hand', sel:UI.sel === c.id, cls: chk.ok ? 'can' : 'cant', title: chk.ok ? '' : chk.why});
  }).join('');
}
function renderLog(){
  const el = $('#log'); const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
  const rows = [...LOGS.values()].sort((a,b) => a.t - b.t).slice(-120);
  el.innerHTML = rows.map(r => {
    const time = new Date(r.t).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const who = r.pid ? `<b style="--seatc:${seatColor(r.pid)}">${esc(nameOf(r.pid))}</b> ` : '';
    return `<div class="e${r.c ? ' chat' : ''}${/^⚠/.test(r.s) ? ' warnline' : ''}"><span class="t">${time}</span>${who}${r.c ? '“' + esc(r.s) + '”' : esc(r.s)}</div>`;
  }).join('') || '<div class="e">Nothing yet.</div>';
  if (atBottom) el.scrollTop = el.scrollHeight;
}
function renderInspector(){
  const el = $('#insp'); const sp = UI.insp; const inf = sp && info(sp.k);
  if (!inf){ el.innerHTML = '<div class="empty">Hover or tap any card to read it here.</div>'; return; }
  const showBack = UI.inspFlip && inf.back;
  const f = showBack ? inf.back : inf;
  const img = f.img || (showBack ? '' : inf.img);
  el.innerHTML = `<div class="big" style="${frameVars(inf)}">${img ? `<img src="${esc(img)}" alt="${esc(f.n)}">` : `<div class="card" style="--cw:100%;--ch:100%;width:100%;height:100%;${frameVars(inf)}"><div class="ct" style="font-size:15px"><span class="n">${esc(f.n)}</span><span>${manaHTML(f.m)}</span><span class="ty">${esc(f.t)}</span><span style="white-space:pre-wrap">${manaHTML(f.o)}</span><span class="p">${esc(f.p)}</span></div></div>`}</div>
    <div style="display:grid;gap:6px;min-width:0">
      <div class="ttl"><span>${esc(f.n)}</span><span style="font-family:var(--f-body);font-weight:400">${manaHTML(f.m)}</span></div>
      <div class="tl">${esc(f.t)}</div>
      ${f.o ? `<div class="ot">${manaHTML(f.o)}</div>` : ''}
      ${f.p ? `<div class="pt">${f.p.startsWith('L') ? 'Loyalty ' + esc(f.p.slice(1)) : f.p.startsWith('D') ? 'Defense ' + esc(f.p.slice(1)) : esc(f.p)}</div>` : ''}
      ${inf.back ? `<div><button class="btn small" type="button" data-act="inspFlip">Show ${showBack ? 'front' : 'back'} face</button></div>` : ''}
    </div>`;
}
function inspect(k, fl){ if (!k || !DICT.has(k)) return; if (!UI.insp || UI.insp.k !== k) UI.inspFlip = !!fl; UI.insp = {k}; renderInspector(); }

/* ---------- Menus ---------- */
function closeMenu(){ const m = $('#menu'); m.hidden = true; UI.menuFor = null; UI.confirm = null; }
function openMenuAt(html, x, y){
  const m = $('#menu'); m.innerHTML = html; m.hidden = false;
  const r = m.getBoundingClientRect();
  m.style.left = clamp(x, 8, window.innerWidth - r.width - 8) + 'px';
  m.style.top = clamp(y, 8, window.innerHeight - r.height - 8) + 'px';
}
const mb = (act, label, extra='', kbd='') => `<button type="button" data-act="${act}" ${extra}>${label}${kbd ? `<kbd>${kbd}</kbd>` : ''}</button>`;
function tokenSection(c){
  const inf = info(c.k); if (!inf || !inf.toks.length) return '';
  const toks = inf.toks.map(t => { const a = info(t.id); return `<button type="button" class="tokbtn" data-act="mkTok" data-k="${esc(t.id)}" data-near="${c.id}">${a?.img ? `<img src="${esc(a.img)}" alt="">` : ''}<span>Create ${esc(a?.n || t.n)}${a?.p ? ' ' + esc(a.p) : ''}</span></button>`; }).join('');
  return `<div class="sep"></div><div class="tokrow"><span class="label">Tokens this card makes</span><span class="qty"><button type="button" data-act="tokQty" data-d="-1" aria-label="Fewer">−</button><input type="text" inputmode="numeric" id="tokQtyIn" value="${UI.tokQty}" aria-label="How many"><button type="button" data-act="tokQty" data-d="1" aria-label="More">+</button></span></div>${toks}`;
}
function cardMenu(id, x, y){
  const [z,,c] = find(id); if (!c) return;
  if (UI.menuFor !== id && info(c.k)?.toks?.length) UI.tokQty = suggestTokQty(c);
  UI.menuFor = id;
  const inf = info(c.k); const title = c.fd ? 'Face-down card' : esc(inf?.n || 'Card');
  let h = `<div class="mh">${title}${(c.n||1) > 1 ? ` <span style="color:var(--dim)">×${c.n}</span>` : ''}</div>`;
  if (z === 'hand'){
    h += castMenuItems(c, 'hand');
    h += `<div class="sep"></div>` + mb('mv','Discard', `data-id="${id}" data-to="gy"`) + mb('mv','Exile', `data-id="${id}" data-to="ex"`) +
      mb('mv','Put on top of library', `data-id="${id}" data-to="lib"`) + mb('mv','Put on bottom of library', `data-id="${id}" data-to="lib" data-bottom="1"`) +
      mb('reveal','Show to the table', `data-id="${id}"`);
    h += tokenSection(c);
  } else if (z === 'cz'){
    h += castMenuItems(c, 'cz') + mb('mv','Put into hand', `data-id="${id}" data-to="hand"`);
    h += tokenSection(c);
  } else if (z === 'bf'){
    const stack = (c.n||1) > 1;
    h += abilityMenuItems(c);
    if (stack){
      h += mb('tap', c.tn === c.n ? 'Untap all' : 'Tap all', `data-id="${id}"`, 'T');
      h += `<div class="grid2">${mb('stack','Tap one',`data-id="${id}" data-op="tap1"`)}${mb('stack','Untap one',`data-id="${id}" data-op="untap1"`)}${mb('stack','Add one',`data-id="${id}" data-op="add1"`)}${mb('stack','Remove one',`data-id="${id}" data-op="del1"`)}</div>`;
      h += mb('stack','Split one off the stack', `data-id="${id}" data-op="split"`);
    } else {
      h += mb('tap', c.tap ? 'Untap' : 'Tap (no mana)', `data-id="${id}"`, 'T');
      if (c.tok) h += mb('stack','Make one more', `data-id="${id}" data-op="add1"`);
    }
    if (inf?.back && !c.fd) h += mb('flip', c.fl ? 'Transform to front' : 'Transform to back', `data-id="${id}"`, 'F');
    h += mb('fd', c.fd ? 'Turn face up' : 'Turn face down', `data-id="${id}"`);
    if (isCreatureCard(c)) h += `<div class="sep"></div><div class="label" style="padding:2px 8px">Until end of turn</div><div class="grid2">${mb('pumpD','+1/+0',`data-id="${id}" data-p="1" data-t="0"`)}${mb('pumpD','−1/−0',`data-id="${id}" data-p="-1" data-t="0"`)}${mb('pumpD','+0/+1',`data-id="${id}" data-p="0" data-t="1"`)}${mb('pumpD','−0/−1',`data-id="${id}" data-p="0" data-t="-1"`)}</div>` + mb('pumpSet', 'Set power/toughness this turn…', `data-id="${id}"`);
    h += `<div class="sep"></div><div class="grid2">${mb('ctr','+1/+1 counter',`data-id="${id}" data-kind="cp" data-d="1"`)}${mb('ctr','Remove +1/+1',`data-id="${id}" data-kind="cp" data-d="-1"`)}${mb('ctr','−1/−1 counter',`data-id="${id}" data-kind="cm" data-d="1"`)}${mb('ctr','Remove −1/−1',`data-id="${id}" data-kind="cm" data-d="-1"`)}${mb('ctr','Other counter',`data-id="${id}" data-kind="co" data-d="1"`)}${mb('ctr','Remove counter',`data-id="${id}" data-kind="co" data-d="-1"`)}</div>`;
    h += tokenSection(c);
    h += `<div class="sep"></div>` + mb('copy','Create a token copy', `data-id="${id}"`);
    h += `<div class="sep"></div>` + mb('mv', c.tok ? (stack ? 'All die (to graveyard)' : 'Dies (to graveyard)') : 'Dies / to graveyard', `data-id="${id}" data-to="gy"`) + mb('mv','Sacrifice', `data-id="${id}" data-to="gy" data-sac="1"`) + mb('mv','To exile', `data-id="${id}" data-to="ex"`);
    if (!c.tok) h += mb('mv','Return to hand', `data-id="${id}" data-to="hand"`) + mb('mv','Top of library', `data-id="${id}" data-to="lib"`) + mb('mv','Bottom of library', `data-id="${id}" data-to="lib" data-bottom="1"`);
    if (c.cmd) h += mb('mv','To command zone', `data-id="${id}" data-to="cz"`);
  }
  openMenuAt(h, x, y);
}
function libMenu(x, y){
  openMenuAt(`<div class="mh">Library · ${S.lib.length}</div>` + (looseOk() ? '' : `<div class="mh" style="opacity:.75;font-weight:400">Strict rules: only cards can draw, search or move cards. Game ▾ → Fix something by hand if needed.</div>`) + mb('draw','Draw a card','', 'D') + mb('drawN','Draw…') + mb('shuffle','Shuffle') +
    mb('lookTop','Look at / scry the top cards…') + mb('search','Search library') + `<div class="sep"></div>` + mb('millN','Mill…') + mb('revealTop','Reveal the top card') +
    mb('topFd','Top card onto battlefield face down') + `<div class="sep"></div>` + mb('mull','Mulligan (shuffle hand in, draw 7)'), x, y);
}
function gameMenu(x, y){
  const c = UI.confirm;
  openMenuAt(`<div class="mh">Game</div>` + mb('toggleReveal', S.rh ? 'Hide my hand' : 'Reveal my hand to the table') + mb('untapAll','Untap everything','', 'U') + mb('toggleAuto', `Start my turn by itself: <b>${UI.auto ? 'on' : 'off'}</b>`) + (typeof AUTOTAP !== 'undefined' ? mb('autotapToggle', `Tap my lands to pay automatically: <b>${AUTOTAP.on ? 'on' : 'off'}</b>`) : '') +
    mb('openStops', 'Stops (which windows to show me)…') + mb('manaAdj', 'Adjust my mana pool by hand…') +
    `<div class="sep"></div>` + (UI.rec ? mb('repeatLoop', '<b>Stop recording and repeat…</b>') : mb('recLoop', 'Record a loop…')) + (UI.recDone && !UI.rec ? mb('repeatLoop', 'Repeat the recorded loop…') : '') + (typeof gameMenuExtra === 'function' ? gameMenuExtra() : '') +
    `<div class="sep"></div>` + (c === 'restart' ? mb('restart','<span class="warn">Click again to restart</span>') : mb('askRestart','New game, same deck')) +
    mb('toLobby','Change deck') + (c === 'leave' ? mb('leave','<span class="warn">Click again to leave the table</span>') : mb('askLeave','Leave the table')), x, y);
}
function diceMenu(x, y){ openMenuAt(`<div class="mh">Roll</div>` + mb('roll','Flip a coin','data-n="2"') + mb('roll','Roll a d6','data-n="6"') + mb('roll','Roll a d20','data-n="20"'), x, y); }

/* ---------- Modals ---------- */
function openModal(m){ const old = UI.modal; UI.modal = m; if (old && old !== m && old.onClose){ const f = old.onClose; old.onClose = null; f(); } renderModal(); }
function closeModal(){ const m = UI.modal; UI.modal = null; $('#modal').hidden = true; $('#modal').dataset.key = ''; if (m && m.onClose) m.onClose(); }
function filterBar(keys, m){
  const counts = {}; keys.forEach(k => typesOf(k).forEach(t => counts[t] = (counts[t] || 0) + 1));
  return `<div class="fchips"><button type="button" data-act="zf" data-f="" aria-pressed="${!m.filter}">All ${keys.length}</button>` +
    TYPE_FILTERS.filter(([t]) => counts[t]).map(([t, l]) => `<button type="button" data-act="zf" data-f="${t}" aria-pressed="${m.filter === t}">${l} ${counts[t]}</button>`).join('') +
    `<input type="search" id="zq" placeholder="Find by name or rules text" value="${esc(m.q || '')}" aria-label="Find a card" autocomplete="off"></div>`;
}
function vattrs(k){ const a = info(k); return `data-ty="${typesOf(k).join(' ')}" data-nm="${esc(norm([a?.n, a?.t, a?.o, a?.back?.n, a?.back?.o].filter(Boolean).join(' ')))}"`; }
function applyZoneFilter(){
  const m = UI.modal; if (!m) return; const q = norm(m.q || ''); let shown = 0;
  document.querySelectorAll('#modal .vitem[data-ty]').forEach(el => {
    const ok = (!m.filter || el.dataset.ty.split(' ').includes(m.filter)) && (!q || el.dataset.nm.includes(q));
    el.hidden = !ok; if (ok) shown++;
  });
  const e = $('#zempty'); if (e) e.hidden = shown > 0;
}
function renderModal(){
  const m = UI.modal; const el = $('#modal'); if (!m){ el.hidden = true; return; }
  el.hidden = false; let title = '', body = '', head = '';
  if (m.type === 'zone'){
    const z = m.zone; let list;
    const range = z === 'lib' && Array.isArray(m.ids);
    if (range){ const want = new Set(m.ids); list = S.lib.filter(c => want.has(c.id)); }
    else { list = S[z].slice(); if (z === 'lib') list.sort((a,b) => cname(a).localeCompare(cname(b))); }
    if (range) title = (m.title || `Top ${m.ids.length} of your library`) + (list.length < m.ids.length ? ` · ${list.length} left` : '');
    else title = z === 'lib' ? `Search your library (${S.lib.length})` : `Your ${ZNAME[z]} (${list.length})`;
    if (z === 'lib' && !range) head = `<button class="btn small" type="button" data-act="shuffleClose">Shuffle and close</button>`;
    let dests = [['hand','Hand'],['bf','Battlefield'],['gy','Graveyard'],['ex','Exile'],['lib','Top'],['libb','Bottom']].filter(([d]) => z === 'lib' || d !== z);
    if (m.dests) dests = dests.filter(([d]) => m.dests.includes(d));
    const pos = c => { const i = S.lib.indexOf(c); return i < m.ids.length ? `#${i+1} from the top` : i === S.lib.length - 1 ? 'on the bottom' : `${S.lib.length - i} from the bottom`; };
    const items = list.map(c => `<div class="vitem" ${vattrs(c.k)}>${cardHTML(c.k, {})}<div class="acts">${range ? `<span class="pos">${pos(c)}</span>` : ''}${z === 'gy' ? gyButtons(c) : ''}${z === 'ex' ? exButtons(c) : ''}${(looseOk() || m.dests || m.eng) ? dests.map(([d, l]) => `<button type="button" data-act="mvz" data-id="${c.id}" data-to="${d}">${l}</button>`).join('') : ''}</div></div>`).join('');
    body = (m.hint ? `<p class="hint">${esc(m.hint)}</p>` : '') + (list.length ? (range ? '' : filterBar(list.map(c => c.k), m)) + `<div class="vgrid">${items}</div><p class="hint" id="zempty" hidden>No cards match.</p>`
      : `<p class="hint">${range ? 'All of those cards have left your library.' : 'Nothing here.'}</p>`);
  } else if (m.type === 'opp'){
    const s = OPP.get(m.pid); if (!s){ closeModal(); return; }
    const list = (m.zone === 'hr' ? (s.hr||[]) : s[m.zone]).filter(Boolean);
    title = `${s.nm}'s ${m.zone === 'hr' ? 'revealed hand' : ZNAME[m.zone]} (${list.length})`;
    body = list.length ? filterBar(list, m) + `<div class="vgrid">${list.map(k => `<div class="vitem" ${vattrs(k)}>${cardHTML(k, {})}</div>`).join('')}</div><p class="hint" id="zempty" hidden>No cards match.</p>` : `<p class="hint">Nothing here.</p>`;
  } else if (m.type === 'bottom'){
    const need = Math.min(m.need, S.hand.length); m.sel = m.sel.filter(id => S.hand.some(c => c.id === id));
    title = `Mulligan: put ${need} card${need === 1 ? '' : 's'} on the bottom`;
    head = `<button class="btn small primary" type="button" data-act="doBottom" ${m.sel.length === need ? '' : 'disabled'}>Put ${m.sel.length} of ${need} on the bottom</button>`;
    body = `<p class="hint">Tap the cards to send to the bottom of your library.</p><div class="vgrid">${S.hand.map(c => { const on = m.sel.includes(c.id);
      return `<button type="button" class="vbtn vitem${on ? ' chosen' : ''}" data-act="pickB" data-id="${c.id}">${cardHTML(c.k, {})}<span>${on ? 'To the bottom' : 'Keep'}</span></button>`; }).join('')}</div>`;
  } else if (m.type === 'deck'){
    const d = LOBBY.deck; if (!d){ closeModal(); return; }
    title = `${LOBBY.deckName || 'Your deck'}: cards & art`;
    const order = ['creature','planeswalker','instant','sorcery','artifact','enchantment','battle'];
    const rank = k => { const t = typesOf(k); if (t.includes('land') && !t.includes('creature')) return 9; const i = order.findIndex(o => t.includes(o)); return i < 0 ? 8 : i; };
    const items = [...d.cmd.map(k => ({k, q:1, cmd:true})), ...d.main.slice().sort((a,b) => rank(a.k) - rank(b.k) || (info(a.k)?.n||'').localeCompare(info(b.k)?.n||''))];
    body = `<div class="row"><label class="label" for="artStyle">Art style for the whole deck</label><select id="artStyle">${ART_STYLES.map(([v, l]) => `<option value="${v}"${m.style === v ? ' selected' : ''}>${l}</option>`).join('')}</select><button class="btn primary small" type="button" data-act="applyStyle" ${m.busy ? 'disabled' : ''}>Apply</button></div>
      <p class="hint">${esc(m.msg || 'Cards with no printing in that style keep their art. Tap any single card to pick its printing yourself.')}</p>
      <div class="vgrid">${items.map(e => { const a = info(e.k); return `<button type="button" class="vbtn" data-act="prints" data-k="${esc(e.k)}">${cardHTML(e.k, {badges:{n:e.q, cmd:e.cmd}})}<small>${esc(a?.sn || (a?.set || '').toUpperCase())}${a?.pr ? ' · $' + esc(a.pr) : ''}</small></button>`; }).join('')}</div>`;
  } else if (m.type === 'prints'){
    const cur = info(m.k);
    title = `Choose art: ${cur?.n || ''}`;
    head = `<button class="btn small" type="button" data-act="openDeck">Back to deck</button>`;
    body = !m.list ? `<p class="hint">Loading printings from Scryfall…</p>`
      : !m.list.length ? `<p class="hint">${esc(m.msg || 'No printings found.')}</p>`
      : `<div class="vgrid">${m.list.map((a, i) => `<button type="button" class="vbtn vitem${a.k === m.k ? ' cur' : ''}" data-act="pickPrint" data-i="${i}"><div class="card" style="${frameVars(a)}">${a.img ? `<img src="${esc(a.img)}" alt="${esc(a.n)}" loading="lazy">` : ''}</div><span>${esc(a.sn)}${a.yr ? ' · ' + esc(a.yr) : ''}</span><small>${esc([a.k === m.k ? 'In your deck' : '', a.fx, a.pr ? '$' + a.pr : ''].filter(Boolean).join(' · ')) || '&nbsp;'}</small></button>`).join('')}</div>`
        + (m.next ? `<div><button class="btn" type="button" data-act="morePrints" ${m.busy ? 'disabled' : ''}>Show more printings</button></div>` : '');
  } else if (m.type === 'ask'){
    title = m.title;
    body = (m.hint ? `<p class="hint">${esc(m.hint)}</p>` : '') + `<form class="row" data-form="ask"><input type="text" inputmode="numeric" id="askIn" value="${m.def}" style="max-width:120px"><button class="btn primary" type="submit">${esc(m.go)}</button></form>`;
  } else if (m.type === 'tokens'){
    title = 'Make a token';
    const deckToks = [...new Set([...S.deck.main.map(e => e.k), ...S.deck.cmd].flatMap(k => info(k)?.toks.map(t => t.id) || []))].filter(id => DICT.has(id));
    const btn = (attrs, img, n, sub) => `<button type="button" ${attrs}>${img ? `<img src="${esc(img)}" alt="">` : '<span class="ph"></span>'}<span>${esc(n)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;
    body = `<div class="row"><span class="label">How many</span><span class="qty row" style="gap:4px"><button class="btn small" type="button" data-act="tokQty" data-d="-1">−</button><input type="text" inputmode="numeric" id="tokQtyIn" value="${UI.tokQty}" style="width:56px;text-align:center"><button class="btn small" type="button" data-act="tokQty" data-d="1">+</button></span></div>` +
      (deckToks.length ? `<div><div class="label" style="margin-bottom:6px">Tokens your deck makes</div><div class="tgrid">${deckToks.map(id => { const a = info(id); return btn(`data-act="mkTok" data-k="${esc(id)}"`, a.img, a.n, [a.p, a.t.replace(/^Token\s*/,'')].filter(Boolean).join(' · ')); }).join('')}</div></div>` : '') +
      `<div><div class="label" style="margin-bottom:6px">Common tokens</div><div class="tgrid">${TOKEN_PRESETS.map(([n, q], i) => btn(`data-act="presetTok" data-i="${i}"`, '', n, '')).join('')}</div></div>` +
      `<form data-form="f34card" class="row" style="gap:6px;align-items:flex-end;flex-wrap:wrap"><div style="flex:1;min-width:180px"><label class="label" for="f34name">Token copy of any card (lands too)</label><input type="text" id="f34name" placeholder="Volcanic Island" autocomplete="off"></div><button class="btn" type="submit">Make it</button></form>` +
      `<form data-form="tokSearch" class="form3"><div><label class="label" for="tsName">Find any token on Scryfall</label><input type="text" id="tsName" placeholder="Construct" value="${esc(m.q||'')}"></div><div><label class="label" for="tsPT">Power/Toughness</label><input type="text" id="tsPT" placeholder="0/0" value="${esc(m.pt||'')}"></div><div><label class="label" for="tsCol">Colors</label><input type="text" id="tsCol" placeholder="e.g. WU" maxlength="5" value="${esc(m.col||'')}"></div><button class="btn primary" type="submit">Create</button></form>` +
      `<p class="hint">${esc(m.msg || 'If Scryfall has no match, a plain token with that name and P/T is made instead.')}</p>`;
  } else {
    const r = renderEngineModal(m); if (!r){ closeModal(); return; }
    title = r.title; body = r.body; head = r.head || '';
  }
  const key = [m.type, m.zone, m.pid, m.k, m.key].join('|');
  const old = el.querySelector('.mbody'); const keepScroll = el.dataset.key === key && old ? old.scrollTop : null;
  const closeBtn = m.noClose ? '' : `<button class="btn small" type="button" data-act="closeModal">Close</button>`;
  el.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="mhead"><h3>${esc(title)}</h3>${head}${closeBtn}</div><div class="mbody">${body}</div></div>`;
  el.dataset.key = key;
  const nb = el.querySelector('.mbody');
  if (m.scroll != null){ nb.scrollTop = m.scroll; delete m.scroll; } else if (keepScroll != null) nb.scrollTop = keepScroll;
  if (m.type === 'zone' || m.type === 'opp') applyZoneFilter();
  if (m.type === 'ask') setTimeout(() => { const i = $('#askIn'); i?.focus(); i?.select(); });
}

/* ---------- Actions ---------- */
function readQty(){ const i = $('#tokQtyIn'); const v = parseInt(i?.value, 10); UI.tokQty = clamp(Number.isFinite(v) ? v : UI.tokQty, 1, 99); return UI.tokQty; }
const ACT = {
  copyCode(){ const t = NET.code; navigator.clipboard?.writeText(t).then(() => toast('Table code copied'), () => toast('Code: ' + t)); },
  rollFirst(){ const r = 1 + rnd(20); log(`rolled a d20 for first: ${r}`); commit(); },
  goFirst, passTurn(){ endTurnFlow(); },
  startTurn(){ startMyTurn(); },
  openTokens(){ closeMenu(); UI.tokQty = 1; openModal({type:'tokens'}); },
  diceMenu(el){ const r = el.getBoundingClientRect(); diceMenu(r.left, r.bottom + 4); },
  gameMenu(el){ const r = el.getBoundingClientRect(); gameMenu(r.right - 240, r.bottom + 4); },
  roll(el){ const n = +el.dataset.n; const r = 1 + rnd(n); log(n === 2 ? `flipped a coin: ${r === 1 ? 'heads' : 'tails'}` : `rolled a d${n}: ${r}`); commit(); },
  life(el){ setLife(+el.dataset.d); },
  psn(el){ S.psn = Math.max(0, S.psn + (+el.dataset.d)); log(`poison: ${S.psn}`); commit(); },
  cdt(el){ const key = el.dataset.key; const d = +el.dataset.d; const v = Math.max(0, (S.cdt[key]||0) + d); if (v === (S.cdt[key]||0)) return;
    S.cdt[key] = v; S.life -= d; const k = key.slice(key.indexOf('|')+1); log(`commander damage from ${info(k)?.n || 'a commander'}: ${v} (life ${S.life})`); commit(); },
  draw(){ draw(1); },
  libMenu(el){ const r = el.getBoundingClientRect(); libMenu(r.left, r.bottom + 2); },
  viewZone(el){ openModal({type:'zone', zone:el.dataset.z}); },
  viewOpp(el){ openModal({type:'opp', pid:el.dataset.pid, zone:el.dataset.z}); },
  drawN(){ openModal({type:'ask', title:'Draw how many cards?', def:7, go:'Draw', run:n => draw(n)}); },
  millN(){ openModal({type:'ask', title:'Mill how many cards?', def:1, go:'Mill', run:n => mill(n)}); },
  lookTop(){ openModal({type:'ask', title:'Look at how many cards from the top?', def:3, go:'Look', run:n => { log(`looked at the top ${n} cards of their library`); openModal({type:'zone', zone:'lib', ids:S.lib.slice(0, n).map(c => c.id)}); commit(); }}); },
  search(){ closeMenu(); log('searched their library'); openModal({type:'zone', zone:'lib'}); commit(); },
  shuffle(){ shuffleLib(); },
  shuffleClose(){ closeModal(); shuffleLib(); },
  revealTop(){ if (!S.lib.length) return; log(`revealed the top card: ${cname(S.lib[0])}`); inspect(S.lib[0].k); commit(); },
  topFd(){ if (S.lib.length) moveCard(S.lib[0].id, 'bf', {fd:true}); },
  mull(){ mulligan(); },
  toggleReveal(){ S.rh = !S.rh; log(S.rh ? 'revealed their hand' : 'hid their hand'); commit(); },
  untapAll(){ untapAll(); },
  askRestart(el){ UI.confirm = 'restart'; const m = $('#menu'); gameMenu(parseFloat(m.style.left), parseFloat(m.style.top)); UI.confirm = 'restart'; },
  restart(){ newGame((currentTurn()[2] || 0) + 1); },
  joinNew(){ newGame(currentTurn()[2] || 0); },
  toLobby(){ closeMenu(); showLobby(); },
  askLeave(){ UI.confirm = 'leave'; const m = $('#menu'); gameMenu(parseFloat(m.style.left), parseFloat(m.style.top)); UI.confirm = 'leave'; },
  leave(){ closeMenu(); closeNet(); S = null; store.del('pt.save'); LOGS.clear(); showLobby(); },
  tok1(el){ createToken(el.dataset.k, 1); },
  tokQty(el){ UI.tokQty = clamp(readQty() + (+el.dataset.d), 1, 99); const i = $('#tokQtyIn'); if (i) i.value = UI.tokQty; },
  async mkTok(el){
    const k = el.dataset.k; const n = readQty();
    const near = el.dataset.near ? find(+el.dataset.near)[2] : null;
    if (!DICT.has(k)){ await ensureTokens([k]); }
    if (!DICT.has(k)){ toast('Could not load that token from Scryfall'); return; }
    createToken(k, n, near && near.x != null ? near : null); if (UI.modal?.type === 'tokens') closeModal();
  },
  async presetTok(el){
    const [label, q] = TOKEN_PRESETS[+el.dataset.i]; const n = readQty();
    toast('Finding ' + label + '…');
    let k = null; try { k = await searchToken(q); } catch {}
    if (!k){ const m = label.match(/^(.*?)\s+(\d+\/\d+)/); k = customToken(m ? m[1] : label, m ? m[2] : '', ''); }
    closeModal(); createToken(k, n);
  },
  play(el){ moveCard(+el.dataset.id, 'bf'); },
  playFd(el){ moveCard(+el.dataset.id, 'bf', {fd:true}); },
  mv(el){ moveCard(+el.dataset.id, el.dataset.to, {bottom: !!el.dataset.bottom, sac: !!el.dataset.sac, manual:true}); },
  mvz(el){ const to = el.dataset.to; moveCard(+el.dataset.id, to === 'libb' ? 'lib' : to, {bottom: to === 'libb'}); if (UI.modal) renderModal(); },
  reveal(el){ const [,,c] = find(+el.dataset.id); if (c){ log(`showed ${cname(c)} from their hand`); commit(); } },
  tap(el){ tapToggle(+el.dataset.id); },
  flip(el){ const [,,c] = find(+el.dataset.id); if (c){ c.fl = !c.fl; const inf = info(c.k); log(`transformed ${inf?.n} → ${c.fl ? inf?.back?.n : inf?.n}`); commit(); } },
  fd(el){ const [,,c] = find(+el.dataset.id); if (c){ c.fd = !c.fd; log(c.fd ? 'turned a card face down' : `turned ${cname(c)} face up`); commit(); } },
  ctr(el){ counter(+el.dataset.id, el.dataset.kind, +el.dataset.d); const [,,c] = find(+el.dataset.id); if (c) cardMenuRefresh(c.id); },
  stack(el){ const id = +el.dataset.id; const op = el.dataset.op; stackOp(id, op); const [z] = find(id); if (z === 'bf' && op !== 'split') setTimeout(() => cardMenuRefresh(id)); },
  copy(el){ copyCard(+el.dataset.id); },
  inspFlip(){ UI.inspFlip = !UI.inspFlip; renderInspector(); },
  closeModal(){ closeModal(); },
  zf(el){ UI.modal.filter = el.dataset.f || null; renderModal(); },
  inspK(el){ inspect(el.dataset.k); },
  toggleAuto(){ UI.auto = !UI.auto; store.set('pt.auto', UI.auto); closeMenu(); toast(UI.auto ? 'Your turn will start by itself' : 'Press “Start my turn” (or U) to begin your turn'); queueRender(); },
  randomFirst(){ const ps = players(); const p = ps[rnd(ps.length)]; const [n,,g=0] = currentTurn(); S.turn = [n + 1, p.pid, g]; log(`picked a random first player: ${p.me ? S.nm : p.nm}`); commit(); },
  pickB(el){ const m = UI.modal; const id = +el.dataset.id; const i = m.sel.indexOf(id);
    if (i >= 0) m.sel.splice(i, 1); else if (m.sel.length < Math.min(m.need, S.hand.length)) m.sel.push(id); renderModal(); },
  doBottom(){ const m = UI.modal; const ids = new Set(m.sel); const cards = S.hand.filter(c => ids.has(c.id));
    S.hand = S.hand.filter(c => !ids.has(c.id)); S.lib.push(...cards);
    log(`put ${cards.length} card${cards.length === 1 ? '' : 's'} on the bottom`); closeModal(); commit(); },
  openDeck(){ openModal({type:'deck', scroll: UI.deckScroll}); },
  prints(el){ UI.deckScroll = $('#modal .mbody')?.scrollTop || 0; openModal({type:'prints', k:el.dataset.k}); loadPrints(false); },
  morePrints(){ loadPrints(true); },
  pickPrint(el){ const m = UI.modal; const a = m.list?.[+el.dataset.i]; if (!a || !LOBBY.deck) return;
    DICT.set(a.k, a); swapKey(LOBBY.deck, m.k, a.k); ensureTokens(a.toks.map(t => t.id));
    renderDeckSum(); openModal({type:'deck', scroll: UI.deckScroll, msg:`Changed the art on ${a.n} (${a.sn}).`}); },
  async applyStyle(){
    const m = UI.modal; const style = $('#artStyle').value; m.style = style; m.busy = true; m.msg = 'Finding printings on Scryfall…'; renderModal();
    try {
      const r = await applyArtStyle(style, (a, b) => { m.msg = `Finding printings on Scryfall… ${a} of ${b} cards`; if (UI.modal === m) renderModal(); });
      m.msg = r.changed ? `Changed the art on ${r.changed} of ${r.total} cards. The rest have no printing in that style.` : 'None of these cards has a printing in that style.';
    } catch (e){ console.warn(e); m.msg = 'Could not reach Scryfall. Check your internet connection and try again.'; }
    m.busy = false; renderDeckSum(); if (UI.modal === m) renderModal();
  },
  saveDeck(){ saveDeck(); },
  loadSaved(el){ const r = savedDecks().find(x => x.id === el.dataset.id); if (!r) return;
    r.dict.forEach(addInfo);
    LOBBY.deck = {main:r.deck.main.map(e => ({k:e.k, q:e.q})), cmd:r.deck.cmd.slice(), missing:(r.deck.missing || []).slice()};
    LOBBY.deckName = r.name; LOBBY.savedId = r.id; UI.delConfirm = null;
    setFmt(FMT[r.fmt] ? r.fmt : 'cmd'); deckStatus(`Loaded “${r.name}”.`, 'ok'); renderSaved();
    $('#deckSum').scrollIntoView({behavior:'smooth', block:'nearest'}); },
  copyDeck(el){
    let d = LOBBY.deck;
    if (el.dataset.id){ const r = savedDecks().find(x => x.id === el.dataset.id); if (!r) return; r.dict.forEach(addInfo); d = r.deck; }
    if (!d) return; const t = deckText(d);
    const fallback = () => { $('#deckIn').value = t; $('#deckIn').select(); toast('The list is in the box: copy it from there'); };
    try { navigator.clipboard.writeText(t).then(() => toast('Deck list copied. Paste it to a friend or into Moxfield.'), fallback); } catch { fallback(); }
  },
  delDeck(el){ const id = el.dataset.id;
    if (UI.delConfirm !== id){ UI.delConfirm = id; renderSaved(); return; }
    writeDecks(savedDecks().filter(x => x.id !== id));
    if (LOBBY.savedId === id) LOBBY.savedId = null; UI.delConfirm = null; renderSaved(); renderDeckSum(); },
};
function swapKey(d, from, to){
  if (from === to) return;
  d.cmd = d.cmd.map(k => k === from ? to : k);
  const main = new Map(); d.main.forEach(e => { const k = e.k === from ? to : e.k; main.set(k, (main.get(k) || 0) + e.q); });
  d.main = [...main].map(([k, q]) => ({k, q}));
}
const frontName = k => ((info(k)?.full || info(k)?.n) || '').split(' // ')[0];
async function loadPrints(more){
  const m = UI.modal; if (!m || m.type !== 'prints') return;
  m.busy = true; renderModal();
  try {
    const path = (more && m.next) ? m.next.replace(SF, '')
      : '/cards/search?unique=prints&order=released&dir=desc&q=' + encodeURIComponent(`!"${frontName(m.k).replace(/"/g, '')}" game:paper`);
    const r = await sf(path);
    if (UI.modal !== m) return;
    const got = (r.data || []).filter(c => c.image_uris || c.card_faces?.[0]?.image_uris).map(infoFrom);
    m.list = (more ? (m.list || []) : []).concat(got); m.next = r.has_more ? r.next_page : null;
  } catch (e){ console.warn(e); m.list = m.list || []; m.msg = 'Could not reach Scryfall. Check your internet connection.'; }
  m.busy = false; if (UI.modal === m) renderModal();
}
async function applyArtStyle(style, onProgress){
  const d = LOBBY.deck; const st = ART_STYLES.find(x => x[0] === style); if (!d || !st) return {changed:0, total:0};
  const keys = [...new Set([...d.cmd, ...d.main.map(e => e.k)])];
  const names = [...new Set(keys.map(frontName).filter(Boolean))];
  const chunks = []; let chunk = [], len = 0;
  for (const n of names){ const q = `!"${n.replace(/"/g, '')}"`;
    if (chunk.length && (len + q.length > 600 || chunk.length >= 15)){ chunks.push(chunk); chunk = []; len = 0; }
    chunk.push(q); len += q.length + 4; }
  if (chunk.length) chunks.push(chunk);
  const best = new Map(); let done = 0;
  for (const ch of chunks){
    let path = '/cards/search?unique=cards&q=' + encodeURIComponent(`(${ch.join(' or ')}) game:paper ${st[2]}`);
    while (path){ const r = await sf(path); for (const c of (r.data || [])) if (c.image_uris || c.card_faces?.[0]?.image_uris) best.set(norm(c.name.split(' // ')[0]), c);
      path = r.has_more && r.next_page ? r.next_page.replace(SF, '') : null; }
    done += ch.length; onProgress?.(done, names.length);
  }
  const changed = new Set(); const tokIds = [];
  for (const k of keys){
    const c = best.get(norm(frontName(k))); if (!c || c.id === k) continue;
    const a = infoFrom(c); DICT.set(a.k, a); swapKey(d, k, a.k); changed.add(frontName(k)); tokIds.push(...a.toks.map(t => t.id));
  }
  if (tokIds.length) await ensureTokens(tokIds);
  return {changed: changed.size, total: names.length};
}
function deckText(d){
  const line = (q, k) => { const a = info(k); return `${q} ${a?.full || a?.n || '?'}${a?.set ? ` (${a.set.toUpperCase()}) ${a.cn}` : ''}`; };
  return (d.cmd.length ? 'Commander\n' + d.cmd.map(k => line(1, k)).join('\n') + '\n\nDeck\n' : '') + d.main.map(e => line(e.q, e.k)).join('\n');
}
function deckCount(d){ return d.main.reduce((a, e) => a + e.q, 0) + d.cmd.length; }
function deckPrice(d, look = info){
  let t = 0, miss = 0; const add = (k, q) => { const p = parseFloat(look(k)?.pr); if (Number.isFinite(p)) t += p * q; else miss += q; };
  d.cmd.forEach(k => add(k, 1)); d.main.forEach(e => add(e.k, e.q)); return {t, miss};
}
function savedDecks(){ const l = store.get('pt.decks'); return Array.isArray(l) ? l.filter(r => r && r.id && r.deck && Array.isArray(r.dict)) : []; }
function writeDecks(list){ try { localStorage.setItem('pt.decks', JSON.stringify(list)); return true; } catch { return false; } }
function saveDeck(){
  const d = LOBBY.deck; if (!d) return;
  const name = (($('#deckNameIn')?.value || '').trim() || LOBBY.deckName || info(d.cmd[0])?.n || 'Untitled deck').slice(0, 60);
  LOBBY.deckName = name;
  const keys = new Set([...d.cmd, ...d.main.map(e => e.k)]);
  [...keys].forEach(k => (info(k)?.toks || []).forEach(t => keys.add(t.id)));
  const dict = [...keys].map(k => DICT.get(k)).filter(Boolean).map(a => { const {fx, ...rest} = a; return rest; });
  const list = savedDecks(); const id = LOBBY.savedId || rid(8);
  const rec = {id, name, fmt: LOBBY.fmt, at: Date.now(), deck: {main: d.main, cmd: d.cmd, missing: d.missing || []}, dict};
  const i = list.findIndex(x => x.id === id); if (i >= 0) list.splice(i, 1);
  list.unshift(rec);
  if (!writeDecks(list)){ deckStatus('Your browser has no room left for saved decks. Delete an old one and try again.', 'err'); return; }
  LOBBY.savedId = id; deckStatus(`Saved “${name}” in this browser.`, 'ok'); renderSaved(); renderDeckSum();
}
function renderSaved(){
  const el = $('#saved'); const list = savedDecks();
  if (!list.length){ el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<h2>My decks <span class="hint" style="font:400 13.5px var(--f-body)">saved in this browser</span></h2><div class="saved-grid">${list.map(r => {
    const dm = new Map(r.dict.map(a => [a.k, a]));
    const cover = dm.get(r.deck.cmd[0]) || dm.get(r.deck.main.find(e => !/\bLand\b/.test(dm.get(e.k)?.t || ''))?.k);
    const pr = deckPrice(r.deck, k => dm.get(k)).t;
    const id = esc(r.id);
    return `<div class="dtile${LOBBY.savedId === r.id ? ' on' : ''}"><button type="button" class="dmain" data-act="loadSaved" data-id="${id}"><span class="dart">${cover?.art ? `<img src="${esc(cover.art)}" alt="" loading="lazy">` : ''}</span><span class="dname">${esc(r.name)}</span><span class="dmeta">${esc(FMT[r.fmt]?.label || '')} · ${deckCount(r.deck)} cards${pr ? ` · about $${Math.round(pr)}` : ''}</span></button>
      <div class="dacts"><button class="btn small" type="button" data-act="copyDeck" data-id="${id}">Copy list</button><button class="btn small ghost" type="button" data-act="delDeck" data-id="${id}">${UI.delConfirm === r.id ? '<span class="warn">Click again to delete</span>' : 'Delete'}</button></div></div>`;
  }).join('')}</div>`;
}
function cardMenuRefresh(id){ const m = $('#menu'); if (m.hidden) { const el = document.querySelector(`.card[data-id="${id}"]`); if (!el) return; const r = el.getBoundingClientRect(); cardMenu(id, r.right + 6, r.top); return; } cardMenu(id, parseFloat(m.style.left), parseFloat(m.style.top)); }
function draw7(){ for (let i=0;i<7 && S.lib.length;i++) S.hand.push(S.lib.shift()); }

/* ---------- Input: clicks, drags, keys ---------- */
document.addEventListener('click', e => {
  if (e.target.id === 'modal'){ if (!UI.modal?.noClose) closeModal(); return; }
  const a = e.target.closest('[data-act]');
  if (a && !a.closest('.card[data-id]')){
    if (a.classList.contains('pile') && e.target.closest('button.more')) return;
    if (a.disabled) return;
    e.preventDefault(); const fn = ACT[a.dataset.act]; if (fn){ undoHook(a.dataset.act); fn(a, e); } return;
  }
  if (!e.target.closest('#menu') && !e.target.closest('.card')) closeMenu();
  const card = e.target.closest('.card[data-k]');
  if (card && !card.dataset.id) inspect(card.dataset.k, !!card.dataset.fl);
});
document.addEventListener('submit', e => {
  const f = e.target;
  if (f.id === 'chat'){ e.preventDefault(); const v = $('#chatIn').value.trim(); if (v && S){ log(v, true); $('#chatIn').value = ''; commit(); } return; }
  if (f.dataset.form === 'ask'){ e.preventDefault(); const n = clamp(parseInt($('#askIn').value, 10) || 0, 0, 999); const run = UI.modal.run; const zeroOk = UI.modal.zeroOk; UI.modal.onClose = null; closeModal(); if (n > 0 || zeroOk) run(n); return; }
  if (f.dataset.form === 'tokSearch'){
    e.preventDefault(); const name = $('#tsName').value.trim(); const pt = $('#tsPT').value.trim(); const col = $('#tsCol').value.trim().toUpperCase().replace(/[^WUBRG]/g,'');
    if (!name) return; const n = readQty(); UI.modal.msg = 'Searching Scryfall…'; UI.modal.q = name; UI.modal.pt = pt; UI.modal.col = col; renderModal();
    const m = pt.match(/^(\*|\d+)\/(\*|\d+)$/);
    let q = `t:token !"${name.replace(/"/g,'')}"` + (m ? ` pow=${m[1]} tou=${m[2]}` : '') + (col ? ` c=${col.toLowerCase()}` : '');
    (async () => { let k = null; try { k = await searchToken(q); if (!k && (m || col)) k = await searchToken(`t:token !"${name.replace(/"/g,'')}"`); } catch {}
      if (!k) k = customToken(name, m ? pt : '', col); closeModal(); createToken(k, n); })();
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'zq' && UI.modal){ UI.modal.q = e.target.value; applyZoneFilter(); }
  else if (e.target.id === 'deckNameIn') LOBBY.deckName = e.target.value.trim();
  else if (e.target.id === 'nameIn') store.set('pt.name', e.target.value.trim());
});
document.addEventListener('mouseover', e => {
  const card = e.target.closest('.card[data-k], .sitem[data-k]'); if (!card || drag || !card.dataset.k) return;
  inspect(card.dataset.k, !!card.dataset.fl);
});
document.addEventListener('dblclick', e => {
  const card = e.target.closest('.card[data-id][data-zone="bf"]'); if (!card) return;
  e.preventDefault(); closeMenu(); snap('quick'); quickTap(+card.dataset.id);
});
document.addEventListener('contextmenu', e => {
  const card = e.target.closest('.card[data-id]'); if (!card) return;
  e.preventDefault(); UI.sel = +card.dataset.id; cardMenu(+card.dataset.id, e.clientX + 4, e.clientY + 4); queueRender();
});
let drag = null;
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('.card[data-id]'); if (!el || e.button > 0 || !S) return;
  const r = el.getBoundingClientRect();
  drag = {id:+el.dataset.id, el, sx:e.clientX, sy:e.clientY, ox:e.clientX - r.left, oy:e.clientY - r.top, w:el.offsetWidth, h:el.offsetHeight, moved:false, ghost:null, hot:null};
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  if (!drag.moved){
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
    drag.moved = true; closeMenu();
    const g = drag.el.cloneNode(true); g.classList.add('ghost'); g.classList.remove('sel');
    g.style.cssText = `position:fixed;left:0;top:0;margin:0;width:${drag.w}px;height:${drag.h}px;pointer-events:none;z-index:100;--cw:${drag.w}px;--ch:${drag.h}px;${frameVars(info(find(drag.id)[2]?.k))}`;
    document.body.appendChild(g); drag.ghost = g; drag.el.classList.add('dragging');
  }
  drag.ghost.style.transform = `translate(${e.clientX - drag.ox}px, ${e.clientY - drag.oy}px)` + (drag.el.classList.contains('tapped') ? ' rotate(90deg)' : '');
  const t = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-drop]') || null;
  if (t !== drag.hot){ drag.hot?.classList.remove('drop-hot'); t?.classList.add('drop-hot'); drag.hot = t; }
  e.preventDefault();
}, {passive:false});
function endDrag(e, cancel){
  const d = drag; drag = null; if (!d) return;
  d.hot?.classList.remove('drop-hot'); d.ghost?.remove(); d.el.classList.remove('dragging');
  if (cancel) return;
  if (!d.moved){
    UI.sel = d.id; const [z,,c] = find(d.id);
    if (c && !c.fd) inspect(c.k, c.fl);
    const r = d.el.getBoundingClientRect();
    cardMenu(d.id, r.right + 6, z === 'hand' ? r.top - 200 : r.top);
    queueRender(); return;
  }
  const t = d.hot; if (!t) return;
  const to = t.dataset.drop;
  const [from,,c] = find(d.id);
  if (!(to === 'bf' && (from === 'bf' || from === 'hand' || from === 'cz')) && from !== to && !manualOk(`moving ${c ? cname(c) : 'a card'}`)) return;
  if (to === 'bf'){
    const bf = $('#bf'); const r = bf.getBoundingClientRect();
    const cw = parseFloat(getComputedStyle(bf).getPropertyValue('--cw')) || 78, ch = parseFloat(getComputedStyle(bf).getPropertyValue('--ch')) || 109;
    const x = clamp((e.clientX - d.ox - r.left) / Math.max(1, r.width - cw) * 1000, 0, 1000);
    const y = clamp((e.clientY - d.oy - r.top) / Math.max(1, r.height - ch) * 1000, 0, 1000);
    if ((from === 'hand' || from === 'cz') && c){ castFromDrag(c, from, {x, y}); return; }
    moveCard(d.id, 'bf', {x, y});
  } else moveCard(d.id, to);
}
document.addEventListener('pointerup', e => endDrag(e, false));
document.addEventListener('pointercancel', e => endDrag(e, true));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape'){ closeMenu(); if (!UI.modal?.noClose) closeModal(); return; }
  if (!S || $('#game').hidden || e.target.closest('input,textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'd'){ if (manualOk('drawing a card')) draw(1); }
  else if (k === 'u'){ const [n, pid] = currentTurn(); if (pid === MYPID && S.untapN < n && n > 0) startMyTurn(); else untapAll(); }
  else if (k === 't' && UI.sel){ quickTap(UI.sel); }
  else if (k === 'f' && UI.sel){ const [,,c] = find(UI.sel); if (c && info(c.k)?.back) ACT.flip({dataset:{id:UI.sel}}); }
  else if (k === 'n'){ if (!nextKey()) return; }
  else return;
  e.preventDefault();
});
document.addEventListener('error', e => { const t = e.target; if (t && t.tagName === 'IMG' && t.closest('.card,.big,.tokchip,.tgrid,.chip,.tokbtn,.dart,.sitem')) t.remove(); }, true);

/* ---------- Lobby ---------- */
function setFmt(f){ LOBBY.fmt = f; document.querySelectorAll('#fmtSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.fmt === f))); renderDeckSum(); }
function deckStatus(msg, cls=''){ const el = $('#deckStatus'); el.textContent = msg; el.className = 'status ' + cls; }
function renderDeckSum(){
  const el = $('#deckSum'); const d = LOBBY.deck;
  const ready = !!d && (d.main.length || d.cmd.length);
  ['#hostBtn','#soloBtn','#joinBtn'].forEach(s => $(s).disabled = !ready);
  if (!d){ el.hidden = true; return; }
  el.hidden = false;
  const total = deckCount(d);
  const cands = [...new Set([...d.cmd, ...d.main.filter(e => info(e.k)?.cc).map(e => e.k)])];
  const needCmd = FMT[LOBBY.fmt].cz;
  const target = LOBBY.fmt === 'std' ? 60 : 100;
  const pr = deckPrice(d);
  el.innerHTML = `
    <div class="row" style="flex-wrap:nowrap"><input type="text" id="deckNameIn" maxlength="60" placeholder="Name this deck" value="${esc(LOBBY.deckName)}" aria-label="Deck name"><button class="btn primary" type="button" data-act="saveDeck">${LOBBY.savedId ? 'Save changes' : 'Save deck'}</button></div>
    <div class="row" style="justify-content:space-between">
      <span class="hint"><b>${total}</b> cards${total !== target && LOBBY.fmt !== 'std' ? ` · Commander decks have ${target}` : ''}${pr.t ? ` · about <b>$${pr.t.toFixed(0)}</b> to buy${pr.miss ? ` (${pr.miss} with no price)` : ''}` : ''}</span>
      <span class="row"><button class="btn small" type="button" data-act="openDeck">Cards &amp; art</button><button class="btn small" type="button" data-act="checkDeck">Check rules text</button><button class="btn small" type="button" data-act="copyDeck">Copy list</button></span>
    </div>
    ${d.cmd.length ? `<div class="cmd-show">${d.cmd.map(k => info(k)?.img ? `<img src="${esc(info(k).img)}" alt="${esc(info(k).n)}">` : '').join('')}</div>` : ''}
    ${needCmd ? `<div><div class="label" style="margin-bottom:6px">${d.cmd.length ? 'Commander' : 'Pick your commander'} <span style="text-transform:none;letter-spacing:0">· tap to change</span></div>
      <div class="chips">${cands.length ? cands.map(k => { const a = info(k); return `<button type="button" class="chip" data-cmd="${esc(k)}" aria-pressed="${d.cmd.includes(k)}">${a.img ? `<img src="${esc(a.img)}" alt="">` : ''}${esc(a.n)}</button>`; }).join('') : '<span class="hint">No legendary creatures or planeswalkers found in this list.</span>'}</div></div>` : ''}
    ${d.missing.length ? `<div class="missing">Not found on Scryfall (left out): ${d.missing.map(esc).join(', ')}</div>` : ''}
    <p class="hint">Prices are Scryfall's US market prices for the printings shown, as a rough guide.</p>`;
}
function buildDeck(res){
  const d = {main:[], cmd:[], missing:res.missing};
  const fmtCmd = FMT[LOBBY.fmt].cz;
  const merge = (k, q) => { const e = d.main.find(x => x.k === k); if (e) e.q += q; else d.main.push({k, q}); };
  for (const c of res.cards){ if (c.section === 'skip') continue; if (c.section === 'cmd') { if (!d.cmd.includes(c.k)) d.cmd.push(c.k); } else merge(c.k, c.q); }
  const skipped = res.cards.filter(c => c.section === 'skip');
  // Moxfield's MTGO export puts the commander in the sideboard block
  if (!d.cmd.length && fmtCmd){
    const mainBlocks = [...new Set(res.cards.filter(c => c.section === 'main').map(c => c.block))];
    const lastBlock = mainBlocks[mainBlocks.length - 1];
    const tail = res.cards.filter(c => c.section === 'main' && c.block === lastBlock);
    if (mainBlocks.length > 1 && tail.length <= 2 && tail.every(c => info(c.k)?.cc)) tail.forEach(c => toCmd(d, c.k));
    else if (skipped.length && skipped.length <= 2 && skipped.every(c => info(c.k)?.cc)) skipped.forEach(c => { if (!d.cmd.includes(c.k)) d.cmd.push(c.k); });
  }
  return d;
}
function toCmd(d, k){ const e = d.main.find(x => x.k === k); if (e){ e.q--; if (e.q <= 0) d.main.splice(d.main.indexOf(e), 1); } if (!d.cmd.includes(k)) d.cmd.push(k); }
function fromCmd(d, k){ d.cmd = d.cmd.filter(x => x !== k); const e = d.main.find(x => x.k === k); if (e) e.q++; else d.main.push({k, q:1}); }
async function loadDeck(text){
  text = String(text||'').trim();
  if (!text){ deckStatus('Paste a Moxfield link or a decklist first.', 'err'); return; }
  $('#loadBtn').disabled = true;
  try {
    let entries, name = '';
    const url = text.match(/https?:\/\/(www\.)?moxfield\.com\/decks\/[A-Za-z0-9_-]+/i)?.[0];
    if (url && text.split(/\n/).filter(l => l.trim()).length <= 2){
      deckStatus('Reading the deck from Moxfield…');
      try { const r = await fetchMoxfield(url); entries = r.entries; name = r.name; }
      catch { deckStatus('Moxfield didn’t let this page read that link. On Moxfield open the deck, press Export → Copy for Moxfield, and paste the text here instead.', 'err'); return; }
    } else entries = parseList(text);
    if (!entries.length){ deckStatus('No cards found in that text. Each line should look like “1 Sol Ring”.', 'err'); return; }
    deckStatus('Looking up cards on Scryfall…');
    const res = await resolveDeck(entries, (a, b) => deckStatus(`Looking up cards on Scryfall… ${a} of ${b}`));
    LOBBY.deck = buildDeck(res); LOBBY.deckName = name; LOBBY.savedId = null;
    const tokIds = [...new Set([...LOBBY.deck.main.map(e => e.k), ...LOBBY.deck.cmd].flatMap(k => info(k)?.toks.map(t => t.id) || []))];
    if (tokIds.length){ deckStatus('Loading the tokens your deck makes…'); await ensureTokens(tokIds); }
    const total = LOBBY.deck.main.reduce((a, e) => a + e.q, 0) + LOBBY.deck.cmd.length;
    deckStatus(`Deck ready: ${total} cards${res.missing.length ? `, ${res.missing.length} not found` : ''}.`, res.missing.length ? '' : 'ok');
    store.set('pt.lastDeck', text.slice(0, 20000));
    renderDeckSum();
  } catch (e){
    console.warn(e); deckStatus('Could not reach Scryfall. Check your internet connection and try again. (' + (e.message || e) + ')', 'err');
  } finally { $('#loadBtn').disabled = false; }
}
function showLobby(){
  $('#game').hidden = true; $('#lobby').hidden = false; closeMenu(); closeModal();
  const r = $('#resume'); const sv = store.get('pt.save');
  if (S && NET.peer){ r.hidden = false; r.innerHTML = `<span>You're still seated at table <b class="sc">${esc(NET.code)}</b>. Load a new deck and sit down again to swap decks.</span><button class="btn primary" type="button" id="backBtn">Back to the table</button>`; }
  else if (!S && sv && sv.S){ r.hidden = false; r.innerHTML = `<span>Unfinished game${sv.net?.code ? ` at table <b class="sc">${esc(sv.net.code)}</b>` : ''}: ${esc(sv.S.deckName || 'your deck')}, ${sv.S.life} life.</span><span class="row"><button class="btn" type="button" id="dropSave">Discard</button><button class="btn primary" type="button" id="resumeBtn">Resume</button></span>`; }
  else r.hidden = true;
}
async function sitDown(mode){
  if (!LOBBY.deck) return;
  const nm = $('#nameIn').value.trim(); store.set('pt.name', nm);
  if (FMT[LOBBY.fmt].cz && !LOBBY.deck.cmd.length){ netStatus('Pick your commander first (step 1).', 'err'); return; }
  const prevNet = NET.peer && S;
  try {
    const want = cleanCode($('#codeIn').value);
    if (prevNet && mode !== 'solo' && (!want || want === NET.code)){ /* already seated at this table: keep it */ }
    else if (mode === 'host'){
      const code = cleanCode($('#codeIn').value) || newCode();
      netStatus('Opening table ' + code + '…'); $('#codeIn').value = code; await hostTable(code);
    } else if (mode === 'join'){
      const code = cleanCode($('#codeIn').value); if (!code){ netStatus('Type the table code your friend gave you.', 'err'); return; }
      netStatus('Joining ' + code + '…'); await joinTable(code);
    } else closeNet();
  } catch (e){ netStatus(e.message, 'err'); return; }
  netStatus('');
  const keepJ = S?.j, keepTurn = S?.turn;
  S = newState(); if (keepJ) S.j = keepJ; if (keepTurn && NET.peer) S.turn = keepTurn;
  draw7(); log(`sat down with ${S.deckName || (S.deck.cmd[0] ? info(S.deck.cmd[0])?.n : 'a deck')}`);
  enterGame();
}
function enterGame(){ $('#lobby').hidden = true; $('#game').hidden = false; commit(); publish(); }
async function resumeSaved(){
  const sv = store.get('pt.save'); if (!sv?.S) return;
  (sv.dict||[]).forEach(a => { if (a && a.k) DICT.set(a.k, a); });
  S = sv.S; S.recent = S.recent || []; if (!Array.isArray(S.turn)) S.turn = [0, '', 0]; if (S.turn.length < 3) S.turn[2] = 0;
  initEngineState(S, true);
  S.log.forEach(e => { LOGS.set(MYPID + '|' + e.t, {t:e.t, pid:MYPID, s:e.s, c:e.c}); lastLogT = Math.max(lastLogT, e.t); });
  enterGame();
  if (sv.net?.code){
    try { await joinTable(sv.net.code); toast('Back at table ' + sv.net.code); publish(); }
    catch (e){ toast(e.message + ' — playing solo for now.'); }
    renderNet(); queueRender();
  }
}
