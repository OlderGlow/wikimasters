// Classe les cartes WikiMasters sans étiquette et écrit leurs étiquettes.
// Usage : node src/classer.js [--apercu]   (--apercu : classe sans rien écrire)
const {classify} = require('./classify');
const {BASE, SB, UA, sleep, pause, req, call, login, summary, esc} = require('./wm');

const DRY = process.argv.includes('--apercu');
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

  // Seules les cartes sans étiquette sont lues ; les pages commencent à 0.
  const cards = new Map();
  for (let page = 0; page < 100; page++) {
    await pause();
    const d = await (await call('wikimasters', BASE + '/api/my-collection?sort=rarity&untagged=1&stats=0&page=' + page, {headers: s.site})).json();
    if (!Array.isArray(d.collection)) throw new Error('réponse inattendue de /api/my-collection : session non reconnue par le site ?');
    for (const uc of d.collection) cards.set(uc.id, {t: uc.card.wikipedia_title, d: uc.card.category || ''});
    if (d.collection.length < 50) break;
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

  let written = 0;
  if (!DRY && cards.size) {
    const rows = [...cards].flatMap(([id, c]) => c.auto.map(n => ({user_card_id: id, tag_id: ids[n]})));
    for (let i = 0; i < rows.length; i += 250) {
      if (i) await pause();
      await call('supabase', SB + 'user_card_tags?on_conflict=user_card_id,tag_id', {method: 'POST',
        headers: {...s.sb, Prefer: 'resolution=ignore-duplicates,return=minimal'}, body: JSON.stringify(rows.slice(i, i + 250))});
      written = Math.min(i + 250, rows.length);
    }
  }

  const counts = {};
  for (const c of cards.values()) c.auto.forEach(t => counts[t] = (counts[t] || 0) + 1);
  const list = [...cards.values()];
  const todo = list.filter(c => c.auto.includes('à classer'));
  summary([
    `## Classement${DRY ? ' (aperçu, rien n\'a été écrit)' : ''}`,
    '',
    `- Cartes sans étiquette traitées : **${cards.size}**${DRY ? '' : ` ; étiquettes écrites : ${written}`}`,
    `- Requêtes : WikiMasters ${req.wikimasters}, Wikipédia ${req.wikipedia}, Supabase ${req.supabase}`,
    `- Répartition : ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t, n]) => t + ' ' + n).join(', ') || '—'}`,
    '',
    todo.length ? `### À classer (${todo.length})\n\n` + todo.map(c => `- ${esc(c.t)} — ${esc((c.d || c.wp || '').slice(0, 80))}`).join('\n') + '\n' : '',
    list.length ? '<details><summary>Toutes les cartes</summary>\n\n| Carte | Description | Tags |\n|---|---|---|\n' +
      list.map(c => `| ${esc(c.t)} | ${esc((c.d || c.wp || '').slice(0, 70))} | ${c.auto.join(', ')} |`).join('\n') + '\n\n</details>' : '',
  ].join('\n'));
})().catch(e => { console.error('Erreur : ' + (e.message || e)); summary('## Erreur\n\n' + (e.message || e)); process.exit(1); });
