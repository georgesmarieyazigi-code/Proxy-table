// Top combos, slice C: each loop is played through the real engine; the table must spot it and ask how many times.
module.exports = async ({A, B, check, sleep, waitFor, after, fresh, putP, toZone, pool, poolOf, act, castH, rec, repeat, life, lost, cnt, libN, noNotes, step}) => {
  const doAll = async (...steps) => { for (const s of steps){ const r = await s(); if (r !== 'ok' && r !== 'mana') return r; await after(); } return true; };
  const chosen = () => A.evaluate(() => window.__chosen || []);
  const attach = (aura, host) => A.evaluate(([a, h]) => { const x = S.bf.find(c => cname(c) === a), y = S.bf.find(c => cname(c) === h); x.att = {pid:MYPID, id:y.id}; commit(); }, [aura, host]);
  const kimLife = n => B.evaluate(n => { S.life = n; commit(); }, n).then(() => sleep(1000));
  const myLife = n => A.evaluate(n => { S.life = n; commit(); }, n);
  const hand = () => A.evaluate(() => S.hand.length);
  const toks = (nm) => A.evaluate(nm => S.bf.filter(c => (c.tok || c.token) && new RegExp(nm, 'i').test(cname(c))).reduce((a, c) => a + (c.n || 1), 0), nm);
  const kimLib = () => B.evaluate(() => S.lib.length);
  const lastLog = (re) => A.evaluate(re => (S.log.filter(e => new RegExp(re).test(e.s)).pop() || {}).s || '', re);
  const asked = async (re) => { const ok = await waitFor(A, re => (window.__chosen || []).some(s => new RegExp(re).test(s)), re, 20000); return ok; };
  // Trigger loop that should drain Kim: start it, the table asks (after 20 triggers), answer "until every opponent is dead".
  const drainLoop = (name, pieces, start, o = {}) => step(name, async () => {
    await fresh(); await sleep(6000); await kimLife(o.kim || 40);
    for (const p of pieces) await putP(A, p);
    if (o.setup) await o.setup();
    await A.evaluate(w => { window.__tgt = 'kim'; window.__want = w; }, o.want || ['every opponent is dead', '^yes', 'draw']); await sleep(400);
    await start(); await after();
    const ok = await waitFor(B, () => S.life <= 0, null, 180000); await after();
    const ch = await chosen();
    if (!o.fast) check(ch.some(s => /go on forever|looks like a loop/.test(s)), `${name}: the table asked how many times (${JSON.stringify(ch.slice(-3))})`);
    check(ok && await lost(B), `${name}: Kim was drained to 0 and lost (Kim ${await life(B)})`);
    if (o.post) await o.post();
    await noNotes(name);
  });
  // Hand loop: do it twice by hand, the table asks, answer a number; then check the result.
  const handLoop = (name, setup, once, n, measure, expect, o = {}) => step(name, async () => {
    await fresh(); await A.evaluate(() => { F25.asked = {}; F25.sh = []; }); await setup(); if (!o.keepPool) await pool(A, {});
    await A.evaluate(([n, w]) => { window.__wantQ = ['how many times']; window.__XQ = [n]; if (w) window.__want = w; }, [n, o.want || null]);
    const m0 = await measure();
    const r1 = await once(); check(r1 === true, `${name}: loop 1 by hand (${r1})`);
    const m1 = await measure();
    for (let i = 2; i <= (o.reps || 2); i++){ const r2 = await once(); check(r2 === true, `${name}: loop ${i} by hand (${r2})`); } await after();
    const ok = await waitFor(A, n => S.log.some(e => new RegExp(`repeated the loop ${n} times`).test(e.s)), n, 120000); await after();
    check(ok, `${name}: the table spotted the loop and repeated it ${n} times (${JSON.stringify(await chosen())})`);
    const m3 = await measure();
    if (process.env.DBG) console.log(await A.evaluate(() => JSON.stringify({acts:UI.recDone && UI.recDone.acts.map(a => a.t + ':' + info(a.k)?.n), ans:UI.recDone && UI.recDone.ans, log:S.log.slice(-60).map(e => e.s).filter(s => /repeat|tapped|returned/.test(s))})));
    check(expect(m0, m1, m3), `${name}: result after 2 + ${n} loops (${JSON.stringify([m0, m1, m3])})`);
    if (o.post) await o.post();
    await noNotes(name);
  });

  // ---- drain loops (mandatory triggers) ----
  await drainLoop('C5 Vito + Exquisite Blood', ['Vito, Thorn of the Dusk Rose', 'Exquisite Blood'], () => A.evaluate(() => { gainLife(1, 'test'); commit(); }));
  await drainLoop('C8 Vito + Bloodthirsty Conqueror', ['Vito, Thorn of the Dusk Rose', 'Bloodthirsty Conqueror'], () => A.evaluate(() => { gainLife(1, 'test'); commit(); }));
  await drainLoop('C26 Marauding Blight-Priest + Exquisite Blood', ['Marauding Blight-Priest', 'Exquisite Blood'], () => A.evaluate(() => { gainLife(1, 'test'); commit(); }));
  await drainLoop('C110 Starscape Cleric + Exquisite Blood', ['Starscape Cleric', 'Exquisite Blood'], () => A.evaluate(() => { gainLife(1, 'test'); commit(); }));
  await drainLoop('C20 Curiosity on Niv-Mizzet, Parun', ['Niv-Mizzet, Parun', 'Curiosity'], () => A.evaluate(() => { draw(1); commit(); }), {setup:() => attach('Curiosity', 'Niv-Mizzet, Parun')});
  await drainLoop('C132 Niv-Mizzet, the Firemind + Curiosity', ['Niv-Mizzet, the Firemind', 'Curiosity'], () => act(A, 'Niv-Mizzet, the Firemind', 'Draw'), {setup:() => attach('Curiosity', 'Niv-Mizzet, the Firemind')});
  await drainLoop('C39 Niv-Mizzet, Parun + Niv-Mizzet, Visionary', ['Niv-Mizzet, Parun', 'Niv-Mizzet, Visionary'], () => A.evaluate(() => { draw(1); commit(); }));
  await drainLoop('C23 Bloodchief Ascension + Mindcrank (doubles every round: may end before the table asks)', ['Bloodchief Ascension', 'Mindcrank'], () => A.evaluate(() => { sendRq(OPP.keys().next().value, 'life', -1); commit(); }),
    {setup:() => A.evaluate(() => { addNamed(S.bf.find(c => cname(c) === 'Bloodchief Ascension'), 'quest', 3); commit(); }), want:['every opponent is dead', '^yes', 'lose 2|have that player'], fast:true});
  await drainLoop('C159 Mindcrank + Duskmantle Guildmage', ['Mindcrank', 'Duskmantle Guildmage'], async () => { await pool(A, {U:2, B:2, C:3}); const r = await act(A, 'Duskmantle Guildmage', 'Whenever a card'); await after(); await pool(A, {U:1, B:1, C:2}); return act(A, 'Duskmantle Guildmage', 'mills two'); });

  // ---- hand loops: mana ----
  const tot = () => poolOf(A).then(p => Object.values(p).reduce((a, b) => a + (+b || 0), 0));
  const col = c => () => poolOf(A).then(p => p[c] || 0);
  const per = (k, n, r = 2) => (m0, m1, m3) => m1 - m0 === k && m3 - m0 === k * (n + r);
  await handLoop('C14 Isochron Scepter + Dramatic Reversal (+ Sol Ring, Gilded Lotus)', async () => {
      await putP(A, 'Sol Ring'); await putP(A, 'Gilded Lotus'); await toZone(A, 'Dramatic Reversal', 'hand'); await toZone(A, 'Isochron Scepter', 'hand');
      await A.evaluate(() => { window.__pickRe = 'Dramatic Reversal'; window.__pick = 1; window.__want = 'Dramatic Reversal|imprint|yes'; }); await pool(A, {C:2});
      check(await castH(A, 'Isochron Scepter') === 'ok', 'cast Isochron Scepter'); await after();
      check(await A.evaluate(() => S.ex.some(x => cname(x) === 'Dramatic Reversal')), 'Dramatic Reversal is imprinted');
      await A.evaluate(() => { window.__want = ['^(yes|cast|copy)', 'how many times']; }); },
    () => doAll(() => act(A, 'Sol Ring', 'Add'), () => act(A, 'Gilded Lotus', 'Add'), () => act(A, 'Isochron Scepter', 'copy')), 6, tot, per(3, 6), {want:['^(yes|cast|copy)', 'how many times']});
  const hull = (name, engine, rock, cost, gain) => handLoop(name, async () => {
      await putP(A, engine); await putP(A, rock); await toZone(A, 'Ornithopter', 'hand');
      await A.evaluate(r => { window.__want = ['nonland permanent', 'how many times']; window.__tgtQ = [r, 'Ornithopter', r, 'Ornithopter']; }, rock); },
    () => doAll(() => act(A, rock, 'Add'), () => castH(A, 'Ornithopter'), () => castH(A, rock)), 6, col('C'), per(gain - cost, 6), {want:['nonland permanent', 'how many times']});
  await hull('C32 Hullbreaker Horror + Mana Vault (+ Ornithopter)', 'Hullbreaker Horror', 'Mana Vault', 1, 3);
  await hull('C155 Hullbreaker Horror + Mana Crypt (+ Ornithopter)', 'Hullbreaker Horror', 'Mana Crypt', 0, 2);
  await hull('C118 Tidespout Tyrant + Sol Ring (+ Ornithopter)', 'Tidespout Tyrant', 'Sol Ring', 1, 2);
  const elves = n => A.evaluate(n => { createFromText(`Create ${n} 1/1 green Elf Warrior creature tokens.`, {k:null, name:'setup', it:{}}); commit(); }, n).then(() => sleep(800));
  const staff = (name, druid, setup) => handLoop(name, async () => { await putP(A, 'Staff of Domination'); await putP(A, druid); await setup(); await A.evaluate(d => { window.__tgt = d; }, druid); },
    () => doAll(() => act(A, druid, 'Add'), () => act(A, 'Staff of Domination', '\\{3\\}, \\{T\\}: Untap'), () => act(A, 'Staff of Domination', '^\\{1\\}: Untap')), 6, col('G'), per(1, 6));
  await staff('C69 Staff of Domination + Priest of Titania (5 Elves)', 'Priest of Titania', () => elves('four'));
  await staff('C83 Staff of Domination + Elvish Archdruid (5 Elves)', 'Elvish Archdruid', () => elves('four'));
  await staff('C107 Staff of Domination + Circle of Dreams Druid (5 creatures)', 'Circle of Dreams Druid', () => elves('four'));
  await handLoop('C169 Bloom Tender + Freed from the Real', async () => { await putP(A, 'Bloom Tender'); await putP(A, 'Freed from the Real'); await attach('Freed from the Real', 'Bloom Tender'); },
    () => doAll(() => act(A, 'Bloom Tender', 'Add'), () => act(A, 'Freed from the Real', 'Untap')), 8, col('G'), per(1, 8));
  // ---- hand loops: cards ----
  await handLoop('C51 Teferi, Time Raveler + Displacer Kitten + Sol Ring', async () => { await putP(A, 'Teferi, Time Raveler'); await putP(A, 'Displacer Kitten'); await putP(A, 'Sol Ring');
      await A.evaluate(() => { window.__tgtQ = ['Sol Ring', 'Teferi', 'Sol Ring', 'Teferi']; }); },
    () => doAll(() => act(A, 'Sol Ring', 'Add'), () => A.evaluate(async () => { const c = S.bf.find(x => cname(x) === 'Teferi, Time Raveler'); const i = loyaltyAbs(c).findIndex(a => a.cost === '-3'); const w = loyaltyReady(c, loyaltyAbs(c)[i]); if (w) return w; await activateLoyalty(c, i); return 'ok'; }), () => castH(A, 'Sol Ring')), 5, hand, per(1, 5), {post:async () => check(await cnt(A, 'Sol Ring') === 1 && await poolOf(A).then(p => p.C === 7), 'Sol Ring back on the battlefield, +1 {C} per loop')});
  await handLoop("C36 Sensei's Divining Top + Aetherflux Reservoir + Bolas's Citadel", async () => { await A.evaluate(() => { S.casts = []; commit(); }); for (const p of ["Sensei's Divining Top", 'Aetherflux Reservoir', "Bolas's Citadel"]) await putP(A, p); },
    () => doAll(() => act(A, "Sensei's Divining Top", 'Draw a card'), async () => { const top = await A.evaluate(() => cname(S.lib[0])); if (top !== "Sensei's Divining Top") return 'top card is ' + top; await A.evaluate(() => r23fPlayTop(true)); return 'ok'; }),
    5, hand, per(1, 5), {post:async () => { const l = await life(A); check(l === 40 + 28 - 7, `paid 1 life per Top cast, gained 1..7 from Aetherflux: 40 + 28 - 7 = 61 (${l})`); }});

  // ---- endless trigger loops with nothing to kill: the table asks, we pick a number, it stops ----
  const countLog = re => A.evaluate(re => S.log.filter(e => new RegExp(re).test(e.s)).length, re);
  const trigNum = (name, pieces, setup, start, n, result) => step(name, async () => {
    await fresh(); await sleep(6000); for (const p of pieces) await putP(A, p); await setup();
    await A.evaluate(n => { window.__wantQ = ['number of times']; window.__XQ = [n]; }, n); await sleep(400);
    const r = await start(); check(r === 'ok' || r === 'mana' || r === true || r == null, `${name}: started (${r})`); await after();
    const ok = await waitFor(A, () => S.log.some(e => /ran the chosen number of times|stopped an endless loop/.test(e.s)), null, 150000); await after(); await sleep(2000); await after();
    const ch = await chosen();
    check(ch.some(s => /go on forever/.test(s)), `${name}: the table asked how many times (${JSON.stringify(ch.slice(-2))})`);
    check(ok, `${name}: the loop ran the chosen number of times and stopped`);
    check(await A.evaluate(() => !stackAll().length && !UI.resolving), `${name}: nothing left on the stack`);
    await result(name);
    await noNotes(name);
  });
  // C45 / C77: Blowfly picks its target when its trigger goes on the stack, together with the token trigger (CR 603.3b), so the loop needs a second creature to start.
  const mkTok = (txt) => A.evaluate(t => { createFromText(t, {k:null, name:'setup', it:{}}); commit(); }, txt).then(() => sleep(800));
  await trigNum('C45 Flourishing Defenses + Blowfly Infestation', ['Flourishing Defenses', 'Blowfly Infestation'],
    async () => { await mkTok('Create two 1/1 green Elf Warrior creature tokens.'); await A.evaluate(() => { window.__tgt = 'Elf'; window.__want = ['^yes|create']; }); },
    () => A.evaluate(() => { const c = single(S.bf.find(x => /Elf/.test(cname(x)) && x.tok)); putCounterOn(c, '-1/-1', 1); commit(); return 'ok'; }), 10,
    async (nm) => { const n = await A.evaluate(() => (F25.lastTrig && Object.keys(F25.lastTrig).length) || 0); check(n >= 2, `${nm}: both cards kept triggering (${n})`); });

  await trigNum('C77 Blowfly Infestation + Nest of Scarabs', ['Nest of Scarabs', 'Blowfly Infestation'],
    async () => { await mkTok('Create two 1/1 black Insect creature tokens.'); await A.evaluate(() => { window.__tgt = 'Insect'; }); },
    () => A.evaluate(() => { const c = single(S.bf.find(x => /Insect/.test(cname(x)) && x.tok)); putCounterOn(c, '-1/-1', 1); commit(); return 'ok'; }), 10,
    async (nm) => { const n = await A.evaluate(() => (F25.lastTrig && Object.keys(F25.lastTrig).length) || 0); check(n >= 2, `${nm}: both cards kept triggering (${n})`); });
  await trigNum('C80 Basking Broodscale + Rosie Cotton of South Lane', ['Basking Broodscale', 'Rosie Cotton of South Lane'],
    async () => { await A.evaluate(() => { window.__tgt = 'Basking Broodscale'; window.__want = ['^yes|create']; }); await pool(A, {G:1, C:1}); },
    () => act(A, 'Basking Broodscale', 'Adapt'), 10,
    async (nm) => { const n = await toks('Spawn'); check(n >= 10, `${nm}: at least the chosen 10 rounds of Eldrazi Spawn (${n})`);
      const cp = await A.evaluate(() => S.bf.find(x => cname(x) === 'Basking Broodscale').cp || 0); check(cp >= 10, `${nm}: Broodscale has a +1/+1 counter per Spawn (${cp})`); });
  await trigNum('C151 Polyraptor + Marauding Raptor (endless; stop it)', ['Marauding Raptor'],
    async () => { await toZone(A, 'Polyraptor', 'hand'); await pool(A, {G:2, C:5}); },
    () => castH(A, 'Polyraptor'), 5,
    async (nm) => { const n = await cnt(A, 'Polyraptor'); check(n >= 5, `${nm}: Polyraptors for the chosen rounds (${n})`); });

  await trigNum('C89 Dualcaster Mage + Saw in Half', [],
    async () => { await putP(A, 'Grizzly Bears'); await toZone(A, 'Saw in Half', 'hand'); await toZone(A, 'Dualcaster Mage', 'hand'); await pool(A, {B:1, R:2, C:3});
      await A.evaluate(() => { window.__tgtQ = ['Grizzly Bears']; window.__tgt = 'Saw in Half|Dualcaster'; window.__want = ['choose new|new target']; }); },
    async () => { const r = await castH(A, 'Saw in Half'); if (r !== 'ok') return r; await sleep(1500); return castH(A, 'Dualcaster Mage'); }, 5,
    async (nm) => { const n = await cnt(A, 'Dualcaster Mage'); check(n >= 5, `${nm}: Dualcaster Mage tokens for the chosen 5 rounds (${n})`); });

  await step("C141 Apex Altisaur + Wrathful Raptors (Akroma's Will only keeps Altisaur alive longer)", async () => {
    await fresh(); await putP(A, 'Wrathful Raptors'); for (const c of ['Grizzly Bears', 'Llanowar Elves', 'Gravecrawler', 'Kitchen Finks']) await putP(B, c); await sleep(1000); await after(); await kimLife(40);
    await toZone(A, 'Apex Altisaur', 'hand'); await pool(A, {G:2, C:7});
    await A.evaluate(() => { window.__f25noKnown = 1; window.__tgt = 'opp'; window.__tgtQ = ['Grizzly', 'Llanowar', 'kim', 'Gravecrawler', 'kim', 'Kitchen', 'kim', 'Kitchen', 'kim']; });
    await A.evaluate(() => { window.__T = []; if (!window.__Tw){ window.__Tw = 1; const t = toast; toast = function(m){ (window.__T ||= []).push(m); return t.apply(this, arguments); }; } });
    check(await castH(A, 'Apex Altisaur') === 'ok', 'cast Apex Altisaur'); await sleep(500); if (process.env.DBG) console.log(await A.evaluate(() => JSON.stringify([window.__T, S.pool, window.__titles]))); await after(); await sleep(2000); await after(); await sleep(2000); await after();
    const left = await B.evaluate(() => S.bf.filter(c => isCreatureCard(c) || /Creature/.test(info(c.k)?.t || '')).map(cname));
    check(!left.length, `Altisaur fought every creature Kim had (${JSON.stringify(left)})`);
    const k = await life(B); check(k === 40 - (2 + 1 + 2 + 3 + 2) + 2, `Wrathful Raptors hit Kim for the 10 damage Altisaur was dealt; Finks gained Kim 2 (Kim ${k})`); check(await cnt(A, 'Apex Altisaur') === 0, 'without indestructible (Akroma\'s Will) Altisaur died at 10 damage');
    await A.evaluate(() => { window.__f25noKnown = 0; }); await noNotes('C141');
  });

  // ---- one-shot kills (no loop to repeat) ----
  await step('C62 Blasphemous Act + Repercussion', async () => {
    await fresh(); await putP(A, 'Repercussion'); await putP(A, 'Grizzly Bears');
    for (const c of ['Grizzly Bears', 'Llanowar Elves', 'Ornithopter', 'Gravecrawler']) await putP(B, c); await sleep(1000);
    await toZone(A, 'Blasphemous Act', 'hand'); await pool(A, {R:1, C:3});
    check(await castH(A, 'Blasphemous Act') === 'ok', 'cast Blasphemous Act for {R}{3} (5 creatures)'); await after(); await sleep(1500); await after();
    check(await lost(B), `Kim took 13 per creature (4 × 13 = 52) and lost (Kim ${await life(B)})`);
    check(await life(A) >= 27, `my own Repercussion trigger (13 to me) may still be on the stack when Kim dies (${await life(A)})`);
    await noNotes('C62');
  });
  await step('C92 Psychosis Crawler + Peer into the Abyss', async () => {
    await fresh(); for (const x of ['Island', 'Swamp', 'Forest']) await toZone(A, x, 'hand'); await putP(A, 'Psychosis Crawler'); await toZone(A, 'Peer into the Abyss', 'hand'); await pool(A, {B:3, C:4});
    await A.evaluate(() => { window.__tgt = 'self'; }); const l0 = await libN(A);
    check(await castH(A, 'Peer into the Abyss') === 'ok', 'cast Peer into the Abyss on myself'); await after(); await sleep(1500); await after();
    const l1 = await libN(A); check(l0 - l1 === Math.ceil(l0 / 2), `drew half my library (${l0} → ${l1})`);
    check(await life(A) === 20, `lost half my life (${await life(A)})`);
    check(await lost(B), `Kim lost 1 per card drawn and lost (Kim ${await life(B)})`);
    await noNotes('C92');
  });
  await step('C74 Maddening Cacophony (kicked) + Bruvac the Grandiloquent', async () => {
    await fresh(); await putP(A, 'Bruvac the Grandiloquent'); await toZone(A, 'Maddening Cacophony', 'hand'); await pool(A, {U:2, C:4});
    await A.evaluate(() => { window.__want = ['kick', 'pay']; });
    check(await castH(A, 'Maddening Cacophony') === 'ok', 'cast Maddening Cacophony with kicker'); await after(); await sleep(1500); await after();
    check(await kimLib() === 0, `Kim milled half ×2 = the whole library (${await kimLib()} left)`);
    await noNotes('C74');
  });
  await step('C148 Singularity Rupture + Bruvac the Grandiloquent (Bruvac dies first: not a combo by itself)', async () => {
    await fresh(); await putP(A, 'Bruvac the Grandiloquent'); await toZone(A, 'Singularity Rupture', 'hand'); await pool(A, {U:1, B:2, C:4});
    await A.evaluate(() => { window.__tgt = 'kim'; }); const k0 = await kimLib();
    check(await castH(A, 'Singularity Rupture') === 'ok', 'cast Singularity Rupture on Kim'); await after(); await sleep(1500); await after();
    const k1 = await kimLib(); check(k1 === k0 - Math.floor(k0 / 2), `Bruvac is destroyed before the mill, so Kim mills only half (${k0} → ${k1})`);
    check(await cnt(A, 'Bruvac the Grandiloquent') === 0, 'Bruvac was destroyed');
    await noNotes('C148');
  });
  await step('C103 Witherbloom Apprentice + Chain of Smog', async () => {
    await fresh(); await sleep(6000); await kimLife(20); await putP(A, 'Witherbloom Apprentice'); await toZone(A, 'Chain of Smog', 'hand'); await pool(A, {B:2});
    await A.evaluate(() => { window.__tgt = 'self'; window.__want = ['every opponent is dead', '^copy it|^yes']; });
    check(await castH(A, 'Chain of Smog') === 'ok', 'cast Chain of Smog on myself (empty hand)');
    const ok = await waitFor(B, () => S.life <= 0, null, 150000);
    await A.evaluate(() => { window.__want = ['^no', 'stop']; }); await after(); await sleep(2000); await after();
    check(ok && await lost(B), `each copy drains 1: Kim lost (Kim ${await life(B)})`);
    check(await life(A) >= 60, `I gained 1 per copy (${await life(A)})`);
    check(await A.evaluate(() => !stackAll().length), 'the copies stop once I say no');
    await noNotes('C103');
  });

  // ---- persist + undying (Kitchen Finks under Mikaeus) ----
  const sacFinks = (outlet, ch) => async () => { await A.evaluate(() => { window.__pickRe = 'Kitchen Finks'; }); return act(A, outlet, 'Sacrifice', ch); };
  await step('C56 Mikaeus, the Unhallowed + Phyrexian Altar (+ Kitchen Finks)', async () => {
    await fresh(); await A.evaluate(() => { F25.asked = {}; F25.sh = []; }); await putP(A, 'Mikaeus, the Unhallowed'); await putP(A, 'Phyrexian Altar'); await putP(A, 'Kitchen Finks'); await pool(A, {});
    await A.evaluate(() => { window.__want = ['^B$|black|\\{B\\}']; window.__wantQ = ['how many times']; window.__XQ = [5]; }); await after(); const l0 = await life(A);
    let byHand = 0;
    for (; byHand < 8; byHand++){ if (await A.evaluate(() => (window.__chosen || []).some(s => /looks like a loop/.test(s)))) break; const r = await sacFinks('Phyrexian Altar', 2)(); check(r === 'mana', 'sacrifice Kitchen Finks for {B} (' + r + ')'); await after(); await sleep(500); }
    const ok = await waitFor(A, () => S.log.some(e => /repeated the loop 5 times/.test(e.s)), null, 60000); await after();
    check(ok, `the table spotted the loop after ${byHand} sacrifices and repeated it 5 times (${JSON.stringify(await chosen())})`);
    const per = await A.evaluate(() => UI.recDone ? UI.recDone.acts.length : 0); const sacs = byHand + 5 * per;
    const p = await tot(); check(p === sacs, `one {B} per sacrifice: ${sacs} (${p})`);
    check(await cnt(A, 'Kitchen Finks') === 1, 'Kitchen Finks is back'); const l = await life(A); check(l === l0 + 2 * sacs, `Finks gained 2 life every time it came back (${l})`);
    await noNotes('C56');
  });
  // Loops that grow counters each time (the board never comes back the same) can't be spotted: Record a loop → Repeat.
  const recLoop = (name, setup, once, n, after2) => step(name, async () => {
    await fresh(); await setup(); await pool(A, {});
    await rec(A); const r = await once(); check(r === true, `${name}: one loop by hand (${r})`); await after();
    if (process.env.DBG) console.log(await A.evaluate(() => JSON.stringify([UI.recDone, UI.rec, F27C.idK, S.bf.map(c => c.id + ':' + c.k)])));
    const msg = await repeat(A, n); check(new RegExp(`repeated the loop ${n} times`).test(msg || ''), `${name}: Repeat ×${n} ran every time (${msg})`); await after();
    await after2(name); await noNotes(name);
  });
  const ctrOf = nm => A.evaluate(nm => { const c = S.bf.find(x => cname(x) === nm); return c ? [c.cp || 0, c.cm || 0] : null; }, nm);
  await recLoop('C59 Mikaeus, the Unhallowed + Carrion Feeder (+ Kitchen Finks)', async () => { await putP(A, 'Mikaeus, the Unhallowed'); await putP(A, 'Carrion Feeder'); await putP(A, 'Kitchen Finks'); },
    () => doAll(sacFinks('Carrion Feeder'), sacFinks('Carrion Feeder')), 6,
    async (nm) => { const c = await ctrOf('Carrion Feeder'); check(c && c[0] === 14, `${nm}: Carrion Feeder has 2 × 7 = 14 +1/+1 counters (${JSON.stringify(c)})`); check(await cnt(A, 'Kitchen Finks') === 1, `${nm}: Kitchen Finks is back`); });
  await recLoop('C86 Gravecrawler + Pitiless Plunderer + Carrion Feeder', async () => { for (const p of ['Gravecrawler', 'Pitiless Plunderer', 'Carrion Feeder']) await putP(A, p);
      await A.evaluate(() => { window.__want = ['^B$|black|\\{B\\}']; window.__pickRe = 'Gravecrawler'; }); },
    () => doAll(() => act(A, 'Carrion Feeder', 'Sacrifice'), () => act(A, 'Treasure', 'Add', 2),
      () => A.evaluate(() => { const c = S.gy.find(x => cname(x) === 'Gravecrawler'); if (!c) return 'Gravecrawler not in graveyard'; const g = gyOptions(c)[0]; if (!g) return 'no option'; castFromGy(c, g); return 'ok'; })), 6,
    async (nm) => { const c = await ctrOf('Carrion Feeder'); check(c && c[0] === 7, `${nm}: Carrion Feeder has 7 counters (${JSON.stringify(c)})`); check(await cnt(A, 'Gravecrawler') === 1, `${nm}: Gravecrawler is back`); check(await toks('Treasure') === 0, `${nm}: every Treasure was used (${await toks('Treasure')})`); });
  await recLoop('C124 Swift Reconfiguration + Devoted Druid', async () => { await putP(A, 'Devoted Druid'); await putP(A, 'Swift Reconfiguration'); await attach('Swift Reconfiguration', 'Devoted Druid'); },
    () => doAll(() => act(A, 'Devoted Druid', 'Add \\{G\\}'), () => act(A, 'Devoted Druid', 'Untap')), 10,
    async (nm) => { const p = await poolOf(A); check(p.G === 11, `${nm}: 11 {G} (${JSON.stringify(p)})`); const c = await ctrOf('Devoted Druid'); check(c && c[1] === 11, `${nm}: Devoted Druid survives with 11 -1/-1 counters, it isn't a creature (${JSON.stringify(c)})`); });

  let h0c = 0;
  await recLoop('C128 Savvy Hunter + Experimental Confectioner + Ygra, Eater of All (Ygra grows: Record → Repeat)', async () => {
      for (const p of ['Ygra, Eater of All', 'Savvy Hunter', 'Experimental Confectioner']) await putP(A, p); await mkTok('Create two 1/1 black Rat creature tokens.');
      await A.evaluate(() => { window.__pickRe = 'Rat'; window.__pick = 2; window.__want = ['^yes']; }); await after(); h0c = await hand(); },
    () => doAll(() => act(A, 'Savvy Hunter', 'Sacrifice two Foods')), 6,
    async (nm) => { const h = await hand(); check(h - h0c === 7, `${nm}: drew 1 + 6 cards (${h0c} → ${h})`); check(await toks('Rat') === 2, `${nm}: two Rats again (${await toks('Rat')})`); });

  await step('C121 Storm-Kiln Artist + Haze of Rage (buyback, storm)', async () => {
    await fresh(); await A.evaluate(() => { F25.asked = {}; F25.sh = []; }); await A.evaluate(() => { S.casts = []; commit(); }); await putP(A, 'Storm-Kiln Artist'); await toZone(A, 'Haze of Rage', 'hand');   // storm counts spells this turn: start the count over (as on a new turn)
    await pool(A, {R:16});
    await A.evaluate(() => { window.__want = ['buyback', '^yes|pay']; });
    for (let i = 0; i < 4; i++){ const r = await castH(A, 'Haze of Rage'); check(r === 'ok', `cast Haze of Rage with buyback #${i + 1} from the pool (${r})`); await after(); }
    const t0 = await toks('Treasure'); check(t0 === 10, `1 + 2 + 3 + 4 = 10 Treasures (${t0}; pool ${JSON.stringify(await poolOf(A))})`);
    await A.evaluate(() => { window.__wantQ = ['how many times']; window.__XQ = [3]; if (!window.__lgT){ window.__lgT = []; const l0 = log; log = function(m){ window.__lgT.push([Date.now(), String(m).slice(0, 70)]); return l0.apply(this, arguments); }; } });
    const once = () => doAll(() => act(A, 'Treasure', 'Add', 3), () => act(A, 'Treasure', 'Add', 3), () => act(A, 'Treasure', 'Add', 3), () => act(A, 'Treasure', 'Add', 3), () => castH(A, 'Haze of Rage'));
    check(await once() === true, 'loop 1 by hand: 4 Treasures → Haze of Rage'); check(await once() === true, 'loop 2 by hand'); await after();
    const ok = await waitFor(A, () => S.log.some(e => /repeated the loop 3 times/.test(e.s)), null, 150000); await after();
    if (process.env.DBG) console.log('LG', await A.evaluate(() => (window.__lgT || []).filter(x => !/(resolved|gets .1.0|creature get)/.test(x[1]) || /epeat|Haze of Rage resolved/.test(x[1])).slice(-45).map(x => x[1]).join(' | ')));
    check(ok, `the table spotted the loop and repeated it 3 times (${JSON.stringify(await chosen())})`);
    const t1 = await toks('Treasure'); check(t1 === 10 + 1 + 2 + 3 + 4 + 5, `each loop nets one more Treasure than the last: 25 (${t1})`);
    check(await cnt(A, 'Haze of Rage', 'hand') === 1, 'Haze of Rage back in hand');
    await noNotes('C121');
  });

  // ---- Aetherflux Reservoir: pay 50 life → 50 damage → lifelink-like gain back ----
  for (const [nm, other] of [['C29 Aetherflux Reservoir + Exquisite Blood', 'Exquisite Blood'], ['C66 Aetherflux Reservoir + Bloodthirsty Conqueror', 'Bloodthirsty Conqueror']])
    await step(nm, async () => {
      await fresh(); await A.evaluate(() => { F25.asked = {}; }); await kimLife(300); await putP(A, 'Aetherflux Reservoir'); await putP(A, other); await myLife(60); await sleep(500);
      await A.evaluate(() => { window.__tgt = 'kim'; window.__want = ['every opponent is dead']; });
      for (let i = 0; i < 3; i++){ const r = await act(A, 'Aetherflux Reservoir', 'Pay 50 life'); check(r === 'ok', `${nm}: activation ${i + 1} (${r})`); await after(); }
      const ok = await waitFor(B, () => S.life <= 0, null, 120000); await after();
      check(ok && await lost(B), `${nm}: Kim lost (Kim ${await life(B)}; ${JSON.stringify(await chosen())})`);
      check(await life(A) >= 10, `${nm}: I paid 50 and got 50 back each time (${await life(A)})`);
      await noNotes(nm);
    });
};
