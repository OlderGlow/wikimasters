# API WikiMasters (repérée le 2026-10-22)

Aucune API publique : ce sont les appels que fait le site lui-même. L'authentification passe par le cookie de session Supabase (`sb-…-auth-token.0/.1`), donc tous les appels se font depuis la page, sans recopier de jeton.

## Lecture de la collection

- `GET https://www.wiki-masters.com/api/my-collection?page=<n>` : 50 cartes par page, **les pages commencent à 0**, pas de paramètre de taille trouvé. 175 pages (0 à 174) pour 8 726 cartes. Les pages lointaines sont plus lentes (5 à 10 s).
  - `&untagged=1` : seulement les cartes sans étiquette (utile pour reprendre après un étiquetage).
  - `&sort=rarity` : tri utilisé par l'interface. **À éviter** : depuis le 26 octobre 2026 (≈ 11 000 cartes), il fait expirer la requête (504) ; sans tri, la même page répond en 5 à 6 s.
- Le serveur sature parfois (HTTP 500 « overflow », 503, 504) : attendre une minute avant de réessayer.
  - `collection[]` : `id` (user_card), `card_id`, `tags[]`, `starred`, `count`, `card{ wikipedia_title, category, rarity, wikipedia_url, … }`.
  - `card.category` = description courte façon Wikidata (« acteur américain »). Vide pour ~20 % des cartes.
- `GET /api/my-collection/stats` : `total`, `totalUnique`, `rarityCounts`, `tagOptions`.

## Étiquettes (Supabase, projet `cyrxjeppjqsxxjayfrur`)

Requêtes repérées dans le code du site :

- `tags` : `select * where user_id = <moi>` ; `insert {user_id, name, color}`.
- `user_card_tags` : `insert {user_card_id, tag_id}` ; `upsert [...] onConflict "user_card_id,tag_id", ignoreDuplicates` (le site écrit **en lot**) ; `delete where tag_id = … and user_card_id in (… par 100)`.

## Descriptions manquantes

Récupérées sur fr.wikipedia.org (`action=query&prop=extracts&exintro&exsentences=1`, 20 titres par requête), sans rien demander à WikiMasters.
