// Outils communs : session WikiMasters ouverte avec email + mot de passe (secrets GitHub),
// requêtes avec pauses et reprises, résumé Markdown du job.
// Rien ici n'affiche ni n'enregistre de mot de passe, de jeton ou de cookie.
const fs = require('fs');

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

// Ouvre une session avec WM_EMAIL / WM_PASSWORD et prépare les en-têtes Supabase et le cookie du site.
async function login() {
  const email = process.env.WM_EMAIL, password = process.env.WM_PASSWORD;
  if (!email || !password) throw new Error('secrets WM_EMAIL et WM_PASSWORD absents : les ajouter dans Settings → Secrets and variables → Actions');
  const key = await anonKey();
  const res = await fetch(SUPA + '/auth/v1/token?grant_type=password', {method: 'POST',
    headers: {apikey: key, 'Content-Type': 'application/json'}, body: JSON.stringify({email, password})});
  req.supabase++;
  const sess = await res.json().catch(() => ({}));
  if (!res.ok || !sess.access_token) {
    const why = sess.error_description || sess.msg || sess.error || ('HTTP ' + res.status);
    throw new Error('connexion refusée : ' + why + (/captcha/i.test(why) ? ' (le site exige un captcha : connexion automatique impossible)' : ''));
  }
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

module.exports = {BASE, SB, UA, sleep, pause, req, call, anonKey, login, summary, esc};
