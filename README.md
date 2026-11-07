# WikiMasters dans le cloud

Ce repo fait tourner sur GitHub Actions trois commandes pour ta collection [WikiMasters](https://www.wiki-masters.com) : le classement des nouvelles cartes, la défausse des cartes « à classer » et la vente des doublons. C'est la même logique que les commandes Claude Code `/classer-wiki-masters`, `/defausser-cartes` et `/vendre-doublons`, mais sans navigateur : le workflow reprend une session WikiMasters que tu as ouverte une fois, grâce à un jeton gardé dans les secrets du repo.

## Mise en place (une seule fois)

La connexion par mot de passe de WikiMasters demande un captcha : un robot ne peut pas l'ouvrir. Le workflow reprend donc une **session ouverte une fois par toi** dans le navigateur, grâce à son jeton de renouvellement. Ensuite, il renouvelle ce jeton tout seul à chaque exécution. Il garde le nouveau jeton chiffré, avec la clé `WM_KEY`, dans la branche `etat` du repo, qui n'expire pas, et dans le cache GitHub Actions en secours.

1. Crée la clé de chiffrement. La commande génère une clé au hasard et l'enregistre sans l'afficher :
   ```bash
   openssl rand -hex 32 | gh secret set WM_KEY --repo OlderGlow/wikimasters
   ```
2. Dans Chrome, ouvre une **fenêtre de navigation privée** et connecte-toi sur [wiki-masters.com](https://www.wiki-masters.com/collection). Comme cette session est distincte de ta session habituelle, la renouveler ne te déconnecte pas ailleurs.
3. Dans cette fenêtre, ouvre la console (**⌥⌘J**), colle la ligne suivante et appuie sur Entrée. Si Chrome refuse de coller, tape d'abord `allow pasting`. La ligne copie le jeton dans le presse-papiers, sans l'afficher.
   ```js
   copy(JSON.parse(atob(document.cookie.split('; ').filter(c => c.startsWith('sb-cyrxjeppjqsxxjayfrur-auth-token')).sort().map(c => decodeURIComponent(c.slice(c.indexOf('=') + 1))).join('').replace(/^base64-/, '').replace(/-/g, '+').replace(/_/g, '/'))).refresh_token); 'jeton copié'
   ```
4. **Ferme tout de suite la fenêtre privée, sans te déconnecter** : te déconnecter annulerait le jeton.
5. Enregistre le jeton dans le repo. Lance la commande suivante, colle le jeton (⌘V), puis appuie sur Entrée :
   ```bash
   gh secret set WM_REFRESH_TOKEN --repo OlderGlow/wikimasters
   ```
6. Lance **Classer** avec la case « Aperçu seulement » cochée, pour vérifier que tout marche.

Si la session est un jour refusée, le workflow ouvre une issue « Session WikiMasters expirée », et tu reçois une notification GitHub. Il suffit alors de refaire les étapes 2 à 5 : le nouveau secret remplace l'ancien jeton, et l'issue se ferme toute seule à la connexion suivante. Ça ne devrait arriver que si tu cliques sur « Déconnecter tous les appareils » sur le site, ou si WikiMasters limite un jour la durée des sessions.

GitHub masque les secrets dans les journaux, et les scripts n'affichent aucun jeton ni cookie.

## Les workflows

| Workflow | Quand | Ce qu'il fait |
|---|---|---|
| **Classer** | 4 fois par jour (vers 6 h, 12 h, 17 h et 22 h), ou à la demande | étiquette les cartes qui n'ont encore aucune étiquette, puis publie la répartition et la liste des « à classer » dans le résumé du job. Quand les règles changent, il reprend aussi les cartes « à classer » et range celles qu'il sait désormais classer |
| **Défausser** | à la demande seulement | en deux exécutions : un aperçu, puis la défausse confirmée |
| **Vendre les doublons** | une fois par jour (vers 14 h 53), ou à la demande | met les doublons aux enchères, dans la limite des places libres |
| **Vente auto** | toutes les 3 h | remplit les places d'enchère libres avec des cartes C, PC ou R au hasard, pour 30 min |
| **Tests** | à chaque modification des règles | vérifie `src/classify.js` sur `test/cases.txt` |

Les résultats s'affichent dans le **résumé** de chaque exécution, dans l'onglet Actions.

### Défausser en deux temps

La défausse est **définitive** : chaque carte rapporte 1 wikibidou et disparaît de la collection.

1. Lance **Défausser** sans rien remplir. Le résumé liste les cartes concernées et les cartes protégées. Il donne aussi un **nombre** et un **code**.
2. Si la liste te convient, relance **Défausser** avec ce nombre et ce code.

Le code est une empreinte de la liste. Si une carte a été ajoutée, retirée ou reclassée entre les deux exécutions, il ne correspond plus et rien n'est défaussé : il suffit de refaire un aperçu.

Ne sont jamais défaussées : les cartes favorites, celles engagées dans un échange, les raretés L, UR, SR et R (qui se vendent souvent plus d'un wikibidou au marché), les brillantes et les cartes en plusieurs exemplaires.

### Vendre les doublons

Chaque exemplaire en trop est mis aux enchères, avec pour mise de départ le **prix moyen** de ses ventes passées (même rareté). Tu gardes toujours un exemplaire normal de chaque carte. Les brillantes, les favoris, les cartes engagées dans un échange et celles déjà en vente ne sont jamais mis aux enchères.

Lance **Vendre les doublons** en choisissant la durée des enchères (12 h par défaut) : les cartes sont mises en vente tout de suite, et le résumé les liste avec leur mise. Si tu veux aussi les doublons jamais vendus, coche « tous » : leur mise de départ sera de 1. Pour voir la liste sans rien mettre en vente, coche « Aperçu seulement ».

Une exécution remplit les places d'enchère libres (10 pour un compte Pro, 5 sinon), en commençant par les mises les plus hautes. Les doublons restants sont listés dans le résumé : relance le workflow quand des places se libèrent.

Si le site demande une vérification humaine, le workflow s'arrête : mets toi-même une carte aux enchères sur le site, puis relance.

Le workflow tourne aussi tout seul **une fois par jour, vers 14 h 53** (heure de Paris en hiver), avec des enchères d'**1 h**, sans les doublons jamais vendus. Ce créneau tombe entre deux passages de Vente auto, et les enchères se terminent avant le passage suivant : elles ne lui prennent pas de places. Pour arrêter la vente planifiée, crée la variable `VENTE_DOUBLONS` avec la valeur `off` (supprime-la pour relancer). Le lancement à la main marche toujours :
```bash
gh variable set VENTE_DOUBLONS --body off --repo OlderGlow/wikimasters
```

### Vente auto

Toutes les 3 heures, le workflow remplit les places d'enchère libres avec des cartes **C, PC ou R** tirées au hasard. Chaque enchère dure **30 minutes**, avec pour mise de départ **80 % du prix moyen** de la carte.

- Seules les cartes vendues au moins 3 fois sont mises en vente, pour que le prix moyen soit fiable.
- Jamais de L, UR ni SR, de favori, de brillante, de carte engagée dans un échange ou déjà en vente.
- **40 enchères par jour au plus**, à l'heure de Paris.
- Le résumé de chaque exécution liste les cartes mises en vente avec leur mise.

Une carte unique peut partir : seuls les favoris sont protégés. Mets en favori sur le site les cartes C, PC ou R que tu veux garder.

Si le site demande une vérification humaine, le robot s'arrête et ouvre une issue « Vente auto en pause ». Tu reçois une notification GitHub. Mets toi-même une carte aux enchères sur le site pour passer la vérification, puis ferme l'issue : la vente reprend au passage suivant.

**Pour tout arrêter :** dans Settings → Secrets and variables → Actions → **Variables**, crée la variable `VENTE_AUTO` avec la valeur `off`. Supprime-la pour relancer. Depuis un terminal :
```bash
gh variable set VENTE_AUTO --body off --repo OlderGlow/wikimasters
```

### Horaires

GitHub lance les workflows planifiés « au mieux » : souvent avec une à deux heures de retard, et il en saute parfois. C'est pour ça que Classer a quatre créneaux par jour, et que Vente auto en a un toutes les 3 h. Tu peux toujours lancer un workflow à la main depuis l'onglet Actions.

## Discrétion

- 2,5 à 3,5 s de pause entre deux requêtes à WikiMasters.
- En cas d'erreur 429 ou 5xx : 30 s puis 60 s d'attente, et arrêt après 3 échecs.
- Une seule commande à la fois (`concurrency`).
- Les cartes déjà étiquetées ne sont jamais relues.

Les requêtes partent des serveurs de GitHub et non de chez toi. Si WikiMasters bloque ces adresses, le workflow s'arrête avec un message clair.

## Ajuster le classement

Les règles sont dans `src/classify.js`, qui est la même copie que celle de la commande Claude Code. Pour corriger une carte mal classée :

1. ajoute-la à `test/cases.txt` au format `titre | description | tags attendus` ;
2. corrige la règle ;
3. lance `node test/cases.js` : tous les cas doivent passer ;
4. pousse la modification.

Le classement cloud n'a pas de relecture : contrairement à la commande Claude Code, personne ne corrige les erreurs après coup. Une carte mal classée garde ses étiquettes, sauf si tu les retires sur le site.

## En local

Il faut Node 20 ou plus récent, sans aucune dépendance.

```bash
WM_REFRESH_TOKEN=… WM_KEY=… node src/classer.js --apercu
```

L'API repérée sur le site est décrite dans [`docs/api-notes.md`](docs/api-notes.md).
