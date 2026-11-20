module.exports = async ({A, B, check, sleep, waitFor, after, fresh, putP, life, lost, step}) => {
  await step('N1 Niv-Mizzet + Curiosity with a 15-card library, Kim at 40', async () => {
    await fresh(); await sleep(6000); await B.evaluate(() => { S.life = 40; commit(); });
    for (const p of ['Niv-Mizzet, Parun', 'Curiosity']) await putP(A, p);
    await A.evaluate(() => { const n = S.bf.find(c => cname(c) === 'Niv-Mizzet, Parun'), c = S.bf.find(c => cname(c) === 'Curiosity'); c.att = {pid:MYPID, id:n.id}; S.lib.splice(15).forEach(x => S.ex.push(x)); window.__tgt = 'kim'; window.__want = ['every opponent is dead', '^yes', 'draw']; window.__noautoAfterLoop = 1; commit(); });
    await sleep(400); await A.evaluate(() => { draw(1); commit(); }); await after();
    await waitFor(A, () => !S.lib.length || S.lost, null, 120000); await sleep(4000); await after();
    const r = await A.evaluate(() => ({lib:S.lib.length, lost:!!(S.lost || S.g23lost), hand:S.hand.length, tgtQs:(window.__titles || []).filter(t => /choose target/.test(t)).length, titles:(window.__titles || []).filter(t => !/choose target|You may draw/.test(t)), ch:(window.__chosen || []).slice(0, 3), log:S.log.slice(-12).map(e => e.s)}));
    console.log('NIV', JSON.stringify(r), 'Kim', await life(B));
    check(!r.lost, 'Georges did not draw from an empty library');
    check(r.lib === 0 && r.hand >= 14, `the loop used the whole library (${r.lib} left, ${r.hand} in hand)`);
    check(r.log.some(s => /loop ended: your library is empty/.test(s)), 'the loop ended by pinging Niv-Mizzet / declining the draw');
    check(r.ch.some(t => /go on forever/.test(t)), 'the table asked how many times');
    await A.evaluate(() => { window.__noauto = 0; window.__noautoAfterLoop = 0; });
  });
};
