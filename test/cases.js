// Vérifie src/classify.js sur test/cases.txt (titre | description | tags attendus).
const fs = require('fs');
const path = require('path');
const {classify} = require('../src/classify');

let fails = 0, n = 0;
for (const line of fs.readFileSync(path.join(__dirname, 'cases.txt'), 'utf8').split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  const [t, d, want] = line.split('|').map(s => s.trim());
  const got = classify({t, d}).tags.join(', ');
  n++;
  if (got !== want) { fails++; console.log('ÉCHEC  ' + t + '\n       attendu : ' + want + '\n       obtenu  : ' + got); }
}
console.log((n - fails) + '/' + n + ' cas réussis');
process.exit(fails ? 1 : 0);
