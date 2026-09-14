# Mycelium — journal des décisions

Récapitulatif de la session de travail : ce qui a été décidé, pourquoi, et
où en est le projet.

---

## 1. Le principe fondateur

Il n'existe **qu'un seul objet : l'Element**. Aucun type narratif imposé —
pas de Character, Scene, Chapter, Arc, Location. L'utilisateur donne du sens
à ses Elements par ce qu'il écrit dedans et par la façon dont il les relie.

La boucle centrale : **CREATE → WRITE → CONNECT → ORGANIZE → EXPLORE**, sans
interruption. Ça doit ressembler à écrire et à penser, jamais à remplir une
base de données.

Quatre systèmes, volontairement **séparés** et jamais fusionnés :

| Système | Répond à | Stockage |
| --- | --- | --- |
| Hiérarchie | l'organisation | `element_links` (multi-parent) |
| Connexions | les liens libres | `relations` + backlinks |
| Tags | le filtrage transversal | `tags` / `element_tags` |
| Chronologie | la position dans le temps | `elements.timeline` + `temporal_relations` |

---

## 2. L'évolution du modèle

### v1 — arbre à parent unique
`elements.parent_id` : un Element, un seul parent. Plus une table
`collections` séparée.

### v2 — graphe multi-parent
Déclencheur : *« Un item peut avoir plusieurs parents bien sûr ! C'est ça que
j'essaie de faire, une app intelligente… je veux une app fluide et organique
où rien n'est figé. »*

- `parent_id` disparaît au profit de **`element_links`** (table de jointure
  parent/enfant, multi-parent).
- La table `collections` disparaît : **une collection = un groupe = un
  Element qui a au moins un enfant**. Aucune table, aucun type.
- Prévention des cycles dans les deux sens : on exclut les *descendants*
  quand on choisit un parent, les *ancêtres* quand on choisit un enfant.

### v3 — la Timeline devient une option, plus un type
Déclencheur : *« TIME ne devrait pas être une famille obligatoire. N'importe
quel Element peut recevoir l'option Timeline. »*

- La colonne **`family` est supprimée**. Il n'existe plus aucun type
  d'Element, pas même technique.
- À la place : **`elements.timeline`** (booléen). Deux dimensions
  optionnelles s'ajoutent à un Element sans le catégoriser — il *est un
  Groupe* parce qu'il a des enfants, il *est dans la chronologie* parce
  qu'on l'y a placé. Les deux, l'une, ou aucune.

> **Pourquoi un booléen** plutôt que de déduire l'appartenance des relations :
> le tout premier Element placé n'a aucun voisin, donc aucune relation ne
> peut exprimer qu'il fait partie de la chronologie.

---

## 3. L'éditeur : trois déclencheurs

| Touche | Effet | Où ça se voit |
| --- | --- | --- |
| `/` | insère une **mention** cliquable | dans le texte |
| `@` | rattache un **parent** | section Parents, sous le texte |
| `+` | rattache un **enfant** | section Enfants, sous le texte |

`@` et `+` n'insèrent **rien** dans le texte : ce sont des actions de
rangement, leur effet apparaît sur la page. Les trois popups permettent aussi
de parcourir les Groupes en profondeur (façon Finder) et de créer un Element
à la volée.

---

## 4. La chronologie

**Ce que voit l'utilisateur** : des emplacements.
**Ce que stocke la base** : des relations `BEFORE`/`AFTER`.

`lib/chronology.ts` est la **seule** frontière où ces relations apparaissent.
Partout ailleurs l'interface dit :

- sur la page d'un Element : « Entre *Mafia* et *Jack* », avec Déplacer /
  Retirer ;
- pour placer : un panneau montre la chronologie et on clique **dans un
  intervalle** ;
- dans la vue Temporel : on glisse une entrée et on la dépose entre deux
  autres.

**Placer et déplacer sont la même opération** : l'Element est détaché de ses
anciens voisins — qu'on relie entre eux pour ne pas trouer la chaîne — puis
rattaché aux nouveaux. En s'insérant entre deux, l'arête directe qui les
reliait est supprimée, sinon la chaîne garderait un raccourci par-dessus le
nouvel arrivant.

Le tri est **déterministe** : à contrainte égale, le plus ancien d'abord —
sinon un Element sauterait de place d'un affichage à l'autre.

Le panneau de placement offre trois façons de viser : parcourir la
chronologie, la filtrer par nom, ou la restreindre à un Groupe. Chaque
intervalle propose aussi de créer un Element sur place.

> **Correction en cours de route** : j'avais affirmé que `BEFORE`/`AFTER` ne
> pouvait pas porter un placement et qu'il faudrait migrer vers des positions
> flottantes. C'était faux : l'insertion *relative à un voisin* est exactement
> ce que ces relations expriment nativement. Aucune migration n'a été
> nécessaire.

---

## 5. Les mises à jour livrées

