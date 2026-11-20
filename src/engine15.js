/* ===================== Rules engine — round 15: passive abilities from the most-played cards ===================== */

// choosing a creature type as it enters; the card counts as that type
{
  const oe = onEnter;
  onEnter = function(c, from, o){ const r = oe(c, from, o); try { if (c && S.bf.includes(c) && /as (?:~|it|this \w+) enters, choose a creature type/i.test(tname(info(c.k)?.o || '', info(c.k)?.n)) && !c.ctype && !UI.dry){ (async () => { c.ctype = await askText(`${cname(c)}: choose a creature type`, 'Elf'); log(`${cname(c)}: chose ${c.ctype}`); commit(); })(); } } catch {} return r; };
  const dk = descOk;
  descOk = function(k, desc, o = {}){ const r = dk(k, desc, o); if (r || !S) return r; const d = String(desc || '').toLowerCase().trim(); if (!d || /\s/.test(d.replace(/^(an?|the) /, '')) && !/creature/.test(d)) return r;
    const types = new Set(); for (const c of S.bf){ if (c.k === k && c.ctype && /is the chosen type in addition to its other types/i.test(info(k)?.o || '')) types.add(c.ctype.toLowerCase()); }
    for (const c of S.bf){ if (c.ctype && /creatures you control are the chosen type in addition/i.test(info(c.k)?.o || '') && /Creature/.test(info(k)?.t || '')) types.add(c.ctype.toLowerCase()); if (/creatures you control are every creature type/i.test(info(c.k)?.o || '') && /Creature/.test(info(k)?.t || '')) return /^(an? )?\w+( creature)?s?$/.test(d) && !/^(an? )?(creature|land|artifact|enchantment|token|legendary|nontoken)/.test(d) ? true : r; }
    const word = d.replace(/^(an?|the) /, '').replace(/ creatures?$/, '').replace(/s$/, ''); return types.has(word) || types.has(word + 's') ? true : r; };
}
// Blood Moon; Thalia; Stony Silence / Collector Ouphe; Linvala; Rites of Flourishing; Lab Maniac; Platinum Angel; tokens with mana
STATIC_RULES.push(
  [/^nonbasic lands are mountains$/, m => ({kind:'bloodMoon', who:'all'})],
  [/^creatures and nonbasic lands your opponents control enter tapped$/, m => ({kind:'oppTapped', who:'opp', nonbasic:true})],
  [/^artifacts your opponents control enter tapped$/, m => ({kind:'oppTapped', who:'opp', art:true, onlyArt:true})],
  [/^activated abilities of artifacts can't be activated$/, m => ({kind:'noAbil', who:'all', type:'Artifact'})],
  [/^activated abilities of creatures your opponents control can't be activated$/, m => ({kind:'noAbil', who:'opp', type:'Creature'})],
  [/^each player may play an additional land on each of their turns$/, m => ({kind:'extraLand', who:'all', n:1})],
  [/^if you would draw a card while your library has no cards in it, you win the game instead$/, m => ({kind:'labMan', who:'you'})],
  [/^you can't lose the game and your opponents can't win the game$/, m => ({kind:'noLose', who:'you'})],
  [/^creature tokens you control have "\{t\}: add one mana of any color"$/, m => ({kind:'tokMana', who:'you'})],
  [/^if you would draw a card except the first one you draw in each of your draw steps, draw two cards instead$/, m => ({kind:'drawTwo', who:'you'})],
  [/^vehicles you control have crew (\d+)$/, m => ({kind:'giveCrew', who:'you', n:+m[1]})],
  [/^you may cast sorcery spells as though they had flash$/, m => ({kind:'allFlash', who:'you', desc:'sorcery'})],
  [/^the "legend rule" doesn't apply to permanents you control$/, m => ({kind:'noLegend', who:'you'})],
  [/^creatures with power less than ~'s power can't block (?:it|creatures you control)$/, m => ({kind:'noop'})],
  [/^if an opponent would gain life, that player loses that much life instead$/, m => ({kind:'gainLoss', who:'opp'})],
  [/^activated abilities of creatures you control cost \{(\d+)\} less to activate$/, m => ({kind:'abilDisc', who:'you', type:'Creature', n:+m[1]})],
  [/^activated abilities of artifacts you control cost \{(\d+)\} less to activate$/, m => ({kind:'abilDisc', who:'you', type:'Artifact', n:+m[1]})],
  [/^this effect can't reduce the mana in that cost to less than one mana$/, m => ({kind:'noop'})],
  [/^creature spells you cast have convoke$/, m => ({kind:'noop'})],
  [/^damage can't be prevented$/, m => ({kind:'noop'})],
  [/^a deck can have any number of cards named ~$/, m => ({kind:'noop'})],
  [/^if you would roll one or more dice, instead roll that many dice plus one and ignore the lowest roll$/, m => ({kind:'diceAdv', who:'you'})],
);
STATIC_KNOWN.push(/^as it enters, choose a color(?: other than \w+)?$/, /^~ is the chosen type in addition to its other types$/, /^as ~ enters, choose a creature type$/, /^vanishing \d+$/, /^increment$/, /^mayhem \{/, /^\d+\/\d+$/, /^firebending x, where x is ~'s power$/);
{
  const ma = manaAbs;
  manaAbs = function(c){ let out = ma(c); if (!S || !c) return out;
    if (isLand(c.k) && !/\bBasic\b/.test(info(c.k)?.t || '') && rulesOn('bloodMoon').length) return [{cost:'{T}', eff:'Add {R}', rest:'', outs:[['R']], tapOnly:true, line:'{T}: Add {R}. (Blood Moon)'}];
    if (c.tok && isCreatureCard(c) && S.bf.includes(c) && rulesOn('tokMana').length && !out.some(o => o.tm)) out = out.concat({cost:'{T}', eff:'Add one mana of any color', rest:'', outs:manaOuts('Add one mana of any color'), tapOnly:true, line:'{T}: Add one mana of any color.', tm:true});
    return out; };
  const ar = abilityReady;
  abilityReady = function(c, ab, mana){ for (const r of rulesOn('noAbil')) if (new RegExp('\\b' + r.type + '\\b').test(typeOf(c)) && !ab.equip) return `${r.src}: abilities of ${r.type.toLowerCase()}s can't be activated`; return ar(c, ab, mana); };
  const pac = payAbilityCost;
  payAbilityCost = async function(c, cost, o){ if (S && c && S.bf.includes(c)){ const n = rulesOn('abilDisc').filter(r => new RegExp('\\b' + r.type + '\\b').test(typeOf(c))).reduce((a, r) => a + r.n, 0); if (n){ const mm = String(cost).match(/\{(\d+)\}/); if (mm){ const tot = (String(cost).match(/\{[^}TQ]+\}/gi) || []).length; const g = +mm[1]; const left = Math.max(tot - 1 > 0 ? 0 : 1, g - n); cost = String(cost).replace(mm[0], left ? `{${left}}` : ''); cost = cost.replace(/^,\s*/, ''); } } } return pac(c, cost, o); };
  const oe = onEnter;
  onEnter = function(c, from, o){ const r = oe(c, from, o); try { if (c && S.bf.includes(c)){ for (const x of rulesOn('oppTapped')){ if (x.onlyArt && !/Artifact/.test(typeOf(c))) continue; if (x.nonbasic && isLand(c.k) && !/\bBasic\b/.test(info(c.k)?.t || '')) c.tap = true; } } } catch {} return r; };
  const dr = draw;
  draw = function(n = 1){ if (S && rulesOn('labMan').length && S.lib.length < n && !UI.dry){ log('🏆 tried to draw from an empty library — wins the game (Laboratory Maniac)'); toast('You win the game!'); return 0; }
    if (S && rulesOn('drawTwo').length && !UI.inDrawStep){ let extra = 0; const pn = phaseNow(); for (let i = 0; i < n; i++){ const first = pn.ph === 2 && pn.pid === MYPID && (S.drawnT !== turnStr() || !S.drawn); if (!first) extra++; } return dr(n + extra); }
    return dr(n); };
  const gl = gainLife;
  gainLife = function(n, src){ return gl(n, src); };
  const al = abilityList;
  abilityList = function(c){ const out = al(c); if (S && c && S.bf.includes(c) && /Vehicle/.test(typeOf(c)) && !out.some(a => a.crew)){ const g = rulesOn('giveCrew')[0]; if (g) return out.concat({cost:`Crew ${g.n}`, eff:'~ becomes an artifact creature until end of turn.', sorc:false, line:`Crew ${g.n}`, crew:g.n}); } return out; };
}
// enchanted creature loses all abilities and becomes an N/N (Kenrith's Transformation, Frogify)
{
  const st0 = stats;
  stats = function(c, pid = MYPID){ const r = st0(c, pid); if (!c || !r) return r; for (const b of boardsAll()) for (const a of b.bf){ if (!a.att || a.att.id !== c.id || a.att.pid !== pid || !a.k) continue; const mm = (info(a.k)?.o || '').match(/enchanted creature loses all abilities and is an? [a-z ]+? creature with base power and toughness (\d+)\/(\d+)/i); if (mm){ const pu = c.pu || [0, 0]; const n = (c.cp || 0) - (c.cm || 0); return [+mm[1] + n + pu[0], +mm[2] + n + pu[1]]; } } return r; };
}
STATIC_RULES.push([/^enchanted creature loses all abilities and is an? [a-z ]+? creature with base power and toughness \d+\/\d+$/, m => ({kind:'noop'})]);
