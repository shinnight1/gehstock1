import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';
import { speicher } from './speicher.mjs';
import { legacyCodes, roleForCode, serviceKey, serviceLabel } from './auth-codes.mjs';

export class AuthError extends Error { constructor(message, status = 403) { super(message); this.status = status; } }
export const authJson = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const digest = value => createHash('sha256').update(value).digest('hex');
export async function change(store, key, fn) {
  for (let i = 0; i < 32; i++) {
    const old = await store.getWithMetadata(key, { type: 'json' });
    const next = fn(structuredClone(old?.data ?? null));
    if (next === undefined) return old?.data;
    const result = await store.setJSON(key, next, old ? { onlyIfMatch: old.etag } : { onlyIfNew: true });
    if (result?.modified) return next;
  }
  throw new AuthError('Bitte versuche es gleich noch einmal.', 503);
}

export function createAuth({ sessions = speicher('hgh-auth'), rooms = speicher('hgh-rooms'), now = Date.now } = {}) {
  let identities;
  async function aliases() {
    if (!identities) {
      const record = await change(sessions, 'identity-key', old => old || { key: randomBytes(32).toString('hex') });
      identities = new Map(legacyCodes.map(code => [code, 'u' + createHmac('sha256', record.key).update(code).digest('hex').slice(0, 16)]));
    }
    return identities;
  }
  async function management() { return await rooms.get('verwaltung', { type: 'json' }) || { version: 0, daten: {} }; }
  async function limited(bucket, max, duration, consume = true) {
    await change(sessions, 'limit:' + digest(bucket), old => {
      const value = old && old.until > now() ? old : { count: 0, until: now() + duration };
      if (value.count >= max) throw new AuthError('Zu viele Versuche. Bitte warte kurz.', 429);
      if (!consume) return undefined;
      value.count++; return value;
    });
  }
  async function authenticate(req) {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
    if (!/^[a-f0-9]{64}$/.test(token)) throw new AuthError('Bitte melde dich im Hideout an.', 401);
    const key = 'session:' + digest(token), session = await sessions.get(key, { type: 'json' });
    if (!session || session.until <= now()) throw new AuthError('Deine Anmeldung ist abgelaufen. Bitte melde dich neu an.', 401);
    const verw = await management();
    if (verw.daten?.banne?.[session.code]) throw new AuthError('Dieser Zugang ist gesperrt.', 403);
    return { ...session, key, rolle: roleForCode(session.code), verw };
  }
  async function transform(value, user, incoming = false) {
    if (!incoming && user.rolle === 'A') return value;
    const mapping = await aliases();
    const lookup = incoming ? new Map([...mapping].map(([code, id]) => [id, code])) : mapping;
    const pattern = incoming ? /u[a-f0-9]{16}/g : /(?<![a-zA-Z0-9])\d{4}(?![a-zA-Z0-9])/g;
    const roomOps = new Set(['create', 'join', 'resume', 'start', 'act', 'ping', 'leave', 'poll']);
    const idFields = new Set(['code', 'codes', 'owner', 'ziel', 'von', 'bnd', 'teilnehmer', 'spiegelAn', 'brett', 'channel']);
    const idMaps = new Set(['banne', 'sperren', 'geraete', 'geklaert', 'schirme', 'spiegelV', 'stimmen', 'byCode', 'kanaele']);
    function convert(v, field, parent, scope, isKey = false) {
      if (typeof v === 'string') {
        // Room invitations are public game codes, not account credentials.
        if (v.startsWith('data:') || v.startsWith('raum:') || isKey && field === 'pixel' || field === 'code' && (scope === 'raum' || parent?.game || parent?.players || roomOps.has(parent?.op))) return v;
        const identity = isKey ? idMaps.has(field) : idFields.has(field);
        if (incoming) {
          // A client must use the public ID of a foreign account. Never let an
          // echo endpoint become a code-to-public-ID lookup oracle.
          if (identity && user.rolle !== 'A' && [...v.matchAll(/(?<![a-zA-Z0-9])\d{4}(?![a-zA-Z0-9])/g)].some(m => m[0] !== user.code)) throw new AuthError('Bitte verwende die Spielerkennung statt eines fremden Zugangscodes.');
          return v.replace(pattern, part => lookup.get(part) || part);
        }
        return v.replace(pattern, part => part === user.code ? part : identity ? lookup.get(part) || '••••' : '••••');
      }
      if (Array.isArray(v)) return v.map(item => convert(item, field, parent, scope));
      if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, item]) => [convert(k, field, v, scope, true), convert(item, k, v, field)]));
      return v;
    }
    return convert(value);
  }
  function decorate(verw) {
    const copy = structuredClone(verw);
    for (const p of copy.daten?.profile || []) { p.rolle = roleForCode(p.code) || 'S'; p.kennung = serviceLabel(p.code); }
    return copy;
  }
  async function endpoint(req) {
    try {
      if (req.method !== 'POST') return authJson({ error: 'POST erforderlich.' }, 405);
      const raw = await req.text();
      if (raw.length > 8000) throw new AuthError('Anfrage zu groß.', 413);
      let body; try { body = JSON.parse(raw); } catch { throw new AuthError('Ungültige Anfrage.', 400); }
      if (!body || typeof body !== 'object') throw new AuthError('Ungültige Anfrage.', 400);
      if (body.op === 'login') {
        const ip = (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
        const rolle = roleForCode(body.code);
        await limited('login-minute:' + ip, 12, 60000, !rolle);
        await limited('login-day:' + ip, 120, 86400000, !rolle);
        if (!rolle) throw new AuthError('Code ungültig.', 401);
        const verw = await management();
        if (verw.daten?.banne?.[body.code]) throw new AuthError('Dieser Zugang ist gesperrt.', 403);
        if (body.device && verw.daten?.geraeteBanne?.[body.device]) throw new AuthError('Dieses Gerät ist gesperrt.', 403);
        const token = randomBytes(32).toString('hex'), until = now() + 8 * 3600000;
        const session = { code: body.code, until };
        await sessions.setJSON('session:' + digest(token), session);
        const profile = (verw.daten?.profile || []).find(p => p.code === body.code);
        return authJson({ token, until, profile: { code: body.code, rolle, name: profile?.name || '', kennung: serviceLabel(body.code) }, verw: await transform(decorate(verw), { code: body.code, rolle }) });
      }
      const user = await authenticate(req);
      if (body.op === 'logout') { await sessions.delete(user.key); return authJson({ ok: true }); }
      if (body.op === 'bnd-check') {
        await limited('bnd:' + user.code, 6, 60000);
        if (!(user.verw.daten?.bnd || []).includes(user.code) || body.value !== serviceKey(user.code)) throw new AuthError('Dienstschlüssel falsch.');
        await sessions.setJSON(user.key, { code: user.code, until: user.until, bnd: true });
        return authJson({ ok: true });
      }
      if (user.rolle !== 'A') throw new AuthError('Nur Admins dürfen Zugangscodes verwalten.');
      if (body.op === 'bnd-key' && roleForCode(body.code)) return authJson({ value: serviceKey(body.code) });
      if (body.op === 'create') {
        if (!['S', 'K', 'A'].includes(body.role) || typeof body.name !== 'string' || body.name.trim().length < 2) throw new AuthError('Name und Rolle fehlen.', 400);
        let code;
        const verw = await change(rooms, 'verwaltung', old => {
          const next = old || { version: 0, daten: {} };
          next.daten.profile ||= [];
          const free = legacyCodes.filter(c => roleForCode(c) === body.role && !next.daten.profile.some(p => p.code === c) && !next.daten.banne?.[c]);
          if (!free.length) throw new AuthError('Für diese Rolle ist kein Code mehr frei.', 409);
          code = free[randomInt(free.length)];
          next.daten.profile.unshift({ code, name: body.name.trim().slice(0, 40), rolle: body.role, t: now() });
          next.version++; next.t = now(); return next;
        });
        return authJson({ code, verw: decorate(verw) });
      }
      throw new AuthError('Unbekannte Aktion.', 400);
    } catch (e) { return authJson({ error: e instanceof AuthError ? e.message : 'Die Anmeldung ist vorübergehend nicht erreichbar.' }, e.status || 503); }
  }
  return { endpoint, authenticate, transform, decorate, management, rooms };
}
export const auth = createAuth();
