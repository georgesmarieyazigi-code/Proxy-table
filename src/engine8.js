
/* ===================== Rules engine — round 8: mechanics of the most-played commanders ===================== */
// eminence / command-zone abilities, ninjutsu, "that many", sacrifice / becomes tapped / leave-graveyard triggers,
// trigger doubling (Panharmonicon, Teysa, Isshin), player counters (experience, energy, rad), discover, "exile until",
// graveyard permissions (Muldrotha, Crucible), token replacements (Chatterfang), +X/+X anthems that count, cost "for each",
// "enters with an additional counter" statics (Giada), blink / return to the battlefield, tap-N / sacrifice-X costs.

/* ---------- Top commanders list (EDHREC past 2 years top 100 + Duel Commander metagame, Oct 2026) ---------- */
const TOP_EDH = ["Y'shtola, Night's Blessed","Edgar Markov","The Ur-Dragon","Atraxa, Praetors' Voice","Krenko, Mob Boss","Vivi Ornitier","Sauron, the Dark Lord","Kaalia of the Vast","Teval, the Balanced Scale","Fire Lord Azula","Giada, Font of Hope","Pantlaza, Sun-Favored","Ms. Bumbleflower","Lathril, Blade of the Elves","Toph, the First Metalbender","The Wise Mothman","Jodah, the Unifier","Cloud, Ex-SOLDIER","Hearthhull, the Worldseed","Kefka, Court Mage","Nekusar, the Mindrazer","Sephiroth, Fabled SOLDIER","Kenrith, the Returned King","Yuriko, the Tiger's Shadow","Isshin, Two Heavens as One","Baylen, the Haymaker","Valgavoth, Harrower of Souls","Miirym, Sentinel Wyrm","Chatterfang, Squirrel General","Ulalek, Fused Atrocity","Hashaton, Scarab's Fist","Ashling, the Limitless","Frodo, Adventurous Hobbit","Sam, Loyal Attendant","Esika, God of the Tree","Bello, Bard of the Brambles","Muldrotha, the Gravetide","Hakbal of the Surging Soul","Rin and Seri, Inseparable","Glarb, Calamity's Augur","Animar, Soul of Elements","Maralen, Fae Ascendant","Arcades, the Strategist","Kuja, Genome Sorcerer","Aragorn, the Uniter","Mr. House, President and CEO","Ygra, Eater of All","Caesar, Legion's Emperor","Ureni of the Unwritten","Wilhelt, the Rotcleaver","Oloro, Ageless Ascetic","Flubs, the Fool","The Necrobloom","Breya, Etherium Shaper","Meren of Clan Nel Toth","Tidus, Yuna's Guardian","Kinnan, Bonder Prodigy","Teysa Karlov","Zhulodok, Void Gorger","Zurgo Stormrender","Atla Palani, Nest Tender","Korvold, Fae-Cursed King","Felothar the Steadfast","The Wandering Minstrel","Tom Bombadil","Gishath, Sun's Avatar","Avatar Aang","Arabella, Abandoned Doll","Shorikai, Genesis Engine","Queen Marchesa","Terra, Herald of Hope","Urza, Lord High Artificer","Betor, Ancestor's Voice","Choco, Seeker of Paradise","Helga, Skittish Seer","Go-Shintai of Life's Origin","Auntie Ool, Cursewretch","Kotis, the Fangkeeper","K'rrik, Son of Yawgmoth","Zaxara, the Exemplary","Terra, Magical Adept","Kilo, Apogee Mind","Sisay, Weatherlight Captain","The First Sliver","Xyris, the Writhing Storm","Ghyrson Starn, Kelermorph","Norman Osborn","Ragost, Deft Gastronaut","Eriette of the Charmed Apple","Hope Estheim","Henzie \"Toolbox\" Torre","Captain N'ghathrod","Urtet, Remnant of Memnarch","Omnath, Locus of Creation","High Perfect Morcant","Witherbloom, the Balancer","Voja, Jaws of the Conclave","Alela, Cunning Conqueror","Magda, Brazen Outlaw","Obeka, Splitter of Seconds","Marneus Calgar"];
const TOP_DUEL = ["Cloud, Midgar Mercenary","Aminatou, the Fateshifter","Aragorn, King of Gondor","Brigid, Clachan's Heart","Jace, Multiverse Architect","Satya, Aetherflux Genius","Light-Paws, Emperor's Voice","Glarb, Calamity's Augur","Tifa Lockhart","Aerid Konstrari","Bruse Tarl, Boorish Herder","Slimefoot and Squee","Dargo, the Shipwrecker","Yoshimaru, Ever Faithful","Phelia, Exuberant Shepherd","Kratos, God of War","Vraska, Soul of Stone","Brigone, Soldier of Meletis","Winter, Cynical Opportunist","Niv-Mizzet, Parun","Octavia, Living Thesis","Basim Ibn Ishaq","Azusa, Lost but Seeking","Vohar, Vodalian Desecrator","Malcolm, Alluring Scoundrel","Aang, Swift Savior","Hit-Monkey","Atraxa, Grand Unifier","Namor the Sub-Mariner","Sokka, Tenacious Tactician","Toph, Greatest Earthbender","Elminster","Nick Fury, Agent of S.H.I.E.L.D.","Fynn, the Fangbearer","Feldon, Ronom Excavator","Amalia Benavides Aguirre","Denzilore Fatehold","Goro-Goro and Satoru","The Scarab God","Fin Fang Foom","Thanos, the Mad Titan","Flamewar, Brash Veteran","Tivit, Seller of Secrets","Raph & Mikey, Troublemakers","Muxus, Goblin Grandee","Judith, Carnage Connoisseur","Yawgmoth, Thran Physician","Altaïr Ibn-La'Ahad","Urza, Lord Protector","Kellan, the Fae-Blooded","Ratchet, Field Medic","Acererak the Archlich","Captain Howler, Sea Scourge","Thrun, Breaker of Silence","Ellivere of the Wild Court","Rivaz of the Claw","Hidetsugu and Kairi","Ertai Resurrected","Emet-Selch, Unsundered","Silas Renn, Seeker Adept","Emry, Lurker of the Loch","Lier, Disciple of the Drowned","Krang, Master Mind","Plagon, Lord of the Beach","Teferi, Temporal Archmage","Katara, Waterbending Master","Wan Shi Tong, Librarian","Baral, Chief of Compliance","Grist, the Hunger Tide","Ikra Shidiqi, the Usurper","The Gitrog Monster","Reyhan, Last of the Abzan","Deadpool, Trading Card","Ellie, Vengeful Hunter","Juri, Master of the Revue","Kroxa, Titan of Death's Hunger","Leovold, Emissary of Trest","Tasigur, the Golden Fang","Ketramose, the New Dawn","Sythis, Harvest's Hand","Uharis, the Stormspinner","Quintorius, History Chaser","Celes, Rune Knight","Lumra, Bellow of the Woods","Magda, the Hoardmaster","Hei Bai, Forest Guardian","Tymna the Weaver","Thrasios, Triton Hero","Rograkh, Son of Rohgahh","Kraum, Ludevic's Opus","Najeela, the Blade-Blossom","Winota, Joiner of Forces","Esika, God of the Tree","Lord Windgrace","Chulane, Teller of Tales","Sheoldred, the Apocalypse","Tam, the Possibility","Tevesh Szat, Doom of Fools","Kenrith, the Returned King","Vial Smasher the Fierce"];
async function runTopCheck(){
  const names = [...new Set([...TOP_EDH, ...TOP_DUEL])];
  openModal({type:'check', title:'Looking up the top commanders on Scryfall…', done:0, total:names.length, rows:[]});
  try {
    const res = await resolveDeck(names.map(n => ({q:1, name:n, section:'main', block:0})), (a, b) => { if (UI.modal && UI.modal.type === 'check'){ UI.modal.title = `Looking up the top commanders on Scryfall… ${a} of ${b}`; renderModal(); } });
    const deck = {main:res.cards.map(c => ({k:c.k, q:1})), cmd:[], name:`Top ${names.length} commanders (EDHREC top 100 + Duel Commander meta)`};
    if (res.missing.length) deck.name += ` (${res.missing.length} names not found on Scryfall — listed at the end)`;
    const prev = LOBBY.deck; if (!prev) LOBBY.deck = deck;
    try { await runDeckCheck(deck, {all:true}); if (res.missing.length && UI.modal && UI.modal.report) UI.modal.report += `\n\nNot found on Scryfall: ${res.missing.join('; ')}`; } finally { if (!prev){ LOBBY.deck = null; renderDeckSum(); } }
  } catch (e){ console.warn(e); if (UI.modal) { UI.modal.title = 'Could not reach Scryfall (' + (e.message || e) + ')'; renderModal(); } }
}

