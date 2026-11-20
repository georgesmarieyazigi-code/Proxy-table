/* ===================== Rules engine — round 18: wording fixes found by the mass check ===================== */
// lists inside trigger conditions: “Whenever you cast an Aura, Equipment, or Vehicle spell”
{
  const tn = tname;
  tname = function(txt, name){ return tn(txt, name).replace(/\b(an?) (\w+), (\w+),? or (\w+) (spell|card|creature|permanent)\b/g, '$1 $2 or $3 or $4 $5'); };
}
// “Then amass”, “you create a Treasure token”, lowercase token names
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){
    let s = String(s0).replace(/\.$/, '').trim();
    if (/^then /i.test(s) && !/^then (?:if|put the rest|shuffle)\b/i.test(s)) s = cap(s.slice(5));
    if (/^you create /i.test(s)) s = cap(s.slice(4));
    if (/^this ability costs \{\d+\} less to activate(?: for each .+)?$/i.test(s)) return;
    if (/^each opponent$/i.test(s) && ctx.dmgN === undefined && /deals damage equal to its power to each other creature and each opponent/i.test(String(ctx.full || ''))) return;
    return ds(s, ctx);
  };
  const cft = createFromText;
  createFromText = function(s, ctx){ return cft(String(s).replace(/\b(treasure|food|clue|gold|blood|map|powerstone|incubator|junk|shard|walker|lander|mutagen)( tokens?)\b/gi, (w, a, b) => cap(a.toLowerCase()) + b), ctx); };
}
// “Each player draws N cards, then discards N cards” stays one instruction
{
  const re = runEffects;
  runEffects = async function(txt, ctx){ return re(String(txt || '').replace(/Each player draws (a card|\w+ cards), then discards (a card|\w+ cards)\./gi, 'Each player draws $1 and discards $2.'), ctx); };
}
async function doRound18Pre(s, l, ctx){
  let m;
  if ((m = l.match(/^each player draws (a card|\w+ cards) and discards (a card|\w+ cards)$/))){ const n = wn(m[1].split(' ')[0]) || 1, d = wn(m[2].split(' ')[0]) || 1; draw(n); await discardTracked(d, ctx); opponents().forEach(p => { sendRq(p.pid, 'draw', n, ctx.name); sendRq(p.pid, 'discard', d, ctx.name); }); commit(); return true; }
  if ((m = l.match(/^((?:\w+s, )*\w+s,? and \w+s) you control get \+(\d+)\/\+(\d+) until end of turn$/))){ const types = m[1].split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => sing(x.trim())); S.bf.filter(c => isCreatureCard(c) && types.some(t => descOk(c.k, t, {tok:c.tok}))).forEach(c => { c.pu = [(c.pu ? c.pu[0] : 0) + +m[2], (c.pu ? c.pu[1] : 0) + +m[3]]; }); commit(); return true; }
  if ((m = l.match(/^if the gift was promised, (.+)$/))){ if (ctx.gift) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true; }
  if ((m = l.match(/^if the gift wasn't promised, (.+)$/))){ if (!ctx.gift) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true; }
  if ((m = l.match(/^if (?:~|this spell) was kicked, (.+?)(?: instead)?$/))){ if (ctx.it && ctx.it.kicked) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true; }
  if ((m = l.match(/^if (?:~|this spell) was bargained, (.+)$/))){ if (ctx.it && ctx.it.bargained) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true; }
  if ((m = l.match(/^if x is (\d+) or more, (.+)$/))){ const x = (ctx.it && ctx.it.x) || 0; if (x >= +m[1]) await doSentence(cap(s.slice(s.length - m[2].length)), ctx); return true; }
  if ((m = l.match(/^if you cast ~ during your main phase, (.+)$/))){ const pn = phaseNow(); if (pn.mine && (pn.ph === 3 || pn.ph === 5)) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true; }
  if ((m = l.match(/^if it's a (\w+), put a \+1\/\+1 counter on it$/))){ const t = (ctx.lastTok || [])[0] ?? ((ctx.lastT || [])[0] || {}).id; const c = t != null && S.bf.find(x => x.id === t); if (c && descOk(c.k, m[1], {tok:c.tok})) modCounters(c, 'cp', 1); commit(); return true; }
  if ((m = l.match(/^you gain (\d+) life for each creature you control with power (\d+) or greater$/))){ const n = S.bf.filter(c => isCreatureCard(c) && stats(c)[0] >= +m[2]).length; if (n) gainLife(+m[1] * n, ctx.name); commit(); return true; }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){
    const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase();
    if (l && await doRound18Pre(s, l, ctx)) return;
    return ds(s0, ctx);
  };
}
// gift, kicker and bargain: ask while casting, remember on the stack item
{
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}){
    const t = (info(c.k)?.o || '');
    if (!UI.dry && /^Gift (?:a|an|two) /im.test(t)) { const v = await askChoice({title:`${cname(c)}: promise the gift?`, options:[{label:'Promise the gift', value:1}, {label:'No gift', value:0}]}); UI.giftNext = !!v; }
    return bc(c, zone, o);
  };
  const re = runEffects;
  runEffects = async function(txt, ctx){ if (ctx && ctx.it && ctx.it.kind === 'spell' && UI.giftNext != null){ ctx.gift = UI.giftNext; UI.giftNext = null; } return re(txt, ctx); };
}
STATIC_KNOWN.push(/^gift (?:a|an|two) /, /^bargain$/, /^echo /, /^splice onto /, /^harmonize /, /^improvise$/);
