// Classe les cartes WikiMasters sans étiquette et écrit leurs étiquettes.
// Usage : node src/classer.js [--apercu]   (--apercu : classe sans rien écrire)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {classify} = require('./classify');
const {SB, UA, sleep, pause, req, call, login, summary, esc} = require('./wm');

const DRY = process.argv.includes('--apercu');
const RECLASSE = '.session/reclasse.json'; // empreinte des règles lors de la dernière reprise des « à classer »
const TAGS = ['personnalité', 'musique', 'film', 'série-tv', 'littérature', 'art', 'architecture', 'guerre', 'militaire', 'histoire', 'politique', 'religion', 'mythologie', 'philosophie', 'science', 'médecine', 'technologie', 'informatique', 'jeu-vidéo', 'sport', 'bateau', 'aviation', 'automobile', 'train', 'espace', 'géographie', 'ville', 'pays', 'animal', 'plante', 'nature', 'alimentation', 'mode', 'économie', 'entreprise', 'langue', 'éducation', 'crime', 'catastrophe', 'à classer'];
const PALETTE = ['#f472b6', '#c084fc', '#a78bfa', '#818cf8', '#60a5fa', '#38bdf8', '#2dd4bf', '#4ade80', '#facc15', '#fb923c', '#fb7185', '#e879f9'];

