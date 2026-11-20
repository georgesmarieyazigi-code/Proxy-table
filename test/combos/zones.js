module.exports = async ({A, check, fresh, step}) => {
  await step('Z2 a card exiled face down comes back face up', async () => { await fresh();
    const r = await A.evaluate(async () => { const c = S.lib.find(x => cname(x) === 'Sol Ring'); moveCard(c.id, 'ex', {quiet:true}); c.fd = true; moveCard(c.id, 'hand', {quiet:true}); const h = S.hand.find(x => x.id === c.id); const fdHand = !!(h && h.fd); moveCard(c.id, 'bf', {quiet:true}); const b = S.bf.find(x => x.id === c.id); return {fdHand, fdBf:!!(b && b.fd)}; });
    check(!r.fdHand && !r.fdBf, 'Sol Ring exiled face down, then put in hand and onto the battlefield, is face up (' + JSON.stringify(r) + ')'); });
};
