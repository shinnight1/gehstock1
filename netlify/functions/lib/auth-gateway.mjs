import { auth, AuthError, authJson, change } from './auth-service.mjs';
import { roleForCode } from './auth-codes.mjs';

const equal = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
function managementUpdate(current, desired, user) {
  const next = structuredClone(current || {}), admin = user.rolle === 'A';
  if (!desired || typeof desired !== 'object' || Array.isArray(desired)) throw new AuthError('Ungültige Verwaltung.', 400);
  if (admin) {
    if (!equal(current.owner, desired.owner) && (current.owner && current.owner !== user.code || roleForCode(desired.owner) !== 'A')) throw new AuthError('Nur der Owner darf diese Rolle weitergeben.');
    const protectedCodes = new Set((current.profile || []).filter(p => p.code !== user.code && (p.code === current.owner || current.owner !== user.code && roleForCode(p.code) === 'A')).map(p => p.code));
    if (current.owner && current.owner !== user.code) protectedCodes.add(current.owner);
    for (const code of protectedCodes) {
      for (const key of ['banne', 'sperren', 'geklaert', 'geraete']) if (!equal(current[key]?.[code], desired[key]?.[code])) throw new AuthError('Dieser Admin ist geschützt.');
      const old = (current.profile || []).find(p => p.code === code), proposed = (desired.profile || []).find(p => p.code === code);
      if (!equal(old && { name: old.name, code: old.code }, proposed && { name: proposed.name, code: proposed.code })) throw new AuthError('Dieser Admin ist geschützt.');
      if ((current.bnd || []).includes(code) !== (desired.bnd || []).includes(code)) throw new AuthError('Dieser Admin ist geschützt.');
    }
    Object.assign(next, desired);
    next.profile = (next.profile || []).filter(p => roleForCode(p.code)).map(p => ({ code: p.code, name: String(p.name || '').slice(0, 40), rolle: roleForCode(p.code), t: p.t }));
  } else {
    // A player may update their own name and devices, never their role or permissions.
    const mine = (desired.profile || []).find(p => p.code === user.code);
    if (mine) {
      next.profile ||= [];
      const old = next.profile.find(p => p.code === user.code);
      if (old) old.name = String(mine.name || '').slice(0, 40);
      else next.profile.push({ code: user.code, name: String(mine.name || '').slice(0, 40), rolle: user.rolle, t: Date.now() });
    }
    if (Array.isArray(desired.geraete?.[user.code])) {
      next.geraete ||= {}; next.geraete[user.code] = desired.geraete[user.code].slice(-8);
    }
    if (user.bnd && (current.bnd || []).includes(user.code)) next.geklaert = desired.geklaert || current.geklaert;
    next.meetings = (current.meetings || []).map(meeting => {
      const proposed = (desired.meetings || []).find(m => m.id === meeting.id);
      if (!proposed || !(meeting.teilnehmer || []).includes(user.code) && meeting.von !== user.code) return meeting;
      return { ...meeting, notiz: String(proposed.notiz || '').slice(0, 400), route: Array.isArray(proposed.route) ? proposed.route.slice(0, 100) : meeting.route };
    });
  }
  return next;
}

export function protect(handler, { service = auth, kind = 'room' } = {}) {
  return async function secured(req) {
    try {
      if (req.method !== 'POST') return authJson({ error: 'POST erforderlich.' }, 405);
      const user = await service.authenticate(req);
      const raw = await req.text();
      if (raw.length > 1000000) throw new AuthError('Anfrage zu groß.', 413);
      let body; try { body = JSON.parse(raw); } catch { throw new AuthError('Ungültige Anfrage.', 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AuthError('Ungültige Anfrage.', 400);
      if (kind === 'mon') {
        if (body.code && body.code !== user.code) throw new AuthError('Dieser Spielstand gehört zu einem anderen Zugang.');
        body.code = user.code;
      } else {
        body = await service.transform(body, user, true);
        const op = body.op, admin = user.rolle === 'A', bnd = user.bnd && (user.verw.daten?.bnd || []).includes(user.code);
        const channelAllowed = name => name === 'admin' ? admin : name === 'kreis' ? user.rolle !== 'S' : ['protokoll', 'antraege', 'fehlversuche'].includes(name) ? admin || bnd : true;
        if (op?.startsWith('chat:') && !channelAllowed(String(body.brett || 'kreis').replace(/[^a-z0-9_:-]/gi, '').slice(0, 40))) throw new AuthError('Dieses Brett ist nicht für deinen Zugang freigegeben.');
        if (['befehl', 'schirm:get', 'schirm:will'].includes(op) && !admin && !bnd) throw new AuthError('Dafür fehlen dir die Rechte.');
        if (op === 'sync') {
          body.ich = { code: user.code, rolle: user.rolle, name: String(body.ich?.name || '').slice(0, 24) };
          if (!admin && !bnd) body.schirme = {};
          body.kanaele = Object.fromEntries(Object.entries(body.kanaele || {}).filter(([name]) => channelAllowed(name)));
        }
        if (['chat:post', 'chat:vote', 'schirm:put', 'pix:write', 'log'].includes(op)) { body.code = user.code; body.rolle = user.rolle; }
        if (['chat:del', 'chat:patch'].includes(op) && !admin && !bnd) {
          const name = String(body.brett || 'kreis').replace(/[^a-z0-9_:-]/gi, '').slice(0, 40);
          const channel = await service.rooms.get('kanal:' + name, { type: 'json' });
          if (channel?.nachrichten?.find(m => m.id === Number(body.id))?.code !== user.code) throw new AuthError('Du darfst nur eigene Nachrichten ändern.');
        }
        if (op === 'verw:write') {
          const result = await change(service.rooms, 'verwaltung', old => {
            old ||= { version: 0, daten: {} };
            if (admin && body.version !== old.version) throw new AuthError('Die Verwaltung wurde inzwischen geändert. Bitte neu öffnen.', 409);
            return { version: old.version + 1, daten: managementUpdate(old.daten, body.daten, user), t: Date.now() };
          });
          await change(service.rooms, 'welt', old => old ? { ...old, verw: result.version, version: (old.version || 0) + 1 } : undefined);
          return authJson(await service.transform(service.decorate(result), user));
        }
      }
      const response = await handler(new Request(req.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
      if (kind === 'mon' || !(response.headers.get('content-type') || '').includes('json')) return response;
      let result = await response.json();
      if (body.op === 'log' && user.rolle !== 'A' && !user.bnd) return authJson({ ok: response.ok }, response.status);
      if (result.verw) result.verw = service.decorate(result.verw);
      if (body.op === 'verw:read') result = service.decorate(result);
      return authJson(await service.transform(result, user), response.status);
    } catch (e) { return authJson({ error: e instanceof AuthError ? e.message : 'Der Server ist vorübergehend nicht erreichbar.' }, e.status || 503); }
  };
}