/* ---------- Command zone abilities (eminence) ---------- */
const czCond = /^if ~ is in the command zone(?: or on the battlefield)?, /;
const bfOrCz = /^as long as ~ is in the command zone or on the battlefield, /;

/* ---------- Static rules added ---------- */
STATIC_RULES.push(
  [/^if (an artifact or creature|a creature|a permanent|a land|an artifact|a nontoken creature) (entering(?: the battlefield)?|dying|attacking) causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time$/, m => ({kind:'trigTwice', who:'you', desc:m[1].replace(/^an? /, ''), ev:{entering:'enter', 'entering the battlefield':'enter', dying:'die', attacking:'attack'}[m[2]]})],
  [/^during each of your turns, you may play a land and cast a permanent spell of each permanent type from your graveyard$/, m => ({kind:'gyMul', who:'you'})],
  [/^you may play lands from your graveyard$/, m => ({kind:'gyLand', who:'you'})],
  [/^(?:during each of your turns, )?you may cast (?:one )?(.+?) spells? from your graveyard(?: this turn)?$/, m => ({kind:'gyCast', who:'you', desc:sing(m[1])})],
  [/^if one or more tokens would be created under your control, those tokens plus that many (\d+)\/(\d+) (white|blue|black|red|green|colorless) ([a-z]+) creature tokens are created instead$/, m => ({kind:'tokPlus', who:'you', pt:`${m[1]}/${m[2]}`, col:{white:'W', blue:'U', black:'B', red:'R', green:'G', colorless:''}[m[3]], name:cap(m[4])})],
  [/^each opponent can't draw more than one card each turn$/, m => ({kind:'drawMax', who:'opp', n:1})],
  [/^you may play (an|one|two|three) additional lands? on each of your turns$/, m => ({kind:'extraLand', who:'you', n:wn(m[1]) || 1})],
);
STATIC_KNOWN.push(/^as long as ~ is in the command zone or on the battlefield, /, /gets? \+x\/\+x(?:,)? where x is/, /gets? \+\d+\/\+\d+ for each/, /enters? with an additional \+1\/\+1 counter/, /^~ can be your commander/, /^(partner|choose a background|friends forever|doctor's companion)/, /^(commander )?ninjutsu/, /less to cast for each/);

/* ---------- Counting: more phrases ---------- */
{
  const co = countOf;
  countOf = function(phrase, ctx){
    const p = String(phrase || '').toLowerCase().trim().replace(/\.$/, '').replace(/^the number of /, ''); let m;
    if ((m = p.match(/^(experience|energy|rad|ticket|poison) counters you have$/))) return m[1] === 'poison' ? (S.psn || 0) : ((S.pc || {})[m[1]] || 0);
    if ((m = p.match(/^(?:that creature's|its) (power|toughness)$/)) && ctx && ctx.it && ctx.it.evId){ const c = boardOf(ctx.it.evPid || MYPID).find(x => x.id === ctx.it.evId); const st = c && stats(c, ctx.it.evPid || MYPID); if (st) return Math.max(0, st[m[1] === 'power' ? 0 : 1]); }
    if (/^(?:that card's|the exiled card's|the revealed card's) mana value$/.test(p) && ctx && ctx.lastMV != null) return ctx.lastMV;
    if ((m = p.match(/^(?:that spell's|its) mana value$/)) && ctx && ctx.it && ctx.it.evk) return info(ctx.it.evk)?.mv || 0;
    if ((m = p.match(/^(.+?) counters? on ~$/)) && ctx){ const src = srcCardOf(ctx); if (src) return /\+1\/\+1/.test(m[1]) ? src.cp || 0 : /-1\/-1/.test(m[1]) ? src.cm || 0 : src.co || 0; }
    return co(phrase, ctx);
  };
}

/* ---------- Anthems that count (+X/+X, +1/+1 for each) ---------- */
const XANTH = new Map();
function xAnthemRules(k, fl){
  const key = k + (fl ? '|b' : ''); if (XANTH.has(key)) return XANTH.get(key);
  const a = info(k); const f = a ? (fl && a.back ? a.back : a) : null; const out = [];
  if (f) for (const sen of tname(f.o, f.n).toLowerCase().split(/\.\s*|\n/)){
    const x = sen.trim(); let m;
    if ((m = x.match(/^(other )?(.+?) gets? \+x\/\+x,? where x is (.+)$/))) out.push({other:!!m[1], desc:m[2], p:1, t:1, count:m[3]});
    else if ((m = x.match(/^(other )?(.+?) gets? \+(\d+)\/\+(\d+) for each (.+)$/))) out.push({other:!!m[1], desc:m[2], p:+m[3], t:+m[4], count:m[5]});
  }
  XANTH.set(key, out); return out;
}
function xAnthems(c, ownerPid){
  let dp = 0, dt = 0;
  for (const b of boardsAll()) for (const s of b.bf){
    if (!s.k || s.fd) continue;
    for (const r of xAnthemRules(s.k, s.fl)){
      let desc = r.desc; const self = /^(~|this creature|it)$/.test(desc);
      if (self){ if (s.id !== c.id || b.pid !== ownerPid) continue; }
      else {
        if (/ you control$/.test(desc)){ if (b.pid !== ownerPid) continue; desc = desc.replace(/ you control$/, ''); }
        if (r.other && b.pid === ownerPid && s.id === c.id) continue;
        if (!descOk(c.k, sing(desc), {tok:c.tok, face:faceOf(c)})) continue;
      }
      const n = b.pid === MYPID ? countOf(r.count, {card:s, srcId:s.id}) : null;
      if (n == null) continue; dp += r.p * n; dt += r.t * n;
    }
  }
  return [dp, dt];
}

/* ---------- Player counters ---------- */
function addPC(kind, n){ S.pc = S.pc || {}; S.pc[kind] = Math.max(0, (S.pc[kind] || 0) + n); log(`${n >= 0 ? 'got' : 'paid'} ${Math.abs(n)} ${kind} counter${Math.abs(n) === 1 ? '' : 's'} (${S.pc[kind]} now)`); commit(); }
{
  const pac = payAbilityCost;
  payAbilityCost = async function(c, cost, o){
    const e = (String(cost).match(/\{E\}/gi) || []).length;
    if (e){ if (((S.pc || {}).energy || 0) < e){ toast(`You need ${e} energy`); return false; } cost = String(cost).replace(/\{E\}/gi, '').replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ','); }
    const ok = await pac(c, cost, o); if (ok && e) addPC('energy', -e); return ok;
  };
  const pp = payPart;
  payPart = async function(p, c){
    const l = p.toLowerCase(); let m;
    if ((m = l.match(/^tap (an?|one|two|three|four|five|six|seven|eight|nine|ten|x|\d+) untapped (.+?) you control$/)) && !/^an?$/.test(m[1])){
      let n = wn(m[1]); if (m[1] === 'x') n = await askNumber(`${cname(c)}: tap how many?`, '', 1); if (n == null) return false;
      const list = S.bf.filter(b => !b.fd && !b.tap && b.id !== c.id && descOk(b.k, sing(m[2]), {tok:b.tok}));
      if (list.length < n){ toast(`You need ${n} untapped ${m[2]}`); return false; }
      const ids = list.length === n ? list.map(b => b.id) : await pickCards({title:`Tap ${n} untapped ${m[2]}`, cards:list, min:n, max:n}); if (!ids) return false;
      ids.forEach(id => { const b = find(id)[2]; if (b) b.tap = true; }); return true;
    }
    if ((m = l.match(/^sacrifice x (.+)$/))){
      const list = S.bf.filter(b => !b.fd && descOk(b.k, sing(m[1]), {tok:b.tok}));
      const n = await askNumber(`${cname(c)}: sacrifice how many ${m[1]}? (X)`, `You have ${list.reduce((a, b) => a + (b.n || 1), 0)}`, 1); if (n == null) return false;
      let left = n; for (const b of list){ while (left > 0 && find(b.id)[0] === 'bf'){ sacrificeOne(b); left--; if ((b.n || 1) <= 0) break; } }
      if (left > 0){ toast(`Not enough ${m[1]}`); return false; }
      UI.lastX = n; return true;
    }
    if ((m = l.match(/^pay ((?:\{e\})+)$/))){ const e = m[1].length / 3; if (((S.pc || {}).energy || 0) < e){ toast(`You need ${e} energy`); return false; } addPC('energy', -e); return true; }
    return pp(p, c);
  };
}

/* ---------- Graveyard permissions ---------- */
const PERM_TYPES = ['Artifact', 'Creature', 'Enchantment', 'Land', 'Planeswalker', 'Battle'];
function mulTypesLeft(){ const t = turnStr(); if (!S.mul || S.mul.t !== t) S.mul = {t, used:[]}; return PERM_TYPES.filter(x => !S.mul.used.includes(x)); }
{
  const go = gyOptions;
  gyOptions = function(c){
    const out = go(c); const a = info(c.k); if (!a || !S) return out;
    const pn = phaseNow(); const types = PERM_TYPES.filter(t => new RegExp('\\b' + t + '\\b').test(a.t));
    const mul = rulesOn('gyMul')[0];
    if (isLand(c.k) && (rulesOn('gyLand').length || (mul && pn.mine && mulTypesLeft().includes('Land')))) out.push({kind:'gyland', label:`Play land from graveyard${mul && !rulesOn('gyLand').length ? ' (' + mul.src + ')' : ''}`, land:true, mulT:'Land'});
    if (!isLand(c.k) && mul && pn.mine){ const left = types.filter(t => t !== 'Land' && mulTypesLeft().includes(t)); if (left.length) out.push({kind:'mul', label:`Cast from graveyard (${mul.src}) ${a.m}`, mana:a.m, extra:[], after:'', mulT:left[0]}); }
    for (const r of rulesOn('gyCast')) if (!isLand(c.k) && descOk(c.k, r.desc)) out.push({kind:'gycast', label:`Cast from graveyard (${r.src}) ${a.m}`, mana:a.m, extra:[], after:''});
    return out;
  };
  const cg = castFromGy;
  castFromGy = async function(c, g){
    if (g && g.land){ playLand(c); if (find(c.id)[0] === 'bf' && g.mulT){ mulTypesLeft(); S.mul.used.push('Land'); } return; }
    await cg(c, g);
    if (g && g.mulT && find(c.id)[0] !== 'gy'){ mulTypesLeft(); S.mul.used.push(g.mulT); }
  };
}

/* ---------- Token replacement (Chatterfang) ---------- */
{
  const ct = createToken;
  createToken = function(k, n, near, o){
    const r = ct(k, n, near, o);
    if (!UI.inTokPlus && S && n > 0 && !UI.dry){
      const rules = rulesOn('tokPlus');
      if (rules.length){ UI.inTokPlus = true; try { rules.forEach(rr => ct(customToken(rr.name, rr.pt, rr.col), n, near, {})); log(`${rules.map(x => x.src).join(', ')}: plus ${n} ${rules[0].name} token${n === 1 ? '' : 's'}`); } finally { UI.inTokPlus = false; } }
    }
    return r;
  };
}

/* ---------- "Enters with an additional +1/+1 counter" statics (Giada, Metallic Mimic-style) ---------- */
{
  const oe = onEnter;
  onEnter = function(c, from, o = {}){
    const r = oe(c, from, o);
    if (from === 'bf' || c.fd || !S.bf.includes(c)) return r;
    for (const s of S.bf){
      if (s === c || s.fd || !s.k) continue; const f = faceOf(s); if (!f) continue;
      for (const sen of tname(f.o, f.n).toLowerCase().split(/\.\s*|\n/)){
        const m = sen.trim().match(/^(each other |each |other )?(.+?) you control enters? with an additional \+1\/\+1 counter on it(?: for each (.+?) you already control)?$/); if (!m) continue;
        if (!descOk(c.k, sing(m[2]), {tok:c.tok})) continue;
        const n = m[3] ? S.bf.filter(b => b !== c && !b.fd && descOk(b.k, sing(m[3]), {tok:b.tok})).reduce((a, b) => a + (b.n || 1), 0) : 1;
        if (n > 0){ modCounters(c, 'cp', n); log(`${cname(c)} enters with ${n} extra +1/+1 counter${n === 1 ? '' : 's'} (${f.n})`); }
      }
    }
    return r;
  };
}

/* ---------- Ninjutsu ---------- */
function ninjutsuOf(c){ const m = (info(c.k)?.o || '').match(/^(Commander )?ninjutsu ((?:\{[^}]+\})+)/mi); return m ? {cmd:!!m[1], cost:m[2]} : null; }
function unblockedAttackers(){ const bl = blockersFor(); return S.bf.filter(c => c.atk && !(bl.get(c.id) || []).length); }
function ninjutsuWindow(){ const pn = phaseNow(); return pn.mine && pn.ph === 4 && S.cb && ['blkd', 'fs'].includes(S.cb.step); }
async function doNinjutsu(c, zone){
  const nj = ninjutsuOf(c); if (!nj) return;
  if (!ninjutsuWindow()){ toast('Ninjutsu only after blockers are declared, before damage'); return; }
  const un = unblockedAttackers(); if (!un.length){ toast('You have no unblocked attacker to return'); return; }
  const plan = payPlan(parseCost(nj.cost), S.pool); if (plan.err){ toast(`Ninjutsu costs ${nj.cost}: ${plan.err}`); return; }
  const aid = un.length === 1 ? un[0].id : await askChoice({title:`${cname(c)}: return which unblocked attacker?`, options:un.map(a => ({label:cname(a), value:a.id}))});
  const a = S.bf.find(x => x.id === aid); if (!a) return;
  S.pool = plan.pool; const def = a.atk;
  a.atk = ''; moveCard(a.id, 'hand', {quiet:true, manual:true});
  moveCard(c.id, 'bf', {quiet:true}); const n = S.bf.find(x => x.id === c.id);
  if (n){ n.tap = true; n.atk = def; n.sk = false; }
  log(`ninjutsu: returned ${cname(a)} and put ${cname(c)} onto the battlefield tapped and attacking ${defLabel(def)}`); commit();
}

/* ---------- Discover and "exile until" ---------- */
async function revealUntil(test, label){
  const seen = []; let hit = null;
  while (S.lib.length){ const c = S.lib.shift(); seen.push(c); if (test(c)){ hit = c; break; } }
  S.ex.push(...seen); log(`${label}: exiled ${seen.map(cname).join(', ') || 'nothing'}`);
  return {hit, rest:seen.filter(c => c !== hit)};
}
function bottomRandom(cards){ const rest = cards.filter(c => S.ex.includes(c)); rest.forEach(c => S.ex.splice(S.ex.indexOf(c), 1)); shuffle(rest); S.lib.push(...rest); if (rest.length) log(`put ${rest.length} card${rest.length === 1 ? '' : 's'} on the bottom in a random order`); commit(); }
async function discover(n, ctx){
  const {hit, rest} = await revealUntil(c => !isLand(c.k) && (info(c.k)?.mv || 0) <= n, `discover ${n}`);
  let cast = false;
  if (hit){
    const v = await askChoice({title:`Discover ${n}: ${cname(hit)}`, options:[{label:'Cast it without paying its mana cost', value:'cast'}, {label:'Put it into your hand', value:'hand'}]});
    if (v === 'cast') cast = true; else { S.ex.splice(S.ex.indexOf(hit), 1); S.hand.push(hit); log(`put ${cname(hit)} into their hand (discover)`); }
  }
  bottomRandom(rest);
  if (cast) await beginCast(hit, 'ex', {free:true});
}

/* ---------- Effects text ---------- */
async function doRound8Pre(s, l, ctx){
  let m;
  if ((m = l.match(czCond))){ const z = ctx.srcId != null ? find(ctx.srcId)[0] : null; if (z === 'cz' || (/battlefield/.test(m[0]) && z === 'bf') || z == null){ await doSentence(cap(s.slice(m[0].length)), ctx); } else log(`${ctx.name}: not in the command zone — nothing happens`); return true; }
  if (/\bthat many\b/.test(l) && ctx.it && ctx.it.evN){
    const n = ctx.it.evN; let t = s;
    if ((m = l.match(/^reveal that many cards from the top of your library$/))){ const full = tname(String(ctx.full || ''), ctx.name || '').toLowerCase(); const i = full.indexOf('reveal that many cards from the top of your library'); ctx.digRestTxt = i >= 0 ? full.slice(i + 52).replace(/^[.,]\s*/, '').split('\n')[0] : ''; t = `Reveal the top ${n} cards of your library`; }
    else t = s.replace(/\bthat many\b/i, String(n));
    await doSentence(cap(t), ctx); ctx.digRestTxt = null; return true;
  }
  if ((m = l.match(/^you get (an?|one|two|three|four|five|\d+) (experience|energy|rad|ticket) counters?$/))){ addPC(m[2], wn(m[1]) || 1); return true; }
  if ((m = l.match(/^you get ((?:\{e\})+)$/))){ addPC('energy', m[1].length / 3); return true; }
  if ((m = l.match(/^discover (\d+|x)(?:, where x is .+)?$/))){ const n = m[1] === 'x' ? await numOf('x', ctx, 'discover') : +m[1]; await discover(n, ctx); return true; }
  if (/^do this only once each turn$/.test(l) || /^activate (?:only|this ability only)\b/.test(l)) return true;
  if ((m = l.match(/^have its controller (create .+)$/))){ if (!ctx.it || !ctx.it.evPid || ctx.it.evPid === MYPID || UI.dry) await doSentence(cap(s.slice(s.toLowerCase().indexOf(m[1]))), ctx); else handWarn(`${nameOf(ctx.it.evPid)} creates: ${m[1]}`, ctx); return true; }
  if ((m = l.match(/^(.+?) loses life equal to (that card's|the exiled card's|the revealed card's) mana value$/)) && ctx.lastMV != null){ await doSentence(cap(`${s.slice(0, m[1].length)} loses ${ctx.lastMV} life`), ctx); return true; }
  if (/^reveal the top card of your library$/.test(l)){ const c = S.lib[0]; if (c){ ctx.lastRev = c; ctx.lastMV = info(c.k)?.mv || 0; log(`revealed ${cname(c)} from the top of their library`); } return true; }
  if (/^(?:put|return) (?:that card|it|the revealed card) (?:into your hand|to your hand|to its owner's hand)$/.test(l) && (ctx.lastRev || (ctx.lastT && ctx.lastT.length))){
    if (ctx.lastRev){ const i = S.lib.indexOf(ctx.lastRev); if (i >= 0){ S.hand.push(S.lib.splice(i, 1)[0]); log(`put ${cname(ctx.lastRev)} into their hand`); } ctx.lastRev = null; }
    else ctx.lastT.forEach(t => { if (t.pid === MYPID){ const [z] = find(t.id); if (z && z !== 'hand' && z !== 'bf') moveCard(t.id, 'hand'); else if (z === 'bf') moveCard(t.id, 'hand'); } });
    commit(); return true;
  }
  if ((m = l.match(/^discard (a|an|one|two|three) cards?$/))){ const n = Math.min(wn(m[1]) || 1, S.hand.length); if (!n) return true; const ids = S.hand.length === n ? S.hand.map(c => c.id) : await pickCards({title:`${ctx.name}: discard ${n === 1 ? 'a card' : n + ' cards'}`, cards:S.hand.slice(), min:n, max:n}); (ids || []).forEach(id => moveCard(id, 'gy')); commit(); return true; }
  if (/^exile the top card$/.test(l)) { await doSentence('Exile the top card of your library', ctx); return true; }
  if ((m = l.match(/^(?:until end of turn, )?you may (play|cast) (that card|it|them|those cards)(?: this turn)? without paying (?:its|their) mana costs?(?: this turn)?$/)) && ctx.lastEx && ctx.lastEx.length){ grantPlay(ctx.lastEx, {cast:m[1] === 'cast', src:ctx.name, free:true}); return true; }
  if ((m = l.match(/^choose target (.+?) card in your graveyard$/))){
    const d = sing(m[1]); const list = S.gy.filter(c => descOk(c.k, d)); if (!list.length){ log(`${ctx.name}: no ${m[1]} card in the graveyard`); ctx.lastT = []; return true; }
    const ids = list.length === 1 ? [list[0].id] : await pickCards({title:`${ctx.name}: choose a ${m[1]} card in your graveyard`, cards:list, min:1, max:1});
    const c = ids && find(ids[0])[2]; ctx.lastT = c ? [{t:'card', pid:MYPID, id:c.id, k:c.k, nm:cname(c)}] : []; ctx.lastMV = c ? info(c.k)?.mv || 0 : null; return true;
  }
  if ((m = l.match(/^if that card's mana value is (less than or equal to|greater than or equal to|less than|greater than) (.+?), (.+)$/))){
    const n = countOf(m[2], ctx); const mv = ctx.lastMV ?? 0; const ok = n == null ? await askYes(`${ctx.name}: is ${mv} ${m[1]} ${m[2]}?`) : ({'less than or equal to':mv <= n, 'greater than or equal to':mv >= n, 'less than':mv < n, 'greater than':mv > n}[m[1]]);
    ctx.condResult = !!ok; if (ok) await doSentence(cap(s.slice(s.length - m[3].length)), ctx); return true;
  }
  if ((m = l.match(/^otherwise, (.+)$/))){ if (ctx.condResult === false) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); ctx.condResult = null; return true; }
  if ((m = l.match(/^if you do, (.+)$/))){ if (ctx.mayYes !== false && ctx.didPay !== false) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true; }
  if ((m = l.match(/^if you don't, (.+)$/))){ if (ctx.mayYes === false || ctx.didPay === false) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true; }
  if ((m = l.match(/^pay ((?:\{[^}]+\})+)$/))){ const plan = payPlan(parseCost(m[1]), S.pool); if (plan.err){ ctx.didPay = false; toast(`${ctx.name}: couldn't pay ${m[1]} (${plan.err}) — tap mana first`); log(`couldn't pay ${m[1]}`); } else { S.pool = plan.pool; ctx.didPay = true; log(`paid ${m[1]}`); commit(); } return true; }
  if ((m = l.match(/^(?:you )?pay (\d+) life$/))){ S.life -= +m[1]; ctx.didPay = true; log(`paid ${m[1]} life`); commit(); return true; }
  if ((m = l.match(/^sacrifice (another|an?|one|two|three) (.+)$/))){ const c = srcCardOf(ctx) || {id:-1}; const ok = await payPart(`sacrifice ${m[1]} ${sing(m[2])}`, c); ctx.didPay = ok; if (!ok) log(`${ctx.name}: nothing to sacrifice`); return true; }
  if ((m = l.match(/^put (an?|one|two|three|\d+) (\+1\/\+1|-1\/-1) counters? on each (other )?(.+?)( you control)?$/))){
    const n = wn(m[1]) || 1; const kind = m[2] === '+1/+1' ? 'cp' : 'cm'; const src = srcCardOf(ctx); const d = sing(m[4]);
    for (const b of boardsAll()){ if (!m[5] && b.pid !== MYPID && !/^creature$/.test(d)) continue; if (m[5] && b.pid !== MYPID) continue;
      b.bf.forEach(c => { if (!c.k || c.fd || (m[3] && src && c.id === src.id) || !descOk(c.k, d, {tok:c.tok})) return; if (b.pid === MYPID) modCounters(c, kind, n); else applyTo({t:'card', pid:b.pid, id:c.id}, {op:'ctr', n, src:ctx.name, d:kind}); }); }
    log(`${ctx.name}: ${n} ${m[2]} counter${n === 1 ? '' : 's'} on each ${m[4]}`); commit(); return true;
  }
  if ((m = l.match(/^(all creatures|creatures you control|each creature you control|other creatures you control|attacking creatures you control|they) gains? (.+?) until end of turn$/))){
    const kws = m[2].split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim()).filter(Boolean); const src = srcCardOf(ctx);
    const mine = c => isCreatureCard(c) && !c.fd && (m[1] !== 'they' || c.atk) && !(m[1].startsWith('other') && src && c.id === src.id);
    S.bf.filter(mine).forEach(c => { c.ekw = [...new Set([...(c.ekw || []), ...kws])]; });
    if (m[1] === 'all creatures') for (const [pid, st] of OPP) (st.bf || []).forEach(c => { if (c.k && isCreatureCard(c)) applyTo({t:'card', pid, id:c.id}, {op:'pump', src:ctx.name, f:{p:0, t:0, kw:kws}}); });
    log(`${ctx.name}: ${m[1]} gain ${kws.join(', ')} until end of turn`); commit(); return true;
  }
  if ((m = l.match(/^target player gains (\d+) life$/))){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; const pid = t ? t.pid : MYPID; if (pid === MYPID){ if (gainLife(+m[1], ctx.name)) log(`gained ${m[1]} life`); } else sendRq(pid, 'life', +m[1], ctx.name); commit(); return true; }
  if ((m = l.match(/^(?:put|return) target (.+?) card from (?:a|any) graveyard (?:onto|to) the battlefield under (?:its owner's|your) control$/))){
    const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (!t){ log(`${ctx.name}: no target`); return true; }
    if (t.pid === MYPID){ moveCard(t.id, 'bf'); } else if (/its owner's/.test(l)) sendRq(t.pid, 'gyToBf', 0, ctx.name, {d:t.k}); else handWarn(`Take ${info(t.k)?.n} from ${nameOf(t.pid)}'s graveyard onto your battlefield`, ctx);
    commit(); return true;
  }
  if ((m = l.match(/^exile another target (.+?) you own$/))){ await doSentence(`Exile target ${m[1]}`, ctx); return true; }
  if ((m = l.match(/^(put (?:an?|one|two|\d+) .+? counters? on ~|you gain \d+ life|draw a card|draw two cards|scry \d+|create .+? tokens?) and (draw a card|draw two cards|you gain \d+ life|each opponent loses \d+ life|scry \d+|create .+? tokens?|put .+? counters? on ~)$/))){ await doSentence(cap(s.slice(0, m[1].length)), ctx); await doSentence(cap(s.slice(s.length - m[2].length)), ctx); return true; }
  if (/[+-]x\/[+-]x/.test(l) && ctx.it && ctx.it.x != null && ctx.it.x !== ""){ /* X = 0 is a real value (v21) */ await doSentence(s.replace(/([+-])X\/([+-])X/i, `$1${ctx.it.x}/$2${ctx.it.x}`), ctx); return true; }
  if ((m = l.match(/^if an opponent is the monarch, /))){ const h = holderOf('mon'); if (h && h !== MYPID) await doSentence(cap(s.slice(m[0].length)), ctx); else log(`${ctx.name}: no opponent is the monarch`); return true; }
  if ((m = l.match(/^if you're the monarch, /))){ if (holderOf('mon') === MYPID) await doSentence(cap(s.slice(m[0].length)), ctx); return true; }
  if ((m = l.match(/^they (lose|discard|draw|mill|sacrifice)s? (.+)$/)) && ctx.it && (ctx.it.evDp || ctx.it.evPid)){ await doSentence(`That player ${m[1]}s ${s.slice(s.toLowerCase().indexOf(m[2]))}`, ctx); return true; }
  if ((m = l.match(/^put (a|an|one|two|three) cards? from your hand on top of your library(?: in any order)?$/))){
    const n = Math.min(wn(m[1]) || 1, S.hand.length); if (!n) return true;
    const ids = await pickCards({title:`${ctx.name}: put ${n === 1 ? 'a card' : n + ' cards'} from your hand on top of your library`, hint:n > 1 ? 'Click them in order: the first goes on top.' : '', cards:S.hand.slice(), min:n, max:n});
    (ids || S.hand.slice(0, n).map(c => c.id)).slice().reverse().forEach(id => { const i = S.hand.findIndex(c => c.id === id); if (i >= 0) S.lib.unshift(S.hand.splice(i, 1)[0]); });
    log(`put ${n === 1 ? 'a card' : n + ' cards'} from their hand on top of their library`); commit(); return true;
  }
  if ((m = l.match(/^(?:you may )?put (?:a|an|up to one) (.+?) card from your hand onto the battlefield( tapped)?$/))){
    const d = sing(m[1]); const list = S.hand.filter(c => !d || /^permanent$/.test(d) ? isPermType(info(c.k)?.t) : descOk(c.k, d));
    if (!list.length){ log(`${ctx.name}: no ${m[1]} card in hand`); return true; }
    const ids = await pickCards({title:`${ctx.name}: put a ${m[1]} card from your hand onto the battlefield`, cards:list, min:0, max:1, noneLabel:'None'});
    if (ids && ids.length){ moveCard(ids[0], 'bf'); const c = S.bf.find(x => x.id === ids[0]); if (c && m[2]) c.tap = true; }
    commit(); return true;
  }
  if (/^create\b/.test(l) && /,? (?:that's|that are|which are)? ?tapped and attacking(?: that player| that player or planeswalker| that opponent| defending player)?/.test(l)){
    const before = new Map(S.bf.map(c => [c.id, c.n || 1]));
    await doSentence(cap(s.replace(/,? (?:that's|that are|which are)? ?tapped and attacking(?: that player or planeswalker| that player| that opponent| defending player)?/i, '')), ctx);
    const def = attackDefFor(ctx);
    S.bf.forEach(c => { if (c.tok && !before.has(c.id)){ c.tap = true; c.sk = false; if (def && phaseNow().ph === 4) c.atk = def; } });
    commit(); return true;
  }
  if ((m = l.match(/^exile cards from the top of your library until you exile an? (.+?) card(?: with (lesser mana value|mana value (\d+|x) or less|mana value less than (.+?)))?$/))){
    const desc = m[1]; let max = 99;
    if (m[2] === 'lesser mana value') max = (ctx.it && ctx.it.evk ? info(ctx.it.evk)?.mv : info(ctx.k)?.mv || 0) - 1;
    else if (m[3]) max = m[3] === 'x' ? await numOf('x', ctx, 'mana value') : +m[3];
    const {hit, rest} = await revealUntil(c => descOk(c.k, desc) && (info(c.k)?.mv || 0) <= max, ctx.name);
    ctx.lastEx = hit ? [hit.id] : []; ctx.untilRest = rest; ctx.untilHit = hit; return true;
  }
  if (/^(?:then )?cast (?:that card|it|the exiled card|that spell) without paying its mana cost$/.test(l) && ctx.untilHit){ const h = ctx.untilHit; ctx.untilHit = null; if (find(h.id)[0] === 'ex'){ UI.afterCast = () => {}; await beginCast(h, 'ex', {free:true}); } return true; }
  if (/^put the rest on the bottom of your library in (a random|any) order$/.test(l) && ctx.untilRest){ const left = ctx.untilRest.concat(ctx.untilHit && find(ctx.untilHit.id)[0] === 'ex' ? [ctx.untilHit] : []); ctx.untilRest = null; bottomRandom(left); return true; }
  if ((m = l.match(/^put (?:that card|it) into your hand$/)) && ctx.untilHit){ const h = ctx.untilHit; ctx.untilHit = null; const i = S.ex.indexOf(h); if (i >= 0){ S.ex.splice(i, 1); S.hand.push(h); log(`put ${cname(h)} into their hand`); } return true; }
  // blink and returns
  if ((m = l.match(/^return (it|that card|them|those cards|the exiled cards?|that creature) to the battlefield(?: tapped)?(?: under (?:its|their) owners?'s? control| under your control)?( at the beginning of the next end step)?$/))){
    const tapped = /tapped/.test(l);
    const targets = (ctx.lastT && ctx.lastT.length) ? ctx.lastT : ctx.srcId != null ? [{t:'card', pid:ctx.it && ctx.it.rpid || MYPID, id:ctx.srcId}] : [];
    if (m[2]){ targets.forEach(t => S.dly.push({id:rid(6), eff:`Return it to the battlefield${tapped ? ' tapped' : ''}.`, k:ctx.k, nm:ctx.name, srcId:t.id, rpid:t.pid})); log(`${ctx.name}: returns at the beginning of the next end step`); commit(); return true; }
    for (const t of targets){
      if (t.pid === MYPID){ const [z] = find(t.id); if (z === 'ex' || z === 'gy'){ moveCard(t.id, 'bf'); const c = S.bf.find(x => x.id === t.id); if (c && tapped) c.tap = true; } }
      else sendRq(t.pid, 'returnBf', tapped ? 1 : 0, ctx.name, {tid:t.id});
    }
    commit(); return true;
  }
  return false;
}
RQ_OPS.push('returnBf', 'gyToBf');
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'gyToBf'){ const c = S.gy.find(x => x.k === r.d); if (c){ moveCard(c.id, 'bf'); log(`${cname(c)} returned from the graveyard to the battlefield (${r.src})`); commit(); } return; }
    if (r.op === 'returnBf'){ const [z] = find(r.tid); if (z === 'ex' || z === 'gy'){ moveCard(r.tid, 'bf'); const c = S.bf.find(x => x.id === r.tid); if (c && r.n) c.tap = true; log(`${c ? cname(c) : 'a card'} returned to the battlefield (${r.src})`); commit(); } return; }
    return ao(r, from);
  };
}

/* ---------- Triggers: once per turn, extra triggers ---------- */
function trigMult(ev, src){
  if (!ev || !S) return 1; let n = 1;
  for (const r of rulesOn('trigTwice')) if (r.ev === ev.type && (!r.desc || r.desc === 'permanent' || descOk(ev.k, r.desc, {tok:ev.tok}))) n++;
  return n;
}
{
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    if (/do this only once each turn/i.test(t.eff)){ const key = src.id + '|' + t.raw; S.once = S.once || {}; if (S.once[key] === turnStr()) return; S.once[key] = turnStr(); }
    pt(src, t, ev, evPid);
    const it = S.stk[S.stk.length - 1]; if (it && ev){ it.evN = ev.amt || null; }
  };
}

/* ---------- Event tracking: becomes tapped, sacrifice, leaving the graveyard ---------- */
function r8Tick(){
  if (!S || UI.dry) return;
  const now = new Set(S.bf.filter(c => c.tap || (c.tn || 0) > 0).map(c => c.id));
  const was = UI.tapSeen; UI.tapSeen = now;
  if (!was) return;
  for (const c of S.bf) if (now.has(c.id) && !was.has(c.id)) emit({type:'tapped', k:c.k, id:c.id, tok:c.tok ? 1 : 0});
}

/* ---------- Menus ---------- */
function r8HandItems(c, zone){
  const nj = ninjutsuOf(c); if (!nj || (zone === 'cz' && !nj.cmd) || (zone !== 'hand' && zone !== 'cz')) return '';
  return `<button type="button" data-act="ninjutsu" data-id="${c.id}" ${ninjutsuWindow() && unblockedAttackers().length ? '' : 'disabled'}><span>${nj.cmd ? 'Commander ninjutsu' : 'Ninjutsu'} ${manaHTML(nj.cost)}${ninjutsuWindow() ? '' : '<small class="why">after blockers are declared, with an unblocked attacker</small>'}</span></button>`;
}
function r8Chips(){
  const pc = S && S.pc || {}; return Object.entries(pc).filter(([, v]) => v > 0).map(([k, v]) => `<span class="chip3">${{experience:'✦', energy:'⚡', rad:'☢', ticket:'🎟'}[k] || '•'} ${v} ${esc(k)}</span>`).join('');
}
Object.assign(ACT, {
  ninjutsu(el){ const [z,,c] = find(+el.dataset.id); closeMenu(); if (c) doNinjutsu(c, z); },
  topCheck(){ runTopCheck(); },
});

function attackDefFor(ctx){
  if (ctx && ctx.it && ctx.it.evDp) return 'p:' + ctx.it.evDp;
  const src = ctx && srcCardOf(ctx); if (src && src.atk) return src.atk;
  const a = S.bf.find(c => c.atk); if (a) return a.atk;
  const o = opponents()[0]; return o ? 'p:' + o.pid : '';
}
