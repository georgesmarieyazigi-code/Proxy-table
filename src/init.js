
/* ---------- Lobby wiring ---------- */
$('#fmtSeg').addEventListener('click', e => { const b = e.target.closest('button[data-fmt]'); if (b) setFmt(b.dataset.fmt); });
$('#loadBtn').addEventListener('click', () => loadDeck($('#deckIn').value));
{ const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small'; b.dataset.act = 'topCheck'; b.textContent = 'Check the most-played commanders'; b.title = 'Looks up the ~200 most-played Commander and Duel Commander commanders on Scryfall and lists any rules text the game can’t do yet'; $('#loadBtn').after(b); }
$('#sampleBtn').addEventListener('click', () => { $('#deckIn').value = SAMPLE_DECK; LOBBY.deckName = ''; loadDeck(SAMPLE_DECK).then(() => { if (LOBBY.deck) LOBBY.deckName = 'Krenko goblins (sample)', renderDeckSum(); }); });
$('#deckSum').addEventListener('click', e => {
  const b = e.target.closest('[data-cmd]'); if (!b) return; const k = b.dataset.cmd; const d = LOBBY.deck;
  if (d.cmd.includes(k)) fromCmd(d, k); else { if (d.cmd.length >= 2) fromCmd(d, d.cmd[0]); toCmd(d, k); }
  renderDeckSum();
});
$('#hostBtn').addEventListener('click', () => sitDown('host'));
$('#joinBtn').addEventListener('click', () => sitDown('join'));
$('#soloBtn').addEventListener('click', () => sitDown('solo'));
$('#resume').addEventListener('click', e => {
  if (e.target.id === 'resumeBtn') resumeSaved();
  else if (e.target.id === 'dropSave'){ store.del('pt.save'); showLobby(); }
  else if (e.target.id === 'backBtn'){ $('#lobby').hidden = true; $('#game').hidden = false; commit(); }
});
$('#codeIn').addEventListener('input', e => { const v = cleanCode(e.target.value); if (v !== e.target.value) e.target.value = v; });
window.addEventListener('beforeunload', () => { saveNow(); });
// leaving the page: clear my retained board at once so I don't linger as a ghost for the relay's timeout
window.addEventListener('pagehide', () => { try { if (NET.peer){ mqPublish(`${base()}/s/${MYPID}`, null); } } catch {} });
window.addEventListener('resize', () => { if (S) queueRender(); });
setInterval(engineClock, 250);

$('#nameIn').value = store.get('pt.name') || '';
const last = store.get('pt.lastDeck'); if (last) $('#deckIn').value = last;
if (typeof mqtt === 'undefined') netStatus('The multiplayer library did not load, so only solo play works right now. Check your internet and reload.', 'err');
renderSaved();
showLobby();
</script>
</body>
</html>
