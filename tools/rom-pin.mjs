/* Setzt die Event-PIN fuer das GehstockMon-Rom-Event. Optional: ohne PIN
   startet der CEO das Event mit einem Druck auf den Knopf.

   Auf dem Handy in Termux:
     node ~/gehstock1/tools/rom-pin.mjs

   Fragt zweimal nach der PIN (4 bis 12 Ziffern, wird nicht angezeigt) und
   legt ~/.config/gehstock1/rom.env an. Darin steht nur ein Hash - die PIN
   selbst wird nirgends gespeichert. Der laufende Server liest die Datei
   alle 15 Sekunden nach, ein Neustart ist nicht noetig.

   Die PIN gehoert zum CEO-Stuhl: Wechselt der CEO, hier eine neue setzen. */
import readline from 'node:readline';
import { writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pinVerschluesseln } from '../netlify/functions/lib/gehstockmon-rom.mjs';

function frage(text) {
  return new Promise((ok) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let stumm = false;
    rl._writeToOutput = (s) => { if (!stumm) rl.output.write(s); };
    rl.question(text, (antwort) => { rl.close(); process.stdout.write('\n'); ok(antwort.trim()); });
    stumm = true;
  });
}

const eins = await frage('Neue Event-PIN (4-12 Ziffern): ');
if (!/^\d{4,12}$/.test(eins)) { console.error('Die PIN braucht 4 bis 12 Ziffern. Nichts geändert.'); process.exit(1); }
const zwei = await frage('PIN noch einmal: ');
if (eins !== zwei) { console.error('Die beiden Eingaben stimmen nicht überein. Nichts geändert.'); process.exit(1); }
const dir = path.join(os.homedir(), '.config', 'gehstock1');
await mkdir(dir, { recursive: true });
await writeFile(path.join(dir, 'rom.env'), 'GEHSTOCK_ROM_PIN_HASH=' + pinVerschluesseln(eins) + '\n', { mode: 0o600 });
console.log('Gespeichert in ' + path.join(dir, 'rom.env') + '. Der Server übernimmt die PIN in spätestens 15 Sekunden, ein Neustart ist nicht nötig.');
