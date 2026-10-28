// Défausse les cartes WikiMasters étiquetées « à classer » (+1 wikibidou par carte, la carte est perdue).
// Deux temps, jamais en une seule exécution :
//   node src/defausser.js                       → aperçu : liste, nombre et code de confirmation, n'écrit rien ;
//   node src/defausser.js --nombre N --code C   → défausse, seulement si la liste est exactement celle de l'aperçu.
// Le code est une empreinte de la liste : si une carte a été ajoutée, retirée ou reclassée entre-temps, il change et rien n'est défaussé.
const crypto = require('crypto');
const {BASE, SB, sleep, pause, req, call, login, tradeIds, summary, esc} = require('./wm');

const arg = name => { const i = process.argv.indexOf('--' + name); return i > 0 ? (process.argv[i + 1] || '').trim() : ''; };
const NOMBRE = arg('nombre'), CODE = arg('code').toLowerCase();
const TAG = arg('etiquette') || 'à classer';
const RARE = ['L', 'UR', 'SR', 'R']; // les R se vendent souvent plus d'un wikibidou au marché

(async () => {
  const s = await login();
  const tag = (await (await call('supabase', SB + 'tags?select=id,name&user_id=eq.' + s.uid, {headers: s.sb})).json()).find(t => t.name === TAG);
  if (!tag) throw new Error('étiquette « ' + TAG + ' » introuvable');
  const rows = [];
  for (let off = 0; ; off += 1000) {
    await sleep(2000);
    const page = await (await call('supabase', SB + 'user_card_tags?select=user_card_id,user_cards(id,starred,count,is_shiny,card_id,cards(wikipedia_title,rarity,category))&tag_id=eq.' + tag.id,
      {headers: {...s.sb, Range: off + '-' + (off + 999)}})).json();
    rows.push(...page);
    if (page.length < 1000) break;
  }
  // Cartes engagées dans un échange : le site refuse de les défausser.
  await pause();
  const trade = await tradeIds(s.site);

  const cards = rows.map(x => x.user_cards && {id: x.user_card_id, card_id: x.user_cards.card_id, t: x.user_cards.cards?.wikipedia_title || '?',
    r: x.user_cards.cards?.rarity, d: x.user_cards.cards?.category || '', starred: x.user_cards.starred, count: x.user_cards.count || 1, shiny: x.user_cards.is_shiny}).filter(Boolean);
  // Garde-fous : jamais les favoris, échanges, cartes rares, brillantes ou en plusieurs exemplaires.
  const why = c => c.starred ? 'favori' : trade.has(c.card_id) ? 'échange en cours' : RARE.includes(c.r) ? 'rareté ' + c.r
    : c.shiny ? 'brillante' : c.count > 1 ? c.count + ' exemplaires' : null;
  const kept = cards.filter(why);
  const ok = cards.filter(c => !why(c)).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const code = crypto.createHash('sha256').update(ok.map(c => c.id).join(',')).digest('hex').slice(0, 8);
  const byRarity = ok.reduce((m, c) => (m[c.r] = (m[c.r] || 0) + 1, m), {});

  if (!NOMBRE && !CODE) {
    summary([
      `## Aperçu de la défausse « ${TAG} »`,
      '',
      ok.length ? `**${ok.length} cartes** à défausser (${Object.entries(byRarity).map(([r, n]) => n + ' ' + r).join(', ')}), soit **${ok.length} wikibidous**. La défausse est **définitive**.` : 'Aucune carte à défausser.',
      '',
      ok.length ? `Pour confirmer, relance le workflow **Défausser** avec **nombre = \`${ok.length}\`** et **code = \`${code}\`**.` : '',
      '',
      ok.length ? '| Carte | Rareté | Description |\n|---|---|---|\n' + ok.map(c => `| ${esc(c.t)} | ${c.r} | ${esc(c.d.slice(0, 70))} |`).join('\n') : '',
      '',
      kept.length ? `### Protégées (${kept.length})\n\n` + kept.map(c => `- ${esc(c.t)} (${why(c)})`).join('\n') : '',
      '',
      `Requêtes : WikiMasters ${req.wikimasters}, Supabase ${req.supabase}.`,
    ].join('\n'));
    return;
  }

  if (Number(NOMBRE) !== ok.length || CODE !== code)
    throw new Error(`confirmation refusée : nombre ${NOMBRE || '—'} / code ${CODE || '—'}, alors que la liste actuelle compte ${ok.length} cartes (code ${code}). Rien n'a été défaussé : relance un aperçu.`);

  let discarded = 0; const failed = [];
  for (let i = 0; i < ok.length; i += 50) {
    if (i) await sleep(3000 + Math.random() * 1000);
    const r = await (await call('wikimasters', BASE + '/api/user-cards/bulk-discard', {method: 'POST', headers: s.site,
      body: JSON.stringify({card_ids: ok.slice(i, i + 50).map(c => c.id)})})).json();
    discarded += r.discarded_count || 0;
    failed.push(...(r.failed || []));
  }
  summary([
    `## Défausse « ${TAG} »`,
    '',
    `**${discarded} cartes défaussées**, soit ${discarded} wikibidous.${failed.length ? ` Échecs : ${failed.length}.` : ''}`,
    failed.length ? '\n```\n' + JSON.stringify(failed, null, 1).slice(0, 3000) + '\n```' : '',
    '',
    `Requêtes : WikiMasters ${req.wikimasters}, Supabase ${req.supabase}.`,
  ].join('\n'));
  if (failed.length) process.exitCode = 1;
})().catch(e => { console.error('Erreur : ' + (e.message || e)); summary('## Erreur\n\n' + (e.message || e)); process.exit(1); });
