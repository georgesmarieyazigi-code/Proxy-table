
/* =================== fix18: hidden information in the public state ===================
   Every client subscribes to the whole table, so anything in publicState / enginePublic is readable by every player.
   Data meant for one player only (a Mindslaver controller's view of the hand, a q24 question or library list for one player,
   Xanathar's top card) is sealed for that player: each client makes an ECDH P-256 key pair and publishes the public half
   (r18pk); a pair of players derives the same AES-GCM key, so only the recipient can open the payload.
   r18Seal / r18Open are synchronous lookups into caches that fill asynchronously (publishing / rendering again when ready). */
const R18 = {kp:null, pub:'', keys:new Map(), sealed:new Map(), opened:new Map(), busy:new Map()};
const r18b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
const r18u8 = b => Uint8Array.from(atob(b), c => c.charCodeAt(0));
const r18Ok = () => !!(window.crypto && crypto.subtle);
R18.ready = (async () => { try { if (!r18Ok()) return;
  R18.kp = await crypto.subtle.generateKey({name:'ECDH', namedCurve:'P-256'}, false, ['deriveKey']);
  R18.pub = r18b64(new Uint8Array(await crypto.subtle.exportKey('raw', R18.kp.publicKey)));
  if (typeof queuePublish === 'function') queuePublish(); } catch (e){ console.warn('r18 keys', e); R18.kp = null; R18.failed = true; } })();
function r18PeerPk(pid){ const st = OPP.get(pid); return st && typeof st.r18pk === 'string' ? st.r18pk : ''; }
// a peer whose board has no key runs an older build (or a browser without WebCrypto): fall back to plain data for it
function r18Legacy(pid){ return !r18Ok() || R18.failed || (OPP.has(pid) && !r18PeerPk(pid)); }
function r18Key(pid){ const pk = r18PeerPk(pid); if (!pk || !R18.kp) return null; const id = pid + '|' + pk; if (R18.keys.has(id)) return R18.keys.get(id);
  const p = (async () => { const pub = await crypto.subtle.importKey('raw', r18u8(pk), {name:'ECDH', namedCurve:'P-256'}, false, []);
    return crypto.subtle.deriveKey({name:'ECDH', public:pub}, R18.kp.privateKey, {name:'AES-GCM', length:256}, false, ['encrypt', 'decrypt']); })();
  p.catch(() => R18.keys.delete(id)); R18.keys.set(id, p); return p; }
function r18Trim(m){ if (m.size > 300) [...m.keys()].slice(0, m.size - 200).forEach(k => m.delete(k)); }
// → Promise of {e} (sealed for `to`), {p} (legacy peer: plain), or null (no key yet)
async function r18SealAsync(to, text){
  if (r18Legacy(to)) return {p:text};
  await R18.ready; const id = to + '\u0001' + r18PeerPk(to) + '\u0001' + text; if (R18.sealed.has(id)) return R18.sealed.get(id);
  if (R18.busy.has(id)) return R18.busy.get(id);
  const job = (async () => { try { const key = await r18Key(to); if (!key) return null; const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, new TextEncoder().encode(text)));
      const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); const r = {e:r18b64(out)}; R18.sealed.set(id, r); r18Trim(R18.sealed); return r; }
    catch (e){ console.warn('r18 seal', e); return null; } finally { R18.busy.delete(id); } })();
  R18.busy.set(id, job); return job; }
function r18Seal(to, text){
  if (r18Legacy(to)) return {p:text};
  const id = to + '\u0001' + r18PeerPk(to) + '\u0001' + text; if (R18.sealed.has(id)) return R18.sealed.get(id);
  if (!R18.busy.has(id)) r18SealAsync(to, text).then(r => { if (r && r.e) queuePublish(); });
  return null; }
async function r18OpenAsync(from, e){
  const id = from + '\u0001' + e; if (R18.opened.has(id)) return R18.opened.get(id);
  try { await R18.ready; const key = await r18Key(from); if (!key) return null; const b = r18u8(e);
    const pt = await crypto.subtle.decrypt({name:'AES-GCM', iv:b.slice(0, 12)}, key, b.slice(12)); const t = new TextDecoder().decode(pt);
    R18.opened.set(id, t); r18Trim(R18.opened); return t; } catch { return null; } }