### Refonte visuelle
- **Suppression totale du jaune**, puis passage au **noir et blanc**.
- **Typographie** : Figtree (géométrique humaniste, dans la lignée d'Avenir
  Next et d'Arboria), servie depuis `public/fonts` — 30 ko, police variable
  400→700. Pas de dépendance à Google Fonts, et surtout pas de changement de
  dessin après coup, très visible sur un titre de 62 px.
- **Règle de couleur** : la couleur n'est pas décorative, c'est un signal.
  Elle veut *toujours* dire « ceci est un lien entre deux Elements ».
  - `/` violet — la mention dans le texte
  - `@` cyan — les parents
  - `+` vert — les enfants
  - fluo plein — les cartes de Groupe
- Tout a été agrandi : titres 40→56 et 46→62, éditeur 17→20, colonne de
  lecture élargie.

### MAJ 1 — les fondations
1. **Plus aucune perte de texte.** Il n'existait qu'un seul chemin de
   sauvegarde (le bouton « Enregistrer ») : écrire puis cliquer sur une
   mention perdait tout. Enregistrement automatique désormais — 800 ms après
   la dernière frappe, **et** au départ de la page.
2. **Les erreurs remontent à l'écran.** Aucune erreur n'était lue nulle
   part : une table absente donnait le même écran qu'un dossier vide. Les
   deux caches React Query remontent maintenant dans un bandeau qui dit quoi
   faire, plus un `ErrorBoundary`. Les erreurs Postgres ne sont plus
   réessayées (on attendait 7 s pour voir le message).
3. **Bug des Groupes corrigé.** Le Dashboard ne montrait que les Groupes
   *racines* : ranger un Groupe dans un autre le faisait disparaître, donc
   l'affichage se vidait à mesure qu'on organisait.
4. **Quatre angles** en vraies routes : Groupes · Éléments · Temporel ·
   Connexions. La barre de capture écrit désormais dans le **texte**, plus
   dans le titre — conséquence assumée : les Elements sans nom s'affichent
   partout par leurs premiers mots, en italique gris.

### MAJ 2 — la Timeline comme dimension
- `family` supprimée, `timeline` ajoutée (voir §2).
- Placement, insertion entre deux, retrait (les voisins se rejoignent),
  glisser-déposer dans la vue Temporel.
- Le sélecteur « Avant… / Après… » disparaît de Connexions.
- **Panneau latéral** : parents *et* enfants cliquables, chaque clic restant
  dans le panneau — explorer sans quitter sa page.
- **Connexions** : filtres combinables (liens, hiérarchie, chronologie,
  Groupe, Tag, recherche texte), **aucun graphe**.

### Schéma SQL rejouable
`supabase/schema.sql` plantait dès la deuxième exécution. Il est maintenant
**idempotent et auto-migrant** : sur une base vide il installe tout, sur une
base existante il ne crée que ce qui manque. Les Elements de l'ancienne
famille `TIME` entrent automatiquement dans la chronologie ; une hiérarchie
encore dans `parent_id` (v1) est reversée dans `element_links`.

Vérifié sur un PostgreSQL 16 réel : installation à vide, trois exécutions
successives, migration v2→v3 avec données, migration v1→v3.

---

## 6. Appliquer le schéma

1. Ouvrir <https://raw.githubusercontent.com/jamescegri/mycelium/main/supabase/schema.sql>
2. Tout sélectionner (Ctrl+A) et copier (Ctrl+C)
3. Supabase → **SQL Editor** → **New query** → coller → **Run**

Les lignes grises `NOTICE: ... skipping` sont normales. Seul du rouge
`ERROR` est un problème.

**Si l'app dit « Could not find the table … in the schema cache »** : la
table existe mais Supabase garde l'ancienne structure en mémoire. Exécuter :

```sql
NOTIFY pgrst, 'reload schema';
```

---

## 7. État des tests

Cinq suites Playwright tournent contre une API Supabase simulée :

| Suite | Couvre |
| --- | --- |
| `v2-test` | multi-parent, les trois déclencheurs, anti-cycle, capture |
| `browse-test` | parcours des Groupes dans les popups |
| `full-regression` | tags, relations, corbeille, palette, auth |
| `maj1-test` | autosave, erreurs visibles, Groupes imbriqués, liste plate |
| `maj2-test` | placement, insertion entre deux, retrait, glisser-déposer, filtres |

**Total : 74 vérifications, 0 échec.** Lint sans erreur, build OK.

---

## 8. Différé volontairement

- **Refonte UX/UI en profondeur** (moins de cadres, navigation par niveaux,
  écriture au centre) — spécifiée puis mise de côté, à reprendre.
- **Connexions façon Obsidian** (graphe visuel) — explicitement écarté :
  la vue Connexions privilégie recherche et filtres.
- Aucune IA, aucun générateur de scénario : le cœur doit être excellent
  d'abord.

## 9. Point ouvert

Le déploiement Cloudflare. La branche `main` a été créée et reçoit tous les
commits, mais la branche de production se règle dans le dashboard Cloudflare
(Workers & Pages → projet → Settings → Build → Branch control) — pas dans le
dépôt, qui ne contient ni `wrangler.toml` ni workflow GitHub.
