// Défausse les cartes WikiMasters étiquetées « à classer » (+1 wikibidou par carte, la carte est perdue).
//   node src/defausser.js            → défausse directe ;
//   node src/defausser.js --apercu   → liste seulement, n'écrit rien.
const {BASE, SB, sleep, pause, req, call, login, tradeIds, summary, esc} = require('./wm');

const arg = name => { const i = process.argv.indexOf('--' + name); return i > 0 ? (process.argv[i + 1] || '').trim() : ''; };
const APERCU = process.argv.includes('--apercu');
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
  const byRarity = ok.reduce((m, c) => (m[c.r] = (m[c.r] || 0) + 1, m), {});

  const table = ok.length ? '| Carte | Rareté | Description |\n|---|---|---|\n' + ok.map(c => `| ${esc(c.t)} | ${c.r} | ${esc(c.d.slice(0, 70))} |`).join('\n') : '';
  const protectedList = kept.length ? `### Protégées (${kept.length})\n\n` + kept.map(c => `- ${esc(c.t)} (${why(c)})`).join('\n') : '';

  if (APERCU) {
    summary([
      `## Aperçu de la défausse « ${TAG} »`,
      '',
      ok.length ? `**${ok.length} cartes** seraient défaussées (${Object.entries(byRarity).map(([r, n]) => n + ' ' + r).join(', ')}), soit **${ok.length} wikibidous**. Rien n'a été défaussé.` : 'Aucune carte à défausser.',
      '',
      table,
      '',
      protectedList,
      '',
      `Requêtes : WikiMasters ${req.wikimasters}, Supabase ${req.supabase}.`,
    ].join('\n'));
    return;
  }

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
    ok.length ? `**${discarded} cartes défaussées**, soit ${discarded} wikibidous.${failed.length ? ` Échecs : ${failed.length}.` : ''}` : 'Aucune carte à défausser.',
    failed.length ? '\n```\n' + JSON.stringify(failed, null, 1).slice(0, 3000) + '\n```' : '',
    '',
    table,
    '',
    protectedList,
    '',
    `Requêtes : WikiMasters ${req.wikimasters}, Supabase ${req.supabase}.`,
  ].join('\n'));
  if (failed.length) process.exitCode = 1;
})().catch(e => { console.error('Erreur : ' + (e.message || e)); summary('## Erreur\n\n' + (e.message || e)); process.exit(1); });