(async () => {
  const s = await login();

  // Étiquettes : celles qui manquent sont créées (sauf en aperçu).
  const tags = await (await call('supabase', SB + 'tags?select=id,name&user_id=eq.' + s.uid, {headers: s.sb})).json();
  const ids = Object.fromEntries(tags.map(t => [t.name, t.id]));
  const missing = TAGS.filter(n => !ids[n]);
  if (missing.length && !DRY) {
    await pause();
    const made = await (await call('supabase', SB + 'tags?select=id,name', {method: 'POST', headers: {...s.sb, Prefer: 'return=representation'},
      body: JSON.stringify(missing.map((name, i) => ({user_id: s.uid, name, color: name === 'à classer' ? '#9ca3af' : PALETTE[i % PALETTE.length]})))})).json();
    made.forEach(t => ids[t.name] = t.id);
  }

  // Seules les cartes sans étiquette sont gardées. La route du site /api/my-collection?untagged=1 expire (504)
  // depuis que la collection dépasse 11 000 cartes, et une jointure équivalente dans la base aussi (500).
  // On lit donc deux listes simples, les identifiants des cartes et ceux des cartes étiquetées, puis on fait
  // la différence ici ; seules les cartes sans étiquette sont ensuite lues en détail.
  const pages = async (url, pick) => {
    const out = [];
    for (let off = 0; ; off += 1000) {
      if (off) await sleep(800);
      const page = await (await call('supabase', SB + url, {headers: {...s.sb, Range: off + '-' + (off + 999)}})).json();
      out.push(...page.map(pick));
      if (page.length < 1000) break;
    }
    return out;
  };
  const tagsOf = new Map();
  for (const r of await pages('user_card_tags?select=user_card_id,tag_id&tag_id=in.(' + Object.values(ids).join(',') + ')&order=user_card_id', r => r))
    (tagsOf.get(r.user_card_id) || tagsOf.set(r.user_card_id, new Set()).get(r.user_card_id)).add(r.tag_id);
  const untagged = (await pages('user_cards?select=id&user_id=eq.' + s.uid + '&order=id', r => r.id)).filter(id => !tagsOf.has(id));

  // Les cartes « à classer » (et seulement elles, sans autre étiquette) sont reprises quand les règles ont changé
  // depuis la dernière reprise : celles que les nouvelles règles savent ranger quittent « à classer ».
  const rulesHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'classify.js'))).digest('hex').slice(0, 12);
  let reState = {};
  try { reState = JSON.parse(fs.readFileSync(RECLASSE, 'utf8')); } catch {}
  const aClasser = ids['à classer'];
  const toRecheck = reState.hash === rulesHash ? [] : [...tagsOf].filter(([, t]) => t.size === 1 && t.has(aClasser)).map(([id]) => id);

  const cards = new Map();
  const both = [...untagged.map(id => [id, false]), ...toRecheck.map(id => [id, true])];
  for (let i = 0; i < both.length; i += 150) {
    if (i) await sleep(800);
    const chunk = new Map(both.slice(i, i + 150));
    const rows = await (await call('supabase', SB + 'user_cards?select=id,cards(wikipedia_title,category)&id=in.(' + [...chunk.keys()].join(',') + ')', {headers: s.sb})).json();
    for (const uc of rows) if (uc.cards) cards.set(uc.id, {t: uc.cards.wikipedia_title, d: uc.cards.category || '', re: chunk.get(uc.id)});
  }

  // Descriptions manquantes : première phrase Wikipédia, 20 titres par requête.
  const empty = [...cards.values()].filter(c => !c.d);
  for (let i = 0; i < empty.length; i += 20) {
    const batch = empty.slice(i, i + 20);
    const params = new URLSearchParams({action: 'query', prop: 'extracts', exintro: '1', explaintext: '1', exsentences: '1', exlimit: '20', redirects: '1', format: 'json', formatversion: '2', titles: batch.map(c => c.t).join('|')});
    const q = (await (await call('wikipedia', 'https://fr.wikipedia.org/w/api.php?' + params, {headers: {'User-Agent': UA}})).json()).query || {};
    const alias = {};
    (q.normalized || []).concat(q.redirects || []).forEach(m => alias[m.from] = m.to);
    const byTitle = Object.fromEntries((q.pages || []).map(p => [p.title, (p.extract || '').trim()]));
    for (const c of batch) { let t = c.t; for (let k = 0; k < 3 && alias[t]; k++) t = alias[t]; c.wp = byTitle[t] || ''; }
    await sleep(1200);
  }

  for (const c of cards.values()) c.auto = classify(c).tags;

  // Cartes reprises : seules celles qui quittent « à classer » changent.
  const moved = [...cards].filter(([, c]) => c.re && c.auto.join() !== 'à classer');
  for (const [id, c] of cards) if (c.re && c.auto.join() === 'à classer') cards.delete(id);

  let written = 0;
  if (!DRY && cards.size) {
    const rows = [...cards].flatMap(([id, c]) => c.auto.map(n => ({user_card_id: id, tag_id: ids[n]})));
    for (let i = 0; i < rows.length; i += 250) {
      if (i) await pause();
      await call('supabase', SB + 'user_card_tags?on_conflict=user_card_id,tag_id', {method: 'POST',
        headers: {...s.sb, Prefer: 'resolution=ignore-duplicates,return=minimal'}, body: JSON.stringify(rows.slice(i, i + 250))});
      written = Math.min(i + 250, rows.length);
    }
    for (let i = 0; i < moved.length; i += 100) {
      await pause();
      await call('supabase', SB + 'user_card_tags?tag_id=eq.' + aClasser + '&user_card_id=in.(' + moved.slice(i, i + 100).map(([id]) => id).join(',') + ')',
        {method: 'DELETE', headers: {...s.sb, Prefer: 'return=minimal'}});
    }
  }
  if (!DRY) { fs.mkdirSync(path.dirname(RECLASSE), {recursive: true}); fs.writeFileSync(RECLASSE, JSON.stringify({hash: rulesHash, at: Date.now()})); }

  const counts = {};
  const list = [...cards.values()].filter(c => !c.re);
  for (const c of list) c.auto.forEach(t => counts[t] = (counts[t] || 0) + 1);
  const todo = list.filter(c => c.auto.includes('à classer'));
  summary([
    `## Classement${DRY ? ' (aperçu, rien n\'a été écrit)' : ''}`,
    '',
    `- Cartes sans étiquette traitées : **${list.length}**${DRY ? '' : ` ; étiquettes écrites : ${written}`}`,
    toRecheck.length ? `- Cartes « à classer » reprises avec les nouvelles règles : ${toRecheck.length}, dont **${moved.length} rangées**${DRY ? ' (aperçu)' : ''}` : '- Règles inchangées : cartes « à classer » non reprises',
    `- Requêtes : WikiMasters ${req.wikimasters}, Wikipédia ${req.wikipedia}, Supabase ${req.supabase}`,
    `- Répartition : ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t, n]) => t + ' ' + n).join(', ') || '—'}`,
    '',
    moved.length ? `### Sorties de « à classer » (${moved.length})\n\n` + moved.map(([, c]) => `- ${esc(c.t)} → ${c.auto.join(', ')}`).join('\n') + '\n' : '',
    todo.length ? `### À classer (${todo.length})\n\n` + todo.map(c => `- ${esc(c.t)} — ${esc((c.d || c.wp || '').slice(0, 80))}`).join('\n') + '\n' : '',
    list.length ? '<details><summary>Toutes les cartes</summary>\n\n| Carte | Description | Tags |\n|---|---|---|\n' +
      list.map(c => `| ${esc(c.t)} | ${esc((c.d || c.wp || '').slice(0, 70))} | ${c.auto.join(', ')} |`).join('\n') + '\n\n</details>' : '',
  ].join('\n'));
})().catch(e => { console.error('Erreur : ' + (e.message || e)); summary('## Erreur\n\n' + (e.message || e)); process.exit(1); });
