// Met aux enchères les exemplaires en trop des cartes possédées plusieurs fois, au prix moyen de leurs ventes.
// Deux temps, jamais en une seule exécution :
//   node src/vendre.js                       → aperçu : liste, mises, nombre et code de confirmation, n'écrit rien ;
//   node src/vendre.js --nombre N --code C   → mise en vente, seulement si la liste (cartes et mises) est celle de l'aperçu.
// Options : --duree MIN (10, 30, 60, 180, 360 ou 720 ; 720 par défaut), --tous (inclure les jamais vendues, mise 1).
const crypto = require('crypto');
const {BASE, SB, sleep, pause, req, call, login, tradeIds, summary, esc} = require('./wm');

const arg = name => { const i = process.argv.indexOf('--' + name); return i > 0 ? (process.argv[i + 1] || '').trim() : ''; };
const NOMBRE = arg('nombre'), CODE = arg('code').toLowerCase();
const DUREE = [10, 30, 60, 180, 360, 720].includes(Number(arg('duree'))) ? Number(arg('duree')) : 720;
const TOUS = process.argv.includes('--tous');

(async () => {
  const s = await login();
  const get = async url => (await call('wikimasters', BASE + url, {headers: s.site})).json();

  // Chaque exemplaire est une ligne à part dans user_cards : un doublon = plusieurs lignes pour la même carte.
  const rows = [];
  for (let off = 0; ; off += 1000) {
    if (off) await sleep(2000);
    const page = await (await call('supabase', SB + 'user_cards?select=id,card_id,is_shiny,starred,cards(wikipedia_title,rarity)&user_id=eq.' + s.uid,
      {headers: {...s.sb, Range: off + '-' + (off + 999)}})).json();
    rows.push(...page);
    if (page.length < 1000) break;
  }

  // Enchères en cours (places libres) et cartes engagées dans un échange.
  await pause();
  const m = await get('/api/marketplace?page=1&limit=1&mine=1');
  const selling = (m.selling || []).filter(a => !a.status || a.status === 'active');
  const max = m.maxConcurrentAuctions || 5, free = Math.max(0, max - selling.length);
  const busy = new Set(selling.flatMap(a => [a.card_id, a.user_card_id].filter(Boolean)));
  await pause();
  const trade = await tradeIds(s.site);

  const groups = {};
  for (const r of rows) (groups[r.card_id] = groups[r.card_id] || []).push(r);
  const kept = [], spares = [];
  for (const g of Object.values(groups).filter(g => g.length > 1)) {
    const t = g[0].cards?.wikipedia_title || '?', rar = g[0].cards?.rarity;
    if (trade.has(g[0].card_id)) { kept.push(t + ' (échange en cours)'); continue; }
    // On garde toujours un exemplaire normal ; jamais de brillante, de favori ni de carte déjà en vente.
    const normal = g.filter(r => !r.is_shiny && !r.starred && !busy.has(r.id) && !busy.has(r.card_id));
    const n = normal.length - (g.some(r => !r.is_shiny && (r.starred || busy.has(r.id))) ? 0 : 1);
    if (n < 1) { kept.push(t + ' (exemplaires brillants, favoris ou déjà en vente)'); continue; }
    normal.slice(0, n).forEach(r => spares.push({id: r.id, card_id: r.card_id, t, r: rar}));
  }

  // Prix : résumé des ventes de chaque carte en double, même rareté.
  const price = {};
  for (const c of [...new Set(spares.map(x => x.card_id))]) {
    await pause();
    // Certaines cartes n'ont pas de page marché (« Carte introuvable ») : on les compte comme jamais vendues.
    try { price[c] = (await get('/api/marketplace/cards/' + c + '/sales?scope=summary')).summary || {}; }
    catch (e) { if (!/HTTP 404/.test(e.message)) throw e; price[c] = {}; }
  }
  const unsold = [], all = [];
  for (const x of spares) {
    const st = price[x.card_id][x.r];
    if (st && st.count) all.push({...x, base: Math.max(1, Math.round(st.average)), avg: st.average, sales: st.count, latest: st.latest});
    else if (TOUS) all.push({...x, base: 1, avg: null, sales: 0, latest: null});
    else unsold.push(x);
  }
  all.sort((a, b) => b.base - a.base || String(a.id).localeCompare(String(b.id)));
  // À la confirmation, on reprend les N premières cartes de l'aperçu : une enchère terminée entre-temps libère
  // une place sans invalider le code. S'il y a moins de places que N, la liste change et le code ne correspond plus.
  const n = NOMBRE && Number(NOMBRE) <= free ? Number(NOMBRE) : free;
  const items = all.slice(0, n), overflow = all.slice(n);
  // Le code couvre les cartes, leurs mises et la durée : si l'un change, la confirmation ne vaut plus.
  const code = crypto.createHash('sha256').update(items.map(x => x.id + ':' + x.base).join(',') + '|' + DUREE).digest('hex').slice(0, 8);
  const total = items.reduce((t, x) => t + x.base, 0);
  const h = DUREE >= 60 ? DUREE / 60 + ' h' : DUREE + ' min';

  if (!NOMBRE && !CODE) {
    summary([
      '## Aperçu de la vente des doublons',
      '',
      items.length ? `**${items.length} cartes** à mettre aux enchères pendant ${h}, pour **${total} WikiCoins** de mises de départ (minimum gagné si chaque carte trouve preneur, sans garantie). Places d'enchère libres : ${free}/${max}.` : `Aucun doublon à mettre en vente. Places d'enchère libres : ${free}/${max}.`,
      '',
      items.length ? `Pour confirmer, relance le workflow **Vendre les doublons** avec **nombre = \`${items.length}\`**, **code = \`${code}\`** et la même durée${TOUS ? ' (et la case « tous » cochée)' : ''}.` : '',
      '',
      items.length ? '| Carte | Rareté | Mise | Prix moyen | Ventes | Dernière |\n|---|---|---|---|---|---|\n' + items.map(x => `| ${esc(x.t)} | ${x.r} | ${x.base} | ${x.avg ?? '—'} | ${x.sales} | ${x.latest ?? '—'} |`).join('\n') : '',
      '',
      overflow.length ? `### Hors places libres (${overflow.length})\n\n` + overflow.map(x => `- ${esc(x.t)} (mise ${x.base})`).join('\n') : '',
      unsold.length ? `\n### Jamais vendues (${unsold.length}, ajoutées avec « tous »)\n\n` + unsold.map(x => `- ${esc(x.t)} (${x.r})`).join('\n') : '',
      kept.length ? `\n### Gardées (${kept.length})\n\n` + kept.map(t => '- ' + esc(t)).join('\n') : '',
      '',
      `Requêtes : WikiMasters ${req.wikimasters}, Supabase ${req.supabase}.`,
    ].join('\n'));
    return;
  }

  if (Number(NOMBRE) !== items.length || CODE !== code)
    throw new Error(`confirmation refusée : nombre ${NOMBRE || '—'} / code ${CODE || '—'}, alors que la liste actuelle compte ${items.length} cartes (code ${code}). Rien n'a été mis en vente : relance un aperçu.`);

  const listed = [];
  let stopped = null;
  for (const x of items) {
    await sleep(3000 + Math.random() * 1000);
    const res = await fetch(BASE + '/api/marketplace', {method: 'POST', headers: s.site,
      body: JSON.stringify({card_id: x.id, base_amount: x.base, duration_minutes: DUREE})});
    req.wikimasters++;
    const r = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Le site demande parfois une vérification humaine : seul l'utilisateur peut la faire, sur le site.
      stopped = r.code === 'human_verification_required'
        ? 'le site demande une vérification humaine : mets toi-même une carte aux enchères sur le site, puis relance un aperçu'
        : (r.error || 'HTTP ' + res.status) + ' pour ' + x.t;
      break;
    }
    listed.push(x);
  }
  summary([
    '## Vente des doublons',
    '',
    `**${listed.length}/${items.length} cartes** mises aux enchères pendant ${h}, pour ${listed.reduce((t, x) => t + x.base, 0)} WikiCoins de mises de départ.`,
    '',
    listed.map(x => `- ${esc(x.t)} — mise ${x.base}`).join('\n'),
    stopped ? `\n**Arrêt :** ${stopped}.` : '',
    '',
    `Requêtes : WikiMasters ${req.wikimasters}, Supabase ${req.supabase}.`,
  ].join('\n'));
  if (stopped) process.exitCode = 1;
})().catch(e => { console.error('Erreur : ' + (e.message || e)); summary('## Erreur\n\n' + (e.message || e)); process.exit(1); });
