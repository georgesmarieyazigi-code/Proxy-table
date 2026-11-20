/* ---------------------------------------------------------------- fix23b: numbers the engine can count (v23 bot games) */
// last known damage on a creature that left the battlefield ("the amount of damage dealt to it this turn": Tangled Colony)
{
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ try { const [from, , c] = find(id); if (c && from === 'bf' && to !== 'bf' && S){ S.f23lki = (S.f23lki || []).filter(x => x.t === turnStr()).slice(-20); S.f23lki.push({id:c.id, dmg:c.dmg || 0, t:turnStr()}); } } catch {} return mc.apply(this, arguments); };
}
{
  const co = countOf;
  countOf = function(phrase, ctx){
    const p = String(phrase || '').trim().toLowerCase().replace(/\.$/, '');
    try {
      if (/^the (?:amount|total amount) of damage (?:that was )?dealt to (?:it|~|this creature) this turn$/.test(p)){
        const id = (ctx && (ctx.srcId ?? (ctx.it && ctx.it.srcId) ?? (ctx.card && ctx.card.id)));
        const c = id != null ? S.bf.find(x => x.id === id) : null; if (c) return c.dmg || 0;
        const l = (S.f23lki || []).filter(x => x.id === id && x.t === turnStr()).pop(); return l ? l.dmg : 0;
      }
      if (/^the number of creatures in your party$/.test(p) || /^the number of creatures in your party you control$/.test(p)) return r23kParty();
    } catch (e){ console.warn('f23 countOf', e); }
    return co(phrase, ctx);
  };
}
// Dungeon of the Mad Mage — Mad Wizard's Lair: draw three, reveal them, you may cast one of them free
{
  const ds = doSentence;
  doSentence = async function(s0, ctx = {}){
    const l = String(s0 || '').replace(/\.$/, '').trim().toLowerCase(); let m;
    try {
      if ((m = l.match(/^draw (two|three|four) cards and reveal them$/))){
        const n = wn(m[1]); const before = new Set(S.hand.map(c => c.id)); if (UI.dry) return;
        draw(n); const got = S.hand.filter(c => !before.has(c.id)); ctx.f23drawn = got.map(c => c.id);
        log(`${ctx.name || 'Effect'}: drew and revealed ${got.map(c => cname(c)).join(', ') || 'nothing'}`); commit(); return; }
      if (/^(?:you may )?cast one of them without paying its mana cost$/.test(l) && ctx.f23drawn){
        if (UI.dry) return; const cs = S.hand.filter(c => ctx.f23drawn.includes(c.id) && !isLand(c.k));
        if (!cs.length){ log(`${ctx.name || 'Effect'}: nothing to cast`); return; }
        const v = await askChoice({title:`${ctx.name || 'Effect'}: cast one of them without paying its mana cost?`, options:[...cs.map(c => ({label:cname(c), value:c.id})), {label:"Don't cast", value:'none'}]});
        const c = v && v !== 'none' ? S.hand.find(x => x.id === v) : null; if (c){ UI.afterCast = () => {}; await beginCast(c, 'hand', {free:true}); } return; }
    } catch (e){ console.warn('f23 lair', e); }
    return ds(s0, ctx);
  };
}
// "X" known from the spell (or from the event, e.g. Monstrosity X) is filled in before tokens are made — here or on an opponent's side
const f23X = ctx => { const it = ctx && ctx.it; if (!it) return null; if (it.xSet || (it.x != null && it.x !== '' && +it.x > 0)) return +it.x || 0; if (it.evX != null) return +it.evX || 0; if (it.monX != null) return +it.monX || 0; return null; };
{
  const cf = createFromText;
  createFromText = function(text, ctx, ...a){ try { const n = f23X(ctx); if (n != null && /\bX\b/.test(String(text)) && !/\bwhere X is\b/i.test(String(text))) text = String(text).replace(/\bX\/X\b/g, `${n}/${n}`).replace(/\b(create|creates) X\b/gi, `$1 ${n}`); } catch {} return cf.call(this, text, ctx, ...a); };
}
if (typeof r23kTokFor === 'function'){ const tf = r23kTokFor;
  r23kTokFor = function(pid, text, ctx){ try { const n = f23X(ctx); if (n != null && /\bX\b/.test(String(text)) && !/\bwhere X is\b/i.test(String(text))) text = String(text).replace(/\bX\/X\b/g, `${n}/${n}`).replace(/^X\b/, String(n)).replace(/\b(an|a) X\/X/g, `$1 ${n}/${n}`); } catch {} return tf.call(this, pid, text, ctx); }; }
