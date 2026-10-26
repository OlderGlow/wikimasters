// Vente automatique : remplit les places d'enchère libres avec des cartes C, PC ou R tirées au hasard,
// pour 30 minutes, à 80 % du prix moyen de leurs ventes. Lancé toutes les 3 h par le workflow « Vente auto ».
// Garde-fous : jamais de légendaire (ni UR/SR), de favori, de brillante, de carte en échange ou déjà en vente ;
// seulement les cartes vendues au moins 3 fois ; 40 enchères par jour au plus.
// Si le site demande une vérification humaine, le robot ouvre une issue « Vente auto en pause » et ne relance
// plus rien tant qu'elle est ouverte : la fermer (après avoir fait la vérification sur le site) le relance.
// Usage : node src/vente-auto.js [--apercu]   (--apercu : choisit les cartes sans rien mettre en vente)
const fs = require('fs');
const {BASE, SB, sleep, pause, req, call, login, summary, esc} = require('./wm');

const DRY = process.argv.includes('--apercu');
const RARITIES = ['C', 'PC', 'R'];
const REMISE = 0.8, MIN_VENTES = 3, PAR_JOUR = 40, DUREE = 30, MAX_PRIX = 25;
const STATE = '.session/vente-auto.json';
const PAUSE_TITLE = 'Vente auto en pause';
const today = () => new Date().toLocaleDateString('fr-CA', {timeZone: 'Europe/Paris'});

