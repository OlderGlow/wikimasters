// Outils communs : session WikiMasters reprise d'un jeton de renouvellement (secrets GitHub),
// requêtes avec pauses et reprises, résumé Markdown du job.
// Rien ici n'affiche de jeton ou de cookie ; le seul jeton gardé l'est chiffré, dans le cache GitHub Actions.
const fs = require('fs');
const crypto = require('crypto');

const BASE = 'https://www.wiki-masters.com';
const PROJECT = 'cyrxjeppjqsxxjayfrur';
const SUPA = `https://${PROJECT}.supabase.co`;
const SB = SUPA + '/rest/v1/';
const UA = 'wikimasters-cloud (usage personnel, peu de requêtes)';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const pause = () => sleep(2500 + Math.random() * 1000);
const req = {wikimasters: 0, wikipedia: 0, supabase: 0};

// Requête avec reprise : 3 essais espacés de 30 s puis 60 s sur 429/5xx/réseau, sinon arrêt.
async function call(kind, url, opts = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let res = null;
    try { res = await fetch(url, opts); req[kind]++; } catch (e) {}
    if (res && res.ok) return res;
    if (res && res.status < 500 && res.status !== 429) throw new Error(kind + ' HTTP ' + res.status + ' ' + (await res.text()).slice(0, 150));
    if (attempt === 2) break;
    const ra = res && Number(res.headers.get('Retry-After'));
    await sleep(ra ? ra * 1000 : 30000 * (attempt + 1));
  }
  throw new Error(kind + ' : serveur indisponible après 3 essais');
}

