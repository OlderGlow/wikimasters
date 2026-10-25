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
// Supabase remplace ce jeton à chaque usage : le nouveau est gardé chiffré (clé WM_KEY) dans le cache
// GitHub Actions, fichier STATE, pour l'exécution suivante. Le secret WM_REFRESH_TOKEN ne sert qu'au départ,
// ou quand on le remplace (son empreinte change) : réutiliser un ancien jeton ferait révoquer la session.
const STATE = '.session/jeton.enc';
const digest = s => crypto.createHash('sha256').update(s).digest();

function loadToken(seed, pass) {
  if (!fs.existsSync(STATE)) return seed;
  const st = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  if (st.seed !== digest(seed).toString('hex').slice(0, 16)) return seed; // secret remplacé depuis
  const d = crypto.createDecipheriv('aes-256-gcm', digest(pass), Buffer.from(st.iv, 'hex'));
  d.setAuthTag(Buffer.from(st.tag, 'hex'));
  return Buffer.concat([d.update(Buffer.from(st.data, 'hex')), d.final()]).toString('utf8');
}

function saveToken(seed, pass, token) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', digest(pass), iv);
  const data = Buffer.concat([c.update(token, 'utf8'), c.final()]);
  fs.mkdirSync('.session', {recursive: true});
  fs.writeFileSync(STATE, JSON.stringify({seed: digest(seed).toString('hex').slice(0, 16), iv: iv.toString('hex'), tag: c.getAuthTag().toString('hex'), data: data.toString('hex')}));
}

// Ouvre la session et prépare les en-têtes Supabase et le cookie du site.
async function login() {
  const seed = (process.env.WM_REFRESH_TOKEN || '').trim(), pass = process.env.WM_KEY || '';
  if (!seed || !pass) throw new Error('secrets WM_REFRESH_TOKEN et WM_KEY absents : voir « Mise en place » dans le README');
  const key = await anonKey();
  const res = await fetch(SUPA + '/auth/v1/token?grant_type=refresh_token', {method: 'POST',
    headers: {apikey: key, 'Content-Type': 'application/json'}, body: JSON.stringify({refresh_token: loadToken(seed, pass)})});
  req.supabase++;
  const sess = await res.json().catch(() => ({}));
  if (!res.ok || !sess.access_token) {
    const why = sess.error_description || sess.msg || sess.error || ('HTTP ' + res.status);
    throw new Error('session refusée : ' + why + ' → recréer le jeton WM_REFRESH_TOKEN (voir le README)');
  }
  saveToken(seed, pass, sess.refresh_token); // tout de suite, avant toute autre requête
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
  else console.log(md);
}

const esc = s => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

module.exports = {BASE, SB, UA, sleep, pause, req, call, anonKey, login, loadToken, saveToken, summary, esc};