// Issues GitHub : signaler une pause et savoir si elle est levée.
const GH = process.env.GITHUB_REPOSITORY && process.env.GITHUB_TOKEN;
const gh = (path, opts = {}) => fetch('https://api.github.com/repos/' + process.env.GITHUB_REPOSITORY + path,
  {...opts, headers: {Authorization: 'Bearer ' + process.env.GITHUB_TOKEN, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json'}});
async function pauseIssue() {
  if (!GH) return null;
  const list = await (await gh('/issues?state=open&labels=vente-auto&per_page=10')).json();
  return Array.isArray(list) ? list.find(i => i.title === PAUSE_TITLE) || null : null;
}
async function openPause(why) {
  if (!GH || await pauseIssue()) return;
  await gh('/issues', {method: 'POST', body: JSON.stringify({title: PAUSE_TITLE, labels: ['vente-auto'],
    body: `La vente automatique s'est arrêtée : **${why}**.\n\nWikiMasters veut vérifier qu'un humain est là. Mets toi-même une carte aux enchères sur le site pour passer la vérification, puis **ferme cette issue** : la vente automatique reprendra au passage suivant.`})});
}

(async () => {
  if (await pauseIssue()) { summary('## Vente auto\n\nEn pause : l\'issue « ' + PAUSE_TITLE + ' » est ouverte. La fermer pour reprendre.'); return; }

  let st = {};
  try { st = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch {}
  if (st.day !== today()) st = {day: today(), count: 0, prices: st.prices || {}};
  st.prices = st.prices || {};
  const fresh = Date.now() - 7 * 86400000;
  for (const [k, v] of Object.entries(st.prices)) if (v.at < fresh) delete st.prices[k];
  const save = () => { fs.mkdirSync('.session', {recursive: true}); fs.writeFileSync(STATE, JSON.stringify(st)); };

  const quota = PAR_JOUR - st.count;
  if (quota <= 0) { summary(`## Vente auto\n\nPlafond du jour atteint (${PAR_JOUR} enchères).`); return; }

  const s = await login();
  const get = async url => (await call('wikimasters', BASE + url, {headers: s.site})).json();

  await pause();
  const m = await get('/api/marketplace?page=1&limit=1&mine=1');
  const selling = (m.selling || []).filter(a => !a.status || a.status === 'active');
  const free = Math.max(0, (m.maxConcurrentAuctions || 5) - selling.length);
  const n = Math.min(free, quota);
  if (!n) { summary(`## Vente auto\n\nAucune place d'enchère libre (${selling.length}/${m.maxConcurrentAuctions || 5}).`); save(); return; }
  const busy = new Set(selling.flatMap(a => [a.card_id, a.user_card_id].filter(Boolean)));

  // Cartes éligibles : C, PC ou R, ni brillante ni favorite, ni en échange ni déjà en vente.
  const rows = [];
  for (let off = 0; ; off += 1000) {
    if (off) await sleep(1500);
    const page = await (await call('supabase', SB + 'user_cards?select=id,card_id,is_shiny,starred,cards!inner(wikipedia_title,rarity)&is_shiny=eq.false&starred=eq.false&cards.rarity=in.(' + RARITIES.join(',') + ')&user_id=eq.' + s.uid,
      {headers: {...s.sb, Range: off + '-' + (off + 999)}})).json();
    rows.push(...page);
    if (page.length < 1000) break;
  }
  await pause();
  const col = await get('/api/my-collection?stats=0&page=0');
  if (!Array.isArray(col.collection)) throw new Error('réponse inattendue de /api/my-collection : session non reconnue par le site ?');
  const trade = new Set(col.pendingTradeCardIds || []);
  const pool = rows.filter(r => RARITIES.includes(r.cards?.rarity) && !busy.has(r.id) && !busy.has(r.card_id) && !trade.has(r.card_id));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }

  // Tirage : on parcourt les cartes au hasard jusqu'à en trouver n assez vendues (prix gardés 7 jours).
  const picks = [], seen = new Set();
  let lookups = 0;
  for (const r of pool) {
    if (picks.length >= n || lookups >= MAX_PRIX) break;
    if (seen.has(r.card_id)) continue;
    seen.add(r.card_id);
    let p = st.prices[r.card_id];
    if (!p) {
      await pause();
      // Certaines cartes n'ont pas de page marché (« Carte introuvable ») : on les saute.
      let sum = {};
      try { sum = (await get('/api/marketplace/cards/' + r.card_id + '/sales?scope=summary')).summary || {}; }
      catch (e) { if (!/HTTP 404/.test(e.message)) throw e; }
      p = st.prices[r.card_id] = {at: Date.now(), sum};
      lookups++;
    }
    const x = p.sum[r.cards.rarity];
    if (x && x.count >= MIN_VENTES) picks.push({id: r.id, t: r.cards.wikipedia_title, r: r.cards.rarity, avg: x.average, sales: x.count, base: Math.max(1, Math.round(x.average * REMISE))});
  }
  save();

  const listed = [];
  let stopped = null;
  if (!DRY) for (const x of picks) {
    await sleep(3000 + Math.random() * 1000);
    const res = await fetch(BASE + '/api/marketplace', {method: 'POST', headers: s.site,
      body: JSON.stringify({card_id: x.id, base_amount: x.base, duration_minutes: DUREE})});
    req.wikimasters++;
    const r = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (r.code === 'human_verification_required') { stopped = 'vérification humaine demandée par le site'; await openPause(stopped); }
      else stopped = (r.error || 'HTTP ' + res.status) + ' pour ' + x.t;
      break;
    }
    listed.push(x);
    st.count++;
    save();
  }

  const shown = DRY ? picks : listed;
  summary([
    `## Vente auto${DRY ? ' (aperçu, rien n\'a été mis en vente)' : ''}`,
    '',
    `${shown.length} carte(s) ${DRY ? 'choisie(s)' : 'mise(s) aux enchères pour ' + DUREE + ' min'} sur ${n} place(s) disponible(s). Enchères du jour : ${st.count}/${PAR_JOUR}.`,
    shown.length ? '\n| Carte | Rareté | Mise | Prix moyen | Ventes |\n|---|---|---|---|---|\n' + shown.map(x => `| ${esc(x.t)} | ${x.r} | ${x.base} | ${x.avg} | ${x.sales} |`).join('\n') : '',
    picks.length < n ? `\nSeulement ${picks.length} carte(s) assez vendue(s) trouvée(s) parmi ${lookups} prix consultés : le reste attendra le prochain passage.` : '',
    stopped ? `\n**Arrêt :** ${stopped}.` : '',
    '',
    `Requêtes : WikiMasters ${req.wikimasters}, Supabase ${req.supabase}.`,
  ].join('\n'));
  if (stopped) process.exitCode = 1;
})().catch(e => { console.error('Erreur : ' + (e.message || e)); summary('## Erreur\n\n' + (e.message || e)); process.exit(1); });
