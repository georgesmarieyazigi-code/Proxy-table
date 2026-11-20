/* ===================== cardroles.js — what a card is for (bots, stage 1) =====================
   cardRoles(k) reads a card's Oracle text and type line once (cached) and returns
     {k, n, mv, roles:Set, land, creature, pw, instant, perm, pow, tou, kw:Set, value, er, colors, produces:Set}
   roles: land, ramp, draw, removal, wipe, counter, tutor, protect, pump, combo, burn, threat, token, aura, equipment, wincon.
   value (0..1) is a prior for "how good is this card": EDHREC rank when the card data has it (info(k).er, kept from Scryfall's
   edhrec_rank by the infoFrom/cleanInfo wrappers below), otherwise a heuristic from roles, mana value and stats.
   Stage 2 extends ROLE_RULES (push [role, test]) and may wrap cardValue / permValue. Nothing here reads hidden state:
   it only looks at card keys the caller passes in. */
const ROLE_CACHE = new Map();
const BOT_KWS = ['flying', 'trample', 'deathtouch', 'lifelink', 'menace', 'haste', 'vigilance', 'first strike', 'double strike', 'hexproof', 'indestructible', 'reach', 'defender', 'shroud', 'ward', 'infect', 'unblockable'];
// [role, test(o = lower-case rules text with the card's own name as ~, t = lower-case type line, a = info)]
const ROLE_RULES = [
  ['land', (o, t) => /\bland\b/.test(t) && !/\bcreature\b/.test(t)],
  ['ramp', (o, t) => (!/\bland\b/.test(t) && /(^|\n)[^\n:"]*\{t\}[^\n:"]*:\s*add\b/.test(o))
    || /search your library for (?:up to (?:one|two|three) |a |an |two )?(?:basic )?(?:land|forest|plains|island|swamp|mountain|basic)[^.]*?onto the battlefield/.test(o)
    || /put (?:a|up to \w+) land cards? from your hand onto the battlefield/.test(o) || /\bcreate (?:a|one|two|three|x|\w+) (?:tapped )?treasure/.test(o)
    || /you may play (?:an|two) additional lands?/.test(o) || /^add \{/m.test(o) && /\b(instant|sorcery)\b/.test(t)],
  ['draw', o => (/\bdraws? (?:a|an additional|one|two|three|four|five|six|seven|x|that many|\w+) cards?\b/.test(o) && !/^each player draws/m.test(o)) || /draw cards equal/.test(o) || /\binvestigate\b/.test(o)],
  ['removal', o => /\b(destroy|exile) (?:up to (?:one|two) )?(?:another )?target (?:nonland |noncreature |nonblack |tapped |attacking |artifact or enchantment|creature or planeswalker|creature|permanent|artifact|enchantment|planeswalker)/.test(o)
    || /deals? (?:\d+|x|damage equal[^.]*) (?:damage )?to (?:any target|target creature|target (?:attacking |blocking )?creature|up to (?:one|two|three) targets?|target creature or planeswalker)/.test(o)
    || /target creature (?:an opponent controls )?gets -\d+\/-\d+/.test(o) || /return target (?:nonland )?(?:creature|permanent)[^.]*to (?:its|their) owner'?s'? hand/.test(o)
    || /\bfights? (?:up to one )?(?:another )?target/.test(o) || /target (?:player|opponent) sacrifices/.test(o) || /each opponent sacrifices (?:a|an) (?:creature|permanent)/.test(o)
    || /gain control of target/.test(o) || /put target (?:creature|nonland permanent)[^.]*(?:on (?:the )?(?:top|bottom)|into (?:its|their) owner's library)/.test(o)],
  ['wipe', o => /\b(destroy|exile) all (?:other )?(?:nonland |non-?\w+ )?(creatures|permanents|nonland permanents|artifacts|enchantments)/.test(o) || /deals? (?:\d+|x) damage to each creature/.test(o)
    || /all (?:other )?creatures get -/.test(o) || /each player sacrifices (?:all|\w+) creatures/.test(o) || /return all (?:nonland )?(?:creatures|permanents) to/.test(o)],
  ['counter', o => /\bcounter target\b/.test(o)],
  ['tutor', o => /search your library for (?:a|an|up to one|two|any) (?!basic land|land|forest|plains|island|swamp|mountain|basic)[^.]*card/.test(o)],
  ['protect', o => /(?:creatures|permanents) you control gain (?:hexproof|indestructible|protection|shroud)/.test(o) || /target (?:creature|permanent|artifact) you control gains (?:hexproof|indestructible|protection|shroud)/.test(o) || /^(?:hexproof|indestructible|shroud)$/m.test(o) || /\bphase out\b/.test(o)],
  ['pump', o => /target creature (?:you control )?gets \+\d+\/\+\d+/.test(o) || /creatures you control get \+\d+\/\+\d+/.test(o) || /^equip\b/m.test(o) || /enchanted creature gets \+/.test(o) || /equipped creature gets \+/.test(o)],
  ['combo', o => /untap all|take an extra turn|extra turn after|you win the game|copy target (?:instant|sorcery|spell)|doubling|twice that many|double the/.test(o)],
  ['burn', o => /each opponent loses (?:\d+|x|that much) life|deals? (?:\d+|x) damage to each opponent|target player loses (?:\d+|x) life/.test(o)],
  ['wincon', o => /you win the game|each opponent loses the game/.test(o)],
  ['token', o => /\bcreate\b[^.]*\btokens?\b/.test(o)],
  ['threat', (o, t) => /\b(creature|planeswalker)\b/.test(t)],
  ['aura', (o, t) => /\baura\b/.test(t)],
  ['equipment', (o, t) => /\bequipment\b/.test(t)],
];
function roleText(a){ if (!a) return ''; try { return tname(a.o || '', a.n).toLowerCase(); } catch { return String(a.o || '').toLowerCase(); } }
function crPT(p){ const m = String(p || '').match(/^(-?\d+)\D*\/(-?\d+)/); return m ? [+m[1], +m[2]] : [0, 0]; }
function cardRoles(k){
  if (k == null) return null;
  if (ROLE_CACHE.has(k)) return ROLE_CACHE.get(k);
  const a = info(k); if (!a) return null;
  const o = roleText(a); const t = String(a.t || '').toLowerCase().split('//')[0];
  const roles = new Set(); for (const [r, f] of ROLE_RULES){ try { if (f(o, t, a)) roles.add(r); } catch {} }
  if (roles.has('land')) ['ramp', 'threat', 'draw'].forEach(r => { if (r !== 'draw') roles.delete(r); });
  const kw = new Set(BOT_KWS.filter(w => new RegExp('(^|\\n|, )' + w + '(,|\\n|$| \\{| \\d)', 'i').test(o) || (a.kw || []).map(x => String(x).toLowerCase()).includes(w)));
  if (/~ can't be blocked/.test(o)) kw.add('unblockable');
  const [pow, tou] = crPT(a.p);
  const produces = new Set(); (o.match(/add [^.]*/g) || []).forEach(s => (s.match(/\{([wubrgc])\}/g) || []).forEach(x => produces.add(x[1].toUpperCase())));
  if (/add one mana of any (?:color|type)|any combination of colors/.test(o)) 'WUBRG'.split('').forEach(x => produces.add(x));
  for (const [bt, col] of Object.entries({plains:'W', island:'U', swamp:'B', mountain:'R', forest:'G'})) if (new RegExp('\\b' + bt + '\\b').test(t)) produces.add(col);
  const r = {k, n:a.n, mv:a.mv || 0, roles, land:roles.has('land'), creature:/\bcreature\b/.test(t), pw:/\bplaneswalker\b/.test(t), instant:/\binstant\b/.test(t) || /\bflash\b/.test(o.split('\n')[0] || ''),
    sorcery:/\bsorcery\b/.test(t), perm:/\b(creature|artifact|enchantment|planeswalker|land|battle)\b/.test(t), legendary:/\blegendary\b/.test(t), pow, tou, kw, er:Number.isFinite(a.er) ? a.er : null,
    colors:a.c || '', ci:a.ci || '', produces, tapped:/enters (?:the battlefield )?tapped/.test(o) && !/unless|if you control/.test(o), text:o};
  r.value = cardValue(r);
  ROLE_CACHE.set(k, r); return r;
}
// a prior for how strong the card is, 0..1
function cardValue(r){
  if (!r) return 0;
  if (r.er != null){ return Math.max(0.05, Math.min(1, 1.05 - Math.log10(Math.max(1, r.er)) / 4.3)); }
  let v = 0.25;
  const R = r.roles;
  if (R.has('land')) return 0.3 + (r.produces.size > 1 ? 0.1 : 0);
  if (R.has('ramp')) v += r.mv <= 2 ? 0.3 : 0.15;
  if (R.has('draw')) v += 0.2; if (R.has('removal')) v += 0.25; if (R.has('wipe')) v += 0.25; if (R.has('counter')) v += 0.2; if (R.has('tutor')) v += 0.2;
  if (R.has('combo') || R.has('wincon')) v += 0.2; if (R.has('protect')) v += 0.1; if (R.has('burn')) v += 0.1;
  if (r.creature){ v += Math.min(0.3, (r.pow + r.tou) / 30 + r.kw.size * 0.03); if (r.mv > 0) v += Math.max(-0.15, Math.min(0.15, ((r.pow + r.tou) / 2 - r.mv) * 0.05)); }
  if (r.pw) v += 0.25;
  return Math.max(0.05, Math.min(1, v));
}
// how much a permanent on a board matters right now (public information only: its key, counters, P/T from stats())
function permValue(c, pid){
  if (!c || !c.k || c.fd) return c && c.fd ? 2 : 0;
  const r = cardRoles(c.k); if (!r) return 1;
  let v = r.value * 4;
  const cr = (() => { try { return isCreatureCard(c); } catch { return r.creature; } })();
  if (cr){ let st = null; try { st = stats(c, pid); } catch {} const p = st ? st[0] : r.pow, t = st ? st[1] : r.tou;
    v += Math.max(0, p) * 1.5 + Math.max(0, t) * 0.5;
    const has = w => { try { return !!kwOf(c, w, pid); } catch { return r.kw.has(w); } };
    if (has('flying') || r.kw.has('unblockable')) v += 1.5 + Math.max(0, p) * 0.5; if (has('deathtouch')) v += 1.5; if (has('double strike')) v += Math.max(0, p); if (has('lifelink')) v += 1; if (has('trample')) v += 0.5; if (has('infect')) v += 2; if (has('indestructible')) v += 1.5; if (has('hexproof')) v += 1; }
  if (r.pw) v += 5 + (c.co || 0) * 0.5;
  if (c.cmd) v += 4;
  if (r.land) v = 0.5 + (r.produces.size > 1 ? 0.5 : 0) + (r.roles.has('combo') ? 2 : 0);
  if (!cr && !r.pw && !r.land){ if (r.roles.has('ramp')) v += 1.5; if (r.roles.has('draw')) v += 1.5; if (r.roles.has('combo') || r.roles.has('wincon')) v += 3; }
  if (c.tok && !cr) v *= 0.5;
  return v;
}
// does the sentence that targets <desc> help or hurt what it targets? 'harm' | 'help' | ''
function targetIntent(text, desc){
  const o = String(text || '').toLowerCase(); const d = String(desc || '').toLowerCase().trim();
  const sens = o.split(/(?<=[.:\n])\s*/).filter(s => /\btarget\b/.test(s));
  let s = sens.find(x => d && x.includes('target ' + d)) || sens.find(x => d && x.includes(d.split(' ').slice(-1)[0])) || sens[0] || '';
  if (/\b(destroy|exile|deals?|damage|gets? -|-\d+\/-\d+|sacrifices?|discards?|loses|mills?|return target [^.]*to (?:its|their) owner'?s'? hand|tap target|counter target|fights?|gain control|can't (?:block|attack)|doesn't untap|on (?:the )?(?:top|bottom) of|into (?:its|their) owner's library|lose all abilities|becomes? a? ?\d\/\d)/.test(s)
    && !/\bfrom (?:your|a|their) graveyard\b/.test(s)) return 'harm';
  if (/\b(gets? \+|gains?|untap target|put (?:a|two|three|\w+) \+1\/\+1 counters?|attach|equip|return target [^.]* from your graveyard|hexproof|indestructible|protection|copy|regenerate|draws?|you gain|blink|exile target [^.]*you control[^.]*return)/.test(s)) return 'help';
  return '';
}
// keep Scryfall's EDHREC rank on cards loaded from now on (and on cards shared by other players / saved decks)
{
  const inf = infoFrom;
  infoFrom = function(c){ const a = inf.apply(this, arguments); try { if (a && c && Number.isFinite(c.edhrec_rank)) a.er = c.edhrec_rank; } catch {} return a; };
  const ci = cleanInfo;
  cleanInfo = function(x){ const a = ci.apply(this, arguments); try { if (a && x && Number.isFinite(x.er)) a.er = clamp(Math.round(x.er), 1, 1e6); } catch {} return a; };
}

/* ---------------------------------------------------------------- stage 2a additions (Hard / Very hard): known combos and win conditions
   Additive only: two new roles ('combopiece', 'bomb') and the COMBOS table. comboInfo(name) → the combos a card belongs to.
   comboRisk(zones) scores how close a player's PUBLIC cards (battlefield, graveyard, command zone) are to a known combo. */
const COMBOS = [
  ["Thassa's Oracle", 'Demonic Consultation'], ["Thassa's Oracle", 'Tainted Pact'], ['Laboratory Maniac', 'Demonic Consultation'], ['Jace, Wielder of Mysteries', 'Demonic Consultation'],
  ["Thassa's Oracle", 'Doomsday'], ['Hermit Druid', "Thassa's Oracle"],
  ['Isochron Scepter', 'Dramatic Reversal'], ['Kiki-Jiki, Mirror Breaker', 'Zealous Conscripts'], ['Kiki-Jiki, Mirror Breaker', 'Pestermite'], ['Kiki-Jiki, Mirror Breaker', 'Deceiver Exarch'],
  ['Kiki-Jiki, Mirror Breaker', 'Restoration Angel'], ['Kiki-Jiki, Mirror Breaker', 'Felidar Guardian'], ['Kiki-Jiki, Mirror Breaker', 'Village Bell-Ringer'], ['Kiki-Jiki, Mirror Breaker', 'Combat Celebrant'],
  ['Splinter Twin', 'Pestermite'], ['Splinter Twin', 'Deceiver Exarch'], ['Saheeli Rai', 'Felidar Guardian'], ['Dualcaster Mage', 'Twinflame'], ['Dualcaster Mage', 'Heat Shimmer'],
  ['Exquisite Blood', 'Sanguine Bond'], ['Exquisite Blood', 'Vito, Thorn of the Dusk Rose'], ['Exquisite Blood', 'Marauding Blight-Priest'], ['Heliod, Sun-Crowned', 'Walking Ballista'],
  ['Mikaeus, the Unhallowed', 'Triskelion'], ['Mikaeus, the Unhallowed', 'Walking Ballista'], ['Devoted Druid', 'Vizier of Remedies'], ['Basalt Monolith', 'Rings of Brighthearth'],
  ['Basalt Monolith', 'Power Artifact'], ['Grim Monolith', 'Power Artifact'], ['Food Chain', 'Eternal Scourge'], ['Food Chain', 'Misthollow Griffin'], ['Food Chain', 'Squee, the Immortal'],
  ['Underworld Breach', "Lion's Eye Diamond", 'Brain Freeze'], ['Peregrine Drake', 'Deadeye Navigator'], ['Palinchron', 'Deadeye Navigator'], ['Palinchron', 'High Tide'],
  ['Niv-Mizzet, Parun', 'Curiosity'], ['Niv-Mizzet, Parun', 'Ophidian Eye'], ['Niv-Mizzet, Parun', 'Tandem Lookout'], ['Niv-Mizzet, the Firemind', 'Curiosity'],
  ['Worldgorger Dragon', 'Animate Dead'], ['Worldgorger Dragon', 'Necromancy'], ['Worldgorger Dragon', 'Dance of the Dead'], ['Bloodchief Ascension', 'Mindcrank'], ['Mindcrank', 'Duskmantle Guildmage'],
  ['Sword of the Meek', 'Thopter Foundry'], ["Painter's Servant", 'Grindstone'], ['Pili-Pala', 'Grand Architect'], ['Freed from the Real', 'Bloom Tender'], ['Freed from the Real', 'Faeburrow Elder'],
  ['Ad Nauseam', "Angel's Grace"], ['Kinnan, Bonder Prodigy', 'Basalt Monolith'], ['Chatterfang, Squirrel General', 'Pitiless Plunderer'], ['Gravecrawler', 'Phyrexian Altar', 'Blood Artist'],
  ['Ghostly Flicker', 'Archaeomancer', 'Peregrine Drake'], ['Aetherflux Reservoir', "Bolas's Citadel"], ["Sensei's Divining Top", "Bolas's Citadel"], ['Nim Deathmantle', "Ashnod's Altar", 'Eternal Witness'],
  ['Dockside Extortionist', 'Temur Sabertooth'], ['Displacer Kitten', 'Teferi, Time Raveler'], ['Ashaya, Soul of the Wild', 'Quirion Ranger'], ['Walking Ballista', 'Heliod, Sun-Crowned'],
  ['Sanguine Bond', 'Exquisite Blood'], ['Witherbloom Apprentice', 'Chain of Smog'], ['Professor Onyx', 'Chain of Smog'], ['Scurry Oak', 'Ivy Lane Denizen'],
];
// single cards that win or nearly win the game on resolution (counter them, hold answers for them)
const BOMBS = new Set(['Craterhoof Behemoth', 'Insurrection', 'Rise of the Dark Realms', 'Tooth and Nail', 'Torment of Hailfire', 'Exsanguinate', 'Finale of Devastation', 'Expropriate',
  'Approach of the Second Sun', 'Triumph of the Hordes', 'Overwhelming Stampede', 'Akroma\'s Will', 'Jin-Gitaxias, Core Augur', 'Omniscience', 'Biovisionary', 'Felidar Sovereign', 'Laboratory Maniac',
  "Thassa's Oracle", 'Revel in Riches', 'Mechanized Production', 'Hellkite Charger', 'Time Warp', 'Temporal Manipulation', 'Capture of Jingzhou', 'Expropriate', 'Living Death', 'Rite of Replication',
  'Debt to the Deathless', 'Kindred Dominance', 'Austere Command', 'Cyclonic Rift', 'Armageddon', 'Ravages of War', 'Sunfall', 'Damnation', 'Wrath of God', "Toxic Deluge", 'Blasphemous Act']);
const COMBO_BY = new Map();
COMBOS.forEach((g, i) => g.forEach(n => { if (!COMBO_BY.has(n)) COMBO_BY.set(n, []); COMBO_BY.get(n).push(i); }));
const comboBase = n => String(n || '').split(' // ')[0];
function comboInfo(name){ return (COMBO_BY.get(comboBase(name)) || []).map(i => COMBOS[i]); }
// names: the public card names a player has (battlefield + graveyard + command zone); returns {score, near:[{combo, missing}], live:[combo]}
function comboRisk(names){
  const have = new Set([...names].map(comboBase)); const out = {score:0, near:[], live:[]};
  const seen = new Set();
  have.forEach(n => (COMBO_BY.get(n) || []).forEach(i => { if (seen.has(i)) return; seen.add(i); const g = COMBOS[i]; const miss = g.filter(x => !have.has(x));
    if (!miss.length){ out.live.push(g); out.score += 20; } else if (miss.length === 1){ out.near.push({combo:g, missing:miss[0]}); out.score += 5; } else out.score += 1; }));
  return out;
}
ROLE_RULES.push(['combopiece', (o, t, a) => COMBO_BY.has(comboBase(a && a.n))]);
ROLE_RULES.push(['bomb', (o, t, a) => BOMBS.has(comboBase(a && a.n)) || /\byou win the game\b|take an extra turn after this one/.test(o)]);
