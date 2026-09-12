/* Ein Endpunkt, identische Kampfregeln auf Browser und Server. */
(function (SG) {
  var testState=null,testPresence=null,testPending=null,testQueue=Promise.resolve();
  function testing(){return SG.gehstockmon.adminOverride===true;}
  function pendingKey() { return 'g:gehstockmon:arena-pending:' + (SG.auth.aktuell ? SG.auth.aktuell.code : 'guest'); }
  function pending() { return testing()?testPending:SG.storage.get(pendingKey(), null); }
  function actionId() { return window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2); }
  SG.gehstockmon.online = {
    pending: pending,
    resetTest:function(){testState=null;testPresence=null;testPending=null;},
    request: function (op, data, serialized) {
      if(testing()&&!serialized){var next=testQueue.then(function(){return SG.gehstockmon.online.request(op,data,true);});testQueue=next.catch(function(){});return next;}
      if (SG.offline || SG.env.file || !SG.auth.aktuell) return Promise.reject(new Error('Die Spielerwelt braucht die Online-Website und deinen Hideout-Zugang.'));
      var previous = pending(), code = SG.auth.aktuell.code, key = pendingKey();
      if (op === 'resume') {
        if (!previous) return Promise.reject(new Error('Es ist keine Aktion offen.'));
        op = previous.op;
      }
      var mutation = ['arena_start','arena_turn','arena_flee','collect','incubate','hatch','upgrade','defend'].concat(SG.gehstockmon.abenteuer?SG.gehstockmon.abenteuer.OPS:[]).indexOf(op) >= 0;
      if (mutation && previous && previous.op !== op) return Promise.reject(new Error('Prüfe zuerst die offene Aktion unter Spielerwelt.'));
      data = JSON.parse(JSON.stringify(mutation && previous ? previous.data : data || {}));
      if (mutation) {
        if (!data.requestId) data.requestId = actionId();
        if(testing())testPending={op:op,data:data};else SG.storage.set(key, { op: op, data: data });
      }
      function clearPending() {
        if (mutation && SG.auth.aktuell && SG.auth.aktuell.code === code) {if(testing())testPending=null;else SG.storage.del(key);}
      }
      var ctrl = new AbortController(), timer = setTimeout(function () { ctrl.abort(); }, op==='presence'?5000:15000);
      return fetch('/api/gehstockmon', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal: ctrl.signal,
        body: JSON.stringify(Object.assign({}, data, { testState:testing()?testState:undefined,testPresence:testing()?testPresence:undefined,op: op, code: code, name: SG.auth.aktuell.name || 'Wanderer', adminOverride: SG.gehstockmon.adminOverride === true, adminCode: SG.gehstockmon.adminOverride === true ? '3141' : undefined }))
      }).then(function (res) {
        if ((res.headers.get('content-type') || '').indexOf('json') < 0) throw new Error('Der Spielserver ist hier noch nicht erreichbar. Bitte öffne die veröffentlichte Hideout-Website.');
        return res.json().then(function (result) {
          if(testing()&&result.sandbox){if(op!=='presence')testState=result.testState;testPresence=result.testPresence;}
          if (!res.ok || result.error) {
            if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429 && res.status !== 423) clearPending();
            var error=new Error(result.error || 'Server nicht erreichbar.');error.status=res.status;error.access=result.access;throw error;
          }
          clearPending(); result.action = { op: op, territoryId: data.territoryId, squad: data.squad }; return result;
        });
      }).catch(function (err) {
        if (err.status === 423 && err.access) throw err;
        if (mutation && SG.auth.aktuell && SG.auth.aktuell.code === code && pending()) throw new Error('Antwort unbestätigt. Unter Spielerwelt → Offene Aktion prüfen erhältst du das Ergebnis, ohne erneut zu bezahlen.');
        if (err.name === 'AbortError') throw new Error('Der Server antwortet noch nicht. Bitte erneut versuchen.'); throw err;
      }).finally(function () { clearTimeout(timer); });
    }
  };
})(SG);
