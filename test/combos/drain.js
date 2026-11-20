// Edgar-style life-drain loops: each one starts from a single life change and must run until every opponent is at 0, by itself.
module.exports = async ({A, B, check, sleep, waitFor, after, fresh, putP, pool, life, lost, noNotes, step}) => {
  const drain = async (name, pieces, kick) => step(name, async () => {
    await fresh(); await B.evaluate(() => { S.life = 12; commit(); }); await sleep(1500);
    for (const p of pieces) check(!!(await putP(A, p)), `${p} on the battlefield`);
    await A.evaluate(() => { window.__tgt = 'kim'; }); await sleep(500);
    await kick(); await after();
    const ok = await waitFor(B, () => S.life <= 0, null, 150000); await after();
    const [a, b, bl] = [await life(A), await life(B), await lost(B)];
    check(ok && b <= 0, `${name}: the loop runs by itself until Kim is at 0 (Kim ${b}, Georges ${a})`);
    check(bl, `${name}: Kim has lost the game`);
    check(await waitFor(A, () => !stackAll().length && !UI.resolving, null, 30000), `${name}: the loop stops once nobody is left to drain`);
    await noNotes(name);
  });
  const kimLoses1 = () => B.evaluate(() => { damageMe(1, {}, 'test'); commit(); });
  const iGain1 = () => A.evaluate(() => { gainLife(1, 'test'); commit(); });
  await drain('D1 Sanguine Bond + Exquisite Blood', ['Sanguine Bond', 'Exquisite Blood'], iGain1);
  await drain('D2 Vito + Exquisite Blood', ['Vito, Thorn of the Dusk Rose', 'Exquisite Blood'], kimLoses1);
  await drain('D3 Vito + Bloodthirsty Conqueror', ['Vito, Thorn of the Dusk Rose', 'Bloodthirsty Conqueror'], kimLoses1);
  await drain('D4 Bloodthirsty Conqueror + Sanguine Bond', ['Bloodthirsty Conqueror', 'Sanguine Bond'], kimLoses1);
};