// Clé publique (anon) de Supabase, présente dans le code JavaScript du site.
async function anonKey() {
  const isAnon = j => { try { return JSON.parse(Buffer.from(j.split('.')[1], 'base64url')).role === 'anon'; } catch { return false; } };
  const seen = new Set();
  for (const page of ['/', '/collection']) {
    const html = await (await call('wikimasters', BASE + page, {headers: {'User-Agent': UA}})).text();
    // Chemins des scripts, y compris ceux cités (entre guillemets échappés) dans les données de la page.
    for (const [path] of html.matchAll(/\/_next\/static\/chunks\/[^"'\s\\]+?\.js/g)) {
      if (seen.has(path)) continue;
      seen.add(path);
      const js = await (await fetch(BASE + path, {headers: {'User-Agent': UA}})).text();
      const k = [...js.matchAll(/eyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{10,}/g)].map(x => x[0]).find(isAnon);
      if (k) return k;
    }
  }
  throw new Error('clé Supabase introuvable dans le code du site (le site a peut-être changé)');
}

// La connexion par mot de passe demande un captcha : on reprend donc une session ouverte une fois
// dans le navigateur, grâce à son jeton de renouvellement (refresh token).
// Supabase remplace ce jeton à chaque usage : le nouveau est gardé chiffré (clé WM_KEY) à deux endroits,
// pour l'exécution suivante :
//   - la branche `etat` du repo (fichier jeton.enc), qui n'expire jamais ;
//   - le cache GitHub Actions (fichier STATE), en secours.
// Au chargement, la copie la plus récente gagne. Le secret WM_REFRESH_TOKEN ne sert qu'au départ, ou quand
// on le remplace (son empreinte change) : réutiliser un ancien jeton ferait révoquer la session.
const STATE = '.session/jeton.enc';
const BRANCH = 'etat';
const digest = s => crypto.createHash('sha256').update(s).digest();
const seedId = seed => digest(seed).toString('hex').slice(0, 16);

// API GitHub du repo courant (dans GitHub Actions seulement).
const GH = !!(process.env.GITHUB_REPOSITORY && process.env.GITHUB_TOKEN);
const gh = (path, opts = {}) => fetch('https://api.github.com/repos/' + process.env.GITHUB_REPOSITORY + path,
  {...opts, headers: {Authorization: 'Bearer ' + process.env.GITHUB_TOKEN, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json'}});

async function readBranch() {
  if (!GH) return null;
  const r = await gh('/contents/jeton.enc?ref=' + BRANCH);
  if (!r.ok) return null;
  const f = await r.json();
  return {sha: f.sha, st: JSON.parse(Buffer.from(f.content, 'base64').toString('utf8'))};
}

async function writeBranch(text) {
  if (!GH) return;
  for (let attempt = 0; attempt < 3; attempt++) {
    // La branche est créée au premier passage, à partir de la branche par défaut.
    let ref = await gh('/git/ref/heads/' + BRANCH);
    if (ref.status === 404) {
      const repo = await (await gh('')).json();
      const head = await (await gh('/git/ref/heads/' + repo.default_branch)).json();
      await gh('/git/refs', {method: 'POST', body: JSON.stringify({ref: 'refs/heads/' + BRANCH, sha: head.object.sha})});
    }
    const cur = await readBranch();
    const r = await gh('/contents/jeton.enc', {method: 'PUT', body: JSON.stringify({message: 'Jeton de session renouvelé', branch: BRANCH,
      content: Buffer.from(text).toString('base64'), ...(cur ? {sha: cur.sha} : {})})});
    if (r.ok) return;
    await sleep(2000);
  }
  console.error('Attention : jeton non enregistré dans la branche « ' + BRANCH + ' » (le cache sert de secours).');
}

function decrypt(st, pass) {
  const d = crypto.createDecipheriv('aes-256-gcm', digest(pass), Buffer.from(st.iv, 'hex'));
  d.setAuthTag(Buffer.from(st.tag, 'hex'));
  return Buffer.concat([d.update(Buffer.from(st.data, 'hex')), d.final()]).toString('utf8');
}

async function loadToken(seed, pass) {
  const copies = [];
  if (fs.existsSync(STATE)) copies.push(JSON.parse(fs.readFileSync(STATE, 'utf8')));
  const b = await readBranch();
  if (b) copies.push(b.st);
  const best = copies.filter(st => st.seed === seedId(seed)).sort((a, b) => (b.at || 0) - (a.at || 0))[0];
  return best ? decrypt(best, pass) : seed; // aucune copie, ou secret remplacé depuis : on part du secret
}

async function saveToken(seed, pass, token) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', digest(pass), iv);
  const data = Buffer.concat([c.update(token, 'utf8'), c.final()]);
  const text = JSON.stringify({seed: seedId(seed), at: Date.now(), iv: iv.toString('hex'), tag: c.getAuthTag().toString('hex'), data: data.toString('hex')});
  fs.mkdirSync('.session', {recursive: true});
  fs.writeFileSync(STATE, text);
  await writeBranch(text);
}

// Prévient par une issue GitHub (notification par email et sur mobile) quand la session est refusée,
// et la ferme d'elle-même dès qu'une exécution se reconnecte.
const EXPIRED = 'Session WikiMasters expirée';
async function expiredIssue(open, why) {
  if (!GH) return;
  const list = await (await gh('/issues?state=open&labels=session&per_page=10')).json().catch(() => []);
  const cur = Array.isArray(list) ? list.find(i => i.title === EXPIRED) : null;
  if (open && !cur) await gh('/issues', {method: 'POST', body: JSON.stringify({title: EXPIRED, labels: ['session'],
    body: `Les workflows ne peuvent plus se connecter à WikiMasters : **${why}**.\n\nPour les relancer, recrée le jeton de session (étapes 2 à 5 de « Mise en place » dans le README) :\n\n1. connecte-toi sur wiki-masters.com dans une fenêtre de navigation privée ;\n2. copie le jeton avec la ligne de la console donnée dans le README ;\n3. ferme la fenêtre sans te déconnecter ;\n4. lance \`gh secret set WM_REFRESH_TOKEN --repo ${process.env.GITHUB_REPOSITORY}\` et colle le jeton.\n\nCette issue se fermera toute seule à la prochaine connexion réussie.`})});
  if (!open && cur) await gh('/issues/' + cur.number, {method: 'PATCH', body: JSON.stringify({state: 'closed'})});
}

// Ouvre la session et prépare les en-têtes Supabase et le cookie du site.
async function login() {
  const seed = (process.env.WM_REFRESH_TOKEN || '').trim(), pass = process.env.WM_KEY || '';
  if (!seed || !pass) throw new Error('secrets WM_REFRESH_TOKEN et WM_KEY absents : voir « Mise en place » dans le README');
  const key = await anonKey();
  const res = await fetch(SUPA + '/auth/v1/token?grant_type=refresh_token', {method: 'POST',
    headers: {apikey: key, 'Content-Type': 'application/json'}, body: JSON.stringify({refresh_token: await loadToken(seed, pass)})});
  req.supabase++;
  const sess = await res.json().catch(() => ({}));
  if (!res.ok || !sess.access_token) {
    const why = sess.error_description || sess.msg || sess.error || ('HTTP ' + res.status);
    // Une erreur serveur passagère n'est pas une session expirée.
    if (res.status >= 400 && res.status < 500) await expiredIssue(true, why).catch(() => {});
    throw new Error('session refusée : ' + why + ' → recréer le jeton WM_REFRESH_TOKEN (voir le README)');
  }
  await saveToken(seed, pass, sess.refresh_token); // tout de suite, avant toute autre requête
  await expiredIssue(false).catch(() => {});
  // Même format de cookie que le site (@supabase/ssr) : « base64- » + JSON en base64url, découpé en morceaux.
  const value = 'base64-' + Buffer.from(JSON.stringify(sess)).toString('base64url');
  const name = `sb-${PROJECT}-auth-token`;
  const parts = value.match(/.{1,3180}/g);
  const cookie = parts.length === 1 ? `${name}=${value}` : parts.map((p, i) => `${name}.${i}=${p}`).join('; ');
  return {
    uid: sess.user.id,
    sb: {apikey: key, Authorization: 'Bearer ' + sess.access_token, 'Content-Type': 'application/json'},
    site: {Cookie: cookie, 'User-Agent': UA, 'Content-Type': 'application/json'},
  };
}

// Résumé affiché sur la page du job GitHub (ou dans le terminal en local).
function summary(md) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
  console.log(md);
}

const esc = s => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

module.exports = {BASE, SB, UA, sleep, pause, req, call, anonKey, login, loadToken, saveToken, summary, esc};
