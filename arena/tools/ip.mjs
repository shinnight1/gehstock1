/* Zeigt die LAN-Adressen dieses Rechners - fuer den iPad-Test.
   Aufruf: npm run ip */
import os from 'node:os';

const treffer = [];
for (const [name, liste] of Object.entries(os.networkInterfaces())) {
  for (const netz of liste ?? []) {
    if (netz.family !== 'IPv4' || netz.internal) continue;
    treffer.push({ name, adresse: netz.address });
  }
}

if (!treffer.length) {
  console.log('Keine LAN-Adresse gefunden. Ist WLAN/LAN verbunden?');
} else {
  console.log('Vom iPad aus erreichbar unter:\n');
  for (const t of treffer) {
    console.log(`  http://${t.adresse}:5173/   (${t.name})`);
  }
  console.log('\niPad und Rechner muessen im selben WLAN sein.');
}
