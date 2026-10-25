# WikiMasters dans le cloud

Ce repo fait tourner sur GitHub Actions deux commandes pour ta collection [WikiMasters](https://www.wiki-masters.com) : le classement des nouvelles cartes et la défausse des cartes « à classer ». C'est la même logique que les commandes Claude Code `/classer-wiki-masters` et `/defausser-cartes`, mais sans navigateur : le workflow ouvre sa propre session avec ton email et ton mot de passe, gardés dans les secrets du repo.

## Mise en place (une seule fois)

1. Dans le repo sur GitHub, ouvre **Settings → Secrets and variables → Actions → New repository secret** et crée deux secrets :
   - `WM_EMAIL` : l'email de ton compte WikiMasters ;
   - `WM_PASSWORD` : son mot de passe.

   Tu peux aussi les créer depuis un terminal, qui te demandera la valeur sans l'afficher :
   ```bash
   gh secret set WM_EMAIL --repo OlderGlow/wikimasters
   gh secret set WM_PASSWORD --repo OlderGlow/wikimasters
   ```
2. Dans l'onglet **Actions**, lance **Classer** avec la case « Aperçu seulement » cochée. Il lit tes cartes sans étiquette et les classe sans rien écrire : c'est le moyen de vérifier que la connexion marche.

Les secrets ne sont jamais affichés : GitHub les masque dans les journaux, et les scripts n'écrivent ni mot de passe, ni jeton, ni cookie.

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

Les requêtes partent des serveurs de GitHub et non de chez toi. Si WikiMasters bloque ces adresses ou ajoute un captcha à la connexion, le workflow s'arrête avec un message clair.

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
WM_EMAIL=… WM_PASSWORD=… node src/classer.js --apercu
```

L'API repérée sur le site est décrite dans [`docs/api-notes.md`](docs/api-notes.md).
