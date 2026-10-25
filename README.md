# WikiMasters dans le cloud

Ce repo fait tourner sur GitHub Actions deux commandes pour ta collection [WikiMasters](https://www.wiki-masters.com) : le classement des nouvelles cartes et la défausse des cartes « à classer ». C'est la même logique que les commandes Claude Code `/classer-wiki-masters` et `/defausser-cartes`, mais sans navigateur : le workflow reprend une session WikiMasters que tu as ouverte une fois, grâce à un jeton gardé dans les secrets du repo.

## Mise en place (une seule fois)

La connexion par mot de passe de WikiMasters demande un captcha : un robot ne peut pas l'ouvrir. Le workflow reprend donc une **session ouverte une fois par toi** dans le navigateur, grâce à son jeton de renouvellement. Ensuite, il renouvelle ce jeton tout seul à chaque exécution. Il garde le nouveau jeton chiffré, avec la clé `WM_KEY`, dans le cache GitHub Actions.

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

Si un jour une exécution échoue avec « session refusée », il suffit de refaire les étapes 2 à 5 : le nouveau secret remplace l'ancien jeton. C'est le cas si le workflow n'a pas tourné pendant plus de 7 jours (le cache GitHub expire) ou si tu as cliqué sur « Déconnecter tous les appareils ».

GitHub masque les secrets dans les journaux, et les scripts n'affichent aucun jeton ni cookie.

## Les workflows

| Workflow | Quand | Ce qu'il fait |
|---|---|---|
| **Classer** | tous les jours vers 7 h, ou à la demande | étiquette les cartes qui n'ont encore aucune étiquette, puis publie la répartition et la liste des « à classer » dans le résumé du job |
| **Défausser** | à la demande seulement | en deux exécutions : un aperçu, puis la défausse confirmée |
| **Tests** | à chaque modification des règles | vérifie `src/classify.js` sur `test/cases.txt` |

Les résultats s'affichent dans le **résumé** de chaque exécution, dans l'onglet Actions.

### Défausser en deux temps

La défausse est **définitive** : chaque carte rapporte 1 wikibidou et disparaît de la collection.

1. Lance **Défausser** sans rien remplir. Le résumé liste les cartes concernées et les cartes protégées. Il donne aussi un **nombre** et un **code**.
2. Si la liste te convient, relance **Défausser** avec ce nombre et ce code.

Le code est une empreinte de la liste. Si une carte a été ajoutée, retirée ou reclassée entre les deux exécutions, il ne correspond plus et rien n'est défaussé : il suffit de refaire un aperçu.

Ne sont jamais défaussées : les cartes favorites, celles engagées dans un échange, les raretés L, UR et SR, les brillantes et les cartes en plusieurs exemplaires.

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