// Notorious Throng: "the damage dealt to your opponents this turn" (from any source)
{ const co = countOf;
  countOf = function(phrase, ctx){ const p = String(phrase || '').trim().toLowerCase().replace(/\.$/, '');
    try { if (/^the (?:total )?(?:amount of )?damage (?:that was )?dealt to your opponents this turn$/.test(p)) return opponents().reduce((a, o) => a + f19DmgThisTurn(o.pid), 0); } catch (e){ console.warn('f23 throng', e); }
    return co(phrase, ctx); }; }
// Kefnet's Monument & co.: "target creature (an opponent controls) doesn't untap during its controller's next untap step"
{ const ds = doSentence;
  doSentence = async function(s0, ctx = {}){
    const l = String(s0 || '').replace(/\.$/, '').trim().toLowerCase();
    try {
      if (/^(?:up to one )?target (?:creature|permanent|artifact or creature)(?: an opponent controls| you don't control)? doesn't untap during its controller's next untap step$/.test(l)){
        if (UI.dry) return; const ts = ctx.tgts ? nextTargets(ctx) : []; const t = ts[0];
        if (!t){ log(`${ctx.name || 'Effect'}: no target`); return; }
        if (t.pid === MYPID){ const c = S.bf.find(x => x.id === t.id); if (c) c.skipUntap = 1; }
        else sendRq(t.pid, 'r23Ifrz1', 0, ctx.name || '', {tid:t.id});
        log(`${ctx.name || 'Effect'}: ${t.nm || 'that creature'} doesn't untap during its controller's next untap step`); commit(); return; }
    } catch (e){ console.warn('f23 frz', e); }
    return ds(s0, ctx);
  };
}
// Tail Swipe: the condition ("if you cast this spell during your main phase") is checked earlier; the rest arrives on its own
{ const ds = doSentence;
  doSentence = async function(s0, ctx = {}){
    const l = String(s0 || '').replace(/\.$/, '').trim().toLowerCase(); let m;
    try { if ((m = l.match(/^the creature you control gets \+(\d+)\/\+(\d+) until end of turn$/)) && ctx.h23fight){ const a = ctx.h23fight[0]; if (a && !UI.dry) applyTo(a, {op:'pump', src:ctx.name || '', f:{p:+m[1], t:+m[2], kw:[]}}); return; } } catch (e){ console.warn('f23 tail', e); }
    return ds(s0, ctx);
  };
}
// "That player loses N life" with no player left to refer to (the target was gone, or there was none): nothing happens
{ const ds = doSentence;
  doSentence = async function(s0, ctx = {}){
    const l = String(s0 || '').replace(/\.$/, '').trim().toLowerCase();
    try { if (/^that player (?:loses|gains) (?:\d+|x|one|two|three|four|five) life$/.test(l) && !(ctx.lastT && ctx.lastT.length) && !ctx.r23kOpp && !ctx.r23Iopp && !ctx.tp && !(ctx.it && (ctx.it.evPid || ctx.it.tgts))){
        const anyT = (ctx.tgts || []).flat().length; if (anyT ? !(ctx.tgts || []).flat().some(targetStillThere) : (ctx.k && /\btarget (?:creature|permanent|player|opponent)/i.test(info(ctx.k)?.o || ''))){ log(`${ctx.name || 'Effect'}: no target player — nothing happens`); return; } } } catch (e){ console.warn('f23 thatplayer', e); }
    return ds(s0, ctx);
  };
}
// X of an activated ability with {X} in its cost is known even when it is 0 (Bronzebeak Foragers asked "how many? (life)")
{ const xk = xKnown; xKnown = function(ctx){ if (xk(ctx)) return true; const it = ctx && ctx.it; try { const o = info(it && it.k)?.o || ''; return !!(it && it.x != null && ((it.kind === 'ability' && /\{X\}[^:\n]*:/.test(o)) || (it.kind === 'spell' && /as an additional cost to cast this spell,[^.]*\bX\b/i.test(o)))); } catch { return false; } }; }
// Loyal Inventor & co.: "you may search" declined (or nothing found) → the follow-up sentences about "that card" do nothing
{ const ds = doSentence;
  doSentence = async function(s0, ctx = {}){
    const l = String(s0 || '').replace(/\.$/, '').trim().toLowerCase();
    try { if ((/^put that card into your hand if you control an? \w+$/.test(l) || /^otherwise, put that card on top of your library$/.test(l)) && !Array.isArray(ctx.jSrch)){ if (/^put/.test(l)) log(`${ctx.name || 'Effect'}: no card was found`); return; } } catch (e){ console.warn('f23 inventor', e); }
    return ds(s0, ctx);
  };
}
// Lonis with X = 0 (nothing revealed): "that player puts the rest on the bottom" has nothing to move
{ const ds = doSentence;
  doSentence = async function(s0, ctx = {}){
    const l = String(s0 || '').replace(/\.$/, '').trim().toLowerCase();
    try { if (/^(?:target|that) player puts the rest on the bottom of their library in a random order$/.test(l) && !ctx.qRev && /reveals the top x cards/i.test(info(ctx.k)?.o || '') && !(ctx.it && +ctx.it.x > 0)){ log(`${ctx.name || 'Effect'}: no cards were revealed`); return; } } catch (e){ console.warn('f23 lonis', e); }
    return ds(s0, ctx);
  };
}
// Shadow, Mysterious Assassin: "each opponent loses life equal to the mana value of the sacrificed permanent"
{ const ds = doSentence;
  doSentence = async function(s0, ctx = {}){
    const l = String(s0 || '').replace(/\.$/, '').trim().toLowerCase(); let m;
    try { if ((m = l.match(/^(each opponent|target opponent|target player) loses life equal to the sacrificed (?:permanent|creature|artifact)'s mana value$|^(each opponent|target opponent|target player) loses life equal to the mana value of the sacrificed (?:permanent|creature|artifact)$/))){
        const who = m[1] || m[2]; const c = ctx.sacd; if (UI.dry) return; if (!c){ log(`${ctx.name || 'Effect'}: nothing was sacrificed`); return; }
        const n = info(c.k)?.mv || 0; const pids = who === 'each opponent' ? opponents().map(o => o.pid) : ((ctx.tgts ? nextTargets(ctx) : []).map(t => t.pid));
        for (const pid of pids) if (n) await loseLife(pid, n, ctx.name || ''); log(`${ctx.name || 'Effect'}: ${who === 'each opponent' ? 'each opponent loses' : 'loses'} ${n} life (${cname(c)})`); commit(); return; } } catch (e){ console.warn('f23 shadow', e); }
    return ds(s0, ctx);
  };
}
// Peerless Recycling (gift): "return two target permanent cards from your graveyard to your hand"
{ const ds = doSentence;
  doSentence = async function(s0, ctx = {}){
    const l = String(s0 || '').replace(/\.$/, '').trim().toLowerCase();
    try { if (/^return (?:up to )?(?:two|three|four|five) target [a-z ,-]+? cards? from your graveyard to your hand$/.test(l) && ctx.tgts){
        if (UI.dry) return; const ts = nextTargets(ctx); let n = 0;
        for (const t of ts){ const c = S.gy.find(g => g.id === t.id); if (c){ moveCard(c.id, 'hand'); n++; } }
        log(`${ctx.name || 'Effect'}: returned ${n} card${n === 1 ? '' : 's'} from the graveyard to hand`); commit(); return; } } catch (e){ console.warn('f23 recyc', e); }
    return ds(s0, ctx);
  };
}
// The Mycotyrant: "the number of creatures you control that are Fungi and/or Saprolings"
{ const co = countOf; const SG = {fungi:'Fungus', saprolings:'Saproling', elves:'Elf', dwarves:'Dwarf', wolves:'Wolf', werewolves:'Werewolf'};
  const sg = w => SG[w] || (w.charAt(0).toUpperCase() + w.slice(1).replace(/s$/, ''));
  countOf = function(phrase, ctx){ const p = String(phrase || '').trim().toLowerCase().replace(/\.$/, ''); let m;
    try { if ((m = p.match(/^(?:the number of )?creatures you control that are (\w+) and\/or (\w+)$/))){ const a = sg(m[1]), b = sg(m[2]); const re = new RegExp(`\\b(${a}|${b})\\b`);
        return S.bf.filter(c => isCreatureCard(c) && !c.fd && re.test(typeOf(c))).reduce((s, c) => s + (c.tok ? (c.n || 1) : 1), 0); } } catch (e){ console.warn('f23 fungi', e); }
    return co(phrase, ctx); }; }
// keywords "until your next turn" on one permanent (cleared when my next turn begins)
{ const ko = kwOf; kwOf = function(c, kw, ...a){ try { if (c && c.f23nt && c.f23nt.includes(kw)) return true; } catch {} return ko.call(this, c, kw, ...a); };
  const sp = setPhase; setPhase = function(i){ try { if (i === 0 && S) S.bf.forEach(c => { if (c.f23nt) delete c.f23nt; }); } catch {} return sp.apply(this, arguments); }; }
{ const ds = doSentence;
  doSentence = async function(s0, ctx = {}){
    const raw = String(s0 || '').replace(/\.$/, '').trim(); const l = raw.toLowerCase(); let m;
    try {
      // Mirrorworks & co.: "create a token that's a copy of that artifact" — the artifact from the event
      if ((m = l.match(/^create a token that's a copy of that (artifact|creature|enchantment|permanent)$/)) && ctx.it && (ctx.it.evk || ctx.it.evId != null)){
        if (UI.dry) return; const c = ctx.it.evId != null ? S.bf.find(x => x.id === ctx.it.evId) : null; const k = c ? c.k : ctx.it.evk;
        if (!k){ log(`${ctx.name || 'Effect'}: that ${m[1]} is gone`); return; } createToken(k, 1); log(`${ctx.name || 'Effect'}: created a token copy of ${info(k)?.n || 'it'}`); commit(); return; }
      // "it gains <keyword> until your next turn" (one of my permanents)
      if ((m = l.match(/^it gains (hexproof|indestructible|shroud|vigilance|lifelink|deathtouch|flying|trample|menace|haste|reach|first strike|ward \{\d\}) until your next turn$/))){
        if (UI.dry || ctx.f23hexDone) return; const t = (ctx.lastT || [])[0]; const c = t && t.pid === MYPID ? S.bf.find(x => x.id === t.id) : null;
        if (c){ c.f23nt = [...new Set([...(c.f23nt || []), m[1]])]; log(`${cname(c)} has ${m[1]} until their next turn`); commit(); return; } }
      // Crumb and Get It: "that creature also gains indestructible until end of turn"
      if ((m = raw.match(/^That creature also gains (.+ until end of turn)$/i))) return ds(`It gains ${m[1]}.`, ctx);
      // Undercity — Throne of the Dead Three
      if (/^put a creature card from among them onto the battlefield with three \+1\/\+1 counters on it/.test(l)){
        if (UI.dry) return; const top = S.lib.slice(0, 10); const cs = top.filter(c => isCreatureCard(c));
        let pick = null; if (cs.length){ const v = await askChoice({title:`${ctx.name || 'Throne of the Dead Three'}: put which creature onto the battlefield?`, options:cs.map(c => ({label:cname(c), value:c.id}))}); pick = cs.find(c => c.id === v) || cs[0]; }
        if (pick){ moveCard(pick.id, 'bf'); const b = S.bf.find(x => x.id === pick.id); if (b){ modCounters(b, 'cp', 3); b.f23nt = [...new Set([...(b.f23nt || []), 'hexproof'])]; ctx.lastT = [{t:'card', pid:MYPID, id:b.id, k:b.k, nm:cname(b)}]; ctx.f23hexDone = true; } log(`${ctx.name || 'Effect'}: put ${cname(pick)} onto the battlefield with three +1/+1 counters; it has hexproof until their next turn`); }
        else log(`${ctx.name || 'Effect'}: no creature card among the top ten`);
        if (/then shuffle/.test(l)) shuffleLib(); commit(); return; }
    } catch (e){ console.warn('f23 batch3', e); }
    return ds(s0, ctx);
  };
}
// Gadwick & co.: an "enters" trigger's X is the X the permanent was cast with
{ const no = numOf; numOf = async function(w, ctx, what){
    try { if (String(w).toLowerCase() === 'x' && ctx && ctx.it && ctx.it.kind === 'trigger' && !xKnown(ctx)){ const id = ctx.it.srcId; const c = id != null ? S.bf.find(b => b.id === id) : null;
        if (c && c.xv != null && /^when(?:ever)? (?:~|this creature|this permanent) enters/i.test(String(ctx.it.trig || ctx.it.raw || '')) || (c && c.xv != null && /\benters\b/i.test(tname(info(c.k)?.o || '', info(c.k)?.n)) && /\bX\b/.test(String(ctx.it.txt || '')))) return +c.xv || 0; } } catch (e){ console.warn('f23 etbX', e); }
    return no.call(this, w, ctx, what); }; }
// Gossip's Talent: "target attacking creature with power N or less can't be blocked this turn"
{ const ds = doSentence;
  doSentence = async function(s0, ctx = {}){
    const l = String(s0 || '').replace(/\.$/, '').trim().toLowerCase();
    try { if (/^target attacking creature(?: with power \d+ or less)? can't be blocked this turn$/.test(l)) return ds("Target creature can't be blocked this turn.", ctx); } catch (e){ console.warn('f23 gossip', e); }
    return ds(s0, ctx);
  };
}
/* ---- "X. If <cond>, instead Y." and "~ deals N damage …. If <cond>, it deals M damage instead." — pick the branch first ---- */
const F23_INST = /(^|\n|\.\s+)([A-Z~][^.\n]*?)\.\s+If ([^,.\n]+), instead ([^.\n]+)\./g;
const F23_DMGI = /(^|\n|\.\s+)([A-Z~][^.\n]*?deals )(\d+)( damage[^.\n]*)\.\s+If ([^,.\n]+), (?:it|~|this [a-z]+) deals (\d+) damage instead\./g;
function f23Cond(cond, ctx){ const c = String(cond || '').trim().toLowerCase();
  if (/^this spell was kicked$/.test(c)) return !!(ctx && ctx.it && ctx.it.kicked);
  if (/^you're the monarch$|^you are the monarch$/.test(c)) return holderOf('mon') === MYPID;
  try { const r = s21Cond(c, ctx); if (r != null) return r; } catch {} return null; }
{ const re = runEffects;
  runEffects = async function(txt, ctx){ let t = String(txt || '');
    try { if (!UI.dry && ctx){
        t = t.replace(F23_DMGI, (w, a, x, n, rest, cond, m) => { const on = f23Cond(cond, ctx); return on == null ? w : `${a}${x}${on ? m : n}${rest}.`; });
        t = t.replace(F23_INST, (w, a, x, cond, y) => { if (/^(the gift was promised|you have the city's blessing)$/i.test(cond)) return w; const on = f23Cond(cond, ctx); return on == null ? w : `${a}${on ? y.charAt(0).toUpperCase() + y.slice(1) : x}.`; }); } } catch (e){ console.warn('f23 inst', e); }
    F23_INST.lastIndex = 0; F23_DMGI.lastIndex = 0; return re(t, ctx); }; }
/* ---- small ones from the 500-game run ---- */
{ const ds = doSentence;
  doSentence = async function(s0, ctx = {}){
    const raw = String(s0 || '').replace(/\.$/, '').trim(); const l = raw.toLowerCase(); let m;
    try {
      // Mirri's Guile: declined the look → nothing to put back
      if (/^(?:then )?put them back in any order$/.test(l) && !ctx.f23looked){ const o = info(ctx.k)?.o || ''; if (/you may look at the top/i.test(o)) return; }
      // Alesha: "return target creature card with power N or less from your graveyard to the battlefield tapped and attacking"
      if (/^return target creature card(?: with (?:power|mana value) \d+ or less)? from your graveyard to the battlefield tapped and attacking$/.test(l)){
        if (UI.dry) return; const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; const c = t && S.gy.find(g => g.id === t.id); if (!c){ log(`${ctx.name || 'Effect'}: the card is gone`); return; }
        const src = ctx.it && ctx.it.srcId != null ? S.bf.find(b => b.id === ctx.it.srcId) : null; const def = (src && src.atk) || (S.bf.find(b => b.atk) || {}).atk || '';
        moveCard(c.id, 'bf'); const b = S.bf.find(x => x.id === c.id); if (b){ b.tap = true; if (def) b.atk = def; b.sk = false; } log(`${ctx.name || 'Effect'}: returned ${cname(c)} tapped${def ? ' and attacking' : ''}`); commit(); return; }
      // Rock (Equipment-granted ability whose text keeps a stray quote): "Rock deals 2 damage to any target'"
      if ((m = raw.match(/^(.+?) deals (\d+) damage to any target['’"]$/))) return ds(`${m[1]} deals ${m[2]} damage to any target.`, ctx);
    } catch (e){ console.warn('f23 batch4', e); }
    return ds(s0, ctx);
  };
}
{ const co = countOf;
  countOf = function(phrase, ctx){ const p = String(phrase || '').trim().toLowerCase().replace(/\.$/, '');
    try { if (/^the number of times you(?:'ve)? descended this turn$/.test(p)) return jTurnRec().desc || 0; } catch (e){ console.warn('f23 desc', e); }
    return co(phrase, ctx); }; }
// Tomb of Annihilation — Oubliette: "Discard a card and sacrifice an artifact, a creature, and a land"
{ const ds = doSentence;
  doSentence = async function(s0, ctx = {}){
    const l = String(s0 || '').replace(/\.$/, '').trim().toLowerCase();
    try { if (/^discard a card and sacrifice an artifact, a creature, and a land$/.test(l)){ await ds('Discard a card.', ctx); for (const w of ['an artifact', 'a creature', 'a land']) await ds(`Sacrifice ${w}.`, ctx); return; } } catch (e){ console.warn('f23 oubliette', e); }
    return ds(s0, ctx);
  };
}
// Psychic Paper: a renamed creature gets its own name back the moment it leaves the battlefield
{ const mc = moveCard;
  moveCard = function(id, to, o = {}){ try { const [from, , c] = find(id); if (c && from === 'bf' && to !== 'bf' && c.c27ppOrig){ c.k = c.c27ppOrig; delete c.c27ppOrig; } } catch {} return mc.apply(this, arguments); }; }
{ const ds = doSentence;
  doSentence = async function(s0, ctx = {}){
    const l = String(s0 || '').replace(/\.$/, '').trim().toLowerCase();
    try {
      // Aven Interrupter: the spell was gone before the trigger resolved → nothing to plot
      if (/^it becomes plotted$/.test(l) && !ctx.r26ctr && !UI.dry){ log(`${ctx.name || 'Effect'}: no spell was exiled — nothing becomes plotted`); return; }
      // Rikku: "until end of turn, that creature can't be blocked by creatures your opponents control" (the creature from the event)
      if (/^(?:until end of turn, )?that creature can't be blocked(?: by creatures your opponents control)?(?: this turn| until end of turn)?$/.test(l) && ctx.it && ctx.it.evId != null){
        if (UI.dry) return; const pid = ctx.it.evPid || MYPID; const c = boardOf(pid).find(b => b.id === ctx.it.evId);
        if (!c){ log(`${ctx.name || 'Effect'}: that creature is gone`); return; }
        return ds("Target creature can't be blocked this turn.", {...ctx, tgts:[[{t:'card', pid, id:c.id, k:c.k, nm:cname(c)}]], ti:0}); }
    } catch (e){ console.warn('f23 batch5', e); }
    return ds(s0, ctx);
  };
}
// Lathiel: "distribute up to that many +1/+1 counters among any number of other target creatures" (that many = life gained this turn)
{ const ds = doSentence;
  doSentence = async function(s0, ctx = {}){
    const l = String(s0 || '').replace(/\.$/, '').trim().toLowerCase(); let m;
    try { if ((m = l.match(/^distribute (?:up to )?that many (\+1\/\+1 counters) among (any number of|one or more) other target (creatures?)$/))){
        const o = info(ctx.k)?.o || ''; let n = null; if (/gained life this turn/i.test(o)) n = lifeT().g;
        if (n != null){ if (!n){ log(`${ctx.name || 'Effect'}: no life gained — no counters`); return; } return ds(`Distribute ${n} ${m[1]} among ${m[2]} target ${m[3]}.`, ctx); } } } catch (e){ console.warn('f23 lathiel', e); }
    return ds(s0, ctx);
  };
}
{ const ds = doSentence;
  doSentence = async function(s0, ctx = {}){
    const raw = String(s0 || '').replace(/\.$/, '').trim(); const l = raw.toLowerCase(); let m;
    try {
      // Communal Brewing: "that creature enters with N additional +1/+1 counters on it" (the creature spell just cast)
      if ((m = l.match(/^that creature enters with (\d+|x|one|two|three|four|five) additional \+1\/\+1 counters? on it(?:, where x is (.+))?$/)) && ctx.it){
        if (UI.dry) return; let n = m[1] === 'x' ? (m[2] ? (countOf(m[2], ctx) ?? 0) : 0) : wn(m[1]); if (!n) return;
        const k = ctx.it.evk; if (!k) return; (S.f23entC ||= []).push({k, n, t:turnStr()}); log(`${ctx.name || 'Effect'}: ${info(k)?.n || 'that creature'} will enter with ${n} more +1/+1 counter${n === 1 ? '' : 's'}`); commit(); return; }
      // Dragonhawk: delayed "deals N damage to each opponent for each of those cards that are still exiled"
      if ((m = raw.match(/^(.+?) deals (\d+) damage to each opponent for each of those cards that are still exiled$/i))){
        if (UI.dry) return; const nm = ctx.name || m[1]; const left = S.ex.filter(c => c.mayPlay && (c.mayPlay.src === nm || c.mayPlay.src === m[1])).length; const n = left * (+m[2]);
        if (n) for (const o of opponents()) dealDamage({t:'player', pid:o.pid}, n, ctx.k, ctx.it && ctx.it.srcId != null ? S.bf.find(b => b.id === ctx.it.srcId) : null);
        log(`${nm}: ${left} of those cards still exiled — ${n} damage to each opponent`); commit(); return; }
    } catch (e){ console.warn('f23 batch6', e); }
    return ds(s0, ctx);
  };
}
{ const oe = onEnter;
  onEnter = function(c, from, o){ const r = oe.apply(this, arguments);
    try { if (S && S.f23entC && S.f23entC.length && c && from !== 'bf' && isCreatureCard(c)){ const t = turnStr(); S.f23entC = S.f23entC.filter(p => p.t === t); const i = S.f23entC.findIndex(p => p.k === c.k);
        if (i >= 0){ const p = S.f23entC.splice(i, 1)[0]; modCounters(c, 'cp', p.n); log(`${cname(c)} entered with ${p.n} additional +1/+1 counter${p.n === 1 ? '' : 's'}`); } } } catch (e){ console.warn('f23 entC', e); }
    return r; }; }
{ const ds = doSentence;
  const AKW = ['flying', 'first strike', 'double strike', 'deathtouch', 'haste', 'hexproof', 'indestructible', 'lifelink', 'menace', 'reach', 'trample', 'vigilance'];
  doSentence = async function(s0, ctx = {}){
    const raw = String(s0 || '').replace(/\.$/, '').trim(); const l = raw.toLowerCase(); let m;
    try {
      // Minsc & Boo −2 (reflexive, after "Sacrifice a creature")
      if ((m = raw.match(/^(.+?) deals X damage to any target, where X is that creature's power$/i))){
        if (UI.dry) return; const c = ctx.sacd; if (!c){ log(`${ctx.name || 'Effect'}: nothing was sacrificed`); return; }
        let p = 0; try { const lk = typeof r21aLki === 'function' ? r21aLki(c.id) : null; p = lk && lk.__pw != null ? lk.__pw : (stats(c) || [])[0]; } catch {} if (p == null || isNaN(+p)) p = +(info(c.k)?.p) || 0; p = Math.max(0, +p || 0); ctx.f23X = p;
        const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t && p) dealDamage(t, p, ctx.k, ctx.it && ctx.it.srcId != null ? S.bf.find(b => b.id === ctx.it.srcId) : null);
        log(`${ctx.name || 'Effect'}: ${p} damage (the sacrificed creature's power)`); commit(); return; }
      if ((m = l.match(/^if the sacrificed creature was an? (\w+), draw x cards$/))){
        if (UI.dry) return; const c = ctx.sacd; if (!c) return; const ty = typeOf(c); const n = ctx.f23X ?? 0;
        if (new RegExp('\\b' + m[1] + '\\b', 'i').test(ty) && n) draw(n); commit(); return; }
      // Akroma, Vision of Ixidor
      if (/^until end of turn, each other creature you control gets \+1\/\+1 if it has flying, \+1\/\+1 if it has first strike, and so on for/.test(l)){
        if (UI.dry) return; const self = ctx.it && ctx.it.srcId;
        for (const c of S.bf.filter(x => isCreatureCard(x) && !x.fd && x.id !== self)){
          let n = AKW.filter(k => { try { return hasKw(c, k); } catch { return false; } }).length;
          const o = textOf(c); if (/\bprotection from\b/i.test(o)) n++; if (/^partner\b/im.test(info(c.k)?.o || '')) n++;
          if (n) applyTo({t:'card', pid:MYPID, id:c.id, k:c.k}, {op:'pump', src:ctx.name || 'Akroma', f:{p:n, t:n, kw:[]}}); }
        log(`${ctx.name || 'Akroma'}: other creatures get +1/+1 for each keyword`); commit(); return; }
    } catch (e){ console.warn('f23 batch7', e); }
    return ds(s0, ctx);
  };
}
// Chandra, Flameshaper +2: "Exile the top three cards of your library. Choose one. You may play that card this turn."
{ const ds = doSentence;
  doSentence = async function(s0, ctx = {}){
    const l = String(s0 || '').replace(/\.$/, '').trim().toLowerCase();
    try { if (l === 'choose one' && /choose one\. you may play that card this turn/i.test(info(ctx.k)?.o || '')){
        if (UI.dry) return; const ids = (ctx.lastEx || []).filter(id => S.ex.some(c => c.id === id)); if (!ids.length){ log(`${ctx.name || 'Effect'}: nothing was exiled`); return; }
        const cs = ids.map(id => S.ex.find(c => c.id === id)); const v = cs.length === 1 ? cs[0].id : await askChoice({title:`${ctx.name || 'Effect'}: choose one of the exiled cards — you may play it this turn`, options:cs.map(c => ({label:cname(c), value:c.id}))});
        ctx.lastEx = [v != null ? v : cs[0].id]; return; } } catch (e){ console.warn('f23 chandra', e); }
    return ds(s0, ctx);
  };
}
// Wall of Frost: "that creature" is the creature it blocked
{ const ds = doSentence;
  doSentence = async function(s0, ctx = {}){
    const l = String(s0 || '').replace(/\.$/, '').trim().toLowerCase();
    try { if (/^that creature doesn't untap during its controller's next untap step$/.test(l) && /whenever ~ blocks a creature|whenever [^,]+ blocks a creature/i.test(tname(info(ctx.k)?.o || '', info(ctx.k)?.n))){
        if (UI.dry) return; const w = ctx.it && ctx.it.srcId != null ? S.bf.find(b => b.id === ctx.it.srcId) : null; const aid = w && w.blk; const apid = phaseNow().pid;
        if (aid == null){ log(`${ctx.name || 'Effect'}: the blocked creature is gone`); return; }
        if (apid === MYPID){ const c = S.bf.find(b => b.id === aid); if (c) c.skipUntap = 1; } else sendRq(apid, 'r23Ifrz1', 0, ctx.name || '', {tid:aid});
        log(`${ctx.name || 'Effect'}: the blocked creature doesn't untap during its controller's next untap step`); commit(); return; } } catch (e){ console.warn('f23 wallfrost', e); }
    return ds(s0, ctx);
  };
}
// Nylea, Keen-Eyed & co.: "Otherwise, you may put it into your graveyard" — "it" is the revealed top card (still on top)
{ const ds = doSentence;
  doSentence = async function(s0, ctx = {}){
    const l = String(s0 || '').replace(/\.$/, '').trim().toLowerCase();
    try { if (/^put it into your graveyard$/.test(l) && /reveal the top card of your library\..*otherwise, you may put it into your graveyard/is.test(info(ctx.k)?.o || '')){
        if (UI.dry) return; const c = S.lib[0]; if (!c) return; moveCard(c.id, 'gy'); log(`${ctx.name || 'Effect'}: put ${cname(c)} into the graveyard`); commit(); return; } } catch (e){ console.warn('f23 nylea', e); }
    return ds(s0, ctx);
  };
}
// Citadel of Pain: "deals X damage to that player, where X is the number of untapped lands they control" (the player whose end step it is)
{ const ds = doSentence;
  doSentence = async function(s0, ctx = {}){
    const raw = String(s0 || '').replace(/\.$/, '').trim(); let m;
    try { if ((m = raw.match(/^(.+?) deals X damage to that player, where X is the number of untapped lands (?:they control|that player controls)$/i))){
        if (UI.dry) return; const pid = (ctx.it && ctx.it.evPid) || phaseNow().pid; const n = boardOf(pid).filter(b => b.k && isLand(b.k) && !(b.tap || b.tp)).length;
        if (n) dealDamage({t:'player', pid}, n, ctx.k, ctx.it && ctx.it.srcId != null ? S.bf.find(b => b.id === ctx.it.srcId) : null);
        log(`${ctx.name || m[1]}: ${n} damage to ${pid === MYPID ? 'me' : nameOf(pid)} (untapped lands)`); commit(); return; } } catch (e){ console.warn('f23 citadel', e); }
    return ds(s0, ctx);
  };
}