function r18Open(from, e, then){ const id = from + '\u0001' + e; if (R18.opened.has(id)) return R18.opened.get(id);
  r18OpenAsync(from, e).then(t => { if (t != null){ try { then && then(t); } catch {} queueRender(); } }); return null; }
{
  const ep = enginePublic; enginePublic = function(){ const o = ep(); try { if (R18.pub) o.r18pk = R18.pub; } catch {} return o; };
  const se = sanitizeEngine; sanitizeEngine = function(s){ const o = se(s); try { o.r18pk = typeof s.r18pk === 'string' && /^[A-Za-z0-9+/=]{60,120}$/.test(s.r18pk) ? s.r18pk : '';
    // sealed q24 entries ({ref, to, e}) are kept as they are; plain ones went through engine24q's sanitizer
    if (Array.isArray(s.q24)) o.q24 = s.q24.slice(-6).map(x => { if (!x || typeof x !== 'object') return null; const ref = String(x.ref || '').slice(0, 16);
      if (typeof x.e === 'string') return {ref, to:String(x.to || '').slice(0, 40), e:x.e.slice(0, 12000)}; return (o.q24 || []).find(y => y.ref === ref) || null; }).filter(Boolean); } catch {} return o; };
}
// q24 entries addressed to one player go out sealed; an entry still being sealed is left out until it is ready
function r18PubQ24(list){ const out = [];
  for (const x of list || []){ if (!x.to){ out.push({ref:x.ref, d:x.d, ks:x.ks}); continue; }
    const s = r18Seal(x.to, JSON.stringify({d:x.d, ks:x.ks})); if (!s) continue; out.push(s.e ? {ref:x.ref, to:x.to, e:s.e} : {ref:x.ref, d:x.d, ks:x.ks}); }
  return out; }
async function r18PubReady(ref){ const x = (S.q24pub || []).find(y => y.ref === ref); if (!x || !x.to) return; await r18SealAsync(x.to, JSON.stringify({d:x.d, ks:x.ks})); }
function r18Q24Plain(t, ref){ try { const o = JSON.parse(t); return {ref, d:String(o.d || '').slice(0, 300), ks:(Array.isArray(o.ks) ? o.ks.slice(0, 80) : []).filter(k => typeof k === 'string').map(k => k.slice(0, 80))}; } catch { return null; } }
{
  const qp = q24PubOf;
  q24PubOf = function(pid, ref){ const x = qp(pid, ref); if (!x || typeof x.e !== 'string') return x; if (x.to !== MYPID) return null; const t = r18Open(pid, x.e); return t == null ? null : r18Q24Plain(t, ref); };
}
async function q24PubGet(pid, ref){ const x = ((OPP.get(pid) || {}).q24 || []).find(y => y.ref === ref); if (!x) return null; if (typeof x.e !== 'string') return x; if (x.to !== MYPID) return null;
  const t = await r18OpenAsync(pid, x.e); return t == null ? null : r18Q24Plain(t, ref); }

/* ---------- Xanathar, Guild Kingpin: only the Xanathar player may see the top card ---------- */
{
  const ps = publicState;
  publicState = function(){ const o = ps(); try { const x = o.c27xtop; if (x && x.k){ const s = r18Seal(x.to, x.k); if (!s) delete o.c27xtop; else if (s.e) o.c27xtop = {t:x.t, to:x.to, e:s.e}; } } catch { delete o.c27xtop; } return o; };
  const ss = sanitizeState;
  sanitizeState = function(st){ const r = ss(st); try { if (r && st && st.c27xtop && typeof st.c27xtop === 'object' && typeof st.c27xtop.e === 'string' && r.c27xtop){
      const e = st.c27xtop.e.slice(0, 400); r.c27xtop.e = e; r.c27xtop.k = '';
      if (r.c27xtop.to === MYPID) r.c27xtop.k = r18XanOpen(r.c27xtop, e) || ''; } } catch {} return r; };
}
// the sender's pid isn't inside the state: it is the player Xanathar targeted (S.c27xan.pid)
function r18XanOpen(top, e){ const x = S && S.c27xan; const from = x && x.pid; if (!from) return '';
  return r18Open(from, e, t => { const st = OPP.get(from); if (st && st.c27xtop && st.c27xtop.e === e) st.c27xtop.k = t; }) || ''; }
